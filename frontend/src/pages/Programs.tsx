import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { useLang } from '../context/LangContext'
import { toast } from '../context/UIContext'
import { BookOpenCheck, Trash2, Upload, Plus, Edit3, Search, ChevronDown, ChevronRight, RotateCw, Award, FileSpreadsheet, X } from 'lucide-react'

type Topic = {
  id: number; subject: number|null; subject_name: string; subject_icon: string
  grade: string; num: number; title: string; description: string; created_by?: number|null
}

/**
 * Учебная программа КР: темы по предметам и классам.
 * Писать тему — учителю/админу (общую программу правит только админ);
 * всем участникам — читать. Импорт CSV: subject_slug;grade;num;title;критерии.
 */
export default function Programs(){
  const {t} = useLang()
  const [topics, setTopics] = useState<Topic[]|null>(null)
  const [dataErr, setDataErr] = useState(false)
  const [subjects, setSubjects] = useState<any[]>([])
  const [subject, setSubject] = useState('')
  const [grade, setGrade] = useState('')
  const [search, setSearch] = useState('')
  const [openAdd, setOpenAdd] = useState(false)
  const [edit, setEdit] = useState<Topic|null>(null)
  const [form, setForm] = useState({ num: 1, title: '', description: '' })
  const [busy, setBusy] = useState(false)
  const [standards, setStandards] = useState<any>(null)
  const [showStd, setShowStd] = useState(false)
  const [showCsv, setShowCsv] = useState(false)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const me = (()=>{ try{ return JSON.parse(localStorage.getItem('user')||'null') }catch{ return null } })()
  const canWrite = !!me && (me.role==='admin' || me.role==='teacher' || me.is_staff)
  const isAdmin = !!me && (me.role==='admin' || me.is_staff)
  const canEditTopic = (tp:Topic)=> isAdmin || (tp.created_by != null && me && Number(tp.created_by)===Number(me.id))

  const load = ()=>{
    setDataErr(false); setTopics(null)
    const params:any = {}
    if(subject) params.subject = subject
    if(grade) params.grade = grade
    client.get('/topics/', { params })
      .then(r=>setTopics(Array.isArray(r.data)?r.data:r.data.results||[]))
      .catch(()=>{ setTopics([]); setDataErr(true) })
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
      toast(`${t('prog_seed_ok')}: +${r.data.created} ${t('prog_topics_cnt')} (${t('prog_updated')}: ${r.data.updated})`, 'success')
      load()
    }catch(e:any){
      toast(e?.response?.data?.detail||t('prog_seed_err'),'error')
    }finally{ setBusy(false) }
  }

  const saveTopic = async ()=>{
    const title = form.title.trim()
    if(!title){ toast(t('prog_need_title'),'error'); return }
    if(!subject){ toast(t('prog_need_subject'),'error'); return }
    try{
      if(edit){
        await client.patch(`/topics/${edit.id}/`, { title, num: form.num, description: form.description.trim() })
        toast(t('prog_topic_updated'),'success')
      } else {
        await client.post('/topics/', { subject: subject, grade: grade, num: form.num, title, description: form.description.trim() })
        toast(t('prog_topic_added'),'success')
      }
      setOpenAdd(false); setEdit(null); setForm({num:1,title:'',description:''}); load()
    }catch(e:any){ toast(e?.response?.data?.detail||e?.response?.data?.title||t('prog_save_err'),'error') }
  }

  const delTopic = async (id:number, title:string)=>{
    if(!confirm(`${t('prog_del_confirm')} «${title}»?`)) return
    try{ await client.delete(`/topics/${id}/`); load(); toast(t('prog_topic_deleted'),'success') }catch{ toast(t('prog_save_err'),'error') }
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
    }catch(e:any){ toast(e?.response?.data?.file||e?.response?.data?.detail||t('prog_save_err'),'error') }
  }

  const grades = useMemo(()=>{
    const gs = new Set<string>((topics||[]).map(x=>String(x.grade||'')).filter(Boolean))
    for(let i=1;i<=11;i++) gs.add(String(i))
    return [...gs].sort((a,b)=>Number(a)-Number(b))
  },[topics])

  const filtered = useMemo(()=>{
    const q = search.trim().toLowerCase()
    if(!q) return topics||[]
    return (topics||[]).filter(x=> (x.title||'').toLowerCase().includes(q) || (x.description||'').toLowerCase().includes(q))
  },[topics, search])

  const grouped = useMemo(()=>{
    const g: Record<string, Topic[]> = {}
    filtered.forEach(x=>{
      const key = `${x.subject || x.subject_name}`
      const k = `${x.subject_icon||''} ${x.subject_name||'—'}${x.grade? ` · ${x.grade} ${t('prog_grade_cls')}`:''}`.trim()
      ;(g[k] = g[k]||[]).push(x)
    })
    return Object.entries(g)
      .map(([k, arr])=>({ k, arr: [...arr].sort((a,b)=>a.num-b.num) }))
      .sort((a,b)=>{
        const ai = subjects.findIndex(s=>a.k.includes(s.name))
        const bi = subjects.findIndex(s=>b.k.includes(s.name))
        return (ai<0?999:ai)-(bi<0?999:bi)
      })
  },[filtered, subjects])

  const totalShown = filtered.length
  const hasFilters = !!(subject || grade || search.trim())
  const resetFilters = ()=>{ setSubject(''); setGrade(''); setSearch('') }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white"><BookOpenCheck className="text-indigo-600"/>{t('prog_t')}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('prog_subtitle')}</p>
      </div>

      {/* Фильтры + поиск */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            {t('prog_sel_subject')}:
            <select value={subject} onChange={e=>setSubject(e.target.value)}
              className="px-3 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm min-w-[190px]">
              <option value="">{t('prog_all_subjects')}</option>
              {subjects.map((s:any)=><option key={s.id} value={s.id}>{s.icon||''} {s.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500">
            {t('prog_sel_grade')}:
            <select value={grade} onChange={e=>setGrade(e.target.value)}
              className="px-3 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm min-w-[130px]">
              <option value="">{t('prog_all_grades')}</option>
              {grades.map(g=><option key={g} value={g}>{g} {t('prog_grade_cls')}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold text-slate-500 flex-1 min-w-[180px]">
            {t('prog_search')}:
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('prog_search_ph')}
                className="w-full pl-9 pr-8 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm"/>
              {search && <button onClick={()=>setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"><X size={14}/></button>}
            </div>
          </label>
        </div>
        {hasFilters && (
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{t('prog_found')}: <b className="text-slate-700 dark:text-slate-200">{totalShown}</b></span>
            <button onClick={resetFilters} className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-semibold">{t('prog_reset')}</button>
          </div>
        )}
        {canWrite && (
          <div className="flex flex-wrap gap-2 pt-1 border-t dark:border-slate-800">
            <button onClick={()=>{ setOpenAdd(o=>!o); setEdit(null); if(!grade){ /* подсказка выбрана при сохранении */ } }} data-testid="topic-add-toggle"
              className="px-4 py-2 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center gap-1 hover:bg-indigo-700">
              <Plus size={15}/>{t('prog_add')}
            </button>
            <button onClick={seedKR} disabled={busy} data-testid="topic-seed-kr" title={t('prog_seed_tip')}
              className="px-4 py-2 min-h-[44px] rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1 hover:bg-emerald-700 disabled:opacity-50">
              <Award size={15}/>{t('prog_seed_btn')}
            </button>
            <label className="px-4 py-2 min-h-[44px] rounded-xl bg-white dark:bg-slate-800 border dark:border-slate-700 text-sm font-semibold inline-flex items-center gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:text-white">
              <Upload size={15}/>{t('prog_csv')}
              <input type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(f) importCsv(f); e.target.value='' }}/>
            </label>
            <button onClick={()=>setShowCsv(s=>!s)} className="px-3 py-2 min-h-[44px] rounded-xl text-sm font-semibold text-slate-500 hover:text-indigo-600 flex items-center gap-1">
              <FileSpreadsheet size={15}/>{t('prog_csv_help')}
            </button>
          </div>
        )}
      </div>

      {/* Форма добавления/редактирования */}
      {(openAdd || edit) && canWrite && (
        <div className="bg-indigo-50/60 dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-slate-700 p-4 space-y-2">
          <div className="text-xs font-bold text-indigo-700 dark:text-indigo-300">{edit? t('prog_edit_topic') : t('prog_new_topic')}</div>
          <div className="flex flex-wrap gap-2 items-end">
            <input type="number" min={1} value={form.num} onChange={e=>setForm(f=>({...f,num:Number(e.target.value)||1}))}
              data-testid="topic-num" aria-label={t('prog_num')}
              className="w-20 px-3 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm"/>
            <input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
              onKeyDown={e=>e.key==='Enter'&&saveTopic()} placeholder={t('prog_title_ph')}
              data-testid="topic-title"
              className="flex-1 min-w-[200px] px-3 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm"/>
            <button onClick={saveTopic} data-testid="topic-save"
              className="px-4 py-2 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-semibold">{t('save')||'Сохранить'}</button>
            <button onClick={()=>{ setOpenAdd(false); setEdit(null) }}
              className="px-4 py-2 min-h-[44px] rounded-xl bg-slate-200 dark:bg-slate-700 text-sm font-semibold dark:text-white">{t('cancel')||'Отмена'}</button>
          </div>
          <input value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
            onKeyDown={e=>e.key==='Enter'&&saveTopic()} placeholder={t('prog_criteria_ph')}
            data-testid="topic-criteria"
            className="w-full px-3 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-800 dark:text-white text-sm"/>
          {!edit && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('prog_new_topic_hint')}</div>
          )}
        </div>
      )}

      {/* Критерии оценивания (сворачиваемый блок) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-indigo-200 dark:border-slate-700 overflow-hidden">
        <button onClick={()=>setShowStd(s=>!s)} className="w-full p-4 flex items-center justify-between gap-2 text-left">
          <div className="text-sm font-bold dark:text-white flex items-center gap-1.5">
            <Award size={16} className="text-indigo-600 shrink-0"/>
            <span>{t('prog_std_title')}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold">5-балльная + %</span>
            {showStd? <ChevronDown size={18} className="text-slate-400"/> : <ChevronRight size={18} className="text-slate-400"/>}
          </div>
        </button>
        {showStd && (
          <div className="px-4 pb-4 space-y-2">
            <div className="grid sm:grid-cols-4 gap-2 text-xs">
              {(standards?.grading_scale || [
                { grade: 5, label: 'Отлично (Эң жакшы)', min_pct: 85, max_pct: 100, criteria: 'Полное освоение темы по стандарту КР, решение нестандартных задач без ошибок' },
                { grade: 4, label: 'Хорошо (Жакшы)', min_pct: 70, max_pct: 84, criteria: 'Освоение базовых и профильных понятий, допускаются 1–2 негрубые ошибки' },
                { grade: 3, label: 'Удовлетворительно (Канааттандырарлык)', min_pct: 50, max_pct: 69, criteria: 'Понимание основного материала, решение типовых задач по образцу' },
                { grade: 2, label: 'Требуется подтянуть (Жетишсиз)', min_pct: 0, max_pct: 49, criteria: 'Пробелы в базовых знаниях темы, требуется индивидуальная работа и повторная диагностика' },
              ]).map((g:any)=>(
                <div key={g.grade} className={`p-2.5 rounded-xl border ${g.grade===5?'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800':g.grade===4?'bg-sky-50/70 border-sky-200 dark:bg-sky-900/20 dark:border-sky-800':g.grade===3?'bg-amber-50/70 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800':'bg-red-50/70 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                  <div className="font-bold dark:text-white">{t('prog_grade_n')} «{g.grade}» ({g.min_pct}–{g.max_pct}%)</div>
                  <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{g.label}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{g.criteria}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Помощь по CSV (сворачиваемый блок) */}
      {showCsv && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
          <div className="text-sm font-bold dark:text-white mb-1">{t('prog_csv_format')}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">{t('prog_csv_cols')} <code className="font-mono">предмет;класс;№;тема;критерии_оценивания</code></div>
          <pre className="mt-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-[11px] dark:text-slate-200 overflow-x-auto font-mono">matematika;8;1;Действия с дробями;Критерий КР: складывает и умножает дроби без ошибок
matematika;8;2;Степени и корни;Критерий КР: применяет свойства степеней и арифметического корня
himiya;8;1;Периодическая система;Критерий КР: определяет заряд ядра и валентность по таблице Менделеева</pre>
        </div>
      )}

      {dataErr && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 p-8 text-center">
          <div className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3">{t('prog_load_err')}</div>
          <button onClick={load} className="px-4 py-2 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-semibold inline-flex items-center gap-2">
            <RotateCw size={15}/>{t('prog_retry')}
          </button>
        </div>
      )}

      {topics===null && !dataErr && <div className="skeleton h-24 rounded-2xl"/>}

      {topics!==null && !dataErr && topics.length===0 && !hasFilters && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-10 text-center space-y-3">
          <BookOpenCheck size={40} className="mx-auto text-slate-300 dark:text-slate-600"/>
          <div className="font-semibold dark:text-white">{t('prog_empty_title')}</div>
          <div className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">{t('prog_empty_hint')}</div>
          {canWrite && (
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <button onClick={seedKR} disabled={busy} className="px-4 py-2 min-h-[44px] rounded-xl bg-emerald-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-50">
                <Award size={15}/>{t('prog_seed_btn')}
              </button>
              <button onClick={()=>setOpenAdd(true)} className="px-4 py-2 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-semibold inline-flex items-center gap-1.5">
                <Plus size={15}/>{t('prog_add')}
              </button>
            </div>
          )}
        </div>
      )}

      {topics!==null && !dataErr && topics.length>0 && filtered.length===0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-10 text-center text-slate-400">{t('prog_search_none')}</div>
      )}

      {grouped.map(g=>{
        const isCollapsed = collapsed[g.k]===true
        return (
        <div key={g.k} className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 overflow-hidden" data-testid="topic-group">
          <button onClick={()=>setCollapsed(c=>({...c,[g.k]:!c[g.k]}))} className="w-full p-4 flex items-center justify-between gap-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <div className="font-bold dark:text-white truncate">{g.k}</div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 font-semibold">{g.arr.length}</span>
              {isCollapsed? <ChevronRight size={18} className="text-slate-400"/> : <ChevronDown size={18} className="text-slate-400"/>}
            </div>
          </button>
          {!isCollapsed && (
          <div className="px-4 pb-4 space-y-1">
            {g.arr.map(tp=>(
              <div key={tp.id} className="flex items-start gap-2 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 group" data-testid={`topic-${tp.id}`}>
                <span className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 flex items-center justify-center font-bold text-sm shrink-0">{tp.num}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm dark:text-white break-words">{tp.title}</div>
                  {tp.description && <div className="text-xs text-emerald-700 dark:text-emerald-400 mt-0.5 break-words">✓ {tp.description}</div>}
                </div>
                {canEditTopic(tp) && (
                  <div className="flex shrink-0 opacity-60 group-hover:opacity-100">
                    <button onClick={()=>{ setOpenAdd(true); setEdit(tp); setForm({num:tp.num,title:tp.title,description:tp.description||''}) }} aria-label={t('edit')||'Править'}
                      className="p-2 text-slate-400 hover:text-indigo-600"><Edit3 size={15}/></button>
                    <button onClick={()=>delTopic(tp.id, tp.title)} aria-label={t('delete')||'Удалить'}
                      className="p-2 text-slate-400 hover:text-red-500"><Trash2 size={15}/></button>
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
        )
      })}
    </div>
  )
}
