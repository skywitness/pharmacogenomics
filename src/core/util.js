// 給所有 3D 場景共用的 three.js 小工具。
// 原則：只依賴 'three' 本體與 addons，不依賴後處理（EffectComposer），
// 因為每個舞台各自有獨立 WebGLRenderer，而且會在離開視窗時被回收重建。

import * as THREE from 'three'
import { COLORS, NUCLEOTIDES, PAIR } from './palette.js'

export const TAU = Math.PI * 2
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3)
export const easeOutBack = (t) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}
/** 與 frame rate 無關的阻尼：current 朝 target 靠近。lambda 越大越快（約 3~12）。*/
export const damp = (current, target, lambda, dt) => lerp(current, target, 1 - Math.exp(-lambda * dt))

/** 可重現的亂數 （mulberry32）。同一 seed 每次排列相同，方便測試與截圖。*/
export function rng(seed = 1) {
  let a = seed >>> 0
  const f = () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  f.range = (lo, hi) => lo + (hi - lo) * f()
  f.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * f())
  f.pick = (arr) => arr[Math.floor(f() * arr.length)]
  return f
}

/** 遞迴釋放 geometry / material / texture。*/
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.isInstancedMesh) o.dispose()
    if (o.geometry) o.geometry.dispose()
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
    for (const m of mats) {
      for (const k of Object.keys(m)) {
        const v = m[k]
        // userData.shared = 多個舞台共用的貼圖（如 glowTexture），不可在單一舞台銷毀時一併釋放
        if (v && v.isTexture && !v.userData.shared) v.dispose()
      }
      m.dispose()
    }
  })
}

const CJK_FONT = '"Noto Sans TC","PingFang TC","Microsoft JhengHei","Heiti TC",system-ui,sans-serif'
export const FONT_STACK = CJK_FONT

/**
 * 文字標籤 Sprite（canvas 貼圖，支援中文）。
 * opts: { fontSize=44, color='#e8ecf8', bg='rgba(6,9,19,.72)', border, padding=18, worldHeight=0.5, bold, maxWidth }
 * 回傳的 sprite.userData.setText(newText) 可更新文字。sprite.material.depthTest 預設 false 讓標籤不被遮住。
 */
export function makeLabel(text, opts = {}) {
  const o = {
    fontSize: 44,
    color: '#e8ecf8',
    bg: 'rgba(6,9,19,0.72)',
    border: 'rgba(120,160,255,0.35)',
    padding: 18,
    worldHeight: 0.5,
    bold: true,
    depthTest: false,
    ...opts,
  }
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: o.depthTest, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.renderOrder = 999

  const draw = (t) => {
    const lines = String(t).split('\n')
    const font = `${o.bold ? '700' : '400'} ${o.fontSize}px ${CJK_FONT}`
    ctx.font = font
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width))
    const lh = o.fontSize * 1.28
    const cw = Math.ceil(w + o.padding * 2)
    const ch = Math.ceil(lh * lines.length + o.padding * 1.4)
    const nw = Math.max(4, cw)
    const nh = Math.max(4, ch)
    // 貼圖儲存空間在第一次上傳時就固定了；文字改變導致 canvas 尺寸改變時必須 dispose,
    // 否則會出現 GL_INVALID_VALUE: glCopySubTextureCHROMIUM: Offset overflows texture dimensions
    if (uploaded && (canvas.width !== nw || canvas.height !== nh)) tex.dispose()
    canvas.width = nw
    canvas.height = nh
    ctx.font = font
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    if (o.bg) {
      const r = Math.min(22, ch / 2)
      ctx.fillStyle = o.bg
      ctx.beginPath()
      ctx.roundRect(1, 1, cw - 2, ch - 2, r)
      ctx.fill()
      if (o.border) {
        ctx.strokeStyle = o.border
        ctx.lineWidth = 2
        ctx.stroke()
      }
    }
    ctx.fillStyle = o.color
    lines.forEach((l, i) => ctx.fillText(l, cw / 2, o.padding * 0.7 + lh * (i + 0.5)))
    tex.needsUpdate = true
    uploaded = true
    const aspect = canvas.width / canvas.height
    sprite.scale.set(o.worldHeight * aspect, o.worldHeight, 1)
    sprite.userData.aspect = aspect
  }
  let uploaded = false
  draw(text)
  sprite.userData.setText = draw
  return sprite
}

