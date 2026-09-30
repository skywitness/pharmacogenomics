// ch05 的「示意用」一室藥動學模型（含一階吸收）。
// 這裡的所有速率常數、劑量單位都是為了教學而挑的示意值，不是任何真實藥物或真實族群的數據。
//
//   Ag' = -ka·Ag                         （腸道待吸收量）
//   Cp' = ka·Ag - (kc·act + ko)·Cp       （母藥；kc·act 是經 CYP 的清除，ko 是其他途徑）
//   Cm' = kc·act·Cp - km·Cm              （代謝物）
//
// act = 「有功能的酵素活性」相對於正常代謝者（NM = 1.0）。

export const HOURS = 72
export const TAU = 12 // 每 12 小時服藥一次
export const DOSE_TIMES = [0, 12, 24, 36, 48, 60]
export const DT = 0.1 // 取樣間隔（小時）
export const N = Math.round(HOURS / DT) + 1

export const ACT = { UM: 2.0, RM: 1.4, NM: 1.0, IM: 0.5, PM: 0.03 } // PM 留一點點殘餘活性（示意）
export const KEYS = ['UM', 'RM', 'NM', 'IM', 'PM']
export const WINDOW = { lo: 0.12, hi: 0.34 } // 治療窗（示意單位）
export const YMAX = 0.9

const KA = 1.6
export const KINDS = {
  // 活性藥：母藥本身有效，CYP 把它清掉（轉成無活性代謝物）
  active: { kc: 0.13, ko: 0.025, km: 0.25, sm: 1, D: 0.3 },
  // 前驅藥：母藥沒活性，CYP 把一小部分轉成活性代謝物（其餘走別的途徑排掉，如同 clopidogrel 大部分被 CES1 水解）
  prodrug: { kc: 0.05, ko: 0.25, km: 0.35, sm: 9.5, D: 0.55 },
}

/** 併用藥物對活性的影響：強效抑制劑→視為不良代謝者；中效→活性減半（CPIC 2021 鴉片類指引的做法）；誘導劑→示意 ×1.5 */
export function effAct(base, mod) {
  if (mod === 'strong') return Math.min(base, ACT.PM)
  if (mod === 'moderate') return base * 0.5
  if (mod === 'inducer') return base <= 0.05 ? base : Math.min(base * 1.5, 2.4)
  return base
}

export function classifyAct(a) {
  if (a <= 0.06) return 'PM'
  if (a < 0.75) return 'IM'
  if (a < 1.2) return 'NM'
  if (a < 1.7) return 'RM'
  return 'UM'
}

/** 回傳 { cp, cm } 兩個長度 N 的 Float32Array（cm 已乘上顯示比例 sm）。*/
export function simulate(kind, act, dose = 1) {
  const P = KINDS[kind]
  const cp = new Float32Array(N)
  const cm = new Float32Array(N)
  const h = 0.02
  const sub = Math.round(DT / h)
  let ag = 0
  let p = 0
  let m = 0
  const kc = P.kc * act
  for (let i = 0; i < N; i++) {
    const t = i * DT
    if (DOSE_TIMES.some((d) => Math.abs(d - t) < 1e-6)) ag += P.D * dose
    cp[i] = p
    cm[i] = m * P.sm
    for (let s = 0; s < sub; s++) {
      const dag = -KA * ag
      const dp = KA * ag - (kc + P.ko) * p
      const dm = kc * p - P.km * m
      ag += dag * h
      p += dp * h
      m += dm * h
    }
  }
  return { cp, cm }
}

/** 取「第 5 個給藥週期（48–60 小時）」判定該基因型/併用藥物的落點。*/
export function zoneOf(series, kind) {
  const arr = kind === 'active' ? series.cp : series.cm
  const a = Math.round(48 / DT)
  const b = Math.round(60 / DT)
  let sum = 0
  let max = 0
  for (let i = a; i < b; i++) {
    sum += arr[i]
    if (arr[i] > max) max = arr[i]
  }
  const mean = sum / (b - a)
  let zone = 'in'
  if (mean < WINDOW.lo) zone = 'low'
  else if (mean > WINDOW.hi) zone = 'high'
  else if (max > WINDOW.hi) zone = 'peak'
  return { zone, mean, max }
}

export function sample(arr, tHours) {
  const f = Math.min(Math.max(tHours / DT, 0), N - 1)
  const i = Math.floor(f)
  const j = Math.min(i + 1, N - 1)
  return arr[i] + (arr[j] - arr[i]) * (f - i)
}
