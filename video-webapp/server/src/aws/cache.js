import memjs from 'memjs';

export const cache = memjs.Client.create('n11817143-a2-cache.km2ji.cfg.apse2.cache.amazonaws.com:11211');

export async function cacheGet (key) {
  try {
    const res = await cache.get(key);
    return res.value ? JSON.parse(res.value.toString()) : null;
  } catch (error) {
    console.warn(`Cache get failed for key ${key}:`, error.message);
    return null;
  }
}

export async function cacheSet (key, value, ttl = 300) {
  try {
    await cache.set(key, JSON.stringify(value), { expires: ttl });
  } catch (error) {
    console.warn(`Cache set failed for key ${key}:`, error.message);
  }
}
