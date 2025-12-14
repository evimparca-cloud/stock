import { NextRequest, NextResponse } from 'next/server';

// GET /api/proxy-image - Proxy external images to bypass CORS
export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
        return NextResponse.json({ error: 'URL parameter required' }, { status: 400 });
    }

    try {
        // Validate URL is from allowed domains
        const allowedDomains = [
            'cdn.dsmcdn.com',      // Trendyol CDN
            'img-trendyol.mncdn.com',
            'images.hepsiburada.net',
        ];

        const parsedUrl = new URL(url);
        if (!allowedDomains.some(domain => parsedUrl.hostname.endsWith(domain))) {
            return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 });
        }

        // Fetch the image
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://www.trendyol.com/',
            },
        });

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch image' }, { status: response.status });
        }

        // Get the image data
        const imageBuffer = await response.arrayBuffer();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        // Return the image with proper headers
        return new NextResponse(imageBuffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (error) {
        console.error('Proxy image error:', error);
        return NextResponse.json(
            { error: 'Failed to proxy image' },
            { status: 500 }
        );
    }
}
