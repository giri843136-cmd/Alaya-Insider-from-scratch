/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  images: {
    unoptimized: true,
  },
  // Low-memory production tuning
  poweredByHeader: false,
  async headers() {
    return [
      // Prevent CDN from caching admin pages — they reference JS chunks that change per build
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
          { key: 'Expires', value: '0' },
          { key: 'Surrogate-Control', value: 'no-store' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          // Prevent MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Control referrer info
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict browser features
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=()' },
          // Force HTTPS for 1 year (HSTS)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
          // Prevent page from being cached with sensitive data
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Content Security Policy - blocks inline scripts from unknown sources
          { key: 'Content-Security-Policy', value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            "img-src 'self' data: blob: https:",
            "connect-src 'self' https://www.google-analytics.com https://www.googletagmanager.com https://alaya-insider-api-production.up.railway.app https://www.google.com https://region1.google-analytics.com",
            "frame-ancestors 'self'",
            "form-action 'self'",
            "base-uri 'self'",
          ].join('; ') },
        ],
      },
    ];
  },
};

export default nextConfig;
