import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OrderStatus, StockLogType } from '@prisma/client';

/**
 * İPTAL SİSTEMİ:
 * 1. Sipariş numarası ile StockLog'u bul
 * 2. Stokları geri ekle
 * 3. İptal log'u kaydet
 */
export async function POST(request: NextRequest) {
  try {
    const { orderNumber } = await request.json();

    if (!orderNumber) {
      return NextResponse.json(
        { success: false, error: 'Sipariş numarası gerekli' },
        { status: 400 }
      );
    }

    console.log(`🔙 Sipariş iptali işleniyor: ${orderNumber}`);

    // Siparişi bul
    const order = await prisma.order.findUnique({
      where: { marketplaceOrderId: orderNumber },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: 'Sipariş bulunamadı' },
        { status: 404 }
      );
    }

    // Zaten iptal edilmiş mi?
    if (order.status === OrderStatus.CANCELLED) {
      return NextResponse.json({
        success: false,
        message: 'Bu sipariş zaten iptal edilmiş',
      });
    }

    // Bu sipariş için düşülen stokları bul
    const stockLogs = await prisma.stockLog.findMany({
      where: {
        reference: orderNumber,
        type: StockLogType.SALE,
      },
      include: {
        product: true,
      },
    });

    if (stockLogs.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Bu sipariş için stok hareketi bulunamadı',
      });
    }

    console.log(`📋 ${stockLogs.length} ürün için stok geri eklenecek`);

    const restoredStocks: any[] = [];

    // Transaction ile stokları geri ekle
    await prisma.$transaction(async (tx) => {
      for (const log of stockLogs) {
        const product = log.product;
        const restoredQuantity = Math.abs(log.quantity); // Negatif değeri pozitif yap
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
            reason: `Sipariş İptal Edildi`,
            reference: orderNumber,
            createdBy: 'system',
          },
        });

        restoredStocks.push({
          productName: product.name,
          sku: product.sku,
          restoredQuantity,
          oldStock,
          newStock,
        });

        console.log(`  ✅ ${product.name}: ${oldStock} → ${newStock} (+${restoredQuantity})`);
      }

      // Siparişi iptal durumuna güncelle
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED },
      });
    });

    console.log(`✅ Sipariş iptal edildi ve ${restoredStocks.length} ürün stoğu geri eklendi`);

    return NextResponse.json({
      success: true,
      message: `✅ Sipariş iptal edildi. ${restoredStocks.length} ürün stoğa geri eklendi.`,
      orderNumber,
      restoredStocks,
    });
  } catch (error) {
    console.error('Cancel order error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
}
