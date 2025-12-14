import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WebhookProcessor } from '@/lib/webhook/processor';
import { WebhookSignature } from '@/lib/webhook/signature';

// POST /api/webhooks/trendyol - Trendyol webhook'larını yakala
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const payload = JSON.parse(body);
    
    // Signature verification (opsiyonel - Trendyol signature gönderiyorsa)
    const signature = request.headers.get('x-trendyol-signature');
    
    // Trendyol pazaryerini bul
    const marketplace = await prisma.marketplace.findFirst({
      where: { name: 'Trendyol' },
    });

    if (!marketplace) {
      return NextResponse.json(
        { error: 'Trendyol marketplace not found' },
        { status: 404 }
      );
    }

    // Signature doğrula (eğer varsa)
    if (signature && marketplace.apiSecret) {
      const isValid = WebhookSignature.verifyTrendyol(
        body,
        signature,
        marketplace.apiSecret
      );

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        );
      }
    }

    // Event type'ı belirle
    const eventType = payload.eventType || 
                     payload.type || 
                     (payload.orderNumber ? 'order.created' : 'unknown');

    // Webhook'u işle
    const result = await WebhookProcessor.process(
      marketplace.id,
      eventType,
      payload
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error('Trendyol webhook error:', error);
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/webhooks/trendyol - Webhook endpoint test
export async function GET() {
  return NextResponse.json({
    message: 'Trendyol webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
