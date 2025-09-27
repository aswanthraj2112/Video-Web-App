# Cloud-Native Video Web App

Modernized video management platform with an Express API and a React frontend. All state is persisted in AWS services:

- **Amazon S3** – raw uploads, thumbnails, and transcoded outputs
- **Amazon DynamoDB** – video metadata (videoId/ownerId primary key)
- **Amazon Cognito** – user authentication & JWT issuance
- **AWS Systems Manager Parameter Store** – runtime configuration (bucket, table, region)
- **AWS Secrets Manager** – ffmpeg tuning and other sensitive settings
- **Amazon ElastiCache (Memcached)** – low-latency cache for metadata and signed URLs

The UI authenticates with Cognito, uploads video files directly to the API (which streams to S3), triggers ffmpeg transcodes, and plays media through signed URLs.

Configuration is fetched dynamically from AWS Systems Manager Parameter Store and Secrets Manager on every container start, keeping the service stateless. Frequently accessed video metadata and generated download links are cached in Amazon ElastiCache (Memcached) to minimise DynamoDB lookups and repeated presign calls.

## Architecture Overview

```
React (Vite) SPA ──► Express API ──► S3 (raw/transcoded/thumbnails)
       │                 │
       │                 ├─► DynamoDB (VideoMetadata table)
       │                 ├─► Parameter Store (S3 bucket / table / region / Cognito IDs / TTL)
       │                 ├─► Secrets Manager (JWT + ffmpeg/thumbnail presets)
       │                 ├─► ElastiCache (Memcached metadata & URL cache)
       ▼                 └─► Cognito (JWT validation via JWKS)
Cognito Hosted UI / Amplify Auth
```

## Prerequisites

- Node.js 18+
- npm 9+
- `ffmpeg` available on your `$PATH`
- AWS account with permissions to use S3, DynamoDB, Cognito, SSM Parameter Store, and Secrets Manager
- AWS CLI configured locally (`aws configure`) or environment variables providing credentials when running in Docker/EC2

## Required AWS Resources

1. **S3 bucket** for video assets (e.g. `my-video-app-assets`). The app writes to the prefixes `raw-videos/`, `transcoded-videos/`, and `thumbnails/`.
2. **DynamoDB table** `VideoMetadata` (partition key: `videoId`, sort key: `ownerId`). Add a global secondary index `OwnerIndex` with `ownerId` as the partition key and `createdAt` as the sort key for listing a user’s videos.
3. **Cognito User Pool** and an **App Client** (no secret) for the SPA. Enable optional MFA if desired.
4. **Parameter Store entries** (String, `WithDecryption=false`):
   - `/n11817143/app/s3Bucket` → `my-video-app-assets`
   - `/n11817143/app/dynamoTable` → `VideoMetadata`
   - `/n11817143/app/dynamoOwnerIndex` → `OwnerIndex`
   - `/n11817143/app/region` → `ap-southeast-2`
   - `/n11817143/app/presignTTL` → `900`
   - `/n11817143/app/cognitoUserPoolId` → `ap-southeast-2_CdVnmKfrW`
   - `/n11817143/app/cognitoClientId` → `11pap5u5svkhr1hgjf934sj0id`
   - `/n11817143/app/cacheEndpoint` → `n11817143-a2-cache.km2ji.cfg.apse2.cache.amazonaws.com:11211`
5. **Secrets Manager secret** `n11817143-a2-secret` (JSON) containing sensitive runtime configuration. Example payload:
   ```json
   {
     "JWT_SECRET": "replace-me",
     "FFMPEG_PRESETS": {
       "720p": [
         "-c:v libx264",
         "-preset fast",
         "-crf 23",
         "-vf scale=1280:-2",
         "-c:a aac",
         "-b:a 128k",
         "-movflags +faststart"
       ]
     },
     "THUMBNAIL_PRESET": {
       "timestamps": ["2"],
       "size": "640x?"
     }
   }
   ```
6. **ElastiCache Memcached cluster** reachable at `n11817143-a2-cache.km2ji.cfg.apse2.cache.amazonaws.com:11211`.

Record the Parameter Store names and the secret ARN – they are resolved automatically at runtime; the container remains stateless.

## Configuration Files

Two sample environment files are included:

- [`server/.env.example`](server/.env.example) – backend configuration (Cognito IDs, Parameter Store names, limits)
- [`client/.env.example`](client/.env.example) – frontend configuration (API URL, Cognito details)

Copy and edit them before running locally:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

At minimum set:

- `AWS_REGION` or `AWS_DEFAULT_REGION`
- `CLIENT_ORIGINS` (comma-separated list including your frontend origin, e.g. `https://myvideoapp.example.com`)
- Frontend `.env`: `VITE_API_URL`, `VITE_AWS_REGION`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`
- Backend `.env`: set `USE_DEV_SERVICES=true` when developing locally to avoid calling AWS. Leave it unset/false on AWS so the real services are used. Provide `CACHE_ENDPOINT` or `MEMCACHED_ENDPOINT` if the ElastiCache cluster uses a different hostname.

## Running Locally

1. **Install dependencies**
   ```bash
   cd server && npm install
   cd ../client && npm install
   ```
2. **Export AWS credentials** (or rely on your default AWS CLI profile). The backend requires access to S3, DynamoDB, SSM, and Secrets Manager.
3. **Start the services**
   ```bash
   # Terminal 1 – backend
   cd server
   npm run dev

   # Terminal 2 – frontend
   cd client
   npm run dev
   ```
4. Browse to `http://localhost:5173` (default Vite dev server).

