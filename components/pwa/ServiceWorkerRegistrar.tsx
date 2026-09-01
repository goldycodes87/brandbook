'use client'

import { useEffect } from 'react'

/**
 * Registers the service worker, once, after the page is usable.
 *
 * Deliberately not blocking first paint: registering during hydration competes
 * with the work of actually showing somebody their herd. It waits for load,
 * which on a slow connection is exactly when it should get out of the way.
 *
 * Failure is silent on purpose. A browser with service workers disabled, or a
 * page served over plain http on somebody's local network, should carry on
 * working as an ordinary web app.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    if (document.readyState === 'complete') register()
    else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
