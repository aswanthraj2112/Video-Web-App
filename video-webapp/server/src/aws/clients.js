import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { fromSSO } from '@aws-sdk/credential-providers';
import { getConfig } from '../config.js';

let s3Client;
let dynamoClient;
let documentClient;

// Check if we have AWS credentials
const hasAwsCredentials = () => {
  // Check if AWS_PROFILE is set for SSO authentication
  return !!process.env.AWS_PROFILE;
};

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
  if (!hasAwsCredentials()) {
    throw new Error('AWS credentials not configured - running in development mode');
  }
  if (!s3Client) {
    s3Client = new S3Client(getAwsConfig());
  }
  return s3Client;
};

export const getDynamoClient = () => {
  if (!hasAwsCredentials()) {
    throw new Error('AWS credentials not configured - running in development mode');
  }
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient(getAwsConfig());
  }
  return dynamoClient;
};

export const getDocumentClient = () => {
  if (!hasAwsCredentials()) {
    throw new Error('AWS credentials not configured - running in development mode');
  }
  if (!documentClient) {
    documentClient = DynamoDBDocumentClient.from(getDynamoClient(), {
      marshallOptions: { removeUndefinedValues: true }
    });
  }
  return documentClient;
};
