import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { MarketplaceFactory } from '@/lib/marketplace/factory';
import { requireAdmin } from '@/lib/auth-helper';

// POST /api/sync/test - Pazaryeri bağlantısını test et
export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { marketplaceId } = body;

    if (!marketplaceId) {
      return NextResponse.json(
        { error: 'marketplaceId gerekli' },
        { status: 400 }
      );
    }

    // Pazaryeri bilgilerini al
    const marketplace = await prisma.marketplace.findUnique({
      where: { id: marketplaceId },
    });

    if (!marketplace) {
      return NextResponse.json(
        { error: 'Pazaryeri bulunamadı' },
        { status: 404 }
      );
    }

    if (!marketplace.apiKey || !marketplace.apiSecret) {
      return NextResponse.json({
        success: false,
        message: 'API bilgileri eksik',
        marketplace: marketplace.name,
      });
    }

    // supplierId kontrolü
    if (!marketplace.supplierId && marketplace.name === 'Trendyol') {
      return NextResponse.json({
        success: false,
        message: 'Supplier ID (Satıcı ID) girilmemiş!',
        error: 'Pazaryeri ayarlarından Supplier ID ekleyin. Trendyol Satıcı Paneli > Hesap Bilgilerim bölümünden bulabilirsiniz.',
        marketplace: marketplace.name,
      });
    }

    // Real API test enabled

    // Marketplace service oluştur
    try {
      const service = MarketplaceFactory.createService(marketplace.name, {
        apiKey: marketplace.apiKey,
        apiSecret: marketplace.apiSecret,
        supplierId: marketplace.supplierId || undefined,
      });

      // Bağlantıyı test et
      const isConnected = await service.testConnection();

      return NextResponse.json({
        success: isConnected,
        message: isConnected 
          ? '✅ Bağlantı başarılı! API bilgileri doğru.' 
          : '❌ Bağlantı başarısız - API bilgilerini kontrol edin',
        marketplace: marketplace.name,
      });
    } catch (error) {
      return NextResponse.json({
        success: false,
        message: '❌ Bağlantı başarısız',
        error: error instanceof Error ? error.message : 'Desteklenmeyen pazaryeri veya bilinmeyen hata',
        marketplace: marketplace.name,
      });
    }
  } catch (error: any) {
    console.error('Connection test error:', error);
    
    // Check if it's an authentication error
    if (error.message === 'Authentication required' || error.message === 'Admin access required') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    
    return NextResponse.json(
      {
        success: false,
        error: 'Bağlantı testi başarısız',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
