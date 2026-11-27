import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import client from '../api/client'
import { GraduationCap, Plus, Copy, Check, LogOut, Users, UsersRound, Search, Wallet } from 'lucide-react'
import { useLang } from '../context/LangContext'
import { canTeach, getRole } from '../utils/role'
import { toast } from '../context/UIContext'

const COLORS = ['#3B82F6','#8B5CF6','#10B981','#F59E0B','#EF4444','#EC4899']

function fmtCode(c?: string|null){
  if(!c) return '—'
  return c.length>3 ? c.slice(0,3)+'-'+c.slice(3) : c
}

export default function Classes(){
  const {t} = useLang()
  const [rooms,setRooms]=useState<any[]>([])
  const [search,setSearch]=useState('')
  const [code,setCode]=useState('')
  const [creating,setCreating]=useState(false)
  const [form,setForm]=useState({title:'',description:'',color:'#3B82F6',subject:'',is_paid:false,price:'',payment_details:''})
  const [subjects,setSubjects]=useState<any[]>([])
  const [copied,setCopied]=useState<number|null>(null)
  const role = getRole()
  const isAdmin = role === 'admin'
  const teach = canTeach()
  const isParent = role === 'parent'
  const meId = (()=>{ try{ return JSON.parse(localStorage.getItem('user')||'{}').id }catch{ return null } })()

  const load = (searchTerm?: string) => {
    const q = (searchTerm !== undefined ? searchTerm : search).trim()
    const params: Record<string, any> = { page_size: 200 }
    if (q) params.search = q
    client.get('/classrooms/', { params })
      .then(r => {
        const list = Array.isArray(r.data) ? r.data : (r.data?.results || [])
        setRooms(list)
      })
      .catch(() => {})
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      load(search)
    }, 250)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (teach) {
      client.get('/subjects/', { params: { page_size: 100 } })
        .then(r => setSubjects(Array.isArray(r.data) ? r.data : (r.data?.results || [])))
        .catch(() => {})
    }
  }, [teach])

  const create=async()=>{
    if(!form.title.trim()){ toast(t('cls_need_title'),'error'); return }
    try{
      const payload: any = {
        title: form.title.trim(),
        description: form.description,
        color: form.color,
        is_paid: !!form.is_paid,
      }
      if (form.subject) payload.subject = Number(form.subject)
      if (form.is_paid) {
        const raw = String(form.price || '').trim().replace(',', '.')
        if (raw !== '') {
          const num = Number(raw)
          if (isNaN(num) || num < 0) { toast('Цена — число больше 0', 'error'); return }
          payload.price = num
        }
        payload.payment_details = form.payment_details.trim()
      }
      await client.post('/classrooms/', payload)
      setForm({title:'',description:'',color:'#3B82F6',subject:'',is_paid:false,price:'',payment_details:''}); setCreating(false); load()
      toast(t('cls_created'),'success')
    }catch(e:any){ toast(e?.response?.data?.detail||t('cls_err'),'error') }
  }
  const join=async()=>{
    if(!code.trim()) return
    try{
      await client.post('/classrooms/join/', {code: code.trim()})
      setCode(''); load(); toast(t('cls_joined'),'success')
    }catch(e:any){ toast(e?.response?.data?.detail||e?.response?.data?.code||t('cls_err'),'error') }
  }
  const remove=async(id:number)=>{
    if(!confirm(t('cls_del_confirm'))) return
    try{
      await client.delete(`/classrooms/${id}/`)
      toast(t('cls_deleted'),'success')
    }catch(e:any){ toast(e?.response?.data?.detail||e?.response?.data?.error||t('cls_err'),'error') }
    load()
  }
  const leave=async(id:number)=>{
    if(!confirm(t('cls_leave_confirm'))) return
    try{
      await client.post(`/classrooms/${id}/leave/`)
      toast(t('cls_left'),'success')
    }catch(e:any){ toast(e?.response?.data?.detail||e?.response?.data?.error||t('cls_err'),'error') }
    load()
  }
  const copy=(id:number, c:string)=>{
    try{ navigator.clipboard.writeText(c); setCopied(id); setTimeout(()=>setCopied(null),1500) }catch{}
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold flex items-center gap-2 dark:text-white">
          <GraduationCap/>{isParent ? t('cls_parent_title') : isAdmin ? t('cls_admin_title') : t('classes')}
        </h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
          {isParent ? (
            <Link to="/children" className="px-4 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5">
              <UsersRound size={16}/> {t('cls_parent_diary')}
            </Link>
          ) : !isAdmin ? (
            <div className="flex rounded-xl border dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 w-full sm:w-auto">
              <input value={code} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,7))} inputMode="text" autoCapitalize="characters" maxLength={8} placeholder={t('cls_code_ph')} className="flex-1 min-w-0 px-3 py-3 sm:py-2 text-sm uppercase font-mono outline-none bg-transparent dark:text-white dark:placeholder-slate-500"/>
              <button onClick={join} className="px-5 py-3 sm:py-2 bg-emerald-600 text-white text-sm font-semibold flex items-center justify-center min-h-[44px]">{t('cls_join')}</button>
            </div>
          ) : null}
          {teach && <button onClick={()=>setCreating(v=>!v)} className="w-full sm:w-auto px-4 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center gap-1"><Plus size={16}/>{t('cls_new')}</button>}
        </div>
      </div>

      {/* Поиск по никнейму (учитель / ученик) или названию */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('cls_search_ph')}
          className="w-full pl-10 pr-10 py-2.5 min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-400"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-bold p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"
            title={t('cls_clear_search')}
          >
            ✕
          </button>
        )}
      </div>

      {creating && teach && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 p-5 space-y-3">
          <div className="grid sm:grid-cols-2 gap-2.5">
            <input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder={t('cls_title_ph')} className="w-full px-4 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 bg-transparent dark:text-white dark:placeholder-slate-500 outline-none focus:border-indigo-400"/>
            <select value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})} aria-label="Предмет класса"
              className="w-full px-3 py-2.5 min-h-[44px] rounded-xl border dark:border-slate-700 bg-white dark:bg-slate-900 dark:text-white outline-none focus:border-indigo-400">
              <option value="">Предмет программы (необязательно)</option>
              {subjects.map((s:any)=><option key={s.id} value={s.id}>{s.icon||''} {s.name}</option>)}
            </select>
          </div>
          <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder={t('cls_desc_ph')} rows={2} className="w-full px-4 py-2.5 rounded-xl border dark:border-slate-700 bg-transparent dark:text-white dark:placeholder-slate-500 outline-none focus:border-indigo-400"/>
          <div className="p-3.5 rounded-xl border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/60 dark:bg-amber-950/25 space-y-2.5">
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-amber-100 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_paid}
                onChange={e=>setForm({...form, is_paid: e.target.checked})}
                data-testid="cls-new-paid"
                className="w-4 h-4 accent-amber-600"
              />
              <Wallet size={15} className="text-amber-600 dark:text-amber-400"/>
              <span>Сделать платным курсом</span>
            </label>
            {form.is_paid && (
              <div className="grid sm:grid-cols-2 gap-2 pt-0.5">
                <input
                  value={form.price}
                  onChange={e=>setForm({...form, price: e.target.value})}
                  placeholder="Цена, сом (например 500)"
                  inputMode="decimal"
                  data-testid="cls-new-price"
                  className="px-3 py-2 rounded-xl border border-amber-300/80 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:border-amber-500"
                />
                <input
                  value={form.payment_details}
                  onChange={e=>setForm({...form, payment_details: e.target.value})}
                  placeholder="Реквизиты: Мбанк 0500123456 / карта"
                  data-testid="cls-new-details"
                  className="px-3 py-2 rounded-xl border border-amber-300/80 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setForm({ ...form, color: c })}
                  aria-label={`Выбрать цвет ${c}`}
                  className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-full transition-transform flex items-center justify-center p-1 ${form.color === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-105' : 'hover:scale-105'}`}
                >
                  <span className="w-full h-full rounded-full" style={{ background: c }} />
                </button>
              ))}
            </div>
            <button onClick={create} className="w-full sm:w-auto px-5 py-2.5 min-h-[44px] rounded-xl bg-indigo-600 text-white font-semibold flex items-center justify-center">{t('create')}</button>
          </div>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {rooms.map(r=>(
          <div key={r.id} className="bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-700 overflow-hidden card-hover">
            <div className="h-20 flex items-end justify-between gap-2 p-4" style={{background:r.color}}>
              <GraduationCap className="text-white/90 shrink-0" size={28}/>
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {r.is_paid && (
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-400 text-slate-950 shadow-sm">
                    💰 {r.price != null ? `${parseFloat(String(r.price))} сом` : 'Платный'}
                  </span>
                )}
                {r.subject_name && <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-black/20 text-white backdrop-blur-sm">{r.subject_name}</span>}
              </div>
            </div>
            <div className="p-4 space-y-2">
              <div>
                <Link to={`/classes/${r.id}`} className="font-bold text-lg hover:text-indigo-700 dark:text-white dark:hover:text-indigo-400">{r.title}</Link>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                  <span>{t('cls_teacher_lbl')} <strong className="text-slate-700 dark:text-slate-300">@{r.owner_name || r.owner_username || '—'}</strong></span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><Users size={12}/>{r.members_count ?? (r.students?.length || 0)}</span>
                  <span>•</span>
                  <span>{r.assignments_count || 0} {t('cls_tasks')}</span>
                </div>
                {Array.isArray(r.students) && r.students.length > 0 && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1">
                    <span>{t('cls_students_lbl')} </span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      {r.students.map((s: string) => `@${s}`).join(', ')}
                    </span>
                  </div>
                )}
              </div>
              {r.invite_code && (
                <button onClick={()=>copy(r.id, r.invite_code)} className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border dark:border-slate-700 font-mono text-sm dark:text-white" title={t('cls_copy_code')}>
                  <span className="tracking-[0.15em] font-bold">{fmtCode(r.invite_code)}</span>
                  {copied===r.id ? <Check size={16} className="text-emerald-600"/> : <Copy size={16} className="text-slate-400"/>}
                </button>
              )}
              <div className="pt-1 flex gap-2">
                <Link to={`/classes/${r.id}`} className="flex-1 text-center px-3 py-2.5 min-h-[44px] rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm font-semibold flex items-center justify-center hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors">{t('open')}</Link>
                {(String(r.owner)===String(meId) || isAdmin)
                  ? <button onClick={()=>remove(r.id)} className="px-3 py-2.5 min-w-[44px] min-h-[44px] rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors" title={t('delete')} aria-label={t('delete')}>✕</button>
                  : !isParent && <button onClick={()=>leave(r.id)} className="px-3 py-2.5 min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 text-sm flex items-center justify-center gap-1 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors" title={t('cls_leave')} aria-label={t('cls_leave')}><LogOut size={14}/></button>}
              </div>
            </div>
          </div>
        ))}
      </div>
      {rooms.length===0 && (
        <div className="text-center text-slate-500 dark:text-slate-400 py-12 space-y-3">
          <div>
            {search
              ? `${t('cls_not_found_q')} «${search}»`
              : isParent
              ? t('cls_parent_empty')
              : t('cls_empty')}
          </div>
          {search && (
            <button
              onClick={() => setSearch('')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              {t('cls_reset_search')}
            </button>
          )}
          {isParent && !search && (
            <Link to="/children" className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold">
              <UsersRound size={16}/> {t('cls_open_children')}
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
