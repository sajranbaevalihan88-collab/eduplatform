import { useEffect, useState } from 'react'
import client from '../api/client'
import { useLang } from '../context/LangContext'
import { toast } from '../context/UIContext'
import { CalendarDays, Repeat2, Upload, Trash2 } from 'lucide-react'

const WD = ['', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']

function todayStr(){
  const d = new Date(); const pad = (n:number)=>String(n).padStart(2,'0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

/**
 * Панель расписания: недельная сетка + день по дате с заменами.
 */
export default function SchedulePanel({ classId, isOwner }:{ classId:number|any, isOwner:boolean }){
  const {t} = useLang()
  const [slots, setSlots] = useState<any[]>([])
  const [subs, setSubs] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [date, setDate] = useState(todayStr())
  const [day, setDay] = useState<any>(null)
  const [busy, setBusy] = useState(false)
  const [subForm, setSubForm] = useState({ date: todayStr(), num: 1, subject: '', note: '' })
  const [impOpen, setImpOpen] = useState(false)
  const [impText, setImpText] = useState('')

  const load = ()=>{
    client.get(`/classrooms/${classId}/schedule_grid/`).then(r=>setSlots(Array.isArray(r.data)?r.data:r.data.results||[])).catch(()=>{})
    client.get(`/classrooms/${classId}/substitutions/`).then(r=>setSubs(Array.isArray(r.data)?r.data:r.data.results||[])).catch(()=>{})
  }
  useEffect(()=>{load()},[classId])
  useEffect(()=>{
    client.get('/subjects/').then(r=>setSubjects(Array.isArray(r.data)?r.data:r.data.results||[])).catch(()=>{})
  },[])
  useEffect(()=>{
    client.get(`/classrooms/${classId}/schedule_day/`, { params:{ date } })
      .then(r=>setDay(r.data)).catch(()=>setDay(null))
  },[date, classId, slots])

  const setSlot = async (wd:number, num:number, subjectId:string)=>{
    if(!isOwner) return
    setBusy(true)
    try{
      await client.post(`/classrooms/${classId}/schedule_set/`, {
        weekday: wd, num, subject: subjectId || null,
      })
      load()
      toast('Расписание обновлено','success')
    }catch(e:any){ toast(e?.response?.data?.detail||'err','error') }
    setBusy(false)
  }

  const addSub = async ()=>{
    if(!isOwner) return
    setBusy(true)
    try{
      await client.post(`/classrooms/${classId}/substitutions/`, {
        date: subForm.date, num: subForm.num,
        subject: subForm.subject || null,
        note: subForm.note.trim(),
      })
      setSubForm(f=>({...f, note: ''}))
      load(); toast('Замена добавлена','success')
    }catch(e:any){ toast(e?.response?.data?.detail||JSON.stringify(e?.response?.data||'err'),'error') }
    setBusy(false)
  }

  const delSub = async (subId:number)=>{
    if(!isOwner) return
    try{
      await client.post(`/classrooms/${classId}/delete_substitution/`, { id: subId })
      load(); toast('Замена удалена','success')
    }catch{}
  }

  const importSchedule = async ()=>{
    if(!impText.trim()){ toast('Вставь строки расписания','error'); return }
    setBusy(true)
    try{
      const r = await client.post(`/classrooms/${classId}/import_schedule_csv/`, { text: impText })
      toast(`Импортировано уроков: ${r.data.imported}`, 'success')
      setImpOpen(false); setImpText(''); load()
    }catch(e:any){ toast(e?.response?.data?.detail||'Ошибка импорта','error') }
    setBusy(false)
  }

  const maxNum = Math.max(6, ...slots.map((s:any)=>s.num))
  const rows = Array.from({length: maxNum}, (_, i)=>i+1)

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-400">{t('sc_set_hint')}</div>
          {isOwner && (
            <button onClick={()=>setImpOpen(v=>!v)} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold flex items-center gap-1 dark:text-slate-200 hover:bg-slate-200">
              <Upload size={13}/> Быстрый перенос расписания (CSV/текст)
            </button>
          )}
        </div>
        {isOwner && impOpen && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border dark:border-slate-700 space-y-2">
            <div className="text-xs text-slate-500">Вставь строки в формате: <code className="font-mono">день_недели;номер_урока;предмет;кабинет</code> (например: <code className="font-mono">Пн;1;Математика;204</code>)</div>
            <textarea value={impText} onChange={e=>setImpText(e.target.value)} rows={3} placeholder={"Пн;1;Математика;204\nПн;2;Физика;301\nВт;1;Информатика;105"}
              className="w-full px-3 py-2 rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-xs font-mono"/>
            <div className="flex gap-2">
              <button onClick={importSchedule} disabled={busy} className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold">Импортировать</button>
              <button onClick={()=>setImpOpen(false)} className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-xs font-semibold dark:text-white">Отмена</button>
            </div>
          </div>
        )}
        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[600px] dark:text-slate-100">
            <thead><tr className="text-xs text-slate-400">
              <th className="p-2 text-left">Урок</th>
              {WD.slice(1).map((d,i)=><th key={i} className="p-2">{d}</th>)}
            </tr></thead>
            <tbody>
              {rows.map(num=>(
                <tr key={num} className="border-t dark:border-slate-700">
                  <td className="p-2 font-bold text-slate-400">{num}</td>
                  {WD.slice(1).map((_, i)=>{
                    const wd = i+1
                    const s = slots.find((x:any)=>x.weekday===wd && x.num===num)
                    if(!isOwner){
                      return <td key={wd} className="p-1.5 text-xs">{s?.subject_name || '—'}</td>
                    }
                    return (
                      <td key={wd} className="p-1">
                        <select value={s?.subject||''} disabled={busy}
                          onChange={e=>setSlot(wd, num, e.target.value)}
                          data-testid={`slot-${wd}-${num}`}
                          className="w-full min-w-[86px] px-2 py-1.5 min-h-[36px] rounded-lg border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-xs">
                          <option value="">—</option>
                          {subjects.map((su:any)=><option key={su.id} value={su.id}>{su.icon||''} {su.name}</option>)}
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-3 rounded-xl border dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="font-bold text-sm dark:text-white flex items-center gap-1"><CalendarDays size={15}/>{t('sc_day')}</span>
          <input type="date" value={date} onChange={e=>setDate(e.target.value)}
            className="px-3 py-2 min-h-[40px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm"/>
        </div>
        {day && day.slots.length>0 ? (
          <div className="space-y-1">
            {day.slots.map((s:any)=>(
              <div key={s.num} className="flex items-center gap-2 text-sm py-1" data-testid={`day-${s.num}`}>
                <b className="text-slate-400">{s.num}.</b>
                <span className="font-semibold dark:text-white">{s.subject_name||'нет урока'}</span>
                {s.room && <span className="text-xs text-slate-400">каб. {s.room}</span>}
                {s.substitution && <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 inline-flex items-center gap-1"><Repeat2 size={11}/>замена{ s.substitution.subject_name? `: ${s.substitution.subject_name}` : '' }</span>}
                {s.base_subject_name && s.substitution && <span className="text-xs text-slate-400 line-through">{s.base_subject_name}</span>}
              </div>
            ))}
          </div>
        ) : <div className="text-sm text-slate-400">В этот день уроков нет</div>}
      </div>

      <div className="space-y-2">
        <div className="font-bold text-sm dark:text-white">{t('sc_subs')}</div>
        {subs.map((s:any)=>(
          <div key={s.id} className="flex items-center gap-2 text-sm p-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50" data-testid={`sub-row-${s.id}`}>
            <b>{s.date} · урок {s.num}</b>
            <span className="text-slate-500 dark:text-slate-300">{s.subject_name||'урока не будет'}</span>
            {s.note && <span className="text-xs text-amber-700 dark:text-amber-300">({s.note})</span>}
            {isOwner && (
              <button onClick={()=>delSub(s.id)} className="ml-auto p-1 text-slate-400 hover:text-red-500" title="Удалить замену">
                <Trash2 size={14}/>
              </button>
            )}
          </div>
        ))}
        {subs.length===0 && <div className="text-sm text-slate-400">Замен пока нет</div>}
        {isOwner && (
          <div className="flex flex-wrap gap-2 pt-1">
            <input type="date" value={subForm.date} onChange={e=>setSubForm(f=>({...f,date:e.target.value}))}
              className="px-3 py-2 min-h-[40px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm"/>
            <select value={subForm.num} onChange={e=>setSubForm(f=>({...f,num:Number(e.target.value)}))}
              className="px-3 py-2 min-h-[40px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm">
              {[1,2,3,4,5,6,7,8,9].map(n=><option key={n} value={n}>Урок {n}</option>)}
            </select>
            <select value={subForm.subject} onChange={e=>setSubForm(f=>({...f,subject:e.target.value}))}
              className="px-3 py-2 min-h-[40px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm">
              <option value="">урока не будет</option>
              {subjects.map((su:any)=><option key={su.id} value={su.id}>{su.icon||''} {su.name}</option>)}
            </select>
            <input value={subForm.note} onChange={e=>setSubForm(f=>({...f,note:e.target.value}))} placeholder="Комментарий (каб., учитель)…"
              className="px-3 py-2 min-h-[40px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm"/>
            <button onClick={addSub} disabled={busy} data-testid="sub-add"
              className="px-4 py-2 min-h-[40px] rounded-xl bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
              {t('sc_sub_add')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
