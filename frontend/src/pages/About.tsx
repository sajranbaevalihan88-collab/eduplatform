import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getRole } from '../utils/role'
import {
  ArrowLeft, ArrowRight, ArrowUpRight, ArrowUp, Check, Minus, X, Sun, Moon,
  BookOpen, GraduationCap, FlaskConical, PenTool, Code2, Database,
  Gamepad2, Presentation, Sparkles
} from 'lucide-react'
import { useLang } from '../context/LangContext'
import { useTheme } from '../context/UIContext'
import {
  AnimatedEduLogoStage,
  AnimatedMetric,
  FlagshipMotionStyles,
  RevealEditorial,
  ScrollExpandPhoto,
  ScrollProgressBar,
  SpotlightTiltCard,
  StickyCinemaStage,
  ThreeHeroSculpture,
  type CinemaChapter,
} from '../components/AboutVisuals'

type LangKey = 'ru' | 'en' | 'kg'
type CatalogFilter = 'all' | 'teach' | 'practice' | 'games'

const DICT: Record<LangKey, Record<string, string>> = {
  ru: {
    back_app: 'В платформу',
    nav_story: 'История',
    nav_studio: 'Студия',
    nav_roles: 'Для кого',
    nav_modules: 'Модули',
    nav_compare: 'Сравнение',
    nav_start: 'Начать',

    hero_eye: 'ОБРАЗОВАТЕЛЬНАЯ СТУДИЯ · КЫРГЫЗСТАН · 2026',
    hero_t1: 'Урок, который сам приходит',
    hero_t2: 'в каждый телефон.',
    hero_sub: 'Интерактивные уроки с чтением PDF HD, Word и Excel, классы с журналом и QR-оплатой, доска 2D/3D, Python & PostgreSQL и живые командные игры — в одном лёгком окне браузера.',
    cta_lessons: 'Открыть уроки',
    cta_create: 'Создать урок',
    cta_games: 'Игры Live',
    stat_1: '8+ модулей',
    stat_2: '0 сом школам',
    stat_3: 'KG · RU · EN',
    stat_4: 'Без API-ключей',

    photo_cap: 'EduPlatform · Образование без границ',
    mission_quote: 'Мне не нужно строить школу в каждой деревне. Мне нужно, чтобы урок сам приходил в каждый телефон.',
    mission_eye: '01 / ИСТОРИЯ ПРОЕКТА',
    mission_t1: 'Сколько стоит',
    mission_t2: 'один хороший урок?',
    mission_p1: 'У репетитора — несколько сотен сомов. В частной школе — тысячи каждый месяц. А для семьи из далёкого села — дороже всех: к цене урока добавляется дорога в город. Выходит несправедливо: качество образования зависит от того, где родился ребёнок.',
    mission_p2: 'По данным PISA-2025, Кыргызстан занял 80-е место из 91 страны, 76% школьников ниже базового уровня, а школам не хватает 761 учителя. Школу в горах строят годами — но смартфон уже лежит в кармане почти у каждого ученика. Поэтому мы создали EduPlatform.',
    kpi1_l: 'место из 91 · PISA-2025',
    kpi2_l: 'школьников ниже базы',
    kpi3_l: 'дефицит учителей в КР',
    kpi4_v: '0 сом',
    kpi4_l: 'доступ для всех школ',

    stage_eye: '02 / ЖИВАЯ СТУДИЯ В ДВИЖЕНИИ',
    stage_t: 'Листайте — экраны меняются сами',
    open_module: 'Открыть',

    roles_eye: '03 / ДЛЯ КАЖДОГО В ШКОЛЕ',
    roles_t1: 'Одна платформа —',
    roles_t2: 'четыре роли',

    modules_eye: '04 / ЭКОСИСТЕМА',
    modules_t1: 'Все восемь инструментов',
    modules_t2: 'в одном окне',
    flt_all: 'Все · 8',
    flt_teach: 'Обучение',
    flt_practice: 'Код и SQL',
    flt_games: 'Игры Live',

    cmp_eye: '05 / СРАВНЕНИЕ',
    cmp_t: 'Чем мы отличаемся',
    cmp_sub: 'Честное сравнение EduPlatform с известными платформами по 12 ключевым критериям',
    cmp_feature: 'Возможность',
    cmp_yes: 'Да',
    cmp_part: 'Частично',
    cmp_no: 'Нет',

    cta_eye: 'ГОТОВО К ЗАПУСКУ',
    cta_t1: 'Проведите следующий урок',
    cta_t2: 'в одном окне.',
    cta_sub: 'Без установок, без платных ключей и флешек — на любом школьном ноутбуке, доске или смартфоне.',
    top_btn: 'Наверх',
  },
  en: {
    back_app: 'Platform',
    nav_story: 'Story',
    nav_studio: 'Studio',
    nav_roles: 'For Who',
    nav_modules: 'Modules',
    nav_compare: 'Compare',
    nav_start: 'Start',

    hero_eye: 'LEARNING STUDIO · KYRGYZSTAN · 2026',
    hero_t1: 'A lesson that arrives',
    hero_t2: 'in every phone.',
    hero_sub: 'Interactive lessons with inline PDF HD, Word & Excel, classrooms with gradebooks & QR pay, 2D/3D whiteboard, Python & PostgreSQL, and live team games — inside one effortless browser window.',
    cta_lessons: 'Explore Lessons',
    cta_create: 'Create Lesson',
    cta_games: 'Live Games',
    stat_1: '8+ modules',
    stat_2: 'Free for schools',
    stat_3: 'KG · RU · EN',
    stat_4: 'No API keys',

    photo_cap: 'EduPlatform · Education without borders',
    mission_quote: 'I do not need to build a school in every village. I need the lesson to arrive in every phone by itself.',
    mission_eye: '01 / THE MISSION',
    mission_t1: 'How much does',
    mission_t2: 'one good lesson cost?',
    mission_p1: 'A private tutor costs hundreds of soms per hour. A private school costs thousands every month. For a family in a remote village, the road to the city makes quality education hardest to reach. A child’s future should never depend on zip code.',
    mission_p2: 'In PISA-2025, Kyrgyzstan ranked 80th out of 91 countries, 76% of students scored below the baseline, and schools lack 761 teachers. Building mountain schools takes years — yet nearly every student already carries a phone. That is why we built EduPlatform.',
    kpi1_l: 'rank of 91 · PISA-2025',
    kpi2_l: 'students below basic',
    kpi3_l: 'teacher shortage',
    kpi4_v: '$0',
    kpi4_l: 'open for every school',

    stage_eye: '02 / LIVE STUDIO IN MOTION',
    stage_t: 'Scroll to explore every workspace',
    open_module: 'Open',

    roles_eye: '03 / BUILT FOR EVERY ROLE',
    roles_t1: 'One workspace —',
    roles_t2: 'four perspectives',

    modules_eye: '04 / ECOSYSTEM',
    modules_t1: 'All eight tools',
    modules_t2: 'in one studio',
    flt_all: 'All · 8',
    flt_teach: 'Teaching',
    flt_practice: 'Code & SQL',
    flt_games: 'Live Games',

    cmp_eye: '05 / BENCHMARK',
    cmp_t: 'How we differ',
    cmp_sub: 'Direct 12-point comparison between EduPlatform and global education platforms',
    cmp_feature: 'Capability',
    cmp_yes: 'Yes',
    cmp_part: 'Partial',
    cmp_no: 'No',

    cta_eye: 'READY TO TEACH',
    cta_t1: 'Run your next lesson',
    cta_t2: 'in one window.',
    cta_sub: 'Zero installs, zero paid API keys, zero flash drives — ready on every school laptop, board, or smartphone.',
    top_btn: 'Top',
  },
  kg: {
    back_app: 'Платформага',
    nav_story: 'Тарых',
    nav_studio: 'Студия',
    nav_roles: 'Кимдерге',
    nav_modules: 'Модулдар',
    nav_compare: 'Салыштыруу',
    nav_start: 'Баштоо',

    hero_eye: 'БИЛИМ БЕРҮҮ СТУДИЯСЫ · КЫРГЫЗСТАН · 2026',
    hero_t1: 'Ар бир телефонго өзү келген',
    hero_t2: 'заманбап сабак.',
    hero_sub: 'PDF HD, Word жана Excel окугучу бар сабактар, журнал жана QR-төлөмдүү класстар, 2D/3D доска, Python & PostgreSQL жана жандуу оюндар — бир жеңил браузер терезесинде.',
    cta_lessons: 'Сабактарды ачуу',
    cta_create: 'Сабак түзүү',
    cta_games: 'Жандуу оюндар',
    stat_1: '8+ модуль',
    stat_2: 'Мектептерге 0 сом',
    stat_3: 'KG · RU · EN',
    stat_4: 'API ачкычысыз',

    photo_cap: 'EduPlatform · Чек арасыз билим',
    mission_quote: 'Ар бир кыштакка мектеп курушум керек эмес. Мага сабактын өзү ар бир телефонго келиши керек.',
    mission_eye: '01 / ДОЛБООРДУН МАКСАТЫ',
    mission_t1: 'Бир жакшы сабак',
    mission_t2: 'канча турат?',
    mission_p1: 'Репетитор — бир нече жүз сом. Жеке мектеп — ай сайын миңдеген сом. Ал эми алыскы айылдагы үй-бүлөгө шаарга чейинки жол кошулат. Билим сапаты баланын кайда төрөлгөнүнө көз каранды болбошу керек.',
    mission_p2: 'PISA-2025 боюнча Кыргызстан 91 өлкөнүн ичинен 80-орунда, окуучулардын 76% негизги деңгээлден төмөн, мектептерге 761 мугалим жетишпейт. Тоодо мектеп курууга жылдар кетет, бирок телефон дээрлик ар бир окуучуда бар. Ошондуктан биз EduPlatform түздүк.',
    kpi1_l: 'орун 91 ичинен · PISA-2025',
    kpi2_l: 'негизги деңгээлден төмөн',
    kpi3_l: 'мугалим жетишсиздиги',
    kpi4_v: '0 сом',
    kpi4_l: 'бардык мектептерге ачык',

    stage_eye: '02 / ЖАНДУУ СТУДИЯ КЫЙМЫЛДА',
    stage_t: 'Жылдырыңыз — экрандар өзү алмашат',
    open_module: 'Ачуу',

    roles_eye: '03 / МЕКТЕПТЕГИ БАРДЫК РОЛДОР',
    roles_t1: 'Бир платформа —',
    roles_t2: 'төрт багыт',

    modules_eye: '04 / ЭКОСИСТЕМА',
    modules_t1: 'Бардык сегиз курал',
    modules_t2: 'бир терезеде',
    flt_all: 'Баары · 8',
    flt_teach: 'Окутуу',
    flt_practice: 'Код & SQL',
    flt_games: 'Жандуу оюндар',

    cmp_eye: '05 / САЛЫШТЫРУУ',
    cmp_t: 'Эмнеси менен айырмаланабыз',
    cmp_sub: 'EduPlatform платформасын дүйнөлүк аналогдор менен 12 критерий боюнча түз салыштыруу',
    cmp_feature: 'Мүмкүнчүлүк',
    cmp_yes: 'Ооба',
    cmp_part: 'Жарым-жартылай',
    cmp_no: 'Жок',

    cta_eye: 'ИШТӨӨГӨ ДАЯР',
    cta_t1: 'Кийинки сабакты',
    cta_t2: 'бир терезеде өткөрүңүз.',
    cta_sub: 'Орнотуусуз, акылуу ачкычсыз жана флешкасыз — каалаган ноутбукта, доскада же телефондо.',
    top_btn: 'Жогору',
  },
}

