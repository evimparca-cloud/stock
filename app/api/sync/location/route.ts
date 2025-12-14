import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TrendyolService } from '@/lib/marketplace/trendyol';
import { requireAdmin } from '@/lib/auth-check';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { marketplaceId } = await request.json();

    if (!marketplaceId) {
      return NextResponse.json(
        { success: false, error: 'Marketplace ID gerekli' },
        { status: 400 }
      );
    }

    // Pazaryeri bilgilerini al
    const marketplace = await prisma.marketplace.findUnique({
      where: { id: marketplaceId },
    });

    if (!marketplace) {
      return NextResponse.json(
        { success: false, error: 'Pazaryeri bulunamadı' },
        { status: 404 }
      );
    }

    // Aktif eşleşmeleri al
    const mappings = await prisma.productMapping.findMany({
      where: {
        marketplaceId,
        syncStock: true,
      },
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

    console.log(`📍 ${marketplace.name} için ${mappings.length} ürün lokasyonu senkronize ediliyor...`);

    let synced = 0;
    let failed = 0;

    if (marketplace.name === 'Trendyol') {
      const trendyolService = new TrendyolService({
        apiKey: marketplace.apiKey || '',
        apiSecret: marketplace.apiSecret || '',
        supplierId: marketplace.supplierId || '',
      });

      // Sadece lokasyonu olan ürünleri filtrele
      const productsWithLocation = mappings.filter(m => m.product.location);

      console.log(`📦 Lokasyonu olan ürün sayısı: ${productsWithLocation.length}`);

      // Batch olarak gönder (10'ar ürün)
      const batchSize = 10;
      for (let i = 0; i < productsWithLocation.length; i += batchSize) {
        const batch = productsWithLocation.slice(i, i + batchSize);

        const updates = batch.map(mapping => ({
          sku: mapping.remoteSku,
          stockCode: mapping.product.location || '',
        }));

        try {
          const result = await trendyolService.updateProductsWithRequiredFields(updates);

          if (result.success) {
            synced += updates.length;
            console.log(`✅ Batch ${i / batchSize + 1}: ${updates.length} ürün lokasyonu güncellendi`);
          } else {
            failed += updates.length;
            console.error(`❌ Batch ${i / batchSize + 1} başarısız:`, result.error);
          }
        } catch (error) {
          failed += updates.length;
          console.error(`❌ Batch ${i / batchSize + 1} hatası:`, error);
        }

        // API rate limiting için bekleme
        if (i + batchSize < productsWithLocation.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    } else {
      return NextResponse.json({
        success: false,
        message: `${marketplace.name} için lokasyon senkronizasyonu henüz desteklenmiyor`,
      });
    }

    const message = failed > 0
      ? `${synced} ürün lokasyonu güncellendi, ${failed} başarısız`
      : `${synced} ürün lokasyonu başarıyla güncellendi`;

    return NextResponse.json({
      success: true,
      message,
      synced,
      failed,
      total: mappings.length,
    });
  } catch (error) {
    console.error('Location sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
        message: 'Lokasyon senkronizasyonu sırasında hata oluştu'
      },
      { status: 500 }
    );
  }
}
