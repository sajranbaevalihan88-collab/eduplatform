import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { getRole } from './utils/role'
import Layout from './components/Layout'
import { Suspense, lazy, useEffect, useState } from 'react'
import { ThemeProvider, AccessibilityProvider, ToastContainer } from './context/UIContext'
import { LangProvider } from './context/LangContext'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import ErrorBoundary from './components/ErrorBoundary'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  useEffect(() => {
    const onChange = () => setToken(localStorage.getItem('token'))
    window.addEventListener('storage', onChange)
    window.addEventListener('auth-change', onChange as any)
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener('auth-change', onChange as any)
    }
  }, [])
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function ErrorFallback() {
  return (
    <div className="p-8 text-center">
      <h2 className="text-xl font-bold">Что-то пошло не так</h2>
      <a href="/" className="text-indigo-600 underline">На главную</a>
    </div>
  )
}

// Только для учителей: ученик и родитель видят заглушку (создавать нельзя, бэк тоже запретит)
function TeacherRoute({ children }: { children: React.ReactNode }) {
  const [token] = useState<string | null>(() => localStorage.getItem('token'))
  if (!token) return <Navigate to="/login" replace />
  if (getRole() === 'student' || getRole() === 'parent') return (
    <div className="max-w-xl mx-auto bg-white dark:bg-slate-900 rounded-2xl border dark:border-slate-800 p-8 text-center space-y-3">
      <div className="text-5xl">🔒</div>
      <h2 className="text-xl font-bold dark:text-white">Только для учителей</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm">Ученики могут открывать уроки, тесты, игры и код, а создавать — нет. Word и заметки доступны в профиле.</p>
      <Link to="/" className="inline-block px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold">На главную</Link>
    </div>
  )
  return <>{children}</>
}

