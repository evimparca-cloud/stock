/**
 * Enterprise Input Validation with Zod
 * Tüm API endpoint'leri için güvenli validation
 */

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { AuditLogger } from './audit';

// Base schemas
export const emailSchema = z.string().email('Geçersiz email formatı').min(1, 'Email gerekli');
export const passwordSchema = z.string()
  .min(8, 'Şifre en az 8 karakter olmalı')
  .regex(/[A-Z]/, 'Şifre en az bir büyük harf içermeli')
  .regex(/[a-z]/, 'Şifre en az bir küçük harf içermeli')
  .regex(/[0-9]/, 'Şifre en az bir rakam içermeli')
  .regex(/[^A-Za-z0-9]/, 'Şifre en az bir özel karakter içermeli');

export const phoneSchema = z.string().regex(/^[0-9+\-\s()]+$/, 'Geçersiz telefon formatı');
export const tcNoSchema = z.string().regex(/^[0-9]{11}$/, 'TC Kimlik No 11 haneli olmalı');

// Auth schemas
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Şifre gerekli'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'İsim en az 2 karakter olmalı').max(50, 'İsim en fazla 50 karakter olabilir'),
  email: emailSchema,
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Mevcut şifre gerekli'),
  newPassword: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirmPassword'],
});

// 2FA schemas
export const setup2FASchema = z.object({
  token: z.string().regex(/^[0-9]{6}$/, '6 haneli kod gerekli'),
});

export const verify2FASchema = z.object({
  token: z.string().regex(/^[0-9]{6}$/, '6 haneli kod gerekli'),
});

export const telegramLinkSchema = z.object({
  chatId: z.string().regex(/^-?[0-9]+$/, 'Geçersiz Telegram Chat ID'),
});

// Product schemas
export const productSchema = z.object({
  sku: z.string().min(1, 'SKU gerekli').max(50, 'SKU en fazla 50 karakter'),
  name: z.string().min(1, 'Ürün adı gerekli').max(200, 'Ürün adı en fazla 200 karakter'),
  description: z.string().optional(),
  stockQuantity: z.number().int().min(0, 'Stok negatif olamaz'),
  price: z.number().positive('Fiyat pozitif olmalı'),
  listPrice: z.number().positive().optional(),
  vatRate: z.number().int().min(0).max(100).optional(),
  brand: z.string().max(100).optional(),
  category: z.string().max(100).optional(),
  gender: z.enum(['Erkek', 'Kadın', 'Unisex']).optional(),
  stockCode: z.string().max(50).optional(),
  location: z.string().max(100).optional(),
});

export const updateProductSchema = productSchema.partial().extend({
  id: z.string().cuid('Geçersiz ürün ID'),
});

// Stock schemas
export const stockUpdateSchema = z.object({
  productId: z.string().cuid('Geçersiz ürün ID'),
  quantityChange: z.number().int().refine(val => val !== 0, 'Miktar değişikliği 0 olamaz'),
  reason: z.string().min(1, 'Sebep gerekli').max(200, 'Sebep en fazla 200 karakter'),
});

export const bulkStockUpdateSchema = z.object({
  updates: z.array(stockUpdateSchema).min(1, 'En az bir güncelleme gerekli').max(100, 'En fazla 100 güncelleme'),
});

