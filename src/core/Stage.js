// Stage：把一個 <figure class="stage"> 變成一個獨立、可回收的 three.js 場景。
//
// 設計重點
//  1. 每個舞台擁有自己的 THREE.Scene / Camera / OrbitControls，場景模組（src/scenes/*.js）只需要 export default (ctx) => instance。
//  2. WebGLRenderer 只在舞台「靠近視窗」時才建立，離開後釋放（forceContextLoss），同時最多保留 MAX_LIVE 個，
//     這樣即使整頁有十幾個 3D 場景也不會爆掉瀏覽器的 WebGL context 上限。
//     ⇒ 場景模組不可持有與 renderer 綁定的資源（WebGLRenderTarget 等），Scene 圖本身不會被銷毀，可安全重用。
//  3. 只有「真的在視窗內」的舞台會 tick；整頁共用一個 requestAnimationFrame。
//  4. 所有錯誤都被攔截並顯示在舞台上，不會讓整頁掛掉；window.__pgx 暴露狀態供自動化測試。

import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import { createUI } from './ui.js'
import * as util from './util.js'
import * as palette from './palette.js'

const MAX_LIVE = 4
const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
const coarsePointer = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

const registry = new Map()
const live = new Set()
let rafId = 0
let lastT = 0

// 給自動化測試/除錯用
if (typeof window !== 'undefined') {
  window.__pgx = window.__pgx || { stages: registry, errors: [] }
}

function loop(now) {
  rafId = requestAnimationFrame(loop)
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0)
  lastT = now
  for (const s of registry.values()) if (s.visible) s.tick(dt)
}
function startLoop() {
  if (rafId) return
  lastT = performance.now()
  rafId = requestAnimationFrame(loop)
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(rafId)
      rafId = 0
    } else if (registry.size) startLoop()
  })
}

export class Stage {
  /**
   * @param {HTMLElement} el   .stage 元素（含 .stage-view > .stage-canvas / .stage-hud，以及可選的 .stage-controls）
   * @param {string} id
   * @param {() => Promise<{default: Function, options?: object}>} loader 動態載入場景模組
   */
  constructor(el, id, loader) {
    this.el = el
    this.id = id
    this.loader = loader
    this.view = el.querySelector('.stage-view')
    this.host = el.querySelector('.stage-canvas')
    this.hudEl = el.querySelector('.stage-hud')
    this.controlsEl = el.querySelector('.stage-controls')
    this.loadingEl = el.querySelector('.stage-loading')

    this.state = 'idle' // idle | loading | ready | error
    this.error = null
    this.visible = false
    this.near = false
    this.paused = false
    this.t = 0
    this.frames = 0
    this.lastVisibleAt = 0
    this.renderer = null
    this.instance = null
    this.options = {}
    this.pendingStep = null
    this.step = null
    this._frame = null
    this._pointerHandlers = new Set()
    this._pointer = { x: 0, y: 0, px: 0, py: 0, inside: false, down: false }
    this._raycaster = new THREE.Raycaster()

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 400)
    this.camera.position.set(0, 0, 8)
    this.controls = new OrbitControls(this.camera, this.view)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.enableZoom = false
    this.controls.enablePan = false
    this.controls.rotateSpeed = 0.7
    // 觸控：允許垂直方向捲動頁面，水平拖曳才旋轉場景
    this.view.style.touchAction = coarsePointer ? 'pan-y' : 'none'
    this._bindKeyboard()

    this._buildHud()
    this._bindPointer()

    this.ui = this.controlsEl ? createUI(this.controlsEl) : createUI(document.createElement('div'))
    registry.set(id, this)
    startLoop()

