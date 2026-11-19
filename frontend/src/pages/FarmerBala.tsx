import { useRef, useState, lazy, Suspense } from 'react'
import { useLang } from '../context/LangContext'
import { sfx } from '../utils/sfx'
import type { CropKind, CellKind, SoilKind, FarmerHat, F3DWeather } from './FarmerField3D'

const FarmerField3D = lazy(() => import('./FarmerField3D'))

const W = 6, H = 5

const CROP_META: Record<CropKind, { icon: string; pts: number; coins: number; name: Record<string, string> }> = {
  carrot: { icon: '🥕', pts: 10, coins: 3, name: { ru: 'Морковь', en: 'Carrot', kg: 'Сабиз' } },
  strawberry: { icon: '🍓', pts: 20, coins: 5, name: { ru: 'Клубника', en: 'Strawberry', kg: 'Кулпунай' } },
  pumpkin: { icon: '🎃', pts: 25, coins: 7, name: { ru: 'Тыква', en: 'Pumpkin', kg: 'Кабак' } },
  sunflower: { icon: '🌻', pts: 30, coins: 8, name: { ru: 'Подсолнух', en: 'Sunflower', kg: 'Күн карама' } },
  watermelon: { icon: '🍉', pts: 40, coins: 12, name: { ru: 'Арбуз', en: 'Watermelon', kg: 'Дарбыз' } },
}

const HATS: { id: FarmerHat; icon: string; price: number; name: Record<string, string> }[] = [
  { id: 'straw', icon: '👒', price: 0, name: { ru: 'Соломенная', en: 'Straw Hat', kg: 'Саман шляпа' } },
  { id: 'cowboy', icon: '🤠', price: 25, name: { ru: 'Ковбой', en: 'Cowboy', kg: 'Ковбой' } },
  { id: 'wizard', icon: '🧙', price: 60, name: { ru: 'Маг кода', en: 'Code Wizard', kg: 'Код сыйкырчысы' } },
  { id: 'crown', icon: '👑', price: 110, name: { ru: 'Король фермы', en: 'Farm King', kg: 'Ферма падышасы' } },
]

type Goal = {
  carrots?: number
  pumpkins?: number
  sunflowers?: number
  strawberries?: number
  watermelons?: number
  watered?: number
  cleared?: number
  printed?: string
}

type CH = {
  icon: string
  parLines: number
  name: Record<string, string>
  concept: Record<string, string>
  task: Record<string, string>
  hint: Record<string, string>
  code: string
  goal: Goal
  seed: [number, number, Exclude<CellKind, null>][]
  dryCells?: [number, number][]
}

const ROW = (crop: CropKind = 'carrot', y = 0): [number, number, CropKind][] =>
  Array.from({ length: W }, (_, x) => [x, y, crop])

