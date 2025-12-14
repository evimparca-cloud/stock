import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/trendyol-products/[barcode] - Trendyol ürün detaylarını getir
export async function GET(
  request: NextRequest,
  { params }: { params: { barcode: string } }
) {
  try {
    const { barcode } = params;

    if (!barcode) {
      return NextResponse.json(
        { error: 'Barkod gerekli' },
        { status: 400 }
      );
    }

    // TrendyolProduct tablosundan ürün detaylarını çek
    const trendyolProduct = await prisma.trendyolProduct.findUnique({
      where: { barcode: barcode },
    });

    if (!trendyolProduct) {
      return NextResponse.json(
        { error: 'Trendyol ürün detayları bulunamadı' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      product: trendyolProduct,
    });

  } catch (error) {
    console.error('Trendyol product details error:', error);
    return NextResponse.json(
      { 
        error: 'Trendyol ürün detayları alınırken hata oluştu',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/trendyol-products/[barcode] - Trendyol ürün detaylarını güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: { barcode: string } }
) {
  try {
    const { barcode } = params;
    const body = await request.json();

    if (!barcode) {
      return NextResponse.json(
        { error: 'Barkod gerekli' },
        { status: 400 }
      );
    }

    // TrendyolProduct tablosunda güncelle
    const updatedProduct = await prisma.trendyolProduct.update({
      where: { barcode: barcode },
      data: {
        ...body,
        lastSyncAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Trendyol ürün detayları güncellendi',
      product: updatedProduct,
    });

  } catch (error) {
    console.error('Trendyol product update error:', error);
    return NextResponse.json(
      { 
        error: 'Trendyol ürün detayları güncellenirken hata oluştu',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
