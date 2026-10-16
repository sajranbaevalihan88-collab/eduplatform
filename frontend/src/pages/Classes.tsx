import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { GraduationCap, Plus, Copy, Check, LogOut, Users } from 'lucide-react'
import { useLang } from '../context/LangContext'
import { canTeach } from '../utils/role'
import { toast } from '../context/UIContext'

const COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899']

export default function Classes(){
  const {t} = useLang()
  const [rooms,setRooms]=useState<any[]>([])
  const [code,setCode]=useState('')
  const [creating,setCreating]=useState(false)
  const [form,setForm]=useState({title:'',description:'',color:'#3B82F6'})
  const [copied,setCopied]=useState<number|null>(null)
  const teach = canTeach()
  const meId = (()=>{ try{ return JSON.parse(localStorage.getItem('user')||'{}').id }catch{ return null } })()

  const load=()=>{ client.get('/classrooms/').then(r=>setRooms(r.data.results||r.data||[])).catch(()=>{}) }
  useEffect(()=>{load()},[])

  const create=async()=>{
    if(!form.title.trim()){ toast(t('cls_need_title'),'error'); return }
    try{
      await client.post('/classrooms/', form)
      setForm({title:'',description:'',color:'#3B82F6'}); setCreating(false); load()
      toast(t('cls_created'),'success')
    }catch(e:any){ toast(e?.response?.data?.detail||t('cls_err'),'error') }
  }
  const join=async()=>{
    if(!code.trim()) return
    try{
      await client.post('/classrooms/join/', {code: code.trim()})
      setCode(''); load(); toast(t('cls_joined'),'success')
    }catch(e:any){ toast(e?.response?.data?.detail||e?.response?.data?.code||t('cls_err'),'error') }
  }
  const remove=async(id:number)=>{
    if(!confirm(t('cls_del_confirm'))) return
    await client.delete(`/classrooms/${id}/`).catch(()=>{})
    load()
  }
  const leave=async(id:number)=>{
    if(!confirm(t('cls_leave_confirm'))) return
    await client.post(`/classrooms/${id}/leave/`).catch(()=>{})
    load()
  }
  const copy=(id:number, c:string)=>{
    try{ navigator.clipboard.writeText(c); setCopied(id); setTimeout(()=>setCopied(null),1500) }catch{}
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2"><GraduationCap/>{t('classes')}</h1>
        <div className="flex gap-2">
          <div className="flex rounded-xl border overflow-hidden">
            <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder={t('cls_code_ph')} className="px-3 py-2 text-sm uppercase font-mono w-32 outline-none"/>
            <button onClick={join} className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold">{t('cls_join')}</button>
          </div>
          {teach && <button onClick={()=>setCreating(v=>!v)} className="px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-semibold flex items-center gap-1"><Plus size={16}/>{t('cls_new')}</button>}
        </div>
      </div>

      {creating && teach && (
        <div className="bg-white rounded-2xl border p-5 space-y-3">
          <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder={t('cls_title_ph')} className="w-full px-4 py-2.5 rounded-xl border outline-none focus:border-blue-400"/>
          <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder={t('cls_desc_ph')} rows={2} className="w-full px-4 py-2.5 rounded-xl border outline-none focus:border-blue-400"/>
          <div className="flex items-center gap-2">
            {COLORS.map(c=><button key={c} onClick={()=>setForm({...form,color:c})} className={`w-8 h-8 rounded-full ${form.color===c?'ring-2 ring-offset-2 ring-slate-400':''}`} style={{background:c}}/>)}
            <button onClick={create} className="ml-auto px-5 py-2 rounded-xl bg-blue-700 text-white font-semibold">{t('create')}</button>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map(r=>(
          <div key={r.id} className="bg-white rounded-2xl border overflow-hidden card-hover">
            <div className="h-20 flex items-end p-4" style={{background:`linear-gradient(135deg, ${r.color}, ${r.color}88)`}}>
              <GraduationCap className="text-white/90" size={28}/>
            </div>
            <div className="p-4">
              <Link to={`/classes/${r.id}`} className="font-bold text-lg hover:text-blue-700">{r.title}</Link>
              <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                <span>{r.owner_name}</span>•<span className="flex items-center gap-1"><Users size={12}/>{r.members_count}</span>•<span>{r.assignments_count} {t('cls_tasks')}</span>
              </div>
              {r.invite_code && (
                <button onClick={()=>copy(r.id, r.invite_code)} className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border font-mono text-sm" title={t('cls_copy_code')}>
                  <span className="tracking-[0.2em] font-bold">{r.invite_code}</span>
                  {copied===r.id ? <Check size={16} className="text-emerald-600"/> : <Copy size={16} className="text-slate-400"/>}
                </button>
              )}
              <div className="mt-3 flex gap-2">
                <Link to={`/classes/${r.id}`} className="flex-1 text-center px-3 py-2 rounded-xl bg-blue-50 text-blue-700 text-sm font-semibold">{t('open')}</Link>
                {String(r.owner)===String(meId)
                  ? <button onClick={()=>remove(r.id)} className="px-3 py-2 rounded-xl bg-red-50 text-red-600 text-sm">✕</button>
                  : <button onClick={()=>leave(r.id)} className="px-3 py-2 rounded-xl bg-slate-100 text-slate-500 text-sm flex items-center gap-1"><LogOut size={14}/></button>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {rooms.length===0 && <div className="text-center text-slate-500 py-12">{t('cls_empty')}</div>}
    </div>
  )
}
