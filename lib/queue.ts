/**
 * Enterprise Queue System with BullMQ
 * Redis yoksa DEV MODE'da çalışır (queue'suz, direkt işlem)
 */

import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { AuditLogger } from './audit';

// ============================================================================
// REDIS CONNECTION (Lazy, tek seferlik)
// ============================================================================

let redis: Redis | null = null;
let redisChecked = false;
let redisOk = false;

function getRedis(): Redis | null {
  if (redisChecked) return redisOk ? redis : null;
  redisChecked = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    console.log('[Queue] Dev mode - Redis yok, queue\'lar devre dışı');
    return null;
  }

  try {
    redis = new Redis(url, { maxRetriesPerRequest: null, connectTimeout: 3000 });
    redisOk = true;
    return redis;
  } catch {
    return null;
  }
}

// ============================================================================
// QUEUE DEFINITIONS
// ============================================================================

export interface StockSyncJob {
  productId: string;
  marketplace: string;
  sku: string;
  quantity: number;
  action: 'UPDATE' | 'SYNC' | 'VERIFY';
  retryCount?: number;
}

export interface OrderProcessJob {
  orderId: string;
  marketplace: string;
  action: 'PROCESS' | 'CANCEL' | 'REFUND' | 'SHIP';
  data?: any;
}

export interface NotificationJob {
  type: 'DISCORD' | 'TELEGRAM' | 'EMAIL';
  message: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  data?: any;
}

// ============================================================================
// STOCK SYNC QUEUE
// ============================================================================

let stockSyncQueue: Queue<StockSyncJob> | null = null;
let stockSyncWorker: Worker<StockSyncJob> | null = null;

export function getStockSyncQueue(): Queue<StockSyncJob> | null {
  const redis = getRedis();
  if (!redis) return null; // Redis yoksa queue yok

  if (!stockSyncQueue) {
    stockSyncQueue = new Queue<StockSyncJob>('stock-sync', {
      connection: redis,
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 30000,
        },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: false,
      },
    });
  }
  return stockSyncQueue;
}

export async function addStockSyncJob(job: StockSyncJob, priority: number = 0): Promise<Job<StockSyncJob> | null> {
  const queue = getStockSyncQueue();
  if (!queue) return null;

  return await queue.add(
    `stock-${job.action.toLowerCase()}-${job.marketplace}`,
    job,
    {
      priority,
      jobId: `${job.marketplace}-${job.sku}-${Date.now()}`,
    }
  );
}

// ============================================================================
// ORDER PROCESS QUEUE
// ============================================================================

let orderProcessQueue: Queue<OrderProcessJob> | null = null;

export function getOrderProcessQueue(): Queue<OrderProcessJob> | null {
  const redis = getRedis();
  if (!redis) return null;

  if (!orderProcessQueue) {
    orderProcessQueue = new Queue<OrderProcessJob>('order-process', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10000,
        },
        removeOnComplete: {
          age: 7 * 24 * 3600,
          count: 5000,
        },
        removeOnFail: false, // Keep failed jobs for DLQ
      },
    });
  }
  return orderProcessQueue;
}

export async function addOrderProcessJob(job: OrderProcessJob): Promise<Job<OrderProcessJob> | null> {
  const queue = getOrderProcessQueue();
  if (!queue) return null;

  return await queue.add(
    `order-${job.action.toLowerCase()}`,
    job,
    {
      jobId: `order-${job.orderId}-${job.action}-${Date.now()}`,
    }
  );
}

// ============================================================================
// NOTIFICATION QUEUE
// ============================================================================

let notificationQueue: Queue<NotificationJob> | null = null;

export function getNotificationQueue(): Queue<NotificationJob> | null {
  const redis = getRedis();
  if (!redis) return null;

  if (!notificationQueue) {
    notificationQueue = new Queue<NotificationJob>('notifications', {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 5000,
        },
        removeOnComplete: {
          age: 3600, // 1 saat
          count: 500,
        },
        removeOnFail: false, // Keep failed jobs for DLQ
      },
    });
  }
  return notificationQueue;
}

export async function sendNotification(job: NotificationJob): Promise<Job<NotificationJob> | null> {
  const queue = getNotificationQueue();
  if (!queue) return null;

  const priorityMap = { LOW: 4, MEDIUM: 3, HIGH: 2, CRITICAL: 1 };

  return await queue.add(
    `notify-${job.type.toLowerCase()}`,
    job,
    {
      priority: priorityMap[job.priority],
    }
  );
}

// ============================================================================
// WORKERS
// ============================================================================

