// Типовые шимы для deep-импортов monaco-editor (в package.json exports
// описаны только рантайм-пути, без .d.ts). Импорт сглаживает tsc:
declare module 'monaco-editor/editor/editor.api' {
  export * from 'monaco-editor'
}
declare module 'monaco-editor/basic-languages/monaco.contribution'
