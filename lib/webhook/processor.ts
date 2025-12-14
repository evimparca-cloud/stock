import { prisma } from '@/lib/prisma';
import { WebhookStatus } from '@prisma/client';

export interface WebhookPayload {
  eventType: string;
  data: any;
  timestamp?: string;
  signature?: string;
}

export class WebhookProcessor {
  /**
   * Webhook'u logla ve işle
   */
  static async process(
    marketplaceId: string,
    eventType: string,
    payload: any
  ): Promise<{ success: boolean; message: string; error?: string }> {
    // Webhook log oluştur
    const webhookLog = await prisma.webhookLog.create({
      data: {
        marketplaceId,
        eventType,
        payload,
        status: WebhookStatus.PENDING,
      },
    });

    try {
      // Status'u PROCESSING yap
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: { status: WebhookStatus.PROCESSING },
      });

      // Event type'a göre işle
      let result;
      switch (eventType) {
        case 'order.created':
        case 'order.new':
          result = await this.handleNewOrder(marketplaceId, payload);
          break;

        case 'order.updated':
        case 'order.status_changed':
          result = await this.handleOrderUpdate(marketplaceId, payload);
          break;

        case 'order.cancelled':
          result = await this.handleOrderCancellation(marketplaceId, payload);
          break;

        case 'stock.updated':
          result = await this.handleStockUpdate(marketplaceId, payload);
          break;

        default:
          // Bilinmeyen event type - ignore
          await prisma.webhookLog.update({
            where: { id: webhookLog.id },
            data: {
              status: WebhookStatus.IGNORED,
              processedAt: new Date(),
              error: `Unknown event type: ${eventType}`,
            },
          });
          return {
            success: true,
            message: `Event type ignored: ${eventType}`,
          };
      }

