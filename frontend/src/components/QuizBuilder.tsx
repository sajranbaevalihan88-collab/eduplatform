import { useState } from 'react'
import client from '../api/client'
import { Plus, Trash2, Sparkles, Globe, Lock } from 'lucide-react'

export type BuilderOpt = { text: string; is_correct: boolean }
export type BuilderQ = { text: string; type: string; points: number; options: BuilderOpt[]; explanation?: string }
export type SavedQuiz = { id: number | string; title: string; questions?: BuilderQ[] }

/** Конструктор викторины для Аркан тартыш. Используется в профиле (вкладка «Мои игры»). */
export default function QuizBuilder({ lessons = [], onSaved }: { lessons?: any[]; onSaved?: (t: SavedQuiz) => void }) {
  const [bTitle, setBTitle] = useState('Моя викторина')
  const [bPublish, setBPublish] = useState(true)
  const [bQs, setBQs] = useState<BuilderQ[]>([])
  const [genLesson, setGenLesson] = useState('')
  const [genText, setGenText] = useState('')
  const [genCount, setGenCount] = useState(5)
  const [busy, setBusy] = useState(false)
  const [genSource, setGenSource] = useState<string | null>(null)
  const [genPrompt, setGenPrompt] = useState('')

  const addQ = (type: string) => {
    if (type === 'true_false') {
      setBQs(q => [...q, { text: 'Новый вопрос', type, points: 1, options: [{ text: 'Верно', is_correct: true }, { text: 'Неверно', is_correct: false }] }])
    } else {
      setBQs(q => [...q, {
        text: 'Новый вопрос', type: 'single', points: 1,
        options: [0, 1, 2, 3].map(i => ({ text: `Вариант ${i + 1}`, is_correct: i === 0 })),
      }])
    }
  }

  const aiGen = async () => {
    setBusy(true)
    try {
      const payload: any = { count: genCount }
      if (genLesson) payload.lesson_id = genLesson
      else payload.text = genText
      if (genPrompt.trim()) payload.prompt = genPrompt.trim().slice(0, 2000)
      const r = await client.post('/tests/generate/', payload)
      const got = (r.data.questions || []).map((q: any) => ({
        text: q.text, type: q.type, points: q.points || 1, explanation: q.explanation || '',
        options: (q.options || []).map((o: any) => ({ text: o.text, is_correct: !!o.is_correct })),
      }))
      setBQs(q => [...q, ...got])
      setGenSource(typeof r.data.source === 'string' ? r.data.source : null)
    } catch (e: any) { alert(e.response?.data?.error || 'Не получилось сгенерировать') } finally { setBusy(false) }
  }

  const save = async () => {
    const valid = bQs.filter(q => q.text.trim() && q.options.length >= 2)
    if (!bTitle.trim() || !valid.length) { alert('Нужно название и хотя бы 1 вопрос с вариантами'); return }
    setBusy(true)
    try {
      const r = await client.post('/tests/', {
        title: bTitle.slice(0, 300), description: 'Викторина Аркан тартыш',
        pass_score: 60, time_limit: 0, is_public: bPublish,
        questions: valid.map((q, i) => ({ ...q, order: i, options: q.options.map((o, j) => ({ ...o, order: j })) })),
      })
      const t: SavedQuiz = { id: r.data.id, title: r.data.title, questions: valid }
      setBTitle('Моя викторина')
      setBQs([])
      onSaved?.(t)
    } catch { alert('Не сохранилось (нет сети?)') } finally { setBusy(false) }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-4 space-y-3">
      <input value={bTitle} onChange={e => setBTitle(e.target.value)} placeholder="Название викторины"
        aria-label="Название викторины" className="w-full px-4 py-2.5 min-h-[48px] rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white font-bold" />
      <label className="flex items-center gap-2 text-sm font-semibold dark:text-slate-200">
        <button onClick={() => setBPublish(!bPublish)} aria-pressed={bPublish}
          className={`w-12 h-7 rounded-full transition ${bPublish ? 'bg-emerald-500' : 'bg-slate-300'} relative`}>
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${bPublish ? 'left-6' : 'left-1'}`} />
        </button>
        {bPublish ? <><Globe size={15} /> Опубликовать — видно всем</> : <><Lock size={15} /> Только мне</>}
      </label>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => addQ('single')} className="px-3 py-2 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-700 dark:text-white text-sm font-bold flex items-center gap-1"><Plus size={15} /> Вопрос с вариантами</button>
        <button onClick={() => addQ('true_false')} className="px-3 py-2 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-700 dark:text-white text-sm font-bold flex items-center gap-1"><Plus size={15} /> Верно/неверно</button>
      </div>
      {lessons.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Sparkles size={15} className="text-blue-600" />
          <select value={genLesson} onChange={e => setGenLesson(e.target.value)} aria-label="Урок для ИИ"
            className="flex-1 min-w-[160px] px-3 py-2 min-h-[44px] rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white">
            <option value="">ИИ из своего текста ниже</option>
            {lessons.map((l: any) => <option key={l.id} value={l.id}>{l.title}</option>)}
          </select>
              <input type="number" min={1} max={40} value={genCount} onChange={e => setGenCount(Math.max(1, Math.min(40, parseInt(e.target.value) || 5)))}
                aria-label="Сколько вопросов (макс 40)" className="w-16 px-2 py-2 min-h-[44px] rounded-xl border dark:bg-slate-700 dark:text-white" />
          <button onClick={aiGen} disabled={busy} className="px-3 py-2 min-h-[44px] rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50">Сгенерировать</button>
        </div>
      )}
      {!genLesson && (
        <textarea value={genText} onChange={e => setGenText(e.target.value)} placeholder="Или вставь текст (мин 100 символов) для ИИ..."
          className="w-full h-20 px-3 py-2 rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white text-sm" />
      )}
      <textarea value={genPrompt} onChange={e => setGenPrompt(e.target.value)}
        placeholder="Что сказать Gemini? Например: только Верно/Неверно про циклы, на кыргызском..."
        aria-label="Указание для ИИ"
        className="w-full h-16 px-3 py-2 rounded-xl border bg-blue-50/50 dark:bg-slate-700 dark:text-white text-sm" />
      {bQs.map((q, qi) => (
        <div key={qi} className="border dark:border-slate-600 rounded-xl p-3 space-y-2">
          <div className="flex gap-2">
            <input value={q.text} onChange={e => setBQs(b => b.map((x, i) => i === qi ? { ...x, text: e.target.value } : x))}
              placeholder="Текст вопроса" aria-label={`Вопрос ${qi + 1}`}
              className="flex-1 px-3 py-2 min-h-[44px] rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white font-semibold" />
            <button onClick={() => setBQs(b => b.filter((_, i) => i !== qi))} aria-label="Удалить вопрос"
              className="p-2 rounded-xl bg-red-50 text-red-600 min-h-[44px] min-w-[44px]"><Trash2 size={16} /></button>
          </div>
          {q.options.map((o, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input type="radio" name={`qb-q${qi}`} checked={o.is_correct}
                onChange={() => setBQs(b => b.map((x, i) => i === qi ? { ...x, options: x.options.map((op, j) => ({ ...op, is_correct: j === oi })) } : x))}
                aria-label="Правильный ответ" className="w-5 h-5 accent-emerald-600" />
              <input value={o.text} onChange={e => setBQs(b => b.map((x, i) => i === qi ? { ...x, options: x.options.map((op, j) => j === oi ? { ...op, text: e.target.value } : op) } : x))}
                placeholder={`Вариант ${oi + 1}`} aria-label={`Вариант ${oi + 1}`}
                className="flex-1 px-3 py-2 min-h-[44px] rounded-xl border bg-slate-50 dark:bg-slate-700 dark:text-white text-sm" />
            </div>
          ))}
        </div>
      ))}
      {genSource && (
        <div className={`text-xs font-bold px-3 py-2 rounded-xl ${genSource.startsWith('gemini') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
          {genSource.startsWith('gemini') ? `⚡ Сгенерировано нейросетью ${genSource.split(':')[1] || 'Gemini'}` : '🔧 Офлайн-режим: без нейросети'}
        </div>
      )}
      <button onClick={save} disabled={busy}
        className="w-full px-4 py-3 min-h-[52px] rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">
        Сохранить викторину
      </button>
    </div>
  )
}
