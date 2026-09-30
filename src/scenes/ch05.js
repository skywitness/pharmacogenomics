// ch05「肝細胞工廠」：內質網膜上鑲嵌 CYP 酵素，藥物分子流過、被轉成產物。
// 同一個一室藥動學模型（見 ./ch05/pk.js，全部為「示意」數值）同時驅動：
//   1) 上方圖表（五種代謝型的濃度曲線 + 治療窗），貼在鏡頭上，不會被旋轉或縮放弄到出框
//   2) 粒子數量（橘=母藥、青綠=活性代謝物、灰=無活性代謝物）
//   3) 膜上「有功能的酵素」數量（依代謝型、抑制劑/誘導劑改變）
import { COLORS } from '../core/palette.js'
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'
import { HOURS, DOSE_TIMES, ACT, KEYS, WINDOW, effAct, classifyAct, simulate, zoneOf, sample } from './ch05/pk.js'
import { drawChart, CHART_ASPECT } from './ch05/chart.js'
import { PHENO_ZH, MECH, OUTCOME, MOD_PREFIX, STEP_CAPTION, ENZYME_TIP } from './ch05/data.js'

export const options = {
  fov: 40,
  camera: [4, 6, 15],
  target: [0.2, 1, 0.3],
  zoom: false,
  orbit: true,
  minPolarAngle: 0.95,
  maxPolarAngle: 1.45,
  minAzimuthAngle: -0.8,
  maxAzimuthAngle: 0.8,
  exposure: 1.1,
  envIntensity: 0.55,
}

const SLAB_W = 13.6
const SLAB_D = 4.2
const SLAB_T = 0.42
const COLS = 8
const ROWS = 3
const NS = COLS * ROWS
const LANE_Y = 1.55
const GATE_X = 6.3
const SIM_SPEED = 3 // 模擬小時 / 秒
const SUBJECT = [0.2, 1.0, 0.3] // 取景中心
const surf = (x, z) => 0.06 * Math.sin(x * 0.8 + z * 0.6) + 0.04 * Math.cos(z * 1.4 - x * 0.3)
const SPEED_LABEL = { none: '', strong: '強效抑制劑', moderate: '中效抑制劑', inducer: '誘導劑' }
// 酵素狀態： 0 空位（無功能） 1 有功能 2 誘導新增 3 被抑制劑堵住
const BODY_HEX = [0x4b546e, COLORS.enzyme, 0x9ad0ff, 0x3d4a86]
const GROW = [0.001, 1, 1, 0.88]

