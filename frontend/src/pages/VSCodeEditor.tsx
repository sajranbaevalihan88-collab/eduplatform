import { useEffect, useState, useRef, useMemo } from 'react'
import Editor from '@monaco-editor/react'
import { Files, Search, Plus, Trash2, FileCode2, Cloud, HardDrive, LogIn, Save, Play, X, File, Command, Copy, RefreshCw, Download, Share2, Maximize2 } from 'lucide-react'
import client from '../api/client'
import { useRunSession } from '../hooks/useRunSession'
import { Link } from 'react-router-dom'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'

type VFile = { id:string, name:string, content:string, lang:string }

// Только 4 рабочих языка — python/javascript локально, html/css preview (офлайн-стабильно)
const LANGS = [
  { ext:'.py', lang:'python', label:'Python', icon:'🐍' },
  { ext:'.js', lang:'javascript', label:'JavaScript', icon:'JS' },
  { ext:'.html', lang:'html', label:'HTML', icon:'</>' },
  { ext:'.css', lang:'css', label:'CSS', icon:'#'},
]

const TEMPLATES: Record<string,string> = {
  python:'print("Hello EduPlatform AI!")\nfor i in range(3):\n    print(f"Строка {i+1}")\n',
  javascript:'console.log("Hello from JS")\nconst sum=(a,b)=>a+b\nconsole.log("2+3 =", sum(2,3))\n',
  html:'<!DOCTYPE html>\n<html><body style="font-family:sans-serif; padding:20px">\n<h1 style="color:#7c3aed">EduPlatform AI</h1>\n<p>HTML preview — без бэкенда</p>\n<button onclick="alert(\'Привет!\')">Кнопка</button>\n</body></html>',
  css:'body { background:#f0f4f8; font-family:sans-serif; }\nh1 { color:#7c3aed; }\n',
}

const DEFAULT_FILES: VFile[] = [
  { id:'1', name:'main.py', content:TEMPLATES.python, lang:'python' },
  { id:'2', name:'app.js', content:TEMPLATES.javascript, lang:'javascript' },
  { id:'3', name:'index.html', content:TEMPLATES.html, lang:'html' },
  { id:'4', name:'style.css', content:TEMPLATES.css, lang:'css' },
]

// Лимит файлов проекта — как у GitHub: не больше 100, у нас макс 99
const MAX_FILES = 99

function getLang(name:string){
  const lower=name.toLowerCase()
  for(const l of LANGS) if(lower.endsWith(l.ext)) return l.lang
  return 'plaintext'
}
function getLabel(lang:string){ return LANGS.find(l=>l.lang===lang)?.label || lang }
function FileIcon({name}:{name:string}){
  const lang=getLang(name)
  if(lang==='python') return <span className="text-[11px]">🐍</span>
  if(lang==='javascript') return <span className="text-[10px] font-bold text-yellow-300">JS</span>
  if(lang==='html') return <span className="text-[11px] text-orange-400">{"</>"}</span>
  if(lang==='css') return <span className="text-[11px] text-blue-400">#</span>
  return <File size={12} className="text-slate-500"/>
}

