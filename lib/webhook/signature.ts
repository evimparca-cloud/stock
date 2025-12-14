import crypto from 'crypto';

export class WebhookSignature {
  /**
   * Trendyol webhook signature'ını doğrula
   */
  static verifyTrendyol(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('base64');
    
    return signature === expectedSignature;
  }

  /**
   * Hepsiburada webhook signature'ını doğrula
   */
  static verifyHepsiburada(
    payload: string,
    signature: string,
    secret: string
  ): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');
    
    return signature === expectedSignature;
  }

  /**
   * Generic HMAC-SHA256 verification
   */
  static verifyHmacSha256(
    payload: string,
    signature: string,
    secret: string,
    encoding: 'hex' | 'base64' = 'hex'
  ): boolean {
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest(encoding);
    
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }
}
