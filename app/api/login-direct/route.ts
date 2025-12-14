import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { telegramNotifications } from '@/lib/telegram-notifications';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    console.log('[DIRECT-LOGIN] Starting...');
    
    const body = await request.json();
    const { email, password } = body;

    console.log('[DIRECT-LOGIN] Attempt:', email);

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email ve şifre gerekli' },
        { status: 400 }
      );
    }

    console.log('[DIRECT-LOGIN] Searching user...');
    
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });

    console.log('[DIRECT-LOGIN] User found:', !!user);

    if (!user) {
      return NextResponse.json(
        { error: 'Kullanıcı bulunamadı' },
        { status: 401 }
      );
    }

    // TEMP: Skip password check for dev
    console.log('[DIRECT-LOGIN] DEV MODE - skipping password check');

    // Create simple session data
    const sessionData = JSON.stringify({
      userId: user.id,
      email: user.email,
      name: user.name,
      role: (user as any).role || 'admin',
      loginTime: Date.now(),
    });

    console.log('[DIRECT-LOGIN] Success, creating session');

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: (user as any).role || 'admin',
      },
    });

    // Set simple session cookie
    response.cookies.set('dev-session', sessionData, {
      httpOnly: true,
      secure: false, // Allow HTTP in dev
      sameSite: 'lax',
      maxAge: 60 * 60 * 8, // 8 hours
      path: '/',
    });

    console.log('[DIRECT-LOGIN] Cookie set successfully');

    // Telegram bildirimi gönder
    try {
      const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'Bilinmiyor';
      await telegramNotifications.notifyAdminLogin(user.email, ip);
      console.log('[DIRECT-LOGIN] Telegram notification sent');
    } catch (telegramError) {
      console.error('[DIRECT-LOGIN] Telegram notification failed:', telegramError);
      // Telegram hatası login'i engellemez
    }

    return response;
  } catch (error: any) {
    console.error('[DIRECT-LOGIN] Error:', error);
    console.error('[DIRECT-LOGIN] Error details:', error.message, error.stack);
    return NextResponse.json(
      { error: 'Giriş hatası: ' + error.message },
      { status: 500 }
    );
  }
}
