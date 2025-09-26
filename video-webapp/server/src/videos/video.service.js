import path from 'path';
import fs from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';
import ffmpeg from 'fluent-ffmpeg';
import mime from 'mime-types';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  QueryCommand
} from '@aws-sdk/lib-dynamodb';
import { AppError, NotFoundError } from '../utils/errors.js';
import { getConfig } from '../config.js';
import { getDocumentClient, getS3Client } from '../aws/clients.js';

const ensureTrailingSlash = (value) => (value.endsWith('/') ? value : `${value}/`);

const joinKey = (...segments) =>
  segments
    .filter(Boolean)
    .map((segment) => `${segment}`.replace(/^\/+/g, '').replace(/\/+$/g, ''))
    .join('/');

const sanitizeName = (name, fallback) => {
  if (!name) return fallback;
  const ext = path.extname(name);
  const base = path.basename(name, ext);
  const safeBase = base.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return `${safeBase || fallback}${ext || ''}`;
};

const withTempDir = async (callback) => {
  const tempDir = await fs.mkdtemp(path.join(tmpdir(), 'video-app-'));
  try {
    return await callback(tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
};

const probeVideo = (filePath) => new Promise((resolve, reject) => {
  ffmpeg.ffprobe(filePath, (err, data) => {
    if (err) return reject(err);
    return resolve(data);
  });
});

const generateThumbnail = (inputPath, outputPath, options) => new Promise((resolve, reject) => {
  ffmpeg(inputPath)
    .on('error', reject)
    .on('end', resolve)
    .screenshots({
      timestamps: options.timestamps || ['2'],
      filename: path.basename(outputPath),
      folder: path.dirname(outputPath),
      size: options.size || '640x?'
    });
});

const mapItemToVideo = (item) => ({
  id: item.videoId,
  ownerId: item.ownerId,
  originalName: item.filename,
  status: item.status,
  s3Key: item.s3Key,
  transcodedKey: item.transcodedKey || null,
  transcodedFilename: item.transcodedFilename || null,
  thumbKey: item.thumbKey || null,
  durationSec: item.durationSec != null ? Number(item.durationSec) : null,
  format: item.format || null,
  mimeType: item.mimeType || null,
  width: item.width != null ? Number(item.width) : null,
  height: item.height != null ? Number(item.height) : null,
  sizeBytes: item.sizeBytes != null ? Number(item.sizeBytes) : null,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt
});

const createSignedUrlForKey = async (key, { download = false, filename, contentType } = {}) => {
  if (!key) return null;
  const config = getConfig();
  const s3 = getS3Client();
  const command = new GetObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: key,
    ResponseContentDisposition: download && filename
      ? `attachment; filename="${filename.replace(/"/g, '')}"`
      : undefined,
    ResponseContentType: contentType
  });
  const url = await getSignedUrl(s3, command, { expiresIn: config.PRESIGNED_TTL_SECONDS });
  return { url, expiresIn: config.PRESIGNED_TTL_SECONDS, key };
};

const loadAllVideosForOwner = async (ownerId) => {
  const config = getConfig();
  const client = getDocumentClient();
  const items = [];
  let exclusiveStartKey;

  do {
    const response = await client.send(new QueryCommand({
      TableName: config.DYNAMO_TABLE,
      IndexName: config.DYNAMO_OWNER_INDEX,
      KeyConditionExpression: 'ownerId = :ownerId',
      ExpressionAttributeValues: { ':ownerId': ownerId },
      ScanIndexForward: false,
      ExclusiveStartKey: exclusiveStartKey
    }));

    if (response.Items) {
      items.push(...response.Items);
    }
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return items;
};

export async function handleUpload (ownerId, file) {
  if (!file) {
    throw new AppError('No file uploaded', 400, 'NO_FILE');
  }

  const config = getConfig();
  const client = getDocumentClient();
  const s3 = getS3Client();
  const videoId = randomUUID();
  const extension = path.extname(file.originalname) || '.mp4';
  const storedFilename = sanitizeName(file.originalname, `video-${videoId}${extension}`);
  const bucket = config.S3_BUCKET;
  const rawPrefix = ensureTrailingSlash(config.S3_RAW_PREFIX);
  const thumbnailPrefix = ensureTrailingSlash(config.S3_THUMBNAIL_PREFIX);
  const rawKey = joinKey(rawPrefix, videoId, storedFilename);
  const thumbKey = joinKey(thumbnailPrefix, videoId, `${videoId}.jpg`);
  const now = new Date().toISOString();

  const { format, durationSec, width, height } = await withTempDir(async (tempDir) => {
    const tempVideoPath = path.join(tempDir, storedFilename);
    await fs.writeFile(tempVideoPath, file.buffer);

    const metadata = await probeVideo(tempVideoPath);
    const videoStream = metadata.streams?.find((stream) => stream.codec_type === 'video');
    const duration = metadata.format?.duration ? Number.parseFloat(metadata.format.duration) : null;
    const derivedFormat = metadata.format?.format_name || file.mimetype || 'video/mp4';

    const thumbnailPath = path.join(tempDir, `${videoId}.jpg`);
    await generateThumbnail(tempVideoPath, thumbnailPath, config.THUMBNAIL_OPTIONS);
    const thumbnailBuffer = await fs.readFile(thumbnailPath);

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: thumbKey,
      Body: thumbnailBuffer,
      ContentType: 'image/jpeg',
      Metadata: { videoId }
    }));

    return {
      format: derivedFormat,
      durationSec: duration,
      width: videoStream?.width || null,
      height: videoStream?.height || null
    };
  });

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: rawKey,
    Body: file.buffer,
    ContentType: file.mimetype || mime.lookup(extension) || 'video/mp4',
    Metadata: { originalfilename: file.originalname }
  }));

  await client.send(new PutCommand({
    TableName: config.DYNAMO_TABLE,
    Item: {
      videoId,
      ownerId,
      filename: file.originalname,
      status: 'uploaded',
      s3Key: rawKey,
      thumbKey,
      createdAt: now,
      updatedAt: now,
      sizeBytes: file.size,
      format,
      durationSec,
      width,
      height,
      mimeType: file.mimetype || format,
      transcodedKey: null,
      transcodedFilename: null
    }
  }));

  return videoId;
}

