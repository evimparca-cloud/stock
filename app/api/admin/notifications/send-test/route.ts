/**
 * Test Bildirimi Gönderme API
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'notification-settings.json');
const LOGS_FILE = path.join(process.cwd(), 'data', 'notification-logs.json');

async function getSettings() {
  try {
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function addLog(log: any) {
  try {
    await fs.mkdir(path.dirname(LOGS_FILE), { recursive: true });
    let logs = [];
    try {
      const data = await fs.readFile(LOGS_FILE, 'utf-8');
      logs = JSON.parse(data);
    } catch {}
    
    logs.unshift({
      id: Date.now().toString(),
      ...log,
      createdAt: new Date().toISOString(),
    });
    
    // Son 100 log'u tut
    logs = logs.slice(0, 100);
    
    await fs.writeFile(LOGS_FILE, JSON.stringify(logs, null, 2));
  } catch (error) {
    console.error('Log kaydetme hatası:', error);
  }
}

async function sendTelegramMessage(token: string, chatId: string, message: string) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });

  return response.json();
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type } = await request.json();
    
    const settings = await getSettings();
    const token = settings?.telegram?.botToken || process.env.TELEGRAM_BOT_TOKEN;
    const chatId = settings?.telegram?.chatId || process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Telegram yapılandırılmadı' 
      });
    }

    let message = '';
    let logType = '';

    switch (type) {
      case 'newOrder':
        logType = 'Yeni Sipariş';
        message = `🛒 <b>YENİ SİPARİŞ ALINDI!</b> (Test)

📦 <b>Sipariş:</b> #TEST${Math.floor(Math.random() * 100000)}
🏪 <b>Pazaryeri:</b> Trendyol
💰 <b>Tutar:</b> ₺${(Math.random() * 500 + 50).toFixed(2)}
📅 <b>Tarih:</b> ${new Date().toLocaleString('tr-TR')}

📋 <b>Ürünler:</b>
• Test Ürünü x2 (₺127.57)

👤 <b>Müşteri:</b> Test Müşteri
📍 <b>İl:</b> İstanbul

🔗 <a href="http://localhost:3001/orders">Detayları Görüntüle</a>`;
        break;

      case 'orderStatusChange':
        logType = 'Sipariş Durumu Değişikliği';
        message = `🚚 <b>SİPARİŞ DURUMU DEĞİŞTİ</b> (Test)

📦 <b>Sipariş:</b> #TEST${Math.floor(Math.random() * 100000)}
🏪 <b>Pazaryeri:</b> Trendyol
👤 <b>Müşteri:</b> Test Müşteri

📊 <b>Durum Değişikliği:</b>
🔄 İşleniyor → 🚚 Kargoda

🔗 <a href="http://localhost:3001/orders">Detayları Görüntüle</a>`;
        break;

      case 'lowStock':
        logType = 'Düşük Stok Uyarısı';
        message = `⚠️ <b>KRİTİK STOK UYARISI!</b> (Test)

📦 <b>Stok Seviyesi Düşük Ürünler:</b>
• Test Ürünü 1 (SKU001): 3 adet
• Test Ürünü 2 (SKU002): 2 adet
• Test Ürünü 3 (SKU003): 1 adet

🔄 <b>Önerilen Aksiyonlar:</b>
• Tedarikçilerle iletişime geçin
• Stok siparişi verin

🔗 <a href="http://localhost:3001/products">Ürünleri Yönet</a>`;
        break;

      case 'dailySummary':
        logType = 'Günlük Özet';
        message = `📊 <b>GÜNLÜK ÖZET</b> (Test)
📅 ${new Date().toLocaleDateString('tr-TR')}

🛒 <b>Yeni Siparişler:</b> 12 adet
💰 <b>Toplam Ciro:</b> ₺3,456.78

🏆 <b>En Çok Satan Ürünler:</b>
1. Test Ürünü A (15 adet)
2. Test Ürünü B (12 adet)
3. Test Ürünü C (8 adet)

⚠️ <b>Düşük Stok:</b> 5 ürün

🔗 <a href="http://localhost:3001/dashboard">Dashboard</a>`;
        break;

      case 'orderCancellation':
        logType = 'Sipariş İptali';
        message = `❌ <b>SİPARİŞ İPTAL EDİLDİ!</b> (Test)

📦 <b>Sipariş:</b> #TEST${Math.floor(Math.random() * 100000)}
🏪 <b>Pazaryeri:</b> Trendyol
💰 <b>Tutar:</b> ₺${(Math.random() * 500 + 50).toFixed(2)}
📅 <b>Tarih:</b> ${new Date().toLocaleString('tr-TR')}

👤 <b>Müşteri:</b> Test Müşteri

⚠️ <b>Durum:</b> İptal Edildi

🔗 <a href="http://localhost:3001/orders">Detayları Görüntüle</a>`;
        break;

      case 'systemError':
        logType = 'Sistem Hatası';
        message = `🚨 <b>SİSTEM HATASI!</b> (Test)

⚠️ <b>Hata:</b> Test hata mesajı
📍 <b>Konum:</b> Test modülü
📅 <b>Zaman:</b> ${new Date().toLocaleString('tr-TR')}

🔧 <b>Önerilen Aksiyonlar:</b>
• Sistem loglarını kontrol edin
• Gerekirse manuel müdahale yapın

🔗 <a href="http://localhost:3001/system">Sistem Yönetimi</a>`;
        break;

      default:
        return NextResponse.json({ 
          success: false, 
          error: 'Geçersiz bildirim türü' 
        });
    }

    const result = await sendTelegramMessage(token, chatId, message);

    if (result.ok) {
      await addLog({
        type: logType,
        message: message.substring(0, 100) + '...',
        status: 'sent',
      });
      
      return NextResponse.json({ success: true, message: 'Test bildirimi gönderildi' });
    } else {
      await addLog({
        type: logType,
        message: result.description || 'Gönderim hatası',
        status: 'failed',
      });
      
      return NextResponse.json({ 
        success: false, 
        error: result.description || 'Telegram API hatası'
      });
    }
  } catch (error) {
    console.error('Send test notification error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Gönderim hatası' 
    }, { status: 500 });
  }
}
