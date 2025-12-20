import Redis from "ioredis";

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  tls: process.env.REDIS_TLS === "true" ? {} : undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  enableOfflineQueue: false,
  connectTimeout: 5000,
  lazyConnect: true,
  retryStrategy: (times) => {
    // Don't log retry attempts, just return delay for exponential backoff
    const delay = Math.min(times * 50, 30000);
    return delay;
  },
});

redis.on("connect", () => {
  console.log("✅ Connected to Redis");
});

redis.on("error", (err) => {
  // Silently fail for optional Redis in development
  // Redis is optional - application works without it
});

redis.on("close", () => {
  // Silent close
});

// Suppress initial connection attempts
redis.removeAllListeners("error");

export default redis;
