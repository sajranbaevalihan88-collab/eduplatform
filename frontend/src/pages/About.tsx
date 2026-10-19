import { Link } from 'react-router-dom'
import { Heart, Monitor, Zap, Layers, Check, Minus, X, ArrowRight, Sparkles } from 'lucide-react'
import { useLang } from '../context/LangContext'

const DICT: Record<string, Record<string, string>> = {
  ru: {
    ab_title: 'О платформе',
    ab_sub: 'Почему EduPlatform AI существует и чем отличается',
    ab_story_t: 'Откуда идея',
    ab_story_p1: 'Идея родилась дома. Мама — преподаватель. Постоянно одно и то же: открыть Word, порыться в папках в поисках то презентации, то видео, то теста. Десять вкладок браузера, Word, PowerPoint, плеер — всё одновременно.',
    ab_story_p2: 'Ноутбук старый, оперативки мало, кулер воет, ноутбук виснет посреди урока. И так не у неё одной — у большинства преподавателей университетов и колледжей техника слабая. Стало ясно: преподавателям нужен один инструмент вместо десяти окон.',
    ab_prob1t: 'Десять окон вместо одного',
    ab_prob1x: 'Word + PowerPoint + видео + тест — четыре программы и десяток вкладок ради одного урока.',
    ab_prob2t: 'Слабые ноутбуки не тянут',
    ab_prob2x: 'Старая техника у большинства преподов: много вкладок = нагрузка на оперативку и процессор, зависания на уроке.',
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
    ab_sub: 'Why EduPlatform AI exists and how it differs',
    ab_story_t: 'Where the idea came from',
    ab_story_p1: 'The idea was born at home. My mom is a teacher. The same routine every day: open Word, dig through folders for a presentation, a video, a test. Ten browser tabs, Word, PowerPoint, a video player — all at once.',
    ab_story_p2: 'Her laptop is old, low on RAM, the fan roars, the machine freezes mid-lesson. And she is not alone — most university and college teachers have weak hardware. Teachers need one tool instead of ten windows.',
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
    ab_sub: 'EduPlatform AI эмне үчүн жана эмнеси менен айырмаланат',
    ab_story_t: 'Идея кайдан жаралды',
    ab_story_p1: 'Идея үйдө жаралды. Апам — мугалим. Күн сайын бирдей: Word ачып, папкалардан презентация, видео, тест издейт. Он вкладка, Word, PowerPoint, видео ойноткуч — бир убакта.',
    ab_story_p2: 'Ноутбук эски, оперативка аз, желбирөөч айкалдап, сабактын ортосунда тоңуп калат. Ал гана эмес — университет жана колледж мугалимдеринин көбүнүн техникасы алсыз. Мугалимге он терезенин ордуна бир курал керек.',
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
  { name: 'ИИ-генерация тестов из текста урока', vals: [2, 0, 0, 1] },
  { name: 'Работает без API-ключей (офлайн-генератор)', vals: [2, 2, 2, 0] },
  { name: 'Доска 2D/3D с осями координат', vals: [2, 0, 0, 0] },
  { name: 'Редактор кода с живым HTML-превью', vals: [2, 0, 0, 0] },
  { name: 'Кыргызский язык интерфейса', vals: [2, 0, 0, 1] },
  { name: 'Игры-тренажёры по предметам', vals: [2, 0, 2, 0] },
  { name: 'Защита тестов от скриншотов', vals: [2, 0, 0, 0] },
  { name: 'Всё в одном окне (урок+тест+презентация)', vals: [2, 1, 0, 1] },
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

      {/* История */}
      <section className="bg-gradient-to-br from-blue-600 to-cyan-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl">
        <div className="flex items-center gap-2 text-blue-100 text-sm font-semibold mb-3"><Heart size={16}/> {L.ab_story_t}</div>
        <p className="text-lg leading-relaxed font-medium">{L.ab_story_p1}</p>
        <p className="mt-3 leading-relaxed text-blue-50">{L.ab_story_p2}</p>
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
                <th className="p-3 text-center font-bold text-blue-700 dark:text-blue-300 whitespace-nowrap">EduPlatform AI</th>
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
      </section>

      {/* CTA */}
      <section className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 p-6 sm:p-8 text-center">
        <h2 className="font-display font-bold text-2xl dark:text-white">{L.ab_cta_t}</h2>
        <p className="text-slate-500 dark:text-slate-400 mt-2 text-sm">{L.ab_cta_sub}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-5">
          <Link to="/lessons" className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold shadow-lg btn-hover inline-flex items-center gap-2">{L.ab_cta_btn} <ArrowRight size={16}/></Link>
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
