import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { 
  createPasswordResetToken, 
  sendPasswordResetEmail, 
  checkPasswordResetRateLimit 
} from '@/lib/password-reset';
import { createAuditLog, getClientIP, getUserAgent } from '@/lib/auth-production';
import { z } from 'zod';

// Validasyon şeması
const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, 'Email adresi gereklidir')
    .email('Geçerli bir email adresi giriniz')
    .toLowerCase()
    .trim(),
});

export async function POST(request: NextRequest) {
  const ipAddress = getClientIP(request);
  const userAgent = getUserAgent(request);

  try {
    // Request body'yi parse et
    const body = await request.json();
    
    // Validasyon
    const validationResult = forgotPasswordSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Geçerli bir email adresi giriniz.' 
        },
        { status: 400 }
      );
    }

    const { email } = validationResult.data;

    // Rate limiting kontrolü
    const rateLimitResult = await checkPasswordResetRateLimit(email, ipAddress);
    if (!rateLimitResult.allowed) {
      // Rate limit audit log
      await createAuditLog({
        action: 'PASSWORD_RESET_RATE_LIMITED',
        ipAddress,
        userAgent,
        success: false,
        errorCode: 'RATE_LIMIT_EXCEEDED',
        details: { 
          email,
          remainingTime: rateLimitResult.remainingTime 
        }
      });

      return NextResponse.json(
        { 
          success: false, 
          error: `Çok fazla şifre sıfırlama talebi. ${rateLimitResult.remainingTime} dakika sonra tekrar deneyin.` 
        },
        { status: 429 }
      );
    }

    // Kullanıcıyı bul
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, role: true }
    });

    // Güvenlik için: Kullanıcı bulunamasa bile başarılı mesaj ver
    // (Email adresi var mı yok mu belli olmasın)
    if (!user) {
      // Audit log - kullanıcı bulunamadı
      await createAuditLog({
        action: 'PASSWORD_RESET_USER_NOT_FOUND',
        ipAddress,
        userAgent,
        success: false,
        errorCode: 'USER_NOT_FOUND',
        details: { email }
      });

      // Yine de başarılı mesaj ver (güvenlik)
      return NextResponse.json({
        success: true,
        message: 'Eğer bu email adresi sistemde kayıtlıysa, şifre sıfırlama linki gönderildi.'
      });
    }

    // Admin kontrolü (sadece admin'ler şifre sıfırlayabilir)
    if (user.role !== 'admin') {
      await createAuditLog({
        userId: user.id,
        action: 'PASSWORD_RESET_UNAUTHORIZED',
        ipAddress,
        userAgent,
        success: false,
        errorCode: 'INSUFFICIENT_ROLE',
        details: { email, userRole: user.role }
      });

      // Yine de başarılı mesaj ver (güvenlik)
      return NextResponse.json({
        success: true,
        message: 'Eğer bu email adresi sistemde kayıtlıysa, şifre sıfırlama linki gönderildi.'
      });
    }

    // Şifre sıfırlama token'ı oluştur
    const resetToken = await createPasswordResetToken(user.id, ipAddress, userAgent);
    
    if (!resetToken) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Şifre sıfırlama token\'ı oluşturulamadı. Lütfen tekrar deneyin.' 
        },
        { status: 500 }
      );
    }

    // Email gönder
    const emailSent = await sendPasswordResetEmail(user.email, resetToken, user.name || undefined);
    
    if (!emailSent) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Email gönderilemedi. Lütfen tekrar deneyin.' 
        },
        { status: 500 }
      );
    }

    // Başarılı audit log
    await createAuditLog({
      userId: user.id,
      action: 'PASSWORD_RESET_EMAIL_SENT',
      ipAddress,
      userAgent,
      success: true,
      details: { 
        email,
        tokenExpires: new Date(Date.now() + 60 * 60 * 1000).toISOString()
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Şifre sıfırlama linki email adresinize gönderildi. Lütfen email\'inizi kontrol edin.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);

    // Sistem hatası audit log
    await createAuditLog({
      action: 'PASSWORD_RESET_SYSTEM_ERROR',
      ipAddress,
      userAgent,
      success: false,
      errorCode: 'SYSTEM_ERROR',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    });

    return NextResponse.json(
      { 
        success: false, 
        error: 'Sistem hatası oluştu. Lütfen tekrar deneyin.' 
      },
      { status: 500 }
    );
  }
}
