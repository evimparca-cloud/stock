import { z } from 'zod';

/**
 * Login formu validasyon şeması
 * Güvenlik odaklı sıkı validasyon kuralları
 */
export const loginSchema = z.object({
  // Email validasyonu - RFC 5322 uyumlu
  email: z
    .string()
    .min(1, 'Email adresi gereklidir')
    .email('Geçerli bir email adresi giriniz')
    .max(254, 'Email adresi çok uzun') // RFC 5321 limit
    .toLowerCase() // Normalize et
    .trim(), // Boşlukları temizle

  // Şifre validasyonu - Güvenlik odaklı
  password: z
    .string()
    .min(8, 'Şifre en az 8 karakter olmalıdır')
    .max(128, 'Şifre çok uzun') // DoS koruması
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Şifre en az 1 küçük harf, 1 büyük harf, 1 rakam ve 1 özel karakter içermelidir'
    ),

  // Honeypot field - Bot koruması
  // Bu alan kullanıcı tarafından görülmez, sadece botlar doldurur
  website: z
    .string()
    .max(0, 'Bot tespit edildi') // Boş olmalı
    .optional()
    .default(''),

  // CSRF koruması için token (opsiyonel)
  csrfToken: z.string().optional(),

  // Remember me checkbox
  rememberMe: z.boolean().optional().default(false),
});

/**
 * Şifre değiştirme validasyon şeması
 */
export const changePasswordSchema = z.object({
  currentPassword: z
    .string()
    .min(1, 'Mevcut şifre gereklidir')
    .max(128, 'Şifre çok uzun'),

  newPassword: z
    .string()
    .min(8, 'Yeni şifre en az 8 karakter olmalıdır')
    .max(128, 'Şifre çok uzun')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Şifre en az 1 küçük harf, 1 büyük harf, 1 rakam ve 1 özel karakter içermelidir'
    ),

  confirmPassword: z
    .string()
    .min(1, 'Şifre tekrarı gereklidir'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Şifreler eşleşmiyor',
  path: ['confirmPassword'],
});

/**
 * 2FA setup validasyon şeması
 */
export const twoFactorSchema = z.object({
  token: z
    .string()
    .min(6, '2FA kodu 6 haneli olmalıdır')
    .max(6, '2FA kodu 6 haneli olmalıdır')
    .regex(/^\d{6}$/, '2FA kodu sadece rakam içermelidir'),
});

/**
 * Admin kullanıcı oluşturma validasyon şeması
 */
export const createUserSchema = z.object({
  name: z
    .string()
    .min(2, 'İsim en az 2 karakter olmalıdır')
    .max(100, 'İsim çok uzun')
    .trim(),

  email: z
    .string()
    .min(1, 'Email adresi gereklidir')
    .email('Geçerli bir email adresi giriniz')
    .max(254, 'Email adresi çok uzun')
    .toLowerCase()
    .trim(),

  password: z
    .string()
    .min(8, 'Şifre en az 8 karakter olmalıdır')
    .max(128, 'Şifre çok uzun')
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
      'Şifre en az 1 küçük harf, 1 büyük harf, 1 rakam ve 1 özel karakter içermelidir'
    ),

  role: z
    .enum(['USER', 'ADMIN'])
    .default('USER'),
});

/**
 * Audit log filtreleme validasyon şeması
 */
export const auditLogFilterSchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, 'Sayfa numarası geçersiz')
    .transform(Number)
    .refine((n) => n > 0, 'Sayfa numarası 1\'den büyük olmalıdır')
    .default(1),

  limit: z
    .string()
    .regex(/^\d+$/, 'Limit geçersiz')
    .transform(Number)
    .refine((n) => n > 0 && n <= 100, 'Limit 1-100 arasında olmalıdır')
    .default(20),

  action: z
    .string()
    .max(50, 'Aksiyon filtresi çok uzun')
    .optional(),

  userId: z
    .string()
    .max(50, 'Kullanıcı ID çok uzun')
    .optional(),

  startDate: z
    .string()
    .datetime('Geçersiz tarih formatı')
    .optional(),

  endDate: z
    .string()
    .datetime('Geçersiz tarih formatı')
    .optional(),
});

/**
 * IP adresi validasyonu
 */
export const ipAddressSchema = z
  .string()
  .refine(
    (ip) => {
      // IPv4 regex
      const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      // IPv6 regex (basit)
      const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
      
      return ipv4Regex.test(ip) || ipv6Regex.test(ip) || ip === 'unknown';
    },
    'Geçersiz IP adresi formatı'
  );

/**
 * Güvenli string validasyonu (XSS koruması)
 */
export const safeStringSchema = (maxLength: number = 255) =>
  z
    .string()
    .max(maxLength, `Metin çok uzun (max: ${maxLength})`)
    .refine(
      (str) => {
        // Tehlikeli karakterleri kontrol et
        const dangerousChars = /<script|javascript:|data:|vbscript:|onload=|onerror=/i;
        return !dangerousChars.test(str);
      },
      'Güvenlik nedeniyle geçersiz karakterler tespit edildi'
    )
    .transform((str) => str.trim());

/**
 * Form validasyon hatalarını kullanıcı dostu mesajlara çevir
 */
export function formatValidationErrors(errors: z.ZodError): Record<string, string> {
  const formattedErrors: Record<string, string> = {};
  
  errors.issues.forEach((error: any) => {
    const path = error.path.join('.');
    formattedErrors[path] = error.message;
  });
  
  return formattedErrors;
}

/**
 * Honeypot kontrolü - Bot tespit etme
 */
export function checkHoneypot(data: any): boolean {
  // 'website' alanı dolu ise bot tespit edildi
  return !data.website || data.website.length === 0;
}

// Type exports
export type LoginFormData = z.infer<typeof loginSchema>;
export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;
export type TwoFactorFormData = z.infer<typeof twoFactorSchema>;
export type CreateUserFormData = z.infer<typeof createUserSchema>;
export type AuditLogFilterData = z.infer<typeof auditLogFilterSchema>;
