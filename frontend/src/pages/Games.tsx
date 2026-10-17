import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gamepad2, Zap, Layers, MonitorUp, Trophy, ChevronRight } from 'lucide-react'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'

function best(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export default function Games() {
  const { speak } = useAccessibility()
  const {t}=useLang()
  const [projector, setProjector] = useState(() => {
    try { return document.documentElement.classList.contains('projector') } catch { return false }
  })
  useEffect(() => {
    try {
      if (localStorage.getItem('projector-mode') === '1') {
        document.documentElement.classList.add('projector')
        setProjector(true)
      }
    } catch {}
  }, [])
  const toggleProjector = () => {
    try {
      const on = document.documentElement.classList.toggle('projector')
      setProjector(on)
      try { localStorage.setItem('projector-mode', on ? '1' : '0') } catch {}
    } catch {}
  }

  const arkanBest = best('edu-arkan-best')
  const sprintBest = best('edu-sprint-best-60') || best('edu-sprint-best-30') || best('edu-sprint-best-15')
  const pairsBest = best('edu-pairs-best')
  const memoryBest = best('edu-memory-best')
  const colorBest = best('edu-colormatch-best')
  const hangBest = best('edu-hangman-best')

  const cards = [
    {
      to: '/games/arkan', icon: '🤼', title: 'Аркан тартыш',
      desc: t('games_arkan_desc'),
      best: arkanBest ? `🏆 ${arkanBest}` : null, ready: true,
    },
    {
      to: '/games/sprint', icon: '⌨️', title: t('games_sprint'),
      desc: t('games_sprint_desc'),
      best: sprintBest ? `🏆 ${sprintBest} WPM` : null, ready: true,
    },
    {
      to: '/games/pairs', icon: '🃏', title: t('games_pairs'),
      desc: t('games_pairs_desc'),
      best: pairsBest ? `🏆 ${pairsBest}` : null, ready: true,
    },
    {
      to: '/games/memory', icon: '🐒', title: t('games_memory'),
      desc: t('games_memory_desc'),
      best: memoryBest ? `🏆 ${t('mem_level')} ${memoryBest}` : null, ready: true,
    },
    {
      to: '/games/colormatch', icon: '🎨', title: t('games_colormatch'),
      desc: t('games_colormatch_desc'),
      best: colorBest ? `🏆 ${t('cm_best')}: ${colorBest}` : null, ready: true,
    },
    {
      to: '/games/hangman', icon: '🎯', title: t('games_hangman'),
      desc: t('games_hangman_desc'),
      best: hangBest ? `🏆 ${t('hm_solved_n')}: ${hangBest}` : null, ready: true,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display font-bold text-2xl dark:text-white flex items-center gap-2">
          <span className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-amber-400 text-white"><Gamepad2 size={20} /></span> {t('games')} <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{cards.length}</span>
        </h1>
        <button onClick={toggleProjector} title={t('games_proj_hint')}
          aria-pressed={projector}
          className={`ml-auto px-4 py-2.5 min-h-[48px] rounded-xl font-bold flex items-center gap-2 border ${projector ? 'bg-amber-400 border-amber-500 text-slate-900' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700'}`}>
          <MonitorUp size={18} /> {projector ? t('games_proj_on') : t('games_proj')}
        </button>
        <button onClick={() => speak(t('games_speak_text'))}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white min-h-[48px] min-w-[48px]" aria-label={t('games_speak_label')}>
          <Trophy size={18} />
        </button>
      </div>

      <p className="text-slate-500 dark:text-slate-400">
        {t('games_intro')}
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <Link key={c.to} to={c.to}
            className="group bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 card-hover flex flex-col gap-2 min-h-[220px]">
            <div className="text-5xl">{c.icon}</div>
            <div className="font-display font-bold text-lg dark:text-white">{c.title}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 flex-1">{c.desc}</div>
            {c.best && <div className="text-sm font-bold text-amber-600 dark:text-amber-400">{c.best}</div>}
            <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold text-sm">
              {t('games_play')} <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-4 text-sm dark:text-slate-200 flex items-start gap-2">
        <Zap size={16} className="mt-0.5 shrink-0 text-blue-600" />
        <span>{t('games_tip_a')} <b>{t('games_tip_proj')}</b> {t('games_tip_b')}</span>
      </div>
    </div>
  )
}
