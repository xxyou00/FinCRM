/** @type {import('next').NextConfig} */
const nextConfig = {
  // Netlify 部署优化
  output: process.env.NETLIFY ? 'standalone' : undefined,
  
  // 图片优化配置
  images: {
    domains: ['placeholder.svg'],
    unoptimized: process.env.NETLIFY ? true : false,
  },

  // 环境变量
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },

  // Webpack 配置
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    }
    return config
  },
}

module.exports = nextConfig
