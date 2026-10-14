import { useEffect, useState } from 'react'
import { X, Eye, EyeOff, Volume2, VolumeX, Check } from 'lucide-react'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'

/** Панель доступности: голос, шрифт, контраст — открывается из шапки. */
export default function A11yPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { poor, toggle, fontScale, setFont, speech, toggleSpeech, rate, setRate, volume, setVolume, voiceLang, setLang, speak } = useAccessibility()
  const { t, lang } = useLang()
  const [voices, setVoices] = useState(0)
  useEffect(() => {
    if (!open) return
    const upd = () => {
      try { setVoices(window.speechSynthesis?.getVoices()?.length || 0) } catch { setVoices(0) }
    }
    upd()
    const t = setTimeout(upd, 800)
    try {
      if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = upd as any
    } catch {}
    return () => clearTimeout(t)
  }, [open ])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-16 p-4" onClick={onClose} role="dialog" aria-label={t('a11y_settings')}>
      <div onClick={e => e.stopPropagation()} className="w-[480px] max-w-full bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 space-y-4 max-h-[85vh] overflow-auto animate-scaleIn">
        <div className="flex items-center justify-between">
          <div className="font-bold text-lg dark:text-white">{t('a11y')}</div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 dark:text-white" aria-label={t('a11y_close')}><X size={18} /></button>
        </div>

        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
          <div className="flex items-center gap-2 font-semibold text-sm dark:text-white">{poor ? <EyeOff size={17} /> : <Eye size={17} />} {t('a11y_poor')}</div>
          <button onClick={toggle} aria-pressed={poor} className={`w-12 h-7 rounded-full transition shrink-0 ${poor ? 'bg-amber-400' : 'bg-slate-300'} relative`}>
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${poor ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        {poor && (
          <div className="flex items-center gap-2 text-sm dark:text-white">
            <span className="font-semibold">{t('font_label')}</span>
            <button onClick={() => setFont(fontScale - 10)} className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border dark:border-slate-600 font-bold">A−</button>
            <span className="font-bold w-12 text-center">{fontScale}%</span>
            <button onClick={() => setFont(fontScale + 10)} className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-700 border dark:border-slate-600 font-bold">A+</button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
          <div className="flex items-center gap-2 font-semibold text-sm dark:text-white">{speech ? <Volume2 size={17} /> : <VolumeX size={17} />} {t('a11y_speech')}</div>
          <button onClick={toggleSpeech} aria-pressed={speech} className={`w-12 h-7 rounded-full transition shrink-0 ${speech ? 'bg-blue-600' : 'bg-slate-300'} relative`}>
            <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${speech ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        {speech && (
          <div className="space-y-3 text-sm dark:text-white">
            <div className="flex items-center gap-2">
              <span className="font-semibold w-24">{t('a11y_lang')}</span>
              {(['ru', 'kg', 'en'] as const).map(l => (
                <button key={l} onClick={() => setLang(l)} aria-pressed={voiceLang === l}
                  className={`px-3 py-1.5 rounded-xl font-bold ${voiceLang === l ? 'bg-blue-600 text-white' : 'bg-white dark:bg-slate-700 border dark:border-slate-600'}`}>
                  {l === 'ru' ? 'RU' : l === 'kg' ? 'KG' : 'EN'}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold w-24">{t('a11y_rate')} {rate.toFixed(1)}x</span>
              <input type="range" min={0.5} max={2} step={0.1} value={rate} onChange={e => setRate(parseFloat(e.target.value))} className="flex-1" aria-label={t('a11y_rate')} />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold w-24">{t('a11y_volume')} {Math.round(volume * 100)}%</span>
              <input type="range" min={0.1} max={1} step={0.1} value={volume} onChange={e => setVolume(parseFloat(e.target.value))} className="flex-1" aria-label={t('a11y_volume')} />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => speak(lang === 'kg' ? 'Салам! Бул үндүн текшерүүсү.' : lang === 'en' ? 'Hello! This is a voice check.' : 'Привет! Это проверка голоса.')} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-bold flex items-center gap-1">
                <Check size={15} /> {t('a11y_check_voice')}
              </button>
              <span className="text-xs text-slate-500 dark:text-slate-400">{voices > 0 ? `${t('a11y_voices')}${voices}` : t('a11y_no_voice')}</span>
            </div>
          </div>
        )}

        <a href="/guide" onClick={onClose} className="flex items-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold">
          {t('a11y_guide')}
        </a>
        <div className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
          {t('a11y_hotkeys')}
        </div>
      </div>
    </div>
  )
}
