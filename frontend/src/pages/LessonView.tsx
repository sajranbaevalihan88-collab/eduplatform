import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import client, { mediaUrl } from '../api/client'
import { FileText, Presentation, FlaskConical, Code2, PenTool, Trash2 } from 'lucide-react'
import { toast } from '../context/UIContext'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'

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
      // parallel fetch all
      const [files,pres,tests,codes]=await Promise.all([
        Promise.all(blocks.filter((b:any)=>b.type==='file').map((b:any)=>client.get(`/files/${b.data.file_id}/`).then(x=>x.data).catch(()=>null))),
        Promise.all(blocks.filter((b:any)=>b.type==='presentation').map((b:any)=>client.get(`/presentations/${b.data.presentation_id}/`).then(x=>x.data).catch(()=>null))),
        Promise.all(blocks.filter((b:any)=>b.type==='test').map((b:any)=>client.get(`/tests/${b.data.test_id}/`).then(x=>x.data).catch(()=>null))),
        Promise.all(blocks.filter((b:any)=>b.type==='code').map((b:any)=>client.get(`/code-tasks/${b.data.code_id}/`).then(x=>x.data).catch(()=>null))),
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
  if(error) return <div className="max-w-4xl mx-auto text-center py-16"><div className="text-red-600 font-bold">{error}</div><Link to="/lessons" className="mt-4 inline-block px-4 py-2 rounded-xl bg-blue-600 text-white">{t('lv_to_lessons')}</Link></div>
  if(!lesson) return <div>{t('loading')}</div>
  const getBlockContent=(block:any,idx:number)=>{
    switch(block.type){
      case 'text': return <div className="prose max-w-none"><h3 className="font-bold text-lg">{block.data.title} <button onClick={()=>speak(`${block.data.title}. ${block.data.content||''}`)} className="ml-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-100 text-xs font-normal" title={t('lv_read_aloud')}>🔊</button></h3><div className="whitespace-pre-wrap mt-2">{block.data.content}</div></div>
      case 'file': {
        const f=related.files.find((x:any)=>String(x.id)===String(block.data.file_id))
        const url = f ? mediaUrl(f.file || f.url) : ''
        return f ? (url ? <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border"><FileText/><div><div className="font-semibold">{f.title}</div><a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600">{t('lv_open_file')}</a><div className="text-xs text-slate-400">{f.file_type||''} • {(f.size/1024).toFixed(1)} KB</div></div></div> : <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm">{t('lv_file_nolink_a')}{f.title}{t('lv_file_nolink_b')} <Link to="/files" className="underline">{t('lv_files')}</Link></div>) : <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm">{t('lv_file_missing_a')}{String(block.data.file_id??'—')}{t('lv_file_missing_b')}</div>
      }
      case 'presentation': {
        const p=related.pres.find((x:any)=>String(x.id)===String(block.data.presentation_id))
        return p ? <Link to={`/presentations/${p.id}`} className="block p-4 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white hover:shadow-lg transition"><div className="flex items-center gap-2"><Presentation size={20}/>{p.title}</div><div className="text-sm opacity-80">{p.slides_count ?? p.slides?.length ?? 0} {t('lv_slides_open')}</div></Link> : <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm">{t('lv_pres_missing_a')}{String(block.data.presentation_id??'—')}{t('lv_pres_missing_b')} <Link to="/presentations" className="text-blue-600 underline">{t('lv_to_pres')}</Link> {t('lv_or_pick')} <Link to={`/lessons/${id}/edit`} className="underline">{t('lv_editing')}</Link>.</div>
      }
      case 'test': {
        const tst=related.tests.find((x:any)=>String(x.id)===String(block.data.test_id))
        return tst ? <Link to={`/tests/${tst.id}/take`} className="block p-4 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition"><div className="flex items-center gap-2 font-semibold"><FlaskConical size={20}/>{tst.title}</div><div className="text-sm text-slate-600">{t('lv_take_test')} {tst.questions_count ?? tst.questions?.length ?? 0} {t('lv_qs')}</div></Link> : <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm">{t('lv_test_missing_a')}{String(block.data.test_id??'—')}{t('lv_test_missing_b')}</div>
      }
      case 'code': {
        const c=related.codes.find((x:any)=>String(x.id)===String(block.data.code_id))
        return c ? <Link to="/code" className="block p-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"><div className="flex items-center gap-2"><Code2 size={20}/>{c.title} — {c.language}</div><div className="text-sm opacity-70">{c.description?.slice(0,80)}</div></Link> : <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm">{t('lv_code_missing_a')}{String(block.data.code_id??'—')}{t('lv_code_missing_b')}</div>
      }
      case 'board': return <Link to="/board" className="block p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2"><PenTool/> {t('lv_board_open')}</Link>
      case 'video': {
        const raw = (block.data.url || '').trim()
        const toEmbed = (u:string)=>{
          if(!u) return ''
          let m=u.match(/youtu\.be\/([a-zA-Z0-9_-]+)/); if(m) return `https://www.youtube.com/embed/${m[1]}`
          m=u.match(/[?&]v=([a-zA-Z0-9_-]+)/); if(m) return `https://www.youtube.com/embed/${m[1]}`
          m=u.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/); if(m) return `https://www.youtube.com/embed/${m[1]}`
          m=u.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/); if(m) return `https://www.youtube.com/embed/${m[1]}`
          if(u.includes('youtube.com')||u.includes('youtu.be')) return u
          return u
        }
        const url = toEmbed(raw)
        const allowed = url.startsWith('https://www.youtube.com/embed/') || url.startsWith('https://player.vimeo.com/') || url.startsWith('https://www.youtube-nocookie.com/embed/')
        if (!allowed) return <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm">{t('lv_video_hint')} <code className="text-xs bg-white px-1 rounded">{raw.slice(0,60)}</code></div>
        return <div className="aspect-video rounded-xl overflow-hidden border"><iframe src={url} className="w-full h-full" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" title="video"/></div>
      }
      default: return <div>{block.type}</div>
    }
  }
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl border p-6">
        <div className="text-sm text-blue-600 font-medium">{lesson.subject_name||t('lv_lesson')} {lesson.course_title?`• ${lesson.course_title}`:''}</div>
        <h1 className="text-3xl font-display font-extrabold mt-1 dark:text-white">{lesson.title}</h1>
        <p className="text-slate-600 mt-2">{lesson.description}</p>
        <div className="flex gap-2 mt-4">
          {canEdit ? <Link to={`/lessons/${id}/edit`} className="px-4 py-2 rounded-xl bg-blue-700 text-white text-sm">{t('edit')}</Link> : <span className="px-4 py-2 rounded-xl bg-slate-100 text-slate-400 text-sm" title={t('lv_locked')}>{t('lv_locked')}</span>}
          {!!me && <button onClick={handleDelete} className="px-4 py-2 rounded-xl bg-red-50 text-red-600 border border-red-200 text-sm flex items-center gap-1 hover:bg-red-100"><Trash2 size={14}/>{t('delete')}</button>}
          <Link to="/lessons" className="px-4 py-2 rounded-xl bg-slate-100 text-sm">{t('back')}</Link>
        </div>
      </div>
      <div className="space-y-4">
        {(lesson.blocks||[]).map((b:any,i:number)=>(
          <div key={b.id||i} className="bg-white rounded-2xl border p-6">
            <div className="text-xs font-bold tracking-widest text-slate-400 mb-3">{t('lv_block')} {i+1} • {b.type.toUpperCase()}</div>
            {getBlockContent(b,i)}
          </div>
        ))}
        {(lesson.blocks||[]).length===0 && <div className="text-center py-12 bg-white rounded-2xl border text-slate-400">{t('lv_no_blocks')}</div>}
      </div>
    </div>
  )
}
