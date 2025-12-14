/**
 * Security Middleware
 * CSRF Protection + Security Headers
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';

export class SecurityMiddleware {
    /**
     * CSRF Token oluştur
     */
    static generateCSRFToken(): string {
        return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
    }

    /**
     * CSRF Token doğrula
     */
    static verifyCSRFToken(req: NextRequest): boolean {
        // GET istekler için CSRF kontrolü yapma
        if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
            return true;
        }

        const cookieToken = req.cookies.get(CSRF_COOKIE_NAME)?.value;
        const headerToken = req.headers.get(CSRF_HEADER_NAME);

        if (!cookieToken || !headerToken) {
            return false;
        }

        // Timing attack koruması için
        return crypto.timingSafeEqual(
            Buffer.from(cookieToken, 'utf8'),
            Buffer.from(headerToken, 'utf8')
        );
    }

    /**
     * CSRF middleware
     */
    static csrfProtection(req: NextRequest): NextResponse | null {
        // Public API'ler için skip
        const publicPaths = ['/api/auth/', '/api/webhooks/'];
        if (publicPaths.some(path => req.nextUrl.pathname.startsWith(path))) {
            return null;
        }

        // CSRF kontrolü
        if (!this.verifyCSRFToken(req)) {
            return NextResponse.json(
                { error: 'Invalid CSRF token' },
                { status: 403 }
            );
        }

        return null;
    }

    /**
     * Security headers ekle
     */
    static addSecurityHeaders(response: NextResponse): NextResponse {
        // CSRF token cookie'si yoksa ekle
        if (!response.cookies.has(CSRF_COOKIE_NAME)) {
            response.cookies.set(CSRF_COOKIE_NAME, this.generateCSRFToken(), {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 60 * 60 * 24, // 24 saat
            });
        }

        // Security headers
        response.headers.set('X-Content-Type-Options', 'nosniff');
        response.headers.set('X-Frame-Options', 'DENY');
        response.headers.set('X-XSS-Protection', '1; mode=block');
        response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

        // HSTS (sadece production)
        if (process.env.NODE_ENV === 'production') {
            response.headers.set(
                'Strict-Transport-Security',
                'max-age=31536000; includeSubDomains; preload'
            );
        }

        return response;
    }
}

/**
 * API Route Handler için CSRF wrapper
 */
export function withCSRF(
    handler: (req: NextRequest) => Promise<NextResponse>
) {
    return async (req: NextRequest) => {
        const csrfError = SecurityMiddleware.csrfProtection(req);
        if (csrfError) return csrfError;

        const response = await handler(req);
        return SecurityMiddleware.addSecurityHeaders(response);
    };
}
