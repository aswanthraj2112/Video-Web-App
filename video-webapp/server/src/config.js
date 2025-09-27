import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { fromSSO } from '@aws-sdk/credential-providers';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';

// Configure AWS clients with SSO credentials
const awsConfig = {
  region,
  credentials: process.env.AWS_PROFILE ? 
    fromSSO({ profile: process.env.AWS_PROFILE }) : 
    undefined // Fall back to default credential chain
};

const ssm = new SSMClient(awsConfig);
const secrets = new SecretsManagerClient(awsConfig);

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

function normalizeDomainToOrigin (value) {
  if (!value) return null;
  const trimmed = `${value}`.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
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
      presignedTtl,
      domainName,
      parameterCognitoClientId,
      parameterCognitoUserPoolId,
      cacheEndpoint
    ] = await Promise.all([
      loadParameter('/n11817143/app/s3Bucket'),
      loadParameter('/n11817143/app/dynamoTable'),
      loadParameter('/n11817143/app/dynamoOwnerIndex'),
      loadParameter('/n11817143/app/s3_raw_prefix'),
      loadParameter('/n11817143/app/s3_transcoded_prefix'),
      loadParameter('/n11817143/app/s3_thumbnail_prefix'),
      loadParameter('/n11817143/app/maxUploadSizeMb'),
      loadParameter('/n11817143/app/preSignedUrlTTL'),
      loadParameter('/n11817143/app/domainName'),
      loadParameter('/n11817143/app/cognitoClientId'),
      loadParameter('/n11817143/app/cognitoUserPoolId'),
      loadParameter('/n11817143/app/cacheEndpoint')
    ]);

    const secretName = process.env.SECRET_NAME || 'n11817143-a2-secret';
    const secretValues = await loadSecret(secretName);
    const domainOrigin = normalizeDomainToOrigin(domainName);

    const config = {
      PORT: parseNumber(process.env.PORT, 4000),
      CLIENT_ORIGINS: parseOrigins(
        process.env.CLIENT_ORIGINS
        || secretValues.CLIENT_ORIGINS
        || domainOrigin
        || 'http://localhost:5173'
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
      COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID
        || secretValues.COGNITO_USER_POOL_ID
        || parameterCognitoUserPoolId
        || '',
      COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID
        || secretValues.COGNITO_CLIENT_ID
        || parameterCognitoClientId
        || '',
      JWT_SECRET: process.env.JWT_SECRET || secretValues.JWT_SECRET || '',
      CACHE_ENDPOINT: process.env.CACHE_ENDPOINT || cacheEndpoint || '',
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
      console.warn('⚠️ Cognito configuration missing. Running in development mode.');
      console.warn('   Set COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID environment variables for production.');
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
