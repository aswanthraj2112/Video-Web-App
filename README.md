# Video-Web-App
Video Web Application

A full-stack web application that allows users to upload, process, and stream videos through a REST API with a simple web interface.

Features

Frontend: A lightweight web client built with HTML, CSS, and JavaScript.

Backend: Node.js + Express REST API.

Video Uploads: Users can upload video files via the web interface.

Video Processing: Uses FFmpeg
 for CPU-intensive tasks such as transcoding and generating thumbnails.

Data Handling:

Video files stored locally (/uploads).

Metadata (title, description, file path, timestamps) stored in SQLite.

Authentication: JSON Web Token (JWT) support for secure endpoints.

API Documentation: REST endpoints for uploading, listing, streaming, and deleting videos.

Tech Stack

Node.js with Express.js (backend REST API)

SQLite (lightweight database for metadata)

FFmpeg (video processing)

Vanilla JS + HTML/CSS (frontend client)

Project Structure
.
├── index.js               # Entry point for the server
├── package.json
├── routes/                # Express routes
│   ├── auth.js
│   ├── videos.js
├── controllers/           # Route controllers
├── middleware/            # JWT, logging, error handling
├── models/                # SQLite database models
├── public/                # Static frontend files
│   ├── index.html
│   ├── script.js
│   └── style.css
├── uploads/               # Uploaded videos
└── README.md

Setup Instructions
1. Prerequisites

Node.js
 (v18 or later)

FFmpeg
 installed and available in your system PATH

2. Installation
git clone <repository-url>
cd video-web-app
npm install

3. Running Locally
npm start


Open your browser and go to:
http://localhost:3000

4. API Endpoints

POST /api/auth/login – Authenticate user and receive JWT.

POST /api/videos/upload – Upload a new video.

GET /api/videos – List uploaded videos and metadata.

GET /api/videos/:id – Stream a video by ID.

DELETE /api/videos/:id – Delete a video.

5. Frontend

Open http://localhost:3000 for a simple upload and playback interface.

Demo

Start the server

Open the frontend in your browser

Upload a video file

Watch the transcoding process and playback

Notes

Designed for local execution first.

Can be extended with Docker and AWS (EC2, S3, DynamoDB, Cognito, Route53) for cloud deployment in future iterations.

JWT authentication can be toggled or extended with more advanced identity management.