export async function listVideos (ownerId, page, limit) {
  const items = await loadAllVideosForOwner(ownerId);
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const total = items.length;
  const offset = (page - 1) * limit;
  const slice = items.slice(offset, offset + limit);

  const videos = await Promise.all(
    slice.map(async (item) => {
      const video = mapItemToVideo(item);
      if (video.thumbKey) {
        const signedThumb = await createSignedUrlForKey(video.thumbKey, {
          contentType: 'image/jpeg'
        });
        video.thumbnailUrl = signedThumb?.url || null;
      }
      return video;
    })
  );

  return { total, items: videos };
}

export async function getVideoByIdForUser (id, ownerId, { includeSignedThumbnail = false } = {}) {
  const config = getConfig();
  const client = getDocumentClient();
  const response = await client.send(new GetCommand({
    TableName: config.DYNAMO_TABLE,
    Key: { videoId: id, ownerId }
  }));

  if (!response.Item) {
    throw new NotFoundError('Video not found');
  }

  const video = mapItemToVideo(response.Item);

  if (includeSignedThumbnail && video.thumbKey) {
    const signedThumb = await createSignedUrlForKey(video.thumbKey, {
      contentType: 'image/jpeg'
    });
    video.thumbnailUrl = signedThumb?.url || null;
  }

  return video;
}

const resolveVariantKey = (video, variant = 'original') => {
  if (variant === 'transcoded') {
    if (!video.transcodedKey) {
      throw new AppError('Transcoded file not yet available', 409, 'TRANSCODE_PENDING');
    }
    return { key: video.transcodedKey, filename: video.transcodedFilename || sanitizeName(`${video.originalName}-720p.mp4`, `${video.id}-720p.mp4`) };
  }
  if (!video.s3Key) {
    throw new NotFoundError('Original video missing');
  }
  return { key: video.s3Key, filename: sanitizeName(video.originalName, `${video.id}${path.extname(video.originalName) || '.mp4'}`) };
};

export async function createVideoStream (video, { variant, range, download }) {
  const config = getConfig();
  const s3 = getS3Client();
  const { key, filename } = resolveVariantKey(video, variant);
  const command = new GetObjectCommand({
    Bucket: config.S3_BUCKET,
    Key: key,
    Range: range || undefined,
    ResponseContentDisposition: download ? `attachment; filename="${filename.replace(/"/g, '')}"` : undefined
  });

  const response = await s3.send(command);
  const bodyStream = response.Body;
  if (!bodyStream) {
    throw new AppError('Unable to stream video from S3', 500, 'S3_STREAM_FAILED');
  }

  const headers = {
    'Content-Type': response.ContentType || video.mimeType || 'application/octet-stream',
    'Accept-Ranges': 'bytes'
  };

  if (response.ContentLength != null) {
    headers['Content-Length'] = `${response.ContentLength}`;
  }
  if (response.ContentRange) {
    headers['Content-Range'] = response.ContentRange;
  }
  if (download) {
    headers['Content-Disposition'] = response.ContentDisposition || `attachment; filename="${filename.replace(/"/g, '')}"`;
  }

  const statusCode = range ? 206 : 200;

  return { stream: bodyStream, headers, statusCode };
}

