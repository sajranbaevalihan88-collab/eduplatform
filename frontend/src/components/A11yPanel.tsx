import { useEffect, useRef } from 'react'
import { X, Eye, EyeOff, Volume2, Square, RotateCcw, ImageOff, Underline, Type } from 'lucide-react'
import { useAccessibility, type ContrastScheme, type LetterSpacingMode } from '../context/UIContext'
import { useLang } from '../context/LangContext'

type NavItem = { to: string; label: string }

const SCHEMES: {
  id: ContrastScheme
  label: string
  bg: string
  card: string
  fg: string
  accent: string
  border: string
}[] = [
  { id: 'wb',   label: 'Белый',   bg: '#ffffff', card: '#f1f5f9', fg: '#0f172a', accent: '#1e40af', border: '#cbd5e1' },
  { id: 'bw',   label: 'Чёрный',  bg: '#151b26', card: '#1e2736', fg: '#f8fafc', accent: '#93c5fd', border: '#334155' },
  { id: 'yb',   label: 'Жёлтый',  bg: '#1e1c14', card: '#29261b', fg: '#fde047', accent: '#facc15', border: '#6b5e22' },
  { id: 'blue', label: 'Голубой', bg: '#eaf3fe', card: '#dcecfd', fg: '#0b2545', accent: '#0f3b75', border: '#93c5fd' },
]

