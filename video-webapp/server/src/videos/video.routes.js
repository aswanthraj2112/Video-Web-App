import express from 'express';
import multer from 'multer';
import { z } from 'zod';
import { loadConfig, getConfig } from '../awsConfig.js';
import authMiddleware from '../auth/auth.middleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import { AppError } from '../utils/errors.js';
import {
  uploadVideo,
  listUserVideos,
  getVideo,
  streamVideo,
  requestTranscode,
  serveThumbnail,
  removeVideo,
  getPresignedDownload
} from './video.controller.js';

await loadConfig();
const config = getConfig();

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new AppError('Only video files are allowed', 400, 'INVALID_FILE_TYPE'));
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: {
    fileSize: config.LIMIT_FILE_SIZE_MB * 1024 * 1024
  }
});

const transcodeSchema = z.object({
  preset: z.string().optional()
});

const presignSchema = z.object({
  variant: z.enum(['original', 'transcoded']).optional(),
  download: z.coerce.boolean().optional()
});

const router = express.Router();

router.use(authMiddleware);

router.post('/upload', upload.single('file'), asyncHandler(uploadVideo));
router.get('/', asyncHandler(listUserVideos));
router.get('/:id', asyncHandler(getVideo));
router.get('/:id/stream', asyncHandler(streamVideo));
router.post('/:id/transcode', (req, res, next) => {
  req.validatedBody = transcodeSchema.parse(req.body);
  next();
}, asyncHandler(requestTranscode));
router.get('/:id/thumbnail', asyncHandler(serveThumbnail));
router.delete('/:id', asyncHandler(removeVideo));
router.get('/:id/presigned', (req, res, next) => {
  try {
    req.validatedQuery = presignSchema.parse(req.query);
    next();
  } catch (error) {
    next(new AppError(error.message, 400, 'INVALID_QUERY'));
  }
}, asyncHandler(getPresignedDownload));

export default router;
