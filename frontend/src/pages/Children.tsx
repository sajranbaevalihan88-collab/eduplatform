import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { BookOpenCheck, GraduationCap, Clock, Users, TrendingUp, CalendarCheck } from 'lucide-react'
import { useLang } from '../context/LangContext'
import { toast } from '../context/UIContext'

type Child = {
  id: number
  username: string
  first_name: string
  total: number
  graded: number
  avg: number | null
  classes: Array<{ classroom_id: number; title: string; color: string; avg: number | null; graded: number; total: number }>
}
type DiaryRow = {
  classroom_id: number; classroom_title: string; classroom_color: string
  assignment_id: number; title: string; kind: string
  score: number | null; mark: string | null; status: string
  max_score: number | null; deadline: string | null; date: string
}
type DiaryData = { rows: DiaryRow[]; classes: any[] }

/** Страница родителя: дети + успеваемость каждого ребёнка (дневник по api с ?student=). */
export default function Children(){
  const {t}=useLang()
  const [kids,setKids]=useState<Child[]|null>(null)
  const [sel,setSel]=useState<string>('')
  const [diary,setDiary]=useState<DiaryData|null>(null)
  const [filter,setFilter]=useState<number|null>(null)
  const [attendance,setAttendance]=useState<any>(null)
  const [progress,setProgress]=useState<any>(null)

  useEffect(()=>{
    client.get('/auth/children/')
      .then(r=>{ const arr:Child[]=Array.isArray(r.data)?r.data:[]; setKids(arr); if(arr.length&&!sel) setSel(arr[0].username) })
      .catch((e:any)=>{ setKids([]); toast(e?.response?.data?.error||t('error'),'error') })
  },[])

  useEffect(()=>{
    if(!sel){ setDiary(null); return }
    setDiary(null)
    client.get('/classrooms/my_diary/',{ params:{ student: sel } })
      .then(r=>setDiary(r.data))
      .catch(()=>setDiary({rows:[],classes:[]}))
    client.get('/classrooms/my_attendance/',{ params:{ student: sel, days: 90 } })
      .then(r=>setAttendance(r.data))
      .catch(()=>setAttendance(null))
    client.get('/classrooms/my_progress/',{ params:{ student: sel } })
      .then(r=>setProgress(r.data))
      .catch(()=>setProgress(null))
  },[sel])

  const cur = useMemo(()=> (kids||[]).find(k=>k.username===sel) || null, [kids, sel])
  const rows = useMemo(()=>{
    if(!diary) return []
    return filter==null? diary.rows : diary.rows.filter(r=>r.classroom_id===filter)
  },[diary,filter])

  const scoreCls=(s:number, max?:number)=>{
    const pct = max && max>0 ? (s/max)*100 : s
    if(pct>=85) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if(pct>=70) return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-red-50 text-red-600 border-red-200'
  }

  if(kids===null) return <div className="p-8 text-center"><div className="skeleton h-32 rounded-2xl max-w-2xl mx-auto"/></div>

  if(kids.length===0){
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-10 text-center">
          <Users size={40} className="mx-auto mb-3 text-slate-300"/>
          <div className="text-lg font-bold dark:text-white">{t('children_empty_t')}</div>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{t('children_empty_hint')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white"><Users className="text-indigo-600"/>{t('children_t')}</h1>

      {/* Выбор ребёнка */}
      <div className="flex flex-wrap gap-2">
        {kids.map(k=>(
          <button key={k.id} onClick={()=>{ setSel(k.username); setFilter(null) }}
            className={`px-4 py-2.5 min-h-[44px] rounded-xl text-sm font-semibold border transition ${sel===k.username?'bg-indigo-600 text-white border-indigo-600 shadow-md':'bg-white dark:bg-slate-900 dark:text-white border-slate-200 dark:border-slate-700 hover:border-indigo-300'}`}>
            {k.first_name||k.username}
            {k.avg!=null && (
              <span className={`ml-2 px-1.5 py-0.5 rounded-md text-xs ${sel===k.username?'bg-white/20':'bg-slate-100 dark:bg-slate-800'}`}><TrendingUp size={11} className="inline -mt-0.5"/>{k.avg}</span>
            )}
          </button>
        ))}
      </div>

      {/* Сводка по ребёнку */}
      {cur && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
            <TrendingUp size={18} className="mx-auto text-indigo-600"/>
            <div className="text-xl font-bold mt-1.5 dark:text-white">{cur.avg!=null? cur.avg : '—'}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t('children_avg')}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
            <BookOpenCheck size={18} className="mx-auto text-emerald-600"/>
            <div className="text-xl font-bold mt-1.5 dark:text-white">{cur.graded}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t('children_graded')}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
            <Clock size={18} className="mx-auto text-amber-600"/>
            <div className="text-xl font-bold mt-1.5 dark:text-white">{cur.total}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t('children_total')}</div>
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
            <GraduationCap size={18} className="mx-auto text-violet-600"/>
            <div className="text-xl font-bold mt-1.5 dark:text-white">{cur.classes.length}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{t('children_classes')}</div>
          </div>
        </div>
      )}

      {/* Фильтр по классам */}
      {diary && diary.classes.length>0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>setFilter(null)} className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold border transition ${filter===null?'bg-indigo-600 text-white border-indigo-600':'bg-white dark:bg-slate-900 dark:text-white border-slate-200 dark:border-slate-700'}`}>
            {t('diary_all')}
          </button>
          {diary.classes.map(c=>(
            <button key={c.classroom_id} onClick={()=>setFilter(c.classroom_id)}
              className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${filter===c.classroom_id?'text-white border-transparent':'bg-white dark:bg-slate-900 dark:text-white border-slate-200 dark:border-slate-700'}`}
              style={filter===c.classroom_id?{backgroundColor:c.color}:{}}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: filter===c.classroom_id? 'rgba(255,255,255,.8)' : c.color}}/>
              {c.title}
              {c.avg!=null && <span className={`ml-1 px-1.5 py-0.5 rounded-md ${filter===c.classroom_id?'bg-white/20':'bg-slate-100 dark:bg-slate-800'}`}>{c.avg}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Посещаемость — за последние 3 месяца */}
      {attendance && attendance.rows && attendance.rows.length>0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
          <h2 className="font-bold flex items-center gap-2 dark:text-white">
            <CalendarCheck size={17} className="text-indigo-600"/>{t('diary_att')||'Посещаемость'}
            <span className="text-xs font-medium text-slate-400">за 90 дней</span>
          </h2>
          <div className="grid sm:grid-cols-2 gap-2 mt-3">
            {(attendance.classes||[]).map((c:any)=>(
              <div key={c.classroom_id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 text-sm">
                <div className="font-semibold dark:text-white">{c.title}</div>
                <div className="flex gap-3 mt-1 text-xs">
                  <span className="text-emerald-600 font-bold">✓ {c.present||0}</span>
                  <span className="text-red-600 font-bold">✕ {c.absent||0}</span>
                  <span className="text-amber-600 font-bold">⏰ {c.late||0}</span>
                  <span className="text-slate-400">· {t('cls_att_absent_day')||''}{(c.present||0)+(c.absent||0)+(c.late||0)+(c.excused||0)}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-1 max-h-40 overflow-auto">
            {attendance.rows.slice(0,12).map((r:any,i:number)=>(
              <div key={i} className="flex items-center gap-2 text-xs dark:text-slate-300">
                <span className="font-semibold">{r.date}</span>
                <span className="text-slate-400">{r.classroom_title}</span>
                <span className={`px-1.5 py-0.5 rounded-md font-bold ${r.status==='present'?'bg-emerald-100 text-emerald-700': r.status==='absent'?'bg-red-100 text-red-700': r.status==='late'?'bg-amber-100 text-amber-700':'bg-slate-200 text-slate-500'}`}>
                  {r.status==='present'?'был': r.status==='absent'?'не был': r.status==='late'?'опоздал':'освобождён'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Прогресс по темам: что умеет, что подтянуть */}
      {progress && progress.topics && progress.topics.length>0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
          <h2 className="font-bold flex items-center gap-2 dark:text-white">
            <TrendingUp size={17} className="text-indigo-600"/>Путь обучения и темы
            <span className="text-xs font-medium text-slate-400">изучено {progress.mastered.length} · подтянуть {progress.gaps.length}</span>
          </h2>
          <div className="mt-3 space-y-2.5">
            {progress.topics.map((tp:any)=>(
              <div key={tp.topic_id}>
                <div className="flex items-center gap-2 text-sm mb-1">
                  <span className="flex-1 truncate dark:text-white">{tp.title}</span>
                  <span className={`font-bold ${tp.pct>=80?'text-emerald-600': tp.pct>=50?'text-sky-600':'text-red-600'}`}>{tp.pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${tp.pct>=80?'bg-emerald-500': tp.pct>=50?'bg-sky-500':'bg-red-500'}`} style={{ width: `${Math.max(2, tp.pct)}%` }}/>
                </div>
              </div>
            ))}
          </div>
          {progress.diagnostics && progress.diagnostics.length>0 && (
            <div className="mt-3 pt-3 border-t dark:border-slate-700">
              <div className="text-xs font-semibold text-slate-500 mb-1">Диагностики</div>
              {progress.diagnostics.map((d:any)=>(
                <div key={d.test_id} className="flex items-center gap-2 text-xs dark:text-slate-300 py-0.5">
                  <span className="flex-1 truncate">{d.title}</span>
                  <b>{d.score}%</b>
                  <span className="text-slate-400">{new Date(d.date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
          {progress.personal_tasks && progress.personal_tasks.length>0 && (
            <div className="mt-3 pt-3 border-t dark:border-slate-700">
              <div className="text-xs font-semibold text-slate-500 mb-1">Персональные задания</div>
              {progress.personal_tasks.map((a:any)=>(
                <div key={a.id} className="flex items-center gap-2 text-xs dark:text-slate-300 py-0.5">
                  <span className="flex-1 truncate">{a.title}</span>
                  <span className="text-slate-400">{a.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Дневник ребёнка */}
      {diary && diary.rows.length===0 && diary.classes.length===0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-10 text-center">
          <GraduationCap size={40} className="mx-auto mb-3 text-slate-300"/>
          <div className="text-slate-500 dark:text-slate-400">{t('children_diary_empty')}</div>
        </div>
      )}

      {diary && (
        <div className="space-y-2">
          {rows.map((r,i)=>(
            <Link to={`/classes/${r.classroom_id}`} key={`${r.assignment_id}-${i}`}
              className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 flex flex-wrap items-center gap-3 card-hover">
              <div className="flex-1 min-w-[220px]">
                <div className="font-semibold dark:text-white flex items-center gap-2 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor:r.classroom_color}}/>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">{r.classroom_title}</span>
                </div>
                <div className="font-bold mt-0.5 dark:text-white break-words">{r.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1"><Clock size={12}/>{new Date(r.date).toLocaleDateString()} {new Date(r.date).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>
                  {r.status==='late' && <span className="text-red-600 font-semibold">{t('cls_late')}</span>}
                  {r.deadline && <span>• {t('cls_dl')}: {new Date(r.deadline).toLocaleDateString()}</span>}
                </div>
              </div>
              {r.score!=null
                ? <span className={`px-3 py-1.5 rounded-xl border font-bold text-lg ${scoreCls(r.score, r.max_score ?? undefined)}`}>{r.score}<span className="text-xs font-medium opacity-60">/{r.max_score}</span></span>
                : r.mark
                  ? <span className="px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-bold">{r.mark}</span>
                  : <span className="px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 text-xs font-semibold">—</span>}
            </Link>
          ))}
          {diary.classes.length>0 && rows.length===0 && (
            <div className="text-center text-slate-400 py-10">{t('diary_no_in_class')}</div>
          )}
        </div>
      )}
    </div>
  )
}
