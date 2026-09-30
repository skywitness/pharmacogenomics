// ch10 共用：場景內文字標籤的「窄螢幕放大」工具。
// util.makeLabel 產生的 Sprite 尺寸是世界座標，螢幕越窄、取景越遠，字就越小（手機上只剩 7–9 px）。
// 這裡把每個標籤登記起來，窄螢幕時整體放大；setText 重繪會重設 scale，所以包一層再套用倍率。

export function createLabelKit(ctx) {
  const { util } = ctx
  const items = []
  let boost = 1 // 目前的放大倍率（窄螢幕 > 1）

  const factor = (it) => 1 + (boost - 1) * it.grow
  const apply = (it) => {
    it.sprite.scale.set(it.base.x * factor(it), it.base.y * factor(it), 1)
    // left：讓標籤的左緣固定（放大時往右長，而不是以中心向兩側擴張）
    if (it.left != null) it.sprite.position.x = it.left + it.sprite.scale.x / 2
  }

  return {
    /**
     * 建立標籤。opts 同 util.makeLabel，另可給 grow（0–1，預設 1）：窄螢幕時吃多少比例的放大倍率；left：固定左緣的 x 座標。
     * 節點很密的網路圖用較小的 grow，避免互相遮擋。
     */
    make(text, opts = {}) {
      const { grow = 1, left = null, ...rest } = opts
      const sprite = util.makeLabel(text, rest)
      const it = { sprite, base: sprite.scale.clone(), grow, left }
      const orig = sprite.userData.setText
      sprite.userData.setText = (t) => {
        orig(t)
        it.base.copy(sprite.scale)
        apply(it)
      }
      items.push(it)
      apply(it)
      return sprite
    },
    /** 窄螢幕倍率（1 = 不放大）。 */
    setBoost(k) {
      if (k === boost) return
      boost = k
      items.forEach(apply)
    },
    get boost() {
      return boost
    },
  }
}
