import { useMemo, useState } from 'react'
import { X, Plus, Trash2, Copy, ChevronUp, ChevronDown, FlaskConical } from 'lucide-react'
import client from '../api/client'
import { useLang } from '../context/LangContext'
import { toast } from '../context/UIContext'

// Конструктор теста «как Google Forms», но сразу с выдачей классу:
// один модал — вопросы/варианты/правильные ответы/баллы — и задание создано.

type QType = 'single' | 'multiple' | 'true_false'
type Opt = { text: string; is_correct: boolean }
type Q = { text: string; type: QType; points: number; options: Opt[] }

const DICT: Record<string, Record<string, string>> = {
  ru: {
    title: 'Новый тест', sub: 'Конструктор как Google Forms — после сохранения тест сразу станет заданием класса',
    name_ph: 'Название теста (например: Дроби, 8 класс)', desc_ph: 'Описание для учеников (необязательно)',
    pass: 'Проходной %', tpq: 'Сек на вопрос (0 — без лимита)',
    q: 'Вопрос', add_q: 'Добавить вопрос', add_tf: '+ Верно/Неверно',
    q_ph: 'Формулировка вопроса…', points: 'баллы',
    t_single: 'Один ответ', t_multiple: 'Несколько ответов', t_tf: 'Верно/Неверно',
    add_opt: '+ Вариант', opt_ph: 'Вариант ответа…', yes: 'Верно', no: 'Неверно',
    dup: 'Дублировать вопрос', del: 'Удалить вопрос', up: 'Выше', down: 'Ниже',
    total: 'Вопросов', total_p: 'Баллов',
    save: 'Сохранить и задать классу', saving: 'Сохраняем…', cancel: 'Отмена',
    e_title: 'Дай название тесту', e_q: 'Есть пустой вопрос — напиши формулировку',
    e_opts: 'В каждом вопросе минимум 2 непустых варианта', e_correct: 'Отметь правильный ответ в каждом вопросе',
    e_save: 'Не удалось сохранить тест', ok: 'Тест создан и задан классу!',
    correct_hint: 'Отметь правильные', close: 'Закрыть',
  },
  en: {
    title: 'New quiz', sub: 'Google Forms-style builder — saving turns the quiz into a class assignment',
    name_ph: 'Quiz title (e.g. Fractions, grade 8)', desc_ph: 'Description for students (optional)',
    pass: 'Pass %', tpq: 'Seconds per question (0 = no limit)',
    q: 'Question', add_q: 'Add question', add_tf: '+ True/False',
    q_ph: 'Question text…', points: 'points',
    t_single: 'Single answer', t_multiple: 'Multiple answers', t_tf: 'True/False',
    add_opt: '+ Option', opt_ph: 'Answer option…', yes: 'True', no: 'False',
    dup: 'Duplicate question', del: 'Delete question', up: 'Move up', down: 'Move down',
    total: 'Questions', total_p: 'Points',
    save: 'Save & assign to class', saving: 'Saving…', cancel: 'Cancel',
    e_title: 'Give the quiz a title', e_q: 'A question is empty — write its text',
    e_opts: 'Each question needs at least 2 non-empty options', e_correct: 'Mark the correct answer in every question',
    e_save: 'Could not save the quiz', ok: 'Quiz created and assigned!',
    correct_hint: 'Mark correct', close: 'Close',
  },
  kg: {
    title: 'Жаңы тест', sub: 'Google Forms сыяктуу конструктор — сакталган тест дароо класска тапшырма болот',
    name_ph: 'Тесттин аталышы (мисалы: Бөлчөктөр, 8-класс)', desc_ph: 'Окуучуларга сүрөттөмө (милдеттүү эмес)',
    pass: 'Өтүү %', tpq: 'Суроого секунд (0 — чексиз)',
    q: 'Суроо', add_q: 'Суроо кошуу', add_tf: '+ Туура/Туура эмес',
    q_ph: 'Суроонун тексти…', points: 'упай',
    t_single: 'Бир жооп', t_multiple: 'Бир нече жооп', t_tf: 'Туура/Туура эмес',
    add_opt: '+ Вариант', opt_ph: 'Жооп варианты…', yes: 'Туура', no: 'Туура эмес',
    dup: 'Суроону көчүрүү', del: 'Суроону өчүрүү', up: 'Жогору', down: 'Төмөн',
    total: 'Суроолор', total_p: 'Упайлар',
    save: 'Сактап, класска берүү', saving: 'Сакталууда…', cancel: 'Жокко чыгаруу',
    e_title: 'Тестке аталык коюңуз', e_q: 'Бош суроо бар — текстин жазыңыз',
    e_opts: 'Ар бир суроодо кеминде 2 бош эмес вариант', e_correct: 'Ар бир суроодо туура жоопту белгилеңиз',
    e_save: 'Тест сакталбай калды', ok: 'Тест түзүлдү жана класска берилди!',
    correct_hint: 'Туураны белгилөө', close: 'Жабуу',
  },
}

