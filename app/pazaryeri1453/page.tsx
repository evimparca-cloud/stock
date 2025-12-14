'use client';

import { signIn } from 'next-auth/react';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const timeout = searchParams.get('timeout');
    const reason = searchParams.get('reason');
    const errorParam = searchParams.get('error');
    const message = searchParams.get('message');

    if (reason === 'idle') {
      setError('⏰ 30 dakika hareketsizlik nedeniyle oturum sonlandırıldı.');
    } else if (timeout === 'true') {
      setError('Oturum süresi doldu. Lütfen tekrar giriş yapın.');
    } else if (errorParam === 'insufficient-permissions') {
      setError('Bu sayfaya erişim yetkiniz yok.');
    } else if (errorParam === 'session-required') {
      setError('Bu sayfaya erişmek için giriş yapmanız gerekiyor.');
    } else if (message === 'password-reset-success') {
      setError(''); // Başarı mesajı için error kullanmıyoruz
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        // Güvenlik: Genel hata mesajı
        setError('Email veya şifre hatalı.');
      } else {
        // Başarılı giriş - Server-side cookie set et ve 2FA durumunu kontrol et
        try {
          const cookieResponse = await fetch('/api/auth/set-2fa-cookie', {
            method: 'POST',
          });
          const cookieData = await cookieResponse.json();

          if (cookieData.twoFactorEnabled) {
            // 2FA aktif - doğrulama sayfasına yönlendir
            router.push('/verify-2fa');
          } else {
            // 2FA kapalı - direkt dashboard'a git
            router.push('/dashboard');
          }
          router.refresh();
        } catch {
          // Hata olursa dashboard'a git
          router.push('/dashboard');
          router.refresh();
        }
      }
    } catch (error) {
      setError('Sistem hatası oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-800 flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-black/20"></div>

      <div className="relative w-full max-w-md">
        {/* Logo ve Başlık */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl mb-4">
            <div className="text-3xl">📊</div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Stock Manager</h1>
          <p className="text-white/70">Inventory Management System</p>
        </div>

        {/* Login Form */}
        <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-8">
          {/* Hata Mesajları */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="text-red-400 text-xl">⚠️</div>
                <p className="text-red-200 text-sm font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Başarı Mesajı */}
          {searchParams.get('message') === 'password-reset-success' && (
            <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="text-green-400 text-xl">✅</div>
                <p className="text-green-200 text-sm font-medium">Şifreniz başarıyla değiştirildi. Yeni şifrenizle giriş yapabilirsiniz.</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">
                Email Adresi
              </label>
              <div className="relative">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                  placeholder="admin@example.com"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="w-5 h-5 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">
                Şifre
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/30 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all pr-12"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/50 hover:text-white/80 transition-colors"
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-400 bg-white/10 border-white/30 rounded focus:ring-blue-400 focus:ring-2"
                />
                <span className="ml-2 text-sm text-white/80">Beni hatırla</span>
              </label>

              <button
                type="button"
                className="text-sm text-blue-300 hover:text-blue-200 transition-colors"
                onClick={() => router.push('/forgot-password')}
              >
                Şifremi unuttum
              </button>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3 px-4 rounded-xl font-medium transition-all duration-200 ${loading
                  ? 'bg-white/20 text-white/50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                }`}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Giriş yapılıyor...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>Giriş Yap</span>
                </div>
              )}
            </button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10">
            <div className="flex items-start gap-3">
              <div className="text-yellow-400 text-lg mt-0.5">🔒</div>
              <div>
                <h3 className="text-white/90 font-medium text-sm mb-1">Güvenlik Bildirimi</h3>
                <p className="text-white/60 text-xs leading-relaxed">
                  Bu sistem gelişmiş güvenlik önlemleri ile korunmaktadır.
                  Başarısız giriş denemeleri kayıt altına alınır ve IP bazlı sınırlamalar uygulanır.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-white/50 text-sm">
            © 2024 Stock Manager. Tüm hakları saklıdır.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-white">Yükleniyor...</div>}>
      <LoginForm />
    </Suspense>
  );
}
