import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/mappings - Tüm eşleşmeleri listele
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const productId = searchParams.get('productId');
    const marketplaceId = searchParams.get('marketplaceId');

    const where: any = {};
    if (productId) where.productId = productId;
    if (marketplaceId) where.marketplaceId = marketplaceId;

    const mappings = await prisma.productMapping.findMany({
      where,
      include: {
        product: true,
        marketplace: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(mappings);
  } catch (error) {
    console.error('Error fetching mappings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mappings' },
      { status: 500 }
    );
  }
}

// POST /api/mappings - Yeni eşleşme oluştur
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, marketplaceId, remoteSku, remoteProductId, syncStock } = body;

    if (!productId || !marketplaceId || !remoteSku) {
      return NextResponse.json(
        { error: 'productId, marketplaceId, and remoteSku are required' },
        { status: 400 }
      );
    }

    // Aynı ürün ve pazaryeri kombinasyonunu kontrol et
    const existingMapping = await prisma.productMapping.findFirst({
      where: {
        productId,
        marketplaceId,
      },
    });

    if (existingMapping) {
      return NextResponse.json(
        { error: 'Mapping already exists for this product and marketplace' },
        { status: 409 }
      );
    }

    const mapping = await prisma.productMapping.create({
      data: {
        productId,
        marketplaceId,
        remoteSku,
        remoteProductId: remoteProductId || null,
        syncStock: syncStock !== undefined ? syncStock : true,
      },
      include: {
        product: true,
        marketplace: true,
      },
    });

    return NextResponse.json(mapping, { status: 201 });
  } catch (error) {
    console.error('Error creating mapping:', error);
    return NextResponse.json(
      { error: 'Failed to create mapping' },
      { status: 500 }
    );
  }
}