// Ленивая подгрузка всех вторичных разделов и игр — быстрый старт на слабых ноутбуках и при медленном интернете
const About = lazy(() => import('./pages/About'))
const Profile = lazy(() => import('./pages/Profile'))
const Subjects = lazy(() => import('./pages/Subjects'))
const SubjectDetail = lazy(() => import('./pages/SubjectDetail'))
const MyLessons = lazy(() => import('./pages/MyLessons'))
const Lessons = lazy(() => import('./pages/Lessons'))
const LessonView = lazy(() => import('./pages/LessonView'))
const LessonBuilder = lazy(() => import('./pages/LessonBuilder'))
const Files = lazy(() => import('./pages/Files'))
const Presentations = lazy(() => import('./pages/Presentations'))
const PresentationView = lazy(() => import('./pages/PresentationView'))
const PresentationEditor = lazy(() => import('./pages/PresentationEditor'))
const CodeLab = lazy(() => import('./pages/CodeLab'))
const SharedView = lazy(() => import('./pages/SharedView'))
const Board = lazy(() => import('./pages/Board'))
const VSCodeEditor = lazy(() => import('./pages/VSCodeEditor'))
const SqlLab = lazy(() => import('./pages/SqlLab'))
const WordEditor = lazy(() => import('./pages/WordEditor'))
const Tests = lazy(() => import('./pages/Tests'))
const TestBuilder = lazy(() => import('./pages/TestBuilder'))
const TestTake = lazy(() => import('./pages/TestTake'))
const Classes = lazy(() => import('./pages/Classes'))
const ClassroomDetail = lazy(() => import('./pages/ClassroomDetail'))
const Programs = lazy(() => import('./pages/Programs'))
const Progress = lazy(() => import('./pages/Progress'))
const Messages = lazy(() => import('./pages/Messages'))
const Portfolio = lazy(() => import('./pages/Portfolio'))
const TeacherAI = lazy(() => import('./pages/TeacherAI'))
const Diary = lazy(() => import('./pages/Diary'))
const Children = lazy(() => import('./pages/Children'))
const Notes = lazy(() => import('./pages/Notes'))
const Guide = lazy(() => import('./pages/Guide'))
const Games = lazy(() => import('./pages/Games'))
const Arkan = lazy(() => import('./pages/Arkan'))
const Sprint = lazy(() => import('./pages/Sprint'))
const Memory = lazy(() => import('./pages/Memory'))
const ColorMatch = lazy(() => import('./pages/ColorMatch'))
const Hangman = lazy(() => import('./pages/Hangman'))
const WordSearch = lazy(() => import('./pages/WordSearch'))
const FarmerBala = lazy(() => import('./pages/FarmerBala'))
const MathBattle = lazy(() => import('./pages/MathBattle'))
const SoundMemory = lazy(() => import('./pages/SoundMemory'))
const ConnectFour = lazy(() => import('./pages/ConnectFour'))
const Blocade = lazy(() => import('./pages/Blocade'))
const LiveQuizHost = lazy(() => import('./pages/LiveQuizHost'))
const LiveQuizPlay = lazy(() => import('./pages/LiveQuizPlay'))

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AccessibilityProvider>
          <Layout>
            <ErrorBoundary label="страница">
              <Suspense fallback={<div className="p-8"><div className="skeleton h-32 rounded-2xl" /></div>}>
              <Routes>
                <Route path="/" element={<Landing />} />
                <Route path="/about" element={<About />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/login" element={<Login />} />
                <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
                <Route path="/subjects" element={<PrivateRoute><Subjects /></PrivateRoute>} />
                <Route path="/subjects/:slug" element={<PrivateRoute><SubjectDetail /></PrivateRoute>} />
                <Route path="/my-lessons" element={<TeacherRoute><MyLessons /></TeacherRoute>} />
                <Route path="/lessons" element={<Lessons />} />
                <Route path="/lessons/new" element={<TeacherRoute><LessonBuilder /></TeacherRoute>} />
                <Route path="/lessons/:id" element={<LessonView />} />
                <Route path="/lessons/:id/edit" element={<TeacherRoute><LessonBuilder /></TeacherRoute>} />
                <Route path="/files" element={<PrivateRoute><Files /></PrivateRoute>} />
                <Route path="/presentations" element={<Presentations />} />
                <Route path="/presentations/new" element={<TeacherRoute><PresentationEditor /></TeacherRoute>} />
                <Route path="/presentations/:id" element={<PresentationView />} />
                <Route path="/presentations/:id/edit" element={<TeacherRoute><PresentationEditor /></TeacherRoute>} />
                <Route path="/tests" element={<Tests />} />
                <Route path="/tests/new" element={<TeacherRoute><TestBuilder /></TeacherRoute>} />
                <Route path="/tests/:id" element={<TeacherRoute><TestBuilder /></TeacherRoute>} />
                <Route path="/tests/:id/edit" element={<TeacherRoute><TestBuilder /></TeacherRoute>} />
                <Route path="/tests/:id/take" element={<TestTake />} />
                <Route path="/classes" element={<PrivateRoute><Classes /></PrivateRoute>} />
                <Route path="/programs" element={<PrivateRoute><Programs /></PrivateRoute>} />
                <Route path="/progress" element={<PrivateRoute><Progress /></PrivateRoute>} />
                <Route path="/messages" element={<PrivateRoute><Messages /></PrivateRoute>} />
                <Route path="/portfolio" element={<PrivateRoute><Portfolio /></PrivateRoute>} />
                <Route path="/ai-assistant" element={<TeacherRoute><TeacherAI /></TeacherRoute>} />
                <Route path="/classes/:id" element={<PrivateRoute><ClassroomDetail /></PrivateRoute>} />
                <Route path="/diary" element={<PrivateRoute><Diary /></PrivateRoute>} />

                <Route path="/children" element={<PrivateRoute><Children /></PrivateRoute>} />
                <Route path="/code" element={<CodeLab />} />
                <Route path="/notes" element={<PrivateRoute><Notes /></PrivateRoute>} />
                <Route path="/word" element={<PrivateRoute><WordEditor /></PrivateRoute>} />
                <Route path="/games" element={<Games />} />
                <Route path="/guide" element={<Guide />} />
                <Route path="/games/arkan" element={<Arkan />} />
                <Route path="/games/sprint" element={<Sprint />} />
                                <Route path="/games/memory" element={<Memory />} />
                <Route path="/games/colormatch" element={<ColorMatch />} />
                <Route path="/games/hangman" element={<Hangman />} />
                <Route path="/games/word-search" element={<WordSearch />} />
                <Route path="/games/farmer" element={<FarmerBala />} />
                <Route path="/games/math-battle" element={<MathBattle />} />
                <Route path="/games/sound-memory" element={<SoundMemory />} />
                <Route path="/games/connect-four" element={<ConnectFour />} />
                <Route path="/games/blocade" element={<Blocade />} />
                <Route path="/live" element={<LiveQuizPlay />} />
                <Route path="/live/host" element={<TeacherRoute><LiveQuizHost /></TeacherRoute>} />
                <Route path="/s/:token" element={<SharedView />} />
                <Route path="/editor" element={<VSCodeEditor />} />
                <Route path="/sql" element={<SqlLab />} />
                <Route path="/board" element={<TeacherRoute><Board /></TeacherRoute>} />
                <Route path="/board/:id" element={<TeacherRoute><Board /></TeacherRoute>} />
                <Route path="*" element={<ErrorFallback/>} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
            <ToastContainer/>
          </Layout>
        </AccessibilityProvider>
      </LangProvider>
    </ThemeProvider>
  )
}