const CHAPTERS: CH[] = [
  {
    icon: '🌱',
    parLines: 3,
    name: { ru: 'Первые шаги', en: 'First Steps', kg: 'Биринчи кадамдар' },
    concept: {
      ru: 'Код выполняется строка за строкой: move() — шаг вправо, harvest() — собрать урожай.',
      en: 'Code runs line by line: move() steps right, harvest() collects the crop.',
      kg: 'Код сап сап менен аткарылат: move() — оңго кадам, harvest() — түшүм жыйноо.',
    },
    task: { ru: 'Собери 1 морковь', en: 'Harvest 1 carrot', kg: '1 сабизди жыйна' },
    hint: { ru: 'Сделай два шага вправо move() и вызови harvest().', en: 'Step right twice with move(), then call harvest().', kg: 'Эки жолу move() жасап, harvest() чакыр.' },
    code: 'move()\nmove()\nharvest()',
    goal: { carrots: 1 },
    seed: [[2, 0, 'carrot']],
  },
  {
    icon: '🔁',
    parLines: 4,
    name: { ru: 'Цикл for', en: 'for Loop', kg: 'for цикли' },
    concept: {
      ru: 'for i in range(n): повторяет строки с отступом n раз. Один цикл заменяет десяток строк!',
      en: 'for i in range(n): repeats indented lines n times.',
      kg: 'for i in range(n): — чегиниш менен жазылган саптарды n жолу кайталайт.',
    },
    task: { ru: 'Собери целый ряд — 6 морковей', en: 'Harvest the whole row — 6 carrots', kg: 'Бүт катарды жыйна — 6 сабиз' },
    hint: { ru: 'Собери первую морковь, затем в цикле 5 раз сделай move() и harvest().', en: 'Harvest first, then loop 5 times: move() and harvest().', kg: 'Биринчисин жыйнап, 5 жолу move() жана harvest() кайтала.' },
    code: 'harvest()\nfor i in range(5):\n    move()\n    harvest()',
    goal: { carrots: 6 },
    seed: ROW('carrot', 0),
  },
  {
    icon: '🥬',
    parLines: 2,
    name: { ru: 'Посадка', en: 'Planting', kg: 'Эгүү' },
    concept: {
      ru: "plant('carrot') сажает морковь в текущей клетке. Также доступны strawberry, pumpkin, sunflower, watermelon!",
      en: "plant('carrot') plants a crop on the current tile.",
      kg: "plant('carrot') ушул уячага сабиз эгет.",
    },
    task: { ru: 'Посади и собери морковь', en: 'Plant and harvest a carrot', kg: 'Сабиз эгип, жыйна' },
    hint: { ru: "Напиши plant('carrot'), а следующей строкой harvest().", en: "Write plant('carrot') followed by harvest().", kg: "plant('carrot') анан harvest() деп жаз." },
    code: "plant('carrot')\nharvest()",
    goal: { carrots: 1 },
    seed: [],
  },
  {
    icon: '🎃',
    parLines: 5,
    name: { ru: 'Тыквенная грядка', en: 'Pumpkin Patch', kg: 'Кабак талаасы' },
    concept: {
      ru: "plant('pumpkin') — тыква приносит в 2.5 раза больше очков и монет, чем морковь.",
      en: "plant('pumpkin') gives 2.5× more points and coins than carrots.",
      kg: "plant('pumpkin') — кабак 2.5 эсе көп упай берет.",
    },
    task: { ru: 'Посади и собери 2 тыквы', en: 'Plant and harvest 2 pumpkins', kg: '2 кабак эгип жыйна' },
    hint: { ru: "Посади тыкву, собери, шагни move(), повтори (или используй цикл).", en: "Plant, harvest, move(), repeat!", kg: "Кабак эк, жыйна, move(), кайтала!" },
    code: "plant('pumpkin')\nharvest()\nmove()\nplant('pumpkin')\nharvest()",
    goal: { pumpkins: 2 },
    seed: [],
  },
  {
    icon: '💧',
    parLines: 5,
    name: { ru: 'Засуха и полив', en: 'Drought & Watering', kg: 'Кургакчылык жана сугаруу' },
    concept: {
      ru: 'Светлые клетки — сухая почва! Команда water() поливает грядку: почва темнеет и даёт ×2 очков за урожай!',
      en: 'Pale tiles are dry soil! Call water() before harvesting dry crops for ×2 bonus!',
      kg: 'Ачык уячалар — кургак топурак! water() сугарат жана түшүмгө ×2 упай берет!',
    },
    task: { ru: 'Полей 3 сухие грядки и собери 3 клубники 🍓', en: 'Water 3 dry tiles & harvest 3 strawberries 🍓', kg: '3 кургак уячаны сугарып, 3 кулпунай 🍓 жыйна' },
    hint: { ru: 'В цикле 3 раза: water(), harvest(), move() (на последнем шаге move не нужен).', en: 'Use water() then harvest() on each of the 3 tiles.', kg: 'Ар бир уячада water() анан harvest() чакыр.' },
    code: 'for i in range(3):\n    water()\n    harvest()\n    if i < 2:\n        move()',
    goal: { strawberries: 3, watered: 3 },
    seed: [[0, 0, 'strawberry'], [1, 0, 'strawberry'], [2, 0, 'strawberry']],
    dryCells: [[0, 0], [1, 0], [2, 0]],
  },
  {
    icon: '🌿',
    parLines: 6,
    name: { ru: 'Борьба с сорняками', en: 'Weeding Time', kg: 'Отоо чөп тазалоо' },
    concept: {
      ru: 'Сорняки 🌿 мешают сажать! Команда clear() пропалывает клетку и освобождает грядку.',
      en: 'Weeds 🌿 block planting! Use clear() to pull them out.',
      kg: 'Отоо чөп 🌿 эгүүгө тоскоол болот! clear() аны тазалайт.',
    },
    task: { ru: 'Прополи 2 сорняка, посади и собери 2 подсолнуха 🌻', en: 'Clear 2 weeds, plant & harvest 2 sunflowers 🌻', kg: '2 отоо чөптү тазалап, 2 күн карама 🌻 эк жана жыйна' },
    hint: { ru: "На сорняке вызови clear(), затем plant('sunflower') и harvest().", en: "Call clear(), then plant('sunflower') and harvest().", kg: "clear(), анан plant('sunflower') жана harvest()." },
    code: "clear()\nplant('sunflower')\nharvest()\nmove()\nclear()\nplant('sunflower')\nharvest()",
    goal: { cleared: 2, sunflowers: 2 },
    seed: [[0, 0, 'weed'], [1, 0, 'weed']],
  },
  {
    icon: '🪨',
    parLines: 5,
    name: { ru: 'Прыжок через камни', en: 'Jump Over Rocks', kg: 'Таштардан секирүү' },
    concept: {
      ru: 'На камень 🪨 нельзя наступить! Но можно обойти через down()/up() или перепрыгнуть командой jump() (прыжок на 2 клетки вправо)!',
      en: 'You cannot step on rocks 🪨! Walk around with down()/up() or hop over with jump()!',
      kg: 'Ташка 🪨 басууга болбойт! Айланып өт же jump() менен секирип өт!',
    },
    task: { ru: 'Перепрыгни камни и собери 2 подсолнуха 🌻', en: 'Jump over rocks & harvest 2 sunflowers 🌻', kg: 'Таштардан секирип, 2 күн карама 🌻 жыйна' },
    hint: { ru: 'jump() перепрыгивает на 2 клетки вправо прямо через камень! Попробуй jump(), harvest(), jump(), harvest().', en: "jump() leaps 2 tiles right over a rock! Try jump(), harvest(), jump(), harvest().", kg: 'jump() оңго 2 уяча секирет! jump(), harvest(), jump(), harvest().' },
    code: 'jump()\nharvest()\njump()\nharvest()',
    goal: { sunflowers: 2 },
    seed: [[1, 0, 'rock'], [2, 0, 'sunflower'], [3, 0, 'rock'], [4, 0, 'sunflower']],
  },
  {
    icon: '🧠',
    parLines: 5,
    name: { ru: 'Условие if', en: 'Smart if Condition', kg: 'if шарты' },
    concept: {
      ru: 'if has_crop(): выполняет блок только если на клетке есть урожай! Так один цикл сам решает, где собирать.',
      en: 'if has_crop(): runs only when a crop is on the tile! Let code decide.',
      kg: 'if has_crop(): уячада түшүм болгондо гана иштейт!',
    },
    task: { ru: 'Пройди весь ряд с if has_crop(): и собери 3 клубники 🍓', en: 'Walk the row with if has_crop(): & collect 3 strawberries 🍓', kg: 'if has_crop(): колдонуп 3 кулпунай 🍓 жыйна' },
    hint: { ru: 'В цикле 5 раз: если has_crop(), собирай, затем шагай move(). И проверь последнюю клетку!', en: 'Loop across the row checking if has_crop(): harvest().', kg: 'Циклде if has_crop(): harvest() текшерип жүр.' },
    code: 'for i in range(5):\n    if has_crop():\n        harvest()\n    move()\nif has_crop():\n    harvest()',
    goal: { strawberries: 3 },
    seed: [[1, 0, 'strawberry'], [3, 0, 'strawberry'], [5, 0, 'strawberry']],
  },
  {
    icon: '🧭',
    parLines: 8,
    name: { ru: 'Змейка по 2 рядам', en: '2-Row Snake', kg: '2 катар жылан жолу' },
    concept: {
      ru: 'Фермер ходит во все 4 стороны: move()/right(), left(), down(), up(). Пройди два ряда змейкой!',
      en: 'Walk in all 4 directions: move()/right(), left(), down(), up().',
      kg: 'Фермер 4 тарапка жүрөт: move(), left(), down(), up().',
    },
    task: { ru: 'Собери 4 моркови в 1-м ряду и 4 клубники во 2-м ряду', en: 'Harvest 4 carrots in row 0 & 4 strawberries in row 1', kg: '1-катарда 4 сабиз, 2-катарда 4 кулпунай жыйна' },
    hint: { ru: 'Собери 4 клетки вправо, спустись down(), и собери 4 клетки влево left()!', en: 'Go right 3 steps, step down(), then go left 3 steps!', kg: 'Оңго жыйнап, down() түшүп, left() менен кайт!' },
    code: 'for i in range(3):\n    harvest()\n    move()\nharvest()\ndown()\nfor i in range(3):\n    harvest()\n    left()\nharvest()',
    goal: { carrots: 4, strawberries: 4 },
    seed: [
      [0, 0, 'carrot'], [1, 0, 'carrot'], [2, 0, 'carrot'], [3, 0, 'carrot'],
      [0, 1, 'strawberry'], [1, 1, 'strawberry'], [2, 1, 'strawberry'], [3, 1, 'strawberry'],
    ],
  },
  {
    icon: '🍉',
    parLines: 8,
    name: { ru: 'Арбузный автомат', en: 'Watermelon Bot', kg: 'Дарбыз автоматы' },
    concept: {
      ru: 'Комбинируй условия: if is_weed(): clear() и if is_dry(): water()! Арбузы 🍉 — самый ценный урожай (+40 очков).',
      en: 'Combine if is_weed(): clear() and if is_dry(): water()! Watermelons 🍉 give +40 pts.',
      kg: 'if is_weed(): clear() жана if is_dry(): water() бириктир! Дарбыз 🍉 +40 упай берет.',
    },
    task: { ru: 'Убери сорняки, полей сухие клетки, посади и собери 3 арбуза 🍉', en: 'Clear weeds, water dry tiles, plant & harvest 3 watermelons 🍉', kg: 'Отоо чөптү тазалап, сугарып, 3 дарбыз 🍉 эк жана жыйна' },
    hint: { ru: "В цикле: if is_weed(): clear(), if is_dry(): water(), plant('watermelon'), harvest().", en: "Inside loop: clear weeds, water dry tiles, plant('watermelon'), harvest().", kg: "Циклде: clear(), water(), plant('watermelon'), harvest()." },
    code: "for i in range(3):\n    if is_weed():\n        clear()\n    if is_dry():\n        water()\n    plant('watermelon')\n    harvest()\n    if i < 2:\n        move()",
    goal: { watermelons: 3, cleared: 2, watered: 2 },
    seed: [[0, 0, 'weed'], [2, 0, 'weed']],
    dryCells: [[1, 0], [2, 0]],
  },
  {
    icon: '🖨️',
    parLines: 7,
    name: { ru: 'Отчёт фермера', en: 'Farm Report', kg: 'Фермердин отчёту' },
    concept: {
      ru: "print('текст') печатает отчёт в терминал. Собери смешанный урожай и отправь отчёт «Готово».",
      en: "print('text') prints a report to the terminal.",
      kg: "print('текст') терминалга отчёт чыгарат.",
    },
    task: { ru: 'Собери 2 тыквы + 2 арбуза и напечатай «Урожай готов»', en: 'Harvest 2 pumpkins + 2 watermelons & print «Урожай готов»', kg: '2 кабак + 2 дарбыз жыйнап, «Урожай готов» чыгар' },
    hint: { ru: "Пройди ряд с if has_crop(): harvest(), в конце добавь print('Урожай готов').", en: "Walk with if has_crop(): harvest(), end with print('Урожай готов').", kg: "if has_crop(): harvest() анан print('Урожай готов')." },
    code: "for i in range(4):\n    if has_crop():\n        harvest()\n    move()\nprint('Урожай готов')",
    goal: { pumpkins: 2, watermelons: 2, printed: 'Урожай готов' },
    seed: [[0, 0, 'pumpkin'], [1, 0, 'watermelon'], [2, 0, 'pumpkin'], [3, 0, 'watermelon']],
  },
  {
    icon: '🏆',
    parLines: 11,
    name: { ru: 'Финал: Супер-ферма', en: 'Final: Super Farm', kg: 'Финал: Супер-ферма' },
    concept: {
      ru: 'Босс-уровень! На поле есть всё: камни, сорняки, засуха, подсолнухи и арбузы. Напиши универсальный код фермера!',
      en: 'Boss level! Rocks, weeds, drought, sunflowers & watermelons — combine every skill!',
      kg: 'Босс-деңгээл! Таш, отоо чөп, кургакчылык, күн карама жана дарбыз — баарын колдон!',
    },
    task: { ru: 'Собери 2 подсолнуха + 2 арбуза, прополи 1 сорняк, полей 1 клетку и напечатай «Победа!»', en: '2 sunflowers + 2 watermelons, clear 1 weed, water 1 tile & print «Победа!»', kg: '2 күн карама + 2 дарбыз, 1 отоо чөп, 1 сугаруу жана «Победа!»' },
    hint: { ru: "Собери первый арбуз, перепрыгни камень jump(), собери 🌻, перейди вниз down(), разберись с сорняком и сухой клеткой!", en: "Harvest, jump() over the rock, go down() to row 1, clear weed & water!", kg: "Жыйнап, jump() менен таштан секирип, down() түшүп баарын жыйна!" },
    code: "harvest()\njump()\nharvest()\ndown()\nif is_weed():\n    clear()\nwater()\nplant('watermelon')\nharvest()\nleft()\nharvest()\nprint('Победа!')",
    goal: { sunflowers: 2, watermelons: 2, cleared: 1, watered: 1, printed: 'Победа' },
    seed: [[0, 0, 'watermelon'], [1, 0, 'rock'], [2, 0, 'sunflower'], [2, 1, 'weed'], [1, 1, 'sunflower']],
    dryCells: [[2, 1]],
  },
]

