import {
  handleUpload,
  listVideos,
  getVideoByIdForUser,
  createVideoStream,
  transcodeVideo,
  getThumbnailUrl,
  deleteVideo,
  createPresignedUrl
} from './video.service.js';
import {
  devUploadVideo,
  devListVideos,
  devGetVideo,
  devDeleteVideo,
  devGetPresignedUrl
} from './dev-video.service.js';
import { AppError } from '../utils/errors.js';
import { getConfig } from '../config.js';
import { cacheGet, cacheSet } from '../aws/cache.js';
import { useAwsServices } from '../utils/runtime.js';

const shouldUseAws = () => useAwsServices();

export const uploadVideo = async (req, res) => {
  if (!shouldUseAws()) {
    console.log('🚧 Using development video upload');
    const video = await devUploadVideo(req.user.id, req.file);
    return res.status(201).json({ videoId: video.id, video });
  }

  const videoId = await handleUpload(req.user.id, req.file);
  res.status(201).json({ videoId });
};

export const listUserVideos = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10));
  const rawLimit = Number.parseInt(req.query.limit || '10', 10);
  const limit = Math.min(Math.max(rawLimit || 10, 1), 50);
  
  if (!shouldUseAws()) {
    console.log('🚧 Using development video listing');
    const result = await devListVideos(req.user.id, page, limit);
    return res.json({ page, limit, ...result });
  }

  const result = await listVideos(req.user.id, page, limit);
  res.json({ page, limit, ...result });
};

export const getVideo = async (req, res) => {
  if (!shouldUseAws()) {
    console.log('🚧 Using development video get');
    const video = await devGetVideo(req.params.id, req.user.id);
    return res.json({ video });
  }

  const cacheKey = `video:${req.user.id}:${req.params.id}:metadata`;
  const cached = await cacheGet(cacheKey);
  if (cached) {
    return res.json({ video: cached });
  }

  const video = await getVideoByIdForUser(req.params.id, req.user.id, { includeSignedThumbnail: true });
  const config = getConfig();
  await cacheSet(cacheKey, video, config.PRESIGNED_TTL_SECONDS);
  res.json({ video });
};

export const streamVideo = async (req, res) => {
  if (!shouldUseAws()) {
    return res.status(501).json({ message: 'Video streaming is unavailable in development mode' });
  }
  const variant = req.query.variant === 'transcoded' ? 'transcoded' : 'original';
  const download = req.query.download === '1' || req.query.download === 'true';
  const range = req.headers.range || null;
  const video = await getVideoByIdForUser(req.params.id, req.user.id);
  const { stream, statusCode, headers } = await createVideoStream(video, {
    variant,
    range,
    download
  });
  res.writeHead(statusCode, headers);
  stream.pipe(res);
};

export const requestTranscode = async (req, res) => {
  if (!shouldUseAws()) {
    return res.status(501).json({ message: 'Transcoding is unavailable in development mode' });
  }
  const preset = (req.validatedBody?.preset || '720p').toLowerCase();
  const { FFMPEG_PRESETS } = getConfig();
  if (!FFMPEG_PRESETS?.[preset]) {
    throw new AppError('Unsupported preset', 400, 'UNSUPPORTED_PRESET');
  }
  const video = await getVideoByIdForUser(req.params.id, req.user.id);
  await transcodeVideo(video, preset);
  res.json({ message: 'Transcode started' });
};

export const serveThumbnail = async (req, res) => {
  if (!shouldUseAws()) {
    const video = await devGetVideo(req.params.id, req.user.id);
    return res.redirect(`/dev-storage/thumbnails/${video.id}-thumb.jpg`);
  }
  const video = await getVideoByIdForUser(req.params.id, req.user.id);
  const url = await getThumbnailUrl(video);
  res.redirect(url);
};

export const removeVideo = async (req, res) => {
  if (!shouldUseAws()) {
    await devDeleteVideo(req.params.id, req.user.id);
    return res.json({ message: 'Video deleted' });
  }
  const video = await getVideoByIdForUser(req.params.id, req.user.id);
  await deleteVideo(video);
  res.json({ message: 'Video deleted' });
};

export const getPresignedDownload = async (req, res) => {
  if (!shouldUseAws()) {
    console.log('🚧 Using development presigned URL');
    const variant = req.validatedQuery?.variant || 'original';
    const download = req.validatedQuery?.download ?? true;

    try {
      const payload = await devGetPresignedUrl(req.params.id, req.user.id, variant, download);
      return res.json(payload);
    } catch (error) {
      throw new AppError(error.message, 404, 'VIDEO_NOT_FOUND');
    }
  }

  const config = getConfig();
  const variant = req.validatedQuery?.variant || 'original';
  const download = req.validatedQuery?.download ?? true;
  const cacheKey = `video:${req.user.id}:${req.params.id}:presigned:${variant}:${download ? '1' : '0'}`;

  const cached = await cacheGet(cacheKey);
  if (cached) {
    return res.json(cached);
  }

  const video = await getVideoByIdForUser(req.params.id, req.user.id);
  const payload = await createPresignedUrl(video, { variant, download });
  await cacheSet(cacheKey, payload, config.PRESIGNED_TTL_SECONDS);
  res.json(payload);
};
