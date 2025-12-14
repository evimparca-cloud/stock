/**
 * Telegram Bağlantı Testi API
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { botToken, chatId, type } = body;

    // .env'den token al - type parametresi geldiyse veya maskeli geldiyse
    const token = (!botToken || botToken === '••••••••') ? process.env.TELEGRAM_BOT_TOKEN : botToken;
    const chat = chatId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chat) {
      return NextResponse.json({
        success: false,
        error: 'Bot Token ve Chat ID gerekli. Environment değişkenlerini kontrol edin.'
      });
    }

    // Test tiplerine göre farklı mesajlar
    const testMessages: Record<string, string> = {
      newOrder: `🛍️ <b>YENİ SİPARİŞ - TEST</b>\n\n📦 Sipariş: #TEST12345\n🏪 Pazaryeri: Trendyol\n💰 Tutar: ₺250.00\n\n🧪 Bu bir test bildirimidir.`,
      orderStatusChange: `🔄 <b>SİPARİŞ DURUMU DEĞİŞTİ - TEST</b>\n\n📦 Sipariş: #TEST12345\n📍 Yeni Durum: Kargoya Verildi\n\n🧪 Bu bir test bildirimidir.`,
      lowStock: `⚠️ <b>DÜŞÜK STOK UYARISI - TEST</b>\n\n📦 Ürün: Test Ürünü\n📊 Kalan Stok: 3 adet\n\n🧪 Bu bir test bildirimidir.`,
      dailySummary: `📊 <b>GÜNLÜK ÖZET - TEST</b>\n\n💰 Bugünkü Ciro: ₺5,250\n🛒 Sipariş Sayısı: 15\n📦 Kargolanacak: 8\n\n🧪 Bu bir test bildirimidir.`,
    };

    const message = type && testMessages[type]
      ? testMessages[type]
      : `✅ <b>Bağlantı Testi Başarılı!</b>\n\n📱 Telegram bildirimleri aktif.\n🕐 ${new Date().toLocaleString('tr-TR')}\n\nBu mesajı görüyorsanız, bildirim sistemi doğru çalışıyor.`;

    const url = `https://api.telegram.org/bot${token}/sendMessage`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chat,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const result = await response.json();

    if (result.ok) {
      return NextResponse.json({ success: true, message: 'Test bildirimi gönderildi' });
    } else {
      return NextResponse.json({
        success: false,
        error: result.description || 'Telegram API hatası'
      });
    }
  } catch (error) {
    console.error('Telegram test error:', error);
    return NextResponse.json({
      success: false,
      error: 'Bağlantı hatası'
    }, { status: 500 });
  }
}
