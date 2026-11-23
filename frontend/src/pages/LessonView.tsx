import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import { Presentation, FlaskConical, Code2, PenTool, Trash2 } from 'lucide-react'
import { toast } from '../context/UIContext'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import InlineFileReader from '../components/InlineFileReader'

export default function LessonView(){
  const {id}=useParams()
  const {t}=useLang()
  const nav=useNavigate()
  const [lesson,setLesson]=useState<any>(null)
  const [related,setRelated]=useState<any>({files:[],pres:[],tests:[],codes:[]})
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState<string|null>(null)
  const [me,setMe]=useState<any>(null)
  const {speech,autoRead,speak}=useAccessibility()
  useEffect(()=>{
    if(speech && autoRead && lesson){
      speak(`${lesson.title}. ${lesson.description||''}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[speech, autoRead, lesson?.id])
  useEffect(()=>{
    const raw=localStorage.getItem('user')
    if(raw) try{ setMe(JSON.parse(raw)) }catch{}
  },[])
  useEffect(()=>{
    if(!id) return
    setLoading(true); setError(null)
    client.get(`/lessons/${id}/`).then(async r=>{
      setLesson(r.data)
      const blocks=r.data.blocks||[]
      const [files,pres,tests,codes]=await Promise.all([
        Promise.all(blocks.filter((b:any)=>b.type==='file' && b.data?.file_id).map((b:any)=>client.get(`/files/${b.data.file_id}/`).then(x=>x.data).catch(()=>null))),
        Promise.all(blocks.filter((b:any)=>b.type==='presentation' && b.data?.presentation_id).map((b:any)=>client.get(`/presentations/${b.data.presentation_id}/`).then(x=>x.data).catch(()=>null))),
        Promise.all(blocks.filter((b:any)=>b.type==='test' && b.data?.test_id).map((b:any)=>client.get(`/tests/${b.data.test_id}/`).then(x=>x.data).catch(()=>null))),
        Promise.all(blocks.filter((b:any)=>b.type==='code' && b.data?.code_id).map((b:any)=>client.get(`/code-tasks/${b.data.code_id}/`).then(x=>x.data).catch(()=>null))),
      ])
      setRelated({files:files.filter(Boolean),pres:pres.filter(Boolean),tests:tests.filter(Boolean),codes:codes.filter(Boolean)})
      setLoading(false)
    }).catch(err=>{
      setError(err.response?.status===404 ? t('lv_not_found') : t('lv_load_err'))
      setLoading(false)
    })
  },[id])
  const canEdit = me && (me.role==='admin' || me.is_staff || String(lesson?.owner)===String(me.id) || String(lesson?.owner_id)===String(me.id))
  const handleDelete=async()=>{
    if(!confirm(t('lessons_del_confirm'))) return
    try{
      await client.delete(`/lessons/${id}/`)
      toast(t('lessons_deleted'),'success')
      nav('/lessons')
    }catch(err:any){
      toast(err?.response?.data?.detail || t('lessons_del_err'),'error')
    }
  }
  if(loading) return <div className="max-w-4xl mx-auto space-y-4"><div className="skeleton h-32 rounded-2xl"/><div className="skeleton h-64 rounded-2xl"/><div className="skeleton h-48 rounded-2xl"/></div>
  if(error) return <div className="max-w-4xl mx-auto text-center py-16"><div className="text-red-600 font-bold">{error}</div><Link to="/lessons" className="mt-4 inline-block px-4 py-2 rounded-xl bg-indigo-600 text-white">{t('lv_to_lessons')}</Link></div>
  if(!lesson) return <div>{t('loading')}</div>
  const getBlockContent=(block:any)=>{
    switch(block.type){
      case 'text': return (
        <div className="prose dark:prose-invert max-w-none">
          <h3 className="font-bold text-lg flex flex-wrap items-center gap-2 dark:text-white">
            <span>{block.data.title}</span>
            <button onClick={()=>speak(`${block.data.title}. ${block.data.content||''}`)} className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-base font-normal" title={t('lv_read_aloud')} aria-label={t('lv_read_aloud')}>🔊</button>
          </h3>
          <div className="whitespace-pre-wrap mt-2 text-slate-700 dark:text-slate-200 leading-relaxed">{block.data.content}</div>
        </div>
      )
      case 'file': {
        const f=related.files.find((x:any)=>String(x.id)===String(block.data.file_id))
        if (!f) return <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">{t('lv_file_missing_a')}{String(block.data.file_id??'—')}{t('lv_file_missing_b')}</div>
        return <InlineFileReader file={f} defaultOpen={true} />
      }
      case 'presentation': {
        const p=related.pres.find((x:any)=>String(x.id)===String(block.data.presentation_id))
        return p ? <Link to={`/presentations/${p.id}`} className="block p-4 rounded-xl bg-indigo-600 text-white hover:shadow-lg transition"><div className="flex items-center gap-2 font-bold"><Presentation size={20}/>{p.title}</div><div className="text-sm opacity-80">{p.slides_count ?? p.slides?.length ?? 0} {t('lv_slides_open')}</div></Link> : <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 text-sm">{t('lv_pres_missing_a')}{String(block.data.presentation_id??'—')}{t('lv_pres_missing_b')} <Link to="/presentations" className="text-indigo-600 underline">{t('lv_to_pres')}</Link> {t('lv_or_pick')} <Link to={`/lessons/${id}/edit`} className="underline">{t('lv_editing')}</Link>.</div>
      }
      case 'test': {
        const tst=related.tests.find((x:any)=>String(x.id)===String(block.data.test_id))
        return tst ? <Link to={`/tests/${tst.id}/take`} className="block p-4 rounded-xl bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition"><div className="flex items-center gap-2 font-semibold dark:text-amber-200"><FlaskConical size={20}/>{tst.title}</div><div className="text-sm text-slate-600 dark:text-slate-300">{t('lv_take_test')} {tst.questions_count ?? tst.questions?.length ?? 0} {t('lv_qs')}</div></Link> : <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 text-sm">{t('lv_test_missing_a')}{String(block.data.test_id??'—')}{t('lv_test_missing_b')}</div>
      }
      case 'code': {
        const c=related.codes.find((x:any)=>String(x.id)===String(block.data.code_id))
        return c ? <Link to="/code" className="block p-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"><div className="flex items-center gap-2"><Code2 size={20}/>{c.title} — {c.language}</div><div className="text-sm opacity-70">{c.description?.slice(0,80)}</div></Link> : <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm">{t('lv_code_missing_a')}{String(block.data.code_id??'—')}{t('lv_code_missing_b')}</div>
      }
      case 'board': return <Link to="/board" className="block p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/25 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold flex items-center gap-2"><PenTool/> {t('lv_board_open')}</Link>
      case 'video': {
        const raw = (block.data.url || '').trim()
        const toEmbed = (u:string)=>{
          if(!u) return ''
          let m=u.match(/youtu\.be\/([a-zA-Z0-9_-]+)/); if(m) return `https://www.youtube.com/embed/${m[1]}`
          m=u.match(/[?&]v=([a-zA-Z0-9_-]+)/); if(m) return `https://www.youtube.com/embed/${m[1]}`
          m=u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/); if(m) return `https://www.youtube.com/embed/${m[1]}`
          m=u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/); if(m) return `https://www.youtube.com/embed/${m[1]}`
          return u
        }
        const url = toEmbed(raw)
        const allowed = url.startsWith('https://www.youtube.com/embed/') || url.startsWith('https://player.vimeo.com/') || url.startsWith('https://www.youtube-nocookie.com/embed/')
        if (!allowed) return <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-sm">{t('lv_video_hint')} <code className="text-xs bg-white dark:bg-slate-800 px-1 rounded">{raw.slice(0,60)}</code></div>
        return <div className="aspect-video rounded-xl overflow-hidden border dark:border-slate-700"><iframe src={url} className="w-full h-full" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" title="video"/></div>
      }
      default: return <div>{block.type}</div>
    }
  }
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-6 shadow-sm">
        <div className="text-sm text-indigo-600 dark:text-indigo-400 font-semibold">{lesson.subject_name||t('lv_lesson')} {lesson.course_title?`• ${lesson.course_title}`:''}</div>
        <h1 className="text-2xl sm:text-3xl font-display font-extrabold mt-1 dark:text-white">{lesson.title}</h1>
        {lesson.description && <p className="text-slate-600 dark:text-slate-300 mt-2">{lesson.description}</p>}
        <div className="flex flex-wrap gap-2 mt-4">
          {canEdit ? <Link to={`/lessons/${id}/edit`} className="px-4 py-2.5 min-h-[44px] inline-flex items-center rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold">{t('edit')}</Link> : <span className="px-4 py-2.5 min-h-[44px] inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-sm" title={t('lv_locked')}>{t('lv_locked')}</span>}
          {canEdit && <button onClick={handleDelete} className="px-4 py-2.5 min-h-[44px] rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-800 text-sm font-semibold flex items-center gap-1 hover:bg-red-100"><Trash2 size={16}/>{t('delete')}</button>}
          <Link to="/lessons" className="px-4 py-2.5 min-h-[44px] inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-800 dark:text-slate-200 text-sm font-semibold">{t('back')}</Link>
        </div>
      </div>
      <div className="space-y-4">
        {(lesson.blocks||[]).map((b:any,i:number)=>(
          <div key={b.id||i} className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-5 sm:p-6 shadow-sm">
            <div className="text-xs font-bold tracking-widest text-slate-400 mb-3">{t('lv_block')} {i+1} • {b.type.toUpperCase()}</div>
            {getBlockContent(b)}
          </div>
        ))}
        {(lesson.blocks||[]).length===0 && <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 text-slate-400">{t('lv_no_blocks')}</div>}
      </div>
    </div>
  )
}
