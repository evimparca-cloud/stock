import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/products/[id]/mappings - Ürün eşleştirmesi oluştur
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { marketplaceId, remoteSku, remoteProductId } = body;

    if (!marketplaceId || !remoteSku) {
      return NextResponse.json(
        { error: 'marketplaceId ve remoteSku gerekli' },
        { status: 400 }
      );
    }

    // Ürünün varlığını kontrol et
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      );
    }

    // Aynı eşleştirme var mı kontrol et
    const existingMapping = await prisma.productMapping.findUnique({
      where: {
        productId_marketplaceId: {
          productId: id,
          marketplaceId,
        },
      },
    });

    if (existingMapping) {
      // Varsa güncelle
      const mapping = await prisma.productMapping.update({
        where: { id: existingMapping.id },
        data: {
          remoteSku,
          remoteProductId: remoteProductId || null,
        },
        include: {
          marketplace: true,
          product: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Eşleştirme güncellendi',
        data: mapping,
      });
    } else {
      // Yoksa oluştur
      const mapping = await prisma.productMapping.create({
        data: {
          productId: id,
          marketplaceId,
          remoteSku,
          remoteProductId: remoteProductId || null,
          syncStock: true,
        },
        include: {
          marketplace: true,
          product: true,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Eşleştirme oluşturuldu',
        data: mapping,
      });
    }
  } catch (error) {
    console.error('Error creating mapping:', error);
    return NextResponse.json(
      { error: 'Eşleştirme oluşturulamadı' },
      { status: 500 }
    );
  }
}

// DELETE /api/products/[id]/mappings - Eşleştirmeyi kaldır
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = request.nextUrl;
    const marketplaceId = searchParams.get('marketplaceId');

    if (!marketplaceId) {
      return NextResponse.json(
        { error: 'marketplaceId gerekli' },
        { status: 400 }
      );
    }

    await prisma.productMapping.delete({
      where: {
        productId_marketplaceId: {
          productId: id,
          marketplaceId,
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Eşleştirme kaldırıldı',
    });
  } catch (error) {
    console.error('Error deleting mapping:', error);
    return NextResponse.json(
      { error: 'Eşleştirme kaldırılamadı' },
      { status: 500 }
    );
  }
}
