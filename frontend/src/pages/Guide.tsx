import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { Volume2, Keyboard, ArrowRight, Check } from 'lucide-react'

type Step = { title: string; text: string; to: string; link: string }

export default function Guide() {
  const { speak, stopSpeak, speech, toggleSpeech } = useAccessibility()
  const {t}=useLang()
  const [idx, setIdx] = useState(0)
  const [tour, setTour] = useState(false)

  /** Путеводитель для незрячих: стрелками ходишь по разделам, каждый озвучивается, Enter — открыть. */
  const STEPS: Step[] = [
    { title: t('guide_s1t'), text: t('guide_s1x'), to: '/lessons', link: t('guide_s1l') },
    { title: t('guide_s2t'), text: t('guide_s2x'), to: '/tests', link: t('guide_s2l') },
    { title: t('guide_s3t'), text: t('guide_s3x'), to: '/games/arkan', link: t('guide_s3l') },
    { title: t('guide_s4t'), text: t('guide_s4x'), to: '/games/sprint', link: t('guide_s4l') },
    { title: t('guide_s5t'), text: t('guide_s5x'), to: '/profile', link: t('guide_s5l') },
  ]

  const sayStep = (i: number) => {
    const s = STEPS[i]
    if (!s) return
    speak(`${t('guide_section')} ${i + 1} ${t('guide_of')} ${STEPS.length}. ${s.title}. ${s.text}`)
  }

  const startTour = () => {
    if (!speech) toggleSpeech()
    setTour(true)
    setTimeout(() => sayStep(0), 400)
  }

  useEffect(() => {
    if (!tour) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault()
        setIdx(i => {
          const n = Math.min(STEPS.length - 1, i + 1)
          setTimeout(() => sayStep(n), 50)
          return n
        })
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setIdx(i => {
          const n = Math.max(0, i - 1)
          setTimeout(() => sayStep(n), 50)
          return n
        })
      } else if (e.key === 'Enter') {
        const s = STEPS[idx]
        if (s) window.location.href = s.to
      } else if (e.key === 'Escape') {
        stopSpeak()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, idx, speech])

  useEffect(() => () => { try { stopSpeak() } catch {} }, [stopSpeak])

  return (
    <div className="max-w-3xl mx-auto space-y-5 page-enter">
      <div className="text-center space-y-2">
        <h1 className="font-display font-bold text-3xl dark:text-white">{t('guide_title')}</h1>
        <p className="text-slate-500 dark:text-slate-400">
          {t('guide_sub')}
        </p>
        {!tour ? (
          <button onClick={startTour} className="px-8 py-4 min-h-[64px] rounded-2xl bg-blue-600 text-white font-bold text-xl inline-flex items-center gap-2">
            <Volume2 size={22} /> {t('guide_start')}
          </button>
        ) : (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm" aria-live="polite">
            <Check size={15} /> {t('guide_tour_on')}
          </div>
        )}
      </div>

      <div className="space-y-3" role="list" aria-label={t('guide_list')}>
        {STEPS.map((s, i) => (
          <div key={s.to}
            role="listitem"
            className={`bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 flex items-center gap-4 ${tour && i === idx ? 'border-blue-500 ring-2 ring-blue-300' : ''}`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shrink-0 ${tour && i === idx ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 dark:text-white'}`}>
              {i + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-lg dark:text-white">{s.title}</div>
              <div className="text-sm text-slate-500 dark:text-slate-400">{s.text}</div>
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              <button onClick={() => speak(`${s.title}. ${s.text}`)} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 dark:text-white" aria-label={`${t('guide_narrate')}: ${s.title}`}>🔊</button>
              <Link to={s.to} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold inline-flex items-center gap-1">
                {s.link} <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5">
        <div className="font-bold flex items-center gap-2 dark:text-white"><Keyboard size={18} /> {t('guide_hotkeys')}</div>
        <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300 space-y-1">
          <li><b>Tab / Shift+Tab</b> — {t('guide_k1')}</li>
          <li><b>Enter / {t('guide_space')}</b> — {t('guide_k2')}</li>
          <li><b>Esc</b> — {t('guide_k3')}</li>
          <li><b>{t('guide_arrows')} ↑ ↓</b> — {t('guide_k4')}</li>
        </ul>
      </div>
    </div>
  )
}
