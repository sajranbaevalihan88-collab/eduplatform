import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { X, Eye, EyeOff } from 'lucide-react'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'

type NavItem = { to: string; label: string }

/** Панель доступности: режим слабовидящих + быстрый переход по разделам. */
export default function A11yPanel({ open, onClose, items = [] }: { open: boolean; onClose: () => void; items?: NavItem[] }) {
  const { poor, toggle, fontScale, setFont } = useAccessibility()
  const { t } = useLang()
  const boxRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

  // Esc — закрыть панель; Tab — цикл внутри модального окна.
  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement as HTMLElement | null
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return }
      if (e.key !== 'Tab' || !boxRef.current) return
      const focusables = Array.from(boxRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ))
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    const id = setTimeout(() => boxRef.current?.focus(), 30)
    return () => {
      window.removeEventListener('keydown', onKey)
      clearTimeout(id)
    }
  }, [open, onClose])

  // При закрытии возвращаем фокус туда, откуда открыли.
  useEffect(() => {
    if (open) return
    openerRef.current?.focus?.()
    openerRef.current = null
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-16 p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="a11y-title">
      <div ref={boxRef} tabIndex={-1} onClick={e => e.stopPropagation()} className="w-[480px] max-w-full bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 space-y-4 max-h-[85vh] overflow-auto animate-scaleIn outline-none">
        <div className="flex items-center justify-between">
          <h2 id="a11y-title" className="font-bold text-lg dark:text-white">{t('a11y')}</h2>
          <button onClick={onClose} className="min-w-[44px] min-h-[44px] p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white flex items-center justify-center" aria-label={t('a11y_close')}><X size={18} /></button>
        </div>

        <nav aria-label={t('a11y_quick_nav')} className="rounded-2xl border border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
          <h3 className="font-bold text-sm dark:text-white">{t('a11y_quick_nav')}</h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{t('a11y_quick_nav_hint')}</p>
          <ul className="mt-2 space-y-1.5">
            {items.map((item, i) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onClose}
                  aria-label={`${i + 1}. ${item.label}`}
                  className="w-full min-h-[44px] px-3 py-2.5 rounded-xl bg-white dark:bg-slate-800 dark:text-white border border-slate-200 dark:border-slate-700 font-semibold flex items-center justify-between"
                >
                  <span>{item.label}</span>
                  <span aria-hidden="true" className="text-xs font-bold text-blue-700 dark:text-blue-300">Alt+{i + 1}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
          <div className="flex items-center gap-2 font-semibold text-sm dark:text-white">{poor ? <EyeOff size={17} /> : <Eye size={17} />} {t('a11y_poor')}</div>
          <button onClick={toggle} aria-label={t('a11y_poor')} aria-pressed={poor} className={`w-14 min-h-[44px] rounded-full transition shrink-0 ${poor ? 'bg-amber-400' : 'bg-slate-300'} relative`}>
            <span className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white transition-all ${poor ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        {poor && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm dark:text-white">
            <div className="font-semibold mb-2">{t('font_label')}</div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setFont(fontScale - 10)} className="px-3 min-h-[44px] rounded-xl bg-white dark:bg-slate-700 border dark:border-slate-600 font-bold">A−</button>
              <span className="font-bold w-12 text-center">{fontScale}%</span>
              <button onClick={() => setFont(fontScale + 10)} className="px-3 min-h-[44px] rounded-xl bg-white dark:bg-slate-700 border dark:border-slate-600 font-bold">A+</button>
              <span className="w-full sm:w-auto sm:ml-1 flex gap-1.5">
                {([100, 125, 150] as const).map(v => (
                  <button key={v} onClick={() => setFont(v)} aria-pressed={fontScale === v}
                    className={`px-3 min-h-[44px] rounded-xl font-bold border ${fontScale === v ? 'bg-amber-400 border-amber-500 text-slate-900' : 'bg-white dark:bg-slate-700 dark:text-white dark:border-slate-600'}`}>{v}%</button>
                ))}
              </span>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-blue-100 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
          <div className="font-bold text-sm dark:text-white mb-1">{t('a11y_howto')}</div>
          <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
            {t('a11y_poor_hint')}
          </div>
        </div>

        <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
          {t('a11y_hotkeys')}
        </div>
      </div>
    </div>
  )
}
