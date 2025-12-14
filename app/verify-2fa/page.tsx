'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

type AuthMethod = 'select' | '2fa' | 'telegram';

export default function Verify2FAPage() {
  const router = useRouter();
  const { status } = useSession();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [authMethod, setAuthMethod] = useState<AuthMethod>('select');
  const [authOptions, setAuthOptions] = useState({
    has2FA: false,
    hasTelegram: false,
    preferredMethod: '2fa',
  });
  const [telegramSent, setTelegramSent] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/pazaryeri1453');
    }
    
    if (status === 'authenticated') {
      fetchAuthOptions();
    }
  }, [status, router]);

  const fetchAuthOptions = async () => {
    try {
      const response = await fetch('/api/user/auth-options');
      if (response.ok) {
        const data = await response.json();
        setAuthOptions(data);
        
        // Tercih edilen yöntemi otomatik seç
        if (data.preferredMethod === 'telegram' && data.hasTelegram) {
          setAuthMethod('telegram');
          sendTelegramCode();
        } else if (data.preferredMethod === '2fa' && data.has2FA) {
          setAuthMethod('2fa');
        } else if (data.has2FA && !data.hasTelegram) {
          setAuthMethod('2fa');
        } else if (!data.has2FA && data.hasTelegram) {
          setAuthMethod('telegram');
          sendTelegramCode();
        } else if (data.has2FA && data.hasTelegram) {
          setAuthMethod('select');
        } else {
          router.push('/dashboard');
        }
      }
    } catch (err) {
      console.error('Failed to fetch auth options:', err);
    }
  };

  const sendTelegramCode = async () => {
    setSendingTelegram(true);
    setError('');
    
    try {
      const response = await fetch('/api/telegram/send-code', {
        method: 'POST',
      });

      if (response.ok) {
        setTelegramSent(true);
      } else {
        const data = await response.json();
        setError(data.error || 'Telegram kodu gonderilemedi');
      }
    } catch (err) {
      setError('Telegram kodu gonderilemedi');
    } finally {
      setSendingTelegram(false);
    }
  };

  const verify = async () => {
    if (!token || token.length < 6) {
      setError('Lutfen gecerli bir kod girin');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const endpoint = authMethod === 'telegram' 
        ? '/api/telegram/verify-code'
        : '/api/2fa/validate';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          token: authMethod === '2fa' ? token : undefined,
          code: authMethod === 'telegram' ? token : undefined,
          isBackupCode: useBackupCode 
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        router.push('/dashboard');
        router.refresh();
      } else {
        setError(data.error || 'Gecersiz kod');
      }
    } catch (err) {
      setError('Dogrulama basarisiz. Tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const selectMethod = (method: '2fa' | 'telegram') => {
    setAuthMethod(method);
    setToken('');
    setError('');
    setUseBackupCode(false);
    
    if (method === 'telegram') {
      sendTelegramCode();
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800">
        <div className="text-white text-xl">Yukleniyor...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-8 max-w-md w-full">
        
        {/* Method Selection */}
        {authMethod === 'select' && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
                <div className="text-3xl">🔐</div>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Dogrulama Yontemi</h1>
              <p className="text-white/70">Giris dogrulamasi icin bir yontem secin</p>
            </div>

            <div className="space-y-4">
              {authOptions.has2FA && (
                <button
                  onClick={() => selectMethod('2fa')}
                  className="w-full p-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all duration-200 text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      🔐
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Authenticator App</h3>
                      <p className="text-white/60 text-sm">Google Authenticator veya benzeri</p>
                    </div>
                  </div>
                </button>
              )}

              {authOptions.hasTelegram && (
                <button
                  onClick={() => selectMethod('telegram')}
                  className="w-full p-4 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl transition-all duration-200 text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-400/20 rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                      📱
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">Telegram</h3>
                      <p className="text-white/60 text-sm">Telegram ile kod al</p>
                    </div>
                  </div>
                </button>
              )}
            </div>
          </>
        )}

        {/* 2FA Verification */}
        {authMethod === '2fa' && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
                <div className="text-3xl">🔐</div>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Authenticator Dogrulama</h1>
              <p className="text-white/70">
                {useBackupCode 
                  ? 'Yedek kodunuzu girin' 
                  : 'Authenticator uygulamanizdan 6 haneli kodu girin'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            <div className="mb-6">
              <input
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                placeholder={useBackupCode ? 'XXXXXXXX' : '000000'}
                maxLength={useBackupCode ? 8 : 6}
                className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white text-center text-2xl tracking-widest placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') verify();
                }}
              />
            </div>

            <button
              onClick={verify}
              disabled={loading || (useBackupCode ? token.length < 8 : token.length < 6)}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Dogrulaniyor...' : 'Dogrula'}
            </button>

            <div className="mt-6 flex flex-col gap-2 text-center">
              <button
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setToken('');
                  setError('');
                }}
                className="text-blue-300 hover:text-blue-200 text-sm transition-colors"
              >
                {useBackupCode ? 'Authenticator kodunu kullan' : 'Yedek kod kullan'}
              </button>
              
              {authOptions.hasTelegram && (
                <button
                  onClick={() => selectMethod('telegram')}
                  className="text-white/60 hover:text-white text-sm transition-colors"
                >
                  Telegram ile dogrula
                </button>
              )}
            </div>
          </>
        )}

        {/* Telegram Verification */}
        {authMethod === 'telegram' && (
          <>
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
                <div className="text-3xl">📱</div>
              </div>
              <h1 className="text-2xl font-bold text-white mb-2">Telegram Dogrulama</h1>
              <p className="text-white/70">
                {telegramSent 
                  ? 'Telegram a gonderilen 6 haneli kodu girin'
                  : 'Telegram a kod gonderiliyor...'}
              </p>
            </div>

            {sendingTelegram && (
              <div className="mb-6 flex justify-center">
                <div className="w-8 h-8 border-2 border-white/30 border-t-blue-400 rounded-full animate-spin"></div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
                <p className="text-red-200 text-sm">{error}</p>
              </div>
            )}

            {telegramSent && (
              <>
                <div className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-xl">
                  <p className="text-green-200 text-sm text-center">Kod Telegram a gonderildi!</p>
                </div>

                <div className="mb-6">
                  <input
                    type="text"
                    value={token}
                    onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    maxLength={6}
                    className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white text-center text-2xl tracking-widest placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') verify();
                    }}
                  />
                </div>

                <button
                  onClick={verify}
                  disabled={loading || token.length < 6}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-400 to-cyan-500 hover:from-blue-500 hover:to-cyan-600 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Dogrulaniyor...' : 'Dogrula'}
                </button>

                <button
                  onClick={sendTelegramCode}
                  disabled={sendingTelegram}
                  className="w-full mt-3 py-2 text-white/70 hover:text-white text-sm transition-colors"
                >
                  Tekrar kod gonder
                </button>
              </>
            )}

            <div className="mt-6 text-center">
              {authOptions.has2FA && (
                <button
                  onClick={() => selectMethod('2fa')}
                  className="text-white/60 hover:text-white text-sm transition-colors"
                >
                  Authenticator ile dogrula
                </button>
              )}
            </div>
          </>
        )}

        {/* Back to Method Selection */}
        {authMethod !== 'select' && authOptions.has2FA && authOptions.hasTelegram && (
          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <button
              onClick={() => {
                setAuthMethod('select');
                setToken('');
                setError('');
                setTelegramSent(false);
              }}
              className="text-white/50 hover:text-white text-sm transition-colors"
            >
              Yontem secimine don
            </button>
          </div>
        )}

        {/* Help Text */}
        <div className="mt-6 p-4 bg-white/5 rounded-xl">
          <p className="text-white/60 text-xs text-center">
            {authMethod === 'telegram'
              ? 'Kod 5 dakika icinde gecerlidir.'
              : 'Kodu 30 saniye icinde girin.'}
          </p>
        </div>
      </div>
    </div>
  );
}
