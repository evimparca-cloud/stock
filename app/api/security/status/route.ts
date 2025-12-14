/**
 * Güvenlik Durumu API
 * GET /api/security/status
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loginLimiter } from '@/lib/rate-limiter';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Kullanıcı bilgilerini al
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        backupCodes: true,
        telegramChatId: true,
        telegramEnabled: true,
        preferredAuthMethod: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Telegram durumu (artık doğrudan user'dan)
    const telegramEnabled = user.telegramEnabled || false;
    const telegramChatId = user.telegramChatId || null;
    const preferredMethod = user.preferredAuthMethod || '2fa';

    // Rate limiter durumu
    let rateLimitStatus = {
      enabled: true,
      maxAttempts: 5,
      windowMinutes: 15,
      currentAttempts: 0,
      isBlocked: false,
      resetTime: null as number | null,
    };

    try {
      const ip = request.headers.get('x-forwarded-for') || 'unknown';
      const key = `login:${ip}:${user.email}`;
      const result = await loginLimiter.checkLimit(key);
      rateLimitStatus.currentAttempts = 5 - result.remaining;
      rateLimitStatus.isBlocked = !result.success;
      rateLimitStatus.resetTime = result.resetTime;
    } catch (e) {
      // Rate limiter bağlantı hatası
      rateLimitStatus.enabled = false;
    }

    // Backup codes sayısı
    const backupCodesCount = Array.isArray(user.backupCodes) ? user.backupCodes.length : 0;

    // Güvenlik skoru hesapla
    let securityScore = 0;
    const securityChecks = [];

    // 2FA kontrolü
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      securityScore += 30;
      securityChecks.push({ name: '2FA (Authenticator)', status: 'active', points: 30 });
    } else {
      securityChecks.push({ name: '2FA (Authenticator)', status: 'inactive', points: 0 });
    }

    // Telegram kontrolü
    if (telegramEnabled && telegramChatId) {
      securityScore += 20;
      securityChecks.push({ name: 'Telegram 2FA', status: 'active', points: 20 });
    } else {
      securityChecks.push({ name: 'Telegram 2FA', status: 'inactive', points: 0 });
    }

    // Backup codes kontrolü
    if (backupCodesCount >= 5) {
      securityScore += 15;
      securityChecks.push({ name: 'Yedek Kodlar (5+)', status: 'active', points: 15 });
    } else if (backupCodesCount > 0) {
      securityScore += 10;
      securityChecks.push({ name: `Yedek Kodlar (${backupCodesCount})`, status: 'warning', points: 10 });
    } else {
      securityChecks.push({ name: 'Yedek Kodlar', status: 'inactive', points: 0 });
    }

    // Rate limiting kontrolü
    if (rateLimitStatus.enabled) {
      securityScore += 20;
      securityChecks.push({ name: 'Rate Limiting', status: 'active', points: 20 });
    } else {
      securityChecks.push({ name: 'Rate Limiting', status: 'error', points: 0 });
    }

    // Admin role kontrolü
    if (user.role === 'admin') {
      securityScore += 15;
      securityChecks.push({ name: 'Admin Rolü', status: 'active', points: 15 });
    }

    // Çevre değişkenleri kontrolü
    const envChecks = {
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      TELEGRAM_BOT_TOKEN: !!process.env.TELEGRAM_BOT_TOKEN,
      DATABASE_URL: !!process.env.DATABASE_URL,
      REDIS_URL: !!process.env.REDIS_URL,
    };

    return NextResponse.json({
      user: {
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
      },
      authentication: {
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorConfigured: !!user.twoFactorSecret,
        telegramEnabled: telegramEnabled,
        telegramConfigured: !!telegramChatId,
        telegramChatId: telegramChatId,
        preferredMethod: preferredMethod,
        backupCodesCount: backupCodesCount,
      },
      rateLimit: rateLimitStatus,
      securityScore: {
        score: securityScore,
        maxScore: 100,
        percentage: securityScore,
        checks: securityChecks,
      },
      environment: envChecks,
      systemStatus: {
        database: true,
        redis: rateLimitStatus.enabled,
        telegram: !!process.env.TELEGRAM_BOT_TOKEN,
      },
    });
  } catch (error) {
    console.error('Security status error:', error);
    return NextResponse.json(
      { error: 'Failed to get security status' },
      { status: 500 }
    );
  }
}
