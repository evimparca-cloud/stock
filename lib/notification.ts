/**
 * Kritik Olay Bildirim Sistemi
 * Discord ve Telegram webhook entegrasyonu
 * Zero-Trust Security için anlık uyarılar
 */

import { prisma } from './prisma';

// Bildirim tipleri
export type NotificationType =
  | 'LOGIN_FAILED_MULTIPLE'
  | 'SECURITY_BREACH'
  | 'SYSTEM_ERROR'
  | 'ADMIN_ACTION'
  | 'DATABASE_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'ORDER_STATUS_CHANGE';


interface NotificationPayload {
  type: NotificationType;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
  timestamp?: Date;
}

// Renk kodları (Discord embed için)
const SEVERITY_COLORS = {
  low: 0x3498db,      // Mavi
  medium: 0xf39c12,   // Turuncu
  high: 0xe74c3c,     // Kırmızı
  critical: 0x8e44ad, // Mor
};

// Emoji'ler
const SEVERITY_EMOJIS = {
  low: 'ℹ️',
  medium: '⚠️',
  high: '🚨',
  critical: '🔴',
};

/**
 * Discord Webhook ile bildirim gönder
 */
export async function sendDiscordNotification(payload: NotificationPayload): Promise<boolean> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn('⚠️ DISCORD_WEBHOOK_URL tanımlanmamış');
    return false;
  }

  try {
    const timestamp = payload.timestamp || new Date();

    const discordPayload = {
      username: 'Stock Manager Security',
      avatar_url: 'https://cdn-icons-png.flaticon.com/512/2716/2716607.png',
      embeds: [
        {
          title: `${SEVERITY_EMOJIS[payload.severity]} ${payload.title}`,
          description: payload.message,
          color: SEVERITY_COLORS[payload.severity],
          fields: [
            {
              name: '📊 Tip',
              value: payload.type,
              inline: true,
            },
            {
              name: '⏰ Zaman',
              value: timestamp.toLocaleString('tr-TR'),
              inline: true,
            },
            {
              name: '🔥 Önem Derecesi',
              value: payload.severity.toUpperCase(),
              inline: true,
            },
            ...(payload.metadata ? [
              {
                name: '📋 Detaylar',
                value: '```json\n' + JSON.stringify(payload.metadata, null, 2).substring(0, 1000) + '\n```',
                inline: false,
              }
            ] : []),
          ],
          footer: {
            text: 'Stock Management Security System',
          },
          timestamp: timestamp.toISOString(),
        },
      ],
    };

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      console.error('Discord webhook hatası:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Discord bildirim hatası:', error);
    return false;
  }
}

/**
 * Telegram Bot ile bildirim gönder
 */
export async function sendTelegramNotification(payload: NotificationPayload): Promise<boolean> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn('⚠️ TELEGRAM_BOT_TOKEN veya TELEGRAM_CHAT_ID tanımlanmamış');
    return false;
  }

  try {
    const timestamp = payload.timestamp || new Date();

    // Telegram mesaj formatı (Markdown)
    const message = `
${SEVERITY_EMOJIS[payload.severity]} *${payload.title}*

📝 ${payload.message}

📊 *Tip:* \`${payload.type}\`
⏰ *Zaman:* ${timestamp.toLocaleString('tr-TR')}
🔥 *Önem:* ${payload.severity.toUpperCase()}
${payload.metadata ? `\n📋 *Detaylar:*\n\`\`\`\n${JSON.stringify(payload.metadata, null, 2).substring(0, 500)}\n\`\`\`` : ''}

