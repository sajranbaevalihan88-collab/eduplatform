import { Link } from 'react-router-dom'
import { BookOpen, Layers, Presentation, FlaskConical, PenTool, Sparkles, ArrowRight, Shield, Globe, Zap, FileText, Gamepad2, Code2, CheckCircle2, Plus } from 'lucide-react'
import { useLang } from '../context/LangContext'
import Reveal from '../components/Reveal'

function HeroCollage({ t }: { t: (k: string) => string }) {
  return (
    <div className="relative hidden lg:block h-[440px] select-none" aria-hidden="true">
      {/* карточка урока */}
      <div className="absolute top-6 left-6 w-[290px] glass dark:!bg-slate-800/85 dark:!border-slate-600 rounded-2xl shadow-2xl p-4 animate-floatSlow" style={{ ['--r' as any]: '-3deg' }}>
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-lg">🧊</span>
          <div>
            <div className="font-bold text-sm text-slate-900 dark:text-white">{t('land_c_lesson')}</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{t('land_c_lesson_sub')}</div>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden">
          <div className="h-full rounded-full bg-indigo-600 animate-progress" />
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <CheckCircle2 size={13} className="text-emerald-500" /> {t('land_c_done')}
        </div>
      </div>
      {/* карточка теста */}
      <div className="absolute top-44 right-2 w-[250px] glass dark:!bg-slate-800/85 dark:!border-slate-600 rounded-2xl shadow-2xl p-4 animate-floatSlow" style={{ ['--r' as any]: '3deg', animationDelay: '.9s' }}>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">{t('land_c_test')}</div>
        <div className="mt-1.5 font-semibold text-sm text-slate-900 dark:text-white">{t('land_c_q')}</div>
        <div className="mt-2.5 space-y-1.5">
          <div className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold flex items-center justify-between">a · a · a <span>✓</span></div>
          <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300">6 · a²</div>
        </div>
      </div>
      {/* карточка кода */}
      <div className="absolute bottom-2 left-16 w-[270px] rounded-2xl bg-slate-900 shadow-2xl p-3.5 animate-floatSlow" style={{ ['--r' as any]: '2deg', animationDelay: '1.7s' }}>
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="mt-2.5 font-mono text-xs leading-relaxed">
          <span className="text-slate-500">&gt;&gt;&gt;</span> <span className="text-cyan-300">print</span><span className="text-slate-300">(</span><span className="text-emerald-300">"{t('land_c_hello')}"</span><span className="text-slate-300">)</span>
        </div>
        <div className="mt-2 font-mono text-[11px] text-slate-400 flex items-center gap-1">
          {t('land_c_hello')}
          <span className="dot-typing inline-flex gap-0.5"><span className="w-1 h-1 rounded-full bg-cyan-300 inline-block" /><span className="w-1 h-1 rounded-full bg-cyan-300 inline-block" /><span className="w-1 h-1 rounded-full bg-cyan-300 inline-block" /></span>
        </div>
      </div>
      {/* летающие чипы */}
      <span className="absolute top-2 right-40 px-3 py-1.5 rounded-full glass dark:!bg-slate-800/85 dark:!border-slate-600 shadow-lg text-xs font-bold text-slate-700 dark:text-slate-200 animate-floatSubtle">{t('land_c_games')}</span>
      <span className="absolute bottom-24 right-36 px-3 py-1.5 rounded-full glass dark:!bg-slate-800/85 dark:!border-slate-600 shadow-lg text-xs font-bold text-slate-700 dark:text-slate-200 animate-floatSubtle" style={{ animationDelay: '1.2s' }}>📄 .docx</span>
      <span className="absolute top-40 left-0 px-3 py-1.5 rounded-full glass dark:!bg-slate-800/85 dark:!border-slate-600 shadow-lg text-xs font-bold text-slate-700 dark:text-slate-200 animate-floatSubtle" style={{ animationDelay: '.6s' }}>{t('land_c_classes')}</span>
    </div>
  )
}

