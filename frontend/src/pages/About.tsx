import { Link } from 'react-router-dom'
import { Heart, Monitor, Zap, Layers, Check, Minus, X, ArrowRight, Sparkles } from 'lucide-react'
import { useLang } from '../context/LangContext'

const DICT: Record<string, Record<string, string>> = {
  ru: {
    ab_title: 'О платформе',
    ab_sub: 'Почему EduPlatform существует и чем отличается',
    ab_story_t: 'Сколько стоит один хороший урок?',
    ab_story_p1: 'У репетитора — несколько сотен сомов. В частной школе — тысячи каждый месяц. А для семьи из далёкого села — дороже всех: к цене урока добавляется дорога в город. Выходит несправедливо: качество урока зависит от того, где родился ребёнок и что в кошельке у родителей.',
    ab_story_p2: 'PISA-2025: Кыргызстан — 80-е место из 91 страны, 76% школьников ниже базового уровня, школам не хватает 761 учителя. Школу в горах строят годами, репетитора в каждое село не отправишь — а телефон уже лежит в кармане почти у каждого школьника. Хороший урок должен стоить как звонок родителям: почти ничего. Поэтому я собрал EduPlatform — урок, который живёт в браузере и сам приходит в каждый телефон.',
    ab_quote: 'Мне не нужно строить школу в каждой деревне. Мне нужно, чтобы урок сам приходил в каждый телефон.',
    ab_prob1t: 'Десять окон вместо одного',
    ab_prob1x: 'Word + PowerPoint + видео + тест — четыре программы и десяток вкладок ради одного урока.',
    ab_prob2t: 'Слабые ноутбуки не тянут',
    ab_prob2x: 'Старая техника у большинства учителей и преподавателей: много вкладок = нагрузка на оперативку и процессор, зависания на уроке.',
    ab_prob3t: 'Всё в разных местах',
    ab_prob3x: 'Материалы теряются в папках и флешках: урок, тест, презентация живут отдельно друг от друга.',
    ab_sol_t: 'Решение — всё в одном окне',
    ab_sol_x: 'Урок из блоков, презентация, тесты с автопроверкой, доска 2D/3D, редактор кода и Word — в одном окне браузера. Лёгкий интерфейс, честный офлайн-режим, кыргызский язык из коробки.',
    ab_table_t: 'Чем отличаемся',
    ab_table_sub: 'Честное сравнение с известными платформами',
    ab_yes: 'Да', ab_part: 'Частично', ab_no: 'Нет',
    ab_cta_t: 'Попробуйте сами — без регистрации',
    ab_cta_sub: 'Демо-вход: логин demo, пароль demo1234. Или смотрите уроки гостем.',
    ab_cta_btn: 'Открыть уроки',
    ab_demo_btn: 'Войти как demo',
    ab_made: 'Сделано школьником для учителей — к StudEXPO 2026',
  },
  en: {
    ab_title: 'About the platform',
    ab_sub: 'Why EduPlatform exists and how it differs',
    ab_story_t: 'How much does one good lesson cost?',
    ab_story_p1: 'A tutor costs hundreds of soms per lesson. A private school — thousands every month. For a family in a remote village it is the most expensive: add the road to the city to the price. It is unfair: the quality of a lesson depends on where a child was born and what the parents can afford.',
    ab_story_p2: 'PISA-2025: Kyrgyzstan ranks 80th out of 91 countries; 76% of schoolchildren are below the basic level; schools lack 761 teachers. A mountain school takes years to build, you cannot send a tutor to every village — yet a phone is already in almost every schoolchild pocket. A good lesson should cost like a call to your parents: almost nothing. So I built EduPlatform — a lesson that lives in the browser and arrives in every phone on its own.',
    ab_quote: 'I do not need to build a school in every village. I need the lesson to arrive in every phone by itself.',
    ab_prob1t: 'Ten windows instead of one',
    ab_prob1x: 'Word + PowerPoint + video + test — four programs and a dozen tabs for a single lesson.',
    ab_prob2t: 'Weak laptops suffer',
    ab_prob2x: 'Most teachers run old hardware: many tabs mean RAM and CPU load, freezes in the middle of a lesson.',
    ab_prob3t: 'Everything lives apart',
    ab_prob3x: 'Materials get lost in folders and flash drives: lesson, test and presentation are stored separately.',
    ab_sol_t: 'The answer — one window',
    ab_sol_x: 'Lessons from blocks, presentations, auto-graded tests, a 2D/3D board, a code editor and Word — in one browser window. Light interface, honest offline mode, Kyrgyz language out of the box.',
    ab_table_t: 'How we differ',
    ab_table_sub: 'An honest comparison with well-known platforms',
    ab_yes: 'Yes', ab_part: 'Partial', ab_no: 'No',
    ab_cta_t: 'Try it yourself — no registration',
    ab_cta_sub: 'Demo login: demo / demo1234. Or browse lessons as a guest.',
    ab_cta_btn: 'Open lessons',
    ab_demo_btn: 'Sign in as demo',
    ab_made: 'Built by a student for teachers — for StudEXPO 2026',
  },
  kg: {
    ab_title: 'Platforma жөнүндө',
    ab_sub: 'EduPlatform эмне үчүн жана эмнеси менен айырмаланат',
    ab_story_t: 'Бир жакшы сабак канча турат?',
    ab_story_p1: 'Репетитор — бир нече жүз сом. Жеке мектеп — ай сайын миңдеген сом. Ал эми алыскы кыштактагы үй-бүлөгө эң кымбат: сабактын баасына шаарга чейинки жол кошулат. Чыккандай: сабактын сапаты баланы кайда төрөлгөнүнө жана ата-энесинин жумушуна байланыштуу.',
    ab_story_p2: 'PISA-2025: Кыргызстан — 91 өлкөнүн ичинен 80-орунда, мектеп окуучулардын 76% негизги деңгээлден төмөн, мектептерге 761 мугалим жетишпейт. Тоодогу мектепти жылдар бою курушат, репетиторду ар бир кыштакка жиберсе болбойт — ал эми телефон дээрлик ар бир окуучунун капчыгында. Жакшы сабак ата-энесине телефон чалуу сыяктуу эле арзан туруш керек: дээрлик эч нерсе. Ошондуктан мен EduPlatform түздүм — браузерде жашаган жана ар бир телефонго өзү келген сабак.',
    ab_quote: 'Ар бир кыштакка мектеп курушум керек эмес. Мага сабактын өзү ар бир телефонго келиши керек.',
    ab_prob1t: 'Биринин ордуна он терезе',
    ab_prob1x: 'Word + PowerPoint + видео + тест — бир сабак үчүн төрт программа жана он вкладка.',
    ab_prob2t: 'Алсыз ноутбуктор көтөрбөйт',
    ab_prob2x: 'Мугалимдердин көбү эски техникада: көп вкладка = оперативка жана процессорго жүк, сабакта тоңуу.',
    ab_prob3t: 'Баары ар башка жерде',
    ab_prob3x: 'Материалдар папкаларда жана флешкаларда жоголот: сабак, тест, презентация өзүнчө сакталат.',
    ab_sol_t: 'Чечим — бир терезеде баары',
    ab_sol_x: 'Блоктордон сабак, презентация, авто-текшерүү менен тесттер, 2D/3D доска, код редактору жана Word — бир браузер терезесинде. Жеңил интерфейс, чын офлайн режим, кыргыз тили даяр.',
    ab_table_t: 'Эмнеси менен айырмаланабыз',
    ab_table_sub: 'Белгилүү платформалар менен түз салыштыруу',
    ab_yes: 'Ооба', ab_part: 'Тартыш', ab_no: 'Жок',
    ab_cta_t: 'Өзүңүз сынап көрүңүз — катталбай',
    ab_cta_sub: 'Демо-кирүү: demo / demo1234. Же конок катары сабактарды көрүңүз.',
    ab_cta_btn: 'Сабактарды ачуу',
    ab_demo_btn: 'demo катары кирүү',
    ab_made: 'Мугалимдер үчүн мектеп окуучусу жасаган — StudEXPO 2026',
  },
}

