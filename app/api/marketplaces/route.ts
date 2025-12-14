import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/auth-helper';

// GET /api/marketplaces - Tüm pazaryerlerini listele
export async function GET() {
  try {
    await requireAdmin();
    const marketplaces = await prisma.marketplace.findMany({
      include: {
        _count: {
          select: {
            mappings: true,
            orders: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(marketplaces);
  } catch (error) {
    console.error('Error fetching marketplaces:', error);
    return NextResponse.json(
      { error: 'Failed to fetch marketplaces' },
      { status: 500 }
    );
  }
}

// POST /api/marketplaces - Yeni pazaryeri ekle
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, storeName, apiKey, apiSecret, supplierId, isActive } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Marketplace name is required' },
        { status: 400 }
      );
    }

    const marketplace = await prisma.marketplace.create({
      data: {
        name,
        storeName: storeName || null,
        apiKey: apiKey || null,
        apiSecret: apiSecret || null,
        supplierId: supplierId || null,
        isActive: isActive !== undefined ? isActive : true,
      },
    });

    return NextResponse.json(marketplace, { status: 201 });
  } catch (error) {
    console.error('Error creating marketplace:', error);
    return NextResponse.json(
      { error: 'Failed to create marketplace' },
      { status: 500 }
    );
  }
}
