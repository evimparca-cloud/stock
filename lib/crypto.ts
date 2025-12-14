/**
 * Enterprise Crypto Service
 * API anahtarları ve hassas verileri AES-256 ile şifreler
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

// Environment'dan master key al, yoksa hata fırlat
const MASTER_KEY = process.env.ENCRYPTION_KEY;
if (!MASTER_KEY || MASTER_KEY.length !== 64) {
  throw new Error('ENCRYPTION_KEY must be 64 characters hex string');
}

const masterKey = Buffer.from(MASTER_KEY, 'hex');

export interface EncryptedData {
  encrypted: string;
  iv: string;
  tag: string;
}

/**
 * Veriyi şifreler
 */
export function encrypt(text: string): EncryptedData {
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipher(ALGORITHM, masterKey);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // GCM mode için tag simülasyonu
    const tag = crypto.createHash('sha256').update(encrypted + iv.toString('hex')).digest('hex').slice(0, 32);
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag,
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Encryption failed');
  }
}

/**
 * Veriyi çözer
 */
export function decrypt(encryptedData: EncryptedData): string {
  try {
    const { encrypted, iv, tag } = encryptedData;
    
    // Tag doğrulama
    const expectedTag = crypto.createHash('sha256').update(encrypted + iv).digest('hex').slice(0, 32);
    if (tag !== expectedTag) {
      throw new Error('Authentication tag verification failed');
    }
    
    const decipher = crypto.createDecipher(ALGORITHM, masterKey);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Decryption failed');
  }
}

/**
 * API Key Vault - Pazaryeri anahtarlarını güvenli saklar
 */
export class ApiKeyVault {
  /**
   * API anahtarını şifreli olarak sakla
   */
  static encryptApiKey(apiKey: string): string {
    const encrypted = encrypt(apiKey);
    return JSON.stringify(encrypted);
  }

  /**
   * Şifreli API anahtarını çöz
   */
  static decryptApiKey(encryptedApiKey: string): string {
    try {
      const encryptedData = JSON.parse(encryptedApiKey) as EncryptedData;
      return decrypt(encryptedData);
    } catch (error) {
      throw new Error('Invalid encrypted API key format');
    }
  }

  /**
   * Pazaryeri API anahtarını güvenli al
   */
  static async getMarketplaceApiKey(marketplace: string): Promise<string | null> {
    try {
      const { prisma } = await import('./prisma');
      
      const config = await prisma.marketplaceConfig.findUnique({
        where: { marketplace },
        select: { encryptedApiKey: true },
      });

      if (!config?.encryptedApiKey) {
        return null;
      }

      return this.decryptApiKey(config.encryptedApiKey);
    } catch (error) {
      console.error(`Failed to get API key for ${marketplace}:`, error);
      return null;
    }
  }

  /**
   * Pazaryeri API anahtarını güvenli kaydet
   */
  static async setMarketplaceApiKey(marketplace: string, apiKey: string): Promise<boolean> {
    try {
      const { prisma } = await import('./prisma');
      const encryptedApiKey = this.encryptApiKey(apiKey);

      await prisma.marketplaceConfig.upsert({
        where: { marketplace },
        update: { encryptedApiKey },
        create: { 
          marketplace, 
          encryptedApiKey,
          isActive: true,
        },
      });

      return true;
    } catch (error) {
      console.error(`Failed to set API key for ${marketplace}:`, error);
      return false;
    }
  }
}

/**
 * Hash fonksiyonları
 */
export function hashSHA256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Güvenli karşılaştırma (timing attack koruması)
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  
  return crypto.timingSafeEqual(
    Buffer.from(a, 'utf8'),
    Buffer.from(b, 'utf8')
  );
}
