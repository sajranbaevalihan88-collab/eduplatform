import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { useLang } from '../context/LangContext'
import { TrendingUp, GraduationCap, Play, Wrench, Target, CheckCircle2, BookOpenCheck, Trophy } from 'lucide-react'

const pctCls = (p:number)=> p>=80? 'bg-emerald-500' : p>=50? 'bg-sky-500' : 'bg-red-500'
const pctTxt = (p:number)=> p>=80? 'text-emerald-600' : p>=50? 'text-sky-600' : 'text-red-600'

export default function Progress(){
  const {t} = useLang()
  const [data, setData] = useState<any>(null)

  useEffect(()=>{
    client.get('/classrooms/my_progress/').then(r=>setData(r.data)).catch(()=>setData(null))
  },[])

  if(data===null) return <div className="p-8 text-center"><div className="skeleton h-32 rounded-2xl max-w-2xl mx-auto"/></div>

  const topics = data.topics || []
  const gaps = data.gaps || []
  const mastered = data.mastered || []
  const diags = data.diagnostics || []
  const avail = data.diagnostics_available || []

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white"><TrendingUp className="text-indigo-600"/>{t('progress_t')||'Мой прогресс'}</h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
          <CheckCircle2 size={18} className="mx-auto text-emerald-600"/>
          <div className="text-xl font-bold mt-1.5 dark:text-white">{mastered.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">тем изучено</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
          <Target size={18} className="mx-auto text-red-600"/>
          <div className="text-xl font-bold mt-1.5 dark:text-white">{gaps.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">тем подтянуть</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
          <GraduationCap size={18} className="mx-auto text-indigo-600"/>
          <div className="text-xl font-bold mt-1.5 dark:text-white">{diags.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">диагностик пройдено</div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4 text-center">
          <BookOpenCheck size={18} className="mx-auto text-violet-600"/>
          <div className="text-xl font-bold mt-1.5 dark:text-white">{(data.personal_tasks||[]).length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">персональных задач</div>
        </div>
      </div>

      {avail.length>0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
          <h2 className="font-bold text-sm dark:text-white mb-2 flex items-center gap-1.5"><Play size={15} className="text-indigo-600"/>Входная диагностика</h2>
          <div className="space-y-2">
            {avail.map((d:any)=>(
              <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-indigo-50/60 dark:bg-blue-900/20 border border-indigo-100 dark:border-indigo-800/50">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm dark:text-white truncate">{d.title}</div>
                  <div className="text-xs text-slate-500">{d.subject}{d.diagnostic_grade? ` · ${d.diagnostic_grade} класс` : ''}</div>
                </div>
                <Link to={`/tests/${d.id}/take`} data-testid={`diag-take-${d.id}`}
                  className="px-4 py-2 min-h-[40px] rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center gap-1">
                  <Play size={14}/>Пройти
                </Link>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Диагностика показывает, какие темы ты уже знаешь, а какие нужно подтянуть.</p>
        </div>
      )}

      {diags.length>0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
          <h2 className="font-bold text-sm dark:text-white mb-2 flex items-center gap-1.5"><Trophy size={15} className="text-emerald-600"/>Диагностики</h2>
          {diags.map((d:any)=>(
            <div key={d.test_id} className="flex items-center gap-3 py-1.5 text-sm">
              <span className="font-semibold dark:text-white flex-1 truncate">{d.title}</span>
              <span className={`font-bold ${pctTxt(d.score)}`}>{d.score}%</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">{d.passed? '✓':'✕'}</span>
              <span className="text-xs text-slate-400">{new Date(d.date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}

      {gaps.length>0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/40 p-4">
          <h2 className="font-bold text-sm text-red-600 flex items-center gap-1.5"><Wrench size={15}/>Что подтянуть</h2>
          <div className="grid sm:grid-cols-2 gap-2 mt-2">
            {gaps.map((g:any)=>(
              <div key={g.topic_id} className="p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/40 text-sm" data-testid={`gap-${g.topic_id}`}>
                <div className="font-semibold dark:text-white">{g.title}</div>
                <div className={`text-xs font-bold ${pctTxt(g.pct)}`}>{g.pct}% освоения</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-400 mt-2">Учитель может дать тебе персональное задание по этим темам — оно появится ниже.</p>
        </div>
      )}

      {(data.personal_tasks||[]).length>0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
          <h2 className="font-bold text-sm dark:text-white mb-2">Персональные задания</h2>
          <div className="space-y-2">
            {data.personal_tasks.map((a:any)=>(
              <div key={a.id} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border dark:border-slate-700" data-testid={`pers-${a.id}`}>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm dark:text-white truncate">{a.title}</div>
                  <div className="text-xs text-slate-400">{a.classroom_title}{a.topic_title? ` · тема: ${a.topic_title}` : ''}</div>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500">{a.status}</span>
                {a.score!=null && <span className="font-bold text-sm dark:text-white">{a.score}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {topics.length>0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-4">
          <h2 className="font-bold text-sm dark:text-white mb-3">Карта знаний</h2>
          <div className="space-y-2.5">
            {topics.map((tp:any)=>(
              <div key={tp.topic_id} data-testid={`topic-row-${tp.topic_id}`}>
                <div className="flex items-center gap-2 text-sm mb-1">
                  <span className="flex-1 font-medium truncate dark:text-white">{tp.title}</span>
                  <span className={`font-bold ${pctTxt(tp.pct)}`}>{tp.pct}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div className={`h-full rounded-full ${pctCls(tp.pct)}`} style={{ width: `${Math.max(2, tp.pct)}%` }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {topics.length===0 && diags.length===0 && avail.length===0 && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-10 text-center">
          <TrendingUp size={40} className="mx-auto mb-3 text-slate-300"/>
          <div className="font-bold dark:text-white">Прогресс пока пустой</div>
          <p className="text-sm text-slate-500 mt-1">Учитель даст входную диагностику — здесь появятся твои результаты и темы для подтягивания.</p>
        </div>
      )}
    </div>
  )
}
