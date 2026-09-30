import './style.css'
import { chapters, levelInfo } from './content/chapters.js'
import { glossary } from './content/glossary.js'
import { resources } from './content/resources.js'
import { renderChapter } from './core/chapter.js'
import { Stage } from './core/Stage.js'
import { initTerms } from './core/terms.js'
import { quizProgress } from './core/quiz.js'
import { h, inline } from './core/markup.js'
import { LEVELS } from './core/palette.js'
import { readingMode } from './core/readingMode.js'

const sceneLoaders = import.meta.glob('./scenes/*.js')
const loaderFor = (name) => sceneLoaders[`./scenes/${name}.js`] || (() => Promise.reject(new Error(`找不到場景模組 scenes/${name}.js`)))

const params = new URLSearchParams(location.search)
const only = params.get('only') // ?only=ch05 → 只渲染單一章節（測試/除錯用）
const shown = only ? chapters.filter((c) => c.id === only) : chapters

const levelsPresent = [...new Set(chapters.map((c) => c.level))].sort()

/* ───────── 導覽列 ───────── */
function buildNav() {
  const brandSvg = `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#35d6ff"/><stop offset="1" stop-color="#ff5c9e"/></linearGradient></defs><path d="M20 6c0 17 24 17 24 34S20 47 20 58M44 6c0 17-24 17-24 34s24 17 24 18" fill="none" stroke="url(#bg)" stroke-width="5" stroke-linecap="round"/><path d="M24 19h16M22 32h20M24 45h16" stroke="#e8ecf8" stroke-width="3.5" stroke-linecap="round"/></svg>`
  const menuBtn = h('button', { type: 'button', class: 'nav-menu-btn', 'aria-expanded': 'false', 'aria-controls': 'nav-menu', text: '☰ 目錄' })
  const menu = h('div', { class: 'nav-menu', id: 'nav-menu', hidden: true, role: 'navigation', 'aria-label': '章節目錄' })
  const quizLine = h('div', { class: 'ctl-note', style: 'padding:6px 10px' })
  const readBtn = h('button', { type: 'button', class: 'menu-switch', role: 'switch', 'aria-checked': String(readingMode.get()) }, h('span', { class: 'ctl-switch', 'aria-hidden': 'true' }), h('span', { text: '閱讀模式：隱藏 3D 動畫' }))
  readBtn.addEventListener('click', () => readingMode.toggle())
  readingMode.subscribe((on) => readBtn.setAttribute('aria-checked', String(on)))

  const fillMenu = () => {
    menu.replaceChildren()
    for (const lv of levelsPresent) {
      menu.append(h('h4', { text: `L${lv} ${levelInfo[lv].zh} · ${levelInfo[lv].en}` }))
      for (const c of chapters.filter((x) => x.level === lv)) {
        menu.append(h('a', { href: only ? `?only=${c.id}#${c.id}` : `#${c.id}`, 'data-target': c.id }, h('span', { class: 'no', text: String(c.no).padStart(2, '0') }), h('span', { html: inline(c.title) })))
      }
    }
    menu.append(h('h4', { text: '更多' }), h('a', { href: '#glossary' }, h('span', { class: 'no', text: '≡' }), '術語表'), h('a', { href: '#resources' }, h('span', { class: 'no', text: '↗' }), '資源與延伸閱讀'), quizLine, readBtn)
    updateQuizLine()
  }
  const updateQuizLine = () => {
    const { done, total } = quizProgress(chapters)
    quizLine.textContent = total ? `小測驗完成度：${done}/${total} 題` : ''
  }

  const nav = h(
    'header',
    { class: 'site-nav' },
    h('a', { class: 'brand', href: '#top', html: `${brandSvg}<span>藥物基因體學<small>PHARMACOGENOMICS</small></span>` }),
    h(
      'nav',
      { class: 'nav-levels', 'aria-label': '難度層級' },
      levelsPresent.map((lv) => {
        const first = chapters.find((c) => c.level === lv)
        return h('a', { class: 'nav-level', 'data-level': lv, href: `#${first.id}` }, h('i'), `L${lv} ${levelInfo[lv].zh}`)
      })
    ),
    menuBtn,
    menu,
    h('div', { class: 'progress-bar', id: 'progress' })
  )
  fillMenu()

  const setOpen = (open) => {
    menu.hidden = !open
    menuBtn.setAttribute('aria-expanded', String(open))
  }
  menuBtn.addEventListener('click', () => setOpen(menu.hidden))
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false)
  })
  document.addEventListener('click', (e) => {
    if (!menu.hidden && !e.target.closest('.nav-menu') && !e.target.closest('.nav-menu-btn')) setOpen(false)
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !menu.hidden) {
      const inMenu = menu.contains(document.activeElement)
      setOpen(false)
      if (inMenu) menuBtn.focus()
    }
  })
  nav.updateQuizLine = updateQuizLine
  return nav
}

