/**
 * İade Onaylama API
 * Trendyol API ile iade onaylama + Stok güncelleme
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { claimId, claimLineItemIdList, items, orderNumber } = body;

    if (!claimId || !claimLineItemIdList || claimLineItemIdList.length === 0) {
      return NextResponse.json({ error: 'claimId ve claimLineItemIdList gerekli' }, { status: 400 });
    }

    // Trendyol pazaryerini bul
    const trendyol = await prisma.marketplace.findFirst({
      where: { name: 'Trendyol' }
    });

    if (!trendyol || !trendyol.apiKey || !trendyol.apiSecret || !trendyol.supplierId) {
      return NextResponse.json({ error: 'Trendyol API bilgileri eksik' }, { status: 400 });
    }

    // 1. Barkod eşleşmesi kontrolü ve stok güncelleme
    const stockUpdates: any[] = [];
    const matchedProducts: any[] = [];
    const unmatchedItems: any[] = [];

    for (const item of items || []) {
      if (!item.barcode && !item.sku) {
        unmatchedItems.push({ ...item, reason: 'Barkod/SKU yok' });
        continue;
      }

      // ProductMapping üzerinden barkod/sku ile ürün ara
      const mapping = await prisma.productMapping.findFirst({
        where: {
          OR: [
            { remoteSku: item.barcode || '' },
            { remoteSku: item.sku || '' }
          ],
          marketplaceId: trendyol.id
        },
        include: {
          product: true,
          marketplace: true
        }
      });

      if (mapping && mapping.product) {
        const product = mapping.product;
        const previousStock = product.stockQuantity;

        matchedProducts.push({
          productId: product.id,
          productName: product.name,
          localSku: product.sku,
          remoteSku: mapping.remoteSku,
          barcode: item.barcode,
          currentStock: previousStock,
          marketplace: mapping.marketplace.name,
          storeName: mapping.marketplace.storeName || 'Ana Mağaza',
          location: product.location || 'Lokasyon belirtilmemiş'
        });

        // Stok güncelle - iade geldiği için +1
        await prisma.product.update({
          where: { id: product.id },
          data: { stockQuantity: { increment: 1 } }
        });

        // İlgili siparişi bul (mağaza bilgisi için)
        const relatedOrder = await prisma.order.findFirst({
          where: { 
            marketplaceOrderId: orderNumber || '',
            marketplaceId: trendyol.id
          }
        });

        // Stok logu kaydet
        await prisma.stockLog.create({
          data: {
            productId: product.id,
            orderId: relatedOrder?.id || null,
            type: 'RETURN',
            quantity: 1,
            oldStock: previousStock,
            newStock: previousStock + 1,
            reason: `İade Onayı - Sipariş: ${orderNumber || 'N/A'}`,
            reference: claimId
          }
        });

        stockUpdates.push({
          productId: product.id,
          productName: product.name,
          barcode: item.barcode,
          previousStock: previousStock,
          newStock: previousStock + 1,
          marketplace: mapping.marketplace.name
        });
      } else {
        unmatchedItems.push({ 
          ...item, 
          reason: 'Sistemde eşleşen ürün bulunamadı' 
        });
      }
    }

    // 2. Trendyol API ile iade onaylama
    const auth = Buffer.from(`${trendyol.apiKey}:${trendyol.apiSecret}`).toString('base64');
    const apiUrl = `https://apigw.trendyol.com/integration/order/sellers/${trendyol.supplierId}/claims/${claimId}/items/approve`;

    console.log('🔄 Trendyol iade onaylama:', apiUrl);
    console.log('📦 Onaylanacak items:', claimLineItemIdList);

    const response = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
        'User-Agent': 'StockManagementSystem/1.0',
      },
      body: JSON.stringify({
        claimLineItemIdList: claimLineItemIdList,
        params: {}
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Trendyol API hatası:', response.status, errorText);
      return NextResponse.json({ 
        error: `Trendyol API hatası: ${response.status}`,
        details: errorText
      }, { status: response.status });
    }

    console.log('✅ İade onaylandı:', claimId);

    return NextResponse.json({
      success: true,
      message: 'İade başarıyla onaylandı',
      claimId,
      approvedItems: claimLineItemIdList.length,
      stockUpdates,
      matchedProducts,
      unmatchedItems
    });

  } catch (error) {
    console.error('Approve return error:', error);
    return NextResponse.json({ error: 'İade onaylama hatası' }, { status: 500 });
  }
}
