import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2';
const ssm = new SSMClient({ region });
const secrets = new SecretsManagerClient({ region });

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

export async function loadConfig () {
  const s3Bucket = await getParam('/n11817143/app/s3Bucket');
  const dynamoTable = await getParam('/n11817143/app/dynamoTable');
  const dynamoOwnerIndex = await getParam('/n11817143/app/dynamoOwnerIndex');
  const presignTTL = await getParam('/n11817143/app/presignTTL');
  const userPoolId = await getParam('/n11817143/app/cognitoUserPoolId');
  const clientId = await getParam('/n11817143/app/cognitoClientId');

  const secretsData = await getSecret('n11817143-a2-secret');

  return {
    REGION: process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'ap-southeast-2',
    PORT: process.env.PORT || 4000,
    CLIENT_ORIGINS: process.env.CLIENT_ORIGINS ? process.env.CLIENT_ORIGINS.split(',') : ['http://localhost:5173'],
    S3_BUCKET: s3Bucket || process.env.S3_BUCKET,
    DYNAMO_TABLE: dynamoTable || process.env.DYNAMO_TABLE,
    DYNAMO_OWNER_INDEX: dynamoOwnerIndex || process.env.DYNAMO_OWNER_INDEX,
    PRESIGNED_TTL_SECONDS: presignTTL || process.env.PRESIGNED_TTL_SECONDS || '900',
    COGNITO_USER_POOL_ID: userPoolId || process.env.COGNITO_USER_POOL_ID,
    COGNITO_CLIENT_ID: clientId || process.env.COGNITO_CLIENT_ID,
    JWT_SECRET: secretsData.JWT_SECRET || process.env.JWT_SECRET,
    FFMPEG_PRESETS: secretsData.FFMPEG_PRESETS || {},
    THUMBNAIL_PRESET: secretsData.THUMBNAIL_PRESET || {}
  };
}

export default { loadConfig };