/* ───────── Hero ───────── */
function buildHero() {
  const stage = h(
    'div',
    { class: 'stage hero-stage', id: 'stage-hero', 'data-scene': 'hero', 'aria-hidden': 'true' },
    h('div', { class: 'stage-view' }, h('div', { class: 'stage-canvas' }))
  )
  const el = h(
    'section',
    { class: 'hero', id: 'top', 'aria-labelledby': 'hero-title' },
    stage,
    h(
      'div',
      { class: 'hero-copy container' },
      h('p', { class: 'eyebrow', text: 'Pharmacogenomics · 藥物基因體學' }),
      h('h1', { id: 'hero-title', html: '同一顆藥，<br>為什麼<span class="grad">因人而異</span>？' }),
      h('p', { class: 'lede', text: `從一條 DNA 出發，跟著 ${chapters.length} 個可以旋轉、點擊、拖曳的 3D 場景，由淺入深理解「你的基因如何影響藥物在你身上的反應」——一趟從入門到臨床的精準用藥之旅。` }),
      h('div', { class: 'hero-cta' }, h('a', { class: 'btn btn-primary', href: `#${chapters[0].id}`, text: '開始探索 →' }), h('a', { class: 'btn btn-ghost', href: '#roadmap', text: '看學習地圖' })),
      h(
        'div',
        { class: 'hero-stats' },
        h('div', {}, h('b', { text: String(chapters.length) }), '互動 3D 章節'),
        h('div', {}, h('b', { text: String(levelsPresent.length) }), '難度層級'),
        h('div', {}, h('b', { text: String(glossary.length) + '+' }), '白話術語')
      )
    ),
    h('a', { class: 'scroll-cue', href: '#roadmap', text: 'SCROLL' })
  )
  return { el, stage }
}

/* ───────── 學習地圖 ───────── */
function buildRoadmap() {
  return h(
    'section',
    { class: 'section-pad container', id: 'roadmap', 'aria-labelledby': 'roadmap-title' },
    h('h2', { class: 'section-title', id: 'roadmap-title', text: '學習地圖：由淺入深的四個層級' }),
    h('p', { class: 'section-sub', text: '每一章都有一個可操作的 3D 場景與小測驗。你可以從頭依序讀，也可以直接跳到有興趣的層級。' }),
    h(
      'div',
      { class: 'roadmap-grid' },
      levelsPresent.map((lv) =>
        h(
          'article',
          { class: 'road-card', 'data-level': lv },
          h('div', { class: 'road-en', text: `L${lv} · ${levelInfo[lv].en}` }),
          h('h3', { text: `${levelInfo[lv].zh}：${levelInfo[lv].title}` }),
          h('p', { text: levelInfo[lv].blurb }),
          h('ol', {}, chapters.filter((c) => c.level === lv).map((c) => h('li', {}, h('a', { href: `#${c.id}` }, h('span', { text: String(c.no).padStart(2, '0') }), h('b', { style: 'font-weight:500', html: inline(c.title) })))))
        )
      )
    )
  )
}

function levelDivider(lv) {
  const info = levelInfo[lv]
  return h(
    'div',
    { class: 'level-divider', 'data-level': lv, id: `level-${lv}` },
    h('div', { class: 'container' }, h('div', { class: 'ld-big', 'aria-hidden': 'true', text: `L${lv}` }), h('div', { class: 'ld-text' }, h('h2', {}, h('em', { text: info.zh }), ` · ${info.title}`), h('p', { text: info.blurb })))
  )
}

