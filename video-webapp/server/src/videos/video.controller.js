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
import { AppError } from '../utils/errors.js';
import { getConfig } from '../config.js';
import { cacheGet, cacheSet } from '../aws/cache.js';

export const uploadVideo = async (req, res) => {
  const videoId = await handleUpload(req.user.id, req.file);
  res.status(201).json({ videoId });
};

export const listUserVideos = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10));
  const rawLimit = Number.parseInt(req.query.limit || '10', 10);
  const limit = Math.min(Math.max(rawLimit || 10, 1), 50);
  const result = await listVideos(req.user.id, page, limit);
  res.json({ page, limit, ...result });
};

export const getVideo = async (req, res) => {
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
  const video = await getVideoByIdForUser(req.params.id, req.user.id);
  const url = await getThumbnailUrl(video);
  res.redirect(url);
};

export const removeVideo = async (req, res) => {
  const video = await getVideoByIdForUser(req.params.id, req.user.id);
  await deleteVideo(video);
  res.json({ message: 'Video deleted' });
};

export const getPresignedDownload = async (req, res) => {
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
