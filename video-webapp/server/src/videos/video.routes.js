import express from 'express';
import multer from 'multer';
import path from 'path';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import config from '../config.js';
import authMiddleware from '../auth/auth.middleware.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validateBody } from '../utils/validate.js';
import { AppError } from '../utils/errors.js';
import {
  uploadVideo,
  listUserVideos,
  getVideo,
  streamVideo,
  requestTranscode,
  serveThumbnail,
  removeVideo
} from './video.controller.js';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, config.PUBLIC_VIDEOS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.mp4';
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith('video/')) {
    cb(null, true);
  } else {
    cb(new AppError('Only video files are allowed', 400, 'INVALID_FILE_TYPE'));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: config.LIMIT_FILE_SIZE_MB * 1024 * 1024
  }
});

const transcodeSchema = z.object({
  preset: z.string().optional()
});

const router = express.Router();

router.use(authMiddleware);

router.post('/upload', upload.single('file'), asyncHandler(uploadVideo));
router.get('/', asyncHandler(listUserVideos));
router.get('/:id', asyncHandler(getVideo));
router.get('/:id/stream', asyncHandler(streamVideo));
router.post('/:id/transcode', validateBody(transcodeSchema), asyncHandler(requestTranscode));
router.get('/:id/thumbnail', asyncHandler(serveThumbnail));
router.delete('/:id', asyncHandler(removeVideo));

export default router;
