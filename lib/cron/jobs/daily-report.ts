import { prisma } from '@/lib/prisma';

/**
 * Günlük özet rapor oluştur
 */
export async function generateDailyReport() {
  console.log('📊 Generating daily report...');

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Bugünün siparişleri
    const todaysOrders = await prisma.order.findMany({
      where: {
        orderDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        marketplace: true,
        items: true,
      },
    });

    // Bugünün toplam geliri
    const totalRevenue = todaysOrders.reduce(
      (sum, order) => sum + parseFloat(order.totalAmount.toString()),
      0
    );

    // Pazaryeri bazında sipariş sayıları
    const ordersByMarketplace = todaysOrders.reduce((acc, order) => {
      const name = order.marketplace.name;
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Durum bazında sipariş sayıları
    const ordersByStatus = todaysOrders.reduce((acc, order) => {
      acc[order.status] = (acc[order.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Toplam ürün sayısı
    const totalProducts = await prisma.product.count();

    // Düşük stoklu ürün sayısı
    const lowStockCount = await prisma.product.count({
      where: {
        stockQuantity: {
          lt: 10,
        },
      },
    });

    // Bugünün webhook'ları
    const todaysWebhooks = await prisma.webhookLog.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    const successfulWebhooks = await prisma.webhookLog.count({
      where: {
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
        status: 'SUCCESS',
      },
    });

    const report = {
      date: today.toISOString().split('T')[0],
      orders: {
        total: todaysOrders.length,
        revenue: totalRevenue,
        byMarketplace: ordersByMarketplace,
        byStatus: ordersByStatus,
      },
      inventory: {
        totalProducts,
        lowStockCount,
      },
      webhooks: {
        total: todaysWebhooks,
        successful: successfulWebhooks,
        successRate: todaysWebhooks > 0 
          ? ((successfulWebhooks / todaysWebhooks) * 100).toFixed(2) + '%'
          : 'N/A',
      },
    };

    console.log('📊 Daily Report:');
    console.log(`  Date: ${report.date}`);
    console.log(`  Orders: ${report.orders.total} (₺${report.orders.revenue.toFixed(2)})`);
    console.log(`  Products: ${report.inventory.totalProducts} (${report.inventory.lowStockCount} low stock)`);
    console.log(`  Webhooks: ${report.webhooks.total} (${report.webhooks.successRate} success rate)`);

    // TODO: Burada email ile rapor gönderilebilir
    // await sendDailyReportEmail(report);

    return report;
  } catch (error) {
    console.error('❌ Daily report generation failed:', error);
    throw error;
  }
}
