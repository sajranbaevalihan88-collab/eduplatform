import { useEffect, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { useAccessibility } from '../context/UIContext'
import { useLang } from '../context/LangContext'
import { enableShotGuard, requestGuardFullscreen, disableShotGuard } from '../utils/shotGuard'

export default function TestTake(){
  const {id}=useParams()
  const {t}=useLang()
  const [test,setTest]=useState<any>(null)
  const [answers,setAnswers]=useState<Record<string,any>>({})
  const [result,setResult]=useState<any>(null)
  const [alreadyAttempted,setAlreadyAttempted]=useState(false)
  const [blockedMsg,setBlockedMsg]=useState<string|null>(null)
  const [qi,setQi]=useState(0)
  const [leftMap,setLeftMap]=useState<Record<string,number>>({})
  const [searchParams]=useSearchParams()
  const fromPath=searchParams.get('from') && searchParams.get('from')!.startsWith('/') ? searchParams.get('from')! : null
  const {speech,autoRead,toggleAutoRead,speak}=useAccessibility()
  const [violations,setViolations]=useState(0)
  useEffect(()=>{
    setViolations(0)
    disableShotGuard()
  },[id])
  useEffect(()=>{
    if(!test || result || alreadyAttempted) return
    const off=enableShotGuard(()=>setViolations(v=>v+1),{
      warnTitle:t('tt_shot_warn_title'), warnMsg:t('tt_shot_warn_msg'),
      blurTitle:t('tt_shot_blur_title'), blurMsg:t('tt_shot_blur_msg')
    })
    // fullscreen нужен жест пользователя: пробуем сразу (жест перехода по ссылке иногда жив),
    // иначе вешаем на первый клик/тап в тесте
    requestGuardFullscreen()
    const once=()=>requestGuardFullscreen()
    window.addEventListener('pointerdown',once,{once:true,capture:true})
    return ()=>{ off(); window.removeEventListener('pointerdown',once,{capture:true}); if(document.fullscreenElement) document.exitFullscreen?.().catch(()=>{}) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[test?.id, result, alreadyAttempted])
  useEffect(()=>{
    if(speech && autoRead && test?.questions?.length){
      speak(`${t('tt_speak_test')} ${test.title}. ${t('tt_speak_qs')}: ${test.questions.length}. ${t('tt_speak_hint')}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[speech, autoRead, test?.id])
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
  const [submitting,setSubmitting]=useState(false)
  const doSubmit=async(ans:Record<string,any>)=>{
    if(submitting) return
    setSubmitting(true)
    try{
      const r=await client.post(`/tests/${id}/submit/`,{answers:ans})
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
        setBlockedMsg(msg||t('tt_send_err'))
      }
    }finally{
      setSubmitting(false)
    }
  }
  const submit=()=>doSubmit(answers)
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
    if(!test || result || alreadyAttempted || !speech || !autoRead) return
    const q = test.questions?.[qi]
    if(!q) return
    speak(`${t('tt_q')} ${qi+1}. ${q.text}. ${t('tt_variants')}: ${(q.options||[]).map((o:any)=>o.text).join(', ')}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[test?.id, qi, autoRead, speech])

  if(!test) return <div>{t('loading')}</div>
  if(alreadyAttempted || result){
    // если уже проходил — показываем результат один раз без кнопки "Пройти снова"
    const show = result
    if(show){
      const isBlocked = show.blocked || (!show.passed && blockedMsg?.includes('уже проходили'))
      const perfect = !show.blocked && !!show.passed && (show.score ?? 0) >= 100
      const confetti = perfect ? Array.from({ length: 80 }, (_, i) => {
        const colors = ['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#fde047']
        return { left: (i * 97) % 100, delay: ((i * 37) % 20) / 10, dur: 2.6 + ((i * 53) % 20) / 10, size: 6 + ((i * 29) % 8), color: colors[i % colors.length], round: i % 3 === 0 }
      }) : []
      return (
        <div className="relative motion-safe:animate-scaleIn">
          {perfect && (
            <div className="pointer-events-none fixed inset-0 overflow-hidden z-50" aria-hidden="true" data-testid="tt-confetti">
              {confetti.map((c: any, i: number) => (
                <span key={i} className="confetti-piece" style={{
                  left: `${c.left}%`, width: c.size, height: c.round ? c.size : c.size * 0.55,
                  background: c.color, borderRadius: c.round ? '50%' : '2px',
                  animationDelay: `${c.delay}s`, animationDuration: `${c.dur}s`,
                }} />
              ))}
            </div>
          )}
          <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 dark:border-slate-700 rounded-2xl border p-6 sm:p-8 text-center">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto text-2xl font-bold ${show.passed?'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300':'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'}`}>{show.score ?? 0}%</div>
          <h2 className="text-2xl font-bold mt-4 dark:text-white">{show.blocked ? t('tt_limited') : show.passed?t('tt_passed'):t('tt_done_title')}</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">{show.blocked ? (blockedMsg || t('tt_already_msg')) : `${t('tt_earned_pre')} ${show.earned ?? 0} ${t('tt_earned_mid')} ${show.total ?? 0} ${t('tt_earned_post')}`}</p>
          {violations>0 && <p data-testid="tt-sshot-count" className="mt-2 text-sm font-semibold text-red-600 dark:text-red-300">🚫 {t('tt_shot_violations')}: {violations}</p>}
          <div className="mt-6 p-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">{t('tt_no_retry')}</div>
          <a href="/tests" className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-blue-700 text-white">{t('tt_to_tests')}</a>
          </div>
        </div>
      )
    }
    if(alreadyAttempted && blockedMsg){
      return (
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border p-8 text-center">
          <h2 className="text-xl font-bold dark:text-white">{t('tt_already_done')}</h2>
          <p className="text-slate-500 mt-2">{blockedMsg}</p>
          <a href="/tests" className="mt-4 inline-block px-5 py-2.5 rounded-xl bg-blue-700 text-white">{t('tt_to_tests')}</a>
        </div>
      )
    }
  }
  const q = test.questions[qi]
  const left = q ? (leftMap[String(q.id)] ?? perQ) : 0
  const answeredCount = test.questions.filter((x:any)=>answers[x.id]!==undefined && answers[x.id]!=='' && (!Array.isArray(answers[x.id]) || answers[x.id].length>0)).length
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {fromPath && <Link to={fromPath} className="inline-block px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">{t('tt_back_lesson')}</Link>}
      <div className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-2xl border p-4 sm:p-6">
        <h1 className="text-xl sm:text-2xl font-bold dark:text-white">{test.title}</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base">{test.description}</p>
          <div className="text-xs sm:text-sm mt-2 dark:text-slate-300">{t('tt_pass_score')}: {test.pass_score}% • {t('tt_q')} {qi+1} {t('tt_of')} {test.questions.length} • {t('tt_answered')}: {answeredCount}{perQ>0 && ` • ⏱ ${perQ}${t('tt_per_q')}`}</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span data-testid="tt-shield-chip" className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800">🛡 {t('tt_shield_on')}</span>
          {violations>0 && <span data-testid="tt-violations-chip" className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800">🚫 {t('tt_shot_violations')}: {violations}</span>}
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div className="h-full bg-blue-600 transition-all" style={{width:`${((qi+1)/test.questions.length)*100}%`}} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1 sm:gap-2">
          {test.questions.map((x:any,i:number)=>(
            <button key={x.id} onClick={()=>setQi(i)} aria-label={`${t('tt_q')} ${i+1}`}
              className={`w-11 h-11 rounded-lg text-sm font-bold shrink-0 ${i===qi ? 'bg-blue-600 text-white' : answers[x.id]!==undefined && answers[x.id]!=='' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300'}`}>
              {i+1}
            </button>
          ))}
        </div>
      </div>
      {q && (
      <div key={q.id} className="bg-white dark:bg-slate-800 dark:border-slate-700 rounded-2xl border p-4 sm:p-5 motion-safe:animate-slide">
        <div className="flex items-start gap-2">
          <div className="font-semibold flex-1 text-base sm:text-lg dark:text-white">#{qi+1} {q.text} <span className="text-xs px-2 py-1 rounded-full bg-slate-100 dark:bg-slate-700 dark:text-slate-300 ml-2">{q.points} {t('points')}</span> <button onClick={()=>speak(`${t('tt_q')} ${qi+1}. ${q.text}. ${t('tt_variants')}: ${(q.options||[]).map((o:any)=>o.text).join(', ')}`)} className="ml-1 inline-flex items-center justify-center align-middle min-w-[44px] min-h-[44px] rounded-xl bg-slate-100 hover:bg-blue-100 dark:bg-slate-700 dark:text-white text-base" title={t('tt_read_aloud')}>🔊</button>
            <button onClick={toggleAutoRead} aria-pressed={autoRead} title={t('tt_autoread_title')} className={`ml-1 inline-flex items-center justify-center align-middle min-w-[44px] min-h-[44px] rounded-xl text-sm font-bold ${autoRead ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-700 dark:text-white'}`}>{autoRead ? '🔊 Авто' : '🔇 Авто'}</button>
          </div>
          {perQ>0 && (
            <span className={`shrink-0 font-mono font-bold text-lg sm:text-xl px-2.5 sm:px-3 py-1 rounded-xl ${left<=5 ? 'bg-red-100 text-red-600 motion-safe:animate-pulse dark:bg-red-900/40 dark:text-red-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-white'}`} role="timer" title={t('tt_left_title')}>0:{String(Math.max(0,left)).padStart(2,'0')}</span>
          )}
        </div>
        {perQ>0 && (
          <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${left<=5 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width:`${(Math.max(0,left)/perQ)*100}%`}} />
          </div>
        )}
        <div className="mt-3 space-y-2">
          {(q.type==='single' || q.type==='true_false') && q.options.map((o:any)=>(
            <label key={o.id} className={`flex items-center gap-2 sm:gap-3 p-3 rounded-xl border cursor-pointer text-sm sm:text-base dark:text-white ${answers[q.id]!==undefined && String(answers[q.id])===String(o.id)?'border-blue-600 bg-blue-50 dark:bg-blue-900/30':'bg-slate-50 hover:bg-white dark:bg-slate-700/50 dark:border-slate-600'}`}>
              <input type="radio" name={`q${q.id}`} value={o.id} checked={answers[q.id]!==undefined && String(answers[q.id])===String(o.id)} onChange={()=>{
                const next = {...answers, [q.id]: o.id}
                setAnswers(next)
                // автовопрос: выбрал — едем дальше; на последнем — автосдача
                const fromQi = qi
                const isLast = fromQi + 1 >= test.questions.length
                setTimeout(()=>{
                  if(result || alreadyAttempted) return
                  if(isLast) doSubmit(next)
                  else setQi(cur=> cur===fromQi ? cur+1 : cur)
                }, 650)
              }} autoComplete="off"/>
              <span>{o.text}</span>
            </label>
          ))}
          {q.type==='multiple' && q.options.map((o:any)=>(
            <label key={o.id} className="flex items-center gap-2 sm:gap-3 p-3 rounded-xl border bg-slate-50 dark:bg-slate-700/50 dark:border-slate-600 dark:text-white cursor-pointer text-sm sm:text-base">
              <input type="checkbox" checked={(answers[q.id]||[]).includes(o.id)} onChange={e=>{
                const cur=new Set(answers[q.id]||[])
                if(e.target.checked) cur.add(o.id); else cur.delete(o.id)
                setAnswers(a=>({...a,[q.id]:Array.from(cur)}))
              }}/>
              <span>{o.text}</span>
            </label>
          ))}
          {q.type==='multiple' && (
            <button data-testid="tt_nextbtn" onClick={()=>{
              if(result||alreadyAttempted) return
              if(qi+1>=test.questions.length) doSubmit(answers)
              else setQi(qi+1)
            }} disabled={!(answers[q.id]||[]).length} title={t('tt_next_title')} className={`w-full py-2.5 rounded-xl font-bold text-sm sm:text-base ${((answers[q.id]||[]).length) ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500 cursor-not-allowed'}`}>{t('tt_next')}</button>
          )}
          {q.type==='text' && <div className="text-sm px-4 py-2.5 rounded-xl bg-amber-50 text-amber-700 border border-amber-200">Вопрос старого типа (текст) — оценка не требуется, жми «Отправить ответы».</div>}
        </div>
      </div>
      )}
      <div className="text-center text-xs text-slate-400">{t('tt_hint')}</div>
      {qi+1 >= test.questions.length && (
        <button data-testid="tt-submit" onClick={submit} disabled={answeredCount===0} title={answeredCount===0? t('tt_need_answer'):undefined} className={`w-full py-3 rounded-xl font-bold text-lg ${answeredCount===0 ? 'bg-slate-300 dark:bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-blue-600 text-white font-bold text-lg hover:bg-blue-700'}`}>{t('tt_submit')}</button>
      )}
    </div>
  )
}
