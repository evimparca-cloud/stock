/**
 * Enterprise Rate Limiter
 * Redis-based (kalıcı, ölçeklenebilir) + Memory fallback
 */

import Redis from 'ioredis';

export interface RateLimitConfig {
  windowMs: number;     // Time window in milliseconds
  maxRequests: number;  // Max requests per window
  message?: string;     // Custom error message
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  message?: string;
}

// Redis client (singleton)
let redisClient: Redis | null = null;
let redisConnected = false;

// Memory fallback store
const memoryStore = new Map<string, { count: number; resetTime: number }>();

// Initialize Redis connection (LAZY - sadece gerektiğinde)
let redisInitAttempted = false;

function getRedisClient(): Redis | null {
  // Zaten bağlıysa kullan
  if (redisClient && redisConnected) return redisClient;
  
  // Daha önce denedik ve başarısız olduysa tekrar deneme
  if (redisInitAttempted && !redisConnected) return null;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    // Sadece bir kez log bas
    if (!redisInitAttempted) {
      console.log('[Rate Limiter] REDIS_URL not set, using memory (fast mode)');
    }
    redisInitAttempted = true;
    return null;
  }

  redisInitAttempted = true;

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1,        // Hızlı fail
      connectTimeout: 3000,           // 3 saniye timeout
      enableReadyCheck: false,        // Hızlı başlangıç
      lazyConnect: true,
    });

    redisClient.on('connect', () => {
      redisConnected = true;
    });

    redisClient.on('error', () => {
      redisConnected = false;
    });

    redisClient.on('close', () => {
      redisConnected = false;
    });

    // Async bağlan, bekletme
    redisClient.connect().catch(() => {
      redisConnected = false;
    });

    return redisClient;
  } catch {
    return null;
  }
}

