import { useEffect, useRef, useState } from 'react'
import { WORD_PACKS } from '../utils/words'
import { playGameSound } from '../utils/sound'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { RotateCcw, Trophy } from 'lucide-react'

type Phase = 'idle' | 'play' | 'over'

const LIVES = 6

function pickBank(lang: string): string[] {
  const key = lang === 'kg' ? 'kg' : lang === 'en' ? 'en' : 'ru'
  const raw = (WORD_PACKS[key] || WORD_PACKS.ru).words
  const ok = ['ru', 'kg'].includes(key) ? /^[а-яёүө]+$/ : /^[a-z]+$/
  return [...new Set(raw.map(w => w.toLowerCase()))].filter(w => w.length >= 4 && w.length <= 7 && ok.test(w))
}

function alphabetOf(bank: string[]): string[] {
  const set = new Set(bank.join('').split(''))
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'))
}

function drawFor(wrong: number) {
  return {
    head: wrong >= 1,
    body: wrong >= 2,
    armL: wrong >= 3,
    armR: wrong >= 4,
    legL: wrong >= 5,
    legR: wrong >= 6,
  }
}

export default function Hangman() {
  const { t, lang } = useLang()
  const { speak, speech } = useAccessibility()
  const say = (s: string) => { try { if (speech) speak(s) } catch {} }
  const [phase, setPhase] = useState<Phase>('idle')
  const [word, setWord] = useState('')
  const [guessed, setGuessed] = useState<string[]>([])
  const [solved, setSolved] = useState(0)
  const [best, setBest] = useState<string | null>(null)
  const [flash, setFlash] = useState('')
  const bankRef = useRef(pickBank(lang))
  const seqRef = useRef<string[]>([])
  const seqIdx = useRef(0)

  useEffect(() => { try { setBest(localStorage.getItem('edu-hangman-best')) } catch {} }, [])

  useEffect(() => { (window as any).__hm = { word, guessed, solved, phase } })

  const alphabet = alphabetOf(bankRef.current)

  const nextWord = () => {
    if (seqIdx.current >= seqRef.current.length) {
      seqRef.current = bankRef.current.slice().sort(() => Math.random() - 0.5)
      seqIdx.current = 0
    }
    setWord(seqRef.current[seqIdx.current++])
    setGuessed([])
    setFlash('')
  }

  const startGame = () => {
    setSolved(0)
    bankRef.current = pickBank(lang)
    seqRef.current = []
    seqIdx.current = 0
    nextWord()
    setPhase('play')
    playGameSound('go')
    say(t('hm_hint'))
  }

  const saveBest = (n: number) => {
    setBest(prev => {
      const p = prev ? parseInt(prev, 10) : 0
      if (n > p) {
        try { localStorage.setItem('edu-hangman-best', String(n)) } catch {}
        return String(n)
      }
      return prev
    })
  }

  const isWin = word && word.length > 0 && word.split('').every(ch => guessed.includes(ch))

  useEffect(() => {
    if (phase !== 'play' || !word || guessed.length === 0) return
    if (isWin) {
      playGameSound('win')
      setFlash(t('hm_solved'))
      const ns = solved + 1
      setSolved(ns)
      saveBest(ns)
      say(`${t('hm_solved')} ${word}`)
      const x = setTimeout(() => { nextWord() }, 1100)
      return () => clearTimeout(x)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isWin])

  const wrong = alphabet.filter(al => guessed.includes(al) && !word.includes(al)).length
  const alive = wrong < LIVES

  useEffect(() => {
    if (phase !== 'play' || alive || !word) return
    playGameSound('wrong')
    say(`${t('hm_lost')} ${word}`)
    setPhase('over')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alive])

  const guess = (al: string) => {
    if (phase !== 'play' ||!alive || word === '' || guessed.includes(al)) return
    if (word.includes(al)) playGameSound('tick')
    else playGameSound('go')
    setGuessed(g => [...g, al])
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = (e.key || '').toLowerCase()
      if (k.length === 1 && alphabet.includes(k)) guess(k)
      if (k === 'Enter' && phase === 'over') startGame()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, word, guessed])

  const parts = drawFor(wrong)
  const d = parts

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <a href="/games" className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400">
        {t('hm_to_games')}
      </a>
      <h1 className="font-display font-bold text-2xl dark:text-white">{t('hm_title')} 🎯</h1>

      {phase === 'idle' && (
        <>
          <p className="text-slate-500 dark:text-slate-400">{t('hm_desc')}</p>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl p-4 space-y-1.5 text-sm dark:text-slate-200">
            <div>• {t('hm_rule1')}</div>
            <div>• {t('hm_rule2')}</div>
          </div>
          <button onClick={startGame} className="w-full px-6 py-4 min-h-[56px] rounded-2xl bg-blue-600 text-white font-bold text-lg">
            🎯 {t('hm_start')}
          </button>
          {best && <div className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1"><Trophy size={15} /> {t('hm_best')}: {best}</div>}
        </>
      )}

      {phase !== 'idle' && (
        <>
          <div className="flex flex-wrap gap-3 items-center font-bold dark:text-white">
            <span>{t('hm_solved_n')}: {solved}</span>
            <span className={wrong >= 4 ? 'text-rose-600 dark:text-rose-400' : ''}>{t('hm_missing')}: {LIVES - wrong}</span>
            <button onClick={startGame} className="ml-auto px-3 py-2 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-white text-sm inline-flex items-center gap-1"><RotateCcw size={15} /> {t('hm_again')}</button>
          </div>
          {flash && <div className="rounded-xl px-4 py-2 text-sm font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">{flash}</div>}
          <div className="flex items-start gap-4">
            <svg viewBox="0 0 120 140" className="w-28 shrink-0" aria-hidden="true">
              <line x1="10" y1="130" x2="80" y2="130" stroke="#94a3b8" strokeWidth="4" />
              <line x1="30" y1="130" x2="30" y2="10" stroke="#94a3b8" strokeWidth="4" />
              <line x1="30" y1="10" x2="86" y2="10" stroke="#94a3b8" strokeWidth="4" />
              <line x1="86" y1="10" x2="86" y2="26" stroke="#94a3b8" strokeWidth="3" />
              {d.head && <circle cx="86" cy="40" r="14" fill="none" stroke="#ef4444" strokeWidth="3.5" />}
              {d.body && <line x1="86" y1="54" x2="86" y2="94" stroke="#ef4444" strokeWidth="3.5" />}
              {d.armL && <line x1="86" y1="62" x2="70" y2="78" stroke="#ef4444" strokeWidth="3.5" />}
              {d.armR && <line x1="86" y1="62" x2="102" y2="78" stroke="#ef4444" strokeWidth="3.5" />}
              {d.legL && <line x1="86" y1="94" x2="70" y2="112" stroke="#ef4444" strokeWidth="3.5" />}
              {d.legR && <line x1="86" y1="94" x2="102" y2="112" stroke="#ef4444" strokeWidth="3.5" />}
            </svg>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap gap-1.5" aria-label={t('hm_word_aria')}>
                {word.split('').map((ch, i) => (
                  <span key={i} className={`w-8 h-11 sm:w-10 sm:h-14 rounded-lg border-2 flex items-center justify-center font-display font-bold text-xl sm:text-2xl ${guessed.includes(ch) ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-900/40 text-slate-800 dark:text-white' : phase === 'over' ? 'bg-rose-50 border-rose-400 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300' : 'border-slate-300 dark:border-slate-700 border-b-4 dark:text-white'}`}>
                    {guessed.includes(ch) ? ch : phase === 'over' ? ch : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {phase === 'play' && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('hm_alpha_aria')}>
              {alphabet.map(al => {
                const used = guessed.includes(al)
                const good = used && word.includes(al)
                return (
                  <button key={al} onClick={() => guess(al)} disabled={used}
                    className={`w-10 h-10 sm:w-11 sm:h-11 min-[412px]:w-12 min-[412px]:h-12 rounded-xl font-display font-bold text-lg border-2 transition-colors ${good
                      ? 'bg-emerald-500 border-emerald-600 text-white'
                      : used
                        ? 'bg-rose-100 border-rose-200 text-rose-400 dark:bg-rose-950/40 dark:border-rose-900'
                        : 'bg-white border-slate-300 hover:bg-blue-50 dark:bg-slate-800 dark:text-white dark:border-slate-700 dark:hover:bg-slate-700'}`}>
                    {al}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {phase === 'over' && (
        <div className="text-center bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-6">
          <div className="text-5xl">🎯</div>
          <div className="font-display font-bold text-2xl dark:text-white">{t('hm_lost')}</div>
          <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">{word}</div>
          <div className="text-slate-500 dark:text-slate-400">{t('hm_solved_n')}: {solved}{best ? ` • ${t('hm_best')}: ${best}` : ''}</div>
          <button onClick={startGame} className="mt-4 px-6 py-3 min-h-[52px] rounded-xl bg-blue-600 text-white font-bold inline-flex items-center gap-2 mx-auto"><RotateCcw size={17} /> {t('hm_again')}</button>
        </div>
      )}
    </div>
  )
}
