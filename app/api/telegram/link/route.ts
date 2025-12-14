/**
 * Telegram Hesabı Bağla
 * POST /api/telegram/link
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { linkTelegramAccount, sendTelegramMessage } from '@/lib/telegram-auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { chatId } = await request.json();

    if (!chatId) {
      return NextResponse.json(
        { error: 'Telegram Chat ID gerekli' },
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

    // Telegram hesabını bağla
    const result = await linkTelegramAccount(user.id, chatId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Telegram hesabı başarıyla bağlandı',
    });
  } catch (error) {
    console.error('Link Telegram error:', error);
    return NextResponse.json(
      { error: 'Telegram hesabı bağlanamadı' },
      { status: 500 }
    );
  }
}

/**
 * Telegram Hesabı Kaldır
 * DELETE /api/telegram/link
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Telegram hesabını kaldır
    await prisma.user.update({
      where: { id: user.id },
      data: {
        telegramChatId: null,
        telegramEnabled: false,
        preferredAuthMethod: '2fa',
      } as any, // Type assertion for new fields
    });

    return NextResponse.json({
      success: true,
      message: 'Telegram hesabı kaldırıldı',
    });
  } catch (error) {
    console.error('Unlink Telegram error:', error);
    return NextResponse.json(
      { error: 'Telegram hesabı kaldırılamadı' },
      { status: 500 }
    );
  }
}