export default function QuizBuilder({ onClose, onCreated }: { onClose: () => void; onCreated: (testId: number) => Promise<void> | void }) {
  const { lang } = useLang()
  const L = DICT[lang] || DICT.ru
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [pass, setPass] = useState(50)
  const [tpq, setTpq] = useState(30)
  const [busy, setBusy] = useState(false)

  const mkQ = (type: QType = 'single'): Q => ({
    text: '', type, points: 1,
    options: type === 'true_false'
      ? [{ text: L.yes, is_correct: true }, { text: L.no, is_correct: false }]
      : [{ text: '', is_correct: true }, { text: '', is_correct: false }],
  })
  const [qs, setQs] = useState<Q[]>(() => [mkQ()])
  const totalPoints = useMemo(() => qs.reduce((a, q) => a + (q.points || 0), 0), [qs])

  const patch = (i: number, p: Partial<Q>) => setQs(arr => arr.map((q, k) => k === i ? { ...q, ...p } : q))
  const setType = (i: number, type: QType) => {
    const q = qs[i]
    const options = type === 'true_false'
      ? [{ text: L.yes, is_correct: true }, { text: L.no, is_correct: false }]
      : (q.type === 'true_false' ? mkQ(type).options : q.options)
    patch(i, { type, options })
  }
  const setOpt = (i: number, j: number, text: string) =>
    patch(i, { options: qs[i].options.map((o, k) => k === j ? { ...o, text } : o) })
  const markCorrect = (i: number, j: number) => {
    const q = qs[i]
    if (q.type === 'multiple') {
      patch(i, { options: q.options.map((o, k) => k === j ? { ...o, is_correct: !o.is_correct } : o) })
    } else {
      patch(i, { options: q.options.map((o, k) => ({ ...o, is_correct: k === j })) })
    }
  }
  const addOpt = (i: number) => patch(i, { options: [...qs[i].options, { text: '', is_correct: false }] })
  const delOpt = (i: number, j: number) => {
    if (qs[i].options.length <= 2) return
    patch(i, { options: qs[i].options.filter((_, k) => k !== j) })
  }
  const move = (i: number, d: -1 | 1) => setQs(arr => {
    const j = i + d
    if (j < 0 || j >= arr.length) return arr
    const a = [...arr]; const [x] = a.splice(i, 1); a.splice(j, 0, x); return a
  })

  const save = async () => {
    if (!title.trim()) { toast(L.e_title, 'error'); return }
    if (qs.some(q => !q.text.trim())) { toast(L.e_q, 'error'); return }
    if (qs.some(q => q.type !== 'true_false' && (q.options.length < 2 || q.options.some(o => !o.text.trim())))) { toast(L.e_opts, 'error'); return }
    if (qs.some(q => !q.options.some(o => o.is_correct))) { toast(L.e_correct, 'error'); return }
    setBusy(true)
    try {
      const payload = {
        title: title.trim(), description: desc.trim(),
        pass_score: Math.max(1, Math.min(100, pass || 50)),
        time_limit: 0, time_per_question: Math.max(0, tpq || 0),
        questions: qs.map((q, i) => ({
          text: q.text.trim(), type: q.type, points: Math.max(1, q.points || 1), order: i,
          options: q.options.map((o, j) => ({ text: o.text.trim(), is_correct: !!o.is_correct, order: j })),
        })),
      }
      const r = await client.post('/tests/', payload)
      await onCreated(r.data.id)
      toast(L.ok, 'success')
      onClose()
    } catch (e: any) {
      toast(e?.response?.data?.detail || e?.response?.data?.error || L.e_save, 'error')
    } finally { setBusy(false) }
  }

  const inputCls = 'w-full px-3 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white dark:placeholder-slate-500 outline-none focus:border-blue-400'
  const iconBtn = 'p-2 min-h-[36px] min-w-[36px] rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-white flex items-center justify-center'

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-2 sm:p-6" data-testid="quiz-builder">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[94vh] overflow-y-auto rounded-2xl bg-slate-50 dark:bg-slate-800 shadow-2xl border dark:border-slate-700">
        <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b dark:border-slate-700 p-4 flex items-center gap-3 rounded-t-2xl">
          <div className="w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-300 flex items-center justify-center shrink-0"><FlaskConical size={20} /></div>
          <div className="flex-1 min-w-0">
            <div className="font-bold dark:text-white">{L.title}</div>
            <div className="text-xs text-slate-400 truncate">{L.sub}</div>
          </div>
          <button onClick={onClose} aria-label={L.close} className={iconBtn}><X size={20} /></button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 space-y-3 border-t-4 border-t-rose-500">
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder={L.name_ph} className={`${inputCls} text-lg font-bold`} data-testid="qb-title" />
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder={L.desc_ph} className={inputCls} />
            <div className="flex flex-wrap gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
                {L.pass}
                <input type="number" min={1} max={100} value={pass} onChange={e => setPass(Number(e.target.value))} className="w-20 px-2 py-2 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white" />
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-300">
                {L.tpq}
                <input type="number" min={0} max={600} value={tpq} onChange={e => setTpq(Number(e.target.value))} className="w-20 px-2 py-2 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white" />
              </label>
            </div>
          </div>

          {qs.map((q, i) => (
            <div key={i} className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 space-y-3" data-testid={`qb-q-${i}`}>
              <div className="flex items-start gap-2">
                <span className="mt-3 text-xs font-bold text-slate-400 shrink-0">{L.q} {i + 1}</span>
                <input value={q.text} onChange={e => patch(i, { text: e.target.value })} placeholder={L.q_ph} className={inputCls} data-testid={`qb-qtext-${i}`} />
                <div className="flex shrink-0">
                  <button onClick={() => move(i, -1)} title={L.up} className={iconBtn}><ChevronUp size={16} /></button>
                  <button onClick={() => move(i, 1)} title={L.down} className={iconBtn}><ChevronDown size={16} /></button>
                  <button onClick={() => setQs(arr => { const a = [...arr]; a.splice(i + 1, 0, JSON.parse(JSON.stringify(q))); return a })} title={L.dup} className={iconBtn}><Copy size={15} /></button>
                  <button onClick={() => setQs(arr => arr.length > 1 ? arr.filter((_, k) => k !== i) : arr)} title={L.del} className={`${iconBtn} hover:text-red-500`}><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select value={q.type} onChange={e => setType(i, e.target.value as QType)} className="px-3 py-2 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm">
                  <option value="single">{L.t_single}</option>
                  <option value="multiple">{L.t_multiple}</option>
                  <option value="true_false">{L.t_tf}</option>
                </select>
                <label className="flex items-center gap-1.5 text-xs text-slate-400">
                  <input type="number" min={1} max={100} value={q.points} onChange={e => patch(i, { points: Number(e.target.value) })} className="w-16 px-2 py-2 rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white" />
                  {L.points}
                </label>
                {q.type === 'multiple' && <span className="text-[11px] text-slate-400">☑ {L.correct_hint}</span>}
              </div>
              <div className="space-y-2 pl-1">
                {q.options.map((o, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <button
                      onClick={() => markCorrect(i, j)}
                      title={L.correct_hint}
                      aria-label={`${L.correct_hint} ${j + 1}`}
                      data-testid={`qb-correct-${i}-${j}`}
                      className={`w-6 h-6 shrink-0 flex items-center justify-center border-2 transition ${q.type === 'multiple' ? 'rounded-md' : 'rounded-full'} ${o.is_correct ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600 text-transparent hover:border-emerald-400'}`}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 6L9 17l-5-5" /></svg>
                    </button>
                    {q.type === 'true_false'
                      ? <span className="text-sm dark:text-slate-200 px-2">{o.text}</span>
                      : <input value={o.text} onChange={e => setOpt(i, j, e.target.value)} placeholder={`${L.opt_ph}`} className="flex-1 min-w-0 px-3 py-2 min-h-[40px] rounded-lg border-b border-slate-200 dark:border-slate-700 bg-transparent dark:text-white dark:placeholder-slate-500 outline-none focus:border-blue-400" data-testid={`qb-opt-${i}-${j}`} />}
                    {q.type !== 'true_false' && q.options.length > 2 && (
                      <button onClick={() => delOpt(i, j)} className={iconBtn} aria-label="×"><X size={14} /></button>
                    )}
                  </div>
                ))}
                {q.type !== 'true_false' && (
                  <button onClick={() => addOpt(i)} className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline px-1 py-1" data-testid={`qb-addopt-${i}`}>{L.add_opt}</button>
                )}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap gap-2">
            <button onClick={() => setQs(a => [...a, mkQ()])} className="px-4 py-2.5 min-h-[44px] rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold text-sm flex items-center gap-1.5 hover:border-blue-400 hover:text-blue-600" data-testid="qb-addq"><Plus size={16} />{L.add_q}</button>
            <button onClick={() => setQs(a => [...a, mkQ('true_false')])} className="px-4 py-2.5 min-h-[44px] rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:border-blue-400 hover:text-blue-600">{L.add_tf}</button>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white dark:bg-slate-900 border-t dark:border-slate-700 p-4 flex flex-wrap items-center gap-3 rounded-b-2xl">
          <span className="text-xs font-semibold text-slate-400">{L.total}: {qs.length} • {L.total_p}: {totalPoints}</span>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-4 py-2.5 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-700 dark:text-white font-semibold text-sm">{L.cancel}</button>
            <button onClick={save} disabled={busy} className="px-5 py-2.5 min-h-[44px] rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold text-sm" data-testid="qb-save">{busy ? L.saving : L.save}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
