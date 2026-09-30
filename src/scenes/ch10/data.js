// ch10 場景用的資料與小型模擬。
// 【重要】曼哈頓圖的每一根柱子、AI 散布圖的每個點都是「示意」：由固定亂數種子程式產生，
//   不是任何真實 GWAS 的資料。真實數字（樣本數、P 值、比例）只出現在文字與 tooltip，並附出處。

import { rng } from '../../core/util.js'

// ───────── GWAS 曼哈頓景觀 ─────────

/** 全基因體顯著門檻 5×10^-8 → −log10 p ≈ 7.3（GWAS 的通用慣例） */
export const GW_THRESHOLD = 7.3

/** 染色體 1–22、X 的大致相對長度（Mb，取整數，僅用來決定版面寬度） */
export const CHROMS = [
  ['1', 248], ['2', 242], ['3', 198], ['4', 190], ['5', 181], ['6', 171], ['7', 159], ['8', 145],
  ['9', 138], ['10', 134], ['11', 135], ['12', 133], ['13', 114], ['14', 107], ['15', 102], ['16', 90],
  ['17', 83], ['18', 80], ['19', 59], ['20', 64], ['21', 47], ['22', 51], ['X', 156],
]

/** 每 11 Mb 一根柱子（示意的「位點」） */
export const BIN_MB = 11

/**
 * 三種性狀（全部為示意設定）。
 *  n0      : 進入這個性狀時預設的「研究人數」（示意）
 *  loci    : 位置 = 染色體代號 + 該染色體上的相對位置（0–1）；r2 = 示意效應量（此位點解釋的變異比例）
 *  bg      : 許多微小效應位點的數量與效應量分布（多基因的「背景丘陵」）
 */
export const TRAITS = {
  warfarin: {
    label: '華法林劑量',
    // r2 皆為示意的相對大小，並非文獻數字（CPIC 2017 引用的歐洲族群上限約為 CYP2C9 18%、VKORC1 30%、CYP4F2 11%）
    n0: 300,
    note: '少數大效應基因 + 一個小效應基因',
    loci: [
      { gene: 'VKORC1', chr: '16', pos: 0.32, r2: 0.3, size: 'big' },
      { gene: 'CYP2C9', chr: '10', pos: 0.53, r2: 0.12, size: 'mid' },
      { gene: 'CYP4F2', chr: '19', pos: 0.17, r2: 0.036, size: 'small' },
    ],
    bg: { count: 0 },
  },
  statin: {
    label: '史他汀肌病',
    n0: 175,
    note: '單一大效應變異，小樣本就看得見',
    loci: [{ gene: 'SLCO1B1', chr: '12', pos: 0.21, r2: 0.194, size: 'big' }],
    bg: { count: 0 },
  },
  antidep: {
    label: '抗憂鬱藥療效',
    n0: 3000,
    note: '許多微小效應，幾乎沒有高峰',
    loci: [],
    bg: { count: 60, r2Lo: 1e-5, r2Hi: 1.6e-4 },
  },
}

/** 卡方統計量 → −log10 p（單自由度的常態尾端近似；示意用） */
export function nlogP(chi2) {
  if (chi2 < 4) return 0.3175 * chi2
  return chi2 / (2 * Math.LN10) + 0.5 * Math.log10(chi2) + 0.098
}

/**
 * 建立（固定亂數）的基因體版面：回傳每一根柱子的染色體、位置與 null 噪音。
 * 版面座標：x 從 0 到 total（單位 = 柱子數）。
 */
export function buildGenome() {
  const r = rng(20260929)
  const bins = []
  const chromInfo = []
  let idx = 0
  for (const [name, mb] of CHROMS) {
    const n = Math.max(4, Math.round(mb / BIN_MB))
    const start = idx
    for (let i = 0; i < n; i++) {
      // 在 null 假設下 p 值均勻分布 → −log10 p 呈指數分布
      const u = Math.max(1e-6, r())
      bins.push({ chr: name, k: i, noise: Math.min(3.4, -Math.log10(u)) * 0.85, r2: 0, gene: null })
      idx++
    }
    chromInfo.push({ name, start, count: n })
  }
  return { bins, chromInfo, total: idx }
}

/** 位點在整個版面上的柱子 index */
export function locusIndex(genome, chr, pos) {
  const c = genome.chromInfo.find((x) => x.name === chr)
  return c.start + Math.min(c.count - 1, Math.round(pos * (c.count - 1)))
}

/** 每根柱子的「連鎖」擴散：一個位點的峰會向鄰近位置以高斯形狀遞減 */
export const LD_SIGMA = 1.4

