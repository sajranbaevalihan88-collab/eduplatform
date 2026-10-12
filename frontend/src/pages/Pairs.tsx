import { useEffect, useState } from 'react'
import client from '../api/client'
import { shuffle } from '../utils/words'
import { playGameSound } from '../utils/sound'
import { useAccessibility } from '../context/UIContext'
import { RotateCcw, Trophy } from 'lucide-react'

type Card = { key: number; pair: number; label: string }

export default function Pairs() {
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
      setTests(t => [...t, ...arr.filter((x: any) => !t.some((y: any) => y.id === x.id))])
    }).catch(() => {})
    try { setBest(localStorage.getItem('edu-pairs-best')) } catch {}
  }, [])

  useEffect(() => {
    if (done || cards.length === 0) return
    const iv = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(iv)
  }, [done, cards])

  const deal = async () => {
    if (!testId) { alert('Выбери викторину'); return }
    setBusy(true)
    try {
      const r = await client.get(`/tests/${testId}/`)
      const qs = (r.data.questions || []).filter((q: any) =>
        (q.type === 'single' || q.type === 'true_false') && q.options?.length >= 2)
      if (qs.length < 3) { alert('Нужно минимум 3 вопроса с вариантами'); return }
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
    } catch { alert('Не открылось (нет сети?)') } finally { setBusy(false) }
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
          say('Пара!')
          setMatched(m => [...m, ...no])
          setOpen([])
          if (matched.length + 2 >= cards.length) {
            setDone(true)
            playGameSound('win')
            say(`Победа! Все пары за ${moves + 1} ходов и ${secs} секунд.`)
            try {
              const rec = `${moves + 1} ходов • ${secs}с`
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
      <a href="/games" className="inline-flex items-center gap-1 text-sm font-bold text-violet-600 dark:text-violet-400">
        ← К играм
      </a>
      <h1 className="font-display font-bold text-2xl dark:text-white">🃏 Быстрые пары — термин + определение</h1>
      <div className="flex flex-wrap gap-2 items-center">
        <select value={testId} onChange={e => setTestId(e.target.value)} aria-label="Викторина"
          className="flex-1 min-w-[200px] px-3 py-2.5 min-h-[52px] rounded-xl border bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:[color-scheme:dark] font-bold">
          <option value="">Выбери викторину…</option>
          {tests.map((t: any) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <button onClick={deal} disabled={busy}
          className="px-6 py-2.5 min-h-[52px] rounded-xl bg-violet-600 text-white font-bold disabled:opacity-50">Раздать</button>
        {best && <span className="text-sm font-bold text-amber-600 flex items-center gap-1"><Trophy size={15} /> {best}</span>}
      </div>

      {cards.length > 0 && (
        <div className="flex gap-4 font-bold dark:text-white" aria-live="polite">
          <span>Ходы: {moves}</span><span>Время: {secs}с</span><span>Пары: {matched.length / 2}/{cards.length / 2}</span>
        </div>
      )}

      {done && (
        <div className="text-center bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-2xl p-5">
          <div className="text-5xl">🏆</div>
          <div className="font-display font-bold text-2xl dark:text-white">Все пары за {moves} ходов и {secs}с!</div>
          <button onClick={deal} className="mt-3 px-6 py-3 min-h-[52px] rounded-xl bg-violet-600 text-white font-bold inline-flex items-center gap-2">
            <RotateCcw size={17} /> Ещё раз
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="group" aria-label="Карточки мемори">
        {cards.map(c => {
          const face = open.includes(c.key) || matched.includes(c.key)
          const isMatched = matched.includes(c.key)
          return (
            <button key={c.key} onClick={() => flip(c.key)} disabled={done}
              aria-label={face ? c.label : 'Закрытая карточка'}
              className={`min-h-[110px] p-3 rounded-2xl border-2 font-bold text-sm transition-all ${face
                ? isMatched
                  ? 'bg-emerald-100 border-emerald-500 dark:bg-emerald-900/40 text-slate-800 dark:text-white'
                  : 'bg-white border-violet-500 dark:bg-slate-700 dark:text-white'
                : 'bg-gradient-to-br from-violet-600 to-indigo-600 border-violet-600 text-white text-3xl'}`}>
              {face ? c.label : '?'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
