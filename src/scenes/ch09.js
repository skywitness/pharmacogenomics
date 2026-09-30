// ch09 場景「基因檢測流水線」
// 一條 U 形輸送帶串起六個站：採檢 → 萃取 → 檢測（實體檢體）│ 數位化 │ 判讀 → 決策支援 → 處方（資料）
// 粉紅試管 = 你的檢體；過了「數位化」閘門後它變成一份報告（資料流）。
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { STATIONS, TECHS, SCENARIOS, SCENARIO_ORDER, ETHICS_CHIPS, seenBy, toneColor } from './ch09/data.js'
import { drawCard, drawMonitor, drawSheet, drawCurves } from './ch09/panels.js'

export const options = {
  fov: 42,
  camera: [0, 12, 15],
  target: [0.4, 0.3, 0],
  exposure: 1.12,
  envIntensity: 0.6,
  minPolarAngle: 0.2,
  maxPolarAngle: 1.36,
}

const BY = 0.42 // 輸送帶表面高度
const PAD_Y = 0.31 // 站台檯面高度
const ZA = -1.7
const ZB = 1.7
const XL = -7.5
const XR = 6.9
const R = 1.7
const BELT_W = 1.3
const PAD_W = 3.9
const PAD_D = 3.3

export default function create(ctx) {
  const { THREE, util, palette, scene, camera, controls, ui, hud } = ctx
  const { COLORS } = palette
  const V3 = THREE.Vector3
  const rand = util.rng(9)
  util.addStudioLights(scene, { intensity: 1.05 })

  // ───────────────────────── 材質小工具 ─────────────────────────
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, ...o })
  const emis = (color, k = 1.2, o = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4, metalness: 0, ...o })
  const basic = (color, opacity = 1, additive = false) =>
    new THREE.MeshBasicMaterial({ color, transparent: opacity < 1 || additive, opacity, depthWrite: !(opacity < 1 || additive), blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending })
  const glassM = new THREE.MeshPhysicalMaterial({ color: 0xdfeaff, transparent: true, opacity: 0.26, roughness: 0.08, metalness: 0, clearcoat: 1, depthWrite: false })
  const css = palette.hex

  // ───────────────────────── 狀態 ─────────────────────────
  let scen = 'acs'
  let techKey = 'pcr'
  let prospective = false
  let step = 0 // 由文字捲動決定的步驟
  let stage = 0 // 目前顯示的站（0 = 總覽）
  let mode = 'loop' // loop | park | run
  let heroS = 0
  let loopT = 0
  let runT = 0
  let labelK = 1
  let captionKey = ''
  let cardKey = ''

  // ───────────────────────── 路徑（輸送帶中心線） ─────────────────────────
  const PTS = []
  const DS = 0.06
  for (let x = XL; x <= XR + 1e-6; x += DS) PTS.push(new V3(x, BY, ZA))
  const na = Math.ceil((Math.PI * R) / DS)
  for (let k = 1; k <= na; k++) {
    const th = -Math.PI / 2 + (Math.PI * k) / na
    PTS.push(new V3(XR + R * Math.cos(th), BY, R * Math.sin(th)))
  }
  for (let x = XR - DS; x >= XL - 1e-6; x -= DS) PTS.push(new V3(x, BY, ZB))
  const CUM = [0]
  for (let i = 1; i < PTS.length; i++) CUM.push(CUM[i - 1] + PTS[i].distanceTo(PTS[i - 1]))
  const S_END = CUM[CUM.length - 1]
  let segF = 0 // seg() 的小數部分（避免每次呼叫配置新陣列）
  function seg(s) {
    s = util.clamp(s, 0, S_END - 1e-6)
    let lo = 0
    let hi = CUM.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (CUM[mid] <= s) lo = mid
      else hi = mid
    }
    segF = (s - CUM[lo]) / Math.max(1e-6, CUM[lo + 1] - CUM[lo])
    return lo
  }
  function pointAt(s, out = new V3()) {
    const i = seg(s)
    return out.copy(PTS[i]).lerp(PTS[i + 1], segF)
  }
  function tangentAt(s, out = new V3()) {
    const i = seg(s)
    return out.copy(PTS[Math.min(PTS.length - 1, i + 1)]).sub(PTS[i]).normalize()
  }
  const nearestS = (x, z) => {
    let best = 0
    let bd = 1e9
    PTS.forEach((p, i) => {
      const d = (p.x - x) ** 2 + (p.z - z) ** 2
      if (d < bd) {
        bd = d
        best = i
      }
    })
    return CUM[best]
  }
  STATIONS.forEach((st) => (st.s = nearestS(st.x, st.row === 'A' ? ZA : ZB)))
  const S_GATE = STATIONS[2].s + 1.35 // 數位化閘門

  // ───────────────────────── 地板 ─────────────────────────
  const floor = new THREE.Mesh(new RoundedBoxGeometry(19.6, 0.24, 14.4, 3, 0.08), std(0x0d1636, { roughness: 0.7, metalness: 0.1 }))
  floor.position.set(0.7, -0.12, 0)
  scene.add(floor)
  {
    const pos = []
    for (let x = -9; x <= 10.4; x += 1) pos.push(x, 0.006, -7, x, 0.006, 7)
    for (let z = -7; z <= 7; z += 1) pos.push(-9, 0.006, z, 10.4, 0.006, z)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2a3d7a, transparent: true, opacity: 0.32 })))
  }
  const dust = util.createParticles({ count: 160, spread: [22, 7, 16], size: 0.07, color: 0x8fb4ff, opacity: 0.45, seed: 12 })
  dust.position.set(0.5, 3.4, 0)
  scene.add(dust)

  // ───────────────────────── 輸送帶 ─────────────────────────
  function chevronTex(fg, bg) {
    const c = document.createElement('canvas')
    c.width = 128
    c.height = 64
    const g = c.getContext('2d')
    g.fillStyle = bg
    g.fillRect(0, 0, 128, 64)
    g.strokeStyle = fg
    g.lineWidth = 8
    g.lineCap = 'round'
    g.lineJoin = 'round'
    g.beginPath()
    g.moveTo(46, 14)
    g.lineTo(80, 32)
    g.lineTo(46, 50)
    g.stroke()
    const t = new THREE.CanvasTexture(c)
    t.wrapS = THREE.RepeatWrapping
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  }
  /** 沿路徑產生條帶（flat：水平；wall：垂直牆） */
  function strips(sA, sB, defs, uvLen = 2.6) {
    const pos = []
    const uv = []
    const idx = []
    const n = Math.max(2, Math.ceil((sB - sA) / 0.1))
    const p = new V3()
    const t = new V3()
    for (const d of defs) {
      const base = pos.length / 3
      for (let i = 0; i <= n; i++) {
        const s = sA + ((sB - sA) * i) / n
        pointAt(s, p)
        tangentAt(s, t)
        const nx = -t.z
        const nz = t.x
        if (d.kind === 'wall') {
          pos.push(p.x + nx * d.off, d.y0, p.z + nz * d.off, p.x + nx * d.off, d.y1, p.z + nz * d.off)
        } else {
          pos.push(p.x + nx * (d.off + d.w / 2), d.y, p.z + nz * (d.off + d.w / 2), p.x + nx * (d.off - d.w / 2), d.y, p.z + nz * (d.off - d.w / 2))
        }
        uv.push(s / uvLen, 0, s / uvLen, 1)
      }
      for (let i = 0; i < n; i++) {
        const a = base + i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }
  const beltTex = { phys: chevronTex('#8fa4e8', '#1f2b56'), data: chevronTex('#35d6ff', '#0b3450') }
  const beltRoot = new THREE.Group()
  scene.add(beltRoot)
  ;[
    { a: 0, b: S_GATE, key: 'phys', edge: 0xa9b8ff },
    { a: S_GATE, b: S_END, key: 'data', edge: COLORS.cyan },
  ].forEach((sec) => {
    const top = new THREE.Mesh(
      strips(sec.a, sec.b, [{ kind: 'flat', off: 0, w: BELT_W, y: BY }]),
      new THREE.MeshBasicMaterial({ map: beltTex[sec.key], side: THREE.DoubleSide })
    )
    const wall = new THREE.Mesh(
      strips(sec.a, sec.b, [
        { kind: 'wall', off: BELT_W / 2 + 0.02, y0: 0.06, y1: BY },
        { kind: 'wall', off: -BELT_W / 2 - 0.02, y0: 0.06, y1: BY },
      ]),
      std(sec.key === 'phys' ? 0x151f45 : 0x0a2a44, { side: THREE.DoubleSide, roughness: 0.6 })
    )
    const edge = new THREE.Mesh(
      strips(sec.a, sec.b, [
        { kind: 'flat', off: BELT_W / 2 + 0.03, w: 0.1, y: BY + 0.012 },
        { kind: 'flat', off: -BELT_W / 2 - 0.03, w: 0.1, y: BY + 0.012 },
      ]),
      new THREE.MeshBasicMaterial({ color: sec.edge, side: THREE.DoubleSide })
    )
    beltRoot.add(top, wall, edge)
  })

  // 數位化閘門
  const gate = new THREE.Group()
  {
    const p = pointAt(S_GATE)
    gate.position.set(p.x, BY, p.z)
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.055, 10, 40, Math.PI), basic(COLORS.cyan, 1))
    arch.rotation.y = Math.PI / 2
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.84, 0.92), basic(COLORS.cyan, 0.0, true))
    sheet.rotation.y = Math.PI / 2
    sheet.position.y = 0.46
    gate.userData.sheet = sheet
    gate.add(arch, sheet)
    scene.add(gate)
  }

  // ───────────────────────── 標籤 ─────────────────────────
  const labels = []
  function mkLabel(txt, opts = {}) {
    const s = util.makeLabel(txt, { fontSize: 44, worldHeight: 0.5, ...opts })
    s.userData.bs = s.scale.clone()
    s.userData.bump = 1
    labels.push(s)
    return s
  }
  function relabel(s, txt) {
    s.userData.setText(txt)
    s.userData.bs = s.scale.clone()
  }
  const setLabelK = () => {
    const w = ctx.size.w || 700
    labelK = util.clamp(760 / Math.max(w, 1), 1, 1.85)
  }

  // ───────────────────────── 試管 ─────────────────────────
  function makeTube({ cap = 0x6b78a8, fluid = COLORS.blood, level = 0.62, r = 0.17, scale = 1 } = {}) {
    const g = new THREE.Group()
    const glass = new THREE.Mesh(new THREE.CapsuleGeometry(r, 0.5, 4, 14), glassM)
    glass.position.y = 0.4
    glass.renderOrder = 3
    const liquid = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.78, 1, 14), emis(fluid, 0.35, { roughness: 0.3 }))
    const capM = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.14, 16), std(cap, { roughness: 0.4 }))
    capM.position.y = 0.86
    g.add(liquid, glass, capM)
    g.userData = { liquid, capM, r }
    g.scale.setScalar(scale)
    setTubeLevel(g, level)
    return g
  }
  function setTubeLevel(g, lvl) {
    const h = Math.max(0.001, 0.62 * lvl)
    g.userData.liquid.scale.y = h
    g.userData.liquid.position.y = 0.14 + h / 2
  }

  // ───────────────────────── 站台 ─────────────────────────
  const pads = []
  const pickables = []
  STATIONS.forEach((st, i) => {
    const zc = st.row === 'A' ? -4.6 : 4.6
    const digital = st.n >= 4
    const rimCol = digital ? COLORS.cyan : 0xa9b8ff
    const g = new THREE.Group()
    g.position.set(st.x, 0, zc)
    g.userData.stationIndex = i
    const base = new THREE.Mesh(new RoundedBoxGeometry(PAD_W, 0.28, PAD_D, 4, 0.09), std(0x1a2652, { roughness: 0.55, metalness: 0.25 }))
    base.position.y = 0.14
    const top = new THREE.Mesh(new RoundedBoxGeometry(PAD_W - 0.34, 0.05, PAD_D - 0.34, 3, 0.02), std(0x263673, { roughness: 0.65 }))
    top.position.y = 0.285
    const rim = new THREE.Mesh(new RoundedBoxGeometry(PAD_W + 0.14, 0.07, PAD_D + 0.14, 3, 0.03), basic(rimCol, 0.3))
    rim.position.y = 0.05
    const glow = util.makeGlow(rimCol, 7, 0)
    glow.position.set(0, 0.5, 0)
    const equip = new THREE.Group()
    equip.position.y = PAD_Y
    const label = mkLabel(`${st.n} ${st.name}`, { fontSize: 46, worldHeight: 0.6, color: '#f4f7ff', bg: 'rgba(8,13,34,0.82)', border: css(rimCol) })
    label.position.set(st.n === 6 ? 1.3 : 0, st.n === 3 ? 4.25 : 3.7, 0)
    label.material.color.setHex(0x9aa6c4)
    g.add(base, top, rim, glow, equip, label)
    scene.add(g)
    pads.push({ st, g, equip, rim, glow, label, act: 0, done: 0, rimCol, update: null })
    pickables.push(g)
  })

  // 每個站台底下的小說明（子標籤）
  const subLabels = []
  function mkSub(pad, txt, x, y, z) {
    const s = mkLabel(txt, { fontSize: 40, worldHeight: 0.36, bold: true, bg: 'rgba(8,13,34,0.78)' })
    s.position.set(x, y, z)
    s.material.opacity = 0
    pad.g.add(s)
    subLabels.push({ s, pad })
    return s
  }

  // ═════════ 站 1：採檢 ═════════
  {
    const pad = pads[0]
    const eq = pad.equip
    const rack = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.14, 0.66, 3, 0.05), std(0x33437c))
    rack.position.set(-0.5, 0.07, 0.25)
    eq.add(rack)
    const tubes = [-1.0, -0.5, 0].map((x, i) => {
      const t = makeTube({ cap: [0xb0304a, 0x8f7bff, 0xb0304a][i], level: i === 1 ? 0.05 : 0.85 })
      t.position.set(x, 0.14, 0.25)
      eq.add(t)
      return t
    })
    // 針頭
    const needle = new THREE.Group()
    needle.add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8), std(0xdfe6ff, { metalness: 0.6, roughness: 0.25 })))
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.2, 12), std(0x35d6ff, { roughness: 0.35 }))
    hub.position.y = 0.32
    needle.add(hub)
    needle.position.set(-0.5, 1.45, 0.25)
    eq.add(needle)
    const drops = [0, 1, 2].map(() => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), emis(COLORS.blood, 0.6))
      d.visible = false
      eq.add(d)
      return d
    })
    // 同意書
    const clip = new THREE.Group()
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.25, 0.06), std(0xa27f52, { roughness: 0.7 }))
    const paper = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.05, 0.02), std(0xeef2ff, { roughness: 0.8 }))
    paper.position.z = 0.04
    const clipTop = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.13, 0.07), std(0xc9d2ee, { metalness: 0.6, roughness: 0.3 }))
    clipTop.position.set(0, 0.6, 0.06)
    clip.add(board, paper, clipTop)
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(i === 0 ? 0.5 : 0.62, 0.04, 0.01), std(0x8b98c4))
      l.position.set(i === 0 ? -0.05 : 0, 0.34 - i * 0.16, 0.055)
      clip.add(l)
    }
    const check = new THREE.Group()
    const c1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 0.02), basic(COLORS.green))
    c1.position.set(-0.07, -0.02, 0)
    c1.rotation.z = -Math.PI / 4
    const c2 = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.02), basic(COLORS.green))
    c2.position.set(0.07, 0.03, 0)
    c2.rotation.z = Math.PI / 4
    check.add(c1, c2)
    check.position.set(0.14, -0.4, 0.07)
    check.scale.setScalar(0.001)
    clip.add(check)
    clip.position.set(1.2, 0.68, -0.15)
    clip.rotation.x = -0.78
    eq.add(clip)
    // 拭子
    const swab = new THREE.Group()
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.95, 8), std(0xdfe6ff))
    stick.rotation.z = Math.PI / 2
    const cotton = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), std(0xffffff, { roughness: 0.95 }))
    cotton.position.x = 0.5
    swab.add(stick, cotton)
    swab.position.set(-0.35, 0.09, 1.1)
    swab.rotation.y = 0.3
    eq.add(swab)
    mkSub(pad, '抽血', -0.5, 2.1, 0.25)
    mkSub(pad, '口腔拭子', -1.15, 0.75, 1.6)
    mkSub(pad, '知情同意書', 1.2, 1.75, -0.15)
    let dropT = 0
    pad.update = (dt, t, a) => {
      dropT += dt * (0.4 + a * 1.1)
      setTubeLevel(tubes[1], 0.05 + 0.8 * util.smoothstep(0.1, 0.9, a))
      drops.forEach((d, i) => {
        const k = (dropT + i / 3) % 1
        d.visible = a > 0.15 && a < 0.98
        d.position.set(-0.5, 1.2 - k * 0.3 + 0.0, 0.25)
        d.scale.setScalar(a > 0.15 ? 1 - k * 0.3 : 0)
      })
      check.scale.setScalar(Math.max(0.001, util.easeOutBack(util.smoothstep(0.35, 0.9, a))))
      needle.position.y = 1.45 - 0.05 * a
    }
  }

  // ═════════ 站 2：萃取 DNA ═════════
  {
    const pad = pads[1]
    const eq = pad.equip
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 1.05, 0.7, 40), std(0x3b4a80, { metalness: 0.45, roughness: 0.35 }))
    body.position.set(0, 0.35, 0.3)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.05, 8, 48), emis(0xa9b8ff, 0.8))
    ring.rotation.x = Math.PI / 2
    ring.position.set(0, 0.7, 0.3)
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.94, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2), glassM)
    dome.position.set(0, 0.7, 0.3)
    dome.renderOrder = 4
    const rotor = new THREE.Group()
    rotor.position.set(0, 0.86, 0.3)
    rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.06, 32), std(0x8a98c8, { metalness: 0.5, roughness: 0.3 })))
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2
      const holder = new THREE.Group()
      holder.position.set(Math.cos(ang) * 0.5, 0.05, Math.sin(ang) * 0.5)
      const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.42, 10), emis(i % 2 ? COLORS.blood : 0xcfefff, 0.35))
      tb.position.y = 0.2
      holder.rotation.set(Math.sin(ang) * 0.5, 0, -Math.cos(ang) * 0.5)
      holder.add(tb)
      rotor.add(holder)
    }
    eq.add(body, ring, rotor, dome)
    const dna = util.createDNA({ pairs: 9, radius: 0.24, pitch: 1.2, rise: 0.17, ballSize: 0.06, rungRadius: 0.022, backbone: true, seed: 5 })
    dna.group.position.set(0, 2.25, 0.3)
    dna.group.scale.setScalar(0.001)
    const dnaGlow = util.makeGlow(0xcfefff, 1.9, 0)
    dnaGlow.position.set(0, 2.25, 0.3)
    eq.add(dna.group, dnaGlow)
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.34, 0.9, 12, 1, true), basic(0xcfefff, 0, true))
    beam.position.set(0, 1.35, 0.3)
    eq.add(beam)
    mkSub(pad, '離心', -1.15, 1.0, 0.3)
    mkSub(pad, '純化的 DNA', 1.25, 2.35, 0.3)
    let spin = 0
    pad.update = (dt, t, a) => {
      spin += dt * (1.2 * ctx.motion + 30 * util.smoothstep(0.05, 0.6, a))
      rotor.rotation.y = spin
      const k = util.easeOutCubic(util.smoothstep(0.45, 0.95, a))
      dna.group.scale.setScalar(Math.max(0.001, k))
      dna.group.rotation.y = t * 0.9
      dnaGlow.material.opacity = 0.7 * k
      beam.material.opacity = 0.25 * k
    }
  }

  // ═════════ 站 3：基因檢測（三種技術） ═════════
  const techGroups = {}
  let curvesPlane
  let techLabel
  const tech = { pcrT: 0, arrT: 0, ngsT: 0 }
  {
    const pad = pads[2]
    const eq = pad.equip
    techLabel = mkSub(pad, TECHS.pcr.short, 0, 3.85, 0.2)

    // —— 即時 PCR ——
    const pcr = new THREE.Group()
    const body = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.8, 1.5, 4, 0.1), std(0x2c3b6e, { metalness: 0.35, roughness: 0.4 }))
    body.position.set(0, 0.4, 0.4)
    const strip = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.06, 0.02), emis(COLORS.cyan, 1.5))
    strip.position.set(0, 0.3, 1.16)
    const plate = new THREE.Mesh(new RoundedBoxGeometry(1.95, 0.06, 1.2, 3, 0.02), std(0x5d6fa8))
    plate.position.set(0, 0.83, 0.4)
    const wells = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 14), new THREE.MeshBasicMaterial({ color: 0xffffff }), 24)
    const wellDummy = new THREE.Object3D()
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        wellDummy.position.set(-0.75 + c * 0.3, 0.88, 0.4 - 0.45 + r * 0.3)
        wellDummy.updateMatrix()
        wells.setMatrixAt(r * 6 + c, wellDummy.matrix)
        wells.setColorAt(r * 6 + c, new THREE.Color(0x2a3556))
      }
    }
    curvesPlane = util.createChartPlane({ width: 3.4, height: 2.07, px: 480 })
    curvesPlane.mesh.position.set(0, 1.9, -0.95)
    curvesPlane.mesh.rotation.x = -0.5
    wells.frustumCulled = false
    pcr.add(body, strip, plate, wells, curvesPlane.mesh)
    const ctA = new THREE.Color(COLORS.cyan)
    const ctB = new THREE.Color(COLORS.magenta)
    const dark = new THREE.Color(0x2a3556)
    const tmpC = new THREE.Color()
    pcr.userData.update = (dt, t, a, seen) => {
      if (a > 0.3) tech.pcrT += dt * 0.14
      else tech.pcrT = Math.max(0, tech.pcrT - dt * 0.6)
      if (tech.pcrT > 1.3) tech.pcrT = 0
      const prog = Math.min(1, tech.pcrT)
      const cyc = 40 * prog
      for (let i = 0; i < 24; i++) {
        const ct = 19 + (i % 5) * 0.8
        const f = 1 / (1 + Math.exp(-(cyc - ct) / 1.6))
        const isB = seen.zyg === 'het' && (i + Math.floor(i / 6)) % 2 === 1
        tmpC.copy(dark).lerp(isB ? ctB : ctA, f * (0.35 + 0.65 * Math.min(1, a + 0.25)))
        wells.setColorAt(i, tmpC)
      }
      wells.instanceColor.needsUpdate = true
      const q = Math.round(cyc * 2)
      if (q !== pcr.userData.lastQ || pcr.userData.lastZ !== seen.zyg) {
        pcr.userData.lastQ = q
        pcr.userData.lastZ = seen.zyg
        curvesPlane.redraw((g, W, H) => drawCurves(g, W, H, { cycles: cyc, zyg: seen.zyg }))
      }
    }
    techGroups.pcr = pcr

    // —— 基因晶片 ——
    const arr = new THREE.Group()
    const tray = new THREE.Mesh(new RoundedBoxGeometry(2.4, 0.22, 1.7, 3, 0.06), std(0x24305c, { metalness: 0.3 }))
    tray.position.set(0, 0.11, 0.35)
    const chip = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.05, 1.4, 3, 0.02), new THREE.MeshPhysicalMaterial({ color: 0x9fc6ff, transparent: true, opacity: 0.35, roughness: 0.1, clearcoat: 1, depthWrite: false }))
    chip.position.set(0, 0.25, 0.35)
    chip.renderOrder = 2
    const spots = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.065, 0.065, 0.03, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }), 96)
    const spotBase = []
    const bases = ['A', 'T', 'G', 'C']
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 12; c++) {
        const i = r * 12 + c
        wellDummy.position.set(-0.85 + c * 0.155, 0.29, 0.35 - 0.5 + r * 0.143)
        wellDummy.updateMatrix()
        spots.setMatrixAt(i, wellDummy.matrix)
        spotBase.push(new THREE.Color(COLORS[bases[Math.floor(rand() * 4)]]))
        spots.setColorAt(i, new THREE.Color(0x2a3556))
      }
    }
    const rails = new THREE.Group()
    ;[-1, 1].forEach((sz) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.06, 0.06), std(0x8a98c8, { metalness: 0.5 }))
      rail.position.set(0, 1.05, 0.35 + sz * 0.95)
      rails.add(rail)
      ;[-1, 1].forEach((sx) => {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.8, 0.06), std(0x8a98c8, { metalness: 0.5 }))
        post.position.set(sx * 1.35, 0.65, 0.35 + sz * 0.95)
        rails.add(post)
      })
    })
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 2.0), emis(COLORS.cyan, 1.4))
    bar.position.set(-1, 1.05, 0.35)
    const sheet = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.72, 1.86), basic(COLORS.cyan, 0.28, true))
    sheet.position.set(-1, 0.68, 0.35)
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 24), basic(0xffffff, 0.95))
    ring.rotation.x = Math.PI / 2
    ring.position.set(-0.85 + 7 * 0.155, 0.31, 0.35 - 0.5 + 3 * 0.143)
    spots.frustumCulled = false
    arr.add(tray, chip, spots, rails, bar, sheet, ring)
    arr.userData.update = (dt, t, a) => {
      if (a > 0.3) tech.arrT += dt * 0.16
      else tech.arrT = Math.max(0, tech.arrT - dt * 0.6)
      if (tech.arrT > 1.35) tech.arrT = 0
      const prog = Math.min(1, tech.arrT)
      const bx = -1.2 + 2.4 * prog
      bar.position.x = bx
      sheet.position.x = bx
      sheet.visible = bar.visible = a > 0.2 && tech.arrT < 1.0
      for (let i = 0; i < 96; i++) {
        const c = i % 12
        const sx = -0.85 + c * 0.155
        const lit = util.smoothstep(sx - 0.05, sx + 0.1, bx) * (0.3 + 0.7 * Math.min(1, a + 0.2))
        tmpC.copy(dark).lerp(spotBase[i], lit)
        spots.setColorAt(i, tmpC)
      }
      spots.instanceColor.needsUpdate = true
      ring.visible = prog > 0.7
      ring.scale.setScalar(1 + 0.15 * Math.sin(t * 6))
    }
    techGroups.array = arr

    // —— 次世代定序 ——
    const ngs = new THREE.Group()
    const cell = new THREE.Mesh(new RoundedBoxGeometry(2.5, 0.12, 1.0, 3, 0.04), std(0x1c2a58, { metalness: 0.3 }))
    cell.position.set(0, 0.06, 1.0)
    const lanes = []
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.02, 0.1), basic(COLORS.cyan, 0.6, true))
      l.position.set(0, 0.13, 1.0 - 0.33 + i * 0.22)
      lanes.push(l)
      ngs.add(l)
    }
    // 讀段堆疊面板
    const PW = 2.7
    const PH = 1.7
    const panel = new THREE.Group()
    panel.position.set(0, 1.35, -0.55)
    panel.rotation.x = -0.45
    const back = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), basic(0x0a1230, 0.9))
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(PW, PH)), new THREE.LineBasicMaterial({ color: 0x5d7bd8 }))
    panel.add(back, frame)
    const NC = 28
    const cw = (PW - 0.3) / NC
    const cx = (c) => -PW / 2 + 0.15 + (c + 0.5) * cw
    const refBases = Array.from({ length: NC }, (_, i) => bases[(i * 7 + 3) % 4])
    const refInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(cw * 0.86, cw * 0.86), new THREE.MeshBasicMaterial({ color: 0xffffff }), NC)
    refBases.forEach((b, i) => {
      wellDummy.position.set(cx(i), -0.66, 0.005)
      wellDummy.scale.set(1, 1, 1)
      wellDummy.updateMatrix()
      refInst.setMatrixAt(i, wellDummy.matrix)
      refInst.setColorAt(i, new THREE.Color(COLORS[b]))
    })
    const MAXR = 70
    const readsInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), MAXR)
    const marks = new THREE.InstancedMesh(new THREE.PlaneGeometry(cw * 0.86, 0.066), new THREE.MeshBasicMaterial({ color: 0xffffff }), 40)
    const depthInst = new THREE.InstancedMesh(new THREE.PlaneGeometry(cw * 0.8, 1), new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.85 }), NC)
    const VC = 13
    const band = new THREE.Mesh(new THREE.PlaneGeometry(cw * 1.1, PH - 0.3), basic(0xffffff, 0.12))
    band.position.set(cx(VC), -0.02, 0.003)
    panel.add(refInst, readsInst, marks, depthInst, band)
    ;[readsInst, marks, depthInst, refInst].forEach((m) => (m.frustumCulled = false))
    ngs.add(cell, panel)
    const rd = { reads: [], depth: new Array(NC).fill(0), key: '' }
    const rr = util.rng(21)
    function buildReads(dup, zyg) {
      const key = `${dup}-${zyg}`
      if (rd.key === key) return
      rd.key = key
      const list = []
      for (let i = 0; i < MAXR - 6; i++) {
        const len = rr.int(7, 12)
        let start
        if (dup && rr() < 0.55) start = rr.int(4, 16)
        else start = rr.int(0, NC - len)
        start = Math.min(start, NC - len)
        list.push({ start, len })
      }
      list.sort((a, b) => a.start - b.start)
      const rowEnd = []
      const placed = []
      for (const r of list) {
        let row = rowEnd.findIndex((e) => e < r.start)
        if (row < 0) {
          if (rowEnd.length >= 11) continue
          row = rowEnd.length
          rowEnd.push(-1)
        }
        rowEnd[row] = r.start + r.len
        placed.push({ ...r, row })
      }
      rd.reads = placed
      rd.depth.fill(0)
      placed.forEach((r) => {
        for (let c = r.start; c < r.start + r.len; c++) rd.depth[c]++
      })
      // 變異位點標記
      let mi = 0
      placed.forEach((r, i) => {
        if (VC >= r.start && VC < r.start + r.len && mi < 40) {
          const alt = zyg === 'het' && i % 2 === 0
          const base = alt ? 'A' : 'G'
          wellDummy.position.set(cx(VC), -0.5 + r.row * 0.085, 0.006)
          wellDummy.scale.set(1, 1, 1)
          wellDummy.updateMatrix()
          marks.setMatrixAt(mi, wellDummy.matrix)
          marks.setColorAt(mi, new THREE.Color(COLORS[base]))
          r.mark = mi
          mi++
        }
      })
      marks.count = mi
      marks.instanceMatrix.needsUpdate = true
      if (marks.instanceColor) marks.instanceColor.needsUpdate = true
      readsInst.count = placed.length
      depthInst.count = NC
    }
    ngs.userData.update = (dt, t, a, seen) => {
      buildReads(seen === undefined ? false : seen.alleles[1].tone === 'um', seen.zyg)
      if (a > 0.3) tech.ngsT += dt * 0.16
      else tech.ngsT = Math.max(0, tech.ngsT - dt * 0.6)
      if (tech.ngsT > 1.35) tech.ngsT = 0
      const prog = Math.min(1, tech.ngsT)
      const n = rd.reads.length
      const shown = Math.floor(n * util.easeOutCubic(prog))
      rd.reads.forEach((r, i) => {
        const vis = i < shown ? 1 : 0.0001
        wellDummy.position.set(cx(r.start) + (r.len * cw) / 2 - cw / 2, -0.5 + r.row * 0.085, 0.004)
        wellDummy.scale.set(r.len * cw * 0.96 * vis, 0.052 * vis, 1)
        wellDummy.updateMatrix()
        readsInst.setMatrixAt(i, wellDummy.matrix)
        readsInst.setColorAt(i, tmpC.set(0x7fdcff))
      })
      readsInst.instanceMatrix.needsUpdate = true
      if (readsInst.instanceColor) readsInst.instanceColor.needsUpdate = true
      const maxD = 11
      for (let c = 0; c < NC; c++) {
        const hgt = 0.02 + (rd.depth[c] / maxD) * 0.5 * util.easeOutCubic(prog)
        wellDummy.position.set(cx(c), 0.2 + hgt / 2, 0.004)
        wellDummy.scale.set(1, hgt, 1)
        wellDummy.updateMatrix()
        depthInst.setMatrixAt(c, wellDummy.matrix)
      }
      wellDummy.scale.set(1, 1, 1)
      depthInst.instanceMatrix.needsUpdate = true
      marks.visible = prog > 0.5
      band.material.opacity = 0.1 + 0.07 * Math.sin(t * 4)
      lanes.forEach((l, i) => (l.material.opacity = 0.35 + 0.35 * Math.sin(t * 3 + i * 1.3) * (a > 0.2 ? 1 : 0.3)))
    }
    techGroups.ngs = ngs
    Object.values(techGroups).forEach((g) => {
      g.visible = false
      eq.add(g)
    })
    techGroups.pcr.visible = true
    const techEntries = Object.entries(techGroups)
    pad.update = (dt, t, a, rdt) => {
      const seen = seenBy(SCENARIOS[scen], techKey)
      for (const [k, g] of techEntries) {
        if (g.visible) {
          const sc = g.scale.y
          g.scale.setScalar(util.damp(sc, k === techKey ? 1 : 0.001, 14, rdt))
          if (k !== techKey && g.scale.y < 0.05) g.visible = false
        }
      }
      const cur = techGroups[techKey]
      if (!cur.visible) {
        cur.visible = true
        cur.scale.setScalar(0.001)
      }
      cur.userData.update(dt, t, a, seen)
    }
  }

  // ═════════ 站 4：判讀 ═════════
  let cardPlane
  {
    const pad = pads[3]
    const eq = pad.equip
    cardPlane = util.createChartPlane({ width: 3.4, height: 2.5, px: 640 })
    cardPlane.mesh.position.set(0, 1.85, -0.5)
    cardPlane.mesh.rotation.x = -0.1
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 0.12), std(0x5d6fa8, { metalness: 0.5 }))
    stand.position.set(0, 0.3, -0.5)
    const brickL = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.5, 0.5, 3, 0.08), emis(COLORS.NM, 0.55, { roughness: 0.35 }))
    const brickR = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.5, 0.5, 3, 0.08), emis(COLORS.inactive, 0.55, { roughness: 0.35 }))
    brickL.position.set(-1.3, 0.34, 0.85)
    brickR.position.set(1.3, 0.34, 0.85)
    const brickGlow = util.makeGlow(COLORS.cyan, 2.3, 0)
    brickGlow.position.set(0, 0.5, 0.85)
    eq.add(cardPlane.mesh, stand, brickL, brickR, brickGlow)
    mkSub(pad, '等位基因積木', 0, 1.0, 0.85)
    let lastQ = -1
    let lastKey = ''
    pad.update = (dt, t, a) => {
      const sc = SCENARIOS[scen]
      const seen = seenBy(sc, techKey)
      const key = `${scen}-${techKey}`
      const p = util.smoothstep(0.12, 0.98, a)
      const q = Math.round(p * 12)
      if (q !== lastQ || key !== lastKey) {
        lastQ = q
        lastKey = key
        cardPlane.redraw((g, W, H) => drawCard(g, W, H, { sc, seen, progress: q / 12 }))
        brickL.material.color.setHex(toneColor(seen.alleles[0].tone))
        brickL.material.emissive.setHex(toneColor(seen.alleles[0].tone))
        brickR.material.color.setHex(toneColor(seen.alleles[1].tone))
        brickR.material.emissive.setHex(toneColor(seen.alleles[1].tone))
      }
      const join = util.easeInOut(util.smoothstep(0.25, 0.75, a))
      brickL.position.x = util.lerp(-1.3, -0.33, join)
      brickR.position.x = util.lerp(1.3, 0.33, join)
      brickL.position.y = brickR.position.y = 0.34 + 0.05 * Math.sin(t * 2) * ctx.motion
      brickGlow.material.opacity = 0.55 * join * util.smoothstep(0.6, 1, a)
    }
  }

  // ═════════ 站 5：決策支援（電子病歷） ═════════
  let monitorPlane
  let ehrRings = []
  let ehrLock
  {
    const pad = pads[4]
    const eq = pad.equip
    monitorPlane = util.createChartPlane({ width: 2.9, height: 1.8125, px: 640 })
    monitorPlane.mesh.position.set(-0.6, 1.72, -0.35)
    monitorPlane.mesh.rotation.x = -0.1
    const bezel = new THREE.Mesh(new RoundedBoxGeometry(3.02, 1.94, 0.08, 3, 0.03), std(0x141c3c, { metalness: 0.4 }))
    bezel.position.set(-0.6, 1.72, -0.41)
    bezel.rotation.x = -0.1
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.75, 10), std(0x5d6fa8, { metalness: 0.5 }))
    stand.position.set(-0.6, 0.375, -0.42)
    // 病歷資料庫
    const db = new THREE.Group()
    db.position.set(1.5, 0, 0.7)
    db.scale.setScalar(0.85)
    for (let i = 0; i < 3; i++) {
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.26, 32), std(0x2c3b6e, { metalness: 0.4, roughness: 0.4 }))
      disc.position.y = 0.16 + i * 0.32
      const rg = new THREE.Mesh(new THREE.TorusGeometry(0.555, 0.028, 8, 40), emis(COLORS.cyan, 0.2))
      rg.rotation.x = Math.PI / 2
      rg.position.y = 0.16 + i * 0.32 + 0.135
      db.add(disc, rg)
      ehrRings.push(rg)
    }
    const dbGlow = util.makeGlow(COLORS.cyan, 2.6, 0)
    dbGlow.position.set(0, 0.6, 0)
    db.add(dbGlow)
    // 掛鎖
    ehrLock = new THREE.Group()
    const lockBody = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.28, 0.16, 2, 0.04), emis(COLORS.amber, 0.7))
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.028, 8, 20, Math.PI), std(0xdfe6ff, { metalness: 0.7, roughness: 0.25 }))
    shackle.position.y = 0.14
    ehrLock.add(lockBody, shackle)
    ehrLock.position.set(0, 1.35, 0.15)
    ehrLock.scale.setScalar(0.001)
    db.add(ehrLock)
    const wire = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.03, 0.03), basic(COLORS.cyan, 0.0, true))
    wire.position.set(0.55, 0.5, 0.7)
    wire.scale.x = 0.5
    eq.add(monitorPlane.mesh, bezel, stand, db, wire)
    mkSub(pad, '病歷', 1.5, 1.6, 0.7)
    let lastKey = ''
    let dbA = 0
    let reactT = 0 // 反應式：「等結果 → 結果回來 → 提示」的循環計時（用實際經過時間，暫停動畫時也會走）
    const REACT_CYCLE = 9.5
    const REACT_WAIT = 3.6
    pad.update = (dt, t, a, rdt) => {
      const sc = SCENARIOS[scen]
      const seen = seenBy(sc, techKey)
      const key = `${scen}-${techKey}-${prospective}`
      const q = Math.round(a * 20)
      if (!prospective && a > 0.5) reactT += rdt
      else if (prospective || a < 0.3) reactT = 0
      // wait: 0..1 = 反應式等待結果中（進度）；-1 = 不在等待（前瞻式，或結果已回來）
      let wait = -1
      if (!prospective && a >= 0.18) {
        const ph = reactT % REACT_CYCLE
        wait = a > 0.5 ? (ph < REACT_WAIT ? ph / REACT_WAIT : -1) : 0
      }
      const busy = a > 0.05
      const blink = busy ? Math.floor(t * 2) : 0
      const pulse = a > 0.62 && wait < 0 ? Math.floor(t * 5) : 0
      const spin = wait >= 0 ? Math.floor(reactT * 8) + Math.floor(t * 2) : 0
      const kk = `${q}|${key}|${blink}|${pulse}|${wait < 0 ? -1 : Math.floor(wait * 24)}|${spin}`
      if (kk !== lastKey) {
        lastKey = kk
        monitorPlane.redraw((g, W, H) => drawMonitor(g, W, H, { sc, seen, prospective, act: a, t: busy ? Math.floor(t * 5) / 5 : 0, wait, spin: reactT * 8 }))
      }
      dbA = util.damp(dbA, prospective ? 1 : 0, 4, rdt)
      ehrRings.forEach((r, i) => (r.material.emissiveIntensity = 0.2 + dbA * (1.2 + 0.5 * Math.sin(t * 3 + i))))
      dbGlow.material.opacity = 0.55 * dbA
      ehrLock.scale.setScalar(Math.max(0.001, dbA * util.easeOutBack(util.smoothstep(0, 1, dbA))))
      ehrLock.rotation.y = Math.sin(t * 1.2) * 0.25
      wire.material.opacity = prospective ? 0.15 + 0.55 * util.smoothstep(0.3, 0.8, a) : 0
    }
  }

  // ═════════ 站 6：處方 ═════════
  let sheetPlane
  {
    const pad = pads[5]
    const eq = pad.equip
    sheetPlane = util.createChartPlane({ width: 2.6, height: 3.0, px: 460, bg: null })
    sheetPlane.mesh.position.set(-0.75, 1.95, -0.8)
    sheetPlane.mesh.rotation.set(-0.12, 0.1, 0)
    const origPill = util.createPill({ length: 0.95, radius: 0.22, colorA: COLORS.drug, colorB: 0xfff3e0 })
    origPill.position.set(0.85, 0.42, 1.0)
    origPill.rotation.y = 0.4
    const altPill = util.createPill({ length: 0.95, radius: 0.22, colorA: COLORS.green, colorB: 0xeafff5 })
    altPill.position.set(1.4, 0.42, -0.2)
    altPill.rotation.y = -0.5
    const cross = new THREE.Group()
    ;[Math.PI / 4, -Math.PI / 4].forEach((rz) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.09, 0.05), basic(COLORS.red))
      b.rotation.z = rz
      cross.add(b)
    })
    cross.position.set(0.85, 0.95, 1.0)
    cross.scale.setScalar(0.001)
    const tick = new THREE.Group()
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.09, 0.05), basic(COLORS.green))
    t1.position.set(-0.17, -0.06, 0)
    t1.rotation.z = -Math.PI / 4
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.05), basic(COLORS.green))
    t2.position.set(0.1, 0.06, 0)
    t2.rotation.z = Math.PI / 4
    tick.add(t1, t2)
    tick.position.set(1.4, 0.98, -0.2)
    tick.scale.setScalar(0.001)
    const glowAlt = util.makeGlow(COLORS.green, 1.8, 0)
    glowAlt.position.copy(altPill.position)
    eq.add(sheetPlane.mesh, origPill, altPill, cross, tick, glowAlt)
    const lOrig = mkSub(pad, 'clopidogrel', 0.85, 1.5, 1.0)
    const lAlt = mkSub(pad, '替代藥物', 1.4, 1.5, -0.2)
    pad.userData = { lOrig, lAlt, origPill, altPill, cross, tick, glowAlt }
    let lastKey = ''
    let lastDrug = ''
    pad.update = (dt, t, a, rdt) => {
      const sc = SCENARIOS[scen]
      const seen = seenBy(sc, techKey)
      const q = Math.round(a * 12)
      const key = `${scen}-${techKey}-${q}`
      if (key !== lastKey) {
        lastKey = key
        sheetPlane.redraw((g, W, H) => drawSheet(g, W, H, { sc, seen, act: q / 12 }))
      }
      if (sc.drug !== lastDrug) {
        lastDrug = sc.drug
        relabel(lOrig, sc.drug)
        relabel(lAlt, sc.alt.short)
      }
      const changed = !seen.missed
      const k = util.easeOutBack(util.smoothstep(0.4, 0.9, a))
      cross.scale.setScalar(changed ? Math.max(0.001, k) : 0.001)
      tick.scale.setScalar(changed ? Math.max(0.001, k) : 0.001)
      glowAlt.material.opacity = changed ? 0.55 * util.smoothstep(0.5, 1, a) : 0
      origPill.rotation.z = 0.05 * Math.sin(t * 1.5) * ctx.motion
      altPill.position.y = 0.42 + 0.06 * Math.sin(t * 2 + 1) * ctx.motion
      const dim = changed ? 0.45 : 1
      origPill.scale.setScalar(util.damp(origPill.scale.x, dim > 0.9 ? 1 : 0.85, 6, rdt))
      altPill.scale.setScalar(util.damp(altPill.scale.x, changed ? 1 : 0.7, 6, rdt))
    }
  }

  // 台階（判讀→決策→處方）的視覺連結：資料光點
  // ═════════ 倫理標籤（第 6 步出現） ═════════
  // 倫理提示不放在世界座標（會擋住站名與處方單），而是貼在鏡頭前方畫面上緣排成一列（見 update 的 layoutChips）
  const chips = ETHICS_CHIPS.map((c) => {
    const s = mkLabel(c.text, { fontSize: 42, worldHeight: 0.42, color: '#ffe9b0', bg: 'rgba(60,40,10,0.86)', border: 'rgba(255,196,77,0.85)' })
    s.material.opacity = 0
    s.visible = false
    scene.add(s)
    return s
  })

  // ───────────────────────── 樣本（主角）與環境試管 ─────────────────────────
  const hero = new THREE.Group()
  scene.add(hero)
  const heroTube = makeTube({ cap: COLORS.magenta, fluid: COLORS.blood, level: 0.75, r: 0.2, scale: 1.15 })
  const heroPacket = new THREE.Group()
  {
    const cube = new THREE.Mesh(new RoundedBoxGeometry(0.56, 0.56, 0.56, 3, 0.1), emis(COLORS.cyan, 1.3))
    cube.position.y = 0.55
    const inner = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.34, 0.34, 3, 0.06), emis(0xffffff, 0.9))
    inner.position.y = 0.55
    heroPacket.add(cube, inner)
    heroPacket.userData = { cube, inner }
  }
  const heroRing = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 8, 40), basic(COLORS.magenta, 0.9, true))
  heroRing.rotation.x = Math.PI / 2
  heroRing.position.y = 0.03
  const heroGlow = util.makeGlow(COLORS.magenta, 2.0, 0.6)
  heroGlow.position.y = 0.55
  const heroLabel = mkLabel('你的檢體', { fontSize: 42, worldHeight: 0.42, color: '#ffd6ea', bg: 'rgba(60,10,36,0.82)', border: 'rgba(255,92,158,0.85)' })
  heroLabel.position.y = 1.75
  hero.add(heroTube, heroPacket, heroRing, heroGlow, heroLabel)
  heroPacket.visible = false

  const ambTubes = [0x6b78a8, 0x5a86b8, 0x7a8ab5, 0x6a7fa0, 0x8090c0].map((cap, i) => {
    const t = makeTube({ cap, fluid: i % 2 ? 0x7a2434 : 0x9a2b3d, level: 0.55 + 0.1 * (i % 3), scale: 0.85 })
    scene.add(t)
    return t
  })
  const ambPackets = Array.from({ length: 6 }, () => {
    const m = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.3, 0.3, 2, 0.06), emis(COLORS.cyan, 0.9))
    scene.add(m)
    return m
  })
  const LANE = 0.36
  const tmpP = new V3()
  const tmpT = new V3()
  const placeAt = (obj, s, lane = 0, y = 0) => {
    pointAt(s, tmpP)
    tangentAt(s, tmpT)
    obj.position.set(tmpP.x - tmpT.z * lane, BY + y, tmpP.z + tmpT.x * lane)
  }

  // ───────────────────────── 時程：熱身循環與「走一遍」 ─────────────────────────
  const SPEED = 3.4
  const SCHED = []
  {
    let t = 0
    let s = 0
    const dwell = [1.9, 1.9, 3.5, 3.0, 3.0, 3.0]
    STATIONS.forEach((st, i) => {
      const d = (st.s - s) / SPEED + 0.5
      SCHED.push({ t0: t, t1: t + d, a: s, b: st.s })
      t += d
      SCHED.push({ t0: t, t1: t + dwell[i], a: st.s, b: st.s })
      t += dwell[i]
      s = st.s
    })
    const d = (S_END - 0.4 - s) / SPEED + 0.4
    SCHED.push({ t0: t, t1: t + d, a: s, b: S_END - 0.4 })
  }
  const SCHED_END = SCHED[SCHED.length - 1].t1
  const LOOP_P = SCHED_END + 1.2
  function schedS(t) {
    for (const sg of SCHED) {
      if (t <= sg.t1) {
        const k = (t - sg.t0) / Math.max(1e-6, sg.t1 - sg.t0)
        return sg.a + (sg.b - sg.a) * util.smoothstep(0, 1, util.clamp(k, 0, 1))
      }
    }
    return SCHED[SCHED.length - 1].b
  }

  // ───────────────────────── 相機（依步驟平滑對焦） ─────────────────────────
  // el = 該步驟偏好的俯仰角（弧度）。實體站用較高的俯視角；資料站的面板是直立的，平視才讀得到字。
  const FOCUS = [
    { c: new V3(0.5, 0.5, 0), r: 7.7, el: 0.86 },
    { c: new V3(-4.6, 0.9, -3.6), r: 3.6, el: 0.72 },
    { c: new V3(0, 0.9, -3.6), r: 3.6, el: 0.72 },
    { c: new V3(4.6, 2.15, -3.7), r: 3.0, el: 0.6 },
    { c: new V3(4.6, 2.05, 4.1), r: 1.95, el: 0.3 },
    { c: new V3(0.0, 2.0, 4.1), r: 2.2, el: 0.3 },
    { c: new V3(-4.5, 2.4, 4.1), r: 3.0, el: 0.5 },
  ]
  // 窄螢幕（手機）上，直立面板的字太小：把鏡頭再拉近一點
  const NARROW_R = [1, 1, 1, 0.92, 0.8, 0.8, 0.92]
  const isNarrow = () => (ctx.size.w || 700) < 520
  const radiusFor = (k) => {
    const i = Math.max(0, Math.min(6, k))
    return FOCUS[i].r * (isNarrow() ? NARROW_R[i] : 1)
  }
  const focus = { c: FOCUS[0].c.clone(), r: FOCUS[0].r }
  const cur = { c: FOCUS[0].c.clone(), r: FOCUS[0].r }
  const DEFAULT_DIR = new V3(0, Math.sin(0.86), Math.cos(0.86)).normalize()
  let dirOverride = null
  let elGoal = null // 換站時，俯仰角慢慢滑到該站偏好值（方位角保留使用者旋轉的結果）
  const dirFromEl = (az, el) => new V3(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el))
  // 說明字幕蓋在畫面下緣：量出它佔畫面的比例，把主體往上挪、鏡頭略拉遠，讓主體落在字幕上方的可見區
  // 同理，頂端的徽章/按鈕列也會蓋住畫面：量出它的高度，讓站名與圖表落在它的下方
  let capFrac = 0
  let capCur = 0
  let topFrac = 0
  let topCur = 0
  function measureCaption() {
    const q = (sel) => (ctx.el && ctx.el.querySelector ? ctx.el.querySelector(sel) : null)
    const el = q('.hud-caption')
    const top = q('.hud-top')
    const h = ctx.size.h || 0
    capFrac = el && !el.hidden && h > 0 ? util.clamp(el.offsetHeight / h, 0, 0.45) : 0
    topFrac = top && h > 0 ? util.clamp((top.offsetTop + top.offsetHeight) / h, 0, 0.3) : 0
  }
  const camDir = new V3()
  const camRight = new V3()
  const camUp = new V3()
  let camDist = 10
  function applyCam(dt, snap) {
    const k = snap ? 1 : 1 - Math.exp(-3.4 * dt)
    cur.c.lerp(focus.c, k)
    cur.r += (focus.r - cur.r) * k
    capCur += (capFrac - capCur) * k
    topCur += (topFrac - topCur) * k
    const dir = camDir
    if (dirOverride) dir.copy(dirOverride)
    else dir.copy(camera.position).sub(controls.target)
    dirOverride = null
    if (dir.lengthSq() < 1e-6) dir.copy(DEFAULT_DIR)
    dir.normalize()
    if (elGoal != null) {
      const az = Math.atan2(dir.x, dir.z)
      const el = Math.asin(util.clamp(dir.y, -1, 1))
      const nel = el + (elGoal - el) * Math.min(1, k * 1.3)
      if (Math.abs(elGoal - nel) < 0.008) elGoal = null
      dir.copy(dirFromEl(az, elGoal == null ? nel : nel))
    }
    const vfov = THREE.MathUtils.degToRad(camera.fov)
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
    const dist = ((cur.r * 1.1) / Math.sin(Math.min(vfov, hfov) / 2)) / (1 - 0.55 * capCur - 0.8 * topCur)
    // 鏡頭對準「主體下方一點」，主體就會出現在畫面偏上的位置
    camUp.set(0, 1, 0).addScaledVector(dir, -dir.y).normalize()
    camRight.crossVectors(camUp, dir).normalize()
    const shift = (0.8 * capCur - 1.1 * topCur) * Math.tan(vfov / 2) * dist
    controls.target.copy(cur.c).addScaledVector(camUp, -shift)
    camera.position.copy(controls.target).addScaledVector(dir, dist)
    camDist = dist
  }
  ctx.setFrame(FOCUS[0].c, FOCUS[0].r, { azimuth: 0, elevation: 0.86 })
  measureCaption()

  // ───────────────────────── 控制項與說明 ─────────────────────────
  // 窄舞台（手機）用較短的徽章，讓徽章與兩顆按鈕擠在同一列，不佔掉太多畫面
  let badgeShort = null
  function updateBadge() {
    const short = (ctx.size.w || 700) < 460
    if (short === badgeShort) return
    badgeShort = short
    hud.badge(short ? '檢測流水線 · 示意' : '基因檢測流水線 · 示意')
  }
  updateBadge()
  // 圖例隨站點變化，避免一直擋住畫面：實體站看「檢體/資料」，處方站看「原處方藥/建議方向」
  let legendKey = ''
  function updateLegend() {
    // 圖例只在總覽出現；放大到各站時，場景內已有標籤，圖例反而會蓋住面板文字
    const k = stage === 0 && (ctx.size.w || 700) >= 520 ? 'overview' : 'none'
    if (k === legendKey) return
    legendKey = k
    if (k === 'overview') hud.legend([{ color: COLORS.magenta, label: '你的檢體' }, { color: COLORS.cyan, label: '數位化後成為資料' }])
    else hud.legend([])
  }
  updateLegend()

  const seenNow = () => seenBy(SCENARIOS[scen], techKey)

  function captionHtml() {
    const sc = SCENARIOS[scen]
    const seen = seenNow()
    switch (stage) {
      case 0:
        return '<b>一管血 → 一張處方。</b>粉紅色試管是你的檢體，沿輸送帶走過六站。可點任一站，或按控制列的「送一管檢體走一遍」按鈕。'
      case 1:
        return '<b>① 採檢</b>：抽血或口腔拭子。先說明用途、簽同意書；基因型終身不變，但解讀會隨指引更新。'
      case 2:
        return '<b>② 萃取</b>：離心分出血球、破膜、純化，得到可以檢測的 DNA。'
      case 3:
        return TECHS[techKey].cap.replace('③', '<b>③</b>')
      case 4:
        return seen.missed
          ? `<b>④ 判讀</b>：${seen.diplotype} → 看起來是「正常代謝者」，但⚠ 基因重複沒被看見！`
          : `<b>④ 判讀</b>：${seen.diplotype} → ${seen.phenotype}。`
      case 5:
        if (seen.missed) return '<b>⑤ 決策支援</b>：系統把「正常」放行——這次沒有跳出任何提示。'
        return prospective
          ? '<b>⑤ 決策支援（前瞻式）</b>：結果早已存在病歷，開藥當下立刻提示。'
          : '<b>⑤ 決策支援（反應式）</b>：開藥時才發現沒有結果，要先送檢、等待。'
      default:
        return seen.missed
          ? '<b>⑥ 處方</b>：照原處方開出。「正常」只代表沒找到所檢測的變異，不等於安全。'
          : '<b>⑥ 處方</b>：指引「建議」調整，最終由醫師與你共同決定。自留報告，別自行停藥。'
    }
  }

  function cardHtml() {
    const sc = SCENARIOS[scen]
    const seen = seenNow()
    const tk = TECHS[techKey]
    const box = (title, body) =>
      `<span style="display:block;border-left:3px solid var(--cyan,#35d6ff);padding:2px 0 2px 10px;font-size:.84rem;line-height:1.65"><span style="display:block;font-weight:700;color:#fff;margin-bottom:2px">${title}</span>${body}</span>`
    switch (stage) {
      case 0:
        return box('怎麼玩', `① 選一種病人情境（全是虛構的示意病人）<br>② 換檢測技術、開關「前瞻式」<br>③ 按控制列的「送一管檢體走一遍」按鈕，或一路往下讀、讓場景跟著文字前進。<br>目前情境：${sc.story}。`)
      case 1:
        return box('採檢：抽血 / 口腔拭子', '目的與用途要先說明、取得同意。台灣的實驗室開發檢測（LDT）施行計畫須載明費用與同意書範本，並由認證實驗室執行。')
      case 2:
        return box('萃取 DNA', '血液中有細胞核的白血球提供 DNA；離心與純化後才能進入檢測。此步驟和你要查的基因無關。')
      case 3:
        return box(`檢測技術：${tk.label}`, `<b>優點</b>：${tk.pros}<br><b>限制</b>：${tk.cons}<br><span style="opacity:.75">${tk.src}</span>`)
      case 4:
        return box('判讀：等位基因 → 基因型 → 表現型', `${seen.missed ? sc.interpMissed : sc.interp}<br><span style="opacity:.75">示意病人，非真實個案。</span>`)
      case 5:
        return box(
          prospective ? '前瞻式（預先）檢測' : '反應式檢測',
          prospective
            ? '在開藥前就一次分析多個基因、把結果存進病歷；日後每次開藥，系統自動比對並提示。要留意基因資料屬特種個資，需要保護。'
            : '等醫師要開某個藥時，才針對單一基因送檢。省下不會用到的檢測，但開藥當下要等結果，而且每換一種藥可能又要再檢一次。'
        )
      default:
        return box(
          `指引建議（${sc.rec.guide}）`,
          seen.missed
            ? `如果基因被正確判讀，${sc.rec.text}<br><b>但這次檢測漏看了重複</b>，系統沒有提示，處方照舊——這是「陰性 / 正常」不等於安全的例子（示意）。`
            : `${sc.rec.text}<br><span style="opacity:.85">${sc.rec.caveat}</span>`
        )
    }
  }

  ui.button({ label: '▶ 送一管檢體走一遍流水線', onClick: () => startRun() })
  ui.segmented({
    label: '病人情境（虛構的示意病人）',
    options: SCENARIO_ORDER.map((k) => ({ value: k, label: SCENARIOS[k].seg, title: SCENARIOS[k].story })),
    value: scen,
    onChange: (v) => {
      scen = v
      // 情境只在判讀之後才看得出差別：在前面幾站切換時，直接帶鏡頭到第 4 站看結果
      if (mode !== 'run' && stage < 4) goStage(4)
      refresh()
    },
  })
  ui.segmented({
    label: '第 3 站：檢測技術',
    options: [
      { value: 'pcr', label: '即時 PCR' },
      { value: 'array', label: '基因晶片' },
      { value: 'ngs', label: '定序 NGS' },
    ],
    value: techKey,
    onChange: (v) => {
      techKey = v
      relabel(techLabel, TECHS[v].short)
      if (mode !== 'run') goStage(3)
      refresh()
    },
  })
  ui.toggle({
    label: '前瞻式檢測（結果先存進病歷）',
    value: prospective,
    onChange: (v) => {
      prospective = v
      if (mode !== 'run' && stage !== 5) goStage(5)
      refresh()
    },
  })
  const card = ui.note('', { html: true })
  card.style.marginTop = '4px'
  card.setAttribute('aria-live', 'polite')

  function refresh() {
    const ck = `${stage}|${scen}|${techKey}|${prospective}`
    if (ck === cardKey) return
    cardKey = ck
    hud.caption(captionHtml(), { html: true })
    card.innerHTML = cardHtml()
    updateLegend()
    measureCaption()
  }
  function forceRefresh() {
    cardKey = ''
    refresh()
  }

  // ───────────────────────── 步驟 / 模式切換 ─────────────────────────
  function goStage(k) {
    // 直接停靠到某站（k = 1..6），0 = 總覽循環；超出範圍的值一律夾回 0..6，避免 STATIONS[k-1] 取到 undefined
    k = Math.max(0, Math.min(6, Math.round(Number(k) || 0)))
    if (k <= 0) {
      mode = 'loop'
      loopT = 0
      stage = 0
    } else {
      mode = 'park'
      stage = k
    }
    const f = FOCUS[k]
    focus.c.copy(f.c)
    focus.r = radiusFor(k)
    elGoal = f.el
    forceRefresh()
  }
  function startRun() {
    mode = 'run'
    runT = 0
    heroS = 0
    stage = 0
    focus.c.copy(FOCUS[0].c)
    focus.r = radiusFor(0)
    elGoal = FOCUS[0].el
    forceRefresh()
  }

  // ───────────────────────── 指標：懸停看說明、點擊跳到該站 ─────────────────────────
  const stationOf = (hit) => {
    let o = hit.object
    while (o) {
      if (o.userData && o.userData.stationIndex != null) return o.userData.stationIndex
      o = o.parent
    }
    return -1
  }
  const offPtr = ctx.onPointer((type, e, ptr) => {
    if (type === 'leave' || type === 'cancel') {
      hud.tip(null)
      ctx.setCursor('')
      return
    }
    if (type === 'move' && ptr.down) {
      hud.tip(null)
      ctx.setCursor('')
      return
    }
    if (type === 'move' || type === 'click') {
      const hits = ctx.pick(pickables, true)
      const idx = hits.length ? stationOf(hits[0]) : -1
      if (type === 'move') {
        // 觸控裝置沒有「懸停」，提示會卡在畫面上，所以只在滑鼠環境顯示
        if (idx >= 0 && !ptr.down && !ctx.coarsePointer) {
          const st = STATIONS[idx]
          hud.tip(`<b>${st.n} ${st.name}</b><br>${st.tip}<br><span style="opacity:.7">點一下：鏡頭移到這一站</span>`)
          ctx.setCursor('pointer')
        } else {
          hud.tip(null)
          ctx.setCursor('')
        }
      } else {
        hud.tip(null)
        if (idx >= 0) goStage(idx + 1)
      }
    }
  })

  // ───────────────────────── 每幀更新 ─────────────────────────
  const tmpW = new V3()
  const dbgTmp = new THREE.Color()
  const dbgTmp2 = new THREE.Color()
  let lastHeroPacket = false
  let bumpT = 0
  // 使用者觸發的動畫（鏡頭飛行、站台啟動、淡入淡出）要在「暫停動畫」時也能動：
  // Stage 暫停時 dt = 0，所以另外用牆鐘時間算一個 rdt；純背景的循環動畫仍用 dt。
  let lastNow = 0
  // 倫理提示排成一列，貼在鏡頭前方畫面上緣
  function layoutChips(rdt, t) {
    const vfovR = THREE.MathUtils.degToRad(camera.fov)
    const asp = camera.aspect || 1
    const d = camDist * 0.6
    const visH = 2 * Math.tan(vfovR / 2) * d
    const visW = visH * asp
    const n = chips.length
    // 目標高度：畫面高度的 6%，但要確保一整列放得下（放不下就換行，最多兩列）
    let f = (0.06 * visH) / chips[0].userData.bs.y
    const totalW = chips.reduce((a, c) => a + c.userData.bs.x, 0) * f
    const gap = 0.012 * visW
    const rows = totalW + gap * (n - 1) > 0.94 * visW ? 2 : 1
    const perRow = Math.ceil(n / rows)
    const rowW = (from, to) => {
      let w = 0
      for (let i = from; i < to; i++) w += chips[i].userData.bs.x * f + (i > from ? gap : 0)
      return w
    }
    let maxRow = 0
    for (let r = 0; r < rows; r++) maxRow = Math.max(maxRow, rowW(r * perRow, Math.min(n, (r + 1) * perRow)))
    if (maxRow > 0.94 * visW) f *= (0.94 * visW) / maxRow
    const hh = chips[0].userData.bs.y * f
    for (let r = 0; r < rows; r++) {
      const from = r * perRow
      const to = Math.min(n, (r + 1) * perRow)
      let x = -rowW(from, to) / 2
      const y = visH / 2 - Math.max(0.165, topCur + 0.045) * visH - r * hh * 1.25
      for (let i = from; i < to; i++) {
        const c = chips[i]
        const w = c.userData.bs.x * f
        const bob = 0.15 * hh * Math.sin(t * 1.4 + i * 1.7) * ctx.motion
        c.position.copy(camera.position).addScaledVector(camDir, -d).addScaledVector(camRight, x + w / 2).addScaledVector(camUp, y + bob)
        c.scale.set(w, hh, 1)
        x += w + gap
      }
    }
  }
  setLabelK()
  forceRefresh()
  applyCam(0, true)

  return {
    onResize() {
      updateBadge()
      setLabelK()
      updateLegend()
      measureCaption()
      if (mode !== 'run') focus.r = radiusFor(stage)
      else focus.r = radiusFor(0)
      applyCam(0, true)
    },
    onResetView() {
      dirOverride = dirFromEl(0, FOCUS[Math.max(0, Math.min(6, mode === 'run' ? 0 : stage))].el)
      elGoal = null
      applyCam(0, true)
    },
    onStep(i) {
      step = i
      goStage(i)
    },
    update(dt, t) {
      const now = performance.now()
      const rdt = dt > 0 ? dt : Math.min(0.05, lastNow ? Math.max(0, (now - lastNow) / 1000) : 0)
      lastNow = now
      bumpT += dt
      // —— 主角位置 ——
      let heroScale = 1
      if (mode === 'loop') {
        loopT += dt * ctx.motion
        const tt = loopT % LOOP_P
        heroS = schedS(Math.min(tt, SCHED_END))
        heroScale = util.smoothstep(0, 0.5, tt) * (1 - util.smoothstep(SCHED_END - 0.3, SCHED_END + 0.5, tt))
      } else if (mode === 'run') {
        runT += dt
        heroS = schedS(Math.min(runT, SCHED_END))
        if (runT > SCHED_END + 0.3) {
          mode = 'park'
          stage = 6
          heroS = STATIONS[5].s
          forceRefresh()
        }
      } else {
        const target = STATIONS[Math.max(0, stage - 1)].s
        const diff = target - heroS
        const v = util.clamp(diff * 3.2, -9, 9)
        heroS += util.clamp(v * rdt, -Math.abs(diff), Math.abs(diff))
      }

      // —— 各站啟動程度 ——
      let nearest = -1
      pads.forEach((p, i) => {
        const d = Math.abs(heroS - p.st.s)
        const target = d < 0.35 && heroScale > 0.5 ? 1 : 0
        p.act = util.damp(p.act, target, 4.2, rdt)
        const passed = heroS > p.st.s + 0.4 ? 1 : 0
        p.done = util.damp(p.done, passed, 3, rdt)
        if (target) nearest = i
      })
      if (mode === 'run' && nearest >= 0 && stage !== nearest + 1) {
        stage = nearest + 1
        forceRefresh()
      }

      // —— 輸送帶動畫 ——
      const bv = 1.05 * ctx.motion
      beltTex.phys.offset.x -= (bv * dt) / 2.6
      beltTex.data.offset.x -= (bv * dt) / 2.6

      // —— 環境試管與資料方塊 ——
      const physLen = S_GATE - 0.6
      ambTubes.forEach((tb, i) => {
        const s = (((i / ambTubes.length) * physLen + t * bv) % physLen) + 0.3
        placeAt(tb, s, LANE)
        tb.visible = true
      })
      const dataLen = S_END - S_GATE - 0.8
      ambPackets.forEach((pk, i) => {
        const s = S_GATE + 0.5 + (((i / ambPackets.length) * dataLen + t * bv) % dataLen)
        placeAt(pk, s, -LANE, 0.24 + 0.03 * Math.sin(t * 3 + i))
        pk.rotation.y = t * 0.8 + i
        pk.rotation.x = t * 0.5
      })

      // —— 主角 ——
      const isPacket = heroS > S_GATE + 0.05
      placeAt(hero, heroS, 0, 0)
      hero.scale.setScalar(Math.max(0.001, heroScale))
      if (isPacket !== lastHeroPacket) {
        lastHeroPacket = isPacket
        heroTube.visible = !isPacket
        heroPacket.visible = isPacket
        heroGlow.material.color.setHex(isPacket ? COLORS.cyan : COLORS.magenta)
        heroRing.material.color.setHex(isPacket ? COLORS.cyan : COLORS.magenta)
        relabel(heroLabel, isPacket ? '你的報告' : '你的檢體')
      }
      // 萃取後，血液變成清亮的 DNA 溶液
      const clear = util.smoothstep(STATIONS[1].s - 0.2, STATIONS[1].s + 0.6, heroS)
      dbgTmp.setHex(COLORS.blood).lerp(dbgTmp2.setHex(0xcfefff), clear)
      heroTube.userData.liquid.material.color.copy(dbgTmp)
      heroTube.userData.liquid.material.emissive.copy(dbgTmp)
      heroPacket.rotation.y = t * 1.2
      heroPacket.userData.inner.rotation.x = t * 1.6
      heroPacket.position.y = 0.06 * Math.sin(t * 3)
      heroRing.rotation.z = t * 1.5
      heroRing.scale.setScalar(1 + 0.08 * Math.sin(t * 4))
      heroGlow.material.opacity = 0.5 + 0.15 * Math.sin(t * 3)
      // 資料站（判讀、決策支援、處方單）的直立面板會擋住檢體，採檢站的小標籤也會被蓋住：此時淡出主角標籤
      heroLabel.material.opacity = util.damp(heroLabel.material.opacity, mode === 'park' && (stage === 1 || stage >= 4) ? 0 : 1, 6, rdt)

      // 閘門閃光
      const gd = Math.abs(heroS - S_GATE)
      gate.userData.sheet.material.opacity = gd < 0.9 ? 0.45 * (1 - gd / 0.9) : 0.0

      // —— 站台外觀 ——
      pads.forEach((p) => {
        const a = p.act
        p.rim.material.opacity = 0.22 + 0.3 * p.done + 0.5 * a + (stage === 0 ? 0.1 * (0.5 + 0.5 * Math.sin(t * 2.2 + p.st.n * 0.9)) * ctx.motion : 0)
        p.glow.material.opacity = 0.32 * a
        const c = 0.6 + 0.4 * Math.max(a, p.done * 0.6)
        p.label.material.color.setScalar(c)
        p.label.material.opacity = util.damp(p.label.material.opacity, stage === 0 || stage === p.st.n ? 1 : 0.35, 6, rdt)
        p.label.userData.bump = 1 + 0.1 * a
        if (p.update) p.update(dt, t, a, rdt)
      })
      // 子標籤淡入淡出
      subLabels.forEach(({ s, pad }) => {
        const target = pad.act > 0.55 && stage === pad.st.n ? 1 : 0
        s.material.opacity = util.damp(s.material.opacity, target, 6, rdt)
        s.visible = s.material.opacity > 0.02
      })

      // 倫理標籤：第 6 站停靠時浮現
      const showChips = mode === 'park' && stage === 6
      chips.forEach((c, i) => {
        const target = showChips ? 1 : 0
        c.material.opacity = util.damp(c.material.opacity, target, 3 + i * 0.4, rdt)
        c.visible = c.material.opacity > 0.02
      })

      // 標籤縮放：視窗窄時放大；並依與相機的距離補償，讓標籤在拉近鏡頭時不會變成巨大色塊
      const vfovR = THREE.MathUtils.degToRad(camera.fov)
      const hfovR = 2 * Math.atan(Math.tan(vfovR / 2) * camera.aspect)
      const refDist = (FOCUS[0].r * 1.1) / Math.sin(Math.min(vfovR, hfovR) / 2)
      for (const l of labels) {
        l.getWorldPosition(tmpW)
        const df = util.clamp(1.5 * Math.pow(camera.position.distanceTo(tmpW) / refDist, 0.7), 0.5, 1.8)
        l.scale.copy(l.userData.bs).multiplyScalar((1 + (labelK - 1) * 0.5) * df * (l.userData.bump || 1))
      }

      dust.rotation.y = t * 0.01 * ctx.motion

      applyCam(rdt, false)
      if (chips[0].visible || chips[chips.length - 1].visible) layoutChips(rdt, t)
    },
    dispose() {
      offPtr && offPtr()
    },
  }
}