const MARQUEE_ITEMS = [
  'PDF HD · DOCX · EXCEL',
  'ДОСКА 2D / 3D',
  'POSTGRESQL 18 · 9 MS',
  'ШКОЛЬНАЯ МАФИЯ LIVE',
  'АРКАН ТАРТЫШ',
  'КЛАССЫ И QR-ОПЛАТА',
  'АНТИ-СКРИНШОТ ТЕСТОВ',
  'VS CODE IDE',
  'KG · RU · EN',
]

const ROLES_DATA: {
  num: string
  id: string
  to: string
  photo: string
  label: Record<LangKey, string>
  title: Record<LangKey, string>
  desc: Record<LangKey, string>
  bullets: Record<LangKey, string[]>
}[] = [
    {
      num: '01',
      id: 'teacher',
      to: '/lessons/new',
      photo: '/about/lessons_live.webp',
      label: { ru: 'Учителю', en: 'Teachers', kg: 'Мугалимге' },
      title: { ru: 'Урок готов за 2 минуты, а не за вечер', en: 'Rich lessons ready in 2 minutes', kg: 'Сабак кечке эмес, 2 мүнөттө даяр' },
      desc: {
        ru: 'Собирайте уроки из блоков, загружайте PDF, Word, Excel и презентации, автоматически создавайте тесты и ведите журнал с QR-оплатой.',
        en: 'Assemble modular lessons, attach PDF, Word, Excel & slides, auto-build quizzes and run gradebooks with QR pay.',
        kg: 'Даяр блоктордон сабак чогултуңуз, PDF, Word, Excel жүктөңүз, тесттерди автоматтык түзүп, классты башкарыңыз.',
      },
      bullets: {
        ru: ['Просмотр всех страниц PDF HD, Word и Excel без скачивания', 'Автопроверка тестов, водяной знак и защита от скриншотов', 'Журнал, посещаемость, расписание и платные курсы с QR банка'],
        en: ['Inline multi-page PDF HD, Word & Excel readers', 'Auto-graded proctored tests with screenshot shield', 'Gradebook, attendance, timetable & bank QR courses'],
        kg: ['PDF HD, Word жана Excel файлдарын түз көрүү', 'Тесттерди авто-текшерүү жана скриншоттон коргоо', 'Журнал, катышуу, жадыбал жана банк QR акылуу курстар'],
      },
    },
    {
      num: '02',
      id: 'student',
      to: '/games',
      photo: '/about/games_live.webp',
      label: { ru: 'Ученику', en: 'Students', kg: 'Окуучуга' },
      title: { ru: 'Учёба, код и командные игры со смартфона', en: 'Lessons, code & live games on any phone', kg: 'Сабак, код жана оюндар түз телефондо' },
      desc: {
        ru: 'Все конспекты, файлы, тренажёры Python/SQL и живые командные игры с одноклассниками открываются по одной ссылке.',
        en: 'Every lesson, file reader, Python/SQL lab and classroom game opens instantly in any mobile or desktop browser.',
        kg: 'Бардык конспект, файлдар, Python/SQL практикасы жана жандуу оюндар бир шилтеме менен дароо ачылат.',
      },
      bullets: {
        ru: ['Школьная Мафия Live по PIN/QR, Аркан тартыш, Блокада и Квиз', 'VS Code IDE (Python, JS, HTML) и реальный PostgreSQL 18', 'Уроки, домашки, оценки и портфолио достижений в одном окне'],
        en: ['School Mafia Live (PIN/QR), Tug of War, Blocade & Quizzes', 'VS Code IDE (Python, JS, HTML) & real PostgreSQL 18', 'Lessons, homework, grades & achievement portfolio'],
        kg: ['Мектеп Мафиясы Live, Аркан тартыш, Блокада жана Квиз', 'VS Code IDE (Python, JS, HTML) жана PostgreSQL 18', 'Сабактар, үй тапшырмалар, баалар жана портфолио'],
      },
    },
    {
      num: '03',
      id: 'parent',
      to: '/classes',
      photo: '/about/classes_live.webp',
      label: { ru: 'Родителю', en: 'Parents', kg: 'Ата-энеге' },
      title: { ru: 'Прозрачный дневник в реальном времени', en: 'Transparent progress in real time', kg: 'Реалдуу убакыттагы ачык күндөлүк' },
      desc: {
        ru: 'Текущие оценки, средний балл, посещаемость и сданные задания ребёнка видны сразу после каждого урока.',
        en: 'Grades, averages, attendance history and submitted assignments appear immediately after class.',
        kg: 'Баланын учурдагы баалары, орточо баллы, катышуусу жана тапшырмалары сабактан кийин дароо көрүнөт.',
      },
      bullets: {
        ru: ['Журнал оценок, средний балл и динамика по каждому предмету', 'История посещаемости и контроль сроков сдачи заданий', 'Прозрачная оплата дополнительных курсов по QR банка'],
        en: ['Live gradebook, averages and clear subject trends', 'Attendance log and homework deadline visibility', 'Direct bank QR payment for extra courses'],
        kg: ['Ар бир предмет боюнча баалар журналы жана орточо балл', 'Сабакка катышуу тарыхы жана мөөнөттөрдү көзөмөлдөө', 'Кошумча курстар үчүн банк QR аркылуу ачык төлөм'],
      },
    },
    {
      num: '04',
      id: 'school',
      to: '/programs',
      photo: '/about/hero_study.webp',
      label: { ru: 'Школе', en: 'Schools', kg: 'Мектепке' },
      title: { ru: 'Цифровая школа без бюджета на лицензии', en: 'A digital school with $0 license cost', kg: 'Лицензияга чыгымсыз санарип мектеп' },
      desc: {
        ru: 'Запускается на обычных школьных компьютерах, интерактивных досках и смартфонах без закупки платного ПО.',
        en: 'Runs smoothly on existing school laptops, interactive boards and phones with zero software licensing fees.',
        kg: 'Кадимки мектеп компьютерлеринде, интерактивдүү доскаларда жана телефондордо акысыз иштейт.',
      },
      bullets: {
        ru: ['Учебные программы по государственному стандарту КР', 'Массовый перенос классов и учеников через CSV за минуты', 'Кыргызский, русский и английский + режим для слабовидящих'],
        en: ['National curriculum templates ready out of the box', 'Bulk CSV roster import in minutes', 'Kyrgyz, Russian & English + dedicated accessibility mode'],
        kg: ['КР мамлекеттик стандарты боюнча даяр программалар', 'CSV аркылуу класстарды бир нече мүнөттө жүктөө', 'Кыргыз, орус, англис тилдери + начар көргөндөр режими'],
      },
    },
  ]