/** Панель доступности (ГОСТ Р 52872 / WCAG AAA): крупный шрифт, 4 мягкие контрастные темы, интервалы, озвучка. */
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
      className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-0 sm:p-[16px] transition-opacity duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="a11y-title"
    >
      <div
        ref={boxRef}
        data-a11y-panel="1"
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-[min(560px,calc(100vw-16px))] bg-white dark:bg-slate-900 rounded-t-[16px] sm:rounded-[16px] border border-slate-200/90 dark:border-slate-700/80 p-[14px] sm:p-[18px] flex flex-col gap-[10px] max-h-[92dvh] overflow-y-auto overflow-x-hidden outline-none shadow-2xl scrollbar-thin"
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between gap-[8px] pb-[8px] border-b border-slate-200/80 dark:border-slate-800">
          <h2 id="a11y-title" className="font-display font-bold text-[16px] leading-snug text-slate-900 dark:text-white flex items-center gap-[10px] min-w-0">
            <span className="w-[30px] h-[30px] rounded-[9px] bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              {poor ? <EyeOff size={16} /> : <Eye size={16} />}
            </span>
            <span className="truncate">Версия для слабовидящих</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[36px] min-h-[36px] p-[6px] rounded-[10px] hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-200 flex items-center justify-center shrink-0 transition-colors"
            aria-label={t('a11y_close')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Главный тумблер */}
        <div className="flex items-center justify-between gap-[12px] p-[11px] rounded-[12px] bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
          <div className="min-w-0">
            <div className="font-bold text-[13.5px] text-slate-900 dark:text-white leading-snug">{t('a11y_poor')}</div>
            <div className="text-[11.5px] text-slate-500 dark:text-slate-400 mt-[2px] leading-snug">
              Высокий контраст, крупный текст и комфортные цвета
            </div>
          </div>
          <button
            type="button"
            data-a11y-switch="1"
            onClick={toggle}
            aria-label={t('a11y_poor')}
            aria-pressed={poor}
            className={`w-[52px] h-[30px] rounded-full transition-colors duration-200 shrink-0 relative border ${
              poor
                ? 'bg-indigo-600 border-indigo-600'
                : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'
            }`}
          >
            <span
              data-a11y-knob="1"
              className={`absolute top-1/2 -translate-y-1/2 w-[22px] h-[22px] rounded-full bg-white shadow-sm transition-all duration-200 ${
                poor ? 'left-[26px]' : 'left-[3px]'
              }`}
            />
          </button>
        </div>

        {/* Размер шрифта — px-геометрия: кнопки никогда не переполняются даже при 200% масштабе сайта */}
        <div className="p-[11px] rounded-[12px] bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-[8px]">
          <div className="flex items-center justify-between gap-[8px] text-[12.5px] font-bold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-[6px]"><Type size={14} className="shrink-0" /> {t('font_label')}</span>
            <span className="font-mono text-[12.5px] px-[8px] py-[2px] rounded-[6px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
              {poor ? `${fontScale}%` : '100%'}
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-[7px]">
            <button
              type="button"
              data-a11y-nowrap="1"
              onClick={() => setFont(fontScale - 15)}
              className="min-h-[38px] px-[6px] py-[5px] rounded-[10px] bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-600 font-bold text-[13px] text-slate-800 dark:text-white flex items-center justify-center whitespace-nowrap transition-colors"
              aria-label="Уменьшить шрифт"
            >
              A−
            </button>
            {([100, 125, 150, 175] as const).map(v => (
              <button
                key={v}
                type="button"
                data-a11y-nowrap="1"
                onClick={() => setFont(v)}
                aria-pressed={poor && fontScale === v}
                className={`min-h-[38px] px-[6px] py-[5px] rounded-[10px] font-bold text-[13px] border flex items-center justify-center whitespace-nowrap transition-colors ${
                  poor && fontScale === v
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white border-slate-200 dark:border-slate-600'
                }`}
              >
                {v}%
              </button>
            ))}
            <button
              type="button"
              data-a11y-nowrap="1"
              onClick={() => setFont(fontScale + 15)}
              className="min-h-[38px] px-[6px] py-[5px] rounded-[10px] bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-600 font-bold text-[13px] text-slate-800 dark:text-white flex items-center justify-center whitespace-nowrap transition-colors"
              aria-label="Увеличить шрифт"
            >
              A+
            </button>
          </div>
        </div>

        {/* 4 цветовые схемы (мягкий контраст, в стиле основного сайта) */}
        <div className="p-[11px] rounded-[12px] bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-[8px]">
          <div className="text-[12.5px] font-bold text-slate-700 dark:text-slate-200">Цветовая схема (контраст)</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-[8px]">
            {SCHEMES.map(sc => {
              const active = poor && contrastScheme === sc.id
              return (
                <button
                  key={sc.id}
                  type="button"
                  data-a11y-swatch={sc.id}
                  onClick={() => setContrastScheme(sc.id)}
                  aria-pressed={active}
                  style={{ backgroundColor: sc.bg, color: sc.fg, borderColor: active ? sc.accent : sc.border }}
                  className={`min-h-[52px] px-[8px] py-[6px] rounded-[11px] border-2 font-bold flex flex-col items-center justify-center gap-[3px] transition-all duration-200 ${
                    active ? 'ring-2 ring-offset-2 ring-indigo-500 shadow-md' : 'hover:opacity-95 shadow-sm'
                  }`}
                >
                  <span className="text-[16px] leading-none font-extrabold" style={{ color: sc.fg }}>Аа</span>
                  <span className="text-[11px] font-semibold flex items-center gap-[5px] whitespace-nowrap" style={{ color: sc.fg }}>
                    <span className="w-[7px] h-[7px] rounded-full inline-block shrink-0" style={{ backgroundColor: sc.accent }} />
                    {sc.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Интервалы, картинки и ссылки */}
        <div className="p-[11px] rounded-[12px] bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-[8px]">
          <div>
            <div className="text-[12.5px] font-bold text-slate-700 dark:text-slate-200 mb-[6px]">Межбуквенный интервал</div>
            <div className="grid grid-cols-3 gap-[7px]">
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
                  className={`min-h-[36px] px-[8px] py-[5px] rounded-[10px] text-[12px] font-bold border flex items-center justify-center text-center transition-colors ${
                    poor && letterSpacing === opt.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white border-slate-200 dark:border-slate-600'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-[7px]">
            <button
              type="button"
              onClick={() => setLineHeightMode(lineHeightMode === 'large' ? 'normal' : 'large')}
              aria-pressed={poor && lineHeightMode === 'large'}
              className={`min-h-[38px] px-[10px] py-[5px] rounded-[10px] text-[12px] font-bold border flex items-center justify-center gap-[6px] transition-colors ${
                poor && lineHeightMode === 'large'
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white border-slate-200 dark:border-slate-600'
              }`}
            >
              Строки 2×
            </button>
            <button
              type="button"
              onClick={toggleUnderlineLinks}
              aria-pressed={poor && underlineLinks}
              className={`min-h-[38px] px-[10px] py-[5px] rounded-[10px] text-[12px] font-bold border flex items-center justify-center gap-[6px] transition-colors ${
                poor && underlineLinks
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white border-slate-200 dark:border-slate-600'
              }`}
            >
              <Underline size={14} className="shrink-0" /> Ссылки
            </button>
            <button
              type="button"
              onClick={toggleHideImages}
              aria-pressed={poor && hideImages}
              className={`min-h-[38px] px-[10px] py-[5px] rounded-[10px] text-[12px] font-bold border flex items-center justify-center gap-[6px] transition-colors ${
                poor && hideImages
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-white border-slate-200 dark:border-slate-600'
              }`}
            >
              <ImageOff size={14} className="shrink-0" /> Без фото
            </button>
          </div>
        </div>

        {/* Озвучивание страницы */}
        <div className="p-[11px] rounded-[12px] bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 flex flex-col gap-[8px]">
          <div className="flex items-center justify-between gap-[8px] text-[12.5px] font-bold text-slate-700 dark:text-slate-200">
            <span className="flex items-center gap-[6px]"><Volume2 size={14} className="shrink-0" /> Озвучивание текста</span>
            <span className="font-mono text-[12px] text-slate-500 dark:text-slate-400">Скорость {rate}×</span>
          </div>
          <div className="flex flex-wrap items-center gap-[7px]">
            <button
              type="button"
              onClick={readCurrentPage}
              className="flex-1 min-w-[160px] min-h-[38px] px-[14px] rounded-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[12.5px] flex items-center justify-center gap-[6px] transition-colors"
            >
              <Volume2 size={14} className="shrink-0" /> Прочитать страницу
            </button>
            <button
              type="button"
              onClick={stopSpeak}
              className="min-h-[38px] px-[14px] rounded-[10px] bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-800 dark:text-white font-bold text-[12.5px] flex items-center justify-center gap-[6px] transition-colors"
            >
              <Square size={12} className="shrink-0" /> Стоп
            </button>
          </div>
          <div className="grid grid-cols-3 gap-[7px]">
            {([0.8, 1, 1.25] as const).map(sp => (
              <button
                key={sp}
                type="button"
                data-a11y-nowrap="1"
                onClick={() => setRate(sp)}
                aria-pressed={Math.abs(rate - sp) < 0.05}
                className={`min-h-[34px] px-[8px] rounded-[9px] text-[12px] font-bold border flex items-center justify-center whitespace-nowrap transition-colors ${
                  Math.abs(rate - sp) < 0.05
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-600'
                }`}
              >
                {sp}×
              </button>
            ))}
          </div>
        </div>

        {/* Сброс к обычной версии */}
        <div className="flex flex-wrap items-center justify-between gap-[8px] pt-[2px]">
          <button
            type="button"
            onClick={() => { resetA11y(); onClose() }}
            className="min-h-[38px] px-[14px] rounded-[10px] border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-[12.5px] font-bold flex items-center justify-center gap-[6px] transition-colors"
          >
            <RotateCcw size={14} className="shrink-0" /> Обычная версия сайта
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] px-[20px] rounded-[10px] bg-indigo-600 hover:bg-indigo-700 text-white text-[12.5px] font-bold transition-colors"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  )
}
