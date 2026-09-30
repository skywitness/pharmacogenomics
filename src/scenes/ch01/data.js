// ch01 場景用的「模擬示意」資料。
// 重要：這裡的 60 位對象與他們的結果全部是程式產生的示意資料（固定亂數種子，每次相同），
// 不是任何真實研究的統計。目的只是讓讀者「看見」：同一顆藥、不同的人，結果可以很不一樣；
// 以及用不同因素把人分組時，結果被分得多乾淨。
import { COLORS } from '../../core/palette.js'
import { rng } from '../../core/util.js'

export const N = 60

/** 結果：0 有效 / 1 沒效 / 2 嚴重副作用 */
export const OUT = [
  { key: 'good', label: '有效', color: COLORS.green, mark: '◯' },
  { key: 'none', label: '沒效', color: 0xbfb98f, mark: '▬' },
  { key: 'bad', label: '嚴重副作用', color: COLORS.red, mark: '▲' },
]

/** 各因素的分組名稱（示意）。 */
export const FACTORS = {
  none: { label: '無（不分組）', short: '不分組', groups: [] },
  age: { label: '年齡', short: '年齡', groups: ['年輕族群', '中年族群', '年長族群'], field: 'age', weights: [[0.42, 0.38, 0.2], [0.3, 0.3, 0.4], [0.12, 0.3, 0.58]] },
  weight: { label: '體重', short: '體重', groups: ['體重偏輕', '體重中等', '體重偏重'], field: 'weight', weights: [[0.26, 0.5, 0.24], [0.16, 0.34, 0.5], [0.5, 0.36, 0.14]] },
  organ: { label: '肝腎功能', short: '肝腎功能', groups: ['肝腎功能正常', '肝腎功能較弱'], field: 'organ', weights: [[0.82, 0.18], [0.72, 0.28], [0.42, 0.58]] },
  comed: { label: '併用藥物', short: '併用藥物', groups: ['只吃這顆藥', '同時吃其他藥'], field: 'comed', weights: [[0.78, 0.22], [0.56, 0.44], [0.5, 0.5]] },
  geno: { label: '基因型', short: '基因型', groups: ['基因型甲', '基因型乙', '基因型丙'], field: 'geno' },
}
export const FACTOR_KEYS = ['none', 'age', 'weight', 'organ', 'comed', 'geno']

// 基因型 → 結果的配額（刻意留下少數例外，不是 100% 乾淨）
//            有效 沒效 副作用
const GENO_QUOTA = [
  [27, 3, 2], // 甲 32 人
  [3, 12, 3], // 乙 18 人
  [1, 1, 8], // 丙 10 人
]

const wpick = (r, w) => {
  let x = r() * w.reduce((a, b) => a + b, 0)
  for (let i = 0; i < w.length; i++) {
    x -= w[i]
    if (x <= 0) return i
  }
  return w.length - 1
}

/** 分群清楚度：各組中「占多數的結果」人數加總 / 總人數（全體不分組時為最大類別占比）。*/
export function purity(people, factorKey, outOf = (p) => p.out0) {
  if (factorKey === 'none') {
    const c = [0, 0, 0]
    people.forEach((p) => c[outOf(p)]++)
    return Math.max(...c) / people.length
  }
  const f = FACTORS[factorKey]
  const groups = f.groups.map(() => [0, 0, 0])
  people.forEach((p) => groups[p[f.field]][outOf(p)]++)
  return groups.reduce((s, c) => s + Math.max(...c), 0) / people.length
}

function build(seed) {
  const r = rng(seed)
  const people = []
  let id = 0
  GENO_QUOTA.forEach((q, geno) => {
    q.forEach((cnt, out) => {
      for (let k = 0; k < cnt; k++) people.push({ id: id++, geno, out0: out })
    })
  })
  for (const p of people) {
    for (const key of ['age', 'weight', 'organ', 'comed']) {
      const f = FACTORS[key]
      p[f.field] = wpick(r, f.weights[p.out0])
    }
  }
  // 洗牌（讓編號與分組無關）
  for (let i = people.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[people[i], people[j]] = [people[j], people[i]]
  }
  people.forEach((p, i) => (p.id = i))
  return people
}

function acceptable(people) {
  const pg = purity(people, 'geno')
  const others = ['age', 'weight', 'organ', 'comed'].map((k) => purity(people, k))
  const okSizes = ['age', 'weight', 'organ', 'comed'].every((k) => {
    const f = FACTORS[k]
    const cnt = f.groups.map(() => 0)
    people.forEach((p) => cnt[p[f.field]]++)
    return Math.min(...cnt) >= 8
  })
  return okSizes && Math.max(...others) < 0.68 && Math.min(...others) > 0.55 && pg - Math.max(...others) > 0.1
}

let cache = null
/** 回傳 60 位示意對象。每位：{id, age, weight, organ, comed, geno, out0, out1, flip}。out1 = 「依基因型個別化用藥」後的（示意）結果。*/
export function makePeople() {
  if (cache) return cache
  let people
  for (let seed = 1; seed < 400; seed++) {
    people = build(seed)
    if (acceptable(people)) break
  }
  // 個別化（示意假設）：基因型乙、丙中原本沒效/副作用者，有一部分在調整用藥後改善。
  const r = rng(99)
  const cand = people.filter((p) => p.geno > 0 && p.out0 !== 0)
  cand.sort(() => r() - 0.5)
  const flipIds = new Set(cand.slice(0, 10).map((p) => p.id))
  people.forEach((p) => {
    p.flip = flipIds.has(p.id)
    p.out1 = p.flip ? 0 : p.out0
  })
  cache = people
  return people
}

export const AGE_TXT = ['年輕', '中年', '年長']
export const WEIGHT_TXT = ['偏輕', '中等', '偏重']
export const ORGAN_TXT = ['正常', '較弱']
export const COMED_TXT = ['無', '有']
export const GENO_TXT = ['甲', '乙', '丙']