type ModuleItem = {
  id: string
  cat: Exclude<CatalogFilter, 'all'>
  featured?: boolean
  to: string
  photo: string
  icon: any
  title: Record<LangKey, string>
  desc: Record<LangKey, string>
  chips: string[]
}

const MODULES: ModuleItem[] = [
  {
    id: 'lessons', cat: 'teach', featured: true, to: '/lessons/new', photo: '/about/lessons_live.webp', icon: BookOpen,
    title: { ru: 'Конструктор уроков и файлы', en: 'Modular Lesson Builder', kg: 'Сабак конструктору' },
    desc: {
      ru: 'Теория, видео, задания и полноценное чтение всех страниц PDF HD, Word (.docx), многолистового Excel, TXT и фото прямо внутри урока.',
      en: 'Theory, video, tasks and full inline multi-page PDF HD, Word (.docx), multi-sheet Excel, TXT and image readers inside one lesson.',
      kg: 'Теория, видео, тапшырмалар жана PDF HD бардык беттери, Word, Excel, TXT, сүрөттөр түз сабак ичинде.',
    },
    chips: ['PDF HD', 'DOCX', 'Excel', 'Фото'],
  },
  {
    id: 'board', cat: 'teach', featured: true, to: '/board', photo: '/about/board_live.webp', icon: PenTool,
    title: { ru: 'Интерактивная доска 2D / 3D', en: 'Interactive 2D / 3D Board', kg: 'Интерактивдүү 2D / 3D доска' },
    desc: {
      ru: 'Живые графики функций y = f(x) с предпросмотром, оси координат, меловая и клетчатая доска, 3D-стереометрия и настраиваемый карандаш.',
      en: 'Live y = f(x) function graphs with preview, coordinate axes, chalkboard & grid canvas, 3D solids and adjustable pen.',
      kg: 'Жандуу y = f(x) графиктери, координат огу, бор доскасы, 3D фигуралар жана жөнгө салынуучу калем.',
    },
    chips: ['y = f(x)', '3D-фигуры', 'PNG'],
  },
  {
    id: 'classes', cat: 'teach', to: '/classes', photo: '/about/classes_live.webp', icon: GraduationCap,
    title: { ru: 'Классы, журнал и QR', en: 'Classrooms & QR Courses', kg: 'Класстар & QR' },
    desc: {
      ru: 'Лента класса, задания, журнал оценок, посещаемость, расписание и платные курсы с проверкой чеков по QR.',
      en: 'Class stream, assignments, gradebook, attendance, timetable and paid courses with bank QR checks.',
      kg: 'Класс лентасы, тапшырмалар, баа журналы, катышуу, жадыбал жана банк QR акылуу курстар.',
    },
    chips: ['Журнал', 'QR Мбанк', 'CSV'],
  },
  {
    id: 'tests', cat: 'teach', to: '/tests', photo: '/about/tests_live.webp', icon: FlaskConical,
    title: { ru: 'Тесты и анти-скриншот', en: 'Proctored Tests', kg: 'Корголгон тесттер' },
    desc: {
      ru: 'Автопроверка, ИИ- и офлайн-генератор вопросов, персональный водяной знак и защита от скриншотов.',
      en: 'Auto-grading, AI/offline quiz generator, personal watermarks and hardened screenshot guard.',
      kg: 'Авто-текшерүү, ЖИ/офлайн генератор, суу белгиси жана скриншоттон коргоо.',
    },
    chips: ['Анти-скриншот', 'Автопроверка', 'Live'],
  },
  {
    id: 'presentations', cat: 'teach', to: '/presentations', photo: '/about/presentations_live.webp', icon: Presentation,
    title: { ru: 'Студия презентаций', en: 'Presentations Studio', kg: 'Презентациялар' },
    desc: {
      ru: 'Онлайн-редактор слайдов с анимациями и автоматический импорт PowerPoint (.pptx) и PDF прямо в урок.',
      en: 'Slide studio with transitions plus automatic PowerPoint (.pptx) and PDF import.',
      kg: 'Анимациялуу слайд редактору жана PowerPoint (.pptx), PDF файлдарын түз жүктөө.',
    },
    chips: ['PPTX', 'Слайд-шоу', 'PDF'],
  },
  {
    id: 'editor', cat: 'practice', to: '/editor', photo: '/about/editor_live.webp', icon: Code2,
    title: { ru: 'Редактор кода IDE', en: 'Browser Code IDE', kg: 'Код редактору IDE' },
    desc: {
      ru: 'Редактор в стиле VS Code с запуском Python, JavaScript и живым превью HTML/CSS прямо в браузере.',
      en: 'VS Code-style editor running Python, JavaScript and live HTML/CSS previews in browser.',
      kg: 'Python, JavaScript жана жандуу HTML/CSS-превью иштетүүчү VS Code редактору.',
    },
    chips: ['Python', 'JS', 'HTML/CSS'],
  },
  {
    id: 'sql', cat: 'practice', to: '/sql', photo: '/about/sql_live.webp', icon: Database,
    title: { ru: 'База PostgreSQL 18', en: 'PostgreSQL 18 Lab', kg: 'PostgreSQL 18 Базасы' },
    desc: {
      ru: 'Реальный PostgreSQL в отдельном Web Worker без фризов, ER-схема таблиц и задачи с автопроверкой.',
      en: 'Real PostgreSQL in a dedicated Web Worker, ER diagrams and auto-graded SQL exercises.',
      kg: 'Web Worker ичиндеги PostgreSQL 18, ER-схема жана авто-текшерүү.',
    },
    chips: ['PostgreSQL 18', 'ER-схема', '9 мс'],
  },
  {
    id: 'games', cat: 'games', to: '/games', photo: '/about/games_live.webp', icon: Gamepad2,
    title: { ru: 'Игры-тренажёры Live', en: 'Live Classroom Games', kg: 'Жандуу оюндар' },
    desc: {
      ru: 'Школьная Мафия Live по PIN/QR, Аркан тартыш, Блокада, Биллим-Квиз, Фермер-Бала 3D и Филворд.',
      en: 'School Mafia Live (PIN/QR), Tug of War, Blocade, PIN Quiz, 3D Farm and Word Search.',
      kg: 'Мектеп Мафиясы Live, Аркан тартыш, Блокада, PIN-квиз, Фермер 3D жана Сөз издөө.',
    },
    chips: ['Мафия Live', 'Аркан', 'PIN'],
  },
]

