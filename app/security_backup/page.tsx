'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Production yapılacak item bileşeni
function ProductionItem({ title, description, command }: {
    title: string;
    description: string;
    command: string;
}) {
    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
                <span className="text-xl">⏳</span>
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900">{title}</h4>
                        <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600">
                            Deploy Sonrası
                        </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{description}</p>
                    <div className="mt-2">
                        <code className="text-xs bg-gray-800 text-green-400 px-2 py-1 rounded font-mono">{command}</code>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Güvenlik özelliği bileşeni
function FeatureItem({ status, title, description, file, note }: {
    status: 'active' | 'warning' | 'inactive';
    title: string;
    description: string;
    file: string;
    note?: string;
}) {
    const statusConfig = {
        active: { icon: '✅', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-800' },
        warning: { icon: '⚠️', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', badge: 'bg-yellow-100 text-yellow-800' },
        inactive: { icon: '❌', bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-800' },
    };
    const config = statusConfig[status];

    return (
        <div className={`${config.bg} ${config.border} border rounded-lg p-4`}>
            <div className="flex items-start gap-3">
                <span className="text-xl">{config.icon}</span>
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <h4 className="font-semibold text-gray-900">{title}</h4>
                        <span className={`text-xs px-2 py-1 rounded ${config.badge}`}>
                            {status === 'active' ? 'Aktif' : status === 'warning' ? 'Geliştirilebilir' : 'Pasif'}
                        </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{description}</p>
                    <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded font-mono">{file}</span>
                    </div>
                    {note && (
                        <div className="mt-2 text-xs text-yellow-700 bg-yellow-100 px-2 py-1 rounded">
                            💡 {note}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SecurityPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    const [activeTab, setActiveTab] = useState('overview');
    const [securityStatus, setSecurityStatus] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [qrCode, setQrCode] = useState('');
    const [secret, setSecret] = useState('');
    const [token, setToken] = useState('');
    const [backupCodes, setBackupCodes] = useState<string[]>([]);
    const [showBackupCodes, setShowBackupCodes] = useState(false);
    const [setupLoading, setSetupLoading] = useState(false);
    const [telegramChatId, setTelegramChatId] = useState('');
    const [telegramLoading, setTelegramLoading] = useState(false);

    // Role check logic
    const isAdmin = session?.user && ((session.user as any).role === 'admin' || (session.user as any).role === 'ADMIN');

    useEffect(() => {
        if (status === 'loading') return;
        if (!session) {
            // Redirect handled by middleware mostly, but good to have
            // router.push('/pazaryeri1453');
        } else if (isAdmin) {
            fetchSecurityStatus();
        } else {
            setLoading(false); // Stop loading to show access denied
        }
    }, [session, status, isAdmin]);

    const fetchSecurityStatus = async () => {
        try {
            const response = await fetch('/api/security/status');
            if (response.ok) {
                const data = await response.json();
                setSecurityStatus(data);
                // Telegram Chat ID'yi state'e al (mevcut bağlı ise)
                if (data.authentication?.telegramChatId) {
                    setTelegramChatId(data.authentication.telegramChatId);
                }
            }
        } catch (err) { setError('Baglanti hatasi'); }
        finally { setLoading(false); }
    };

    const setup2FA = async () => {
        setSetupLoading(true);
        try {
            const response = await fetch('/api/2fa/setup', { method: 'POST' });
            if (response.ok) { const data = await response.json(); setQrCode(data.qrCode); setSecret(data.secret); }
        } catch (err) { setError('2FA kurulumu basarisiz'); }
        finally { setSetupLoading(false); }
    };

    const verify2FA = async () => {
        if (token.length !== 6) return setError('6 haneli kod girin');
        setSetupLoading(true);
        try {
            const response = await fetch('/api/2fa/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) });
            if (response.ok) { const data = await response.json(); setBackupCodes(data.backupCodes); setShowBackupCodes(true); setSuccess('2FA etkinlestirildi!'); setQrCode(''); setToken(''); fetchSecurityStatus(); }
            else setError('Gecersiz kod');
        } catch (err) { setError('Dogrulama basarisiz'); }
        finally { setSetupLoading(false); }
    };

    const disable2FA = async () => {
        const password = prompt('Sifrenizi girin:');
        if (!password) return;
        try {
            const response = await fetch('/api/2fa/disable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
            if (response.ok) { setSuccess('2FA devre disi'); fetchSecurityStatus(); } else setError('Sifre hatali');
        } catch (err) { setError('Islem basarisiz'); }
    };

    const linkTelegram = async () => {
        if (!telegramChatId) return setError('Chat ID girin');
        setTelegramLoading(true);
        try {
            const response = await fetch('/api/telegram/link', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chatId: telegramChatId }) });
            if (response.ok) { setSuccess('Telegram baglandi!'); fetchSecurityStatus(); }
            else { const data = await response.json(); setError(data.error || 'Baglama basarisiz'); }
        } catch (err) { setError('Baglama basarisiz'); }
        finally { setTelegramLoading(false); }
    };

    const unlinkTelegram = async () => {
        if (!confirm('Telegram i kaldirmak istediginizden emin misiniz?')) return;
        try { await fetch('/api/telegram/link', { method: 'DELETE' }); setSuccess('Telegram kaldirildi'); fetchSecurityStatus(); } catch (err) { setError('Kaldirma basarisiz'); }
    };

    const updatePreferredMethod = async (method: string) => {
        try { await fetch('/api/user/preferred-auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method }) }); setSuccess('Tercih guncellendi'); fetchSecurityStatus(); } catch (err) { setError('Guncelleme basarisiz'); }
    };

    if (status === 'loading' || (loading && isAdmin)) {
        return (
            <div className="p-6 flex items-center justify-center min-h-screen">
                <div className="animate-spin text-4xl">🔄</div>
            </div>
        );
    }

    if (!isAdmin) {
        return (
            <div className="p-6 max-w-2xl mx-auto min-h-screen flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-xl p-8 border-2 border-blue-100 text-center">
                    <div className="text-6xl mb-4">🛡️</div>
                    <h1 className="text-2xl font-bold mb-2">Güvenlik Yönetimi</h1>
                    <p className="text-gray-600 mb-6">
                        Bu sayfaya erişmek için admin olarak giriş yapmalısınız.
                    </p>
                    <Link
                        href="/pazaryeri1453"
                        className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition font-medium"
                    >
                        🔑 Giriş Yap
                    </Link>
                </div>
            </div>
        );
    }

    const s = securityStatus;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">🛡️ Guvenlik Merkezi</h1>
            {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">{error}<button onClick={() => setError('')} className="float-right">x</button></div>}
            {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4">{success}<button onClick={() => setSuccess('')} className="float-right">x</button></div>}

            <div className="flex border-b mb-6">
                {[{ id: 'overview', label: '📊 Genel Bakis' }, { id: 'features', label: '🛡️ Koruma Sistemleri' }, { id: '2fa', label: '🔐 2FA' }, { id: 'telegram', label: '📱 Telegram' }, { id: 'system', label: '⚙️ Sistem' }].map((tab) => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 font-medium ${activeTab === tab.id ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>{tab.label}</button>
                ))}
            </div>

            {activeTab === 'overview' && s && (
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">Guvenlik Skoru: <span className={s.securityScore.score >= 80 ? 'text-green-500' : s.securityScore.score >= 50 ? 'text-yellow-500' : 'text-red-500'}>{s.securityScore.score}/100</span></h2>
                        <div className="w-full bg-gray-200 rounded-full h-4 mb-4"><div className={`h-4 rounded-full ${s.securityScore.score >= 80 ? 'bg-green-500' : s.securityScore.score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${s.securityScore.score}%` }}></div></div>
                        <div className="space-y-2">{s.securityScore.checks.map((c: any, i: number) => <div key={i} className="flex justify-between text-sm"><span>{c.status === 'active' ? '✅' : c.status === 'warning' ? '⚠️' : '❌'} {c.name}</span><span className={c.points > 0 ? 'text-green-600' : 'text-gray-400'}>+{c.points}</span></div>)}</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className={`rounded-lg p-4 ${s.authentication.twoFactorEnabled ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                            <div className="text-3xl mb-2">{s.authentication.twoFactorEnabled ? '🔐' : '🔓'}</div>
                            <h3 className="font-semibold">2FA (Authenticator)</h3>
                            <p className={`text-sm ${s.authentication.twoFactorEnabled ? 'text-green-600' : 'text-red-600'}`}>{s.authentication.twoFactorEnabled ? 'Aktif' : 'Pasif'}</p>
                        </div>
                        <div className={`rounded-lg p-4 ${s.authentication.telegramEnabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'} border`}>
                            <div className="text-3xl mb-2">📱</div>
                            <h3 className="font-semibold">Telegram 2FA</h3>
                            <p className={`text-sm ${s.authentication.telegramEnabled ? 'text-blue-600' : 'text-gray-600'}`}>{s.authentication.telegramEnabled ? 'Bagli' : 'Bagli Degil'}</p>
                        </div>
                        <div className={`rounded-lg p-4 ${s.rateLimit.enabled ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}>
                            <div className="text-3xl mb-2">🚦</div>
                            <h3 className="font-semibold">Rate Limiting</h3>
                            <p className={`text-sm ${s.rateLimit.enabled ? 'text-green-600' : 'text-red-600'}`}>{s.rateLimit.enabled ? `${s.rateLimit.maxAttempts} deneme / ${s.rateLimit.windowMinutes} dk` : 'Devre Disi'}</p>
                        </div>
                        <div className={`rounded-lg p-4 ${s.authentication.backupCodesCount > 0 ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-200'} border`}>
                            <div className="text-3xl mb-2">🔑</div>
                            <h3 className="font-semibold">Yedek Kodlar</h3>
                            <p className="text-sm">{s.authentication.backupCodesCount} kod mevcut</p>
                        </div>
                    </div>

                    {(s.authentication.twoFactorEnabled || s.authentication.telegramEnabled) && (
                        <div className="bg-white rounded-lg shadow-lg p-6">
                            <h2 className="text-xl font-semibold mb-4">🎯 Tercih Edilen Yontem</h2>
                            <div className="flex gap-4">
                                {s.authentication.twoFactorEnabled && <button onClick={() => updatePreferredMethod('2fa')} className={`flex-1 p-4 rounded-lg border-2 ${s.authentication.preferredMethod === '2fa' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'}`}><div className="text-2xl mb-2">🔐</div><div className="font-medium">Authenticator</div>{s.authentication.preferredMethod === '2fa' && <div className="text-xs text-indigo-600 mt-1">✓ Secili</div>}</button>}
                                {s.authentication.telegramEnabled && <button onClick={() => updatePreferredMethod('telegram')} className={`flex-1 p-4 rounded-lg border-2 ${s.authentication.preferredMethod === 'telegram' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}><div className="text-2xl mb-2">📱</div><div className="font-medium">Telegram</div>{s.authentication.preferredMethod === 'telegram' && <div className="text-xs text-blue-600 mt-1">✓ Secili</div>}</button>}
                            </div>
                        </div>
                    )}

                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">👤 Hesap Bilgileri</h2>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-500">Email:</span> {s.user.email}</div>
                            <div><span className="text-gray-500">Isim:</span> {s.user.name}</div>
                            <div><span className="text-gray-500">Rol:</span> <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">{s.user.role}</span></div>
                            <div><span className="text-gray-500">Kayit:</span> {new Date(s.user.createdAt).toLocaleDateString('tr-TR')}</div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'features' && (
                <div className="space-y-6">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-lg p-6 text-white">
                        <h2 className="text-2xl font-bold mb-2">🛡️ Sistemde Aktif Güvenlik Önlemleri</h2>
                        <p className="text-indigo-100">Aşağıda uygulamanızdaki tüm güvenlik katmanları ve koruma sistemleri listelenmektedir.</p>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                        <div className="bg-blue-600 text-white px-6 py-3">
                            <h3 className="text-lg font-semibold">1️⃣ Uygulama ve Kod Güvenliği</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <FeatureItem
                                status="active"
                                title="AES-256 Şifreleme"
                                description="Pazaryeri API anahtarları (client_secret vb.) veritabanına şifreli kaydedilir, okurken çözülür."
                                file="lib/crypto.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="2FA (İki Faktörlü Doğrulama)"
                                description="Admin girişi için Google Authenticator / TOTP ile ek güvenlik katmanı."
                                file="lib/2fa.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="Telegram 2FA"
                                description="Alternatif doğrulama yöntemi olarak Telegram üzerinden kod gönderimi."
                                file="lib/telegram-auth.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="Honeypot"
                                description="Login formuna botları tuzağa düşüren gizli input alanı. Otomatik saldırıları engeller."
                                file="app/pazaryeri1453/actions.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="Zod Validasyonu"
                                description="Tüm form girişleri (Email, Şifre vb.) sunucu tarafında sıkı şekilde doğrulanır."
                                file="lib/validations.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="Secure Session (HttpOnly Cookie)"
                                description="JWT token'ları LocalStorage yerine HttpOnly & Secure Cookie içinde saklanır."
                                file="middleware.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="Route Protection"
                                description="Admin sayfaları ve API'ler middleware ile korunur. Yetkisiz erişim engellenir."
                                file="middleware.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="CSRF Protection"
                                description="Cross-Site Request Forgery saldırılarına karşı token doğrulaması."
                                file="lib/security-middleware.ts"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                        <div className="bg-green-600 text-white px-6 py-3">
                            <h3 className="text-lg font-semibold">2️⃣ Pazaryeri Mantığı ve Veri Tutarlılığı</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <FeatureItem
                                status="active"
                                title="Concurrency Control (Stok Kilidi)"
                                description="Aynı anda sipariş gelirse stoğun negatife düşmemesi için veritabanı kilitleme (Pessimistic Locking)."
                                file="lib/stock-manager.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="Idempotency (Tekrarlanan İstek Kontrolü)"
                                description="Webhook'ların aynı siparişi 2 kere işlemesini engelleyen kontrol mekanizması."
                                file="lib/idempotency.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="Kuyruk Sistemi (BullMQ)"
                                description="Stok güncellemelerini UI'ı dondurmadan arka planda sırayla yapan sistem."
                                file="lib/queue.ts"
                            />
                            <FeatureItem
                                status="warning"
                                title="Dead Letter Queue (DLQ)"
                                description="Hata veren işlerin silinmeyip 'Hatalı İşler' havuzunda bekletilmesi. Tam DLQ yapısı eksik."
                                file="lib/queue.ts"
                                note="removeOnFail: false var ama özel DLQ işleme mantığı geliştirilebilir"
                            />
                            <FeatureItem
                                status="active"
                                title="Audit Logging"
                                description="Admin işlemleri (Eski Değer -> Yeni Değer) detaylı şekilde kaydedilir."
                                file="lib/audit.ts"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                        <div className="bg-purple-600 text-white px-6 py-3">
                            <h3 className="text-lg font-semibold">3️⃣ Altyapı ve Sunucu Güvenliği</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <FeatureItem
                                status="active"
                                title="Redis Rate Limiting"
                                description="Hız sınırlaması Redis tabanlı. Sunucu resetlense bile banlar kalkmaz. Memory fallback mevcut."
                                file="lib/rate-limiter.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="İzole Network"
                                description="Veritabanı ve Redis sadece internal network üzerinden erişilebilir (docker-compose backend network)."
                                file="docker-compose.yml"
                            />
                            <FeatureItem
                                status="active"
                                title="Nginx Security Headers"
                                description="X-Frame-Options, X-Content-Type-Options, X-XSS-Protection, Referrer-Policy headers aktif."
                                file="nginx.conf"
                            />
                            <FeatureItem
                                status="active"
                                title="HSTS (HTTP Strict Transport Security)"
                                description="Tarayıcıları her zaman HTTPS kullanmaya zorlar. 1 yıl süre, preload aktif."
                                file="nginx.conf"
                            />
                            <FeatureItem
                                status="active"
                                title="CSP (Content Security Policy)"
                                description="Hangi kaynaklardan script/style yüklenebileceğini belirler. XSS saldırılarını engeller."
                                file="nginx.conf"
                            />
                            <FeatureItem
                                status="active"
                                title="Graceful Shutdown"
                                description="Sunucu kapanırken devam eden işlerin tamamlanması beklenir (30-60 saniye)."
                                file="lib/graceful-shutdown.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="Healthchecks"
                                description="Docker servisleri (PostgreSQL, Redis, App) sürekli kontrol edilir, kilitlenirse restart atılır."
                                file="docker-compose.yml"
                            />
                            <FeatureItem
                                status="active"
                                title="Log Rotation"
                                description="Disk dolmasın diye Docker logları 10-50MB ile sınırlı, max 3-5 dosya."
                                file="docker-compose.yml"
                            />
                            <FeatureItem
                                status="active"
                                title="Timezone (Europe/Istanbul)"
                                description="Tüm servisler Türkiye saat dilimiyle çalışır. Log zamanları ve cron job'lar doğru saatte çalışır."
                                file="docker-compose.yml"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                        <div className="bg-orange-600 text-white px-6 py-3">
                            <h3 className="text-lg font-semibold">4️⃣ Veritabanı Operasyonları</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <FeatureItem
                                status="active"
                                title="Prisma Migration"
                                description="Güvenli migrate deploy komutu kullanılır. Veri kaybı riski minimuma indirilir."
                                file="prisma/schema.prisma"
                            />
                            <FeatureItem
                                status="active"
                                title="Auto-Vacuum"
                                description="PostgreSQL'in şişmesini engelleyen performans ayarları docker-compose'da tanımlı."
                                file="docker-compose.yml"
                            />
                            <FeatureItem
                                status="active"
                                title="Seeding"
                                description="Sistem ilk açıldığında şifreli admin kullanıcısı otomatik oluşturulur."
                                file="prisma/seed.ts"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                        <div className="bg-red-600 text-white px-6 py-3">
                            <h3 className="text-lg font-semibold">5️⃣ Yedekleme ve Felaket Kurtarma</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <FeatureItem
                                status="active"
                                title="Google Drive Yedekleme"
                                description="Veritabanı yedekleri sıkıştırılıp Google Drive'a gönderilir (haftalık otomatik)."
                                file="app/api/admin/backup/route.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="Otomatik Yedek Temizliği"
                                description="30 günden eski yedekler hem sunucudan hem Drive'dan otomatik silinir."
                                file="scripts/backup.sh"
                            />
                            <FeatureItem
                                status="active"
                                title="Docker Prune Script"
                                description="Haftalık otomatik Docker temizliği - eski image'lar, container'lar silinir."
                                file="scripts/docker-prune.sh"
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                        <div className="bg-teal-600 text-white px-6 py-3">
                            <h3 className="text-lg font-semibold">6️⃣ Oturum Güvenliği</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <FeatureItem
                                status="active"
                                title="Session Timeout (8 saat)"
                                description="Giriş yaptıktan 8 saat sonra oturum otomatik sona erer."
                                file="app/api/auth/[...nextauth]/route.ts"
                            />
                            <FeatureItem
                                status="active"
                                title="Idle Timeout (30 dakika)"
                                description="30 dakika hareketsiz kalınırsa otomatik çıkış yapılır."
                                file="components/IdleTimeoutProvider.tsx"
                            />
                            <FeatureItem
                                status="active"
                                title="Tab Visibility Check"
                                description="Başka tab'a geçip geri dönüldüğünde hareketsizlik süresi kontrol edilir."
                                file="components/IdleTimeoutProvider.tsx"
                            />
                        </div>
                    </div>

                    <div className="bg-gray-100 rounded-lg p-6">
                        <h3 className="text-lg font-semibold mb-4">📊 Özet</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                            <div className="bg-white rounded-lg p-4">
                                <div className="text-3xl font-bold text-green-600">26</div>
                                <div className="text-sm text-gray-600">Aktif Koruma</div>
                            </div>
                            <div className="bg-white rounded-lg p-4">
                                <div className="text-3xl font-bold text-yellow-600">1</div>
                                <div className="text-sm text-gray-600">Geliştirilebilir</div>
                            </div>
                            <div className="bg-white rounded-lg p-4">
                                <div className="text-3xl font-bold text-blue-600">6</div>
                                <div className="text-sm text-gray-600">Kategori</div>
                            </div>
                            <div className="bg-white rounded-lg p-4">
                                <div className="text-3xl font-bold text-purple-600">✓</div>
                                <div className="text-sm text-gray-600">Production Ready</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                        <div className="bg-gradient-to-r from-gray-700 to-gray-900 text-white px-6 py-3">
                            <h3 className="text-lg font-semibold">🚀 Production'da Yapılacak (Sunucuya Çıkınca)</h3>
                        </div>
                        <div className="p-6 space-y-4">
                            <ProductionItem
                                title="UFW Firewall"
                                description="Sunucu seviyesinde güvenlik duvarı. Sadece 22 (SSH), 80 (HTTP), 443 (HTTPS) portları açık olacak."
                                command="sudo ufw enable"
                            />
                            <ProductionItem
                                title="Cloudflare DNS Proxy"
                                description="Sunucunun gerçek IP'sini gizler. DDoS koruması ve global CDN sağlar. Ücretsiz."
                                command="DNS Records → Proxy: ON (Turuncu Bulut)"
                            />
                            <ProductionItem
                                title="SSH Key Authentication"
                                description="Şifre yerine SSH key kullanarak brute-force saldırılarını engeller."
                                command="PasswordAuthentication no"
                            />
                            <ProductionItem
                                title="Fail2ban"
                                description="Çok fazla başarısız giriş denemesi yapan IP'leri otomatik banlar."
                                command="sudo apt install fail2ban"
                            />
                            <ProductionItem
                                title="Let's Encrypt SSL"
                                description="Ücretsiz SSL sertifikası. HTTPS zorunlu, otomatik yenileme."
                                command="sudo certbot --nginx -d domain.com"
                            />
                            <ProductionItem
                                title="Otomatik Güvenlik Güncellemeleri"
                                description="Ubuntu güvenlik yamalarını otomatik yükler."
                                command="sudo apt install unattended-upgrades"
                            />
                        </div>
                        <div className="bg-gray-50 px-6 py-4 border-t">
                            <p className="text-sm text-gray-600">
                                📄 Detaylı talimatlar için: <code className="bg-gray-200 px-2 py-1 rounded text-xs">PRODUCTION_CHECKLIST.md</code>
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === '2fa' && s && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">🔐 Authenticator App (2FA)</h2>
                    {!s.authentication.twoFactorEnabled && !qrCode && <div><p className="text-gray-600 mb-4">Google Authenticator, Microsoft Authenticator veya Authy kullanabilirsiniz.</p><button onClick={setup2FA} disabled={setupLoading} className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50">{setupLoading ? 'Yukleniyor...' : '2FA yi Etkinlestir'}</button></div>}
                    {qrCode && !showBackupCodes && <div className="space-y-4"><div><h3 className="font-semibold mb-2">1. QR Kodu Tarayin</h3><div className="flex justify-center bg-white p-4 rounded-lg border"><img src={qrCode} alt="2FA QR" className="w-48 h-48" /></div></div><div><h3 className="font-semibold mb-2">2. Manuel Kod</h3><code className="bg-gray-100 px-3 py-2 rounded block text-sm break-all">{secret}</code></div><div><h3 className="font-semibold mb-2">3. Dogrulama Kodu</h3><input type="text" value={token} onChange={(e) => setToken(e.target.value)} placeholder="6 haneli kod" maxLength={6} className="border rounded-lg px-4 py-2 w-full max-w-xs" /></div><button onClick={verify2FA} disabled={setupLoading || token.length !== 6} className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 disabled:opacity-50">{setupLoading ? 'Dogrulaniyor...' : 'Dogrula ve Etkinlestir'}</button></div>}
                    {showBackupCodes && backupCodes.length > 0 && <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg p-6"><h3 className="font-bold text-lg mb-2 text-yellow-800">⚠️ Yedek Kodlariniz</h3><p className="text-sm text-yellow-700 mb-4">Bu kodlari guvenli bir yerde saklayin!</p><div className="grid grid-cols-2 gap-2 mb-4">{backupCodes.map((code, i) => <code key={i} className="bg-white px-3 py-2 rounded border border-yellow-300 text-center font-mono">{code}</code>)}</div><div className="flex gap-2"><button onClick={() => { navigator.clipboard.writeText(backupCodes.join('\n')); alert('Kopyalandi!'); }} className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700">📋 Kopyala</button><button onClick={() => setShowBackupCodes(false)} className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700">Kapat</button></div></div>}
                    {s.authentication.twoFactorEnabled && !qrCode && !showBackupCodes && <div className="bg-green-50 border border-green-200 rounded-lg p-4"><div className="flex items-center justify-between"><div><p className="font-semibold text-green-800">✅ 2FA Aktif</p><p className="text-sm text-green-600">Authenticator App ile korunuyor</p></div><button onClick={disable2FA} disabled={setupLoading} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50">Devre Disi Birak</button></div></div>}
                </div>
            )}

            {activeTab === 'telegram' && s && (
                <div className="bg-white rounded-lg shadow-lg p-6">
                    <h2 className="text-xl font-semibold mb-4">📱 Telegram Dogrulama</h2>
                    {!s.authentication.telegramConfigured ? (
                        <div>
                            <p className="text-gray-600 mb-4">Telegram hesabinizi baglayarak giris dogrulamasi yapabilirsiniz.</p>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                                <h3 className="font-semibold text-blue-800 mb-2">📋 Nasil Baglanir?</h3>
                                <ol className="text-sm text-blue-700 space-y-1">
                                    <li>1. @userinfobot ile Chat ID alin</li>
                                    <li>2. Asagiya Chat ID girin</li>
                                    <li>3. @StoksysyemBot ile /start yapin</li>
                                </ol>
                            </div>
                            <div className="flex gap-2">
                                <input type="text" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} placeholder="Chat ID" className="border rounded-lg px-4 py-2 flex-1" />
                                <button onClick={linkTelegram} disabled={telegramLoading || !telegramChatId} className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50">{telegramLoading ? 'Baglaniyor...' : 'Bagla'}</button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="font-semibold text-green-800">✅ Telegram Bagli</p>
                                        <p className="text-sm text-green-600">Giris kodlari Telegram a gonderilecek</p>
                                        <p className="text-xs text-gray-500 mt-1">Chat ID: <code className="bg-gray-100 px-2 py-0.5 rounded">{s.authentication.telegramChatId}</code></p>
                                    </div>
                                    <button onClick={unlinkTelegram} disabled={telegramLoading} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50">Kaldir</button>
                                </div>
                            </div>
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                <h3 className="font-semibold text-blue-800 mb-2">📝 Chat ID Degistir</h3>
                                <div className="flex gap-2">
                                    <input type="text" value={telegramChatId} onChange={(e) => setTelegramChatId(e.target.value)} placeholder="Yeni Chat ID" className="border rounded-lg px-4 py-2 flex-1" />
                                    <button onClick={linkTelegram} disabled={telegramLoading || !telegramChatId} className="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50">{telegramLoading ? 'Guncelleniyor...' : 'Guncelle'}</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'system' && s && (
                <div className="space-y-6">
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">🖥️ Sistem Durumu</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className={`p-4 rounded-lg ${s.systemStatus.database ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} border`}><span className="text-2xl">{s.systemStatus.database ? '✅' : '❌'}</span><h3 className="font-semibold">Database</h3><p className="text-sm">{s.systemStatus.database ? 'Bagli' : 'Baglanti Yok'}</p></div>
                            <div className={`p-4 rounded-lg ${s.systemStatus.redis ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border`}><span className="text-2xl">{s.systemStatus.redis ? '✅' : '⚠️'}</span><h3 className="font-semibold">Redis (Rate Limit)</h3><p className="text-sm">{s.systemStatus.redis ? 'Aktif' : 'Devre Disi'}</p></div>
                            <div className={`p-4 rounded-lg ${s.systemStatus.telegram ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border`}><span className="text-2xl">{s.systemStatus.telegram ? '✅' : '⚠️'}</span><h3 className="font-semibold">Telegram Bot</h3><p className="text-sm">{s.systemStatus.telegram ? 'Yapilandirildi' : 'Token Yok'}</p></div>
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">🔧 Ortam Degiskenleri</h2>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(s.environment).map(([key, value]: [string, any]) => <div key={key} className="flex items-center gap-2"><span>{value ? '✅' : '❌'}</span><span className="font-mono text-sm">{key}</span></div>)}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow-lg p-6">
                        <h2 className="text-xl font-semibold mb-4">🚦 Rate Limit Durumu</h2>
                        <div className="space-y-2 text-sm">
                            <div><span className="text-gray-500">Durum:</span> {s.rateLimit.enabled ? <span className="text-green-600">Aktif</span> : <span className="text-red-600">Devre Disi</span>}</div>
                            <div><span className="text-gray-500">Max Deneme:</span> {s.rateLimit.maxAttempts}</div>
                            <div><span className="text-gray-500">Pencere:</span> {s.rateLimit.windowMinutes} dakika</div>
                            <div><span className="text-gray-500">Mevcut Deneme:</span> {s.rateLimit.currentAttempts}</div>
                            <div><span className="text-gray-500">Engellendi:</span> {s.rateLimit.isBlocked ? <span className="text-red-600">Evet</span> : <span className="text-green-600">Hayir</span>}</div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
