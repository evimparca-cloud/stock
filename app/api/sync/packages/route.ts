import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TrendyolService } from '@/lib/marketplace/trendyol';
import { OrderStatus } from '@prisma/client';

/**
 * Toplu sipariş paketi senkronizasyonu
 * Created statüsündeki paketleri çekip işler ve stoktan düşer
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { marketplaceId } = body;

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

    if (marketplace.name !== 'Trendyol') {
      return NextResponse.json(
        { success: false, error: 'Sadece Trendyol destekleniyor' },
        { status: 400 }
      );
    }

    const trendyolService = new TrendyolService({
      apiKey: marketplace.apiKey || '',
      apiSecret: marketplace.apiSecret || '',
      supplierId: marketplace.supplierId || '',
    });

    console.log('📦 Sipariş paketleri çekiliyor (Created statüsü)...');

    // Created statüsündeki paketleri çek
    const packagesResult = await trendyolService.getShipmentPackages({
      status: 'Created',
      page: 0,
      size: 100, // Maksimum 100 paket
    });

    const packages = packagesResult.content || [];
    console.log(`📋 ${packages.length} adet Created paket bulundu`);

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const processedOrders: any[] = [];
    const errors: string[] = [];

    for (const pkg of packages) {
      try {
        // Sipariş zaten var mı kontrol et
        const existingOrder = await prisma.order.findUnique({
          where: { marketplaceOrderId: pkg.orderNumber },
        });

        if (existingOrder) {
          skipped++;
          continue;
        }

        // Sipariş kalemlerini hazırla ve eşleştir
        const orderItems: Array<{
          productMappingId: string;
          quantity: number;
          price: number;
        }> = [];

        const stockUpdates: Array<{
          productId: string;
          quantity: number;
          productName: string;
        }> = [];

        let hasUnmatchedItems = false;

        for (const line of pkg.lines || []) {
          // merchantSku ile mapping bul
          const mapping = await prisma.productMapping.findFirst({
            where: {
              marketplaceId: marketplace.id,
              remoteSku: line.merchantSku || line.barcode,
            },
            include: {
              product: true,
            },
          });

          if (!mapping) {
            errors.push(`${pkg.orderNumber}: Eşleşme bulunamadı - ${line.merchantSku}`);
            hasUnmatchedItems = true;
            continue;
          }

          orderItems.push({
            productMappingId: mapping.id,
            quantity: parseInt(line.quantity),
            price: parseFloat(line.amount),
          });

          // Stok senkronizasyonu açık mı kontrol et
          if (mapping.syncStock) {
            stockUpdates.push({
              productId: mapping.productId,
              quantity: parseInt(line.quantity),
              productName: mapping.product.name,
            });
          }
        }

        if (orderItems.length === 0) {
          failed++;
          errors.push(`${pkg.orderNumber}: Hiçbir ürün eşleştirilemedi`);
          continue;
        }

        // Transaction ile sipariş oluştur ve stok düş
        await prisma.$transaction(async (tx) => {
          // Siparişi oluştur
          const order = await tx.order.create({
            data: {
              marketplaceOrderId: pkg.orderNumber,
              marketplaceId: marketplace.id,
              totalAmount: parseFloat(pkg.totalPrice || '0'),
              status: OrderStatus.PENDING,
              customerInfo: {
                firstName: pkg.customerFirstName,
                lastName: pkg.customerLastName || '',
                email: pkg.customerEmail,
                phone: pkg.customerPhone || '',
                address: {
                  city: pkg.city,
                  district: pkg.district,
                  fullAddress: pkg.address || '',
                },
              },
              orderDate: new Date(),
              items: {
                create: orderItems.map(item => ({
                  productMappingId: item.productMappingId,
                  quantity: item.quantity,
                  price: item.price,
                })),
              },
            },
          });

          // Stoktan düş
          for (const stockUpdate of stockUpdates) {
            const product = await tx.product.findUnique({
              where: { id: stockUpdate.productId },
            });

            if (product) {
              const newStock = Math.max(0, product.stockQuantity - stockUpdate.quantity);
              
              await tx.product.update({
                where: { id: stockUpdate.productId },
                data: { stockQuantity: newStock },
              });
            }
          }

          processedOrders.push({
            orderNumber: order.marketplaceOrderId,
            itemCount: orderItems.length,
            stockUpdated: stockUpdates.length,
          });
        });

        processed++;
        console.log(`✅ İşlendi: ${pkg.orderNumber} (${orderItems.length} ürün, ${stockUpdates.length} stok düşürme)`);

      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
        errors.push(`${pkg.orderNumber}: ${errorMsg}`);
        console.error(`❌ Hata: ${pkg.orderNumber}`, error);
      }
    }

    const message = `${processed} sipariş işlendi, ${skipped} zaten mevcut, ${failed} başarısız`;
    console.log('📊 Sonuç:', { processed, skipped, failed, total: packages.length });

    return NextResponse.json({
      success: true,
      message,
      processed,
      skipped,
      failed,
      total: packages.length,
      processedOrders,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // İlk 10 hatayı göster
    });
  } catch (error) {
    console.error('Sync packages error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
}