      // Başarılı
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: {
          status: WebhookStatus.SUCCESS,
          processedAt: new Date(),
        },
      });

      return result;
    } catch (error) {
      // Hata
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await prisma.webhookLog.update({
        where: { id: webhookLog.id },
        data: {
          status: WebhookStatus.FAILED,
          processedAt: new Date(),
          error: errorMessage,
        },
      });

      return {
        success: false,
        message: 'Webhook processing failed',
        error: errorMessage,
      };
    }
  }

  /**
   * Yeni sipariş webhook'unu işle
   */
  private static async handleNewOrder(
    marketplaceId: string,
    payload: any
  ): Promise<{ success: boolean; message: string }> {
    const orderNumber = payload.orderNumber || payload.orderId;

    // Sipariş zaten var mı kontrol et
    const existingOrder = await prisma.order.findUnique({
      where: { marketplaceOrderId: orderNumber },
    });

    if (existingOrder) {
      return {
        success: true,
        message: 'Order already exists',
      };
    }

    // Sipariş kalemlerini eşleştir
    const orderItems: Array<{
      productMappingId: string;
      quantity: number;
      price: number;
      // Trendyol fields
      orderLineId?: string;
      productName?: string;
      productCode?: string;
      productSize?: string;
      productColor?: string;
      barcode?: string;
      merchantSku?: string;
      sku?: string;
      amount?: number;
      discount?: number;
      tyDiscount?: number;
    }> = [];

    for (const item of payload.items || payload.lines || []) {
      const sku = item.barcode || item.sku || item.merchantSku;
      const productName = item.productName || item.name || 'Bilinmeyen Ürün';

      let mapping = await prisma.productMapping.findFirst({
        where: {
          marketplaceId,
          remoteSku: sku,
        },
      });

      // ✅ FIX: Eşleşme yoksa otomatik oluştur
      if (!mapping) {
        console.warn(`⚠️ Mapping not found for SKU: ${sku}, auto-creating...`);

        // Placeholder product oluştur
        const placeholderProduct = await prisma.product.upsert({
          where: { sku: `UNMAPPED_${sku}` },
          update: {},
          create: {
            sku: `UNMAPPED_${sku}`,
            name: `[EŞLEŞME BEKLIYOR] ${productName}`,
            description: `Otomatik oluşturuldu - Sipariş: ${payload.orderNumber || payload.orderId}`,
            stockQuantity: 0,
            price: parseFloat(item.price || item.amount || 0),
            requiresReview: true,
          },
        });

        // Mapping oluştur
        mapping = await prisma.productMapping.create({
          data: {
            marketplaceId,
            productId: placeholderProduct.id,
            remoteSku: sku,
            remoteProductName: productName,
            syncStock: false, // İncelenene kadar stok senkronize etme
          },
        });

        console.log(`✅ Auto-created mapping: ${sku} -> ${placeholderProduct.sku}`);
      }

      // ✅ Include all Trendyol fields including orderLineId
      orderItems.push({
        productMappingId: mapping.id,
        quantity: item.quantity,
        price: parseFloat(item.price || item.amount),
        // ✅ Trendyol specific fields
        orderLineId: item.id?.toString() || item.orderLineId?.toString() || item.lineId?.toString(),
        productName: item.productName,
        productCode: item.productCode,
        productSize: item.productSize,
        productColor: item.productColor,
        barcode: item.barcode,
        merchantSku: item.merchantSku,
        sku: item.sku,
        amount: item.amount ? parseFloat(item.amount) : undefined,
        discount: item.discount ? parseFloat(item.discount) : undefined,
        tyDiscount: item.tyDiscount ? parseFloat(item.tyDiscount) : undefined,
      });
    }

    if (orderItems.length === 0) {
      throw new Error('No valid order items found');
    }

    // Siparişi oluştur
    await prisma.$transaction(async (tx) => {
      await tx.order.create({
        data: {
          marketplaceOrderId: orderNumber,
          marketplaceId,
          totalAmount: parseFloat(payload.totalAmount || payload.grossAmount || 0),
          status: 'PENDING',
          // ✅ Trendyol specific ID - required for "Toplanıyor" API
          shipmentPackageId: payload.id?.toString() || payload.shipmentPackageId?.toString(),
          // Customer Info (detailed fields)
          customerFirstName: payload.customerFirstName,
          customerLastName: payload.customerLastName,
          customerEmail: payload.customerEmail,
          customerId: payload.customerId?.toString(),
          // Legacy customerInfo for backwards compatibility
          customerInfo: {
            name: payload.customerName ||
              `${payload.customerFirstName || ''} ${payload.customerLastName || ''}`.trim(),
            email: payload.customerEmail,
            phone: payload.customerPhone || payload.shipmentAddress?.phone,
            address: payload.shippingAddress || payload.shipmentAddress,
          },
          // Addresses (JSON)
          shipmentAddress: payload.shipmentAddress,
          invoiceAddress: payload.invoiceAddress,
          // Cargo info
          cargoProviderName: payload.cargoProviderName,
          cargoTrackingNumber: payload.cargoTrackingNumber?.toString(),
          cargoTrackingLink: payload.cargoTrackingLink,
          cargoSenderNumber: payload.cargoSenderNumber,
          // Order date
          orderDate: payload.orderDate ? new Date(payload.orderDate) : new Date(),
          // Items with all Trendyol fields
          items: {
            create: orderItems,
          },
        },
      });

      // Stok düşür
      for (const item of orderItems) {
        const mapping = await tx.productMapping.findUnique({
          where: { id: item.productMappingId },
        });

        if (mapping?.syncStock) {
          await tx.product.update({
            where: { id: mapping.productId },
            data: {
              stockQuantity: {
                decrement: item.quantity,
              },
            },
          });
        }
      }
    });

    return {
      success: true,
      message: `Order ${orderNumber} created successfully`,
    };
  }

  /**
   * Sipariş güncelleme webhook'unu işle
   */
  private static async handleOrderUpdate(
    marketplaceId: string,
    payload: any
  ): Promise<{ success: boolean; message: string }> {
    const orderNumber = payload.orderNumber || payload.orderId;
    const newStatus = payload.status;

    const order = await prisma.order.findUnique({
      where: { marketplaceOrderId: orderNumber },
    });

    if (!order) {
      return {
        success: true,
        message: 'Order not found - ignoring update',
      };
    }

    // ✅ FIX: Status değişikliği iptal ise, handleOrderCancellation'a yönlendir
    const mappedStatus = this.mapOrderStatus(newStatus);
    if (mappedStatus === 'CANCELLED' && order.status !== 'CANCELLED') {
      console.log(`🔀 Status update to CANCELLED detected, routing to handleOrderCancellation`);
      return await this.handleOrderCancellation(marketplaceId, payload);
    }

    // Sipariş durumunu güncelle
    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: mappedStatus,
      },
    });

    return {
      success: true,
      message: `Order ${orderNumber} updated to ${newStatus}`,
    };
  }

  /**
   * Sipariş iptali webhook'unu işle
   */
  private static async handleOrderCancellation(
    marketplaceId: string,
    payload: any
  ): Promise<{ success: boolean; message: string }> {
    const orderNumber = payload.orderNumber || payload.orderId;

    const order = await prisma.order.findUnique({
      where: { marketplaceOrderId: orderNumber },
      include: {
        items: {
          include: {
            productMapping: true,
          },
        },
      },
    });

    if (!order) {
      return {
        success: true,
        message: 'Order not found - ignoring cancellation',
      };
    }

    // ✅ FIX: Zaten iptal edilmiş siparişler için duplicate refund'u engelle
    if (order.status === 'CANCELLED' || order.status === 'REFUNDED') {
      console.log(`⚠️ Order ${orderNumber} already cancelled (status: ${order.status}) - skipping stock refund`);
      return {
        success: true,
        message: `Order ${orderNumber} already cancelled`,
      };
    }

    // Stokları geri yükle ve siparişi iptal et
    await prisma.$transaction(async (tx) => {
      for (const item of order.items) {
        if (item.productMapping.syncStock) {
          await tx.product.update({
            where: { id: item.productMapping.productId },
            data: {
              stockQuantity: {
                increment: item.quantity,
              },
            },
          });
          console.log(`📈 Stock refunded: ${item.productMapping.productId} +${item.quantity}`);
        }
      }

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'CANCELLED' },
      });
    });

    return {
      success: true,
      message: `Order ${orderNumber} cancelled and stock restored`,
    };
  }

  /**
   * Stok güncelleme webhook'unu işle
   */
  private static async handleStockUpdate(
    marketplaceId: string,
    payload: any
  ): Promise<{ success: boolean; message: string }> {
    // Bu genellikle pazaryerinden gelen stok güncellemeleri için
    // Şu an için ignore ediyoruz çünkü biz stok master'ız
    return {
      success: true,
      message: 'Stock update from marketplace ignored',
    };
  }

  /**
   * Pazaryeri durumunu sistem durumuna çevir
   */
  private static mapOrderStatus(status: string): any {
    const statusMap: Record<string, string> = {
      'Created': 'PENDING',
      'Approved': 'PROCESSING',
      'Shipped': 'SHIPPED',
      'Delivered': 'DELIVERED',
      'Cancelled': 'CANCELLED',
      'Returned': 'REFUNDED',
    };

    return statusMap[status] || 'PENDING';
  }
}
