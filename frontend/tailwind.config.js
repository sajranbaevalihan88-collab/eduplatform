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
        /* Акцент бренда перекрашен из яркого индиго в сдержанный корпоративный сине-стальной:
           весь интерфейс (сотни классов indigo-*) перекрашивается одной заменой — отсюда. */
        indigo: {
          50: '#f2f5fd',
          100: '#e5eaf8',
          200: '#cbd3f0',
          300: '#a8b6e4',
          400: '#8295d5',
          500: '#6478c7',
          600: '#4a5cb8',
          700: '#3e4d9e',
          800: '#354084',
          900: '#303a6c',
          950: '#1d2342',
        },
      },
    },
  },
  plugins: [],
}
