/**
 * CSRF (Cross-Site Request Forgery) Protection
 * API endpoint'lerinde CSRF token validation
 */

import crypto from 'crypto';
import { NextRequest } from 'next/server';
import { getRedis } from './redis';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY = 3600; // 1 saat

export interface CSRFValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * CSRF token üret
 */
export function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * CSRF token'ı session'a kaydet
 */
export async function storeCSRFToken(sessionId: string, token: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.setex(`csrf:${sessionId}`, CSRF_TOKEN_EXPIRY, token);
    } catch (error) {
      console.error('[CSRF] Failed to store token:', error);
    }
  }
}

/**
 * CSRF token'ı doğrula
 */
export async function validateCSRFToken(
  sessionId: string,
  token: string
): Promise<CSRFValidationResult> {
  if (!token) {
    return { valid: false, error: 'CSRF token missing' };
  }

  const redis = getRedis();
  if (redis) {
    try {
      const storedToken = await redis.get(`csrf:${sessionId}`);
      
      if (!storedToken) {
        return { valid: false, error: 'CSRF token expired or not found' };
      }

      // Timing attack koruması ile karşılaştırma
      const valid = crypto.timingSafeEqual(
        Buffer.from(token, 'utf8'),
        Buffer.from(storedToken, 'utf8')
      );

      if (!valid) {
        return { valid: false, error: 'Invalid CSRF token' };
      }

      return { valid: true };
    } catch (error) {
      console.error('[CSRF] Validation error:', error);
      return { valid: false, error: 'CSRF validation failed' };
    }
  }

  // Redis yoksa warning ver ama geçir (development)
  console.warn('[CSRF] Redis not available, skipping CSRF check');
  return { valid: true };
}

/**
 * CSRF token'ı sil (logout, form submit sonrası)
 */
export async function deleteCSRFToken(sessionId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(`csrf:${sessionId}`);
    } catch (error) {
      console.error('[CSRF] Failed to delete token:', error);
    }
  }
}

/**
 * CSRF token'ı yenile
 */
export async function refreshCSRFToken(sessionId: string): Promise<string> {
  const newToken = generateCSRFToken();
  await storeCSRFToken(sessionId, newToken);
  return newToken;
}

/**
 * Request'den CSRF token'ı al
 */
export function getCSRFTokenFromRequest(request: NextRequest): string | null {
  // 1. Header'dan kontrol et (X-CSRF-Token)
  const headerToken = request.headers.get('X-CSRF-Token') || 
                     request.headers.get('x-csrf-token');
  
  if (headerToken) return headerToken;

  // 2. Body'den kontrol et (form data için)
  // Bu NextRequest.json() ile kullanılamaz, controller'da handle edilmeli
  
  return null;
}

/**
 * Session ID'yi request'den çıkar
 */
export function getSessionIdFromRequest(request: NextRequest): string | null {
  // NextAuth session cookie
  const sessionToken = request.cookies.get('next-auth.session-token')?.value ||
                       request.cookies.get('__Secure-next-auth.session-token')?.value;
  
  if (sessionToken) return sessionToken;

  // Dev session cookie
  const devSession = request.cookies.get('dev-session')?.value;
  if (devSession) {
    try {
      const parsed = JSON.parse(devSession);
      return parsed.userId;
    } catch {}
  }

  return null;
}

/**
 * CSRF Middleware - API route'larda kullanılacak
 */
export async function requireCSRF(request: NextRequest): Promise<CSRFValidationResult> {
  // GET, HEAD, OPTIONS metodları için CSRF kontrolü yapma
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return { valid: true };
  }

  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) {
    return { valid: false, error: 'No session found' };
  }

  const token = getCSRFTokenFromRequest(request);
  if (!token) {
    return { valid: false, error: 'CSRF token missing in request' };
  }

  return await validateCSRFToken(sessionId, token);
}

/**
 * Development modunda CSRF'i devre dışı bırak
 */
export function shouldSkipCSRF(): boolean {
  return process.env.NODE_ENV === 'development' && 
         process.env.SKIP_CSRF === 'true';
}