export default function VSCodeEditor(){
  const {t}=useLang()
  const [files,setFiles]=useState<VFile[]>(()=>{
    try{
      const raw=localStorage.getItem('vscode-files')
      if(raw){
        const p=JSON.parse(raw)
        if(Array.isArray(p) && p.length){
          // дедупликация и починка пустых
          const seen=new Set<string>()
          const fixed=p.map((f:any)=>{
            let name=f.name||'untitled.txt'
            let base=name
            let n=1
            while(seen.has(name)){ const ext=name.includes('.')? name.slice(name.lastIndexOf('.')):''; const stem=base.slice(0, base.length-ext.length); name=`${stem}_${n}${ext}`; n++ }
            seen.add(name)
            let content=f.content
            if(!content || !content.trim()){
              const d=DEFAULT_FILES.find(d=>d.name===name)
              content=d?d.content:(getLang(name)==='python'?'print("hello")':getLang(name)==='html'?'<!DOCTYPE html><p>new</p>':'console.log("hi")')
            }
            return {id:String(f.id||Date.now()+Math.random()), name, content, lang:getLang(name)}
          })
          if(fixed.length) return fixed
        }
      }
    }catch{}
    return DEFAULT_FILES
  })
  const [activeId,setActiveId]=useState<string>(files[0]?.id||'1')
  const active = useMemo(()=> files.find(f=>f.id===activeId) || files[0], [files, activeId])
  const [output,setOutput]=useState('')
  const [running,setRunning]=useState(false)
  const [explanation,setExplanation]=useState<any>(null)
  const [explaining,setExplaining]=useState(false)
  const [useLive,setUseLive]=useState(false)
  const [liveInput,setLiveInput]=useState('')
  const live=useRunSession()
  useEffect(()=>{ if(useLive) setOutput(live.output) },[useLive, live.output])
  // Фолбэк: если live-сессия (ws/run) недоступна — сервер без daphne отвечает 404
  // и сокет сразу закрывается. Тогда молча переключаемся на обычный HTTP-запуск.
  const fbRef=useRef(false)
  useEffect(()=>{
    if(useLive && fbRef.current && live.state==='error' && !live.output.trim()){
      fbRef.current=false
      setUseLive(false); live.close()
      runBatch()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[useLive, live.state, live.output])
  const [editorTheme,setEditorTheme]=useState<'vs-dark'|'light'>('vs-dark')
  const [fontSize,setFontSize]=useState(13)
  const [isFull,setIsFull]=useState(false)
  const [showShare,setShowShare]=useState(false)
  const [shareDays,setShareDays]=useState(30)
  const [shareUrl,setShareUrl]=useState('')
  const [sharing,setSharing]=useState(false)
  const shareFiles=async()=>{
    if(!isAuth){ toast(t('vsc_share_need_auth'),'error'); return }
    setSharing(true)
    try{
      const r=await client.post('/shared/',{title:active.name, files:files.map(f=>({name:f.name, content:f.content})), days:shareDays})
      const url=`${window.location.origin}/s/${r.data.token}`
      setShareUrl(url)
      try{ await navigator.clipboard.writeText(url); toast(t('shared_copied'),'success') }catch{}
    }catch(e:any){ toast(e.response?.data?.error||t('vsc_share_fail'),'error') }
    setSharing(false)
  }
  const explainCode=async()=>{
    if(!active || !output) return
    if(active.lang!=='python' && active.lang!=='javascript') return
    setExplaining(true)
    try{
      const r=await client.post('/code-tasks/explain/',{code:active.content, language:active.lang, output})
      setExplanation(r.data)
    }catch(e:any){
      setExplanation({title:t('codelab_explain_fail'), what:String(e.response?.data?.error||e.message||e), fix:''})
    }
    setExplaining(false)
  }
  const [saving,setSaving]=useState(false)
  const [isAuth,setIsAuth]=useState(()=>!!localStorage.getItem('token'))
  const [newName,setNewName]=useState('')
  const [showNew,setShowNew]=useState(false)
  const [showCmd,setShowCmd]=useState(false)
  const [search,setSearch]=useState('')
  const [searchContent,setSearchContent]=useState('')
  const [activeView,setActiveView]=useState<'explorer'|'search'>('explorer')
  const [filesOpen,setFilesOpen]=useState(false)
  const [showOutput,setShowOutput]=useState(false)
  const [panelHeight,setPanelHeight]=useState(200)
  const dragRef=useRef<{startY:number, startH:number}|null>(null)
  const [stdinInput,setStdinInput]=useState('')
  const [entry,setEntry]=useState<string>('')
  const [requirements,setRequirements]=useState('')
  const [projectMode,setProjectMode]=useState(false)
  const iframeRef=useRef<HTMLIFrameElement>(null)
  const [mobPrev, setMobPrev] = useState(false)
  const editorRef=useRef<any>(null)
  const runRef=useRef<()=>void>(()=>{})
  const [cursor,setCursor]=useState({line:1, col:1})

  useEffect(()=>{
    const onAuth=()=> setIsAuth(!!localStorage.getItem('token'))
    window.addEventListener('storage',onAuth)
    window.addEventListener('auth-change',onAuth as any)
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==='Escape' && isFull){ setIsFull(false); return }
      if((e.ctrlKey||e.metaKey)&& e.key.toLowerCase()==='p' && !e.shiftKey){ e.preventDefault(); setShowCmd(v=>!v) }
      if((e.ctrlKey||e.metaKey)&& e.key.toLowerCase()==='k'){ e.preventDefault(); setShowCmd(true) }
      if((e.ctrlKey||e.metaKey)&& e.key.toLowerCase()==='s'){ e.preventDefault(); handleSave() }
      if((e.ctrlKey||e.metaKey)&& e.key==='Enter'){ e.preventDefault(); runRef.current() }
    }
    window.addEventListener('keydown',onKey)
    return()=>{window.removeEventListener('storage',onAuth); window.removeEventListener('auth-change',onAuth as any); window.removeEventListener('keydown',onKey)}
  },[active, isFull])

  useEffect(()=>{
    try{ localStorage.setItem('vscode-files', JSON.stringify(files)) }
    catch{ /* переполнение localStorage при ~99 больших файлах — работаем без автосейва */ }
  },[files])
  useEffect(()=>{ if(!entry || !files.find(f=>f.name===entry)) setEntry(active.name) },[active.name, files])
  useEffect(()=>{
    if(active.lang==='html' && iframeRef.current){
      iframeRef.current.srcdoc = active.content
    }
  },[active.content, active.lang, activeId])

  useEffect(()=>{
    const onMove=(e:MouseEvent)=>{
      if(!dragRef.current) return
      const dy = dragRef.current.startY - e.clientY
      const nh = Math.min(window.innerHeight*0.7, Math.max(90, dragRef.current.startH + dy))
      setPanelHeight(nh)
    }
    const onUp=()=>{ dragRef.current=null; document.body.style.cursor=''; document.body.style.userSelect='' }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return()=>{ window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  },[])

  const updateContent=(v:string)=> setFiles(fs=> fs.map(f=> f.id===activeId? {...f, content:v}:f))

  const handleNew=()=>{
    if(files.length>=MAX_FILES){ toast(`${t('vsc_limit_a')}${MAX_FILES}${t('vsc_limit_gh')}`,'error'); return }
    let n=newName.trim(); if(!n) return
    if(!n.includes('.')) n+='.js'
    if(files.some(f=>f.name===n)){ const ext=n.includes('.')? n.slice(n.lastIndexOf('.')):''; const stem=n.slice(0, n.length-ext.length); n=`${stem}_${Date.now().toString().slice(-3)}${ext}`; }
    const lang=getLang(n)
    const c= TEMPLATES[lang] || `// ${getLabel(lang)} — новый файл\n`
    const f: VFile={ id:Date.now().toString(), name:n, content:c, lang }
    setFiles([...files,f]); setActiveId(f.id); setNewName(''); setShowNew(false)
    toast(`${t('vsc_file_a')}${n}${t('vsc_file_created_b')}(${getLabel(lang)})`, 'success')
  }
  const handleDelete=(id:string)=>{
    if(files.length===1){ toast(t('vsc_last_file'),'error'); return }
    const nf=files.filter(f=>f.id!==id); setFiles(nf); if(activeId===id) setActiveId(nf[0].id)
    toast(t('vsc_file_deleted'),'info')
  }
  const handleDuplicate=(id:string)=>{
    if(files.length>=MAX_FILES){ toast(`${t('vsc_limit_a')}${MAX_FILES}${t('vsc_limit_b')}`,'error'); return }
    const src=files.find(f=>f.id===id); if(!src) return
    const ext=src.name.includes('.')? src.name.slice(src.name.lastIndexOf('.')):''
    const stem=src.name.slice(0, src.name.length-ext.length)
    const f={...src, id:Date.now().toString(), name: `${stem}_copy${ext}`}
    setFiles([...files,f]); setActiveId(f.id)
    toast(t('vsc_duplicated'),'success')
  }
  const handleRename=(id:string)=>{
    const cur=files.find(f=>f.id===id); if(!cur) return
    const nm=prompt(t('vsc_new_name'), cur.name); if(!nm || nm===cur.name) return
    if(files.some(f=>f.name===nm && f.id!==id)){ toast(t('vsc_name_taken'),'error'); return }
    setFiles(files.map(f=> f.id===id? {...f, name:nm.trim(), lang:getLang(nm.trim())}:f))
    toast(t('vsc_renamed'),'success')
  }

  const handleSave=async()=>{
    try{ localStorage.setItem('vscode-files', JSON.stringify(files)) }
    catch{ toast(t('vsc_ls_full'),'error') }
    if(!isAuth){ setOutput(t('vsc_saved_local')); toast(t('vsc_saved_local_t'),'success'); return }
    setSaving(true)
    try{
      await client.post('/code-tasks/',{ title:active.name, language: active.lang, description:'VS Code', starter_code: active.content })
      setOutput(t('vsc_saved_cloud'))
      toast(t('vsc_saved_cloud_t'),'success')
    }catch(e:any){ setOutput(t('vsc_error_a')+(e.response?.data?.detail||e.message)); toast(t('vsc_save_err'),'error') }
    setSaving(false)
  }

  const runProject=async(entryOverride?:string)=>{
    if(files.length===0) return
    const usedEntry = entryOverride || entry || active.name
    setUseLive(false); live.close()
    setShowOutput(true)
    setRunning(true); setOutput(`${t('vsc_run_project_a')}${files.length}${t('vsc_run_project_b')}${usedEntry}${t('vsc_run_project_c')}`)
    try{
      const payload:any={
        files: files.map(f=>({path:f.name, content:f.content})),
        entry: usedEntry,
        requirements: requirements,
        input: stdinInput
      }
      const r=await client.post('/code-tasks/run_project/', payload)
      const out = (r.data.output||'').trim() ? r.data.output : t('vsc_empty_out')
      setOutput('▶ '+usedEntry+'\n'+out)
      if(r.data.passed) toast(t('vsc_proj_done'),'success')
      else toast(t('vsc_proj_err'),'error')
    }catch(e:any){ const m=e.response?.data?.output || e.response?.data?.error || e.response?.data?.detail || e.message; setOutput('▶ '+usedEntry+'\n'+m); toast(m,'error') }
    setRunning(false)
  }

  const run=async()=>{
    if(!active) return
    // Проект целиком — только если включён режим Проект или это Flask/django/pygame.
    // Иначе запускаем АКТИВНЫЙ файл напрямую (как online-python): быстро и предсказуемо.
    const needProject = projectMode || requirements.trim() ||
      active.content.includes('Flask(') || active.content.includes('import django') || active.content.includes('import pygame') ||
      files.some(f=> f.name==='manage.py');
    if(needProject){
      return runProject(projectMode ? undefined : active.name)
    }
    // Живая сессия (интерактивный ввод) для python/javascript, иначе пакетный запуск
    if(active.lang==='python' || active.lang==='javascript'){
      setUseLive(true); setShowOutput(true); setExplanation(null)
      setOutput('▶ '+active.name+'\n'+t('vsc_connecting'))
      fbRef.current=true
      const ok=live.start(active.lang, active.content, (p)=>{
        fbRef.current=false
        if(active.lang==='python'||active.lang==='javascript'){
          p ? toast(active.lang==='python'?t('vsc_py_done'):t('vsc_js_done'),'success') : toast(t('vsc_has_errors'),'error')
        }
      })
      if(!ok){ fbRef.current=false; setUseLive(false); return runBatch() }
      return
    }
    setUseLive(false)
    return runBatch()
  }

  const runBatch=async()=>{
    if(!active) return
    setShowOutput(true)
    setRunning(true); setOutput(''); setExplanation(null)
    const code=active.content
    if(!code.trim()){ setOutput(t('vsc_empty_file')); setRunning(false); return }
    if(code.length>8000){ setOutput(t('vsc_too_long')); setRunning(false); return }
    const withFile=(out:string)=> '▶ '+active.name+'\n'+((out||'').trim()?out:t('vsc_empty_out'))
    try{
      if(active.lang==='html'){
        if(iframeRef.current) iframeRef.current.srcdoc=code
        if(window.innerWidth < 1024) setMobPrev(true)
        setOutput('▶ '+active.name+'\n'+t('vsc_html_preview'))
        toast(t('vsc_preview_upd'),'success')
      } else if(active.lang==='css'){
        setOutput(withFile(t('vsc_css_preview')+code.slice(0,1000)))
        toast(t('vsc_css_ok'),'info')
      } else if(active.lang==='javascript'){
        // Безопасно: JS всегда через бэкенд-раннер, без new Function в origin страницы
        // (new Function давал коду доступ к localStorage с JWT).
        try{
          const r=await client.post('/code-tasks/run_code/',{code, language:'javascript'})
          const out=r.data.output
          setOutput(withFile(out)); toast(r.data.passed?t('vsc_js_done'):t('vsc_js_err'), r.data.passed?'success':'error')
        } catch(e:any){
          const m=e.response?.data?.output || e.response?.data?.detail || e.message
          setOutput(withFile(m)); toast(m,'error')
        }
      } else if(active.lang==='python'){
        const payload:any={code, language:'python'}
        if(code.includes('input(')) payload.input=stdinInput
        const r=await client.post('/code-tasks/run_code/',payload)
        setOutput(withFile(r.data.output))
        if(r.data.passed) toast(t('vsc_py_done'),'success')
        else toast(t('vsc_py_err'),'error')
      } else {
        setOutput(withFile(`${t('vsc_unknown_type_a')}${active.name}${t('vsc_unknown_type_b')}`))
        toast(t('vsc_unknown_type'),'error')
      }
    } catch(e:any){ const m=e.response?.data?.output || e.response?.data?.detail || e.message; setOutput(withFile(m)); toast(m,'error') }
    setRunning(false)
  }
  runRef.current = run

  const downloadFile=()=>{
    if(!active) return
    const blob=new Blob([active.content],{type:'text/plain;charset=utf-8'})
    const a=document.createElement('a')
    a.href=URL.createObjectURL(blob); a.download=active.name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000)
    toast(`${t('vsc_file_a')}${active.name}${t('vsc_downloaded')}`,'success')
  }

  const filtered = files.filter(f=>{
    if(!search && !searchContent) return true
    const byName = !search || f.name.toLowerCase().includes(search.toLowerCase())
    const byContent = !searchContent || f.content.toLowerCase().includes(searchContent.toLowerCase())
    return byName && byContent
  })

  const resetFiles=()=>{
    if(confirm(t('vsc_reset_confirm'))){
      localStorage.removeItem('vscode-files')
      setFiles(DEFAULT_FILES); setActiveId(DEFAULT_FILES[0].id)
      toast(t('vsc_reset_done'),'success')
    }
  }

  return (
    <div className={isFull ? 'fixed inset-0 z-50 flex flex-col bg-[#1e1e1e] border border-[#2d2d2d] overflow-hidden text-sm' : '-m-4 lg:-m-8 flex flex-col h-[calc(100vh-64px)] bg-[#1e1e1e] border border-[#2d2d2d] overflow-hidden text-sm'}>
      {/* Title bar */}
      <div className="h-7 bg-[#181818] flex items-center px-2 gap-2 text-xs border-b border-[#2d2d2d] shrink-0">
        <div className="flex gap-1.5 mr-1"><span className="w-3 h-3 rounded-full bg-[#ff5f56]"/><span className="w-3 h-3 rounded-full bg-[#ffbd2e]"/><span className="w-3 h-3 rounded-full bg-[#27c93f]"/></div>
        <FileCode2 size={12} className="text-[#007acc] hidden sm:block"/> <span className="text-slate-300 hidden md:inline truncate">EduPlatform AI — VS Code • {active.name}</span>
        {isFull && <button onClick={()=>setIsFull(false)} className="px-3 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 shrink-0"><X size={11}/> {t('vsc_exit_esc')}</button>}
        <button onClick={()=>setShowCmd(v=>!v)} className="mx-auto hidden md:flex items-center gap-1.5 bg-[#252526] hover:bg-[#2a2d2e] border border-[#3c3c3c] rounded px-3 py-0.5 text-slate-400 text-xs">
          <Command size={10}/> {t('vsc_cmd')}
        </button>
        <span className={`hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-xs ${isAuth?'bg-[#16825d] text-white':'bg-[#3c3c3c] text-slate-300'}`}>{isAuth?<><Cloud size={10}/> {t('vsc_cloud')}</>:<><HardDrive size={10}/> {t('vsc_guest')}</>}</span>
        {!isAuth && <Link to="/login" className="px-2 py-0.5 rounded bg-[#007acc] text-white text-xs flex items-center gap-1"><LogIn size={10}/> {t('login')}</Link>}
      </div>

      <div className="relative flex flex-1 min-h-0">
        {filesOpen && <div className="fixed inset-0 bg-black/40 z-20 md:hidden" onClick={()=>setFilesOpen(false)} />}
        {/* Activity Bar — только рабочие панели */}
        <div className="w-12 bg-[#333333] flex flex-col items-center py-1 gap-0.5 border-r border-[#2d2d2d] shrink-0 hidden sm:flex">
          <button title="Explorer (Ctrl+Shift+E)" onClick={()=>setActiveView('explorer')} className={`w-12 h-12 flex items-center justify-center border-l-2 ${activeView==='explorer'?'border-[#007acc] text-white bg-[#252526]':'border-transparent text-slate-500 hover:text-white'}`}><Files size={18}/></button>
          <button title="Search (Ctrl+Shift+F)" onClick={()=>setActiveView('search')} className={`w-12 h-12 flex items-center justify-center border-l-2 ${activeView==='search'?'border-[#007acc] text-white bg-[#252526]':'border-transparent text-slate-500 hover:text-white'}`}><Search size={18}/></button>
        </div>

        {/* Sidebar — меняется по activeView */}
        <div className={`w-[240px] bg-[#252526] flex-col border-r border-[#2d2d2d] shrink-0 ${filesOpen?'absolute inset-y-0 left-0 z-30 flex shadow-2xl':'hidden md:flex'}`}>
          {activeView==='explorer' && (
            <>
              <div className="h-8 flex items-center justify-between px-3 text-[11px] font-bold tracking-widest text-slate-400">
                <span>EXPLORER</span>
                <div className="flex gap-1">
                  <button onClick={()=>{ if(files.length>=MAX_FILES){ toast(`${t('vsc_limit_a')}${MAX_FILES}${t('vsc_limit_b')}`,'error'); return } setShowNew(v=>!v) }} className="p-1 hover:bg-[#2a2d2e] rounded text-slate-400 hover:text-white" title={files.length>=MAX_FILES?`${t('vsc_limit_a')}${MAX_FILES}${t('vsc_files_unit')}`:'New File'}><Plus size={12}/></button>
                  <button onClick={resetFiles} className="p-1 hover:bg-[#2a2d2e] rounded text-slate-400 hover:text-white" title="Reset"><RefreshCw size={12}/></button>
                </div>
              </div>
              <div className="px-2 pb-1">
                <div className="relative">
                  <Search size={12} className="absolute left-2 top-2 text-slate-500"/>
                  <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('vsc_search_files')} className="w-full pl-7 pr-2 py-1 rounded bg-[#3c3c3c] border border-transparent focus:border-[#007acc] text-xs text-white placeholder:text-slate-500 outline-none"/>
                </div>
              </div>
              <div className="px-2 py-1 text-xs font-bold text-slate-300 flex items-center gap-1">
                <span className="text-slate-500 text-[10px]">▾</span> EDUPATFORM
                <span className={`ml-auto text-[10px] font-mono ${files.length>=MAX_FILES?'text-red-400':'text-slate-500'}`}>{files.length}/{MAX_FILES}</span>
              </div>
              {showNew && (
                <div className="px-2 py-1 space-y-1">
                  <div className="flex gap-1">
                    <input autoFocus value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=> e.key==='Enter' && handleNew()} placeholder="main.py, app.js, index.html, style.css" className="flex-1 px-2 py-1 rounded bg-[#3c3c3c] border border-[#007acc] text-xs text-white outline-none"/>
                    <button onClick={handleNew} className="px-2 rounded bg-[#007acc] text-white text-xs">+</button>
                    <button onClick={()=>setShowNew(false)} className="p-1 text-slate-400"><X size={10}/></button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {LANGS.slice(0,8).map(l=>(
                      <button key={l.ext} onClick={()=>setNewName('main'+l.ext)} className="px-1.5 py-0.5 rounded bg-[#3c3c3c] text-[10px] text-slate-300 hover:bg-[#007acc] hover:text-white">{l.ext}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex-1 overflow-auto">
                {filtered.map(f=>(
                  <div key={f.id} onClick={()=>setActiveId(f.id)} onDoubleClick={()=>handleRename(f.id)} className={`group flex items-center gap-2 px-2 py-1 text-xs cursor-pointer border-l-2 h-6 ${activeId===f.id?'bg-[#37373d] border-[#007acc] text-white':'border-transparent text-slate-400 hover:bg-[#2a2d2e] hover:text-white'}`}>
                    <FileIcon name={f.name}/>
                    <span className="flex-1 truncate font-mono text-xs">{f.name}</span>
                    <button onClick={(e)=>{e.stopPropagation(); handleDuplicate(f.id)}} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded" title="Duplicate"><Copy size={10}/></button>
                    <button onClick={(e)=>{e.stopPropagation(); handleRename(f.id)}} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded text-[10px]" title="Rename">✎</button>
                    <button onClick={(e)=>{e.stopPropagation(); handleDelete(f.id)}} className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-white/10 rounded" title="Delete"><Trash2 size={10} className="text-slate-400 hover:text-red-400"/></button>
                  </div>
                ))}
                {filtered.length===0 && <div className="px-3 py-4 text-xs text-slate-500 text-center">{t('vsc_no_files')}</div>}
              </div>
              <div className="p-2 border-t border-[#2d2d2d] bg-[#181818] text-[11px]">
                <div className="text-slate-400 flex items-center gap-1"><File size={10}/> {files.length}/{MAX_FILES} {t('vsc_files_compact')}</div>
                <div className="text-slate-500">{isAuth?t('vsc_cloud_ok'):t('vsc_guest_ls')}{t('vsc_max_a')}{MAX_FILES}{t('vsc_max_b')}</div>
              </div>
            </>
          )}
          {activeView==='search' && (
            <div className="flex flex-col h-full">
              <div className="h-8 flex items-center px-3 text-[11px] font-bold tracking-widest text-slate-400">SEARCH</div>
              <div className="px-2 space-y-2">
                <input value={searchContent} onChange={e=>setSearchContent(e.target.value)} placeholder={t('vsc_search_in_files')} className="w-full px-2 py-1 rounded bg-[#3c3c3c] border border-transparent focus:border-[#007acc] text-xs text-white outline-none"/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('vsc_file_name_ph')} className="w-full px-2 py-1 rounded bg-[#3c3c3c] border border-transparent focus:border-[#007acc] text-xs text-white outline-none"/>
              </div>
              <div className="flex-1 overflow-auto mt-2 px-2">
                {filtered.map(f=>(
                  <button key={f.id} onClick={()=>setActiveId(f.id)} className="w-full text-left px-2 py-1 rounded text-xs hover:bg-[#2a2d2e] text-slate-300">
                    <div className="font-mono flex items-center gap-1"><FileIcon name={f.name}/>{f.name}</div>
                    {searchContent && <div className="text-[11px] text-slate-500 truncate">{f.content.slice(0,60)}</div>}
                  </button>
                ))}
              </div>
              <div className="p-2 text-[11px] text-slate-500">{filtered.length} {t('vsc_matches')}</div>
            </div>
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
          <div className="h-8 bg-[#252526] flex items-stretch border-b border-[#2d2d2d] shrink-0">
            <div className="flex-1 flex items-center min-w-0 overflow-x-auto">
            {files.map(f=>(
              <div key={f.id} onClick={()=>setActiveId(f.id)} className={`h-full flex items-center gap-1.5 px-2 border-r border-[#2d2d2d] cursor-pointer text-xs whitespace-nowrap shrink-0 ${activeId===f.id?'bg-[#1e1e1e] text-white':'bg-[#2d2d2d] text-slate-500 hover:text-white'}`}>
                <FileIcon name={f.name}/>
                <span className="font-mono text-xs">{f.name}</span>
                <button onClick={(e)=>{e.stopPropagation(); handleDelete(f.id)}} className="ml-1 p-0.5 rounded hover:bg-white/10"><X size={10}/></button>
              </div>
            ))}
            </div>
            <div className="ml-auto flex items-center gap-1 px-1.5 shrink-0 py-0.5">
              <button onClick={()=>setFontSize(f=>Math.max(10,f-1))} className="h-9 w-9 sm:h-6 sm:w-auto sm:px-1.5 rounded text-slate-400 hover:text-white text-xs flex items-center justify-center" title={t('vsc_font_down')}>A-</button>
              <button onClick={()=>setFontSize(f=>Math.min(24,f+1))} className="h-9 w-9 sm:h-6 sm:w-auto sm:px-1.5 rounded text-slate-400 hover:text-white text-xs flex items-center justify-center" title={t('vsc_font_up')}>A+</button>
              <button onClick={()=>setEditorTheme(t=>t==='vs-dark'?'light':'vs-dark')} className="h-9 w-9 sm:h-6 sm:w-auto sm:px-1.5 rounded text-slate-400 hover:text-white text-xs flex items-center justify-center" title={t('vsc_theme')}>{editorTheme==='vs-dark'?'☀':'🌙'}</button>
              {active.lang==='html' && (
                <button onClick={()=>setMobPrev(v=>!v)} className="h-9 px-2 lg:h-6 lg:px-1.5 rounded text-xs flex items-center justify-center gap-1 font-bold shrink-0 bg-[#007acc] text-white" title={t('vsc_prev_title')}>
                  {mobPrev ? `◂ ${t('vsc_code')}` : `${t('vsc_preview')} ▸`}
                </button>
              )}
              <span className="w-px h-4 bg-[#3c3c3c] mx-0.5 hidden sm:block"/>
              <button onClick={downloadFile} className="h-9 w-9 sm:h-6 sm:w-auto sm:px-2 rounded hover:bg-white/10 text-slate-300 text-xs hidden sm:flex items-center justify-center gap-1" title={t('vsc_download_title')}><Download size={11}/><span className="hidden lg:inline">{t('vsc_download')}</span></button>
              <button onClick={()=>{setShareUrl(''); setShowShare(v=>!v)}} className="h-9 w-9 sm:h-6 sm:w-auto sm:px-2 rounded hover:bg-white/10 text-slate-300 text-xs hidden sm:flex items-center justify-center gap-1" title={t('vsc_share_title')}><Share2 size={11}/><span className="hidden lg:inline">{t('vsc_share')}</span></button>
              <button onClick={()=>setIsFull(v=>!v)} className="h-9 w-9 sm:h-6 sm:w-auto sm:px-2 rounded hover:bg-white/10 text-slate-300 text-xs flex items-center justify-center gap-1" title={isFull?t('vsc_exit_full'):t('vsc_fullscreen')}><Maximize2 size={11}/><span className="hidden xl:inline">{isFull?t('vsc_min'):t('vsc_maximize')}</span></button>
              <button onClick={()=>setFilesOpen(v=>!v)} className="h-9 w-9 rounded hover:bg-white/10 text-slate-300 text-xs md:hidden flex items-center justify-center" title="Файлы"><Files size={13}/></button>
              <button onClick={handleSave} disabled={saving} className="h-9 sm:h-6 px-2.5 rounded bg-[#0e639c] hover:bg-[#1177bb] text-white text-xs flex items-center gap-1"><Save size={10}/><span className="hidden sm:inline">{saving?'..':'Save'}</span></button>
              <button onClick={run} disabled={running} title={t('vsc_run_title')} className="h-9 sm:h-7 px-3 sm:px-4 rounded-lg bg-[#16825d] hover:bg-[#1a9c6e] text-white text-sm font-bold flex items-center gap-1.5 shadow"><Play size={12}/>{running?'...':'Run ▶'}</button>
            </div>
          </div>
          <div className="h-5 bg-[#1e1e1e] flex items-center px-2 text-xs text-slate-500 border-b border-[#2d2d2d]/40 shrink-0">
            <span className="text-slate-500">EDUPLATFORM</span> <span className="mx-1 text-slate-600">›</span> <span className="text-slate-300 font-mono text-xs">{active.name}</span> <span className="ml-auto hidden sm:inline text-slate-600">{active.lang} • Tab:2 • {active.content.split('\n').length} {t('vsc_lines')}</span>
          </div>
          {/* Проект-бар для мини-проектов (django/pygame) — компакт, на телефоне в 2 ряда */}
          <div className="min-h-[2rem] bg-[#252526] flex flex-wrap items-center gap-1.5 px-2 py-1 text-xs border-b border-[#2d2d2d] shrink-0">
            <label className="flex items-center gap-1 text-slate-400 cursor-pointer"><input type="checkbox" checked={projectMode} onChange={e=>setProjectMode(e.target.checked)} className="w-3 h-3"/> {t('vsc_project')}</label>
            <select value={entry} onChange={e=>setEntry(e.target.value)} className="bg-[#3c3c3c] border border-transparent focus:border-[#007acc] text-white text-xs rounded px-1 py-0.5 max-w-[120px]">
              {files.map(f=> <option key={f.id} value={f.name}>{f.name}</option>)}
            </select>
            <input value={requirements} onChange={e=>setRequirements(e.target.value)} placeholder="requirements: django pygame" className="flex-1 min-w-0 bg-[#3c3c3c] border border-transparent focus:border-[#007acc] text-white text-xs rounded px-2 py-0.5 hidden sm:block" title={t('vsc_req_hint')}/>
            <button onClick={()=>runProject()} disabled={running} className="px-2 py-0.5 rounded bg-[#16825d] hover:bg-[#1a9c6e] text-white text-xs flex items-center gap-1 shrink-0"><Play size={10}/> Run Project</button>
          </div>
          <div className="flex-1 min-h-0 relative flex">
            <div className={mobPrev ? 'hidden' : 'flex-1 min-w-0 relative'}>
            <Editor
              height="100%"
              path={active.id+'/'+active.name}
              language={active.lang==='python'?'python': active.lang==='html'?'html': active.lang==='css'?'css':'javascript'}
              value={active.content}
              onChange={v=>updateContent(v||'')}
              theme={editorTheme}
              onMount={e=>{
                editorRef.current=e
                try{
                  e.onDidChangeCursorPosition((ev:any)=> setCursor({line: ev.position.lineNumber, col: ev.position.column}))
                  const pos=e.getPosition(); if(pos) setCursor({line:pos.lineNumber, col:pos.column})
                }catch{}
              }}
              options={{
                minimap:{enabled:true, scale:0.7},
                fontSize:fontSize,
                lineHeight:Math.round(fontSize*1.4),
                fontFamily:"'Cascadia Code','JetBrains Mono','Consolas',monospace",
                scrollBeyondLastLine:false,
                automaticLayout:true,
                wordWrap:'on',
                padding:{top:8, bottom:8},
                cursorBlinking:'smooth',
                smoothScrolling:true,
                bracketPairColorization:{enabled:true},
                guides:{bracketPairs:true, indentation:true},
                quickSuggestions:{other:true, comments:false, strings:false},
                suggestOnTriggerCharacters:true,
                tabSize:2,
                formatOnType:true,
                formatOnPaste:true,
                folding:true,
                lineNumbers:'on',
                renderLineHighlight:'line',
                occurrencesHighlight:'off',
              }}
              loading={<div className="flex items-center justify-center h-full bg-[#1e1e1e] text-slate-500 text-xs">{t('vsc_monaco_loading')}</div>}
            />
            </div>
            {active.lang==='html' && (
              <div className={`${mobPrev?'flex':'hidden lg:flex'} w-full lg:w-1/2 border-l border-[#2d2d2d] bg-white flex-col shrink-0`}>
                <div className="px-2 py-1 bg-[#f3f3f3] border-b text-xs font-semibold text-slate-600 flex items-center justify-between shrink-0">
                  <span>Preview — live</span>
                  <div className="flex gap-1">
                    <button onClick={()=>{ if(iframeRef.current) iframeRef.current.srcdoc=active.content }} className="px-2 py-0.5 rounded bg-[#007acc] text-white text-xs">{t('vsc_refresh')}</button>
                  </div>
                </div>
                <iframe ref={iframeRef} srcDoc={active.content} className="flex-1 w-full border-0" sandbox="allow-scripts allow-modals allow-forms" allow="fullscreen"/>
              </div>
            )}
            {showCmd && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-10 z-20" onClick={()=>setShowCmd(false)}>
                <div onClick={e=>e.stopPropagation()} className="w-[600px] max-w-[90%] bg-[#252526] rounded-lg border border-[#3c3c3c] shadow-2xl overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-[#3c3c3c]">
                    <Search size={14} className="text-slate-500"/>
                    <input autoFocus placeholder={t('vsc_cmd_ph')} className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-slate-500"/>
                    <button onClick={()=>setShowCmd(false)} className="p-1 text-slate-500"><X size={14}/></button>
                  </div>
                  <div className="p-2 space-y-0.5 max-h-[300px] overflow-auto">
                    {files.map(f=>(
                      <button key={f.id} onClick={()=>{setActiveId(f.id); setShowCmd(false)}} className="w-full text-left px-3 py-1.5 rounded text-sm flex items-center gap-2 hover:bg-[#2a2d2e] text-slate-300 hover:text-white"><FileIcon name={f.name}/>{f.name} <span className="ml-auto text-xs text-slate-500">{f.lang}</span></button>
                    ))}
                    <button onClick={()=>{handleSave(); setShowCmd(false)}} className="w-full text-left px-3 py-1.5 rounded text-sm hover:bg-[#2a2d2e] text-slate-300"><Save size={12} className="inline mr-2"/>Save (Ctrl+S)</button>
                    <button onClick={()=>{run(); setShowCmd(false)}} className="w-full text-left px-3 py-1.5 rounded text-sm hover:bg-[#2a2d2e] text-slate-300"><Play size={12} className="inline mr-2"/>Run</button>
                    <button onClick={()=>{setActiveView('search'); setShowCmd(false)}} className="w-full text-left px-3 py-1.5 rounded text-sm hover:bg-[#2a2d2e] text-slate-300"><Search size={12} className="inline mr-2"/>Search</button>
                  </div>
                </div>
              </div>
            )}
            {showShare && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-start justify-center pt-10 z-20" onClick={()=>setShowShare(false)}>
                <div onClick={e=>e.stopPropagation()} className="w-[480px] max-w-[90%] bg-[#252526] rounded-lg border border-[#3c3c3c] shadow-2xl overflow-hidden p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-sm font-bold">{t('vsc_share_code')}</span>
                    <button onClick={()=>setShowShare(false)} className="p-1 text-slate-500"><X size={14}/></button>
                  </div>
                  <div className="text-xs text-slate-400">{t('vsc_share_desc_a')}{files.length}{t('vsc_share_desc_b')}</div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{t('vsc_share_days')}</span>
                    <select value={shareDays} onChange={e=>setShareDays(parseInt(e.target.value))} className="bg-[#3c3c3c] text-white text-xs rounded px-2 py-1">
                      <option value={1}>{t('vsc_24h')}</option>
                      <option value={30}>{t('vsc_1m')}</option>
                      <option value={180}>{t('vsc_6m')}</option>
                      <option value={0}>{t('vsc_forever')}</option>
                    </select>
                    <button onClick={shareFiles} disabled={sharing} className="ml-auto px-3 py-1.5 rounded bg-[#007acc] text-white text-xs font-bold disabled:opacity-50">{sharing?'...':t('vsc_create_link')}</button>
                  </div>
                  {shareUrl && (
                    <div className="flex items-center gap-2 bg-[#1e1e1e] rounded p-2">
                      <span className="flex-1 truncate text-xs text-emerald-300 font-mono">{shareUrl}</span>
                      <button onClick={async()=>{ try{ await navigator.clipboard.writeText(shareUrl); toast(t('shared_copied'),'success') }catch{} }} className="p-1.5 rounded bg-[#3c3c3c] text-white"><Copy size={12}/></button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {showOutput && (
          <div className="bg-[#181818] border-t border-[#2d2d2d] flex flex-col shrink-0">
            <div
              onMouseDown={e=>{
                dragRef.current={startY:e.clientY, startH:panelHeight}
                document.body.style.cursor='row-resize'
                document.body.style.userSelect='none'
              }}
              className="h-2 bg-[#007acc]/0 hover:bg-[#007acc] cursor-row-resize flex items-center justify-center shrink-0"
              title={t('vsc_drag_hint')}
            >
              <div className="w-10 h-1 bg-[#3c3c3c] rounded"/>
            </div>
            <div className="h-7 flex items-center gap-2 px-2 border-b border-[#2d2d2d] bg-[#252526] text-xs shrink-0">
              <span className="text-white font-semibold px-1">{t('vsc_output')}</span>
              {useLive && <span className="px-1.5 py-0.5 rounded bg-emerald-900 text-emerald-300 text-[10px] font-bold">LIVE</span>}
              <span className="text-slate-500 hidden sm:inline">— {active.name}</span>
              <div className="ml-auto flex gap-1">
                <button onClick={()=>setOutput('')} className="p-1 text-slate-500 hover:text-white" title={t('vsc_clear_title')}><Trash2 size={12}/></button>
                <button onClick={()=>{setShowOutput(false); setOutput(''); setExplanation(null); setUseLive(false); live.close()}} className="p-1 text-slate-500 hover:text-white" title={t('close')}><X size={12}/></button>
                {(active.lang==='python'||active.lang==='javascript') && output && (
                  <button onClick={explainCode} disabled={explaining} className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs flex items-center gap-1 disabled:opacity-50">✨ {explaining?'...':t('vsc_explain')}</button>
                )}
                {(live.state==='running'||live.state==='waiting') && (
                  <button onClick={()=>live.stop()} className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold" title={t('vsc_stop_title')}>{t('vsc_stop')}</button>
                )}
                <button onClick={run} className="px-2 py-0.5 rounded bg-[#16825d] text-white text-xs flex items-center gap-1"><Play size={10}/> Run</button>
              </div>
            </div>
            {!useLive && active.lang==='python' && active.content.includes('input(') && (
              <div className="px-2 py-1.5 bg-[#252526] border-b border-[#2d2d2d] flex items-start gap-2 shrink-0">
                <span className="text-xs text-amber-300 whitespace-nowrap pt-1">{t('codelab_stdin_a')} {stdinInput.trim() ? stdinInput.split('\n').length : 0} {t('codelab_stdin_b')} {active.content.split('\n').filter((l:string)=>{ const t=l.trim(); return t && !t.startsWith('#') && /(?<![\w.])input\s*\(/.test(t.split('#')[0]) }).length}:</span>
                <textarea value={stdinInput} onChange={e=>setStdinInput(e.target.value)} rows={2} placeholder={'Каждое значение с новой строки:\nАйбек\n20\n1.75\nда'} className="flex-1 px-2 py-1 rounded bg-[#3c3c3c] border border-[#007acc] text-white text-xs outline-none resize-y min-h-[3rem]"/>
              </div>
            )}
            <pre className="overflow-auto p-2 font-mono text-xs leading-5 whitespace-pre-wrap break-words text-[#e6e6e6]" style={{height: panelHeight}}>{output||t('vsc_output_ph')}</pre>
            {useLive && live.state==='waiting' && (
              <div className="px-2 py-1.5 bg-amber-950/50 border-t border-amber-800/40 flex items-center gap-2 shrink-0">
                <span className="text-xs text-amber-300 font-bold whitespace-nowrap animate-pulse">{t('vsc_wait_input')}</span>
                <input autoFocus value={liveInput} onChange={e=>setLiveInput(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter'){ live.sendInput(liveInput); setLiveInput('') } }} placeholder={t('vsc_enter_value')} className="flex-1 px-2 py-1 rounded bg-[#3c3c3c] border border-amber-500 text-white text-xs outline-none font-mono"/>
                <button onClick={()=>{ live.sendInput(liveInput); setLiveInput('') }} className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold">↵</button>
              </div>
            )}
            {explanation && (
              <div className="m-2 rounded-lg bg-blue-950/60 border border-blue-500/30 p-2.5 text-xs space-y-1">
                <div className="font-bold text-blue-200">💡 {explanation.title}</div>
                <div className="text-slate-200">{explanation.what}</div>
                {explanation.fix && <div className="text-emerald-300">✅ {explanation.fix}</div>}
              </div>
            )}
          </div>
          )}
        </div>
      </div>
      <div className="h-5 bg-[#007acc] text-white flex items-center px-2 text-xs gap-3 shrink-0">
        <span className="hidden sm:flex items-center gap-1">{files.length}/{MAX_FILES} {t('vsc_files_short')}</span>
        <span className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${active.lang==='python'?'bg-yellow-400':active.lang==='javascript'?'bg-yellow-300':active.lang==='html'?'bg-orange-400':'bg-white'}`}/>{active.name}</span>
        <span className="hidden md:inline">Spaces:2 • UTF-8 • LF • {active.lang} • {active.content.split('\n').length} {t('vsc_lines')}</span>
        <span className="ml-auto hidden lg:inline">Ln {cursor.line}, Col {cursor.col}</span>
        <span>{isAuth?t('vsc_logged_in'):t('vsc_guest')}</span>
      </div>
      <div className="md:hidden flex gap-1 p-1 bg-[#252526] border-t border-[#2d2d2d] overflow-auto shrink-0">
        {files.map(f=>(
          <button key={f.id} onClick={()=>setActiveId(f.id)} className={`px-2 py-1 rounded text-xs whitespace-nowrap flex items-center gap-1 ${activeId===f.id?'bg-[#007acc] text-white':'bg-[#3c3c3c] text-slate-300'}`}><FileIcon name={f.name}/>{f.name}</button>
        ))}
        <button onClick={()=>setShowNew(v=>!v)} className="px-2 py-1 rounded bg-[#007acc] text-white"><Plus size={12}/></button>
      </div>
    </div>
  )
}
