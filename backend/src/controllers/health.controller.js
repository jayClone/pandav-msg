import mongoose from 'mongoose';
import { checkRedisHealth } from '../config/redis.js';

/**
 * Checks the actual state of this service's dependencies, instead of just
 * returning a static 200 regardless of whether Mongo/Redis are reachable.
 * Redis is best-effort everywhere in this app (every cache path already
 * fails open without it), so only MongoDB being down counts as unhealthy —
 * Redis status is reported but doesn't flip the overall verdict.
 */
export const getHealthStatus = async () => {
  const mongoConnected = mongoose.connection.readyState === 1;
  const redis = await checkRedisHealth();

  return {
    healthy: mongoConnected,
    mongo: mongoConnected ? 'connected' : 'disconnected',
    redis: redis.status
  };
};

export const healthCheck = async (req, res) => {
  const status = await getHealthStatus();

  res.status(status.healthy ? 200 : 503).json({
    success: status.healthy,
    status: status.healthy ? 'ok' : 'degraded',
    mongo: status.mongo,
    redis: status.redis,
    timestamp: new Date().toISOString()
  });
};
