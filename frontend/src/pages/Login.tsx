import { useState } from 'react'
import client from '../api/client'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../context/LangContext'

export default function Login(){
  const {t}=useLang()
  const [isReg,setIsReg]=useState(false)
  const [form,setForm]=useState({username:'',password:'',email:'',role:'teacher'})
  const nav=useNavigate()
  const [error,setError]=useState<string>('')
  const [busy,setBusy]=useState(false)
  const submit=async(e:any)=>{
    e.preventDefault()
    if(busy) return
    setError('')
    // клиентская валидация
    if (form.username.trim().length < 3) { setError(t('login_err_login_min')); return; }
    if (form.password.length < 8) { setError(t('login_err_pass_min')); return; }
    if (isReg && form.email && !form.email.includes('@')) { setError(t('login_err_email')); return; }
    setBusy(true)
    try{
      if(isReg){
        await client.post('/auth/register/',form)
        alert(t('login_reg_ok'))
        setIsReg(false)
        setError('')
      } else {
        const r=await client.post('/auth/jwt/create/',{username:form.username,password:form.password})
        localStorage.setItem('access',r.data.access)
        localStorage.setItem('refresh',r.data.refresh)
        // для совместимости со старым кодом
        localStorage.setItem('token',r.data.access)
        // получить пользователя
        const me = await client.get('/auth/me/', {headers:{Authorization:`Bearer ${r.data.access}`}})
        localStorage.setItem('user',JSON.stringify(me.data))
        window.dispatchEvent(new Event('auth-change'))
        nav('/')
      }
    }catch(err:any){ 
      const data = err.response?.data
      let msg = t('error')
      if (data) {
        if (typeof data === 'string') msg = data
        else if (data.detail) msg = data.detail
        else if (data.error) msg = data.error
        else {
          // собрать все поля {username:[...], password:[...]}
          const parts: string[] = []
          for (const [k,v] of Object.entries(data)) {
            const arr = Array.isArray(v) ? v : [v]
            parts.push(`${k}: ${arr.join(', ')}`)
          }
          if (parts.length) msg = parts.join('\n')
          else msg = JSON.stringify(data)
        }
      } else if (err.message) msg = err.message
      setError(msg)
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-2xl border p-5 sm:p-8">
        <div className="flex flex-col items-center gap-1 mb-1">
          <img src="/logo.svg" alt="EduPlatform AI" className="w-16 h-16 drop-shadow-md" />
          <div className="font-display font-bold text-lg dark:text-white">EduPlatform <span className="brand-ai">AI</span></div>
        </div>
        <h1 className="text-2xl font-display font-bold text-center dark:text-white">{isReg?t('login_title_reg'):t('login')}</h1>
        <p className="text-sm text-slate-500 text-center mt-1">{isReg?t('login_sub_reg'):t('login_to_create')}</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input placeholder={t('login_ph_user')} aria-label={t('login_ph_user')} autoComplete="username" autoCapitalize="none" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border bg-slate-50" required minLength={3}/>
          {isReg && <input placeholder={t('login_ph_email')} aria-label={t('login_ph_email')} autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border bg-slate-50" type="email"/>}
          <input type="password" placeholder={t('login_ph_pass')} aria-label={t('login_ph_pass')} autoComplete={isReg ? 'new-password' : 'current-password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border bg-slate-50" required minLength={8}/>
          {isReg && <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50"><option value="teacher">{t('login_teacher')}</option><option value="student">{t('login_student')}</option></select>}
          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 whitespace-pre-wrap">{error}</div>}
          <button disabled={busy} className="w-full min-h-[44px] py-2.5 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60">{busy ? '…' : isReg ? t('login_btn_reg') : t('login_submit')}</button>
        </form>
        <button onClick={()=>{setIsReg(!isReg); setError('')}} className="w-full mt-3 text-sm text-blue-600 font-medium">{isReg?t('login_to_in'):t('login_to_reg')}</button>
        <div className="mt-6 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-slate-700">{t('login_hint')}</div>
      </div>
    </div>
  )
}