type FState = {
  x: number
  y: number
  grid: CellKind[][]
  soil: SoilKind[][]
  waterPulse: number
  out: string[]
  carrots: number
  pumpkins: number
  sunflowers: number
  strawberries: number
  watermelons: number
  watered: number
  cleared: number
  msg: string
  done: boolean
}

const mkState = (
  seed: [number, number, Exclude<CellKind, null>][],
  dryCells: [number, number][] = []
): FState => {
  const grid = Array.from({ length: H }, () => Array<CellKind>(W).fill(null))
  const soil = Array.from({ length: H }, () => Array<SoilKind>(W).fill('normal'))
  for (const [sx, sy, c] of seed) {
    if (sy >= 0 && sy < H && sx >= 0 && sx < W) grid[sy][sx] = c
  }
  for (const [dx, dy] of dryCells) {
    if (dy >= 0 && dy < H && dx >= 0 && dx < W) soil[dy][dx] = 'dry'
  }
  return {
    x: 0, y: 0, grid, soil, waterPulse: 0,
    out: [], carrots: 0, pumpkins: 0, sunflowers: 0, strawberries: 0, watermelons: 0,
    watered: 0, cleared: 0, msg: '', done: false,
  }
}

// AST-интерпретатор с настоящими динамическими условиями (if has_crop / is_weed / is_dry / is_empty / is_rock_ahead / i < N)
type Stmt =
  | { kind: 'cmd'; fn: 'move' | 'left' | 'down' | 'up' | 'jump' | 'harvest' | 'plant' | 'water' | 'clear' | 'print'; arg?: any; ln: number }
  | { kind: 'loop'; varName: string; times: number; body: Stmt[]; ln: number }
  | { kind: 'if'; cond: string; body: Stmt[]; elseBody?: Stmt[]; ln: number }

