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
    <div className="fixed bottom-[calc(72px+env(safe-area-inset-bottom))] lg:bottom-4 left-4 right-4 sm:left-auto sm:right-4 z-[70] flex flex-col gap-2 max-w-full sm:max-w-[360px]" role="status" aria-live="polite">
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
    const next=!speech
    if(next){
      // Слепой/слабовидящий ученик не должен ещё раз искать «авто-чтение».
      if(!autoRead){
        setAutoReadState(true)
        try{ localStorage.setItem('edu-auto-read','1') }catch{}
      }
      setTimeout(()=>speak('Озвучка включена. Страницы читаются автоматически.'),250)
    }
    setSpeech(next)
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
  // Синтез речи должен понимать контент на любом языке.
  // Выбираем голос по скрипту текста: RU/KG кириллица -> русский/киргизский голос,
  // английский текст -> английский. Если голоса нет, кириллицу читаем через латинскую транслитерацию.
  const translitCyrillic=(input:string)=>{
    const map:Record<string,string>={
      'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i',
      'й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t',
      'у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y',
      'ь':'','э':'e','ю':'yu','я':'ya','ң':'ng','ө':'o','ү':'u','һ':'h','җ':'jh','ҥ':'ng'
    }
    return String(input||'').replace(/[\u0400-\u04FF]/g, ch=>{
      const low=ch.toLowerCase()
      const tr=map[low]
      if(tr===undefined) return ch
      return ch===low ? tr : tr.charAt(0).toUpperCase()+tr.slice(1)
    })
  }
  const detectSpeechScript=(text:string)=>{
    const s=String(text||'')
    const cyr=(s.match(/[\u0400-\u04FF]/g)||[]).length
    const lat=(s.match(/[A-Za-z]/g)||[]).length
    if(cyr===0 && lat===0) return voiceLang==='kg'||voiceLang==='ky' ? 'cyr' : 'lat'
    if(cyr>lat) return 'cyr'
    if(lat>cyr) return 'lat'
    return voiceLang==='en' ? 'lat' : 'cyr'
  }
  const pickVoiceForText=(text:string):{voice:SpeechSynthesisVoice|null, matched:boolean, script:'cyr'|'lat'}=>{
    try{
      const vs=window.speechSynthesis?.getVoices()||[]
      const script=detectSpeechScript(text)
      if(!vs.length) return {voice:null, matched:false, script}
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
      const byLang=(codes:string[])=>{
        for(const code of codes){
          const cand=vs.filter(v=>v.lang&&v.lang.toLowerCase().replace('_','-').startsWith(code))
          if(cand.length) return cand.sort((a,b)=>rank(b)-rank(a))[0]
        }
        return null
      }
      // Кыргызские тексты: сначала ky, потом русский голос (он хорошо читает кириллицу).
      const cyrPref=voiceLang==='kg'||voiceLang==='ky'||/[\u04A3\u04E9\u04AF]/i.test(String(text||''))
        ? ['ky','kg','ru','uk','bg','sr','mk','ba','kk']
        : ['ru','ky','kg','uk','bg','sr','mk','ba','kk']
      const voice=script==='cyr' ? byLang(cyrPref) : byLang(['en-US','en-GB','en'])
      if(voice) return {voice, matched:true, script}
      // Нет точного языка: берём другой кириллический голос; если его нет — английский голос + транслитерация.
      const cyrCandidates=vs.filter(v=>{
        const l=(v.lang||'').toLowerCase()
        return ['ru','uk','bg','sr','mk','ba','kk','ky','kg'].some(code=>l.startsWith(code))
      }).sort((a,b)=>rank(b)-rank(a))[0]
      if(script==='cyr' && cyrCandidates) return {voice:cyrCandidates, matched:true, script}
      return {voice:vs.slice().sort((a,b)=>rank(b)-rank(a))[0]||null, matched:false, script}
    }catch{ return {voice:null, matched:false, script:'cyr'} }
  }

  const speakQueue=(parts:string[])=>{
    try{
      const s=window.speechSynthesis
      if(!s||!parts.length) return
      // Chrome режет длинные фразы — бьём на куски и ставим в очередь
      for(const chunk of parts){
        const sel=pickVoiceForText(chunk)
        const cyrillicWithoutVoice=sel.script==='cyr' && !sel.matched
        const spoken=cyrillicWithoutVoice ? translitCyrillic(chunk) : chunk
        const u=new SpeechSynthesisUtterance(spoken)
        if(sel.voice){ u.voice=sel.voice; u.lang=sel.voice.lang }
        else { u.lang=sel.script==='lat' ? 'en-US' : 'ru-RU' }
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
      const clean=String(t||'').replace(/[<>{}[\]]/g,' ').replace(/\s+/g,' ').trim().slice(0,1500)
      if(!clean) return
      // Chrome/Android отдают список голосов асинхронно: иначе первый запуск может взять только English.
      const start=()=>{
        try{
          if((s as any).paused) (s as any).resume()
          if(!pickVoiceForText(clean).voice) toast('Голоса в системе нет — почитаю как смогу','info')
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
      const finish=()=>{ try{ s.removeEventListener('voiceschanged', finish) }catch{} }
      if(s.getVoices().length){ start(); return }
      let started=false
      const ready=()=>{ if(started) return; started=true; finish(); start() }
      s.addEventListener('voiceschanged', ready, {once:true})
      setTimeout(ready, 850)
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
