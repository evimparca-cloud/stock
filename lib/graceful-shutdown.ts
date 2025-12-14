/**
 * Graceful Shutdown Handler
 * Uygulama kapanırken devam eden işlerin tamamlanmasını bekler
 */

import { shutdownQueues } from './queue';
import { prisma } from './prisma';

let isShuttingDown = false;
const activeRequests = new Set<string>();
const shutdownCallbacks: Array<() => Promise<void>> = [];

/**
 * Aktif istek kaydet
 */
export function trackRequest(requestId: string): void {
  if (!isShuttingDown) {
    activeRequests.add(requestId);
  }
}

/**
 * İstek tamamlandı
 */
export function untrackRequest(requestId: string): void {
  activeRequests.delete(requestId);
}

/**
 * Kapanış callback'i ekle
 */
export function onShutdown(callback: () => Promise<void>): void {
  shutdownCallbacks.push(callback);
}

/**
 * Graceful shutdown başlat
 */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    console.log('[Shutdown] Already shutting down...');
    return;
  }

  isShuttingDown = true;
  console.log(`\n[Shutdown] ${signal} received. Starting graceful shutdown...`);

  const startTime = Date.now();
  const maxWaitTime = 25000; // 25 saniye max bekleme

  // 1. Yeni istekleri reddet (isShuttingDown = true)
  console.log('[Shutdown] Rejecting new requests...');

  // 2. Aktif isteklerin bitmesini bekle
  console.log(`[Shutdown] Waiting for ${activeRequests.size} active requests...`);
  
  while (activeRequests.size > 0 && Date.now() - startTime < maxWaitTime) {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (activeRequests.size > 0) {
      console.log(`[Shutdown] Still waiting for ${activeRequests.size} requests...`);
    }
  }

  if (activeRequests.size > 0) {
    console.warn(`[Shutdown] Timeout! ${activeRequests.size} requests still active.`);
  }

  // 3. Queue'ları kapat
  console.log('[Shutdown] Closing queues...');
  try {
    await shutdownQueues();
  } catch (error) {
    console.error('[Shutdown] Queue shutdown error:', error);
  }

  // 4. Custom callback'leri çalıştır
  console.log('[Shutdown] Running shutdown callbacks...');
  for (const callback of shutdownCallbacks) {
    try {
      await callback();
    } catch (error) {
      console.error('[Shutdown] Callback error:', error);
    }
  }

  // 5. Database bağlantısını kapat
  console.log('[Shutdown] Closing database connection...');
  try {
    await prisma.$disconnect();
  } catch (error) {
    console.error('[Shutdown] Database disconnect error:', error);
  }

  const duration = Date.now() - startTime;
  console.log(`[Shutdown] Graceful shutdown completed in ${duration}ms`);

  process.exit(0);
}

/**
 * Shutdown sinyallerini dinle
 */
export function initGracefulShutdown(): void {
  // SIGTERM: Docker stop, Kubernetes termination
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // SIGINT: Ctrl+C
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[Shutdown] Uncaught Exception:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });

  // Unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Shutdown] Unhandled Rejection at:', promise, 'reason:', reason);
    // Sadece log, crash etme
  });

  console.log('[Shutdown] Graceful shutdown handlers initialized');
}

/**
 * Shutdown durumunu kontrol et
 */
export function isServerShuttingDown(): boolean {
  return isShuttingDown;
}

/**
 * Health check için aktif istek sayısı
 */
export function getActiveRequestCount(): number {
  return activeRequests.size;
}
