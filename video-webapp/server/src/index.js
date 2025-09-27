import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { loadConfig, getConfig } from './awsConfig.js';
import authRoutes from './auth/auth.routes.js';
import videoRoutes from './videos/video.routes.js';
import { errorHandler, NotFoundError } from './utils/errors.js';
import { useAwsServices } from './utils/runtime.js';

const app = express();

(async () => {
  try {
    await loadConfig();
    const config = getConfig();

    console.log('✅ Loaded AWS configuration', {
      region: config.AWS_REGION,
      s3Bucket: config.S3_BUCKET,
      dynamoTable: config.DYNAMO_TABLE,
      cacheEndpoint: config.CACHE_ENDPOINT
    });

    const awsEnabled = useAwsServices();

    app.use(cors({
      origin: (origin, callback) => callback(null, true),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['Content-Length', 'Content-Range']
    }));

    app.use(morgan('dev'));
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // Serve development storage files when running without AWS services
    if (!awsEnabled) {
      const path = await import('path');
      app.use('/dev-storage', express.static(path.join(config.PUBLIC_DIR, 'dev-storage')));
      console.log('🚧 Serving development storage at /dev-storage');
    }

    const healthHandler = (req, res) => {
      res.json({ status: 'ok', configLoaded: true, region: config.REGION });
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
      if (awsEnabled) {
        console.log('AWS mode enabled');
      } else {
        console.log('Development services enabled');
      }
    });
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
})();