let _glowTex
/** 柔和圓形光暈貼圖（共用）。*/
export function glowTexture() {
  if (_glowTex) return _glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grd.addColorStop(0, 'rgba(255,255,255,1)')
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  grd.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = grd
  g.fillRect(0, 0, 128, 128)
  _glowTex = new THREE.CanvasTexture(c)
  _glowTex.userData.shared = true
  _glowTex.colorSpace = THREE.SRGBColorSpace
  return _glowTex
}

/** 加法混合的光暈 Sprite，用來取代後處理 bloom。*/
export function makeGlow(color = COLORS.cyan, size = 1, opacity = 0.8) {
  const m = new THREE.SpriteMaterial({
    map: glowTexture(),
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const s = new THREE.Sprite(m)
  s.scale.setScalar(size)
  return s
}

/** 標準三點打光。回傳 { group, key, fill, rim }。*/
export function addStudioLights(scene, { intensity = 1 } = {}) {
  const group = new THREE.Group()
  group.name = 'studio-lights'
  const hemi = new THREE.HemisphereLight(0xbcd0ff, 0x101830, 0.35 * intensity)
  const key = new THREE.DirectionalLight(0xffffff, 1.5 * intensity)
  key.position.set(4, 6, 5)
  const fill = new THREE.DirectionalLight(0x6ab8ff, 0.55 * intensity)
  fill.position.set(-5, 2, 3)
  const rim = new THREE.DirectionalLight(0xff6aa8, 0.9 * intensity)
  rim.position.set(-2, 3, -6)
  group.add(hemi, key, fill, rim)
  scene.add(group)
  return { group, key, fill, rim }
}

/** 發光材質（自發光為主，不需光源）。*/
export const glowMat = (color, intensity = 1.4, extra = {}) =>
  new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.35,
    metalness: 0.0,
    ...extra,
  })

/** 半透明玻璃/膜材質。*/
export const glassMat = (color = 0x9fc6ff, opacity = 0.22, extra = {}) =>
  new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.15,
    metalness: 0,
    transmission: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.2,
    side: THREE.DoubleSide,
    depthWrite: false,
    ...extra,
  })

/** 光滑塑膠感材質，適合分子與膠囊。*/
export const glossMat = (color, extra = {}) =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.05, clearcoat: 0.8, clearcoatRoughness: 0.25, ...extra })

/** 兩色膠囊藥丸。長軸沿 X。回傳 Group。*/
export function createPill({ length = 1.2, radius = 0.32, colorA = 0xff5c9e, colorB = 0xf4f7ff } = {}) {
  const g = new THREE.Group()
  const half = length / 2
  const cyl = length - radius * 2
  const mk = (color, sign) => {
    const grp = new THREE.Group()
    const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, cyl / 2, 32, 1, true), glossMat(color))
    body.rotation.z = Math.PI / 2
    body.position.x = sign * (cyl / 4)
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 32, 16, 0, TAU, 0, Math.PI / 2),
      glossMat(color)
    )
    cap.rotation.z = -sign * (Math.PI / 2)
    cap.position.x = sign * (cyl / 2)
    grp.add(body, cap)
    return grp
  }
  g.add(mk(colorA, 1), mk(colorB, -1))
  // 中間接縫
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.005, radius * 0.03, 8, 40), glossMat(0xffffff))
  ring.rotation.y = Math.PI / 2
  g.add(ring)
  g.userData.length = length
  g.userData.half = half
  return g
}

/** 簡化人形（頭 + 身體），適合人群場景。高度約 1。*/
export function createPerson({ color = 0x8fb4ff, height = 1 } = {}) {
  const g = new THREE.Group()
  const mat = glossMat(color)
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), mat)
  head.position.y = 0.86
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.19, 0.42, 6, 16), mat)
  body.position.y = 0.46
  g.add(head, body)
  g.scale.setScalar(height)
  g.userData.material = mat
  return g
}

/**
 * DNA 雙股螺旋。沿 Y 軸向上，原點在中心。
 * opts: { pairs=24, radius=0.6, pitch=3.4 （每圈高度）， rise=0.34 （鹼基對間距）， sequence （字串，長度=pairs, 預設隨機）， seed,
 *         backbone=true, strandColors=[cyan, magenta], ballSize, segments }
 * 回傳 { group, pairs:[{index, a, b, base, partner, y, angle, meshes:{ ... }}], setOpen(t), setBase(i, base), update(t) }
 *   group.userData.helix 亦指向同一物件。
 *   setOpen(t) : 0..1 把雙股沿 X 方向拉開（像解旋酶），用來做「解開 DNA」動畫。
 */