/** 把某性狀的 r2 佈到柱子上；回傳每根柱子的有效 r2 與所屬基因 */
export function layoutTrait(genome, traitKey) {
  const t = TRAITS[traitKey]
  const n = genome.total
  const r2 = new Float32Array(n)
  const gene = new Array(n).fill(null)
  for (const L of t.loci) {
    const c = locusIndex(genome, L.chr, L.pos)
    for (let d = -6; d <= 6; d++) {
      const j = c + d
      if (j < 0 || j >= n) continue
      const w = Math.exp(-(d * d) / (2 * LD_SIGMA * LD_SIGMA))
      if (L.r2 * w > r2[j]) {
        r2[j] = L.r2 * w
        if (d === 0) gene[j] = L.gene
      }
    }
  }
  if (t.bg.count) {
    const r = rng(777)
    for (let i = 0; i < t.bg.count; i++) {
      const j = Math.floor(r() * n)
      const v = Math.exp(Math.log(t.bg.r2Lo) + r() * (Math.log(t.bg.r2Hi) - Math.log(t.bg.r2Lo)))
      for (let d = -2; d <= 2; d++) {
        const k = j + d
        if (k < 0 || k >= n) continue
        const w = Math.exp(-(d * d) / 2)
        r2[k] = Math.max(r2[k], v * w)
      }
    }
  }
  return { r2, gene }
}

/** 給定樣本數 n，某柱子的示意 −log10 p */
export function binNl(noise, r2, n) {
  const chi2 = 1 + n * r2
  const sig = nlogP(chi2)
  // 噪音與訊號合成：訊號存在時取兩者較大並略加噪音，維持地形的自然起伏
  return Math.max(noise * 0.9, sig + noise * 0.12)
}

/** 太高的峰以「壓縮」方式顯示（y 軸標示提醒） */
export const NL_KNEE = 12
export const NL_MAX_DISPLAY = 17
export function displayNl(nl) {
  if (nl <= NL_KNEE) return nl
  return Math.min(NL_MAX_DISPLAY, NL_KNEE + (nl - NL_KNEE) * 0.12)
}

// ───────── 族群多樣性（GWAS Diversity Monitor，資料檢查日 2026-09-16） ─────────
export const DIVERSITY = [
  { key: 'eu', label: '歐洲血統', pct: 88.18 },
  { key: 'as', label: '亞洲', pct: 6.17 },
  { key: 'aa', label: '非裔美國人/加勒比非裔', pct: 2.75 },
  { key: 'oth', label: '其他/混合', pct: 1.33 },
  { key: 'his', label: '西語/拉丁美洲', pct: 1.28 },
  { key: 'af', label: '非洲', pct: 0.28 },
]
export const DIVERSITY_DATE = '2026-09-16'

/** 最大餘數法：把百分比分配到 total 個方塊（每格 = 100/total %） */
export function allocateCells(items, total) {
  const raw = items.map((it) => (it.pct / 100) * total)
  const base = raw.map(Math.floor)
  let left = total - base.reduce((a, b) => a + b, 0)
  const order = raw.map((v, i) => [v - base[i], i]).sort((a, b) => b[0] - a[0])
  for (let k = 0; left > 0; k++, left--) base[order[k % order.length][1]]++
  return base
}

// ───────── 生物資料庫（數字來自事實庫 frontiers-05 / 43 / 44） ─────────
export const BIOBANKS = [
  {
    key: 'tpmi',
    name: '台灣精準醫療計畫 TPMI',
    short: 'TPMI',
    n: 565390,
    color: 0xff5c9e,
    tech: '漢人族群最佳化的 SNP 晶片，可連結電子病歷',
    tip: '中央研究院與 16 家醫學中心合作，已招募 <b>565,390</b> 人（Nature 2025 報告）。使用針對漢人族群最佳化的 SNP 晶片，並可連結電子病歷研究疾病風險與藥物反應。晶片不等於全基因體定序。',
  },
  {
    key: 'twb',
    name: '台灣人體生物資料庫',
    short: 'Taiwan Biobank',
    n: 103106,
    color: 0xffc44d,
    tech: '客製化 SNP 晶片（另有 1,492 人高覆蓋度全基因體定序）',
    tip: '一項研究以客製化 SNP 晶片分析 <b>103,106</b> 名漢人，報告約 87.3% 的人帶有已知的功能性藥物反應變異。「帶有」不等於臨床上需要調整處方；比例受晶片內容與定義左右。',
  },
  {
    key: 'aou',
    name: 'All of Us（美國）',
    short: 'All of Us',
    n: 245388,
    color: 0x35d6ff,
    tech: '臨床等級全基因體定序（2024 年釋出）',
    tip: '2024 年釋出 <b>245,388</b> 名參與者的全基因體序列，其中 77% 來自歷史上在生醫研究中代表性不足的群體、46% 為種族或族裔少數；並承諾回傳包含藥物基因的個人結果。',
  },
  {
    key: 'ukb',
    name: '英國生物資料庫 UK Biobank',
    short: 'UK Biobank',
    n: 500000,
    color: 0x8f7bff,
    tech: '約 50 萬名 40–69 歲參與者；以歐洲血統為主',
    tip: '約有 <b>50 萬</b>名 40–69 歲的參與者；參與者以歐洲血統為主（族群組成依 Fatumo 等人 2022 的描述）。',
  },
]
