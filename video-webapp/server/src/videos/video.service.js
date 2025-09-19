import path from 'path';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import mime from 'mime-types';
import config from '../config.js';
import { getDb } from '../db.js';
import { AppError, NotFoundError } from '../utils/errors.js';

export async function ensureStorageDirs () {
  await fs.mkdir(config.PUBLIC_VIDEOS_DIR, { recursive: true });
  await fs.mkdir(config.PUBLIC_THUMBS_DIR, { recursive: true });
}

const probeVideo = (filePath) => new Promise((resolve, reject) => {
  ffmpeg.ffprobe(filePath, (err, data) => {
    if (err) return reject(err);
    return resolve(data);
  });
});

const generateThumbnail = (inputPath, outputPath) => new Promise((resolve, reject) => {
  ffmpeg(inputPath)
    .on('error', reject)
    .on('end', resolve)
    .screenshots({
      timestamps: ['2'],
      filename: path.basename(outputPath),
      folder: path.dirname(outputPath),
      size: '640x?'
    });
});

const mapVideoRow = (row) => ({
  id: row.id,
  userId: row.userId,
  originalName: row.originalName,
  storedFilename: row.storedFilename,
  format: row.format,
  durationSec: row.durationSec != null ? Number(row.durationSec) : null,
  status: row.status,
  width: row.width != null ? Number(row.width) : null,
  height: row.height != null ? Number(row.height) : null,
  sizeBytes: row.sizeBytes != null ? Number(row.sizeBytes) : null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
  thumbPath: row.thumbPath,
  transcodedFilename: row.transcodedFilename
});

