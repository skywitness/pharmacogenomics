// ch03 場景資料：基因、等位基因功能、雙倍型 → 表現型 的對應。
// 來源：CPIC 資料庫（2026-09-29 擷取）——CYP2C19 雙倍型表（研究庫 molecular-basics-30）、
// CYP2C9 活性值與分數（molecular-basics-31）；星號變異定義見 molecular-basics-21/23/24。
// 「酵素分子數」為教學示意，不是實測量。
import { COLORS } from '../../core/palette.js'

export const CHROM_COL = { mom: 0xff86b6, dad: 0x62c8ff }

export const FN = {
  normal: { zh: '正常功能', short: '正常', color: COLORS.NM },
  decreased: { zh: '功能降低', short: '降低', color: COLORS.IM },
  none: { zh: '無功能', short: '無功能', color: COLORS.inactive },
  increased: { zh: '功能增加', short: '增加', color: COLORS.UM },
}

export const PH = {
  UM: { zh: '超快速代謝者', short: '超快速', en: 'Ultrarapid', color: COLORS.UM },
  RM: { zh: '快速代謝者', short: '快速', en: 'Rapid', color: COLORS.RM },
  NM: { zh: '正常代謝者', short: '正常', en: 'Normal', color: COLORS.NM },
  IM: { zh: '中間代謝者', short: '中間', en: 'Intermediate', color: COLORS.IM },
  PM: { zh: '不良代謝者', short: '不良', en: 'Poor', color: COLORS.PM },
}

export const css = (n) => '#' + n.toString(16).padStart(6, '0')

export const GENES = {
  CYP2C19: {
    key: 'CYP2C19',
    kind: 'category', // 直接由「兩個等位基因的功能類別」決定表現型（CPIC 不用活性分數）
    alleles: {
      '*1': { id: '*1', fn: 'normal', act: 1, variant: '預設型（未偵測到已定義變異）', chip: '預設型', how: '正常轉錄、正常剪接，做出完整的酵素' },
      '*2': { id: '*2', fn: 'none', act: 0, variant: 'c.681G>A', chip: 'c.681G>A', how: '剪接缺陷，做出截短、無功能的蛋白質' },
      '*3': { id: '*3', fn: 'none', act: 0, variant: 'c.636G>A', chip: 'c.636G>A', how: '提早出現終止密碼子，蛋白質截短' },
      '*17': { id: '*17', fn: 'increased', act: 1.5, variant: 'c.-806C>T', chip: 'c.-806C>T', how: '調控區變異，轉錄增加，酵素變多' },
    },
    order: ['*1', '*2', '*3', '*17'],
    ladder: ['PM', 'IM', 'NM', 'RM', 'UM'],
  },
  CYP2C9: {
    key: 'CYP2C9',
    kind: 'score', // 活性分數：兩個等位基因的活性值相加
    alleles: {
      '*1': { id: '*1', fn: 'normal', act: 1, variant: '預設型', chip: '預設型', how: '完整功能，活性值 1.0' },
      '*2': { id: '*2', fn: 'decreased', act: 0.5, variant: '錯義變異', chip: '錯義變異', how: '胺基酸被取代，活性值 0.5' },
      '*3': { id: '*3', fn: 'none', act: 0, variant: '錯義變異', chip: '錯義變異', how: '胺基酸被取代，活性值 0.0' },
    },
    order: ['*1', '*2', '*3'],
    ladder: ['PM', 'PM', 'IM', 'IM', 'NM'], // 分數 0、0.5、1.0、1.5、2.0
  },
}

const starNum = (id) => Number(String(id).replace('*', ''))

/** 依星號數字排序，雙倍型慣例寫小的在前。 */
export const sortPair = (a, b) => (starNum(a) <= starNum(b) ? [a, b] : [b, a])
export const dipLabel = (a, b) => sortPair(a, b).join('/')

/** 某基因的雙倍型 → { key: 'IM', score?: 1.5, parts: '...' } */
export function phenotypeOf(geneKey, a, b) {
  const gene = GENES[geneKey]
  const A = gene.alleles[a]
  const B = gene.alleles[b]
  if (gene.kind === 'score') {
    const score = A.act + B.act
    const key = score >= 2 ? 'NM' : score >= 1 ? 'IM' : 'PM'
    return { key, score, parts: `${A.act.toFixed(1)} + ${B.act.toFixed(1)} = ${score.toFixed(1)}` }
  }
  const fns = [A.fn, B.fn]
  const nNone = fns.filter((f) => f === 'none').length
  const nInc = fns.filter((f) => f === 'increased').length
  let key
  if (nNone === 2) key = 'PM'
  else if (nNone === 1) key = 'IM'
  else if (nInc === 2) key = 'UM'
  else if (nInc === 1) key = 'RM'
  else key = 'NM'
  return { key, parts: `${FN[A.fn].short} + ${FN[B.fn].short}` }
}

/** 所有不重複雙倍型（給下拉選單）。 */
export function allDiplotypes(geneKey) {
  const ids = GENES[geneKey].order
  const out = []
  for (let i = 0; i < ids.length; i++) for (let j = i; j < ids.length; j++) out.push([ids[i], ids[j]])
  return out
}

/** 某等位基因在酵素工廠中的示意分子數：有功能的、殘缺的。 */
export function enzymeCounts(geneKey, alleleId) {
  const al = GENES[geneKey].alleles[alleleId]
  const working = Math.round(6 * al.act)
  const broken = Math.max(0, 6 - working)
  return { working, broken }
}

/** 哈迪-溫伯格：給對偶基因頻率 q → 三種基因型比例。 */
export function hardyWeinberg(q) {
  const p = 1 - q
  return { p, p2: p * p, pq2: 2 * p * q, q2: q * q }
}
