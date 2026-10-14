import { useEffect, useState } from 'react'
import client, { mediaUrl } from '../api/client'
import { Upload, FileText, Presentation, File, Image as ImgIcon, Trash2, Eye } from 'lucide-react'
import { useLang } from '../context/LangContext'

export default function Files(){
  const {t}=useLang()
  const [list,setList]=useState<any[]>([])
  const [uploading,setUploading]=useState(false)
  const [preview,setPreview]=useState<any|null>(null)
  const [me,setMe]=useState<any>(null)
  const load=()=>client.get('/files/').then(r=>setList(Array.isArray(r.data)?r.data:r.data.results||[]))
  useEffect(()=>{
    load()
    const raw=localStorage.getItem('user'); if(raw) try{ setMe(JSON.parse(raw)) }catch{}
    const h=()=>{ const r=localStorage.getItem('user'); if(r) try{ setMe(JSON.parse(r)) }catch{} else setMe(null) }
    window.addEventListener('auth-change', h as any); window.addEventListener('storage', h)
    return ()=>{ window.removeEventListener('auth-change', h as any); window.removeEventListener('storage', h)}
  },[])
  const canDelete=(f:any)=> me && (String(f.owner)===String(me.id) || String(f.owner_id)===String(me.id) || me.role==='admin' || me.is_staff)
  const onUpload=async(e:any)=>{
    const file=e.target.files?.[0]
    if(!file) return
    // клиентская валидация
    const allowed = ['.ppt','.pptx','.doc','.docx','.pdf','.png','.jpg','.jpeg','.gif','.webp']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowed.includes(ext)) { alert(t('files_bad_type') + allowed.join(', ')); return; }
    if (file.size > 50*1024*1024) { alert(t('files_too_big')); return; }
    if (file.size === 0) { alert(t('files_empty_file')); return; }
    setUploading(true)
    try {
      const fd=new FormData()
      fd.append('file',file)
      fd.append('title',file.name.slice(0,200))
      await client.post('/files/',fd,{headers:{'Content-Type':'multipart/form-data'}})
      load()
    } catch(err:any) {
      alert(err.response?.data?.detail || err.response?.data?.error || t('files_upload_err'))
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }
  const del=async(id:number)=>{
    if(!confirm(t('files_del_confirm'))) return
    await client.delete(`/files/${id}/`)
    load()
  }
  const iconFor=(t:string)=>{
    if(t==='presentation') return <Presentation size={20} className="text-orange-600"/>
    if(t==='document') return <FileText size={20} className="text-blue-600"/>
    if(t==='pdf') return <File size={20} className="text-red-600"/>
    if(t==='image') return <ImgIcon size={20} className="text-emerald-600"/>
    return <File size={20}/>
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold dark:text-white">{t('files_title')}</h1>
        <label className="px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold cursor-pointer flex items-center gap-2 hover:bg-blue-700">
          <Upload size={18}/> {uploading?t('files_uploading'):t('files_upload')} <input type="file" className="hidden" accept=".ppt,.pptx,.doc,.docx,.pdf,.png,.jpg,.jpeg" onChange={onUpload}/>
        </label>
      </div>
      <div className="bg-white rounded-2xl border p-3 flex gap-2 text-sm overflow-auto">
        <span className="px-3 py-1.5 rounded-full bg-blue-700 text-white">{t('files_all')}</span>
        <span className="px-3 py-1.5 rounded-full bg-slate-100">{t('files_pptx')}</span>
        <span className="px-3 py-1.5 rounded-full bg-slate-100">{t('files_docx')}</span>
        <span className="px-3 py-1.5 rounded-full bg-slate-100">PDF</span>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(f=>(
          <div key={f.id} className="bg-white rounded-2xl border p-4 hover:shadow-md transition">
            <div className="flex items-start justify-between">
              <div className="w-10 h-10 rounded-xl bg-slate-50 border flex items-center justify-center">{iconFor(f.file_type)}</div>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-100 capitalize">{f.file_type}</span>
            </div>
            <h3 className="font-semibold mt-3 line-clamp-1" title={f.title}>{f.title}</h3>
            <div className="text-xs text-slate-500 mt-1">{(f.size/1024).toFixed(1)} KB • {new Date(f.created_at).toLocaleDateString()}</div>
            <div className="flex gap-2 mt-4">
              <a href={mediaUrl(f.file)} target="_blank" rel="noopener noreferrer" className="flex-1 px-3 py-2 rounded-xl bg-blue-700 text-white text-sm font-medium text-center flex items-center justify-center gap-1"><Eye size={14}/> {t('files_open')}</a>
              <button onClick={()=>setPreview(f)} className="px-3 py-2 rounded-xl bg-slate-100 text-sm">{t('files_preview')}</button>
              {canDelete(f) && <button onClick={()=>del(f.id)} className="p-2 rounded-xl bg-red-50 text-red-600"><Trash2 size={16}/></button>}
            </div>
          </div>
        ))}
      </div>
      {list.length===0 && <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border">{t('files_empty_list')}</div>}
      {preview && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={()=>setPreview(null)}>
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={e=>e.stopPropagation()}>
            <div className="p-4 border-b flex items-center justify-between"><h3 className="font-bold">{preview.title}</h3><button onClick={()=>setPreview(null)} className="px-3 py-1.5 rounded-xl bg-slate-100">{t('close')}</button></div>
            <div className="flex-1 overflow-auto p-4 bg-slate-50">
              {preview.file_type==='image' ? <img src={mediaUrl(preview.file)} className="max-w-full mx-auto rounded-xl" referrerPolicy="no-referrer"/> :
               preview.file?.endsWith('.pdf') ? <iframe src={mediaUrl(preview.file)} className="w-full h-[60vh] rounded-xl border bg-white" sandbox="allow-same-origin" title="preview"/> :
               <div className="text-center py-12"><p className="text-slate-500">{t('files_preview_na')}</p><a href={mediaUrl(preview.file)} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-blue-600 text-white">{t('files_download')}</a></div>
              }
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
