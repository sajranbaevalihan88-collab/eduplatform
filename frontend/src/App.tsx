import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { getRole } from './utils/role'
import Layout from './components/Layout'
import { Suspense, lazy, useEffect, useState } from 'react'
import { ThemeProvider, AccessibilityProvider, ToastContainer } from './context/UIContext'
import { LangProvider } from './context/LangContext'
import { configureMonacoLocale } from './monacoLocale'
import Landing from './pages/Landing'
import About from './pages/About'

// Меню Monaco (правый клик в редакторе) — на языке интерфейса, по умолчанию русское.
// Конфиг должен примениться ДО первого монтирования <Editor/>.
configureMonacoLocale()

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const [token,setToken]=useState<string|null>(()=>localStorage.getItem('token'))
  useEffect(()=>{
    const onChange=()=> setToken(localStorage.getItem('token'))
    window.addEventListener('storage', onChange)
    window.addEventListener('auth-change', onChange as any)
    return ()=>{ window.removeEventListener('storage', onChange); window.removeEventListener('auth-change', onChange as any) }
  },[])
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

function ErrorFallback(){ return <div className="p-8 text-center"><h2 className="text-xl font-bold">Что-то пошло не так</h2><a href="/" className="text-blue-600 underline">На главную</a></div> }

// Только для учителей: ученик видит заглушку (создавать нельзя, бэк тоже запретит)
function TeacherRoute({ children }: { children: React.ReactNode }) {
  const [token] = useState<string|null>(()=>localStorage.getItem('token'))
  if (!token) return <Navigate to="/login" replace />
  if (getRole() === 'student') return (
    <div className="max-w-xl mx-auto bg-white rounded-2xl border p-8 text-center space-y-3">
      <div className="text-5xl">🔒</div>
      <h2 className="text-xl font-bold">Только для учителей</h2>
      <p className="text-slate-500 text-sm">Ученики могут открывать уроки, тесты, игры и код, а создавать — нет. Word и заметки доступны в профиле.</p>
      <Link to="/" className="inline-block px-5 py-2.5 rounded-xl bg-blue-600 text-white font-semibold">На главную</Link>
    </div>
  )
  return <>{children}</>
}

import Dashboard from './pages/Dashboard'
import Subjects from './pages/Subjects'
import Lessons from './pages/Lessons'
import LessonView from './pages/LessonView'
import Files from './pages/Files'
import Presentations from './pages/Presentations'
const LessonBuilder = lazy(()=>import('./pages/LessonBuilder'))
const PresentationView = lazy(()=>import('./pages/PresentationView'))
const PresentationEditor = lazy(()=>import('./pages/PresentationEditor'))
const CodeLab = lazy(()=>import('./pages/CodeLab'))
const SharedView = lazy(()=>import('./pages/SharedView'))
const Board = lazy(()=>import('./pages/Board'))
const VSCodeEditor = lazy(()=>import('./pages/VSCodeEditor'))
const WordEditor = lazy(()=>import('./pages/WordEditor'))
import Tests from './pages/Tests'
import Classes from './pages/Classes'
import ClassroomDetail from './pages/ClassroomDetail'
import TestBuilder from './pages/TestBuilder'
import TestTake from './pages/TestTake'
import Notes from './pages/Notes'
import Games from './pages/Games'
import Guide from './pages/Guide'
import Arkan from './pages/Arkan'
import Sprint from './pages/Sprint'
import Pairs from './pages/Pairs'
import Memory from './pages/Memory'
import ColorMatch from './pages/ColorMatch'
import Hangman from './pages/Hangman'
import WordSearch from './pages/WordSearch'
import FarmerBala from './pages/FarmerBala'
import Login from './pages/Login'
import Profile from './pages/Profile'
import ErrorBoundary from './components/ErrorBoundary'

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
                <Route path="/subjects" element={<Subjects />} />
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
                <Route path="/classes/:id" element={<PrivateRoute><ClassroomDetail /></PrivateRoute>} />
                <Route path="/code" element={<CodeLab />} />
                <Route path="/notes" element={<PrivateRoute><Notes /></PrivateRoute>} />
                <Route path="/word" element={<PrivateRoute><WordEditor /></PrivateRoute>} />
                <Route path="/games" element={<Games />} />
                <Route path="/guide" element={<Guide />} />
                <Route path="/games/arkan" element={<Arkan />} />
                <Route path="/games/sprint" element={<Sprint />} />
                <Route path="/games/pairs" element={<Pairs />} />
                <Route path="/games/memory" element={<Memory />} />
                <Route path="/games/colormatch" element={<ColorMatch />} />
                <Route path="/games/hangman" element={<Hangman />} />
                <Route path="/games/word-search" element={<WordSearch />} />
                <Route path="/games/farmer" element={<FarmerBala />} />
                <Route path="/s/:token" element={<SharedView />} />
                <Route path="/editor" element={<VSCodeEditor />} />
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
