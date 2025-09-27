import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const resolveFromRoot = (maybeRelative) =>
  path.isAbsolute(maybeRelative)
    ? maybeRelative
    : path.resolve(rootDir, maybeRelative);

let cachedConfig = null;
let cachedSsmClient = null;
let cachedSecretsClient = null;

const PARAMETER_NAMES = {
  S3_BUCKET: '/n11817143/app/s3Bucket',
  DYNAMO_TABLE: '/n11817143/app/dynamoTable',
  DYNAMO_OWNER_INDEX: '/n11817143/app/dynamoOwnerIndex',
  REGION: '/n11817143/app/region',
  PRESIGN_TTL: '/n11817143/app/presignTTL',
  COGNITO_USER_POOL_ID: '/n11817143/app/cognitoUserPoolId',
  COGNITO_CLIENT_ID: '/n11817143/app/cognitoClientId'
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

const getSsmClient = (region) => {
  if (!cachedSsmClient) {
    cachedSsmClient = new SSMClient({ region });
  }
  return cachedSsmClient;
};

const getSecretsClient = (region) => {
  if (!cachedSecretsClient) {
    cachedSecretsClient = new SecretsManagerClient({ region });
  }
  return cachedSecretsClient;
};

async function fetchParameter (client, name, { decrypt = true } = {}) {
  try {
    const response = await client.send(
      new GetParameterCommand({ Name: name, WithDecryption: decrypt })
    );
    return response.Parameter?.Value ?? null;
  } catch (error) {
    console.warn(`Unable to load parameter ${name}:`, error.message);
    return null;
  }
}

async function fetchSecret (client, secretId) {
  try {
    const response = await client.send(new GetSecretValueCommand({ SecretId: secretId }));
    return response.SecretString ?? null;
  } catch (error) {
    console.warn(`Unable to load secret ${secretId}:`, error.message);
    return null;
  }
}

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

export async function loadConfig () {
  if (cachedConfig) return cachedConfig;

  const baseRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
  const ssmClient = getSsmClient(baseRegion);
  const secretsClient = getSecretsClient(baseRegion);

  const [
    s3Bucket,
    dynamoTable,
    dynamoOwnerIndex,
    regionParam,
    presignTtl,
    cognitoUserPoolId,
    cognitoClientId
  ] = await Promise.all([
    fetchParameter(ssmClient, PARAMETER_NAMES.S3_BUCKET, { decrypt: false }),
    fetchParameter(ssmClient, PARAMETER_NAMES.DYNAMO_TABLE, { decrypt: false }),
    fetchParameter(ssmClient, PARAMETER_NAMES.DYNAMO_OWNER_INDEX, { decrypt: false }),
    fetchParameter(ssmClient, PARAMETER_NAMES.REGION, { decrypt: false }),
    fetchParameter(ssmClient, PARAMETER_NAMES.PRESIGN_TTL, { decrypt: false }),
    fetchParameter(ssmClient, PARAMETER_NAMES.COGNITO_USER_POOL_ID, { decrypt: false }),
    fetchParameter(ssmClient, PARAMETER_NAMES.COGNITO_CLIENT_ID, { decrypt: false })
  ]);

  const secretString = await fetchSecret(secretsClient, SECRET_NAME);
  let secretPayload = {};
  if (secretString) {
    try {
      secretPayload = JSON.parse(secretString);
    } catch (error) {
      console.warn('Failed to parse Secrets Manager payload. Falling back to defaults.', error.message);
    }
  }

  const region = regionParam || baseRegion;
  const resolvedConfig = {
    PORT: parseNumber(process.env.PORT, 4000),
    CLIENT_ORIGINS: normalizeOrigins(
      process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:5173'
    ),
    REGION: region,
    AWS_REGION: region,
    S3_BUCKET: s3Bucket || process.env.S3_BUCKET || '',
    S3_RAW_PREFIX: process.env.S3_RAW_PREFIX || 'raw-videos/',
    S3_TRANSCODED_PREFIX: process.env.S3_TRANSCODED_PREFIX || 'transcoded-videos/',
    S3_THUMBNAIL_PREFIX: process.env.S3_THUMBNAIL_PREFIX || 'thumbnails/',
    DYNAMO_TABLE: dynamoTable || process.env.DYNAMO_TABLE || '',
    DYNAMO_OWNER_INDEX: dynamoOwnerIndex || process.env.DYNAMO_OWNER_INDEX || '',
    LIMIT_FILE_SIZE_MB: parseNumber(process.env.LIMIT_FILE_SIZE_MB, 512),
    PRESIGNED_TTL_SECONDS: parseNumber(presignTtl, parseNumber(process.env.PRESIGNED_TTL_SECONDS, 900)),
    COGNITO_USER_POOL_ID: cognitoUserPoolId || process.env.COGNITO_USER_POOL_ID || '',
    COGNITO_CLIENT_ID: cognitoClientId || process.env.COGNITO_CLIENT_ID || process.env.COGNITO_APP_CLIENT_ID || '',
    PUBLIC_DIR: resolveFromRoot(process.env.PUBLIC_DIR || './src/public'),
    JWT_SECRET: secretPayload.JWT_SECRET || process.env.JWT_SECRET || '',
    FFMPEG_PRESETS: secretPayload.FFMPEG_PRESETS && typeof secretPayload.FFMPEG_PRESETS === 'object'
      ? secretPayload.FFMPEG_PRESETS
      : DEFAULT_FFMPEG_PRESETS,
    THUMBNAIL_PRESET: {
      ...DEFAULT_THUMBNAIL_PRESET,
      ...(secretPayload.THUMBNAIL_PRESET || {})
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
  return cachedConfig;
}

export function getConfig () {
  if (!cachedConfig) {
    throw new Error('Configuration not loaded. Call loadConfig() during startup.');
  }
  return cachedConfig;
}

export default { loadConfig, getConfig };
