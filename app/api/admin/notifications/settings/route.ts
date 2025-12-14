import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helper';
import fs from 'fs/promises';
import path from 'path';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'notification-settings.json');

// Ayarları dosyadan oku
async function loadSettings() {
  try {
    await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
    const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// Ayarları dosyaya kaydet
async function saveSettings(settings: any) {
  await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
  await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// GET - Ayarları getir
export async function GET(request: Request) {
  try {
    // Merkezi auth kontrolü (Global bypass burada çalışacak)
    await requireAdmin();

    // Varsayılan ayarlar
    const defaultSettings = {
      telegram: {
        enabled: !!process.env.TELEGRAM_BOT_TOKEN,
        botToken: process.env.TELEGRAM_BOT_TOKEN ? '••••••••' : '',
        chatId: process.env.TELEGRAM_CHAT_ID || '',
        connected: !!process.env.TELEGRAM_BOT_TOKEN && !!process.env.TELEGRAM_CHAT_ID,
      },
      events: {
        newOrder: true,
        orderStatusChange: true,
        lowStock: true,
        dailySummary: false,
        systemError: true,
      },
      statusEvents: {
        created: true,
        picking: true,
        shipped: true,
        delivered: true,
        cancelled: true,
      },
      thresholds: {
        lowStockLevel: 5,
        dailySummaryTime: '09:00',
      },
      templates: {
        newOrder: 'default',
        orderStatusChange: 'default',
        lowStock: 'default',
      },
    };

    const savedSettings = await loadSettings();

    if (savedSettings) {
      // Merge saved settings with defaults to ensure all fields exist
      const merged = {
        ...defaultSettings,
        ...savedSettings,
        telegram: { ...defaultSettings.telegram, ...savedSettings.telegram },
        events: { ...defaultSettings.events, ...savedSettings.events },
        statusEvents: { ...defaultSettings.statusEvents, ...(savedSettings.statusEvents || {}) },
        thresholds: { ...defaultSettings.thresholds, ...(savedSettings.thresholds || {}) },
        templates: { ...defaultSettings.templates, ...(savedSettings.templates || {}) },
      };

      // Token'ı maskele
      if (merged.telegram?.botToken && merged.telegram.botToken !== '••••••••') {
        merged.telegram.botToken = '••••••••';
      }
      return NextResponse.json(merged);
    }

    return NextResponse.json(defaultSettings);
  } catch (error) {
    if (error instanceof Error && (error.message === 'Admin access required' || error.message.includes('Authentication'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Get notification settings error:', error);
    return NextResponse.json({ error: 'Failed to get settings' }, { status: 500 });
  }
}

// POST - Ayarları kaydet
export async function POST(request: Request) {
  try {
    // Merkezi auth kontrolü
    await requireAdmin();

    const body = await request.json();

    // Eğer token maskeli geldiyse, mevcut token'ı koru
    if (body.telegram?.botToken === '••••••••') {
      const existingSettings = await loadSettings();
      if (existingSettings?.telegram?.botToken) {
        body.telegram.botToken = existingSettings.telegram.botToken;
      } else {
        body.telegram.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
      }
    }

    await saveSettings(body);

    return NextResponse.json({ success: true, message: 'Ayarlar kaydedildi' });
  } catch (error) {
    if (error instanceof Error && (error.message === 'Admin access required' || error.message.includes('Authentication'))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Save notification settings error:', error);
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
