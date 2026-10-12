import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { useAccessibility } from '../context/UIContext'

export default function TestTake(){
  const {id}=useParams()
  const [test,setTest]=useState<any>(null)
  const [answers,setAnswers]=useState<Record<string,any>>({})
  const [result,setResult]=useState<any>(null)
  const [alreadyAttempted,setAlreadyAttempted]=useState(false)
  const [blockedMsg,setBlockedMsg]=useState<string|null>(null)
  const [qi,setQi]=useState(0)
  const [leftMap,setLeftMap]=useState<Record<string,number>>({})
  const [autoRead,setAutoRead]=useState(()=>{ try{ return localStorage.getItem('edu-auto-read')==='1' }catch{ return false } })
  const [searchParams]=useSearchParams()
  const fromPath=searchParams.get('from') && searchParams.get('from')!.startsWith('/') ? searchParams.get('from')! : null
  const {speech,speak}=useAccessibility()
  useEffect(()=>{
    if(speech && test?.questions?.length){
      speak(`Тест ${test.title}. Вопросов: ${test.questions.length}. Читай текущий вопрос кнопкой динамика.`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[speech, test?.id])
  useEffect(()=>{
    setAnswers({}); setResult(null); setAlreadyAttempted(false); setBlockedMsg(null); setQi(0); setLeftMap({})
    client.get(`/tests/${id}/`).then(r=>{
      setTest(r.data)
      const perQ = r.data.time_per_question || 0
      if(perQ > 0){
        const m:Record<string,number> = {}
        ;(r.data.questions||[]).forEach((q:any)=>{ m[String(q.id)] = perQ })
        setLeftMap(m)
      }
    }).catch(()=>{})
    // проверяем, проходил ли уже — только для вошедших, гостям всегда можно
    const token=localStorage.getItem('access')||localStorage.getItem('token')
    if(token){
      client.get('/attempts/').then(r=>{
        const list=Array.isArray(r.data)?r.data:r.data.results||[]
        const found=list.find((a:any)=>String(a.test)===String(id) || String(a.test_id)===String(id))
        if(found){
          setAlreadyAttempted(true)
          setResult({score: found.score, earned: Math.round(found.score*found.max_score/100), total: found.max_score, passed: found.passed, details: [], already:true})
        }
      }).catch(()=>{})
    }
    // гостям — не блокировать по localStorage, можно проходить сколько угодно
  },[id])
  const submit=async()=>{
    try{
      const r=await client.post(`/tests/${id}/submit/`,{answers})
      setResult(r.data)
      setAlreadyAttempted(true)
      localStorage.setItem(`test_done_${id}`,'1')
    }catch(e:any){
      const msg=e?.response?.data?.error || e?.response?.data?.detail
      if(e?.response?.status===403 && msg?.includes('уже проходили')){
        setBlockedMsg(msg)
        setAlreadyAttempted(true)
        setResult({score:0, earned:0, total:0, passed:false, blocked:true, details:[]})
      } else {
        setBlockedMsg(msg||'Ошибка отправки')
      }
    }
  }
  // таймер на вопрос: время идёт только на текущем, при переключении — пауза
  const perQ = test?.time_per_question || 0
  useEffect(()=>{
    if(!test || result || alreadyAttempted || !perQ) return
    const q = test.questions?.[qi]
    if(!q) return
    const key = String(q.id)
    if((leftMap[key] ?? perQ) <= 0) return
    const iv = setInterval(()=>{
      setLeftMap(m=>{
        const left = (m[key] ?? perQ) - 1
        return {...m, [key]: Math.max(0, left)}
      })
    }, 1000)
    return ()=>clearInterval(iv)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[test?.id, qi, result, alreadyAttempted])

  // время вышло — авто-дальше (на последнем — авто-отправка)
  useEffect(()=>{
    if(!test || result || alreadyAttempted || !perQ) return
    const q = test.questions?.[qi]
    if(!q) return
    if((leftMap[String(q.id)] ?? perQ) <= 0){
      if(qi + 1 < test.questions.length) setQi(qi + 1)
      else submit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[leftMap, qi])

  // авто-чтение текущего вопроса для незрячих
  useEffect(()=>{
    if(!test || result || alreadyAttempted || !autoRead) return
    const q = test.questions?.[qi]
    if(!q) return
    speak(`Вопрос ${qi+1}. ${q.text}. Варианты: ${(q.options||[]).map((o:any)=>o.text).join(', ')}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[test?.id, qi, autoRead])

  if(!test) return <div>Загрузка...</div>
  if(alreadyAttempted || result){
    // если уже проходил — показываем результат один раз без кнопки "Пройти снова"
    const show = result
    if(show){
      const isBlocked = show.blocked || (!show.passed && blockedMsg?.includes('уже проходили'))
      return (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border p-8 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto text-2xl font-bold ${show.passed?'bg-emerald-100 text-emerald-700':'bg-amber-100 text-amber-700'}`}>{show.score ?? 0}%</div>
          <h2 className="text-2xl font-bold mt-4 dark:text-white">{show.blocked ? 'Прохождение ограничено' : show.passed?'Тест пройден!':'Тест завершён'}</h2>
          <p className="text-slate-500 mt-2">{show.blocked ? (blockedMsg || 'Вы уже сдавали этот тест — только один раз.') : `Набрано ${show.earned ?? 0} из ${show.total ?? 0} баллов`}</p>
          {show.details?.length>0 && <div className="mt-6 text-left space-y-2">
            {show.details.map((d:any)=>(
              <div key={d.question_id} className={`p-3 rounded-xl border ${d.correct?'bg-emerald-50 border-emerald-200':'bg-red-50 border-red-200'}`}>Вопрос {d.question_id}: {d.correct?'Верно':'Неверно'} (+{d.points})</div>
            ))}
          </div>}
          <div className="mt-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">Повторное прохождение запрещено — тест можно пройти только один раз.</div>
          <a href="/tests" className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-slate-900 text-white">К тестам</a>
        </div>
      )
    }
    if(alreadyAttempted && blockedMsg){
      return (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border p-8 text-center">
          <h2 className="text-xl font-bold dark:text-white">Тест уже пройден</h2>
          <p className="text-slate-500 mt-2">{blockedMsg}</p>
          <a href="/tests" className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-slate-900 text-white">К тестам</a>
        </div>
      )
    }
  }
  const q = test.questions[qi]
  const left = q ? (leftMap[String(q.id)] ?? perQ) : 0
  const answeredCount = test.questions.filter((x:any)=>answers[x.id]!==undefined && answers[x.id]!=='' && (!Array.isArray(answers[x.id]) || answers[x.id].length>0)).length
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {fromPath && <Link to={fromPath} className="inline-block px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700">← Вернуться к уроку</Link>}
      <div className="bg-white rounded-2xl border p-6">
        <h1 className="text-2xl font-bold">{test.title}</h1>
        <p className="text-slate-500">{test.description}</p>
        <div className="text-sm mt-2">Проходной балл: {test.pass_score}% • Вопрос {qi+1} из {test.questions.length} • Отвечено: {answeredCount}{perQ>0 && ` • ⏱ ${perQ}с на вопрос`}</div>
        <div className="mt-3 h-2 rounded-full bg-slate-100 overflow-hidden">
          <div className="h-full bg-violet-600 transition-all" style={{width:`${((qi+1)/test.questions.length)*100}%`}} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {test.questions.map((x:any,i:number)=>(
            <button key={x.id} onClick={()=>setQi(i)} aria-label={`Вопрос ${i+1}`}
              className={`w-8 h-8 rounded-lg text-xs font-bold ${i===qi ? 'bg-violet-600 text-white' : answers[x.id]!==undefined && answers[x.id]!=='' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
              {i+1}
            </button>
          ))}
        </div>
      </div>
      {q && (
      <div key={q.id} className="bg-white rounded-2xl border p-5 animate-slide">
        <div className="flex items-start gap-2">
          <div className="font-semibold flex-1">#{qi+1} {q.text} <span className="text-xs px-2 py-1 rounded-full bg-slate-100 ml-2">{q.points} балл</span> <button onClick={()=>speak(`Вопрос ${qi+1}. ${q.text}. Варианты: ${(q.options||[]).map((o:any)=>o.text).join(', ')}`)} className="ml-1 px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-violet-100 text-xs" title="Прочитать вслух">🔊</button>
            <button onClick={()=>{
              setAutoRead(v=>{ try{ localStorage.setItem('edu-auto-read', v?'0':'1') }catch{}; return !v })
            }} aria-pressed={autoRead} title="Читать каждый вопрос вслух автоматически" className={`ml-1 px-2 py-0.5 rounded-lg text-xs font-bold ${autoRead ? 'bg-violet-600 text-white' : 'bg-slate-100'}`}>{autoRead ? '🔊 Авто' : '🔇 Авто'}</button>
          </div>
          {perQ>0 && (
            <span className={`shrink-0 font-mono font-bold text-xl px-3 py-1 rounded-xl ${left<=5 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700'}`} role="timer" title="Осталось на вопрос">0:{String(Math.max(0,left)).padStart(2,'0')}</span>
          )}
        </div>
        {perQ>0 && (
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${left<=5 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width:`${(Math.max(0,left)/perQ)*100}%`}} />
          </div>
        )}
        <div className="mt-3 space-y-2">
          {(q.type==='single' || q.type==='true_false') && q.options.map((o:any)=>(
            <label key={o.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${answers[q.id]!==undefined && String(answers[q.id])===String(o.id)?'border-violet-600 bg-violet-50':'bg-slate-50 hover:bg-white'}`}>
              <input type="radio" name={`q${q.id}`} checked={answers[q.id]!==undefined && String(answers[q.id])===String(o.id)} onChange={()=>{
                setAnswers(a=>({...a,[q.id]:o.id}))
                // автовопрос: выбрал — едем дальше (на последнем остаёмся под кнопкой отправки)
                const fromQi = qi
                setTimeout(()=>{ setQi(cur=> cur===fromQi && cur+1 < test.questions.length ? cur+1 : cur) }, 650)
              }} autoComplete="off"/>
              <span>{o.text}</span>
            </label>
          ))}
          {q.type==='multiple' && q.options.map((o:any)=>(
            <label key={o.id} className="flex items-center gap-3 p-3 rounded-xl border bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={(answers[q.id]||[]).includes(o.id)} onChange={e=>{
                const cur=new Set(answers[q.id]||[])
                if(e.target.checked) cur.add(o.id); else cur.delete(o.id)
                setAnswers(a=>({...a,[q.id]:Array.from(cur)}))
              }}/>
              <span>{o.text}</span>
            </label>
          ))}
          {q.type==='text' && <input value={answers[q.id]||''} onChange={e=>setAnswers(a=>({...a,[q.id]:e.target.value}))} placeholder="Ваш ответ" className="w-full px-4 py-2.5 rounded-xl border bg-slate-50"/>}
        </div>
      </div>
      )}
      <div className="text-center text-xs text-slate-400">Выбрал ответ — вопрос сменится сам • вернуться можно по точкам выше</div>
      {qi+1 >= test.questions.length && (
        <button onClick={submit} className="w-full py-3 rounded-xl bg-violet-600 text-white font-bold text-lg">Отправить ответы</button>
      )}
    </div>
  )
}
