import { useEffect, useState } from 'react'
import client from '../api/client'
import { Link } from 'react-router-dom'
import { BookOpen, Plus, X } from 'lucide-react'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'

type Subject={id:number,name:string,slug:string,description:string,icon:string,color:string,courses:any[]}

export default function Subjects(){
  const {t}=useLang()
  const [list,setList]=useState<Subject[]>([])
  const [error,setError]=useState<string|null>(null)
  const [me,setMe]=useState<any>(null)
  const [showAdd,setShowAdd]=useState(false)
  const [form,setForm]=useState({name:'',icon:'📘',color:'#6366F1',description:''})
  const [busy,setBusy]=useState(false)
  const isAdmin=!!me && (me.role==='admin'||me.is_staff)
  const load=()=>client.get('/subjects/').then(r=>setList(Array.isArray(r.data)?r.data:r.data.results||[])).catch((e:any)=>setError(e?.response?.data?.detail||e?.message||t('subj_load_err')))
  useEffect(()=>{load(); const raw=localStorage.getItem('user'); if(raw) try{ setMe(JSON.parse(raw)) }catch{} },[])
  const createSubject=async()=>{
    if(busy) return
    if(form.name.trim().length<2){ toast(t('subj_add_name_short'),'error'); return }
    setBusy(true)
    try{
      await client.post('/subjects/',{name:form.name.trim(),icon:form.icon||'📘',color:form.color,description:form.description.trim()})
      toast(t('subj_added'),'success')
      setForm({name:'',icon:'📘',color:'#6366F1',description:''})
      setShowAdd(false)
      load()
    }catch(e:any){
      toast(e?.response?.data?.detail||e?.response?.data?.error||t('error'),'error')
    }
    setBusy(false)
  }
  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2 dark:text-white"><span className="p-2 rounded-xl bg-blue-600 text-white"><BookOpen size={20}/></span> {t('subjects_title')} <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{list.length}</span></h1>
        </div>
        {isAdmin && (
          <button onClick={()=>setShowAdd(v=>!v)} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2"><Plus size={16}/>{showAdd?t('close'):t('subj_add')}</button>
        )}
      </div>
      {isAdmin && showAdd && (
        <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border p-5 space-y-3">
          <h2 className="font-bold dark:text-white">{t('subj_add')}</h2>
          <div className="flex flex-wrap gap-2">
            <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder={t('subj_add_name')} className="flex-1 min-w-[180px] px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm"/>
            <input value={form.icon} onChange={e=>setForm({...form,icon:e.target.value.slice(0,3)})} placeholder={t('subj_add_icon')} className="w-24 px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm text-center"/>
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300">{t('subj_add_color')}<input type="color" value={form.color} onChange={e=>setForm({...form,color:e.target.value})} className="w-8 h-8 rounded cursor-pointer bg-transparent"/></label>
          </div>
          <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder={t('subj_add_desc')} rows={2} className="w-full px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm"/>
          <div className="flex gap-2">
            <button onClick={createSubject} disabled={busy} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold disabled:opacity-50">{busy?'...':t('create')}</button>
            <button onClick={()=>setShowAdd(false)} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold flex items-center gap-1"><X size={14}/>{t('close')}</button>
          </div>
        </div>
      )}
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(s=>(
          <Link key={s.id} to={`/subjects/${s.slug}`} className="bg-white rounded-2xl border overflow-hidden hover:shadow-md transition hover:border-indigo-200 group block">
            <div className="h-2" style={{background:s.color}} />
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl border group-hover:scale-105 transition" style={{background:`${s.color}15`}}>{s.icon}</div>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100">{s.slug}</span>
              </div>
              <h3 className="font-bold text-lg mt-3 group-hover:text-indigo-600 transition">{s.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-2">{s.description||t('subj_no_desc')}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>{s.courses?.length||0} {t('subj_courses')}</span><span className="text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition">{t('subj_go')}</span></div>
            </div>
          </Link>
        ))}
        {list.length===0 && <div className="col-span-full text-center py-12 text-slate-400">{t('subj_empty')}</div>}
      </div>
    </div>
  )
}
