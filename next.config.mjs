/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async redirects() {
    return [
      { source: '/tienda', destination: '/shop', permanent: true },
      { source: '/tienda/:path*', destination: '/shop/:path*', permanent: true },
      { source: '/blog', destination: '/news', permanent: true },
      { source: '/blog/:path*', destination: '/news/:path*', permanent: true },
      { source: '/foro', destination: '/forum', permanent: true },
      { source: '/foro/:path*', destination: '/forum/:path*', permanent: true },
      { source: '/modelos', destination: '/performers', permanent: true },
      { source: '/modelos/:path*', destination: '/performers/:path*', permanent: true },
      { source: '/suscripcion', destination: '/my-account/subscription', permanent: false },
      { source: '/mi-cuenta', destination: '/my-account', permanent: true },
      { source: '/mi-cuenta/suscripcion', destination: '/my-account/subscription', permanent: true },
      { source: '/mi-cuenta/historial-de-pagos', destination: '/my-account/payment-history', permanent: true },
      { source: '/mi-cuenta/favoritos', destination: '/my-account/favorites', permanent: true },
      { source: '/mi-cuenta/configuracion', destination: '/my-account/settings', permanent: true },
      { source: '/mi-cuenta/notifications', destination: '/my-account/notifications', permanent: true },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    loader: 'custom',
    loaderFile: './lib/cloudflare-image-loader.ts',
    deviceSizes: [800, 1280, 1920],
    imageSizes: [480],
  },
  serverExternalPackages: [
    '@prisma/client',
    '@prisma/adapter-pg',
    '@prisma/adapter-neon',
    '@neondatabase/serverless',
    'ws',
    '@prisma/client-runtime-utils',
    'pg',
    '@aws-sdk/client-s3',
    '@aws-sdk/s3-request-presigner',
  ],
  outputFileTracingIncludes: {
    '/**/*': [
      './node_modules/.prisma/**/*',
      './node_modules/@prisma/client/**/*',
      './node_modules/@prisma/client-runtime-utils/**/*',
      './node_modules/@prisma/adapter-pg/**/*',
      './node_modules/@prisma/adapter-neon/**/*',
    ],
  },
}

export default nextConfig
