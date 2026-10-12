import { useEffect, useState } from 'react'
import client from '../api/client'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Layers, Plus, Search, Trash2, X } from 'lucide-react'
import { isStudent } from '../utils/role'
import { toast } from '../context/UIContext'

export default function Lessons(){
  const [list,setList]=useState<any[]>([])
  const [q,setQ]=useState('')
  const [me,setMe]=useState<any>(null)
  const nav=useNavigate()
  const [searchParams,setSearchParams]=useSearchParams()
  const subjectFilter=searchParams.get('subject')
  const [subjectName,setSubjectName]=useState<string|null>(null)
  useEffect(()=>{
    const url = subjectFilter ? `/lessons/?subject=${encodeURIComponent(subjectFilter)}` : '/lessons/'
    client.get(url).then(r=>setList(Array.isArray(r.data)?r.data:r.data.results||[]))
    if(subjectFilter){
      client.get('/subjects/').then(r=>{
        const arr=Array.isArray(r.data)?r.data:r.data.results||[]
        const found=arr.find((s:any)=>s.slug===subjectFilter)
        if(found) setSubjectName(found.name)
        else setSubjectName(subjectFilter)
      }).catch(()=>setSubjectName(subjectFilter))
    } else setSubjectName(null)
    const raw=localStorage.getItem('user')
    if(raw) try{ setMe(JSON.parse(raw)) }catch{}
  },[subjectFilter])
  const filtered=list.filter(l=>!q||l.title.toLowerCase().includes(q.toLowerCase()))
  const canEdit=(lesson:any)=>{
    if(!me) return false
    if(me.role==='admin' || me.is_staff) return true
    return String(lesson.owner)===String(me.id) || String(lesson.owner_id)===String(me.id)
  }
  const handleDelete=async(e:any, id:number)=>{
    e.stopPropagation()
    if(!confirm('Удалить урок? Это нельзя отменить.')) return
    try{
      await client.delete(`/lessons/${id}/`)
      setList(prev=>prev.filter(l=>l.id!==id))
      toast('Урок удалён','success')
    }catch(err:any){
      toast(err?.response?.data?.detail || 'Не удалось удалить — только владелец или админ','error')
    }
  }
  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2 dark:text-white"><span className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white"><Layers size={20}/></span> Уроки <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{filtered.length}</span></h1>
          {subjectFilter && <span className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-100 text-violet-700 text-sm font-medium">Предмет: {subjectName||subjectFilter} <button onClick={()=>setSearchParams({})} className="p-1 rounded-full hover:bg-violet-200"><X size={14}/></button></span>}
        </div>
        <div className="flex gap-2">
          <div className="relative group"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 transition-colors"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Поиск уроков..." className="pl-9 pr-4 py-2.5 rounded-xl border bg-white w-[220px] focus-ring transition-all focus:w-[260px]"/></div>
          {!isStudent() && (
          <Link to="/lessons/new" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white font-semibold flex items-center gap-2 shadow-md btn-hover"><Plus size={18}/>Создать</Link>
          )}
        </div>
      </div>
      {subjectFilter && (
        <div className="sm:hidden flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-50 border border-violet-200 text-sm text-violet-700">
          <span>Фильтр: {subjectName||subjectFilter}</span>
          <button onClick={()=>setSearchParams({})} className="ml-auto px-2 py-1 rounded-full bg-white border text-xs">Сбросить ✕</button>
        </div>
      )}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {filtered.map(l=>(
          <div key={l.id} onClick={()=>nav(`/lessons/${l.id}`)} className="bg-white rounded-2xl border border-slate-100 overflow-hidden card-hover group cursor-pointer" style={{borderLeft: `4px solid ${l.subject_color||'#e2e8f0'}`}}>
            <div className="p-5">
              <div className="text-xs px-2 py-1 rounded-full text-white inline-block" style={{background: l.subject_color||'#6366F1'}}>{l.subject_icon||'📚'} {l.subject_name||'Без предмета'} {l.course_title?`• ${l.course_title}`:''}</div>
              <h3 className="font-bold text-lg mt-2 line-clamp-1" style={{color: l.subject_color ? l.subject_color : '#0f172a'}}>{l.title}</h3>
              <p className="text-sm text-slate-500 line-clamp-2 mt-1">{l.description||'Нет описания'}</p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-400"><span>{l.blocks_count} блоков</span> • <span>{new Date(l.created_at).toLocaleDateString()}</span></div>
            </div>
            <div className="px-5 py-3 bg-slate-50 border-t flex gap-2" onClick={e=>e.stopPropagation()}>
              <button onClick={()=>nav(`/lessons/${l.id}`)} className="flex-1 text-sm font-semibold text-violet-700 text-left">Открыть →</button>
              {canEdit(l) ? (
                <button onClick={()=>nav(`/lessons/${l.id}/edit`)} className="text-xs px-3 py-1 rounded-full bg-white border hover:bg-violet-50 hover:border-violet-200 hover:text-violet-700 transition-colors">Редактировать</button>
              ) : (
                <span className="text-xs px-2 py-1 text-slate-400" title="Только автор может редактировать">🔒</span>
              )}
              {canEdit(l) && <button onClick={(e)=>handleDelete(e,l.id)} className="p-1.5 rounded-full bg-white border text-red-500 hover:bg-red-50 hover:border-red-200 transition-colors" title="Удалить"><Trash2 size={14}/></button>}
            </div>
          </div>
        ))}
      </div>
      {filtered.length===0 && (
        <div className="text-center py-16 bg-white rounded-2xl border text-slate-400">
          {q ? (
            <div>Ничего не найдено по "<b>{q}</b>" <button onClick={()=>setQ('')} className="ml-2 px-3 py-1 rounded-full bg-violet-100 text-violet-700 text-sm">Сбросить</button></div>
          ) : (
            "Нет уроков — создай первый!"
          )}
        </div>
      )}
    </div>
  )
}
