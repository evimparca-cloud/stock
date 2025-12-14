import { prisma } from '@/lib/prisma';

/**
 * Eski webhook loglarını temizle (30 günden eski)
 */
export async function cleanupOldLogs() {
  console.log('🧹 Cleaning up old webhook logs...');

  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Eski logları sil
    const result = await prisma.webhookLog.deleteMany({
      where: {
        createdAt: {
          lt: thirtyDaysAgo,
        },
      },
    });

    console.log(`✅ Deleted ${result.count} old webhook logs`);

    return {
      deleted: result.count,
      olderThan: thirtyDaysAgo,
    };
  } catch (error) {
    console.error('❌ Log cleanup failed:', error);
    throw error;
  }
}
