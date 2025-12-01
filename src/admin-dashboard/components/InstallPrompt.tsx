'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setIsVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return

    try {
      await deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      console.log(`PWA install outcome: ${outcome}`)

      setDeferredPrompt(null)
      setIsVisible(false)
    } catch (error) {
      console.error('Error installing PWA:', error)
    }
  }

  const handleDismiss = () => {
    setIsVisible(false)
  }

  if (!isVisible || !deferredPrompt) return null

  return (
    <div className="fixed bottom-4 right-4 bg-black text-white p-4 rounded-lg shadow-lg max-w-sm z-50">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm">Install OwnYou for offline access and a native app experience</p>
          <button
            onClick={handleDismiss}
            className="text-white hover:text-gray-300 transition-colors"
            aria-label="Dismiss install prompt"
          >
            ✕
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleInstall}
            className="flex-1 px-4 py-2 bg-white text-black rounded hover:bg-gray-200 transition-colors font-medium"
          >
            Install App
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 border border-white rounded hover:bg-white hover:text-black transition-colors"
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  )
}