// Cleanup memory store periodically
setInterval(() => {
  const now = Date.now();
  memoryStore.forEach((value, key) => {
    if (value.resetTime < now) {
      memoryStore.delete(key);
    }
  });
}, 5 * 60 * 1000);

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      message: 'Too many requests, please try again later.',
      ...config,
    };
  }

  /**
   * Redis-based rate limiting with memory fallback
   */
  async checkLimit(identifier: string): Promise<RateLimitResult> {
    const key = `rate_limit:${identifier}`;
    const redis = getRedisClient();

    // Try Redis first
    if (redis && redisConnected) {
      try {
        return await this.checkLimitRedis(redis, key);
      } catch (error) {
        console.warn('[Rate Limiter] Redis failed, using memory fallback');
        return this.checkLimitMemory(key);
      }
    }

    // Fallback to memory
    return this.checkLimitMemory(key);
  }

  /**
   * Redis-based check (kalıcı, ölçeklenebilir)
   */
  private async checkLimitRedis(redis: Redis, key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const windowSeconds = Math.ceil(this.config.windowMs / 1000);

    // Atomic increment with TTL
    const multi = redis.multi();
    multi.incr(key);
    multi.ttl(key);
    const results = await multi.exec();

    const count = results?.[0]?.[1] as number || 1;
    const ttl = results?.[1]?.[1] as number || -1;

    // Set TTL if new key
    if (ttl === -1) {
      await redis.expire(key, windowSeconds);
    }

    const resetTime = now + (ttl > 0 ? ttl * 1000 : this.config.windowMs);

    if (count > this.config.maxRequests) {
      return {
        success: false,
        limit: this.config.maxRequests,
        remaining: 0,
        resetTime,
        message: this.config.message,
      };
    }

    return {
      success: true,
      limit: this.config.maxRequests,
      remaining: this.config.maxRequests - count,
      resetTime,
    };
  }

  /**
   * Memory-based fallback
   */
  private checkLimitMemory(key: string): RateLimitResult {
    const now = Date.now();
    let entry = memoryStore.get(key);

    if (!entry || entry.resetTime < now) {
      entry = { count: 0, resetTime: now + this.config.windowMs };
      memoryStore.set(key, entry);
    }

    if (entry.count >= this.config.maxRequests) {
      return {
        success: false,
        limit: this.config.maxRequests,
        remaining: 0,
        resetTime: entry.resetTime,
        message: this.config.message,
      };
    }

    entry.count++;
    memoryStore.set(key, entry);

    return {
      success: true,
      limit: this.config.maxRequests,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Clear rate limit (Redis + Memory)
   */
  async clearLimit(identifier: string): Promise<void> {
    const key = `rate_limit:${identifier}`;
    memoryStore.delete(key);

    const redis = getRedisClient();
    if (redis && redisConnected) {
      try {
        await redis.del(key);
      } catch (error) {
        console.error('[Rate Limiter] Failed to clear Redis key:', error);
      }
    }
  }

  /**
   * Get current status
   */
  async getStatus(identifier: string): Promise<{ count: number; remaining: number; isBlocked: boolean; storage: string }> {
    const key = `rate_limit:${identifier}`;
    const redis = getRedisClient();

    if (redis && redisConnected) {
      try {
        const count = parseInt(await redis.get(key) || '0', 10);
        return {
          count,
          remaining: Math.max(0, this.config.maxRequests - count),
          isBlocked: count >= this.config.maxRequests,
          storage: 'redis',
        };
      } catch (error) {
        // Fallback to memory
      }
    }

    const entry = memoryStore.get(key);
    const now = Date.now();

    if (!entry || entry.resetTime < now) {
      return { count: 0, remaining: this.config.maxRequests, isBlocked: false, storage: 'memory' };
    }

    return {
      count: entry.count,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      isBlocked: entry.count >= this.config.maxRequests,
      storage: 'memory',
    };
  }

  /**
   * Ban IP permanently (Redis only)
   */
  async banIP(ip: string, durationMs: number = 24 * 60 * 60 * 1000): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis || !redisConnected) return false;

    try {
      const key = `ip_ban:${ip}`;
      await redis.set(key, '1', 'PX', durationMs);
      console.log(`[Rate Limiter] IP banned: ${ip} for ${durationMs}ms`);
      return true;
    } catch (error) {
      console.error('[Rate Limiter] Failed to ban IP:', error);
      return false;
    }
  }

  /**
   * Check if IP is banned
   */
  async isIPBanned(ip: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis || !redisConnected) return false;

    try {
      const banned = await redis.get(`ip_ban:${ip}`);
      return banned === '1';
    } catch (error) {
      return false;
    }
  }

  /**
   * Unban IP
   */
  async unbanIP(ip: string): Promise<boolean> {
    const redis = getRedisClient();
    if (!redis || !redisConnected) return false;

    try {
      await redis.del(`ip_ban:${ip}`);
      return true;
    } catch (error) {
      return false;
    }
  }
}

// Predefined rate limiters
export const loginLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,            // 5 attempts per 15 minutes
  message: 'Too many login attempts, please try again in 15 minutes.',
});

export const apiLimiter = new RateLimiter({
  windowMs: 60 * 1000,      // 1 minute
  maxRequests: 100,         // 100 requests per minute
  message: 'API rate limit exceeded, please slow down.',
});

export const strictApiLimiter = new RateLimiter({
  windowMs: 60 * 1000,      // 1 minute  
  maxRequests: 10,          // 10 requests per minute
  message: 'Strict API rate limit exceeded.',
});

// Helper function to get client IP
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  return 'unknown';
}

// Middleware helper
export async function withRateLimit(
  request: Request,
  limiter: RateLimiter,
  identifier?: string
): Promise<{ success: boolean; response?: Response; result: RateLimitResult }> {
  const ip = identifier || getClientIP(request);
  const result = await limiter.checkLimit(ip);

  if (!result.success) {
    const response = new Response(
      JSON.stringify({
        error: result.message,
        limit: result.limit,
        remaining: result.remaining,
        resetTime: result.resetTime,
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': result.resetTime.toString(),
          'Retry-After': Math.ceil((result.resetTime - Date.now()) / 1000).toString(),
        },
      }
    );

    return { success: false, response, result };
  }

  return { success: true, result };
}
