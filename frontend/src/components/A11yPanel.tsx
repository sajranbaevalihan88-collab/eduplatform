import { useEffect, useRef } from 'react'
import { X, Eye, EyeOff, Volume2, Square, RotateCcw, ImageOff, Underline, Type } from 'lucide-react'
import { useAccessibility, type ContrastScheme, type LetterSpacingMode } from '../context/UIContext'
import { useLang } from '../context/LangContext'

type NavItem = { to: string; label: string }

const SCHEMES: { id: ContrastScheme; label: string; bg: string; fg: string; border: string }[] = [
  { id: 'wb',   label: 'Белый',   bg: '#ffffff', fg: '#000000', border: '#000000' },
  { id: 'bw',   label: 'Чёрный',  bg: '#000000', fg: '#ffffff', border: '#ffffff' },
  { id: 'yb',   label: 'Жёлтый',  bg: '#000000', fg: '#ffea00', border: '#ffea00' },
  { id: 'blue', label: 'Голубой', bg: '#d8efff', fg: '#06264d', border: '#06264d' },
]

/** Панель доступности (ГОСТ Р 52872): крупный шрифт, 4 контрастные схемы, интервалы, озвучка. */
export default function A11yPanel({ open, onClose }: { open: boolean; onClose: () => void; items?: NavItem[] }) {
  const {
    poor, toggle, fontScale, setFont,
    contrastScheme, setContrastScheme,
    letterSpacing, setLetterSpacing,
    lineHeightMode, setLineHeightMode,
    hideImages, toggleHideImages,
    underlineLinks, toggleUnderlineLinks,
    resetA11y,
    speak, stopSpeak, rate, setRate,
  } = useAccessibility()
  const { t } = useLang()
  const boxRef = useRef<HTMLDivElement>(null)
  const openerRef = useRef<HTMLElement | null>(null)

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

  useEffect(() => {
    if (open) return
    openerRef.current?.focus?.()
    openerRef.current = null
  }, [open])

  const readCurrentPage = () => {
    const main = document.getElementById('main-content')
    const txt = (main?.innerText || document.body.innerText || '').trim()
    if (txt) speak(txt)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/55 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-title"
    >
      <div
        ref={boxRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="w-full sm:w-[500px] max-w-full bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 p-4 sm:p-5 space-y-4 max-h-[90dvh] overflow-y-auto outline-none shadow-2xl"
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-200 dark:border-slate-800">
          <h2 id="a11y-title" className="font-bold text-base sm:text-lg text-slate-900 dark:text-white flex items-center gap-2">
            {poor ? <EyeOff size={18} /> : <Eye size={18} />}
            <span>Версия для слабовидящих</span>
          </h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-white flex items-center justify-center"
            aria-label={t('a11y_close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Главный тумблер */}
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
          <div>
            <div className="font-bold text-sm text-slate-900 dark:text-white">{t('a11y_poor')}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Высокий контраст, крупный текст и отключение анимаций</div>
          </div>
          <button
            type="button"
            onClick={toggle}
            aria-label={t('a11y_poor')}
            aria-pressed={poor}
            className={`w-14 min-h-[40px] rounded-full transition shrink-0 relative ${poor ? 'bg-amber-400' : 'bg-slate-300 dark:bg-slate-600'}`}
          >
            <span className={`absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-white shadow transition-all ${poor ? 'left-7' : 'left-1'}`} />
          </button>
        </div>

        {/* Размер шрифта */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-1.5"><Type size={14} /> {t('font_label')}</span>
            <span className="font-mono text-sm">{poor ? `${fontScale}%` : '100%'}</span>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            <button
              type="button"
              onClick={() => setFont(fontScale - 15)}
              className="min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold text-sm text-slate-900 dark:text-white"
              aria-label="Уменьшить шрифт"
            >
              A−
            </button>
            {([100, 125, 150, 175] as const).map(v => (
              <button
                key={v}
                type="button"
                onClick={() => setFont(v)}
                aria-pressed={poor && fontScale === v}
                className={`min-h-[44px] rounded-xl font-bold text-xs sm:text-sm border ${
                  poor && fontScale === v
                    ? 'bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 border-slate-900 dark:border-amber-500'
                    : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600'
                }`}
              >
                {v}%
              </button>
            ))}
            <button
              type="button"
              onClick={() => setFont(fontScale + 15)}
              className="min-h-[44px] rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 font-bold text-sm text-slate-900 dark:text-white"
              aria-label="Увеличить шрифт"
            >
              A+
            </button>
          </div>
        </div>

        {/* 4 цветовые схемы по ГОСТ */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">Цветовая схема (контраст)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {SCHEMES.map(sc => {
              const active = poor && contrastScheme === sc.id
              return (
                <button
                  key={sc.id}
                  type="button"
                  data-a11y-swatch={sc.id}
                  onClick={() => setContrastScheme(sc.id)}
                  aria-pressed={active}
                  style={{ backgroundColor: sc.bg, color: sc.fg, borderColor: sc.border }}
                  className={`min-h-[52px] px-2 py-2 rounded-xl border-2 font-bold flex flex-col items-center justify-center gap-0.5 transition ${
                    active ? 'ring-2 ring-offset-2 ring-blue-500' : ''
                  }`}
                >
                  <span className="text-base leading-none font-black">Аа</span>
                  <span className="text-[11px]">{sc.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Интервалы, картинки и ссылки */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3">
          <div>
            <div className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">Межбуквенный интервал</div>
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { id: 'normal', label: 'Обычный' },
                { id: 'wide', label: 'Средний' },
                { id: 'xwide', label: 'Широкий' },
              ] as { id: LetterSpacingMode; label: string }[]).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setLetterSpacing(opt.id)}
                  aria-pressed={poor && letterSpacing === opt.id}
                  className={`min-h-[42px] rounded-xl text-xs font-bold border ${
                    poor && letterSpacing === opt.id
                      ? 'bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 border-slate-900'
                      : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setLineHeightMode(lineHeightMode === 'large' ? 'normal' : 'large')}
              aria-pressed={poor && lineHeightMode === 'large'}
              className={`min-h-[44px] px-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                poor && lineHeightMode === 'large'
                  ? 'bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 border-slate-900'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600'
              }`}
            >
              Строки 2×
            </button>
            <button
              type="button"
              onClick={toggleUnderlineLinks}
              aria-pressed={poor && underlineLinks}
              className={`min-h-[44px] px-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                poor && underlineLinks
                  ? 'bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 border-slate-900'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600'
              }`}
            >
              <Underline size={14} /> Ссылки
            </button>
            <button
              type="button"
              onClick={toggleHideImages}
              aria-pressed={poor && hideImages}
              className={`min-h-[44px] px-2.5 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 ${
                poor && hideImages
                  ? 'bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 border-slate-900'
                  : 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white border-slate-300 dark:border-slate-600'
              }`}
            >
              <ImageOff size={14} /> Без фото
            </button>
          </div>
        </div>

        {/* Озвучивание страницы */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-2.5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-1.5"><Volume2 size={14} /> Озвучивание текста</span>
            <span className="font-mono text-[11px]">Скорость {rate}×</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={readCurrentPage}
              className="flex-1 min-h-[44px] px-3 rounded-xl bg-slate-900 dark:bg-indigo-600 text-white font-bold text-xs flex items-center justify-center gap-1.5"
            >
              <Volume2 size={14} /> Прочитать страницу
            </button>
            <button
              type="button"
              onClick={stopSpeak}
              className="min-h-[44px] px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white font-bold text-xs flex items-center gap-1"
            >
              <Square size={12} /> Стоп
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {([0.8, 1, 1.25] as const).map(sp => (
              <button
                key={sp}
                type="button"
                onClick={() => setRate(sp)}
                aria-pressed={Math.abs(rate - sp) < 0.05}
                className={`min-h-[38px] rounded-lg text-xs font-bold border ${
                  Math.abs(rate - sp) < 0.05
                    ? 'bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-950 border-slate-900'
                    : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'
                }`}
              >
                {sp}×
              </button>
            ))}
          </div>
        </div>

        {/* Сброс к обычной версии */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => { resetA11y(); onClose() }}
            className="min-h-[44px] px-4 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold flex items-center gap-1.5"
          >
            <RotateCcw size={14} /> Обычная версия сайта
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-bold"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  )
}
