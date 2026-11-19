import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { useAccessibility, toast } from '../context/UIContext'
import { playArkanSound } from '../utils/sound'
import { sfx } from '../utils/sfx'
import { READY_TOPICS } from '../data/readyTopics'
import { isStudent, isGuest } from '../utils/role'
import { Play, Volume2, ArrowRight, RotateCcw, Sparkles, Plus, Trash2, Users, Bot, Zap } from 'lucide-react'
import { useLang } from '../context/LangContext'

type Opt = { id?: number; text: string; is_correct: boolean }
type Q = { id?: number; text: string; type: string; points: number; options: Opt[]; explanation?: string }
type TestT = { id: number | string; title: string; questions?: Q[] }
type BattleMode = 'turns' | 'duel' | 'ai'

const PULL_CORRECT = 14
const PULL_MISS = 6

const MASCOTS = ['🦅', '🐺', '🐴', '🐆', '🏔️', '🦁', '🐉']

function loadMascot(key: string, fallback: string) {
  try {
    const v = localStorage.getItem(key)
    return v && MASCOTS.includes(v) ? v : fallback
  } catch { return fallback }
}

const DEMO_QS: Q[] = [
  {
    text: 'Что выводит print(2 + 2 * 2) в Python?', type: 'single', points: 1,
    options: [
      { text: '6', is_correct: true }, { text: '8', is_correct: false },
      { text: '4', is_correct: false }, { text: 'Ошибка', is_correct: false },
    ],
  },
  {
    text: 'Python — интерпретируемый язык программирования. Верно?', type: 'true_false', points: 1,
    options: [{ text: 'Верно', is_correct: true }, { text: 'Неверно', is_correct: false }],
  },
  {
    text: 'Какой тег делает текст жирным в HTML?', type: 'single', points: 1,
    options: [
      { text: '<b>', is_correct: true }, { text: '<i>', is_correct: false },
      { text: '<u>', is_correct: false }, { text: '<p>', is_correct: false },
    ],
  },
  {
    text: 'Столица Кыргызской Республики?', type: 'single', points: 1,
    options: [
      { text: 'Бишкек', is_correct: true }, { text: 'Ош', is_correct: false },
      { text: 'Каракол', is_correct: false }, { text: 'Нарын', is_correct: false },
    ],
  },
  {
    text: 'Список (list) в Python является изменяемым. Верно?', type: 'true_false', points: 1,
    options: [{ text: 'Верно', is_correct: true }, { text: 'Неверно', is_correct: false }],
  },
  {
    text: 'Чему равен корень уравнения 3x - 5 = 16?', type: 'single', points: 1,
    options: [
      { text: '7', is_correct: true }, { text: '5', is_correct: false },
      { text: '6', is_correct: false }, { text: '8', is_correct: false },
    ],
  },
  {
    text: 'Какое озеро называют «Жемчужиной Кыргызстана»?', type: 'single', points: 1,
    options: [
      { text: 'Иссык-Куль', is_correct: true }, { text: 'Сон-Куль', is_correct: false },
      { text: 'Сары-Челек', is_correct: false }, { text: 'Чатыр-Куль', is_correct: false },
    ],
  },
  {
    text: 'Какой оператор в Python возвращает остаток от деления?', type: 'single', points: 1,
    options: [
      { text: '%', is_correct: true }, { text: '//', is_correct: false },
      { text: '**', is_correct: false }, { text: '/', is_correct: false },
    ],
  },
]

