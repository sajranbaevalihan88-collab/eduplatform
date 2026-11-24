import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { FolderLock, Trash2, Eye, Presentation as PresIcon, Layers, Globe, Lock } from 'lucide-react'
import client from '../api/client'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'

// Мои уроки и презентации: показывает ВСЕ созданные учителем материалы (и опубликованные в предметах, и приватные черновики),
// чтобы сохранённая презентация или урок всегда находились здесь с первого раза.
export default function MyLessons(){
  const {t}=useLang()
  const [searchParams, setSearchParams]=useSearchParams()
  const initTab = (searchParams.get('tab') === 'pres' || searchParams.get('tab') === 'presentations') ? 'pres' : 'lessons'
  const [tab,setTab]=useState<'lessons'|'pres'>(initTab)
  const [visFilter,setVisFilter]=useState<'all'|'public'|'private'>('all')
  const [list,setList]=useState<any[]>([])
  const [pres,setPres]=useState<any[]>([])
  const [busy,setBusy]=useState<string|null>(null)

  useEffect(()=>{
    const raw = searchParams.get('tab')
    if (raw === 'pres' || raw === 'presentations') setTab('pres')
    else if (raw === 'lessons') setTab('lessons')
  },[searchParams])

  const load=()=>{
    client.get('/lessons/?owner=me').then(r=>{
      const arr=Array.isArray(r.data)?r.data:r.data.results||[]
      setList(arr)
    }).catch(()=>setList([]))
    client.get('/presentations/?owner=me').then(r=>{
      const arr=Array.isArray(r.data)?r.data:r.data.results||[]
      setPres(arr)
    }).catch(()=>setPres([]))
  }
  useEffect(()=>{load()},[])

  const publishLesson=async(id:number)=>{
    setBusy('l'+id)
    try{
      await client.patch(`/lessons/${id}/`,{is_public:true})
      setList(prev=>prev.map(l=>l.id===id?{...l,is_public:true}:l))
      toast(t('my_lessons_published'),'success')
    }catch(e:any){
      toast(e?.response?.data?.detail||t('my_lessons_pub_err'),'error')
    }
    setBusy(null)
  }
  const publishPres=async(id:number)=>{
    setBusy('p'+id)
    try{
      await client.patch(`/presentations/${id}/`,{is_public:true,is_lesson_private:false})
      setPres(prev=>prev.map(p=>p.id===id?{...p,is_public:true,is_lesson_private:false}:p))
      toast(t('pres_published'),'success')
    }catch(e:any){
      toast(e?.response?.data?.detail||t('my_lessons_pub_err'),'error')
    }
    setBusy(null)
  }
  const del=async(e:any,kind:'lessons'|'presentations',id:number)=>{
    e.stopPropagation()
    if(!confirm(t('lessons_del_confirm'))) return
    try{
      await client.delete(`/${kind}/${id}/`)
      if(kind==='lessons') setList(prev=>prev.filter(l=>l.id!==id))
      else setPres(prev=>prev.filter(p=>p.id!==id))
      toast(t('lessons_deleted'),'success')
    }catch(err:any){
      toast(err?.response?.data?.detail||t('lessons_del_err'),'error')
    }
  }

  const filteredList = list.filter(l => visFilter === 'all' ? true : visFilter === 'public' ? !!l.is_public : !l.is_public)
  const filteredPres = pres.filter(p => visFilter === 'all' ? true : visFilter === 'public' ? !!p.is_public : !p.is_public)

  const tabs=[
    {key:'lessons' as const, label:t('lessons'), icon:Layers, count:filteredList.length},
    {key:'pres' as const, label:t('presentations'), icon:PresIcon, count:filteredPres.length},
  ]

  return (
    <div className="space-y-5 page-enter">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-display font-bold flex items-center gap-3 dark:text-white">
          <span className="p-2 rounded-xl bg-slate-700 text-white"><FolderLock size={20}/></span>
          {t('my_lessons')}
        </h1>
        <div className="flex items-center gap-2">
          <Link to="/presentations/new" className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold">+ Презентация</Link>
          <Link to="/lessons/new" className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold">+ Урок</Link>
        </div>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Все ваши уроки и презентации в одном месте. Опубликованные материалы с выбранным предметом также отображаются в разделе «Предметы».
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex border rounded-xl overflow-hidden w-fit dark:border-slate-800">
          {tabs.map(x=>(
            <button key={x.key} onClick={()=>{ setTab(x.key); setSearchParams({ tab: x.key }, { replace: true }) }}
              className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition ${tab===x.key?'border-indigo-600 text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/20':'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
              <x.icon size={16}/>{x.label}<span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800">{x.count}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
          {([
            ['all', 'Все'],
            ['public', '🌐 Опубликованные'],
            ['private', '🔒 Приватные'],
          ] as const).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setVisFilter(k)}
              className={`px-3 py-1.5 rounded-lg transition ${visFilter === k ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {tab==='lessons' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredList.map(l=>(
            <div key={l.id} className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border p-4 hover:shadow-md transition">
              <div className="flex items-start gap-2">
                {l.subject_icon && <span className="text-lg">{l.subject_icon}</span>}
                <h3 className="font-bold line-clamp-2 flex-1 dark:text-white">{l.title}</h3>
              </div>
              {l.description && <p className="text-sm text-slate-500 line-clamp-2 mt-1">{l.description}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                {l.subject_name && <span className="px-2 py-0.5 rounded-full font-semibold" style={{background:`${l.subject_color||'#6366F1'}15`,color:l.subject_color||'#6366F1'}}>{l.subject_name}</span>}
                <span className={`px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${l.is_public ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'}`}>
                  {l.is_public ? <><Globe size={11}/> Опубликован</> : <><Lock size={11}/> Черновик</>}
                </span>
                <span className="text-slate-400">{l.blocks_count ?? 0} {t('subj_blocks')}</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <Link to={`/lessons/${l.id}`} className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1"><Eye size={13}/>{t('subj_open')}</Link>
                <Link to={`/lessons/${l.id}/edit`} className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">{t('subj_edit')}</Link>
                {!l.is_public && (
                  <button onClick={()=>publishLesson(l.id)} disabled={busy==='l'+l.id} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50">{busy==='l'+l.id?'...':t('my_lessons_publish')}</button>
                )}
                <button onClick={e=>del(e,'lessons',l.id)} className="ml-auto p-1.5 rounded-lg bg-red-50 text-red-600"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
          {filteredList.length===0 && (
            <div className="col-span-full text-center py-14 text-slate-400">
              <FolderLock size={40} className="mx-auto mb-3 opacity-40"/>
              <p>{t('my_lessons_empty')}</p>
              <Link to="/lessons/new" className="inline-block mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">{t('create')}</Link>
            </div>
          )}
        </div>
      )}

      {tab==='pres' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPres.map(p=>(
            <div key={p.id} className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border p-4 hover:shadow-md transition">
              <div className="flex items-start gap-2">
                <span className="p-2 rounded-xl bg-orange-50 text-orange-500 shrink-0"><PresIcon size={16}/></span>
                <h3 className="font-bold line-clamp-2 flex-1 dark:text-white">{p.title}</h3>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
                {p.subject_name && (
                  <Link
                    to={p.subject_slug ? `/subjects/${p.subject_slug}?tab=pres` : '/subjects'}
                    className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold hover:underline"
                  >
                    {p.subject_icon || '📘'} {p.subject_name}
                  </Link>
                )}
                <span className={`px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1 ${p.is_public ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'}`}>
                  {p.is_public ? <><Globe size={11}/> В предмете</> : <><Lock size={11}/> Приватная</>}
                </span>
                <span className="text-slate-400">{p.slides_count ?? p.slides?.length ?? 0} {t('pres_slides_short')}</span>
              </div>
              <div className="mt-3 flex items-center gap-1.5">
                <Link to={`/presentations/${p.id}`} className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold flex items-center gap-1"><Eye size={13}/>{t('subj_open')}</Link>
                <Link to={`/presentations/${p.id}/edit`} className="px-2.5 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">{t('subj_edit')}</Link>
                {!p.is_public && (
                  <button onClick={()=>publishPres(p.id)} disabled={busy==='p'+p.id} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-50">{busy==='p'+p.id?'...':t('my_lessons_publish')}</button>
                )}
                <button onClick={e=>del(e,'presentations',p.id)} className="ml-auto p-1.5 rounded-lg bg-red-50 text-red-600"><Trash2 size={14}/></button>
              </div>
            </div>
          ))}
          {filteredPres.length===0 && (
            <div className="col-span-full text-center py-14 text-slate-400">
              <PresIcon size={40} className="mx-auto mb-3 opacity-40"/>
              <p>{t('my_lessons_empty_pres')}</p>
              <Link to="/presentations/new" className="inline-block mt-4 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold">{t('create')}</Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
