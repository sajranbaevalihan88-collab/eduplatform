import { useCallback, useEffect, useRef, useState } from 'react'
import { WS_BASE } from '../api/client'

export type LiveState = 'idle' | 'running' | 'waiting' | 'done' | 'error'

/** Интерактивная сессия запуска кода по WebSocket (ws/run/).
 *  Возвращает состояние, вывод, отправку ввода и остановку. */
export function useRunSession(){
  const [state,setState]=useState<LiveState>('idle')
  const [output,setOutput]=useState('')
  const [passed,setPassed]=useState<boolean|null>(null)
  const wsRef=useRef<WebSocket|null>(null)
  const outRef=useRef('')
  const aliveRef=useRef(false)

  const close=useCallback(()=>{
    try{ wsRef.current?.close() }catch{}
    wsRef.current=null
    aliveRef.current=false
  },[])

  useEffect(()=>()=>{ try{ wsRef.current?.close() }catch{} },[])

  const stop=useCallback(()=>{
    try{ wsRef.current?.send(JSON.stringify({type:'stop'})) }catch{}
  },[])

  const sendInput=useCallback((text:string)=>{
    if(!aliveRef.current) return false
    try{
      wsRef.current?.send(JSON.stringify({type:'input', text}))
      setOutput(o=>o+`› ${text}\n`)
      setState('running')
      return true
    }catch{ return false }
  },[])

  const start=useCallback((language:string, code:string, onDone?:(passed:boolean)=>void):boolean=>{
    close()
    // Хост берём из API-базы (VITE_API_URL): на проде фронт и бэк на разных
    // доменах, window.location.host вёл бы сокет на статику фронта.
    const url = `${WS_BASE}/ws/run/`
    let ws:WebSocket
    try{ ws=new WebSocket(url) }catch{ return false }
    wsRef.current=ws
    aliveRef.current=true
    outRef.current=''
    setOutput('')
    setPassed(null)
    setState('running')
    ws.onopen=()=>{ try{ ws.send(JSON.stringify({type:'start', language, code})) }catch{} }
    ws.onmessage=(ev)=>{
      let m:any=null
      try{ m=JSON.parse(ev.data) }catch{ return }
      if(m.type==='started'){ setState('running') }
      else if(m.type==='output'){
        outRef.current+=(m.text||'')
        setOutput(outRef.current.slice(-20000))
      }
      else if(m.type==='need_input'){ setState('waiting') }
      else if(m.type==='done'){
        setPassed(!!m.passed)
        setState('done')
        aliveRef.current=false
        try{ onDone?.(!!m.passed) }catch{}
        setTimeout(()=>{ try{ ws.close() }catch{} }, 1500)
      }
      else if(m.type==='error'){
        outRef.current+=(outRef.current?'\n':'')+('⚠️ '+(m.message||'Ошибка'))
        setOutput(outRef.current)
        setPassed(false)
        setState('error')
        aliveRef.current=false
      }
    }
    ws.onerror=()=>{ /* onclose решит */ }
    ws.onclose=()=>{ aliveRef.current=false; setState(s=> s==='running'||s==='waiting' ? 'error' : s) }
    return true
  },[close])

  return {state, output, passed, start, stop, sendInput, close, setOutput}
}
