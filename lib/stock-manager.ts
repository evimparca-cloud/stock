/**
 * Enterprise Stock Management with Concurrency Control
 * Race condition'ları önler, atomic operations sağlar
 * Idempotency ile tekrarlanan istekleri engeller
 */

import { prisma } from './prisma';
import { AuditLogger } from './audit';
import { IdempotencyService } from './idempotency';

export interface StockUpdateResult {
  success: boolean;
  newStock: number;
  error?: string;
  duplicate?: boolean;
}

export class StockManager {
  /**
   * Güvenli stok güncelleme - Pessimistic Locking ile
   */
  static async updateStockSafely(
    productId: string,
    quantityChange: number,
    reason: string,
    userId?: string,
    orderId?: string,
    ipAddress: string = 'system'
  ): Promise<StockUpdateResult> {
    const lockId = `stock-update-${Date.now()}-${Math.random()}`;
    
    try {
      // 0. Idempotency kontrolü (sipariş için)
      if (orderId) {
        const duplicateCheck = await IdempotencyService.checkStockUpdateDuplicate(
          productId,
          orderId,
          quantityChange
        );
        
        if (!duplicateCheck.isNew) {
          console.log(`[StockManager] Duplicate stock update detected for order ${orderId}`);
          return {
            success: true,
            newStock: 0,
            duplicate: true,
            error: 'Duplicate request - already processed',
          };
        }
      }

      // 1. Lock al
      const lockAcquired = await this.acquireLock(productId, lockId);
      if (!lockAcquired) {
        return {
          success: false,
          newStock: 0,
          error: 'Could not acquire lock - another operation in progress',
        };
      }

      // 2. Transaction içinde güvenli güncelleme
      const result = await prisma.$transaction(async (tx) => {
        // Mevcut stoku al
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { stockQuantity: true, name: true },
        });

        if (!product) {
          throw new Error('Product not found');
        }

        const oldStock = product.stockQuantity;
        const newStock = oldStock + quantityChange;

        // Negatif stok kontrolü
        if (newStock < 0) {
          throw new Error(`Insufficient stock. Available: ${oldStock}, Required: ${Math.abs(quantityChange)}`);
        }

        // Stoku güncelle
        const updatedProduct = await tx.product.update({
          where: { id: productId },
          data: { stockQuantity: newStock },
        });

        // Stock log oluştur
        await tx.stockLog.create({
          data: {
            productId,
            orderId,
            type: quantityChange > 0 ? 'ENTRY' : quantityChange < 0 ? 'EXIT' : 'ADJUSTMENT',
            quantity: quantityChange,
            oldStock,
            newStock,
            reason,
            createdBy: userId,
          },
        });

        // Audit log
        await AuditLogger.logStockChange(
          userId || null,
          productId,
          oldStock,
          newStock,
          reason,
          ipAddress
        );

        return {
          success: true,
          newStock,
          oldStock,
          productName: product.name,
        };
      });

