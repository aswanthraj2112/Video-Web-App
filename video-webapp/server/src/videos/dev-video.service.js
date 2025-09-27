import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import { getConfig } from '../awsConfig.js';

// Development storage - in-memory database simulation
let devVideoDatabase = [];
let nextVideoId = 1;

const getDevStoragePath = () => {
  const config = getConfig();
  return path.join(config.PUBLIC_DIR, 'dev-storage');
};

const ensureDevStorageExists = async () => {
  const storagePath = getDevStoragePath();
  if (!existsSync(storagePath)) {
    await fs.mkdir(storagePath, { recursive: true });
  }
  // Create subdirectories
  await fs.mkdir(path.join(storagePath, 'videos'), { recursive: true });
  await fs.mkdir(path.join(storagePath, 'thumbnails'), { recursive: true });
};

export const devListVideos = async (userId, page = 1, limit = 10) => {
  await ensureDevStorageExists();
  
  // Filter videos for this user
  const userVideos = devVideoDatabase
    .filter(video => video.ownerId === userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  
  const offset = (page - 1) * limit;
  const videos = userVideos.slice(offset, offset + limit);
  
  return {
    items: videos.map(video => ({
      ...video,
      thumbnailUrl: `/dev-storage/thumbnails/${video.id}-thumb.jpg`,
      videoUrl: `/dev-storage/videos/${video.id}-video.mp4`
    })),
    total: userVideos.length,
    currentPage: page,
    totalPages: Math.ceil(userVideos.length / limit)
  };
};

export const devUploadVideo = async (userId, file, metadata = {}) => {
  await ensureDevStorageExists();
  
  const videoId = `dev-video-${nextVideoId++}`;
  const storagePath = getDevStoragePath();
  
  // Save the uploaded file
  const videoPath = path.join(storagePath, 'videos', `${videoId}-video.mp4`);
  await fs.writeFile(videoPath, file.buffer);
  
  // Create a mock thumbnail (just copy the video file for now)
  const thumbnailPath = path.join(storagePath, 'thumbnails', `${videoId}-thumb.jpg`);
  await fs.writeFile(thumbnailPath, Buffer.from('mock-thumbnail-data'));
  
  // Create video record
  const video = {
    id: videoId,
    ownerId: userId,
    originalName: file.originalname || 'uploaded-video.mp4',
    title: metadata.title || file.originalname || 'Untitled Video',
    description: metadata.description || '',
    size: file.size || 0,
    duration: 120, // Mock duration
    status: 'ready',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    thumbnailUrl: `/dev-storage/thumbnails/${videoId}-thumb.jpg`,
    videoUrl: `/dev-storage/videos/${videoId}-video.mp4`
  };
  
  devVideoDatabase.push(video);
  return video;
};

export const devGetVideo = async (videoId, userId) => {
  const video = devVideoDatabase.find(v => v.id === videoId && v.ownerId === userId);
  if (!video) {
    throw new Error('Video not found');
  }
  return video;
};

export const devDeleteVideo = async (videoId, userId) => {
  const index = devVideoDatabase.findIndex(v => v.id === videoId && v.ownerId === userId);
  if (index === -1) {
    throw new Error('Video not found');
  }
  
  const video = devVideoDatabase[index];
  devVideoDatabase.splice(index, 1);
  
  // Delete files
  const storagePath = getDevStoragePath();
  try {
    await fs.unlink(path.join(storagePath, 'videos', `${videoId}-video.mp4`));
    await fs.unlink(path.join(storagePath, 'thumbnails', `${videoId}-thumb.jpg`));
  } catch (error) {
    console.warn('Failed to delete video files:', error.message);
  }
  
  return video;
};

export const devUpdateVideo = async (videoId, userId, updates) => {
  const index = devVideoDatabase.findIndex(v => v.id === videoId && v.ownerId === userId);
  if (index === -1) {
    throw new Error('Video not found');
  }
  
  devVideoDatabase[index] = {
    ...devVideoDatabase[index],
    ...updates,
    updatedAt: new Date().toISOString()
  };
  
  return devVideoDatabase[index];
};

// Initialize with some mock videos for demo
const initializeMockData = () => {
  if (devVideoDatabase.length === 0) {
    devVideoDatabase = [
      {
        id: 'dev-video-1',
        ownerId: 'dev-user-id',
        originalName: 'sample-video-1.mp4',
        title: 'Sample Video 1',
        description: 'This is a sample video for development',
        size: 1024000,
        duration: 60,
        status: 'ready',
        createdAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
        thumbnailUrl: '/dev-storage/thumbnails/dev-video-1-thumb.jpg',
        videoUrl: '/dev-storage/videos/dev-video-1-video.mp4'
      },
      {
        id: 'dev-video-2',
        ownerId: 'dev-user-id',
        originalName: 'sample-video-2.mp4',
        title: 'Sample Video 2',
        description: 'Another sample video for development',
        size: 2048000,
        duration: 90,
        status: 'ready',
        createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        updatedAt: new Date(Date.now() - 172800000).toISOString(),
        thumbnailUrl: '/dev-storage/thumbnails/dev-video-2-thumb.jpg',
        videoUrl: '/dev-storage/videos/dev-video-2-video.mp4'
      }
    ];
    nextVideoId = 3;
  }
};

export const devGetPresignedUrl = async (videoId, userId, variant = 'original', download = true) => {
  await ensureDevStorageExists();
  
  // Find the video
  const video = devVideoDatabase.find(v => v.id === videoId && v.ownerId === userId);
  if (!video) {
    throw new Error('Video not found');
  }
  
  // Return a direct URL to the development storage
  const baseUrl = `http://localhost:4000/dev-storage`;
  const filename = variant === 'transcoded' && video.transcodedKey 
    ? `${videoId}-transcoded.mp4` 
    : `${videoId}-video.mp4`;
  
  return {
    url: `${baseUrl}/videos/${filename}`,
    expiresAt: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
    variant,
    download
  };
};

// Initialize mock data
initializeMockData();