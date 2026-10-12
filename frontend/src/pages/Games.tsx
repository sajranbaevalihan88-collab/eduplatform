import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Gamepad2, Zap, Layers, MonitorUp, Trophy, ChevronRight } from 'lucide-react'
import { useAccessibility } from '../context/UIContext'

function best(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

export default function Games() {
  const { speak } = useAccessibility()
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

  const cards = [
    {
      to: '/games/arkan', icon: '🤼', title: 'Аркан тартыш',
      desc: '2 команды тянут канат ответами. Свои вопросы, публикация, ИИ из урока.',
      best: arkanBest ? `🏆 ${arkanBest}` : null, ready: true,
    },
    {
      to: '/games/sprint', icon: '⌨️', title: 'Спринт печати',
      desc: '15 / 30 / 60 секунд. WPM и точность как в Monkeytype. Режим «Побей 71».',
      best: sprintBest ? `🏆 ${sprintBest} WPM` : null, ready: true,
    },
    {
      to: '/games/pairs', icon: '🃏', title: 'Быстрые пары',
      desc: 'Мемори «термин — определение» из твоего урока. Минимум ходов.',
      best: pairsBest ? `🏆 ${pairsBest}` : null, ready: true,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display font-bold text-2xl dark:text-white flex items-center gap-2">
          <span className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white"><Gamepad2 size={20} /></span> Игры и практика <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{cards.length}</span>
        </h1>
        <button onClick={toggleProjector} title="Крупный шрифт и кнопки для интерактивной доски"
          aria-pressed={projector}
          className={`ml-auto px-4 py-2.5 min-h-[48px] rounded-xl font-bold flex items-center gap-2 border ${projector ? 'bg-amber-400 border-amber-500 text-slate-900' : 'bg-white dark:bg-slate-800 dark:text-white dark:border-slate-700'}`}>
          <MonitorUp size={18} /> {projector ? 'Проектор: вкл' : 'Проектор'}
        </button>
        <button onClick={() => speak('Игры и практика. Аркан тартыш, спринт печати и быстрые пары.')}
          className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white min-h-[48px] min-w-[48px]" aria-label="Озвучить раздел">
          <Trophy size={18} />
        </button>
      </div>

      <p className="text-slate-500 dark:text-slate-400">
        Играй с классом на интерактивной доске или один за рекордом. Свою викторину собери в профиле — вкладка «Мои игры».
      </p>

      <div className="grid sm:grid-cols-3 gap-4">
        {cards.map(c => (
          <Link key={c.to} to={c.to}
            className="group bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 card-hover flex flex-col gap-2 min-h-[220px]">
            <div className="text-5xl">{c.icon}</div>
            <div className="font-display font-bold text-lg dark:text-white">{c.title}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 flex-1">{c.desc}</div>
            {c.best && <div className="text-sm font-bold text-amber-600 dark:text-amber-400">{c.best}</div>}
            <div className="flex items-center gap-1 text-violet-600 dark:text-violet-400 font-bold text-sm">
              Играть <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-2xl p-4 text-sm dark:text-slate-200 flex items-start gap-2">
        <Zap size={16} className="mt-0.5 shrink-0 text-violet-600" />
        <span>На доске включи <b>«Проектор»</b> — шрифты и кнопки станут огромными под тач. Свои вопросы для Аркана создаются в профиле — вкладка «Мои игры».</span>
      </div>
    </div>
  )
}
