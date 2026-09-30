// ch07 的版面輔助：
//  1. createFit：量測 HUD（上方按鈕列 / 圖例 / 圖說）之後，用 camera.setViewOffset 把「主體」縮放並置中到不被遮住的安全區。
//     （手機的舞台很矮，圖說會吃掉三分之一，不做這件事主體一定被遮住。）
//  2. createLabels:DOM 標籤 + SVG 引線，窄螢幕自動換短字並只顯示核心標籤，同側標籤會互相推開避免重疊。

const SVG_NS = 'http://www.w3.org/2000/svg'

export function createFit(ctx) {
  const { camera, view, util } = ctx
  const hudRoot = view.querySelector('.stage-hud')
  const q = (s) => (hudRoot ? hudRoot.querySelector(s) : null)
  const elTop = q('.hud-top')
  const elLegend = q('.hud-legend')
  const elCap = q('.hud-caption')

  const region = { y0: 46, y1: 330, W: 0, H: 0, dirty: true }
  const fit = { s: 1, cy: 0, ready: false }
  const applied = { s: -1, cy: -1, W: 0, H: 0 }

  function measure(H) {
    let y0 = 44
    if (elTop) y0 = elTop.offsetTop + elTop.offsetHeight + 6
    let bottomEl = null
    if (elLegend && !elLegend.hidden) bottomEl = elLegend
    else if (elCap && !elCap.hidden) bottomEl = elCap
    const y1 = bottomEl ? bottomEl.offsetTop - 6 : H - 10
    region.y0 = y0
    region.y1 = Math.max(y0 + 80, y1)
    region.dirty = false
  }

  return {
    region,
    markDirty() {
      region.dirty = true
    },
    invalidate() {
      applied.W = 0
    },
    /** subj: 這個畫面「未縮放時」主體占用的像素 {w,h};padY = 上下需要另外保留給標籤的固定像素（不隨縮放） */
    update(dt, subj) {
      const W = view.clientWidth
      const H = view.clientHeight
      if (!W || !H) return
      if (region.dirty || W !== region.W || H !== region.H) {
        measure(H)
        region.W = W
        region.H = H
      }
      const rw = W - 20
      const rh = region.y1 - region.y0
      const sT = Math.min(1, rw / Math.max(1, subj.w), Math.max(20, rh - (subj.padY || 0)) / Math.max(1, subj.h))
      const cyT = (region.y0 + region.y1) / 2
      if (!fit.ready) {
        fit.s = sT
        fit.cy = cyT
        fit.ready = true
      } else {
        fit.s = util.damp(fit.s, sT, 6, dt)
        fit.cy = util.damp(fit.cy, cyT, 6, dt)
      }
      if (Math.abs(fit.s - applied.s) > 0.0005 || Math.abs(fit.cy - applied.cy) > 0.05 || W !== applied.W || H !== applied.H) {
        const FW = W * fit.s
        const FH = H * fit.s
        camera.setViewOffset(FW, FH, (FW - W) / 2, FH / 2 - fit.cy, W, H)
        applied.s = fit.s
        applied.cy = fit.cy
        applied.W = W
        applied.H = H
      }
    },
    dispose() {
      camera.clearViewOffset()
    },
  }
}

export function createLabels(ctx, region) {
  const { view, camera } = ctx
  const layer = document.createElement('div')
  layer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;'
  layer.setAttribute('aria-hidden', 'true')
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', '100%')
  svg.setAttribute('height', '100%')
  svg.style.cssText = 'position:absolute;inset:0;overflow:visible'
  layer.append(svg)
  const hudEl = view.querySelector('.stage-hud')
  if (hudEl) view.insertBefore(layer, hudEl)
  else view.append(layer)

  const list = []
  function add(key, o) {
    const el = document.createElement('div')
    const color = o.color || '#e8ecf8'
    el.style.cssText = `position:absolute;left:0;top:0;white-space:nowrap;line-height:1.25;font-weight:600;padding:3px 9px;border-radius:999px;color:#eef2ff;background:rgba(6,9,19,0.84);border:1px solid ${color};box-shadow:0 0 10px ${color}55;opacity:0;transition:opacity .35s;will-change:transform;`
    const ln = document.createElementNS(SVG_NS, 'line')
    ln.setAttribute('stroke', color)
    ln.setAttribute('stroke-width', '1.2')
    ln.setAttribute('stroke-opacity', '0.75')
    ln.style.transition = 'opacity .35s'
    ln.style.opacity = '0'
    svg.append(ln)
    layer.append(el)
    const L = { key, el, ln, side: 'r', gap: 22, dy: 0, core: false, w: 0, h: 0, shown: false, cur: '', ...o }
    list.push(L)
    return L
  }

  function update(getTextSize) {
    const W = view.clientWidth
    const narrow = W < 520
    const items = []
    for (const l of list) {
      const want = !!l.on() && (!narrow || l.core)
      if (want !== l.shown) {
        l.shown = want
        l.el.style.opacity = want ? '1' : '0'
        l.ln.style.opacity = want ? '1' : '0'
      }
      if (!want) continue
      const txt = narrow && l.short ? l.short : typeof l.text === 'function' ? l.text() : l.text
      if (txt !== l.cur) {
        l.cur = txt
        l.el.textContent = txt
        l.el.style.fontSize = narrow ? '11px' : '12px'
        l.w = l.el.offsetWidth
        l.h = l.el.offsetHeight
      }
      const p = ctx.project(l.anchor())
      const gap = narrow ? Math.round(l.gap * 0.55) : l.gap
      let lx = p.x
      let ly = p.y + l.dy
      if (l.side === 'r') lx += l.w / 2 + gap
      else if (l.side === 'l') lx -= l.w / 2 + gap
      else if (l.side === 't') ly -= l.h / 2 + gap
      else ly += l.h / 2 + gap
      items.push({ l, px: p.x, py: p.y, cx: lx, cy: ly })
    }
    // 互相推開
    items.sort((a, b) => a.cy - b.cy)
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const a = items[i]
          const b = items[j]
          const ox = Math.abs(a.cx - b.cx) < (a.l.w + b.l.w) / 2 + 4
          const oy = Math.abs(a.cy - b.cy) < (a.l.h + b.l.h) / 2 + 3
          if (ox && oy) b.cy = a.cy + (a.l.h + b.l.h) / 2 + 3
        }
      }
    }
    for (const it of items) {
      const { l } = it
      const cx = Math.min(Math.max(it.cx, l.w / 2 + 4), W - l.w / 2 - 4)
      // 標籤不可進入下方圖例/圖說區：下限是安全區底線
      const cy = Math.min(Math.max(it.cy, region.y0 + l.h / 2 - 4), Math.max(region.y0 + l.h / 2, region.y1 - l.h / 2 - 2))
      l.el.style.transform = `translate(${cx - l.w / 2}px,${cy - l.h / 2}px)`
      l.ln.setAttribute('x1', it.px)
      l.ln.setAttribute('y1', it.py)
      l.ln.setAttribute('x2', cx)
      l.ln.setAttribute('y2', cy)
    }
  }

  return {
    add,
    update,
    resetSizes() {
      for (const l of list) l.cur = ''
    },
    dispose() {
      layer.remove()
    },
  }
}