// Order schemas
export const orderFilterSchema = z.object({
  status: z.enum(['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED']).optional(),
  marketplaceId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

// Marketplace schemas
export const marketplaceConfigSchema = z.object({
  marketplace: z.string().min(1, 'Pazaryeri adı gerekli'),
  apiKey: z.string().min(1, 'API anahtarı gerekli'),
  apiSecret: z.string().optional(),
  supplierId: z.string().optional(),
});

// Audit log schemas
export const auditLogFilterSchema = z.object({
  userId: z.string().cuid().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(50),
});

// Security schemas
export const securityEventSchema = z.object({
  eventType: z.string().min(1, 'Olay tipi gerekli'),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  details: z.record(z.string(), z.any()),
});

// File upload schemas
export const fileUploadSchema = z.object({
  file: z.instanceof(File),
  maxSize: z.number().default(5 * 1024 * 1024), // 5MB
  allowedTypes: z.array(z.string()).default(['image/jpeg', 'image/png', 'image/webp']),
});

/**
 * API validation middleware
 */
export function validateRequest<T>(schema: z.ZodSchema<T>) {
  return async (request: NextRequest): Promise<{ data: T; error?: never } | { data?: never; error: NextResponse }> => {
    try {
      const body = await request.json();
      const data = schema.parse(body);
      
      return { data };
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Validation hatalarını audit log'a kaydet
        const { ipAddress, userAgent } = getRequestInfo(request);
        await AuditLogger.log({
          action: 'VALIDATION_ERROR',
          resource: 'API',
          details: {
            errors: error.issues,
            path: request.nextUrl.pathname,
          },
          ipAddress,
          userAgent,
          success: false,
          errorCode: 'VALIDATION_ERROR',
        });

        return {
          error: NextResponse.json(
            {
              error: 'Validation failed',
              details: error.issues.map((err) => ({
                field: String(err.path.join('.')),
                message: err.message,
              })),
            },
            { status: 400 }
          ),
        };
      }

      return {
        error: NextResponse.json(
          { error: 'Invalid request format' },
          { status: 400 }
        ),
      };
    }
  };
}

/**
 * Query parameter validation
 */
export function validateQuery<T>(schema: z.ZodSchema<T>, searchParams: URLSearchParams): { data: T; error?: never } | { data?: never; error: any } {
  try {
    const params: any = {};
    
    for (const [key, value] of Array.from(searchParams.entries())) {
      // Number conversion
      if (!isNaN(Number(value)) && value !== '') {
        params[key] = Number(value);
      } else if (value === 'true') {
        params[key] = true;
      } else if (value === 'false') {
        params[key] = false;
      } else {
        params[key] = value;
      }
    }

    const data = schema.parse(params);
    return { data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        error: {
          message: 'Query validation failed',
          details: error.issues.map((err) => ({
            field: String(err.path.join('.')),
            message: err.message,
          })),
        },
      };
    }
    return { error: { message: 'Invalid query parameters' } };
  }
}

/**
 * File validation
 */
export async function validateFile(file: File, options: {
  maxSize?: number;
  allowedTypes?: string[];
} = {}): Promise<{ valid: boolean; error?: string }> {
  const maxSize = options.maxSize || 5 * 1024 * 1024; // 5MB
  const allowedTypes = options.allowedTypes || ['image/jpeg', 'image/png', 'image/webp'];

  if (file.size > maxSize) {
    return {
      valid: false,
      error: `Dosya boyutu ${Math.round(maxSize / 1024 / 1024)}MB'dan büyük olamaz`,
    };
  }

  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `Desteklenen formatlar: ${allowedTypes.join(', ')}`,
    };
  }

  return { valid: true };
}

/**
 * Sanitize HTML input
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * SQL injection pattern detection
 */
export function detectSqlInjection(input: string): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
    /(--|\/\*|\*\/|;|'|"|`)/,
    /(\bOR\b|\bAND\b).*?[=<>]/i,
  ];

  return sqlPatterns.some(pattern => pattern.test(input));
}

/**
 * XSS pattern detection
 */
export function detectXss(input: string): boolean {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
  ];

  return xssPatterns.some(pattern => pattern.test(input));
}

/**
 * Request info helper
 */
function getRequestInfo(request: NextRequest): { ipAddress: string; userAgent?: string } {
  const ipAddress = 
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const userAgent = request.headers.get('user-agent') || undefined;

  return { ipAddress, userAgent };
}

/**
 * Rate limit validation
 */
export function validateRateLimit(identifier: string, maxRequests: number = 100, windowMs: number = 60000) {
  // Bu fonksiyon rate-limiter.ts ile entegre edilecek
  // Şimdilik placeholder
  return { allowed: true, remaining: maxRequests };
}
