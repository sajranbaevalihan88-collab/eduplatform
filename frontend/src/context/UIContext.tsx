import { createContext, useContext, useEffect, useState } from 'react'

// Toast (встроен для сжатия)
type Toast = { id:number, msg:string, type:'error'|'success'|'info' }
let push: ((msg:string, type?:Toast['type'])=>void) | null = null
export function useToast(){ return (msg:string, type:Toast['type']='info')=> push?.(msg, type) }
export function ToastContainer(){
  const [toasts,setToasts]=useState<Toast[]>([])
  useEffect(()=>{
    push = (msg, type='info')=>{
      const id=Date.now()+Math.random()
      setToasts(t=>[...t,{id,msg,type}])
      setTimeout(()=> setToasts(t=>t.filter(x=>x.id!==id)), 4000)
    }
    return ()=>{ push=null }
  },[])
  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-50 flex flex-col gap-2 max-w-full sm:max-w-[360px]" role="status" aria-live="polite">
      {toasts.map(t=>(
        <div key={t.id} className={`px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${t.type==='error'?'bg-red-50 border-red-200 text-red-700': t.type==='success'?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-white border-slate-200 text-slate-700'}`}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}
export const toast = (msg:string, type:Toast['type']='info')=> push?.(msg,type)

// Theme
type Theme='light'|'dark'
const ThemeCtx=createContext<{theme:Theme, toggle:()=>void, set:(t:Theme)=>void}>({theme:'light', toggle:()=>{}, set:()=>{}})
export function ThemeProvider({children}:{children:React.ReactNode}){
  // по умолчанию СВЕТЛАЯ тема: авто-дарк по системе ломал читаемость (тёмный текст на тёмном фоне),
  // тёмную включает сам пользователь кнопкой — выбор запоминается.
  // Ключ theme-v2: сбрасывает старое авто-тёмное значение у тех, кто его не выбирал
  const [theme,setTheme]=useState<Theme>(()=> (localStorage.getItem('theme-v2') as Theme) || 'light')
  useEffect(()=>{
    document.documentElement.classList.toggle('dark', theme==='dark')
    localStorage.setItem('theme-v2', theme)
    try{ localStorage.removeItem('theme') }catch{}
  },[theme])
  const toggle=()=> setTheme(t=> t==='light'?'dark':'light')
  const set=(t:Theme)=> setTheme(t)
  return <ThemeCtx.Provider value={{theme,toggle,set}}>{children}</ThemeCtx.Provider>
}
export const useTheme=()=> useContext(ThemeCtx)

// Accessibility
const AccCtx=createContext<{poor:boolean, toggle:()=>void, fontScale:number, setFont:(n:number)=>void, speech:boolean, toggleSpeech:()=>void, speak:(t:string)=>void, stopSpeak:()=>void, rate:number, setRate:(n:number)=>void, volume:number, setVolume:(n:number)=>void, voiceLang:string, setLang:(l:string)=>void, autoRead:boolean, toggleAutoRead:()=>void}>({poor:false, toggle:()=>{}, fontScale:100, setFont:()=>{}, speech:false, toggleSpeech:()=>{}, speak:()=>{}, stopSpeak:()=>{}, rate:1, setRate:()=>{}, volume:1, setVolume:()=>{}, voiceLang:'ru', setLang:()=>{}, autoRead:false, toggleAutoRead:()=>{}})
export function AccessibilityProvider({children}:{children:React.ReactNode}){
  const [poor,setPoor]=useState(()=> localStorage.getItem('poor-mode')==='1')
  const [fontScale,setFontScale]=useState(()=> parseInt(localStorage.getItem('font-scale')||'100'))
  const [speech,setSpeech]=useState(()=> localStorage.getItem('speech-mode')==='1')
  const [rate,setRateState]=useState(()=> {
    const v=parseFloat(localStorage.getItem('speech-rate')||'1')
    return isNaN(v)?1:Math.max(0.5,Math.min(2,v))
  })
  const [volume,setVolumeState]=useState(()=> {
    const v=parseFloat(localStorage.getItem('speech-volume')||'1')
    return isNaN(v)?1:Math.max(0,Math.min(1,v))
  })
  const [voiceLang,setVoiceLang]=useState(()=> localStorage.getItem('speech-lang')||'ru')
  // авто-озвучка страниц: пока выключена — платформа не говорит сама, только по кнопкам 🔊
  const [autoRead,setAutoReadState]=useState(()=> localStorage.getItem('edu-auto-read')==='1')
  const toggleAutoRead=()=>{
    setAutoReadState(v=>{
      try{ localStorage.setItem('edu-auto-read', v?'0':'1') }catch{}
      return !v
    })
  }
  useEffect(()=>{
    document.documentElement.classList.toggle('poor-vision', poor)
    localStorage.setItem('poor-mode', poor?'1':'0')
    document.documentElement.style.fontSize = poor ? `${fontScale}%` : ''
    if(poor) document.documentElement.style.setProperty('--poor-contrast','1')
  },[poor, fontScale])
  useEffect(()=>{ localStorage.setItem('speech-mode', speech?'1':'0'); if(!speech) try{ window.speechSynthesis?.cancel() }catch{} },[speech])
  const toggle=()=>{
    // при первом включении шрифт 100% — глазом не видно, что режим заработал.
    // Поднимаем до 125%, чтобы изменение было очевидным.
    if(!poor){
      try{ if(parseInt(localStorage.getItem('font-scale')||'100')<=100) setFont(125) }catch{}
    }
    setPoor(v=>!v)
  }
  const setFont=(n:number)=>{
    const v=Math.max(100, Math.min(200, n))
    setFontScale(v)
    localStorage.setItem('font-scale', String(v))
    document.documentElement.style.fontSize=`${v}%`
  }
  const toggleSpeech=()=>{
    // при включении сразу говорим — иначе тишина, и кажется, что «не работает»
    if(!speech) setTimeout(()=>speak('Озвучка включена. Нажимайте значок динамика у текста, чтобы слушать.'),250)
    setSpeech(v=>!v)
  }
  const setRate=(n:number)=>{
    const v=Math.max(0.5,Math.min(2,n))
    setRateState(v)
    try{ localStorage.setItem('speech-rate',String(v)) }catch{}
  }
  const setVolume=(n:number)=>{
    const v=Math.max(0,Math.min(1,n))
    setVolumeState(v)
    try{ localStorage.setItem('speech-volume',String(v)) }catch{}
  }
  const setLang=(l:string)=>{
    setVoiceLang(l)
    try{ localStorage.setItem('speech-lang',l) }catch{}
  }
  const pickVoice=()=>{
    try{
      const vs=window.speechSynthesis?.getVoices()||[]
      if(!vs.length) return null
      // рейт по качеству: Neural/Natural > Enhanced > Cloud/Google > Online > Server > базовые
      const rank=(v:SpeechSynthesisVoice)=>{
        const n=(v.name||'').toLowerCase()
        let s=0
        if(n.includes('neural')||n.includes('natural')||n.includes('нейро')) s+=50
        else if(n.includes('enhanced')||n.includes('усовершенст')) s+=40
        else if(n.includes('cloud')||n.includes('google')) s+=30
        else if(n.includes('online')) s+=20
        else if(n.includes('server')) s+=15
        else if(n.includes('desktop')) s-=5
        if(n.includes('compact')) s-=10
        return s
      }
      const pref=[voiceLang,'ru','ky','kg','en']
      for(const p of pref){
        const cand=vs.filter(v=>v.lang&&v.lang.toLowerCase().startsWith(p))
        if(cand.length) return cand.sort((a,b)=>rank(b)-rank(a))[0]
      }
      return vs.slice().sort((a,b)=>rank(b)-rank(a))[0]||null
    }catch{ return null }
  }
  const speakQueue=(parts:string[])=>{
    try{
      const s=window.speechSynthesis
      if(!s||!parts.length) return
      const voice=pickVoice()
      // Chrome режет длинные фразы — бьём на куски и ставим в очередь
      for(const chunk of parts){
        const u=new SpeechSynthesisUtterance(chunk)
        if(voice){ u.voice=voice; u.lang=voice.lang } else { u.lang='ru-RU' }
        u.rate=rate
        u.volume=volume
        s.speak(u)
      }
    }catch{}
  }
  const speak=(t:string, _retry?:boolean)=>{
    try{
      const s=window.speechSynthesis
      if(!s){ toast('В этом браузере нет голоса','error'); return }
      try{ if((s as any).paused) (s as any).resume() }catch{}
      const clean=String(t||'').replace(/[<>{}[\]]/g,' ').replace(/\s+/g,' ').trim().slice(0,1500)
      if(!clean) return
      if(!pickVoice()) toast('Голоса в системе нет — почитаю как смогу','info')
      const parts=clean.match(/[^.!?…]+[.!?…]?/g)?.map(x=>x.trim()).filter(Boolean).slice(0,12) || [clean]
      const say=()=>{ speakQueue(parts); watch(parts.join(' ').length) }
      const watch=(len:number)=>{
        // короткие фразы успевают прозвучать — проверяем только длинные
        if(len < 14) return
        setTimeout(()=>{
          try{
            if(!s.speaking && !s.pending){
              if(!_retry){ try{ s.cancel() }catch{}; setTimeout(()=>speak(t, true), 200) }
              else toast('Браузер молчит: проверь звук в системе и нажми ещё раз','error')
            }
          }catch{}
        }, 900)
      }
      // cancel() вплотную перед speak() глушит фразу в Chrome — только если реально говорит, и с паузой
      if(s.speaking||s.pending){ try{ s.cancel() }catch{}; setTimeout(say,150) }
      else say()
    }catch{}
  }
  const stopSpeak=()=>{ try{ window.speechSynthesis?.cancel() }catch{} }
  // Esc — стоп озвучки везде (как у скринридеров), работает и без мыши
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){ try{ window.speechSynthesis?.cancel() }catch{} }
    }
    window.addEventListener('keydown',onKey)
    // подгружаем голоса заранее (Chrome отдаёт их асинхронно)
    try{
      window.speechSynthesis?.getVoices()
      const h=()=>{ try{ window.speechSynthesis?.getVoices() }catch{} }
      window.speechSynthesis&&(window.speechSynthesis.onvoiceschanged=h)
    }catch{}
    // iOS Safari: синтез встаёт на паузу сам — дёргаем resume, иначе молчит после ~15 сек.
    // Тот же приём чинит паузу при сворачивании вкладки на телефоне.
    const keepAlive=setInterval(()=>{
      try{
        const s=window.speechSynthesis
        if(s && ((s as any).paused || s.pending) && (s.speaking || (s as any).paused)) (s as any).resume()
      }catch{}
    }, 4000)
    const onVis=()=>{ try{ if(!document.hidden) (window.speechSynthesis as any)?.resume?.() }catch{} }
    document.addEventListener('visibilitychange',onVis)
    return ()=>{ window.removeEventListener('keydown',onKey); document.removeEventListener('visibilitychange',onVis); clearInterval(keepAlive) }
  },[])
  return <AccCtx.Provider value={{poor,toggle,fontScale,setFont,speech,toggleSpeech,speak,stopSpeak,rate,setRate,volume,setVolume,voiceLang,setLang,autoRead,toggleAutoRead}}>{children}</AccCtx.Provider>
}
export const useAccessibility=()=> useContext(AccCtx)
