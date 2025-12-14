import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TrendyolService } from '@/lib/marketplace/trendyol';
import { OrderStatus, StockLogType } from '@prisma/client';
import { telegramNotifications } from '@/lib/telegram-notifications';

/**
 * BASİT SİSTEM:
 * 1. Trendyol'dan siparişleri çek
 * 2. Barkod ile product tablosundan eşleştir
 * 3. Stoktan düş
 * 4. StockLog'a sipariş numarası ile kaydet
 */
export async function POST(request: NextRequest) {
  try {
    const { marketplaceId, status = 'Created' } = await request.json();

    if (!marketplaceId) {
      return NextResponse.json(
        { success: false, error: 'Marketplace ID gerekli' },
        { status: 400 }
      );
    }

    // Marketplace bilgilerini al
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

    console.log(`📦 ${status} statüsünde siparişler çekiliyor...`);

    // Siparişleri çek
    const packagesResult = await trendyolService.getShipmentPackages({
      status,
      page: 0,
      size: 100,
    });

    const packages = packagesResult.content || [];
    console.log(`📋 ${packages.length} paket bulundu`);

    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const results: any[] = [];
    const errors: string[] = [];

    for (const pkg of packages) {
      try {
        // Zaten işlenmiş mi?
        const existingOrder = await prisma.order.findUnique({
          where: { marketplaceOrderId: pkg.orderNumber },
        });

        if (existingOrder) {
          // Zaten var - statü değişmiş mi kontrol et
          const oldStatus = existingOrder.shipmentPackageStatus;
          const newStatus = pkg.shipmentPackageStatus;

          if (oldStatus !== newStatus && newStatus) {
            // Statü değişmiş! Güncelle
            await prisma.order.update({
              where: { id: existingOrder.id },
              data: {
                shipmentPackageStatus: newStatus,
                status: mapStatus(newStatus),
                cargoTrackingNumber: pkg.cargoTrackingNumber?.toString() || existingOrder.cargoTrackingNumber,
                cargoTrackingLink: pkg.cargoTrackingLink || existingOrder.cargoTrackingLink,
                cargoProviderName: pkg.cargoProviderName || existingOrder.cargoProviderName,
                lastModifiedDate: pkg.lastModifiedDate ? new Date(pkg.lastModifiedDate) : new Date(),
              },
            });

            // Telegram bildirimi gönder
            const customerName = `${pkg.customerFirstName || ''} ${pkg.customerLastName || ''}`.trim() || 'Müşteri';
            await telegramNotifications.notifyOrderStatusChange(
              pkg.orderNumber,
              'Trendyol',
              oldStatus || 'Unknown',
              newStatus,
              customerName
            );

            console.log(`  📱 Statü değişikliği bildirimi gönderildi: ${pkg.orderNumber} (${oldStatus} → ${newStatus})`);
          }

          skipped++;
          continue;
        }

        const stockChanges: Array<{
          productId: string;
          productName: string;
          barcode: string;
          quantity: number;
          oldStock: number;
          newStock: number;
        }> = [];

        const orderItems: any[] = [];

        const unmatchedItems: string[] = [];

        // Transaction ile işle
        await prisma.$transaction(async (tx) => {
          // Her ürün için
          for (const line of pkg.lines || []) {
            // ✅ Trendyol API değişikliği: merchantSku → stockCode (geriye uyumlu)
            const barcode = line.barcode || line.stockCode || line.merchantSku;

            console.log(`  🔍 Line: ${line.productName}, Barcode: ${barcode}, Quantity: ${line.quantity}`);

            if (!barcode) {
              unmatchedItems.push(`Barkod yok: ${line.productName}`);
              console.log(`  ❌ BARKOD YOK!`);
              continue;
            }

            // BARKOD ile product bul (önce Product, sonra ProductMapping.remoteSku)
            let product = await tx.product.findFirst({
              where: {
                OR: [
                  { sku: barcode },
                  { stockCode: barcode },
                ],
              },
            });

            // Bulunamadıysa ProductMapping'den bul
            if (!product) {
              const mapping = await tx.productMapping.findFirst({
                where: {
                  remoteSku: barcode,
                  marketplaceId: marketplace.id,
                },
                include: {
                  product: true,
                },
              });

              if (mapping) {
                product = mapping.product;
                console.log(`  ✅ Ürün ProductMapping ile bulundu: ${product.name}`);
              }
            }

            if (!product) {
              unmatchedItems.push(`Ürün bulunamadı: ${barcode} - ${line.productName}`);
              console.log(`  ⚠️ ÜRÜN BULUNAMADI: ${barcode} - Yine de kaydedeceğiz`);

              const itemQuantity = parseInt(line.quantity || '0');

              // Ürün bulunamasa bile sipariş kalemini ekle (bilgi amaçlı)
              // Önce dummy product mapping oluştur
              let dummyProduct = await tx.product.findFirst();

              // ✅ FIX: Eğer hiç ürün yoksa, placeholder ürün oluştur
              if (!dummyProduct) {
                console.log(`  ⚠️ Hiç ürün yok, placeholder oluşturuluyor...`);
                dummyProduct = await tx.product.create({
                  data: {
                    sku: `PLACEHOLDER_${barcode}`,
                    name: `[EŞLEŞME BEKLİYOR] ${line.productName || barcode}`,
                    description: 'Otomatik oluşturulan placeholder ürün - Sipariş import',
                    stockQuantity: 0,
                    // ✅ Trendyol API: price → lineUnitPrice
                    price: parseFloat(line.lineUnitPrice || line.price || '0'),
                  }
                });
                console.log(`  ✅ Placeholder ürün oluşturuldu: ${dummyProduct.sku}`);
              }

              let dummyMapping = await tx.productMapping.findFirst({
                where: {
                  productId: dummyProduct.id,
                  marketplaceId: marketplace.id,
                }
              });

              if (!dummyMapping) {
                dummyMapping = await tx.productMapping.create({
                  data: {
                    productId: dummyProduct.id,
                    marketplaceId: marketplace.id,
                    remoteSku: barcode,
                    syncStock: false, // Stok senkronize etme
                  }
                });
              }

              orderItems.push({
                productMappingId: dummyMapping.id,
                quantity: itemQuantity,
                // ✅ Trendyol API değişiklikleri (geriye uyumlu)
                price: parseFloat(line.lineUnitPrice || line.price || '0'),
                amount: parseFloat(line.lineGrossAmount || line.amount || '0'),
                discount: parseFloat(line.lineSellerDiscount || line.discount || '0'),
                tyDiscount: parseFloat(line.lineTyDiscount || line.tyDiscount || '0'),
                productName: line.productName,
                // ✅ productCode → contentId
                productCode: (line.contentId || line.productCode)?.toString(),
                productSize: line.productSize,
                productColor: line.productColor,
                productOrigin: line.productOrigin,
                productCategoryId: line.productCategoryId,
                barcode: line.barcode,
                // ✅ merchantSku → stockCode (lokasyon)
                merchantSku: line.stockCode || line.merchantSku,
                sku: line.sku,
                productImageUrl: line.productImageUrl || null, // Trendyol ürün resmi
                // ✅ vatBaseAmount → vatRate
                vatBaseAmount: parseFloat(line.vatRate || line.vatBaseAmount || '0'),
                laborCost: parseFloat(line.laborCost || '0'),
                commission: parseFloat(line.commission || '0'),
                currencyCode: line.currencyCode || 'TRY',
                salesCampaignId: line.salesCampaignId,
                // ✅ merchantId → sellerId
                merchantId: line.sellerId || line.merchantId,
                orderLineItemStatusName: line.orderLineItemStatusName,
                // ✅ id → lineId
                orderLineId: (line.lineId || line.id)?.toString(),
                discountDetails: line.discountDetails || null,
                fastDeliveryOptions: line.fastDeliveryOptions || null,
              });

              console.log(`  ℹ️ Ürün bilgisi kaydedildi (stok yok): ${line.productName}`);
              continue;
            }

            console.log(`  ✅ Ürün bulundu: ${product.name} (ID: ${product.id}, Mevcut Stok: ${product.stockQuantity})`);

            const quantity = parseInt(line.quantity || '0');
            if (quantity <= 0) {
              console.log(`  ⚠️ Quantity 0 veya eksik!`);
              continue;
            }

            // ProductMapping bul veya oluştur
            let mapping = await tx.productMapping.findFirst({
              where: {
                productId: product.id,
                marketplaceId: marketplace.id,
              },
            });

            if (!mapping) {
              // Mapping yoksa oluştur
              mapping = await tx.productMapping.create({
                data: {
                  productId: product.id,
                  marketplaceId: marketplace.id,
                  remoteSku: barcode,
                  syncStock: true,
                },
              });
            }

            const oldStock = product.stockQuantity;
            const newStock = Math.max(0, oldStock - quantity);

            console.log(`  📦 STOK GÜNCELLEMESI: ${product.name}`);
            console.log(`     Eski Stok: ${oldStock}`);
            console.log(`     Miktar: ${quantity}`);
            console.log(`     Yeni Stok: ${newStock}`);

            // Stok güncelle
            const updatedProduct = await tx.product.update({
              where: { id: product.id },
              data: { stockQuantity: newStock },
            });

            console.log(`  ✅ STOK GÜNCELLENDİ: ${updatedProduct.stockQuantity}`);

            // StockLog bilgilerini sakla (sipariş oluştuktan sonra ekleyeceğiz)
            stockChanges.push({
              productId: product.id,
              productName: product.name,
              barcode,
              quantity,
              oldStock,
              newStock,
            });

            console.log(`  📝 Stok değişikliği kaydedildi`);

            // OrderItem için kaydet (Detaylı)
            orderItems.push({
              productMappingId: mapping.id,
              quantity,
              // ✅ Trendyol API değişiklikleri (geriye uyumlu)
              price: parseFloat(line.lineUnitPrice || line.price || '0'),
              amount: parseFloat(line.lineGrossAmount || line.amount || '0'),
              discount: parseFloat(line.lineSellerDiscount || line.discount || '0'),
              tyDiscount: parseFloat(line.lineTyDiscount || line.tyDiscount || '0'),
              productName: line.productName,
              // ✅ productCode → contentId
              productCode: (line.contentId || line.productCode)?.toString(),
              productSize: line.productSize,
              productColor: line.productColor,
              productOrigin: line.productOrigin,
              productCategoryId: line.productCategoryId,
              barcode: line.barcode,
              // ✅ merchantSku → stockCode (lokasyon)
              merchantSku: line.stockCode || line.merchantSku,
              sku: line.sku,
              productImageUrl: line.productImageUrl || null, // Trendyol ürün resmi
              // ✅ vatBaseAmount → vatRate
              vatBaseAmount: parseFloat(line.vatRate || line.vatBaseAmount || '0'),
              laborCost: parseFloat(line.laborCost || '0'),
              commission: parseFloat(line.commission || '0'),
              currencyCode: line.currencyCode || 'TRY',
              salesCampaignId: line.salesCampaignId,
              // ✅ merchantId → sellerId
              merchantId: line.sellerId || line.merchantId,
              orderLineItemStatusName: line.orderLineItemStatusName,
              // ✅ id → lineId
              orderLineId: (line.lineId || line.id)?.toString(),
              discountDetails: line.discountDetails || null,
              fastDeliveryOptions: line.fastDeliveryOptions || null,
            });

            console.log(`  ✅ ${product.name}: ${oldStock} → ${newStock} (-${quantity})`);
          }

          // Sipariş bilgilerini logla
          console.log(`  📦 Sipariş Bilgileri:`);
          console.log(`     Sipariş No: ${pkg.orderNumber}`);
          console.log(`     Kargo Firması: ${pkg.cargoProviderName || 'YOK'}`);
          console.log(`     Takip No: ${pkg.cargoTrackingNumber || 'YOK'}`);
          console.log(`     Gönderici No: ${pkg.cargoSenderNumber || 'YOK'}`);
          console.log(`     Müşteri: ${pkg.customerFirstName} ${pkg.customerLastName}`);

          // Sipariş kaydı oluştur (DETAYLI - Tüm Trendyol Alanları)
          const createdOrder = await tx.order.create({
            data: {
              marketplaceOrderId: pkg.orderNumber,
              marketplaceId: marketplace.id,

              // ✅ Trendyol API değişiklikleri (geriye uyumlu)
              // totalPrice → packageTotalPrice, grossAmount → packageGrossAmount
              // totalDiscount → packageSellerDiscount, totalTyDiscount → packageTyDiscount
              totalAmount: parseFloat(pkg.packageTotalPrice || pkg.totalPrice || '0'),
              grossAmount: parseFloat(pkg.packageGrossAmount || pkg.grossAmount || '0'),
              totalDiscount: parseFloat(pkg.packageSellerDiscount || pkg.totalDiscount || '0'),
              totalTyDiscount: parseFloat(pkg.packageTyDiscount || pkg.totalTyDiscount || '0'),
              totalPrice: parseFloat(pkg.packageTotalPrice || pkg.totalPrice || '0'),
              currencyCode: pkg.currencyCode || 'TRY',

              // Durum
              status: mapStatus(status),
              shipmentPackageStatus: pkg.shipmentPackageStatus,

              // Müşteri Bilgileri
              customerFirstName: pkg.customerFirstName,
              customerLastName: pkg.customerLastName,
              customerEmail: pkg.customerEmail,
              customerId: pkg.customerId?.toString(),
              identityNumber: pkg.identityNumber,
              taxNumber: pkg.taxNumber,

              // Adres Bilgileri (JSON)
              shipmentAddress: pkg.shipmentAddress || null,
              invoiceAddress: pkg.invoiceAddress || null,

              // Kargo Bilgileri
              cargoTrackingNumber: pkg.cargoTrackingNumber?.toString(),
              cargoTrackingLink: pkg.cargoTrackingLink,
              cargoSenderNumber: pkg.cargoSenderNumber,
              cargoProviderName: pkg.cargoProviderName,
              cargoDeci: parseFloat(pkg.cargoDeci || '0'),

              // Tarih Bilgileri
              orderDate: pkg.orderDate ? new Date(pkg.orderDate) : new Date(),
              originShipmentDate: pkg.originShipmentDate ? new Date(pkg.originShipmentDate) : null,
              lastModifiedDate: pkg.lastModifiedDate ? new Date(pkg.lastModifiedDate) : null,
              estimatedDeliveryStartDate: pkg.estimatedDeliveryStartDate ? new Date(pkg.estimatedDeliveryStartDate) : null,
              estimatedDeliveryEndDate: pkg.estimatedDeliveryEndDate ? new Date(pkg.estimatedDeliveryEndDate) : null,
              agreedDeliveryDate: pkg.agreedDeliveryDate ? new Date(pkg.agreedDeliveryDate) : null,
              agreedDeliveryDateExtendible: pkg.agreedDeliveryDateExtendible,
              extendedAgreedDeliveryDate: pkg.extendedAgreedDeliveryDate ? new Date(pkg.extendedAgreedDeliveryDate) : null,
              agreedDeliveryExtensionStartDate: pkg.agreedDeliveryExtensionStartDate ? new Date(pkg.agreedDeliveryExtensionStartDate) : null,
              agreedDeliveryExtensionEndDate: pkg.agreedDeliveryExtensionEndDate ? new Date(pkg.agreedDeliveryExtensionEndDate) : null,

              // Paket Geçmişi
              packageHistories: pkg.packageHistories || null,

              // Özel Durumlar
              fastDelivery: pkg.fastDelivery || false,
              fastDeliveryType: pkg.fastDeliveryType,
              commercial: pkg.commercial || false,
              deliveredByService: pkg.deliveredByService || false,
              micro: pkg.micro || false,
              giftBoxRequested: pkg.giftBoxRequested || false,
              threePByTrendyol: pkg['3pByTrendyol'] || false,
              containsDangerousProduct: pkg.containsDangerousProduct || false,
              isCod: pkg.isCod || false,

              // Mikro İhracat
              etgbNo: pkg.etgbNo,
              etgbDate: pkg.etgbDate ? new Date(pkg.etgbDate) : null,
              hsCode: pkg.hsCode,

              // Diğer
              deliveryType: pkg.deliveryType || 'normal',
              deliveryAddressType: pkg.deliveryAddressType,
              timeSlotId: pkg.timeSlotId,
              scheduledDeliveryStoreId: pkg.scheduledDeliveryStoreId,
              invoiceLink: pkg.invoiceLink,
              // ✅ id → shipmentPackageId
              shipmentPackageId: (pkg.shipmentPackageId || pkg.id)?.toString(),
              whoPays: pkg.whoPays,
              createdBy: pkg.createdBy,
              originPackageIds: pkg.originPackageIds || null,

              // Geriye dönük uyumluluk için customerInfo
              customerInfo: {
                name: `${pkg.customerFirstName || ''} ${pkg.customerLastName || ''}`.trim(),
                email: pkg.customerEmail,
              },

              items: {
                create: orderItems,
              },
            },
          });

          // Şimdi StockLog'ları orderId ile oluştur
          for (const stockChange of stockChanges) {
            await tx.stockLog.create({
              data: {
                productId: stockChange.productId,
                orderId: createdOrder.id,
                type: StockLogType.SALE,
                quantity: -stockChange.quantity,
                oldStock: stockChange.oldStock,
                newStock: stockChange.newStock,
                reason: `Trendyol Siparişi`,
                reference: pkg.orderNumber,
                createdBy: 'system',
              },
            });
          }

          console.log(`  📝 ${stockChanges.length} StockLog kaydı oluşturuldu`);
        });

        processed++;
        results.push({
          orderNumber: pkg.orderNumber,
          stockChanges: stockChanges.length,
          unmatchedItems: unmatchedItems.length,
          details: stockChanges,
        });

        if (unmatchedItems.length > 0) {
          errors.push(...unmatchedItems.map(u => `${pkg.orderNumber}: ${u}`));
        }

        console.log(`✅ İşlendi: ${pkg.orderNumber} (${stockChanges.length} ürün stoktan düştü)`);

        // 🔔 YENİ SİPARİŞ TELEGRam BİLDİRİMİ
        try {
          const orderItems = (pkg.lines || []).map((line: any) => ({
            productName: line.productName || 'Ürün',
            quantity: parseInt(line.quantity || '1'),
            price: parseFloat(line.price || '0'),
          }));

          // Stok uyarısı için düşük stoklu ürünleri bul
          const lowStockItems = stockChanges
            .filter((sc: any) => sc.newStock <= 5)
            .map((sc: any) => ({
              productName: sc.productName,
              quantity: sc.quantity,
              price: 0,
              oldStock: sc.oldStock,
              newStock: sc.newStock,
            }));

          await telegramNotifications.notifyNewOrder({
            orderId: pkg.id?.toString() || pkg.orderNumber,
            orderNumber: pkg.orderNumber,
            marketplace: marketplace.name,
            totalAmount: parseFloat(pkg.totalPrice || '0'),
            customerName: `${pkg.customerFirstName || ''} ${pkg.customerLastName || ''}`.trim() || 'Müşteri',
            customerCity: pkg.shipmentAddress?.city || '',
            customerPhone: pkg.shipmentAddress?.phone || '',
            items: orderItems.length > 0 ? orderItems : lowStockItems,
            orderDate: pkg.orderDate ? new Date(pkg.orderDate) : new Date(),
            status: status,
          });

          console.log(`📱 Telegram bildirimi gönderildi: ${pkg.orderNumber}`);
        } catch (telegramError) {
          console.error(`📱 Telegram bildirim hatası:`, telegramError);
        }

      } catch (error) {
        failed++;
        const errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata';
        errors.push(`${pkg.orderNumber}: ${errorMsg}`);
        console.error(`❌ Hata: ${pkg.orderNumber}`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `✅ ${processed} sipariş işlendi, ${skipped} zaten var, ${failed} hata`,
      processed,
      skipped,
      failed,
      total: packages.length,
      results,
      errors: errors.slice(0, 20), // İlk 20 hata
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
}

function mapStatus(packageStatus: string): OrderStatus {
  const statusMap: Record<string, OrderStatus> = {
    'Created': OrderStatus.PENDING,
    'Picking': OrderStatus.PROCESSING,
    'Invoiced': OrderStatus.PROCESSING,
    'Shipped': OrderStatus.SHIPPED,
    'Delivered': OrderStatus.DELIVERED,
    'Cancelled': OrderStatus.CANCELLED,
    'Returned': OrderStatus.REFUNDED,
  };
  return statusMap[packageStatus] || OrderStatus.PENDING;
}
