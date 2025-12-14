'use client';

import { useState, useEffect } from 'react';

interface NotificationSettings {
  telegram: {
    enabled: boolean;
    botToken: string;
    chatId: string;
    connected: boolean;
  };
  events: {
    newOrder: boolean;
    orderStatusChange: boolean;
    lowStock: boolean;
    dailySummary: boolean;
    orderCancellation: boolean;
    systemError: boolean;
  };
  statusEvents: {
    created: boolean;
    picking: boolean;
    shipped: boolean;
    delivered: boolean;
    cancelled: boolean;
  };
  thresholds: {
    lowStockLevel: number;
    dailySummaryTime: string;
  };
  templates: {
    newOrder: string;
    orderStatusChange: string;
    lowStock: string;
  };
}

interface NotificationLog {
  id: string;
  type: string;
  message: string;
  status: 'sent' | 'failed';
  createdAt: string;
}

const defaultSettings: NotificationSettings = {
  telegram: {
    enabled: false,
    botToken: '',
    chatId: '',
    connected: false,
  },
  events: {
    newOrder: true,
    orderStatusChange: true,
    lowStock: true,
    dailySummary: false,
    orderCancellation: true,
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

export default function NotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'settings' | 'events' | 'templates' | 'logs'>('settings');

  const [telegramStatus, setTelegramStatus] = useState<{
    connected: boolean;
    botName?: string;
    username?: string;
    chatTitle?: string;
    error?: string;
    checking: boolean;
  }>({ connected: false, checking: true });

  useEffect(() => {
    loadSettings();
    loadLogs();
    checkTelegramStatus();
  }, []);

  const checkTelegramStatus = async () => {
    setTelegramStatus(prev => ({ ...prev, checking: true }));
    try {
      const res = await fetch('/api/telegram/status');
      const data = await res.json();
      setTelegramStatus({
        connected: data.connected,
        botName: data.botName,
        username: data.username,
        chatTitle: data.chatTitle,
        error: data.error,
        checking: false
      });
    } catch (error) {
      setTelegramStatus({
        connected: false,
        error: 'Bağlantı kontrol edilemedi',
        checking: false
      });
    }
  };

  const loadSettings = async () => {
    try {
      const res = await fetch('/api/admin/notifications/settings');
      if (res.ok) {
        const data = await res.json();
        // Safe merge with default settings to prevent undefined errors
        setSettings(prev => ({
          ...prev,
          ...data,
          telegram: { ...prev.telegram, ...(data.telegram || {}) },
          events: { ...prev.events, ...(data.events || {}) },
          statusEvents: { ...prev.statusEvents, ...(data.statusEvents || {}) },
          thresholds: { ...prev.thresholds, ...(data.thresholds || {}) },
          templates: { ...prev.templates, ...(data.templates || {}) },
        }));
      }
    } catch (error) {
      console.error('Ayarlar yüklenemedi:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    try {
      const res = await fetch('/api/admin/notifications/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Loglar yüklenemedi:', error);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage('');
    console.log('Saving settings...', settings);

    try {
      const res = await fetch('/api/admin/notifications/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setMessage('✅ Ayarlar kaydedildi!');
        loadSettings();
        checkTelegramStatus(); // Re-check status after save
      } else {
        const data = await res.json();
        setMessage('❌ ' + (data.error || 'Kaydetme başarısız'));
      }
    } catch (error) {
      console.error('Save settings error:', error);
      setMessage('❌ Kaydetme hatası: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    } finally {
      setSaving(false);
    }
  };

  const sendTestNotification = async (type: string) => {
    setTesting(true);
    setMessage('');

    try {
      const res = await fetch('/api/admin/notifications/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      });

      if (res.ok) {
        setMessage('✅ Test bildirimi gönderildi!');
        loadLogs();
      } else {
        const data = await res.json();
        setMessage('❌ ' + (data.error || 'Gönderim başarısız'));
      }
    } catch (error) {
      setMessage('❌ Test hatası');
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-xl">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 shadow-lg text-white flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-3 rounded-xl">
            <span className="text-3xl">🔔</span>
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Bildirim Merkezi</h1>
            <p className="mt-1 text-blue-100">
              Telegram bildirimlerini ve olayları yönetin
            </p>
          </div>
        </div>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="bg-white text-blue-600 px-6 py-2 rounded-lg hover:bg-blue-50 disabled:opacity-50 flex items-center gap-2 font-semibold shadow-md transition-all"
        >
          {saving ? '⏳ Kaydediliyor...' : '💾 Ayarları Kaydet'}
        </button>
      </div>

      {/* Message */}
      {message && (
        <div className={`p-4 rounded-lg border animate-in fade-in slide-in-from-top-2 ${message.includes('✅') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
          {message}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <nav className="flex overflow-x-auto">
          {[
            { id: 'settings', label: 'Telegram Ayarları', icon: '⚙️' },
            { id: 'events', label: 'Bildirim Olayları', icon: '📋' },
            { id: 'templates', label: 'Şablonlar', icon: '📝' },
            { id: 'logs', label: 'Bildirim Geçmişi', icon: '📊' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-4 font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id
                ? 'border-blue-600 text-blue-600 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Telegram Ayarları */}
        {activeTab === 'settings' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b">
              <div className="bg-blue-100 p-2 rounded-lg">
                <span className="text-2xl">📱</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Telegram Bağlantısı</h2>
                <p className="text-sm text-gray-500">Bot token ve grup ID ayarları</p>
              </div>
            </div>

            {/* Status Indicator */}
            <div className={`p-4 rounded-lg border flex items-center justify-between ${telegramStatus.checking ? 'bg-gray-50 border-gray-200' :
              telegramStatus.connected ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
              }`}>
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${telegramStatus.checking ? 'bg-gray-400 animate-pulse' :
                  telegramStatus.connected ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                <div>
                  <h3 className="font-medium text-sm">
                    {telegramStatus.checking ? 'Bağlantı kontrol ediliyor...' :
                      telegramStatus.connected ? 'Telegram Botu Bağlı ✅' : 'Bağlantı Hatası ❌'}
                  </h3>
                  {!telegramStatus.checking && telegramStatus.connected && (
                    <p className="text-xs text-green-700 mt-1">
                      Bot: @{telegramStatus.username} | Grup: {telegramStatus.chatTitle}
                    </p>
                  )}
                  {!telegramStatus.checking && !telegramStatus.connected && (
                    <p className="text-xs text-red-700 mt-1">
                      {telegramStatus.error || 'Bot token veya Chat ID hatalı'}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={checkTelegramStatus}
                className="text-xs bg-white border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors"
              >
                🔄 Kontrol Et
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🤖 Bot Token
                </label>
                <input
                  type="password"
                  value={settings.telegram.botToken}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    telegram: { ...prev.telegram, botToken: e.target.value }
                  }))}
                  placeholder="1234567890:ABCdefGHIjklMNOpqrsTUVwxyz"
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  @BotFather'dan alınan token
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  💬 Chat ID
                </label>
                <input
                  type="text"
                  value={settings.telegram.chatId}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    telegram: { ...prev.telegram, chatId: e.target.value }
                  }))}
                  placeholder="-100123456789"
                  className="w-full border rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Gruba @RawDataBot ekleyerek ID'yi öğrenebilirsiniz (genelde -100 ile başlar)
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 pt-4 border-t">
              <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors w-full border border-gray-200">
                <div className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.telegram.enabled}
                    onChange={(e) => setSettings(prev => ({
                      ...prev,
                      telegram: { ...prev.telegram, enabled: e.target.checked }
                    }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </div>
                <span className="font-medium text-gray-700">Telegram Bildirimlerini Etkinleştir</span>
              </label>
            </div>
          </div>
        )}

        {/* Bildirim Olayları */}
        {activeTab === 'events' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b">
              <div className="bg-purple-100 p-2 rounded-lg">
                <span className="text-2xl">⚡</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Bildirim Olayları</h2>
                <p className="text-sm text-gray-500">Hangi durumlarda bildirim gönderileceğini seçin</p>
              </div>
            </div>

            <div className="grid gap-4">
              {/* Yeni Sipariş */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">🛍️</span>
                  <div>
                    <h3 className="font-medium">Yeni Sipariş</h3>
                    <p className="text-sm text-gray-500">Yeni bir sipariş geldiğinde</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => sendTestNotification('newOrder')}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium px-3 py-1 rounded hover:bg-blue-50"
                  >
                    🧪 Test
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.events.newOrder}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        events: { ...prev.events, newOrder: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Sipariş Durumu Değişikliği */}
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">🔄</span>
                    <div>
                      <h3 className="font-medium">Sipariş Durumu Değişikliği</h3>
                      <p className="text-sm text-gray-500">Sipariş durumu değiştiğinde</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => sendTestNotification('orderStatusChange')}
                      className="text-blue-600 hover:text-blue-700 text-sm font-medium px-3 py-1 rounded hover:bg-blue-50"
                    >
                      🧪 Test
                    </button>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.events.orderStatusChange}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          events: { ...prev.events, orderStatusChange: e.target.checked }
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                </div>

                {/* Alt Durumlar */}
                {settings.events.orderStatusChange && settings.statusEvents && (
                  <div className="ml-12 grid grid-cols-2 md:grid-cols-3 gap-3 pt-2 border-t border-gray-200">
                    {[
                      { key: 'created', label: '🆕 Hazır (Created)' },
                      { key: 'picking', label: '📦 Toplanıyor (Picking)' },
                      { key: 'shipped', label: '🚚 Kargoda (Shipped)' },
                      { key: 'delivered', label: '✅ Teslim (Delivered)' },
                      { key: 'cancelled', label: '❌ İptal (Cancelled)' },
                    ].map((status) => (
                      <label key={status.key} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={settings.statusEvents?.[status.key as keyof typeof settings.statusEvents] ?? true}
                          onChange={(e) => setSettings(prev => ({
                            ...prev,
                            statusEvents: {
                              ...prev.statusEvents,
                              [status.key]: e.target.checked
                            }
                          }))}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-gray-700">{status.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Düşük Stok */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                <div className="flex items-center gap-4">
                  <span className="text-3xl">⚠️</span>
                  <div>
                    <h3 className="font-medium">Düşük Stok Uyarısı</h3>
                    <p className="text-sm text-gray-500">Stok belirlenen seviyenin altına düştüğünde</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-gray-500">Uyarı seviyesi:</span>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={settings.thresholds.lowStockLevel}
                        onChange={(e) => setSettings(prev => ({
                          ...prev,
                          thresholds: { ...prev.thresholds, lowStockLevel: parseInt(e.target.value) || 5 }
                        }))}
                        className="w-16 border rounded px-2 py-1 text-sm"
                      />
                      <span className="text-xs text-gray-500">adet</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => sendTestNotification('lowStock')}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium px-3 py-1 rounded hover:bg-blue-50"
                  >
                    🧪 Test
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.events.lowStock}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        events: { ...prev.events, lowStock: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>

              {/* Günlük Özet - Enhanced */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-xl p-5 border border-indigo-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <span className="text-2xl">📊</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-indigo-900">Günlük Yönetim Raporu</h3>
                      <p className="text-sm text-indigo-600">Her gün belirlenen saatte detaylı özet gönderilir</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.events.dailySummary}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        events: { ...prev.events, dailySummary: e.target.checked }
                      }))}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {/* System Status */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                  <div className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="text-xs text-gray-500 mb-1">Durum</div>
                    <div className="flex items-center gap-2">
                      {settings.events.dailySummary ? (
                        <>
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                          <span className="font-medium text-green-700">Aktif</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2 h-2 bg-gray-400 rounded-full"></span>
                          <span className="font-medium text-gray-500">Pasif</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="text-xs text-gray-500 mb-1">Gönderim Saati</div>
                    <input
                      type="time"
                      value={settings.thresholds.dailySummaryTime}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        thresholds: { ...prev.thresholds, dailySummaryTime: e.target.value }
                      }))}
                      className="border-0 bg-gray-50 rounded px-2 py-1 text-sm font-medium"
                    />
                  </div>
                  <div className="bg-white rounded-lg p-3 border border-indigo-100">
                    <div className="text-xs text-gray-500 mb-1">Sonraki Gönderim</div>
                    <div className="font-medium text-indigo-700">
                      Yarın {settings.thresholds.dailySummaryTime}
                    </div>
                  </div>
                </div>

                {/* Control Buttons */}
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => sendTestNotification('dailySummary')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors text-sm font-medium"
                  >
                    🟢 Şimdi Manuel Gönder
                  </button>
                  <button
                    onClick={() => sendTestNotification('dailySummary')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors text-sm font-medium"
                  >
                    🧪 Test Gönder
                  </button>
                </div>

                {/* Report Preview */}
                <details className="bg-white rounded-lg border border-indigo-200 overflow-hidden">
                  <summary className="p-3 cursor-pointer hover:bg-gray-50 text-sm font-medium text-indigo-700 flex items-center gap-2">
                    📋 Rapor Formatı Önizleme
                  </summary>
                  <div className="p-4 bg-gray-900 text-green-400 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                    {`📊 GÜNLÜK YÖNETİM RAPORU
📅 Tarih: ${new Date().toLocaleDateString('tr-TR')} (Dün Özeti)

💰 FİNANSAL PERFORMANS
------------------------
• Toplam Ciro:    45.250 ₺
• Sipariş Adedi:  112 Adet
• Sepet Ort.:     404 ₺
• İadeler:        -850 ₺ (2 Adet)

🛒 PAZARYERİ DAĞILIMI
------------------------
🟠 Trendyol:      28.000 ₺ (65 Sipariş)
🔵 Hepsiburada:   12.000 ₺ (30 Sipariş)
🟢 Website:       5.250 ₺  (17 Sipariş)

🚨 STOK UYARILARI
------------------------
• 🔴 Tükenenler:  2 Ürün (Acil Tedarik!)
• ⚠️ Kritik (<5): 8 Ürün

🚛 OPERASYON (BUGÜN)
------------------------
• Kargolanacak:   112 Paket
• Bekleyen İade:  3 Paket

🏆 GÜNÜN YILDIZI
👉 X Model Bluetooth Kulaklık (18 Satış)

🤖 Rapor Oluşturuldu: ${settings.thresholds.dailySummaryTime}`}
                  </div>
                </details>
              </div>
            </div>
          </div>
        )}

        {/* Şablonlar */}
        {activeTab === 'templates' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b">
              <div className="bg-yellow-100 p-2 rounded-lg">
                <span className="text-2xl">📝</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold">Bildirim Şablonları</h2>
                <p className="text-sm text-gray-500">Bildirim mesajlarını özelleştirin</p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-medium text-yellow-800 mb-2">Değişkenler</h3>
              <p className="text-sm text-yellow-700 mb-3">
                Şablonlarda aşağıdaki değişkenleri kullanabilirsiniz:
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-yellow-700">
                <code className="bg-yellow-100 px-2 py-1 rounded">{'{orderNumber}'}</code>
                <code className="bg-yellow-100 px-2 py-1 rounded">{'{marketplace}'}</code>
                <code className="bg-yellow-100 px-2 py-1 rounded">{'{totalAmount}'}</code>
                <code className="bg-yellow-100 px-2 py-1 rounded">{'{customerName}'}</code>
                <code className="bg-yellow-100 px-2 py-1 rounded">{'{productName}'}</code>
                <code className="bg-yellow-100 px-2 py-1 rounded">{'{quantity}'}</code>
                <code className="bg-yellow-100 px-2 py-1 rounded">{'{stockLevel}'}</code>
                <code className="bg-yellow-100 px-2 py-1 rounded">{'{status}'}</code>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  🛒 Yeni Sipariş Şablonu
                </label>
                <textarea
                  rows={6}
                  className="w-full border rounded-lg px-4 py-2 font-mono text-sm"
                  placeholder="Varsayılan şablon kullanılıyor..."
                  defaultValue={`🛒 YENİ SİPARİŞ!

📦 Sipariş: #{orderNumber}
🏪 Pazaryeri: {marketplace}
💰 Tutar: ₺{totalAmount}

👤 Müşteri: {customerName}`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ⚠️ Düşük Stok Şablonu
                </label>
                <textarea
                  rows={4}
                  className="w-full border rounded-lg px-4 py-2 font-mono text-sm"
                  placeholder="Varsayılan şablon kullanılıyor..."
                  defaultValue={`⚠️ DÜŞÜK STOK UYARISI!

📦 Ürün: {productName}
📊 Kalan: {stockLevel} adet`}
                />
              </div>
            </div>

            <p className="text-sm text-gray-500 italic">
              💡 Şablon özelleştirme yakında aktif olacak. Şimdilik varsayılan şablonlar kullanılıyor.
            </p>
          </div>
        )}

        {/* Bildirim Geçmişi */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <h2 className="text-xl font-semibold">📊 Bildirim Geçmişi</h2>
                <p className="text-gray-500 text-sm mt-1">Son gönderilen bildirimler</p>
              </div>
              <button
                onClick={loadLogs}
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span className="text-xl">🔄</span> Yenile
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <span className="text-4xl block mb-2">📭</span>
                Henüz bildirim gönderilmedi
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                    <tr>
                      <th className="py-3 px-4">Durum</th>
                      <th className="py-3 px-4">Tarih</th>
                      <th className="py-3 px-4">İşlem Tipi</th>
                      <th className="py-3 px-4">Mesaj Detayı</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          {log.status === 'sent' ? (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700">
                              ✅ Başarılı
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-700">
                              ❌ Hata
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-gray-600 whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString('tr-TR')}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">
                          {log.type}
                        </td>
                        <td className="py-3 px-4 text-gray-600 max-w-md truncate" title={log.message}>
                          {log.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