const ROWS_BY_LANG: Record<LangKey, { name: string; vals: number[] }[]> = {
  ru: [
    { name: 'Тесты как в Google Forms (конструктор, автопроверка)', vals: [2, 0, 0, 1] },
    { name: 'Работает без API-ключей (офлайн-генератор)', vals: [2, 2, 2, 0] },
    { name: 'Доска 2D/3D с графиками функций и стереометрией', vals: [2, 0, 0, 0] },
    { name: 'Редактор кода (Python/JS/HTML) + база PostgreSQL 18', vals: [2, 0, 0, 0] },
    { name: 'Кыргызский, русский и английский языки из коробки', vals: [2, 0, 0, 1] },
    { name: 'Игры-тренажёры (Мафия Live, Аркан тартыш, Фермер 3D)', vals: [2, 0, 2, 0] },
    { name: 'Защита тестов от скриншотов и копирования', vals: [2, 0, 0, 0] },
    { name: 'Всё в одном окне (урок + PDF HD / Word / Excel + слайды)', vals: [2, 1, 0, 1] },
    { name: 'Журнал, посещаемость, расписание и платные курсы с QR', vals: [2, 2, 0, 1] },
    { name: 'Работает на телефоне и интерактивной доске', vals: [2, 2, 2, 1] },
    { name: 'Мгновенный запуск без установок и сложных настроек', vals: [2, 0, 0, 0] },
    { name: 'Лёгкая нагрузка для старых школьных ноутбуков', vals: [2, 1, 2, 0] },
  ],
  en: [
    { name: 'Google Forms-style quizzes (builder & auto-grading)', vals: [2, 0, 0, 1] },
    { name: 'Works without API keys (offline generator)', vals: [2, 2, 2, 0] },
    { name: '2D/3D whiteboard with live function graphs & solids', vals: [2, 0, 0, 0] },
    { name: 'Code editor (Python/JS/HTML) + real PostgreSQL 18 lab', vals: [2, 0, 0, 0] },
    { name: 'Kyrgyz, Russian & English interface out of the box', vals: [2, 0, 0, 1] },
    { name: 'Live classroom games (Mafia Live, Tug of War, 3D Farm)', vals: [2, 0, 2, 0] },
    { name: 'Anti-screenshot & proctoring test protection', vals: [2, 0, 0, 0] },
    { name: 'All in one window (lesson + PDF HD / Word / Excel + slides)', vals: [2, 1, 0, 1] },
    { name: 'Gradebook, attendance, timetable & QR paid courses', vals: [2, 2, 0, 1] },
    { name: 'Works on smartphones and interactive whiteboards', vals: [2, 2, 2, 1] },
    { name: 'Instant start without installations or setup', vals: [2, 0, 0, 0] },
    { name: 'Lightweight for older school laptops', vals: [2, 1, 2, 0] },
  ],
  kg: [
    { name: 'Google Forms сыяктуу тесттер (конструктор, авто-текшерүү)', vals: [2, 0, 0, 1] },
    { name: 'API ачкычысыз иштейт (офлайн генератор)', vals: [2, 2, 2, 0] },
    { name: 'Графиктер жана стереометриясы бар 2D/3D доска', vals: [2, 0, 0, 0] },
    { name: 'Код редактору (Python/JS/HTML) + PostgreSQL 18 базасы', vals: [2, 0, 0, 0] },
    { name: 'Кыргыз, орус жана англис тилдери даяр', vals: [2, 0, 0, 1] },
    { name: 'Окуу оюндары (Мафия Live, Аркан тартыш, Фермер 3D)', vals: [2, 0, 2, 0] },
    { name: 'Тесттерди скриншоттон жана көчүрүүдөн коргоо', vals: [2, 0, 0, 0] },
    { name: 'Баары бир терезеде (сабак + PDF HD / Word / Excel + слайд)', vals: [2, 1, 0, 1] },
    { name: 'Журнал, катышуу, жадыбал жана QR акылуу курстар', vals: [2, 2, 0, 1] },
    { name: 'Телефондо жана интерактивдүү доскада иштейт', vals: [2, 2, 2, 1] },
    { name: 'Орнотуусуз дароо браузерде башталат', vals: [2, 0, 0, 0] },
    { name: 'Эски мектеп ноутбуктарында жеңил иштейт', vals: [2, 1, 2, 0] },
  ],
}

