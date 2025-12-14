import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { WebhookProcessor } from '@/lib/webhook/processor';
import { WebhookSignature } from '@/lib/webhook/signature';

// POST /api/webhooks/hepsiburada - Hepsiburada webhook'larını yakala
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const payload = JSON.parse(body);
    
    // Signature verification
    const signature = request.headers.get('x-hepsiburada-signature');
    
    // Hepsiburada pazaryerini bul
    const marketplace = await prisma.marketplace.findFirst({
      where: { name: 'Hepsiburada' },
    });

    if (!marketplace) {
      return NextResponse.json(
        { error: 'Hepsiburada marketplace not found' },
        { status: 404 }
      );
    }

    // Signature doğrula (eğer varsa)
    if (signature && marketplace.apiSecret) {
      const isValid = WebhookSignature.verifyHepsiburada(
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
    console.error('Hepsiburada webhook error:', error);
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/webhooks/hepsiburada - Webhook endpoint test
export async function GET() {
  return NextResponse.json({
    message: 'Hepsiburada webhook endpoint is active',
    timestamp: new Date().toISOString(),
  });
}
