// 章節小測驗。每題：{ q, options:[...], answer:index, explain }
// 作答結果存在 localStorage（失敗就忽略），讓導覽列可以顯示完成度。

import { h, inline } from './markup.js'

const KEY = 'pgx.quiz.v1'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}
function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function quizProgress(chapters) {
  const st = load()
  let done = 0
  let total = 0
  for (const c of chapters) {
    const n = (c.quiz || []).length
    total += n
    done += Object.keys(st[c.id] || {}).length
  }
  return { done, total }
}

export function renderQuiz(chapterId, questions, onProgress, no) {
  const state = load()
  const mine = (state[chapterId] = state[chapterId] || {})
  const root = h('section', { class: 'quiz', 'aria-label': `第 ${no ?? parseInt(String(chapterId).replace(/\D/g, ''), 10)} 章小測驗` }, h('h3', { class: 'quiz-title', text: '🧪 小測驗：確認你學會了嗎？' }))
  const scoreEl = h('div', { class: 'quiz-score', 'aria-live': 'polite' })

  const updateScore = () => {
    const answered = Object.keys(mine).length
    const correct = questions.filter((q, i) => mine[i] != null && mine[i] === q.answer).length
    scoreEl.textContent = answered ? `已作答 ${answered}/${questions.length} 題，答對 ${correct} 題` : ''
    onProgress && onProgress()
  }

  questions.forEach((q, qi) => {
    const fb = h('div', { class: 'quiz-fb', 'aria-live': 'polite', hidden: true })
    const opts = h('div', { class: 'quiz-opts', role: 'group', 'aria-label': `第 ${qi + 1} 題選項` })
    const btns = q.options.map((o, oi) => {
      const b = h('button', { type: 'button', class: 'quiz-opt', html: inline(o) })
      b.addEventListener('click', () => {
        if (mine[qi] == null) choose(oi)
      })
      opts.append(b)
      return b
    })
    const choose = (oi, silent = false) => {
      mine[qi] = oi
      btns.forEach((b, i) => {
        b.setAttribute('aria-disabled', 'true')
        b.classList.toggle('is-correct', i === q.answer)
        b.classList.toggle('is-wrong', i === oi && oi !== q.answer)
        b.querySelector('.quiz-mark')?.remove()
        if (i === q.answer || (i === oi && oi !== q.answer)) {
          const m = document.createElement('span')
          m.className = 'quiz-mark'
          m.textContent = i === q.answer ? '✓ 正確答案' : '✗ 你的選擇'
          b.append(m)
        }
      })
      fb.hidden = false
      fb.className = 'quiz-fb ' + (oi === q.answer ? 'ok' : 'no')
      fb.innerHTML = `<strong>${oi === q.answer ? '答對了！' : '再想想：'}</strong> ${inline(q.explain || '')}`
      if (!silent) {
        save(state)
        updateScore()
      }
    }
    root.append(h('div', { class: 'quiz-q' }, h('p', { class: 'quiz-text', html: `<span class="quiz-no">Q${qi + 1}</span> ${inline(q.q)}` }), opts, fb))
    if (mine[qi] != null) choose(mine[qi], true)
  })
  root.append(scoreEl)
  updateScore()
  return root
}
