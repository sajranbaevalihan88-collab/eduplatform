import { useEffect, useMemo, useState } from 'react'
import client from '../api/client'
import { Link } from 'react-router-dom'
import { Plus, FlaskConical, Clock, Target, Search, Zap, X } from 'lucide-react'
import { canTeach, isStudent } from '../utils/role'
import { requestGuardFullscreen } from '../utils/shotGuard'
import { useLang, type Lang } from '../context/LangContext'

function formatQCount(n: number, lang: Lang): string {
  const num = Number(n) || 0
  if (lang === 'en') return `${num} ${num === 1 ? 'question' : 'questions'}`
  if (lang === 'kg') return `${num} суроо`
  const mod10 = num % 10
  const mod100 = num % 100
  if (mod10 === 1 && mod100 !== 11) return `${num} вопрос`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${num} вопроса`
  return `${num} вопросов`
}

export default function Tests(){
  const {t, lang}=useLang()
  const [list,setList]=useState<any[]>([])
  const [q,setQ]=useState('')
  const [subjFilter,setSubjFilter]=useState<string>('all')
  const [me,setMe]=useState<any>(null)
  useEffect(()=>{
    client.get('/tests/').then(r=>setList(Array.isArray(r.data)?r.data:r.data.results||[]))
    const raw=localStorage.getItem('user'); if(raw) try{ setMe(JSON.parse(raw)) }catch{}
    const h=()=>{ const r=localStorage.getItem('user'); if(r) try{ setMe(JSON.parse(r)) }catch{} else setMe(null) }
    window.addEventListener('auth-change', h as any); window.addEventListener('storage', h)
    return ()=>{ window.removeEventListener('auth-change', h as any); window.removeEventListener('storage', h)}
  },[])
  const canEdit=(item:any)=> me && (String(item.owner)===String(me.id) || String(item.owner_id)===String(me.id) || me.role==='admin' || me.is_staff)
  const subjectNames = useMemo(()=>{
    const set = new Set<string>()
    list.forEach(item => { if (item.subject_name) set.add(String(item.subject_name)) })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [list])
  const filtered=list.filter(item=>{
    if (subjFilter !== 'all' && String(item.subject_name || '') !== subjFilter) return false
    if (!q.trim()) return true
    const needle = q.trim().toLowerCase()
    return (item.title||'').toLowerCase().includes(needle) || (item.description||'').toLowerCase().includes(needle) || (item.subject_name||'').toLowerCase().includes(needle)
  })
  return (
    <div className="space-y-5 page-enter">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <span className="p-2 rounded-xl bg-rose-600 text-white shadow-sm"><FlaskConical size={20}/></span>
            {t('tests')}
            <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-0.5 rounded-full">{filtered.length}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <div className="relative group flex-1 sm:w-[260px] md:w-[300px]">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder={t('tests_search_ph')}
              className="pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder:text-slate-400 w-full text-sm focus-ring"
            />
            {q && (
              <button
                type="button"
                onClick={()=>setQ('')}
                aria-label={t('close')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={14}/>
              </button>
            )}
          </div>
          {!isStudent() && (
            <Link to="/tests/new" className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm flex items-center gap-1.5 shadow-sm btn-hover shrink-0">
              <Plus size={18}/>{t('tests_create')}
            </Link>
          )}
        </div>
      </div>

      {subjectNames.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto tab-scroll pb-1">
          <button
            type="button"
            onClick={()=>setSubjFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition ${
              subjFilter==='all'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            Все ({list.length})
          </button>
          {subjectNames.map(sn=>(
            <button
              key={sn}
              type="button"
              onClick={()=>setSubjFilter(sn)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border whitespace-nowrap transition ${
                subjFilter===sn
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {sn}
            </button>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(item=>{
          const qCount = item.questions_count ?? item.questions?.length ?? 0
          const timeText = item.time_limit > 0
            ? `${item.time_limit} ${t('tests_min')}`
            : item.time_per_question > 0
              ? `${item.time_per_question}${t('tt_per_q')}`
              : t('tests_no_limit')
          return (
          <div key={item.id} className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-5 card-hover flex flex-col">
            <div className="flex items-start justify-between gap-2">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-900/50 flex items-center justify-center shrink-0">
                <FlaskConical size={20}/>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                {formatQCount(qCount, lang)}
              </span>
            </div>
            <h3 className="font-bold text-base mt-3 text-slate-900 dark:text-white line-clamp-2">{item.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mt-1">{item.description||t('tests_no_desc')}</p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs mt-3">
              {item.is_public
                ? <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 font-semibold">{t('tests_public')}</span>
                : <span className="px-2.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60 font-semibold">{t('tests_private')}</span>}
              {item.subject_name && <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60 font-semibold">{item.subject_name}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs mt-3 text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><Target size={13}/> {t('tests_pass')} {item.pass_score}%</span>
              <span className="flex items-center gap-1"><Clock size={13}/> {timeText}</span>
            </div>
            <div className="flex gap-2 mt-auto pt-4">
              <Link to={`/tests/${item.id}/take`} onClick={()=>requestGuardFullscreen()} className="flex-1 px-3 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold text-center flex items-center justify-center transition">
                {t('tests_take')}
              </Link>
              {canTeach() && (
                <Link to={`/live/host?test=${item.id}`} title="Запустить Билим-Квиз Live (Kahoot)"
                  className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-sm font-bold flex items-center justify-center gap-1 transition">
                  <Zap size={15}/> Live
                </Link>
              )}
              {canEdit(item) ? (
                <Link to={`/tests/${item.id}`} className="px-3.5 py-2.5 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 text-sm font-semibold flex items-center justify-center transition">
                  {t('edit')}
                </Link>
              ) : (
                <span className="px-3 py-2.5 min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-sm flex items-center justify-center" title={t('tests_lock')}>🔒</span>
              )}
            </div>
          </div>
          )
        })}
      </div>

      {filtered.length===0 && (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 px-6" data-testid="tests-empty">
          <div className="text-4xl mb-3">🧪</div>
          <div className="text-slate-500 dark:text-slate-400 mb-5">{(q || subjFilter !== 'all') ? t('tests_empty_search') : t('tests_empty')}</div>
          {(q || subjFilter !== 'all') ? (
            <button type="button" onClick={()=>{ setQ(''); setSubjFilter('all') }} className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition">
              {t('lessons_reset_short')}
            </button>
          ) : !isStudent() && (
            <Link to="/tests/new" data-testid="tests-cta" className="inline-flex px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-semibold btn-hover shadow-md">
              <Plus size={18} className="inline mr-1"/>{t('dash_new_test')}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
