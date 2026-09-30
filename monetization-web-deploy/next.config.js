/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@monetization/shared'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/:path*`,
      },
    ];
  },
  images: {
    domains: ['localhost', 'api.highkingflower.com', 'images.unsplash.com'],
  },
};

module.exports = nextConfig;