export default function About() {
  const { lang, setLang, t } = useLang()
  const { theme, toggle: toggleTheme } = useTheme()
  const dark = theme === 'dark'
  const lk: LangKey = lang === 'en' || lang === 'kg' ? lang : 'ru'
  const L = DICT[lk]
  const ROWS = ROWS_BY_LANG[lk]
  const isSignedIn = Boolean(typeof window !== 'undefined' && localStorage.getItem('token'))
  const appHome = isSignedIn ? (getRole() === 'parent' ? '/children' : '/dashboard') : '/login'
  const loginLabel = lk === 'en' ? 'Sign in' : lk === 'kg' ? 'Кирүү' : 'Войти'
  const cycleLang = () => setLang(lk === 'ru' ? 'kg' : lk === 'kg' ? 'en' : 'ru')

  const [roleIdx, setRoleIdx] = useState(0)
  const [filter, setFilter] = useState<CatalogFilter>('all')

  const activeRole = ROLES_DATA[roleIdx] || ROLES_DATA[0]
  const visibleModules = filter === 'all' ? MODULES : MODULES.filter(m => m.cat === filter)

  const cinemaChapters: CinemaChapter[] = [
    {
      id: 'board',
      num: '01',
      to: '/board',
      routeText: 'eduplatform.kg/board',
      photo: '/about/board_live.webp',
      tag: 'WHITEBOARD 2D / 3D',
      title: lk === 'en' ? '2D / 3D Board & Graphs' : 'Доска 2D / 3D и графики',
      desc:
        lk === 'en'
          ? 'Plot y = f(x) functions with instant live preview, coordinate axes, chalkboard mode and 3D geometry solids.'
          : lk === 'kg'
            ? 'Жандуу y = f(x) функция графиктери, координат огу, бор доскасы жана 3D фигуралар.'
            : 'Живые графики функций y = f(x) с мгновенным предпросмотром, оси координат, мел и 3D-стереометрия.',
      chips: ['y = x² − 3', '3D', 'PNG'],
    },
    {
      id: 'code',
      num: '02',
      to: '/sql',
      routeText: 'eduplatform.kg/sql',
      photo: '/about/sql_live.webp',
      tag: 'POSTGRESQL 18 · WORKER',
      title: lk === 'en' ? 'PostgreSQL 18 Lab' : lk === 'kg' ? 'PostgreSQL 18 Базасы' : 'База PostgreSQL 18',
      desc:
        lk === 'en'
          ? 'Real PostgreSQL 18 running inside a dedicated Web Worker with zero UI freeze, ER diagrams and auto-grading.'
          : lk === 'kg'
            ? 'Web Worker ичиндеги PostgreSQL 18, ER-схема жана тапшырмаларды авто-текшерүү.'
            : 'Настоящий PostgreSQL 18 в отдельном Web Worker без подвисаний, ER-схема таблиц и задачи с автопроверкой.',
      chips: ['9 ms', 'Web Worker', 'ER-схема'],
    },
    {
      id: 'games',
      num: '03',
      to: '/games',
      routeText: 'eduplatform.kg/games',
      photo: '/about/games_live.webp',
      tag: 'MULTIPLAYER · PIN & QR',
      title: lk === 'en' ? 'Live Classroom Games' : lk === 'kg' ? 'Жандуу окуу оюндары' : 'Игры-тренажёры Live',
      desc:
        lk === 'en'
          ? 'School Mafia Live with role distribution under teacher control, Tug of War, Blocade, PIN Quiz and 3D Farm.'
          : lk === 'kg'
            ? 'Мугалимдин көзөмөлүндөгү Мектеп Мафиясы Live, Аркан тартыш, Блокада жана PIN-квиз.'
            : 'Школьная Мафия Live с ролями под контролем учителя, Аркан тартыш, Блокада, Квиз по PIN и Фермер 3D.',
      chips: ['Мафия Live', 'Аркан тартыш', 'PIN'],
    },
    {
      id: 'classes',
      num: '04',
      to: '/classes',
      routeText: 'eduplatform.kg/classes',
      photo: '/about/classes_live.webp',
      tag: 'CLASSROOM & QR PAY',
      title: lk === 'en' ? 'Classes, Gradebook & QR' : lk === 'kg' ? 'Класстар, журнал & QR' : 'Классы, журнал и QR',
      desc:
        lk === 'en'
          ? 'Assignments, attendance, timetable, live gradebook and paid courses with direct bank QR verification.'
          : lk === 'kg'
            ? 'Тапшырмалар, катышуу, жадыбал, баа журналы жана банк QR акылуу курстар.'
            : 'Задания с дедлайнами, журнал оценок, посещаемость, расписание и платные курсы с проверкой оплаты по QR.',
      chips: ['Журнал', 'QR Мбанк', 'CSV'],
    },
    {
      id: 'lessons',
      num: '05',
      to: '/lessons/new',
      routeText: 'eduplatform.kg/lessons/new',
      photo: '/about/lessons_live.webp',
      tag: 'PDF HD · DOCX · XLSX',
      title: lk === 'en' ? 'Lessons & Inline Files' : lk === 'kg' ? 'Сабактар жана файлдар' : 'Конструктор уроков',
      desc: {
        ru: 'Все страницы PDF (включая HD PyMuPDF), Word, многолистовой Excel, TXT и фото читаются прямо внутри урока.',
        en: 'All PDF pages (including HD PyMuPDF), Word, multi-sheet Excel, TXT and photos render natively inline.',
        kg: 'PDF бардык беттери (HD PyMuPDF), Word, Excel, TXT жана сүрөттөр түз сабак ичинде ачылат.',
      }[lk],
      chips: ['PDF HD', 'DOCX', 'Excel'],
    },
  ]

  const scrollToId = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const mark = (v: number) =>
    v === 2 ? (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
        <Check size={15} strokeWidth={2.75} />
      </span>
    ) : v === 1 ? (
      <span
        className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400"
        title={L.cmp_part}
      >
        <Minus size={14} strokeWidth={2.5} />
      </span>
    ) : (
      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-200/80 dark:bg-white/5 text-slate-400 dark:text-slate-600">
        <X size={14} strokeWidth={2} />
      </span>
    )

  return (
    <div
      className="min-h-screen bg-[#F7F5F0] dark:bg-[#07090F] text-[#0E1117] dark:text-[#F4F6FB] selection:bg-blue-600 selection:text-white overflow-x-clip"
      data-testid="about-page"
    >
      <FlagshipMotionStyles />
      <ScrollProgressBar />

      {/* ==================== ПЛАВАЮЩАЯ ПОЛНОЭКРАННАЯ НАВИГАЦИЯ ==================== */}
      <header className="fixed top-3 sm:top-4 inset-x-3 sm:inset-x-4 z-50 pointer-events-none">
        <div className="max-w-7xl mx-auto pointer-events-auto flex items-center justify-between gap-2 sm:gap-3 px-2.5 sm:px-4 py-2 rounded-full bg-white/85 dark:bg-[#0D111C]/85 backdrop-blur-xl border border-black/[0.08] dark:border-white/[0.12] shadow-lg shadow-black/[0.04] dark:shadow-black/30">
          <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
            {isSignedIn && (
              <Link
                to={appHome}
                className="h-9 px-2.5 sm:px-3 rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.14] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0"
              >
                <ArrowLeft size={14} />
                <span className="hidden sm:inline">{L.back_app}</span>
              </Link>
            )}
            <Link to="/" className="inline-flex items-center gap-2 pl-1 pr-1 min-w-0">
              <img
                src="/logo.svg"
                alt="EduPlatform"
                data-testid="about-hero-logo"
                className="w-6 h-6 object-contain shrink-0"
              />
              <span className="font-display font-extrabold text-sm tracking-tight truncate">EduPlatform</span>
            </Link>
          </div>

          <nav className="hidden lg:flex items-center gap-1">
            {[
              ['sec-story', L.nav_story],
              ['sec-stage', L.nav_studio],
              ['sec-roles', L.nav_roles],
              ['sec-modules', L.nav_modules],
              ['sec-compare', L.nav_compare],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollToId(id)}
                className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white hover:bg-black/[0.05] dark:hover:bg-white/[0.08] transition-colors"
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={cycleLang}
              aria-label="Language"
              className="sm:hidden h-9 px-2.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08] text-[11px] font-bold uppercase"
            >
              {lk}
            </button>
            <div className="hidden sm:inline-flex items-center p-0.5 rounded-full bg-black/[0.05] dark:bg-white/[0.08]">
              {(['ru', 'kg', 'en'] as const).map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLang(code)}
                  className={`px-2 py-1 rounded-full text-[10.5px] font-bold uppercase transition-colors ${lk === code
                    ? 'bg-white dark:bg-slate-800 text-slate-950 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                >
                  {code}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="w-9 h-9 rounded-full bg-black/[0.05] dark:bg-white/[0.08] hover:bg-black/[0.1] dark:hover:bg-white/[0.15] inline-flex items-center justify-center transition-colors"
            >
              {dark ? <Sun size={15} className="text-amber-300" /> : <Moon size={15} className="text-slate-700" />}
            </button>

            <Link
              to={isSignedIn ? appHome : '/login'}
              className="h-9 px-3.5 sm:px-4 rounded-full bg-[#0E1117] dark:bg-white text-white dark:text-[#0E1117] hover:bg-blue-600 dark:hover:bg-sky-300 text-xs font-bold inline-flex items-center gap-1 transition-colors"
            >
              <span>{isSignedIn ? L.nav_start : loginLabel}</span>
              <ArrowUpRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ==================== ACT I: FULLSCREEN 100VH HERO С ЖИВОЙ 3D WEBGL-СКУЛЬПТУРОЙ ==================== */}
      <section className="relative min-h-screen flex flex-col justify-between pt-20 sm:pt-28 overflow-hidden">
        {/* Мягкий студийный свет на фоне */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-20 right-[-8%] w-[680px] h-[680px] rounded-full blur-3xl opacity-55 dark:opacity-35 edu-soft-glow"
          style={{
            background: dark
              ? 'radial-gradient(circle, rgba(37,99,235,0.45) 0%, rgba(251,146,60,0.18) 50%, transparent 72%)'
              : 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, rgba(251,146,60,0.14) 48%, transparent 72%)',
          }}
        />

        <div className="relative z-10 max-w-7xl mx-auto w-full px-5 sm:px-10 my-auto py-5 sm:py-12 grid lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-6 items-center">
          {/* Левая редакционная типографика (7 колонок) */}
          <div className="lg:col-span-7 space-y-5 sm:space-y-7">
            <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-white/80 dark:bg-white/[0.06] border border-black/[0.08] dark:border-white/[0.12] backdrop-blur-md max-w-full">
              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-sky-400 animate-pulse shrink-0" />
              <span className="font-mono text-[9.5px] sm:text-[11px] font-semibold tracking-[0.06em] sm:tracking-[0.14em] text-slate-700 dark:text-sky-200 truncate">
                {L.hero_eye}
              </span>
            </div>

            <h1 className="font-display font-extrabold text-[clamp(2.45rem,5.7vw,5.15rem)] leading-[1.03] tracking-[-0.035em] text-[#0E1117] dark:text-white">
              {L.hero_t1}{' '}
              <span className="block font-editorial italic font-semibold text-[1.12em] leading-[1.04] bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 dark:from-sky-300 dark:via-blue-400 dark:to-amber-300 bg-clip-text text-transparent">
                {L.hero_t2}
              </span>
            </h1>

            <p className="text-[15px] sm:text-lg text-slate-600 dark:text-slate-300/90 leading-relaxed max-w-xl">
              {L.hero_sub}
            </p>

            <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-1">
              <Link
                to="/lessons"
                className="h-12 sm:h-13 px-6 sm:px-7 py-3 sm:py-3.5 rounded-full bg-[#0E1117] dark:bg-white text-white dark:text-[#0E1117] hover:bg-blue-600 dark:hover:bg-sky-300 font-bold text-sm shadow-xl shadow-black/10 dark:shadow-sky-500/10 inline-flex items-center gap-2.5 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                {L.cta_lessons} <ArrowRight size={16} />
              </Link>
              <Link
                to="/lessons/new"
                className="h-12 sm:h-13 px-5 sm:px-6 py-3 sm:py-3.5 rounded-full bg-white/85 dark:bg-white/[0.07] hover:bg-white dark:hover:bg-white/[0.14] text-slate-900 dark:text-white border border-black/10 dark:border-white/15 font-semibold text-sm inline-flex items-center gap-2 transition-all hover:-translate-y-0.5"
              >
                <Sparkles size={15} className="text-blue-600 dark:text-sky-400" />
                {L.cta_create}
              </Link>
              <Link
                to="/games"
                className="px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-full text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-sky-300 font-semibold text-sm inline-flex items-center gap-1.5 transition-colors"
              >
                <Gamepad2 size={16} />
                {L.cta_games}
              </Link>
            </div>

            <div className="flex flex-wrap items-center gap-2 sm:gap-x-5 sm:gap-y-2 pt-3 border-t border-black/[0.08] dark:border-white/[0.1] text-[11px] sm:text-xs font-mono text-slate-500 dark:text-slate-400">
              {[L.stat_1, L.stat_2, L.stat_3, L.stat_4].map((st, idx) => (
                <span key={idx} className="inline-flex items-center gap-3 sm:gap-5">
                  {idx > 0 && <span aria-hidden="true" className="hidden sm:inline opacity-50">·</span>}
                  <span className="px-2.5 py-0.5 sm:p-0 rounded-full sm:rounded-none bg-black/[0.04] sm:bg-transparent dark:bg-white/[0.06] sm:dark:bg-transparent">
                    {st}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Правая живая 3D WebGL-скульптура Three.js (5 колонок) */}
          <div className="lg:col-span-5 relative h-[280px] sm:h-[440px] lg:h-[560px]">
            <ThreeHeroSculpture dark={dark} />
          </div>
        </div>

        {/* Бесконечная кинематографическая лента Marquee по нижнему краю 100vh Hero */}
        <div className="relative z-10 border-y border-black/[0.08] dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.03] backdrop-blur-md py-3.5 overflow-hidden">
          <div className="edu-marquee-track items-center gap-8 font-mono text-xs font-semibold tracking-[0.16em] text-slate-600 dark:text-slate-300">
            {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-8 whitespace-nowrap">
                <span>{item}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-sky-400" />
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== ACT II: РАСКРЫВАЮЩЕЕСЯ ПРИ СКРОЛЛЕ ФОТО + ИСТОРИЯ PISA-2025 ==================== */}
      <section id="sec-story" className="py-20 sm:py-28 px-5 sm:px-10">
        <div className="max-w-7xl mx-auto space-y-16 sm:space-y-20">
          {/* Панорамный кадр Тянь-Шаня, физически расширяющийся при прокрутке */}
          <ScrollExpandPhoto
            src="/about/mission_mountain.webp"
            alt={L.mission_t1}
            caption={L.photo_cap}
            quote={L.mission_quote}
          />

          {/* Журнальный разворот: история слева, скульптурные цифры справа */}
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <RevealEditorial className="lg:col-span-6 space-y-5">
              <div className="font-mono text-xs tracking-[0.18em] text-blue-600 dark:text-sky-400 font-semibold">
                {L.mission_eye}
              </div>
              <h2 className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.035em] leading-[1.06]">
                {L.mission_t1}{' '}
                <span className="font-editorial italic font-semibold text-blue-600 dark:text-sky-400">
                  {L.mission_t2}
                </span>
              </h2>
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">{L.mission_p1}</p>
              <p className="text-base text-slate-600 dark:text-slate-400 leading-relaxed">{L.mission_p2}</p>
            </RevealEditorial>

            <RevealEditorial delay={120} className="lg:col-span-6 grid grid-cols-2 border-t border-black/15 dark:border-white/15">
              <div className="py-7 pr-6 border-b border-r border-black/10 dark:border-white/10">
                <div className="font-display font-extrabold text-4xl sm:text-6xl tracking-tight">
                  <AnimatedMetric target={80} />
                </div>
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2">{L.kpi1_l}</div>
              </div>
              <div className="py-7 pl-6 border-b border-black/10 dark:border-white/10">
                <div className="font-display font-extrabold text-4xl sm:text-6xl tracking-tight">
                  <AnimatedMetric target={76} suffix="%" />
                </div>
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2">{L.kpi2_l}</div>
              </div>
              <div className="py-7 pr-6 border-r border-black/10 dark:border-white/10">
                <div className="font-display font-extrabold text-4xl sm:text-6xl tracking-tight">
                  <AnimatedMetric target={761} />
                </div>
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2">{L.kpi3_l}</div>
              </div>
              <div className="py-7 pl-6">
                <div className="font-display font-extrabold text-4xl sm:text-6xl tracking-tight text-blue-600 dark:text-sky-400">
                  {L.kpi4_v}
                </div>
                <div className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-2">{L.kpi4_l}</div>
              </div>
            </RevealEditorial>
          </div>
        </div>
      </section>

      {/* ==================== ACT III: STICKY SCROLL-SCRUBBED КИНОСЦЕНА ЖИВЫХ МОДУЛЕЙ ==================== */}
      <StickyCinemaStage
        eyebrow={L.stage_eye}
        heading={L.stage_t}
        chapters={cinemaChapters}
        openLabel={L.open_module}
      />

      {/* ==================== ACT IV: РЕДАКЦИОННЫЙ ИНДЕКС РОЛЕЙ (01..04) ==================== */}
      <section id="sec-roles" className="py-20 sm:py-28 px-5 sm:px-10">
        <div className="max-w-7xl mx-auto space-y-12">
          <RevealEditorial className="space-y-3 max-w-2xl">
            <div className="font-mono text-xs tracking-[0.18em] text-blue-600 dark:text-sky-400 font-semibold">
              {L.roles_eye}
            </div>
            <h2 className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.035em] leading-[1.06]">
              {L.roles_t1}{' '}
              <span className="font-editorial italic font-semibold text-blue-600 dark:text-sky-400">{L.roles_t2}</span>
            </h2>
          </RevealEditorial>

          <div className="grid lg:grid-cols-12 gap-10 items-start">
            {/* Левый крупный нумерованный список 01..04 */}
            <div className="lg:col-span-5 border-t border-black/15 dark:border-white/15 divide-y divide-black/10 dark:divide-white/10">
              {ROLES_DATA.map((r, i) => {
                const isCur = i === roleIdx
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRoleIdx(i)}
                    onMouseEnter={() => setRoleIdx(i)}
                    className={`w-full text-left py-5 px-2 transition-all flex items-baseline justify-between gap-4 group ${isCur ? 'opacity-100' : 'opacity-45 hover:opacity-85'
                      }`}
                  >
                    <div className="flex items-baseline gap-4">
                      <span className={`font-mono text-xs ${isCur ? 'text-blue-600 dark:text-sky-400 font-bold' : ''}`}>
                        {r.num}
                      </span>
                      <span className="font-display font-extrabold text-2xl sm:text-3xl tracking-tight">
                        {r.label[lk]}
                      </span>
                    </div>
                    <ArrowRight
                      size={18}
                      className={`transition-transform ${isCur ? 'translate-x-0 text-blue-600 dark:text-sky-400' : '-translate-x-2 opacity-0 group-hover:opacity-60'}`}
                    />
                  </button>
                )
              })}
            </div>

            {/* Правый сменяемый шоукейс активной роли */}
            <div
              key={activeRole.id}
              className="lg:col-span-7 edu-fade-rise rounded-3xl bg-white dark:bg-[#0D111C] border border-black/[0.08] dark:border-white/[0.1] shadow-xl p-6 sm:p-8 space-y-6"
            >
              <div className="rounded-2xl overflow-hidden bg-slate-950 border border-black/10 dark:border-white/10 aspect-[16/10]">
                <img
                  src={activeRole.photo}
                  alt={activeRole.title[lk]}
                  loading="lazy"
                  className="w-full h-full object-cover object-top edu-clip-wipe"
                />
              </div>

              <div className="space-y-4">
                <h3 className="font-display font-bold text-2xl sm:text-3xl tracking-tight">{activeRole.title[lk]}</h3>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                  {activeRole.desc[lk]}
                </p>
                <ul className="space-y-2.5 pt-1">
                  {activeRole.bullets[lk].map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-200">
                      <span className="mt-0.5 w-5 h-5 rounded-full bg-blue-600/12 dark:bg-sky-400/15 text-blue-600 dark:text-sky-400 inline-flex items-center justify-center shrink-0">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <div className="pt-2">
                  <Link
                    to={activeRole.to}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0E1117] dark:bg-white text-white dark:text-[#0E1117] hover:bg-blue-600 dark:hover:bg-sky-300 text-xs font-bold uppercase tracking-wider transition-colors"
                  >
                    {L.open_module} <ArrowUpRight size={14} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== ACT V: МОЗАИКА ВСЕХ 8 МОДУЛЕЙ С 3D SPOTLIGHT TILT ==================== */}
      <section id="sec-modules" className="py-20 sm:py-28 px-5 sm:px-10 border-t border-black/[0.08] dark:border-white/[0.08] bg-white/55 dark:bg-white/[0.02]">
        <div className="max-w-7xl mx-auto space-y-10">
          <RevealEditorial className="flex flex-col md:flex-row md:items-end justify-between gap-5">
            <div className="space-y-2">
              <div className="font-mono text-xs tracking-[0.18em] text-blue-600 dark:text-sky-400 font-semibold">
                {L.modules_eye}
              </div>
              <h2 className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.035em] leading-[1.06]">
                {L.modules_t1}{' '}
                <span className="font-editorial italic font-semibold text-blue-600 dark:text-sky-400">
                  {L.modules_t2}
                </span>
              </h2>
            </div>

            <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-full bg-black/[0.05] dark:bg-white/[0.07] w-fit">
              {([
                ['all', L.flt_all],
                ['teach', L.flt_teach],
                ['practice', L.flt_practice],
                ['games', L.flt_games],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${filter === id
                    ? 'bg-[#0E1117] dark:bg-white text-white dark:text-[#0E1117] shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </RevealEditorial>

          <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-5">
            {visibleModules.map((mod, idx) => {
              const Icon = mod.icon
              const wide = filter === 'all' && Boolean(mod.featured)
              const colSpan = wide
                ? 'lg:col-span-3'
                : filter === 'practice'
                  ? 'lg:col-span-3'
                  : filter === 'games'
                    ? 'lg:col-span-6'
                    : 'lg:col-span-2'
              return (
                <RevealEditorial key={mod.id} delay={(idx % 3) * 70} className={colSpan}>
                  <SpotlightTiltCard className="rounded-3xl bg-white dark:bg-[#0D111C] border border-black/[0.08] dark:border-white/[0.1] hover:border-blue-500/50 shadow-sm hover:shadow-2xl hover:shadow-blue-950/10 dark:hover:shadow-black/50 overflow-hidden">
                    <Link to={mod.to} className="group h-full flex flex-col p-4 sm:p-5">
                      <div className="rounded-2xl overflow-hidden bg-slate-950 border border-black/10 dark:border-white/10 aspect-[16/10] mb-4">
                        <img
                          src={mod.photo}
                          alt={mod.title[lk]}
                          loading="lazy"
                          className="w-full h-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-105"
                        />
                      </div>

                      <div className="flex-1 flex flex-col justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="w-9 h-9 rounded-xl bg-blue-600/10 dark:bg-sky-400/15 text-blue-600 dark:text-sky-400 inline-flex items-center justify-center">
                              <Icon size={17} />
                            </span>
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform">
                              {L.open_module} <ArrowUpRight size={14} />
                            </span>
                          </div>
                          <h3 className="font-display font-bold text-lg sm:text-xl tracking-tight">
                            {mod.title[lk]}
                          </h3>
                          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300/90 leading-relaxed">
                            {mod.desc[lk]}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-black/[0.06] dark:border-white/[0.08]">
                          {mod.chips.map(ch => (
                            <span
                              key={ch}
                              className="px-2.5 py-0.5 rounded-full bg-black/[0.04] dark:bg-white/[0.07] text-slate-600 dark:text-slate-300 text-[11px] font-medium"
                            >
                              {ch}
                            </span>
                          ))}
                        </div>
                      </div>
                    </Link>
                  </SpotlightTiltCard>
                </RevealEditorial>
              )
            })}
          </div>
        </div>
      </section>

      {/* ==================== ACT VI: МАТРИЦА СРАВНЕНИЯ ==================== */}
      <section id="sec-compare" className="py-20 sm:py-28 px-5 sm:px-10">
        <div className="max-w-7xl mx-auto space-y-8">
          <RevealEditorial className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <div className="font-mono text-xs tracking-[0.18em] text-blue-600 dark:text-sky-400 font-semibold">
                {L.cmp_eye}
              </div>
              <h2 className="font-display font-extrabold text-3xl sm:text-5xl tracking-[-0.035em]">{L.cmp_t}</h2>
              <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">{L.cmp_sub}</p>
            </div>

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white dark:bg-[#0D111C] border border-black/10 dark:border-white/15 text-xs font-bold shadow-xs">
              <img src="/logo.svg" alt="" aria-hidden="true" className="w-4 h-4 object-contain" />
              <span>EduPlatform · 12 / 12</span>
            </div>
          </RevealEditorial>

          <RevealEditorial delay={80}>
            <div className="rounded-3xl border border-black/[0.08] dark:border-white/[0.1] bg-white dark:bg-[#0D111C] shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm" data-testid="about-table">
                  <thead>
                    <tr className="border-b border-black/[0.08] dark:border-white/[0.1] text-left text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-4 px-5 min-w-[240px]">{L.cmp_feature}</th>
                      <th className="py-4 px-4 text-center whitespace-nowrap bg-[#0E1117] dark:bg-blue-600 text-white font-bold">
                        EduPlatform
                      </th>
                      <th className="py-4 px-4 text-center whitespace-nowrap">Google Classroom</th>
                      <th className="py-4 px-4 text-center whitespace-nowrap">Kahoot</th>
                      <th className="py-4 px-4 text-center whitespace-nowrap">Moodle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROWS.map(r => (
                      <tr
                        key={r.name}
                        className="border-b border-black/[0.05] dark:border-white/[0.06] last:border-0 hover:bg-black/[0.015] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-3.5 px-5 font-medium">{r.name}</td>
                        {r.vals.map((v, i) => (
                          <td
                            key={i}
                            className={`py-3.5 px-4 text-center ${i === 0 ? 'bg-blue-600/[0.05] dark:bg-blue-500/10' : ''
                              }`}
                          >
                            {mark(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </RevealEditorial>

          <div
            className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-medium text-slate-500 dark:text-slate-400"
            data-testid="about-table-legend"
          >
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Check size={11} strokeWidth={3} />
              </span>
              {L.cmp_yes}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Minus size={11} strokeWidth={2.5} />
              </span>
              {L.cmp_part}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-slate-200/80 dark:bg-white/10 text-slate-400">
                <X size={11} strokeWidth={2} />
              </span>
              {L.cmp_no}
            </span>
          </div>
        </div>
      </section>

      {/* ==================== ACT VII: ФИНАЛЬНЫЙ ШОУКЕЙС + 2D СТУДИЙНАЯ ЗАСТАВКА ЛОГОТИПА ==================== */}
      <section className="pb-16 sm:pb-20 px-5 sm:px-10">
        <RevealEditorial className="max-w-7xl mx-auto space-y-6">
          {/* Студийная 2D-анимация логотипа + названия сайта (в стиле Mojang Studios) */}
          <AnimatedEduLogoStage
            tagline={t('tagline')}
            replayLabel={lk === 'en' ? 'Replay animation' : lk === 'kg' ? 'Анимацияны кайталоо' : 'Повторить анимацию'}
          />

          {/* Финальный CTA-баннер */}
          <div className="relative rounded-[32px] overflow-hidden bg-[#07090F] text-white p-8 sm:p-14 lg:p-16 shadow-2xl border border-white/10">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-24 -right-24 w-[520px] h-[520px] rounded-full blur-3xl opacity-55 edu-soft-glow"
              style={{
                background:
                  'radial-gradient(circle, rgba(37,99,235,0.65) 0%, rgba(14,165,233,0.3) 45%, transparent 72%)',
              }}
            />

            <div className="relative z-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
              <div className="space-y-4 max-w-2xl">
                <div className="inline-flex items-center gap-2.5">
                  <img src="/logo.svg" alt="EduPlatform" className="w-7 h-7 object-contain" />
                  <span className="font-mono text-xs tracking-[0.18em] text-sky-300">{L.cta_eye}</span>
                </div>
                <h2 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-[3.4rem] leading-[1.04] tracking-[-0.035em]">
                  {L.cta_t1}{' '}
                  <span className="font-editorial italic font-semibold text-sky-300">{L.cta_t2}</span>
                </h2>
                <p className="text-sm sm:text-base text-white/70 max-w-xl">{L.cta_sub}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <Link
                  to="/lessons/new"
                  className="h-13 px-7 py-3.5 rounded-full bg-white text-[#07090F] hover:bg-sky-200 font-bold text-sm inline-flex items-center gap-2 transition-all hover:-translate-y-0.5 shadow-lg shadow-sky-500/15"
                >
                  {L.cta_create} <ArrowRight size={16} />
                </Link>
                <Link
                  to={isSignedIn ? appHome : '/login'}
                  className="h-13 px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 font-semibold text-sm inline-flex items-center gap-2 transition-colors"
                >
                  {isSignedIn ? <ArrowLeft size={15} /> : <ArrowUpRight size={15} />}
                  {isSignedIn ? L.back_app : loginLabel}
                </Link>
              </div>
            </div>
          </div>
        </RevealEditorial>
      </section>

      <footer className="border-t border-black/[0.08] dark:border-white/[0.1] px-5 sm:px-10 py-6">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
            <img src="/logo.svg" alt="EduPlatform" className="w-4 h-4 object-contain" />
            <span>EduPlatform · {t('tagline')}</span>
          </span>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="inline-flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-sky-400 transition-colors"
          >
            {L.top_btn} <ArrowUp size={13} />
          </button>
        </div>
      </footer>
    </div>
  )
}
