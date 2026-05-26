import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Brand Book',
    short_name: 'Brand Book',
    description: 'Ranch OS by ranchers, for ranchers',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#080808',
    theme_color: '#080808',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-1024.png', sizes: '1024x1024', type: 'image/png', purpose: 'any' },
    ],
  }
}
