/**
 * Tercih Edilen Auth Yöntemini Güncelle
 * POST /api/user/preferred-auth
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { method } = await request.json();

    if (!method || !['2fa', 'telegram'].includes(method)) {
      return NextResponse.json(
        { error: 'Geçerli bir yöntem seçin (2fa veya telegram)' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update preferred method
    await prisma.user.update({
      where: { id: user.id },
      data: {
        preferredAuthMethod: method,
      } as any,
    });

    return NextResponse.json({
      success: true,
      preferredMethod: method,
    });
  } catch (error) {
    console.error('Update preferred auth error:', error);
    return NextResponse.json(
      { error: 'Tercih güncellenemedi' },
      { status: 500 }
    );
  }
}
