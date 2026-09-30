// 「遺傳」模式：親代雙倍型 → 生殖細胞（各帶一個等位基因）→ 2×2 龐尼特方格 → 子代雙倍型與表現型機率。
import { CHROM_COL, FN, PH, GENES, css, phenotypeOf, dipLabel, sortPair } from './data.js'

const rr = (c, x, y, w, h, r) => {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
}

const DX = 0.65 // 整體水平置中的位移
export const PL = {
  colX: [-1.05 + DX, 1.25 + DX],
  rowY: [0.42, -0.58],
  rowHeadX: -3.05 + DX,
  colHeadY: 1.38,
  barY: -1.6,
  cardW: 2.2,
  cardH: 0.9,
}
export const PUN_BOX = { cx: 0, cy: -0.02, w: 6.6, h: 3.95 }

export function createPunnett(ctx) {
  const { THREE, util } = ctx
  const FONT = util.FONT_STACK
  const root = new THREE.Group()
  root.name = 'punnett'
  root.visible = false

  let st = { gene: 'CYP2C19', mom: ['*1', '*2'], dad: ['*1', '*2'] }
  let kids = []
  let selected = null // {r,c}
  let tally = null
  let reveal = 0 // 秒，進場動畫用
  let flash = { r: -1, c: -1, t: 0 }

  // 卡片 ×4
  const cards = []
  const cardGlow = util.makeGlow(0xffffff, 3.6, 0)
  cardGlow.renderOrder = 3
  root.add(cardGlow)
  for (let r = 0; r < 2; r++) {
    for (let cc = 0; cc < 2; cc++) {
      const p = util.createChartPlane({ width: PL.cardW, height: PL.cardH, px: 440, bg: null })
      p.mesh.position.set(PL.colX[cc], PL.rowY[r], 0)
      p.mesh.material.depthTest = false
      p.mesh.renderOrder = 10 + r * 2 + cc
      p.mesh.userData = { r, c: cc }
      p.s = 0
      p.z = 0
      root.add(p.mesh)
      cards.push(p)
    }
  }
  const cardAt = (r, c) => cards[r * 2 + c]

  // 生殖細胞標頭
  function makeGamete(x, y) {
    const p = util.createChartPlane({ width: 1.2, height: 0.86, px: 240, bg: null })
    p.mesh.position.set(x, y, 0.1)
    p.mesh.material.depthTest = false
    p.mesh.renderOrder = 8
    root.add(p.mesh)
    return p
  }
  const gRow = [makeGamete(PL.rowHeadX, PL.rowY[0]), makeGamete(PL.rowHeadX, PL.rowY[1])]
  const gCol = [makeGamete(PL.colX[0], PL.colHeadY), makeGamete(PL.colX[1], PL.colHeadY)]
  function drawGamete(p, who, al) {
    const col = css(who === 'mom' ? CHROM_COL.mom : CHROM_COL.dad)
    p.redraw((c, W, H) => {
      rr(c, 4, 4, W - 8, H - 8, 26)
      c.fillStyle = 'rgba(6,9,19,0.9)'
      c.fill()
      c.lineWidth = 5
      c.strokeStyle = col
      c.stroke()
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillStyle = col
      c.font = `800 38px ${FONT}`
      c.fillText(who === 'mom' ? '卵子帶' : '精子帶', W / 2, 30)
      c.fillStyle = '#fff'
      c.font = `800 72px ${FONT}`
      c.fillText(al.id, W / 2, 90)
      c.fillStyle = css(FN[al.fn].color)
      c.font = `800 40px ${FONT}`
      c.fillText(FN[al.fn].short, W / 2, 146)
    })
  }

  // 角落：親代摘要
  const corner = util.makeLabel('假設親代', { fontSize: 30, worldHeight: 0.8, bg: 'rgba(6,9,19,0.6)', border: 'rgba(120,160,255,0.3)', bold: true })
  corner.position.set(PL.rowHeadX, PL.colHeadY, 0.2)
  root.add(corner)

  // 機率長條
  const bar = util.createChartPlane({ width: 5.6, height: 0.8, px: 1120, bg: 'rgba(8,13,30,0.88)' })
  bar.mesh.position.set(0, PL.barY, 0.2)
  bar.mesh.renderOrder = 15
  root.add(bar.mesh)

  function summarize() {
    const dist = {}
    for (const row of kids) for (const k of row) dist[k.ph.key] = (dist[k.ph.key] || 0) + 1
    return dist // 次數，共 4
  }

  function drawCard(r, cc) {
    const k = kids[r][cc]
    const p = cardAt(r, cc)
    const col = css(PH[k.ph.key].color)
    const sel = selected && selected.r === r && selected.c === cc
    const [s1, s2] = k.dip.split('/')
    p.redraw((c, W, H) => {
      const bw = sel ? 9 : 5
      rr(c, bw / 2 + 1, bw / 2 + 1, W - bw - 2, H - bw - 2, 26)
      c.fillStyle = sel ? 'rgba(20,28,58,0.97)' : 'rgba(6,9,19,0.92)'
      c.fill()
      c.lineWidth = bw
      c.strokeStyle = col
      c.stroke()
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      // 雙倍型：兩個等位基因分別用「來源」的顏色標示（母源粉紅、父源藍）
      // k.a 是母源、k.b 是父源；顯示順序依星號數字小的在前
      c.font = `800 78px ${FONT}`
      const colA = k.a === s1 ? css(CHROM_COL.mom) : css(CHROM_COL.dad)
      const colB = colA === css(CHROM_COL.mom) ? css(CHROM_COL.dad) : css(CHROM_COL.mom)
      const w1 = c.measureText(s1).width
      const w2 = c.measureText(s2).width
      const ws = c.measureText('/').width
      const total = w1 + ws + w2
      let x = W / 2 - total / 2
      c.textAlign = 'left'
      c.fillStyle = colA
      c.fillText(s1, x, 52)
      x += w1
      c.fillStyle = '#ffffff'
      c.fillText('/', x, 52)
      x += ws
      c.fillStyle = colB
      c.fillText(s2, x, 52)
      c.textAlign = 'center'
      c.fillStyle = col
      c.font = `800 58px ${FONT}`
      c.fillText(PH[k.ph.key].zh, W / 2, 132)
    })
  }

  function drawBar() {
    const dist = summarize()
    const keys = ['PM', 'IM', 'NM', 'RM', 'UM'].filter((kk) => dist[kk])
    bar.redraw((c, W, H) => {
      const x0 = 12
      const total = W - 24
      let x = x0
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      for (const key of keys) {
        const w = (dist[key] / 4) * total
        rr(c, x + 4, 10, w - 8, H - 20, 12)
        c.fillStyle = css(PH[key].color)
        c.fill()
        c.fillStyle = '#0a1024'
        c.font = `800 ${Math.round(H * 0.31)}px ${FONT}`
        c.fillText(PH[key].short + "代謝者", x + w / 2, H * 0.34)
        c.fillText(`${dist[key] * 25}%`, x + w / 2, H * 0.72)
        x += w
      }
    })
  }

  function rebuild() {
    const gene = GENES[st.gene]
    kids = [0, 1].map((r) =>
      [0, 1].map((cc) => {
        const a = st.mom[r]
        const b = st.dad[cc]
        const [x, y] = sortPair(a, b)
        return { a, b, dip: `${x}/${y}`, ph: phenotypeOf(st.gene, a, b) }
      })
    )
    for (let r = 0; r < 2; r++) {
      drawGamete(gRow[r], 'mom', gene.alleles[st.mom[r]])
      drawGamete(gCol[r], 'dad', gene.alleles[st.dad[r]])
    }
    for (let r = 0; r < 2; r++) for (let cc = 0; cc < 2; cc++) drawCard(r, cc)
    corner.userData.setText(`假設親代\n母 ${dipLabel(st.mom[0], st.mom[1])}\n父 ${dipLabel(st.dad[0], st.dad[1])}`)
    drawBar()
  }
  rebuild()

  function setSel(next) {
    const prev = selected
    selected = next
    if (prev) drawCard(prev.r, prev.c)
    if (next) drawCard(next.r, next.c)
    cardGlow.material.color.setHex(next ? PH[kids[next.r][next.c].ph.key].color : 0xffffff)
  }

  return {
    root,
    get cards() {
      return cards.map((c) => c.mesh)
    },
    get state() {
      return st
    },
    get kids() {
      return kids
    },
    get selected() {
      return selected
    },
    get tally() {
      return tally
    },
    set(next) {
      st = { ...st, ...next }
      tally = null
      selected = null
      rebuild()
    },
    select(r, c) {
      setSel(r == null ? null : { r, c })
    },
    /** 隨機生一位孩子（各 25%），回傳 {r,c,kid}。 */
    draw() {
      const r = Math.floor(Math.random() * 2)
      const c = Math.floor(Math.random() * 2)
      const kid = kids[r][c]
      if (!tally) tally = { n: 0, by: {} }
      tally.n++
      tally.by[kid.ph.key] = (tally.by[kid.ph.key] || 0) + 1
      setSel({ r, c })
      flash = { r, c, t: 1 }
      return { r, c, kid }
    },
    summary() {
      const d = summarize()
      return ['PM', 'IM', 'NM', 'RM', 'UM']
        .filter((k) => d[k])
        .map((k) => `${PH[k].short} ${d[k] * 25}%`)
        .join('、')
    },
    tallyText() {
      if (!tally || !tally.n) return ''
      const parts = ['PM', 'IM', 'NM', 'RM', 'UM'].filter((kk) => tally.by[kk]).map((kk) => `${PH[kk].short} ${tally.by[kk]}`)
      return `已隨機生了 ${tally.n} 位：${parts.join('、')}`
    },
    resetTally() {
      tally = null
    },
    show(v) {
      if (v && !root.visible) reveal = 0
      root.visible = v
    },
    update(dt) {
      if (!root.visible) return
      reveal += dt
      for (let r = 0; r < 2; r++) {
        for (let cc = 0; cc < 2; cc++) {
          const p = cardAt(r, cc)
          const delay = 0.1 + (r * 2 + cc) * 0.12
          const appear = util.easeOutBack(util.clamp((reveal - delay) / 0.5, 0, 1))
          const isSel = selected && selected.r === r && selected.c === cc
          p.s = util.damp(p.s, isSel ? 1.06 : 1, 9, dt)
          p.z = util.damp(p.z, isSel ? 0.5 : 0, 9, dt)
          p.mesh.scale.setScalar(Math.max(0.001, appear * p.s))
          p.mesh.position.z = p.z
        }
      }
      for (const g of [...gRow, ...gCol]) {
        const a = util.easeOutBack(util.clamp((reveal - 0.02) / 0.4, 0, 1))
        g.mesh.scale.setScalar(Math.max(0.001, a))
      }
      bar.mesh.material.opacity = util.clamp((reveal - 0.7) / 0.4, 0, 1)
      if (selected) {
        cardGlow.position.copy(cardAt(selected.r, selected.c).mesh.position)
        cardGlow.position.z = -0.1
      }
      flash.t = Math.max(0, flash.t - dt * 1.2)
      const target = selected ? 0.4 + flash.t * 0.5 : 0
      cardGlow.material.opacity = util.damp(cardGlow.material.opacity, target, 8, dt)
    },
    dispose() {
      util.disposeTree(root)
    },
  }
}
