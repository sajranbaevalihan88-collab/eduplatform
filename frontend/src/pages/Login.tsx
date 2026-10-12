import { useState } from 'react'
import client from '../api/client'
import { useNavigate } from 'react-router-dom'

export default function Login(){
  const [isReg,setIsReg]=useState(false)
  const [form,setForm]=useState({username:'',password:'',email:'',role:'teacher'})
  const nav=useNavigate()
  const [error,setError]=useState<string>('')
  const submit=async(e:any)=>{
    e.preventDefault()
    setError('')
    // клиентская валидация
    if (form.username.trim().length < 3) { setError('Логин минимум 3 символа'); return; }
    if (form.password.length < 8) { setError('Пароль минимум 8 символов'); return; }
    if (isReg && form.email && !form.email.includes('@')) { setError('Укажи корректный email'); return; }
    try{
      if(isReg){
        await client.post('/auth/register/',form)
        alert('Регистрация успешна — теперь войди')
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
      let msg = 'Ошибка'
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
    }
  }
  return (
    <div className="max-w-md mx-auto">
      <div className="bg-white rounded-2xl border p-8">
        <h1 className="text-2xl font-display font-bold text-center">{isReg?'Регистрация':'Вход'}</h1>
        <p className="text-sm text-slate-500 text-center mt-1">{isReg?'Создай аккаунт учителя или ученика':'Войди чтобы создавать уроки'}</p>
        <form onSubmit={submit} className="mt-6 space-y-3">
          <input placeholder="Логин (мин 3 символа, без пробелов)" value={form.username} onChange={e=>setForm({...form,username:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50" required minLength={3}/>
          {isReg && <input placeholder="Email (необязательно)" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50" type="email"/>}
          <input type="password" placeholder="Пароль (мин 8 символов)" value={form.password} onChange={e=>setForm({...form,password:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50" required minLength={8}/>
          {isReg && <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full px-4 py-2.5 rounded-xl border bg-slate-50"><option value="teacher">Учитель</option><option value="student">Ученик</option></select>}
          {error && <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 whitespace-pre-wrap">{error}</div>}
          <button className="w-full py-2.5 rounded-xl bg-violet-600 text-white font-bold">{isReg?'Зарегистрироваться':'Войти'}</button>
        </form>
        <button onClick={()=>{setIsReg(!isReg); setError('')}} className="w-full mt-3 text-sm text-violet-600 font-medium">{isReg?'Уже есть аккаунт? Войти':'Нет аккаунта? Регистрация'}</button>
        <div className="mt-6 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-slate-700">✨ Глобальная база: все уроки/презентации/тесты видны всем без входа. Войди чтобы создавать свои.</div>
      </div>
    </div>
  )
}
