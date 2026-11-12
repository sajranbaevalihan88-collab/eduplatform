import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { useLang } from '../context/LangContext'
import { toast } from '../context/UIContext'
import { BookOpenCheck, Trash2, Upload, Plus, Edit3 } from 'lucide-react'

type Topic = {
  id: number; subject: number|null; subject_name: string; subject_icon: string
  grade: string; num: number; title: string; description: string
}

/**
 * Учебная программа КР: темы по предметам и классам.
 * Писать тему — учителю/админу; всем участникам — читать.
 * Импорт CSV: subject_slug;grade;num;title — один раз переносится готовая программа.
 */
export default function Programs(){
  const {t} = useLang()
  const [topics, setTopics] = useState<Topic[]|null>(null)
  const [subjects, setSubjects] = useState<any[]>([])
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [openAdd, setOpenAdd] = useState(false)
  const [edit, setEdit] = useState<Topic|null>(null)
  const [form, setForm] = useState({ num: 1, title: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [standards, setStandards] = useState<any>(null)

  const load = ()=>{
    const params:any = {}
    if(subject) params.subject = subject
    if(grade.trim()) params.grade = grade.trim()
    client.get('/topics/', { params })
      .then(r=>setTopics(Array.isArray(r.data)?r.data:r.data.results||[]))
      .catch(()=>setTopics([]))
  }
  useEffect(()=>{ load() },[subject, grade])
  useEffect(()=>{
    client.get('/subjects/').then(r=>{
      const arr = Array.isArray(r.data)?r.data:r.data.results||[]
      setSubjects(arr)
      return null
    }).catch(()=>{})
    client.get('/topics/standards_kr/').then(r=>setStandards(r.data)).catch(()=>{})
  },[])

  const seedKR = async ()=>{
    setBusy(true)
    try{
      const r = await client.post('/topics/seed_kr/')
      toast(`Программа КР загружена: +${r.data.created} тем (обновлено критериев: ${r.data.updated})`, 'success')
      load()
    }catch(e:any){
      toast(e?.response?.data?.detail||'Ошибка загрузки программы КР','error')
    }finally{ setBusy(false) }
  }

  const saveTopic = async ()=>{
    const title = form.title.trim()
    if(!title){ toast('Напиши название темы','error'); return }
    if(!subject){ toast('Выбери предмет сверху','error'); return }
    try{
      if(edit){
        await client.patch(`/topics/${edit.id}/`, { title, num: form.num, description: form.description.trim() })
        toast('Тема обновлена','success')
      } else {
        await client.post('/topics/', { subject: subject, grade: grade.trim(), num: form.num, title, description: form.description.trim() })
        toast('Тема добавлена','success')
      }
      setOpenAdd(false); setEdit(null); setForm({num:1,title:'',description:''}); load()
    }catch(e:any){ toast(e?.response?.data?.detail||e?.response?.data?.title||'err','error') }
  }

  const delTopic = async (id:number, title:string)=>{
    if(!confirm(`Удалить тему «${title}»?`)) return
    try{ await client.delete(`/topics/${id}/`); load(); toast('Тема удалена','success') }catch{}
  }

  const importCsv = async (file: File)=>{
    const fd = new FormData(); fd.append('file', file)
    try{
      const r = await client.post('/topics/import_csv/', fd, { headers:{'Content-Type':'multipart/form-data'} })
      toast(`${t('prog_imported')}: ${r.data.created + (r.data.updated||0)}`, 'success')
      if(r.data.skipped && r.data.skipped.length){
        toast(r.data.skipped[0], 'error')
      }
      load()
    }catch(e:any){ toast(e?.response?.data?.file||e?.response?.data?.detail||'err','error') }
  }

  const grouped = useMemo(()=>{
    const g: Record<string, Topic[]> = {}
    ;(topics||[]).forEach(x=>{
      const k = `${x.subject_icon||''} ${x.subject_name||''}`.trim() + (x.grade? ` · ${x.grade} класс` : '')
      ;(g[k] = g[k]||[]).push(x)
    })
    return Object.entries(g).map(([k, arr])=>({ k, arr: [...arr].sort((a,b)=>a.num-b.num) }))
  },[topics])

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white"><BookOpenCheck className="text-indigo-600"/>{t('prog_t')}</h1>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 flex flex-wrap gap-2 items-end">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
          {t('prog_sel_subject')}:
          <select value={subject} onChange={e=>setSubject(e.target.value)}
            className="px-3 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm min-w-[180px]">
            <option value="">Все предметы</option>
            {subjects.map((s:any)=><option key={s.id} value={s.id}>{s.icon||''} {s.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
          {t('prog_sel_grade')}:
          <input value={grade} onChange={e=>setGrade(e.target.value)} placeholder="8"
            className="px-3 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 text-sm w-[90px]"/>
        </label>
        <button onClick={()=>{ setOpenAdd(o=>!o); setEdit(null) }} data-testid="topic-add-toggle"
          className="px-4 py-2 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center gap-1">
          <Plus size={15}/>{t('prog_add')}
        </button>
        <button onClick={seedKR} disabled={busy} data-testid="topic-seed-kr"
          className="px-4 py-2 min-h-[44px] rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-50">
          🇰🇬 Загрузить госстандарт КР
        </button>
        <label className="ml-auto px-4 py-2 min-h-[44px] rounded-xl bg-white dark:bg-slate-800 border text-sm font-semibold inline-flex items-center gap-1 cursor-pointer">
          <Upload size={15}/>{t('prog_csv')}
          <input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(f) importCsv(f); e.target.value='' }}/>
        </label>
      </div>

      {/* Государственный стандарт оценивания КР (МОиН КР) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-slate-700 p-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm font-bold dark:text-white flex items-center gap-1.5">🇰🇬 Критерии оценивания по государственным стандартам Кыргызской Республики (МОиН КР)</div>
          <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold">5-балльная и %-шкала освоения</span>
        </div>
        <div className="grid sm:grid-cols-4 gap-2 text-xs">
          {(standards?.grading_scale || [
            { grade: 5, label: 'Отлично (Эң жакшы)', min_pct: 85, max_pct: 100, criteria: 'Полное освоение темы по стандарту КР, решение нестандартных задач без ошибок' },
            { grade: 4, label: 'Хорошо (Жакшы)', min_pct: 70, max_pct: 84, criteria: 'Освоение базовых и профильных понятий, допускаются 1–2 негрубые ошибки' },
            { grade: 3, label: 'Удовлетворительно (Канааттандырарлык)', min_pct: 50, max_pct: 69, criteria: 'Понимание основного материала, решение типовых задач по образцу' },
            { grade: 2, label: 'Требуется подтянуть (Жетишсиз)', min_pct: 0, max_pct: 49, criteria: 'Пробелы в базовых знаниях темы, требуется индивидуальная работа и повторная диагностика' },
          ]).map((g:any)=>(
            <div key={g.grade} className={`p-2.5 rounded-xl border ${g.grade===5?'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800':g.grade===4?'bg-sky-50/70 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800':g.grade===3?'bg-amber-50/70 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800':'bg-red-50/70 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
              <div className="font-bold dark:text-white">Оценка «{g.grade}» ({g.min_pct}–{g.max_pct}%)</div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{g.label}</div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{g.criteria}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-indigo-100 dark:border-slate-700 p-4">
        <div className="text-sm font-bold dark:text-white mb-1">Формат CSV (с критериями оценивания КР)</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">Файл в Excel: сохрани как CSV и импортируй сюда. Колонки: <code className="font-mono">предмет;класс;№;тема;критерии_оценивания</code></div>
        <pre className="mt-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] dark:text-slate-200 overflow-x-auto font-mono">matematika;8;1;Действия с дробями;Критерий КР: складывает и умножает дроби без ошибок
matematika;8;2;Степени и корни;Критерий КР: применяет свойства степеней и арифметического корня
himiya;8;1;Периодическая система;Критерий КР: определяет заряд ядра и валентность по таблице Менделеева</pre>
      </div>

      {(openAdd || edit) && (
        <div className="bg-indigo-50/60 dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-slate-700 p-4 flex flex-wrap gap-2 items-end">
          <input type="number" min={1} value={form.num} onChange={e=>setForm(f=>({...f,num:Number(e.target.value)||1}))}
            data-testid="topic-num" aria-label="№ темы"
            className="w-20 px-3 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/>
          <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
            onKeyDown={e=>e.key==='Enter'&&saveTopic()} placeholder="Название темы…"
            data-testid="topic-title"
            className="flex-1 min-w-[200px] px-3 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/>
          <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
            onKeyDown={e=>e.key==='Enter'&&saveTopic()} placeholder="Критерии оценивания по стандарту КР (что ученик должен уметь)…"
            data-testid="topic-criteria"
            className="flex-1 min-w-[240px] px-3 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"/>
          <button onClick={saveTopic} data-testid="topic-save"
            className="px-4 py-2 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-semibold">{t('save')||'Сохранить'}</button>
          <button onClick={()=>{ setOpenAdd(false); setEdit(null) }}
            className="px-4 py-2 min-h-[44px] rounded-xl bg-slate-200 dark:bg-slate-700 text-sm font-semibold">{t('cancel')||'Отмена'}</button>
        </div>
      )}

      {topics===null && <div className="skeleton h-24 rounded-2xl"/>}
      {topics!==null && topics.length===0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-10 text-center text-slate-400">{t('prog_empty')}</div>
      )}

      {grouped.map(g=>(
        <div key={g.k} className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4" data-testid="topic-group">
          <div className="font-bold dark:text-white mb-2">{g.k}</div>
          <div className="space-y-1">
            {g.arr.map(tp=>(
              <div key={tp.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800" data-testid={`topic-${tp.id}`}>
                <span className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 flex items-center justify-center font-bold text-sm shrink-0">{tp.num}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm dark:text-white truncate">{tp.title}</div>
                  {tp.description && <div className="text-xs text-emerald-700 dark:text-emerald-400 truncate">✓ {tp.description}</div>}
                </div>
                <button onClick={()=>{ setOpenAdd(true); setEdit(tp); setForm({num:tp.num,title:tp.title,description:tp.description||''}) }} aria-label="Править"
                  className="p-2 text-slate-400 hover:text-indigo-600"><Edit3 size={15}/></button>
                <button onClick={()=>delTopic(tp.id, tp.title)} aria-label="Удалить"
                  className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={15}/></button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
