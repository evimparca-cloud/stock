/**
 * Kullanıcının Auth Seçeneklerini Getir
 * GET /api/user/auth-options
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Type assertion for new fields
    const userAny = user as any;

    return NextResponse.json({
      has2FA: !!userAny.twoFactorSecret && userAny.twoFactorEnabled,
      hasTelegram: !!userAny.telegramChatId && userAny.telegramEnabled,
      preferredMethod: userAny.preferredAuthMethod || '2fa',
      twoFactorEnabled: userAny.twoFactorEnabled || false,
      telegramEnabled: userAny.telegramEnabled || false,
    });
  } catch (error) {
    console.error('Get auth options error:', error);
    return NextResponse.json(
      { error: 'Failed to get auth options' },
      { status: 500 }
    );
  }
}