// ── Полноценная 2D-сцена «Аркан Тартыш» на джайлоо Ала-Тоо ──
function Arkan2DScene({
  rope,
  teamA,
  teamB,
  mascA,
  mascB,
  scoreA,
  scoreB,
  turn,
  pullAnim,
  lastGain,
  combo,
}: {
  rope: number // -100 (Team B wins on right) .. +100 (Team A wins on left)
  teamA: string
  teamB: string
  mascA: string
  mascB: string
  scoreA: number
  scoreB: number
  turn: 'A' | 'B'
  pullAnim: 'none' | 'A' | 'B'
  lastGain: string | null
  combo: number
}) {
  // В нашей механике: rope > 0 означает перетягивание в пользу Команды А (влево),
  // rope < 0 — в пользу Команды Б (вправо).
  // Центр поля в SVG: X = 450 (из 900). Смещение каната: до ±170px.
  const shiftPx = -(rope / 100) * 165
  const knotX = 450 + shiftPx
  const tension = Math.min(1, Math.abs(rope) / 75)
  const isPullA = pullAnim === 'A'
  const isPullB = pullAnim === 'B'

  // Угол наклона батыров: когда тянут — отклоняются назад (-22° / +22°), когда их тянут — клонятся вперёд
  const leanA = isPullA ? -24 : isPullB ? 12 : -11
  const leanB = isPullB ? 24 : isPullA ? -12 : 11

  return (
    <div className="relative w-full rounded-3xl overflow-hidden border-2 border-amber-500/50 shadow-2xl bg-slate-900 select-none" data-testid="arkan-2d-arena">
      {/* Верхний HUD поверх 2D-сцены */}
      <div className="absolute top-2.5 inset-x-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
        <div className={`px-3.5 py-1.5 rounded-2xl backdrop-blur-md border-2 transition-all flex items-center gap-2 shadow-lg ${
          turn === 'A'
            ? 'bg-blue-600/90 border-amber-300 text-white scale-105'
            : 'bg-slate-900/75 border-blue-400/40 text-blue-100'
        }`}>
          <span className="text-2xl">{mascA}</span>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider opacity-85">{teamA}</div>
            <div className="text-lg font-black leading-none">{scoreA} очк.</div>
          </div>
        </div>

        {/* Индикатор перевеса каната в центре */}
        <div className="px-4 py-1.5 rounded-2xl bg-slate-950/80 backdrop-blur-md border border-amber-400/40 text-center shadow-lg">
          <div className="text-[10px] uppercase tracking-widest text-amber-300 font-bold">Перевес каната</div>
          <div className="font-mono font-black text-sm text-white flex items-center justify-center gap-2">
            <span className="text-blue-400">{Math.max(0, Math.round(rope))}%</span>
            <span className="text-amber-400">🪢</span>
            <span className="text-rose-400">{Math.max(0, Math.round(-rope))}%</span>
          </div>
        </div>

        <div className={`px-3.5 py-1.5 rounded-2xl backdrop-blur-md border-2 transition-all flex items-center gap-2 shadow-lg ${
          turn === 'B'
            ? 'bg-rose-600/90 border-amber-300 text-white scale-105'
            : 'bg-slate-900/75 border-rose-400/40 text-rose-100'
        }`}>
          <div className="text-right">
            <div className="text-xs font-extrabold uppercase tracking-wider opacity-85">{teamB}</div>
            <div className="text-lg font-black leading-none">{scoreB} очк.</div>
          </div>
          <span className="text-2xl">{mascB}</span>
        </div>
      </div>

      {/* Всплывающий бонус удара / рывка */}
      {lastGain && (
        <div
          className="absolute top-14 left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-amber-400 text-slate-950 font-display font-black text-base sm:text-lg shadow-xl animate-bounce"
          aria-live="polite"
        >
          💪 Рывок {lastGain}!
        </div>
      )}

      {/* 2D SVG-Арена Джайлоо */}
      <svg
        viewBox="0 0 900 310"
        className="w-full h-[220px] sm:h-[285px] block"
        role="img"
        aria-label="2D Арена Аркан Тартыш"
      >
        <defs>
          {/* Небо джайлоо */}
          <linearGradient id="jailooSky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="48%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#fde68a" />
          </linearGradient>
          {/* Трава */}
          <linearGradient id="jailooGrass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4ade80" />
            <stop offset="35%" stopColor="#16a34a" />
            <stop offset="100%" stopColor="#14532d" />
          </linearGradient>
          {/* Текстура витого каната */}
          <pattern id="ropeBraid" width="14" height="10" patternUnits="userSpaceOnUse">
            <rect width="14" height="10" fill="#d97706" />
            <path d="M0 10 L7 0 L14 0 L7 10 Z" fill="#f59e0b" />
            <path d="M0 0 L3 0 L0 4 Z M11 10 L14 6 L14 10 Z" fill="#92400e" />
          </pattern>
          {/* Грязевая ров-ловушка по центру */}
          <linearGradient id="mudPit" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#451a03" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
        </defs>

        {/* 1. Небо и золотое солнце Түндүк */}
        <rect x="0" y="0" width="900" height="190" fill="url(#jailooSky)" />
        <g transform="translate(450, 58)">
          <circle r="38" fill="#fef08a" opacity="0.25" />
          <circle r="25" fill="#facc15" />
          <circle r="19" fill="none" stroke="#dc2626" strokeWidth="2" opacity="0.55" />
          <path d="M-12 -5 L12 5 M-12 5 L12 -5 M-5 -12 L5 12 M-5 12 L5 -12" stroke="#dc2626" strokeWidth="1.6" opacity="0.55" />
        </g>

        {/* Облака */}
        <g fill="#ffffff" opacity="0.75">
          <ellipse cx="145" cy="48" rx="38" ry="12" />
          <ellipse cx="165" cy="42" rx="24" ry="11" />
          <ellipse cx="735" cy="52" rx="42" ry="12" />
          <ellipse cx="715" cy="45" rx="25" ry="10" />
        </g>

        {/* 2. Снежные хребты Ала-Тоо */}
        <polygon points="0,190 95,88 195,190" fill="#475569" />
        <polygon points="95,88 68,117 95,110 122,118" fill="#f8fafc" />

        <polygon points="130,190 265,68 400,190" fill="#334155" />
        <polygon points="265,68 228,108 252,99 265,112 282,98 302,108" fill="#ffffff" />

        <polygon points="335,190 450,82 565,190" fill="#475569" />
        <polygon points="450,82 420,114 450,105 480,114" fill="#f1f5f9" />

        <polygon points="500,190 645,64 785,190" fill="#334155" />
        <polygon points="645,64 606,106 632,96 645,110 664,97 684,106" fill="#ffffff" />

        <polygon points="710,190 815,92 900,190" fill="#475569" />
        <polygon points="815,92 790,118 815,111 840,118" fill="#f8fafc" />

        {/* Зелёные предгорья и юрты (Боз үй) на заднем плане */}
        <path d="M0 190 Q220 156 450 182 Q680 156 900 190 Z" fill="#15803d" opacity="0.7" />
        {/* Левая юрта */}
        <g transform="translate(105, 152)">
          <path d="M0 32 L0 16 Q24 -6 48 16 L48 32 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M16 5 Q24 0 32 5" fill="none" stroke="#dc2626" strokeWidth="2.5" />
          <rect x="20" y="18" width="8" height="14" rx="2" fill="#b45309" />
        </g>
        {/* Правая юрта */}
        <g transform="translate(745, 152)">
          <path d="M0 32 L0 16 Q24 -6 48 16 L48 32 Z" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.5" />
          <path d="M16 5 Q24 0 32 5" fill="none" stroke="#dc2626" strokeWidth="2.5" />
          <rect x="20" y="18" width="8" height="14" rx="2" fill="#b45309" />
        </g>

        {/* 3. Основное зелёное поле боя */}
        <rect x="0" y="184" width="900" height="126" fill="url(#jailooGrass)" />
        {/* Беговая/боевая грунтовая дорожка */}
        <rect x="25" y="232" width="850" height="52" rx="26" fill="#b45309" opacity="0.38" />
        <rect x="35" y="238" width="830" height="40" rx="20" fill="#fef3c7" opacity="0.22" />

        {/* 4. Центральный ров и победные рубежи */}
        {/* Левый рубеж победы (Команда А побеждает, когда узел доходит до X=285) */}
        <g transform="translate(285, 178)">
          <line x1="0" y1="0" x2="0" y2="108" stroke="#3b82f6" strokeWidth="3.5" strokeDasharray="6 4" />
          <polygon points="0,0 -26,9 0,18" fill="#2563eb" />
          <text x="-4" y="102" fill="#bfdbfe" fontSize="10" fontWeight="bold" textAnchor="end">РУБЕЖ {teamA.toUpperCase()}</text>
        </g>

        {/* Правый рубеж победы (Команда Б побеждает, когда узел доходит до X=615) */}
        <g transform="translate(615, 178)">
          <line x1="0" y1="0" x2="0" y2="108" stroke="#ef4444" strokeWidth="3.5" strokeDasharray="6 4" />
          <polygon points="0,0 26,9 0,18" fill="#dc2626" />
          <text x="4" y="102" fill="#fecaca" fontSize="10" fontWeight="bold" textAnchor="start">РУБЕЖ {teamB.toUpperCase()}</text>
        </g>

        {/* Центральная яма и линия центра */}
        <ellipse cx="450" cy="264" rx="46" ry="14" fill="url(#mudPit)" stroke="#fde68a" strokeWidth="2" opacity="0.85" />
        <line x1="450" y1="184" x2="450" y2="294" stroke="#ffffff" strokeWidth="2.5" strokeDasharray="5 5" opacity="0.75" />

        {/* 5. БАТЫРЫ КОМАНДЫ А (СЛЕВА — Синие) */}
        {[0, 1, 2].map((idx) => {
          const baseX = knotX - 85 - idx * 64
          const baseY = 248
          return (
            <g
              key={`teamA-${idx}`}
              transform={`translate(${baseX}, ${baseY})`}
              style={{ transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            >
              {/* Тень под ногами */}
              <ellipse cx="0" cy="18" rx="18" ry="5" fill="rgba(0,0,0,0.28)" />
              {/* Пыль из-под сапог при рывке */}
              {isPullA && (
                <g fill="#fef3c7" opacity="0.8">
                  <circle cx="18" cy="14" r="5" />
                  <circle cx="26" cy="9" r="3.5" />
                  <circle cx="14" cy="7" r="3" />
                </g>
              )}
              <g transform={`rotate(${leanA})`} style={{ transition: 'transform 300ms ease-out' }}>
                {/* Задняя и передняя ноги (упираются в землю вперёд) */}
                <line x1="-4" y1="-2" x2="-15" y2="16" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
                <line x1="4" y1="-2" x2="18" y2="16" stroke="#0f172a" strokeWidth="6" strokeLinecap="round" />
                {/* Торс с национальным поясом кемер */}
                <rect x="-11" y="-34" width="22" height="33" rx="8" fill="#2563eb" stroke="#1d4ed8" strokeWidth="2" />
                <rect x="-11" y="-11" width="22" height="6" fill="#f59e0b" />
                {/* Эмблема на груди */}
                <text x="0" y="-16" fontSize="11" textAnchor="middle">{idx === 0 ? mascA : '★'}</text>
                {/* Голова */}
                <circle cx="0" cy="-46" r="10.5" fill="#fed7aa" stroke="#d97706" strokeWidth="1.5" />
                {/* Лицо (смотрит вправо на соперника) */}
                <circle cx="4" cy="-47" r="1.5" fill="#0f172a" />
                <path d={isPullA ? 'M1 -42 Q5 -39 8 -42' : 'M2 -42 L7 -42'} stroke="#0f172a" strokeWidth="1.5" fill="none" />
                {/* Белый кыргызский Ак-Калпак */}
                <polygon points="-12,-52 12,-52 7,-71 -7,-71" fill="#ffffff" stroke="#334155" strokeWidth="1.5" />
                <path d="M-13,-52 Q0,-49 13,-52" stroke="#1e293b" strokeWidth="3" fill="none" />
                <line x1="0" y1="-69" x2="0" y2="-54" stroke="#1e293b" strokeWidth="1.3" />
                <circle cx="0" cy="-72" r="2" fill="#1e293b" />
                {/* Руки, сжимающие канат */}
                <line x1="-4" y1="-25" x2="14" y2="-16" stroke="#fed7aa" strokeWidth="5.5" strokeLinecap="round" />
              </g>
            </g>
          )
        })}

        {/* 6. БАТЫРЫ КОМАНДЫ Б (СПРАВА — Красные) */}
        {[0, 1, 2].map((idx) => {
          const baseX = knotX + 85 + idx * 64
          const baseY = 248
          return (
            <g
              key={`teamB-${idx}`}
              transform={`translate(${baseX}, ${baseY})`}
              style={{ transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            >
              {/* Тень под ногами */}
              <ellipse cx="0" cy="18" rx="18" ry="5" fill="rgba(0,0,0,0.28)" />
              {/* Пыль из-под сапог при рывке */}
              {isPullB && (
                <g fill="#fef3c7" opacity="0.8">
                  <circle cx="-18" cy="14" r="5" />
                  <circle cx="-26" cy="9" r="3.5" />
                  <circle cx="-14" cy="7" r="3" />
                </g>
              )}
              <g transform={`rotate(${leanB})`} style={{ transition: 'transform 300ms ease-out' }}>
                {/* Ноги (упираются влево) */}
                <line x1="4" y1="-2" x2="15" y2="16" stroke="#1e293b" strokeWidth="6" strokeLinecap="round" />
                <line x1="-4" y1="-2" x2="-18" y2="16" stroke="#0f172a" strokeWidth="6" strokeLinecap="round" />
                {/* Торс с золотым поясом */}
                <rect x="-11" y="-34" width="22" height="33" rx="8" fill="#dc2626" stroke="#991b1b" strokeWidth="2" />
                <rect x="-11" y="-11" width="22" height="6" fill="#f59e0b" />
                <text x="0" y="-16" fontSize="11" textAnchor="middle">{idx === 0 ? mascB : '★'}</text>
                {/* Голова */}
                <circle cx="0" cy="-46" r="10.5" fill="#fed7aa" stroke="#d97706" strokeWidth="1.5" />
                {/* Лицо (смотрит влево) */}
                <circle cx="-4" cy="-47" r="1.5" fill="#0f172a" />
                <path d={isPullB ? 'M-8 -42 Q-5 -39 -1 -42' : 'M-7 -42 L-2 -42'} stroke="#0f172a" strokeWidth="1.5" fill="none" />
                {/* Ак-Калпак */}
                <polygon points="-12,-52 12,-52 7,-71 -7,-71" fill="#ffffff" stroke="#334155" strokeWidth="1.5" />
                <path d="M-13,-52 Q0,-49 13,-52" stroke="#991b1b" strokeWidth="3" fill="none" />
                <line x1="0" y1="-69" x2="0" y2="-54" stroke="#991b1b" strokeWidth="1.3" />
                <circle cx="0" cy="-72" r="2" fill="#991b1b" />
                {/* Руки, сжимающие канат */}
                <line x1="4" y1="-25" x2="-14" y2="-16" stroke="#fed7aa" strokeWidth="5.5" strokeLinecap="round" />
              </g>
            </g>
          )
        })}

        {/* 7. ВИТОЙ КАНАТ (АРКАН) И ЦЕНТРАЛЬНАЯ КРАСНАЯ ЛЕНТА */}
        <g
          transform={`translate(${shiftPx}, 0)`}
          style={{ transition: 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          {/* Тень каната */}
          <line x1="175" y1="258" x2="725" y2="258" stroke="rgba(0,0,0,0.22)" strokeWidth="6" strokeLinecap="round" />
          {/* Сам канат */}
          <rect x="170" y="227" width="560" height="9" rx="4.5" fill="url(#ropeBraid)" stroke="#78350f" strokeWidth="1.4" />
          {/* Искры напряжения при большом комбо */}
          {(combo >= 2 || tension > 0.5) && (
            <g>
              <circle cx="450" cy="231" r="18" fill="#facc15" opacity="0.28" />
              <circle cx="450" cy="231" r="11" fill="#fde047" opacity="0.45" />
            </g>
          )}
          {/* Центральный узел и красная шёлковая лента (Кызыл тасма) */}
          <rect x="444" y="223" width="12" height="17" rx="3" fill="#fbbf24" stroke="#78350f" strokeWidth="1.5" />
          <path d="M450 238 L442 262 L450 256 L458 262 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="1" />
        </g>

        {/* Нижняя шкала прогресса от -100 до +100 прямо на арене */}
        <g transform="translate(285, 294)">
          <rect x="0" y="0" width="330" height="8" rx="4" fill="rgba(15,23,42,0.65)" />
          <rect
            x="0"
            y="0"
            width={Math.max(6, Math.min(330, 165 - (rope / 100) * 165))}
            height="8"
            rx="4"
            fill="#3b82f6"
          />
          <circle
            cx={Math.max(6, Math.min(324, 165 - (rope / 100) * 165))}
            cy="4"
            r="6"
            fill="#fbbf24"
            stroke="#ffffff"
            strokeWidth="2"
          />
        </g>
      </svg>
    </div>
  )
}

export default function Arkan() {
  const { speak, speech, autoRead, toggleAutoRead } = useAccessibility()
  const tr = useLang().t
  const [searchParams] = useSearchParams()
  const [phase, setPhase] = useState<'lobby' | 'battle' | 'result'>('lobby')
  const [tab, setTab] = useState<'topics' | 'mine' | 'public' | 'custom'>('topics')
  const student = isStudent()
  const noMine = student || isGuest()
  const [mine, setMine] = useState<TestT[]>([])
  const [pub, setPub] = useState<TestT[]>([])
  const [sel, setSel] = useState<TestT | null>(null)
  const [busy, setBusy] = useState(false)
  const [teamA, setTeamA] = useState('Көк-Бөрү')
  const [teamB, setTeamB] = useState('Ак-Шумкар')
  const [mascA, setMascA] = useState(() => loadMascot('edu-arkan-mascA', '🦅'))
  const [mascB, setMascB] = useState(() => loadMascot('edu-arkan-mascB', '🐺'))
  const [qtime, setQtime] = useState(15)
  const [battleMode, setBattleMode] = useState<BattleMode>('turns')

  // Конструктор + ИИ прямо внутри Аркан Тартыш
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiCount, setAiCount] = useState(10)
  const [aiBusy, setAiBusy] = useState(false)
  const [customTitle, setCustomTitle] = useState('Мой бой Аркан тартыш')
  const [customBulk, setCustomBulk] = useState('')
  const [customQs, setCustomQs] = useState<Q[]>([])

  const pickMasc = (team: 'A' | 'B', m: string) => {
    if (team === 'A') { setMascA(m); try { localStorage.setItem('edu-arkan-mascA', m) } catch {} }
    else { setMascB(m); try { localStorage.setItem('edu-arkan-mascB', m) } catch {} }
  }

  // бой
  const [qs, setQs] = useState<Q[]>([])
  const [testId, setTestId] = useState<number | string | null>(null)
  const [qi, setQi] = useState(0)
  const [rope, setRope] = useState(0)
  const [scoreA, setScoreA] = useState(0)
  const [scoreB, setScoreB] = useState(0)
  const [turn, setTurn] = useState<'A' | 'B'>('A')
  const [left, setLeft] = useState(15)
  const [lock, setLock] = useState<null | { ok: boolean; pick: number; byTeam?: 'A' | 'B' }>(null)
  const [winner, setWinner] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [combo, setCombo] = useState(0)
  const [lastGain, setLastGain] = useState<string | null>(null)
  const [pullAnim, setPullAnim] = useState<'none' | 'A' | 'B'>('none')
  const qStartRef = useRef(0)
  const tickRef = useRef(0)

  useEffect(() => {
    if (!isGuest()) client.get('/tests/?owner=me').then(r => setMine(Array.isArray(r.data) ? r.data : r.data.results || [])).catch(() => {})
    client.get('/tests/?is_public=true').then(r => setPub(Array.isArray(r.data) ? r.data : r.data.results || [])).catch(() => {})
  }, [])

  useEffect(() => {
    const tid = searchParams.get('test')
    if (!tid) return
    client.get(`/tests/${tid}/`).then(r => {
      const full: TestT = { id: r.data.id, title: r.data.title, questions: r.data.questions || [] }
      if (playable(full).length) {
        setSel(full)
        setTab(isStudent() ? 'public' : 'mine')
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const playable = (test: TestT): Q[] =>
    (test.questions || []).filter((qq: Q) => (qq.type === 'single' || qq.type === 'true_false') && qq.options && qq.options.length >= 2)

  const pickTest = async (tests: TestT) => {
    setBusy(true)
    try {
      const r = await client.get(`/tests/${tests.id}/`)
      const full: TestT = { id: r.data.id, title: r.data.title, questions: r.data.questions || [] }
      const pl = playable(full)
      if (!pl.length) { toast(tr('arkan_no_opts'), 'error'); return }
      setSel(full)
    } catch { toast(tr('arkan_open_err'), 'error') } finally { setBusy(false) }
  }

  // Распознавание числа из запроса учителя ("сделай мне вопросы по пайтону 14 вопросов")
  const parsePromptCount = (promptStr: string, fallback: number): number => {
    const s = promptStr.toLowerCase()
    const m = s.match(/\b(\d{1,2})\s*(?:вопрос\S*|вопр\.?|суроо\S*|question\S*|задани\S*|шт\.?|штук\S*)/i)
    if (m) {
      const n = parseInt(m[1], 10)
      if (n >= 1 && n <= 40) return n
    }
    const cleaned = s.replace(/\b\d{1,2}\s*[-–]?\s*(?:класс\S*|кл\.?|grade\S*)/gi, '').replace(/python\s*3/gi, '')
    const nums = (cleaned.match(/\b(\d{1,2})\b/g) || []).map(Number).filter(n => n >= 1 && n <= 40)
    if (nums.length > 0) return nums[nums.length - 1]
    return Math.max(1, Math.min(40, fallback || 10))
  }

  const onAiPromptChange = (val: string) => {
    setAiPrompt(val)
    if (/\d/.test(val)) {
      const detected = parsePromptCount(val, aiCount)
      if (detected >= 1 && detected <= 40) setAiCount(detected)
    }
  }

  const generateArkanAI = async () => {
    if (!aiPrompt.trim()) {
      toast('Напиши запрос, например: «сделай мне вопросы по пайтону 14 вопросов»', 'error')
      return
    }
    const targetCount = parsePromptCount(aiPrompt, aiCount)
    setAiCount(targetCount)
    setAiBusy(true)
    try {
      const r = await client.post('/tests/generate/', {
        count: targetCount,
        prompt: aiPrompt.trim(),
        text: '',
      })
      const got: Q[] = (r.data?.questions || []).map((q: any) => ({
        text: q.text || '',
        type: q.type === 'true_false' ? 'true_false' : 'single',
        points: 1,
        explanation: q.explanation || '',
        options: (q.options || []).slice(0, 4).map((o: any) => ({ text: o.text || '', is_correct: !!o.is_correct })),
      })).filter((q: Q) => q.text && q.options.length >= 2)
      if (!got.length) throw new Error('empty')
      setCustomQs(got)
      const cleanName = aiPrompt.trim()
        .replace(/\b(?:сделай|создай|составь|сгенерируй|мне|нам|вопросы|вопросов|по|теме|на|тему)\b/gi, ' ')
        .replace(/\b\d{1,2}\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      const title = `✨ ${cleanName || aiPrompt.trim()} (${got.length} вопр.)`
      setCustomTitle(title)
      setSel({ id: 'ready-custom-ai', title, questions: got })
      sfx('ui.success')
      toast(`Сгенерировано ровно ${got.length} вопросов! Можно сразу начинать бой.`, 'success')
    } catch {
      toast('Не удалось сгенерировать через сервер — проверь подключение или вставь вопросы списком', 'error')
    }
    setAiBusy(false)
  }

  const parseBulkCustom = () => {
    const lines = customBulk.split('\n').map(l => l.trim()).filter(Boolean)
    const parsed: Q[] = []
    for (const ln of lines) {
      const parts = ln.split('|').map(s => s.trim()).filter(Boolean)
      if (parts.length >= 3) {
        parsed.push({
          text: parts[0],
          type: parts.length === 3 ? 'true_false' : 'single',
          points: 1,
          options: parts.slice(1, 5).map((txt, idx) => ({ text: txt, is_correct: idx === 0 })),
        })
      }
    }
    if (!parsed.length) {
      toast('Формат: Вопрос? | Правильный ответ | Неверный 1 | Неверный 2', 'error')
      return
    }
    setCustomQs(parsed)
    const title = `${customTitle || 'Свой набор'} (${parsed.length} вопр.)`
    setSel({ id: 'ready-custom-manual', title, questions: parsed })
    setCustomBulk('')
    sfx('ui.success')
    toast(`Добавлено вопросов: ${parsed.length}`, 'success')
  }

  // --- бой ---
  const resetBattle = (list: Q[], tid: number | string) => {
    setQs(list); setTestId(tid)
    setQi(0); setRope(0); setScoreA(0); setScoreB(0)
    setTurn('A'); setLeft(qtime); setLock(null); setWinner(null)
    tickRef.current = 0
    setPhase('battle')
    setCountdown(3)
    setCombo(0)
    setLastGain(null)
    setPullAnim('none')
    qStartRef.current = 0
    playArkanSound('tick')
  }

  const demoBattle = () => resetBattle(DEMO_QS.map(q => ({ ...q })), 'demo')

  const pickTopic = (topicId: string) => {
    const topic = READY_TOPICS.find(t => t.id === topicId)
    if (!topic) return
    const tq: TestT = {
      id: `ready-${topic.id}`,
      title: `${topic.icon} ${topic.title} (${tr('arkan_ready_badge')})`,
      questions: topic.questions.map(q => ({ ...q, options: q.options.map(o => ({ ...o })) })),
    }
    setSel(tq)
  }

  const startBattle = async () => {
    const cur = sel
    if (!cur) { toast(tr('arkan_pick_first'), 'error'); return }
    if (typeof cur.id === 'string' && cur.id.startsWith('ready-')) {
      const pl = playable(cur)
      if (!pl.length) { toast(tr('arkan_no_playable'), 'error'); return }
      resetBattle(pl, cur.id)
      return
    }
    setBusy(true)
    try {
      const r = await client.get(`/tests/${cur.id}/`)
      const full: TestT = { id: r.data.id, title: r.data.title, questions: r.data.questions || [] }
      const pl = playable(full)
      if (!pl.length) { toast(tr('arkan_no_opts_short'), 'error'); return }
      resetBattle(pl, full.id)
    } catch { toast(tr('arkan_open_err'), 'error') } finally { setBusy(false) }
  }

  useEffect(() => {
    if (phase !== 'battle' || lock || countdown !== null) return
    if (left <= 0) { onTimeout(); return }
    if (left <= 5 && tickRef.current !== left) { tickRef.current = left; playArkanSound('tick') }
    const iv = setInterval(() => setLeft(v => v - 1), 1000)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, left, lock, qi, countdown])

  // Ход ИИ-команды в режиме battleMode === 'ai', когда очередь команды B
  useEffect(() => {
    if (phase !== 'battle' || battleMode !== 'ai' || turn !== 'B' || lock || countdown !== null) return
    const q = qs[qi]
    if (!q) return
    const delayMs = 1800 + Math.floor(Math.random() * 1600)
    const id = window.setTimeout(() => {
      const cIdx = q.options.findIndex(o => o.is_correct)
      const botCorrect = Math.random() < 0.72
      const pick = botCorrect && cIdx >= 0 ? cIdx : Math.floor(Math.random() * q.options.length)
      answer(pick, 'B')
    }, delayMs)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, battleMode, turn, qi, lock, countdown])

  // Горячие клавиши: 1-4 (или A/S/D/F) и в режиме дуэли 7-0 (или J/K/L/;)
  useEffect(() => {
    if (phase !== 'battle' || lock || countdown !== null) return
    const q = qs[qi]
    if (!q) return
    const onKey = (e: KeyboardEvent) => {
      if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = Number(e.key) - 1
        if (idx < q.options.length) {
          if (battleMode === 'duel') answer(idx, 'A')
          else if (battleMode !== 'ai' || turn === 'A') answer(idx, turn)
        }
      } else if (battleMode === 'duel' && ['7', '8', '9', '0'].includes(e.key)) {
        const idx = e.key === '0' ? 3 : Number(e.key) - 7
        if (idx < q.options.length) answer(idx, 'B')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lock, countdown, qi, turn, battleMode])

  useEffect(() => {
    if (phase !== 'battle' || countdown === null) return
    if (countdown > 0) {
      const timeout = setTimeout(() => {
        setCountdown(c => (c !== null && c > 0 ? c - 1 : c))
        playArkanSound('tick')
      }, 700)
      return () => clearTimeout(timeout)
    }
    const timeout = setTimeout(() => {
      setCountdown(null)
      tickRef.current = 0
      setLeft(qtime)
      qStartRef.current = Date.now()
      playArkanSound('go')
    }, 600)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown])

  const finish = (r: number, a: number, b: number) => {
    const w = r >= 100 ? teamA : r <= -100 ? teamB : r > 0 ? teamA : r < 0 ? teamB : 'Ничья'
    setWinner(w)
    if (w !== 'Ничья') {
      playArkanSound('win')
      try { localStorage.setItem('edu-arkan-best', `${w} ${a}:${b} • ${new Date().toLocaleDateString()}`) } catch {}
    }
    setPhase('result')
  }

  useEffect(() => {
    if (phase !== 'result' || !speech) return
    const timeout = setTimeout(() => playArkanSound('win'), 400)
    try {
      const msg = winner === 'Ничья' ? tr('arkan_draw') : `${tr('arkan_winner_a')}${winner}!`
      speak(msg)
    } catch {}
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  useEffect(() => {
    if (phase !== 'battle' || !lock || countdown !== null) return
    const timeout = setTimeout(() => {
      applyResult(lock.ok, lock.byTeam || turn)
    }, lock.ok ? 950 : 1650)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, lock, countdown])

  useEffect(() => {
    if (phase !== 'battle' || !speech || !autoRead || countdown !== null || lock) return
    const q = qs[qi]
    if (!q) return
    speak(`${q.text}. Варианты: ${q.options.map(o => o.text).join(', ')}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, qi, countdown, autoRead, speech])

  const applyResult = (ok: boolean, activeTeam: 'A' | 'B') => {
    const elapsed = qStartRef.current ? (Date.now() - qStartRef.current) / 1000 : 999
    const speedBonus = ok ? (elapsed <= 3 ? 6 : elapsed <= 6 ? 3 : 0) : 0
    const newCombo = ok ? combo + 1 : 0
    const comboBonus = ok ? Math.min(Math.max(newCombo - 1, 0), 5) * 2 : 0
    const pull = ok ? PULL_CORRECT + speedBonus + comboBonus : -PULL_MISS
    const dir = activeTeam === 'A' ? 1 : -1
    const nr = Math.max(-100, Math.min(100, rope + dir * pull))
    const na = scoreA + (ok && activeTeam === 'A' ? 1 : 0)
    const nb = scoreB + (ok && activeTeam === 'B' ? 1 : 0)

    setRope(nr); setScoreA(na); setScoreB(nb)
    setCombo(newCombo)
    const winningPullTeam = (dir * pull) > 0 ? 'A' : 'B'
    setPullAnim(winningPullTeam)
    setTimeout(() => setPullAnim('none'), 750)

    if (ok) {
      const parts = [`+${PULL_CORRECT + speedBonus + comboBonus}%`]
      if (speedBonus > 0) parts.push(`⚡${elapsed.toFixed(1)}${tr('arkan_sec_short')}`)
      if (newCombo >= 2) parts.push(`🔥x${newCombo}`)
      setLastGain(parts.join(' '))
      setTimeout(() => setLastGain(null), 1300)
    } else {
      setLastGain(null)
    }
    playArkanSound(ok ? 'correct' : 'wrong')
    if (nr >= 100 || nr <= -100) { finish(nr, na, nb); return }
    if (qi + 1 >= qs.length) { finish(nr, na, nb); return }
    setQi(qi + 1)
    setTurn(activeTeam === 'A' ? 'B' : 'A')
    setLeft(qtime)
    setLock(null)
    tickRef.current = 0
    qStartRef.current = Date.now()
  }

  const answer = async (optIdx: number, byTeam: 'A' | 'B' = turn) => {
    if (lock || countdown !== null) return
    const q = qs[qi]
    const opt = q.options[optIdx]
    if (!opt) return
    try {
      if (typeof testId === 'number' && typeof q.id === 'number' && typeof opt.id === 'number') {
        const r = await client.post(`/tests/${testId}/answer/`, { question_id: q.id, option_id: opt.id })
        const ok = !!r.data.correct
        playArkanSound(ok ? 'correct' : 'wrong')
        setLock({ ok, pick: optIdx, byTeam })
        return
      }
      throw new Error('local')
    } catch (e: any) {
      if (typeof opt.is_correct === 'boolean') {
        const ok = opt.is_correct
        playArkanSound(ok ? 'correct' : 'wrong')
        setLock({ ok, pick: optIdx, byTeam })
        return
      }
      if (e.response) { toast(tr('arkan_offline'), 'error'); return }
    }
  }

  const onTimeout = () => {
    if (lock) return
    playArkanSound('wrong')
    setLock({ ok: false, pick: -1, byTeam: turn })
  }

  const correctIdx = (q: Q) => q.options.findIndex(o => o.is_correct)

  if (phase === 'result') {
    const wMasc = winner === teamA ? mascA : winner === teamB ? mascB : '🤝'
    const isDraw = winner === 'Ничья'
    const confetti = isDraw ? [] : Array.from({ length: 70 }, (_, i) => {
      const colors = ['#dc2626', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#fde047']
      return {
        left: (i * 97) % 100,
        delay: ((i * 37) % 20) / 10,
        dur: 2.6 + ((i * 53) % 20) / 10,
        size: 6 + ((i * 29) % 8),
        color: colors[i % colors.length],
        round: i % 3 === 0,
      }
    })
    const rematch = () => {
      setQi(0); setRope(0); setScoreA(0); setScoreB(0)
      setTurn('A'); setLeft(qtime); setLock(null); setWinner(null)
      setCombo(0); setLastGain(null); setPullAnim('none')
      tickRef.current = 0
      qStartRef.current = 0
      setPhase('battle')
      setCountdown(3)
      playArkanSound('tick')
    }
    return (
      <div className="max-w-2xl mx-auto text-center space-y-5 py-8 relative">
        {!isDraw && (
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-50" aria-hidden="true">
            {confetti.map((c, i) => (
              <span
                key={i}
                className="confetti-piece"
                style={{
                  left: `${c.left}%`,
                  width: c.size,
                  height: c.round ? c.size : c.size * 0.55,
                  background: c.color,
                  borderRadius: c.round ? '50%' : '2px',
                  animationDelay: `${c.delay}s`,
                  animationDuration: `${c.dur}s`,
                }}
              />
            ))}
          </div>
        )}
        <Link to="/games" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-400">
          {tr('arkan_to_games')}
        </Link>
        <div className="arkan-arena p-8 space-y-4">
          <div className="oimo-strip" />
          <div className="text-8xl animate-enter">{wMasc}</div>
          <h1 className="font-display font-bold text-4xl text-slate-900">
            {isDraw ? tr('arkan_draw') : `${tr('arkan_winner_a')}${winner}!`}
          </h1>
          <div className="text-2xl text-slate-800 font-bold">{mascA} {teamA} {scoreA} : {scoreB} {teamB} {mascB}</div>
          {!isDraw && <div className="font-bold text-amber-700">{tr('arkan_congrats')}</div>}
          <div className="oimo-strip" />
        </div>
        <div className="flex gap-3 justify-center">
          <button onClick={rematch}
            className="px-6 py-3 min-h-[56px] rounded-2xl bg-indigo-600 text-white font-bold flex items-center gap-2">
            <RotateCcw size={18} /> {tr('arkan_rematch')}
          </button>
          <button onClick={() => setPhase('lobby')} className="px-6 py-3 min-h-[56px] rounded-2xl bg-white border dark:bg-slate-800 dark:text-white dark:border-slate-700 font-bold">
            {tr('arkan_to_topics')}
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'battle') {
    const q = qs[qi]
    const ci = correctIdx(q)
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <button onClick={() => setPhase('lobby')}
            className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-400">
            {tr('arkan_exit_battle')}
          </button>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
            {battleMode === 'duel' ? '⚡ Одновременная дуэль 2 команд' : battleMode === 'ai' ? '🤖 Против ИИ-батыров' : '🔄 По очереди'}
          </span>
        </div>

        {/* Полноценная 2D-Сцена Аркан Тартыш */}
        <Arkan2DScene
          rope={rope}
          teamA={teamA}
          teamB={teamB}
          mascA={mascA}
          mascB={mascB}
          scoreA={scoreA}
          scoreB={scoreB}
          turn={turn}
          pullAnim={pullAnim}
          lastGain={lastGain}
          combo={combo}
        />

        <div className="arkan-arena p-4 sm:p-6 space-y-4 relative">
          <div className="oimo-strip" />

          <div className="flex flex-wrap items-center gap-3">
            {battleMode === 'duel' ? (
              <span className="px-4 py-2 rounded-xl font-bold bg-gradient-to-r from-blue-600 via-amber-500 to-rose-600 text-white shadow">
                ⚡ Кто быстрее ответит: {mascA} {teamA} (слева / клавиши 1–4) vs {mascB} {teamB} (справа / клавиши 7–0)
              </span>
            ) : (
              <span className={`px-4 py-2 rounded-xl font-bold shadow ${turn === 'A' ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'}`}>
                {tr('arkan_answering')} {turn === 'A' ? `${mascA} ${teamA}` : `${mascB} ${teamB}`}
                {battleMode === 'ai' && turn === 'B' ? ' (ИИ думает…)' : ''}
              </span>
            )}

            {combo >= 2 && (
              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-orange-100 text-orange-800 text-sm font-black">
                🔥 Серия ×{combo}
              </span>
            )}

            <span className="ml-auto flex items-center gap-2" role="timer" aria-label={`${tr('arkan_time_a')}${left}${tr('arkan_time_b')}`}>
              <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
                <circle cx="22" cy="22" r="18" fill="none" stroke="rgba(15,23,42,.12)" strokeWidth="5" />
                <circle
                  cx="22" cy="22" r="18" fill="none"
                  stroke={left <= 5 ? '#dc2626' : '#0d9488'}
                  strokeWidth="5" strokeLinecap="round"
                  className="timer-ring"
                  strokeDasharray={2 * Math.PI * 18}
                  strokeDashoffset={2 * Math.PI * 18 * (1 - Math.max(0, left) / Math.max(1, qtime))}
                  transform="rotate(-90 22 22)"
                />
              </svg>
              <span className={`font-mono font-bold text-2xl ${left <= 5 ? 'text-red-600' : 'text-slate-900'}`}>0:{String(Math.max(0, left)).padStart(2, '0')}</span>
            </span>
            <button onClick={() => speak(q.text)} className="p-2.5 rounded-xl bg-white/80 text-slate-800 border border-sky-200" aria-label={tr('arkan_speak_q')}><Volume2 size={18} /></button>
            <button onClick={toggleAutoRead} aria-pressed={autoRead} title={tr('arkan_autoread_title')}
              className={`px-3 py-2.5 rounded-xl text-xs font-bold border ${autoRead ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white/80 text-slate-800 border-sky-200'}`}>
              {autoRead ? tr('arkan_auto_on') : tr('arkan_auto_off')}
            </button>
          </div>

          {countdown !== null && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-900/55 rounded-2xl backdrop-blur-sm" aria-live="assertive">
              <div key={countdown} className="count-pop font-display font-bold text-7xl text-white drop-shadow-lg">
                {countdown > 0 ? countdown : tr('arkan_go')}
              </div>
            </div>
          )}

          <div className="text-sm text-slate-600 font-semibold">{tr('arkan_q')} {qi + 1} {tr('arkan_of')} {qs.length}</div>

          <div key={qi} className="motion-safe:animate-slide space-y-3">
            <h2 className="font-display font-bold text-2xl sm:text-3xl text-slate-900 leading-snug">{q.text}</h2>

            {/* В режиме одновременной дуэли — 2 колонки кнопок (Слева для Команды А, Справа для Команды Б) */}
            {battleMode === 'duel' ? (
              <div className="grid sm:grid-cols-2 gap-4">
                {(['A', 'B'] as const).map(tm => {
                  const isA = tm === 'A'
                  return (
                    <div key={tm} className={`p-3 rounded-2xl border-2 space-y-2 ${isA ? 'bg-blue-50/80 border-blue-400' : 'bg-rose-50/80 border-rose-400'}`}>
                      <div className={`font-extrabold text-sm flex items-center justify-between ${isA ? 'text-blue-800' : 'text-rose-800'}`}>
                        <span>{isA ? `${mascA} ${teamA}` : `${mascB} ${teamB}`}</span>
                        <span className="text-xs opacity-75">Клавиши {isA ? '1–4' : '7–0'}</span>
                      </div>
                      <div className="grid gap-2">
                        {q.options.map((o, i) => {
                          const cls = !lock
                            ? 'bg-white text-slate-900 hover:border-amber-400 shadow-sm'
                            : i === ci
                              ? 'bg-emerald-100 border-emerald-500 text-slate-900'
                              : i === lock.pick && lock.byTeam === tm
                                ? 'bg-red-100 border-red-500 text-slate-900'
                                : 'bg-white opacity-50 text-slate-900'
                          return (
                            <button
                              key={i}
                              disabled={!!lock || countdown !== null}
                              onClick={() => answer(i, tm)}
                              className={`text-left px-4 py-3 min-h-[56px] rounded-xl border-2 border-slate-200 font-bold text-base transition flex items-center gap-2 ${cls}`}
                            >
                              <span className={`w-6 h-6 rounded-md text-xs font-black flex items-center justify-center shrink-0 ${isA ? 'bg-blue-600 text-white' : 'bg-rose-600 text-white'}`}>
                                {isA ? i + 1 : (i === 3 ? 0 : i + 7)}
                              </span>
                              <span>{o.text}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {q.options.map((o, i) => {
                  const cls = !lock
                    ? 'bg-white text-slate-900 hover:border-amber-400 shadow-sm'
                    : i === ci
                      ? 'bg-emerald-100 border-emerald-500 text-slate-900'
                      : i === lock.pick
                        ? 'bg-red-100 border-red-500 text-slate-900'
                        : 'bg-white opacity-50 text-slate-900'
                  return (
                    <button
                      key={i}
                      disabled={!!lock || countdown !== null || (battleMode === 'ai' && turn === 'B')}
                      onClick={() => answer(i, turn)}
                      className={`text-left px-5 py-4 min-h-[72px] rounded-2xl border-2 border-sky-200 font-bold text-lg sm:text-xl transition flex items-center gap-3 ${cls}`}
                    >
                      <span className="w-8 h-8 rounded-lg bg-slate-900/10 text-slate-800 text-sm font-black flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span>{o.text}</span>
                    </button>
                  )
                })}
              </div>
            )}

            {lock && (
              <div className="w-full px-6 py-4 min-h-[64px] rounded-2xl bg-slate-900 text-white font-bold text-xl flex flex-wrap items-center justify-center gap-2 animate-enter" aria-live="polite">
                <span>
                  {(lock.byTeam || turn) === 'A' ? `${mascA} ${teamA}: ` : `${mascB} ${teamB}: `}
                  {lock.ok ? tr('arkan_correct') : lock.pick === -1 ? tr('arkan_timeout') : tr('arkan_wrong')}
                </span>
                <span className="text-amber-300">
                  {tr('arkan_next')} {(lock.byTeam || turn) === 'A' ? `${mascB} ${teamB}` : `${mascA} ${teamA}`} <ArrowRight size={20} className="inline" />
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // --- лобби ---
  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <Link to="/games" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-400">
        {tr('arkan_to_games')}
      </Link>

      {/* Превью 2D-Арены прямо в лобби */}
      <Arkan2DScene
        rope={0}
        teamA={teamA}
        teamB={teamB}
        mascA={mascA}
        mascB={mascB}
        scoreA={0}
        scoreB={0}
        turn="A"
        pullAnim="none"
        lastGain={null}
        combo={0}
      />

      <div className="flex flex-wrap gap-3">
        <button onClick={demoBattle}
          className="flex-1 min-w-[240px] px-6 py-4 min-h-[60px] rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-lg flex items-center justify-center gap-2 shadow-lg">
          {tr('arkan_demo')}
        </button>
        <button onClick={() => setTab('custom')}
          className="px-5 py-4 min-h-[60px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg">
          <Sparkles size={19} /> ✨ Создать свой бой с ИИ
        </button>
      </div>

      {/* Выбор режима битвы: По очереди / Одновременная дуэль / Против ИИ */}
      <div className="grid sm:grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => setBattleMode('turns')}
          className={`p-3.5 rounded-2xl border-2 text-left transition ${battleMode === 'turns' ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-white' : 'bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'}`}
        >
          <div className="font-extrabold text-sm flex items-center gap-1.5"><Users size={16} className="text-indigo-600" /> 🔄 По очереди (Классика)</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Команды отвечают по очереди у интерактивной доски</div>
        </button>
        <button
          type="button"
          onClick={() => setBattleMode('duel')}
          className={`p-3.5 rounded-2xl border-2 text-left transition ${battleMode === 'duel' ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30 dark:text-white' : 'bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'}`}
        >
          <div className="font-extrabold text-sm flex items-center gap-1.5"><Zap size={16} className="text-amber-500" /> ⚡ Дуэль на скорость</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Обе команды отвечают одновременно — кто быстрее, тот тянет!</div>
        </button>
        <button
          type="button"
          onClick={() => setBattleMode('ai')}
          className={`p-3.5 rounded-2xl border-2 text-left transition ${battleMode === 'ai' ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-white' : 'bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'}`}
        >
          <div className="font-extrabold text-sm flex items-center gap-1.5"><Bot size={16} className="text-emerald-600" /> 🤖 Против ИИ-батыров</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Одиночная тренировка против компьютерной команды</div>
        </button>
      </div>

      {/* Настройка команд и таймера */}
      <div className="grid sm:grid-cols-3 gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700">
        <div className="text-sm dark:text-slate-300 font-semibold">{tr('arkan_team_left')}
          <div className="mt-1 flex gap-1">
            <input value={teamA} onChange={e => setTeamA(e.target.value.slice(0, 20))} aria-label={tr('arkan_team_left')} className="flex-1 min-w-0 px-3 py-2.5 min-h-[44px] rounded-xl border dark:bg-slate-700 dark:text-white font-bold" />
          </div>
          <div className="mt-1.5 flex gap-1" role="group" aria-label={tr('arkan_masc_left')}>
            {MASCOTS.map(m => (
              <button key={m} onClick={() => pickMasc('A', m)} aria-pressed={mascA === m}
                className={`flex-1 min-h-[38px] rounded-xl text-lg border ${mascA === m ? 'bg-blue-100 border-blue-500 dark:bg-blue-900/50' : 'bg-slate-50 dark:bg-slate-900 dark:border-slate-700'}`}>{m}</button>
            ))}
          </div>
        </div>
        <div className="text-sm dark:text-slate-300 font-semibold">{tr('arkan_team_right')}
          <div className="mt-1 flex gap-1">
            <input value={teamB} onChange={e => setTeamB(e.target.value.slice(0, 20))} aria-label={tr('arkan_team_right')} className="flex-1 min-w-0 px-3 py-2.5 min-h-[44px] rounded-xl border dark:bg-slate-700 dark:text-white font-bold" />
          </div>
          <div className="mt-1.5 flex gap-1" role="group" aria-label={tr('arkan_masc_right')}>
            {MASCOTS.map(m => (
              <button key={m} onClick={() => pickMasc('B', m)} aria-pressed={mascB === m}
                className={`flex-1 min-h-[38px] rounded-xl text-lg border ${mascB === m ? 'bg-rose-100 border-rose-500 dark:bg-rose-900/50' : 'bg-slate-50 dark:bg-slate-900 dark:border-slate-700'}`}>{m}</button>
            ))}
          </div>
        </div>
        <label className="text-sm dark:text-slate-300 font-semibold">{tr('arkan_sec_per_q')}
          <select value={qtime} onChange={e => setQtime(parseInt(e.target.value))} className="mt-1 w-full px-3 py-2.5 min-h-[44px] rounded-xl border dark:bg-slate-700 dark:text-white font-bold">
            <option value={10}>10 сек</option><option value={15}>15 сек</option><option value={20}>20 сек</option><option value={30}>30 сек</option>
          </select>
        </label>
      </div>

      {/* Вкладки выбора вопросов */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label={tr('arkan_src')}>
        {(
          (noMine
            ? [['topics', tr('arkan_tab_topics')], ['custom', '✨ Своя игра / ИИ'], ['public', tr('arkan_tab_public')]]
            : [['topics', tr('arkan_tab_topics')], ['custom', '✨ Своя игра / ИИ'], ['mine', tr('arkan_tab_mine')], ['public', tr('arkan_tab_public')]]
          ) as Array<['topics' | 'mine' | 'public' | 'custom', string]>
        ).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} role="tab" aria-selected={tab === k}
            className={`flex-1 min-w-[140px] px-4 py-3 min-h-[48px] rounded-xl font-bold text-sm ${tab === k ? 'bg-indigo-600 text-white shadow' : 'bg-white dark:bg-slate-800 dark:text-white border dark:border-slate-700'}`}>{l}</button>
        ))}
      </div>

      {tab === 'custom' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-indigo-400/50 p-4 sm:p-5 space-y-4">
          <div className="font-bold text-base dark:text-white flex items-center gap-2">
            <Sparkles size={18} className="text-amber-500" />
            Создать вопросы для Аркан Тартыш с помощью ИИ или списком
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={aiPrompt}
              onChange={e => onAiPromptChange(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && generateArkanAI()}
              placeholder="Напиши запрос, напр.: «сделай мне вопросы по пайтону 14 вопросов»"
              className="flex-1 min-w-[220px] px-3.5 py-2.5 rounded-xl border dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white text-sm"
            />
            <label className="text-xs font-bold dark:text-slate-300 flex items-center gap-1.5">
              Вопросов:
              <input
                type="number"
                min={1}
                max={40}
                value={aiCount}
                onChange={e => setAiCount(Math.max(1, Math.min(40, parseInt(e.target.value) || 10)))}
                className="w-16 px-2 py-2 rounded-xl border dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white text-center font-mono font-bold"
              />
            </label>
            <button
              type="button"
              onClick={generateArkanAI}
              disabled={aiBusy}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles size={16} /> {aiBusy ? 'Создаю…' : `Сгенерировать (${aiCount} вопр.)`}
            </button>
          </div>

          <div className="space-y-1.5 pt-2 border-t dark:border-slate-700">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Или вставь свои вопросы списком (<code className="font-mono">Вопрос? | Правильный ответ | Неверный 1 | Неверный 2</code>):
            </div>
            <textarea
              value={customBulk}
              onChange={e => setCustomBulk(e.target.value)}
              rows={3}
              placeholder={"Что выведет print(3 * 4)? | 12 | 7 | 34 | Ошибка\nСтолица Кыргызстана? | Бишкек | Ош | Нарын | Талас"}
              className="w-full p-2.5 rounded-xl border dark:border-slate-600 bg-slate-50 dark:bg-slate-900 dark:text-white text-xs font-mono"
            />
            <button type="button" onClick={parseBulkCustom} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center gap-1">
              <Plus size={14} /> Загрузить свои вопросы
            </button>
          </div>

          {customQs.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  ✓ Готово к бою: {customQs.length} вопросов ({customTitle})
                </span>
                <button type="button" onClick={() => { setCustomQs([]); setSel(null) }} className="text-xs text-rose-500 flex items-center gap-1">
                  <Trash2 size={13} /> Очистить
                </button>
              </div>
              <div className="max-h-44 overflow-auto space-y-1 pr-1">
                {customQs.map((q, i) => (
                  <div key={i} className="px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 text-xs dark:text-slate-200 flex items-center justify-between gap-2">
                    <span className="truncate"><b>#{i + 1}.</b> {q.text}</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold shrink-0">✓ {q.options.find(o => o.is_correct)?.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'topics' && (
        <div className="grid gap-2">
          {READY_TOPICS.map(topic => (
            <button key={topic.id} onClick={() => pickTopic(topic.id)} disabled={busy}
              className={`w-full text-left px-4 py-3 min-h-[64px] rounded-xl border dark:text-white ${sel?.id === `ready-${topic.id}` ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'bg-white dark:bg-slate-800 dark:border-slate-700'}`}>
              <div className="font-bold">{topic.icon} {topic.title} <span className="text-xs font-semibold text-amber-600">{tr('arkan_ready_badge')}</span></div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{topic.desc}</div>
            </button>
          ))}
        </div>
      )}

      {(tab === 'mine' || tab === 'public') && (
        <div className="space-y-2 max-h-[40vh] overflow-auto">
          {(tab === 'mine' ? mine : pub).length === 0 && <div className="text-slate-400 text-center py-4">{tr('arkan_empty_mine')}</div>}
          {(tab === 'mine' ? mine : pub).map(t => (
            <button key={t.id} onClick={() => pickTest(t)} disabled={busy}
              className={`w-full text-left px-4 py-3 min-h-[56px] rounded-xl border font-semibold dark:text-white ${sel?.id === t.id ? 'border-blue-500 bg-indigo-50 dark:bg-indigo-900/30' : 'bg-white dark:bg-slate-800 dark:border-slate-700'}`}>
              {t.title}
            </button>
          ))}
        </div>
      )}

      <button onClick={startBattle} disabled={busy || !sel}
        className="w-full px-6 py-4 min-h-[64px] rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-xl">
        <Play size={22} /> {`${tr('arkan_play')}${sel ? `: ${sel.title.slice(0, 45)}` : ''}`}
      </button>
    </div>
  )
}