      return {
        success: true,
        newStock: result.newStock,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Hata audit log
      await AuditLogger.log({
        userId,
        action: 'STOCK_UPDATE_FAILED',
        resource: 'PRODUCT',
        resourceId: productId,
        details: { reason, quantityChange, error: errorMessage },
        ipAddress,
        success: false,
        errorCode: 'STOCK_UPDATE_ERROR',
      });

      return {
        success: false,
        newStock: 0,
        error: errorMessage,
      };
    } finally {
      // Lock'u serbest bırak
      await this.releaseLock(productId, lockId);
    }
  }

  /**
   * Toplu stok güncelleme - Sipariş işleme için
   */
  static async updateMultipleStocks(
    updates: Array<{
      productId: string;
      quantityChange: number;
      reason: string;
    }>,
    userId?: string,
    orderId?: string,
    ipAddress: string = 'system'
  ): Promise<{ success: boolean; results: StockUpdateResult[]; error?: string }> {
    const results: StockUpdateResult[] = [];
    const lockIds = updates.map(u => `bulk-${u.productId}-${Date.now()}-${Math.random()}`);
    
    try {
      // Tüm ürünler için lock al
      const locksAcquired = await Promise.all(
        updates.map((update, index) => this.acquireLock(update.productId, lockIds[index]))
      );

      if (!locksAcquired.every(Boolean)) {
        return {
          success: false,
          results: [],
          error: 'Could not acquire all locks',
        };
      }

      // Transaction içinde tüm güncellemeleri yap
      await prisma.$transaction(async (tx) => {
        for (const update of updates) {
          const product = await tx.product.findUnique({
            where: { id: update.productId },
            select: { stockQuantity: true, name: true },
          });

          if (!product) {
            throw new Error(`Product ${update.productId} not found`);
          }

          const oldStock = product.stockQuantity;
          const newStock = oldStock + update.quantityChange;

          if (newStock < 0) {
            throw new Error(`Insufficient stock for ${product.name}. Available: ${oldStock}, Required: ${Math.abs(update.quantityChange)}`);
          }

          // Stoku güncelle
          await tx.product.update({
            where: { id: update.productId },
            data: { stockQuantity: newStock },
          });

          // Stock log
          await tx.stockLog.create({
            data: {
              productId: update.productId,
              orderId,
              type: update.quantityChange > 0 ? 'ENTRY' : update.quantityChange < 0 ? 'EXIT' : 'ADJUSTMENT',
              quantity: update.quantityChange,
              oldStock,
              newStock,
              reason: update.reason,
              createdBy: userId,
            },
          });

          // Audit log
          await AuditLogger.logStockChange(
            userId || null,
            update.productId,
            oldStock,
            newStock,
            update.reason,
            ipAddress
          );

          results.push({
            success: true,
            newStock,
          });
        }
      });

      return {
        success: true,
        results,
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      await AuditLogger.log({
        userId,
        action: 'BULK_STOCK_UPDATE_FAILED',
        resource: 'PRODUCT',
        details: { updates, error: errorMessage },
        ipAddress,
        success: false,
        errorCode: 'BULK_STOCK_ERROR',
      });

      return {
        success: false,
        results,
        error: errorMessage,
      };
    } finally {
      // Tüm lock'ları serbest bırak
      await Promise.all(
        updates.map((update, index) => this.releaseLock(update.productId, lockIds[index]))
      );
    }
  }

  /**
   * Stok lock'u al
   */
  private static async acquireLock(productId: string, lockId: string): Promise<boolean> {
    try {
      const expiresAt = new Date(Date.now() + 30000); // 30 saniye

      await prisma.stockLock.create({
        data: {
          productId,
          lockedBy: lockId,
          expiresAt,
        },
      });

      return true;
    } catch (error) {
      // Unique constraint hatası = zaten lock var
      return false;
    }
  }

  /**
   * Stok lock'unu serbest bırak
   */
  private static async releaseLock(productId: string, lockId: string): Promise<void> {
    try {
      await prisma.stockLock.deleteMany({
        where: {
          productId,
          lockedBy: lockId,
        },
      });
    } catch (error) {
      console.error('Failed to release lock:', error);
    }
  }

  /**
   * Süresi dolmuş lock'ları temizle
   */
  static async cleanupExpiredLocks(): Promise<void> {
    try {
      const result = await prisma.stockLock.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      if (result.count > 0) {
        console.log(`Cleaned up ${result.count} expired stock locks`);
      }
    } catch (error) {
      console.error('Failed to cleanup expired locks:', error);
    }
  }

  /**
   * Stok durumu sorgula
   */
  static async getStockStatus(productId: string): Promise<{
    currentStock: number;
    isLocked: boolean;
    lockedBy?: string;
    lockedUntil?: Date;
  }> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { stockQuantity: true },
    });

    const lock = await prisma.stockLock.findUnique({
      where: { productId },
    });

    return {
      currentStock: product?.stockQuantity || 0,
      isLocked: !!lock && lock.expiresAt > new Date(),
      lockedBy: lock?.lockedBy,
      lockedUntil: lock?.expiresAt,
    };
  }

  /**
   * Stok geçmişi
   */
  static async getStockHistory(productId: string, limit: number = 50) {
    return await prisma.stockLog.findMany({
      where: { productId },
      include: {
        order: {
          select: { marketplaceOrderId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}

// Cron job için expired lock cleanup
setInterval(() => {
  StockManager.cleanupExpiredLocks();
}, 60000); // Her dakika
