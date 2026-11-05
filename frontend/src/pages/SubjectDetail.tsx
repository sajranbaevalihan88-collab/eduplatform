import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layers, Presentation as PresIcon, FlaskConical, Plus, Upload, Search } from 'lucide-react'
import client from '../api/client'
import { isStudent } from '../utils/role'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'

// Страница предмета: три вкладки — Уроки / Презентации / Тесты.
// Учителю: создание и загрузка прямо внутри вкладки; ученику — просмотр и прохождение.
export default function SubjectDetail(){
  const {t}=useLang()
  const {slug}=useParams()
  const [subject,setSubject]=useState<any>(null)
  const [tab,setTab]=useState<'lessons'|'pres'|'tests'>('lessons')
  const [lessons,setLessons]=useState<any[]>([])
  const [pres,setPres]=useState<any[]>([])
  const [tests,setTests]=useState<any[]>([])
  const [q,setQ]=useState('')
  const [me,setMe]=useState<any>(null)
  const [uploading,setUploading]=useState(false)
  const fileRef=useRef<HTMLInputElement>(null)

  useEffect(()=>{
    client.get('/subjects/').then(r=>{
      const arr=Array.isArray(r.data)?r.data:r.data.results||[]
      setSubject(arr.find((s:any)=>String(s.slug)===String(slug))||null)
    }).catch(()=>{})
    const raw=localStorage.getItem('user')
    if(raw) try{ setMe(JSON.parse(raw)) }catch{}
  },[slug])

  useEffect(()=>{
    if(!slug) return
    const s=encodeURIComponent(slug)
    client.get(`/lessons/?subject=${s}`).then(r=>setLessons(Array.isArray(r.data)?r.data:r.data.results||[])).catch(()=>setLessons([]))
    client.get(`/presentations/?subject=${s}`).then(r=>setPres(Array.isArray(r.data)?r.data:r.data.results||[])).catch(()=>setPres([]))
    client.get(`/tests/?subject=${s}`).then(r=>setTests(Array.isArray(r.data)?r.data:r.data.results||[])).catch(()=>setTests([]))
  },[slug])

  const canEdit=(item:any)=>{
    if(!me) return false
    if(me.role==='admin'||me.is_staff) return true
    return String(item.owner)===String(me.id)||String(item.owner_id)===String(me.id)
  }
  const isTeacher=!isStudent()

  const uploadPres=async(file:File)=>{
    setUploading(true)
    try{
      const fd=new FormData()
      fd.append('file',file)
      fd.append('title',file.name.replace(/\.[^/.]+$/,''))
      if(subject?.id) fd.append('subject',String(subject.id))
      fd.append('is_public','true')
      const r=await client.post('/presentations/import/', fd, {headers:{'Content-Type':'multipart/form-data'}})
      const count=r.data?.slides_count ?? r.data?.slides?.length ?? 0
      toast(`${t('pres_uploaded')} — ${count} ${t('pres_slides_short')}`,'success')
      const s=encodeURIComponent(slug||'')
      client.get(`/presentations/?subject=${s}`).then(rr=>setPres(Array.isArray(rr.data)?rr.data:rr.data.results||[])).catch(()=>{})
    }catch(e:any){
      toast(e?.response?.data?.detail||e?.response?.data?.error||t('pres_import_err'),'error')
    }
    setUploading(false)
  }

  const fl=lessons.filter(l=>!q||l.title.toLowerCase().includes(q.toLowerCase()))
  const fp=pres.filter(p=>!q||(p.title||'').toLowerCase().includes(q.toLowerCase()))
  const ft=tests.filter(x=>!q||x.title.toLowerCase().includes(q.toLowerCase()))

  const tabs=[
    {key:'lessons' as const, label:t('lessons'), icon:Layers, count:lessons.length},
    {key:'pres' as const, label:t('presentations'), icon:PresIcon, count:pres.length},
    {key:'tests' as const, label:t('tests'), icon:FlaskConical, count:tests.length},
  ]

  return (
    <div className="space-y-5 page-enter">
      <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border overflow-hidden">
        <div className="h-2" style={{background:subject?.color||'#6366F1'}}/>
        <div className="p-5">
          <Link to="/subjects" className="text-sm text-indigo-600 hover:underline">← {t('subj_back')}</Link>
          <h1 className="text-2xl font-display font-bold mt-2 flex items-center gap-3 dark:text-white">
            <span className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{background:`${subject?.color||'#6366F1'}15`}}>{subject?.icon||'📘'}</span>
            {subject?.name||slug}
          </h1>
          {subject?.description && <p className="text-sm text-slate-500 mt-2">{subject.description}</p>}
        </div>
        <div className="flex border-t dark:border-slate-800 overflow-x-auto">
          {tabs.map(x=>(
            <button key={x.key} onClick={()=>setTab(x.key)}
              className={`px-4 py-3 text-sm font-semibold flex items-center gap-2 whitespace-nowrap border-b-2 transition ${tab===x.key?'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20':'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              <x.icon size={16}/>{x.label}<span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">{x.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder={t('lessons_search_ph')} className="pl-9 pr-4 py-2.5 rounded-xl border bg-white w-full focus-ring dark:bg-slate-900 dark:text-white"/>
        </div>
        {isTeacher && tab==='lessons' && <Link to={`/lessons/new?subject=${slug}`} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2"><Plus size={16}/>{t('create')}</Link>}
        {isTeacher && tab==='pres' && <>
          <Link to={`/presentations/new?subject=${slug}`} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2"><Plus size={16}/>{t('create')}</Link>
          <button onClick={()=>fileRef.current?.click()} disabled={uploading} className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Upload size={16}/>{uploading?'...':t('subj_upload')}</button>
          <input ref={fileRef} type="file" accept=".pptx,.ppt" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) uploadPres(f); e.target.value=''}}/>
        </>}
        {isTeacher && tab==='tests' && <Link to={`/tests/new?subject=${slug}`} className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-2"><Plus size={16}/>{t('create')}</Link>}
      </div>

      {tab==='lessons' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fl.map(l=>(
            <Link key={l.id} to={`/lessons/${l.id}`} className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border p-4 hover:shadow-md transition block">
              <h3 className="font-bold line-clamp-2 dark:text-white">{l.title}</h3>
              {l.description && <p className="text-sm text-slate-500 line-clamp-2 mt-1">{l.description}</p>}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>{l.blocks_count ?? 0} {t('subj_blocks')}</span>
                {canEdit(l) && <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-semibold">{l.is_public?t('subj_public'):t('subj_private')}</span>}
              </div>
            </Link>
          ))}
          {fl.length===0 && <div className="col-span-full text-center py-10 text-slate-400">{t('subj_empty_lessons')}</div>}
        </div>
      )}

      {tab==='pres' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {fp.map(p=>(
            <Link key={p.id} to={`/presentations/${p.id}`} className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border p-4 hover:shadow-md transition block">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-xl bg-orange-50 text-orange-500"><PresIcon size={16}/></span>
                <h3 className="font-bold line-clamp-2 dark:text-white">{p.title}</h3>
              </div>
              <div className="mt-3 text-xs text-slate-400">{p.slides_count ?? p.slides?.length ?? 0} {t('pres_slides_short')}</div>
            </Link>
          ))}
          {fp.length===0 && <div className="col-span-full text-center py-10 text-slate-400">{t('subj_empty_pres')}</div>}
        </div>
      )}

      {tab==='tests' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ft.map(x=>(
            <div key={x.id} className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border p-4 hover:shadow-md transition">
              <h3 className="font-bold line-clamp-2 dark:text-white">{x.title}</h3>
              {x.description && <p className="text-sm text-slate-500 line-clamp-2 mt-1">{x.description}</p>}
              <div className="mt-3 flex items-center gap-2 text-xs">
                <span className="text-slate-400">{x.questions_count ?? 0} {t('subj_questions')}</span>
                {canEdit(x) && <Link to={`/tests/${x.id}/edit`} className="ml-auto px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">{t('subj_edit')}</Link>}
                <Link to={`/tests/${x.id}/take`} className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-semibold">{t('subj_take')}</Link>
              </div>
            </div>
          ))}
          {ft.length===0 && <div className="col-span-full text-center py-10 text-slate-400">{t('subj_empty_tests')}</div>}
        </div>
      )}
    </div>
  )
}
