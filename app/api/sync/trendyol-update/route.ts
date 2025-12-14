import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketplaceFactory } from '@/lib/marketplace/factory';
import { requireAdmin } from '@/lib/auth-check';

// POST /api/sync/trendyol-update - Trendyol'a stok, fiyat ve ürün bilgisi güncelleme gönder
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { marketplaceId, updates, updateType = 'priceAndInventory' } = body;

    if (!marketplaceId) {
      return NextResponse.json(
        { error: 'marketplaceId gerekli' },
        { status: 400 }
      );
    }

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json(
        { error: 'updates array gerekli' },
        { status: 400 }
      );
    }

    // Marketplace bilgilerini al
    const marketplace = await prisma.marketplace.findUnique({
      where: { id: marketplaceId },
    });

    if (!marketplace) {
      return NextResponse.json(
        { error: 'Pazaryeri bulunamadı' },
        { status: 404 }
      );
    }

    if (marketplace.name !== 'Trendyol') {
      return NextResponse.json(
        { error: 'Bu endpoint sadece Trendyol için kullanılabilir' },
        { status: 400 }
      );
    }

    // Trendyol service oluştur
    const service = MarketplaceFactory.createService(marketplace.name, {
      apiKey: marketplace.apiKey || '',
      apiSecret: marketplace.apiSecret || '',
      supplierId: marketplace.supplierId || '',
    });

    console.log(`🔄 Trendyol'a ${updates.length} ürün güncelleniyor... (${updateType})`);

    let result;

    if (updateType === 'products') {
      // Ürün bilgisi güncelleme
      if (!service.updateProducts) {
        return NextResponse.json(
          { error: 'Trendyol service updateProducts metodunu desteklemiyor' },
          { status: 500 }
        );
      }
      result = await service.updateProducts(updates);
    } else {
      // Stok ve fiyat güncelleme (varsayılan)
      if (!service.updatePriceAndInventory) {
        return NextResponse.json(
          { error: 'Trendyol service updatePriceAndInventory metodunu desteklemiyor' },
          { status: 500 }
        );
      }
      result = await service.updatePriceAndInventory(updates);
    }

    if (result.success) {
      console.log(`✅ Trendyol güncelleme başarılı: ${result.batchRequestId}`);

      return NextResponse.json({
        success: true,
        message: result.message,
        batchRequestId: result.batchRequestId,
        updatedCount: updates.length,
      });
    } else {
      console.error(`❌ Trendyol güncelleme başarısız: ${result.message}`);

      return NextResponse.json({
        success: false,
        message: result.message,
        error: result.error,
      }, { status: 400 });
    }

  } catch (error) {
    console.error('Trendyol sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Trendyol senkronizasyon hatası',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
