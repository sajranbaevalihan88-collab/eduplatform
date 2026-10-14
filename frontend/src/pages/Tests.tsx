import { useEffect, useState } from 'react'
import client from '../api/client'
import { Link } from 'react-router-dom'
import { Plus, FlaskConical, Clock, Target, Search } from 'lucide-react'
import { isStudent } from '../utils/role'
import { useLang } from '../context/LangContext'

export default function Tests(){
  const {t}=useLang()
  const [list,setList]=useState<any[]>([])
  const [q,setQ]=useState('')
  const [me,setMe]=useState<any>(null)
  useEffect(()=>{
    client.get('/tests/?is_public=true').then(r=>setList(Array.isArray(r.data)?r.data:r.data.results||[]))
    const raw=localStorage.getItem('user'); if(raw) try{ setMe(JSON.parse(raw)) }catch{}
    const h=()=>{ const r=localStorage.getItem('user'); if(r) try{ setMe(JSON.parse(r)) }catch{} else setMe(null) }
    window.addEventListener('auth-change', h as any); window.addEventListener('storage', h)
    return ()=>{ window.removeEventListener('auth-change', h as any); window.removeEventListener('storage', h)}
  },[])
  const canEdit=(item:any)=> me && (String(item.owner)===String(me.id) || String(item.owner_id)===String(me.id) || me.role==='admin' || me.is_staff)
  const filtered=list.filter(item=>!q||(item.title||'').toLowerCase().includes(q.toLowerCase()))
  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2 dark:text-white"><span className="p-2 rounded-xl bg-gradient-to-br from-rose-500 to-amber-400 text-white"><FlaskConical size={20}/></span> {t('tests')} <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{filtered.length}</span></h1>
        </div>
        <div className="flex gap-2">
          <div className="relative group"><Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors"/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={t('tests_search_ph')} className="pl-9 pr-4 py-2.5 rounded-xl border bg-white w-[220px] focus-ring transition-all focus:w-[260px]"/></div>
          {!isStudent() && (
          <Link to="/tests/new" className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold flex items-center gap-2 shadow-md btn-hover"><Plus size={18}/>{t('tests_create')}</Link>
          )}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map(item=>(
          <div key={item.id} className="bg-white rounded-2xl border p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center"><FlaskConical size={20}/></div>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100">{item.questions_count||item.questions?.length||0} {t('tests_questions')}</span>
            </div>
            <h3 className="font-bold mt-3">{item.title}</h3>
            <p className="text-sm text-slate-500 line-clamp-2">{item.description||t('tests_no_desc')}</p>
            <div className="flex gap-2 text-xs mt-3 text-slate-500"><span className="flex items-center gap-1"><Target size={12}/> {t('tests_pass')} {item.pass_score}%</span><span className="flex items-center gap-1"><Clock size={12}/> {item.time_limit||t('tests_no_limit')} {t('tests_min')}</span></div>
            <div className="flex gap-2 mt-4">
              <Link to={`/tests/${item.id}/take`} className="flex-1 px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold text-center">{t('tests_take')}</Link>
              {canEdit(item) ? <Link to={`/tests/${item.id}`} className="px-3 py-2 rounded-xl bg-slate-100 text-sm font-medium">{t('edit')}</Link> : <span className="px-3 py-2 rounded-xl bg-slate-50 text-slate-400 text-sm" title={t('tests_lock')}>🔒</span>}
            </div>
          </div>
        ))}
      </div>
      {filtered.length===0 && <div className="text-center py-16 bg-white rounded-2xl border text-slate-400">{q ? t('tests_empty_search') : t('tests_empty')}</div>}
    </div>
  )
}
