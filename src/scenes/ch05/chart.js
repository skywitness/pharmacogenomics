// ch05 圖表：五種代謝型的血中濃度曲線 + 治療窗（全部為示意）。
// 畫在 1200×400 的 canvas 上（3:1），字級刻意放大，手機縮小顯示時仍看得清楚。
import { COLORS, hex } from '../../core/palette.js'
import { HOURS, DOSE_TIMES, KEYS, WINDOW, YMAX, sample, DT } from './pk.js'

export const CHART_ASPECT = 3

/**
 * @param g   canvas 2d context
 * @param st  { series, baseline, pheno, kind, simT, font }
 */
export function drawChart(g, W, H, st) {
  const { series, baseline, pheno, kind, simT, font, narrow } = st
  const L = 74
  const R = 22
  const T = narrow ? 80 : 84
  const B = narrow ? 70 : 62
  const pw = W - L - R
  const ph = H - T - B
  const X = (h) => L + (h / HOURS) * pw
  const Y = (v) => T + ph * (1 - Math.min(v, YMAX * 1.02) / YMAX)
  const active = kind === 'active'
  const F = (px, w = 700) => `${w} ${px}px ${font}`

  // 標題列
  g.textBaseline = 'alphabetic'
  g.textAlign = 'left'
  g.fillStyle = '#ffffff'
  g.font = F(baseline ? 32 : 42)
  const title = (active ? '活性藥：血中濃度' : baseline ? '前驅藥：活性物' : '前驅藥：活性物濃度') + (baseline ? ' · 虛線=未併用（示意）' : '（示意）')
  g.fillText(title, 24, 52)

  // 代謝型圖例（目前選擇者加亮）
  const cw = 88
  const gap = 8
  const x0 = W - R - (KEYS.length * cw + (KEYS.length - 1) * gap)
  KEYS.forEach((k, i) => {
    const x = x0 + i * (cw + gap)
    const sel = k === pheno
    g.fillStyle = hex(COLORS[k]) + (sel ? '77' : '22')
    g.strokeStyle = sel ? '#ffffff' : hex(COLORS[k])
    g.lineWidth = sel ? 4 : 2
    g.beginPath()
    g.roundRect(x, 12, cw, 50, 14)
    g.fill()
    g.stroke()
    g.fillStyle = sel ? '#ffffff' : hex(COLORS[k])
    g.font = F(34)
    g.textAlign = 'center'
    g.fillText(k, x + cw / 2, 49)
  })
  g.textAlign = 'left'

  // 繪圖區與治療窗
  g.fillStyle = 'rgba(255,255,255,0.035)'
  g.fillRect(L, T, pw, ph)
  g.fillStyle = 'rgba(255,92,92,0.13)'
  g.fillRect(L, T, pw, Y(WINDOW.hi) - T)
  g.fillStyle = 'rgba(75,227,160,0.20)'
  g.fillRect(L, Y(WINDOW.hi), pw, Y(WINDOW.lo) - Y(WINDOW.hi))
  g.fillStyle = 'rgba(255,196,77,0.09)'
  g.fillRect(L, Y(WINDOW.lo), pw, T + ph - Y(WINDOW.lo))
  g.strokeStyle = 'rgba(75,227,160,0.85)'
  g.lineWidth = 2.5
  g.setLineDash([12, 9])
  for (const v of [WINDOW.hi, WINDOW.lo]) {
    g.beginPath()
    g.moveTo(L, Y(v))
    g.lineTo(L + pw, Y(v))
    g.stroke()
  }
  g.setLineDash([])

  // x 軸刻度
  g.strokeStyle = 'rgba(255,255,255,0.10)'
  g.lineWidth = 1.5
  g.fillStyle = '#b4bfdc'
  g.font = F(narrow ? 40 : 32, 500)
  for (let h = 0; h <= HOURS; h += 24) {
    g.beginPath()
    g.moveTo(X(h), T)
    g.lineTo(X(h), T + ph)
    g.stroke()
    g.textAlign = h === 0 ? 'left' : h === HOURS ? 'right' : 'center'
    g.fillText(h === HOURS ? `${h} 小時` : String(h), h === 0 ? L : h === HOURS ? L + pw : X(h), T + ph + (narrow ? 50 : 40))
  }
  if (!narrow) {
    g.textAlign = 'center'
    g.font = F(28, 500)
    g.fillText('▼ 服藥（每 12 小時）', (X(24) + X(48)) / 2, T + ph + 40)
  }
  // y 軸標籤
  g.save()
  g.translate(34, T + ph / 2)
  g.rotate(-Math.PI / 2)
  g.textAlign = 'center'
  g.font = F(narrow ? 36 : 32, 500)
  g.fillStyle = '#b4bfdc'
  g.fillText('濃度（示意）', 0, 0)
  g.restore()

  // 區域標籤
  g.textAlign = 'left'
  g.font = F(narrow ? 34 : 30)
  g.lineJoin = 'round'
  g.lineWidth = 7
  g.strokeStyle = 'rgba(6,9,19,0.9)'
  const zl = (txt, x, y, col) => {
    g.strokeText(txt, x, y)
    g.fillStyle = col
    g.fillText(txt, x, y)
  }
  zl('毒性風險', L + 76, T + (narrow ? 36 : 34), 'rgba(255,160,160,1)')
  zl('治療窗', L + 76, Y(WINDOW.hi) + (narrow ? 34 : 33), 'rgba(120,240,190,1)')
  zl('療效不足', L + 76, T + ph - 12, 'rgba(255,205,110,1)')

  // 服藥標記
  g.fillStyle = 'rgba(255,255,255,0.75)'
  for (const d of narrow ? [] : DOSE_TIMES) {
    g.beginPath()
    g.moveTo(X(d) - 8, T - 14)
    g.lineTo(X(d) + 8, T - 14)
    g.lineTo(X(d), T - 2)
    g.closePath()
    g.fill()
  }

  // 曲線
  g.save()
  g.beginPath()
  g.rect(L, T - 4, pw, ph + 8)
  g.clip()
  const key = active ? 'cp' : 'cm'
  const cur = Math.min(simT, HOURS)
  const line = (arr, until) => {
    g.beginPath()
    const nmax = Math.round(until / DT)
    for (let i = 0; i <= nmax; i++) {
      const x = X(i * DT)
      const y = Y(arr[i])
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  g.lineJoin = 'round'
  const drawKey = (k, sel) => {
    const arr = series[k][key]
    g.strokeStyle = hex(COLORS[k])
    g.globalAlpha = sel ? 0.3 : 0.16
    g.lineWidth = sel ? 6 : 3
    line(arr, HOURS)
    if (sel) {
      // 選中的曲線加一圈半透明外光暈（不用 shadowBlur，較省效能）
      g.globalAlpha = 0.22
      g.lineWidth = 17
      line(arr, cur)
    }
    g.globalAlpha = sel ? 1 : 0.6
    g.lineWidth = sel ? 9 : 4
    line(arr, cur)
    g.globalAlpha = 1
  }
  for (const k of KEYS) if (k !== pheno) drawKey(k, false)
  if (baseline) {
    g.strokeStyle = hex(COLORS[pheno])
    g.lineWidth = 5
    g.globalAlpha = 0.95
    g.setLineDash([18, 12])
    line(baseline[key], cur)
    g.setLineDash([])
    g.globalAlpha = 1
  }
  drawKey(pheno, true)
  // 游標
  g.strokeStyle = 'rgba(255,255,255,0.6)'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(X(cur), T)
  g.lineTo(X(cur), T + ph)
  g.stroke()
  const yv = sample(series[pheno][key], cur)
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.arc(X(cur), Y(yv), 10, 0, Math.PI * 2)
  g.fill()
  g.restore()
}
