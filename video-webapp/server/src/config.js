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

const defaultTranscodeOptions = [
  '-c:v libx264',
  '-preset fast',
  '-crf 23',
  '-vf scale=1280:-2',
  '-c:a aac',
  '-b:a 128k',
  '-movflags +faststart'
];

const defaultThumbnailOptions = {
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

async function tryFetchParameter (client, name, withDecryption = true) {
  if (!name) return null;
  try {
    const result = await client.send(
      new GetParameterCommand({ Name: name, WithDecryption: withDecryption })
    );
    return result.Parameter?.Value || null;
  } catch (error) {
    if (error.name !== 'ParameterNotFound') {
      console.warn(`Unable to load parameter ${name}:`, error.message);
    }
    return null;
  }
}

async function tryFetchSecret (client, name) {
  if (!name) return null;
  try {
    const result = await client.send(new GetSecretValueCommand({ SecretId: name }));
    return result.SecretString || null;
  } catch (error) {
    if (error.name !== 'ResourceNotFoundException') {
      console.warn(`Unable to load secret ${name}:`, error.message);
    }
    return null;
  }
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

  const baseRegion = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const ssmClient = getSsmClient(baseRegion);
  const secretsClient = getSecretsClient(baseRegion);

  const [
    s3BucketFromParam,
    dynamoTableFromParam,
    regionFromParam
  ] = await Promise.all([
    tryFetchParameter(ssmClient, process.env.PARAMETER_S3_BUCKET),
    tryFetchParameter(ssmClient, process.env.PARAMETER_DYNAMO_TABLE),
    tryFetchParameter(ssmClient, process.env.PARAMETER_REGION)
  ]);

  const awsRegion = regionFromParam || baseRegion;

  const secretString = await tryFetchSecret(secretsClient, process.env.SECRETS_TRANSCODE_OPTIONS);
  let secretConfig = {};
  if (secretString) {
    try {
      secretConfig = JSON.parse(secretString);
    } catch (error) {
      console.warn('Failed to parse Secrets Manager payload. Falling back to defaults.', error.message);
    }
  }

  const resolvedConfig = {
    PORT: Number.parseInt(process.env.PORT || '4000', 10),
    CLIENT_ORIGINS: normalizeOrigins(
      process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:5173'
    ),
    AWS_REGION: awsRegion,
    S3_BUCKET: s3BucketFromParam || process.env.S3_BUCKET || '',
    S3_RAW_PREFIX: process.env.S3_RAW_PREFIX || 'raw-videos/',
    S3_TRANSCODED_PREFIX: process.env.S3_TRANSCODED_PREFIX || 'transcoded-videos/',
    S3_THUMBNAIL_PREFIX: process.env.S3_THUMBNAIL_PREFIX || 'thumbnails/',
    DYNAMO_TABLE: dynamoTableFromParam || process.env.DYNAMO_TABLE || 'VideoMetadata',
    DYNAMO_OWNER_INDEX: process.env.DYNAMO_OWNER_INDEX || 'OwnerIndex',
    LIMIT_FILE_SIZE_MB: Number.parseInt(process.env.LIMIT_FILE_SIZE_MB || '512', 10),
    PRESIGNED_TTL_SECONDS: Number.parseInt(process.env.PRESIGNED_TTL_SECONDS || '900', 10),
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || '',
    COGNITO_APP_CLIENT_ID: process.env.COGNITO_APP_CLIENT_ID || '',
    PUBLIC_DIR: resolveFromRoot(process.env.PUBLIC_DIR || './src/public'),
    TRANSCODE_OPTIONS: Array.isArray(secretConfig.transcodeOptions)
      ? secretConfig.transcodeOptions
      : defaultTranscodeOptions,
    THUMBNAIL_OPTIONS: {
      ...defaultThumbnailOptions,
      ...(secretConfig.thumbnailOptions || {})
    }
  };

  if (!resolvedConfig.S3_BUCKET) {
    throw new Error('S3 bucket name is required. Provide S3_BUCKET env or Parameter Store value.');
  }
  if (!resolvedConfig.COGNITO_USER_POOL_ID || !resolvedConfig.COGNITO_APP_CLIENT_ID) {
    throw new Error('Cognito configuration missing. Set COGNITO_USER_POOL_ID and COGNITO_APP_CLIENT_ID.');
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
