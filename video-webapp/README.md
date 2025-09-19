# Video Web App

A local-first video management web application with an Express/SQLite backend and a React (Vite) frontend. Upload videos, generate thumbnails, trigger ffmpeg transcodes, and stream securely via JWT.

## Prerequisites
- Node.js 18+
- npm 9+
- [ffmpeg](https://ffmpeg.org/) installed and available on your `PATH`

## Getting Started
1. **Install backend dependencies**
   ```bash
   cd server
   npm install
   ```
2. **Configure environment and initialize the database**
   ```bash
   cp .env.example .env
   npm run init-db
   ```
3. **Install frontend dependencies**
   ```bash
   cd ../client
   npm install
   ```
4. **Run both apps together**
   ```bash
   cd ..
   npm run dev
   ```

The root `npm run dev` script launches the Express API (port 4000 by default) and the Vite dev server (port 5173) concurrently. The backend serves uploaded videos and thumbnails from `server/src/public`.

## Usage
- Register a user via `POST /api/auth/register` or the UI login form.
- Upload a video from the dashboard. The server probes metadata, stores the original file under `server/src/public/videos`, and generates a thumbnail in `server/src/public/thumbs`.
- Trigger a transcode to 720p (H.264/AAC) from the dashboard. Progress is reflected in the video status (`uploaded → transcoding → ready`).
- Stream or download originals/transcodes directly in the dashboard via the secure `/stream` endpoint.

## Troubleshooting
| Issue | Fix |
|-------|-----|
| `ffmpeg` not found | Ensure ffmpeg is installed and accessible via your shell `PATH`. On macOS you can use Homebrew (`brew install ffmpeg`); on Linux use your package manager. |
| CORS errors in the browser console | Confirm `CLIENT_ORIGIN` inside `server/.env` matches the Vite dev URL (default `http://localhost:5173`). Restart the server after changes. |
| File upload limits | Multer defaults allow reasonably large files, but Node may still hit memory limits on extremely large uploads. Adjust `LIMIT_FILE_SIZE_MB` in `.env` and restart if needed. |
| Database missing tables | Re-run `npm run init-db` inside `/server` to create or migrate the SQLite schema. |

## File Storage Layout
```
server/src/public/
  videos/   # original and transcoded mp4 files
  thumbs/   # generated thumbnails (.jpg)
```

Backups are as simple as copying the SQLite file (`server/data.sqlite` by default) and the `public/` directory.

## Testing Users
Create accounts directly via the UI login form (switch to Register tab) or issue a `POST /api/auth/register` call with `{ "username": "demo", "password": "demo123" }`.

## Scripts Overview
- `npm run dev` (root): run both backend and frontend concurrently
- `npm run dev` (server): nodemon-powered Express server with auto-reload
- `npm run init-db` (server): create the SQLite tables
- `npm run lint` (server/client): run ESLint for code quality
- `npm run build` (client): build production-ready frontend assets

Enjoy building locally without any cloud dependencies!
