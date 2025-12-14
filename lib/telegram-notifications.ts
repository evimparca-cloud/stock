
/**
 * Telegram Bildirim Servisi
 * Sipariş ve stok bildirimleri için
 */
import fs from 'fs';
import path from 'path';

interface TelegramMessage {
  text: string;
  parse_mode?: 'HTML' | 'Markdown';
  disable_web_page_preview?: boolean;
}

interface OrderNotification {
  orderId: string;
  orderNumber: string;
  marketplace: string;
  totalAmount: number;
  customerName: string;
  customerCity?: string;
  customerPhone?: string;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
    newStock?: number;
    oldStock?: number;
  }>;
  orderDate: Date;
  status: string;
}

interface StockAlert {
  productName: string;
  sku: string;
  currentStock: number;
  criticalLevel: number;
  marketplace?: string;
}

export class TelegramNotificationService {
  private botToken: string;
  private chatId: string;
  private baseUrl: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    this.baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

    // If env vars are empty, try validation from settings file
    this.loadFromSettings();
  }

  private loadFromSettings() {
    try {
      if (this.botToken && this.chatId) return;

      const settingsPath = path.join(process.cwd(), 'data', 'notification-settings.json');
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        const settings = JSON.parse(raw);
        
        if (settings.telegram?.botToken && settings.telegram.botToken !== '••••••••') {
          this.botToken = settings.telegram.botToken;
        }
        if (settings.telegram?.chatId) {
          this.chatId = settings.telegram.chatId;
        }
        // console.log('✅ Loaded Telegram config from settings file');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  private isConfigured(): boolean {
    // Reload settings if not configured (in case they changed)
    if (!this.botToken || !this.chatId) {
       this.loadFromSettings();
    }
    return !!(this.botToken && this.chatId);
  }

  private async sendMessage(message: TelegramMessage): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log('📱 Telegram yapılandırılmadı, bildirim atlanıyor');
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.chatId,
          text: message.text,
          parse_mode: message.parse_mode || 'HTML',
          disable_web_page_preview: message.disable_web_page_preview ?? true,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('❌ Telegram API hatası:', error);
        return false;
      }

      console.log('✅ Telegram bildirimi gönderildi');
      return true;
    } catch (error) {
      console.error('❌ Telegram bildirim hatası:', error);
      return false;
    }
  }

  /**
   * Yeni sipariş bildirimi
   */
  async notifyNewOrder(order: OrderNotification): Promise<boolean> {
    const stockWarnings = order.items
      .filter(item => item.newStock !== undefined && item.newStock <= 5)
      .map(item => `• ${item.productName}: ${item.oldStock} → ${item.newStock} adet kaldı`)
      .join('\n');

    const itemsList = order.items
      .map(item => `• ${item.productName} x${item.quantity} (₺${item.price.toFixed(2)})`)
      .join('\n');

    const message = `🛒 <b>YENİ SİPARİŞ ALINDI!</b>

📦 <b>Sipariş:</b> #${order.orderNumber}
🏪 <b>Pazaryeri:</b> ${order.marketplace}
💰 <b>Tutar:</b> ₺${order.totalAmount.toFixed(2)}
📅 <b>Tarih:</b> ${order.orderDate.toLocaleString('tr-TR')}

📋 <b>Ürünler:</b>
${itemsList}

👤 <b>Müşteri:</b> ${order.customerName}${order.customerCity ? `\n📍 <b>İl:</b> ${order.customerCity}` : ''}${order.customerPhone ? `\n📞 <b>Tel:</b> ${this.maskPhone(order.customerPhone)}` : ''}

${stockWarnings ? `⚠️ <b>Stok Uyarısı:</b>\n${stockWarnings}\n\n` : ''}🔗 <a href="${this.baseUrl}/orders">Detayları Görüntüle</a>`;

    return this.sendMessage({ text: message });
  }

  /**
   * Sipariş iptal bildirimi
   */
  async notifyOrderCancellation(order: {
    orderNumber: string;
    marketplace: string;
    totalAmount: number;
    customerName: string;
    orderDate: Date;
  }): Promise<boolean> {
    const message = `❌ <b>SİPARİŞ İPTAL EDİLDİ!</b>

📦 <b>Sipariş:</b> #${order.orderNumber}
🏪 <b>Pazaryeri:</b> ${order.marketplace}
💰 <b>Tutar:</b> ₺${order.totalAmount.toFixed(2)}
📅 <b>Tarih:</b> ${order.orderDate.toLocaleString('tr-TR')}

👤 <b>Müşteri:</b> ${order.customerName}

⚠️ <b>Durum:</b> İptal Edildi

🔗 <a href="${this.baseUrl}/orders">Detayları Görüntüle</a>`;

    return this.sendMessage({ text: message });
  }

  /**
   * Sipariş durumu değişiklik bildirimi
   */
  async notifyOrderStatusChange(
    orderNumber: string,
    marketplace: string,
    oldStatus: string,
    newStatus: string,
    customerName: string
  ): Promise<boolean> {
    const statusEmojis: { [key: string]: string } = {
      'PENDING': '⏳',
      'PROCESSING': '🔄',
      'SHIPPED': '🚚',
      'DELIVERED': '✅',
      'CANCELLED': '❌',
      'RETURNED': '↩️'
    };

    const statusNames: { [key: string]: string } = {
      'PENDING': 'Bekliyor',
      'PROCESSING': 'İşleniyor',
      'SHIPPED': 'Kargoda',
      'DELIVERED': 'Teslim Edildi',
      'CANCELLED': 'İptal Edildi',
      'RETURNED': 'İade Edildi'
    };

    const message = `${statusEmojis[newStatus] || '📦'} <b>SİPARİŞ DURUMU DEĞİŞTİ</b>

📦 <b>Sipariş:</b> #${orderNumber}
🏪 <b>Pazaryeri:</b> ${marketplace}
👤 <b>Müşteri:</b> ${customerName}

📊 <b>Durum Değişikliği:</b>
${statusEmojis[oldStatus] || '📦'} ${statusNames[oldStatus] || oldStatus} → ${statusEmojis[newStatus] || '📦'} ${statusNames[newStatus] || newStatus}

🔗 <a href="${this.baseUrl}/orders">Detayları Görüntüle</a>`;

    return this.sendMessage({ text: message });
  }

  /**
   * Kritik stok uyarısı
   */
  async notifyLowStock(alerts: StockAlert[]): Promise<boolean> {
    if (alerts.length === 0) return true;

    const alertsList = alerts
      .map(alert => `• ${alert.productName} (${alert.sku}): ${alert.currentStock} adet${alert.marketplace ? ` - ${alert.marketplace}` : ''}`)
      .join('\n');

    const message = `⚠️ <b>KRİTİK STOK UYARISI!</b>

📦 <b>Stok Seviyesi Düşük Ürünler:</b>
${alertsList}

🔄 <b>Önerilen Aksiyonlar:</b>
• Tedarikçilerle iletişime geçin
• Stok siparişi verin
• Ürünleri pazaryerlerinde pasif hale getirin

🔗 <a href="${this.baseUrl}/products">Ürünleri Yönet</a>`;

    return this.sendMessage({ text: message });
  }

  /**
   * Günlük özet bildirimi
   */
  async notifyDailySummary(stats: {
    newOrders: number;
    totalRevenue: number;
    topProducts: Array<{ name: string; quantity: number }>;
    lowStockCount: number;
  }): Promise<boolean> {
    const topProductsList = stats.topProducts
      .slice(0, 3)
      .map((product, index) => `${index + 1}. ${product.name} (${product.quantity} adet)`)
      .join('\n');

    const message = `📊 <b>GÜNLÜK ÖZET</b>
📅 ${new Date().toLocaleDateString('tr-TR')}

🛒 <b>Yeni Siparişler:</b> ${stats.newOrders} adet
💰 <b>Toplam Ciro:</b> ₺${stats.totalRevenue.toFixed(2)}

🏆 <b>En Çok Satan Ürünler:</b>
${topProductsList || 'Veri yok'}

${stats.lowStockCount > 0 ? `⚠️ <b>Düşük Stok:</b> ${stats.lowStockCount} ürün\n\n` : ''}🔗 <a href="${this.baseUrl}/dashboard">Dashboard</a>`;

    return this.sendMessage({ text: message });
  }

  /**
   * İade paketi bildirimi
   */
  async notifyReturnPackage(returnData: {
    claimId: string;
    orderNumber: string;
    marketplace: string;
    customerName: string;
    claimDate: Date;
    status: string;
    items: Array<{
      productName: string;
      reason: string;
      quantity?: number;
    }>;
    cargoTrackingNumber?: string;
  }): Promise<boolean> {
    const statusEmojis: { [key: string]: string } = {
      'CREATED': '🆕',
      'WAITING_IN_ACTION': '⏳',
      'ACCEPTED': '✅',
      'REJECTED': '❌',
      'CANCELLED': '🚫',
      'UNRESOLVED': '⚠️',
      'IN_ANALYSIS': '🔍',
    };

    const statusEmoji = statusEmojis[returnData.status] || '📦';
    
    // Ürün listesi
    const itemsList = returnData.items
      .map(item => `• ${item.productName}${item.quantity ? ` x${item.quantity}` : ''}\n  Sebep: ${item.reason}`)
      .join('\n');

    const message = `${statusEmoji} <b>İADE PAKETİ</b>

📦 <b>İade ID:</b> ${returnData.claimId}
📋 <b>Sipariş:</b> #${returnData.orderNumber}
🏪 <b>Pazaryeri:</b> ${returnData.marketplace}
📅 <b>İade Tarihi:</b> ${returnData.claimDate.toLocaleString('tr-TR')}

👤 <b>Müşteri:</b> ${returnData.customerName}
📊 <b>Durum:</b> ${returnData.status}

📋 <b>İade Edilen Ürünler:</b>
${itemsList}

${returnData.cargoTrackingNumber ? `🚚 <b>Kargo Takip:</b> ${returnData.cargoTrackingNumber}\n\n` : ''}🔗 <a href="${this.baseUrl}/returns">İade Yönetimi</a>`;

    return this.sendMessage({ text: message });
  }

  /**
   * Sistem hatası bildirimi
   */
  async notifySystemError(error: string, context: string): Promise<boolean> {
    const message = `🚨 <b>SİSTEM HATASI!</b>

⚠️ <b>Hata:</b> ${error}
📍 <b>Konum:</b> ${context}
📅 <b>Zaman:</b> ${new Date().toLocaleString('tr-TR')}

🔧 <b>Önerilen Aksiyonlar:</b>
• Sistem loglarını kontrol edin
• Gerekirse manuel müdahale yapın
• Pazaryeri bağlantılarını test edin

🔗 <a href="${this.baseUrl}/system">Sistem Yönetimi</a>`;

    return this.sendMessage({ text: message });
  }

  /**
   * Admin login bildirimi
   */
  async notifyAdminLogin(email: string, ip?: string): Promise<boolean> {
    if (!this.isConfigured()) return false;

    const now = new Date();
    const timeStr = now.toLocaleString('tr-TR', { 
      timeZone: 'Europe/Istanbul',
      dateStyle: 'short',
      timeStyle: 'short'
    });

    const message = `🔐 <b>Admin Giriş Bildirimi</b>

👤 <b>Kullanıcı:</b> ${email}
🕐 <b>Tarih:</b> ${timeStr}
${ip ? `🌐 <b>IP:</b> ${ip}` : ''}

🔗 <a href="${this.baseUrl}/dashboard">Dashboard'a Git</a>`;

    return this.sendMessage({ text: message });
  }

  /**
   * Telefon numarasını maskele
   */
  private maskPhone(phone: string): string {
    if (phone.length < 7) return phone;
    const start = phone.slice(0, 4);
    const end = phone.slice(-4);
    const middle = '*'.repeat(phone.length - 8);
    return `${start}${middle}${end}`;
  }
}

// Singleton instance
export const telegramNotifications = new TelegramNotificationService();