export function startStockSyncWorker() {
  const redis = getRedis();
  if (!redis) return null;
  if (stockSyncWorker) return stockSyncWorker;

  stockSyncWorker = new Worker<StockSyncJob>(
    'stock-sync',
    async (job) => {
      const { productId, marketplace, sku, quantity, action } = job.data;

      console.log(`[Queue] Processing stock ${action} for ${marketplace}: ${sku}`);

      try {
        // Marketplace'e göre API çağrısı yap
        switch (marketplace.toLowerCase()) {
          case 'trendyol':
            await syncToTrendyol(sku, quantity);
            break;
          case 'hepsiburada':
            await syncToHepsiburada(sku, quantity);
            break;
          case 'amazon':
            await syncToAmazon(sku, quantity);
            break;
          default:
            throw new Error(`Unknown marketplace: ${marketplace}`);
        }

        // Audit log
        await AuditLogger.logMarketplaceSync(
          marketplace,
          `STOCK_${action}`,
          true,
          { productId, sku, quantity, jobId: job.id }
        );

        console.log(`[Queue] ✅ Stock ${action} completed for ${marketplace}: ${sku}`);

        return { success: true, sku, quantity };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        console.error(`[Queue] ❌ Stock ${action} failed for ${marketplace}: ${sku}`, errorMessage);

        // Audit log
        await AuditLogger.logMarketplaceSync(
          marketplace,
          `STOCK_${action}`,
          false,
          { productId, sku, quantity, error: errorMessage, attempt: job.attemptsMade + 1 },
          'SYNC_FAILED'
        );

        // Son deneme mi? Kritik bildirim gönder
        if (job.attemptsMade >= (job.opts.attempts || 5) - 1) {
          await sendNotification({
            type: 'DISCORD',
            message: `🚨 **STOCK SYNC FAILED** (Max retries reached)\nMarketplace: ${marketplace}\nSKU: ${sku}\nError: ${errorMessage}`,
            priority: 'CRITICAL',
            data: { productId, sku, marketplace, error: errorMessage },
          });
        }

        throw error; // Retry için
      }
    },
    {
      connection: redis,
      concurrency: 5, // 5 paralel iş
      limiter: {
        max: 10,
        duration: 1000, // Saniyede max 10 istek
      },
    }
  );

  stockSyncWorker.on('completed', (job) => {
    console.log(`[Queue] Job ${job.id} completed`);
  });

  stockSyncWorker.on('failed', (job, err) => {
    console.error(`[Queue] Job ${job?.id} failed:`, err.message);
  });

  stockSyncWorker.on('stalled', (jobId) => {
    console.warn(`[Queue] Job ${jobId} stalled`);
  });

  return stockSyncWorker;
}

// ============================================================================
// MARKETPLACE API FUNCTIONS (Placeholder - gerçek implementasyon için)
// ============================================================================

async function syncToTrendyol(sku: string, quantity: number): Promise<void> {
  // TODO: Gerçek Trendyol API çağrısı
  const apiKey = process.env.TRENDYOL_API_KEY;
  const apiSecret = process.env.TRENDYOL_API_SECRET;
  const sellerId = process.env.TRENDYOL_SELLER_ID;

  if (!apiKey || !apiSecret || !sellerId) {
    throw new Error('Trendyol API credentials not configured');
  }

  // Simulate API call
  await new Promise((resolve, reject) => {
    setTimeout(() => {
      // %10 hata olasılığı (test için)
      if (Math.random() < 0.1) {
        reject(new Error('Trendyol API timeout'));
      } else {
        resolve(true);
      }
    }, 1000);
  });
}

async function syncToHepsiburada(sku: string, quantity: number): Promise<void> {
  // TODO: Gerçek Hepsiburada API çağrısı
  await new Promise((resolve) => setTimeout(resolve, 500));
}

async function syncToAmazon(sku: string, quantity: number): Promise<void> {
  // TODO: Gerçek Amazon API çağrısı
  await new Promise((resolve) => setTimeout(resolve, 500));
}

// ============================================================================
// QUEUE STATUS & MONITORING
// ============================================================================

export async function getQueueStats() {
  const stockQueue = getStockSyncQueue();
  const orderQueue = getOrderProcessQueue();
  const notifyQueue = getNotificationQueue();

  const [stockCounts, orderCounts, notifyCounts] = await Promise.all([
    stockQueue?.getJobCounts() || Promise.resolve({}),
    orderQueue?.getJobCounts() || Promise.resolve({}),
    notifyQueue?.getJobCounts() || Promise.resolve({}),
  ]);

  return {
    stockSync: stockCounts,
    orderProcess: orderCounts,
    notifications: notifyCounts,
    timestamp: new Date().toISOString(),
  };
}

export async function getFailedJobs(queueName: string, limit: number = 10) {
  let queue: Queue<any> | null = null;

  switch (queueName) {
    case 'stock-sync':
      queue = getStockSyncQueue();
      break;
    case 'order-process':
      queue = getOrderProcessQueue();
      break;
    case 'notifications':
      queue = getNotificationQueue();
      break;
    default:
      throw new Error(`Unknown queue: ${queueName}`);
  }

  if (!queue) {
    return [];
  }

  return await queue.getFailed(0, limit);
}

export async function retryFailedJob(queueName: string, jobId: string) {
  const jobs = await getFailedJobs(queueName, 100);
  const job = jobs.find(j => j.id === jobId);

  if (job) {
    await job.retry();
    return true;
  }

  return false;
}

export async function clearQueue(queueName: string) {
  let queue: Queue<any> | null = null;

  switch (queueName) {
    case 'stock-sync':
      queue = getStockSyncQueue();
      break;
    case 'order-process':
      queue = getOrderProcessQueue();
      break;
    case 'notifications':
      queue = getNotificationQueue();
      break;
    default:
      throw new Error(`Unknown queue: ${queueName}`);
  }

  if (!queue) {
    throw new Error(`Queue ${queueName} is not available`);
  }

  await queue.obliterate({ force: true });
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

export async function shutdownQueues() {
  console.log('[Queue] Shutting down queues...');

  if (stockSyncWorker) {
    await stockSyncWorker.close();
  }

  if (stockSyncQueue) {
    await stockSyncQueue.close();
  }

  if (orderProcessQueue) {
    await orderProcessQueue.close();
  }

  if (notificationQueue) {
    await notificationQueue.close();
  }

  console.log('[Queue] All queues closed');
}

// Handle process termination
process.on('SIGTERM', async () => {
  await shutdownQueues();
  process.exit(0);
});

process.on('SIGINT', async () => {
  await shutdownQueues();
  process.exit(0);
});
