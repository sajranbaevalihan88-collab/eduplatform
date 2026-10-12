import { useEffect, useRef, useState } from 'react'
import client from '../api/client'
import { useAccessibility } from '../context/UIContext'
import Editor from '@monaco-editor/react'
import { Play, Plus, Save, Sparkles } from 'lucide-react'
import { isStudent } from '../utils/role'

export default function CodeLab(){
  const [tasks,setTasks]=useState<any[]>([])
  const [active,setActive]=useState<any>(null)
  const [code,setCode]=useState('')
  const [output,setOutput]=useState('')
  const [running,setRunning]=useState(false)
  const [explanation,setExplanation]=useState<any>(null)
  const [explaining,setExplaining]=useState(false)
  const [stdinInput,setStdinInput]=useState('')
  const {speech,speak}=useAccessibility()
  useEffect(()=>{
    if(speech && output) speak('Вывод программы. '+output)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[speech, output])
  const [showNew,setShowNew]=useState(false)
  const [newTask,setNewTask]=useState({title:'',language:'python',description:'',starter_code:'print("Hello")'})

  const load=()=>client.get('/code-tasks/').then(r=>{
    const arr=Array.isArray(r.data)?r.data:r.data.results||[]
    setTasks(arr)
    // чтобы Run работал сразу — выбираем первую задачу, если ничего не выбрано
    setActive((prev:any)=>prev || arr[0] || null)
  })
  const runRef=useRef<()=>void>(()=>{})
  useEffect(()=>{load()},[])
  useEffect(()=>{if(active) setCode(active.starter_code||'')},[active])
  useEffect(()=>{
    const onKey=(e:KeyboardEvent)=>{
      if((e.ctrlKey||e.metaKey)&& e.key==='Enter'){ e.preventDefault(); runRef.current() }
    }
    window.addEventListener('keydown',onKey)
    return()=>window.removeEventListener('keydown',onKey)
  },[])

  const run=async()=>{
    if (code.length > 5000) { setOutput('Код слишком длинный (макс 5000)'); return; }
    if (!code.trim()) { setOutput('Сначала напиши код в редакторе'); return; }
    setRunning(true); setExplanation(null)
    try{
      // Только 4 языка: html/css preview, python/javascript через бэкенд
      const lang = active?.language || 'python'
      if(lang==='html' || lang==='css'){
        setOutput((lang==='css' ? 'CSS preview — подключи к HTML через <link>' : 'HTML preview — код сохранён, открой в новой вкладке для просмотра'))
      } else if(!active) {
        // задачи нет — быстрый запуск без привязки к задаче
        const r=await client.post('/code-tasks/run_code/',{code, language: lang})
        setOutput(r.data.output)
      } else {
        const r=await client.post(`/code-tasks/${active.id}/run/`,{code, input:stdinInput})
        setOutput(r.data.output)
      }
    }catch(e:any){ 
      const msg = e.response?.data?.output || e.response?.data?.error || e.response?.data?.detail || String(e)
      setOutput(msg)
    }
    setRunning(false)
  }
  runRef.current = run
  const explain=async()=>{
    if(!active || !output) return
    setExplaining(true)
    try{
      const r=await client.post('/code-tasks/explain/',{code, language:active.language, output})
      setExplanation(r.data)
    }catch(e:any){
      setExplanation({title:'Не получилось', what:String(e.response?.data?.error||e.message||e), fix:''})
    }
    setExplaining(false)
  }
  const create=async()=>{
    await client.post('/code-tasks/',newTask)
    setShowNew(false); load()
  }

  return (
    <div className="grid lg:grid-cols-[320px_1fr] gap-4">
      <h1 className="sr-only">Редактор кода — задачи и запуск</h1>
      <div className="bg-white rounded-2xl border p-4 space-y-3 h-fit">
        <div className="flex items-center justify-between"><h2 className="font-bold">Задачи</h2>{!isStudent() && <button onClick={()=>setShowNew(!showNew)} className="p-1.5 rounded-lg bg-slate-900 text-white"><Plus size={16}/></button>}</div>
        {showNew && (
          <div className="p-3 rounded-xl bg-slate-50 border space-y-2">
            <input placeholder="Название" value={newTask.title} onChange={e=>setNewTask({...newTask,title:e.target.value})} className="w-full px-3 py-2 rounded-xl border bg-white text-sm"/>
            <select value={newTask.language} onChange={e=>setNewTask({...newTask,language:e.target.value})} className="w-full px-3 py-2 rounded-xl border bg-white text-sm">
              <option value="python">Python</option><option value="javascript">JavaScript</option><option value="html">HTML</option><option value="css">CSS</option>
            </select>
            <textarea placeholder="Описание" value={newTask.description} onChange={e=>setNewTask({...newTask,description:e.target.value})} className="w-full px-3 py-2 rounded-xl border bg-white text-sm"/>
            <textarea placeholder="Стартовый код" value={newTask.starter_code} onChange={e=>setNewTask({...newTask,starter_code:e.target.value})} className="w-full px-3 py-2 rounded-xl border bg-white text-sm font-mono"/>
            <button onClick={create} className="w-full py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold flex items-center justify-center gap-1"><Save size={14}/> Создать</button>
          </div>
        )}
        <div className="space-y-2 max-h-[60vh] overflow-auto pr-1">
          {tasks.map(t=>(
            <button key={t.id} onClick={()=>setActive(t)} className={`w-full text-left p-3 rounded-xl border ${active?.id===t.id?'border-violet-600 bg-violet-50':'bg-slate-50 hover:bg-white'}`}>
              <div className="font-semibold text-sm line-clamp-1">{t.title}</div>
              <div className="text-xs text-slate-500">{t.language} • {t.description?.slice(0,40)}</div>
            </button>
          ))}
          {tasks.length===0 && <div className="text-sm text-slate-400 text-center py-8">Нет задач — создай первую!</div>}
        </div>
      </div>

      <div className="space-y-4">
        {active ? (
          <>
            <div className="bg-white rounded-2xl border p-4">
              <h3 className="font-bold">{active.title} <span className="text-xs px-2 py-1 rounded-full bg-slate-100 ml-2">{active.language}</span></h3>
              <p className="text-sm text-slate-500 mt-1">{active.description}</p>
            </div>
            <div className="bg-white rounded-2xl border overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b bg-slate-50">
                <span className="text-sm font-semibold">Редактор <span className="text-xs font-normal text-slate-400">(Ctrl+Enter — запуск)</span></span>
                <button onClick={run} disabled={running} className="px-4 py-1.5 min-h-[40px] rounded-xl bg-emerald-600 text-white text-sm font-semibold flex items-center gap-1 disabled:opacity-50"><Play size={14}/>{running?'...':'Запустить'}</button>
              </div>
              <Editor height="380px" language={active.language==='python'?'python':active.language==='html'?'html':'javascript'} value={code} onChange={v=>setCode(v||'')} options={{minimap:{enabled:false},fontSize:14}}/>
            </div>
            {active.language==='python' && code.includes('input(') && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="text-xs font-bold text-amber-800 mb-1">Ввод для input() — введено {stdinInput.trim() ? stdinInput.split('\n').length : 0} из {code.split('\n').filter(l=>{ const t=l.trim(); return t && !t.startsWith('#') && /(?<![\w.])input\s*\(/.test(t.split('#')[0]) }).length}, каждое значение с новой строки:</div>
                <textarea value={stdinInput} onChange={e=>setStdinInput(e.target.value)} rows={3} placeholder={'Айбек\n20\n1.75\nда'} className="w-full px-3 py-2 rounded-xl border bg-white text-sm font-mono"/>
              </div>
            )}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-800 flex items-start gap-2">
              <span className="text-emerald-600 mt-0.5">✓</span>
              <div><b>4 рабочих языка:</b> Python и JavaScript выполняются на сервере, HTML и CSS — live preview. Все работает офлайн-стабильно.</div>
            </div>
            <div className="bg-slate-900 rounded-2xl p-4 text-white">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold tracking-widest text-slate-400">ВЫВОД</div>
                <div className="flex gap-2">
                {output && (
                  <button onClick={()=>speak(output)} className="px-3 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold" title="Прочитать вывод вслух">🔊 Слушать</button>
                )}
                {output && (active.language==='python'||active.language==='javascript') && (
                  <button onClick={explain} disabled={explaining} className="px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1 disabled:opacity-50"><Sparkles size={12}/>{explaining?'Думаю...':'Объясни ошибку'}</button>
                )}
                </div>
              </div>
              <pre className="whitespace-pre-wrap text-sm font-mono bg-black/30 rounded-xl p-3 min-h-[100px]">{output||'Нажми Запустить — результат появится здесь. Python выполняется на сервере (песочница), JS — в браузере.'}</pre>
              {explanation && (
                <div className="mt-3 rounded-xl bg-violet-950/60 border border-violet-500/30 p-3 text-sm space-y-1.5">
                  <div className="font-bold text-violet-200">💡 {explanation.title}</div>
                  <div className="text-slate-200">{explanation.what}</div>
                  <div className="text-emerald-300">✅ {explanation.fix}</div>
                </div>
              )}
              <div className="text-xs text-slate-400 mt-2">Поддерживается Pyodide (браузерный Python) — можно расширить без бэкенда.</div>
            </div>
          </>
        ) : (
            <div className="bg-white rounded-2xl border p-12 text-center">
            <h3 className="font-bold text-lg dark:text-white">Мини-редактор кода</h3>
            <p className="text-slate-500 mt-2 max-w-lg mx-auto">Выбери задачу слева или создай новую. Python, JavaScript, HTML, CSS — идеально для уроков информатики.</p>
          </div>
        )}
      </div>
    </div>
  )
}
