import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

interface RateLimitResult {
    allowed: boolean;
    remainingTime?: number; // in minutes
}

/**
 * Create a password reset token for a user
 */
export async function createPasswordResetToken(
    userId: string,
    ipAddress: string,
    userAgent: string
): Promise<string | null> {
    try {
        // Generate secure random token
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Delete any existing tokens for this user
        await prisma.passwordResetToken.deleteMany({
            where: { userId },
        });

        // Create new token
        await prisma.passwordResetToken.create({
            data: {
                userId,
                token,
                expires,
                ipAddress,
                userAgent,
            },
        });

        return token;
    } catch (error) {
        console.error('Error creating password reset token:', error);
        return null;
    }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
    email: string,
    token: string,
    name?: string
): Promise<boolean> {
    try {
        // In production, you would use an email service like SendGrid, AWS SES, etc.
        // For now, we'll just log it (development)

        const resetUrl = `${process.env.NEXTAUTH_URL}/auth/reset-password?token=${token}`;

        console.log('Password Reset Email:');
        console.log('To:', email);
        console.log('Name:', name || 'User');
        console.log('Reset URL:', resetUrl);
        console.log('Token expires in 1 hour');

        // TODO: In production, implement actual email sending
        // Example with SendGrid:
        // await sendgrid.send({
        //   to: email,
        //   from: 'noreply@yourdomain.com',
        //   subject: 'Şifre Sıfırlama Talebi',
        //   html: `<p>Merhaba ${name},</p>
        //          <p>Şifrenizi sıfırlamak için <a href="${resetUrl}">buraya tıklayın</a></p>
        //          <p>Link 1 saat geçerlidir.</p>`
        // });

        return true;
    } catch (error) {
        console.error('Error sending password reset email:', error);
        return false;
    }
}

/**
 * Check password reset rate limit
 */
export async function checkPasswordResetRateLimit(
    email: string,
    ipAddress: string
): Promise<RateLimitResult> {
    try {
        const now = new Date();
        const fifteenMinutesAgo = new Date(now.getTime() - 15 * 60 * 1000);

        // Check recent attempts by email
        const recentAttempts = await prisma.passwordResetToken.count({
            where: {
                user: { email },
                createdAt: { gte: fifteenMinutesAgo },
            },
        });

        // Check recent attempts by IP
        const ipAttempts = await prisma.passwordResetToken.count({
            where: {
                ipAddress,
                createdAt: { gte: fifteenMinutesAgo },
            },
        });

        // Allow max 3 attempts per email or 5 attempts per IP in 15 minutes
        if (recentAttempts >= 3 || ipAttempts >= 5) {
            return {
                allowed: false,
                remainingTime: 15,
            };
        }

        return { allowed: true };
    } catch (error) {
        console.error('Error checking password reset rate limit:', error);
        // If there's an error, allow the request (fail open for better UX)
        return { allowed: true };
    }
}

/**
 * Verify and consume a password reset token
 */
export async function verifyPasswordResetToken(
    token: string
): Promise<{ valid: boolean; userId?: string }> {
    try {
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
            include: { user: true },
        });

        if (!resetToken) {
            return { valid: false };
        }

        // Check if token is expired
        if (resetToken.expires < new Date()) {
            // Delete expired token
            await prisma.passwordResetToken.delete({
                where: { id: resetToken.id },
            });
            return { valid: false };
        }

        // Check if token was already used
        if (resetToken.used) {
            return { valid: false };
        }

        return {
            valid: true,
            userId: resetToken.userId,
        };
    } catch (error) {
        console.error('Error verifying password reset token:', error);
        return { valid: false };
    }
}

/**
 * Mark a password reset token as used
 */
export async function consumePasswordResetToken(token: string): Promise<boolean> {
    try {
        await prisma.passwordResetToken.update({
            where: { token },
            data: { used: true },
        });
        return true;
    } catch (error) {
        console.error('Error consuming password reset token:', error);
        return false;
    }
}
