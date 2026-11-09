import { useEffect, useState } from 'react'
import client from '../api/client'
import { toast } from '../context/UIContext'
import { TrendingUp, Target, AlertTriangle } from 'lucide-react'

/**
 * Аналитика пути обучения класса (только владелец):
 * кто отстаёт, по каким темам, сколько диагностик пройдено.
 */
export default function ProgressTab({ classId }:{ classId:number|any }){
  const [data, setData] = useState<any>(null)

  useEffect(()=>{
    client.get(`/classrooms/${classId}/class_progress/`)
      .then(r=>setData(r.data)).catch(()=>setData(null))
  },[classId])

  if(data===null) return <div className="skeleton h-24 rounded-2xl"/>

  const rows = data.students || []
  const laggards = rows.filter((r:any)=> r.avg!=null && r.avg<50)
  const notTested = rows.filter((r:any)=> r.tested_topics===0)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold dark:text-slate-200">
          Учеников: {rows.length}
        </span>
        <span className="px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 font-semibold">
          ⚠️ Отстают: {laggards.length}
        </span>
        <span className="px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold">
          Не проверены: {notTested.length}
        </span>
      </div>

      {laggards.length>0 && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40">
          <div className="text-sm font-bold text-red-700 dark:text-red-300 flex items-center gap-1.5 mb-1">
            <AlertTriangle size={15}/>Кто отстаёт — дай персональные задания по этим темам
          </div>
          {laggards.map((r:any)=>(
            <div key={r.student} className="flex flex-wrap items-center gap-2 text-sm py-1" data-testid={`laggard-${r.student}`}>
              <b className="dark:text-white">{r.username}</b>
              <span className="text-red-600 font-bold">{r.avg}%</span>
              <span className="text-xs text-slate-500">пробелы:</span>
              {r.gaps.map((g:string)=><span key={g} className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">{g}</span>)}
            </div>
          ))}
        </div>
      )}

      <div className="overflow-auto">
        <table className="w-full text-sm min-w-[520px] dark:text-slate-100">
          <thead><tr className="text-left text-xs text-slate-400">
            <th className="p-2">Ученик</th><th className="p-2">Средний %</th><th className="p-2">Тем проверено</th>
            <th className="p-2">Диагностик</th><th className="p-2">Пробелы</th>
          </tr></thead>
          <tbody>
            {rows.map((r:any)=>(
              <tr key={r.student} className="border-t dark:border-slate-700" data-testid={`prog-st-${r.student}`}>
                <td className="p-2 font-semibold">{r.username}</td>
                <td className="p-2">
                  {r.avg!=null
                    ? <span className={`font-bold ${r.avg>=80?'text-emerald-600': r.avg>=50?'text-sky-600':'text-red-600'}`}>{r.avg}%</span>
                    : <span className="text-slate-400">—</span>}
                </td>
                <td className="p-2">{r.tested_topics}</td>
                <td className="p-2">{r.diagnostics_taken}</td>
                <td className="p-2">
                  <div className="flex flex-wrap gap-1">
                    {r.gaps.map((g:string)=><span key={g} className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">{g}</span>)}
                    {r.gaps.length===0 && <span className="text-slate-400">—</span>}
                  </div>
                </td>
              </tr>
            ))}
            {rows.length===0 && (
              <tr><td colSpan={5} className="p-4 text-center text-slate-400">В классе нет учеников</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {(data.class_gaps||[]).length>0 && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40">
          <div className="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5 mb-1">
            <Target size={15}/>Частые пробелы класса
          </div>
          {data.class_gaps.map((g:any)=>(
            <div key={g.topic_id} className="text-sm py-0.5 flex items-center gap-2">
              <b className="dark:text-white">{g.title}</b>
              <span className="text-xs text-slate-500">— {g.students.length} ученик(ов): {g.students.slice(0,5).join(', ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
