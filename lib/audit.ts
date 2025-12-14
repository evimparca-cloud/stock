/**
 * Enterprise Audit Logging System
 * Tüm kritik işlemleri detaylı olarak loglar
 */

import { prisma } from './prisma';

export interface AuditLogData {
  userId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  details?: any;
  ipAddress: string;
  userAgent?: string;
  success?: boolean;
  errorCode?: string;
  oldValue?: any;
  newValue?: any;
}

export class AuditLogger {
  /**
   * Audit log kaydı oluştur
   */
  static async log(data: AuditLogData): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: data.userId,
          action: data.action,
          resource: data.resource,
          resourceId: data.resourceId,
          details: {
            ...data.details,
            oldValue: data.oldValue,
            newValue: data.newValue,
            timestamp: new Date().toISOString(),
          },
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          success: data.success ?? true,
          errorCode: data.errorCode,
        },
      });
    } catch (error) {
      console.error('Audit log failed:', error);
      // Audit log hatası sistem çalışmasını durdurmamalı
    }
  }

  /**
   * Login başarılı
   */
  static async logLoginSuccess(userId: string, ipAddress: string, userAgent?: string): Promise<void> {
    await this.log({
      userId,
      action: 'LOGIN_SUCCESS',
      resource: 'AUTH',
      ipAddress,
      userAgent,
      success: true,
    });
  }

  /**
   * Login başarısız
   */
  static async logLoginFailure(email: string, reason: string, ipAddress: string, userAgent?: string): Promise<void> {
    await this.log({
      action: 'LOGIN_FAILED',
      resource: 'AUTH',
      details: { email, reason },
      ipAddress,
      userAgent,
      success: false,
      errorCode: 'AUTH_FAILED',
    });
  }

  /**
   * 2FA başarılı
   */
  static async log2FASuccess(userId: string, method: string, ipAddress: string): Promise<void> {
    await this.log({
      userId,
      action: '2FA_SUCCESS',
      resource: 'AUTH',
      details: { method },
      ipAddress,
      success: true,
    });
  }

  /**
   * 2FA başarısız
   */
  static async log2FAFailure(userId: string, method: string, ipAddress: string): Promise<void> {
    await this.log({
      userId,
      action: '2FA_FAILED',
      resource: 'AUTH',
      details: { method },
      ipAddress,
      success: false,
      errorCode: '2FA_INVALID',
    });
  }

  /**
   * Stok değişikliği
   */
  static async logStockChange(
    userId: string | null,
    productId: string,
    oldStock: number,
    newStock: number,
    reason: string,
    ipAddress: string
  ): Promise<void> {
    await this.log({
      userId: userId ?? undefined,
      action: 'STOCK_CHANGE',
      resource: 'PRODUCT',
      resourceId: productId,
      details: { reason },
      oldValue: { stock: oldStock },
      newValue: { stock: newStock },
      ipAddress,
    });
  }

  /**
   * API anahtarı değişikliği
   */
  static async logApiKeyChange(
    userId: string,
    marketplace: string,
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    ipAddress: string
  ): Promise<void> {
    await this.log({
      userId,
      action: 'API_KEY_CHANGE',
      resource: 'MARKETPLACE_CONFIG',
      resourceId: marketplace,
      details: { action },
      ipAddress,
    });
  }

  /**
   * Admin işlemi
   */
  static async logAdminAction(
    userId: string,
    action: string,
    resource: string,
    resourceId: string,
    details: any,
    ipAddress: string
  ): Promise<void> {
    await this.log({
      userId,
      action: `ADMIN_${action}`,
      resource,
      resourceId,
      details,
      ipAddress,
    });
  }

  /**
   * Güvenlik olayı
   */
  static async logSecurityEvent(
    eventType: string,
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    source: string,
    details: any,
    userId?: string
  ): Promise<void> {
    try {
      // Audit log
      await this.log({
        userId,
        action: 'SECURITY_EVENT',
        resource: 'SECURITY',
        details: { eventType, severity, ...details },
        ipAddress: source,
        success: false,
        errorCode: eventType,
      });

      // Security events tablosuna da kaydet
      await prisma.securityEvent.create({
        data: {
          eventType,
          severity,
          source,
          userId,
          details,
        },
      });
    } catch (error) {
      console.error('Security event log failed:', error);
    }
  }

  /**
   * Sipariş işlemi
   */
  static async logOrderAction(
    userId: string | null,
    orderId: string,
    action: string,
    details: any,
    ipAddress: string
  ): Promise<void> {
    await this.log({
      userId: userId ?? undefined,
      action: `ORDER_${action}`,
      resource: 'ORDER',
      resourceId: orderId,
      details,
      ipAddress,
    });
  }

  /**
   * Pazaryeri senkronizasyonu
   */
  static async logMarketplaceSync(
    marketplace: string,
    action: string,
    success: boolean,
    details: any,
    errorCode?: string
  ): Promise<void> {
    await this.log({
      action: `MARKETPLACE_${action}`,
      resource: 'MARKETPLACE',
      resourceId: marketplace,
      details,
      ipAddress: 'system',
      success,
      errorCode,
    });
  }

  /**
   * Audit logları sorgula
   */
  static async getAuditLogs(filters: {
    userId?: string;
    action?: string;
    resource?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.action) where.action = { contains: filters.action };
    if (filters.resource) where.resource = filters.resource;
    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) where.timestamp.gte = filters.startDate;
      if (filters.endDate) where.timestamp.lte = filters.endDate;
    }

    return await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { timestamp: 'desc' },
      take: filters.limit || 100,
      skip: filters.offset || 0,
    });
  }

  /**
   * Güvenlik olaylarını sorgula
   */
  static async getSecurityEvents(filters: {
    eventType?: string;
    severity?: string;
    resolved?: boolean;
    limit?: number;
  }) {
    const where: any = {};

    if (filters.eventType) where.eventType = filters.eventType;
    if (filters.severity) where.severity = filters.severity;
    if (filters.resolved !== undefined) where.resolved = filters.resolved;

    return await prisma.securityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: filters.limit || 50,
    });
  }
}

/**
 * Request'ten IP ve User Agent al
 */
export function getRequestInfo(request: Request): { ipAddress: string; userAgent?: string } {
  const ipAddress = 
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const userAgent = request.headers.get('user-agent') || undefined;

  return { ipAddress, userAgent };
}

/**
 * Middleware için audit wrapper
 */
export function withAudit<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  auditData: Omit<AuditLogData, 'success' | 'errorCode'>
) {
  return async (...args: T): Promise<R> => {
    try {
      const result = await fn(...args);
      await AuditLogger.log({ ...auditData, success: true });
      return result;
    } catch (error) {
      await AuditLogger.log({
        ...auditData,
        success: false,
        errorCode: error instanceof Error ? error.message : 'UNKNOWN_ERROR',
      });
      throw error;
    }
  };
}
