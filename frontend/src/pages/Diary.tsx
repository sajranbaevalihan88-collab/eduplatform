import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { BookOpenCheck, GraduationCap, Clock } from 'lucide-react'
import { useLang } from '../context/LangContext'

/** Дневник ученика: все оценки/пометки по всем классам в одном месте. */
export default function Diary(){
  const {t}=useLang()
  const [data,setData]=useState<{rows:any[],classes:any[]}|null>(null)
  const [filter,setFilter]=useState<number|null>(null)
  useEffect(()=>{
    client.get('/classrooms/my_diary/').then(r=>setData(r.data)).catch(()=>setData({rows:[],classes:[]}))
  },[])

  const rows = useMemo(()=>{
    if(!data) return []
    return filter==null ? data.rows : data.rows.filter(r=>r.classroom_id===filter)
  },[data,filter])

  const scoreCls=(s:number, max?:number)=>{
    // цвет по проценту от max_score, а не по сырому числу (9/10 ≠ красный)
    const pct = max && max>0 ? (s/max)*100 : s
    if(pct>=85) return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    if(pct>=70) return 'bg-amber-50 text-amber-700 border-amber-200'
    return 'bg-red-50 text-red-600 border-red-200'
  }

  if(!data) return <div className="p-8 text-center"><div className="skeleton h-32 rounded-2xl max-w-2xl mx-auto"/></div>

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white"><BookOpenCheck className="text-indigo-600"/>{t('diary')}</h1>

      {data.classes.length>0 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={()=>setFilter(null)} className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold border transition ${filter===null?'bg-indigo-600 text-white border-indigo-600':'bg-white dark:bg-slate-900 dark:text-white border-slate-200 dark:border-slate-700'}`}>
            {t('diary_all')}
          </button>
          {data.classes.map(c=>(
            <button key={c.classroom_id} onClick={()=>setFilter(c.classroom_id)}
              className={`px-3 py-2 min-h-[40px] rounded-xl text-xs font-semibold border transition flex items-center gap-1.5 ${filter===c.classroom_id?'text-white border-transparent':'bg-white dark:bg-slate-900 dark:text-white border-slate-200 dark:border-slate-700'}`}
              style={filter===c.classroom_id?{backgroundColor:c.color}:{}}
              title={c.avg!=null?`${t('diary_avg')}: ${c.avg}`:undefined}>
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{backgroundColor: filter===c.classroom_id? 'rgba(255,255,255,.8)' : c.color}}/>
              {c.title}
              {c.avg!=null && <span className={`ml-1 px-1.5 py-0.5 rounded-md ${filter===c.classroom_id?'bg-white/20':'bg-slate-100 dark:bg-slate-800'}`}>{c.avg}</span>}
            </button>
          ))}
        </div>
      )}

      {data.classes.length===0 && rows.length===0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-10 text-center">
          <GraduationCap size={40} className="mx-auto mb-3 text-slate-300"/>
          <div className="text-slate-500 dark:text-slate-400">{t('diary_empty')}</div>
          <Link to="/classes" className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold">{t('classes')}</Link>
        </div>
      )}

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
              ? <span className={`px-3 py-1.5 rounded-xl border font-bold text-lg ${scoreCls(r.score, r.max_score)}`} data-testid="diary-score">{r.score}<span className="text-xs font-medium opacity-60">/{r.max_score}</span></span>
              : r.mark
                ? <span className="px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 font-bold">{r.mark}</span>
                : <span className="px-3 py-1.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 text-xs font-semibold">—</span>}
          </Link>
        ))}
      </div>

      {data.classes.length>0 && rows.length===0 && (
        <div className="text-center text-slate-400 py-10">{t('diary_no_in_class')}</div>
      )}
    </div>
  )
}