export function createDNA(opts = {}) {
  const o = {
    pairs: 24,
    radius: 0.6,
    pitch: 3.4,
    rise: 0.34,
    seed: 7,
    strandColors: [COLORS.cyan, COLORS.magenta],
    ballSize: 0.13,
    rungRadius: 0.035,
    backbone: true,
    ...opts,
  }
  const rand = rng(o.seed)
  const seq = (o.sequence || Array.from({ length: o.pairs }, () => NUCLEOTIDES[Math.floor(rand() * 4)]).join('')).toUpperCase()
  const n = Math.min(o.pairs, seq.length)
  const group = new THREE.Group()
  const height = n * o.rise
  const twist = (TAU * o.rise) / o.pitch
  const sphereGeo = new THREE.SphereGeometry(o.ballSize, 20, 14)
  const rungGeo = new THREE.CylinderGeometry(o.rungRadius, o.rungRadius, 1, 10, 1, false)
  const strandMats = o.strandColors.map((c) => glossMat(c, { emissive: c, emissiveIntensity: 0.1 }))
  const baseMat = (b) => glossMat(COLORS[b], { emissive: COLORS[b], emissiveIntensity: 0.3 })
  const pairs = []
  const UP = new THREE.Vector3(0, 1, 0)
  /** 讓單位圓柱 mesh 從 from 連到 to */
  const orient = (mesh, from, to) => {
    const dir = new THREE.Vector3().subVectors(to, from)
    const len = dir.length()
    mesh.scale.set(1, Math.max(len, 1e-4), 1)
    mesh.position.copy(from).addScaledVector(dir, 0.5)
    mesh.quaternion.setFromUnitVectors(UP, dir.normalize())
  }

  const backboneCurves = [[], []]
  for (let i = 0; i < n; i++) {
    const y = i * o.rise - height / 2
    const ang = i * twist
    const b = seq[i]
    const partner = PAIR[b]
    const p = { index: i, base: b, partner, y, angle: ang, meshes: {} }
    const pos = [
      new THREE.Vector3(Math.cos(ang) * o.radius, y, Math.sin(ang) * o.radius),
      new THREE.Vector3(Math.cos(ang + Math.PI) * o.radius, y, Math.sin(ang + Math.PI) * o.radius),
    ]
    p.pos = pos
    const s0 = new THREE.Mesh(sphereGeo, strandMats[0])
    const s1 = new THREE.Mesh(sphereGeo, strandMats[1])
    s0.position.copy(pos[0])
    s1.position.copy(pos[1])
    // 鹼基：兩半根，各自著色（A-T / G-C）
    const half0 = new THREE.Mesh(rungGeo, baseMat(b))
    const half1 = new THREE.Mesh(rungGeo, baseMat(partner))
    const mid = new THREE.Vector3(0, y, 0)
    orient(half0, pos[0], mid)
    orient(half1, pos[1], mid)
    p.meshes = { s0, s1, half0, half1 }
    group.add(s0, s1, half0, half1)
    pairs.push(p)
    backboneCurves[0].push(pos[0].clone())
    backboneCurves[1].push(pos[1].clone())
  }
  let backboneMeshes = []
  if (o.backbone) {
    backboneCurves.forEach((pts, k) => {
      const curve = new THREE.CatmullRomCurve3(pts)
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, n * 4, o.ballSize * 0.55, 10, false), strandMats[k])
      backboneMeshes.push(tube)
      group.add(tube)
    })
  }

  const api = {
    group,
    pairs,
    height,
    sequence: seq,
    backbone: backboneMeshes,
    /** 把第 i 對換成別的鹼基，並更新顏色。*/
    setBase(i, base) {
      const p = pairs[i]
      p.base = base
      p.partner = PAIR[base]
      p.meshes.half0.material = baseMat(base)
      p.meshes.half1.material = baseMat(p.partner)
    },
    /**
     * 將兩股沿 X 軸分開 t (0..1) * amount，製造解旋/複製的效果。
     * 骨架管線是一次性建好的，無法跟著動，所以 t>0 時會把 backbone 隱藏（只剩球串）。
     * 鹼基半根會跟著各自的股線移動，並保持長度（氫鍵斷開，各自帶著自己的鹼基）。
     */
    setOpen(t, amount = 1.4) {
      const dx = t * amount
      const a = new THREE.Vector3()
      const b = new THREE.Vector3()
      const dir = new THREE.Vector3()
      const e = new THREE.Vector3()
      for (const p of pairs) {
        a.set(p.pos[0].x - dx, p.pos[0].y, p.pos[0].z)
        b.set(p.pos[1].x + dx, p.pos[1].y, p.pos[1].z)
        p.meshes.s0.position.copy(a)
        p.meshes.s1.position.copy(b)
        dir.subVectors(b, a).normalize()
        const len = o.radius * (1 - 0.15 * t)
        orient(p.meshes.half0, a, e.copy(a).addScaledVector(dir, len))
        orient(p.meshes.half1, b, e.copy(b).addScaledVector(dir, -len))
      }
      for (const m of backboneMeshes) m.visible = t < 0.01
    },
    update(t) {
      group.rotation.y = t * 0.25
    },
  }
  group.userData.helix = api
  return api
}

