# AWS Assignment 2 – Deployment Inventory

This document captures the deployed AWS resources and runtime configuration for the cab432 video web application.

## EC2
- **Instance ID**: `i-0aaedf6a70038409`
- **Public IP**: `16.176.178.164`
- **Public DNS**: `ec2-16-176-178-164.ap-southeast-2.compute.amazonaws.com`
- **Region**: `ap-southeast-2`
- **Instance Type**: `t3.small`

## Elastic Container Registry (ECR)
- **Repository name**: `n11817143-a2`
- **Repository URL**: `901444280953.dkr.ecr.ap-southeast-2.amazonaws.com/n11817143-a2`

## Amazon S3
- **Bucket name**: `n11817143-a2`
- **Prefixes**:
  - Raw uploads: `raw-videos/`
  - Transcoded output: `transcoded-videos/`
  - Thumbnails: `thumbnails/`

## Amazon Route 53
- **Record name**: `n11817143-videoapp.cab432.com`
- **Record type**: `CNAME`
- **Target value**: `ec2-16-176-178-164.ap-southeast-2.compute.amazonaws.com`
- **Hosted zone**: `cab432.com`

## AWS Secrets Manager
- **Secret name**: `n11817143-a2-secret`
- **Keys**:
  - `JWT_SECRET`: `cab432_A2_super_secret_key_11817143`

## AWS Systems Manager Parameter Store
| Parameter | Purpose |
| --- | --- |
| `/n11817143/app/cognitoClientId` | Cognito SPA client ID |
| `/n11817143/app/cognitoUserPoolId` | Cognito User Pool ID |
| `/n11817143/app/domainName` | Public application domain used for CORS |
| `/n11817143/app/dynamoTable` | Video metadata table name |
| `/n11817143/app/dynamoOwnerIndex` | DynamoDB GSI for owner-based queries |
| `/n11817143/app/s3Bucket` | Primary video assets bucket |
| `/n11817143/app/s3_raw_prefix` | S3 prefix for raw uploads |
| `/n11817143/app/s3_thumbnail_prefix` | S3 prefix for thumbnails |
| `/n11817143/app/s3_transcoded_prefix` | S3 prefix for transcoded assets |
| `/n11817143/app/maxUploadSizeMb` | Upload file size limit in megabytes |
| `/n11817143/app/preSignedUrlTTL` | Signed URL TTL (seconds) |

These values are read automatically by `server/src/config.js` during startup. Environment variables can still override them when required (see `server/.env.example`).
