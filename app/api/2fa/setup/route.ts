import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const session = await getServerSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Generate a secret key for the user
    const secret = speakeasy.generateSecret({
      name: `Stock Management (${user.email})`,
      issuer: 'Stock Management System',
    });

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url || '');

    // Store the secret temporarily (will be confirmed in verify endpoint)
    await prisma.user.update({
      where: { id: user.id },
      data: { twoFactorSecret: secret.base32 },
    });

    return NextResponse.json({
      secret: secret.base32,
      qrCode: qrCodeUrl,
      otpauth_url: secret.otpauth_url,
    });
  } catch (error) {
    console.error('2FA Setup Error:', error);
    return NextResponse.json(
      { error: 'Failed to setup 2FA' },
      { status: 500 }
    );
  }
}