The Express API listens on port `4000` by default. On startup it loads configuration from Parameter Store/Secrets Manager, verifies Cognito environment variables, and then responds to requests.

## Docker Compose (local testing)

`docker-compose.yml` keeps runtime secrets out of source control. Provide AWS credentials and any optional overrides before running:

```bash
# Config is fetched dynamically from AWS SSM + Secrets Manager
AWS_REGION=ap-southeast-2 \
CLIENT_ORIGINS=http://localhost:5173 \
VITE_API_URL=http://localhost:4000 \
VITE_AWS_REGION=ap-southeast-2 \
VITE_COGNITO_USER_POOL_ID=ap-southeast-2_CdVnmKfrW \
VITE_COGNITO_CLIENT_ID=11pap5u5svkhr1hgjf934sj0id \
docker-compose up --build
```

The containers use the supplied AWS credentials in the environment; mount `~/.aws` or provide `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` if running outside your workstation.

## Backend API Reference

All routes require a valid Cognito-issued JWT (Authorization header or `token` query parameter for media streams).

| Method & Path | Description |
| --- | --- |
| `POST /api/videos/upload` | Accepts a `file` upload, stores raw bytes in S3 (`raw-videos/`), extracts metadata, writes thumbnail to S3, and inserts metadata into DynamoDB. |
| `GET /api/videos` | Returns paginated videos for the authenticated owner (leveraging the DynamoDB `OwnerIndex`). Includes signed thumbnail URLs. |
| `GET /api/videos/:id` | Fetch a single video record (optionally with a fresh signed thumbnail URL). |
| `GET /api/videos/:id/stream` | Streams the requested variant (`original` or `transcoded`) directly from S3 with Range support. |
| `POST /api/videos/:id/transcode` | Downloads the original from S3, runs ffmpeg using options from Secrets Manager, uploads the result to `transcoded-videos/`, updates DynamoDB. |
| `GET /api/videos/:id/thumbnail` | Redirects to a short-lived signed thumbnail URL in S3. |
| `DELETE /api/videos/:id` | Removes metadata and S3 objects (raw, transcoded, thumbnail). |
| `GET /api/videos/:id/presigned` | Returns a JSON payload containing a pre-signed S3 URL for direct download (`variant=original|transcoded`, `download=true|false`). |
| `GET /api/auth/me` | Echoes the Cognito identity embedded in the JWT. |

Errors are reported in JSON with `error.code` and HTTP status codes.

## Frontend Flow

- The React app configures Amplify Auth with your Cognito IDs. Users sign up / confirm / sign in directly against Cognito.
- After login, the app calls `/api/auth/me` to validate the JWT and persist metadata.
- Uploads use `FormData` to stream bytes to the API, which forwards them to S3.
- Thumbnails and video streams rely on short-lived URLs. Downloads call `/api/videos/:id/presigned` and open the result in a new tab.

Environment variable `VITE_API_URL` should point to your API domain (e.g. `https://myvideoapi.example.com`).

## Route53 / DNS

Expose the API behind an ALB, CloudFront distribution, or API Gateway. Then create a Route53 record so clients call `https://myvideoapi.example.com`:

```yaml
# Example: Route53 A record aliasing an Application Load Balancer
Resources:
  ApiAliasRecord:
    Type: AWS::Route53::RecordSet
    Properties:
      HostedZoneName: example.com.
      Name: myvideoapi.example.com.
      Type: A
      AliasTarget:
        DNSName: !GetAtt ApiLoadBalancer.DNSName
        HostedZoneId: !GetAtt ApiLoadBalancer.CanonicalHostedZoneID
```

Ensure the API’s `CLIENT_ORIGINS` includes the frontend domain (e.g. `https://app.example.com`) so CORS preflights succeed.

## Infrastructure as Code

A starter CloudFormation template is provided at [`infrastructure/cloudformation.yaml`](infrastructure/cloudformation.yaml). It provisions:

- S3 bucket with sensible defaults
- DynamoDB table + `OwnerIndex`
- Cognito user pool and app client
- Parameter Store entries populated from the created resources
- Secrets Manager secret with default ffmpeg options

Use it as a reference or starting point for your own deployment pipeline.

## Running Tests & Linting

- Backend lint: `cd server && npm run lint`
- Frontend lint: `cd client && npm run lint`

## Additional Features Implemented

- ✅ Parameter Store integration (bucket, table, region, Cognito IDs, TTL)
- ✅ Secrets Manager integration for JWT/ffmpeg/thumbnail presets
- ✅ ElastiCache-backed caching for video metadata and pre-signed URLs
- ✅ Pre-signed download endpoint (`/api/videos/:id/presigned`)
- Stateless EC2/container runtime – all persistence in S3/DynamoDB/Cognito

## Troubleshooting

| Issue | Resolution |
| --- | --- |
| `ConfigError: S3 bucket name is required` | Ensure Parameter Store values exist or set `S3_BUCKET`/`DYNAMO_TABLE` directly in `.env`. |
| Cognito JWT validation fails | Confirm `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, and `AWS_REGION` match the user pool issuing tokens. |
| CORS blocked | Verify `CLIENT_ORIGINS` contains the exact protocol/host pair for your frontend (e.g. `https://app.example.com`). |
| ffmpeg errors during transcode | Check the secret’s `FFMPEG_PRESETS`, verify `ffmpeg` is installed, and review CloudWatch/log output. Status in DynamoDB will change to `failed`. |

Happy streaming!