function parseAst(src: string): { stmts: Stmt[]; err: string | null; lineCount: number } {
  const lines = src.split('\n')
  const lineCount = lines.filter(l => l.trim() && !l.trim().startsWith('#')).length
  let i = 0

  const parseBlock = (minInd: number): { stmts: Stmt[]; err: string | null } => {
    const out: Stmt[] = []
    while (i < lines.length) {
      const raw = lines[i]
      const trimmed = raw.trim()
      if (!trimmed || trimmed.startsWith('#')) { i++; continue }
      const indent = raw.search(/\S/)
      if (indent < minInd) break
      const ln = i + 1
      // убираем инлайн-комментарий вне кавычек
      const clean = trimmed.replace(/\s+#[^'"]*$/, '').trim()

      // цикл for / repeat
      const loopM = /^(?:for\s+(\w+)\s+in\s+range\(\s*(\d+)\s*\)|repeat\(\s*(\d+)\s*\))\s*:?\s*$/.exec(clean)
      if (loopM) {
        const varName = loopM[1] || 'i'
        const times = Number(loopM[2] || loopM[3] || 0)
        if (times < 1 || times > 50) return { stmts: [], err: `Строка ${ln}: повтори от 1 до 50` }
        i++
        const sub = parseBlock(indent + 1)
        if (sub.err) return sub
        if (!sub.stmts.length) return { stmts: [], err: `Строка ${ln}: в цикле нет команд (нужен отступ 4 пробела)` }
        out.push({ kind: 'loop', varName, times, body: sub.stmts, ln })
        continue
      }

      // условие if
      const ifM = /^if\s+(.+?)\s*:\s*$/.exec(clean)
      if (ifM) {
        const cond = ifM[1].trim()
        i++
        const sub = parseBlock(indent + 1)
        if (sub.err) return sub
        if (!sub.stmts.length) return { stmts: [], err: `Строка ${ln}: внутри if нет команд` }
        let elseBody: Stmt[] | undefined
        if (i < lines.length) {
          const nextRaw = lines[i]
          const nextTrim = nextRaw.trim()
          const nextInd = nextRaw.search(/\S/)
          if (nextInd === indent && /^else\s*:\s*$/.test(nextTrim)) {
            i++
            const eb = parseBlock(indent + 1)
            if (eb.err) return eb
            elseBody = eb.stmts
          }
        }
        out.push({ kind: 'if', cond, body: sub.stmts, elseBody, ln })
        continue
      }

      // обычная команда
      const m = /^(move|right|left|down|up|jump|harvest|plant|water|clear|print)\s*\(\s*(.*?)\s*\)\s*$/.exec(clean)
      if (!m) return { stmts: [], err: `Строка ${ln}: непонятная команда «${clean.slice(0, 40)}»` }
      const rawFn = m[1], arg = m[2]
      const fn = (rawFn === 'right' ? 'move' : rawFn) as any
      if (fn === 'move' || fn === 'left' || fn === 'down' || fn === 'up') {
        out.push({ kind: 'cmd', fn, arg: Math.min(50, Math.max(1, Math.round(Number(arg) || 1))), ln })
      } else if (fn === 'jump') {
        const dir = arg.replace(/['"]/g, '').trim() || 'right'
        out.push({ kind: 'cmd', fn, arg: dir, ln })
      } else if (fn === 'plant') {
        const cName = arg.replace(/['"]/g, '').trim().toLowerCase()
        if (!(['carrot', 'pumpkin', 'sunflower', 'strawberry', 'watermelon'].includes(cName))) {
          return { stmts: [], err: `Строка ${ln}: plant('carrot' | 'pumpkin' | 'sunflower' | 'strawberry' | 'watermelon')` }
        }
        out.push({ kind: 'cmd', fn, arg: cName as CropKind, ln })
      } else if (fn === 'print') {
        out.push({ kind: 'cmd', fn, arg: String(arg).replace(/^['"]|['"]$/g, ''), ln })
      } else {
        out.push({ kind: 'cmd', fn, ln })
      }
      i++
    }
    return { stmts: out, err: null }
  }

  const res = parseBlock(0)
  if (res.err) return { stmts: [], err: res.err, lineCount }
  if (!res.stmts.length) return { stmts: [], err: 'Программа пуста', lineCount }
  return { stmts: res.stmts, err: null, lineCount }
}

function isCropCell(c: CellKind): c is CropKind {
  return c === 'carrot' || c === 'pumpkin' || c === 'sunflower' || c === 'strawberry' || c === 'watermelon'
}

function evalCond(cond: string, s: FState, vars: Record<string, number>): boolean {
  let c = cond.trim()
  let neg = false
  if (c.startsWith('not ')) { neg = true; c = c.slice(4).trim() }
  let val = false
  if (c === 'has_crop()' || c === 'is_crop()') val = isCropCell(s.grid[s.y][s.x])
  else if (c === 'is_weed()') val = s.grid[s.y][s.x] === 'weed'
  else if (c === 'is_dry()') val = s.soil[s.y][s.x] === 'dry'
  else if (c === 'is_wet()') val = s.soil[s.y][s.x] === 'wet'
  else if (c === 'is_empty()') val = s.grid[s.y][s.x] === null
  else if (c === 'is_rock_ahead()') val = s.x + 1 < W && s.grid[s.y][s.x + 1] === 'rock'
  else {
    const cmp = /^(\w+)\s*(<|<=|>|>=|==|!=)\s*(\d+)$/.exec(c)
    if (cmp) {
      const lv = vars[cmp[1]] ?? 0
      const rv = Number(cmp[3])
      if (cmp[2] === '<') val = lv < rv
      else if (cmp[2] === '<=') val = lv <= rv
      else if (cmp[2] === '>') val = lv > rv
      else if (cmp[2] === '>=') val = lv >= rv
      else if (cmp[2] === '==') val = lv === rv
      else if (cmp[2] === '!=') val = lv !== rv
    }
  }
  return neg ? !val : val
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type Weather = { key: F3DWeather; icon: string; name: Record<string, string>; multAll: number; multPumpkin: number }
const WEATHERS: Weather[] = [
  { key: 'sun', icon: '☀️', name: { ru: 'Солнечно', en: 'Sunny', kg: 'Күндүү' }, multAll: 1, multPumpkin: 1 },
  { key: 'sunset', icon: '🌅', name: { ru: 'Закат ×1.5', en: 'Sunset ×1.5', kg: 'Күн батыш ×1.5' }, multAll: 1.5, multPumpkin: 1 },
  { key: 'rain', icon: '🌧️', name: { ru: 'Дождь: тыквы ×2', en: 'Rain: pumpkins ×2', kg: 'Жаан: кабак ×2' }, multAll: 1, multPumpkin: 2 },
  { key: 'rainbow', icon: '🌈', name: { ru: 'Радуга: всё ×2', en: 'Rainbow: all ×2', kg: 'Кайырма: баары ×2' }, multAll: 2, multPumpkin: 2 },
  { key: 'night', icon: '🌙', name: { ru: 'Ночь: светлячки ×1.5', en: 'Night: fireflies ×1.5', kg: 'Түн ×1.5' }, multAll: 1.5, multPumpkin: 1.5 },
]

const CELL_ICON: Record<Exclude<CellKind, null>, string> = {
  carrot: '🥕', pumpkin: '🎃', sunflower: '🌻', strawberry: '🍓', watermelon: '🍉', rock: '🪨', weed: '🌿',
}

export default function FarmerBala() {
  const { t, lang } = useLang()
  const [tab, setTab] = useState<'tree' | 'farm' | 'sandbox'>('tree')
  const [ch, setCh] = useState(() => Math.min(Number(localStorage.getItem('edu-farmer-max') || 0), CHAPTERS.length - 1))
  const [stars, setStars] = useState(() => Number(localStorage.getItem('edu-farmer-best') || 0))
  const [coins, setCoins] = useState(() => Number(localStorage.getItem('edu-farmer-coins') || 20))
  const [ownedHats, setOwnedHats] = useState<FarmerHat[]>(() => {
    try { return JSON.parse(localStorage.getItem('edu-farmer-hats') || '["straw"]') } catch { return ['straw'] }
  })
  const [hat, setHat] = useState<FarmerHat>(() => (localStorage.getItem('edu-farmer-hat') as FarmerHat) || 'straw')
  const [shopOpen, setShopOpen] = useState(false)

  const [st, setSt] = useState<FState>(() => {
    const idx = Math.min(Number(localStorage.getItem('edu-farmer-max') || 0), CHAPTERS.length - 1)
    return mkState(CHAPTERS[idx].seed, CHAPTERS[idx].dryCells)
  })
  const [code, setCode] = useState(() => CHAPTERS[Math.min(Number(localStorage.getItem('edu-farmer-max') || 0), CHAPTERS.length - 1)].code)
  const [err, setErr] = useState<string | null>(null)
  const [showHint, setShowHint] = useState(false)
  const [earnedStars, setEarnedStars] = useState(3)

  // Песочница (редактор карты)
  const [sbBrush, setSbBrush] = useState<CellKind | 'dry'>('carrot')
  const [sbSeed, setSbSeed] = useState<[number, number, Exclude<CellKind, null>][]>([
    [1, 0, 'carrot'], [2, 0, 'sunflower'], [3, 0, 'rock'], [4, 0, 'watermelon'], [2, 1, 'weed'],
  ])
  const [sbDry, setSbDry] = useState<[number, number][]>([[2, 1]])

  const [pts, setPts] = useState(0)
  const [combo, setCombo] = useState({ n: 0, max: 0 })
  const [wI, setWI] = useState(0)
  const [float, setFloat] = useState<{ txt: string; cls: string; key: number } | null>(null)
  const [dayNo, setDayNo] = useState(1)
  const [is3d, setIs3d] = useState(true)
  const [speed, setSpeed] = useState<1 | 2>(1)
  const [activeLine, setActiveLine] = useState<number | null>(null)
  const [dayBest, setDayBest] = useState(() => Number(localStorage.getItem('edu-farmer-daybest-' + Math.min(Number(localStorage.getItem('edu-farmer-max') || 0), CHAPTERS.length - 1)) || 0))
  const t0Ref = useRef(0)
  const [fastBonus, setFastBonus] = useState(false)
  const stopRef = useRef(false)
  const stepWaitRef = useRef<(() => void) | null>(null)
  const [stepping, setStepping] = useState(false)

  const weather = WEATHERS[wI % WEATHERS.length]
  ;(window as any).__fb = { ch, carrots: st.carrots, pumpkins: st.pumpkins, out: st.out, done: st.done, msg: st.msg, stars, chapters: CHAPTERS.length, pts, combo: combo.max }

  const initialForMode = () => tab === 'sandbox' ? mkState(sbSeed, sbDry) : mkState(CHAPTERS[ch].seed, CHAPTERS[ch].dryCells)

  const openChapter = (i: number) => {
    stopRef.current = true
    stepWaitRef.current?.()
    setStepping(false)
    setCh(i); setCode(CHAPTERS[i].code); setErr(null); setShowHint(false)
    setSt(mkState(CHAPTERS[i].seed, CHAPTERS[i].dryCells)); setTab('farm')
    setPts(0); setCombo({ n: 0, max: 0 }); setFloat(null); setDayNo(d => d + 1)
    setDayBest(Number(localStorage.getItem('edu-farmer-daybest-' + i) || 0))
    setFastBonus(false)
  }

  const openSandbox = () => {
    stopRef.current = true
    stepWaitRef.current?.()
    setStepping(false)
    setTab('sandbox')
    setErr(null)
    setSt(mkState(sbSeed, sbDry))
    setCode("for i in range(5):\n    if is_weed():\n        clear()\n    if is_dry():\n        water()\n    if has_crop():\n        harvest()\n    if is_rock_ahead():\n        jump()\n    else:\n        move()")
  }

  const paintSandboxCell = (x: number, y: number) => {
    if (x === 0 && y === 0 && sbBrush === 'rock') return
    sfx('fb.chip')
    if (sbBrush === 'dry') {
      const exists = sbDry.some(([dx, dy]) => dx === x && dy === y)
      const nextDry = exists ? sbDry.filter(([dx, dy]) => !(dx === x && dy === y)) : [...sbDry, [x, y] as [number, number]]
      setSbDry(nextDry)
      setSt(mkState(sbSeed, nextDry))
    } else {
      const cleaned = sbSeed.filter(([sx, sy]) => !(sx === x && sy === y))
      const nextSeed = sbBrush ? [...cleaned, [x, y, sbBrush] as [number, number, Exclude<CellKind, null>]] : cleaned
      setSbSeed(nextSeed)
      setSt(mkState(nextSeed, sbDry))
    }
  }

  const buyOrEquipHat = (h: typeof HATS[number]) => {
    if (ownedHats.includes(h.id)) {
      setHat(h.id); localStorage.setItem('edu-farmer-hat', h.id); sfx('fb.chip')
      return
    }
    if (coins < h.price) { sfx('cm.wrong'); return }
    const nextCoins = coins - h.price
    const nextOwned = [...ownedHats, h.id]
    setCoins(nextCoins); setOwnedHats(nextOwned); setHat(h.id)
    localStorage.setItem('edu-farmer-coins', String(nextCoins))
    localStorage.setItem('edu-farmer-hats', JSON.stringify(nextOwned))
    localStorage.setItem('edu-farmer-hat', h.id)
    sfx('fb.level')
  }

  const reset = () => {
    stopRef.current = true
    stepWaitRef.current?.()
    setStepping(false)
    setActiveLine(null); setErr(null)
    setSt(initialForMode())
    setPts(0); setCombo({ n: 0, max: 0 }); setFloat(null); setFastBonus(false)
  }

  const execute = async (stepMode = false) => {
    stopRef.current = true
    stepWaitRef.current?.()
    setActiveLine(null)
    await sleep(30)
    const parsed = parseAst(code)
    if (parsed.err) { setErr(parsed.err); sfx('cm.wrong'); return }
    setErr(null)
    const s0 = initialForMode()
    setSt(s0)
    setPts(0); setCombo({ n: 0, max: 0 })
    t0Ref.current = Date.now()
    stopRef.current = false
    setStepping(stepMode)

    let s = s0
    let cpts = 0
    let earnedCoins = 0
    let ccombo = 0
    let cmax = 0
    let totalSteps = 0
    const stepMs = speed === 2 ? 170 : 320

    const waitNext = async () => {
      if (stepMode) {
        await new Promise<void>(res => { stepWaitRef.current = res })
        stepWaitRef.current = null
      } else {
        await sleep(stepMs)
      }
    }

    const runBlock = async (stmts: Stmt[], vars: Record<string, number>) => {
      for (const node of stmts) {
        if (stopRef.current) return
        if (node.kind === 'loop') {
          for (let r = 0; r < node.times; r++) {
            if (stopRef.current) return
            await runBlock(node.body, { ...vars, [node.varName]: r })
          }
          continue
        }
        if (node.kind === 'if') {
          if (evalCond(node.cond, s, vars)) await runBlock(node.body, vars)
          else if (node.elseBody) await runBlock(node.elseBody, vars)
          continue
        }
        // cmd
        totalSteps++
        if (totalSteps > 450) throw new Error('Слишком много шагов (>450) — проверь циклы')
        setActiveLine(node.ln)
        await waitNext()
        if (stopRef.current) return

        if (node.fn === 'move' || node.fn === 'left' || node.fn === 'down' || node.fn === 'up') {
          const k = Number(node.arg) || 1
          for (let step = 0; step < k; step++) {
            const nx = node.fn === 'move' ? s.x + 1 : node.fn === 'left' ? s.x - 1 : s.x
            const ny = node.fn === 'down' ? s.y + 1 : node.fn === 'up' ? s.y - 1 : s.y
            if (nx < 0 || nx >= W || ny < 0 || ny >= H) throw new Error(`Строка ${node.ln}: фермер ушёл за край фермы`)
            if (s.grid[ny][nx] === 'rock') throw new Error(`Строка ${node.ln}: путь преграждает камень 🪨! Используй jump() или обойди.`)
            s = { ...s, x: nx, y: ny }
            setSt(s)
            sfx('ws.select', 0.35)
            if (k > 1 && step < k - 1) await sleep(stepMs * 0.6)
          }
        } else if (node.fn === 'jump') {
          const d = String(node.arg || 'right')
          const dx = d === 'left' ? -2 : d === 'down' || d === 'up' ? 0 : 2
          const dy = d === 'down' ? 2 : d === 'up' ? -2 : 0
          const nx = s.x + dx, ny = s.y + dy
          if (nx < 0 || nx >= W || ny < 0 || ny >= H) throw new Error(`Строка ${node.ln}: прыжок за край фермы`)
          if (s.grid[ny][nx] === 'rock') throw new Error(`Строка ${node.ln}: приземление прямо на камень 🪨`)
          s = { ...s, x: nx, y: ny }
          sfx('fb.chip')
        } else if (node.fn === 'water') {
          const wasDry = s.soil[s.y][s.x] === 'dry'
          const nextSoil = s.soil.map((row, yy) => yy === s.y ? row.map((v, xx) => xx === s.x ? 'wet' as SoilKind : v) : row)
          cpts += wasDry ? 15 : 5
          setFloat({ txt: wasDry ? '💧 +15' : '💧', cls: 'text-sky-300', key: Date.now() })
          s = { ...s, soil: nextSoil, waterPulse: s.waterPulse + 1, watered: s.watered + 1 }
          sfx('fb.plant')
        } else if (node.fn === 'clear') {
          if (s.grid[s.y][s.x] !== 'weed') throw new Error(`Строка ${node.ln}: здесь нет сорняка 🌿`)
          const nextGrid = s.grid.map((row, yy) => yy === s.y ? row.map((c, xx) => xx === s.x ? null : c) : row)
          cpts += 15; earnedCoins += 3
          setFloat({ txt: '🌿 +15', cls: 'text-lime-300', key: Date.now() })
          s = { ...s, grid: nextGrid, cleared: s.cleared + 1 }
          sfx('fb.pick')
        } else if (node.fn === 'harvest') {
          const cell = s.grid[s.y][s.x]
          if (!isCropCell(cell)) throw new Error(`Строка ${node.ln}: здесь нечего собирать`)
          if (s.soil[s.y][s.x] === 'dry') throw new Error(`Строка ${node.ln}: почва сухая! Сначала полей грядку командой water()`)
          ccombo++
          cmax = Math.max(cmax, ccombo)
          const meta = CROP_META[cell]
          const wetMult = s.soil[s.y][s.x] === 'wet' ? 2 : 1
          const comboMult = 1 + Math.min(2, (ccombo - 1) * 0.25)
          const gained = Math.round(meta.pts * wetMult * weather.multAll * (cell === 'pumpkin' ? weather.multPumpkin : 1) * comboMult)
          cpts += gained
          earnedCoins += meta.coins
          setFloat({ txt: `+${gained}${wetMult > 1 ? ' 💧×2' : ''}`, cls: cell === 'watermelon' || cell === 'pumpkin' ? 'text-fuchsia-300' : 'text-amber-300', key: Date.now() })
          s = {
            ...s,
            grid: s.grid.map((row, yy) => yy === s.y ? row.map((c, xx) => xx === s.x ? null : c) : row),
            carrots: cell === 'carrot' ? s.carrots + 1 : s.carrots,
            pumpkins: cell === 'pumpkin' ? s.pumpkins + 1 : s.pumpkins,
            sunflowers: cell === 'sunflower' ? s.sunflowers + 1 : s.sunflowers,
            strawberries: cell === 'strawberry' ? s.strawberries + 1 : s.strawberries,
            watermelons: cell === 'watermelon' ? s.watermelons + 1 : s.watermelons,
          }
          if (ccombo === 3 || ccombo === 5) sfx('fb.big')
          else sfx(cell === 'pumpkin' || cell === 'watermelon' ? 'fb.big' : 'fb.pick')
        } else if (node.fn === 'plant') {
          if (s.grid[s.y][s.x] === 'weed') throw new Error(`Строка ${node.ln}: сначала прополи сорняк командой clear()`)
          if (s.grid[s.y][s.x]) throw new Error(`Строка ${node.ln}: клетка уже занята`)
          const c: CropKind = node.arg
          s = { ...s, grid: s.grid.map((row, yy) => yy === s.y ? row.map((cc, xx) => xx === s.x ? c : cc) : row) }
          sfx('fb.plant')
        } else if (node.fn === 'print') {
          s = { ...s, out: [...s.out, String(node.arg)] }
          sfx('fb.print')
        }
        setPts(cpts)
        setCombo(prev => ({ n: ccombo, max: Math.max(prev.max, cmax) }))
        setSt(s)
      }
    }

    try {
      await runBlock(parsed.stmts, {})
    } catch (e: any) {
      sfx('cm.wrong')
      setActiveLine(null)
      setStepping(false)
      setCombo({ n: 0, max: cmax })
      setSt({ ...s, msg: e.message })
      return
    }

    setActiveLine(null)
    setStepping(false)
    if (stopRef.current) return

    if (earnedCoins > 0) {
      const nextCoins = coins + earnedCoins
      setCoins(nextCoins)
      localStorage.setItem('edu-farmer-coins', String(nextCoins))
    }

    if (tab === 'sandbox') {
      sfx('fb.print')
      return
    }

    const g = CHAPTERS[ch].goal
    const ok =
      (g.carrots === undefined || s.carrots >= g.carrots) &&
      (g.pumpkins === undefined || s.pumpkins >= g.pumpkins) &&
      (g.sunflowers === undefined || s.sunflowers >= g.sunflowers) &&
      (g.strawberries === undefined || s.strawberries >= g.strawberries) &&
      (g.watermelons === undefined || s.watermelons >= g.watermelons) &&
      (g.watered === undefined || s.watered >= g.watered) &&
      (g.cleared === undefined || s.cleared >= g.cleared) &&
      (g.printed === undefined || s.out.some(o => o.includes(g.printed!)))

    if (ok) {
      sfx('fb.level')
      const eff = parsed.lineCount <= CHAPTERS[ch].parLines ? 3 : parsed.lineCount <= CHAPTERS[ch].parLines + 3 ? 2 : 1
      setEarnedStars(eff)
      const prevMax = Number(localStorage.getItem('edu-farmer-max') || 0)
      const nextMax = Math.max(prevMax, Math.min(ch + 1, CHAPTERS.length))
      localStorage.setItem('edu-farmer-max', String(nextMax))
      const ns = Math.max(stars, ch + 1)
      setStars(ns)
      localStorage.setItem('edu-farmer-best', String(ns))
      const bonusCoins = eff * 5
      const nextCoins = coins + earnedCoins + bonusCoins
      setCoins(nextCoins)
      localStorage.setItem('edu-farmer-coins', String(nextCoins))

      const fast = (Date.now() - t0Ref.current) < 7000
      const bonus = fast ? 30 : 0
      if (fast) setTimeout(() => setFloat({ txt: '⚡ +30', cls: 'text-cyan-300', key: Date.now() }), 350)
      const fpts = cpts + bonus
      setPts(fpts)
      const prevBest = Number(localStorage.getItem('edu-farmer-daybest-' + ch) || 0)
      if (fpts > prevBest) {
        localStorage.setItem('edu-farmer-daybest-' + ch, String(fpts))
        setDayBest(fpts)
      }
      setFastBonus(fast)
      setSt({ ...s, done: true, msg: '' })
    } else {
      sfx('fb.print')
      setSt({ ...s, msg: 'Цель уровня ещё не выполнена — проверь счётчики сверху и попробуй снова!' })
    }
  }

  const unlocked = (i: number) => i === 0 || stars >= i
  const finished = (i: number) => Number(localStorage.getItem('edu-farmer-max') || 0) > i
  const starNow = Math.min(stars, CHAPTERS.length)

  const insertChip = (s: string, raw = false) => {
    sfx('fb.chip')
    try { navigator.vibrate && navigator.vibrate(10) } catch {}
    setCode(c => (raw ? c : c + (c.endsWith('\n') || c === '' ? '' : '\n')) + s)
  }

  const CHIPS: [string, string, boolean?][] = [
    ['➡ move()', 'move()'],
    ['⬅ left()', 'left()'],
    ['⬇ down()', 'down()'],
    ['⬆ up()', 'up()'],
    ['🦘 jump()', 'jump()'],
    ['💧 water()', 'water()'],
    ['🌿 clear()', 'clear()'],
    ['🧺 harvest()', 'harvest()'],
    ['🥕', "plant('carrot')"],
    ['🍓', "plant('strawberry')"],
    ['🎃', "plant('pumpkin')"],
    ['🌻', "plant('sunflower')"],
    ['🍉', "plant('watermelon')"],
    ['if crop:', 'if has_crop():\n    harvest()'],
    ['if weed:', 'if is_weed():\n    clear()'],
    ['for 5:', 'for i in range(5):\n    '],
    ['print()', "print('Готово!')"],
    ['⎵ отступ', '\n    ', true],
  ]

  const goal = CHAPTERS[ch].goal

  return (
    <div className="min-h-[calc(100vh-64px)] w-full bg-gradient-to-b from-emerald-900 to-emerald-950 px-2 py-4 sm:px-3 lg:px-8 sm:py-6" data-page="farmer">
      <div className="max-w-5xl mx-auto">
        <a href="/games" className="inline-flex items-center gap-1 text-sm font-bold text-indigo-300 hover:text-white">
          {t('hm_to_games')}
        </a>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-center mb-1 text-white">🧑‍🌾 {t('games_farmer')}</h1>
        <p className="text-center text-emerald-200/80 mb-3 sm:mb-4 text-sm sm:text-base">{t('fb_sub')}</p>

        {/* Верхняя навигация: уровни, ферма, песочница, монеты и магазин шляп */}
        <div className="flex flex-wrap justify-center gap-2 mb-5">
          <button onClick={() => setTab('tree')} className={`px-4 py-2 rounded-xl font-bold min-h-[44px] ${tab === 'tree' ? 'bg-amber-400 text-emerald-950 shadow' : 'bg-white/10 text-white hover:bg-white/20'}`}>🌳 {t('fb_tree')} ({starNow}/{CHAPTERS.length})</button>
          <button onClick={() => setTab('farm')} className={`px-4 py-2 rounded-xl font-bold min-h-[44px] ${tab === 'farm' ? 'bg-amber-400 text-emerald-950 shadow' : 'bg-white/10 text-white hover:bg-white/20'}`}>🚜 {t('fb_farm')}</button>
          <button onClick={openSandbox} className={`px-4 py-2 rounded-xl font-bold min-h-[44px] ${tab === 'sandbox' ? 'bg-amber-400 text-emerald-950 shadow' : 'bg-white/10 text-white hover:bg-white/20'}`}>🎨 Песочница</button>
          <button onClick={() => setShopOpen(v => !v)} className="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-300/40 text-amber-200 font-bold min-h-[44px] hover:bg-amber-500/30 flex items-center gap-1.5">
            🪙 {coins} · {HATS.find(h => h.id === hat)?.icon} Шляпы
          </button>
        </div>

        {/* Магазин 3D-шляп */}
        {shopOpen && (
          <div className="mb-5 p-4 rounded-2xl bg-slate-900/80 border border-amber-400/30 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="font-bold text-white text-sm">👒 Магазин 3D-шляп фермера (отображается прямо на персонаже в 3D!)</div>
              <button onClick={() => setShopOpen(false)} className="text-xs text-slate-400 hover:text-white">✕</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {HATS.map(h => {
                const owned = ownedHats.includes(h.id)
                const active = hat === h.id
                return (
                  <button key={h.id} onClick={() => buyOrEquipHat(h)}
                    className={`p-3 rounded-xl border text-left transition ${active ? 'bg-amber-400 text-emerald-950 border-amber-300' : owned ? 'bg-white/10 text-white border-emerald-400/40 hover:bg-white/20' : coins >= h.price ? 'bg-white/10 text-white border-white/15 hover:bg-white/20' : 'bg-white/5 text-white/40 border-white/10'}`}>
                    <div className="text-2xl">{h.icon}</div>
                    <div className="font-bold text-xs mt-1">{h.name[lang] || h.name.ru}</div>
                    <div className="text-[11px] opacity-80 mt-0.5">{active ? '✓ Надето' : owned ? 'Надеть' : `🪙 ${h.price}`}</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Дерево 12 уровней */}
        {tab === 'tree' && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto" data-testid="fb-tree">
            {CHAPTERS.map((c, i) => {
              const u = unlocked(i), f = finished(i)
              return (
                <button key={i} disabled={!u} onClick={() => openChapter(i)}
                  className={`text-left rounded-2xl p-4 border transition-all ${!u ? 'bg-white/5 border-white/10 text-emerald-200/40 cursor-not-allowed' : f ? 'bg-emerald-500/20 border-emerald-400/50 text-white hover:bg-emerald-500/30' : 'bg-white/10 border-amber-300/40 text-white hover:bg-white/20'}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{u ? (f ? '✅' : c.icon) : '🔒'}</span>
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm truncate">{i + 1}. {c.name[lang] || c.name.ru}</div>
                      <div className="text-xs opacity-70">{u ? (f ? t('fb_done') : t('fb_open')) : t('fb_locked')}</div>
                    </div>
                  </div>
                  <div className="mt-2 text-xs leading-snug opacity-80">{u ? (c.concept[lang] || c.concept.ru) : '? ? ?'}</div>
                </button>
              )
            })}
          </div>
        )}

        {/* Игровой экран (Кампания или Песочница) */}
        {(tab === 'farm' || tab === 'sandbox') && (
          <div className="grid lg:grid-cols-2 gap-4" data-testid="fb-farm">
            <div>
              {tab === 'farm' ? (
                <div className="rounded-2xl bg-white/10 border border-white/10 p-4 text-white mb-3" data-testid="fb-task">
                  <div className="flex items-start gap-2 mb-1">
                    <span className="text-2xl">{CHAPTERS[ch].icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-extrabold text-sm">{ch + 1}. {CHAPTERS[ch].name[lang] || CHAPTERS[ch].name.ru}</div>
                      <div className="text-xs font-bold text-amber-200">{t('fb_task')}: {CHAPTERS[ch].task[lang] || CHAPTERS[ch].task.ru}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setWI(i => (i + 1) % WEATHERS.length); sfx('fb.chip') }}
                      className="ml-auto shrink-0 px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 border border-white/15 text-xs font-bold whitespace-nowrap transition cursor-pointer"
                      data-testid="fb-weather"
                      title={t('fb3d_switch_weather')}
                    >
                      <span className="fb-hop">{weather.icon}</span> {weather.name[lang] || weather.name.ru} · {t('fb_day')} {dayNo}
                    </button>
                  </div>
                  <div className="text-xs opacity-80 mt-1">{CHAPTERS[ch].concept[lang] || CHAPTERS[ch].concept.ru}</div>
                  {showHint && (
                    <div className="mt-2 p-2.5 rounded-xl bg-amber-400/20 border border-amber-300/40 text-xs text-amber-100">
                      💡 {CHAPTERS[ch].hint[lang] || CHAPTERS[ch].hint.ru}
                    </div>
                  )}
                  <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs font-bold" data-testid="fb-goal">
                    {goal.carrots !== undefined && <span className={`px-2 py-1 rounded-lg ${st.carrots >= goal.carrots ? 'bg-emerald-500/40 text-emerald-100' : 'bg-white/10'}`}>🥕 {st.carrots}/{goal.carrots}</span>}
                    {goal.strawberries !== undefined && <span className={`px-2 py-1 rounded-lg ${st.strawberries >= goal.strawberries ? 'bg-emerald-500/40 text-emerald-100' : 'bg-white/10'}`}>🍓 {st.strawberries}/{goal.strawberries}</span>}
                    {goal.pumpkins !== undefined && <span className={`px-2 py-1 rounded-lg ${st.pumpkins >= goal.pumpkins ? 'bg-emerald-500/40 text-emerald-100' : 'bg-white/10'}`}>🎃 {st.pumpkins}/{goal.pumpkins}</span>}
                    {goal.sunflowers !== undefined && <span className={`px-2 py-1 rounded-lg ${st.sunflowers >= goal.sunflowers ? 'bg-emerald-500/40 text-emerald-100' : 'bg-white/10'}`}>🌻 {st.sunflowers}/{goal.sunflowers}</span>}
                    {goal.watermelons !== undefined && <span className={`px-2 py-1 rounded-lg ${st.watermelons >= goal.watermelons ? 'bg-emerald-500/40 text-emerald-100' : 'bg-white/10'}`}>🍉 {st.watermelons}/{goal.watermelons}</span>}
                    {goal.watered !== undefined && <span className={`px-2 py-1 rounded-lg ${st.watered >= goal.watered ? 'bg-sky-500/40 text-sky-100' : 'bg-white/10'}`}>💧 {st.watered}/{goal.watered}</span>}
                    {goal.cleared !== undefined && <span className={`px-2 py-1 rounded-lg ${st.cleared >= goal.cleared ? 'bg-lime-500/40 text-lime-100' : 'bg-white/10'}`}>🌿 {st.cleared}/{goal.cleared}</span>}
                    {goal.printed !== undefined && (
                      <span className={`px-2 py-1 rounded-lg ${st.out.some(o => o.includes(goal.printed!)) ? 'bg-emerald-500/40 text-emerald-100' : 'bg-white/10'}`}>🖨 {goal.printed}</span>
                    )}
                    <button type="button" onClick={() => setShowHint(v => !v)} className="ml-auto px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-amber-200">
                      💡 {showHint ? 'Скрыть' : 'Подсказка'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-white/10 border border-white/10 p-3.5 text-white mb-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-sm">🎨 Конструктор фермы — рисуй поле и запускай любой код!</span>
                    <button type="button" onClick={() => { setSbSeed([]); setSbDry([]); setSt(mkState([], [])) }} className="text-xs px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20">Очистить поле</button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {([
                      ['carrot', '🥕'], ['strawberry', '🍓'], ['pumpkin', '🎃'], ['sunflower', '🌻'], ['watermelon', '🍉'],
                      ['weed', '🌿 Сорняк'], ['rock', '🪨 Камень'], ['dry', '🏜️ Сухо'], [null, '🧹 Стереть'],
                    ] as [CellKind | 'dry', string][]).map(([k, lbl]) => (
                      <button key={String(k)} onClick={() => setSbBrush(k)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${sbBrush === k ? 'bg-amber-400 text-emerald-950 border-amber-300' : 'bg-white/10 text-white border-white/15 hover:bg-white/20'}`}>
                        {lbl}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-6 gap-1 bg-emerald-950/60 p-1.5 rounded-xl">
                    {Array.from({ length: H }).flatMap((_, y) =>
                      Array.from({ length: W }).map((_, x) => {
                        const c = sbSeed.find(([sx, sy]) => sx === x && sy === y)?.[2] || null
                        const dry = sbDry.some(([dx, dy]) => dx === x && dy === y)
                        return (
                          <button key={`${x}-${y}`} type="button" onClick={() => paintSandboxCell(x, y)}
                            className={`h-8 rounded-lg text-sm flex items-center justify-center border transition ${dry ? 'bg-amber-700/60 border-amber-400/50' : 'bg-emerald-800/60 border-emerald-700/50'} hover:ring-2 hover:ring-amber-300`}>
                            {x === 0 && y === 0 && !c ? '🧑‍🌾' : c ? CELL_ICON[c] : dry ? '🏜️' : ''}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="relative" data-testid="fb-grid">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {activeLine != null && (
                      <span className="px-2.5 py-1 rounded-lg bg-amber-400/20 border border-amber-300/40 text-amber-200 text-xs font-mono font-bold animate-pulse">
                        ▶ {t('fb_line')} {activeLine}
                      </span>
                    )}
                    {stepping && (
                      <button type="button" onClick={() => stepWaitRef.current?.()}
                        className="px-3 py-1 rounded-lg bg-amber-400 text-emerald-950 text-xs font-extrabold shadow animate-bounce">
                        ⏭ Следующий шаг
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => { setSpeed(v => v === 1 ? 2 : 1); sfx('fb.chip') }}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition ${
                        speed === 2 ? 'bg-amber-400 text-emerald-950 border-amber-300' : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                      }`}
                    >
                      ⚡ {speed}×
                    </button>
                    <button onClick={() => { setIs3d(v => !v); sfx('fb.chip') }}
                      className="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-white text-xs font-bold hover:bg-white/20"
                      data-testid="fb-3d-toggle">
                      {is3d ? `⬅ ${t('fb_2d')}` : `🧊 ${t('fb_3d')}`}
                    </button>
                  </div>
                </div>

                {is3d ? (
                  <Suspense fallback={<div className="rounded-2xl bg-emerald-700/60 border-4 border-emerald-600 p-2 text-white/70 text-xs" style={{ minHeight: 300 }}>🧊 …</div>}>
                    <FarmerField3D st={st} wx={weather.key} stopped={st.done} celebrate={st.done} hat={hat} />
                  </Suspense>
                ) : (
                  <div className="relative rounded-2xl bg-emerald-700/60 border-4 border-emerald-600 p-2 shadow-inner">
                    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${W},minmax(0,1fr))` }}>
                      {Array.from({ length: H }).flatMap((_, y) =>
                        Array.from({ length: W }).map((_, x) => {
                          const cell = st.grid[y][x]
                          const soil = st.soil[y][x]
                          const me = st.x === x && st.y === y
                          return (
                            <div key={`${x}-${y}`} data-cell={`${x},${y}`}
                              className={`relative aspect-square rounded-lg flex items-center justify-center text-2xl md:text-3xl ${
                                me ? 'ring-2 ring-amber-300 bg-amber-300/30' :
                                soil === 'dry' ? 'bg-amber-600/50' :
                                soil === 'wet' ? 'bg-sky-900/60' : 'bg-emerald-600/40'
                              }`}>
                              {me ? <span className="fb-hop" data-testid="fb-me">🧑‍🌾</span> : ''}
                              {cell && <span className="absolute bottom-0 right-0 text-xl">{CELL_ICON[cell]}</span>}
                              {soil === 'wet' && <span className="absolute top-0.5 left-0.5 text-[10px]">💧</span>}
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )}

                {float && (
                  <div key={float.key} className={`fb-float pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 text-2xl font-extrabold drop-shadow-lg ${float.cls}`} data-testid="fb-float">{float.txt}</div>
                )}
                {combo.n >= 3 && !st.done && (
                  <div className="absolute top-2 left-2 px-2 py-1 rounded-lg bg-fuchsia-600/80 text-white text-xs font-extrabold shadow" data-testid="fb-combo">🔥 {t('fb_combo')} ×{combo.n}</div>
                )}
              </div>

              <pre className="mt-3 rounded-xl bg-black/40 text-emerald-200 text-sm p-3 min-h-[82px] whitespace-pre-wrap" data-testid="fb-out">{st.out.length ? st.out.join('\n') : '> _'}</pre>
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-3 flex flex-col">
              <div className="flex items-center justify-between mb-2 text-xs text-slate-400 flex-wrap gap-1">
                <span className="font-mono font-bold text-emerald-300">Python 🐍 · Фермер Бала 2.0</span>
                <span className="text-[11px] text-slate-400">
                  {tab === 'farm' ? `Идеально ≤ ${CHAPTERS[ch].parLines} стр.` : 'Свободный режим'}
                </span>
              </div>
              <textarea value={code} onChange={e => setCode(e.target.value)} spellCheck={false}
                className="flex-1 min-h-[200px] w-full rounded-xl bg-[#0b1220] text-emerald-100 font-mono text-base sm:text-sm p-3 border border-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400/60" data-testid="fb-code" />
              {err && <div className="mt-2 text-rose-300 text-sm font-semibold" data-testid="fb-err">{err}</div>}
              {st.msg && <div className="mt-2 text-amber-300 text-sm font-semibold" data-testid="fb-msg">⚠ {st.msg}</div>}
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0" data-testid="fb-chips" role="group" aria-label={t('fb_chips')}>
                {CHIPS.map(([label, ins, raw], i) => (
                  <button key={i} onClick={() => insertChip(ins, !!raw)} title={ins}
                    className="px-2.5 py-1.5 min-h-[38px] rounded-xl bg-white/10 hover:bg-white/20 text-emerald-100 font-mono text-xs border border-white/10 active:scale-95 shrink-0">
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => execute(false)} className="flex-1 py-3 rounded-xl font-extrabold bg-amber-400 text-emerald-950 hover:bg-amber-300 min-h-[44px]" data-testid="fb-run">▶ {t('fb_run')}</button>
                <button onClick={() => stepping ? stepWaitRef.current?.() : execute(true)} className="px-3.5 py-3 rounded-xl font-bold bg-sky-500/80 text-white hover:bg-sky-500 min-h-[44px]" title="Пошаговая отладка">
                  ⏭ {stepping ? 'Далее' : 'Шаг'}
                </button>
                <button onClick={reset} className="px-4 py-3 rounded-xl font-bold bg-white/10 text-white hover:bg-white/20 min-h-[44px]">{t('fb_reset')}</button>
              </div>
              <div className="mt-2 flex items-center flex-wrap gap-2 text-xs sm:text-sm text-white/80" data-testid="fb-res">
                <span>🥕 {st.carrots}</span>
                <span>🍓 {st.strawberries}</span>
                <span>🎃 {st.pumpkins}</span>
                <span>🌻 {st.sunflowers}</span>
                <span>🍉 {st.watermelons}</span>
                <span className="ml-auto font-extrabold text-amber-300" data-testid="fb-pts">🏅 {pts}</span>
                {dayBest > 0 && <span className="font-bold text-emerald-300" data-testid="fb-best" title={t('fb_best_hint')}>🏆 {dayBest}</span>}
              </div>
            </div>
          </div>
        )}

        {st.done && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" data-testid="fb-done">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-8 text-center shadow-2xl max-w-sm w-full">
              <div className="text-4xl sm:text-5xl mb-2 fb-hop">{'⭐'.repeat(earnedStars)}{'☆'.repeat(3 - earnedStars)}</div>
              <div className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white">{t('fb_done2')}</div>
              <div className="mt-1 text-slate-500 dark:text-slate-400 text-sm">
                +{earnedStars * 5} 🪙 · {t('fb_total')}: {starNow}/{CHAPTERS.length} ⭐
              </div>
              <div className="mt-2 flex justify-center gap-2 flex-wrap text-sm font-bold" data-testid="fb-final">
                <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-700">🏅 {pts}</span>
                {fastBonus && <span className="px-2 py-1 rounded-lg bg-cyan-100 text-cyan-700" data-testid="fb-fast">⚡ {t('fb_fast')}</span>}
                {combo.max >= 3 && <span className="px-2 py-1 rounded-lg bg-fuchsia-100 text-fuchsia-700">🔥 ×{combo.max}</span>}
                <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">{weather.icon} {weather.name[lang] || weather.name.ru}</span>
              </div>
              <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
                {ch + 1 < CHAPTERS.length && (
                  <button onClick={() => openChapter(ch + 1)} className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-bold min-h-[44px]">
                    ➡ Уровень {ch + 2}
                  </button>
                )}
                <button onClick={() => { setSt(s => ({ ...s, done: false })); setTab('tree') }} className="px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold min-h-[44px]">
                  🌳 {t('fb_tonext')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
