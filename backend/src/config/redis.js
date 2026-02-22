import redis from 'redis';
import logger from './logger.js';

let redisClient = null;

/**
 * Initialize Redis connection with aggressive timeout
 */
export const initRedis = async () => {
  return new Promise((resolve) => {
    // ✅ SET TIMEOUT: If Redis doesn't connect in 3 seconds, skip it
    const timeoutId = setTimeout(() => {
      console.warn('⏱️  Redis connection timeout (3s) - skipping Redis');
      resolve(null); // Don't throw, just continue
    }, 3000);

    try {
      const redisUrl = process.env.REDIS_URL;
      
      if (!redisUrl) {
        clearTimeout(timeoutId);
        console.warn('⚠️  REDIS_URL not configured - skipping Redis');
        resolve(null);
        return;
      }

      console.log('🔗 Connecting to Redis (timeout: 3s)...');

      redisClient = redis.createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            // ✅ FAIL FAST: Give up after 2 retries locally
            if (retries > 2) {
              console.warn('⚠️  Redis gave up reconnecting (retries exceeded)');
              return false; // Stop reconnecting
            }
            return retries * 100; // 100ms, 200ms backoff
          },
          connectTimeout: 2000,    // ✅ 2 second timeout
          keepAlive: 5000,
          noDelay: true
        }
      });

      // ✅ Connection listeners
      redisClient.on('connect', () => {
        clearTimeout(timeoutId);
        console.log('✅ Redis connected');
        resolve(redisClient);
      });

      redisClient.on('error', (err) => {
        console.warn(`⚠️  Redis error: ${err.message}`);
        // Don't block - continue without Redis
      });

      redisClient.on('ready', () => {
        clearTimeout(timeoutId);
        console.log('✅ Redis ready');
        resolve(redisClient);
      });

      // ✅ Connect with timeout
      redisClient.connect().catch((connectErr) => {
        clearTimeout(timeoutId);
        console.warn(`⚠️  Redis connection failed: ${connectErr.message}`);
        redisClient = null;
        resolve(null); // Resolve without Redis
      });

    } catch (error) {
      clearTimeout(timeoutId);
      console.warn(`⚠️  Redis init error: ${error.message}`);
      resolve(null);
    }
  });
};

/**
 * Get Redis client
 */
export const getRedis = () => {
  return redisClient;
};

/**
 * Check if Redis is available
 */
export const isRedisAvailable = () => {
  return redisClient !== null;
};

/**
 * Cache helper - GET
 */
export const getCache = async (key) => {
  if (!redisClient) return null;

  try {
    const cached = await redisClient.get(key);
    if (cached) {
      console.debug(`✅ Cache HIT: ${key}`);
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.warn(`⚠️  Cache GET failed: ${error.message}`);
    return null;
  }
};

/**
 * Cache helper - SET with TTL
 */
export const setCache = async (key, value, ttl = 3600) => {
  if (!redisClient) return;

  try {
    await redisClient.setEx(key, ttl, JSON.stringify(value));
    console.debug(`✅ Cache SET: ${key}`);
  } catch (error) {
    console.warn(`⚠️  Cache SET failed: ${error.message}`);
  }
};

/**
 * Cache helper - DELETE
 */
export const deleteCache = async (key) => {
  if (!redisClient) return;

  try {
    await redisClient.del(key);
    console.debug(`✅ Cache DELETE: ${key}`);
  } catch (error) {
    console.warn(`⚠️  Cache DELETE failed: ${error.message}`);
  }
};

/**
 * Health check
 */
export const checkRedisHealth = async () => {
  if (!redisClient) {
    return { status: 'disabled', message: 'Redis not configured' };
  }

  try {
    await redisClient.ping();
    return { status: 'healthy', message: 'Redis responding' };
  } catch (error) {
    return { status: 'unhealthy', message: error.message };
  }
};

export default {
  initRedis,
  getRedis,
  isRedisAvailable,
  getCache,
  setCache,
  deleteCache,
  checkRedisHealth
};