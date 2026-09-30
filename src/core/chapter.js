// 把 content/chXX.js 的資料渲染成一個章節 <section>，並建立對應的 3D 舞台。
//
// content 檔格式（export default）：
// {
//   id: 'ch01', no: 1, level: 1..4,
//   title, subtitle, minutes: 6,
//   scene: 'ch01',                    // 可省略，預設同 id → src/scenes/ch01.js
//   stage: { aria: '無障礙描述', caption: '操作提示（顯示在舞台下方）' },
//   blocks: [ ... 見下 ... ],
//   quiz: [ { q, options:[..], answer:0, explain } ],
//   sources: [ { name, url, note? } ],
// }
// block 型別：
//   { type:'p', text, step? }                      段落（支援 markup.js 標記）
//   { type:'h3', text, step? }                     小標
//   { type:'list', items:[..], ordered?, step? }
//   { type:'keypoints', title?, items:[..] }       重點整理卡
//   { type:'callout', kind:'info|warn|taiwan|tip|clinical', title?, text, step? }
//   { type:'facts', items:[{ value, label, note? }] }        數字卡
//   { type:'table', caption?, head:[..], rows:[[..]], note? }
//   { type:'steps', title?, items:[{ title, text }] }        編號流程
//   { type:'compare', left:{title,items}, right:{title,items} }
//   { type:'bars', title, unit?, max?, data:[{ label, value, color?, note? }], note? }   長條圖（也是無障礙的資料替代）
//   { type:'deepdive', title, blocks:[..] }        可收合的「想更深入？」
// 任何 block 加上 step: n，捲到該區塊時會呼叫場景的 onStep（n）。

import { h, inline } from './markup.js'
import { LEVELS, hex } from './palette.js'
import { renderQuiz } from './quiz.js'

const pad = (n) => String(n).padStart(2, '0')

function renderList(items, ordered) {
  return h(ordered ? 'ol' : 'ul', { class: 'plist' }, items.map((t) => h('li', { html: inline(t) })))
}

export function renderBlock(b) {
  let el
  switch (b.type) {
    case 'p':
      el = h('p', { html: inline(b.text) })
      break
    case 'h3':
      el = h('h3', { class: 'prose-h3', html: inline(b.text) })
      break
    case 'list':
      el = renderList(b.items, b.ordered)
      break
    case 'keypoints':
      el = h('div', { class: 'keypoints', role: 'note' }, h('div', { class: 'keypoints-title', text: b.title || '重點整理' }), renderList(b.items))
      break
    case 'callout': {
      const icons = { info: 'ℹ️', warn: '⚠️', taiwan: '🇹🇼', tip: '💡', clinical: '🩺' }
      const kind = b.kind || 'info'
      el = h(
        'div',
        { class: `callout callout-${kind}`, role: 'note' },
        h('div', { class: 'callout-title' }, h('span', { 'aria-hidden': 'true', text: icons[kind] || 'ℹ️' }), ' ', b.title || { info: '補充', warn: '注意', taiwan: '台灣觀點', tip: '小提示', clinical: '臨床應用' }[kind]),
        h('div', { html: inline(b.text) })
      )
      break
    }
    case 'facts':
      el = h(
        'div',
        { class: 'facts' },
        b.items.map((f) =>
          h('div', { class: 'fact' }, h('div', { class: 'fact-value', html: inline(f.value) }), h('div', { class: 'fact-label', html: inline(f.label) }), f.note ? h('div', { class: 'fact-note', html: inline(f.note) }) : null)
        )
      )
      break
    case 'table':
      el = h(
        'div',
        { class: 'table-wrap', role: 'region', tabindex: '0', 'aria-label': b.caption || '表格' },
        h(
          'table',
          { class: 'ptable' },
          b.caption ? h('caption', { html: inline(b.caption) }) : null,
          h('thead', {}, h('tr', {}, b.head.map((c) => h('th', { scope: 'col', html: inline(c) })))),
          h('tbody', {}, b.rows.map((r) => h('tr', {}, r.map((c, i) => h(i === 0 ? 'th' : 'td', i === 0 ? { scope: 'row', html: inline(c) } : { html: inline(c) })))))
        ),
        b.note ? h('p', { class: 'table-note', html: inline(b.note) }) : null
      )
      break
    case 'steps':
      el = h(
        'div',
        { class: 'steps-block' },
        b.title ? h('div', { class: 'steps-title', html: inline(b.title) }) : null,
        h('ol', {}, b.items.map((s) => h('li', {}, h('strong', { html: inline(s.title) }), s.text ? h('span', { html: ' — ' + inline(s.text) }) : null)))
      )
      break
    case 'compare':
      el = h(
        'div',
        { class: 'compare' },
        [b.left, b.right].map((side) => h('div', { class: 'compare-col' }, h('div', { class: 'compare-title', html: inline(side.title) }), renderList(side.items)))
      )
      break
    case 'bars': {
      const max = b.max || Math.max(...b.data.map((d) => d.value), 1)
      el = h(
        'figure',
        { class: 'bars' },
        b.title ? h('figcaption', { class: 'bars-title', html: inline(b.title) }) : null,
        h(
          'div',
          { class: 'bars-list', role: 'list' },
          b.data.map((d) => {
            const bar = h('div', { class: 'bar-fill' })
            bar.style.width = Math.max(0.5, (d.value / max) * 100) + '%'
            if (d.color != null) bar.style.background = typeof d.color === 'number' ? hex(d.color) : d.color
            return h(
              'div',
              { class: 'bar-row', role: 'listitem' },
              h('span', { class: 'bar-label', html: inline(d.label) }),
              h('span', { class: 'bar-track' }, bar),
              h('span', { class: 'bar-val', text: `${d.value}${b.unit || ''}` }),
              d.note ? h('span', { class: 'bar-note', html: inline(d.note) }) : null
            )
          })
        ),
        b.note ? h('p', { class: 'table-note', html: inline(b.note) }) : null
      )
      break
    }
    case 'deepdive':
      el = h('details', { class: 'deepdive' }, h('summary', {}, h('span', { class: 'dd-tag', text: '進階' }), ' ', b.title || '想更深入？'), h('div', { class: 'deepdive-body' }, b.blocks.map(renderBlock)))
      break
    default:
      el = h('p', { class: 'unknown-block', text: `[未知區塊類型：${b.type}]` })
  }
  if (b.step != null) {
    el.dataset.step = String(b.step)
    el.classList.add('has-step')
  }
  return el
}

