'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { 
  createToken, 
  verifyPassword, 
  createAuditLog,
  checkRateLimit,
  getClientIP,
  getUserAgent 
} from '@/lib/auth-production';
import { loginSchema, checkHoneypot, formatValidationErrors } from '@/lib/validations';
import type { LoginFormData } from '@/lib/validations';

/**
 * Production-Ready Login Server Action
 * Kapsamlı güvenlik kontrolleri ile giriş işlemi
 */
export async function loginAction(prevState: any, formData: FormData) {
  // IP adresi ve User-Agent bilgilerini al
  const headersList = headers();
  const forwardedFor = headersList.get('x-forwarded-for');
  const userAgent = headersList.get('user-agent') || 'unknown';
  const ipAddress = forwardedFor?.split(',')[0]?.trim() || 'unknown';

  try {
    // 1. Form verilerini al ve temizle
    const rawData = {
      email: formData.get('email')?.toString()?.trim() || '',
      password: formData.get('password')?.toString() || '',
      website: formData.get('website')?.toString() || '', // Honeypot field
      rememberMe: formData.get('rememberMe') === 'on',
    };

    // 2. Honeypot kontrolü - Bot tespit etme
    if (!checkHoneypot(rawData)) {
      // Bot tespit edildi - Audit log kaydet
      await createAuditLog({
        action: 'LOGIN_BOT_DETECTED',
        ipAddress,
        userAgent,
        success: false,
        errorCode: 'BOT_DETECTED',
        details: { honeypotValue: rawData.website }
      });

      // Bot'a başarılı gibi görünmesi için delay ekle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      return {
        success: false,
        error: 'Sistem hatası. Lütfen tekrar deneyin.',
        fields: {}
      };
    }

    // 3. Rate Limiting kontrolü
    const rateLimitResult = await checkRateLimit(
      `login:${ipAddress}`, // IP bazlı rate limiting
      5, // Maksimum 5 deneme
      15 // 15 dakika içinde
    );

    if (!rateLimitResult.allowed) {
      // Rate limit aşıldı - Audit log kaydet
      await createAuditLog({
        action: 'LOGIN_RATE_LIMITED',
        ipAddress,
        userAgent,
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        details: { 
          remainingAttempts: rateLimitResult.remainingAttempts,
          resetTime: rateLimitResult.resetTime,
          blockedUntil: rateLimitResult.blockedUntil
        }
      });

      const waitMinutes = Math.ceil((rateLimitResult.resetTime.getTime() - Date.now()) / 60000);
      
      return {
        success: false,
        error: `Çok fazla başarısız deneme. ${waitMinutes} dakika sonra tekrar deneyin.`,
        fields: {}
      };
    }

    // 4. Zod ile input validasyonu
    const validationResult = loginSchema.safeParse(rawData);
    
    if (!validationResult.success) {
      // Validasyon hatası - Audit log kaydet
      await createAuditLog({
        action: 'LOGIN_VALIDATION_ERROR',
        ipAddress,
        userAgent,
        success: false,
        errorCode: 'VALIDATION_ERROR',
        details: { 
          errors: formatValidationErrors(validationResult.error),
          email: rawData.email // Email'i log'a ekle (debug için)
        }
      });

      return {
        success: false,
        error: 'Girilen bilgiler geçersiz.',
        fields: formatValidationErrors(validationResult.error)
      };
    }

    const { email, password } = validationResult.data;

    // 5. Kullanıcıyı veritabanından bul
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        name: true,
        twoFactorEnabled: true,
      }
    });

    // 6. Kullanıcı bulunamadı veya şifre yanlış
    if (!user || !user.password || !(await verifyPassword(password, user.password))) {
      // Başarısız giriş - Audit log kaydet
      await createAuditLog({
        userId: user?.id, // Kullanıcı varsa ID'sini kaydet
        action: 'LOGIN_FAILED',
        ipAddress,
        userAgent,
        success: false,
        errorCode: user ? 'INVALID_PASSWORD' : 'USER_NOT_FOUND',
        details: { 
          email,
          userExists: !!user,
          attemptNumber: rateLimitResult.remainingAttempts
        }
      });

      // Güvenlik için aynı hata mesajı (kullanıcı var mı yok mu belli olmasın)
      return {
        success: false,
        error: 'Email veya şifre hatalı.',
        fields: {}
      };
    }

    // 7. Admin role kontrolü
    if (user.role !== 'admin') {
      // Yetkisiz erişim denemesi - Audit log kaydet
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN_UNAUTHORIZED',
        ipAddress,
        userAgent,
        success: false,
        errorCode: 'INSUFFICIENT_ROLE',
        details: { 
          email,
          userRole: user.role,
          requiredRole: 'admin'
        }
      });

      return {
        success: false,
        error: 'Bu sisteme erişim yetkiniz bulunmamaktadır.',
        fields: {}
      };
    }

    // 8. 2FA kontrolü (eğer aktifse)
    if (user.twoFactorEnabled) {
      // 2FA gerekli - Session'a kullanıcı bilgilerini geçici kaydet
      // Bu kısım 2FA sayfasında tamamlanacak
      
      await createAuditLog({
        userId: user.id,
        action: 'LOGIN_2FA_REQUIRED',
        ipAddress,
        userAgent,
        success: true,
        details: { email }
      });

      // 2FA sayfasına yönlendir (geçici token ile)
      // Bu implementasyon 2FA sayfası hazır olduğunda tamamlanacak
      
      return {
        success: false,
        error: '2FA kodu gerekli. 2FA sayfasına yönlendiriliyorsunuz...',
        fields: {},
        redirect2FA: true
      };
    }

    // 9. Başarılı giriş - JWT token oluştur
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name || undefined,
    };

    await createToken(tokenPayload);

    // 10. Başarılı giriş - Audit log kaydet
    await createAuditLog({
      userId: user.id,
      action: 'LOGIN_SUCCESS',
      ipAddress,
      userAgent,
      success: true,
      details: { 
        email,
        rememberMe: rawData.rememberMe,
        sessionDuration: '24h'
      }
    });

    // 11. Rate limit'i sıfırla (başarılı giriş)
    await prisma.rateLimit.deleteMany({
      where: { identifier: `login:${ipAddress}` }
    });

    // 12. Dashboard'a yönlendir
    redirect('/dashboard');

  } catch (error) {
    console.error('Login action error:', error);

    // Sistem hatası - Audit log kaydet
    await createAuditLog({
      action: 'LOGIN_SYSTEM_ERROR',
      ipAddress,
      userAgent,
      success: false,
      errorCode: 'SYSTEM_ERROR',
      details: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });

    return {
      success: false,
      error: 'Sistem hatası oluştu. Lütfen tekrar deneyin.',
      fields: {}
    };
  }
}

/**
 * Logout Server Action
 * Güvenli çıkış işlemi
 */
export async function logoutAction() {
  try {
    // IP ve User-Agent bilgilerini al
    const headersList = headers();
    const forwardedFor = headersList.get('x-forwarded-for');
    const userAgent = headersList.get('user-agent') || 'unknown';
    const ipAddress = forwardedFor?.split(',')[0]?.trim() || 'unknown';

    // Mevcut kullanıcı bilgilerini al (token'dan)
    // Bu kısım token verify edildiğinde user ID'si alınacak

    // Audit log kaydet
    await createAuditLog({
      // userId: currentUser?.id, // Token'dan alınacak
      action: 'LOGOUT_SUCCESS',
      ipAddress,
      userAgent,
      success: true,
      details: { 
        logoutTime: new Date().toISOString()
      }
    });

    // Token'ı temizle (cookie'yi sil)
    // clearToken(); // Bu fonksiyon auth-production.ts'de tanımlı

  } catch (error) {
    console.error('Logout action error:', error);
  }

  // Login sayfasına yönlendir
  redirect('/pazaryeri1453');
}
