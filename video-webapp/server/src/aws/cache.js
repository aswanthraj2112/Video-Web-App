import memjs from 'memjs';
import { getConfig } from '../config.js';
import { useAwsServices } from '../utils/runtime.js';

// Development cache - in-memory storage
const devCache = new Map();

let cacheClient = null;

const getCacheClient = () => {
  if (!useAwsServices()) {
    return null;
  }
  if (!cacheClient) {
    const config = getConfig();
    const endpoint = process.env.MEMCACHED_ENDPOINT
      || process.env.CACHE_ENDPOINT
      || config.CACHE_ENDPOINT;

    if (!endpoint) {
      console.warn('CACHE_ENDPOINT not configured. Falling back to in-memory cache.');
      cacheClient = null;
      return null;
    }

    cacheClient = memjs.Client.create(endpoint);
  }
  return cacheClient;
};

export async function cacheGet (key) {
  if (!useAwsServices()) {
    // Development mode - use in-memory cache
    const cached = devCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }
    devCache.delete(key);
    return null;
  }

  try {
    const cache = getCacheClient();
    if (!cache) {
      return null;
    }
    const res = await cache.get(key);
    return res.value ? JSON.parse(res.value.toString()) : null;
  } catch (error) {
    console.warn(`Cache get failed for key ${key}:`, error.message);
    return null;
  }
}

export async function cacheSet (key, value, ttl = 300) {
  if (!useAwsServices()) {
    // Development mode - use in-memory cache
    devCache.set(key, {
      value,
      expires: Date.now() + (ttl * 1000)
    });
    return;
  }

  try {
    const cache = getCacheClient();
    if (!cache) {
      return;
    }
    await cache.set(key, JSON.stringify(value), { expires: ttl });
  } catch (error) {
    console.warn(`Cache set failed for key ${key}:`, error.message);
  }
}
