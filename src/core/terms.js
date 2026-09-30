// 術語浮動說明：內文的 <button class="term" data-term="…"> 被點擊/聚焦時顯示定義。
import { findTerm } from '../content/glossary.js'
import { LEVELS } from './palette.js'
import { h } from './markup.js'

export function initTerms() {
  const pop = h('div', { class: 'term-pop', role: 'dialog', 'aria-label': '術語說明', hidden: true })
  // 固定存在的螢幕閱讀器播報區：比「隱藏 → 顯示的 live region」可靠
  const sr = h('div', { class: 'sr-only', role: 'status', 'aria-live': 'polite' })
  document.body.append(pop, sr)
  let current = null

  const hide = () => {
    pop.hidden = true
    if (current) current.setAttribute('aria-expanded', 'false')
    current = null
  }
  const show = (btn) => {
    const entry = findTerm(btn.dataset.term)
    if (!entry) return
    if (current) current.setAttribute('aria-expanded', 'false')
    current = btn
    btn.setAttribute('aria-expanded', 'true')
    sr.textContent = `${entry.zh}${entry.en ? '（' + entry.en + '）' : ''}：${entry.def}`
    const lv = LEVELS[entry.level]
    pop.replaceChildren(
      h('div', { class: 'term-pop-head' }, h('strong', { text: entry.zh }), entry.en ? h('span', { class: 'term-pop-en', text: entry.en }) : null, lv ? h('span', { class: `level-badge L${entry.level}`, text: lv.zh }) : null),
      h('p', { text: entry.def })
    )
    pop.hidden = false
    const r = btn.getBoundingClientRect()
    const pw = Math.min(340, window.innerWidth - 24)
    pop.style.width = pw + 'px'
    let left = r.left + window.scrollX + r.width / 2 - pw / 2
    left = Math.max(12, Math.min(window.scrollX + window.innerWidth - pw - 12, left))
    pop.style.left = left + 'px'
    const below = r.bottom + window.scrollY + 8
    pop.style.top = below + 'px'
    // 若下方空間不夠，改放上方
    requestAnimationFrame(() => {
      const ph = pop.offsetHeight
      if (r.bottom + 8 + ph > window.innerHeight && r.top - 8 - ph > 0) pop.style.top = r.top + window.scrollY - ph - 8 + 'px'
    })
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest && e.target.closest('.term')
    if (t) {
      e.preventDefault()
      if (current === t && !pop.hidden) hide()
      else show(t)
    } else if (!e.target.closest || !e.target.closest('.term-pop')) hide()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') hide()
  })
  window.addEventListener('scroll', () => {
    if (!pop.hidden) hide()
  }, { passive: true })
}
