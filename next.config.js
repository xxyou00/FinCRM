/** @type {import('next').NextConfig} */
const nextConfig = {
  // Netlify 部署优化
  output: process.env.NETLIFY ? 'standalone' : undefined,
  
  // 跳过类型检查和 ESLint（加快构建）
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Turbopack 配置（Next.js 16+）
  turbopack: {},
  
  // 图片优化配置
  images: {
    domains: ['placeholder.svg'],
    unoptimized: process.env.NETLIFY ? true : false,
  },

  // 环境变量
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },
}

module.exports = nextConfig
