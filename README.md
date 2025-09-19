# Video-Web-App

A full-stack web application for uploading, transcoding, and streaming video content.  
The backend exposes a REST API for authentication, upload management, and media streaming, while the frontend provides an intuitive interface for creators and viewers.  

This README guides you through local setup, environment configuration, and everyday workflows.

---

## Table of Contents
- [Prerequisites](#prerequisites)  
- [Project Structure](#project-structure)  
- [Installation](#installation)  
  - [Server Setup](#server-setup)  
  - [Client Setup](#client-setup)  
- [Environment Variables](#environment-variables)  
- [Initialize the Database](#initialize-the-database)  
- [Using the Application](#using-the-application)  
  - [Register and Log In](#register-and-log-in)  
  - [Upload and Transcode Videos](#upload-and-transcode-videos)  
  - [Stream Videos](#stream-videos)  
  - [File Storage Locations](#file-storage-locations)  
- [Troubleshooting](#troubleshooting)  

---

## Prerequisites

Make sure the following software is installed:

| Tool      | Version         | Notes                                                                 |
|-----------|-----------------|----------------------------------------------------------------------|
| Node.js   | **18.x+**       | Required for both server and client. Install via [nvm](https://github.com/nvm-sh/nvm) or official installer. |
| npm       | 8.x+            | Bundled with Node.js. Check with `npm -v`.                           |
| FFmpeg    | Latest stable   | Used for transcoding and thumbnails. Confirm with `ffmpeg -version`. |
| Git       | Latest          | For cloning and managing the repo.                                   |
| Database  | PostgreSQL/MySQL/SQLite | PostgreSQL is assumed in examples; configure via `DATABASE_URL`. |

---

## Project Structure

```
Video-Web-App/
├── client/          # Vite + React front-end
├── server/          # Node.js API and background workers
├── prisma/          # Prisma schema and migrations
├── storage/
│   ├── uploads/     # Raw video uploads
│   └── transcoded/  # HLS/MP4 outputs from FFmpeg
└── README.md        # This file
```

> If `storage/uploads` or `storage/transcoded` don’t exist, create them before running the server.

---

## Installation

Clone the repo and install dependencies for both server and client:

```bash
git clone https://github.com/<your-org>/Video-Web-App.git
cd Video-Web-App
```

### Server Setup
```bash
cd server
npm install
```

1. Copy `.env.example` to `.env` and edit values.  
2. Generate Prisma types:
   ```bash
   npx prisma generate
   ```
3. Run in dev mode:
   ```bash
   npm run dev
   ```
   Server runs at: `http://localhost:4000`.

### Client Setup
```bash
cd client
npm install
npm run dev
```

Frontend runs at: `http://localhost:5173`.

---

## Environment Variables

### Server `.env`
```env
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://video_user:video_password@localhost:5432/video_app
JWT_SECRET=replace-with-a-secure-random-string
UPLOAD_DIR=storage/uploads
TRANSCODED_DIR=storage/transcoded
FFMPEG_PATH=/usr/bin/ffmpeg
MAX_UPLOAD_SIZE_MB=500
```

### Client `.env`
```env
VITE_API_URL=http://localhost:4000
VITE_STREAMING_URL=http://localhost:4000/stream
VITE_CHUNK_SIZE_MB=5
```

> **Note:** The frontend automatically prefixes API requests with `/api/…`. Supplying a base URL that already ends with `/api` will cause requests like `/api/api/auth/login`, which the server rejects with "Route not found" errors during login.

---

## Initialize the Database

```bash
cd server
npx prisma migrate dev --name init
npx prisma db seed   # optional: seed admin/demo data
```

---

## Using the Application

Start both server and client. Then open `http://localhost:5173`.

### Register and Log In
- **Sign Up** → `POST /auth/register`  
- **Login** → `POST /auth/login` (returns JWT)  

### Upload and Transcode
- Upload file → `POST /videos`  
- Server stores in `storage/uploads` → transcodes with FFmpeg → saves to `storage/transcoded/<videoId>/`.

### Stream Videos
- HLS playback → `GET /stream/:videoId/master.m3u8`  
- Optional MP4 download → `GET /videos/:id/download`

### File Storage
- Raw: `storage/uploads/<videoId>/<filename>`  
- Transcoded: `storage/transcoded/<videoId>/`  

---

## Troubleshooting

### FFmpeg not found
- Check `ffmpeg -version`.  
- If installed but not found, set `FFMPEG_PATH` in `.env`.  

### CORS errors
- Ensure `CLIENT_URL` matches frontend host exactly.  

### Upload file too large
- Adjust `MAX_UPLOAD_SIZE_MB` in `.env`.  
- Ensure disk space is 2–3× original video size for processing.  

---
