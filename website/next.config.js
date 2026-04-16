/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Environment variables for client-side
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:7130',
    NEXT_PUBLIC_PREVIEW_URL: process.env.NEXT_PUBLIC_PREVIEW_URL || 'http://localhost:19006',
  },
};

module.exports = nextConfig;
