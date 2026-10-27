import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Download, X } from 'lucide-react'
import { useLang } from '../context/LangContext'

interface BIPEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

// «Погружённые» экраны: не мешать установочным баннером в редакторах и играх
const IMMERSIVE = /^(\/games\/.+|\/presentations\/(new|\d+(\/edit)?)|\/lessons\/new|\/lessons\/\d+\/edit|\/tests\/new|\/tests\/\d+\/(edit|take)|\/board(\/\d+)?$|\/editor$|\/word$)/

/** Карточка «Установить приложение»: показывается, когда браузер разрешает
 *  установку PWA (beforeinstallprompt). Скрыта в standalone, после отказа и в редакторах/играх. */
export default function InstallPWA() {
  const { t } = useLang()
  const { pathname } = useLocation()
  const [promptEvent, setPromptEvent] = useState<BIPEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem('pwa-install-dismiss') === '1') { setDismissed(true); return }
      const standalone = window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true
      if (standalone) { setDismissed(true); return }
    } catch { /* приватный режим — просто показываем по событию */ }
    const onBIP = (e: Event) => {
      e.preventDefault()
      setPromptEvent(e as BIPEvent)
    }
    const onInstalled = () => setPromptEvent(null)
    window.addEventListener('beforeinstallprompt', onBIP)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBIP)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    setDismissed(true)
    try { localStorage.setItem('pwa-install-dismiss', '1') } catch {}
  }

  if (!promptEvent || dismissed || IMMERSIVE.test(pathname)) return null
  return (
    <div className="fixed right-3 bottom-24 lg:bottom-6 z-30 max-w-[290px] bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-600 rounded-2xl shadow-xl p-3 flex items-center gap-3 animate-enterUp">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 flex items-center justify-center text-white shrink-0 shadow-md shadow-blue-600/30">
        <Download size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-slate-900 dark:text-white leading-tight">{t('install_title')}</div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">{t('install_sub')}</div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <button
          onClick={async () => { try { await promptEvent.prompt(); await promptEvent.userChoice } catch {} setPromptEvent(null) }}
          className="px-3 py-1.5 rounded-lg bg-blue-700 dark:bg-white dark:text-slate-900 text-white text-xs font-bold btn-hover shadow-md">
          {t('install_btn')}
        </button>
        <button onClick={dismiss} className="text-[10px] text-slate-400 dark:text-slate-500 px-2 flex items-center gap-1"><X size={9} />{t('install_later')}</button>
      </div>
    </div>
  )
}