_Stock Management Security System_
    `.trim();

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      console.error('Telegram webhook hatası:', response.statusText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Telegram bildirim hatası:', error);
    return false;
  }
}

/**
 * Tüm kanallara bildirim gönder
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  // Her iki kanala paralel gönder
  await Promise.allSettled([
    sendDiscordNotification(payload),
    sendTelegramNotification(payload),
  ]);

  // Kritik bildirimleri veritabanına da kaydet
  if (payload.severity === 'high' || payload.severity === 'critical') {
    try {
      await prisma.auditLog.create({
        data: {
          action: `NOTIFICATION_${payload.type}`,
          ipAddress: 'SYSTEM',
          userAgent: 'Security Notification System',
          success: true,
          details: {
            title: payload.title,
            message: payload.message,
            severity: payload.severity,
            metadata: payload.metadata,
          },
        },
      });
    } catch (error) {
      console.error('Bildirim audit log hatası:', error);
    }
  }
}

/**
 * Başarısız giriş sayacı ve bildirim
 * 5 başarısız denemede uyarı gönderir
 */
const failedLoginAttempts = new Map<string, { count: number; lastAttempt: Date }>();

export async function trackFailedLogin(ipAddress: string, email: string): Promise<void> {
  const key = `${ipAddress}:${email}`;
  const now = new Date();

  // Mevcut kayıt
  const existing = failedLoginAttempts.get(key);

  if (existing) {
    // 15 dakika içinde mi?
    const timeDiff = now.getTime() - existing.lastAttempt.getTime();
    if (timeDiff < 15 * 60 * 1000) {
      existing.count++;
      existing.lastAttempt = now;

      // 5 başarısız deneme = uyarı
      if (existing.count === 5) {
        await sendNotification({
          type: 'LOGIN_FAILED_MULTIPLE',
          title: '🚨 Çoklu Başarısız Giriş Denemesi',
          message: `Aynı IP'den peş peşe 5 başarısız giriş denemesi tespit edildi!`,
          severity: 'high',
          metadata: {
            ipAddress,
            email,
            attemptCount: existing.count,
            firstAttempt: new Date(now.getTime() - timeDiff).toISOString(),
            lastAttempt: now.toISOString(),
          },
        });
      }

      // 10+ deneme = kritik
      if (existing.count >= 10) {
        await sendNotification({
          type: 'SECURITY_BREACH',
          title: '🔴 OLASI BRUTE FORCE SALDIRISI',
          message: `IP adresi engellenmeli! ${existing.count} başarısız deneme.`,
          severity: 'critical',
          metadata: {
            ipAddress,
            email,
            attemptCount: existing.count,
          },
        });
      }
    } else {
      // 15 dakika geçmiş, sıfırla
      failedLoginAttempts.set(key, { count: 1, lastAttempt: now });
    }
  } else {
    failedLoginAttempts.set(key, { count: 1, lastAttempt: now });
  }
}

/**
 * Başarılı girişte sayacı sıfırla
 */
export function clearFailedLoginAttempts(ipAddress: string, email: string): void {
  const key = `${ipAddress}:${email}`;
  failedLoginAttempts.delete(key);
}

/**
 * Sistem hatası bildirimi
 */
export async function notifySystemError(error: Error, context?: string): Promise<void> {
  await sendNotification({
    type: 'SYSTEM_ERROR',
    title: '⚠️ Sistem Hatası',
    message: `Uygulamada kritik bir hata oluştu: ${error.message}`,
    severity: 'high',
    metadata: {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack?.substring(0, 500),
      context,
    },
  });
}

/**
 * Veritabanı hatası bildirimi
 */
export async function notifyDatabaseError(operation: string, error: Error): Promise<void> {
  await sendNotification({
    type: 'DATABASE_ERROR',
    title: '🗄️ Veritabanı Hatası',
    message: `Veritabanı işlemi başarısız: ${operation}`,
    severity: 'critical',
    metadata: {
      operation,
      errorMessage: error.message,
    },
  });
}

/**
 * Admin işlemi bildirimi
 */
export async function notifyAdminAction(
  userId: string,
  action: string,
  resource: string,
  details?: Record<string, any>
): Promise<void> {
  await sendNotification({
    type: 'ADMIN_ACTION',
    title: '👤 Admin İşlemi',
    message: `Admin kullanıcı kritik bir işlem gerçekleştirdi: ${action}`,
    severity: 'medium',
    metadata: {
      userId,
      action,
      resource,
      ...details,
    },
  });
}
