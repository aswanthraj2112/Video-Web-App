import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
const ssm = new SSMClient({ region });
const secrets = new SecretsManagerClient({ region });

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

const resolveFromRoot = (maybeRelative) =>
  path.isAbsolute(maybeRelative)
    ? maybeRelative
    : path.resolve(rootDir, maybeRelative);

function parseNumber (value, fallback) {
  if (value == null) return fallback;
  const parsed = Number.parseInt(`${value}`, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function parseOrigins (rawOrigins) {
  if (!rawOrigins) return [];
  const values = Array.isArray(rawOrigins) ? rawOrigins : `${rawOrigins}`.split(',');
  return values
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function ensureObject (value, fallback = {}) {
  return value && typeof value === 'object' ? value : fallback;
}

function parseJson (value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function loadParameter (name) {
  try {
    const result = await ssm.send(new GetParameterCommand({ Name: name }));
    return result.Parameter?.Value ?? null;
  } catch (error) {
    console.warn(`Unable to load parameter ${name}:`, error.message);
    return null;
  }
}

async function loadParameterAny (names) {
  const candidateNames = Array.isArray(names) ? names : [names];

  for (const name of candidateNames) {
    const value = await loadParameter(name);
    if (value != null) {
      return value;
    }
  }

  return null;
}

async function loadSecret (secretName) {
  try {
    const result = await secrets.send(new GetSecretValueCommand({ SecretId: secretName }));
    if (!result.SecretString) return {};
    return JSON.parse(result.SecretString);
  } catch (error) {
    console.warn(`Unable to load secret ${secretName}:`, error.message);
    return {};
  }
}

export async function loadConfig () {
  if (cachedConfig) return cachedConfig;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const [
      s3Bucket,
      dynamoTable,
      dynamoOwnerIndex,
      rawPrefix,
      transcodedPrefix,
      thumbnailPrefix,
      limitFileSize,
      presignedTtl
    ] = await Promise.all([
      loadParameterAny(['/a2/s3_bucket', '/n11817143/app/s3Bucket']),
      loadParameterAny(['/a2/dynamo_table', '/n11817143/app/dynamoTable']),
      loadParameterAny(['/a2/dynamo_owner_index', '/n11817143/app/dynamoOwnerIndex']),
      loadParameter('/a2/s3_raw_prefix'),
      loadParameter('/a2/s3_transcoded_prefix'),
      loadParameter('/a2/s3_thumbnail_prefix'),
      loadParameterAny(['/a2/limit_file_size_mb', '/n11817143/app/maxUploadSizeMb']),
      loadParameterAny(['/a2/presigned_ttl_seconds', '/n11817143/app/preSignedUrlTTL'])
    ]);

    const secretValues = await loadSecret('n11817143-a2-secret');

    const config = {
      PORT: parseNumber(process.env.PORT, 4000),
      CLIENT_ORIGINS: parseOrigins(
        process.env.CLIENT_ORIGINS || secretValues.CLIENT_ORIGINS || 'http://localhost:5173'
      ),
      REGION: region,
      AWS_REGION: region,
      S3_BUCKET: process.env.S3_BUCKET || s3Bucket || '',
      DYNAMO_TABLE: process.env.DYNAMO_TABLE || dynamoTable || '',
      DYNAMO_OWNER_INDEX: process.env.DYNAMO_OWNER_INDEX || dynamoOwnerIndex || '',
      S3_RAW_PREFIX: process.env.S3_RAW_PREFIX || rawPrefix || 'raw-videos/',
      S3_TRANSCODED_PREFIX: process.env.S3_TRANSCODED_PREFIX || transcodedPrefix || 'transcoded-videos/',
      S3_THUMBNAIL_PREFIX: process.env.S3_THUMBNAIL_PREFIX || thumbnailPrefix || 'thumbnails/',
      LIMIT_FILE_SIZE_MB: parseNumber(process.env.LIMIT_FILE_SIZE_MB ?? limitFileSize, 512),
      PRESIGNED_TTL_SECONDS: parseNumber(process.env.PRESIGNED_TTL_SECONDS ?? presignedTtl, 900),
      COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || secretValues.COGNITO_USER_POOL_ID || '',
      COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || secretValues.COGNITO_CLIENT_ID || '',
      JWT_SECRET: process.env.JWT_SECRET || secretValues.JWT_SECRET || '',
      PUBLIC_DIR: resolveFromRoot(process.env.PUBLIC_DIR || './src/public'),
      FFMPEG_PRESETS: ensureObject(
        secretValues.FFMPEG_PRESETS || parseJson(process.env.FFMPEG_PRESETS, null),
        DEFAULT_FFMPEG_PRESETS
      ),
      THUMBNAIL_PRESET: {
        ...DEFAULT_THUMBNAIL_PRESET,
        ...ensureObject(secretValues.THUMBNAIL_PRESET || parseJson(process.env.THUMBNAIL_PRESET, null))
      }
    };

    if (!config.CLIENT_ORIGINS.length) {
      config.CLIENT_ORIGINS = ['http://localhost:5173'];
    }

    if (!config.S3_BUCKET) {
      throw new Error('S3 bucket name is required from Parameter Store or environment override.');
    }

    if (!config.DYNAMO_TABLE) {
      throw new Error('DynamoDB table name is required from Parameter Store or environment override.');
    }

    if (!config.DYNAMO_OWNER_INDEX) {
      throw new Error('DynamoDB owner index is required from Parameter Store or environment override.');
    }

    if (!config.COGNITO_USER_POOL_ID || !config.COGNITO_CLIENT_ID) {
      throw new Error('Cognito configuration missing. Ensure Parameter Store contains user pool ID and client ID.');
    }

    cachedConfig = config;
    console.log('✅ Loaded config:', {
      S3_BUCKET: cachedConfig.S3_BUCKET,
      DYNAMO_TABLE: cachedConfig.DYNAMO_TABLE,
      REGION: cachedConfig.REGION
    });

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
    throw new Error('Configuration not loaded. Call loadConfig() during startup.');
  }
  return cachedConfig;
}

export default { loadConfig, getConfig };