export default function create(ctx) {
  const { THREE, util, scene, camera, controls, ui, hud } = ctx
  const V3 = THREE.Vector3
  const clamp = util.clamp
  const rand = util.rng(11)
  const root = new THREE.Group()
  scene.add(root)
  util.addStudioLights(scene, { intensity: 1.0 })

  // ───────────────────────── 狀態 ─────────────────────────
  const st = { pheno: 'NM', kind: 'active', mod: 'none', dose: 1 }
  let step = 0
  let simT = 26
  let holdT = 0
  let prevT = 26
  let demo = null
  let elapsed = 0
  let bsDone = false
  let spotT = 0
  let userTouched = false
  let tipT = 0
  let lastNow = performance.now()
  let lastAsp = 0
  let introHint = true
  const coarse = !!ctx.coarsePointer
  const cntBuf = [0, 0]
  const funcBuf = []

  // ───────────────────────── 膜 ─────────────────────────
  function dotTexture() {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    g.fillStyle = '#3552b4'
    g.fillRect(0, 0, 128, 128)
    const r = util.rng(3)
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const cx = x * 16 + 8 + (y % 2 ? 8 : 0)
        g.fillStyle = `rgba(${170 + r() * 50},${195 + r() * 40},255,${0.5 + r() * 0.35})`
        g.beginPath()
        g.arc(cx % 128, y * 16 + 8, 4.6 + r() * 1.4, 0, Math.PI * 2)
        g.fill()
      }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(7, 2.6)
    t.anisotropy = 4
    return t
  }
  function sideTexture() {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 64
    const g = c.getContext('2d')
    g.fillStyle = '#26377f'
    g.fillRect(0, 0, 512, 64)
    g.strokeStyle = 'rgba(140,170,255,0.25)'
    g.lineWidth = 2
    for (let x = 6; x < 512; x += 16) {
      g.beginPath()
      g.moveTo(x, 20)
      g.lineTo(x, 44)
      g.stroke()
    }
    for (let x = 0; x < 32; x++) {
      for (const cy of [11, 53]) {
        g.fillStyle = 'rgba(190,210,255,0.85)'
        g.beginPath()
        g.arc(x * 16 + 8, cy, 6.5, 0, Math.PI * 2)
        g.fill()
      }
    }
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  const slabGeo = new THREE.BoxGeometry(SLAB_W, SLAB_T, SLAB_D, 67, 1, 24)
  slabGeo.translate(0, -SLAB_T / 2, 0)
  {
    const pos = slabGeo.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setY(i, pos.getY(i) + surf(pos.getX(i), pos.getZ(i)))
    slabGeo.computeVertexNormals()
  }
  const sideMat = new THREE.MeshStandardMaterial({ map: sideTexture(), roughness: 0.55, metalness: 0.02, emissive: 0x1b2a6e, emissiveIntensity: 0.55 })
  const topMat = new THREE.MeshStandardMaterial({ map: dotTexture(), roughness: 0.5, metalness: 0.02, emissive: 0x1b2a6e, emissiveIntensity: 0.5 })
  const slab = new THREE.Mesh(slabGeo, [sideMat, sideMat, topMat, sideMat, sideMat, sideMat])
  root.add(slab)

  // 前緣光條：顏色 = 目前「實際」代謝型
  const edgePts = []
  for (let i = 0; i <= 40; i++) {
    const x = -SLAB_W / 2 + (SLAB_W * i) / 40
    edgePts.push(new V3(x, surf(x, SLAB_D / 2) + 0.04, SLAB_D / 2 + 0.01))
  }
  const edge = util.tubeFromPoints(edgePts, 0.035, COLORS.NM, { segments: 120 })
  root.add(edge)
  const edgeColor = new THREE.Color(COLORS.NM)

  // ───────────────────────── 酵素（InstancedMesh） ─────────────────────────
  const slots = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const x = -5.35 + c * 1.4 + (r === 1 ? 0.7 : 0) + (rand() - 0.5) * 0.14
      const z = (r - 1) * 1.05 + (rand() - 0.5) * 0.12
      slots.push({ x, z, y0: surf(x, z), rot: rand() * 6.28, ph: rand() * 6.28, g: 0.001, plug: 0, flash: 0, busy: 0, S: 0, tint: 0.9 + rand() * 0.2, col: new THREE.Color(0x4b546e), ring: new THREE.Color(0x3b4f96) })
    }
  // 聚焦用的那顆酵素：前排中間
  const F = slots[2 * COLS + 4]
  // 「排名」= 第幾顆先有功能。用最遠點取樣，讓有功能的酵素在整片膜上分布均勻，前排中間最先。
  const order = (() => {
    const idx = slots.map((_, i) => i)
    const first = slots.indexOf(F)
    const out = [first]
    const left = idx.filter((i) => i !== first)
    while (left.length) {
      let bi = 0
      let bd = -1
      left.forEach((i, k) => {
        let md = 1e9
        for (const j of out) md = Math.min(md, Math.hypot(slots[i].x - slots[j].x, (slots[i].z - slots[j].z) * 1.6))
        if (md > bd) {
          bd = md
          bi = k
        }
      })
      out.push(left.splice(bi, 1)[0])
    }
    return out
  })()

  const bodyGeo = (() => {
    let g = new THREE.IcosahedronGeometry(0.42, 3)
    g.deleteAttribute('uv')
    g.deleteAttribute('normal')
    g = mergeVertices(g, 1e-4)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const y = p.getY(i)
      const z = p.getZ(i)
      const n = Math.sin(x * 7.1 + 1.3) * Math.sin(y * 6.3 + 0.4) * Math.sin(z * 5.7 + 2.1)
      const k = 1 + 0.17 * n
      p.setXYZ(i, x * k, y * k * 0.98, z * k)
    }
    g.computeVertexNormals()
    return g
  })()
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.42, metalness: 0.05, emissive: 0x2a3a86, emissiveIntensity: 0.55 })
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, NS)
  const hemeGeo = new THREE.TorusGeometry(0.16, 0.05, 8, 22)
  hemeGeo.rotateX(Math.PI / 2)
  const hemes = new THREE.InstancedMesh(hemeGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), NS)
  const feGeo = new THREE.SphereGeometry(0.08, 12, 8)
  const fes = new THREE.InstancedMesh(feGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), NS)
  const ringGeo = new THREE.TorusGeometry(0.58, 0.045, 8, 48)
  ringGeo.rotateX(Math.PI / 2)
  const rings = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), NS)
  const plugGeo = new THREE.CylinderGeometry(0.3, 0.34, 0.12, 8)
  const plugs = new THREE.InstancedMesh(plugGeo, new THREE.MeshStandardMaterial({ color: COLORS.magenta, emissive: COLORS.magenta, emissiveIntensity: 0.55, roughness: 0.35 }), NS)
  const INST = [bodies, hemes, fes, rings, plugs]
  for (const m of INST) {
    m.frustumCulled = false
    root.add(m)
  }
  const dummy = new THREE.Object3D()
  const tmpC = new THREE.Color()
  const white = new THREE.Color(1, 1, 1)
  const HEME_BASE = new THREE.Color(1.0, 0.36, 0.44)
  const HEME_DIM = new THREE.Color(0.32, 0.13, 0.17)
  const BODY_COL = BODY_HEX.map((h) => new THREE.Color(h))

  // ───────────────────────── 藥物粒子 ─────────────────────────
  const drugGeo = (() => {
    const a = new THREE.SphereGeometry(0.17, 10, 8)
    const b = new THREE.SphereGeometry(0.11, 8, 6).translate(0.2, 0.07, 0)
    const c = new THREE.SphereGeometry(0.09, 8, 6).translate(-0.14, 0.14, 0.09)
    return mergeGeometries([a, b, c])
  })()
  const prodGeo = (() => {
    const a = new THREE.SphereGeometry(0.17, 10, 8)
    const b = new THREE.SphereGeometry(0.11, 8, 6).translate(0.2, 0.07, 0)
    return mergeGeometries([a, b])
  })()
  const oxGeo = new THREE.SphereGeometry(0.08, 8, 6).translate(-0.09, 0.19, 0.06)
  const MAXP = 300
  const drugMat = new THREE.MeshStandardMaterial({ color: COLORS.drug, emissive: COLORS.drug, emissiveIntensity: 0.34, roughness: 0.3 })
  const prodMat = new THREE.MeshStandardMaterial({ color: COLORS.inactive, emissive: COLORS.inactive, emissiveIntensity: 0.3, roughness: 0.3 })
  const oxMat = new THREE.MeshStandardMaterial({ color: COLORS.red, emissive: COLORS.red, emissiveIntensity: 0.5, roughness: 0.3 })
  const drugMesh = new THREE.InstancedMesh(drugGeo, drugMat, MAXP)
  const prodMesh = new THREE.InstancedMesh(prodGeo, prodMat, MAXP)
  const oxMesh = new THREE.InstancedMesh(oxGeo, oxMat, MAXP)
  for (const m of [drugMesh, prodMesh, oxMesh]) {
    m.frustumCulled = false
    m.count = 0
    root.add(m)
  }
  const P = Array.from({ length: MAXP }, () => ({ alive: false }))
  let recAcc = 0
  let rdAcc = 0
  const rdCache = {}

  function freeP() {
    for (const p of P) if (!p.alive) return p
    return null
  }
  function spawn(type, x, y, z, s0 = 0) {
    const p = freeP()
    if (!p) return null
    p.alive = true
    p.type = type
    p.x = x
    p.y = y
    p.z = z
    p.yb = y
    p.zb = z
    p.vx = 0.7 + rand() * 0.5
    p.ph = rand() * 6.28
    p.s = s0
    p.sT = 1
    p.state = 0
    p.t = 0
    p.flipped = false
    p.slot = -1
    p.spin = rand() * 6.28
    p.dockAtX = null
    return p
  }
  function countAlive() {
    let d = 0
    let pr = 0
    for (const p of P) if (p.alive && p.sT > 0) (p.type === 0 ? d++ : pr++)
    cntBuf[0] = d
    cntBuf[1] = pr
    return cntBuf
  }
  function fadeOne(type) {
    let best = null
    for (const p of P) if (p.alive && p.sT > 0 && p.type === type && p.state === 0 && (!best || p.x > best.x)) best = p
    if (best) best.sT = 0
  }
  const isFunc = (s) => s.S === 1 || s.S === 2
  function functionalSlots() {
    funcBuf.length = 0
    for (let i = 0; i < NS; i++) if (isFunc(slots[i])) funcBuf.push(i)
    return funcBuf
  }
  function dockTo(p, i) {
    const s = slots[i]
    s.busy = elapsed + 1.5
    Object.assign(p, {
      state: 1,
      t: 0,
      flipped: false,
      slot: i,
      type: 1,
      fx: p.x,
      fy: p.y,
      fz: p.z,
      sx: s.x,
      sy: s.y0 + 0.3 * s.g + 0.42 * s.g + 0.3,
      sz: s.z,
      tx: s.x + 1.0 + rand() * 0.4,
      ty: LANE_Y + (rand() - 0.5) * 0.5,
      tz: s.z + (rand() - 0.5) * 0.8,
    })
  }
  function startDock(p, funcs) {
    let best = -1
    let bd = 1e9
    for (const i of funcs) {
      const s = slots[i]
      if (s.busy > elapsed) continue
      const d = Math.abs(s.x - p.x - 0.8) + 0.6 * Math.abs(s.z - p.z)
      if (d < bd) {
        bd = d
        best = i
      }
    }
    if (best < 0 || bd > 5) return false
    dockTo(p, best)
    return true
  }
  function reconcile(cp, cm, frozen) {
    const tD = clamp(Math.round(cp * 110), 0, coarse ? 90 : 150)
    const tP = clamp(Math.round(cm * 110), 0, coarse ? 75 : 120)
    const [nD, nP] = countAlive()
    const funcs = functionalSlots()
    if (nD < tD) {
      if (!frozen) for (let k = 0; k < Math.min(tD - nD, 3); k++) spawn(0, -6.7 + rand() * 1.6, LANE_Y - 0.3 + rand() * 0.75, -1.7 + rand() * 3.4)
    } else if (nD > tD) {
      for (let k = 0; k < Math.min(nD - tD, 3); k++) fadeOne(0)
    }
    if (nP < tP && funcs.length) {
      if (frozen) return
      let made = 0
      const cands = P.filter((p) => p.alive && p.sT > 0 && p.type === 0 && p.state === 0 && p.s > 0.8 && p.x > -6 && p.x < 5)
      while (made < Math.min(tP - nP, 2) && cands.length) {
        const p = cands.splice(Math.floor(rand() * cands.length), 1)[0]
        if (startDock(p, funcs)) made++
      }
      if (made === 0 && tP - nP > 2) {
        const i = funcs[Math.floor(rand() * funcs.length)]
        const s = slots[i]
        spawn(1, s.x, s.y0 + 1.0, s.z, 0)
      }
    } else if (nP > tP) {
      for (let k = 0; k < Math.min(nP - tP, 3); k++) fadeOne(1)
    }
  }

  // 反應閃光（加法混合光暈池）
  const glows = Array.from({ length: 10 }, () => {
    const g = util.makeGlow(COLORS.metabolite, 1.6, 0)
    g.userData.life = 0
    g.visible = false
    root.add(g)
    return g
  })
  function flashAt(x, y, z, color, size = 1.6) {
    const g = glows.find((q) => q.userData.life <= 0) || glows[0]
    g.position.set(x, y, z)
    g.material.color.set(color)
    g.userData.life = 1
    g.userData.size = size
    g.visible = true
  }
  const productColor = () => (st.kind === 'prodrug' ? COLORS.metabolite : COLORS.inactive)

  // 藥丸落下
  const pill = util.createPill({ length: 0.9, radius: 0.24, colorA: COLORS.drug, colorB: 0xf4f7ff })
  pill.visible = false
  root.add(pill)
  let pillT = -1

  // 入口/出口環
  const gateMat = new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.55 })
  for (const gx of [-GATE_X, GATE_X]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.04, 8, 60), gateMat)
    ring.rotation.y = Math.PI / 2
    ring.scale.set(1.5, 1, 1)
    ring.position.set(gx, LANE_Y + 0.05, 0)
    root.add(ring)
  }
  const dust = util.createParticles({ count: 170, spread: [20, 7, 11], size: 0.07, color: 0x8fb4ff, opacity: 0.45, seed: 8 })
  dust.position.set(0, 2.2, -0.5)
  root.add(dust)
  const glowA = util.makeGlow(COLORS.cyan, 16, 0.16)
  glowA.position.set(-3, 0.5, -5)
  const glowB = util.makeGlow(COLORS.magenta, 12, 0.1)
  glowB.position.set(6, -1, -4)
  scene.add(glowA, glowB)

  // ───────────────────────── 標籤（螢幕上大小固定，不會隨鏡頭拉近而變巨大）─────────────────────────
  const labels = []
  function addLabel(text, anchor, off, show, opts = {}) {
    const s = util.makeLabel(text, { worldHeight: 1, fontSize: 40, padding: 12, bg: 'rgba(6,9,19,0.86)', ...opts })
    const aspect = s.scale.x / s.scale.y
    s.material.opacity = 0
    s.material.toneMapped = false
    s.visible = false
    const geo = new THREE.BufferGeometry().setFromPoints([new V3(), new V3()])
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: opts.lineColor ?? 0xdfe8ff, transparent: true, opacity: 0, depthTest: false, toneMapped: false }))
    line.frustumCulled = false
    line.renderOrder = 998
    line.visible = false
    root.add(s, line)
    const e = { s, line, aspect, anchor: new V3(...anchor), off, show, target: 0, a: 0, hideNarrow: !!opts.hideNarrow }
    labels.push(e)
    return e
  }
  const fTopY = F.y0 + 0.3 + 0.42 * 0.95
  addLabel('血液帶藥物進來', [-3.9, LANE_Y + 0.35, 0], [0, 42], [0])
  addLabel('離開肝細胞', [3.9, LANE_Y + 0.35, 0], [0, 42], [0])
  addLabel('內質網膜（酵素鑲在上面）', [3.4, -0.15, SLAB_D / 2], [0, -14], [0], { color: '#dbe6ff' })
  addLabel('CYP 酵素', [F.x + 1.4, F.y0 + 1.0, F.z - 1.05], [0, 46], [0], { color: '#b9caff' })
  addLabel('藥物分子', [F.x - 1.25, LANE_Y + 0.05, F.z], [-16, 58], [1], { color: '#ffd08a' })
  addLabel('CYP 酵素', [F.x - 0.4, F.y0 + 0.4, F.z + 0.25], [-98, -40], [1], { color: '#b9caff', hideNarrow: true })
  addLabel('血基質（heme）', [F.x + 0.12, fTopY, F.z], [74, 40], [1], { color: '#ff9aa9' })
  addLabel('氧化後的產物', [F.x + 1.3, LANE_Y + 0.1, F.z], [30, 56], [1], { color: '#a8f5dc' })

  // ───────────────────────── 圖表（貼在鏡頭上的平面，永遠完整入鏡） ─────────────────────────
  const chart = util.createChartPlane({ width: CHART_ASPECT, height: 1, px: 1200, bg: 'rgba(8,13,30,0.93)' })
  const CH_DIST = 6
  chart.tex.generateMipmaps = false
  chart.tex.minFilter = THREE.LinearFilter
  chart.mesh.position.set(0, 0, -CH_DIST)
  chart.mesh.renderOrder = 1200 // 蓋在文字標籤之上，標籤淡出時不會透出來
  chart.mesh.material.depthTest = false
  chart.mesh.material.toneMapped = false
  chart.mesh.material.opacity = 0
  chart.mesh.visible = false
  scene.add(camera)
  camera.add(chart.mesh)
  let chartOp = 0
  let chartTarget = 0
  let chartAcc = 1
  let chartHpx = 150 // 圖表在畫面上的高度（px），供取景估算
  const chartTopPx = (h) => Math.max(48, h * 0.1)
  function layoutChart() {
    const { w, h } = ctx.size
    if (!w || !h) return
    const vh = 2 * CH_DIST * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const vw = vh * (w / h)
    const topPx = chartTopPx(h)
    const hPx = Math.min(h * (w < 480 ? 0.36 : 0.37), (w - 12) / CHART_ASPECT)
    chartHpx = hPx
    const cy = topPx + hPx / 2
    chart.mesh.position.y = vh * (0.5 - cy / h)
    const sc = (hPx / h) * vh
    chart.mesh.scale.set(sc, sc, 1)
  }

  // 模擬結果
  const series = {}
  let baseline = null
  let zone = { zone: 'in', mean: 0, max: 0 }
  let effKey = 'NM'
  let nBase = 12
  let nFunc = 12

  function recompute() {
    const base = ACT[st.pheno]
    const eff = effAct(base, st.mod)
    effKey = classifyAct(eff)
    // 24 格 = 活性 2.4（誘導後 UM 的上限）；一般 UM（2.0）還留幾個空位，讓誘導看得出「多長出來」
    nBase = Math.round((Math.min(base, 2.4) / 2.4) * NS)
    nFunc = Math.round((Math.min(eff, 2.4) / 2.4) * NS)
    for (const k of KEYS) series[k] = simulate(st.kind, effAct(ACT[k], st.mod), st.dose)
    baseline = st.mod === 'none' ? null : simulate(st.kind, base, st.dose)
    zone = zoneOf(series[st.pheno], st.kind)
    for (let r = 0; r < NS; r++) {
      const s = slots[order[r]]
      if (r < nFunc) s.S = r < nBase ? 1 : 2
      else if (r < nBase) s.S = 3
      else s.S = 0
    }
    chartAcc = 1
  }

  // ───────────────────────── 介面 ─────────────────────────
  function syncUI() {
    segP.set(st.pheno)
    segK.set(st.kind)
    segM.set(st.mod)
    sld.set(Math.round(st.dose * 100))
  }
  function setState(p, fromUser = false) {
    if (fromUser) {
      demo = null
      userTouched = true
      introHint = false
    }
    Object.assign(st, p)
    recompute()
    syncUI()
    refreshHud()
    edgeColor.setHex(COLORS[effKey])
  }
  const segP = ui.segmented({
    label: '基因型預測的代謝型（UM 超快速 · RM 快速 · NM 正常 · IM 中間 · PM 不良）',
    options: KEYS.map((k) => ({ value: k, label: k, color: COLORS[k], title: PHENO_ZH[k] })),
    value: 'NM',
    onChange: (v) => setState({ pheno: v }, true),
  })
  const segK = ui.segmented({
    label: '藥物類型',
    options: [
      { value: 'active', label: '活性藥 · CYP 把它清掉' },
      { value: 'prodrug', label: '前驅藥 · CYP 把它變活' },
    ],
    value: 'active',
    onChange: (v) => {
      // 換藥物類型時清掉舊產物，避免顏色意義混在一起
      for (const p of P) if (p.alive && p.type === 1) p.sT = 0
      setState({ kind: v }, true)
    },
  })
  const segM = ui.segmented({
    label: '併用的其他藥物',
    options: [
      { value: 'none', label: '無' },
      { value: 'strong', label: '強效抑制劑', color: COLORS.magenta },
      { value: 'moderate', label: '中效抑制劑', color: COLORS.magenta },
      { value: 'inducer', label: '誘導劑', color: COLORS.cyan },
    ],
    value: 'none',
    onChange: (v) => setState({ mod: v }, true),
  })
  const sld = ui.slider({
    label: '劑量（示意，不是用藥建議）',
    min: 50,
    max: 200,
    step: 10,
    value: 100,
    format: (v) => v + '%',
    onInput: (v) => setState({ dose: v / 100 }, true),
  })
  const rdWrap = ui.group()
  const restartBtn = rdWrap.button({
    label: '▶ 重新服藥',
    onClick: () => restartDose(),
  })
  restartBtn.button.title = '從第 0 小時重新開始模擬服藥'
  const rTime = rdWrap.readout({ label: '服藥後時間', value: '' })
  const rDrug = rdWrap.readout({ label: '母藥濃度（示意）', value: '' })
  const rMeta = rdWrap.readout({ label: '代謝物濃度（示意）', value: '' })
  const rEnz = rdWrap.readout({ label: '有功能的 CYP（示意）', value: '' })
  for (const r of [rTime, rDrug, rMeta, rEnz]) {
    const v = r.el.querySelector('.readout-value')
    if (v) v.setAttribute('aria-live', 'off')
    r.el.style.padding = '5px 9px'
  }
  const ctlBox = ctx.el.querySelector('.stage-controls')
  const rdGroupEl = rTime.el.parentElement
  if (rdGroupEl && rdGroupEl !== ctlBox) {
    rdGroupEl.style.gridColumn = '1 / -1'
    rdGroupEl.style.display = 'grid'
    rdGroupEl.style.gridTemplateColumns = 'repeat(auto-fit, minmax(120px, 1fr))'
    rdGroupEl.style.gap = '8px'
  }
  ui.note('全部是示意：酵素數量、曲線與劑量都不是任何真實藥物或族群的數據。空的環代表沒有功能的酵素。CYP2D6 沒有「快速代謝者」這一類，這裡為了通用而保留五類。「誘導劑」為通用示意；CPIC 指出目前沒有證據顯示藥物會對 CYP2D6 產生臨床上有意義的誘導。')

  // 縮小 HUD 字級，避免在小螢幕遮住主體（只作用在本舞台）
  const capEl = ctx.el.querySelector('.hud-caption')
  if (capEl) capEl.style.fontSize = 'clamp(0.74rem, 2.5vw, 0.86rem)'
  const legEl = ctx.el.querySelector('.hud-legend')
  if (legEl) {
    legEl.style.fontSize = 'clamp(0.7rem, 2.3vw, 0.78rem)'
  }
  const isNarrow = () => (ctx.size.w || 600) < 480

  function refreshHud() {
    const label = PHENO_ZH[st.pheno]
    if (st.mod === 'none') hud.badge(`${st.pheno} · ${label}`)
    else hud.badge(isNarrow() ? `${st.pheno} → 像 ${effKey}(${SPEED_LABEL[st.mod].slice(0, 2)})` : `${st.pheno} → 實際像 ${effKey}(${SPEED_LABEL[st.mod]})`)
    const items = [{ color: COLORS.drug, label: st.kind === 'active' ? '藥物' : '前驅藥' }]
    items.push(st.kind === 'active' ? { color: COLORS.inactive, label: '無活性代謝物' } : { color: COLORS.metabolite, label: '活性代謝物' })
    items.push({ color: COLORS.enzyme, label: 'CYP 酵素' })
    if (st.mod === 'strong' || st.mod === 'moderate') items.push({ color: COLORS.magenta, label: '抑制劑' })
    // 小螢幕且圖表在畫面上時，圖例會擋到圖表與膜，略過（顏色語意在第 0、1 步已說明）
    hud.legend(step === 1 || (isNarrow() && (chartTarget > 0 || step === 0)) ? [] : items)
    if (step <= 1 && !demo && st.mod === 'none' && st.pheno === 'NM' && st.kind === 'active') {
      hud.caption(STEP_CAPTION[Math.min(step, 1)] + (introHint && step === 0 ? ' 試試看：用下方控制項把 NM 切換成 PM。' : ''))
    } else {
      hud.caption(`${MOD_PREFIX[st.mod]}${MECH[st.kind][effKey]} → ${OUTCOME[st.kind][zone.zone]}（示意）`)
    }
  }

  // ───────────────────────── 鏡頭 ─────────────────────────
  const fovRad = () => THREE.MathUtils.degToRad(camera.fov)
  const dirOf = (az, el) => new V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  const FIT_H = 12.2 // 全景要涵蓋的世界高度（圖表+膜+HUD）
  const FIT_W = 14.4
  function fullDist(aspect) {
    const th = Math.tan(fovRad() / 2)
    return Math.max(FIT_H / (2 * th), FIT_W / (2 * th * aspect))
  }
  function fitRadius(aspect) {
    const vf = fovRad()
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect)
    return fullDist(aspect) * Math.sin(Math.min(vf, hf) / 2)
  }
  const SUBJ = new V3(...SUBJECT)
  /** shift：主體中心相對畫面中心往下偏移的比例（以畫面高度計） */
  function makeGoal(center, dist, az, el, shift) {
    const dir = dirOf(az, el)
    const fwd = dir.clone().negate()
    const right = new V3().crossVectors(fwd, new V3(0, 1, 0)).normalize()
    const up = new V3().crossVectors(right, fwd).normalize()
    const viewH = 2 * dist * Math.tan(fovRad() / 2)
    const tgt = center.clone().addScaledVector(up, shift * viewH)
    return { tgt, pos: tgt.clone().addScaledVector(dir, dist) }
  }
  function goalFor(s) {
    const asp = camera.aspect || 1.33
    const th = Math.tan(fovRad() / 2)
    if (s <= 0) {
      const narrow = isNarrow()
      const d = Math.max((narrow ? 8.6 : 8.2) / (2 * th), (narrow ? 12.4 : 12.4) / (2 * th * asp))
      return makeGoal(SUBJ, d, 0.26, 0.4, narrow ? -0.02 : 0.0)
    }
    if (s === 1) {
      const narrow = isNarrow()
      const d = Math.max((narrow ? 4.3 : 3.5) / (2 * th), (narrow ? 5.4 : 4.6) / (2 * th * asp))
      return makeGoal(new V3(F.x + 0.3, 1.0, F.z), d, 0.55, 0.3, narrow ? 0.02 : -0.05)
    }
    // 圖表在上、膜在下：主體放在「圖表下緣」與「HUD 上緣」的中間
    const hPx = ctx.size.h || 471
    const hudH = isNarrow() ? 78 : clamp(hPx * 0.22, 92, 104)
    const chartBottom = chartTopPx(hPx) + chartHpx
    const shift = clamp((chartBottom + (hPx - hudH)) / (2 * hPx) - 0.5, 0.04, 0.24)
    return makeGoal(SUBJ, fullDist(asp), 0.2, 0.4, shift)
  }
  let anim = null
  function goCam(goal, snap) {
    if (snap) {
      camera.position.copy(goal.pos)
      controls.target.copy(goal.tgt)
      controls.update()
      anim = null
    } else {
      anim = { from: { pos: camera.position.clone(), tgt: controls.target.clone() }, to: goal, t: 0 }
    }
  }
  ctx.setFrame(SUBJ, fitRadius(ctx.size.aspect || 1.33), { azimuth: 0.32, elevation: 0.4, padding: 1 })

  const offPointer = ctx.onPointer((type) => {
    if (type === 'down') anim = null
    if (type === 'move' || type === 'click') {
      const hits = ctx.pick([bodies, rings], false)
      if (hits.length && hits[0].instanceId != null) {
        const tip = ENZYME_TIP[slots[hits[0].instanceId].S]
        if (coarse) {
          // 觸控：pointerleave 會立刻收掉工具提示，改把說明放進圖說停留數秒
          if (type === 'click') {
            hud.caption(tip)
            tipT = 3.5
          }
        } else {
          hud.tip(tip)
          ctx.setCursor('pointer')
        }
      } else {
        hud.tip(null)
        ctx.setCursor('')
      }
    } else if (type === 'leave') hud.tip(null)
  })

  // ───────────────────────── 初始化 ─────────────────────────
  recompute()
  edgeColor.setHex(COLORS[effKey])
  for (const s of slots) {
    s.g = GROW[s.S]
    s.col.copy(BODY_COL[s.S])
  }
  // 起始就放一些粒子，讓畫面一開始就有東西
  for (let i = 0; i < 26; i++) spawn(0, -6.3 + rand() * 12.6, LANE_Y - 0.3 + rand() * 0.75, -1.7 + rand() * 3.4, 1)
  for (let i = 0; i < 6; i++) spawn(1, -5 + rand() * 10, LANE_Y - 0.3 + rand() * 0.75, -1.7 + rand() * 3.4, 1)
  for (const l of labels) {
    l.target = l.show.includes(0) ? 1 : 0
    l.a = l.target
  }
  refreshHud()
  syncUI()
  layoutChart()
  goCam(goalFor(0), true)
  lastAsp = camera.aspect || 1

  // ───────────────────────── 步驟 ─────────────────────────
  function restartDose() {
    simT = 0
    holdT = 0
    prevT = -1
  }
  function onStep(i) {
    step = i
    for (const l of labels) l.target = l.show.includes(i) ? 1 : 0
    chartTarget = i >= 2 ? 1 : 0
    demo = null
    spotT = 0
    if (i > 1) userTouched = false
    if (i <= 1) {
      if (!userTouched) setState({ pheno: 'NM', kind: 'active', mod: 'none', dose: 1 })
    } else if (i === 2) {
      setState({ pheno: 'UM', kind: 'active', mod: 'none', dose: 1 })
      demo = { kind: 'cycle', t: 0 }
      restartDose()
    } else if (i === 3) {
      setState({ pheno: 'PM', kind: 'active', mod: 'none', dose: 1 })
      demo = { kind: 'flip', t: 0 }
      restartDose()
    } else if (i === 4) {
      setState({ pheno: 'NM', kind: 'prodrug', mod: 'none', dose: 1 })
      demo = { kind: 'inhibit', t: 0 }
      restartDose()
    } else {
      // 總結：基因型正常 + 中效抑制劑，圖上同時看到虛線基線與實線實際情況，之後交給讀者操作
      setState({ pheno: 'NM', kind: 'prodrug', mod: 'moderate', dose: 1 })
      restartDose()
    }
    layoutChart()
    goCam(goalFor(i), false)
    refreshHud()
  }

  function tickDemo(dt) {
    demo.t += dt
    if (demo.kind === 'cycle') {
      const idx = Math.floor(demo.t / 3.4) % 5
      const want = ['UM', 'RM', 'NM', 'IM', 'PM'][idx]
      if (want !== st.pheno) setState({ pheno: want })
    } else if (demo.kind === 'flip') {
      const want = Math.floor(demo.t / 6) % 2 === 0 ? 'active' : 'prodrug'
      if (want !== st.kind) {
        for (const p of P) if (p.alive && p.type === 1) p.sT = 0
        setState({ kind: want })
      }
    } else if (demo.kind === 'inhibit') {
      if (demo.t > 2.2 && st.mod === 'none') setState({ mod: 'strong' })
      if (demo.t > 12) demo = null
    }
  }

  // ───────────────────────── 每幀 ─────────────────────────
  const tmpV = new V3()
  const camR = new V3()
  const camU = new V3()
  const lp = new V3()
  function updateLabels(dt, size) {
    camera.updateMatrixWorld(true)
    camR.setFromMatrixColumn(camera.matrixWorld, 0)
    camU.setFromMatrixColumn(camera.matrixWorld, 1)
    const viewH = size.h || 400
    const viewW = size.w || 600
    const px = clamp(viewH * 0.06, 22, 29)
    const ok = clamp(viewH / 471, 0.62, 1) // 小螢幕時縮小偏移量
    const tanH = Math.tan(fovRad() / 2)
    for (const e of labels) {
      const want = e.hideNarrow && isNarrow() ? 0 : e.target
      e.a = util.damp(e.a, want, want ? 6 : 14, dt)
      const vis = e.a > 0.02
      e.s.visible = vis
      e.line.visible = vis
      if (!vis) continue
      tmpV.copy(e.anchor).applyMatrix4(camera.matrixWorldInverse)
      const dz = Math.max(0.5, -tmpV.z)
      const wpp = (2 * dz * tanH) / viewH
      const ph = px * wpp
      let ox = e.off[0] * ok
      const oy = e.off[1] * ok
      // 標籤整個要留在畫面內：必要時水平推回來
      const halfW = (px * e.aspect) / 2
      tmpV.copy(e.anchor).project(camera)
      const sx = (tmpV.x * 0.5 + 0.5) * viewW + ox
      if (sx - halfW < 6) ox += 6 + halfW - sx
      else if (sx + halfW > viewW - 6) ox -= sx + halfW - (viewW - 6)
      lp.copy(e.anchor).addScaledVector(camR, ox * wpp).addScaledVector(camU, oy * wpp)
      e.s.position.copy(lp)
      e.s.scale.set(ph * e.aspect, ph, 1)
      e.s.material.opacity = e.a
      // 引線：從標籤邊緣連到目標點
      const attr = e.line.geometry.attributes.position
      const len = Math.hypot(ox, oy) || 1
      const back = (Math.min(len - 4, 16)) / len
      attr.setXYZ(0, e.anchor.x, e.anchor.y, e.anchor.z)
      attr.setXYZ(1, lp.x + (e.anchor.x - lp.x) * back, lp.y + (e.anchor.y - lp.y) * back, lp.z + (e.anchor.z - lp.z) * back)
      attr.needsUpdate = true
      e.line.material.opacity = e.a * 0.8
    }
  }

  return {
    onStep,
    onResize() {
      layoutChart()
      refreshHud()
      const keepPos = camera.position.clone()
      const keepTgt = controls.target.clone()
      const asp = camera.aspect || 1.33
      ctx.setFrame(SUBJ, fitRadius(asp), { padding: 1 })
      if (Math.abs(asp - lastAsp) > 0.02) goCam(goalFor(step), true)
      else {
        // 只是重建 renderer 或高度微調：保留使用者轉好的視角
        camera.position.copy(keepPos)
        controls.target.copy(keepTgt)
        controls.update()
      }
      lastAsp = asp
    },
    onResetView() {
      goCam(goalFor(step), true)
    },
    update(dt, t) {
      elapsed += dt
      const now = performance.now()
      // 使用者觸發的動畫（鏡頭、淡入淡出、酵素長出/被堵）用實際時間；暫停時模擬本身仍凍結
      const rdt = Math.min(0.05, (now - lastNow) / 1000 || 0)
      lastNow = now
      const size = ctx.size
      const m = ctx.motion
      if (tipT > 0) {
        tipT -= rdt
        if (tipT <= 0) refreshHud()
      }
      if (demo) tickDemo(dt)

      // 時間推進
      if (dt > 0) {
        if (simT >= HOURS) {
          holdT += dt
          if (holdT > 2.5) restartDose()
        } else simT = Math.min(HOURS, simT + dt * SIM_SPEED)
      }
      for (const d of DOSE_TIMES) if (prevT < d && simT >= d) pillT = 0
      prevT = simT
      const s0 = series[st.pheno]
      const cp = sample(s0.cp, simT)
      const cm = sample(s0.cm, simT)

      // 粒子協調
      recAcc += rdt
      if (recAcc > 1 / 12) {
        recAcc = 0
        reconcile(cp, cm, dt === 0)
      }

      // 放大步驟：固定節奏讓一顆藥物分子撞上聚焦的那顆酵素，好看清楚反應過程
      if (step === 1 && dt > 0) {
        spotT += dt
        if (spotT > 2.6 && isFunc(F)) {
          spotT = 0
          const p = spawn(0, F.x - 2.5, LANE_Y + 0.05, F.z + (rand() - 0.5) * 0.3, 0.6)
          if (p) {
            p.vx = 1.0
            p.dockAtX = F.x - 1.05
          }
        }
      }

      // 酵素
      for (let i = 0; i < NS; i++) {
        const s = slots[i]
        s.g = util.damp(s.g, GROW[s.S], 5, rdt)
        s.plug = util.damp(s.plug, s.S === 3 ? 1 : 0, 4.5, rdt)
        s.flash = Math.max(0, s.flash - rdt * 2.0)
        s.col.lerp(BODY_COL[s.S], 1 - Math.exp(-6 * rdt))
        tmpC.copy(s.col).multiplyScalar(s.tint)
        bodies.setColorAt(i, tmpC)
        const g = s.g
        const alive = s.S === 1 || s.S === 2
        const wob = alive ? 1 + 0.025 * Math.sin(t * 2.2 * m + s.ph) : 1
        const sxz = (1 + (1 - g) * 0.2) * wob
        dummy.position.set(s.x, s.y0 + 0.3 * g, s.z)
        dummy.rotation.set(0, s.rot, 0)
        dummy.scale.set(sxz, g * wob, sxz)
        dummy.updateMatrix()
        bodies.setMatrixAt(i, dummy.matrix)
        const topY = s.y0 + 0.3 * g + 0.42 * g * 0.95
        const hs = (alive ? 1 : s.S === 3 ? 0.85 : 0) * (1 + 0.55 * s.flash) * clamp(g * 1.4 - 0.2, 0, 1)
        dummy.position.set(s.x, topY + 0.02, s.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(Math.max(0.0001, hs))
        dummy.updateMatrix()
        hemes.setMatrixAt(i, dummy.matrix)
        fes.setMatrixAt(i, dummy.matrix)
        tmpC.copy(alive ? HEME_BASE : HEME_DIM).lerp(white, s.flash)
        tmpC.multiplyScalar(1 + s.flash * 1.4)
        hemes.setColorAt(i, tmpC)
        tmpC.copy(alive ? white : HEME_DIM).multiplyScalar(1 + s.flash * 1.5)
        fes.setColorAt(i, tmpC)
        // 底環：顏色 = 實際代謝型；空位 = 暗淡的環
        tmpC.setHex(s.S === 0 ? 0x4a62b8 : COLORS[effKey])
        if (s.S === 0) tmpC.multiplyScalar(0.75)
        else if (s.S === 3) tmpC.multiplyScalar(0.55)
        else tmpC.multiplyScalar(0.9 + 0.5 * s.flash)
        s.ring.lerp(tmpC, 1 - Math.exp(-6 * rdt))
        rings.setColorAt(i, s.ring)
        dummy.position.set(s.x, s.y0 + 0.035, s.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.setScalar(s.S === 0 ? 0.82 : 1 + 0.08 * s.flash)
        dummy.updateMatrix()
        rings.setMatrixAt(i, dummy.matrix)
        // 抑制劑塞子
        dummy.position.set(s.x, topY + 0.2 + (1 - s.plug) * 1.6, s.z)
        dummy.rotation.set(0, s.rot + s.plug * 0.4, 0)
        dummy.scale.setScalar(Math.max(0.0001, clamp(s.plug * 2.5, 0, 1)))
        dummy.updateMatrix()
        plugs.setMatrixAt(i, dummy.matrix)
      }
      for (const mesh of INST) {
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      }
      edge.material.color.lerp(edgeColor, 1 - Math.exp(-6 * rdt))
      edge.material.emissive.copy(edge.material.color)

      if (!bsDone) {
        bodies.computeBoundingSphere()
        bsDone = true
      }

      // 粒子
      const prodCol = productColor()
      prodMat.color.set(prodCol)
      prodMat.emissive.set(prodCol)
      prodMat.emissiveIntensity = st.kind === 'prodrug' ? 0.7 : 0.25
      let nd = 0
      let np = 0
      for (const p of P) {
        if (!p.alive) continue
        p.s = util.damp(p.s, p.sT, 7, rdt)
        if (p.sT === 0 && p.s < 0.03) {
          p.alive = false
          continue
        }
        if (p.state === 0) {
          p.x += p.vx * dt * (0.4 + 0.6 * m)
          p.y = p.yb + 0.16 * m * Math.sin(t * 1.3 + p.ph)
          p.z = p.zb + 0.22 * m * Math.sin(t * 0.8 + p.ph * 1.7)
          if (p.dockAtX != null && p.x >= p.dockAtX) {
            p.dockAtX = null
            if (isFunc(F)) dockTo(p, slots.indexOf(F))
          }
          if (p.x > GATE_X && p.sT > 0) p.sT = 0
        } else {
          p.t += dt
          const tt = p.t
          if (tt < 0.55) {
            const u = util.easeInOut(tt / 0.55)
            p.x = util.lerp(p.fx, p.sx, u)
            p.y = util.lerp(p.fy, p.sy, u) + Math.sin(u * Math.PI) * 0.3
            p.z = util.lerp(p.fz, p.sz, u)
          } else if (tt < 0.9) {
            p.x = p.sx + 0.03 * Math.sin(tt * 40)
            p.y = p.sy
            p.z = p.sz
            if (!p.flipped && tt > 0.62) {
              p.flipped = true
              slots[p.slot].flash = 1
              flashAt(p.sx, p.sy - 0.1, p.sz, productColor(), 1.7)
            }
          } else if (tt < 1.5) {
            const u = util.easeInOut((tt - 0.9) / 0.6)
            p.x = util.lerp(p.sx, p.tx, u)
            p.y = util.lerp(p.sy, p.ty, u)
            p.z = util.lerp(p.sz, p.tz, u)
          } else {
            p.state = 0
            p.yb = p.ty
            p.zb = p.tz
          }
        }
        p.spin += dt * 1.2
        const showProd = p.type === 1 && !(p.state === 1 && !p.flipped)
        dummy.position.set(p.x, p.y, p.z)
        dummy.rotation.set(p.spin * 0.7, p.spin, p.ph)
        dummy.scale.setScalar(Math.max(0.0001, p.s))
        dummy.updateMatrix()
        if (showProd) {
          prodMesh.setMatrixAt(np, dummy.matrix)
          oxMesh.setMatrixAt(np, dummy.matrix)
          np++
        } else {
          drugMesh.setMatrixAt(nd, dummy.matrix)
          nd++
        }
      }
      drugMesh.count = nd
      prodMesh.count = np
      oxMesh.count = np
      drugMesh.instanceMatrix.needsUpdate = true
      prodMesh.instanceMatrix.needsUpdate = true
      oxMesh.instanceMatrix.needsUpdate = true

      // 反應光暈
      for (const g of glows) {
        if (g.userData.life > 0) {
          g.userData.life -= rdt * 2.4
          const k = Math.max(0, g.userData.life)
          g.material.opacity = k * 0.9
          g.scale.setScalar(g.userData.size * (1.4 - k * 0.6))
        } else if (g.visible) {
          g.material.opacity = 0
          g.visible = false
        }
      }

      // 藥丸
      if (pillT >= 0) {
        pillT += dt / 0.9
        const u = Math.min(1, pillT)
        pill.visible = u < 1
        pill.position.set(-GATE_X + 0.3 + u * 0.7, util.lerp(4.6, LANE_Y + 0.1, u * u), 0)
        pill.rotation.set(0, 0, u * 4.5)
        if (pillT >= 1) {
          pillT = -1
          flashAt(-GATE_X + 1, LANE_Y + 0.1, 0, COLORS.drug, 2.6)
        }
      }

      // 鏡頭動畫
      if (anim) {
        anim.t += rdt / 1.4
        const e = util.easeInOut(Math.min(1, anim.t))
        camera.position.lerpVectors(anim.from.pos, anim.to.pos, e)
        controls.target.lerpVectors(anim.from.tgt, anim.to.tgt, e)
        if (anim.t >= 1) anim = null
      }

      // 圖表（低頻重繪）
      chartOp = util.damp(chartOp, chartTarget, 4, rdt)
      chart.mesh.material.opacity = chartOp
      chart.mesh.visible = chartOp > 0.02
      chartAcc += rdt
      if (chart.mesh.visible && chartAcc > 0.2) {
        chartAcc = 0
        chart.redraw((g, W, H) => drawChart(g, W, H, { series, baseline, pheno: st.pheno, kind: st.kind, simT, font: util.FONT_STACK, narrow: isNarrow() }))
      }

      updateLabels(rdt, size)

      // 讀數（低頻）
      rdAcc += rdt
      if (rdAcc > 1 / 6) {
        rdAcc = 0
        const put = (r, key, txt) => {
          if (rdCache[key] !== txt) {
            rdCache[key] = txt
            r.set(txt)
          }
        }
        put(rTime, 't', `第 ${Math.floor(simT)} 小時 / ${HOURS}`)
        const cur = st.kind === 'active' ? cp : cm
        const z = cur < WINDOW.lo ? 'low' : cur > WINDOW.hi ? 'high' : 'in'
        const zc = { low: '#ffc44d', in: '#4be3a0', high: '#ff5c5c' }[z]
        const zt = { low: '低於治療窗', in: '治療窗內', high: '高於治療窗' }[z]
        if (st.kind === 'active') {
          put(rDrug, 'd', `${cp.toFixed(2)} · ${zt}`)
          rDrug.setColor(zc)
          put(rMeta, 'm', `${cm.toFixed(2)} · 無活性`)
          rMeta.setColor('#9aa6c4')
        } else {
          put(rDrug, 'd', `${cp.toFixed(2)} · 無活性`)
          rDrug.setColor('#9aa6c4')
          put(rMeta, 'm', `${cm.toFixed(2)} · ${zt}`)
          rMeta.setColor(zc)
        }
        put(rEnz, 'e', `${nFunc} / ${NS}` + (st.mod !== 'none' ? `（基因型原本 ${nBase}）` : ''))
        rEnz.setColor(`#${COLORS[effKey].toString(16).padStart(6, '0')}`)
      }
      dust.rotation.y = t * 0.01 * m
    },
    dispose() {
      if (offPointer) offPointer()
      for (const m of [...INST, drugMesh, prodMesh, oxMesh]) m.dispose()
      if (capEl) capEl.style.fontSize = ''
      if (legEl) {
        legEl.style.fontSize = ''
      }
      camera.remove(chart.mesh)
      scene.remove(camera)
      chart.tex.dispose()
      chart.mesh.geometry.dispose()
      chart.mesh.material.dispose()
    },
  }
}
