// ch04 的示意藥動學模型（一室、一階吸收與排除、簡化肝臟 well-stirred 首渡）。
// 全部數值都是「教學示意」，不對應任何真實藥物。
// 時間單位：小時。濃度單位：示意單位（基準口服曲線的峰值定為 0.9）。

export const T_END = 12 // 圖表與動畫的總時間
export const LAG = 0.9 // 口服的延遲時間（藥丸崩解 + 胃排空），小時
export const KA = 1.2 // 口服吸收速率常數 /小時
export const KIV = 3.0 // 靜脈點滴（約 1 小時內注入）的等效輸入速率 /小時
export const L_PORTAL = 0.3 // 顆粒穿過腸壁 → 門靜脈 → 肝臟所需的視覺時間（小時）
export const L_IV = 0.2 // 點滴從手臂靜脈到心臟的視覺時間（小時）
export const T_BREAK = 0.3 // 藥丸在胃裡崩解成顆粒的時間

export const WIN_LO = 0.6 // 治療窗下緣（示意）
export const WIN_HI = 1.1 // 治療窗上緣（示意）
export const Y_MAX = 1.7 // 圖表縱軸上限

const Q = 90 // 肝血流量（示意 L/小時）
const CL_R = 6 // 腎清除率（示意 L/小時）
const E0 = 0.5 // 基準肝臟萃取率
const T_HALF0 = 4 // 基準半衰期（小時）
const K_INT = E0 / (1 - E0) // CLint / Q（基準）

function hep(r) {
  const E = (K_INT * r) / (1 + K_INT * r) // well-stirred:E = CLint / (Q + CLint)
  return { E, CLh: Q * E }
}
const h1 = hep(1)
const V = (T_HALF0 * (h1.CLh + CL_R)) / Math.LN2

function shape(ka, ke, tau) {
  if (tau <= 0) return 0
  return (ka / (ka - ke)) * (Math.exp(-ke * tau) - Math.exp(-ka * tau))
}
function peakOf(F, dose, ka, ke) {
  const tp = Math.log(ka / ke) / (ka - ke)
  return F * dose * shape(ka, ke, tp)
}
const SCALE = 0.9 / peakOf(1 - h1.E, 1, KA, (h1.CLh + CL_R) / V)

/** r：肝臟代謝速率（相對值，0.5–2）；route:'oral' | 'iv' */
export function model(r, route) {
  const { E, CLh } = hep(r)
  const oral = route !== 'iv'
  const CL = CLh + CL_R
  const ke = CL / V
  const ka = oral ? KA : KIV
  const lag = oral ? LAG : 0
  const F = oral ? 1 - E : 1
  const dose = oral ? 1 : 1 - h1.E // 靜脈劑量設為「基準口服實際進入血液的量」，使基準的 AUC 相同，方便比較
  const conc = (t) => SCALE * F * dose * shape(ka, ke, t - lag)
  const tmax = lag + Math.log(ka / ke) / (ka - ke)
  return { r, route: oral ? 'oral' : 'iv', E, F, fH: CLh / CL, ke, ka, lag, dose, tHalf: Math.LN2 / ke, tmax, cmax: conc(tmax), auc: (SCALE * F * dose) / ke, conc }
}

export function zone(c) {
  return c < WIN_LO ? 'low' : c > WIN_HI ? 'high' : 'ok'
}

/** 指數分布的分位數（u 0..1），尾端截在 98.5% 以免出現極端值 */
export const expQ = (u, k) => -Math.log(1 - 0.985 * u) / k