// [мы, Google Classroom, Kahoot, Moodle]: 2 = да, 1 = частично, 0 = нет
const ROWS_RU = [
  { name: '🧪 Тесты как в Google Forms (конструктор, автопроверка)', vals: [2, 0, 0, 1] },
  { name: 'Работает без API-ключей (офлайн-генератор)', vals: [2, 2, 2, 0] },
  { name: 'Доска 2D/3D с осями координат', vals: [2, 0, 0, 0] },
  { name: 'Редактор кода с живым HTML-превью', vals: [2, 0, 0, 0] },
  { name: 'Кыргызский язык интерфейса', vals: [2, 0, 0, 1] },
  { name: 'Игры-тренажёры по предметам', vals: [2, 0, 2, 0] },
  { name: 'Защита тестов от скриншотов', vals: [2, 0, 0, 0] },
  { name: 'Всё в одном окне (урок+тест+презентация)', vals: [2, 1, 0, 1] },
  { name: 'Мини-журнал: ручные колонки, оценки и средние', vals: [2, 2, 0, 1] },
  { name: 'Работает на телефоне и интерактивной доске', vals: [2, 2, 2, 1] },
  { name: 'Демо-вход без регистрации и сборок', vals: [2, 0, 0, 0] },
  { name: 'Лёгкая для старых ноутбуков', vals: [2, 1, 2, 0] },
]

