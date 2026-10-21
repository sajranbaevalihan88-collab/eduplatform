import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import client, { mediaUrl } from '../api/client'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { Plus, Trash2, Save, GripVertical, Type, FileText, Presentation, FlaskConical, Code2, PenTool, Video, Eye, BookOpen, Sparkles } from 'lucide-react'

type Block={id:string,type:string,data:any}

export default function LessonBuilder(){
  const {t}=useLang()
  const {id}=useParams()
  const nav=useNavigate()
  const isNew=!id || id==='new'
  // привязка создаваемого контента к редактируемому уроку; путь возврата для «Открыть ↗»
  const lessonLinkId = (!isNew && id && id!=='new') ? id : null
  const fromPath = isNew ? '/lessons/new' : `/lessons/${id}/edit`
  const withFrom = (to:string)=> `${to}?from=${encodeURIComponent(fromPath)}`
  const [title,setTitle]=useState('')
  const [desc,setDesc]=useState('')
  const [subject,setSubject]=useState<any>(null)
  const [subjects,setSubjects]=useState<any[]>([])
  const [subjectsLoading,setSubjectsLoading]=useState(true)
  const [subjectsError,setSubjectsError]=useState<string|null>(null)
  const [blocks,setBlocks]=useState<Block[]>([{id:'1',type:'text',data:{title:'Введение',content:''}}])
  const [options,setOptions]=useState({files:[],presentations:[],tests:[],codes:[]} as any)
  const [preview,setPreview]=useState(false)
  const [saving,setSaving]=useState(false)
  const [inlineSubjectName,setInlineSubjectName]=useState('')
  // refs чтобы beforeunload не зависел от deps
  const titleRef = useRef(title); const descRef = useRef(desc); const subjectRef = useRef(subject); const blocksRef = useRef(blocks)
  useEffect(()=>{ titleRef.current=title },[title]); useEffect(()=>{ descRef.current=desc },[desc]); useEffect(()=>{ subjectRef.current=subject },[subject]); useEffect(()=>{ blocksRef.current=blocks },[blocks])

  const loadSubjects = ()=>{
    setSubjectsLoading(true); setSubjectsError(null)
    client.get('/subjects/').then(r=>{
      const arr = Array.isArray(r.data)?r.data:r.data.results||[]; setSubjects(arr)
      if(arr.length===0) setSubjectsError(null) // пусто — не ошибка, покажем inline создание
    }).catch((e:any)=>{
      const msg = e?.response?.status===429 ? 'Слишком много запросов — подожди пару секунд' : (e?.message||'Не удалось загрузить предметы')
      setSubjectsError(msg); toast(msg,'error')
    }).finally(()=>setSubjectsLoading(false))
  }
  const [optsLoading,setOptsLoading]=useState(true)
  // догружаем ВСЕ страницы (PAGE_SIZE=20 резал списки — старые элементы «пропадали»)
  const fetchAll=async(url:string)=>{
    const out:any[]=[]
    let next:string|null=url
    let guard=0
    while(next && guard<10){
      guard++
      const r:any=await client.get(next)
      const d:any=r.data
      if(Array.isArray(d)){ out.push(...d); break }
      out.push(...(d.results||[]))
      next=d.next||null
    }
    return out
  }
  const loadOptions = ()=>{
    setOptsLoading(true)
    Promise.all([
      fetchAll('/files/').then(a=>setOptions((o:any)=>({...o,files:a}))).catch(()=>{}),
      fetchAll('/presentations/').then(a=>setOptions((o:any)=>({...o,presentations:a}))).catch(()=>{}),
      fetchAll('/tests/').then(a=>setOptions((o:any)=>({...o,tests:a}))).catch(()=>{}),
      fetchAll('/code-tasks/').then(a=>setOptions((o:any)=>({...o,codes:a}))).catch(()=>{}),
    ]).finally(()=>setOptsLoading(false))
  }

  // 1) загрузка справочников и урока — только при смене id
  useEffect(()=>{
    loadSubjects(); loadOptions()
    if(!isNew && id) client.get(`/lessons/${id}/`).then(r=>{setTitle(r.data.title); setDesc(r.data.description||''); setSubject(r.data.subject!=null?Number(r.data.subject):null); if(r.data.blocks?.length) setBlocks(r.data.blocks)}).catch(e=>toast(e?.response?.data?.detail||'Не удалось загрузить урок','error'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id])

  // 2) beforeunload + autosave draft — черновик только если реально что-то введено
  const [draftBanner,setDraftBanner]=useState<any>(null)
  const persistDraft=(nb?:Block[])=>{
    try{
      const tt=titleRef.current, d=descRef.current, s=subjectRef.current, b=nb||blocksRef.current
      const hasContent = tt.trim() || d.trim() || s || b.length>1 || (b[0]?.data?.content?.trim() || b[0]?.data?.title?.trim() && b[0]?.data?.title!=='Введение')
      if(hasContent) localStorage.setItem('lesson-draft', JSON.stringify({title:tt,desc:d,subject:s,blocks:b, ts: Date.now()}))
    }catch{}
  }
  useEffect(()=>{
    const onBeforeUnload=(e:BeforeUnloadEvent)=>{
      const tt=titleRef.current, d=descRef.current, s=subjectRef.current, b=blocksRef.current
      const hasContent = tt.trim() || d.trim() || s || b.length>1 || (b[0]?.data?.content?.trim() || b[0]?.data?.title?.trim() && b[0]?.data?.title!=='Введение')
      if(hasContent){
        e.preventDefault(); e.returnValue=''
        localStorage.setItem('lesson-draft', JSON.stringify({title:tt,desc:d,subject:s,blocks:b, ts: Date.now()}))
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    // Проверяем черновик — сразу автовосстанавливаем, чтобы не терять презентацию после перехода
    const draft=localStorage.getItem('lesson-draft')
    if(draft && isNew){
      try{
        const dd=JSON.parse(draft)
        const hasDraftContent = (dd.title && String(dd.title).trim()) || (dd.subject) || (dd.blocks && dd.blocks.length>1) || (dd.blocks?.[0]?.data?.content?.trim()) || (dd.blocks?.[0]?.data?.title && dd.blocks[0].data.title!=='Введение')
        const age = Date.now() - (dd.ts||0)
        if(!hasDraftContent || age > 7*24*60*60*1000){
          localStorage.removeItem('lesson-draft')
        } else {
          // автовосстановление — чтобы «бац его нету» не повторялось
          if(dd.title) setTitle(dd.title||'')
          if(dd.desc) setDesc(dd.desc||'')
          if(dd.subject!=null) setSubject(Number(dd.subject))
          if(dd.blocks && Array.isArray(dd.blocks) && dd.blocks.length) setBlocks(dd.blocks)
          setDraftBanner(dd)
          toast(t('lb_draft_restored'),'info')
        }
      }catch{ localStorage.removeItem('lesson-draft') }
    }
    return ()=> window.removeEventListener('beforeunload', onBeforeUnload)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[id])
  // Дополнительно: автосохранение каждые 5с если есть изменения (для надёжности)
  useEffect(()=>{
    if(!isNew) return
    const iv=setInterval(()=>{
      const tt=titleRef.current, d=descRef.current, s=subjectRef.current, b=blocksRef.current
      const hasContent = tt.trim() || d.trim() || s || b.length>1 || b[0]?.data?.content?.trim()
      if(hasContent) localStorage.setItem('lesson-draft', JSON.stringify({title:tt,desc:d,subject:s,blocks:b, ts:Date.now()}))
    }, 5000)
    return ()=>clearInterval(iv)
  },[isNew])

  const [quickPresTitle,setQuickPresTitle]=useState('')
  const [uploadingPres,setUploadingPres]=useState<string|null>(null)
  const [errors,setErrors]=useState<{title?:string,subject?:string,blocks?:Record<string,string>}>({})
  const titleInputRef = useRef<HTMLInputElement>(null)
  const subjectRefEl = useRef<HTMLDivElement>(null)
  const blocksRefEl = useRef<HTMLDivElement>(null)
  // Профессионально: вкладки для презентации и inline-создание теста прямо в уроке
  const [presTabs,setPresTabs]=useState<Record<string,'select'|'upload'|'create'>>({})
  const [testInlineOpen,setTestInlineOpen]=useState<Record<string,boolean>>({})
  type InlineOpt={text:string,is_correct:boolean}
  type InlineQ={text:string,type:string,points:number,options:InlineOpt[]}
  const [inlineTests,setInlineTests]=useState<Record<string,{title:string,desc:string,pass:number,questions:InlineQ[]}>>({})
  // ИИ-генерация вопросов прямо в inline-тесте (тот же /tests/generate/, что в ТестВыборatеле)
  const [ltAiOpen,setLtAiOpen]=useState<Record<string,boolean>>({})
  const [ltAiPrompt,setLtAiPrompt]=useState('')
  const [ltAiCount,setLtAiCount]=useState(5)
  const [ltAiBusy,setLtAiBusy]=useState(false)
  const [ltAiSrc,setLtAiSrc]=useState<string|null>(null)
  const getPresTab=(id:string)=> presTabs[id] || (options.presentations.length ? 'select' : 'upload')
  const getInlineTest=(id:string)=> inlineTests[id] || {title:'',desc:'',pass:60,questions:[{text:'Сколько будет 2+2?',type:'single',points:1,options:[{text:'3',is_correct:false},{text:'4',is_correct:true},{text:'5',is_correct:false}]}]}
  const ltAiGenerate=async(bid:string)=>{
    if(ltAiBusy) return
    if(ltAiPrompt.trim().length<10){ toast('Напиши указание для ИИ (от 10 символов)','error'); return }
    setLtAiBusy(true)
    try{
      const r=await client.post('/tests/generate/',{count:ltAiCount,prompt:ltAiPrompt.trim().slice(0,2000)})
      const got=(r.data.questions||[]).map((q:any)=>({text:String(q.text||''),type:String(q.type||'single'),points:q.points||1,exp:String(q.explanation||''),options:(q.options||[]).map((o:any)=>({text:String(o.text||''),is_correct:!!o.is_correct}))})).filter((q:any)=>q.text)
      if(!got.length) throw new Error('empty')
      const cur=getInlineTest(bid)
      const isFreshEmpty = cur.questions.length===0 || (cur.questions.length===1 && cur.questions[0].text==='Сколько будет 2+2?' && !cur.title.trim())
      setInlineTests(prev=>({...prev,[bid]:{...cur,questions:isFreshEmpty?got:[...cur.questions,...got]}}))
      setLtAiSrc(typeof r.data.source==='string'? r.data.source : null)
      toast(`ИИ добавил ${got.length} вопросов ✓`,'success')
    }catch(e:any){ toast(e?.response?.data?.error||'ИИ не сгенерировал — попробуй другую тему','error') }
    setLtAiBusy(false)
  }
  const toEmbedUrl=(url:string)=>{
    if(!url) return ''
    url=url.trim()
    let m=url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/); if(m) return `https://www.youtube.com/embed/${m[1]}`
    m=url.match(/[?&]v=([a-zA-Z0-9_-]+)/); if(m) return `https://www.youtube.com/embed/${m[1]}`
    m=url.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/); if(m) return `https://www.youtube.com/embed/${m[1]}`
    m=url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/); if(m) return `https://www.youtube.com/embed/${m[1]}`
    return url
  }

  // Возвращает Promise — теперь await refreshOptions() реально ждёт
  const refreshOptions=()=>{
    setOptsLoading(true)
    return Promise.all([
      fetchAll('/presentations/').then(a=>setOptions((o:any)=>({...o,presentations:a}))),
      fetchAll('/tests/').then(a=>setOptions((o:any)=>({...o,tests:a}))),
      fetchAll('/files/').then(a=>setOptions((o:any)=>({...o,files:a}))),
      fetchAll('/code-tasks/').then(a=>setOptions((o:any)=>({...o,codes:a}))),
    ]).then(()=>toast('Списки обновлены','success')).catch(()=>toast('Не удалось обновить списки','error')).finally(()=>setOptsLoading(false))
  }

  const createInlineSubject=async()=>{
    const name=inlineSubjectName.trim(); if(!name) return
    const slug=name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9а-яё-]/gi,'-').replace(/--+/g,'-').replace(/^-|-$/g,'').slice(0,50) || `predmet-${Date.now()}`
    try{
      const r=await client.post('/subjects/',{name, slug, description:'', icon:'📚', color:'#3B82F6'})
      setSubjects(prev=>[...prev, r.data]); setSubject(r.data.id); setInlineSubjectName(''); toast(`Предмет "${r.data.name}" создан ✓`,'success')
    }catch(e:any){
      const msg=e?.response?.data?.slug?.[0] || e?.response?.data?.detail || JSON.stringify(e?.response?.data) || 'Не удалось создать предмет'
      toast(msg,'error')
    }
  }

  const addBlock=(type:string)=>{
    const nid=Date.now().toString()
    const presForBlock = subject ? filteredPresentations[0]?.id ?? options.presentations[0]?.id : options.presentations[0]?.id
    const dataMap:any={
      text:{title:'',content:''},
      file:{file_id:options.files[0]?.id},
      presentation:{presentation_id:presForBlock},
      test:{test_id:options.tests[0]?.id},
      code:{code_id:options.codes[0]?.id},
      board:{},
      video:{url:''}
    }
    // не блокируем — создаем пустой блок, пусть создаст внутри
    setBlocks(b=>[...b,{id:nid,type,data:dataMap[type]||{}}])
    setTimeout(()=>window.scrollTo({top:document.body.scrollHeight, behavior:'smooth'}),100)
  }

  const handlePresUpload=async(blockId:string, file:File)=>{
    if(!subject){ toast('Сначала выбери предмет урока — презентации фильтруются по нему','error'); subjectRefEl.current?.scrollIntoView({behavior:'smooth'}); return }
    if(!file) return
    const allowed=['.ppt','.pptx','.pdf']
    const ext='.'+file.name.split('.').pop()?.toLowerCase()
    if(!allowed.includes(ext)){ toast('Разрешены .ppt, .pptx, .pdf','error'); return }
    if(file.size>50*1024*1024){ toast('Файл >50MB','error'); return }
    setUploadingPres(blockId)
    try{
      const fd=new FormData()
      fd.append('file', file)
      fd.append('title', file.name.replace(/\.[^/.]+$/,''))
      fd.append('subject', String(subject))
      // приватно для урока: видно только владельцу, пока урок не опубликован — откроется гостям вместе с публикацией урока
      fd.append('is_lesson_private','true')
      fd.append('is_public','false')
      if(lessonLinkId) fd.append('lesson', String(lessonLinkId))
      // Новый бэкенд: импорт реальных слайдов (текст+картинки) из pptx
      let pres:any
      try{
        const r=await client.post('/presentations/import/', fd, {headers:{'Content-Type':'multipart/form-data'}})
        pres=r.data
      } catch(err:any){
        // fallback для старых бэкендов — старый путь через /files/ + placeholder
        if(err?.response?.status!==404){
          throw err
        }
        const r=await client.post('/files/', fd, {headers:{'Content-Type':'multipart/form-data'}})
        const p=await client.post('/presentations/', {title: file.name.replace(/\.[^/.]+$/,''), description: `Загружено из ${file.name}`, subject, is_public:false, is_lesson_private:true, ...(lessonLinkId?{lesson:Number(lessonLinkId)}:{})})
        await client.post(`/presentations/${p.data.id}/slides/`, {order:0, background:'#ffffff', content:{blocks:[{type:'text',content:`Презентация ${file.name}`},{type:'text',content:`Файл: ${r.data.title}`}]}})
        const full=await client.get(`/presentations/${p.data.id}/`)
        pres=full.data
      }
      // optimistic — сразу в список, не ждём refetch
      setOptions((o:any)=>({...o, presentations: [{...pres, slides_count: pres.slides_count ?? pres.slides?.length ?? 1}, ...(o.presentations||[])] }))
      await refreshOptions()
      updateBlock(blockId, {presentation_id: pres.id})
      toast(`Презентация "${pres.title}" загружена: ${pres.slides_count ?? pres.slides?.length ?? 0} слайдов ✓`,'success')
    }catch(e:any){ toast(e.response?.data?.detail||e.response?.data?.error||JSON.stringify(e.response?.data)||'Ошибка загрузки','error') }
    finally{ setUploadingPres(null) }
  }

  const handleQuickCreatePres=async(blockId:string)=>{
    if(!subject){ toast('Сначала выбери предмет урока','error'); return }
    if(!quickPresTitle.trim()){ toast('Укажи название','error'); return }
    try{
      const r=await client.post('/presentations/', {title: quickPresTitle.trim(), description: '', subject, is_public:false, is_lesson_private:true, ...(lessonLinkId?{lesson:Number(lessonLinkId)}:{})})
      await client.post(`/presentations/${r.data.id}/slides/`, {order:0, background:'#ffffff', content:{blocks:[{type:'text',content:'Новый слайд'}]}})
      setOptions((o:any)=>({...o, presentations: [{...r.data, slides_count:1}, ...(o.presentations||[])] }))
      await refreshOptions()
      updateBlock(blockId, {presentation_id: r.data.id})
      setQuickPresTitle('')
      toast('Презентация создана ✓','success')
    }catch(e:any){ toast(e?.response?.data?.detail||'Ошибка создания','error') }
  }
  const updateBlock=(id:string,patch:any)=>setBlocks(b=>{
    const nb=b.map(x=>x.id===id?{...x,data:{...x.data,...patch}}:x)
    if(isNew){
      // мгновенно — чтобы не терять после перехода «Открыть ↗»
      try{ const tt=titleRef.current,d=descRef.current,s=subjectRef.current; localStorage.setItem('lesson-draft', JSON.stringify({title:tt,desc:d,subject:s,blocks:nb, ts:Date.now()})) }catch{}
    }
    return nb
  })
  const move=(idx:number,dir:number)=>{
    const nb=[...blocks]
    const ni=idx+dir
    if(ni<0||ni>=nb.length) return
    const tmp=nb[idx]; nb[idx]=nb[ni]; nb[ni]=tmp
    setBlocks(nb)
  }
  // Предпросмотр блока — так же, как увидит ученик (LessonView), данные уже есть в options
  const renderPreviewBlock=(b:Block)=>{
    if(b.type==='text') return <><div className="font-semibold mt-1">{b.data.title||t('lb_no_title')}</div><div className="whitespace-pre-wrap text-sm mt-1">{b.data.content||t('lb_empty')}</div></>
    if(b.type==='presentation'){
      const p=options.presentations.find((x:any)=>String(x.id)===String(b.data.presentation_id))
      if(!b.data.presentation_id) return <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-1">{t('lb_pres_not_picked')}</div>
      if(!p) return <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mt-1">{t('lb_pres_missing_a')}{String(b.data.presentation_id)}{t('lb_pres_missing_b')}</div>
      return <Link to={withFrom(`/presentations/${p.id}`)} target="_blank" className="block mt-1 p-4 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-600 text-white hover:shadow-lg transition"><div className="flex items-center gap-2 font-semibold"><Presentation size={20}/>{p.title}</div><div className="text-sm opacity-80">{p.slides_count ?? p.slides?.length ?? 0} {t('pres_slides')}{t('lb_open_arrow')}</div></Link>
    }
    if(b.type==='test'){
      const tst=options.tests.find((x:any)=>String(x.id)===String(b.data.test_id))
      if(!b.data.test_id) return <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-1">{t('lb_test_not_picked')}</div>
      if(!tst) return <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mt-1">{t('lb_test_missing_a')}{String(b.data.test_id)}{t('lb_test_missing_b')}</div>
      return <Link to={withFrom(`/tests/${tst.id}/take`)} target="_blank" className="block mt-1 p-4 rounded-xl bg-amber-50 border border-amber-200 hover:bg-amber-100 transition"><div className="flex items-center gap-2 font-semibold"><FlaskConical size={20}/>{tst.title}</div><div className="text-sm text-slate-600">{t('lv_take_test')} {tst.questions_count ?? tst.questions?.length ?? 0} {t('lv_qs')} ↗</div></Link>
    }
    if(b.type==='file'){
      const f=options.files.find((x:any)=>String(x.id)===String(b.data.file_id))
      if(!b.data.file_id) return <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-1">{t('lb_file_not_picked')}</div>
      if(!f) return <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mt-1">{t('lb_file_missing_a')}{String(b.data.file_id)}{t('lb_file_missing_b')}</div>
      const url=mediaUrl(f.file||f.url)
      return <div className="flex items-center gap-3 p-4 rounded-xl bg-white border mt-1"><FileText/><div><div className="font-semibold">{f.title}</div>{url ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600">{t('lv_open_file')} ↗</a> : <div className="text-xs text-slate-400">{t('lb_link_na')}</div>}</div></div>
    }
    if(b.type==='code'){
      const c=options.codes.find((x:any)=>String(x.id)===String(b.data.code_id))
      if(!b.data.code_id) return <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-1">{t('lb_code_not_picked')}</div>
      if(!c) return <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-3 mt-1">{t('lb_code_missing_a')}{String(b.data.code_id)}{t('lb_code_missing_b')}</div>
      return <Link to="/code" target="_blank" className="block mt-1 p-4 rounded-xl bg-slate-900 text-white hover:bg-slate-800 transition"><div className="flex items-center gap-2"><Code2 size={20}/>{c.title} — {c.language}</div><div className="text-sm opacity-70">{c.description?.slice(0,80)}</div></Link>
    }
    if(b.type==='board') return <div className="mt-1 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-sm"><PenTool size={16}/> {t('lb_board_hint')}</div>
    if(b.type==='video'){
      const raw=(b.data.url||'').trim()
      if(!raw) return <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-1">{t('lb_video_empty')}</div>
      const url=toEmbedUrl(raw)
      const ok=url.startsWith('https://www.youtube.com/embed/')||url.startsWith('https://player.vimeo.com/')
      if(!ok) return <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl p-3 mt-1">{t('lb_video_bad')} <code className="text-xs bg-white px-1 rounded">{raw.slice(0,60)}</code></div>
      return <div className="aspect-video rounded-xl overflow-hidden border mt-1"><iframe src={url} className="w-full h-full" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" title="video"/></div>
    }
    return <div className="text-sm text-slate-500 mt-1">{t('lb_unknown_block_a')}{b.type}</div>
  }
  const save=async()=>{
    const newErrors:{title?:string,subject?:string,blocks?:Record<string,string>} = {}
    if(!title.trim()){
      newErrors.title = t('lb_err_title')
    }
    if(!subject){
      newErrors.subject = t('lb_err_subject')
    }
    const blockErrs:Record<string,string>={}
    let firstBad=''
    for(let i=0;i<blocks.length;i++){
      const b=blocks[i]
      if((b.type==='presentation' && !b.data.presentation_id) || (b.type==='test' && !b.data.test_id) || (b.type==='file' && !b.data.file_id) || (b.type==='code' && !b.data.code_id)){
        blockErrs[b.id] = `${t('lb_block_a')}${i+1} (${b.type})${t('lb_block_pick_b')}`
        if(!firstBad) firstBad=`${t('lb_block_a')}${i+1} (${b.type})`
      }
      if(b.type==='text' && !b.data.title?.trim() && !b.data.content?.trim()){
        blockErrs[b.id] = `${t('lb_block_a')}${i+1}${t('lb_block_empty_b')}`
        if(!firstBad) firstBad=`${t('lb_block_a')}${i+1} ${t('lb_type_text')}`
      }
      if(b.type==='video' && !b.data.url?.trim()){
        blockErrs[b.id] = `${t('lb_block_a')}${i+1} ${t('lb_type_video')}${t('lb_block_video_b')}`
        if(!firstBad) firstBad=`${t('lb_block_a')}${i+1} ${t('lb_type_video')}`
      }
    }
    if(Object.keys(blockErrs).length) newErrors.blocks = blockErrs
    if(Object.keys(newErrors).length){
      setErrors(newErrors)
      // скролл к первой ошибке — профессионально: не просто toast внизу
      if(newErrors.title){
        toast(t('lb_need_title_top'),'error')
        titleInputRef.current?.scrollIntoView({behavior:'smooth', block:'center'})
        titleInputRef.current?.focus()
      } else if(newErrors.subject){
        toast(t('lb_pick_subject_t'),'error')
        subjectRefEl.current?.scrollIntoView({behavior:'smooth', block:'center'})
      } else if(newErrors.blocks){
        toast(firstBad ? `${firstBad}${t('lb_block_unfilled_b')}` : t('lb_fill_empty'),'error')
        blocksRefEl.current?.scrollIntoView({behavior:'smooth', block:'start'})
      }
      return
    }
    setErrors({})
    const token=localStorage.getItem('token')
    if(!token){ toast(t('lb_login_to_save'),'error'); nav('/login'); return }
    setSaving(true)
    try{
      const payload={title:title.trim(),description:desc.trim(),subject,blocks}
      if(isNew){
        const r=await client.post('/lessons/',payload)
        localStorage.removeItem('lesson-draft')
        setDraftBanner(null)
        toast(t('lb_published'),'success')
        const newId = r.data?.id
        if(newId) nav(`/lessons/${newId}`, {replace:true})
        else nav('/lessons', {replace:true})
      } else {
        await client.patch(`/lessons/${id}/`,payload)
        localStorage.removeItem('lesson-draft')
        setDraftBanner(null)
        toast(t('tb_saved_short'),'success')
        nav(`/lessons/${id}`, {replace:true})
      }
    }catch(e:any){
      const msg=e.response?.data?.detail || JSON.stringify(e.response?.data) || t('lb_save_err')
      toast(msg,'error')
    } finally{ setSaving(false) }
  }

  const selectedSubject = subjects.find(s=>String(s.id)===String(subject))
  const filteredPresentations = subject ? options.presentations.filter((p:any)=>{
    const pid = p.subject ?? p.subject_id ?? p.subject_slug
    const sslug = selectedSubject?.slug
    const sid = String(subject)
    return String(p.subject)===sid || String(p.subject_id)===sid || (p.subject_slug && sslug && p.subject_slug===sslug) || (p.subject_name && selectedSubject && p.subject_name===selectedSubject.name)
  }) : []

  const handleCancel=()=>{
    const hasContent = title.trim() || desc.trim() || subject || blocks.length>1 || blocks[0]?.data?.title?.trim() || blocks[0]?.data?.content?.trim()
    if(hasContent && !confirm(t('lb_cancel_confirm'))) return
    if(window.history.length>2) nav(-1)
    else nav('/lessons')
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 text-sm text-slate-500">
        <Link to="/lessons" className="hover:text-blue-600">{t('lessons')}</Link>
        <span>›</span>
        <span className="text-slate-900 font-medium">{isNew?t('lb_new'):t('lb_editing')}</span>
      </div>
      {draftBanner && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[94vw] sm:max-w-md rounded-2xl bg-slate-900/92 dark:bg-black/85 text-white shadow-2xl border border-white/10 px-4 py-3 flex items-center gap-3" data-testid="lb-draft-chip">
          <span className="text-xl shrink-0">↩️</span>
          <div className="min-w-0">
            <div className="text-sm font-bold leading-tight">{t('lb_draft_restored')}</div>
            <div className="text-xs text-slate-300 truncate">{draftBanner.title ? `«${draftBanner.title.slice(0, 40)}»` : `${draftBanner.blocks?.length || 0} ${t('lessons_blocks')}`} · {new Date(draftBanner.ts).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <button onClick={() => {
            localStorage.removeItem('lesson-draft')
            setTitle(''); setDesc(''); setSubject(null)
            setBlocks([{ id: '1', type: 'text', data: { title: 'Введение', content: '' } }])
            setDraftBanner(null); toast(t('lb_draft_deleted'), 'info')
          }} className="px-3 py-2 rounded-xl bg-amber-500 text-slate-900 text-xs font-bold hover:bg-amber-400 shrink-0" data-testid="lb-draft-clear">{t('lb_start_fresh')}</button>
          <button onClick={() => setDraftBanner(null)} className="w-11 h-11 rounded-xl bg-white/10 text-white text-sm font-bold hover:bg-white/20 shrink-0" data-testid="lb-draft-hide" title={t('fb_hide') || '✕'} aria-label="Скрыть предупреждение">✕</button>
        </div>
      )}

      <div className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-[24px] p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Sparkles size={20}/> {isNew?t('lb_hero_new'):t('lb_hero_edit')}</h1>
            <p className="text-white/80 text-sm mt-1">{t('lb_hero_sub')}</p>
          </div>
          <button onClick={()=>setPreview(!preview)} className="px-4 py-2 rounded-xl bg-white text-blue-700 font-semibold flex items-center gap-2 text-sm"><Eye size={16}/>{preview?t('lb_editor'):t('lb_preview')}</button>
        </div>
      </div>

      {!preview ? (
        <>
          <div className="bg-white rounded-2xl border p-6 space-y-4">
            <div id="lesson-title-field">
              <label className="text-sm font-semibold text-slate-700">Название урока *</label>
              <input ref={titleInputRef} value={title} onChange={e=>{setTitle(e.target.value); if(errors.title) setErrors(prev=>({...prev, title:undefined}))}} placeholder="Например: Квадратные уравнения — 8 класс" className={`w-full mt-1 px-4 py-3 rounded-xl border font-bold text-lg focus:outline-none focus:ring-2 ${errors.title ? 'bg-red-50 border-red-300 focus:border-red-400 focus:ring-red-200' : 'bg-slate-50 focus:border-blue-400 focus:ring-blue-200'}`}/>
              {errors.title ? <div className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1">⚠ {errors.title}</div> : <div className="text-xs text-slate-400 mt-1">{title.length}/100 {title.length===0 && <span className="text-slate-500">— это поле обязательно, не путай с заголовком блока «Введение» ниже</span>}</div>}
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700">О чём урок?</label>
              <textarea value={desc} onChange={e=>setDesc(e.target.value)} placeholder="Коротко: цели, для кого, что узнают. Это покажется в списке уроков." rows={3} className="w-full mt-1 px-4 py-3 rounded-xl border bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-200"/>
            </div>
            <div ref={subjectRefEl} id="lesson-subject-field">
              <label className="text-sm font-semibold text-slate-700">Предмет *</label>
              {errors.subject && <div className="mt-1 text-xs font-medium text-red-600">⚠ {errors.subject}</div>}
              {subjectsLoading ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-500"><span className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"/> Загрузка предметов...</div>
              ) : subjectsError ? (
                <div className="mt-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center justify-between gap-2">
                  <span>{subjectsError}</span>
                  <button onClick={loadSubjects} className="px-3 py-1 rounded-full bg-white border text-xs font-semibold hover:bg-red-50">Повторить</button>
                </div>
              ) : !subjects.length ? (
                <div className="mt-2 p-4 rounded-xl bg-amber-50 border border-amber-200">
                  <div className="text-sm font-semibold text-amber-800">Предметов пока нет — создай первый прямо здесь</div>
                  <p className="text-xs text-amber-700 mt-1">Без предмета урок не опубликуется. Введи название и нажми «Создать».</p>
                  <div className="flex gap-2 mt-3">
                    <input value={inlineSubjectName} onChange={e=>setInlineSubjectName(e.target.value)} onKeyDown={e=>e.key==='Enter' && createInlineSubject()} placeholder="Например: Математика" className="flex-1 px-3 py-2 rounded-xl border bg-white text-sm"/>
                    <button onClick={createInlineSubject} className="px-4 py-2 rounded-xl bg-blue-700 text-white text-sm font-semibold">Создать</button>
                    <Link to="/subjects" className="px-4 py-2 rounded-xl bg-white border text-sm">Все предметы →</Link>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {subjects.map(s=>(
                    <button key={s.id} onClick={()=>setSubject(s.id)} className={`p-3 rounded-xl border text-left flex items-center gap-2 ${String(subject)===String(s.id)?'bg-blue-50 border-blue-300 ring-2 ring-blue-200':'bg-slate-50 hover:bg-white'}`}>
                      <span className="text-lg">{s.icon}</span>
                      <span className="font-medium text-sm">{s.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedSubject && <div className="mt-2 text-sm text-blue-700">Выбран: {selectedSubject.icon} {selectedSubject.name}</div>}
              {!!subjects.length && !selectedSubject && subject && <div className="mt-2 text-xs text-amber-600">Предмет с id={String(subject)} не найден — выбери из списка выше</div>}
              {errors.subject && !selectedSubject && <div className="mt-2 p-2 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">Без предмета урок не сохранится — кликни на карточку предмета выше или создай новый.</div>}
            </div>
          </div>

          <div className="bg-white rounded-2xl border p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Конструктор — добавь блоки</h3>
              <span className="text-xs text-slate-500">{blocks.length} блоков</span>
            </div>
            <p className="text-sm text-slate-500 mt-1">Каждый блок — часть урока. Меняй порядок стрелками. Презентации/тесты можно создать тут же.</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              <button onClick={()=>addBlock('text')} className="p-3 rounded-xl bg-blue-700 text-white flex flex-col items-center gap-1 text-sm font-medium"><Type size={20}/> Текст</button>
              <button onClick={()=>addBlock('presentation')} className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 flex flex-col items-center gap-1 text-sm font-medium"><Presentation size={20}/> Презентация { !options.presentations.length && <span className="text-[10px]">(создать)</span>}</button>
              <button onClick={()=>addBlock('test')} className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex flex-col items-center gap-1 text-sm font-medium"><FlaskConical size={20}/> Тест { !options.tests.length && <span className="text-[10px]">(создать)</span>}</button>
              <button onClick={()=>addBlock('board')} className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex flex-col items-center gap-1 text-sm font-medium"><PenTool size={20}/> Доска 2D/3D</button>
              <button onClick={()=>addBlock('file')} className="p-3 rounded-xl bg-slate-50 border flex flex-col items-center gap-1 text-sm"><FileText size={18}/> Файл</button>
              <button onClick={()=>addBlock('video')} className="p-3 rounded-xl bg-slate-50 border flex flex-col items-center gap-1 text-sm"><Video size={18}/> Видео</button>
              <button onClick={()=>addBlock('code')} className="p-3 rounded-xl bg-slate-50 border flex flex-col items-center gap-1 text-sm"><Code2 size={18}/> Код</button>
              <Link to={subject ? `/presentations/new?subject=${selectedSubject?.slug||subject}` : "/presentations/new"} className="p-3 rounded-xl bg-blue-50 border border-blue-200 flex flex-col items-center gap-1 text-sm text-blue-700 font-medium"><Plus size={18}/> Создать презент.</Link>
            </div>
          </div>

          <div ref={blocksRefEl} id="lesson-blocks" className="space-y-3">
            {blocks.map((b,idx)=>(
              <div key={b.id} className={`bg-white rounded-2xl border p-4 shadow-sm ${errors.blocks?.[b.id] ? 'border-red-300 bg-red-50/30 ring-1 ring-red-200' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <GripVertical size={14} className="text-slate-400"/>
                    <span className="text-xs font-bold tracking-widest text-slate-500">{b.type.toUpperCase()} • БЛОК {idx+1}</span>
                    {b.type==='text' && <span className={`text-xs px-2 py-1 rounded-full ${!b.data.title?.trim() && !b.data.content?.trim() ? 'bg-amber-100 text-amber-700' : 'bg-slate-100'}`}>{b.data.title||'без заголовка'}</span>}
                    {errors.blocks?.[b.id] && <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">⚠ ошибка</span>}
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={()=>move(idx,-1)} aria-label="Блок выше" title="Блок выше" className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-lg active:bg-slate-200">↑</button>
                    <button onClick={()=>move(idx,1)} aria-label="Блок ниже" title="Блок ниже" className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-lg active:bg-slate-200">↓</button>
                    <button onClick={()=>setBlocks(bl=>bl.filter(x=>x.id!==b.id))} aria-label="Удалить блок" title="Удалить блок" className="w-11 h-11 rounded-xl bg-red-50 text-red-600 flex items-center justify-center active:bg-red-100"><Trash2 size={18}/></button>
                  </div>
                </div>
                {b.type==='text' && (
                  <div className="space-y-2">
                    <input value={b.data.title} onChange={e=>{updateBlock(b.id,{title:e.target.value}); if(errors.blocks?.[b.id]) setErrors(prev=>({...prev, blocks:{...prev.blocks!, [b.id]:''}}))}} placeholder="Заголовок блока, например ‘Теория’ (это НЕ название урока — урок выше)" className="w-full px-3 py-2.5 rounded-xl border bg-blue-50/50 font-semibold focus:outline-none focus:border-blue-300"/>
                    <textarea value={b.data.content} onChange={e=>{updateBlock(b.id,{content:e.target.value}); if(errors.blocks?.[b.id]) setErrors(prev=>({...prev, blocks:{...prev.blocks!, [b.id]:''}}))}} placeholder="Содержание блока — теория, пример, задание..." rows={4} className="w-full px-3 py-2.5 rounded-xl border bg-slate-50 focus:outline-none focus:border-blue-300"/>
                    {errors.blocks?.[b.id] && <div className="text-xs text-red-600">⚠ {errors.blocks?.[b.id]}</div>}
                  </div>
                )}
                {b.type==='file' && (
                  <div className="space-y-2">
                    <select value={b.data.file_id||''} onChange={e=>{updateBlock(b.id,{file_id:e.target.value?Number(e.target.value):null}); if(errors.blocks?.[b.id]) setErrors(prev=>({...prev, blocks:{...prev.blocks!, [b.id]:''}}))}} className={`w-full px-3 py-2.5 rounded-xl border bg-slate-50 ${errors.blocks?.[b.id] ? 'border-red-300 bg-red-50' : ''}`}>
                      <option value="">Выбери файл</option>
                      {options.files.map((f:any)=><option key={f.id} value={f.id}>{f.title}</option>)}
                    </select>
                    {errors.blocks?.[b.id] && <div className="text-xs text-red-600">⚠ {errors.blocks?.[b.id]}</div>}
                    {options.files.length===0 && <div className="text-xs text-amber-600">Нет файлов — загрузи в файлы или оставь блок пустым</div>}
                  </div>
                )}
                {b.type==='presentation' && (
                  <div className="space-y-3">
                    {/* Выбранная */}
                    {!!b.data.presentation_id && options.presentations.find((p:any)=>String(p.id)===String(b.data.presentation_id)) && (
                      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between gap-2">
                        <span>✓ Выбрана: <b>{options.presentations.find((p:any)=>String(p.id)===String(b.data.presentation_id))?.title}</b> ({options.presentations.find((p:any)=>String(p.id)===String(b.data.presentation_id))?.slides_count ?? options.presentations.find((p:any)=>String(p.id)===String(b.data.presentation_id))?.slides?.length ?? 0} слайдов)</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <Link to={withFrom(`/presentations/${b.data.presentation_id}`)} target="_blank" className="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-semibold no-underline">Открыть ↗</Link>
                          <button onClick={()=>updateBlock(b.id,{presentation_id:null})} className="text-xs underline">Сменить</button>
                        </span>
                      </div>
                    )}
                    {errors.blocks?.[b.id] && <div className="text-xs text-red-600">⚠ {errors.blocks?.[b.id]}</div>}
                    {/* Вкладки */}
                    <div className="flex gap-1 p-1 rounded-xl bg-slate-100 w-fit">
                      {(['select','upload','create'] as const).map(tab=>(
                        <button key={tab} onClick={()=>setPresTabs(p=>({...p,[b.id]:tab}))} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${getPresTab(b.id)===tab?'bg-white shadow text-slate-900':'text-slate-500 hover:text-slate-700'}`}>
                          {tab==='select'?'📂 Выбрать':tab==='upload'?'⬆ Загрузить':'✨ Создать'}
                        </button>
                      ))}
                      <span className="ml-2 text-[11px] text-slate-400 self-center hidden sm:inline">урок сохранится с выбранной презентацией</span>
                    </div>
                    {getPresTab(b.id)==='select' && (
                      <div className="space-y-2">
                        {!subject ? (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">Сначала выбери предмет урока выше — покажу только презентации по <b>{selectedSubject?.name || 'выбранному предмету'}</b>. Это быстро помогает найти нужную.</div>
                        ) : filteredPresentations.length===0 ? (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm">
                            <div className="font-semibold text-amber-800">Нет презентаций по предмету «{selectedSubject?.name}»</div>
                            <div className="text-xs text-amber-700 mt-1">Загрузи во вкладке «Загрузить» или создай новую — она автоматически привяжется к этому предмету.</div>
                            <div className="text-xs text-slate-500 mt-1">Всего презентаций в системе: {options.presentations.length}</div>
                          </div>
                        ) : (
                          <select value={b.data.presentation_id||''} onChange={e=>{updateBlock(b.id,{presentation_id:e.target.value?Number(e.target.value):null}); if(errors.blocks?.[b.id]) setErrors(prev=>({...prev, blocks:{...prev.blocks!, [b.id]:''}}))}} className="w-full px-3 py-2.5 rounded-xl border bg-slate-50">
                            <option value="">— выбери из {filteredPresentations.length} по предмету «{selectedSubject?.name}» —</option>
                            {filteredPresentations.map((p:any)=><option key={p.id} value={p.id}>{p.title} ({p.slides_count ?? p.slides?.length ?? 0} слайдов){p.subject_name? ` • ${p.subject_name}`:''}</option>)}
                          </select>
                        )}
                        {subject && filteredPresentations.length>0 && <div className="text-xs text-slate-500">Показано {filteredPresentations.length} из {options.presentations.length} — фильтр по предмету урока «{selectedSubject?.name}». <button onClick={()=>refreshOptions()} className="underline">Обновить</button></div>}
                        <div className="flex gap-2">
                          <button onClick={()=>refreshOptions()} className="text-xs px-3 py-1.5 rounded-full bg-white border hover:bg-slate-50">↻ Обновить список</button>
                          <Link to="/presentations" target="_blank" className="text-xs px-3 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700">Все презентации →</Link>
                        </div>
                      </div>
                    )}
                    {getPresTab(b.id)==='upload' && (
                      <div className="space-y-2">
                        <label className={`block p-4 rounded-xl border-2 border-dashed text-center cursor-pointer transition ${uploadingPres===b.id?'bg-orange-50 border-orange-300':'bg-orange-50/50 border-orange-200 hover:bg-orange-50 hover:border-orange-300'}`}>
                          <div className="text-sm font-semibold text-orange-700">{uploadingPres===b.id ? '⏳ Загружаю и разбираю слайды...' : '⬆ Перетащи сюда .pptx/.pdf или кликни'}</div>
                          <div className="text-xs text-orange-600/80 mt-1">Поддерживается .pptx .ppt .pdf до 50MB — слайды и картинки извлекутся автоматически (21 слайд из Ребусы)</div>
                          <input type="file" className="hidden" accept=".ppt,.pptx,.pdf" onChange={e=>{ const f=e.target.files?.[0]; if(f) handlePresUpload(b.id,f); (e.target as HTMLInputElement).value=''}} disabled={uploadingPres===b.id}/>
                        </label>
                        <div className="text-xs text-slate-500">После загрузки презентация появится в списке «Выбрать» и сразу привяжется к уроку.</div>
                      </div>
                    )}
                    {getPresTab(b.id)==='create' && (
                      <div className="space-y-2 p-3 rounded-xl bg-blue-50 border border-blue-200">
                        <div className="text-xs font-semibold text-blue-800">Быстро создать пустую презентацию</div>
                        <div className="flex gap-2">
                          <input value={quickPresTitle} onChange={e=>setQuickPresTitle(e.target.value)} placeholder="Название, напр. Ребусы — 5 класс" className="flex-1 px-3 py-2 rounded-xl border bg-white text-sm"/>
                          <button onClick={()=>handleQuickCreatePres(b.id)} className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">Создать и выбрать</button>
                        </div>
                        <Link to="/presentations/new" target="_blank" className="text-xs text-blue-600 underline">Открыть полный редактор →</Link>
                      </div>
                    )}
                    {!!b.data.presentation_id && !options.presentations.find((p:any)=>String(p.id)===String(b.data.presentation_id)) && (
                      optsLoading ? (
                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-xl">Загружаю список презентаций…</div>
                      ) : (
                        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-xl space-y-2">
                          <div>Презентация id {String(b.data.presentation_id)} недоступна (удалена или нет доступа).</div>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={()=>{updateBlock(b.id,{presentation_id:null}); setPresTabs(p=>({...p,[b.id]:'select'}))}} className="px-2.5 py-1 rounded-full bg-white border font-semibold">Выбрать другую</button>
                            <button onClick={()=>{setBlocks(bl=>bl.filter(x=>x.id!==b.id))}} className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 font-semibold">Удалить блок</button>
                            <button onClick={()=>refreshOptions()} className="underline">обновить список</button>
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
                {b.type==='test' && (
                  <div className="space-y-3">
                    {/* Выбран */}
                    {!!b.data.test_id && options.tests.find((t:any)=>String(t.id)===String(b.data.test_id)) && (
                      <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2.5 rounded-xl flex items-center justify-between gap-2">
                        <span>✓ Выбран тест: <b>{options.tests.find((t:any)=>String(t.id)===String(b.data.test_id))?.title}</b> ({options.tests.find((t:any)=>String(t.id)===String(b.data.test_id))?.questions_count ?? 0} вопр.)</span>
                        <span className="flex items-center gap-2 shrink-0">
                          <Link to={withFrom(`/tests/${b.data.test_id}/take`)} target="_blank" className="px-2.5 py-1 rounded-full bg-emerald-600 text-white font-semibold no-underline">Открыть ↗</Link>
                          <button onClick={()=>updateBlock(b.id,{test_id:null})} className="text-xs underline">Сменить</button>
                        </span>
                      </div>
                    )}
                    {!!b.data.test_id && !options.tests.find((t:any)=>String(t.id)===String(b.data.test_id)) && (
                      optsLoading ? (
                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-xl">Загружаю список тестов…</div>
                      ) : (
                        <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-xl space-y-2">
                          <div>Тест id {String(b.data.test_id)} недоступен (удалён или нет доступа).</div>
                          <div className="flex flex-wrap gap-2">
                            <button onClick={()=>updateBlock(b.id,{test_id:null})} className="px-2.5 py-1 rounded-full bg-white border font-semibold">Выбрать другой</button>
                            <button onClick={()=>{setBlocks(bl=>bl.filter(x=>x.id!==b.id))}} className="px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-600 font-semibold">Удалить блок</button>
                          </div>
                        </div>
                      )
                    )}
                    {errors.blocks?.[b.id] && <div className="text-xs text-red-600">⚠ {errors.blocks?.[b.id]}</div>}
                    {!testInlineOpen[b.id] ? (
                      <>
                        <select value={b.data.test_id||''} onChange={e=>{updateBlock(b.id,{test_id:e.target.value?Number(e.target.value):null}); if(errors.blocks?.[b.id]) setErrors(prev=>({...prev, blocks:{...prev.blocks!, [b.id]:''}}))}} className={`w-full px-3 py-2.5 rounded-xl border bg-slate-50 ${errors.blocks?.[b.id] ? 'border-red-300 bg-red-50' : ''}`}>
                          <option value="">— выбери готовый тест —</option>
                          {options.tests.map((t:any)=><option key={t.id} value={t.id}>{t.title} ({t.questions_count ?? t.questions?.length ?? 0} вопр.)</option>)}
                        </select>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={()=>{ setTestInlineOpen(p=>({...p,[b.id]:true})); setInlineTests(prev=>({...prev,[b.id]: getInlineTest(b.id)}))}} className="px-3 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold">✨ Создать тест прямо здесь</button>
                          <Link to="/tests/new" target="_blank" className="px-3 py-2 rounded-xl bg-white border text-sm">Открыть конструктор тестов →</Link>
                          <button onClick={()=>refreshOptions()} className="px-3 py-2 rounded-xl bg-slate-100 text-sm">↻ Обновить</button>
                        </div>
                        <div className="text-xs text-slate-500">После создания тест сразу появится в списке и урок останется — не нужно уходить со страницы. Остальные блоки урока никуда не денутся.</div>
                      </>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-50 border space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-bold">Новый тест для урока</div>
                          <button onClick={()=>setTestInlineOpen(p=>({...p,[b.id]:false}))} className="min-h-[44px] px-3 py-2 text-sm font-semibold rounded-full bg-white border active:bg-slate-100">✕ Свернуть</button>
                        </div>
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-2.5 space-y-2" data-testid="lb-ai">
                          <button onClick={()=>setLtAiOpen(p=>({...p,[b.id]:!p[b.id]}))}
                            className="px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold flex items-center gap-1.5" data-testid="lb-ai-btn">
                            ✨ Создать вопросы с ИИ {ltAiOpen[b.id] ? '▾' : '▸'}
                          </button>
                          {ltAiOpen[b.id] && (
                            <div className="space-y-2" data-testid="lb-ai-panel">
                              <textarea value={ltAiPrompt} onChange={e=>setLtAiPrompt(e.target.value)}
                                placeholder="Например: тест на тему «Атомы» для 6 класса, простые вопросы, по-русски"
                                className="w-full px-3 py-2 rounded-xl border bg-white text-sm min-h-[64px]" />
                              <div className="flex items-center gap-2">
                                <label className="text-xs text-slate-600">Вопросов:
                                  <input type="number" min={1} max={40} value={ltAiCount} onChange={e=>setLtAiCount(Math.max(1,Math.min(40,parseInt(e.target.value)||5)))} className="w-16 px-2 py-1 rounded border ml-1"/>
                                </label>
                                <button onClick={()=>ltAiGenerate(b.id)} disabled={ltAiBusy}
                                  className="ml-auto px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50" data-testid="lb-ai-gen">
                                  {ltAiBusy?'⏳ Думаю…':'Сгенерировать'}
                                </button>
                              </div>
                              {ltAiSrc && <div className={`text-[11px] font-bold px-2 py-1 rounded-lg w-fit ${ltAiSrc.startsWith('gemini') ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{ltAiSrc.startsWith('gemini') ? `🤖 ${ltAiSrc.split(':')[1] || 'Gemini'} отвечает` : '🧮 офлайн-генератор'}</div>}
                              <div className="text-[11px] text-slate-500">Вопросы добавятся в список ниже — проверь и поправь, потом сохрани тест.</div>
                            </div>
                          )}
                        </div>
                        <input value={getInlineTest(b.id).title} onChange={e=>setInlineTests(prev=>({...prev,[b.id]:{...getInlineTest(b.id), title:e.target.value}}))} placeholder="Название теста, напр. Ребусы — проверка" className="w-full px-3 py-2 rounded-xl border bg-white text-sm font-semibold"/>
                        <textarea value={getInlineTest(b.id).desc} onChange={e=>setInlineTests(prev=>({...prev,[b.id]:{...getInlineTest(b.id), desc:e.target.value}}))} placeholder="Описание (необязательно)" rows={2} className="w-full px-3 py-2 rounded-xl border bg-white text-sm"/>
                        <div className="flex items-center gap-2 text-xs">
                          <label>Проходной % <input type="number" value={getInlineTest(b.id).pass} onChange={e=>setInlineTests(prev=>({...prev,[b.id]:{...getInlineTest(b.id), pass: parseInt(e.target.value)||0}}))} className="w-16 px-2 py-1 rounded border ml-1"/></label>
                          <span className="text-slate-400">• урок не пропадёт, тест создастся отдельно</span>
                        </div>
                        <div className="space-y-3">
                          {getInlineTest(b.id).questions.map((q,qi)=>(
                            <div key={qi} className="p-3 rounded-xl bg-white border space-y-2">
                              <div className="flex gap-2">
                                <span className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold shrink-0">{qi+1}</span>
                                <textarea value={q.text} onChange={e=>setInlineTests(prev=>{
                                  const cur=getInlineTest(b.id); const qs=[...cur.questions]; qs[qi]={...qs[qi],text:e.target.value}; return {...prev,[b.id]:{...cur,questions:qs}}
                                })} placeholder={`Вопрос ${qi+1}`} className="flex-1 px-2 py-1.5 rounded border text-sm font-medium" rows={2}/>
                                <button onClick={()=>setInlineTests(prev=>{ const cur=getInlineTest(b.id); return {...prev,[b.id]:{...cur,questions:cur.questions.filter((_,i)=>i!==qi)}}})} className="p-1.5 text-red-500">🗑</button>
                              </div>
                              <div className="flex gap-2 text-xs">
                                <select value={q.type} onChange={e=>setInlineTests(prev=>{ const cur=getInlineTest(b.id); const qs=[...cur.questions]; qs[qi]={...qs[qi],type:e.target.value}; return {...prev,[b.id]:{...cur,questions:qs}}})} className="px-2 py-1 rounded border bg-slate-50">
                                  <option value="single">Один ответ</option><option value="multiple">Несколько</option><option value="true_false">Верно/Неверно</option>
                                </select>
                                <label className="flex items-center gap-1">Баллы <input type="number" value={q.points} onChange={e=>setInlineTests(prev=>{ const cur=getInlineTest(b.id); const qs=[...cur.questions]; qs[qi]={...qs[qi],points:parseInt(e.target.value)||1}; return {...prev,[b.id]:{...cur,questions:qs}}})} className="w-14 px-2 py-1 rounded border"/></label>
                              </div>
                              <div className="space-y-1">
                                {q.options.map((o,oi)=>(
                                  <div key={oi} className="flex items-center gap-2">
                                    <input type={q.type==='multiple'?'checkbox':'radio'} checked={o.is_correct} onChange={e=>setInlineTests(prev=>{
                                      const cur=getInlineTest(b.id); const qs=[...cur.questions];
                                      if(q.type==='single'){ qs[qi]={...qs[qi], options: qs[qi].options.map((op,idx)=>({...op,is_correct: idx===oi}))}
                                      } else { const opts=[...qs[qi].options]; opts[oi]={...opts[oi], is_correct:e.target.checked}; qs[qi]={...qs[qi], options:opts}}
                                      return {...prev,[b.id]:{...cur,questions:qs}}
                                    })} />
                                    <input value={o.text} onChange={e=>setInlineTests(prev=>{ const cur=getInlineTest(b.id); const qs=[...cur.questions]; const opts=[...qs[qi].options]; opts[oi]={...opts[oi], text:e.target.value}; qs[qi]={...qs[qi], options:opts}; return {...prev,[b.id]:{...cur,questions:qs}}})} className="flex-1 px-2 py-1.5 rounded border text-sm" placeholder={`Вариант ${oi+1}`}/>
                                    <button onClick={()=>setInlineTests(prev=>{ const cur=getInlineTest(b.id); const qs=[...cur.questions]; qs[qi]={...qs[qi], options: qs[qi].options.filter((_,i)=>i!==oi)}; return {...prev,[b.id]:{...cur,questions:qs}}})} className="text-xs">✕</button>
                                  </div>
                                ))}
                                <button onClick={()=>setInlineTests(prev=>{ const cur=getInlineTest(b.id); const qs=[...cur.questions]; qs[qi]={...qs[qi], options:[...qs[qi].options,{text:'Новый вариант',is_correct:false}]}; return {...prev,[b.id]:{...cur,questions:qs}}})} className="text-xs text-blue-600">+ Вариант</button>
                              </div>
                            </div>
                          ))}
                          <button onClick={()=>setInlineTests(prev=>{ const cur=getInlineTest(b.id); return {...prev,[b.id]:{...cur,questions:[...cur.questions,{text:'Новый вопрос',type:'single',points:1,options:[{text:'Вариант 1',is_correct:true},{text:'Вариант 2',is_correct:false}]}]}}})} className="w-full py-2 rounded-xl border-2 border-dashed text-sm font-medium">+ Добавить вопрос</button>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={async()=>{
                            const cur=getInlineTest(b.id)
                            if(!cur.title.trim()){ toast('Укажи название теста','error'); return}
                            if(!cur.questions.length || cur.questions.some(q=>!q.text.trim())){ toast('Заполни все вопросы','error'); return}
                            try{
                              const payload={title:cur.title.trim(),description:cur.desc.trim(),pass_score:cur.pass,time_limit:0,is_public:false,is_lesson_private:true,...(lessonLinkId?{lesson:Number(lessonLinkId)}:{}),questions:cur.questions.map((q,i)=>({...q,order:i,options:q.options.map((o,j)=>({...o,order:j}))}))}
                              const r=await client.post('/tests/',payload)
                              const newTest=r.data
                              setOptions((o:any)=>({...o, tests:[newTest,...(o.tests||[])]}))
                              updateBlock(b.id,{test_id:newTest.id})
                              setTestInlineOpen(p=>({...p,[b.id]:false}))
                              toast(`Тест "${newTest.title}" создан и выбран для урока ✓`,'success')
                            }catch(e:any){ toast(e?.response?.data?.detail||JSON.stringify(e?.response?.data)||'Ошибка создания теста','error')}
                          }} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-semibold text-sm">Создать тест и привязать к уроку</button>
                          <button onClick={()=>setTestInlineOpen(p=>({...p,[b.id]:false}))} className="px-4 py-2.5 rounded-xl bg-white border text-sm">Отмена</button>
                        </div>
                        <div className="text-xs text-slate-500">Важно: урок не пропадёт — после создания теста ты останешься в конструкторе урока, просто выбери предмет и нажми «Опубликовать урок».</div>
                      </div>
                    )}
                  </div>
                )}
                {b.type==='code' && (
                  <div className="space-y-2">
                    <select value={b.data.code_id||''} onChange={e=>{updateBlock(b.id,{code_id:e.target.value?Number(e.target.value):null}); if(errors.blocks?.[b.id]) setErrors(prev=>({...prev, blocks:{...prev.blocks!, [b.id]:''}}))}} className={`w-full px-3 py-2.5 rounded-xl border bg-slate-50 ${errors.blocks?.[b.id] ? 'border-red-300 bg-red-50' : ''}`}>
                      <option value="">Выбери задачу</option>
                      {options.codes.map((c:any)=><option key={c.id} value={c.id}>{c.title} ({c.language})</option>)}
                    </select>
                    {errors.blocks?.[b.id] && <div className="text-xs text-red-600">⚠ {errors.blocks?.[b.id]}</div>}
                  </div>
                )}
                {b.type==='board' && <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm flex items-center gap-2"><PenTool size={16}/> Личная доска 2D/3D — ученик откроет твою доску с фигурами (куб, сфера, орбита).</div>}
                {b.type==='video' && (
                  <div className="space-y-2">
                    <input value={b.data.url||''} onChange={e=>{
                      const raw=e.target.value
                      const emb=toEmbedUrl(raw)
                      // авто-конверт youtube watch → embed, иначе оставляем как есть
                      updateBlock(b.id,{url: raw.includes('youtu') ? emb : raw})
                      if(errors.blocks?.[b.id]) setErrors(prev=>({...prev, blocks:{...prev.blocks!, [b.id]:''}}))
                    }} placeholder="Вставь YouTube: https://www.youtube.com/watch?v=... или https://youtu.be/... — станет embed автоматом" className="w-full px-3 py-2.5 rounded-xl border bg-slate-50"/>
                    {b.data.url && toEmbedUrl(b.data.url).startsWith('https://www.youtube.com/embed/') && (
                      <div className="aspect-video rounded-xl overflow-hidden border">
                        <iframe src={toEmbedUrl(b.data.url)} className="w-full h-full" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" title="preview"/>
                      </div>
                    )}
                    {b.data.url && !toEmbedUrl(b.data.url).startsWith('https://www.youtube.com/embed/') && !b.data.url.startsWith('https://player.vimeo.com/') && (
                      <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-xl">Скопируй ссылку из браузера YouTube — она автоматически конвертируется в embed.</div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {blocks.length===0 && <div className="text-center py-8 bg-white rounded-2xl border text-slate-400">Добавь первый блок ↑</div>}
          </div>

          <div className="flex gap-3">
            <button onClick={handleCancel} type="button" className="flex-1 py-4 rounded-2xl bg-white border border-slate-300 text-slate-700 font-bold text-lg hover:bg-slate-50">Отмена</button>
            <button onClick={save} disabled={saving} className="flex-[2] py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"><Save size={20}/>{saving?'Сохранение...':(isNew?'Опубликовать урок':'Сохранить изменения')}</button>
          </div>
          <div className="text-center">
            <Link to="/lessons" className="text-sm text-slate-500 hover:text-blue-600">← К списку уроков</Link>
          </div>
        </>
      ) : (
        <div className="bg-white rounded-2xl border p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm text-slate-500"><BookOpen size={16}/> Предпросмотр как увидит ученик</div>
          <h1 className="text-2xl font-bold">{title||'Без названия'}</h1>
          <p className="text-slate-600">{desc||'Без описания'}</p>
          {selectedSubject && <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-white text-sm" style={{background:selectedSubject.color}}>{selectedSubject.icon} {selectedSubject.name}</span>}
          <div className="space-y-3 mt-6">
            {blocks.map((b,i)=>(
              <div key={b.id} className="p-4 rounded-xl border bg-slate-50">
                <div className="text-xs font-bold text-slate-400">БЛОК {i+1} • {b.type}</div>
                {renderPreviewBlock(b)}
              </div>
            ))}
          </div>
          <button onClick={()=>setPreview(false)} className="w-full mt-4 py-2.5 rounded-xl bg-blue-700 text-white font-semibold">Вернуться к редактору</button>
        </div>
      )}
    </div>
  )
}
