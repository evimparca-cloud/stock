import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TrendyolService } from '@/lib/marketplace/trendyol';
import { requireAdmin } from '@/lib/auth-helper';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const searchParams = request.nextUrl.searchParams;
    const marketplaceId = searchParams.get('marketplaceId');
    const status = searchParams.get('status') || 'Created';
    const page = parseInt(searchParams.get('page') || '0');
    const size = parseInt(searchParams.get('size') || '50');
    const orderNumber = searchParams.get('orderNumber') || undefined;
    
    // Tarih parametreleri (timestamp)
    const startDate = searchParams.get('startDate') 
      ? parseInt(searchParams.get('startDate')!) 
      : undefined;
    const endDate = searchParams.get('endDate') 
      ? parseInt(searchParams.get('endDate')!) 
      : undefined;

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

    // Check if Trendyol API credentials are available
    if (!marketplace.apiKey || !marketplace.apiSecret || !marketplace.supplierId) {
      // Return mock data for testing when credentials are missing
      console.log('⚠️ Trendyol API credentials missing, returning mock data');
      return NextResponse.json({
        success: true,
        data: {
          content: [],
          totalElements: 0,
          totalPages: 0,
          size: size,
          number: page,
          first: true,
          last: true,
          numberOfElements: 0,
        },
        message: 'Trendyol API anahtarları eksik - test verisi döndürülüyor'
      });
    }

    const trendyolService = new TrendyolService({
      apiKey: marketplace.apiKey,
      apiSecret: marketplace.apiSecret,
      supplierId: marketplace.supplierId,
    });

    // Trendyol servisinden paketleri çek
    const result = await trendyolService.getShipmentPackages({
      status,
      page,
      size,
      orderNumber,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error('Shipment packages fetch error:', error);
    
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
