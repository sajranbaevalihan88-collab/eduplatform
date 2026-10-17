import { useEffect, useRef, useState } from 'react'
import { shuffle } from '../utils/words'
import { playGameSound } from '../utils/sound'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { RotateCcw, Trophy } from 'lucide-react'

type Phase = 'idle' | 'show' | 'recall' | 'over'

const GRID = 16
const SHOW_SECS = 10
const RECALL_SECS = 30

function levelCount(l: number): number {
  return Math.min(4 + (l - 1), 10)
}

export default function Memory() {
  const { t } = useLang()
  const { speak, speech } = useAccessibility()
  const say = (s: string) => { try { if (speech) speak(s) } catch {} }
  const [phase, setPhase] = useState<Phase>('idle')
  const [level, setLevel] = useState(1)
  const [lives, setLives] = useState(3)
  const [cells, setCells] = useState<(number | 0)[]>(Array(GRID).fill(0))
  const [found, setFound] = useState<number[]>([])
  const [wrongIdx, setWrongIdx] = useState<number | null>(null)
  const [nextNum, setNextNum] = useState(1)
  const [secs, setSecs] = useState(0)
  const [flash, setFlash] = useState('')
  const [best, setBest] = useState<number | null>(null)
  const timerRef = useRef<any>(null)

  useEffect(() => { try { const b = parseInt(localStorage.getItem('edu-memory-best') || '', 10); if (b) setBest(b) } catch {} }, [])

  useEffect(() => {
    if (phase !== 'show' && phase !== 'recall') return
    setSecs(phase === 'show' ? SHOW_SECS : RECALL_SECS)
    timerRef.current = setInterval(() => {
      setSecs(s => {
        if (s <= 1) {
          clearInterval(timerRef.current)
          if (phase === 'show') { setPhase('recall'); say(t('mem_remember')) } else { outOfTime() }
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, level])

  const outOfTime = () => { failLevel() }

  const startGame = () => {
    setLevel(1); setLives(3)
    setUpLevel(true)
  }

  const setUpLevel = (fresh: boolean) => {
    const n = levelCount(fresh ? 1 : level)
    const pos = shuffle([...Array(GRID).keys()]).slice(0, n)
    const arr = Array(GRID).fill(0) as number[]
    pos.forEach((p, i) => { arr[p] = i + 1 })
    setCells(arr)
    setFound([]); setNextNum(1); setWrongIdx(null); setPhase('show')
    setFlash('')
    playGameSound('go')
    say(t('mem_memorize'))
  }

  const failLevel = () => {
    const lv = lives - 1
    setLives(lv)
    playGameSound('wrong')
    setFlash(t('mem_wrong'))
    if (lv <= 0) {
      setPhase('over')
      saveBest(level)
      say(`${t('mem_gameover')} ${t('mem_level')} ${level}`)
    } else {
      const n = levelCount(level)
      const pos = shuffle([...Array(GRID).keys()]).slice(0, n)
      const arr = Array(GRID).fill(0) as number[]
      pos.forEach((p, i) => { arr[p] = i + 1 })
      setCells(arr)
      setFound([]); setNextNum(1); setWrongIdx(null); setPhase('show')
    }
  }

  const saveBest = (lv: number) => {
    setBest(prev => {
      if (!prev || lv > prev) {
        try { localStorage.setItem('edu-memory-best', String(lv)) } catch {}
        return lv
      }
      return prev
    })
  }

  const tap = (idx: number) => {
    if (phase !== 'recall') return
    const n = cells[idx]
    if (!n || found.includes(n)) return
    if (n === nextNum) {
      playGameSound('tick')
      const nf = [...found, n]
      setFound(nf)
      setNextNum(n + 1)
      if (nf.length >= levelCount(level)) {
        clearInterval(timerRef.current)
        playGameSound('win')
        saveBest(level + 1)
        setFlash(t('mem_level_ok'))
        setTimeout(() => {
          setLevel(l => l + 1)
          const nl = level + 1
          const cnt = levelCount(nl)
          const pos = shuffle([...Array(GRID).keys()]).slice(0, cnt)
          const arr = Array(GRID).fill(0) as number[]
          pos.forEach((p, i) => { arr[p] = i + 1 })
          setCells(arr)
          setFound([]); setNextNum(1); setWrongIdx(null); setPhase('show')
        }, 900)
      }
    } else {
      setWrongIdx(idx)
      setTimeout(() => setWrongIdx(null), 500)
      failLevel()
    }
  }

  const showNums = phase === 'show'

  const hintPhase = phase === 'show' ? t('mem_memorize') : phase === 'recall' ? t('mem_remember') : flash

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <a href="/games" className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400">
        {t('mem_to_games')}
      </a>
      <h1 className="font-display font-bold text-2xl dark:text-white">{t('mem_title')} 🙈</h1>

      {phase === 'idle' && (
        <>
          <p className="text-slate-500 dark:text-slate-400">{t('mem_desc')}</p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-4 space-y-1.5 text-sm dark:text-slate-200">
            <div>• {t('mem_rule1')}</div>
            <div>• {t('mem_rule2')}</div>
            <div>• {t('mem_rule3')}</div>
          </div>
          <button onClick={startGame} className="w-full px-6 py-4 min-h-[56px] rounded-2xl bg-blue-600 text-white font-bold text-lg">
            🐒 {t('mem_start')}
          </button>
          {best != null && <div className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1"><Trophy size={15} /> {t('mem_best')}: {t('mem_level')} {best}</div>}
        </>
      )}

      {phase !== 'idle' && (
        <>
          <div className="flex flex-wrap gap-3 items-center font-bold dark:text-white">
            <span>{t('mem_level')} {level} / {levelCount(level)} {t('mem_level_short')}</span>
            <span>{'❤️'.repeat(Math.max(0, lives))}</span>
            {(phase === 'show' || phase === 'recall') && (
              <span aria-live="polite" className={phase === 'show' ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'}>
                {secs}s
              </span>
            )}
            {phase === 'show' && (
              <button onClick={() => { clearInterval(timerRef.current); setPhase('recall'); say(t('mem_remember')) }}
                className="px-3 py-2 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm">{t('mem_ready')}</button>
            )}
            <button onClick={startGame} className="ml-auto px-3 py-2 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white text-sm inline-flex items-center gap-1"><RotateCcw size={15} /> {t('mem_again')}</button>
          </div>
          {(phase === 'show' || phase === 'recall') && flash && (
            <div className={`rounded-xl px-4 py-2 text-sm font-bold ${flash === t('mem_level_ok') ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'}`}>{flash}</div>
          )}
          <div className="grid grid-cols-4 gap-2 sm:gap-3" role="group" aria-label={t('mem_cells_aria')}>
            {cells.map((n, i) => {
              const isOpen = n > 0 && (showNums || found.includes(n))
              return (
                <button key={i} onClick={() => tap(i)} disabled={phase !== 'recall'}
                  aria-label={isOpen ? String(n) : t('mem_closed')}
                  className={`min-h-[72px] sm:min-h-[88px] rounded-2xl border-2 font-display font-bold text-2xl sm:text-3xl transition-all ${showNums && n > 0
                    ? 'bg-white border-blue-500 dark:bg-slate-700 dark:text-white'
                    : isOpen
                      ? 'bg-emerald-100 border-emerald-500 dark:bg-emerald-900/40 text-slate-800 dark:text-white'
                      : phase === 'recall'
                        ? wrongIdx === i
                          ? 'bg-rose-100 border-rose-500 dark:bg-rose-900/40'
                          : 'bg-gradient-to-br from-blue-600 to-cyan-600 border-blue-600'
                        : 'bg-gradient-to-br from-slate-300 to-slate-200 dark:from-slate-700 dark:to-slate-800 border-slate-300 dark:border-slate-700'}`}>
                  {n > 0 && showNums ? n : isOpen ? n : ''}
                </button>
              )
            })}
          </div>
        </>
      )}

      {phase === 'over' && (
        <div className="text-center bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-6">
          <div className="text-5xl">🐵</div>
          <div className="font-display font-bold text-2xl dark:text-white">{t('mem_gameover')}</div>
          <div className="text-slate-500 dark:text-slate-400">{t('mem_level')} {level} • {lives <= 0 ? t('mem_no_lives') : ''}</div>
          {best != null && <div className="font-bold text-amber-600 dark:text-amber-400 mt-1">{t('mem_best')}: {t('mem_level')} {best}</div>}
          <button onClick={startGame} className="mt-4 px-6 py-3 min-h-[52px] rounded-xl bg-blue-600 text-white font-bold inline-flex items-center gap-2 mx-auto"><RotateCcw size={17} /> {t('mem_again')}</button>
        </div>
      )}
    </div>
  )
}
