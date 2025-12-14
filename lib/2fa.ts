/**
 * 2FA (Two-Factor Authentication) Service
 * Google Authenticator / TOTP ile uyumlu
 */

import { authenticator } from 'otplib';
import QRCode from 'qrcode';

export interface TwoFactorSecret {
    secret: string;
    qrCode: string;
    backupCodes: string[];
}

export class TwoFactorAuth {
    /**
     * Kullanıcı için 2FA secret oluştur
     */
    static async generateSecret(email: string): Promise<TwoFactorSecret> {
        const secret = authenticator.generateSecret();
        const appName = 'Stock Management';
        const otpauth = authenticator.keyuri(email, appName, secret);

        // QR kod oluştur
        const qrCode = await QRCode.toDataURL(otpauth);

        // Yedek kodlar (8 adet)
        const backupCodes: string[] = [];
        for (let i = 0; i < 8; i++) {
            backupCodes.push(this.generateBackupCode());
        }

        return {
            secret,
            qrCode,
            backupCodes,
        };
    }

    /**
     * TOTP token doğrula
     */
    static verifyToken(secret: string, token: string): boolean {
        try {
            return authenticator.verify({ token, secret });
        } catch {
            return false;
        }
    }

    /**
     * Yedek kod oluştur
     */
    private static generateBackupCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    /**
     * Yedek kod doğrula
     */
    static async verifyBackupCode(userId: string, code: string): Promise<boolean> {
        try {
            const { prisma } = await import('./prisma');

            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { backupCodes: true },
            });

            if (!user?.backupCodes) return false;

            const backupCodes = user.backupCodes as unknown as string[];
            const index = backupCodes.indexOf(code);

            if (index === -1) return false;

            // Kullanılan kodu sil
            backupCodes.splice(index, 1);
            await prisma.user.update({
                where: { id: userId },
                data: { backupCodes },
            });

            return true;
        } catch {
            return false;
        }
    }
}
