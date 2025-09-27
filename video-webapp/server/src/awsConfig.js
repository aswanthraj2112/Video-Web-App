import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '.');

const envRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';

const ssm = new SSMClient({ region: envRegion });
const secrets = new SecretsManagerClient({ region: envRegion });

const PARAMETER_NAMES = {
  s3Bucket: '/video-app/prod/s3-bucket',
  dynamoTable: '/video-app/prod/dynamo-table',
  region: '/video-app/prod/region',
  cacheEndpoint: '/video-app/prod/cache-endpoint'
};

const SECRET_NAME = 'n11817143-a2-secret';

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
let loadingPromise = null;

async function loadParameter (name) {
  try {
    const result = await ssm.send(new GetParameterCommand({ Name: name }));
    return result.Parameter?.Value ?? null;
  } catch (error) {
    throw new Error(`Unable to load SSM parameter ${name}: ${error.message}`);
  }
}

async function loadSecret (secretName) {
  try {
    const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretName }));
    if (!result.SecretString) return {};
    return JSON.parse(result.SecretString);
  } catch (error) {
    throw new Error(`Unable to load secret ${secretName}: ${error.message}`);
  }
}

function resolveFromRoot (maybeRelative) {
  return path.isAbsolute(maybeRelative)
    ? maybeRelative
    : path.resolve(rootDir, maybeRelative);
}

function parseOrigins (rawOrigins) {
  if (!rawOrigins) return [];
  const values = Array.isArray(rawOrigins) ? rawOrigins : `${rawOrigins}`.split(',');
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function parseNumber (value, fallback) {
  if (value == null) return fallback;
  const parsed = Number.parseInt(`${value}`, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function ensureObject (value, fallback = {}) {
  return value && typeof value === 'object' ? value : fallback;
}

export async function loadConfig () {
  if (cachedConfig) return cachedConfig;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const [s3Bucket, dynamoTable, regionParameter, cacheEndpoint] = await Promise.all([
      loadParameter(PARAMETER_NAMES.s3Bucket),
      loadParameter(PARAMETER_NAMES.dynamoTable),
      loadParameter(PARAMETER_NAMES.region),
      loadParameter(PARAMETER_NAMES.cacheEndpoint)
    ]);

    const secretValues = await loadSecret(SECRET_NAME);

    const region = regionParameter || envRegion;

    const config = {
      PORT: parseNumber(process.env.PORT, 4000),
      AWS_REGION: region,
      REGION: region,
      S3_BUCKET: s3Bucket,
      DYNAMO_TABLE: dynamoTable,
      DYNAMO_OWNER_INDEX: 'OwnerIndex',
      CACHE_ENDPOINT: cacheEndpoint,
      JWT_SECRET: secretValues.JWT_SECRET || '',
      S3_RAW_PREFIX: 'raw-videos/',
      S3_TRANSCODED_PREFIX: 'transcoded-videos/',
      S3_THUMBNAIL_PREFIX: 'thumbnails/',
      PRESIGNED_TTL_SECONDS: 900,
      LIMIT_FILE_SIZE_MB: 512,
      CLIENT_ORIGINS: parseOrigins(secretValues.CLIENT_ORIGINS),
      COGNITO_USER_POOL_ID: secretValues.COGNITO_USER_POOL_ID || '',
      COGNITO_CLIENT_ID: secretValues.COGNITO_CLIENT_ID || '',
      PUBLIC_DIR: resolveFromRoot('./public'),
      FFMPEG_PRESETS: ensureObject(secretValues.FFMPEG_PRESETS, DEFAULT_FFMPEG_PRESETS),
      THUMBNAIL_PRESET: {
        ...DEFAULT_THUMBNAIL_PRESET,
        ...ensureObject(secretValues.THUMBNAIL_PRESET)
      }
    };

    if (!config.S3_BUCKET) {
      throw new Error('Missing S3 bucket configuration from Parameter Store.');
    }

    if (!config.DYNAMO_TABLE) {
      throw new Error('Missing DynamoDB table configuration from Parameter Store.');
    }

    if (!config.CACHE_ENDPOINT) {
      throw new Error('Missing cache endpoint configuration from Parameter Store.');
    }

    if (!config.JWT_SECRET) {
      throw new Error('Missing JWT_SECRET in Secrets Manager.');
    }

    cachedConfig = config;
    loadingPromise = null;
    return cachedConfig;
  })().catch((error) => {
    loadingPromise = null;
    throw error;
  });

  return loadingPromise;
}

export function getConfig () {
  if (!cachedConfig) {
    throw new Error('Configuration not loaded. Call loadConfig() before accessing it.');
  }
  return cachedConfig;
}

export default { loadConfig, getConfig };
