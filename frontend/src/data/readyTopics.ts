export type ReadyOpt = { text: string; is_correct: boolean }
export type ReadyQ = { text: string; type: 'single' | 'true_false'; points: number; options: ReadyOpt[] }
export type ReadyTopic = { id: string; title: string; icon: string; desc: string; questions: ReadyQ[] }

const S = (text: string, correct: string, wrong: string[]): ReadyQ => ({
  text, type: 'single', points: 1,
  options: [{ text: correct, is_correct: true }, ...wrong.map(w => ({ text: w, is_correct: false }))],
})

const TF = (text: string, correctIsTrue: boolean): ReadyQ => ({
  text, type: 'true_false', points: 1,
  options: [
    { text: 'Туура', is_correct: correctIsTrue },
    { text: 'Туура эмес', is_correct: !correctIsTrue },
  ],
})

export const READY_TOPICS: ReadyTopic[] = [
  {
    id: 'math',
    title: 'Математика',
    icon: '🔢',
    desc: '5 вопросов: счёт, дроби, геометрия. Для разминки класса.',
    questions: [
      S('2 + 2 × 2 = ?', '6', ['8', '4', '10']),
      S('Половина от 50?', '25', ['20', '30', '15']),
      TF('Квадрат имеет 4 равные стороны.', true),
      S('Сколько градусов в прямом угле?', '90', ['45', '180', '60']),
      S('7 × 8 = ?', '56', ['54', '63', '48']),
    ],
  },
  {
    id: 'info',
    title: 'Информатика',
    icon: '💻',
    desc: '5 вопросов: Python, HTML, интернет. База для программистов.',
    questions: [
      S('Что выводит print(2 + 2 * 2) в Python?', '6', ['8', '4', 'Ошибка']),
      TF('Список в Python изменяемый.', true),
      S('Какой тег делает текст жирным в HTML?', '<b>', ['<i>', '<u>', '<p>']),
      S('Что означает www?', 'World Wide Web', ['World Web Window', 'Web World Wide', 'Wide World Web']),
      TF('Python — компилируемый язык.', false),
    ],
  },
  {
    id: 'kyrgyz',
    title: 'Кыргыз тили',
    icon: '🇰🇬',
    desc: '5 суроо: тамгалар, макалдар, борбор. Улуттук тема!',
    questions: [
      S('Кыргызстандын борбору?', 'Бишкек', ['Ош', 'Ташкент', 'Алматы']),
      S('«Эмгек — ...» Макалды ула.', 'бакыттын ачкычы', ['байлыктын башаты', 'ден соолук', 'билимдин энеси']),
      TF('Кыргыз алфавитинде 36 тамга бар.', true),
      S('«Китеп» сөзүндө канча муун бар?', '2', ['1', '3', '4']),
      S('Эне тил — бул эмне?', 'Өз элиңдин тили', ['Чет тил', 'Жасалма тил', 'Байыркы тил']),
    ],
  },
]
