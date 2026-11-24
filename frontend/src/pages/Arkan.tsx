import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import client from '../api/client'
import { useAccessibility, toast } from '../context/UIContext'
import { playArkanSound } from '../utils/sound'
import { sfx, startBgMusic, stopBgMusic, isBgMusicPlaying } from '../utils/sfx'
import { READY_TOPICS } from '../data/readyTopics'
import { isStudent, isGuest } from '../utils/role'
import { Play, Volume2, Music, ArrowRight, RotateCcw, Sparkles, Plus, Trash2, Users, Bot, Zap } from 'lucide-react'
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

type ArenaTheme = 'day' | 'sunset' | 'night'

const ARENA_THEMES: Array<{ id: ArenaTheme; label: string; emoji: string }> = [
  { id: 'day', label: 'Джайлоо', emoji: '☀️' },
  { id: 'sunset', label: 'Иссык-Куль', emoji: '🌅' },
  { id: 'night', label: 'Ночной турнир', emoji: '🌙' },
]

// ── Полноценная анимированная 2D-сцена «Аркан Тартыш» (3 арены + живая физика и анимация) ──
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
  theme,
  onChangeTheme,
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
  theme: ArenaTheme
  onChangeTheme: (t: ArenaTheme) => void
}) {
  // Живой 30fps таймер для плавных 2D-анимаций (авто-пауза при скрытой вкладке — бережёт CPU на слабых ноутбуках)
  const [animT, setAnimT] = useState(0)
  useEffect(() => {
    let raf = 0
    let lastTs = 0
    const start = performance.now()
    const loop = (now: number) => {
      if (document.hidden) { raf = 0; return }
      if (now - lastTs >= 33) {
        lastTs = now
        setAnimT((now - start) / 1000)
      }
      raf = requestAnimationFrame(loop)
    }
    const onVis = () => {
      if (!document.hidden && !raf) raf = requestAnimationFrame(loop)
    }
    document.addEventListener('visibilitychange', onVis)
    raf = requestAnimationFrame(loop)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  // Центр поля в SVG: X = 450 (из 900). Смещение каната: до ±165px.
  const shiftPx = -(rope / 100) * 165
  const knotX = 450 + shiftPx
  const tension = Math.min(1, Math.abs(rope) / 75)
  const isPullA = pullAnim === 'A'
  const isPullB = pullAnim === 'B'
  const nearWinA = rope >= 65
  const nearWinB = rope <= -65

  // Динамическое колебание каната и ритм дыхания/тяги батыров
  const heaveA = Math.sin(animT * (isPullA ? 14 : 4.2)) * (isPullA ? 3.5 : 1.6)
  const heaveB = Math.sin(animT * (isPullB ? 14 : 4.2) + 1.2) * (isPullB ? 3.5 : 1.6)
  const leanA = (isPullA ? -26 : isPullB ? 15 : -11) + heaveA
  const leanB = (isPullB ? 26 : isPullA ? -15 : 11) + heaveB

  // Живая вибрация каната + провисание при низком напряжении
  const vibAmp = isPullA || isPullB ? 4.2 : 0.7 + tension * 2.2
  const ropeMidY = 230 + (1 - tension) * 5 + Math.sin(animT * 32) * vibAmp
  const ribbonSway = Math.sin(animT * 8) * (isPullA || isPullB ? 10 : 4)

  // Полёт золотого беркута и дрейф облаков
  const eagleX = ((animT * 38) % 1020) - 60
  const eagleY = 58 + Math.sin(animT * 2.1) * 11
  const wingFlap = Math.sin(animT * 8.5) * 7
  const cloudShift1 = ((animT * 9) % 1040) - 70
  const cloudShift2 = ((animT * 6 + 520) % 1040) - 70
  const flagWave = Math.sin(animT * 6.5) * 4
  const flameFlicker = Math.sin(animT * 18) * 2.4

  // Палитра 3 арен
  const pal =
    theme === 'night'
      ? {
          skyTop: '#020617',
          skyMid: '#1e1b4b',
          skyBot: '#312e81',
          mtBack: '#1e293b',
          mtFront: '#0f172a',
          snow: '#cbd5e1',
          hill: '#064e3b',
          grassTop: '#166534',
          grassMid: '#14532d',
          grassBot: '#052e16',
          track: '#78350f',
          yurtBody: '#e2e8f0',
        }
      : theme === 'sunset'
        ? {
            skyTop: '#3b0764',
            skyMid: '#ea580c',
            skyBot: '#fde047',
            mtBack: '#581c87',
            mtFront: '#3b0764',
            snow: '#fed7aa',
            hill: '#365314',
            grassTop: '#65a30d',
            grassMid: '#3f6212',
            grassBot: '#1a2e05',
            track: '#9a3412',
            yurtBody: '#ffedd5',
          }
        : {
            skyTop: '#1d4ed8',
            skyMid: '#38bdf8',
            skyBot: '#fef08a',
            mtBack: '#475569',
            mtFront: '#334155',
            snow: '#ffffff',
            hill: '#15803d',
            grassTop: '#4ade80',
            grassMid: '#16a34a',
            grassBot: '#14532d',
            track: '#b45309',
            yurtBody: '#f8fafc',
          }

  return (
    <div
      className={`relative w-full rounded-3xl overflow-hidden border-2 border-amber-500/60 shadow-2xl bg-slate-950 select-none ${
        isPullA || isPullB ? 'arkan-arena-shake' : ''
      }`}
      data-testid="arkan-2d-arena"
    >
      <style>{`
        @keyframes arkanShake {
          0%, 100% { transform: translate(0, 0); }
          20% { transform: translate(-3px, 1px); }
          40% { transform: translate(3px, -1px); }
          60% { transform: translate(-2px, 1px); }
          80% { transform: translate(2px, 0); }
        }
        .arkan-arena-shake { animation: arkanShake 0.32s ease-out; }
      `}</style>

      {/* Верхний HUD поверх 2D-сцены */}
      <div className="absolute top-2.5 inset-x-3 z-20 flex items-center justify-between gap-2 pointer-events-none">
        <div
          className={`px-3 sm:px-3.5 py-1.5 rounded-2xl backdrop-blur-md border-2 transition-all flex items-center gap-2 shadow-lg ${
            turn === 'A'
              ? 'bg-blue-600/90 border-amber-300 text-white scale-105 shadow-blue-500/40'
              : 'bg-slate-950/75 border-blue-400/40 text-blue-100'
          }`}
        >
          <span className="text-xl sm:text-2xl">{mascA}</span>
          <div>
            <div className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider opacity-90">{teamA}</div>
            <div className="text-base sm:text-lg font-black leading-none">{scoreA} очк.</div>
          </div>
        </div>

        {/* Индикатор перевеса каната + переключение 3 арен */}
        <div className="flex flex-col items-center gap-1">
          <div className="px-3.5 py-1 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-amber-400/50 text-center shadow-lg">
            <div className="text-[9px] uppercase tracking-widest text-amber-300 font-bold">
              {nearWinA ? `⚡ ${teamA} ПОЧТИ ПОБЕДИЛА!` : nearWinB ? `⚡ ${teamB} ПОЧТИ ПОБЕДИЛА!` : 'Перевес каната'}
            </div>
            <div className="font-mono font-black text-sm text-white flex items-center justify-center gap-2">
              <span className="text-blue-400">{Math.max(0, Math.round(rope))}%</span>
              <span className="text-amber-400">🪢</span>
              <span className="text-rose-400">{Math.max(0, Math.round(-rope))}%</span>
            </div>
          </div>
          <div className="pointer-events-auto flex items-center gap-1 bg-slate-950/75 backdrop-blur-md p-0.5 rounded-full border border-white/15">
            {ARENA_THEMES.map(th => (
              <button
                key={th.id}
                type="button"
                onClick={() => { onChangeTheme(th.id); sfx('ui.click') }}
                title={`Арена: ${th.label}`}
                data-testid={`arkan-theme-${th.id}`}
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold transition ${
                  theme === th.id ? 'bg-amber-400 text-slate-950 shadow' : 'text-white/75 hover:text-white'
                }`}
              >
                {th.emoji} <span className="hidden sm:inline">{th.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div
          className={`px-3 sm:px-3.5 py-1.5 rounded-2xl backdrop-blur-md border-2 transition-all flex items-center gap-2 shadow-lg ${
            turn === 'B'
              ? 'bg-rose-600/90 border-amber-300 text-white scale-105 shadow-rose-500/40'
              : 'bg-slate-950/75 border-rose-400/40 text-rose-100'
          }`}
        >
          <div className="text-right">
            <div className="text-[10px] sm:text-xs font-extrabold uppercase tracking-wider opacity-90">{teamB}</div>
            <div className="text-base sm:text-lg font-black leading-none">{scoreB} очк.</div>
          </div>
          <span className="text-xl sm:text-2xl">{mascB}</span>
        </div>
      </div>

      {/* Всплывающий бонус удара / рывка */}
      {lastGain && (
        <div
          className="absolute top-[74px] left-1/2 -translate-x-1/2 z-30 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-300 to-orange-400 text-slate-950 font-display font-black text-sm sm:text-lg shadow-2xl border-2 border-white animate-bounce"
          aria-live="polite"
        >
          💪 Рывок {lastGain}!
        </div>
      )}

      {/* 2D SVG-Арена Джайлоо / Иссык-Куль / Ночной Турнир */}
      <svg
        viewBox="0 0 900 325"
        className="w-full h-[245px] sm:h-[310px] block"
        role="img"
        aria-label="2D Арена Аркан Тартыш"
      >
        <defs>
          <linearGradient id="arkanSkyGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={pal.skyTop} />
            <stop offset="52%" stopColor={pal.skyMid} />
            <stop offset="100%" stopColor={pal.skyBot} />
          </linearGradient>
          <linearGradient id="arkanGrassGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={pal.grassTop} />
            <stop offset="40%" stopColor={pal.grassMid} />
            <stop offset="100%" stopColor={pal.grassBot} />
          </linearGradient>
          <linearGradient id="issykLake" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </linearGradient>
          <linearGradient id="mudPitGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#451a03" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>
          <radialGradient id="spotGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fef08a" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#fef08a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* 1. НЕБО */}
        <rect x="0" y="0" width="900" height="196" fill="url(#arkanSkyGrad)" />

        {/* Ночные звёзды и полумесяц */}
        {theme === 'night' && (
          <g>
            {[
              [70, 32], [140, 58], [210, 26], [300, 46], [380, 22], [530, 34],
              [620, 50], [700, 24], [785, 44], [855, 28], [260, 74], [660, 76],
            ].map(([sx, sy], i) => (
              <circle
                key={i}
                cx={sx}
                cy={sy}
                r={i % 3 === 0 ? 2.1 : 1.3}
                fill="#fef9c3"
                opacity={0.45 + 0.5 * Math.abs(Math.sin(animT * 2.2 + i))}
              />
            ))}
            <g transform="translate(450, 58)">
              <circle r="28" fill="#fef08a" opacity="0.16" />
              <path d="M-4,-20 A20,20 0 1,0 18,12 A15,15 0 1,1 -4,-20 Z" fill="#fef08a" />
            </g>
          </g>
        )}

        {/* Золотое солнце Түндүк (День / Закат) */}
        {theme !== 'night' && (
          <g transform={`translate(450, ${theme === 'sunset' ? 112 : 60})`}>
            <circle r="48" fill="#fef08a" opacity="0.22" />
            <g transform={`rotate(${animT * 12})`} opacity="0.45">
              {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(ang => (
                <line key={ang} x1="0" y1="-30" x2="0" y2="-44" stroke="#fef08a" strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${ang})`} />
              ))}
            </g>
            <circle r="26" fill={theme === 'sunset' ? '#fb923c' : '#facc15'} />
            <circle r="20" fill="none" stroke="#dc2626" strokeWidth="2" opacity="0.6" />
            <path d="M-12 -5 L12 5 M-12 5 L12 -5 M-5 -12 L5 12 M-5 12 L5 -12" stroke="#dc2626" strokeWidth="1.6" opacity="0.6" />
          </g>
        )}

        {/* Плывущие облака */}
        <g fill={theme === 'night' ? '#334155' : theme === 'sunset' ? '#fed7aa' : '#ffffff'} opacity={theme === 'night' ? 0.35 : 0.72}>
          <g transform={`translate(${cloudShift1}, 46)`}>
            <ellipse cx="0" cy="0" rx="40" ry="12" />
            <ellipse cx="22" cy="-7" rx="25" ry="11" />
            <ellipse cx="-22" cy="-4" rx="20" ry="9" />
          </g>
          <g transform={`translate(${cloudShift2}, 62)`}>
            <ellipse cx="0" cy="0" rx="46" ry="12" />
            <ellipse cx="-20" cy="-7" rx="26" ry="10" />
          </g>
        </g>

        {/* Парящий Золотой Беркут */}
        <g transform={`translate(${eagleX}, ${eagleY})`} opacity={theme === 'night' ? 0.55 : 0.9}>
          <path
            d={`M-16,${-wingFlap} Q-7,-8 0,-1 Q7,-8 16,${-wingFlap} Q8,1 0,3 Q-8,1 -16,${-wingFlap}`}
            fill={theme === 'night' ? '#94a3b8' : '#451a03'}
          />
          <circle cx="2" cy="-1" r="2.2" fill="#facc15" />
        </g>

        {/* 2. СНЕЖНЫЕ ХРЕБТЫ АЛА-ТОО */}
        <polygon points="0,192 95,84 195,192" fill={pal.mtBack} />
        <polygon points="95,84 67,114 95,107 123,115" fill={pal.snow} opacity="0.92" />

        <polygon points="125,192 265,62 405,192" fill={pal.mtFront} />
        <polygon points="265,62 228,104 252,95 265,108 282,94 303,104" fill={pal.snow} />

        <polygon points="335,192 450,80 565,192" fill={pal.mtBack} />
        <polygon points="450,80 420,113 450,104 480,113" fill={pal.snow} opacity="0.92" />

        <polygon points="495,192 645,58 790,192" fill={pal.mtFront} />
        <polygon points="645,58 606,102 632,92 645,106 664,93 685,102" fill={pal.snow} />

        <polygon points="710,192 820,88 900,192" fill={pal.mtBack} />
        <polygon points="820,88 794,116 820,108 846,116" fill={pal.snow} opacity="0.92" />

        {/* Блестящая полоса озера Иссык-Куль в теме Закат */}
        {theme === 'sunset' && (
          <g>
            <rect x="0" y="172" width="900" height="18" fill="url(#issykLake)" opacity="0.85" />
            <ellipse cx="450" cy="181" rx={75 + Math.sin(animT * 3) * 8} ry="3.5" fill="#fde047" opacity="0.65" />
          </g>
        )}

        {/* Предгорья и две кыргызские юрты (Боз үй) с поднимающимся дымком */}
        <path d="M0 192 Q220 156 450 184 Q680 156 900 192 Z" fill={pal.hill} opacity="0.88" />
        {[102, 748].map((yx, yi) => (
          <g key={yi} transform={`translate(${yx}, 152)`}>
            {/* Поднимающийся дымок из түндүка */}
            {[0, 1, 2].map(si => {
              const p = (animT * 0.55 + si * 0.33 + yi * 0.5) % 1
              return (
                <circle
                  key={si}
                  cx={24 + Math.sin(p * 6 + yi) * 5}
                  cy={-2 - p * 26}
                  r={3 + p * 5}
                  fill="#f8fafc"
                  opacity={(1 - p) * 0.45}
                />
              )
            })}
            <path d="M0 34 L0 16 Q24 -6 48 16 L48 34 Z" fill={pal.yurtBody} stroke="#94a3b8" strokeWidth="1.5" />
            <path d="M0 24 Q24 20 48 24" fill="none" stroke="#dc2626" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
            <path d="M16 5 Q24 0 32 5" fill="none" stroke="#dc2626" strokeWidth="2.6" />
            <rect x="20" y="18" width="8" height="16" rx="2" fill={theme === 'night' ? '#fbbf24' : '#92400e'} />
          </g>
        ))}

        {/* 3. ПОЛЕ БОЯ + КОЛЫШУЩАЯСЯ ТРАВА */}
        <rect x="0" y="186" width="900" height="139" fill="url(#arkanGrassGrad)" />
        {/* Боевая грунтовая дорожка */}
        <rect x="22" y="232" width="856" height="58" rx="29" fill={pal.track} opacity="0.45" />
        <rect x="34" y="240" width="832" height="42" rx="21" fill="#fef3c7" opacity={theme === 'night' ? 0.1 : 0.22} />

        {/* Прожекторный свет в центре ночью */}
        {theme === 'night' && <ellipse cx={knotX} cy="245" rx="150" ry="62" fill="url(#spotGlow)" />}

        {/* Декоративные пучки травы */}
        {[60, 175, 340, 560, 725, 845].map((gx, gi) => {
          const sway = Math.sin(animT * 3 + gi) * 3
          return (
            <path
              key={gi}
              d={`M${gx},216 Q${gx - 4 + sway},206 ${gx - 7 + sway},203 M${gx},216 Q${gx + 4 + sway},205 ${gx + 7 + sway},202`}
              stroke={theme === 'night' ? '#22c55e' : '#86efac'}
              strokeWidth="2"
              fill="none"
              opacity="0.55"
            />
          )
        })}

        {/* 4. ПОБЕДНЫЕ РУБЕЖИ, РАЗВЕВАЮЩИЕСЯ ФЛАГИ И ФАКЕЛЫ */}
        {/* Левый рубеж победы (Команда А) */}
        <g transform="translate(285, 176)">
          {nearWinA && <rect x="-12" y="0" width="24" height="118" rx="8" fill="#3b82f6" opacity={0.2 + 0.15 * Math.sin(animT * 10)} />}
          <line x1="0" y1="0" x2="0" y2="116" stroke="#60a5fa" strokeWidth="3.5" strokeDasharray="6 4" />
          <path d={`M0,0 Q-14,${4 + flagWave * 0.5} -30,${9 + flagWave} Q-14,${14 + flagWave * 0.5} 0,20 Z`} fill="#2563eb" stroke="#93c5fd" strokeWidth="1" />
          <text x="-6" y="110" fill="#bfdbfe" fontSize="10" fontWeight="bold" textAnchor="end">РУБЕЖ {teamA.toUpperCase()}</text>
          {theme === 'night' && (
            <g transform="translate(-8, 12)">
              <rect x="-2" y="8" width="4" height="16" fill="#78350f" />
              <ellipse cx="0" cy="4" rx="5" ry={7 + flameFlicker * 0.4} fill="#f97316" />
              <ellipse cx="0" cy="5" rx="2.5" ry={4 + flameFlicker * 0.3} fill="#fef08a" />
            </g>
          )}
        </g>

        {/* Правый рубеж победы (Команда Б) */}
        <g transform="translate(615, 176)">
          {nearWinB && <rect x="-12" y="0" width="24" height="118" rx="8" fill="#ef4444" opacity={0.2 + 0.15 * Math.sin(animT * 10)} />}
          <line x1="0" y1="0" x2="0" y2="116" stroke="#f87171" strokeWidth="3.5" strokeDasharray="6 4" />
          <path d={`M0,0 Q14,${4 - flagWave * 0.5} 30,${9 - flagWave} Q14,${14 - flagWave * 0.5} 0,20 Z`} fill="#dc2626" stroke="#fca5a5" strokeWidth="1" />
          <text x="6" y="110" fill="#fecaca" fontSize="10" fontWeight="bold" textAnchor="start">РУБЕЖ {teamB.toUpperCase()}</text>
          {theme === 'night' && (
            <g transform="translate(8, 12)">
              <rect x="-2" y="8" width="4" height="16" fill="#78350f" />
              <ellipse cx="0" cy="4" rx="5" ry={7 - flameFlicker * 0.4} fill="#f97316" />
              <ellipse cx="0" cy="5" rx="2.5" ry={4 - flameFlicker * 0.3} fill="#fef08a" />
            </g>
          )}
        </g>

        {/* Центральный ров с брызгами грязи при опасном перевесе */}
        <ellipse cx="450" cy="270" rx="50" ry="15" fill="url(#mudPitGrad)" stroke="#fde68a" strokeWidth="2" opacity="0.88" />
        <ellipse cx="450" cy="270" rx="34" ry="7" fill="#92400e" opacity="0.55" />
        {(Math.abs(rope) >= 50 || isPullA || isPullB) && (
          <g fill="#78350f" opacity="0.85">
            <circle cx={435 + Math.sin(animT * 12) * 8} cy={258 - Math.abs(Math.sin(animT * 10)) * 14} r="3.5" />
            <circle cx={464 + Math.cos(animT * 11) * 8} cy={256 - Math.abs(Math.cos(animT * 9)) * 16} r="3" />
            <circle cx={450 + Math.sin(animT * 15) * 6} cy={254 - Math.abs(Math.sin(animT * 13)) * 18} r="2.8" />
          </g>
        )}
        <line x1="450" y1="186" x2="450" y2="300" stroke="#ffffff" strokeWidth="2.2" strokeDasharray="5 5" opacity="0.65" />

        {/* 5. БАТЫРЫ КОМАНДЫ А (СЛЕВА — Синие) */}
        {[0, 1, 2].map((idx) => {
          const baseX = knotX - 88 - idx * 65
          const baseY = 252
          const scale = idx === 0 ? 1.08 : idx === 2 ? 1.04 : 0.98
          const dragged = isPullB || rope < -35
          return (
            <g
              key={`teamA-${idx}`}
              transform={`translate(${baseX}, ${baseY}) scale(${scale})`}
              style={{ transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            >
              {/* Силовая аура при серии комбо */}
              {combo >= 2 && turn === 'A' && (
                <ellipse cx="0" cy="-22" rx="24" ry="38" fill="#60a5fa" opacity={0.18 + 0.1 * Math.sin(animT * 10)} />
              )}
              <ellipse cx="0" cy="20" rx="20" ry="5.5" fill="rgba(0,0,0,0.34)" />

              {/* Клубы пыли из-под сапог при рывке */}
              {isPullA && (
                <g fill="#fef3c7" opacity="0.85">
                  <circle cx={19 + Math.sin(animT * 16) * 4} cy="15" r="6" />
                  <circle cx={29 + Math.cos(animT * 14) * 3} cy="9" r="4.2" />
                  <circle cx={15} cy="6" r="3.4" />
                </g>
              )}

              <g transform={`rotate(${leanA + idx * 1.4})`}>
                {/* Ноги в сапогах (өтук) */}
                <line x1="-4" y1="-2" x2="-16" y2="17" stroke="#1e293b" strokeWidth="6.5" strokeLinecap="round" />
                <line x1="4" y1="-2" x2="19" y2="17" stroke="#0f172a" strokeWidth="6.5" strokeLinecap="round" />
                <ellipse cx="-17" cy="18" rx="5.5" ry="3" fill="#0f172a" />
                <ellipse cx="20" cy="18" rx="5.5" ry="3" fill="#0f172a" />

                {/* Традиционный чапан / камзол с золотым поясом кемер */}
                <rect x="-12" y="-36" width="24" height="35" rx="9" fill="#2563eb" stroke="#1e3a8a" strokeWidth="2" />
                <path d="M-12,-30 L12,-30" stroke="#93c5fd" strokeWidth="2" opacity="0.7" />
                <rect x="-12" y="-12" width="24" height="6.5" fill="#f59e0b" />
                <rect x="-3" y="-12.5" width="6" height="7.5" rx="1.5" fill="#fef08a" stroke="#92400e" strokeWidth="1" />
                <text x="0" y="-17" fontSize="11.5" textAnchor="middle">{idx === 0 ? mascA : idx === 2 ? '🛡️' : '★'}</text>

                {/* Голова и мимика */}
                <circle cx="0" cy="-48" r="11" fill="#fed7aa" stroke="#d97706" strokeWidth="1.5" />
                {/* Глаз + бровь */}
                <circle cx="4.5" cy="-49" r="1.7" fill="#0f172a" />
                <line x1="1.5" y1={isPullA ? '-53.5' : '-52.5'} x2="7.5" y2={isPullA ? '-51.5' : '-52.5'} stroke="#0f172a" strokeWidth="1.6" strokeLinecap="round" />
                {/* Рот: боевой клич при рывке / напряжение */}
                {isPullA ? (
                  <ellipse cx="5" cy="-42.5" rx="3.5" ry="2.6" fill="#991b1b" />
                ) : dragged ? (
                  <path d="M1.5 -41 Q4.5 -44 7.5 -41" stroke="#0f172a" strokeWidth="1.5" fill="none" />
                ) : (
                  <path d="M2 -43 L7.5 -43" stroke="#0f172a" strokeWidth="1.5" fill="none" />
                )}
                {/* Капли пота, если команду перетягивают */}
                {dragged && (
                  <path
                    d={`M-9,${-54 + (animT * 24) % 10} Q-12,${-49 + (animT * 24) % 10} -9,${-47 + (animT * 24) % 10} Q-6,${-49 + (animT * 24) % 10} -9,${-54 + (animT * 24) % 10}`}
                    fill="#38bdf8"
                  />
                )}

                {/* Белый кыргызский Ак-Калпак */}
                <polygon points="-13,-54 13,-54 7.5,-74 -7.5,-74" fill="#ffffff" stroke="#334155" strokeWidth="1.6" />
                <path d="M-14,-54 Q0,-50.5 14,-54" stroke="#1e293b" strokeWidth="3.2" fill="none" />
                <line x1="0" y1="-72" x2="0" y2="-56" stroke="#1e293b" strokeWidth="1.4" />
                <circle cx="0" cy="-75" r="2.2" fill="#1e293b" />

                {/* Обе руки крепко держат канат */}
                <line x1="-4" y1="-26" x2="16" y2="-17" stroke="#fed7aa" strokeWidth="5.8" strokeLinecap="round" />
                <circle cx="16" cy="-17" r="3.4" fill="#fdba74" stroke="#92400e" strokeWidth="1" />
              </g>
            </g>
          )
        })}

        {/* 6. БАТЫРЫ КОМАНДЫ Б (СПРАВА — Красные) */}
        {[0, 1, 2].map((idx) => {
          const baseX = knotX + 88 + idx * 65
          const baseY = 252
          const scale = idx === 0 ? 1.08 : idx === 2 ? 1.04 : 0.98
          const dragged = isPullA || rope > 35
          return (
            <g
              key={`teamB-${idx}`}
              transform={`translate(${baseX}, ${baseY}) scale(${scale})`}
              style={{ transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            >
              {combo >= 2 && turn === 'B' && (
                <ellipse cx="0" cy="-22" rx="24" ry="38" fill="#fb7185" opacity={0.18 + 0.1 * Math.sin(animT * 10)} />
              )}
              <ellipse cx="0" cy="20" rx="20" ry="5.5" fill="rgba(0,0,0,0.34)" />

              {isPullB && (
                <g fill="#fef3c7" opacity="0.85">
                  <circle cx={-19 - Math.sin(animT * 16) * 4} cy="15" r="6" />
                  <circle cx={-29 - Math.cos(animT * 14) * 3} cy="9" r="4.2" />
                  <circle cx={-15} cy="6" r="3.4" />
                </g>
              )}

              <g transform={`rotate(${leanB - idx * 1.4})`}>
                <line x1="4" y1="-2" x2="16" y2="17" stroke="#1e293b" strokeWidth="6.5" strokeLinecap="round" />
                <line x1="-4" y1="-2" x2="-19" y2="17" stroke="#0f172a" strokeWidth="6.5" strokeLinecap="round" />
                <ellipse cx="17" cy="18" rx="5.5" ry="3" fill="#0f172a" />
                <ellipse cx="-20" cy="18" rx="5.5" ry="3" fill="#0f172a" />

                <rect x="-12" y="-36" width="24" height="35" rx="9" fill="#dc2626" stroke="#7f1d1d" strokeWidth="2" />
                <path d="M-12,-30 L12,-30" stroke="#fca5a5" strokeWidth="2" opacity="0.7" />
                <rect x="-12" y="-12" width="24" height="6.5" fill="#f59e0b" />
                <rect x="-3" y="-12.5" width="6" height="7.5" rx="1.5" fill="#fef08a" stroke="#92400e" strokeWidth="1" />
                <text x="0" y="-17" fontSize="11.5" textAnchor="middle">{idx === 0 ? mascB : idx === 2 ? '🛡️' : '★'}</text>

                <circle cx="0" cy="-48" r="11" fill="#fed7aa" stroke="#d97706" strokeWidth="1.5" />
                <circle cx="-4.5" cy="-49" r="1.7" fill="#0f172a" />
                <line x1="-1.5" y1={isPullB ? '-53.5' : '-52.5'} x2="-7.5" y2={isPullB ? '-51.5' : '-52.5'} stroke="#0f172a" strokeWidth="1.6" strokeLinecap="round" />
                {isPullB ? (
                  <ellipse cx="-5" cy="-42.5" rx="3.5" ry="2.6" fill="#991b1b" />
                ) : dragged ? (
                  <path d="M-7.5 -41 Q-4.5 -44 -1.5 -41" stroke="#0f172a" strokeWidth="1.5" fill="none" />
                ) : (
                  <path d="M-7.5 -43 L-2 -43" stroke="#0f172a" strokeWidth="1.5" fill="none" />
                )}
                {dragged && (
                  <path
                    d={`M9,${-54 + (animT * 24) % 10} Q12,${-49 + (animT * 24) % 10} 9,${-47 + (animT * 24) % 10} Q6,${-49 + (animT * 24) % 10} 9,${-54 + (animT * 24) % 10}`}
                    fill="#38bdf8"
                  />
                )}

                <polygon points="-13,-54 13,-54 7.5,-74 -7.5,-74" fill="#ffffff" stroke="#334155" strokeWidth="1.6" />
                <path d="M-14,-54 Q0,-50.5 14,-54" stroke="#991b1b" strokeWidth="3.2" fill="none" />
                <line x1="0" y1="-72" x2="0" y2="-56" stroke="#991b1b" strokeWidth="1.4" />
                <circle cx="0" cy="-75" r="2.2" fill="#991b1b" />

                <line x1="4" y1="-26" x2="-16" y2="-17" stroke="#fed7aa" strokeWidth="5.8" strokeLinecap="round" />
                <circle cx="-16" cy="-17" r="3.4" fill="#fdba74" stroke="#92400e" strokeWidth="1" />
              </g>
            </g>
          )
        })}

        {/* 7. ВИБРИРУЮЩИЙ ВИТОЙ КАНАТ (АРКАН), КРАСНАЯ ЛЕНТА И ИСКРЫ НАПРЯЖЕНИЯ */}
        <g>
          {/* Тень каната */}
          <line x1={knotX - 285} y1="264" x2={knotX + 285} y2="264" stroke="rgba(0,0,0,0.24)" strokeWidth="6" strokeLinecap="round" />
          {/* Основа витого каната (с живым прогибом/вибрацией) */}
          <path
            d={`M ${knotX - 290},233 Q ${knotX},${ropeMidY} ${knotX + 290},233`}
            fill="none"
            stroke="#78350f"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d={`M ${knotX - 290},233 Q ${knotX},${ropeMidY} ${knotX + 290},233`}
            fill="none"
            stroke="#d97706"
            strokeWidth="8.5"
            strokeLinecap="round"
          />
          <path
            d={`M ${knotX - 290},233 Q ${knotX},${ropeMidY} ${knotX + 290},233`}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="5"
            strokeDasharray="8 8"
            strokeLinecap="round"
          />

          {/* Энергетические искры при рывке или высоком комбо */}
          {(combo >= 2 || tension > 0.45 || isPullA || isPullB) && (
            <g transform={`translate(${knotX}, ${ropeMidY})`}>
              <circle r={18 + Math.sin(animT * 18) * 4} fill="#facc15" opacity="0.28" />
              <circle r="10" fill="#fde047" opacity="0.55" />
              {[0, 60, 120, 180, 240, 300].map(ang => (
                <line
                  key={ang}
                  x1="0"
                  y1="-12"
                  x2="0"
                  y2={-22 - (isPullA || isPullB ? 7 : 0)}
                  stroke="#fef08a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  transform={`rotate(${ang + animT * 90})`}
                />
              ))}
            </g>
          )}

          {/* Центральный золотой узел и развевающаяся красная лента Кызыл тасма */}
          <g transform={`translate(${knotX}, ${ropeMidY})`}>
            <rect x="-7" y="-9" width="14" height="18" rx="4" fill="#fbbf24" stroke="#78350f" strokeWidth="1.6" />
            <path
              d={`M0,7 Q${-5 + ribbonSway * 0.4},20 ${-9 + ribbonSway},32 L${ribbonSway * 0.6},26 L${9 + ribbonSway},32 Q${5 + ribbonSway * 0.4},20 0,7 Z`}
              fill="#ef4444"
              stroke="#991b1b"
              strokeWidth="1.2"
            />
          </g>
        </g>

        {/* Нижняя шкала прогресса от -100 до +100 прямо на арене */}
        <g transform="translate(285, 306)">
          <rect x="0" y="0" width="330" height="9" rx="4.5" fill="rgba(15,23,42,0.75)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
          <rect
            x="0"
            y="0"
            width={Math.max(8, Math.min(330, 165 - (rope / 100) * 165))}
            height="9"
            rx="4.5"
            fill="#3b82f6"
          />
          <rect
            x={Math.max(8, Math.min(330, 165 - (rope / 100) * 165))}
            y="0"
            width={Math.max(0, 330 - Math.max(8, Math.min(330, 165 - (rope / 100) * 165)))}
            height="9"
            rx="4.5"
            fill="#ef4444"
          />
          <circle
            cx={Math.max(7, Math.min(323, 165 - (rope / 100) * 165))}
            cy="4.5"
            r="6.5"
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
  const [arenaTheme, setArenaTheme] = useState<ArenaTheme>(() => {
    try {
      const saved = localStorage.getItem('edu-arkan-theme')
      return saved === 'sunset' || saved === 'night' ? saved : 'day'
    } catch { return 'day' }
  })
  const changeTheme = (t: ArenaTheme) => {
    setArenaTheme(t)
    try { localStorage.setItem('edu-arkan-theme', t) } catch {}
  }

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
  const [musicOn, setMusicOn] = useState(false)
  const qStartRef = useRef(0)
  const tickRef = useRef(0)

  useEffect(() => {
    const sync = () => setMusicOn(isBgMusicPlaying())
    window.addEventListener('audio-state-change', sync)
    return () => {
      window.removeEventListener('audio-state-change', sync)
      stopBgMusic()
    }
  }, [])

  const toggleBattleMusic = () => {
    if (musicOn) {
      stopBgMusic()
      setMusicOn(false)
    } else {
      startBgMusic('arkan')
      setMusicOn(true)
    }
  }

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
    const winSide: 'A' | 'B' | 'draw' = isDraw ? 'draw' : winner === teamA ? 'A' : 'B'
    const ropePctA = Math.round(Math.max(5, Math.min(95, 50 + rope / 2)))
    return (
      <div className="max-w-3xl mx-auto text-center space-y-6 py-4 sm:py-8 px-2 relative">
        {!isDraw && (
          <div className="pointer-events-none fixed inset-0 overflow-hidden z-10" aria-hidden="true">
            {confetti.map((c, i) => (
              <span
                key={i}
                className="confetti-piece opacity-85"
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

        <div className="relative z-20 flex items-center justify-between">
          <Link to="/games" className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
            {tr('arkan_to_games')}
          </Link>
          <span className="text-xs font-extrabold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-400/30">
            🪢 Аркан Тартыш • Итоги
          </span>
        </div>

        {/* Чемпионская карточка победы */}
        <div className="relative z-20 rounded-3xl overflow-hidden bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-950 border-2 border-amber-400/50 shadow-[0_24px_80px_rgba(15,23,42,0.55)] text-white p-6 sm:p-10 space-y-6">
          {/* Мягкое золотое свечение за кубком */}
          <div
            className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-[380px] h-[240px] rounded-full blur-3xl opacity-35"
            style={{ background: winSide === 'A' ? 'radial-gradient(circle,#38bdf8,#facc15)' : winSide === 'B' ? 'radial-gradient(circle,#fb7185,#facc15)' : 'radial-gradient(circle,#818cf8,#facc15)' }}
          />
          {/* Деликатная золотая орнаментальная полоса сверху */}
          <div className="h-1.5 w-full rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-rose-500 opacity-90" />

          {/* Значок чемпиона */}
          <div className="relative flex flex-col items-center gap-3 pt-1">
            {!isDraw && (
              <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-amber-400/20 border border-amber-300/40 text-amber-300 text-xs sm:text-sm font-black tracking-wide uppercase">
                🏆 {tr('arkan_congrats')}
              </div>
            )}
            <div className="relative">
              {!isDraw && (
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-4xl drop-shadow-lg animate-bounce">👑</span>
              )}
              <div className={`w-28 h-28 sm:w-32 sm:h-32 rounded-3xl flex items-center justify-center text-6xl sm:text-7xl shadow-2xl border-2 ${
                winSide === 'A'
                  ? 'bg-gradient-to-br from-blue-500/40 to-indigo-700/60 border-amber-300 shadow-blue-500/30'
                  : winSide === 'B'
                    ? 'bg-gradient-to-br from-rose-500/40 to-orange-700/60 border-amber-300 shadow-rose-500/30'
                    : 'bg-gradient-to-br from-indigo-500/30 to-slate-700/60 border-indigo-300'
              }`}>
                {wMasc}
              </div>
            </div>

            <div className="space-y-1">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-indigo-300">
                {isDraw ? 'Равная схватка!' : 'Победитель турнира'}
              </div>
              <h1 className="font-display font-black text-3xl sm:text-5xl bg-gradient-to-r from-white via-amber-100 to-amber-300 bg-clip-text text-transparent leading-tight">
                {isDraw ? tr('arkan_draw') : `${tr('arkan_winner_a')}${winner}!`}
              </h1>
            </div>
          </div>

          {/* Табло счёта двух команд */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 max-w-xl mx-auto">
            <div className={`rounded-2xl p-3.5 sm:p-4 border transition ${
              winSide === 'A'
                ? 'bg-blue-500/20 border-amber-400/70 ring-2 ring-amber-400/25 shadow-lg'
                : 'bg-white/5 border-white/10 opacity-80'
            }`}>
              <div className="text-3xl mb-1">{mascA}</div>
              <div className="font-extrabold text-sm sm:text-base truncate">{teamA}</div>
              <div className="text-3xl sm:text-4xl font-mono font-black text-blue-300 mt-1">{scoreA}</div>
              {winSide === 'A' && <div className="text-[11px] font-bold text-amber-300 mt-1">🥇 Чемпион</div>}
            </div>

            <div className="flex flex-col items-center gap-1 px-1">
              <span className="text-xs font-black text-slate-400 uppercase">Счёт</span>
              <span className="text-2xl sm:text-3xl font-black text-amber-400">:</span>
            </div>

            <div className={`rounded-2xl p-3.5 sm:p-4 border transition ${
              winSide === 'B'
                ? 'bg-rose-500/20 border-amber-400/70 ring-2 ring-amber-400/25 shadow-lg'
                : 'bg-white/5 border-white/10 opacity-80'
            }`}>
              <div className="text-3xl mb-1">{mascB}</div>
              <div className="font-extrabold text-sm sm:text-base truncate">{teamB}</div>
              <div className="text-3xl sm:text-4xl font-mono font-black text-rose-300 mt-1">{scoreB}</div>
              {winSide === 'B' && <div className="text-[11px] font-bold text-amber-300 mt-1">🥇 Чемпион</div>}
            </div>
          </div>

          {/* Итоговый перевес каната */}
          <div className="max-w-lg mx-auto space-y-1.5">
            <div className="flex justify-between text-[11px] font-bold text-slate-300">
              <span className="text-blue-300">{teamA}</span>
              <span className="text-amber-300">Итог каната: {Math.abs(Math.round(rope))}%</span>
              <span className="text-rose-300">{teamB}</span>
            </div>
            <div className="h-3 rounded-full bg-slate-800 overflow-hidden border border-white/10 flex">
              <div className="h-full bg-gradient-to-r from-blue-600 to-sky-400 transition-all" style={{ width: `${ropePctA}%` }} />
              <div className="h-full bg-gradient-to-r from-rose-400 to-rose-600 flex-1" />
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="flex flex-wrap gap-3 justify-center pt-2">
            <button
              onClick={rematch}
              className="px-7 py-3.5 min-h-[54px] rounded-2xl bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 hover:brightness-110 text-slate-950 font-black text-base flex items-center gap-2 shadow-xl shadow-amber-500/20 transition"
            >
              <RotateCcw size={18} /> {tr('arkan_rematch')}
            </button>
            <button
              onClick={() => setPhase('lobby')}
              className="px-6 py-3.5 min-h-[54px] rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 text-white font-bold text-base transition"
            >
              {tr('arkan_to_topics')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'battle') {
    const q = qs[qi]
    const ci = correctIdx(q)
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button onClick={() => { stopBgMusic(); setMusicOn(false); setPhase('lobby') }}
            className="inline-flex items-center gap-1 text-sm font-bold text-indigo-600 dark:text-indigo-400">
            {tr('arkan_exit_battle')}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleBattleMusic}
              className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border transition ${
                musicOn
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Music size={13} /> {musicOn ? 'Музыка: Вкл' : 'Музыка'}
            </button>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300">
              {battleMode === 'duel' ? '⚡ Одновременная дуэль 2 команд' : battleMode === 'ai' ? '🤖 Против ИИ-батыров' : '🔄 По очереди'}
            </span>
          </div>
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
          theme={arenaTheme}
          onChangeTheme={changeTheme}
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
        theme={arenaTheme}
        onChangeTheme={changeTheme}
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
                type="text"
                inputMode="numeric"
                value={aiCount || ''}
                onChange={e => {
                  const raw = e.target.value.replace(/[^\d]/g, '')
                  setAiCount(raw === '' ? 0 : Math.min(40, parseInt(raw, 10) || 1))
                }}
                onBlur={() => {
                  if (!aiCount || aiCount < 1) setAiCount(10)
                }}
                placeholder="10"
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
