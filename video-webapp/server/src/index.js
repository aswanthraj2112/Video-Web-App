import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config.js';
import { initDb } from './db.js';
import authRoutes from './auth/auth.routes.js';
import videoRoutes from './videos/video.routes.js';
import { errorHandler, NotFoundError } from './utils/errors.js';
import { ensureStorageDirs } from './videos/video.controller.js';

const app = express();

app.use(cors({ origin: config.CLIENT_ORIGIN }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);

app.use((req, res, next) => {
  next(new NotFoundError('Route not found'));
});

app.use(errorHandler);

const start = async () => {
  await ensureStorageDirs();
  await initDb();
  app.listen(config.PORT, () => {
    console.log(`Server listening on http://localhost:${config.PORT}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