    this._ro = new ResizeObserver(() => this.resize())
    this._ro.observe(this.host)
    this._ioNear = new IntersectionObserver((es) => this._setNear(es[0].isIntersecting), { rootMargin: '120% 0px 120% 0px' })
    this._ioNear.observe(this.el)
    this._ioVis = new IntersectionObserver(
      (es) => {
        this.visible = es[0].isIntersecting
        if (this.visible) this.lastVisibleAt = performance.now()
      },
      { rootMargin: '0px' }
    )
    this._ioVis.observe(this.el)
  }

  // ───────────────────────── HUD ─────────────────────────
  _buildHud() {
    const root = this.hudEl
    if (!root) {
      this.hud = { badge() {}, legend() {}, caption() {}, tip() {}, clear() {} }
      return
    }
    // OrbitControls 在 pointerdown 時會對 .stage-view 做 setPointerCapture,click 因此被導向 view 而不是按鈕
    // （HUD 的「暫停動畫/重設視角」會完全失效）。互動式 HUD 元素攔截 pointer 事件，不讓它冒泡到 view。
    for (const type of ['pointerdown', 'pointerup', 'pointermove', 'pointercancel']) {
      root.addEventListener(type, (e) => {
        if (e.target.closest && e.target.closest('button, a, input, select, textarea')) e.stopPropagation()
      })
    }
    const q = (s) => root.querySelector(s)
    const badge = q('.hud-badge')
    const legend = q('.hud-legend')
    const caption = q('.hud-caption')
    const tooltip = q('.hud-tooltip')
    caption && caption.setAttribute('aria-live', 'off')
    const srLive = document.createElement('div')
    srLive.className = 'sr-only'
    srLive.setAttribute('role', 'status')
    srLive.setAttribute('aria-live', 'polite')
    root.append(srLive)
    const pauseBtn = q('[data-act="pause"]')
    const resetBtn = q('[data-act="reset"]')
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.paused = !this.paused
        pauseBtn.setAttribute('aria-pressed', String(this.paused))
        pauseBtn.setAttribute('aria-label', this.paused ? '繼續動畫' : '暫停動畫')
        const ico = pauseBtn.querySelector('.ico')
        const lbl = pauseBtn.querySelector('.lbl')
        if (ico) ico.textContent = this.paused ? '▶' : '⏸'
        if (lbl) lbl.textContent = this.paused ? ' 繼續動畫' : ' 暫停動畫'
        if (!ico && !lbl) pauseBtn.textContent = this.paused ? '▶ 繼續動畫' : '⏸ 暫停動畫'
      })
    }
    if (resetBtn) resetBtn.addEventListener('click', () => this.resetView())
    const cssColor = (c) => (typeof c === 'number' ? palette.hex(c) : c)
    this.hud = {
      badge: (t) => {
        if (badge) {
          badge.textContent = t || ''
          badge.hidden = !t
        }
      },
      /** items: [{color:number|string, label:string}] */
      legend: (items = []) => {
        if (!legend) return
        legend.replaceChildren(
          ...items.map((it) => {
            const s = document.createElement('span')
            s.className = 'legend-item'
            const dot = document.createElement('i')
            dot.style.background = cssColor(it.color)
            s.append(dot, document.createTextNode(it.label))
            return s
          })
        )
        legend.hidden = !items.length
      },
      caption: (text, { html = false } = {}) => {
        if (!caption) return
        if (html) caption.innerHTML = text || ''
        else caption.textContent = text || ''
        caption.hidden = !text
        // 螢幕閱讀器用的副本：延遲 700ms 且只讀最後一次（拖曳滑桿時每一格都朗讀會是災難）
        clearTimeout(this._srTimer)
        this._srTimer = setTimeout(() => {
          if (srLive && srLive.textContent !== caption.textContent) srLive.textContent = caption.textContent
        }, 700)
      },
      /** 顯示浮動提示。x,y 為相對 .stage-view 的像素；省略則用目前指標位置。html=null 隱藏。*/
      tip: (html, x, y) => {
        if (!tooltip) return
        if (html == null || html === '') {
          tooltip.hidden = true
          return
        }
        if (tooltip._html !== html) {
          tooltip.innerHTML = html
          tooltip._html = html
        }
        tooltip.hidden = false
        const px = x ?? this._pointer.px
        const py = y ?? this._pointer.py
        const w = this.view.clientWidth
        const tw = tooltip.offsetWidth
        tooltip.style.left = Math.max(6, Math.min(w - tw - 6, px + 14)) + 'px'
        tooltip.style.top = Math.max(6, py - 10 - tooltip.offsetHeight) + 'px'
      },
      clear: () => {
        this.hud.badge('')
        this.hud.legend([])
        this.hud.caption('')
        this.hud.tip(null)
      },
    }
  }

  // ───────────────────────── 鍵盤 ─────────────────────────
  // .stage-view 可聚焦（tabindex=0，由 chapter.js 設定）：方向鍵旋轉、Home 重設視角。
  // （滑過/點擊物件顯示的提示只有指標可用；重要資訊都另外寫在文字與圖說裡。）
  _bindKeyboard() {
    const STEP = 0.14
    const sph = new THREE.Spherical()
    const off = new THREE.Vector3()
    this.view.addEventListener('keydown', (e) => {
      if (e.key === 'Home') {
        e.preventDefault()
        this.resetView()
        return
      }
      const dAz = e.key === 'ArrowLeft' ? -STEP : e.key === 'ArrowRight' ? STEP : 0
      const dEl = e.key === 'ArrowUp' ? -STEP : e.key === 'ArrowDown' ? STEP : 0
      if (!dAz && !dEl) return
      // 場景自己處理旋轉(關閉 OrbitControls,如 ch08 的地球):把方向鍵轉交給 instance.onKeyRotate(dAzimuthRad, dElevationRad)
      if (!this.controls.enabled) {
        if (this.instance && this.instance.onKeyRotate) {
          e.preventDefault()
          this.instance.onKeyRotate(dAz, dEl)
        }
        return
      }
      e.preventDefault()
      const c = this.controls
      off.copy(this.camera.position).sub(c.target)
      sph.setFromVector3(off)
      sph.theta = THREE.MathUtils.clamp(sph.theta - dAz, c.minAzimuthAngle === -Infinity ? -Infinity : c.minAzimuthAngle, c.maxAzimuthAngle === Infinity ? Infinity : c.maxAzimuthAngle)
      sph.phi = THREE.MathUtils.clamp(sph.phi - dEl, Math.max(0.05, c.minPolarAngle), Math.min(Math.PI - 0.05, c.maxPolarAngle))
      off.setFromSpherical(sph)
      this.camera.position.copy(c.target).add(off)
      c.update()
    })
  }

  // ───────────────────────── 指標 ─────────────────────────
  _bindPointer() {
    const v = this.view
    let downAt = null
    const upd = (e) => {
      const r = v.getBoundingClientRect()
      const p = this._pointer
      p.px = e.clientX - r.left
      p.py = e.clientY - r.top
      p.x = (p.px / r.width) * 2 - 1
      p.y = -(p.py / r.height) * 2 + 1
    }
    const emit = (type, e) => {
      for (const h of this._pointerHandlers) {
        try {
          h(type, e, this._pointer)
        } catch (err) {
          this._fail(err)
        }
      }
    }
    v.addEventListener('pointermove', (e) => {
      upd(e)
      this._pointer.inside = true
      emit('move', e)
    })
    v.addEventListener('pointerdown', (e) => {
      upd(e)
      this._pointer.down = true
      downAt = { x: e.clientX, y: e.clientY, t: performance.now() }
      emit('down', e)
    })
    const up = (e) => {
      upd(e)
      this._pointer.down = false
      emit('up', e)
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && performance.now() - downAt.t < 600) emit('click', e)
      downAt = null
    }
    v.addEventListener('pointerup', up)
    v.addEventListener('pointercancel', () => {
      this._pointer.down = false
      downAt = null
      emit('cancel')
    })
    v.addEventListener('pointerleave', (e) => {
      this._pointer.inside = false
      this._pointer.down = false
      // 觸控：手指抬起也會觸發 pointerleave，不要因此立刻清掉剛點出的提示
      if (e.pointerType !== 'touch') this.hud.tip(null)
      emit('leave', e)
    })
  }

  // ───────────────────────── 載入場景 ─────────────────────────
  _setNear(near) {
    this.near = near
    if (near) {
      if (this.state === 'idle') this._load()
      else if (this.state === 'ready') this._ensureRenderer()
    } else {
      this._releaseRenderer()
    }
  }

  async _load() {
    this.state = 'loading'
    try {
      const mod = await this.loader()
      const factory = mod.default
      if (typeof factory !== 'function') throw new Error(`場景模組 ${this.id} 沒有 export default 函式`)
      this.options = mod.options || {}
      this._applyOptions(this.options)
      const ctx = this._makeCtx()
      const inst = await factory(ctx)
      this.instance = inst || {}
      this.state = 'ready'
      // 手機版控制項收在「互動控制項」開關裡；場景沒有任何控制項時就不顯示開關
      const toggle = this.el.querySelector('.stage-controls-toggle')
      if (toggle) toggle.hidden = !(this.controlsEl && this.controlsEl.childElementCount)
      if (this.loadingEl) this.loadingEl.hidden = true
      this.el.dataset.ready = 'true'
      if (this.pendingStep != null) this.setStep(this.pendingStep)
      if (this.near) this._ensureRenderer()
    } catch (err) {
      this._fail(err)
    }
  }

  _applyOptions(o) {
    const c = this.controls
    if (o.fov) this.camera.fov = o.fov
    if (o.camera) this.camera.position.set(...o.camera)
    if (o.target) c.target.set(...o.target)
    if (o.orbit === false) c.enabled = false
    if (o.zoom) c.enableZoom = true
    if (o.pan) c.enablePan = true
    if (o.autoRotate) {
      c.autoRotate = !reducedMotion
      c.autoRotateSpeed = o.autoRotateSpeed ?? 0.8
    }
    if (o.minDistance != null) c.minDistance = o.minDistance
    if (o.maxDistance != null) c.maxDistance = o.maxDistance
    if (o.minPolarAngle != null) c.minPolarAngle = o.minPolarAngle
    if (o.maxPolarAngle != null) c.maxPolarAngle = o.maxPolarAngle
    if (o.minAzimuthAngle != null) c.minAzimuthAngle = o.minAzimuthAngle
    if (o.maxAzimuthAngle != null) c.maxAzimuthAngle = o.maxAzimuthAngle
    if (o.exposure != null) this._exposure = o.exposure
    if (o.envIntensity != null) this._envIntensity = o.envIntensity
    this.camera.updateProjectionMatrix()
    c.update()
    this._home = { pos: this.camera.position.clone(), target: c.target.clone() }
  }

  _makeCtx() {
    const self = this
    return {
      THREE,
      util,
      palette,
      id: this.id,
      el: this.el,
      view: this.view,
      scene: this.scene,
      camera: this.camera,
      controls: this.controls,
      ui: this.ui,
      hud: this.hud,
      reducedMotion,
      coarsePointer,
      get size() {
        return { w: self.host.clientWidth, h: self.host.clientHeight, aspect: self.camera.aspect }
      },
      get paused() {
        return self.paused
      },
      /** 目前指標狀態 {x,y (NDC), px,py (px), inside, down} */
      get pointer() {
        return self._pointer
      },
      /** 註冊指標事件： handler（type: 'move'|'down'|'up'|'click'|'leave'|'cancel', event, pointer）。回傳取消函式。*/
      onPointer(handler) {
        self._pointerHandlers.add(handler)
        return () => self._pointerHandlers.delete(handler)
      },
      /** 以目前指標位置對 objects 做 raycast。回傳 intersections 陣列。*/
      pick(objects, recursive = true) {
        self._raycaster.setFromCamera(self._pointer, self.camera)
        return self._raycaster.intersectObjects(objects, recursive)
      },
      /** 由 clientX/Y 或 NDC 做 raycast。*/
      pickAt(ndcX, ndcY, objects, recursive = true) {
        self._raycaster.setFromCamera({ x: ndcX, y: ndcY }, self.camera)
        return self._raycaster.intersectObjects(objects, recursive)
      },
      /** 世界座標 → 相對 .stage-view 的像素座標 {x,y,visible}。*/
      project(v3) {
        const v = v3.clone().project(self.camera)
        return {
          x: ((v.x + 1) / 2) * self.view.clientWidth,
          y: ((1 - v.y) / 2) * self.view.clientHeight,
          visible: v.z > -1 && v.z < 1,
        }
      },
      setCursor(c) {
        self.view.style.cursor = c || ''
      },
      /**
       * 設定「取景」：讓以 center 為中心、半徑 radius 的球體完整落在畫面內（橫豎螢幕都適用），
       * 視窗尺寸改變時會自動重新計算距離（保留使用者旋轉的方向）。
       * opts: { azimuth, elevation （弧度，只有第一次呼叫且未指定 keepAngle 時才會套用）， padding=1.15 }
       */
      setFrame(center, radius, opts = {}) {
        self._frame = { center: center.clone(), radius, padding: opts.padding ?? 1.15 }
        self.controls.target.copy(center)
        let angled = false
        if (opts.azimuth != null || opts.elevation != null) {
          const az = opts.azimuth ?? 0
          const el = opts.elevation ?? 0.2
          const d = 1
          self.camera.position.set(center.x + d * Math.sin(az) * Math.cos(el), center.y + d * Math.sin(el), center.z + d * Math.cos(az) * Math.cos(el))
          angled = true
        }
        self._applyFrame()
        // 「重設視角」的方向只在明確給定角度、或第一次呼叫時記錄；
        // 之後（例如 onResize / onStep 又呼叫 setFrame）不能把使用者剛旋轉過的方向當成 home。
        if (angled || !self._homeDir) self._homeDir = self.camera.position.clone().sub(self.controls.target).normalize()
        const dist = self.camera.position.distanceTo(self.controls.target)
        self._home = { pos: center.clone().addScaledVector(self._homeDir, dist), target: center.clone() }
      },
      /** 讓場景「停止/開始」ambient 動畫的建議倍率：reduced motion 使用者為 0.15，其他為 1。*/
      motion: reducedMotion ? 0.15 : 1,
      /** 通知外部（章節文字）目前發生了什麼，例如用於進度更新。*/
      emit(name, detail) {
        self.el.dispatchEvent(new CustomEvent('stage:' + name, { detail, bubbles: true }))
      },
    }
  }

  _applyFrame() {
    const f = this._frame
    if (!f) return
    const cam = this.camera
    const vfov = THREE.MathUtils.degToRad(cam.fov)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * cam.aspect)
    const dist = (f.radius * f.padding) / Math.sin(Math.min(vfov, hfov) / 2)
    const dir = cam.position.clone().sub(this.controls.target)
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.2, 1)
    dir.normalize()
    this.controls.target.copy(f.center)
    cam.position.copy(f.center).addScaledVector(dir, dist)
    this.controls.update()
  }

  resetView() {
    if (!this._home) return
    this.camera.position.copy(this._home.pos)
    this.controls.target.copy(this._home.target)
    this._applyFrame()
    this.controls.update()
    if (this.instance && this.instance.onResetView) this.instance.onResetView()
  }

  // ───────────────────────── renderer 生命週期 ─────────────────────────
  _ensureRenderer() {
    if (this.renderer || this.state !== 'ready') return
    // 超過上限時，回收最久沒看的、目前不在視窗內的舞台
    if (live.size >= MAX_LIVE) {
      const victims = [...live].filter((s) => !s.visible).sort((a, b) => a.lastVisibleAt - b.lastVisibleAt)
      if (victims.length) victims[0]._releaseRenderer()
    }
    try {
      const canvas = document.createElement('canvas')
      canvas.setAttribute('aria-hidden', 'true')
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
      renderer.setClearColor(0x000000, 0)
      renderer.toneMapping = THREE.ACESFilmicToneMapping
      renderer.toneMappingExposure = this._exposure ?? 1.0
      canvas.addEventListener('webglcontextlost', (e) => {
        e.preventDefault()
        this._releaseRenderer(true)
      })
      const pmrem = new THREE.PMREMGenerator(renderer)
      this._envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
      pmrem.dispose()
      this.scene.environment = this._envTex
      this.scene.environmentIntensity = this._envIntensity ?? 0.4
      this.host.append(canvas)
      this.renderer = renderer
      live.add(this)
      // 先前因建立 WebGL context 失敗而顯示的錯誤，在之後重新建立成功時清除（場景本身的執行錯誤不會被清掉）
      if (this._glError && this.error === this._glError) {
        this.error = null
        this._glError = null
        delete this.el.dataset.error
        if (this.loadingEl) {
          this.loadingEl.hidden = true
          this.loadingEl.classList.remove('is-error')
        }
      }
      this.resize()
    } catch (err) {
      this._glError = err
      this._fail(err)
    }
  }

  _releaseRenderer(lost = false) {
    if (!this.renderer) return
    const r = this.renderer
    live.delete(this)
    this.renderer = null
    this.scene.environment = null
    if (this._envTex) {
      this._envTex.dispose()
      this._envTex = null
    }
    const canvas = r.domElement
    try {
      util.disposeTree(this.scene)
    } catch (e) {
      console.warn(e)
    }
    r.dispose()
    if (!lost) r.forceContextLoss()
    canvas.remove()
    if (lost && this.near) setTimeout(() => this._ensureRenderer(), 200)
  }

  resize() {
    const w = this.host.clientWidth
    const h = this.host.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    if (this.renderer) this.renderer.setSize(w, h, false)
    this._applyFrame()
    if (this.instance && this.instance.onResize) {
      try {
        this.instance.onResize(w, h)
      } catch (e) {
        this._fail(e)
      }
    }
  }

  // ───────────────────────── 每幀 ─────────────────────────
  tick(dt) {
    if (this.state !== 'ready' || !this.renderer || this.error) return
    const step = this.paused ? 0 : dt
    this.t += step
    try {
      if (this.instance.update) this.instance.update(step, this.t)
      this.controls.update()
      this.renderer.render(this.scene, this.camera)
      this.frames++
    } catch (err) {
      this._fail(err)
    }
  }

  /** 章節捲動到某個文字步驟時呼叫。*/
  setStep(i) {
    if (this.state !== 'ready') {
      this.pendingStep = i
      return
    }
    const prev = this.step
    this.step = i
    if (this.instance && this.instance.onStep) {
      try {
        this.instance.onStep(i, prev)
      } catch (err) {
        this._fail(err)
      }
    }
  }

  _fail(err) {
    console.error(`[Stage ${this.id}]`, err)
    this.error = err
    this.state = this.state === 'ready' ? 'ready' : 'error'
    if (window.__pgx) window.__pgx.errors.push({ id: this.id, message: String(err && err.message ? err.message : err), stack: err && err.stack })
    if (this.loadingEl) {
      this.loadingEl.hidden = false
      this.loadingEl.classList.add('is-error')
      this.loadingEl.textContent = '3D 場景暫時無法顯示（不影響閱讀文字內容）'
    }
    this.el.dataset.error = 'true'
  }

  destroy() {
    this._releaseRenderer()
    this._ro.disconnect()
    this._ioNear.disconnect()
    this._ioVis.disconnect()
    this.controls.dispose()
    if (this.instance && this.instance.dispose) {
      try {
        this.instance.dispose()
      } catch (e) {
        console.error(e)
      }
    }
    util.disposeTree(this.scene)
    registry.delete(this.id)
  }
}
