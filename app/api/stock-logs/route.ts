import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { StockLogType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get('type') as StockLogType | null;

    const logs = await prisma.stockLog.findMany({
      where: type ? { type } : undefined,
      include: {
        product: {
          select: {
            name: true,
            sku: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Son 100 kayıt
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error fetching stock logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stock logs' },
      { status: 500 }
    );
  }
}