function renderSources(sources, no) {
  if (!sources || !sources.length) return null
  return h(
    'section',
    { class: 'sources', 'aria-label': `第 ${no} 章參考來源` },
    h('h3', { text: '📚 參考來源與延伸閱讀' }),
    h('ul', {}, sources.map((s) => h('li', {}, h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', text: s.name }), s.note ? h('span', { class: 'src-note', html: ' — ' + inline(s.note) }) : null)))
  )
}

export function buildStageFigure(id, cfg = {}) {
  const fig = h(
    'figure',
    { class: 'stage', id: `stage-${id}`, 'data-scene': id },
    h(
      'div',
      { class: 'stage-view', role: 'group', tabindex: '0', 'aria-label': cfg.aria || '互動式 3D 場景', 'aria-describedby': `figcap-${id}` },
      h('div', { class: 'stage-canvas' }),
      h(
        'div',
        { class: 'stage-hud' },
        h(
          'div',
          { class: 'hud-top' },
          h('span', { class: 'hud-badge', hidden: true }),
          h('div', { class: 'hud-actions' }, h('button', { type: 'button', 'data-act': 'pause', 'aria-pressed': 'false', 'aria-label': '暫停動畫' }, h('span', { class: 'ico', 'aria-hidden': 'true', text: '⏸' }), h('span', { class: 'lbl', text: ' 暫停動畫' })), h('button', { type: 'button', 'data-act': 'reset', 'aria-label': '重設視角' }, h('span', { class: 'ico', 'aria-hidden': 'true', text: '↺' }), h('span', { class: 'lbl', text: ' 重設視角' })))
        ),
        h('div', { class: 'hud-legend', hidden: true }),
        h('div', { class: 'hud-caption', hidden: true }),
        h('div', { class: 'hud-tooltip', hidden: true })
      ),
      h('div', { class: 'stage-loading', text: '載入 3D 場景…' })
    ),
    // 手機版：舞台黏在頂端，控制項收在這個開關裡（桌機版隱藏，見 style.css）
    h('button', { type: 'button', class: 'stage-controls-toggle', 'aria-expanded': 'false', 'aria-controls': `controls-${id}`, hidden: true, text: '⚙ 互動控制項' }),
    h('div', { class: 'stage-controls', id: `controls-${id}` }),
    h('figcaption', { class: 'stage-figcap', id: `figcap-${id}`, html: inline((cfg.caption || '拖曳可旋轉視角 · 用下方控制項互動') + ' · 鍵盤：聚焦後用方向鍵旋轉、Home 重設') })
  )
  const toggle = fig.querySelector('.stage-controls-toggle')
  toggle.addEventListener('click', () => {
    const open = fig.classList.toggle('controls-open')
    toggle.setAttribute('aria-expanded', String(open))
    toggle.textContent = open ? '⚙ 收起控制項' : '⚙ 互動控制項'
  })
  return fig
}

/**
 * @returns {{ section: HTMLElement, stageEl: HTMLElement, stepEls: HTMLElement[] }}
 */
export function renderChapter(ch, { onQuizProgress } = {}) {
  const lv = LEVELS[ch.level]
  const stageEl = buildStageFigure(ch.id, ch.stage)
  const prose = h('div', { class: 'prose' }, ch.blocks.map(renderBlock))
  const stepEls = [...prose.querySelectorAll('[data-step]')]

  const section = h(
    'section',
    { class: 'chapter', id: ch.id, 'data-level': ch.level, 'aria-labelledby': `${ch.id}-title` },
    h(
      'header',
      { class: 'chapter-head container' },
      h('div', { class: 'chapter-no', 'aria-hidden': 'true', text: pad(ch.no) }),
      h(
        'div',
        { class: 'chapter-head-text' },
        h('div', { class: 'chapter-meta' }, h('span', { class: `level-badge L${ch.level}`, text: `L${ch.level} ${lv.zh}` }), ch.minutes ? h('span', { class: 'read-time', text: `閱讀約 ${ch.minutes} 分鐘` }) : null),
        h('h2', { id: `${ch.id}-title`, html: inline(ch.title) }),
        ch.subtitle ? h('p', { class: 'chapter-sub', html: inline(ch.subtitle) }) : null
      )
    ),
    h('div', { class: 'chapter-body container' }, prose, stageEl),
    h('div', { class: 'chapter-foot container' }, ch.quiz && ch.quiz.length ? renderQuiz(ch.id, ch.quiz, onQuizProgress, ch.no) : null, renderSources(ch.sources, ch.no))
  )
  return { section, stageEl, stepEls }
}
