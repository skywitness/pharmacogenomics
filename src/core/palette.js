// 全站「顏色語法」— 所有場景共用，讓讀者在不同章節看到同一種顏色就知道是同一種意思。
// CSS 變數在 style.css 的 :root 內有對應值，請同步修改。

export const COLORS = {
  // 背景 / 版面
  bg: 0x060913,
  bg2: 0x0b1122,
  ink: 0xe8ecf8,
  muted: 0x9aa6c4,

  // 強調色
  cyan: 0x35d6ff,
  magenta: 0xff5c9e,
  green: 0x4be3a0,
  amber: 0xffc44d,
  violet: 0x8f7bff,
  red: 0xff5c5c,
  blue: 0x4aa8ff,

  // 鹼基 A T G C （U 用 T 的顏色偏淡）
  A: 0x4be3a0,
  T: 0xff5c7a,
  U: 0xff9fb0,
  G: 0xffc44d,
  C: 0x4aa8ff,

  // 代謝型 （CPIC 標準用語）  UM 超快速 / RM 快速 / NM 正常 / IM 中間 / PM 不良
  UM: 0xb06bff,
  RM: 0x35d6ff,
  NM: 0x4be3a0,
  IM: 0xffc44d,
  PM: 0xff5c5c,

  // 分子 / 生物結構
  drug: 0xffb347, // 藥物分子（母藥）
  metabolite: 0x7cf2c8, // 代謝產物（活性）
  inactive: 0x8a93ad, // 無活性代謝物 / 無功能
  enzyme: 0x6c8cff, // 酵素 / 蛋白質
  membrane: 0x2b3f7a,
  liver: 0xc8553d,
  blood: 0xe0364a,
  hla: 0x59c2ff,
  tcell: 0xffd166,
  peptide: 0xff7ab6,
}

export const PHENOTYPES = [
  { key: 'UM', zh: '超快速代謝者', en: 'Ultrarapid Metabolizer', color: COLORS.UM },
  { key: 'RM', zh: '快速代謝者', en: 'Rapid Metabolizer', color: COLORS.RM },
  { key: 'NM', zh: '正常代謝者', en: 'Normal Metabolizer', color: COLORS.NM },
  { key: 'IM', zh: '中間代謝者', en: 'Intermediate Metabolizer', color: COLORS.IM },
  { key: 'PM', zh: '不良代謝者', en: 'Poor Metabolizer', color: COLORS.PM },
]

export const NUCLEOTIDES = ['A', 'T', 'G', 'C']
export const PAIR = { A: 'T', T: 'A', G: 'C', C: 'G' }

/** 0xRRGGBB -> '#rrggbb' */
export const hex = (n) => '#' + n.toString(16).padStart(6, '0')

// 難易度層級（由淺入深）
export const LEVELS = {
  1: { key: 'L1', zh: '入門', en: 'Foundations', color: COLORS.green },
  2: { key: 'L2', zh: '初階', en: 'Core concepts', color: COLORS.cyan },
  3: { key: 'L3', zh: '中階', en: 'Mechanisms & cases', color: COLORS.violet },
  4: { key: 'L4', zh: '進階', en: 'Practice & frontiers', color: COLORS.magenta },
}
