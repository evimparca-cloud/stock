/**
 * Telegram Doğrulama Kodu Gönder
 * POST /api/telegram/send-code
 */

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helper';
import { sendVerificationCode } from '@/lib/telegram-auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const authUser = await requireAuth();

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: authUser.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Telegram bağlı mı kontrol et
    if (!(user as any).telegramChatId) {
      return NextResponse.json(
        { error: 'Telegram hesabı bağlı değil' },
        { status: 400 }
      );
    }

    // Doğrulama kodu gönder
    const result = await sendVerificationCode(user.id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Doğrulama kodu Telegram\'a gönderildi',
    });
  } catch (error) {
    console.error('Send Telegram code error:', error);
    return NextResponse.json(
      { error: 'Kod gönderilemedi' },
      { status: 500 }
    );
  }
}
