import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Layers, Presentation as PresIcon, FlaskConical, Plus, Upload, Search, BookOpen, X, Download, Trash2 } from 'lucide-react'
import client, { mediaUrl, mediaSrc } from '../api/client'
import { isStudent } from '../utils/role'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'

// Страница предмета: три вкладки — Уроки / Презентации / Тесты.
// Учителю: создание и загрузка прямо внутри вкладки; ученику — просмотр и прохождение.
export default function SubjectDetail(){
  const {t}=useLang()
  const {slug}=useParams()
  const [subject,setSubject]=useState<any>(null)
  const [tab,setTab]=useState<'lessons'|'pres'|'tests'|'books'>('lessons')
  const [lessons,setLessons]=useState<any[]>([])
  const [pres,setPres]=useState<any[]>([])
  const [tests,setTests]=useState<any[]>([])
  const [books,setBooks]=useState<any[]>([])
  const [book,setBook]=useState<any>(null)
  const [q,setQ]=useState('')
  const [me,setMe]=useState<any>(null)
  const [uploading,setUploading]=useState(false)
  const [bookObjUrl,setBookObjUrl]=useState('')
  const [bookLoading,setBookLoading]=useState(false)
  const [bookErr,setBookErr]=useState('')
  const [pendingBook,setPendingBook]=useState<File|null>(null)
  const [bookTitle,setBookTitle]=useState('')
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
    loadBooks()
  },[slug])

  // перезагружаем данные активной вкладки при каждом переключении —
  // чтобы после загрузки файла/перезапуска бэкенда список был свежим
  useEffect(()=>{
    if(!slug) return
    const s=encodeURIComponent(slug)
    if(tab==='lessons') client.get(`/lessons/?subject=${s}`).then(r=>setLessons(Array.isArray(r.data)?r.data:r.data.results||[])).catch(()=>{})
    if(tab==='pres') client.get(`/presentations/?subject=${s}`).then(r=>setPres(Array.isArray(r.data)?r.data:r.data.results||[])).catch(()=>{})
    if(tab==='tests') client.get(`/tests/?subject=${s}`).then(r=>setTests(Array.isArray(r.data)?r.data:r.data.results||[])).catch(()=>{})
    if(tab==='books') loadBooks()
  },[slug,tab])

  const canEdit=(item:any)=>{
    if(!me) return false
    if(me.role==='admin'||me.is_staff) return true
    return String(item.owner)===String(me.id)||String(item.owner_id)===String(me.id)
  }
  const isTeacher=!isStudent()
  const isAdmin=!!me && (me.role==='admin'||me.is_staff)

  const loadBooks=()=>{
    const s=encodeURIComponent(slug||'')
    client.get(`/files/?subject=${s}`).then(r=>{
      const arr=Array.isArray(r.data)?r.data:r.data.results||[]
      setBooks(arr.filter((f:any)=>f.file_type==='pdf'||f.file_type==='document'))
    }).catch(()=>setBooks([]))
  }
  const canDeleteFile=(f:any)=> me && (me.role==='admin'||me.is_staff || String(f.owner)===String(me.id) || String(f.owner_id)===String(me.id))
  const delBook=async(e:any,f:any)=>{
    e.stopPropagation()
    if(!confirm(t('del_confirm'))) return
    try{
      await client.delete(`/files/${f.id}/`)
      setBooks(prev=>prev.filter(x=>x.id!==f.id))
      if(book?.id===f.id){ if(bookObjUrl) URL.revokeObjectURL(bookObjUrl); setBook(null); setBookObjUrl('') }
      toast(t('file_deleted'),'success')
    }catch(err:any){
      toast(err?.response?.data?.detail||t('lessons_del_err'),'error')
    }
  }
  // Открытие книги: качаем файл обычным fetch'ем (как все API-запросы — они
  // стабильно работают) и отдаём в iframe через blob:URL. Прямой коннект
  // iframe'а к localhost:8001 Chrome иногда блокирует, а vite-прокси на
  // больших файлах отвечает 500/text-plain — серый экран вместо PDF.
  const openBook=async(b:any)=>{
    if(bookObjUrl) URL.revokeObjectURL(bookObjUrl)
    setBookObjUrl(''); setBookErr(''); setBook(b); setBookLoading(true)
    try{
      const r=await client.get(b.url||mediaUrl(b.file), {responseType:'blob'})
      const blob=new Blob([r.data], {type:'application/pdf'})
      setBookObjUrl(URL.createObjectURL(blob))
    }catch(e:any){
      setBookErr(t('books_load_err'))
    }
    setBookLoading(false)
  }
  useEffect(()=>()=>{ if(bookObjUrl) URL.revokeObjectURL(bookObjUrl) },[bookObjUrl])

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

  const uploadBook=async(title:string)=>{
    if(!pendingBook) return
    const file=pendingBook
    setUploading(true)
    try{
      const fd=new FormData()
      fd.append('file',file)
      fd.append('title',(title||file.name.replace(/\.[^/.]+$/,'')).trim())
      if(subject?.id) fd.append('subject',String(subject.id))
      fd.append('is_public','true')
      await client.post('/files/', fd, {headers:{'Content-Type':'multipart/form-data'}})
      toast(t('books_uploaded'),'success')
      setPendingBook(null); setBookTitle('')
      loadBooks()
    }catch(e:any){
      toast(e?.response?.data?.detail||e?.response?.data?.error||t('pres_import_err'),'error')
    }
    setUploading(false)
  }

  const humanSize=(n:number)=>{
    if(!n) return ''
    if(n<1024*1024) return `${Math.round(n/1024)} KB`
    return `${(n/1024/1024).toFixed(1)} MB`
  }

  const fl=lessons.filter(l=>!q||l.title.toLowerCase().includes(q.toLowerCase()))
  const fp=pres.filter(p=>!q||(p.title||'').toLowerCase().includes(q.toLowerCase()))
  const ft=tests.filter(x=>!q||x.title.toLowerCase().includes(q.toLowerCase()))
  const fb=books.filter(b=>!q||(b.title||'').toLowerCase().includes(q.toLowerCase()))

  const tabs=[
    {key:'lessons' as const, label:t('lessons'), icon:Layers, count:lessons.length},
    {key:'pres' as const, label:t('presentations'), icon:PresIcon, count:pres.length},
    {key:'tests' as const, label:t('tests'), icon:FlaskConical, count:tests.length},
    {key:'books' as const, label:t('subj_tab_books'), icon:BookOpen, count:books.length},
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
        <div className="flex border-t dark:border-slate-800 overflow-x-auto tab-scroll">
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
        {isAdmin && tab==='books' && <>
          <button onClick={()=>fileRef.current?.click()} disabled={uploading} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Upload size={16}/>{uploading?'...':t('subj_upload_book')}</button>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f){ setPendingBook(f); setBookTitle(f.name.replace(/\.[^/.]+$/,'')) } e.target.value=''}}/>
        </>}
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
      {tab==='books' && (
        <div className="space-y-4">
          {isTeacher && !isAdmin && <p className="text-xs text-slate-400">{t('books_admin_only')}</p>}
          {book && (
            <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border overflow-hidden">
              <div className="px-4 py-2.5 flex items-center gap-2 border-b dark:border-slate-800">
                <BookOpen size={16} className="text-cyan-600 shrink-0"/>
                <span className="font-bold text-sm truncate dark:text-white">{book.title}</span>
                {bookObjUrl && <a href={bookObjUrl} target="_blank" rel="noopener noreferrer" className="ml-auto px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1 shrink-0"><Download size={13}/>{t('books_open_new')}</a>}
                <button onClick={()=>{ if(bookObjUrl) URL.revokeObjectURL(bookObjUrl); setBook(null); setBookObjUrl('') }} className={bookObjUrl?'p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500':'ml-auto p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500'}><X size={14}/></button>
              </div>
              {bookLoading ? (
                <div className="p-14 text-center text-sm text-slate-500 dark:text-slate-400">⏳ {t('books_loading')}</div>
              ) : bookObjUrl ? (
                <iframe src={bookObjUrl} className="w-full h-[70vh] bg-white" title={book.title}/>
              ) : (
                <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  <BookOpen size={36} className="mx-auto mb-3 opacity-40"/>
                  <p>{bookErr||t('books_doc_hint')}</p>
                  <a href={mediaSrc(book.url||book.file)} target="_blank" rel="noopener noreferrer" className="inline-block mt-3 px-4 py-2 rounded-xl bg-cyan-600 text-white text-sm font-semibold"><Download size={14} className="inline mr-1"/>{t('books_download')}</a>
                </div>
              )}
            </div>
          )}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {fb.map(b=>(
              <div key={b.id} onClick={()=>openBook(b)} className="cursor-pointer text-left bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border p-4 hover:shadow-md transition">
                <div className="flex items-start gap-2">
                  <span className="p-2 rounded-xl bg-cyan-50 text-cyan-600 shrink-0"><BookOpen size={16}/></span>
                  <h3 className="font-bold line-clamp-2 flex-1 dark:text-white">{b.title}</h3>
                  {canDeleteFile(b) && <button onClick={e=>delBook(e,b)} className="p-1.5 rounded-lg bg-red-50 text-red-600 shrink-0"><Trash2 size={14}/></button>}
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold uppercase">{b.file_type==='pdf'?'PDF':'Word'}</span>
                  {b.size ? <span>{humanSize(b.size)}</span> : null}
                  <span className="ml-auto text-cyan-600 font-semibold">{t('subj_open')}</span>
                </div>
              </div>
            ))}
            {fb.length===0 && <div className="col-span-full text-center py-10 text-slate-400">{t('subj_empty_books')}</div>}
          </div>
        </div>
      )}

      {pendingBook && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50" onClick={()=>{ if(!uploading){ setPendingBook(null); setBookTitle('') } }}>
          <div className="bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border shadow-2xl w-full max-w-md p-5 space-y-3" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-bold dark:text-white flex items-center gap-2"><BookOpen size={18}/> {t('books_upload_title')}</h2>
              <button onClick={()=>{ if(!uploading){ setPendingBook(null); setBookTitle('') } }} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 dark:text-white" aria-label={t('close')}><X size={18}/></button>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-semibold uppercase shrink-0">{pendingBook.name.endsWith('.pdf')?'PDF':'Word'}</span>
              <span className="truncate">{pendingBook.name}</span>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">{t('books_title_label')}</label>
              <input autoFocus value={bookTitle} onChange={e=>setBookTitle(e.target.value)} placeholder={t('books_title_ph')}
                className="w-full px-3 py-2.5 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:text-white text-sm" onKeyDown={e=>{ if(e.key==='Enter' && bookTitle.trim()) uploadBook(bookTitle) }}/>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={()=>{ if(!uploading){ setPendingBook(null); setBookTitle('') } }} disabled={uploading} className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-semibold disabled:opacity-50">{t('close')}</button>
              <button onClick={()=>uploadBook(bookTitle)} disabled={uploading||!bookTitle.trim()} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center gap-2 disabled:opacity-50"><Upload size={15}/>{uploading?'...':t('subj_upload_book')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
