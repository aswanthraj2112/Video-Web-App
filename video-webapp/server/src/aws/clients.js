import { S3Client } from '@aws-sdk/client-s3';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { getConfig } from '../config.js';

let s3Client;
let dynamoClient;
let documentClient;

export const getS3Client = () => {
  if (!s3Client) {
    const config = getConfig();
    s3Client = new S3Client({ region: config.AWS_REGION });
  }
  return s3Client;
};

export const getDynamoClient = () => {
  if (!dynamoClient) {
    const config = getConfig();
    dynamoClient = new DynamoDBClient({ region: config.AWS_REGION });
  }
  return dynamoClient;
};

export const getDocumentClient = () => {
  if (!documentClient) {
    documentClient = DynamoDBDocumentClient.from(getDynamoClient(), {
      marshallOptions: { removeUndefinedValues: true }
    });
  }
  return documentClient;
};