export default function Landing() {
  const { t } = useLang()
  const FEATURES = [
    { icon: Layers, tint: 'bg-indigo-100 text-indigo-700 dark:bg-blue-900/50 dark:text-indigo-300', title: t('land_f1_t'), desc: t('land_f1_d'), to: '/lessons' },
    { icon: Presentation, tint: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300', title: t('land_f2_t'), desc: t('land_f2_d'), to: '/presentations' },
    { icon: PenTool, tint: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', title: t('land_f3_t'), desc: t('land_f3_d'), to: '/board' },
    { icon: FlaskConical, tint: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300', title: t('land_f4_t'), desc: t('land_f4_d'), to: '/tests' },
    { icon: FileText, tint: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300', title: t('land_f5_t'), desc: t('land_f5_d'), to: '/word' },
    { icon: Gamepad2, tint: 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300', title: t('land_f6_t'), desc: t('land_f6_d'), to: '/games' },
  ]
  const MARQUEE = [t('land_m1'), t('land_m2'), t('land_m3'), t('land_m4'), t('land_m5'), t('land_m6'), t('land_m7'), t('land_m8'), t('land_m9')]
  const STEPS = [
    { n: '1', title: t('land_s1_t'), desc: t('land_s1_d') },
    { n: '2', title: t('land_s2_t'), desc: t('land_s2_d') },
    { n: '3', title: t('land_s3_t'), desc: t('land_s3_d') },
    { n: '4', title: t('land_s4_t'), desc: t('land_s4_d') },
  ]
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 -m-4 lg:-m-8">
      {/* Hero */}
      <section className="relative">
        <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-14 pb-10 sm:pt-20 relative">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/40 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-blue-200 text-xs font-bold shadow-sm">
                  <Sparkles size={14} /> {t('new_board_anim')}
                </span>
              </Reveal>
              <Reveal delay={90}>
                <h1 className="mt-5 text-[34px] leading-[1.08] sm:text-5xl xl:text-[56px] font-display font-extrabold tracking-tight">
                  <span className="text-slate-900 dark:text-white">EduPlatform</span>
                  <span className="block mt-2 text-slate-900 dark:text-white">{t('hero_title1')} <span>{t('hero_title2')}</span></span>
                </h1>
              </Reveal>
              <Reveal delay={180}>
                <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed" dangerouslySetInnerHTML={{ __html: t('hero_sub') }} />
              </Reveal>
              <Reveal delay={260}>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/lessons" className="px-6 py-3.5 min-h-[48px] rounded-xl bg-indigo-600 dark:bg-white dark:text-slate-900 text-white font-bold flex items-center gap-2 hover:bg-indigo-700 dark:hover:bg-slate-100 transition-colors">
                    {t('view_lessons')} <ArrowRight size={18} />
                  </Link>
                  <Link to="/lessons/new" className="px-6 py-3.5 min-h-[48px] rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white font-semibold flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <Plus size={18} className="text-indigo-700 dark:text-cyan-400" /> {t('create_lesson')}
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={340}>
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5"><Shield size={15} className="text-emerald-500" /> {t('real_db')}</span>
                  <span className="flex items-center gap-1.5"><Globe size={15} className="text-indigo-500" /> {t('globally')}</span>
                  <span className="flex items-center gap-1.5"><Code2 size={15} className="text-violet-500" /> Python · JS · HTML · CSS</span>
                  <span className="flex items-center gap-1.5"><Zap size={15} className="text-amber-500" /> RU · EN · KG</span>
                </div>
              </Reveal>
            </div>
            <Reveal delay={200}><HeroCollage t={t} /></Reveal>
          </div>
        </div>
      </section>

      {/* Бегущая строка */}
      <section className="marquee marquee-mask border-y border-slate-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur py-3.5 overflow-hidden" aria-hidden="true">
        <div className="flex w-max animate-marquee gap-3 pr-3">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span key={i} className="whitespace-nowrap px-4 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-sm font-semibold text-slate-600 dark:text-slate-300">{m}</span>
          ))}
        </div>
      </section>

      {/* Возможности */}
      <section className="max-w-7xl mx-auto px-5 sm:px-6 py-14 sm:py-16">
        <Reveal>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-center text-slate-900 dark:text-white tracking-tight">{t('all_for_lesson')}</h2>
          <p className="text-center text-slate-500 dark:text-slate-400 mt-2.5 max-w-2xl mx-auto text-sm sm:text-base">{t('land_sub')}</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mt-10">
          {FEATURES.map((f, i) => (
            <Reveal key={f.to} delay={i * 70}>
              <Link to={f.to} className="group block h-full bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6 card-hover hover:border-blue-400 dark:hover:border-indigo-600 transition-colors">
                <div className={`w-11 h-11 rounded-lg ${f.tint} flex items-center justify-center`}>
                  <f.icon size={22} />
                </div>
                <h3 className="font-bold mt-4 text-slate-900 dark:text-white">{f.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{f.desc}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-700 dark:text-cyan-400 mt-3.5">
                  {t('land_open')} <ArrowRight size={15} className="opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Как начать */}
      <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-14 sm:pb-16">
        <Reveal>
          <h2 className="text-2xl sm:text-3xl font-display font-extrabold text-center text-slate-900 dark:text-white tracking-tight">{t('how_to_start')}</h2>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-9">
          {STEPS.map((s, i) => (
            <Reveal key={s.n} delay={i * 90}>
              <div className="relative h-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 card-hover">
                <span className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-display font-extrabold flex items-center justify-center">{s.n}</span>
                <h3 className="font-bold mt-3.5 text-slate-900 dark:text-white">{s.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-16">
        <Reveal>
          <div className="rounded-2xl bg-slate-900 dark:bg-slate-800 border border-slate-800 dark:border-slate-700 p-8 sm:p-12 text-white">
            <div className="flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">{t('ready')}</h2>
                <p className="text-white/70 mt-2.5 max-w-xl text-sm sm:text-base">{t('ready_sub')}</p>
              </div>
              <Link to="/login" className="shrink-0 inline-flex px-7 py-3.5 min-h-[48px] rounded-xl bg-white text-slate-900 font-bold text-sm sm:text-base hover:bg-indigo-50 transition-colors w-fit">
                {t('login_btn')} <ArrowRight size={18} className="ml-2" />
              </Link>
            </div>
          </div>
        </Reveal>
        <div className="text-center text-xs text-slate-400 dark:text-slate-500 mt-8">{t('footer')}</div>
      </section>
    </div>
  )
}
