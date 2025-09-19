import {
  ensureStorageDirs,
  handleUpload,
  listVideos,
  getVideoByIdForUser,
  getVideoFile,
  openVideoReadStream,
  getThumbnailPath,
  deleteVideo,
  transcodeVideo
} from './video.service.js';
import { AppError } from '../utils/errors.js';

const DEFAULT_CHUNK_SIZE = 1 * 1024 * 1024; // 1MB

export { ensureStorageDirs };

export const uploadVideo = async (req, res) => {
  const videoId = await handleUpload(req.user.id, req.file);
  res.status(201).json({ videoId });
};

export const listUserVideos = async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page || '1', 10));
  const rawLimit = Number.parseInt(req.query.limit || '10', 10);
  const limit = Math.min(Math.max(rawLimit || 10, 1), 50);
  const { total, items } = await listVideos(req.user.id, page, limit);
  res.json({ page, limit, total, items });
};

export const getVideo = async (req, res) => {
  const video = await getVideoByIdForUser(req.params.id, req.user.id);
  res.json({ video });
};

export const streamVideo = async (req, res) => {
  const variant = req.query.variant === 'transcoded' ? 'transcoded' : 'original';
  const download = req.query.download === '1' || req.query.download === 'true';
  const video = await getVideoByIdForUser(req.params.id, req.user.id);
  const file = await getVideoFile(video, variant);
  const range = req.headers.range;
  const fileSize = file.size;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = Number.parseInt(parts[0], 10);
    const end = parts[1] ? Number.parseInt(parts[1], 10) : Math.min(start + DEFAULT_CHUNK_SIZE, fileSize - 1);

    if (Number.isNaN(start) || Number.isNaN(end)) {
      throw new AppError('Invalid Range header', 416, 'INVALID_RANGE');
    }

    const chunkSize = end - start + 1;
    const stream = openVideoReadStream(file.filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': file.mimeType
    });
    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    }
    stream.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': file.mimeType,
      'Accept-Ranges': 'bytes'
    });
    if (download) {
      res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    }
    openVideoReadStream(file.filePath).pipe(res);
  }
};

export const requestTranscode = async (req, res) => {
  const preset = (req.validatedBody?.preset || '720p').toLowerCase();
  if (preset !== '720p') {
    throw new AppError('Unsupported preset', 400, 'UNSUPPORTED_PRESET');
  }
  const video = await getVideoByIdForUser(req.params.id, req.user.id);
  await transcodeVideo(video, preset);
  res.json({ message: 'Transcode started' });
};

export const serveThumbnail = async (req, res) => {
  const video = await getVideoByIdForUser(req.params.id, req.user.id);
  const thumbnailPath = await getThumbnailPath(video);
  res.sendFile(thumbnailPath);
};

export const removeVideo = async (req, res) => {
  const video = await getVideoByIdForUser(req.params.id, req.user.id);
  await deleteVideo(video);
  res.json({ message: 'Video deleted' });
};
