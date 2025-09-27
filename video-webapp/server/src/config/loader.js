import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
const ssm = new SSMClient({ region });
const secrets = new SecretsManagerClient({ region });

const PARAMETER_PATHS = {
  S3_BUCKET: '/a2/s3_bucket',
  DYNAMO_TABLE: '/a2/dynamo_table',
  DYNAMO_OWNER_INDEX: '/a2/dynamo_owner_index',
  PRESIGNED_TTL_SECONDS: '/a2/presigned_ttl_seconds',
  COGNITO_USER_POOL_ID: '/a2/cognito_user_pool_id',
  COGNITO_CLIENT_ID: '/a2/cognito_client_id',
  CLIENT_ORIGINS: '/a2/client_origins'
};

const SECRET_ID = 'n11817143-a2-secret';

async function getParam (name) {
  try {
    const res = await ssm.send(new GetParameterCommand({ Name: name }));
    return res.Parameter?.Value ?? null;
  } catch (error) {
    console.warn(`Unable to load parameter ${name}:`, error.message);
    return null;
  }
}

async function getSecret (name) {
  try {
    const res = await secrets.send(new GetSecretValueCommand({ SecretId: name }));
    if (!res.SecretString) return {};
    return JSON.parse(res.SecretString);
  } catch (error) {
    console.warn(`Unable to load secret ${name}:`, error.message);
    return {};
  }
}

function parseList (value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return `${value}`
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function loadConfig () {
  const parameterEntries = await Promise.all(
    Object.entries(PARAMETER_PATHS).map(async ([key, path]) => [key, await getParam(path)])
  );

  const parameters = Object.fromEntries(parameterEntries);
  const secretsData = await getSecret(SECRET_ID);
  const envOrigins = parseList(process.env.CLIENT_ORIGINS);
  const parameterOrigins = parseList(parameters.CLIENT_ORIGINS);

  return {
    REGION: region,
    PORT: process.env.PORT || 4000,
    CLIENT_ORIGINS:
      envOrigins.length > 0
        ? envOrigins
        : parameterOrigins.length > 0
          ? parameterOrigins
          : ['http://localhost:5173'],
    S3_BUCKET: parameters.S3_BUCKET || process.env.S3_BUCKET,
    DYNAMO_TABLE: parameters.DYNAMO_TABLE || process.env.DYNAMO_TABLE,
    DYNAMO_OWNER_INDEX: parameters.DYNAMO_OWNER_INDEX || process.env.DYNAMO_OWNER_INDEX,
    PRESIGNED_TTL_SECONDS:
      parameters.PRESIGNED_TTL_SECONDS || process.env.PRESIGNED_TTL_SECONDS || '900',
    COGNITO_USER_POOL_ID: parameters.COGNITO_USER_POOL_ID || process.env.COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID: parameters.COGNITO_CLIENT_ID || process.env.COGNITO_CLIENT_ID,
    JWT_SECRET: secretsData.JWT_SECRET || process.env.JWT_SECRET,
    FFMPEG_PRESETS: secretsData.FFMPEG_PRESETS || {},
    THUMBNAIL_PRESET: secretsData.THUMBNAIL_PRESET || {}
  };
}

export default { loadConfig };
