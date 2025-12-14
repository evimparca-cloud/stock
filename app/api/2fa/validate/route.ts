import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import speakeasy from 'speakeasy';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { cookies } from 'next/headers';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    const { token, isBackupCode } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // Session'dan email al
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      return NextResponse.json({ error: 'User not found or 2FA not enabled' }, { status: 404 });
    }

    // Try TOTP verification first
    const verified = speakeasy.totp.verify({
      secret: user.twoFactorSecret,
      encoding: 'base32',
      token: token,
      window: 2,
    });

    if (verified) {
      // 2FA doğrulandı cookie'si set et
      const response = NextResponse.json({ success: true, method: 'totp' });
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
    }

    // If TOTP fails, check backup codes
    if (user.backupCodes && Array.isArray(user.backupCodes)) {
      for (let i = 0; i < user.backupCodes.length; i++) {
        const isMatch = await bcrypt.compare(token, user.backupCodes[i] as string);
        if (isMatch) {
          // Remove used backup code
          const updatedCodes = [...user.backupCodes];
          updatedCodes.splice(i, 1);
          
          await prisma.user.update({
            where: { id: user.id },
            data: { backupCodes: updatedCodes },
          });

          // 2FA doğrulandı cookie'si set et
          const response = NextResponse.json({
            success: true,
            method: 'backup',
            remainingBackupCodes: updatedCodes.length,
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
        }
      }
    }

    return NextResponse.json({ error: 'Invalid token or backup code' }, { status: 400 });
  } catch (error) {
    console.error('2FA Validate Error:', error);
    return NextResponse.json(
      { error: 'Failed to validate 2FA' },
      { status: 500 }
    );
  }
}
