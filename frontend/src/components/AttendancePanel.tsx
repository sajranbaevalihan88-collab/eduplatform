import { useEffect, useState } from 'react'
import client from '../api/client'
import { useLang } from '../context/LangContext'
import { toast } from '../context/UIContext'
import { Check, X, Clock, MinusCircle, Download } from 'lucide-react'

const STATUSES = [
  {k:'present', lbl:'Был', cls:'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', icon:Check},
  {k:'absent', lbl:'Не был', cls:'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', icon:X},
  {k:'late', lbl:'Опоздал', cls:'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', icon:Clock},
  {k:'excused', lbl:'Освобождён', cls:'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300', icon:MinusCircle},
] as const

function todayStr(){
  const d = new Date(); const pad = (n:number)=>String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

/**
 * Панель посещаемости класса.
 * isOwner: показывает кнопки + сохранение пачкой; иначе — только просмотр за дату.
 */
export default function AttendancePanel({ classId, members, isOwner }:{ classId:number|any, members:any[], isOwner:boolean }){
  const {t} = useLang()
  const [date, setDate] = useState(todayStr())
  const [marks, setMarks] = useState<Record<number,string>>({})
  const [recs, setRecs] = useState<any[]>([])
  const [summary, setSummary] = useState<any[]|null>(null)
  const [busy, setBusy] = useState(false)
  const [month, setMonth] = useState(todayStr().slice(0,7))

  const loadDay = ()=>{
    client.get(`/classrooms/${classId}/attendance/`, { params:{ date } })
      .then(r=>{
        const arr:any[] = r.data.results||r.data||[]
        setRecs(arr)
        const m:Record<number,string> = {}
        arr.forEach(a=>{ m[a.student] = a.status })
        setMarks(m)
      }).catch(()=>setRecs([]))
  }
  useEffect(()=>{ loadDay() },[date, classId])

  const loadMonth = ()=>{
    client.get(`/classrooms/${classId}/attendance_month/`, { params:{ month } })
      .then(r=>setSummary(r.data.rows||[])).catch(()=>{})
  }
  useEffect(()=>{ loadMonth() },[month, classId])

  const set = (sid:number, status:string)=>{
    if(!isOwner) return
    setMarks(m=>({...m, [sid]: status}))
  }
  const save = async ()=>{
    const marksArr = Object.entries(marks).map(([student, status])=>({ student: Number(student), status }))
    if(!marksArr.length){ toast('Сначала отметь хотя бы одного ученика','error'); return }
    setBusy(true)
    try{
      await client.post(`/classrooms/${classId}/attendance/`, { date, marks: marksArr })
      toast(t('cls_att_saved'),'success'); loadDay(); loadMonth()
    }catch(e:any){ toast(e?.response?.data?.detail||e?.response?.data?.status||JSON.stringify(e?.response?.data||'err'),'error') }
    setBusy(false)
  }
  const exportCsv = async ()=>{
    try{
      const r = await client.get(`/classrooms/${classId}/export_csv/`, {
        params:{ type:'attendance', start: `${month}-01`, end: todayStr() },
        responseType:'blob',
      })
      const url = URL.createObjectURL(new Blob([r.data], { type:'text/csv;charset=utf-8' }))
      const a = document.createElement('a'); a.href = url; a.download = `attendance-${month}.csv`; a.click()
      URL.revokeObjectURL(url)
    }catch(e:any){ toast(e?.response?.data?.detail||'err','error') }
  }

  const students = members.map(m=>m.student_name).filter(Boolean)
  const counts = { present:0, absent:0, late:0, excused:0 }
  Object.values(marks).forEach(v=>{ if(v in counts) (counts as any)[v]++ })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={date} onChange={e=>setDate(e.target.value)}
          className="px-3 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white"/>
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)}
          className="px-3 py-2 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white"/>
        {isOwner && (
          <>
            <button onClick={()=>{
              const next:Record<number,string> = {...marks}
              members.forEach((m:any)=>{ if(!next[m.student]) next[m.student] = 'present' })
              setMarks(next)
            }} className="px-3 py-2 min-h-[44px] rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold">
              ✓ Все «Был»
            </button>
            <button onClick={save} disabled={busy} data-testid="att-save"
              className="px-4 py-2 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
              {busy?'…':t('cls_att_save')}
            </button>
            <button onClick={exportCsv} data-testid="att-csv"
              className="px-3 py-2 min-h-[44px] rounded-xl bg-white dark:bg-slate-800 border text-sm font-semibold flex items-center gap-1">
              <Download size={14}/>{t('cls_att_export')}
            </button>
          </>
        )}
        <div className="text-xs text-slate-500 dark:text-slate-400 sm:ml-auto flex gap-3 w-full sm:w-auto justify-end">
          <span className="text-emerald-600">✓{counts.present}</span>
          <span className="text-red-600">✕{counts.absent}</span>
          <span className="text-amber-600">⏰{counts.late}</span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-2">
        {members.map((m:any)=>(
          <div key={m.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 p-2.5 rounded-xl border dark:border-slate-700 bg-white/50 dark:bg-slate-900/50" data-testid={`att-row-${m.student_name}`}>
            <div className="flex items-center gap-2.5 min-w-0 w-full sm:w-auto flex-1">
              <div className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">{m.student_name?.[0]?.toUpperCase()}</div>
              <div className="flex-1 min-w-0 font-semibold text-sm dark:text-white truncate">{m.student_name}</div>
            </div>
            <div className="flex gap-1 overflow-x-auto tab-scroll w-full sm:w-auto shrink-0 pb-0.5 sm:pb-0">
              {STATUSES.map(s=>(
                <button key={s.k} onClick={()=>set(m.student, s.k)} disabled={!isOwner}
                  title={s.lbl} aria-label={s.lbl} data-testid={`att-${m.student_name}-${s.k}`}
                  className={`flex-1 sm:flex-initial px-2 sm:px-2.5 py-2 min-h-[40px] rounded-lg text-xs font-bold border flex items-center justify-center gap-1 transition whitespace-nowrap shrink-0 ${marks[m.student]===s.k
                    ? s.cls + ' ring-2 ring-indigo-400'
                    : 'bg-white dark:bg-slate-900 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700'} ${isOwner?'':'opacity-60'}`}>
                  <s.icon size={13} className="shrink-0"/> <span>{s.lbl}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {members.length===0 && <div className="text-slate-400 text-sm">В классе нет учеников</div>}
      </div>

      {summary && summary.length>0 && (
        <div className="overflow-auto">
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Сводка за месяц {month}</div>
          <table className="w-full text-sm min-w-[520px] dark:text-slate-100">
            <thead><tr className="text-left text-xs text-slate-400">
              <th className="p-2">Ученик</th><th className="p-2">Был</th><th className="p-2">Не был</th><th className="p-2">Опоздал</th><th className="p-2">Освобождён</th>
            </tr></thead>
            <tbody>
              {summary.map((r:any)=>(
                <tr key={r.student} className="border-t dark:border-slate-700" data-testid={`att-month-${r.username}`}>
                  <td className="p-2 font-semibold">{r.username}</td>
                  <td className="p-2 text-emerald-600">{r.present||''}</td>
                  <td className="p-2 text-red-600">{r.absent||''}</td>
                  <td className="p-2 text-amber-600">{r.late||''}</td>
                  <td className="p-2 text-slate-500">{r.excused||''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
