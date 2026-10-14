import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import client from '../api/client'
import Editor from '@monaco-editor/react'
import { Copy, Check, FolderOpen, ArrowLeft } from 'lucide-react'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'

export default function SharedView(){
  const {t}=useLang()
  const {token}=useParams()
  const nav=useNavigate()
  const [data,setData]=useState<any>(null)
  const [error,setError]=useState('')
  const [activeIdx,setActiveIdx]=useState(0)
  const [copied,setCopied]=useState(false)
  useEffect(()=>{
    client.get(`/shared/${token}/`).then(r=>setData(r.data)).catch((e:any)=>setError(e.response?.data?.error||t('shared_open_err')))
  },[token])
  if(error) return <div className="max-w-2xl mx-auto text-center py-16"><h2 className="text-xl font-bold dark:text-white">😕 {error}</h2><Link to="/" className="mt-4 inline-block px-4 py-2 rounded-xl bg-blue-600 text-white">{t('shared_home')}</Link></div>
  if(!data) return <div className="p-8"><div className="skeleton h-64 rounded-2xl max-w-3xl mx-auto"/></div>
  const files=data.files||[]
  const active=files[activeIdx]||{name:'',content:''}
  const lang = active.name.endsWith('.py')?'python':active.name.endsWith('.html')?'html':active.name.endsWith('.css')?'css':'javascript'
  const copy=async()=>{
    try{ await navigator.clipboard.writeText(active.content||''); setCopied(true); setTimeout(()=>setCopied(false),1500) }catch{ toast(t('shared_copy_err'),'error') }
  }
  const openInEditor=()=>{
    try{
      const arr=files.map((f:any,i:number)=>({id:String(Date.now()+i), name:f.name, content:f.content, lang: f.name.endsWith('.py')?'python':f.name.endsWith('.html')?'html':f.name.endsWith('.css')?'css':'javascript'}))
      localStorage.setItem('vscode-files', JSON.stringify(arr))
    }catch{}
    nav('/editor')
  }
  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <Link to="/" className="text-sm text-slate-500 hover:text-blue-600 flex items-center gap-1"><ArrowLeft size={14}/> {t('shared_home')}</Link>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5">
        <div className="text-xs text-slate-400">{t('shared_shared')}</div>
        <h1 className="text-2xl font-bold dark:text-white">{data.title}</h1>
        <div className="mt-3 flex flex-wrap gap-2">
          {files.map((f:any,i:number)=>(
            <button key={i} onClick={()=>setActiveIdx(i)} className={`px-3 py-1.5 rounded-xl text-sm font-mono ${i===activeIdx?'bg-slate-900 dark:bg-white dark:text-slate-900 text-white':'bg-slate-100 dark:bg-slate-700 dark:text-slate-200'}`}>{f.name}</button>
          ))}
        </div>
      </div>
      <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
          <span className="text-sm font-mono font-semibold dark:text-white">{active.name}</span>
          <div className="flex gap-2">
            <button onClick={copy} className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-sm flex items-center gap-1 dark:text-white">{copied?<Check size={14}/>:<Copy size={14}/>} {copied?t('shared_copied'):t('shared_copy')}</button>
            <button onClick={openInEditor} className="px-3 py-1.5 rounded-xl bg-blue-600 text-white text-sm flex items-center gap-1"><FolderOpen size={14}/> {t('shared_to_editor')}</button>
          </div>
        </div>
        <Editor height="420px" path={'shared/'+active.name} language={lang} value={active.content||''} theme="vs-dark" options={{readOnly:true, minimap:{enabled:false}, fontSize:14}}/>
      </div>
    </div>
  )
}
