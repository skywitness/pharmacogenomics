// 遺傳漂變示意（Wright-Fisher 簡化版）：多個相同起點的族群，每一代從上一代的等位基因「隨機抽樣」。
// 這是通用的機制示範，不代表任何特定藥物基因等位基因的真實歷史。
import { FONT_STACK } from '../../core/util.js'

export const DRIFT_LINES = 16
export const DRIFT_GENS = 100
export const DRIFT_P0 = 0.1

export const DRIFT_SIZES = [
  { value: '20', n: 20, label: '很小 N=20' },
  { value: '200', n: 200, label: '中 N=200' },
  { value: '5000', n: 5000, label: '很大 N=5000' },
]

export function createDrift(rng) {
  const sim = {
    n: 20,
    gen: 0,
    // hist[line][gen]
    hist: Array.from({ length: DRIFT_LINES }, () => new Float32Array(DRIFT_GENS + 1)),
    acc: 0,
    reset(n, seed = 1) {
      this.n = n
      this.gen = 0
      this.acc = 0
      this.rand = rng(seed)
      for (const h of this.hist) {
        h.fill(NaN)
        h[0] = DRIFT_P0
      }
    },
    rand: rng(1),
    /** 二項抽樣（小 n 直接抽；大 n 用常態近似，僅供示意） */
    binom(n, p) {
      if (p <= 0) return 0
      if (p >= 1) return n
      if (n <= 400) {
        let k = 0
        for (let i = 0; i < n; i++) if (this.rand() < p) k++
        return k
      }
      const mean = n * p
      const sd = Math.sqrt(n * p * (1 - p))
      const u = Math.max(1e-9, this.rand())
      const v = this.rand()
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
      return Math.min(n, Math.max(0, Math.round(mean + sd * z)))
    },
    step() {
      if (this.gen >= DRIFT_GENS) return false
      const alleles = 2 * this.n
      for (const h of this.hist) {
        const p = h[this.gen]
        h[this.gen + 1] = this.binom(alleles, p) / alleles
      }
      this.gen++
      return true
    },
    stats() {
      let lost = 0
      let fixed = 0
      let alive = 0
      for (const h of this.hist) {
        const p = h[this.gen]
        if (p <= 0) lost++
        else if (p >= 1) fixed++
        else alive++
      }
      return { lost, fixed, alive }
    },
  }
  sim.reset(20)
  return sim
}

/** 把模擬畫進 2D canvas（在 createChartPlane 的 redraw 內呼叫）。 */
export function drawDrift(ctx, w, h, sim, colors) {
  const padL = w * 0.115
  const padR = w * 0.04
  const padT = h * 0.27
  const padB = h * 0.2
  const X = (g) => padL + ((w - padL - padR) * g) / DRIFT_GENS
  const Y = (p) => h - padB - (h - padT - padB) * p

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillStyle = colors.ink
  ctx.font = `700 ${Math.round(h * 0.06)}px ${FONT_STACK}`
  ctx.fillText('遺傳漂變示意：同一起點，不同族群大小', padL, h * 0.07)
  ctx.font = `400 ${Math.round(h * 0.04)}px ${FONT_STACK}`
  ctx.fillStyle = colors.amber
  ctx.fillText(`示意模擬（非真實統計）：每條線是一個族群，起點都是 ${Math.round(DRIFT_P0 * 100)}%`, padL, h * 0.13)

  // 軸與格線
  ctx.strokeStyle = 'rgba(160,180,230,0.22)'
  ctx.lineWidth = 1
  ctx.fillStyle = colors.muted
  ctx.font = `400 ${Math.round(h * 0.04)}px ${FONT_STACK}`
  ctx.textAlign = 'right'
  for (const p of [0, 0.25, 0.5, 0.75, 1]) {
    ctx.beginPath()
    ctx.moveTo(padL, Y(p))
    ctx.lineTo(w - padR, Y(p))
    ctx.stroke()
    ctx.fillText(Math.round(p * 100) + '%', padL - 8, Y(p))
  }
  ctx.textAlign = 'center'
  for (const g of [0, 25, 50, 75, 100]) ctx.fillText(String(g), X(g), h - padB + h * 0.05)
  ctx.fillText('世代', (padL + w - padR) / 2, h - padB + h * 0.105)
  ctx.save()
  ctx.translate(padL * 0.13, (padT + h - padB) / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('等位基因頻率', 0, 0)
  ctx.restore()

  // 起點虛線
  ctx.setLineDash([6, 6])
  ctx.strokeStyle = 'rgba(255,255,255,0.4)'
  ctx.beginPath()
  ctx.moveTo(padL, Y(DRIFT_P0))
  ctx.lineTo(w - padR, Y(DRIFT_P0))
  ctx.stroke()
  ctx.setLineDash([])

  // 曲線
  ctx.lineWidth = Math.max(2, h * 0.006)
  ctx.lineJoin = 'round'
  sim.hist.forEach((hs) => {
    const cur = hs[sim.gen]
    ctx.strokeStyle = cur <= 0 ? colors.lost : cur >= 1 ? colors.fixed : colors.alive
    ctx.beginPath()
    for (let g = 0; g <= sim.gen; g++) {
      const p = hs[g]
      if (g === 0) ctx.moveTo(X(g), Y(p))
      else ctx.lineTo(X(g), Y(p))
    }
    ctx.stroke()
  })

  // 圖例與統計
  const st = sim.stats()
  const ly = h - h * 0.04
  ctx.textAlign = 'left'
  ctx.font = `400 ${Math.round(h * 0.043)}px ${FONT_STACK}`
  let x = padL
  const item = (c, t) => {
    ctx.fillStyle = c
    ctx.fillRect(x, ly - h * 0.014, h * 0.05, h * 0.028)
    x += h * 0.065
    ctx.fillStyle = colors.ink
    ctx.fillText(t, x, ly)
    x += ctx.measureText(t).width + h * 0.05
  }
  item(colors.alive, `仍存在 ${st.alive}`)
  item(colors.lost, `已消失 ${st.lost}`)
  item(colors.fixed, `已固定（100%） ${st.fixed}`)
  ctx.textAlign = 'left'
  ctx.fillStyle = colors.muted
  ctx.fillText(`族群大小 N=${sim.n}（共 ${2 * sim.n} 份等位基因） · 第 ${sim.gen} 代`, padL, h * 0.195)
}
