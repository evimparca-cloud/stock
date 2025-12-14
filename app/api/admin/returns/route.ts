/**
 * İade Yönetimi API - Trendyol'dan Gerçek Veriler
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// GET - İade paketlerini Trendyol'dan çek
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const page = parseInt(url.searchParams.get('page') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '20'); // 20 iade per sayfa

    // Trendyol pazaryerini bul
    const trendyol = await prisma.marketplace.findFirst({
      where: { name: 'Trendyol' }
    });

    if (!trendyol || !trendyol.apiKey || !trendyol.apiSecret || !trendyol.supplierId) {
      return NextResponse.json({ 
        error: 'Trendyol API bilgileri eksik',
        returns: [],
        pagination: { page: 0, limit, total: 0, pages: 0 }
      });
    }

    // Trendyol API'den iadeleri çek
    const auth = Buffer.from(`${trendyol.apiKey}:${trendyol.apiSecret}`).toString('base64');
    const headers = {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'User-Agent': 'StockManagementSystem/1.0',
    };

    // Durum filtresi parametresi
    const statusParam = status && status !== 'all' ? `&claimItemStatus=${status}` : '';
    
    // Önce toplam eleman sayısını öğrenmek için bir istek yap (durum filtresi dahil)
    const countUrl = `https://apigw.trendyol.com/integration/order/sellers/${trendyol.supplierId}/claims?page=0&size=1${statusParam}`;
    const countResponse = await fetch(countUrl, { method: 'GET', headers });
    const countData = await countResponse.json();
    const totalElements = countData.totalElements || 0;
    
    // Doğru sayfa hesaplaması: toplam eleman / sayfa başına eleman
    const calculatedTotalPages = Math.ceil(totalElements / limit);
    
    // Yeniden eskiye sıralama: Son sayfadan başla
    // Kullanıcı sayfa 0 isterse, API'nin son sayfasını çek
    const reversedPage = Math.max(0, calculatedTotalPages - 1 - page);
    
    console.log(`📊 Durum: ${status || 'all'}, Toplam: ${totalElements} iade, ${calculatedTotalPages} sayfa, İstenen: ${page}, API Sayfa: ${reversedPage}`);
    
    // Ana veri isteği
    let apiUrl = `https://apigw.trendyol.com/integration/order/sellers/${trendyol.supplierId}/claims?page=${reversedPage}&size=${limit}${statusParam}`;

    console.log('🔍 Trendyol iade API çağrılıyor:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: headers,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Trendyol API hatası:', response.status, errorText);
      return NextResponse.json({ 
        error: `Trendyol API hatası: ${response.status}`,
        returns: [],
        pagination: { page: 0, limit, total: 0, pages: 0 }
      });
    }

    const data = await response.json();
    // Yeniden eskiye sıralama için ters çevir
    const claims = (data.content || []).sort((a: any, b: any) => {
      return new Date(b.claimDate).getTime() - new Date(a.claimDate).getTime();
    });
    
    console.log(`✅ ${claims.length} iade paketi çekildi (Toplam: ${data.totalElements})`);

    // Veriyi formatla
    const formattedReturns = claims.map((claim: any) => {
      // İade kalemlerini düzleştir
      const items = (claim.items || []).flatMap((item: any) => 
        (item.claimItems || []).map((claimItem: any) => ({
          id: claimItem.id,
          productName: item.orderLine?.productName || 'Bilinmeyen Ürün',
          barcode: item.orderLine?.barcode,
          productColor: item.orderLine?.productColor,
          productSize: item.orderLine?.productSize,
          price: item.orderLine?.price || 0,
          customerReason: claimItem.customerClaimItemReason?.name || 'Belirtilmemiş',
          status: claimItem.claimItemStatus?.name || 'Unknown',
          customerNote: claimItem.customerNote,
          sku: item.orderLine?.merchantSku,
        }))
      );

      return {
        id: claim.id,
        claimId: claim.id,
        orderNumber: claim.orderNumber,
        customerName: `${claim.customerFirstName || ''} ${claim.customerLastName || ''}`.trim() || 'Bilinmeyen',
        claimDate: new Date(claim.claimDate).toISOString(),
        status: items[0]?.status || 'Unknown',
        marketplace: 'Trendyol',
        cargoTrackingNumber: claim.cargoTrackingNumber?.toString(),
        cargoProvider: claim.cargoProviderName,
        totalAmount: items.reduce((sum: number, item: any) => sum + (Number(item.price) || 0), 0),
        items: items,
      };
    });

    return NextResponse.json({
      returns: formattedReturns,
      pagination: {
        page,
        limit,
        total: totalElements,
        pages: calculatedTotalPages,
      }
    });

  } catch (error) {
    console.error('Get returns error:', error);
    return NextResponse.json({ error: 'Failed to get returns' }, { status: 500 });
  }
}

// POST - İade paketlerini Trendyol'dan çek
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Cron job'ı tetikle
    const cronResponse = await fetch('http://localhost:3001/api/cron/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId: 'process-returns' }),
    });

    if (!cronResponse.ok) {
      return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
    }

    const result = await cronResponse.json();
    return NextResponse.json({ success: true, result });

  } catch (error) {
    console.error('Sync returns error:', error);
    return NextResponse.json({ error: 'Failed to sync returns' }, { status: 500 });
  }
}