export async function handleUpload (userId, file) {
  if (!file) {
    throw new AppError('No file uploaded', 400, 'NO_FILE');
  }

  const absolutePath = path.join(config.PUBLIC_VIDEOS_DIR, file.filename);
  try {
    const metadata = await probeVideo(absolutePath);
    const videoStream = metadata.streams.find((stream) => stream.codec_type === 'video');
    const duration = metadata.format?.duration ? Number.parseFloat(metadata.format.duration) : null;
    const format = metadata.format?.format_name || file.mimetype;

    const baseName = path.parse(file.filename).name;
    const thumbFile = `${baseName}.jpg`;
    const thumbAbsolute = path.join(config.PUBLIC_THUMBS_DIR, thumbFile);

    await generateThumbnail(absolutePath, thumbAbsolute);

    const relativeThumb = path.relative(config.PUBLIC_DIR, thumbAbsolute);
    const now = new Date().toISOString();

    const db = await getDb();
    const result = await db.run(
      `INSERT INTO videos (
        userId, originalName, storedFilename, format, durationSec, status,
        width, height, sizeBytes, createdAt, updatedAt, thumbPath
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      userId,
      file.originalname,
      file.filename,
      format,
      duration,
      'uploaded',
      videoStream?.width || null,
      videoStream?.height || null,
      file.size,
      now,
      now,
      relativeThumb
    );

    return result.lastID;
  } catch (error) {
    console.error('Upload processing failed', error);
    await fs.unlink(absolutePath).catch(() => {});
    throw new AppError('Unable to process uploaded video', 500, 'UPLOAD_PROCESSING_FAILED');
  }
}

export async function listVideos (userId, page, limit) {
  const db = await getDb();
  const totalRow = await db.get('SELECT COUNT(*) as count FROM videos WHERE userId = ?', userId);
  const total = totalRow ? Number(totalRow.count) : 0;
  const offset = (page - 1) * limit;
  const rows = await db.all(
    'SELECT * FROM videos WHERE userId = ? ORDER BY datetime(createdAt) DESC LIMIT ? OFFSET ?',
    userId,
    limit,
    offset
  );
  return {
    total,
    items: rows.map(mapVideoRow)
  };
}

export async function getVideoByIdForUser (id, userId) {
  const db = await getDb();
  const row = await db.get('SELECT * FROM videos WHERE id = ? AND userId = ?', id, userId);
  if (!row) {
    throw new NotFoundError('Video not found');
  }
  return mapVideoRow(row);
}

export async function getVideoFile (video, variant = 'original') {
  const useTranscoded = variant === 'transcoded' && video.transcodedFilename;
  const filename = useTranscoded ? video.transcodedFilename : video.storedFilename;
  if (!filename) {
    throw new NotFoundError('Requested video file not available');
  }
  const filePath = path.join(config.PUBLIC_VIDEOS_DIR, filename);
  let stats;
  try {
    stats = await fs.stat(filePath);
  } catch (error) {
    if (useTranscoded) {
      throw new AppError('Transcoded file not yet available', 409, 'TRANSCODE_PENDING');
    }
    throw new NotFoundError('Video file missing on disk');
  }

  const mimeType = mime.lookup(filePath) || 'application/octet-stream';
  return {
    filePath,
    filename,
    size: stats.size,
    mimeType
  };
}

export const openVideoReadStream = (filePath, options) => createReadStream(filePath, options);

export async function getThumbnailPath (video) {
  if (!video.thumbPath) {
    throw new NotFoundError('Thumbnail not generated yet');
  }
  const absolute = path.join(config.PUBLIC_DIR, video.thumbPath);
  await fs.access(absolute).catch(() => {
    throw new NotFoundError('Thumbnail file missing');
  });
  return absolute;
}

export async function deleteVideo (video) {
  const targets = [];
  if (video.storedFilename) {
    targets.push(path.join(config.PUBLIC_VIDEOS_DIR, video.storedFilename));
  }
  if (video.transcodedFilename) {
    targets.push(path.join(config.PUBLIC_VIDEOS_DIR, video.transcodedFilename));
  }
  if (video.thumbPath) {
    targets.push(path.join(config.PUBLIC_DIR, video.thumbPath));
  }

  await Promise.all(targets.map((filePath) => fs.unlink(filePath).catch(() => {})));
  const db = await getDb();
  await db.run('DELETE FROM videos WHERE id = ?', video.id);
}

export async function transcodeVideo (video, preset = '720p') {
  if (video.status === 'transcoding') {
    throw new AppError('Video is already transcoding', 409, 'ALREADY_TRANSCODING');
  }
  const inputPath = path.join(config.PUBLIC_VIDEOS_DIR, video.storedFilename);
  try {
    await fs.access(inputPath);
  } catch (error) {
    throw new NotFoundError('Original video file missing');
  }

  const outputName = `${path.parse(video.storedFilename).name}-${preset}.mp4`;
  const outputPath = path.join(config.PUBLIC_VIDEOS_DIR, outputName);
  await fs.unlink(outputPath).catch(() => {});

  const db = await getDb();
  const startedAt = new Date().toISOString();
  await db.run('UPDATE videos SET status = ?, updatedAt = ? WHERE id = ?', 'transcoding', startedAt, video.id);

  console.log(`Starting ffmpeg transcode for video ${video.id} -> ${outputName}`);

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-c:v libx264',
        '-preset fast',
        '-crf 23',
        '-vf scale=1280:-2',
        '-c:a aac',
        '-b:a 128k',
        '-movflags +faststart'
      ])
      .format('mp4')
      .on('error', async (error) => {
        console.error(`ffmpeg failed for video ${video.id}`, error);
        await db.run('UPDATE videos SET status = ?, updatedAt = ? WHERE id = ?', 'failed', new Date().toISOString(), video.id);
        reject(new AppError('Transcoding failed', 500, 'TRANSCODE_FAILED'));
      })
      .on('end', async () => {
        console.log(`ffmpeg completed for video ${video.id}`);
        await db.run(
          'UPDATE videos SET status = ?, transcodedFilename = ?, updatedAt = ? WHERE id = ?',
          'ready',
          outputName,
          new Date().toISOString(),
          video.id
        );
        resolve(outputName);
      })
      .save(outputPath);
  });
}