/** 粒子雲（THREE.Points），用於背景氛圍。回傳 Points。*/
export function createParticles({ count = 400, spread = [8, 5, 8], size = 0.05, color = 0x88aaff, opacity = 0.7, seed = 3 } = {}) {
  const r = rng(seed)
  const pos = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (r() - 0.5) * spread[0]
    pos[i * 3 + 1] = (r() - 0.5) * spread[1]
    pos[i * 3 + 2] = (r() - 0.5) * spread[2]
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  const mat = new THREE.PointsMaterial({
    size,
    color,
    map: glowTexture(),
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true,
  })
  return new THREE.Points(geo, mat)
}

/** 簡單的球棍風「藥物分子」：回傳 Group，中心 atoms 隨機排列（僅示意，不代表真實結構）。*/
export function createMolecule({ atoms = 7, radius = 0.3, color = COLORS.drug, seed = 5, accent = 0xffffff } = {}) {
  const r = rng(seed)
  const g = new THREE.Group()
  const pts = []
  for (let i = 0; i < atoms; i++) {
    const p = new THREE.Vector3(r.range(-1, 1), r.range(-1, 1), r.range(-1, 1)).normalize().multiplyScalar(r.range(0.25, 0.6) * radius * 3)
    if (i === 0) p.set(0, 0, 0)
    pts.push(p)
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(radius * (i === 0 ? 0.9 : r.range(0.45, 0.7)), 24, 16),
      glossMat(i % 3 === 2 ? accent : color)
    )
    m.position.copy(p)
    g.add(m)
    if (i > 0) {
      const parent = pts[Math.floor(r() * i)]
      const dir = new THREE.Vector3().subVectors(p, parent)
      const len = dir.length()
      const bond = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.12, radius * 0.12, len, 8), glossMat(0xdfe6ff))
      bond.position.copy(parent).addScaledVector(dir, 0.5)
      bond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
      g.add(bond)
    }
  }
  return g
}

/** 沿曲線的管狀線條 （半徑很小），常用來畫軌跡。*/
export function tubeFromPoints(points, radius = 0.03, color = COLORS.cyan, { closed = false, segments } = {}) {
  const curve = new THREE.CatmullRomCurve3(points, closed)
  const geo = new THREE.TubeGeometry(curve, segments || points.length * 8, radius, 8, closed)
  return new THREE.Mesh(geo, glowMat(color, 0.9))
}

/** 把 canvas 2D 折線圖畫進貼圖，做為 3D 場景中的「圖表板」。回傳 { mesh, canvas, ctx, tex, redraw(fn) }。*/
export function createChartPlane({ width = 3, height = 1.8, px = 512, bg = 'rgba(8,13,30,0.85)' } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = px
  canvas.height = Math.round((px * height) / width)
  const ctx = canvas.getContext('2d')
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false })
  )
  const api = {
    mesh,
    canvas,
    ctx,
    tex,
    redraw(fn) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      if (bg) {
        ctx.fillStyle = bg
        ctx.beginPath()
        ctx.roundRect(0, 0, canvas.width, canvas.height, 18)
        ctx.fill()
      }
      fn(ctx, canvas.width, canvas.height)
      tex.needsUpdate = true
    },
  }
  return api
}

export { THREE }
