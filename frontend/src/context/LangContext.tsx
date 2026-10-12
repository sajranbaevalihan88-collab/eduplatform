import { createContext, useContext, useState, useEffect } from 'react'

type Lang='ru'|'en'|'kg'
const dict:Record<Lang,Record<string,string>>={
  ru:{
    dashboard:'Дашборд', subjects:'Предметы', lessons:'Уроки', presentations:'Презентации', tests:'Тесты', board:'Доска 2D/3D', login:'Вход', logout:'Выйти', profile:'Профиль',
    create_lesson:'Создать урок', view_lessons:'Смотреть уроки', how_it_works:'Как это работает', new_board_anim:'⚡ Live Demo • Python • JavaScript • HTML • CSS',
    hero_title1:'— платформа', hero_title2:'для уроков нового поколения',
    hero_sub:'Создавай <b>уроки</b> из блоков, <b>презентации</b> как в PowerPoint, <b>тесты</b> с автопроверкой и <b>личную доску 2D/3D</b> для геометрии, физики, астрономии. Всё на <b>настоящей БД</b> — видно всем без входа.',
    real_db:'PostgreSQL • настоящая БД', globally:'4 языка с запуском кода', premium_anim:'Офлайн-стабильно',
    all_for_lesson:'Всё для урока в одном месте', lessons_from_blocks:'Уроки из блоков', lessons_desc:'Текст, презентация, тест, доска, видео — собирай как конструктор, меняй порядок.',
    presentations_clone:'Презентации — клон PowerPoint', presentations_desc:'14 фигур, таблицы, диаграммы, переходы, анимации, слайд-шоу.',
    board_2d3d:'Доска 2D/3D', board_desc:'Куб, сфера, орбита, векторы — без лимита, листы + , на весь экран.',
    tests_auto:'Тесты с автопроверкой', tests_desc:'Один/несколько, текст, верно/неверно, проходной балл.',
    subjects_title:'Предметы', subjects_desc:'Математика, физика, информатика — с иконками и цветом.',
    ready:'Готово к уроку?', ready_sub:'Войди и создай первый урок — увидят все.', login_btn:'Войти →',
    how_to_start:'Как начать за 1 минуту', step1:'Зарегистрируйся', step1_as:'как Учитель', step2:'Создай презентацию в клоне PowerPoint', step3:'Собери урок из блоков и опубликуй',
    create_first:'Создать первый урок', footer:'© 2026 EduPlatform AI — на реальной БД MariaDB/Postgres • Тёмная тема • RU/EN/KG • Для слабовидящих',
    welcome:'Добро пожаловать в EduPlatform AI', welcome_sub:'Создавай уроки: тексты + презентации + тесты + личная доска 2D/3D — всё видно всем.',
    light:'Светлая', dark:'Тёмная', lang:'Язык', poor:'Для слабовидящих'
  },
  en:{
    dashboard:'Dashboard', subjects:'Subjects', lessons:'Lessons', presentations:'Presentations', tests:'Tests', board:'Board 2D/3D', login:'Login', logout:'Logout', profile:'Profile',
    create_lesson:'Create lesson', view_lessons:'View lessons', how_it_works:'How it works', new_board_anim:'⚡ Live Demo • Python • JavaScript • HTML • CSS',
    hero_title1:'— platform', hero_title2:'for next-gen lessons',
    hero_sub:'Create <b>lessons</b> from blocks, <b>presentations</b> like PowerPoint, <b>tests</b> with auto-check and <b>personal 2D/3D board</b> for geometry, physics, astronomy. All on <b>real DB</b> — visible to all without login.',
    real_db:'PostgreSQL • real DB', globally:'4 languages with code run', premium_anim:'Offline-stable',
    all_for_lesson:'All for lesson in one place', lessons_from_blocks:'Lessons from blocks', lessons_desc:'Text, presentation, test, board, video — assemble like constructor.',
    presentations_clone:'Presentations — PowerPoint clone', presentations_desc:'14 shapes, tables, charts, transitions, animations, slideshow.',
    board_2d3d:'Board 2D/3D', board_desc:'Cube, sphere, orbit, vectors — unlimited, sheets +, fullscreen.',
    tests_auto:'Tests with auto-check', tests_desc:'Single/multiple, text, true/false, passing score.',
    subjects_title:'Subjects', subjects_desc:'Math, physics, informatics — with icons and colors.',
    ready:'Ready for lesson?', ready_sub:'Log in and create first lesson — everyone will see.', login_btn:'Login →',
    how_to_start:'How to start in 1 minute', step1:'Register', step1_as:'as Teacher', step2:'Create presentation in PowerPoint clone', step3:'Assemble lesson from blocks and publish',
    create_first:'Create first lesson', footer:'© 2026 EduPlatform AI — on real DB MariaDB/Postgres • Dark mode • RU/EN/KG • Low vision',
    welcome:'Welcome to EduPlatform AI', welcome_sub:'Create lessons: texts + presentations + tests + personal 2D/3D board — visible to all.',
    light:'Light', dark:'Dark', lang:'Lang', poor:'Low vision'
  },
  kg:{
    dashboard:'Такта', subjects:'Предметтер', lessons:'Сабактар', presentations:'Презентациялар', tests:'Тесттер', board:'Такта 2D/3D', login:'Кирүү', logout:'Чыгуу', profile:'Профиль',
    create_lesson:'Сабак түзүү', view_lessons:'Сабактарды көрүү', how_it_works:'Кантип иштейт', new_board_anim:'⚡ Live Demo • Python • JavaScript • HTML • CSS',
    hero_title1:'— платформа', hero_title2:'жаңы муун сабактары үчүн',
    hero_sub:'<b>Сабактарды</b> блоктордон, <b>презентацияларды</b> PowerPoint сыяктуу, <b>тесттерди</b> авто-текшерүү менен жана <b>жеке 2D/3D тактаны</b> геометрия, физика, астрономия үчүн түзүңүз. Баары <b>чыныгы БД</b> — кирүүсүз баарына көрүнөт.',
    real_db:'PostgreSQL • чыныгы БД', globally:'4 тил код иштетүү менен', premium_anim:'Офлайн-туруктуу',
    all_for_lesson:'Сабак үчүн баары бир жерде', lessons_from_blocks:'Блоктордон сабактар', lessons_desc:'Текст, презентация, тест, такта, видео — конструктор сыяктуу чогултуу.',
    presentations_clone:'Презентациялар — PowerPoint клону', presentations_desc:'14 фигура, таблица, диаграмма, өтмөктөр, анимациялар.',
    board_2d3d:'Такта 2D/3D', board_desc:'Куб, сфера, орбита, векторлор — чексиз, барактар + , толук экран.',
    tests_auto:'Тесттер авто-текшерүү менен', tests_desc:'Бир/көп, текст, туура/ката, өтүү баллы.',
    subjects_title:'Предметтер', subjects_desc:'Математика, физика, информатика — иконкалар жана түс менен.',
    ready:'Сабакка даярсызбы?', ready_sub:'Кирип биринчи сабакты түзүңүз — баары көрөт.', login_btn:'Кирүү →',
    how_to_start:'1 мүнөттө кантип баштоо', step1:'Катталуу', step1_as:'Мугалим катары', step2:'PowerPoint клонунда презентация түзүү', step3:'Блоктордон сабак чогултуп жарыялоо',
    create_first:'Биринчи сабакты түзүү', footer:'© 2026 EduPlatform AI — чыныгы БД MariaDB/Postgres • Караңгы тема • RU/EN/KG • Начар көрүү',
    welcome:'EduPlatform AI кош келиңиз', welcome_sub:'Сабактарды түзүү: текст + презентация + тест + жеке такта.',
    light:'Жарык', dark:'Караңгы', lang:'Тил', poor:'Начар көрүү'
  }
}

const Ctx=createContext<{lang:Lang, t:(k:string)=>string, setLang:(l:Lang)=>void}>({lang:'ru', t:k=>k, setLang:()=>{}})

export function LangProvider({children}:{children:React.ReactNode}){
  const [lang,setLang]=useState<Lang>(()=> (localStorage.getItem('lang') as Lang) || 'ru')
  useEffect(()=>{ localStorage.setItem('lang', lang); document.documentElement.lang=lang },[lang])
  const t=(k:string)=> dict[lang][k] || dict['ru'][k] || k
  return <Ctx.Provider value={{lang,t,setLang}}>{children}</Ctx.Provider>
}
export const useLang=()=> useContext(Ctx)
export const useT=()=> useContext(Ctx).t
