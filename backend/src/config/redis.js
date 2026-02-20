import redis from 'redis';
import logger from './logger.js';

let redisClient = null;

/**
 * Initialize Redis client
 * Optional - app works without it (graceful degradation)
 */
export const initRedis = async () => {
  try {
    if (!process.env.REDIS_URL) {
      console.log('⚠️  REDIS_URL not set. Caching disabled (running without Redis)');
      return null;
    }

    redisClient = redis.createClient({
      url: process.env.REDIS_URL,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        connectTimeout: 10000,
      },
    });

    redisClient.on('error', (err) => {
      logger.error(`❌ Redis error: ${err.message}`);
      // Don't crash - app works without Redis
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis connected');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.warn(`⚠️  Redis connection failed: ${error.message}`);
    return null;
  }
};

/**
 * Get cached value
 */
export const getCache = async (key) => {
  if (!redisClient) return null;
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.warn(`Cache get error: ${error.message}`);
    return null;
  }
};

/**
 * Set cached value
 */
export const setCache = async (key, value, ttl = 300) => {
  if (!redisClient) return;
  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    logger.warn(`Cache set error: ${error.message}`);
  }
};

/**
 * Delete cached value
 */
export const deleteCache = async (key) => {
  if (!redisClient) return;
  try {
    await redisClient.del(key);
  } catch (error) {
    logger.warn(`Cache delete error: ${error.message}`);
  }
};

/**
 * Clear cache by pattern
 */
export const clearCachePattern = async (pattern) => {
  if (!redisClient) return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    logger.warn(`Cache clear error: ${error.message}`);
  }
};

export { redisClient };