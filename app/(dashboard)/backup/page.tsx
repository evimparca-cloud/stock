'use client';

import { useState, useEffect } from 'react';

interface BackupFile {
  name: string;
  size: string;
  sizeBytes: number;
  date: string;
  type: 'local' | 'cloud';
  encrypted: boolean;
}

interface BackupStats {
  totalBackups: number;
  totalSize: string;
  oldestBackup: string | null;
  newestBackup: string | null;
  encryptedCount: number;
}

interface CloudStatus {
  googleDrive: { configured: boolean; lastSync: string | null };
  s3: { configured: boolean; lastSync: string | null };
}

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');
  const [backupOptions, setBackupOptions] = useState({
    encrypt: true,
    uploadToCloud: 'none' as 'none' | 'google-drive' | 's3',
  });

  useEffect(() => {
    loadData();
    
    // URL'den Google OAuth code'unu kontrol et
    const urlParams = new URLSearchParams(window.location.search);
    const googleCode = urlParams.get('google_code');
    const error = urlParams.get('error');
    
    if (error) {
      setMessage('❌ Google bağlantısı iptal edildi: ' + error);
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (googleCode) {
      handleGoogleCallback(googleCode);
    }
  }, []);

  const handleGoogleCallback = async (code: string) => {
    setMessage('⏳ Google token alınıyor...');
    try {
      const response = await fetch('/api/admin/backup/google-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();
      if (response.ok && data.success) {
        setMessage('✅ ' + data.message);
        window.history.replaceState({}, document.title, window.location.pathname);
        loadData();
      } else {
        setMessage('❌ Token alınamadı: ' + (data.error || 'Bilinmeyen hata'));
      }
    } catch (error: any) {
      setMessage('❌ Token işlemi başarısız: ' + error.message);
    }
  };

  const loadData = async () => {
    try {
      const [backupsRes, cloudRes] = await Promise.all([
        fetch('/api/admin/backup').catch(() => null),
        fetch('/api/admin/backup?action=cloud-status').catch(() => null),
      ]);

      if (backupsRes) {
        const data = await backupsRes.json().catch(() => ({}));
        setBackups(data.backups || []);
        setStats(data.stats || { totalBackups: 0, totalSize: '0 B', encryptedCount: 0 });
        if (data.error) {
          console.warn('Backup API warning:', data.error, data.details);
        }
      }

      if (cloudRes) {
        const cloudData = await cloudRes.json().catch(() => null);
        if (cloudData) setCloudStatus(cloudData);
      }
    } catch (error) {
      console.error('Load error:', error);
      setBackups([]);
      setStats({ totalBackups: 0, totalSize: '0 B', oldestBackup: null, newestBackup: null, encryptedCount: 0 });
    } finally {
      setLoading(false);
    }
  };

  const createBackup = async () => {
    setCreating(true);
    setMessage('⏳ Yedek oluşturuluyor...');
    
    try {
      console.log('Backup request starting...', backupOptions);
      
      const response = await fetch('/api/admin/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(backupOptions),
      });

      console.log('Backup response status:', response.status);
      const data = await response.json();
      console.log('Backup response data:', data);

      if (response.ok && data.success) {
        setMessage(`✅ Yedek oluşturuldu: ${data.backup.name} (${data.backup.size})`);
        loadData();
      } else {
        setMessage(`❌ Hata: ${data.error || 'Bilinmeyen hata'}`);
        if (data.details) {
          console.error('Backup error details:', data.details);
        }
      }
    } catch (error: any) {
      console.error('Backup request failed:', error);
      setMessage('❌ Yedekleme başarısız: ' + (error?.message || 'Network error'));
    } finally {
      setCreating(false);
    }
  };

  const deleteBackup = async (fileName: string) => {
    if (!confirm(`"${fileName}" silinsin mi?`)) return;

    try {
      const response = await fetch(`/api/admin/backup?file=${encodeURIComponent(fileName)}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setMessage(`✅ ${fileName} silindi`);
        loadData();
      } else {
        setMessage('❌ Silme başarısız');
      }
    } catch (error) {
      setMessage('❌ Silme başarısız');
    }
  };

  const downloadBackup = (fileName: string) => {
    window.open(`/api/admin/backup/download?file=${encodeURIComponent(fileName)}`, '_blank');
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="text-xl">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">🗄️ Yedekleme Yönetimi</h1>
          <p className="text-gray-600">Veritabanı yedekleri ve bulut senkronizasyonu</p>
        </div>
        <button
          onClick={loadData}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded hover:bg-gray-200"
        >
          🔄 Yenile
        </button>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.includes('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message}
        </div>
      )}

      {/* 3-2-1 Kuralı Özeti */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">📋 3-2-1 Yedekleme Kuralı</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className={stats && stats.totalBackups > 0 ? 'text-green-500' : 'text-red-500'}>
              {stats && stats.totalBackups > 0 ? '✅' : '❌'}
            </span>
            <span><strong>3 Kopya:</strong> Canlı + Yerel + Bulut</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={stats && stats.totalBackups > 0 ? 'text-green-500' : 'text-red-500'}>
              {stats && stats.totalBackups > 0 ? '✅' : '❌'}
            </span>
            <span><strong>2 Medya:</strong> Disk + Object Storage</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cloudStatus?.googleDrive.configured || cloudStatus?.s3.configured ? 'text-green-500' : 'text-yellow-500'}>
              {cloudStatus?.googleDrive.configured || cloudStatus?.s3.configured ? '✅' : '⚠️'}
            </span>
            <span><strong>1 Uzak:</strong> Bulut yedekleme</span>
          </div>
        </div>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Toplam Yedek</p>
          <p className="text-2xl font-bold">{stats?.totalBackups || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Toplam Boyut</p>
          <p className="text-2xl font-bold">{stats?.totalSize || '0 B'}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Şifreli Yedek</p>
          <p className="text-2xl font-bold text-green-600">{stats?.encryptedCount || 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Google Drive</p>
          <p className={`text-lg font-semibold ${cloudStatus?.googleDrive.configured ? 'text-green-600' : 'text-gray-400'}`}>
            {cloudStatus?.googleDrive.configured ? '✅ Bağlı' : '⚪ Yapılandırılmadı'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">S3 / Spaces</p>
          <p className={`text-lg font-semibold ${cloudStatus?.s3.configured ? 'text-green-600' : 'text-gray-400'}`}>
            {cloudStatus?.s3.configured ? '✅ Bağlı' : '⚪ Yapılandırılmadı'}
          </p>
        </div>
      </div>

      {/* Manuel Yedekleme */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">➕ Manuel Yedek Oluştur</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Şifreleme</label>
            <select
              value={backupOptions.encrypt ? 'yes' : 'no'}
              onChange={(e) => setBackupOptions({ ...backupOptions, encrypt: e.target.value === 'yes' })}
              className="border rounded px-3 py-2"
            >
              <option value="yes">🔒 Şifreli</option>
              <option value="no">🔓 Şifresiz</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Bulut Yükleme</label>
            <select
              value={backupOptions.uploadToCloud}
              onChange={(e) => setBackupOptions({ ...backupOptions, uploadToCloud: e.target.value as any })}
              className="border rounded px-3 py-2"
            >
              <option value="none">📁 Sadece Yerel</option>
              <option value="google-drive" disabled={!cloudStatus?.googleDrive.configured}>
                ☁️ Google Drive {!cloudStatus?.googleDrive.configured && '(Yapılandırılmadı)'}
              </option>
              <option value="s3" disabled={!cloudStatus?.s3.configured}>
                🪣 S3 / Spaces {!cloudStatus?.s3.configured && '(Yapılandırılmadı)'}
              </option>
            </select>
          </div>
          <button
            onClick={createBackup}
            disabled={creating}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
          >
            {creating ? (
              <>⏳ Oluşturuluyor...</>
            ) : (
              <>💾 Yedek Al</>
            )}
          </button>
        </div>
      </div>

      {/* Yedek Listesi */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-4 border-b">
          <h2 className="text-xl font-semibold">📋 Mevcut Yedekler</h2>
        </div>
        <div className="divide-y">
          {backups.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <span className="text-4xl block mb-2">📭</span>
              Henüz yedek yok
            </div>
          ) : (
            backups.map((backup) => (
              <div key={backup.name} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">
                    {backup.encrypted ? '🔒' : '📄'}
                  </span>
                  <div>
                    <p className="font-medium">{backup.name}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(backup.date).toLocaleString('tr-TR')} • {backup.size}
                      {backup.encrypted && <span className="ml-2 text-green-600">• Şifreli</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => downloadBackup(backup.name)}
                    className="bg-gray-100 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-200"
                  >
                    ⬇️ İndir
                  </button>
                  <button
                    onClick={() => deleteBackup(backup.name)}
                    className="bg-red-50 text-red-600 px-3 py-1 rounded text-sm hover:bg-red-100"
                  >
                    🗑️ Sil
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Google Drive Bağlantısı */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">☁️ Google Drive Bağlantısı</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600">
                {cloudStatus?.googleDrive.configured 
                  ? '✅ Google Drive bağlı' 
                  : '⚪ Google Drive bağlı değil'}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Yedeklerinizi otomatik olarak Google Drive'a yükleyin
              </p>
            </div>
            <button
              onClick={async () => {
                setMessage('⏳ Google\'a bağlanılıyor...');
                try {
                  const res = await fetch('/api/admin/backup/google-auth');
                  console.log('Google auth response:', res.status);
                  const data = await res.json();
                  console.log('Google auth data:', data);
                  
                  if (data.authUrl) {
                    window.location.href = data.authUrl;
                  } else if (data.error) {
                    setMessage('❌ ' + data.error + (data.instructions ? '\n' + data.instructions : ''));
                  } else {
                    setMessage('❌ Beklenmeyen yanıt');
                  }
                } catch (err: any) {
                  console.error('Google auth error:', err);
                  setMessage('❌ Google bağlantısı başarısız: ' + (err?.message || 'Bilinmeyen hata'));
                }
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
              </svg>
              Google ile Bağlan
            </button>
          </div>
          
          {/* STOK_YEDEK Klasör ID Bulucu */}
          {cloudStatus?.googleDrive.configured && (
            <div className="border-t pt-4">
              <h3 className="font-medium mb-2">📁 STOK_YEDEK Klasörü</h3>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch('/api/admin/backup/google-folders');
                      const data = await res.json();
                      if (data.stokYedekFolder) {
                        setMessage(`✅ ${data.recommendation}\n\n.env dosyasına ekleyin:\nGOOGLE_DRIVE_FOLDER_ID=${data.stokYedekFolder.id}`);
                      } else {
                        setMessage(`⚠️ ${data.recommendation}\n\nGoogle Drive'da "STOK_YEDEK" adında bir klasör oluşturun.`);
                      }
                    } catch (error) {
                      setMessage('❌ Klasör listesi alınamadı');
                    }
                  }}
                  className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700"
                >
                  🔍 STOK_YEDEK Klasörünü Bul
                </button>
                
                <button
                  onClick={async () => {
                    if (!confirm('30 günden eski Google Drive yedekleri silinsin mi?')) return;
                    
                    setMessage('⏳ Google Drive temizleniyor...');
                    try {
                      const res = await fetch('/api/admin/backup/google-cleanup', { method: 'POST' });
                      const data = await res.json();
                      if (data.success) {
                        setMessage(`✅ ${data.message}\n📊 ${data.stats.deletedCount} dosya silindi (${data.stats.totalSizeFreed} boşaltıldı)`);
                      } else {
                        setMessage('❌ ' + data.error);
                      }
                    } catch (error) {
                      setMessage('❌ Temizlik başarısız');
                    }
                  }}
                  className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700"
                >
                  🗑️ Eski Yedekleri Sil (30+ gün)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Yapılandırma Rehberi */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="font-semibold text-yellow-800 mb-2">⚙️ Alternatif Yapılandırma</h3>
        <div className="text-sm text-yellow-700 space-y-2">
          <p className="mb-2"><strong>S3 / DigitalOcean Spaces için .env'ye ekleyin:</strong></p>
          <pre className="bg-yellow-100 p-2 rounded text-xs overflow-x-auto">
{`AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_S3_BUCKET=your-bucket-name
AWS_S3_REGION=us-east-1
AWS_S3_ENDPOINT=https://nyc3.digitaloceanspaces.com  # Spaces için`}
          </pre>
          <p className="mt-3"><strong>Şifreleme için:</strong></p>
          <pre className="bg-yellow-100 p-2 rounded text-xs overflow-x-auto">
{`BACKUP_ENCRYPTION_KEY=your_strong_encryption_key_here`}
          </pre>
        </div>
      </div>

      {/* Otomatik Yedekleme Bilgisi */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">🕐 Otomatik Yedekleme</h3>
        <p className="text-sm text-blue-700">
          Docker ortamında her gece <strong>03:00</strong>'da otomatik yedekleme yapılır.
          Yedekler <strong>7 gün</strong> saklanır ve eski olanlar otomatik silinir.
        </p>
      </div>
    </div>
  );
}
