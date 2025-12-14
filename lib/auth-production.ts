import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import bcrypt from 'bcryptjs';

export interface AuditLogData {
    userId?: string;
    action: string;
    ipAddress: string;
    userAgent: string;
    success: boolean;
    errorCode?: string;
    details?: Record<string, any>;
}

export interface RateLimitResult {
    allowed: boolean;
    remainingAttempts: number;
    resetTime: Date;
    blockedUntil?: Date;
}

/**
 * Create an audit log entry for security-critical actions
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                userId: data.userId,
                action: data.action,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                success: data.success,
                errorCode: data.errorCode,
                details: data.details ? JSON.stringify(data.details) : Prisma.JsonNull,
                timestamp: new Date(),
            },
        });
    } catch (error) {
        console.error('Failed to create audit log:', error);
        // Don't throw error - audit logging should not break the main flow
    }
}

/**
 * Get client IP address from request
 */
export function getClientIP(request: NextRequest): string {
    // Check various headers for the real IP
    const forwarded = request.headers.get('x-forwarded-for');
    const realIP = request.headers.get('x-real-ip');
    const cfConnectingIP = request.headers.get('cf-connecting-ip');

    if (cfConnectingIP) return cfConnectingIP;
    if (forwarded) return forwarded.split(',')[0].trim();
    if (realIP) return realIP;

    return 'unknown';
}

/**
 * Get user agent from request
 */
export function getUserAgent(request: NextRequest): string {
    return request.headers.get('user-agent') || 'unknown';
}

/**
 * Verify password using bcrypt
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
}

/**
 * Create JWT token and set cookie
 */
export async function createToken(payload: any): Promise<void> {
    const secret = new TextEncoder().encode(
        process.env.NEXTAUTH_SECRET || 'default-secret-key-change-in-production'
    );

    const token = await new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('24h')
        .sign(secret);

    cookies().set('auth-token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24, // 24 hours
        path: '/',
    });
}

/**
 * Clear auth token cookie
 */
export function clearToken(): void {
    cookies().delete('auth-token');
}

/**
 * Check rate limit for an identifier (IP or User ID)
 */
export async function checkRateLimit(
    identifier: string,
    limit: number = 5,
    windowMinutes: number = 15
): Promise<RateLimitResult> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

    try {
        // Clean up old rate limits
        // Note: In a real production app, this should be done by a cron job, not on every request
        // But for simplicity we do it here occasionally or rely on a separate job

        // Find or create rate limit record
        let rateLimit = await prisma.rateLimit.findUnique({
            where: { identifier }
        });

        if (!rateLimit) {
            rateLimit = await prisma.rateLimit.create({
                data: {
                    identifier,
                    attempts: 0,
                    lastAttempt: now,
                }
            });
        }

        // Check if blocked
        if (rateLimit.blockedUntil && rateLimit.blockedUntil > now) {
            return {
                allowed: false,
                remainingAttempts: 0,
                resetTime: rateLimit.blockedUntil,
                blockedUntil: rateLimit.blockedUntil
            };
        }

        // Reset if window passed
        if (rateLimit.lastAttempt < windowStart) {
            rateLimit = await prisma.rateLimit.update({
                where: { id: rateLimit.id },
                data: {
                    attempts: 0,
                    lastAttempt: now,
                    blockedUntil: null
                }
            });
        }

        // Increment attempts
        const attempts = rateLimit.attempts + 1;

        // Check if limit exceeded
        if (attempts > limit) {
            const blockedUntil = new Date(now.getTime() + windowMinutes * 60 * 1000);

            await prisma.rateLimit.update({
                where: { id: rateLimit.id },
                data: {
                    attempts,
                    lastAttempt: now,
                    blockedUntil
                }
            });

            return {
                allowed: false,
                remainingAttempts: 0,
                resetTime: blockedUntil,
                blockedUntil
            };
        }

        // Update attempts
        await prisma.rateLimit.update({
            where: { id: rateLimit.id },
            data: {
                attempts,
                lastAttempt: now
            }
        });

        return {
            allowed: true,
            remainingAttempts: limit - attempts,
            resetTime: new Date(now.getTime() + windowMinutes * 60 * 1000)
        };

    } catch (error) {
        console.error('Rate limit check error:', error);
        // Fail open in case of database error
        return {
            allowed: true,
            remainingAttempts: 1,
            resetTime: new Date(now.getTime() + windowMinutes * 60 * 1000)
        };
    }
}
