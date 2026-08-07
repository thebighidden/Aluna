import type { NextConfig } from 'next';

const apiOrigin = process.env.ALUNA_API_ORIGIN?.replace(/\/$/, '') ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  // Lets the dev server serve /_next assets when reached through a Cloudflare tunnel hostname.
  allowedDevOrigins: ['*.trycloudflare.com'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;
