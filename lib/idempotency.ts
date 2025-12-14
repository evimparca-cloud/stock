/**
 * Idempotency Service
 * Tekrarlanan istekleri önler (Duplicate webhook, retry vb.)
 */

import { prisma } from './prisma';
import Redis from 'ioredis';

// Redis client for idempotency checks
let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  if (redisClient) return redisClient;
  
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;
  
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
    redisClient.connect().catch(() => {});
    return redisClient;
  } catch {
    return null;
  }
}

export interface IdempotencyResult {
  isNew: boolean;
  existingResult?: any;
  processedAt?: Date;
}

export class IdempotencyService {
  /**
   * Sipariş işleme kontrolü
   * Aynı marketplace order ID'si daha önce işlendi mi?
   */
  static async checkOrderProcessed(
    marketplaceOrderId: string,
    marketplace: string
  ): Promise<IdempotencyResult> {
    const key = `order:${marketplace}:${marketplaceOrderId}`;
    
    // 1. Redis'te hızlı kontrol
    const redis = getRedis();
    if (redis) {
      try {
        const cached = await redis.get(key);
        if (cached) {
          return {
            isNew: false,
            existingResult: JSON.parse(cached),
            processedAt: new Date(),
          };
        }
      } catch (error) {
        console.warn('[Idempotency] Redis check failed, falling back to DB');
      }
    }

    // 2. Database'de kontrol
    const existingOrder = await prisma.order.findUnique({
      where: { marketplaceOrderId },
      select: { id: true, status: true, createdAt: true },
    });

    if (existingOrder) {
      // Redis'e cache'le (24 saat)
      if (redis) {
        try {
          await redis.set(key, JSON.stringify(existingOrder), 'EX', 86400);
        } catch {}
      }
      
      return {
        isNew: false,
        existingResult: existingOrder,
        processedAt: existingOrder.createdAt,
      };
    }

    return { isNew: true };
  }

  /**
   * Webhook event kontrolü
   * Aynı event daha önce işlendi mi?
   */
  static async checkWebhookProcessed(
    eventId: string,
    eventType: string,
    marketplace: string
  ): Promise<IdempotencyResult> {
    const key = `webhook:${marketplace}:${eventType}:${eventId}`;
    
    // Redis'te kontrol
    const redis = getRedis();
    if (redis) {
      try {
        const exists = await redis.exists(key);
        if (exists) {
          const data = await redis.get(key);
          return {
            isNew: false,
            existingResult: data ? JSON.parse(data) : null,
          };
        }
      } catch (error) {
        console.warn('[Idempotency] Redis webhook check failed');
      }
    }

    // WebhookLog tablosunda kontrol
    const existingWebhook = await prisma.webhookLog.findFirst({
      where: {
        eventType,
        marketplace: { name: marketplace },
        payload: {
          path: ['eventId'],
          equals: eventId,
        },
      },
      select: { id: true, status: true, createdAt: true },
    });

    if (existingWebhook) {
      return {
        isNew: false,
        existingResult: existingWebhook,
        processedAt: existingWebhook.createdAt,
      };
    }

    return { isNew: true };
  }

  /**
   * İşlemi tamamlandı olarak işaretle
   */
  static async markProcessed(
    key: string,
    result: any,
    ttlSeconds: number = 86400 // 24 saat
  ): Promise<void> {
    const redis = getRedis();
    if (redis) {
      try {
        await redis.set(key, JSON.stringify(result), 'EX', ttlSeconds);
      } catch (error) {
        console.error('[Idempotency] Failed to mark as processed:', error);
      }
    }
  }

  /**
   * Stok güncelleme kontrolü
   * Aynı ürün için kısa sürede tekrar güncelleme var mı?
   */
  static async checkStockUpdateDuplicate(
    productId: string,
    orderId: string,
    quantity: number
  ): Promise<IdempotencyResult> {
    const key = `stock:${productId}:${orderId}:${quantity}`;
    
    const redis = getRedis();
    if (redis) {
      try {
        const exists = await redis.exists(key);
        if (exists) {
          return { isNew: false };
        }
        
        // 5 dakika boyunca bu kombinasyonu işaretlerece
        await redis.set(key, '1', 'EX', 300);
      } catch (error) {
        console.warn('[Idempotency] Stock duplicate check failed');
      }
    }

    // Database'de son 5 dakikada aynı işlem var mı?
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingLog = await prisma.stockLog.findFirst({
      where: {
        productId,
        orderId,
        quantity,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (existingLog) {
      return {
        isNew: false,
        existingResult: existingLog,
        processedAt: existingLog.createdAt,
      };
    }

    return { isNew: true };
  }

  /**
   * Idempotency key ile generic kontrol
   */
  static async withIdempotency<T>(
    idempotencyKey: string,
    operation: () => Promise<T>,
    ttlSeconds: number = 3600
  ): Promise<{ result: T; wasNew: boolean }> {
    const redis = getRedis();
    
    // Önce kontrol
    if (redis) {
      try {
        const existing = await redis.get(`idem:${idempotencyKey}`);
        if (existing) {
          return {
            result: JSON.parse(existing),
            wasNew: false,
          };
        }
      } catch {}
    }

    // İşlemi çalıştır
    const result = await operation();

    // Sonucu cache'le
    if (redis) {
      try {
        await redis.set(`idem:${idempotencyKey}`, JSON.stringify(result), 'EX', ttlSeconds);
      } catch {}
    }

    return { result, wasNew: true };
  }
}

/**
 * Decorator fonksiyon - Order işleme için idempotency wrapper
 */
export async function processOrderWithIdempotency(
  marketplaceOrderId: string,
  marketplace: string,
  processor: () => Promise<any>
): Promise<{ success: boolean; result?: any; duplicate?: boolean; error?: string }> {
  // 1. Daha önce işlenmiş mi kontrol et
  const check = await IdempotencyService.checkOrderProcessed(
    marketplaceOrderId,
    marketplace
  );

  if (!check.isNew) {
    console.log(`[Idempotency] Order already processed: ${marketplaceOrderId}`);
    return {
      success: true,
      result: check.existingResult,
      duplicate: true,
    };
  }

  // 2. İşlemi çalıştır
  try {
    const result = await processor();
    
    // 3. Başarılı olarak işaretle
    await IdempotencyService.markProcessed(
      `order:${marketplace}:${marketplaceOrderId}`,
      result
    );

    return { success: true, result, duplicate: false };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duplicate: false,
    };
  }
}
