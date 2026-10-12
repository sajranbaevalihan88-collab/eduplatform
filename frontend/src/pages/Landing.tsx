import { Link } from 'react-router-dom'
import { BookOpen, Layers, Presentation, FlaskConical, PenTool, Sparkles, ArrowRight, Play, Shield, Globe, Zap } from 'lucide-react'
import { useLang } from '../context/LangContext'

export default function Landing(){
  const {t}=useLang()
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 -m-4 lg:-m-8">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-800 [mask-image:linear-gradient(to_bottom,white,transparent)]"/>
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-floatSubtle"/>
        <div className="absolute top-40 right-10 w-96 h-96 bg-indigo-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-floatSubtle" style={{animationDelay:'1s'}}/>
        <div className="max-w-6xl mx-auto px-6 pt-16 pb-12 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-700 text-violet-700 dark:text-violet-200 text-xs font-semibold">{t('new_board_anim')}</div>
          <h1 className="mt-4 text-4xl md:text-5xl lg:text-6xl font-display font-extrabold leading-tight">
            <span className="gradient-text">EduPlatform AI</span> <span className="text-slate-900 dark:text-white">{t('hero_title1')}<br/>{t('hero_title2')}</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600 dark:text-slate-300 max-w-2xl" dangerouslySetInnerHTML={{__html: t('hero_sub')}} />
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/lessons" className="px-6 py-3 rounded-xl bg-slate-900 dark:bg-white dark:text-slate-900 text-white font-bold flex items-center gap-2 btn-hover shadow-lg hover:shadow-xl">{t('view_lessons')} <ArrowRight size={18}/></Link>
            <Link to="/lessons/new" className="px-6 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white font-semibold flex items-center gap-2 btn-hover hover:bg-slate-50 dark:hover:bg-slate-700"><Sparkles size={18}/> {t('create_lesson')}</Link>
            <a href="#features" className="px-6 py-3 rounded-xl bg-white/80 dark:bg-slate-800/80 backdrop-blur border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 font-semibold flex items-center gap-2 hover:bg-white dark:hover:bg-slate-700"><Play size={18}/> {t('how_it_works')}</a>
          </div>
          <div className="mt-8 flex flex-wrap gap-6 text-sm text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><Shield size={14} className="text-emerald-500"/> {t('real_db')}</span>
            <span className="flex items-center gap-1.5"><Globe size={14} className="text-blue-500"/> {t('globally')}</span>
            <span className="flex items-center gap-1.5"><Zap size={14} className="text-amber-500"/> {t('premium_anim')}</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-12">
        <h2 className="text-2xl font-bold text-center text-slate-900 dark:text-white">{t('all_for_lesson')}</h2>
        <div className="grid md:grid-cols-3 gap-4 mt-8 stagger">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 card-hover">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-white"><Layers size={20}/></div>
            <h3 className="font-bold mt-3 text-slate-900 dark:text-white">{t('lessons_from_blocks')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('lessons_desc')}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border p-6 card-hover">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white"><Presentation size={20}/></div>
            <h3 className="font-bold mt-3 text-slate-900 dark:text-white">{t('presentations_clone')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('presentations_desc')}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border p-6 card-hover">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white"><PenTool size={20}/></div>
            <h3 className="font-bold mt-3 text-slate-900 dark:text-white">{t('board_2d3d')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('board_desc')}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border p-6 card-hover">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center text-white"><FlaskConical size={20}/></div>
            <h3 className="font-bold mt-3 text-slate-900 dark:text-white">{t('tests_auto')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('tests_desc')}</p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-2xl border p-6 card-hover">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white"><BookOpen size={20}/></div>
            <h3 className="font-bold mt-3 text-slate-900 dark:text-white">{t('subjects_title')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('subjects_desc')}</p>
          </div>
          <div className="bg-gradient-to-br from-slate-900 to-indigo-900 dark:from-slate-800 dark:to-violet-900 rounded-2xl p-6 text-white card-hover border dark:border-slate-700">
            <h3 className="font-bold">{t('ready')}</h3>
            <p className="text-sm text-white/80 mt-1">{t('ready_sub')}</p>
            <Link to="/login" className="inline-flex mt-3 px-4 py-2 rounded-xl bg-white text-slate-900 font-bold text-sm btn-hover">{t('login_btn')}</Link>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-6xl mx-auto px-6 pb-16">
        <div className="bg-white dark:bg-slate-800 rounded-[24px] border dark:border-slate-700 p-6 md:p-8 flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t('how_to_start')}</h3>
            <ol className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300">
              <li>1. <Link to="/login" className="text-violet-600 dark:text-violet-400 underline">{t('step1')}</Link> {t('step1_as')}</li>
              <li>2. {t('step2')}</li>
              <li>3. {t('step3')}</li>
            </ol>
          </div>
          <Link to="/lessons/new" className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-bold shadow-lg btn-hover">{t('create_first')}</Link>
        </div>
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">{t('footer')}</div>
      </section>
    </div>
  )
}