/* ───────── 術語表 ───────── */
function buildGlossary() {
  const items = [...glossary].sort((a, b) => a.level - b.level || String(a.zh).localeCompare(String(b.zh), 'zh-Hant'))
  const grid = h('div', { class: 'gloss-grid' })
  const count = h('span', { class: 'gloss-count', 'aria-live': 'polite' })
  const search = h('input', { type: 'search', class: 'gloss-search', placeholder: '搜尋術語（中文、英文或縮寫）…', 'aria-label': '搜尋術語' })
  let lvFilter = 0
  let showAll = false
  const INITIAL = 24
  const more = h('button', { type: 'button', class: 'btn btn-ghost' })
  const moreWrap = h('div', { class: 'gloss-more' }, more)
  more.addEventListener('click', () => {
    showAll = true
    paint()
  })
  const chips = [0, 1, 2, 3, 4].map((lv) => {
    const b = h('button', { type: 'button', class: 'chip', 'aria-pressed': String(lv === 0), text: lv === 0 ? '全部' : `L${lv} ${LEVELS[lv].zh}` })
    b.addEventListener('click', () => {
      lvFilter = lv
      showAll = false
      chips.forEach((c, i) => c.setAttribute('aria-pressed', String(i === lv)))
      paint()
    })
    return b
  })
  function paint() {
    const q = search.value.trim().toLowerCase()
    const list = items.filter((g) => (!lvFilter || g.level === lvFilter) && (!q || [g.key, g.zh, g.en, g.def, ...(g.aliases || [])].some((s) => s && String(s).toLowerCase().includes(q))))
    const cap = q || showAll ? Infinity : INITIAL
    const shown = list.slice(0, cap)
    grid.replaceChildren(
      ...shown.map((g) =>
        h('article', { class: 'gloss-card' }, h('h3', {}, g.zh, g.en ? h('span', { class: 'en', text: g.en }) : null, g.level ? h('span', { class: `level-badge L${g.level}`, text: `L${g.level}` }) : null), h('p', { text: g.def }))
      )
    )
    count.textContent = `共 ${list.length} 個術語`
    moreWrap.hidden = shown.length >= list.length
    more.textContent = `顯示全部（還有 ${list.length - shown.length} 個）`
  }
  search.addEventListener('input', paint)
  paint()
  return h(
    'section',
    { class: 'section-pad container', id: 'glossary', 'aria-labelledby': 'gloss-title' },
    h('h2', { class: 'section-title', id: 'gloss-title', text: '術語表' }),
    h('p', { class: 'section-sub', text: '內文中有虛線底線的詞都可以點開看白話定義；這裡是完整清單，可搜尋、可依難度篩選。' }),
    h('div', { class: 'gloss-tools' }, search, ...chips, count),
    grid,
    moreWrap
  )
}

/* ───────── 資源 ───────── */
function buildResources() {
  return h(
    'section',
    { class: 'section-pad container', id: 'resources', 'aria-labelledby': 'res-title' },
    h('h2', { class: 'section-title', id: 'res-title', text: '資源與延伸閱讀' }),
    h('p', { class: 'section-sub', text: '以下是本站內容主要參考、也推薦你繼續深入的權威來源。' }),
    h(
      'div',
      { class: 'res-groups' },
      resources.map((g) =>
        h(
          'div',
          { class: `res-group${g.star ? ' res-star' : ''}` },
          h('h3', { text: g.title }),
          h('ul', {}, g.items.map((it) => h('li', {}, h('a', { href: it.url, target: '_blank', rel: 'noopener noreferrer', text: it.name }), it.desc ? h('p', { text: it.desc }) : null)))
        )
      )
    )
  )
}

function buildFooter() {
  return h(
    'footer',
    { class: 'site-footer' },
    h(
      'div',
      { class: 'container' },
      h('div', { class: 'disclaimer', html: '<strong>⚠ 重要聲明：</strong>本網站內容僅供教育與科普用途，不構成醫療建議、診斷或治療。基因檢測結果需由醫師、藥師等專業人員結合您的整體狀況判斷；<strong>請勿自行停藥、換藥或調整劑量</strong>，有任何用藥疑問請諮詢您的醫療團隊。' }),
      h('p', { html: '本站使用 <a href="https://threejs.org/" target="_blank" rel="noopener noreferrer">three.js</a> 製作 3D 互動場景。內容整理自 CPIC、ClinPGx（PharmGKB）、FDA、台灣藥物基因體學會（PGST）等公開資料，各章末附有參考來源；等位基因頻率等數值會因族群與研究而異，僅供示意。' }),
      h('p', { text: '本站為教育性專案，內容會隨新的研究與臨床指引更新而修訂；數值與建議請以各章列出的原始來源為準。' })
    )
  )
}

