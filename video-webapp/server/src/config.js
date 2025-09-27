import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadConfig as loadRemoteConfig } from './config/loader.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const resolveFromRoot = (maybeRelative) =>
  path.isAbsolute(maybeRelative)
    ? maybeRelative
    : path.resolve(rootDir, maybeRelative);

const DEFAULT_FFMPEG_PRESETS = {
  '720p': [
    '-c:v libx264',
    '-preset fast',
    '-crf 23',
    '-vf scale=1280:-2',
    '-c:a aac',
    '-b:a 128k',
    '-movflags +faststart'
  ]
};

const DEFAULT_THUMBNAIL_PRESET = {
  timestamps: ['2'],
  size: '640x?'
};

let cachedConfig = null;

function parseNumber (value, fallback) {
  if (value == null) return fallback;
  const parsed = Number.parseInt(`${value}`, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizeOrigins (rawOrigins) {
  if (!rawOrigins) return [];
  const values = Array.isArray(rawOrigins) ? rawOrigins : `${rawOrigins}`.split(',');
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function ensureObject (value, fallback = {}) {
  return value && typeof value === 'object' ? value : fallback;
}

export async function loadConfig () {
  if (cachedConfig) return cachedConfig;

  const remoteConfig = await loadRemoteConfig();

  const baseRegion = remoteConfig.REGION || process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';

  const resolvedConfig = {
    PORT: parseNumber(remoteConfig.PORT ?? process.env.PORT, 4000),
    CLIENT_ORIGINS: normalizeOrigins(
      remoteConfig.CLIENT_ORIGINS?.length ? remoteConfig.CLIENT_ORIGINS : (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    ),
    REGION: baseRegion,
    AWS_REGION: baseRegion,
    S3_BUCKET: remoteConfig.S3_BUCKET || process.env.S3_BUCKET || '',
    S3_RAW_PREFIX: process.env.S3_RAW_PREFIX || 'raw-videos/',
    S3_TRANSCODED_PREFIX: process.env.S3_TRANSCODED_PREFIX || 'transcoded-videos/',
    S3_THUMBNAIL_PREFIX: process.env.S3_THUMBNAIL_PREFIX || 'thumbnails/',
    DYNAMO_TABLE: remoteConfig.DYNAMO_TABLE || process.env.DYNAMO_TABLE || '',
    DYNAMO_OWNER_INDEX: remoteConfig.DYNAMO_OWNER_INDEX || process.env.DYNAMO_OWNER_INDEX || '',
    LIMIT_FILE_SIZE_MB: parseNumber(process.env.LIMIT_FILE_SIZE_MB, 512),
    PRESIGNED_TTL_SECONDS: parseNumber(remoteConfig.PRESIGNED_TTL_SECONDS ?? process.env.PRESIGNED_TTL_SECONDS, 900),
    COGNITO_USER_POOL_ID: remoteConfig.COGNITO_USER_POOL_ID || process.env.COGNITO_USER_POOL_ID || '',
    COGNITO_CLIENT_ID: remoteConfig.COGNITO_CLIENT_ID || process.env.COGNITO_CLIENT_ID || process.env.COGNITO_APP_CLIENT_ID || '',
    PUBLIC_DIR: resolveFromRoot(process.env.PUBLIC_DIR || './src/public'),
    JWT_SECRET: remoteConfig.JWT_SECRET || process.env.JWT_SECRET || '',
    FFMPEG_PRESETS: ensureObject(remoteConfig.FFMPEG_PRESETS, DEFAULT_FFMPEG_PRESETS),
    THUMBNAIL_PRESET: {
      ...DEFAULT_THUMBNAIL_PRESET,
      ...ensureObject(remoteConfig.THUMBNAIL_PRESET)
    }
  };

  if (!resolvedConfig.S3_BUCKET) {
    throw new Error('S3 bucket name is required from Parameter Store or environment override.');
  }
  if (!resolvedConfig.DYNAMO_TABLE) {
    throw new Error('DynamoDB table name is required from Parameter Store or environment override.');
  }
  if (!resolvedConfig.DYNAMO_OWNER_INDEX) {
    throw new Error('DynamoDB owner index is required from Parameter Store or environment override.');
  }
  if (!resolvedConfig.COGNITO_USER_POOL_ID || !resolvedConfig.COGNITO_CLIENT_ID) {
    throw new Error('Cognito configuration missing. Ensure Parameter Store contains user pool ID and client ID.');
  }

  cachedConfig = resolvedConfig;
  console.log('✅ Loaded config:', {
    S3_BUCKET: resolvedConfig.S3_BUCKET,
    DYNAMO_TABLE: resolvedConfig.DYNAMO_TABLE,
    REGION: resolvedConfig.REGION
  });

  return cachedConfig;
}

export function getConfig () {
  if (!cachedConfig) {
    throw new Error('Configuration not loaded. Call loadConfig() during startup.');
  }
  return cachedConfig;
}

export default { loadConfig, getConfig };
