import { useCallback, useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

// Module-level capture so even if beforeinstallprompt fires before React mounts, we don't miss it
let deferredPromptGlobal: BeforeInstallPromptEvent | null = null
const promptListeners = new Set<() => void>()

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredPromptGlobal = e as BeforeInstallPromptEvent
    promptListeners.forEach((fn) => fn())
  })
}

export function clearPwaApiCache() {
  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_API_CACHE' })
    }
  } catch {}
}

export function usePWA() {
  const [canPrompt, setCanPrompt] = useState<boolean>(() => Boolean(deferredPromptGlobal))
  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const standaloneMq = window.matchMedia?.('(display-mode: standalone)').matches
    const iosStandalone = (window.navigator as any).standalone === true
    return Boolean(standaloneMq || iosStandalone)
  })
  const [updateReady, setUpdateReady] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)
  const [showIosGuide, setShowIosGuide] = useState(false)

  const isIos =
    typeof navigator !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !(window as any).MSStream

  useEffect(() => {
    const syncPrompt = () => setCanPrompt(Boolean(deferredPromptGlobal))
    promptListeners.add(syncPrompt)

    const onInstalled = () => {
      deferredPromptGlobal = null
      setCanPrompt(false)
      setIsInstalled(true)
    }
    window.addEventListener('appinstalled', onInstalled)

    const mq = window.matchMedia?.('(display-mode: standalone)')
    const onMq = (e: MediaQueryListEvent) => {
      if (e.matches) setIsInstalled(true)
    }
    mq?.addEventListener?.('change', onMq)

    const onSwUpdate = (e: Event) => {
      const sw = (e as CustomEvent).detail as ServiceWorker | null
      if (sw) {
        setWaitingWorker(sw)
        setUpdateReady(true)
      }
    }
    window.addEventListener('pwa-update-ready', onSwUpdate)

    return () => {
      promptListeners.delete(syncPrompt)
      window.removeEventListener('appinstalled', onInstalled)
      mq?.removeEventListener?.('change', onMq)
      window.removeEventListener('pwa-update-ready', onSwUpdate)
    }
  }, [])

  const install = useCallback(async () => {
    if (deferredPromptGlobal) {
      try {
        await deferredPromptGlobal.prompt()
        const choice = await deferredPromptGlobal.userChoice
        if (choice.outcome === 'accepted') {
          deferredPromptGlobal = null
          setCanPrompt(false)
          setIsInstalled(true)
          return 'accepted'
        }
        return 'dismissed'
      } catch {
        return 'error'
      }
    }
    if (isIos && !isInstalled) {
      setShowIosGuide(true)
      return 'ios-guide'
    }
    return 'unavailable'
  }, [isIos, isInstalled])

  const applyUpdate = useCallback(() => {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' })
    }
    setUpdateReady(false)
    window.location.reload()
  }, [waitingWorker])

  return {
    canInstall: !isInstalled && (canPrompt || isIos),
    canPrompt,
    isIos,
    isInstalled,
    install,
    updateReady,
    applyUpdate,
    showIosGuide,
    setShowIosGuide,
  }
}
