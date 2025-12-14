/**
 * Telegram Doğrulama Kodunu Kontrol Et
 * POST /api/telegram/verify-code
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { verifyTelegramCode } from '@/lib/telegram-auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { code } = await request.json();

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Geçerli bir 6 haneli kod girin' },
        { status: 400 }
      );
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Kodu doğrula
    const result = await verifyTelegramCode(user.id, code);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    // 2FA doğrulandı cookie'si set et
    const response = NextResponse.json({
      success: true,
      message: 'Telegram doğrulama başarılı',
    });

    response.cookies.set('2fa-verified', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60, // 24 saat
      path: '/',
    });

    // 2fa-required cookie'yi sil
    response.cookies.delete('2fa-required');

    return response;
  } catch (error) {
    console.error('Verify Telegram code error:', error);
    return NextResponse.json(
      { error: 'Doğrulama başarısız' },
      { status: 500 }
    );
  }
}
