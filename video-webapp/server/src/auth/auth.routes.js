import express from 'express';
import { z } from 'zod';
import asyncHandler from '../utils/asyncHandler.js';
import { validateBody } from '../utils/validate.js';
import { register, login, me } from './auth.controller.js';
import authMiddleware from './auth.middleware.js';

const router = express.Router();

const credentialsSchema = z.object({
  username: z.string().min(3).max(32),
  password: z.string().min(6).max(128)
});

router.post('/register', validateBody(credentialsSchema), asyncHandler(register));
router.post('/login', validateBody(credentialsSchema), asyncHandler(login));
router.get('/me', authMiddleware, asyncHandler(me));

export default router;
