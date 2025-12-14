/**
 * Telegram 2FA Authentication Helper
 * Telegram üzerinden doğrulama kodu gönderme ve doğrulama
 */

import { prisma } from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

// Helper to get bot token from settings file if env is missing
function getBotToken(): string {
  // 1. Try env var
  if (process.env.TELEGRAM_BOT_TOKEN) return process.env.TELEGRAM_BOT_TOKEN;

  // 2. Try settings file
  try {
    const settingsPath = path.join(process.cwd(), 'data', 'notification-settings.json');
    if (fs.existsSync(settingsPath)) {
      const raw = fs.readFileSync(settingsPath, 'utf-8');
      const settings = JSON.parse(raw);
      if (settings.telegram?.botToken && settings.telegram.botToken !== '••••••••') {
        return settings.telegram.botToken;
      }
    }
  } catch (error) {
    console.error('Failed to read settings file:', error);
  }
  return '';
}

/**
 * 6 haneli random kod üret
 */
export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Telegram'a mesaj gönder
 */
export async function sendTelegramMessage(
  chatId: string,
  message: string
): Promise<boolean> {
  const token = getBotToken();
  
  if (!token) {
    console.error('TELEGRAM_BOT_TOKEN is not set');
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error('Telegram API error:', data);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
    return false;
  }
}

/**
 * Kullanıcıya doğrulama kodu gönder
 */
export async function sendVerificationCode(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { success: false, error: 'Kullanıcı bulunamadı' };
    }

    if (!user.telegramChatId) {
      return { success: false, error: 'Telegram hesabı bağlı değil' };
    }

    // Eski kullanılmamış kodları sil
    await prisma.telegramCode.deleteMany({
      where: {
        userId: userId,
        used: false,
      },
    });

    // Yeni kod üret
    const code = generateCode();
    const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 dakika

    // Kodu veritabanına kaydet
    await prisma.telegramCode.create({
      data: {
        userId,
        code,
        expires,
      },
    });

    // Telegram'a gönder
    const message = `
🔐 <b>Stock Management System</b>

Giriş doğrulama kodunuz:

<code>${code}</code>

⏰ Bu kod 5 dakika içinde geçerliliğini yitirecektir.

⚠️ Bu kodu kimseyle paylaşmayın!
    `.trim();

    const sent = await sendTelegramMessage(user.telegramChatId, message);

    if (!sent) {
      return { success: false, error: 'Telegram mesajı gönderilemedi' };
    }

    return { success: true };
  } catch (error) {
    console.error('Send verification code error:', error);
    return { success: false, error: 'Kod gönderilemedi' };
  }
}

/**
 * Doğrulama kodunu kontrol et
 */
export async function verifyTelegramCode(
  userId: string,
  code: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Geçerli kodu bul
    const telegramCode = await prisma.telegramCode.findFirst({
      where: {
        userId,
        code,
        used: false,
        expires: {
          gt: new Date(),
        },
      },
    });

    if (!telegramCode) {
      return { success: false, error: 'Geçersiz veya süresi dolmuş kod' };
    }

    // Kodu kullanılmış olarak işaretle
    await prisma.telegramCode.update({
      where: { id: telegramCode.id },
      data: { used: true },
    });

    return { success: true };
  } catch (error) {
    console.error('Verify Telegram code error:', error);
    return { success: false, error: 'Doğrulama başarısız' };
  }
}

/**
 * Telegram hesabını bağla
 * Kullanıcı Telegram bot'a /start komutunu gönderdiğinde
 * bot bir bağlantı kodu oluşturur
 */
export async function linkTelegramAccount(
  userId: string,
  chatId: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramChatId: chatId,
        telegramEnabled: true,
      },
    });

    // Kullanıcıya hoş geldin mesajı gönder
    const message = `
✅ <b>Telegram Hesabınız Bağlandı!</b>

Stock Management System'e Telegram ile giriş yapabilirsiniz.

🔐 Giriş yaptığınızda doğrulama kodu bu sohbete gönderilecektir.
    `.trim();

    await sendTelegramMessage(chatId, message);

    return { success: true };
  } catch (error) {
    console.error('Link Telegram account error:', error);
    return { success: false, error: 'Hesap bağlanamadı' };
  }
}

/**
 * Telegram hesabını kaldır
 */
export async function unlinkTelegramAccount(userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.telegramChatId) {
      // Kullanıcıya bildirim gönder
      await sendTelegramMessage(
        user.telegramChatId,
        '🔓 Telegram hesabınız Stock Management System\'den kaldırıldı.'
      );
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        telegramChatId: null,
        telegramEnabled: false,
        preferredAuthMethod: '2fa', // Varsayılan 2FA'ya dön
      },
    });

    // Eski kodları temizle
    await prisma.telegramCode.deleteMany({
      where: { userId },
    });

    return { success: true };
  } catch (error) {
    console.error('Unlink Telegram account error:', error);
    return { success: false, error: 'Hesap kaldırılamadı' };
  }
}

/**
 * Süresi dolmuş kodları temizle (cron job için)
 */
export async function cleanupExpiredCodes(): Promise<number> {
  const result = await prisma.telegramCode.deleteMany({
    where: {
      OR: [
        { expires: { lt: new Date() } },
        { used: true },
      ],
    },
  });

  return result.count;
}

/**
 * Kullanıcının 2FA durumunu kontrol et
 */
export async function getUserAuthStatus(userId: string): Promise<{
  twoFactorEnabled: boolean;
  telegramEnabled: boolean;
  preferredMethod: string;
  hasTelegram: boolean;
  has2FA: boolean;
}> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorEnabled: true,
      twoFactorSecret: true,
      telegramEnabled: true,
      telegramChatId: true,
      preferredAuthMethod: true,
    },
  });

  if (!user) {
    return {
      twoFactorEnabled: false,
      telegramEnabled: false,
      preferredMethod: '2fa',
      hasTelegram: false,
      has2FA: false,
    };
  }

  return {
    twoFactorEnabled: user.twoFactorEnabled,
    telegramEnabled: user.telegramEnabled,
    preferredMethod: user.preferredAuthMethod,
    hasTelegram: !!user.telegramChatId,
    has2FA: !!user.twoFactorSecret,
  };
}
