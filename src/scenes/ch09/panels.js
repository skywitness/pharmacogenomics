// ch09：畫在 canvas 上的 3D 面板（判讀卡、電子病歷螢幕、處方單、PCR 曲線）
import { COLORS, hex } from '../../core/palette.js'
import { FONT_STACK } from '../../core/util.js'
import { toneColor } from './data.js'

const font = (w, px) => `${w} ${px}px ${FONT_STACK}`
const MONO = '"Cascadia Mono","Consolas","Menlo",monospace'
const rgba = (n, a) => {
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${a})`
}

function rr(g, x, y, w, h, r, fill, stroke, lw = 2) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
  if (fill) {
    g.fillStyle = fill
    g.fill()
  }
  if (stroke) {
    g.strokeStyle = stroke
    g.lineWidth = lw
    g.stroke()
  }
}

function text(g, str, x, y, { size = 22, weight = 500, color = '#e8ecf8', align = 'left', mono = false, base = 'middle' } = {}) {
  g.font = mono ? `${weight} ${size}px ${MONO}` : font(weight, size)
  g.fillStyle = color
  g.textAlign = align
  g.textBaseline = base
  g.fillText(str, x, y)
}

/** 依寬度折行（中文逐字，英文亦逐字元；夠用） */
function wrap(g, str, maxW, size, weight = 500) {
  g.font = font(weight, size)
  const out = []
  let line = ''
  for (const ch of String(str)) {
    if (g.measureText(line + ch).width > maxW && line) {
      out.push(line)
      line = ch
    } else line += ch
  }
  if (line) out.push(line)
  return out
}

/** ④ 判讀卡：兩個等位基因 → 雙倍型 → 表現型。progress 0..1 逐列出現（畫布 640×470；底色不透明，後面的物件不會透出來） */
export function drawCard(g, W, H, { sc, seen, progress }) {
  const p = progress
  rr(g, 0, 0, W, H, 18, 'rgba(22,36,78,0.97)', 'rgba(120,160,255,0.35)', 2)
  text(g, `${sc.gene} 基因判讀`, 26, 40, { size: 34, weight: 700 })
  rr(g, W - 158, 16, 134, 36, 18, rgba(COLORS.amber, 0.16), rgba(COLORS.amber, 0.7), 1.5)
  text(g, '示意病人', W - 91, 34, { size: 21, weight: 700, color: '#ffd98a', align: 'center' })

  // 列 1：兩份等位基因
  text(g, '① 兩份等位基因（各來自一位親代）', 26, 88, { size: 24, color: '#aab5d2' })
  seen.alleles.forEach((a, i) => {
    const x = 26 + i * (W - 52 - 18) * 0.5 + i * 18
    const w = (W - 52 - 18) / 2
    const c = toneColor(a.tone)
    const on = p > 0.02
    g.globalAlpha = on ? 1 : 0.4
    rr(g, x, 104, w, 96, 16, rgba(c, 0.22), rgba(c, 0.95), 2.5)
    text(g, a.name, x + w / 2, 138, { size: 44, weight: 800, align: 'center', mono: true, color: hex(c) === '#8a93ad' ? '#c8d0e8' : '#ffffff' })
    text(g, a.fn, x + w / 2, 177, { size: 25, color: '#e6ecff', align: 'center' })
    g.globalAlpha = 1
  })

  // 列 2：雙倍型
  const a2 = Math.min(1, Math.max(0, (p - 0.33) * 6))
  g.globalAlpha = a2
  text(g, '② 合起來 = 雙倍型', 26, 236, { size: 24, color: '#aab5d2' })
  text(g, seen.diplotype, 26, 278, { size: 44, weight: 800, mono: true, color: '#ffffff' })
  if (seen.activity) text(g, seen.activity, W - 26, 278, { size: 24, weight: 700, align: 'right', color: '#d8ccff' })
  g.globalAlpha = 1

  // 列 3：表現型
  const a3 = Math.min(1, Math.max(0, (p - 0.66) * 6))
  g.globalAlpha = a3
  text(g, '③ 對照指引 → 表現型', 26, 322, { size: 24, color: '#aab5d2' })
  const pc = seen.phColor
  rr(g, 26, 338, W - 52, 62, 31, rgba(pc, 0.28), rgba(pc, 1), 2.5)
  text(g, seen.phenotype, W / 2, 370, { size: 34, weight: 800, align: 'center', color: '#ffffff' })
  g.globalAlpha = 1

  if (seen.missed && a3 > 0.5) {
    rr(g, 26, 412, W - 52, 46, 10, 'rgba(255,92,92,0.18)', 'rgba(255,92,92,0.85)', 1.5)
    text(g, '⚠ 只做 SNV 探針：看不到基因重複（示意）', W / 2, 435, { size: 22, weight: 700, align: 'center', color: '#ffc0c0' })
  }
}

/** ⑤ 電子病歷螢幕（640×400）。
 *  wait：反應式「等待結果」的進度 0..1;-1 表示不在等待（前瞻式，或反應式的結果已回來）。 */
export function drawMonitor(g, W, H, { sc, seen, prospective, act, t, wait = -1, spin = 0 }) {
  rr(g, 0, 0, W, H, 18, 'rgba(22,36,78,0.97)', 'rgba(120,160,255,0.35)', 2)
  rr(g, 0, 0, W, 48, 18, 'rgba(53,214,255,0.18)')
  text(g, '電子病歷 · 開立處方', 22, 25, { size: 26, weight: 700, color: '#c6f1ff' })

  if (act < 0.18) {
    text(g, '等待醫囑 …', 22, 112, { size: 30, color: '#9aa9d0' })
    return
  }
  // 右上角徽章：兩種模式一眼可分
  if (prospective) {
    rr(g, W - 178, 8, 164, 32, 16, 'rgba(75,227,160,0.2)', 'rgba(75,227,160,0.9)', 1.5)
    text(g, '⚡ 即時提示', W - 96, 25, { size: 21, weight: 800, color: '#9df5cf', align: 'center' })
  } else if (wait >= 0) {
    rr(g, W - 178, 8, 164, 32, 16, 'rgba(255,196,77,0.2)', 'rgba(255,196,77,0.9)', 1.5)
    text(g, '⏳ 等待結果', W - 96, 25, { size: 21, weight: 800, color: '#ffd98a', align: 'center' })
  } else {
    rr(g, W - 178, 8, 164, 32, 16, 'rgba(255,196,77,0.12)', 'rgba(255,196,77,0.7)', 1.5)
    text(g, '已延遲後回傳', W - 96, 25, { size: 21, weight: 700, color: '#ffd98a', align: 'center' })
  }
  text(g, `醫囑：開立 ${sc.drug}`, 22, 88, { size: 32, weight: 700, color: '#ffd9a0' })

  // 病歷中有沒有基因結果
  if (prospective) {
    text(g, `✓ 病歷已存有 ${sc.gene} 結果（預先檢測）`, 22, 128, { size: 23, color: '#8ff5d0' })
  } else if (wait >= 0) {
    text(g, `✗ 病歷中沒有 ${sc.gene} 結果 → 先送檢`, 22, 128, { size: 23, color: '#ffb8b8' })
    // 轉圈 + 進度條：處方暫時卡住
    const cx = W / 2
    const cy = 216
    g.strokeStyle = 'rgba(160,180,255,0.25)'
    g.lineWidth = 8
    g.beginPath()
    g.arc(cx, cy, 34, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = '#ffc44d'
    g.lineCap = 'round'
    g.beginPath()
    g.arc(cx, cy, 34, spin, spin + Math.PI * 0.9)
    g.stroke()
    g.lineCap = 'butt'
    text(g, '處方暫時卡住，等檢測結果回來 …', W / 2, 288, { size: 26, weight: 700, color: '#ffe0a0', align: 'center' })
    rr(g, 60, 320, W - 120, 14, 7, 'rgba(160,180,255,0.18)')
    rr(g, 60, 320, Math.max(14, (W - 120) * wait), 14, 7, '#ffc44d')
    text(g, '（示意：實際等待時間依檢測方式與機構而異）', W / 2, 362, { size: 19, color: '#9aa9d0', align: 'center' })
    return
  } else {
    text(g, '✓ 結果回來了（反應式：開藥後才送檢）', 22, 128, { size: 23, color: '#8ff5d0' })
  }
  if (act < 0.62) return

  // 決策支援提示
  const hasAlert = !seen.missed
  if (hasAlert) {
    const pulse = 0.6 + 0.4 * Math.sin(t * 5)
    rr(g, 18, 152, W - 36, 232, 16, 'rgba(255,196,77,0.12)', `rgba(255,196,77,${0.55 + 0.35 * pulse})`, 3)
    text(g, '⚠ 藥物-基因提示', 38, 184, { size: 27, weight: 800, color: '#ffd166' })
    text(g, sc.alert.title, 38, 226, { size: 31, weight: 800, color: '#ffffff' })
    sc.alert.lines.forEach((l, i) => text(g, l, 38, 266 + i * 34, { size: 24, color: '#e6ecff' }))
    rr(g, 32, 330, W - 64, 40, 20, 'rgba(75,227,160,0.18)', 'rgba(75,227,160,0.85)', 1.5)
    text(g, '指引建議：' + sc.alert.advice, W / 2, 351, { size: 21, weight: 700, color: '#b6f7dc', align: 'center' })
  } else {
    rr(g, 18, 152, W - 36, 228, 16, 'rgba(255,92,92,0.1)', 'rgba(255,92,92,0.6)', 2.5)
    text(g, '沒有跳出任何提示', 38, 196, { size: 31, weight: 800, color: '#ffd8d8' })
    text(g, '基因結果被判為「正常」，系統照常放行。', 38, 240, { size: 23, color: '#e6ecff' })
    text(g, '但檢測若漏看了結構變異（缺失、重複），', 38, 280, { size: 23, color: '#ffbcbc' })
    text(g, '「正常」只代表沒找到所檢測的變異。', 38, 316, { size: 23, color: '#ffbcbc' })
  }
}

/** ⑥ 處方單（460×531） */
export function drawSheet(g, W, H, { sc, seen, act }) {
  rr(g, 0, 0, W, H, 18, 'rgba(244,247,255,0.97)')
  text(g, '處方（示意）', 26, 44, { size: 36, weight: 800, color: '#1b2450' })
  g.strokeStyle = 'rgba(27,36,80,0.25)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(24, 76)
  g.lineTo(W - 24, 76)
  g.stroke()
  const changed = !seen.missed
  text(g, '原本考慮', 26, 112, { size: 22, color: '#4b567f' })
  text(g, sc.drug, 26, 158, { size: 40, weight: 800, color: changed ? '#7a839e' : '#b04f00', mono: true })
  if (changed && act > 0.3) {
    g.font = `800 40px ${MONO}`
    const dw = g.measureText(sc.drug).width
    const wdt = Math.min(1, (act - 0.3) * 3)
    g.strokeStyle = '#e0364a'
    g.lineWidth = 6
    g.beginPath()
    g.moveTo(20, 158)
    g.lineTo(20 + (dw + 12) * wdt, 158)
    g.stroke()
  }
  if (changed) {
    text(g, '指引建議的調整方向', 26, 216, { size: 22, color: '#4b567f' })
    wrap(g, sc.alt.detail, W - 52, 32, 800)
      .slice(0, 3)
      .forEach((l, i) => text(g, l, 26, 264 + i * 42, { size: 32, weight: 800, color: '#0a6f4b' }))
    text(g, '※ 是否調整、如何調整，', 26, H - 120, { size: 22, color: '#4b567f' })
    text(g, '由醫師綜合判斷。', 26, H - 90, { size: 22, color: '#4b567f' })
  } else {
    wrap(g, '未被提示 → 照原處方開出', W - 52, 30, 800).forEach((l, i) => text(g, l, 26, 226 + i * 40, { size: 30, weight: 800, color: '#b9372a' }))
    text(g, '這就是檢測「漏看」的後果。', 26, 326, { size: 24, color: '#4b567f' })
    text(g, '（示意）', 26, 364, { size: 22, color: '#4b567f' })
  }
  text(g, '病人：請自留一份報告', 26, H - 36, { size: 24, weight: 700, color: '#1b2450' })
}

/** ③ 即時 PCR 擴增曲線 */
export function drawCurves(g, W, H, { cycles, zyg }) {
  text(g, '螢光訊號 vs 循環數（示意）', 18, 26, { size: 25, weight: 700, color: '#bfefff' })
  const L = 46
  const R = W - 16
  const T = 82
  const B = H - 44
  g.strokeStyle = 'rgba(160,180,255,0.4)'
  g.lineWidth = 2
  g.beginPath()
  g.moveTo(L, T)
  g.lineTo(L, B)
  g.lineTo(R, B)
  g.stroke()
  text(g, '循環數', (L + R) / 2, H - 20, { size: 22, color: '#9aa6c4', align: 'center' })
  const curve = (ct, amp, color) => {
    g.strokeStyle = color
    g.lineWidth = 4
    g.beginPath()
    for (let c = 0; c <= cycles; c += 0.5) {
      const v = amp / (1 + Math.exp(-(c - ct) / 1.7))
      const x = L + ((R - L) * c) / 40
      const y = B - (B - T - 6) * v
      if (c === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  curve(23, 1, hex(COLORS.cyan))
  if (zyg === 'het') curve(24.5, 0.9, hex(COLORS.magenta))
  else {
    g.strokeStyle = hex(COLORS.magenta)
    g.globalAlpha = 0.7
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(L, B - 4)
    g.lineTo(L + ((R - L) * cycles) / 40, B - 4)
    g.stroke()
    g.globalAlpha = 1
  }
  // 圖例
  g.fillStyle = hex(COLORS.cyan)
  g.fillRect(18, 51, 16, 16)
  text(g, '探針 A（等位基因 1）', 40, 59, { size: 20, color: '#dfe6ff' })
  g.fillStyle = hex(COLORS.magenta)
  g.fillRect(250, 51, 16, 16)
  text(g, '探針 B（等位基因 2）', 272, 59, { size: 20, color: '#dfe6ff' })
}