export default function About() {
  const { lang, t } = useLang()
  const L = DICT[lang] || DICT.ru
  const mark = (v: number) => v === 2
    ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><Check size={15} strokeWidth={3}/></span>
    : v === 1
      ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" title={L.ab_part}><Minus size={14} strokeWidth={3}/></span>
      : <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800"><X size={14} strokeWidth={3}/></span>
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8" data-testid="about-page">
      <div>
        <h1 className="font-display font-bold text-3xl sm:text-4xl dark:text-white">{L.ab_title}</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">{L.ab_sub}</p>
      </div>

      {/* История: цифры и правда о цене урока */}
      <section className="bg-slate-900 rounded-3xl p-6 sm:p-8 text-white">
        <div className="flex items-center gap-2 text-blue-100 text-sm font-semibold mb-3"><Heart size={16}/> {L.ab_story_t}</div>
        <p className="text-lg leading-relaxed font-medium">{L.ab_story_p1}</p>
        <p className="mt-3 leading-relaxed text-blue-50">{L.ab_story_p2}</p>
        {L.ab_quote && (
          <blockquote className="mt-5 border-l-4 border-white/40 pl-4 text-lg font-display font-bold italic text-white/95">
            «{L.ab_quote}»
          </blockquote>
        )}
      </section>

      {/* Проблемы → решение */}
      <section className="grid sm:grid-cols-3 gap-4">
        {[['🗂️', L.ab_prob1t, L.ab_prob1x], ['🔋', L.ab_prob2t, L.ab_prob2x], ['🧩', L.ab_prob3t, L.ab_prob3x]].map(([emo, tt, xx]) => (
          <div key={tt as string} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5">
            <div className="text-2xl">{emo as string}</div>
            <div className="font-bold mt-2 dark:text-white">{tt as string}</div>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{xx as string}</div>
          </div>
        ))}
      </section>
      <section className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-6">
        <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-300"><Sparkles size={18}/> {L.ab_sol_t}</div>
        <p className="text-sm sm:text-base text-emerald-900/80 dark:text-emerald-200/80 mt-2">{L.ab_sol_x}</p>
      </section>

      {/* Сравнительная таблица */}
      <section>
        <h2 className="font-display font-bold text-2xl dark:text-white">{L.ab_table_t}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{L.ab_table_sub}</p>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <table className="w-full text-sm" data-testid="about-table">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left">
                <th className="p-3 font-semibold dark:text-white min-w-[220px]"></th>
                <th className="p-3 text-center font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">EduPlatform</th>
                <th className="p-3 text-center font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Google Classroom</th>
                <th className="p-3 text-center font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Kahoot</th>
                <th className="p-3 text-center font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Moodle</th>
              </tr>
            </thead>
            <tbody>
              {ROWS_RU.map(r => (
                <tr key={r.name} className="border-b border-slate-100 dark:border-slate-700/60 last:border-0">
                  <td className="p-3 dark:text-white">{r.name}</td>
                  {r.vals.map((v, i) => <td key={i} className="p-3 text-center">{mark(v)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs font-medium text-slate-500 dark:text-slate-400" data-testid="about-table-legend">
          <span className="inline-flex items-center gap-1.5"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><Check size={12} strokeWidth={3} /></span>{L.ab_yes}</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><Minus size={11} strokeWidth={3} /></span>{L.ab_part}</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-slate-400 dark:bg-slate-800"><X size={11} strokeWidth={3} /></span>{L.ab_no}</span>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6 sm:p-8 text-center">
        <h2 className="font-display font-bold text-2xl dark:text-white">{L.ab_cta_t}</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">{L.ab_cta_sub}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-5">
          <Link to="/lessons" className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-lg btn-hover inline-flex items-center gap-2">{L.ab_cta_btn} <ArrowRight size={16}/></Link>
          <Link to="/login" className="px-5 py-3 rounded-xl bg-slate-100 dark:bg-slate-700 dark:text-white font-bold btn-hover">{L.ab_demo_btn}</Link>
        </div>
        <div className="mt-6 text-xs text-slate-400 flex items-center justify-center gap-1.5"><Zap size={12}/> {L.ab_made}</div>
      </section>
      <div className="text-center pb-4">
        <span className="text-xs text-slate-400 inline-flex items-center gap-1"><Layers size={12}/> {t('tagline')}</span>
      </div>
    </div>
  )
}
