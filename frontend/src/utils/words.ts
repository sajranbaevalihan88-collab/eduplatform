// Наборы слов для спринта печати + догонялок. Короткие частотные слова.
export const WORD_PACKS: Record<string, { label: string; words: string[] }> = {
  ru: {
    label: 'Русские',
    words: ('время рука дело жизнь день человек слово дело мир дом работа стол стул окно дверь вода земля небо солнце луна звезда дерево цветок трава река море гора поле лес птица рыба кот пес друг брат сестра мама папа сын дочь школа урок книга ручка стол игра песня танец смех радость утро вечер ночь сегодня завтра всегда иногда потом здесь там куда откуда почему потому если чтобы когда пока через между против около рядом быстро медленно громко тихо тепло холодно светло темно новый старый большой малый первый последний много мало сам свой наш ваш их мой твой его её день ночь'.split(' ')),
  },
  kg: {
    label: 'Кыргызча',
    words: ('убакыт кол иш жашоо күн адам сөз дүйнө үй жумуш стол терезе эшик суу жер асман күн ай жылдыз дарак гүл чөп дарыя деңиз тоо талаа токой куш балык мышык ит дос ага ини эже апа ата уул кыз мектеп сабак китеп калем оюн ыр бий күлкү кубаныч эртең кеч түн бүгүн эртең дайыма кээде кийин бул жак тиги жак кайда кайдан эмне үчүн эгер качан азыр тез жай катуу акырын жылуу муздак жарык караңгы жаңы эски чоң кичине биринчи акыркы көп аз'.split(' ')),
  },
  en: {
    label: 'English',
    words: ('time hand day life man word world house work table chair window door water earth sky sun moon star tree flower grass river sea mountain field forest bird fish cat dog friend brother sister mother father son daughter school lesson book pen game song dance laugh joy morning evening night today tomorrow always sometimes then here there where why because if when while fast slow loud quiet warm cold light dark new old big small first last much little'.split(' ')),
  },
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// слова из текста урока: частотные, без мусора
const STOP = new Set('это как что или для при про над под без через между также всего всех этом этой этим этих было будет есть нет да же ли бы который можно нельзя надо нужно очень даже только лишь уже еще её его их они она оно мы вы ты он все всё меня тебя себя нас вас них того из-за урок тема класс школа пример задача ответ вопрос текст слово жана же же же'.split(' '))

export function wordsFromText(text: string, count = 200): string[] {
  const found: string[] = []
  const seen = new Set<string>()
  const re = /[A-Za-zА-Яа-яЁё]{4,}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(String(text || '')))) {
    const w = m[0].toLowerCase()
    if (!STOP.has(w) && !seen.has(w)) { seen.add(w); found.push(w) }
    if (found.length >= count) break
  }
  return found.length >= 10 ? found : []
}
