import { Link } from 'react-router-dom'
import { BookOpen, Layers, Presentation, FlaskConical, PenTool, Sparkles, ArrowRight, Shield, Globe, Zap, FileText, Gamepad2, Code2, CheckCircle2 } from 'lucide-react'
import { useLang } from '../context/LangContext'
import Reveal from '../components/Reveal'

const FEATURES = [
  { icon: Layers, grad: 'from-blue-500 to-cyan-500', title: 'Уроки-конструктор', desc: 'Текст, видео, тесты и код — урок собирается из блоков и меняется перетаскиванием.', to: '/lessons' },
  { icon: Presentation, grad: 'from-orange-500 to-amber-400', title: 'Презентации как PowerPoint', desc: '14 фигур, анимации и переходы, импорт .pptx и .pdf, показ на весь экран.', to: '/presentations' },
  { icon: PenTool, grad: 'from-emerald-500 to-teal-500', title: 'Доска 2D/3D', desc: 'Рисование как в Figma и режим стереометрии с настоящими 3D-фигурами и тенями.', to: '/board' },
  { icon: FlaskConical, grad: 'from-rose-500 to-orange-500', title: 'Тесты с автопроверкой', desc: 'Генерация вопросов по теме, таймер, античит и оценки сразу в журнал.', to: '/tests' },
  { icon: FileText, grad: 'from-indigo-500 to-blue-500', title: 'Word онлайн', desc: 'Документы с форматированием, таблицами и картинками, импорт и экспорт .docx.', to: '/word' },
  { icon: Gamepad2, grad: 'from-violet-500 to-fuchsia-500', title: 'Игры и код', desc: '8 обучающих игр и запуск Python и JavaScript прямо в браузере с терминалом.', to: '/games' },
]

const MARQUEE = ['🎓 Уроки-конструктор', '🖼 Презентации', '🧪 Тесты с автопроверкой', '📄 Word онлайн', '🧊 3D-доска', '🎮 8 обучающих игр', '💻 Python и JavaScript', '🏫 Классы и журнал', '🗣 RU · EN · KG']

const STEPS = [
  { n: '1', title: 'Создай аккаунт', desc: 'Учитель или ученик — за 20 секунд, без подтверждений и ожиданий.' },
  { n: '2', title: 'Собери урок', desc: 'Блоки: текст, видео, презентация, тест, код и доска — в одном месте.' },
  { n: '3', title: 'Пригласи класс', desc: 'Код-приглашение как в Google Classroom — ученики вступают сами.' },
  { n: '4', title: 'Проверяй автоматически', desc: 'Тесты проверяются сами, оценки падают в журнал и отчёт по классу.' },
]

function HeroCollage() {
  return (
    <div className="relative hidden lg:block h-[440px] select-none" aria-hidden="true">
      <div className="absolute top-8 right-6 w-72 h-72 bg-gradient-to-br from-blue-400/30 to-cyan-300/30 rounded-full blur-3xl" />
      <div className="absolute bottom-4 left-0 w-60 h-60 bg-gradient-to-br from-violet-400/25 to-fuchsia-300/25 rounded-full blur-3xl" />
      {/* карточка урока */}
      <div className="absolute top-6 left-6 w-[290px] glass dark:!bg-slate-800/85 dark:!border-slate-600 rounded-2xl shadow-2xl p-4 animate-floatSlow" style={{ ['--r' as any]: '-3deg' }}>
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white flex items-center justify-center text-lg">🧊</span>
          <div>
            <div className="font-bold text-sm text-slate-900 dark:text-white">Урок: Стереометрия</div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Геометрия · 12 блоков</div>
          </div>
        </div>
        <div className="mt-3 h-2 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 animate-progress" />
        </div>
        <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
          <CheckCircle2 size={13} className="text-emerald-500" /> 8 из 12 блоков пройдено
        </div>
      </div>
      {/* карточка теста */}
      <div className="absolute top-44 right-2 w-[250px] glass dark:!bg-slate-800/85 dark:!border-slate-600 rounded-2xl shadow-2xl p-4 animate-floatSlow" style={{ ['--r' as any]: '3deg', animationDelay: '.9s' }}>
        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Тест · вопрос 3/10</div>
        <div className="mt-1.5 font-semibold text-sm text-slate-900 dark:text-white">Чему равен объём куба?</div>
        <div className="mt-2.5 space-y-1.5">
          <div className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-300">a · a · a</div>
          <div className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center justify-between">6 · a² <span>✓</span></div>
        </div>
      </div>
      {/* карточка кода */}
      <div className="absolute bottom-2 left-16 w-[270px] rounded-2xl bg-slate-900 shadow-2xl p-3.5 animate-floatSlow" style={{ ['--r' as any]: '2deg', animationDelay: '1.7s' }}>
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="mt-2.5 font-mono text-xs leading-relaxed">
          <span className="text-slate-500">&gt;&gt;&gt;</span> <span className="text-cyan-300">print</span><span className="text-slate-300">(</span><span className="text-emerald-300">"Привет, мир!"</span><span className="text-slate-300">)</span>
        </div>
        <div className="mt-2 font-mono text-[11px] text-slate-400 flex items-center gap-1">
          Привет, мир!
          <span className="dot-typing inline-flex gap-0.5"><span className="w-1 h-1 rounded-full bg-cyan-300 inline-block" /><span className="w-1 h-1 rounded-full bg-cyan-300 inline-block" /><span className="w-1 h-1 rounded-full bg-cyan-300 inline-block" /></span>
        </div>
      </div>
      {/* летающие чипы */}
      <span className="absolute top-2 right-40 px-3 py-1.5 rounded-full glass dark:!bg-slate-800/85 dark:!border-slate-600 shadow-lg text-xs font-bold text-slate-700 dark:text-slate-200 animate-floatSubtle">🎮 8 игр</span>
      <span className="absolute bottom-24 right-36 px-3 py-1.5 rounded-full glass dark:!bg-slate-800/85 dark:!border-slate-600 shadow-lg text-xs font-bold text-slate-700 dark:text-slate-200 animate-floatSubtle" style={{ animationDelay: '1.2s' }}>📄 .docx</span>
      <span className="absolute top-40 left-0 px-3 py-1.5 rounded-full glass dark:!bg-slate-800/85 dark:!border-slate-600 shadow-lg text-xs font-bold text-slate-700 dark:text-slate-200 animate-floatSubtle" style={{ animationDelay: '.6s' }}>🏫 Классы</span>
    </div>
  )
}

