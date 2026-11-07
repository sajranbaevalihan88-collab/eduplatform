/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter','system-ui','sans-serif'],
        display: ['Manrope','sans-serif'],
      },
      colors: {
        primary: {50:'#eff6ff',100:'#dbeafe',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8'},
        surface: '#fafafb',
        /* Фирменная палитра с логотипа: синий #2563eb/#1d4ed8 + оранжевый #fb923c.
           Один акцент на весь интерфейс (сотни классов indigo-*) — отсюда. */
        indigo: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        /* Оранжевый логотипа (фигуры #fb923c/#f97316) — второй акцент */
        brand: {
          orange: '#fb923c',
          deep: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}
