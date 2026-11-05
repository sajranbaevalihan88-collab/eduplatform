import { useEffect, useState, useRef } from 'react'
import client from '../api/client'
import { Link } from 'react-router-dom'
import { Plus, Presentation as Icon, Eye, Trash2, Search, Upload } from 'lucide-react'
import { isStudent } from '../utils/role'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'

export default function Presentations(){
  const {t}=useLang()
  const [list,setList]=useState<any[]>([])
  const [q,setQ]=useState('')
  const [me,setMe]=useState<any>(null)
  const fileRef=useRef<HTMLInputElement>(null)
  const [uploading,setUploading]=useState(false)
  const uploadPres=async(file:File)=>{
    setUploading(true)
    try{
      const fd=new FormData()
      fd.append('file',file)
      fd.append('title',file.name.replace(/\.[^/.]+$/,''))
      fd.append('is_public','true')
      const r=await client.post('/presentations/import/', fd, {headers:{'Content-Type':'multipart/form-data'}})
      const count=r.data?.slides_count ?? r.data?.slides?.length ?? 0
      toast(`${t('pres_uploaded')} — ${count} ${t('pres_slides_short')}`,'success')
      client.get('/presentations/?is_public=true&is_lesson_private=false').then(rr=>setList(Array.isArray(rr.data)?rr.data:rr.data.results||[])).catch(()=>{})
    }catch(e:any){
      toast(e?.response?.data?.detail||e?.response?.data?.error||t('pres_import_err'),'error')
    }
    setUploading(false)
  }
  useEffect(()=>{
    // только публичные и не приватные урока — черновики и уроковые не попадают в общую ленту
    client.get('/presentations/?is_public=true&is_lesson_private=false').then(r=>setList(Array.isArray(r.data)?r.data:r.data.results||[]))
    const updateMe=()=>{
      const token=localStorage.getItem('token')||localStorage.getItem('access')
      if(!token){ setMe(null); return }
      const raw=localStorage.getItem('user'); if(raw) try{ setMe(JSON.parse(raw)) }catch{ setMe(null) } else setMe(null)
    }
    updateMe()
    const onAuth=()=>updateMe()
    window.addEventListener('auth-change', onAuth as any)
    window.addEventListener('storage', onAuth)
    return ()=>{ window.removeEventListener('auth-change', onAuth as any); window.removeEventListener('storage', onAuth)}
  },[])
  const canDelete=(p:any)=> me && (me.role==='admin' || me.is_staff || String(p.owner)===String(me.id) || String(p.owner_id)===String(me.id))
  const handleDelete=async(e:any, id:number)=>{
    e.preventDefault(); e.stopPropagation()
    if(!confirm(t('pres_del_confirm'))) return
    try{ await client.delete(`/presentations/${id}/`); setList(prev=>prev.filter(x=>x.id!==id)); toast(t('pres_deleted'),'success') }catch(err:any){ toast(err?.response?.data?.detail||t('pres_del_err'),'error') }
  }
  const filtered=list.filter(p=>!q||(p.title||'').toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2 dark:text-white"><span className="p-2 rounded-xl bg-orange-500 text-white"><Icon size={20}/></span> {t('presentations')} <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{filtered.length}</span></h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 sm:min-w-[240px]"><div className="relative group flex-1 max-w-full sm:max-w-[260px] md:max-w-[320px]"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={t('pres_search_ph')} className="pl-9 pr-4 py-2.5 rounded-xl border bg-white w-full focus-ring"/></div></div>
          {!isStudent() && (
        <Link to="/presentations/new" className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center gap-2 shadow-md btn-hover"><Plus size={18}/>{t('create')}</Link>
        )}
          {!isStudent() && (
        <button onClick={()=>fileRef.current?.click()} disabled={uploading} className="px-5 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold flex items-center gap-2 shadow-md btn-hover disabled:opacity-50"><Upload size={18}/>{uploading?'...':t('subj_upload')}</button>
        )}
          <input ref={fileRef} type="file" accept=".pptx,.ppt" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) uploadPres(f); e.target.value=''}}/>
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p=>(
          <div key={p.id} className="bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition group relative">
            <Link to={`/presentations/${p.id}`} className="block">
              <div className="h-40 bg-indigo-600 flex items-center justify-center text-white relative">
                <Icon size={48} opacity={0.9}/>
                <span className="absolute bottom-3 right-3 text-xs bg-black/20 px-2 py-1 rounded-full">{p.slides_count||p.slides?.length||0} {t('pres_slides')}</span>
              </div>
              <div className="p-4">
                <h3 className="font-bold line-clamp-1">{p.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-2">{p.description||t('pres_no_desc')}</p>
                <div className="mt-3 text-xs text-slate-400 flex items-center gap-1"><Eye size={12}/> {new Date(p.updated_at).toLocaleDateString()}</div>
              </div>
            </Link>
            {canDelete(p) && <button onClick={(e)=>handleDelete(e,p.id)} className="absolute top-3 right-3 p-2 min-w-[44px] min-h-[44px] rounded-full bg-white text-red-600 shadow hover:bg-red-50 border transition flex items-center justify-center" title={t('pres_del_title')} aria-label={t('delete')}><Trash2 size={14}/></button>}
          </div>
        ))}
      </div>
      {filtered.length===0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 px-6" data-testid="pres-empty">
          <div className="text-4xl mb-3">🎬</div>
          <div className="text-slate-400 mb-5">{q ? t('pres_empty_search') : t('pres_empty')}</div>
          {!q && !isStudent() && (
            <Link to="/presentations/new" data-testid="pres-cta" className="inline-flex px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold btn-hover shadow-md"><Plus size={18} className="inline mr-1"/>{t('dash_new_pres')}</Link>
          )}
        </div>
      )}
    </div>
  )
}
