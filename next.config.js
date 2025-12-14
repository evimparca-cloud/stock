/** @type {import('next').NextConfig} */
const { withSentryConfig } = require('@sentry/nextjs');

const nextConfig = {
  output: 'standalone',
  experimental: {
    instrumentationHook: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Content Security Policy - Production Ready
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'nonce-{NONCE}' https://static.cloudflareinsights.com", // Cloudflare
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Google Fonts
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https: https://fonts.gstatic.com", // Google Fonts
              "connect-src 'self' https: https://git.parcaevim.com.tr", // Sentry/Glitchtip
              "media-src 'self' data:",
              "object-src 'none'", // Flash/Java applet koruması
              "base-uri 'self'", // Base tag koruması
              "form-action 'self'", // Form submit koruması
              "frame-ancestors 'none'", // Clickjacking koruması
              "upgrade-insecure-requests", // HTTP'yi HTTPS'e yönlendir
            ].join('; '),
          },
          // Security Headers
          {
            key: 'X-Frame-Options',
            value: 'DENY', // Clickjacking koruması
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff', // MIME sniffing koruması
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block', // XSS koruması
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          // HSTS (HTTPS zorunluluğu)
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          // Cross-Origin Policies
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
          // Server Information Hiding
          {
            key: 'Server',
            value: '', // Server bilgisini gizle
          },
          {
            key: 'X-Powered-By',
            value: '', // Next.js bilgisini gizle
          },
        ],
      },
    ];
  },
}

// Sentry configuration for GlitchTip compatibility
const sentryWebpackPluginOptions = {
  // Suppresses source map uploading logs during build
  silent: true,
  // GlitchTip doesn't need source map upload
  dryRun: true,
  // Disable telemetry
  telemetry: false,
};

module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
