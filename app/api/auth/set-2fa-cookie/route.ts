/**
 * 2FA Cookie Set API
 * POST /api/auth/set-2fa-cookie
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Kullanıcının 2FA durumunu kontrol et
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { twoFactorEnabled: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const response = NextResponse.json({ 
      success: true, 
      twoFactorEnabled: user.twoFactorEnabled 
    });

    if (user.twoFactorEnabled) {
      // 2FA gerekli - 2fa-required cookie set et
      response.cookies.set('2fa-required', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 3600, // 1 saat
        path: '/',
      });
      // 2fa-verified cookie'yi sil (eğer varsa)
      response.cookies.delete('2fa-verified');
    } else {
      // 2FA kapalı - 2fa-verified cookie set et
      response.cookies.set('2fa-verified', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 86400, // 24 saat
        path: '/',
      });
      // 2fa-required cookie'yi sil
      response.cookies.delete('2fa-required');
    }

    return response;
  } catch (error) {
    console.error('Set 2FA cookie error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
