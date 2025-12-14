import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TrendyolService } from '@/lib/marketplace/trendyol';
import { requireAdmin } from '@/lib/auth-check';

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
  } catch (error) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { marketplaceId, packageId, status, lines, invoiceNumber } = body;

    if (!marketplaceId || !packageId || !status || !lines) {
      return NextResponse.json(
        { success: false, error: 'Eksik parametreler' },
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

    const result = await trendyolService.updatePackageStatus({
      packageId,
      status,
      lines,
      invoiceNumber,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Update package error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Bilinmeyen hata',
      },
      { status: 500 }
    );
  }
}