export default function Landing() {
  const { t } = useLang()
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50 to-white dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 -m-4 lg:-m-8">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-100 dark:bg-grid-slate-800 [mask-image:linear-gradient(to_bottom,white,transparent)]" />
        <div className="absolute top-16 left-[8%] w-64 h-64 bg-blue-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-25 dark:opacity-20 animate-floatSubtle" />
        <div className="absolute top-36 right-[6%] w-80 h-80 bg-cyan-300 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-3xl opacity-25 dark:opacity-20 animate-floatSubtle" style={{ animationDelay: '1.2s' }} />

        <div className="max-w-7xl mx-auto px-5 sm:px-6 pt-14 pb-10 sm:pt-20 relative">
          <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
            <div>
              <Reveal>
                <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/40 border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-200 text-xs font-bold shadow-sm">
                  <Sparkles size={14} /> {t('new_board_anim')}
                </span>
              </Reveal>
              <Reveal delay={90}>
                <h1 className="mt-5 text-[34px] leading-[1.08] sm:text-5xl xl:text-[56px] font-display font-extrabold tracking-tight">
                  <span className="text-slate-900 dark:text-white">EduPlatform </span>
                  <span className="brand-ai">AI</span>
                  <span className="block mt-2 text-slate-900 dark:text-white">{t('hero_title1')} <span className="gradient-text">{t('hero_title2')}</span></span>
                </h1>
              </Reveal>
              <Reveal delay={180}>
                <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed" dangerouslySetInnerHTML={{ __html: t('hero_sub') }} />
              </Reveal>
              <Reveal delay={260}>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link to="/lessons" className="btn-shine px-6 py-3.5 min-h-[48px] rounded-2xl bg-blue-700 dark:bg-white dark:text-slate-900 text-white font-bold flex items-center gap-2 shadow-lg shadow-blue-600/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    {t('view_lessons')} <ArrowRight size={18} />
                  </Link>
                  <Link to="/lessons/new" className="px-6 py-3.5 min-h-[48px] rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-900 dark:text-white font-semibold flex items-center gap-2 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
                    <Sparkles size={18} className="text-blue-600 dark:text-cyan-400" /> {t('create_lesson')}
                  </Link>
                </div>
              </Reveal>
              <Reveal delay={340}>
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-slate-500 dark:text-slate-400">
                  <span className="flex items-center gap-1.5"><Shield size={15} className="text-emerald-500" /> {t('real_db')}</span>
                  <span className="flex items-center gap-1.5"><Globe size={15} className="text-blue-500" /> {t('globally')}</span>
                  <span className="flex items-center gap-1.5"><Code2 size={15} className="text-violet-500" /> Python · JS · HTML · CSS</span>
                  <span className="flex items-center gap-1.5"><Zap size={15} className="text-amber-500" /> RU · EN · KG</span>
                </div>
              </Reveal>
            </div>
            <Reveal delay={200}><HeroCollage /></Reveal>
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
          <p className="text-center text-slate-500 dark:text-slate-400 mt-2.5 max-w-2xl mx-auto text-sm sm:text-base">Шесть инструментов в одном окне — открывай нужный и веди урок без переключений.</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 mt-10">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 70}>
              <Link to={f.to} className="group block h-full bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 card-hover shadow-sm hover:shadow-xl hover:border-blue-200 dark:hover:border-blue-700 transition-all">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.grad} flex items-center justify-center text-white shadow-md group-hover:scale-110 group-hover:-rotate-3 transition-transform duration-300`}>
                  <f.icon size={22} />
                </div>
                <h3 className="font-bold mt-4 text-slate-900 dark:text-white">{f.title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{f.desc}</p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 dark:text-cyan-400 mt-3.5 opacity-0 group-hover:opacity-100 -translate-x-1 group-hover:translate-x-0 transition-all">
                  Открыть <ArrowRight size={15} />
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
                <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-display font-extrabold flex items-center justify-center shadow-md shadow-blue-600/25">{s.n}</span>
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
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-blue-900 to-cyan-900 p-8 sm:p-12 text-white shadow-2xl">
            <div className="absolute inset-0 bg-grid-white/10 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />
            <div className="absolute -top-16 -right-10 w-64 h-64 bg-cyan-400/20 rounded-full blur-3xl animate-floatSubtle" />
            <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex-1">
                <h2 className="text-2xl sm:text-3xl font-display font-extrabold tracking-tight">{t('ready')}</h2>
                <p className="text-white/80 mt-2.5 max-w-xl text-sm sm:text-base">{t('ready_sub')}</p>
              </div>
              <Link to="/login" className="btn-shine shrink-0 inline-flex px-7 py-3.5 min-h-[48px] rounded-2xl bg-white text-slate-900 font-bold text-sm sm:text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all w-fit">
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
