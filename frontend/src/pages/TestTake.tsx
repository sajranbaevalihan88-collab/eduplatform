import { useEffect, useRef, useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { useAccessibility, toast } from '../context/UIContext'
import { useLang, type Lang } from '../context/LangContext'
import { enableShotGuard, requestGuardFullscreen, disableShotGuard, supportsFullscreen } from '../utils/shotGuard'
import { playUiSound } from '../utils/sound'

const MAX_TEST_VIOLATIONS = 3
const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function formatPoints(n: number, lang: Lang): string {
  const num = Number(n) || 1
  if (lang === 'en') return `${num} ${num === 1 ? 'pt' : 'pts'}`
  if (lang === 'kg') return `${num} упай`
  const mod10 = num % 10
  const mod100 = num % 100
  if (mod10 === 1 && mod100 !== 11) return `${num} балл`
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${num} балла`
  return `${num} баллов`
}

export default function TestTake(){
  const {id}=useParams()
  const {t, lang}=useLang()
  const [test,setTest]=useState<any>(null)
  const [answers,setAnswers]=useState<Record<string,any>>({})
  const answersRef=useRef<Record<string,any>>({})
  answersRef.current=answers
  const [result,setResult]=useState<any>(null)
  const [alreadyAttempted,setAlreadyAttempted]=useState(false)
  const [blockedMsg,setBlockedMsg]=useState<string|null>(null)
  const [qi,setQi]=useState(0)
  const [leftMap,setLeftMap]=useState<Record<string,number>>({})
  const [searchParams]=useSearchParams()
  const rawFrom=searchParams.get('from')||''
  const fromPath=rawFrom.startsWith('/') && !rawFrom.startsWith('//') && !rawFrom.startsWith('/\\') ? rawFrom : null
  const {speech,autoRead,toggleAutoRead,speak}=useAccessibility()
  const [violations,setViolations]=useState(0)
  const [started,setStarted]=useState(false)
  const autoSubmittedRef=useRef(false)
  useEffect(()=>{
    setViolations(0)
    setStarted(false)
    autoSubmittedRef.current=false
    disableShotGuard()
  },[id])
  useEffect(()=>{
    if(!test || !started || result || alreadyAttempted) return
    const off=enableShotGuard(()=>{
      setViolations(v=>{
        const next=v+1
        if(next>=MAX_TEST_VIOLATIONS && !autoSubmittedRef.current){
          autoSubmittedRef.current=true
          toast(`Превышен лимит нарушений (${MAX_TEST_VIOLATIONS}/${MAX_TEST_VIOLATIONS}) — тест завершён автоматически!`,'error')
          setTimeout(()=>doSubmit(answersRef.current), 150)
        }
        return next
      })
    },{
      warnTitle:t('tt_shot_warn_title'), warnMsg:t('tt_shot_warn_msg'),
      blurTitle:t('tt_shot_blur_title'), blurMsg:t('tt_shot_blur_msg'),
      requireFullscreen: supportsFullscreen(),
      maxViolations: MAX_TEST_VIOLATIONS,
    })
    return ()=>{ off(); if(document.fullscreenElement) document.exitFullscreen?.().catch(()=>{}) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[test?.id, started, result, alreadyAttempted])
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
  },[id])
  const [submitting,setSubmitting]=useState(false)
  const doSubmit=async(ans:Record<string,any>)=>{
    if(submitting) return
    setSubmitting(true)
    try{
      const r=await client.post(`/tests/${id}/submit/`,{answers:ans})
      setResult(r.data)
      if(r.data.passed) playUiSound('ui-win'); else playUiSound('ui-notify')
      setAlreadyAttempted(true)
      localStorage.setItem(`test_done_${id}`,'1')
      if(r.data.assignments_done) toast(t('cls_submitted'),'success')
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
  const perQ = test?.time_per_question || 0
  useEffect(()=>{
    if(!test || !started || result || alreadyAttempted || !perQ) return
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
  },[test?.id, started, qi, result, alreadyAttempted])

  useEffect(()=>{
    if(!test || !started || result || alreadyAttempted || !perQ) return
    const q = test.questions?.[qi]
    if(!q) return
    if((leftMap[String(q.id)] ?? perQ) <= 0){
      if(qi + 1 < test.questions.length) setQi(qi + 1)
      else submit()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[leftMap, qi, started])

  useEffect(()=>{
    if(!test || !started || result || alreadyAttempted || !speech || !autoRead) return
    const q = test.questions?.[qi]
    if(!q) return
    speak(`${t('tt_q')} ${qi+1}. ${q.text}. ${t('tt_variants')}: ${(q.options||[]).map((o:any)=>o.text).join(', ')}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[test?.id, started, qi, autoRead, speech])

  if(!test) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="skeleton h-36 rounded-2xl" />
      <div className="skeleton h-64 rounded-2xl" />
    </div>
  )

  if(!started && !alreadyAttempted && !result){
    const needsFs = supportsFullscreen()
    return (
      <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 shadow-sm space-y-5">
        {fromPath && <Link to={fromPath} className="inline-block text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">← {t('tt_back_lesson')}</Link>}
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-100 dark:border-indigo-900/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl shrink-0">🛡️</div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white break-words">{test.title}</h1>
            {test.description && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{test.description}</p>}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
            <div className="text-lg font-extrabold text-slate-900 dark:text-white">{test.questions?.length || 0}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Вопросов</div>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
            <div className="text-lg font-extrabold text-slate-900 dark:text-white">{test.pass_score}%</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{t('tt_pass_score')}</div>
          </div>
          <div className="col-span-2 sm:col-span-1 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80">
            <div className="text-lg font-extrabold text-slate-900 dark:text-white">{perQ > 0 ? `${perQ}с` : '∞'}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">На вопрос</div>
          </div>
        </div>
        <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-xs sm:text-sm text-amber-900 dark:text-amber-200 space-y-1.5">
          <div className="font-bold">Правила защищённого тестирования:</div>
          <ul className="list-disc pl-5 space-y-1">
            {needsFs && <li>Тест откроется строго в <b>полноэкранном режиме</b> — при выходе вопросы мгновенно скроются.</li>}
            <li>Попытка сделать скриншот (<b>Win+Shift+S</b>, <b>PrintScreen</b>, <b>Alt+Tab</b>) или открыть DevTools мгновенно затемняет экран и фиксируется как нарушение.</li>
            <li>После <b>{MAX_TEST_VIOLATIONS} нарушений</b> тест автоматически завершается и отправляется на проверку.</li>
          </ul>
        </div>
        <div className="flex flex-col sm:flex-row gap-2.5">
          <Link to={fromPath || '/tests'} className="sm:w-auto px-5 py-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm text-center transition">
            ← {t('back')}
          </Link>
          <button
            type="button"
            onClick={async()=>{
              if(needsFs) await requestGuardFullscreen()
              setStarted(true)
            }}
            className="flex-1 py-3.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-display font-bold text-base shadow-md transition"
          >
            {needsFs ? '🛡️ Начать тест в полноэкранном режиме' : '🛡️ Начать защищённый тест'}
          </button>
        </div>
      </div>
    )
  }

  if(alreadyAttempted || result){
    const show = result
    if(show){
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
          <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 sm:p-8 text-center shadow-sm">
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto text-3xl font-extrabold border-4 ${show.passed ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800' : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800'}`}>
              {show.score ?? 0}%
            </div>
            <h2 className="text-2xl font-display font-bold mt-4 text-slate-900 dark:text-white">{show.blocked ? t('tt_limited') : show.passed ? t('tt_passed') : t('tt_done_title')}</h2>
            <p className="text-slate-600 dark:text-slate-300 mt-2">{show.blocked ? (blockedMsg || t('tt_already_msg')) : `${t('tt_earned_pre')} ${show.earned ?? 0} ${t('tt_earned_mid')} ${show.total ?? 0} ${t('tt_earned_post')}`}</p>
            {violations > 0 && <p data-testid="tt-sshot-count" className="mt-2 text-sm font-semibold text-red-600 dark:text-red-400">🚫 {t('tt_shot_violations')}: {violations}</p>}
            <div className="mt-6 p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-sm text-amber-800 dark:text-amber-200">
              {t('tt_no_retry')}
            </div>
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              {fromPath && <Link to={fromPath} className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-semibold transition">← {t('tt_back_lesson')}</Link>}
              <Link to="/tests" className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-sm transition">{t('tt_to_tests')}</Link>
            </div>
          </div>
        </div>
      )
    }
    if(alreadyAttempted && blockedMsg){
      return (
        <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-8 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('tt_already_done')}</h2>
          <p className="text-slate-600 dark:text-slate-400 mt-2">{blockedMsg}</p>
          <Link to="/tests" className="mt-5 inline-block px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition">{t('tt_to_tests')}</Link>
        </div>
      )
    }
  }

  const q = test.questions[qi]
  const left = q ? (leftMap[String(q.id)] ?? perQ) : 0
  const answeredCount = test.questions.filter((x:any)=>answers[x.id]!==undefined && answers[x.id]!=='' && (!Array.isArray(answers[x.id]) || answers[x.id].length>0)).length
  const totalQ = test.questions.length || 1

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {fromPath && (
        <Link to={fromPath} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition">
          ← {t('tt_back_lesson')}
        </Link>
      )}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 dark:text-white break-words">{test.title}</h1>
            {test.description && <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base mt-0.5">{test.description}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span data-testid="tt-shield-chip" className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800">
              🛡 {t('tt_shield_on')}
            </span>
            {violations > 0 && (
              <span data-testid="tt-violations-chip" className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800">
                🚫 {t('tt_shot_violations')}: {violations} / {MAX_TEST_VIOLATIONS}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs sm:text-sm mt-2.5 text-slate-600 dark:text-slate-300">
          {t('tt_pass_score')}: <b>{test.pass_score}%</b> • {t('tt_q')} <b>{qi+1}</b> {t('tt_of')} <b>{test.questions.length}</b> • {t('tt_answered')}: <b>{answeredCount}</b>{perQ>0 && ` • ⏱ ${perQ}${t('tt_per_q')}`}
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300" style={{width:`${((qi+1)/totalQ)*100}%`}} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
          {test.questions.map((x:any,i:number)=>{
            const isCur = i === qi
            const isAns = answers[x.id] !== undefined && answers[x.id] !== '' && (!Array.isArray(answers[x.id]) || answers[x.id].length > 0)
            return (
              <button
                key={x.id}
                type="button"
                onClick={()=>setQi(i)}
                aria-label={`${t('tt_q')} ${i+1}`}
                aria-current={isCur ? 'step' : undefined}
                className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-sm font-bold shrink-0 border transition ${
                  isCur
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-300 dark:ring-indigo-500/40'
                    : isAns
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 dark:hover:bg-emerald-900/60'
                      : 'bg-slate-100 text-slate-600 border-transparent hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {i+1}
              </button>
            )
          })}
        </div>
      </div>

      {q && (
      <div key={q.id} className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm motion-safe:animate-slide">
        <div className="flex items-start gap-2.5">
          <div className="font-semibold flex-1 text-base sm:text-lg text-slate-900 dark:text-white leading-snug">
            <span className="text-indigo-600 dark:text-indigo-400 mr-1.5">#{qi+1}</span>
            {q.text}
            <span className="inline-block align-middle text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700 ml-2">
              {formatPoints(q.points, lang)}
            </span>
            <button
              type="button"
              onClick={()=>speak(`${t('tt_q')} ${qi+1}. ${q.text}. ${t('tt_variants')}: ${(q.options||[]).map((o:any)=>o.text).join(', ')}`)}
              className="ml-1.5 inline-flex items-center justify-center align-middle min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 hover:bg-indigo-100 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 border border-slate-200/70 dark:border-slate-700 text-base transition"
              title={t('tt_read_aloud')}
            >
              🔊
            </button>
            <button
              type="button"
              onClick={toggleAutoRead}
              aria-pressed={autoRead}
              title={t('tt_autoread_title')}
              className={`ml-1 inline-flex items-center justify-center align-middle px-2.5 min-h-[40px] rounded-xl text-xs font-bold border transition ${
                autoRead
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/70 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-700'
              }`}
            >
              {autoRead ? '🔊 Авто' : '🔇 Авто'}
            </button>
          </div>
          {perQ > 0 && (
            <span className={`shrink-0 font-mono font-bold text-lg sm:text-xl px-3 py-1 rounded-xl border ${left<=5 ? 'bg-red-50 text-red-600 border-red-200 motion-safe:animate-pulse dark:bg-red-950/60 dark:text-red-300 dark:border-red-800' : 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-white dark:border-slate-700'}`} role="timer" title={t('tt_left_title')}>
              0:{String(Math.max(0,left)).padStart(2,'0')}
            </span>
          )}
        </div>
        {perQ > 0 && (
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <div className={`h-full transition-all duration-1000 ${left<=5 ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width:`${(Math.max(0,left)/perQ)*100}%`}} />
          </div>
        )}
        <div className="mt-4 space-y-2.5">
          {(q.type==='single' || q.type==='true_false') && q.options.map((o:any, oi:number)=>{
            const checked = answers[q.id]!==undefined && String(answers[q.id])===String(o.id)
            return (
              <label
                key={o.id}
                className={`flex items-center gap-3 p-3.5 max-lg:min-h-[56px] rounded-xl border cursor-pointer text-sm sm:text-base transition ${
                  checked
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-1 ring-indigo-500/30 dark:bg-indigo-950/60 dark:border-indigo-400 dark:text-white'
                    : 'border-slate-200 bg-slate-50/90 text-slate-800 hover:bg-white hover:border-indigo-300 dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:border-slate-500'
                }`}
              >
                <input
                  type="radio"
                  name={`q${q.id}`}
                  value={o.id}
                  checked={checked}
                  className="w-4 h-4 accent-indigo-600 shrink-0"
                  onChange={()=>{
                    const next = {...answers, [q.id]: o.id}
                    setAnswers(next)
                    const fromQi = qi
                    const isLast = fromQi + 1 >= test.questions.length
                    setTimeout(()=>{
                      if(result || alreadyAttempted) return
                      if(isLast) doSubmit(next)
                      else setQi(cur=> cur===fromQi ? cur+1 : cur)
                    }, 650)
                  }}
                  autoComplete="off"
                />
                <span className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shrink-0 ${
                  checked
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  {LETTERS[oi] || oi + 1}
                </span>
                <span className="min-w-0 flex-1 break-words font-medium">{o.text}</span>
              </label>
            )
          })}
          {q.type==='multiple' && q.options.map((o:any, oi:number)=>{
            const checked = (answers[q.id]||[]).includes(o.id)
            return (
              <label
                key={o.id}
                className={`flex items-center gap-3 p-3.5 max-lg:min-h-[56px] rounded-xl border cursor-pointer text-sm sm:text-base transition ${
                  checked
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-950 ring-1 ring-indigo-500/30 dark:bg-indigo-950/60 dark:border-indigo-400 dark:text-white'
                    : 'border-slate-200 bg-slate-50/90 text-slate-800 hover:bg-white hover:border-indigo-300 dark:bg-slate-800/70 dark:border-slate-700 dark:text-slate-100 dark:hover:bg-slate-800 dark:hover:border-slate-500'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  className="w-4 h-4 accent-indigo-600 shrink-0"
                  onChange={e=>{
                    const cur=new Set(answers[q.id]||[])
                    if(e.target.checked) cur.add(o.id); else cur.delete(o.id)
                    setAnswers(a=>({...a,[q.id]:Array.from(cur)}))
                  }}
                />
                <span className={`w-6 h-6 rounded-md text-xs font-bold flex items-center justify-center shrink-0 ${
                  checked
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-200/80 text-slate-600 dark:bg-slate-700 dark:text-slate-300'
                }`}>
                  {LETTERS[oi] || oi + 1}
                </span>
                <span className="min-w-0 flex-1 break-words font-medium">{o.text}</span>
              </label>
            )
          })}
          {q.type==='multiple' && (
            <button
              type="button"
              data-testid="tt_nextbtn"
              onClick={()=>{
                if(result||alreadyAttempted) return
                if(qi+1>=test.questions.length) doSubmit(answers)
                else setQi(qi+1)
              }}
              disabled={!(answers[q.id]||[]).length}
              title={t('tt_next_title')}
              className={`w-full py-3 rounded-xl font-bold text-sm sm:text-base transition ${
                ((answers[q.id]||[]).length)
                  ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm'
                  : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 cursor-not-allowed'
              }`}
            >
              {t('tt_next')}
            </button>
          )}
          {q.type==='text' && (
            <div className="text-sm px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/60">
              Вопрос старого типа (текст) — оценка не требуется, жми «Отправить ответы».
            </div>
          )}
        </div>

        {/* Удобная навигация Назад / Далее для ПК */}
        <div className="hidden lg:flex items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setQi(cur => Math.max(0, cur - 1))}
            disabled={qi === 0}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {t('tt_prev')}
          </button>
          <span className="text-xs text-slate-400 dark:text-slate-500">{t('tt_hint')}</span>
          {qi + 1 < test.questions.length ? (
            <button
              type="button"
              onClick={() => setQi(cur => Math.min(test.questions.length - 1, cur + 1))}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition"
            >
              {t('tt_next')}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={answeredCount === 0 || submitting}
              className={`px-5 py-2.5 rounded-xl font-bold text-sm transition ${
                answeredCount === 0
                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
              }`}
            >
              {t('tt_submit')}
            </button>
          )}
        </div>
      </div>
      )}

      {q && (
        <div className="lg:hidden sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 mt-4">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setQi(cur => Math.max(0, cur - 1))}
              disabled={qi === 0}
              aria-label={t('tt_prev')}
              className="min-h-[52px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-sm disabled:opacity-40 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white"
            >
              ←
            </button>
            <div className="flex-1 min-w-0 text-center">
              <div className="text-xs font-bold text-slate-600 dark:text-slate-300">{t('tt_q')} {qi + 1} {t('tt_of')} {test.questions.length}</div>
              <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuemin={1} aria-valuemax={test.questions.length} aria-valuenow={qi + 1}>
                <div className="h-full bg-indigo-600 transition-all" style={{ width: `${((qi + 1) / totalQ) * 100}%` }} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => setQi(cur => Math.min(test.questions.length - 1, cur + 1))}
              disabled={qi + 1 >= test.questions.length}
              aria-label={t('tt_next_title')}
              className="min-h-[52px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm disabled:opacity-40"
            >
              →
            </button>
          </div>
        </div>
      )}

      <div className="lg:hidden text-center text-xs text-slate-400 dark:text-slate-500">{t('tt_hint')}</div>
      {(qi + 1 >= test.questions.length || answeredCount === test.questions.length) && (
        <button
          type="button"
          data-testid="tt-submit"
          onClick={submit}
          disabled={answeredCount === 0 || submitting}
          title={answeredCount === 0 ? t('tt_need_answer') : undefined}
          className={`w-full py-3.5 rounded-xl font-bold text-base sm:text-lg transition ${
            answeredCount === 0
              ? 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
          }`}
        >
          {t('tt_submit')}
        </button>
      )}
    </div>
  )
}
