import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode; label?: string }
type State = { err: Error | null; info: string }

// Красная панель с текстом ошибки вместо белого экрана:
// любой краш рендера перестаёт убивать всё приложение молча.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null, info: '' }

  static getDerivedStateFromError(err: Error): State {
    return { err, info: '' }
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    this.setState({ err, info: info.componentStack || '' })
  }

  render() {
    const { err, info } = this.state
    if (!err) return this.props.children
    const line = err.message || String(err)
    const stack = (err.stack || '').split('\n').slice(0, 6).join('\n')
    return (
      <div className="max-w-2xl mx-auto my-10 p-6 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-sm" role="alert" aria-live="assertive">
        <div className="font-bold text-red-700 dark:text-red-300 text-lg flex items-center gap-2">
          <span aria-hidden="true">⚠️</span> Ошибка интерфейса{this.props.label ? ` (${this.props.label})` : ''}
        </div>
        <p className="mt-2 text-red-800 dark:text-red-200 font-mono break-all">{line}</p>
        {stack && <pre className="mt-3 p-3 rounded-lg bg-white/70 dark:bg-slate-900/60 text-xs overflow-auto max-h-40 whitespace-pre-wrap font-mono text-red-700 dark:text-red-300">{stack}</pre>}
        {info && <pre className="mt-2 p-3 rounded-lg bg-white/70 dark:bg-slate-900/60 text-xs overflow-auto max-h-40 whitespace-pre-wrap font-mono text-slate-600 dark:text-slate-300">{info.slice(0, 1200)}</pre>}
        <div className="mt-4 flex gap-2">
          <button onClick={() => window.location.reload()} className="px-4 py-2 min-h-[44px] rounded-xl bg-red-600 text-white font-bold">Перезагрузить</button>
          <a href="/" className="px-4 py-2 min-h-[44px] rounded-xl bg-white dark:bg-slate-800 dark:text-white border dark:border-slate-700 font-bold">На главную</a>
        </div>
      </div>
    )
  }
}