export async function getThumbnailUrl (video) {
  if (!video.thumbKey) {
    throw new NotFoundError('Thumbnail not generated yet');
  }
  const signed = await createSignedUrlForKey(video.thumbKey, { contentType: 'image/jpeg' });
  if (!signed) {
    throw new NotFoundError('Thumbnail missing in storage');
  }
  return signed.url;
}

export async function deleteVideo (video) {
  const config = getConfig();
  const client = getDocumentClient();
  const s3 = getS3Client();
  const keys = [video.s3Key, video.transcodedKey, video.thumbKey].filter(Boolean);
  await Promise.all(
    keys.map((key) =>
      s3.send(
        new DeleteObjectCommand({
          Bucket: config.S3_BUCKET,
          Key: key
        })
      ).catch((error) => {
        console.warn(`Failed to delete ${key} from S3`, error.message);
      })
    )
  );

  await client.send(new DeleteCommand({
    TableName: config.DYNAMO_TABLE,
    Key: { videoId: video.id, ownerId: video.ownerId }
  }));
}

const downloadS3ObjectTo = async (bucket, key, destinationPath) => {
  const s3 = getS3Client();
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!response.Body) {
    throw new AppError('Failed to download source video for transcoding', 500, 'DOWNLOAD_FAILED');
  }
  await pipeline(response.Body, createWriteStream(destinationPath));
};

export async function transcodeVideo (video, preset = '720p') {
  const config = getConfig();
  const client = getDocumentClient();
  const s3 = getS3Client();
  const bucket = config.S3_BUCKET;
  const { key: sourceKey } = resolveVariantKey(video, 'original');

  const startTime = new Date().toISOString();
  await client.send(new UpdateCommand({
    TableName: config.DYNAMO_TABLE,
    Key: { videoId: video.id, ownerId: video.ownerId },
    UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':status': 'transcoding', ':updatedAt': startTime }
  }));

  const outputFilename = `${path.parse(video.originalName || 'video').name}-${preset}.mp4`;
  const transcodedPrefix = ensureTrailingSlash(config.S3_TRANSCODED_PREFIX);
  const outputKey = joinKey(transcodedPrefix, video.id, sanitizeName(outputFilename, `${video.id}-${preset}.mp4`));

  try {
    await withTempDir(async (tempDir) => {
      const inputPath = path.join(
        tempDir,
        sanitizeName(video.originalName, `${video.id}${path.extname(video.originalName) || '.mp4'}`)
      );
      const outputPath = path.join(tempDir, sanitizeName(outputFilename, `${video.id}-${preset}.mp4`));

      await downloadS3ObjectTo(bucket, sourceKey, inputPath);

      await new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath)
          .outputOptions(config.TRANSCODE_OPTIONS)
          .format('mp4')
          .on('error', reject)
          .on('end', resolve)
          .save(outputPath);

        command.on('start', () => {
          console.log(`Transcoding ${video.id} to ${preset}`);
        });
      });

      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: outputKey,
        Body: createReadStream(outputPath),
        ContentType: 'video/mp4',
        Metadata: { source: sourceKey }
      }));
    });

    await client.send(new UpdateCommand({
      TableName: config.DYNAMO_TABLE,
      Key: { videoId: video.id, ownerId: video.ownerId },
      UpdateExpression: 'SET #status = :status, transcodedKey = :key, transcodedFilename = :filename, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':status': 'ready',
        ':key': outputKey,
        ':filename': path.basename(outputKey),
        ':updatedAt': new Date().toISOString()
      }
    }));
  } catch (error) {
    await client.send(new UpdateCommand({
      TableName: config.DYNAMO_TABLE,
      Key: { videoId: video.id, ownerId: video.ownerId },
      UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':status': 'failed', ':updatedAt': new Date().toISOString() }
    }));
    console.error(`Transcode failed for video ${video.id}`, error);
    throw new AppError('Transcoding failed', 500, 'TRANSCODE_FAILED');
  }
}

export async function createPresignedUrl (video, { variant = 'original', download = true } = {}) {
  const { key, filename } = resolveVariantKey(video, variant);
  const signed = await createSignedUrlForKey(key, {
    download,
    filename,
    contentType: video.mimeType || mime.lookup(filename) || 'application/octet-stream'
  });
  if (!signed) {
    throw new NotFoundError('Unable to create pre-signed URL');
  }
  return {
    variant,
    download,
    url: signed.url,
    expiresIn: signed.expiresIn
  };
}
