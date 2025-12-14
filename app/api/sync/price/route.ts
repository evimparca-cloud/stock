import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketplaceFactory } from '@/lib/marketplace/factory';
import { requireAdmin } from '@/lib/auth-check';

// POST /api/sync/price - Fiyatları pazaryerlerine senkronize et
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { marketplaceId, productIds } = body;

    if (!marketplaceId) {
      return NextResponse.json(
        { error: 'marketplaceId gerekli' },
        { status: 400 }
      );
    }

    // Pazaryeri bilgilerini al
    const marketplace = await prisma.marketplace.findUnique({
      where: { id: marketplaceId },
    });

    if (!marketplace) {
      return NextResponse.json(
        { error: 'Pazaryeri bulunamadı' },
        { status: 404 }
      );
    }

    if (!marketplace.isActive) {
      return NextResponse.json(
        { error: 'Pazaryeri aktif değil' },
        { status: 400 }
      );
    }

    // Eşleşmeleri al
    const where: any = {
      marketplaceId,
    };

    if (productIds && productIds.length > 0) {
      where.productId = { in: productIds };
    }

    const mappings = await prisma.productMapping.findMany({
      where,
      include: {
        product: true,
      },
    });

    if (mappings.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Senkronize edilecek ürün bulunamadı',
        synced: 0,
      });
    }

    // Marketplace service oluştur
    const service = MarketplaceFactory.createService(marketplace.name, {
      apiKey: marketplace.apiKey || '',
      apiSecret: marketplace.apiSecret || '',
      supplierId: marketplace.supplierId || '',
    });

    // Fiyat güncellemelerini hazırla
    const priceUpdates = mappings.map(mapping => ({
      sku: mapping.remoteSku,
      price: parseFloat(mapping.product.price.toString()),
    }));

    // Fiyatları güncelle
    const result = await service.updatePrice(priceUpdates);

    return NextResponse.json({
      success: result.success,
      message: result.message,
      synced: result.success ? mappings.length : 0,
      marketplace: marketplace.name,
      error: result.error,
    });
  } catch (error) {
    console.error('Error syncing price:', error);
    return NextResponse.json(
      {
        error: 'Fiyat senkronizasyonu başarısız',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
