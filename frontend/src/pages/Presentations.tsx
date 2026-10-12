import { useEffect, useState } from 'react'
import client from '../api/client'
import { Link } from 'react-router-dom'
import { Plus, Presentation as Icon, Eye, Trash2, Search } from 'lucide-react'
import { isStudent } from '../utils/role'
import { toast } from '../context/UIContext'

export default function Presentations(){
  const [list,setList]=useState<any[]>([])
  const [q,setQ]=useState('')
  const [me,setMe]=useState<any>(null)
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
    if(!confirm('Удалить презентацию?')) return
    try{ await client.delete(`/presentations/${id}/`); setList(prev=>prev.filter(x=>x.id!==id)); toast('Презентация удалена','success') }catch(err:any){ toast(err?.response?.data?.detail||'Не удалось удалить — только владелец','error') }
  }
  const filtered=list.filter(p=>!q||(p.title||'').toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2 dark:text-white"><span className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white"><Icon size={20}/></span> Презентации <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{filtered.length}</span></h1>
        </div>
        <div className="flex gap-2">
          <div className="relative group"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск презентаций..." className="pl-9 pr-4 py-2.5 rounded-xl border bg-white w-[220px] focus-ring transition-all focus:w-[260px]"/></div>
          {!isStudent() && (
        <Link to="/presentations/new" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white font-semibold flex items-center gap-2 shadow-md btn-hover"><Plus size={18}/>Создать</Link>
        )}
        </div>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(p=>(
          <div key={p.id} className="bg-white rounded-2xl border overflow-hidden hover:shadow-lg transition group relative">
            <Link to={`/presentations/${p.id}`} className="block">
              <div className="h-40 bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-white relative">
                <Icon size={48} opacity={0.9}/>
                <span className="absolute bottom-3 right-3 text-xs bg-black/20 px-2 py-1 rounded-full">{p.slides_count||p.slides?.length||0} слайдов</span>
              </div>
              <div className="p-4">
                <h3 className="font-bold line-clamp-1">{p.title}</h3>
                <p className="text-sm text-slate-500 line-clamp-2">{p.description||'Без описания'}</p>
                <div className="mt-3 text-xs text-slate-400 flex items-center gap-1"><Eye size={12}/> {new Date(p.updated_at).toLocaleDateString()}</div>
              </div>
            </Link>
            {canDelete(p) && <button onClick={(e)=>handleDelete(e,p.id)} className="absolute top-3 right-3 p-2 rounded-full bg-white text-red-600 shadow hover:bg-red-50 border transition" title="Удалить презентацию"><Trash2 size={14}/></button>}
          </div>
        ))}
      </div>
      {filtered.length===0 && <div className="text-center py-16 bg-white rounded-2xl border text-slate-400">{q ? 'Ничего не найдено' : 'Нет презентаций — создай первую в визуальном редакторе'}</div>}
    </div>
  )
}
