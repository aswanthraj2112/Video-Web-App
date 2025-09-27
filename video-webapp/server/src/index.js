import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { loadConfig } from './config.js';
import authRoutes from './auth/auth.routes.js';
import videoRoutes from './videos/video.routes.js';
import { errorHandler, NotFoundError } from './utils/errors.js';

let config;

try {
  config = await loadConfig();
  console.log('✅ Runtime configuration loaded', {
    region: config.REGION,
    s3Bucket: config.S3_BUCKET,
    dynamoTable: config.DYNAMO_TABLE
  });
} catch (error) {
  console.error('Failed to load runtime configuration', error);
  process.exit(1);
}

const app = express();

const allowedOrigins = new Set(config.CLIENT_ORIGINS);

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

const start = async () => {
  app.listen(config.PORT, () => {
    console.log(`Server listening on port ${config.PORT}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server', err);
  process.exit(1);
});
