// sql.js WASM: Vite отдаёт бинарник как URL-ассет (?url), грузится лениво
// только на странице /sql — на остальные страницы не влияет.
declare module 'sql.js/dist/sql-wasm.wasm?url' {
  const src: string
  export default src
}
