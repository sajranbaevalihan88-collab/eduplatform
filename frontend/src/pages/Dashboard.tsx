import { useEffect, useState } from 'react'

/** Живые цифры: 0 → значение за ~0.8с */
function CountUp({ value }: { value: number }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const dur = 800
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <>{n}</>
}
import client from '../api/client'
import { Link } from 'react-router-dom'
import { BookOpen, Layers, PenTool, Presentation as PresIcon, FlaskConical, ArrowRight, Cuboid } from 'lucide-react'

export default function Dashboard(){
  const [stats,setStats]=useState({subjects:0,lessons:0,presentations:0,tests:0,boards:0})
  const [me,setMe]=useState<any>(null)
  useEffect(()=>{
    Promise.all([
      client.get('/subjects/').then(r=>r.data.length||r.data.count||r.data.results?.length||0).catch(()=>0),
      client.get('/lessons/').then(r=>r.data.length||r.data.count||r.data.results?.length||0).catch(()=>0),
      client.get('/presentations/').then(r=>r.data.length||r.data.count||r.data.results?.length||0).catch(()=>0),
      client.get('/tests/').then(r=>r.data.length||r.data.count||r.data.results?.length||0).catch(()=>0),
      client.get('/boards/').then(r=>r.data.length||r.data.count||r.data.results?.length||0).catch(()=>0),
    ]).then(([s,l,p,t,b])=>setStats({subjects:s,lessons:l,presentations:p,tests:t,boards:b}))
    const token=localStorage.getItem('token')
    if(token){
      client.get('/auth/me/').then(r=>setMe(r.data)).catch(()=>{
        const raw=localStorage.getItem('user')
        if(raw) try{ setMe(JSON.parse(raw)) }catch{}
      })
    }
  },[])
  const cards=[
    {label:'Предметы',value:stats.subjects,icon:BookOpen,color:'from-violet-600 to-indigo-600',to:'/subjects'},
    {label:'Уроки',value:stats.lessons,icon:Layers,color:'from-blue-600 to-cyan-600',to:'/lessons'},
    {label:'Презентации',value:stats.presentations,icon:PresIcon,color:'from-orange-600 to-pink-600',to:'/presentations'},
    {label:'Тесты',value:stats.tests,icon:FlaskConical,color:'from-rose-600 to-orange-600',to:'/tests'},
    {label:'Доски 2D/3D',value:stats.boards,icon:Cuboid,color:'from-emerald-600 to-teal-600',to:'/board'},
  ]
  return (
    <div className="space-y-6 page-enter">
      <div className="rounded-[24px] bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-900 p-8 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-grid-white/10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-0 left-20 w-48 h-48 bg-gradient-to-br from-indigo-500/20 to-cyan-500/20 rounded-full blur-3xl animate-float" style={{animationDelay:'1s'}} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-medium backdrop-blur mb-3 animate-fadeIn">✨ Новая доска 2D/3D с анимациями</div>
          <h1 className="text-3xl md:text-4xl font-display font-extrabold animate-fadeIn dark:text-white" style={{animationDelay:'0.1s'}}>{me ? `Привет, ${me.username}! 👋` : 'Добро пожаловать в EduPlatform AI'}</h1>
          <p className="text-white/80 mt-2 max-w-2xl animate-fadeIn" style={{animationDelay:'0.2s'}}>{me ? `Роль: ${me.role} — создавай уроки, они станут видны всем. Твоя доска 2D/3D — личная.` : 'Создавай уроки: тексты + презентации + тесты + личная доска 2D/3D (геометрия, стереометрия, физика, астрономия) — всё видно всем, создаёт автор.'}</p>
          <div className="flex flex-wrap gap-3 mt-6 animate-fadeIn" style={{animationDelay:'0.3s'}}>
            <Link to="/lessons/new" className="px-6 py-3 rounded-xl bg-white text-slate-900 font-semibold flex items-center gap-2 btn-hover shadow-lg">Создать урок <ArrowRight size={18} className="transition-transform group-hover:translate-x-1"/></Link>
            <Link to="/presentations/new" className="px-5 py-3 rounded-xl bg-white/10 border border-white/20 font-semibold backdrop-blur hover:bg-white/20 transition-all btn-hover">Новая презентация</Link>
            <Link to="/tests/new" className="px-5 py-3 rounded-xl bg-white/10 border border-white/20 font-semibold backdrop-blur hover:bg-white/20 transition-all btn-hover">Новый тест</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger">
        {cards.map(c=>(
          <Link key={c.label} to={c.to} className="bg-white rounded-2xl p-5 border border-slate-100 card-hover group">
            <div className="flex items-center justify-between">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${c.color} flex items-center justify-center text-white shadow-md group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}><c.icon size={22}/></div>
              <span className="text-3xl font-display font-extrabold group-hover:scale-110 transition-transform duration-300"><CountUp value={c.value} /></span>
            </div>
            <div className="mt-3 font-semibold group-hover:text-violet-600 transition-colors">{c.label}</div>
            <div className="text-sm text-slate-500 flex items-center gap-1 mt-1 group-hover:gap-2 transition-all">Перейти <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform"/></div>
          </Link>
        ))}
      </div>
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100 rounded-2xl p-3 text-xs text-emerald-700 text-center flex items-center justify-center gap-2 animate-fadeIn"><span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulseSoft"/> 🌍 Глобальная БД: PostgreSQL (на Render) — все уроки видны всем без входа. Свои — только после входа.</div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-100 p-6 card-hover">
          <h3 className="font-bold text-lg flex items-center gap-2">📚 Как собрать урок</h3>
          <ol className="mt-4 space-y-3 text-sm stagger">
            <li className="flex gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors"><span className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">1</span> Создай презентацию в редакторе (слайды 2D) или загрузи готовую.</li>
            <li className="flex gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors"><span className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">2</span> Собери тест (один/несколько, текст, верно/неверно).</li>
            <li className="flex gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors"><span className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">3</span> Нарисуй на доске 2D/3D фигуры — геометрия, физика, астрономия (куб, сфера, орбита).</li>
            <li className="flex gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors"><span className="w-7 h-7 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 text-white flex items-center justify-center font-bold shrink-0 shadow-sm">4</span> Собери урок из блоков и опубликуй — увидят все без регистрации.</li>
          </ol>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-6 card-hover">
          <h3 className="font-bold flex items-center gap-2">⚡ Быстрые действия</h3>
          <div className="grid grid-cols-2 gap-3 mt-4 stagger">
            <Link to="/lessons/new" className="p-4 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white text-center font-medium flex flex-col items-center gap-2 shadow-md btn-hover"><Layers size={24}/>Новый урок</Link>
            <Link to="/board" className="p-4 rounded-xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-violet-200 hover:shadow-md text-center font-medium flex flex-col items-center gap-2 card-hover"><PenTool size={24}/>Доска 2D/3D</Link>
            <Link to="/presentations/new" className="p-4 rounded-xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-orange-200 hover:shadow-md text-center font-medium flex flex-col items-center gap-2 card-hover"><Cuboid size={24}/>Презентация</Link>
            <Link to="/tests/new" className="p-4 rounded-xl bg-slate-50 hover:bg-white border border-slate-100 hover:border-rose-200 hover:shadow-md text-center font-medium flex flex-col items-center gap-2 card-hover"><FlaskConical size={24}/>Тест</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
