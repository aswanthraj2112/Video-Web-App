import memjs from 'memjs';
import { getConfig } from '../config.js';

// Development cache - in-memory storage
const devCache = new Map();

const hasAwsCredentials = () => {
  // Force development mode
  return false;
};

export const cache = memjs.Client.create('n11817143-a2-cache.km2ji.cfg.apse2.cache.amazonaws.com:11211');

export async function cacheGet (key) {
  if (!hasAwsCredentials()) {
    // Development mode - use in-memory cache
    const cached = devCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }
    devCache.delete(key);
    return null;
  }

  try {
    const res = await cache.get(key);
    return res.value ? JSON.parse(res.value.toString()) : null;
  } catch (error) {
    console.warn(`Cache get failed for key ${key}:`, error.message);
    return null;
  }
}

export async function cacheSet (key, value, ttl = 300) {
  if (!hasAwsCredentials()) {
    // Development mode - use in-memory cache
    devCache.set(key, {
      value,
      expires: Date.now() + (ttl * 1000)
    });
    return;
  }

  try {
    await cache.set(key, JSON.stringify(value), { expires: ttl });
  } catch (error) {
    console.warn(`Cache set failed for key ${key}:`, error.message);
  }
}
