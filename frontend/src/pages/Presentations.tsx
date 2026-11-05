import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Presentation as Icon, Upload } from 'lucide-react'
import client from '../api/client'
import { isStudent } from '../utils/role'
import { toast } from '../context/UIContext'
import { useLang } from '../context/LangContext'

// Страница «Презентации» = только создание и загрузка (редактор).
// Сам каталог презентаций живёт в предметах: Предметы → предмет → вкладка «Презентации».
export default function Presentations(){
  const {t}=useLang()
  const nav=useNavigate()
  const fileRef=useRef<HTMLInputElement>(null)
  const [uploading,setUploading]=useState(false)

  const uploadPres=async(file:File)=>{
    setUploading(true)
    try{
      const fd=new FormData()
      fd.append('file',file)
      fd.append('title',file.name.replace(/\.[^/.]+$/,''))
      fd.append('is_public','true')
      const r=await client.post('/presentations/import/', fd, {headers:{'Content-Type':'multipart/form-data'}})
      const count=r.data?.slides_count ?? r.data?.slides?.length ?? 0
      toast(`${t('pres_uploaded')} — ${count} ${t('pres_slides_short')}`,'success')
      nav(`/presentations/${r.data.id}/edit`)
    }catch(e:any){
      toast(e?.response?.data?.detail||e?.response?.data?.error||t('pres_import_err'),'error')
    }
    setUploading(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 page-enter">
      <h1 className="text-2xl font-display font-bold flex items-center gap-3 dark:text-white">
        <span className="p-2 rounded-xl bg-orange-500 text-white"><Icon size={20}/></span>
        {t('presentations')}
      </h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">{t('pres_only_hint')}</p>

      {isStudent() ? (
        <div className="p-5 rounded-2xl border bg-white dark:bg-slate-900 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400">
          {t('pres_student_hint')}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <Link to="/presentations/new" data-testid="pres-create" className="group bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border p-6 hover:shadow-lg hover:border-indigo-300 transition flex flex-col items-center text-center gap-3">
            <span className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center group-hover:scale-105 transition"><Plus size={26}/></span>
            <span className="font-bold text-lg dark:text-white">{t('pres_card_create')}</span>
            <span className="text-sm text-slate-500">{t('pres_card_create_desc')}</span>
          </Link>
          <button onClick={()=>fileRef.current?.click()} disabled={uploading} className="group bg-white dark:bg-slate-900 dark:border dark:border-slate-800 rounded-2xl border p-6 hover:shadow-lg hover:border-orange-300 transition flex flex-col items-center text-center gap-3 disabled:opacity-50">
            <span className="w-14 h-14 rounded-2xl bg-orange-500 text-white flex items-center justify-center group-hover:scale-105 transition"><Upload size={26}/></span>
            <span className="font-bold text-lg dark:text-white">{uploading?'...':t('pres_card_upload')}</span>
            <span className="text-sm text-slate-500">{t('pres_card_upload_desc')}</span>
          </button>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".pptx,.ppt" className="hidden" onChange={e=>{const f=e.target.files?.[0]; if(f) uploadPres(f); e.target.value=''}}/>
    </div>
  )
}
