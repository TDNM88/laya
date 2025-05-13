/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['tensorart.io'],
  },
  // Cấu hình allowedDevOrigins để cho phép cross-origin requests trong môi trường dev
  experimental: {
    allowedDevOrigins: ['192.168.1.26', 'localhost'],
  },
}

module.exports = nextConfig