/* ───────── 組裝 ───────── */
function init() {
  const app = document.getElementById('app')
  app.replaceChildren()
  const nav = buildNav()
  app.append(nav)
  const main = h('main', { id: 'main', tabindex: '-1' })
  app.append(main)

  const stages = []
  const heroObj = only ? null : buildHero()
  if (heroObj) {
    main.append(heroObj.el)
    main.append(buildRoadmap())
  } else {
    main.append(h('div', { style: 'height:var(--nav-h)' }))
  }

  const stepGroups = []
  let lastLevel = 0
  for (const ch of shown) {
    if (!only && ch.level !== lastLevel) {
      main.append(levelDivider(ch.level))
      lastLevel = ch.level
    }
    const { section, stageEl, stepEls } = renderChapter(ch, { onQuizProgress: () => nav.updateQuizLine() })
    main.append(section)
    stages.push({ ch, stageEl, section })
    if (stepEls.length) stepGroups.push({ ch, stepEls })
  }

  if (!only) {
    main.append(buildGlossary(), buildResources())
  }
  app.append(buildFooter())

  initTerms()

  // 建立 3D 舞台（此時元素都已進入 DOM）
  const heroStage = heroObj ? new Stage(heroObj.stage, 'hero', loaderFor('hero')) : null
  const stageMap = {}
  for (const s of stages) stageMap[s.ch.id] = new Stage(s.stageEl, s.ch.id, loaderFor(s.ch.scene || s.ch.id))

  // 閱讀模式（手機/平板）：一開始就收起的話，場景根本不會被載入
  const allStages = [...(heroStage ? [heroStage] : []), ...Object.values(stageMap)]
  const isCompact = matchMedia('(max-width: 1100px)')
  allStages.forEach((s) => s.setCollapsed(readingMode.get() && isCompact.matches))

  // 文字 → 場景步驟同步（scrollytelling）
  // 以「觸發帶」判斷讀者目前讀到哪個步驟區塊：桌機是視窗正中央的一條窄帶；
  // 手機版舞台黏在頂端，觸發帶改放在舞台下方。同時有多個短區塊落在帶內時，選最接近帶中心者。
  const mqMobile = matchMedia('(max-width: 1100px)')
  const inBand = new Map() // chapterId -> Set<element>
  const lastActive = new Map() // chapterId -> element
  let stepIO = null
  let bandCenter = innerHeight / 2

  const activate = (chId) => {
    const set = inBand.get(chId)
    if (!set || !set.size) return
    let best = null
    let bestD = Infinity
    for (const el of set) {
      const r = el.getBoundingClientRect()
      const d = Math.abs((r.top + r.bottom) / 2 - bandCenter)
      if (d < bestD) {
        bestD = d
        best = el
      }
    }
    if (!best || best === lastActive.get(chId)) return
    lastActive.set(chId, best)
    const stage = stageMap[chId]
    best.closest('.prose').querySelectorAll('.is-active-step').forEach((n) => n.classList.remove('is-active-step'))
    best.classList.add('is-active-step')
    if (stage) stage.setStep(Number(best.dataset.step))
  }

  const setupStepObserver = () => {
    if (stepIO) stepIO.disconnect()
    inBand.clear()
    lastActive.clear()
    let rootMargin = '-42% 0px -42% 0px'
    bandCenter = innerHeight / 2
    if (mqMobile.matches && stages.length && !readingMode.get()) {
      const navH = 60
      const stageH = stages[0].stageEl.offsetHeight || 340
      const top = Math.min(innerHeight * 0.7, navH + 6 + stageH + 14)
      const band = 80
      rootMargin = `-${Math.round(top)}px 0px -${Math.max(0, Math.round(innerHeight - top - band))}px 0px`
      bandCenter = top + band / 2
    }
    stepIO = new IntersectionObserver(
      (entries) => {
        const touched = new Set()
        for (const e of entries) {
          const chId = e.target.closest('.chapter').id
          if (!inBand.has(chId)) inBand.set(chId, new Set())
          if (e.isIntersecting) inBand.get(chId).add(e.target)
          else inBand.get(chId).delete(e.target)
          touched.add(chId)
        }
        touched.forEach(activate)
      },
      { rootMargin }
    )
    for (const g of stepGroups) g.stepEls.forEach((el) => stepIO.observe(el))
  }
  setupStepObserver()

  // 切換閱讀模式（或跨過手機/桌機斷點）時：收合/展開所有舞台，並讓目前讀到的那一段文字留在原位（否則版面高度改變會讓內容跳走）
  const applyReading = () => {
    const on = readingMode.get() && isCompact.matches
    allStages.forEach((s) => s.setCollapsed(on))
    setupStepObserver()
  }
  readingMode.subscribe(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight * 0.6)
    const anchor = el && el.closest ? el.closest('.prose > *, .chapter-foot > *') : null
    const before = anchor ? anchor.getBoundingClientRect().top : 0
    applyReading()
    requestAnimationFrame(() => {
      if (!anchor || !document.contains(anchor)) return
      const d = anchor.getBoundingClientRect().top - before
      if (Math.abs(d) > 1) window.scrollBy({ top: d, behavior: 'instant' })
    })
  })
  isCompact.addEventListener('change', applyReading)
  let resizeTimer = 0
  addEventListener('resize', () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(setupStepObserver, 200)
  })
  // 手機：鍵盤聚焦到被黏頂舞台蓋住的文字/按鈕時，把它捲到舞台下方
  document.addEventListener('focusin', (e) => {
    if (!mqMobile.matches) return
    const t = e.target
    if (!t.closest || !t.closest('.prose, .chapter-foot')) return
    const stage = t.closest('.chapter')?.querySelector('.stage')
    if (!stage) return
    const sb = stage.getBoundingClientRect()
    if (sb.top > 70) return // 還沒黏住
    const r = t.getBoundingClientRect()
    if (r.top < sb.bottom + 8) window.scrollBy({ top: r.top - sb.bottom - 16, behavior: 'instant' })
  })
  // 抽屜展開後讀者繼續往下捲 → 自動收起（否則黏頂舞台會吃掉大半螢幕）
  let drawerY = 0
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.stage-controls-toggle')) drawerY = scrollY
  })
  addEventListener(
    'scroll',
    () => {
      const open = document.querySelector('.stage.controls-open')
      if (open && Math.abs(scrollY - drawerY) > 260) {
        const t = open.querySelector('.stage-controls-toggle')
        if (t) t.click()
      }
    },
    { passive: true }
  )
  // 展開/收起手機版控制項會改變黏頂舞台的高度 → 重新計算觸發帶
  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('.stage-controls-toggle')) setTimeout(setupStepObserver, 60)
  })

  // 卷動偵測：目前所在章節/層級
  const links = [...nav.querySelectorAll('.nav-menu a[data-target]')]
  const levelLinks = [...nav.querySelectorAll('.nav-level')]
  const spy = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const id = e.target.id
        links.forEach((a) => a.setAttribute('aria-current', String(a.dataset.target === id)))
        const lv = e.target.dataset.level
        levelLinks.forEach((a) => {
          const on = a.dataset.level === lv
          a.classList.toggle('is-current', on)
          if (on) a.setAttribute('aria-current', 'true')
          else a.removeAttribute('aria-current')
        })
      }
    },
    { rootMargin: '-45% 0px -50% 0px' }
  )
  main.querySelectorAll('.chapter').forEach((c) => spy.observe(c))

  // 進度條
  const bar = document.getElementById('progress')
  let ticking = false
  const onScroll = () => {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      const max = document.documentElement.scrollHeight - innerHeight
      bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`
      ticking = false
    })
  }
  addEventListener('scroll', onScroll, { passive: true })
  onScroll()

  // 處理載入時就帶 hash 的情形（元素在 DOM 建立後才存在）
  if (location.hash) {
    const t = document.getElementById(decodeURIComponent(location.hash.slice(1)))
    if (t) requestAnimationFrame(() => t.scrollIntoView())
  }
}

init()
