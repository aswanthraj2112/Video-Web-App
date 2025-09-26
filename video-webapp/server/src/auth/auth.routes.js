import express from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { me } from './auth.controller.js';
import authMiddleware from './auth.middleware.js';

const router = express.Router();

router.get('/me', authMiddleware, asyncHandler(me));

export default router;
