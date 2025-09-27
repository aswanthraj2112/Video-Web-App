import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { loadConfig } from './config.js';
import authRoutes from './auth/auth.routes.js';
import videoRoutes from './videos/video.routes.js';
import { errorHandler, NotFoundError } from './utils/errors.js';

const app = express();

(async () => {
  try {
    const config = await loadConfig();

    const allowedOrigins = new Set(
      Array.isArray(config.CLIENT_ORIGINS)
        ? config.CLIENT_ORIGINS
        : `${config.CLIENT_ORIGINS}`
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)
    );

    app.use(cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Length', 'Content-Range']
    }));

    app.use(morgan('dev'));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Serve development storage files
    const hasAwsCredentials = false; // Force development mode
    if (!hasAwsCredentials) {
      const path = await import('path');
      app.use('/dev-storage', express.static(path.join(config.PUBLIC_DIR, 'dev-storage')));
      console.log('🚧 Serving development storage at /dev-storage');
    }

    const healthHandler = (req, res) => {
      res.json({ status: 'ok', region: config.REGION });
    };

    app.get('/health', healthHandler);
    app.get('/api/health', healthHandler);

    app.use('/api/auth', authRoutes);
    app.use('/api/videos', videoRoutes);

    app.use((req, res, next) => {
      next(new NotFoundError('Route not found'));
    });

    app.use(errorHandler);

    app.listen(config.PORT, () => {
      console.log(`🚀 Server running on port ${config.PORT}`);
      console.log('Using S3 bucket:', config.S3_BUCKET);
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
})();
