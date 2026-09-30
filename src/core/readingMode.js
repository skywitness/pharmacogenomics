// 閱讀模式：手機/平板上把 3D 動畫區收起來，讓文字佔滿畫面。
// 偏好會記在 localStorage（讀不到就當作關閉），全站共用：在任一章切換，所有章節都套用。
// 只有版面 ≤1100px（手機/平板）時才會真的收起；桌機忽略這個偏好。

const KEY = 'pgx.reading.v1'
let on = false
try {
  on = localStorage.getItem(KEY) === '1'
} catch {
  /* 隱私模式等情況讀不到，維持預設 */
}
const subs = new Set()

export const readingMode = {
  get: () => on,
  set(v) {
    v = !!v
    if (v === on) return
    on = v
    try {
      localStorage.setItem(KEY, v ? '1' : '0')
    } catch {
      /* ignore */
    }
    subs.forEach((f) => f(on))
  },
  toggle() {
    this.set(!on)
  },
  subscribe(fn) {
    subs.add(fn)
    return () => subs.delete(fn)
  },
}
