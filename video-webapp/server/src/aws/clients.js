import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { fromSSO } from '@aws-sdk/credential-providers';
import { getConfig } from '../awsConfig.js';
import { useAwsServices } from '../utils/runtime.js';

let s3Client;
let dynamoClient;
let documentClient;

// Create AWS configuration with SSO credentials
const getAwsConfig = () => {
  const config = getConfig();
  return {
    region: config.REGION,
    credentials: process.env.AWS_PROFILE ?
      fromSSO({ profile: process.env.AWS_PROFILE }) :
      undefined
  };
};

export const getS3Client = () => {
  if (!useAwsServices()) {
    throw new Error('AWS services disabled - enable USE_DEV_SERVICES=false to access AWS.');
  }
  if (!s3Client) {
    s3Client = new S3Client(getAwsConfig());
  }
  return s3Client;
};

export const getDynamoClient = () => {
  if (!useAwsServices()) {
    throw new Error('AWS services disabled - enable USE_DEV_SERVICES=false to access AWS.');
  }
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient(getAwsConfig());
  }
  return dynamoClient;
};

export const getDocumentClient = () => {
  if (!useAwsServices()) {
    throw new Error('AWS services disabled - enable USE_DEV_SERVICES=false to access AWS.');
  }
  if (!documentClient) {
    documentClient = DynamoDBDocumentClient.from(getDynamoClient(), {
      marshallOptions: { removeUndefinedValues: true }
    });
  }
  return documentClient;
};
