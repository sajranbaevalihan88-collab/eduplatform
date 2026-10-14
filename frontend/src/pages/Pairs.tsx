import { useEffect, useState } from 'react'
import client from '../api/client'
import { shuffle } from '../utils/words'
import { playGameSound } from '../utils/sound'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { RotateCcw, Trophy } from 'lucide-react'

type Card = { key: number; pair: number; label: string }

export default function Pairs() {
  const {t}=useLang()
  const { speak, speech } = useAccessibility()
  const say = (t: string) => { try { if (speech) speak(t) } catch {} }
  const [tests, setTests] = useState<any[]>([])
  const [testId, setTestId] = useState('')
  const [cards, setCards] = useState<Card[]>([])
  const [open, setOpen] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [secs, setSecs] = useState(0)
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  const [best, setBest] = useState<string | null>(null)

  useEffect(() => {
    client.get('/tests/?owner=me').then(r => setTests(Array.isArray(r.data) ? r.data : r.data.results || [])).catch(() => {})
    client.get('/tests/?is_public=true').then(r => {
      const arr = Array.isArray(r.data) ? r.data : r.data.results || []
      setTests(prev => [...prev, ...arr.filter((x: any) => !prev.some((y: any) => y.id === x.id))])
    }).catch(() => {})
    try { setBest(localStorage.getItem('edu-pairs-best')) } catch {}
  }, [])

  useEffect(() => {
    if (done || cards.length === 0) return
    const iv = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(iv)
  }, [done, cards])

  const deal = async () => {
    if (!testId) { alert(t('pairs_pick')); return }
    setBusy(true)
    try {
      const r = await client.get(`/tests/${testId}/`)
      const qs = (r.data.questions || []).filter((q: any) =>
        (q.type === 'single' || q.type === 'true_false') && q.options?.length >= 2)
      if (qs.length < 3) { alert(t('pairs_min3')); return }
      const picked = shuffle(qs).slice(0, 8)
      const deck: Card[] = []
      picked.forEach((q: any, i: number) => {
        const correct = q.options.find((o: any) => o.is_correct) || q.options[0]
        deck.push({ key: i * 2, pair: i, label: String(q.text).slice(0, 80) })
        deck.push({ key: i * 2 + 1, pair: i, label: String(correct.text).slice(0, 80) })
      })
      setCards(shuffle(deck))
      setOpen([]); setMatched([]); setMoves(0); setSecs(0); setDone(false)
      playGameSound('go')
    } catch { alert(t('pairs_fail')) } finally { setBusy(false) }
  }

  const flip = (key: number) => {
    if (done || open.includes(key) || matched.includes(key)) return
    if (open.length === 2) return
    playGameSound('tick')
    const card = cards.find(c => c.key === key)
    if (card) say(card.label)
    const no = [...open, key]
    setOpen(no)
    if (no.length === 2) {
      setMoves(m => m + 1)
      const a = cards.find(c => c.key === no[0])!
      const b = cards.find(c => c.key === no[1])!
      if (a.pair === b.pair) {
        setTimeout(() => {
          playGameSound('correct')
          say(t('pairs_pair'))
          setMatched(m => [...m, ...no])
          setOpen([])
          if (matched.length + 2 >= cards.length) {
            setDone(true)
            playGameSound('win')
            say(`${t('pairs_win_a')} ${moves + 1} ${t('pairs_win_moves')} ${secs} ${t('pairs_win_secs')}`)
            try {
              const rec = `${moves + 1} ${t('pairs_moves')} • ${secs}${t('pairs_sec')}`
              const prev = localStorage.getItem('edu-pairs-best')
              if (!prev) { localStorage.setItem('edu-pairs-best', rec); setBest(rec) }
            } catch {}
          }
        }, 350)
      } else {
        setTimeout(() => { playGameSound('wrong'); setOpen([]) }, 800)
      }
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <a href="/games" className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 dark:text-blue-400">
        {t('pairs_to_games')}
      </a>
      <h1 className="font-display font-bold text-2xl dark:text-white">{t('pairs_title')}</h1>
      <div className="flex flex-wrap gap-2 items-center">
        <select value={testId} onChange={e => setTestId(e.target.value)} aria-label={t('pairs_quiz_aria')}
          className="flex-1 min-w-[200px] px-3 py-2.5 min-h-[52px] rounded-xl border bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:[color-scheme:dark] font-bold">
          <option value="">{t('pairs_pick_ph')}</option>
          {tests.map((tt: any) => <option key={tt.id} value={tt.id}>{tt.title}</option>)}
        </select>
        <button onClick={deal} disabled={busy}
          className="px-6 py-2.5 min-h-[52px] rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50">{t('pairs_deal')}</button>
        {best && <span className="text-sm font-bold text-amber-600 flex items-center gap-1"><Trophy size={15} /> {best}</span>}
      </div>

      {cards.length > 0 && (
        <div className="flex gap-4 font-bold dark:text-white" aria-live="polite">
          <span>{t('pairs_moves_label')} {moves}</span><span>{t('pairs_time')} {secs}{t('pairs_sec')}</span><span>{t('pairs_pairs')} {matched.length / 2}/{cards.length / 2}</span>
        </div>
      )}

      {done && (
        <div className="text-center bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-2xl p-5">
          <div className="text-5xl">🏆</div>
          <div className="font-display font-bold text-2xl dark:text-white">{t('pairs_done_a')} {moves} {t('pairs_win_moves')} {secs}{t('pairs_sec')}!</div>
          <button onClick={deal} className="mt-3 px-6 py-3 min-h-[52px] rounded-xl bg-blue-600 text-white font-bold inline-flex items-center gap-2">
            <RotateCcw size={17} /> {t('pairs_again')}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="group" aria-label={t('pairs_cards_aria')}>
        {cards.map(c => {
          const face = open.includes(c.key) || matched.includes(c.key)
          const isMatched = matched.includes(c.key)
          return (
            <button key={c.key} onClick={() => flip(c.key)} disabled={done}
              aria-label={face ? c.label : t('pairs_closed')}
              className={`min-h-[110px] p-3 rounded-2xl border-2 font-bold text-sm transition-all ${face
                ? isMatched
                  ? 'bg-emerald-100 border-emerald-500 dark:bg-emerald-900/40 text-slate-800 dark:text-white'
                  : 'bg-white border-blue-500 dark:bg-slate-700 dark:text-white'
                : 'bg-gradient-to-br from-blue-600 to-cyan-600 border-blue-600 text-white text-3xl'}`}>
              {face ? c.label : '?'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
