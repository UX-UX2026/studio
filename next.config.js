/** @type {import('next').NextConfig} */
const nextConfig = {
  serverComponentsExternalPackages: ['require-in-the-middle'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'ubuntupathways.org',
        port: '',
        pathname: '/**',
      }
    ],
  },
};

module.exports = nextConfig;
