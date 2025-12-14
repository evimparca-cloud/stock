import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketplaceFactory } from '@/lib/marketplace/factory';
import { requireAdmin } from '@/lib/auth-check';

// POST /api/trendyol/product-details - Trendyol'dan ürün detaylarını çek
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { marketplaceId, barcode } = await request.json();

    if (!marketplaceId || !barcode) {
      return NextResponse.json(
        { error: 'marketplaceId ve barcode gerekli' },
        { status: 400 }
      );
    }

    // Marketplace bilgilerini al
    const marketplace = await prisma.marketplace.findUnique({
      where: { id: marketplaceId },
    });

    if (!marketplace) {
      return NextResponse.json(
        { error: 'Marketplace bulunamadı' },
        { status: 404 }
      );
    }

    // Trendyol servisini oluştur
    const trendyolService = MarketplaceFactory.createService(
      marketplace.name,
      {
        apiKey: marketplace.apiKey || '',
        apiSecret: marketplace.apiSecret || '',
        supplierId: marketplace.supplierId || '',
      }
    );

    console.log('🔍 Trendyol\'dan ürün detayları çekiliyor:', barcode);

    // Trendyol'dan ürün detaylarını çek
    if (!trendyolService.getProductByBarcode) {
      return NextResponse.json(
        { error: 'Bu marketplace için ürün detayları desteklenmiyor' },
        { status: 400 }
      );
    }

    const productDetails = await trendyolService.getProductByBarcode(barcode);

    if (!productDetails) {
      return NextResponse.json(
        { error: 'Ürün bulunamadı' },
        { status: 404 }
      );
    }

    console.log('✅ Trendyol ürün detayları alındı:', {
      barcode: productDetails.barcode,
      title: productDetails.title,
      brand: productDetails.brand,
      brandName: productDetails.brandName,
      stockCode: productDetails.stockCode,
    });

    return NextResponse.json({
      success: true,
      product: productDetails,
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
