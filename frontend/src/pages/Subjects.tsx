import { useEffect, useState } from 'react'
import client from '../api/client'
import { Link } from 'react-router-dom'
import { BookOpen } from 'lucide-react'
import { useLang } from '../context/LangContext'

type Subject={id:number,name:string,slug:string,description:string,icon:string,color:string,courses:any[]}

export default function Subjects(){
  const {t}=useLang()
  const [list,setList]=useState<Subject[]>([])
  const [error,setError]=useState<string|null>(null)
  const load=()=>client.get('/subjects/').then(r=>setList(Array.isArray(r.data)?r.data:r.data.results||[])).catch((e:any)=>setError(e?.response?.data?.detail||e?.message||t('subj_load_err')))
  useEffect(()=>{load()},[])
  return (
    <div className="space-y-6 page-enter">
      <div className="flex flex-wrap items-center justify-between gap-3 animate-fadeIn">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-display font-bold flex items-center gap-2 dark:text-white"><span className="p-2 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 text-white"><BookOpen size={20}/></span> {t('subjects_title')} <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">{list.length}</span></h1>
        </div>
      </div>
      {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(s=>(
          <Link key={s.id} to={`/lessons?subject=${s.slug}`} className="bg-white rounded-2xl border overflow-hidden hover:shadow-md transition hover:border-blue-200 group block">
            <div className="h-2" style={{background:s.color}} />
            <div className="p-5">
              <div className="flex items-start justify-between">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl border group-hover:scale-105 transition" style={{background:`${s.color}15`}}>{s.icon}</div>
                <span className="text-xs px-2 py-1 rounded-full bg-slate-100">{s.slug}</span>
              </div>
              <h3 className="font-bold text-lg mt-3 group-hover:text-blue-600 transition">{s.name}</h3>
              <p className="text-sm text-slate-500 line-clamp-2">{s.description||t('subj_no_desc')}</p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>{s.courses?.length||0} {t('subj_courses')}</span><span className="text-blue-600 font-medium opacity-0 group-hover:opacity-100 transition">{t('subj_go')}</span></div>
            </div>
          </Link>
        ))}
        {list.length===0 && <div className="col-span-full text-center py-12 text-slate-400">{t('subj_empty')}</div>}
      </div>
    </div>
  )
}
