import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TrendyolService } from '@/lib/marketplace/trendyol';
import { OrderStatus, StockLogType } from '@prisma/client';
import { requireAdmin } from '@/lib/auth-helper';

/**
 * İPTAL SİPARİŞLERİ SENKRONZE ET:
 * 1. Cancelled statüsünde siparişleri çek
 * 2. Local DB'de varsa ve henüz iptal edilmemişse stokları geri ekle
 */
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const { marketplaceId } = await request.json();

    if (!marketplaceId) {
      return NextResponse.json(
        { success: false, error: 'Marketplace ID gerekli' },
        { status: 400 }
      );
    }

    const marketplace = await prisma.marketplace.findUnique({
      where: { id: marketplaceId },
    });

    if (!marketplace || marketplace.name !== 'Trendyol') {
      return NextResponse.json(
        { success: false, error: 'Geçerli Trendyol marketplace bulunamadı' },
        { status: 404 }
      );
    }

    const trendyolService = new TrendyolService({
      apiKey: marketplace.apiKey || '',
      apiSecret: marketplace.apiSecret || '',
      supplierId: marketplace.supplierId || '',
    });

    console.log('📦 İptal edilen siparişler çekiliyor...');

    // İptal edilmiş siparişleri çek
    const packagesResult = await trendyolService.getShipmentPackages({
      status: 'Cancelled',
      page: 0,
      size: 100,
    });

    const packages = packagesResult.content || [];
    console.log(`📋 ${packages.length} iptal edilmiş paket bulundu`);

    let processed = 0;
    let skipped = 0;
    const results: any[] = [];

    for (const pkg of packages) {
      try {
        // Local DB'de var mı?
        const order = await prisma.order.findUnique({
          where: { marketplaceOrderId: pkg.orderNumber },
        });

        if (!order) {
          skipped++;
          continue; // Local'de yok, atlayalım
        }

        // Zaten iptal edilmiş mi?
        if (order.status === OrderStatus.CANCELLED) {
          skipped++;
          continue;
        }

        // Bu sipariş için stok loglarını bul
        const stockLogs = await prisma.stockLog.findMany({
          where: {
            reference: pkg.orderNumber,
            type: StockLogType.SALE,
          },
          include: {
            product: true,
          },
        });

        if (stockLogs.length === 0) {
          skipped++;
          continue;
        }

        const restoredStocks: any[] = [];

        // Transaction ile stokları geri ekle
        await prisma.$transaction(async (tx) => {
          for (const log of stockLogs) {
            const product = log.product;
            const restoredQuantity = Math.abs(log.quantity);
            const oldStock = product.stockQuantity;
            const newStock = oldStock + restoredQuantity;

            // Stok güncelle
            await tx.product.update({
              where: { id: product.id },
              data: { stockQuantity: newStock },
            });

            // İptal log'u kaydet
            await tx.stockLog.create({
              data: {
                productId: product.id,
                type: StockLogType.CANCEL,
                quantity: restoredQuantity,
                oldStock,
                newStock,
                reason: 'Sipariş İptal Edildi (Otomatik)',
                reference: pkg.orderNumber,
                createdBy: 'system',
              },
            });

            restoredStocks.push({
              productName: product.name,
              quantity: restoredQuantity,
              oldStock,
              newStock,
            });
          }

          // Siparişi iptal durumuna güncelle
          await tx.order.update({
            where: { id: order.id },
            data: { status: OrderStatus.CANCELLED },
          });
        });

        processed++;
        results.push({
          orderNumber: pkg.orderNumber,
          restoredItems: restoredStocks.length,
        });

        console.log(`✅ İptal işlendi: ${pkg.orderNumber} (${restoredStocks.length} ürün stoğa eklendi)`);

      } catch (error) {
        console.error(`❌ Hata: ${pkg.orderNumber}`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `✅ ${processed} iptal siparişi işlendi, ${skipped} atlandı`,
      processed,
      skipped,
      total: packages.length,
      results,
    });
  } catch (error: any) {
    console.error('Sync cancelled orders error:', error);
    
    // Check if it's an authentication error
    if (error.message === 'Authentication required' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
}
