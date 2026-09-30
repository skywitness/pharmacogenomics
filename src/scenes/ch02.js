// ch02 場景「解讀密碼」：DNA → mRNA → 蛋白質，以及「改一個字母會怎樣」的突變實驗。
//
// 設計重點
//  - 單一「進度 P」（0–5）決定整個畫面，所以可以拖曳、倒帶、自動播放，文字步驟也只是設定 P 的目標。
//      P=0 螺旋 → 1 解旋（局部打開 + 聚合酶就位）→ 2 轉錄完成 → 3 mRNA 出核 → 4 轉譯完成 → 5 折疊成蛋白質
//  - 突變：改變編碼股上的一個字母，mRNA、密碼子、胺基酸、蛋白質形狀都會即時改變（同義/錯義/無義）。
//  - 示範基因是教學用自行設計的 33 個字母（見 ch02/data.js），畫面上標明「示意」。
//  - 不使用後處理、不持有 renderer 資源；所有大量物件用 InstancedMesh。
import { COLORS, hex } from '../core/palette.js'
import { GENE, N, NCOD, COMP, AA, CLASS_ZH, analyze, classify, isLocked } from './ch02/data.js'

export const options = {
  fov: 40,
  camera: [0, 3, 18],
  target: [0, 2, 0],
  orbit: true,
  zoom: false,
  minPolarAngle: 0.95,
  maxPolarAngle: 2.0,
  minAzimuthAngle: -0.6,
  maxAzimuthAngle: 0.6,
  exposure: 1.0,
  envIntensity: 0.5,
}

// ───────── 版面常數（世界座標）─────────
const S = 0.32 // 鹼基對間距
const CY = 2.2 // DNA 所在高度
const RAD = 0.6 // 螺旋半徑
const DOPEN = 1.0 // 打開時兩股各偏離的距離
const TWIST = (Math.PI * 2 * S) / 3.2 // 每對轉角（約 10 對一圈）
const NRX = 7.0 // 細胞核橢球半徑
const NRY = 2.9
const YROW = CY - 2.15 // mRNA 在核內排成一列的高度
const YC = -2.9 // 細胞質中 mRNA 的高度
const SLOT_Y = -5.2 // 胺基酸串珠的排列高度
const FOLD_C = [0, -4.9, 0.1] // 折疊後蛋白質的中心
const FS = 1.25 // 折疊後蛋白質的放大倍率（讓「結果」在畫面上夠大）
const xOf = (i) => (i - (N - 1) / 2) * S
const xCod = (c) => xOf(3 * c + 1)

const STAGE_NAMES = ['① DNA 螺旋', '② 解旋', '③ 轉錄', '④ 出核', '⑤ 轉譯', '⑥ 折疊成蛋白質']
const STAGE_CAPTIONS = [
  'DNA 用 A（綠）T（紅）G（黃）C（藍）四種字母寫成密碼：A 配 T、G 配 C。點任何一個鹼基，或按下方「動手改字母」。',
  '只有要讀的那一小段雙股會打開，RNA 聚合酶（藍色）在起點就位。',
  '轉錄：聚合酶沿模板股一個字母配一個字母，做出 mRNA（T 換成 U）。',
  'mRNA 穿過核孔到細胞質（示意），DNA 本體留在細胞核裡。',
  '轉譯：核糖體每讀 3 個字母（1 個密碼子），tRNA 就送來 1 顆胺基酸。',
  '胺基酸鏈折成立體的蛋白質；形狀對的口袋能抓住橘色藥物（全為示意）。想試試改一個字母？按「動手改字母」。',
]
const SPEED = [0.55, 0.14, 0.36, 0.13, 0.4] // 每階段的播放速度（進度/秒）

const CSS = `
.c2-strip{grid-column:1/-1;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:6px 3px;padding:8px 6px;border:1px solid var(--line);border-radius:10px;background:rgba(6,9,19,.5)}
.c2-cod{display:flex;flex-direction:column;align-items:center;padding:3px 3px 2px;border-radius:8px;border:1px solid transparent;min-width:0;box-sizing:border-box}
.c2-cod.is-sel{border-color:var(--amber);background:rgba(255,196,77,.1)}
.c2-aa{font-size:.74rem;height:1.25em;line-height:1.25;color:var(--text-dim);white-space:nowrap}
.c2-aa.is-mut{color:var(--magenta);font-weight:700}
.c2-rn{font-family:var(--mono);font-size:.84rem;font-weight:700;letter-spacing:.1em;height:1.3em;line-height:1.3;white-space:nowrap}
.c2-dn{display:flex}
.c2-dn button{font-family:var(--mono);font-weight:700;font-size:.98rem;width:24px;height:30px;padding:0;border:0;background:transparent;cursor:pointer;border-radius:4px;line-height:30px}
.c2-dn button:hover{background:rgba(255,255,255,.14)}
.c2-dn button.is-sel{background:rgba(255,255,255,.2);outline:1px solid #fff}
.c2-dn button.is-mut{text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px}
.c2-dn button.is-lock{opacity:.72}
.c2-key{grid-column:1/-1;font-size:.74rem;color:var(--muted);line-height:1.5;margin:0}
@media (pointer:coarse),(max-width:620px){.c2-strip{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 6px}.c2-dn{gap:6px;justify-content:center}.c2-dn button{width:44px;min-width:44px;height:44px;line-height:44px}}
`

const baseHex = (b) => (b === 'U' ? hex(COLORS.U) : hex(COLORS[b]))

export default function create(ctx) {
  const { THREE, util, scene, camera, hud, ui } = ctx
  const { clamp, lerp, smoothstep, easeInOut, easeOutCubic, damp } = util
  const V3 = THREE.Vector3
  const col = (h) => new THREE.Color(h)

  util.addStudioLights(scene, { intensity: 1.05 })

  // ───────── 材質工具：實例顏色 + 自發光（不用後處理也能「亮」）─────────
  function litMat(color, { emissive = 0.3, roughness = 0.38, metalness = 0.05 } = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness, metalness })
    const k = emissive.toFixed(3)
    m.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * ${k};`)
    }
    m.customProgramCacheKey = () => 'ch02lit' + k
    return m
  }
  const sphG = new THREE.SphereGeometry(1, 16, 12)
  const cylG = new THREE.CylinderGeometry(1, 1, 1, 10, 1, false)
  const IDQ = new THREE.Quaternion()
  const UP = new THREE.Vector3(0, 1, 0)
  const _m = new THREE.Matrix4()
  const _q = new THREE.Quaternion()
  const _s = new THREE.Vector3()
  const _d = new THREE.Vector3()
  const _mid = new THREE.Vector3()
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0)
  const setSphere = (mesh, i, p, r) => {
    if (r <= 0.001) return mesh.setMatrixAt(i, ZERO)
    _s.set(r, r, r)
    _m.compose(p, IDQ, _s)
    mesh.setMatrixAt(i, _m)
  }
  const setBond = (mesh, i, a, b, rad) => {
    _d.subVectors(b, a)
    const len = _d.length()
    if (len < 1e-4 || rad <= 0.001) return mesh.setMatrixAt(i, ZERO)
    _mid.addVectors(a, b).multiplyScalar(0.5)
    _q.setFromUnitVectors(UP, _d.multiplyScalar(1 / len))
    _s.set(rad, len, rad)
    _m.compose(_mid, _q, _s)
    mesh.setMatrixAt(i, _m)
  }
  const inst = (geo, mat, n) => {
    const m = new THREE.InstancedMesh(geo, mat, n)
    m.frustumCulled = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    for (let i = 0; i < n; i++) {
      m.setMatrixAt(i, ZERO)
      m.setColorAt(i, new THREE.Color(0xffffff))
    }
    return m
  }

  const root = new THREE.Group()
  scene.add(root)

  // ───────── 背景：光暈與粒子 ─────────
  const glowA = util.makeGlow(COLORS.cyan, 17, 0.14)
  glowA.position.set(0, CY, -4)
  const glowB = util.makeGlow(COLORS.magenta, 13, 0.09)
  glowB.position.set(0, -4.4, -4)
  const dust = util.createParticles({ count: 260, spread: [28, 18, 9], size: 0.09, opacity: 0.5, seed: 9 })
  dust.position.set(0, -1.2, -3.5)
  root.add(glowA, glowB, dust)

  // ───────── 細胞核（半透明橢球 + 輪廓 + 核孔）─────────
  const nucMat = new THREE.MeshStandardMaterial({ color: 0x4a70d0, transparent: true, opacity: 0.1, side: THREE.DoubleSide, roughness: 0.15, depthWrite: false, emissive: 0x1a2f70, emissiveIntensity: 0.5 })
  const nuc = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), nucMat)
  nuc.scale.set(NRX, NRY, 3.0)
  nuc.position.set(0, CY, 0)
  nuc.renderOrder = -1
  root.add(nuc)
  {
    const pts = []
    for (let i = 0; i < 128; i++) {
      const a = (i / 128) * Math.PI * 2
      pts.push(new V3(Math.cos(a) * NRX, CY + Math.sin(a) * NRY, 0))
    }
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8fb0ff, transparent: true, opacity: 0.55 }))
    root.add(ring)
    const poreMat = litMat(0x9db8ff, { emissive: 0.5 })
    for (const px of [-4.05, -1.35, 1.35, 4.05]) {
      const y = CY - NRY * Math.sqrt(1 - (px / NRX) ** 2)
      const n = new V3(px / NRX ** 2, -(NRY * Math.sqrt(1 - (px / NRX) ** 2)) / NRY ** 2, 0).normalize()
      const pore = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 10, 28), poreMat)
      pore.position.set(px, y, 0)
      pore.quaternion.setFromUnitVectors(new V3(0, 0, 1), n)
      root.add(pore)
    }
  }

  // ───────── DNA 雙股螺旋（實例化）─────────
  const seq = GENE.split('')
  let an = analyze(GENE)
  const orig = analyze(GENE)
  const BB0 = col(0xd7def5) // 編碼股骨架
  const BB1 = col(0x8f9ccb) // 模板股骨架
  const bbSph = inst(sphG, litMat(0xffffff, { emissive: 0.16 }), N * 2)
  const bbBond = inst(cylG, litMat(0xffffff, { emissive: 0.14 }), (N - 1) * 2)
  const rungs = inst(cylG, litMat(0xffffff, { emissive: 0.22 }), N * 2)
  root.add(bbSph, bbBond, rungs)
  const P0 = Array.from({ length: N }, () => new V3())
  const P1 = Array.from({ length: N }, () => new V3())
  const oOpen = new Float32Array(N)
  const flash = new Float32Array(N) // 突變後的閃光（DNA）
  const mrFlash = new Float32Array(N)
  const pbFlash = new Float32Array(NCOD)
  for (let i = 0; i < N - 1; i++) {
    bbBond.setColorAt(i, BB0)
    bbBond.setColorAt(N - 1 + i, BB1)
  }
  for (let i = 0; i < N; i++) {
    bbSph.setColorAt(i, BB0)
    bbSph.setColorAt(N + i, BB1)
  }

  // 密碼子選取框（DNA / mRNA 各一）
  const boxGeo = new THREE.BoxGeometry(1, 1, 1)
  const edgeGeo = new THREE.EdgesGeometry(boxGeo)
  const mkBox = (color) => {
    const g = new THREE.Group()
    const fill = new THREE.Mesh(boxGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.11, depthWrite: false }))
    const edge = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false }))
    edge.renderOrder = 20
    g.add(fill, edge)
    g.visible = false
    g.userData = { fill, edge }
    root.add(g)
    return g
  }
  const dnaBox = mkBox(0xffe08a)
  const mrBox = mkBox(0xffe08a)
  const selGlow = util.makeGlow(0xffe08a, 1.1, 0.85)
  selGlow.visible = false
  root.add(selGlow)
  const scanGlow = util.makeGlow(COLORS.cyan, 1.8, 0.7)
  root.add(scanGlow)

  // ───────── RNA 聚合酶 ─────────
  const polyMat = new THREE.MeshPhysicalMaterial({ color: COLORS.enzyme, transparent: true, opacity: 0.32, roughness: 0.25, clearcoat: 1, emissive: COLORS.enzyme, emissiveIntensity: 0.4, depthWrite: false, side: THREE.DoubleSide })
  const poly = new THREE.Group()
  {
    const body = new THREE.Mesh(sphG, polyMat)
    body.scale.set(1.0, 1.6, 1.1)
    const l1 = new THREE.Mesh(sphG, polyMat)
    l1.scale.setScalar(0.55)
    l1.position.set(-0.7, 0.85, 0.4)
    const l2 = new THREE.Mesh(sphG, polyMat)
    l2.scale.setScalar(0.5)
    l2.position.set(0.55, -0.95, 0.45)
    poly.add(body, l1, l2)
    const g = util.makeGlow(COLORS.enzyme, 4.2, 0.35)
    poly.add(g)
    poly.userData.glow = g
    poly.renderOrder = 6
    poly.traverse((o) => (o.renderOrder = 6))
  }
  root.add(poly)

  // ───────── mRNA（實例化）─────────
  const mrNt = inst(sphG, litMat(0xffffff, { emissive: 0.22 }), N)
  const mrBond = inst(cylG, litMat(0xdfe4f7, { emissive: 0.2 }), N - 1)
  root.add(mrNt, mrBond)
  const MR = Array.from({ length: N }, () => new V3())
  const mrSc = new Float32Array(N)

  // ───────── 核糖體 + tRNA ─────────
  const riboMat = new THREE.MeshPhysicalMaterial({ color: 0xa99bff, transparent: true, opacity: 0.34, roughness: 0.3, clearcoat: 1, emissive: 0x6a58e0, emissiveIntensity: 0.3, depthWrite: false })
  const riboL = new THREE.Mesh(sphG, riboMat)
  riboL.scale.set(1.5, 0.85, 1.0)
  const riboSm = new THREE.Mesh(sphG, riboMat.clone())
  riboSm.material.opacity = 0.42
  riboSm.scale.set(1.25, 0.42, 0.85)
  riboL.renderOrder = riboSm.renderOrder = 6
  riboL.visible = riboSm.visible = false
  for (const m of [riboL, riboSm]) {
    const halo = new THREE.Mesh(sphG, new THREE.MeshBasicMaterial({ color: 0xbfb2ff, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }))
    halo.scale.setScalar(1.07)
    m.add(halo)
    m.userData.halo = halo
  }
  root.add(riboL, riboSm)

  const trMat = litMat(0xb7c4e8, { emissive: 0.3 })
  const trna = new THREE.Group()
  const antiM = [0, 1, 2].map(() => litMat(0xffffff, { emissive: 0.5 }))
  const anti = antiM.map((m, i) => {
    const s = new THREE.Mesh(sphG, m)
    s.scale.setScalar(0.13)
    s.position.set((i - 1) * S, 0, 0)
    trna.add(s)
    return s
  })
  {
    const stem = new THREE.Mesh(cylG, trMat)
    stem.scale.set(0.08, 0.85, 0.08)
    stem.position.set(0, -0.45, 0)
    const arm = new THREE.Mesh(cylG, trMat)
    arm.scale.set(0.08, 1.15, 0.08)
    arm.rotation.z = Math.PI / 2
    arm.position.set(0, -0.86, 0)
    trna.add(stem, arm)
  }
  const trBead = new THREE.Mesh(sphG, litMat(COLORS.enzyme, { emissive: 0.35 }))
  trBead.scale.setScalar(0.32)
  trBead.position.set(0, -1.12, 0)
  trna.add(trBead)
  trna.visible = false
  root.add(trna)

  // ───────── 胺基酸串珠（蛋白質）─────────
  const NP = NCOD - 1 // 10 顆
  const pbSph = inst(sphG, litMat(0xffffff, { emissive: 0.16, roughness: 0.5 }), NP)
  const pbBond = inst(cylG, litMat(0xbcc8ee, { emissive: 0.2 }), NP - 1)
  root.add(pbSph, pbBond)
  const PB = Array.from({ length: NP }, () => new V3())
  const pbSc = new Float32Array(NP)

  // 折疊後的形狀：上下兩段並排的螺旋（像一個小小的螺旋束），之間留一道橫溝，就是藥物結合的「口袋」
  const FOLD = (() => {
    const pts = []
    const R = 0.36
    const rise = 0.52
    const step = (100 * Math.PI) / 180
    const ay = 0.82
    for (let k = 0; k < 5; k++) pts.push(new V3(-1.04 + k * rise, ay + R * Math.cos(k * step), R * Math.sin(k * step)))
    for (let k = 0; k < 5; k++) pts.push(new V3(1.04 - k * rise, -ay + R * Math.cos(k * step + Math.PI), R * Math.sin(k * step + Math.PI)))
    return pts.map((p) => p.multiplyScalar(FS))
  })()
  const POCKET0 = new V3(0, 0, 0.7 * FS)

  const pocketRing = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.055, 10, 32), litMat(0xbff3ff, { emissive: 0.9 }))
  pocketRing.visible = false
  const pocketGlow = util.makeGlow(COLORS.cyan, 1.6, 0.5)
  pocketGlow.visible = false
  root.add(pocketRing, pocketGlow)
  // 蛋白質「表面」：半透明橢球包住串珠，讓折好的形狀讀起來像一顆完整的立體分子
  const blobMat = new THREE.MeshPhysicalMaterial({ color: COLORS.enzyme, transparent: true, opacity: 0.16, roughness: 0.2, clearcoat: 1, emissive: 0x2a4aff, emissiveIntensity: 0.3, depthWrite: false, side: THREE.DoubleSide })
  const blob = new THREE.Mesh(sphG, blobMat)
  blob.renderOrder = 5
  blob.visible = false
  const blobHalo = new THREE.Mesh(sphG, new THREE.MeshBasicMaterial({ color: 0x7f9bff, transparent: true, opacity: 0.16, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false }))
  blobHalo.scale.setScalar(1.06)
  blob.add(blobHalo)
  root.add(blob)
  const beadGlow = util.makeGlow(0xffe08a, 1.3, 0.8)
  beadGlow.visible = false
  root.add(beadGlow)

  // ───────── 藥物分子（橘）─────────
  const DRUG_K = 1.8
  const drug = util.createMolecule({ atoms: 6, radius: 0.16, color: COLORS.drug, seed: 12 })
  drug.scale.setScalar(DRUG_K)
  drug.visible = false
  root.add(drug)
  const drugMats = []
  drug.traverse((o) => {
    if (o.isMesh && o.material && o.material.color && o.material.color.getHex() === COLORS.drug) drugMats.push(o.material)
  })
  const drugGlow = util.makeGlow(COLORS.drug, 1.5, 0.6)
  drug.add(drugGlow)

  // ───────── 文字標籤（<10 個）─────────
  const mkLabel = (text, o = {}) => {
    const l = util.makeLabel(text, { worldHeight: 0.38, fontSize: 40, padding: 14, ...o })
    l.visible = false
    l.material.opacity = 0
    root.add(l)
    return l
  }
  const lbNuc = mkLabel('細胞核', { color: '#cfe0ff' })
  const lbCyt = mkLabel('細胞質', { color: '#cfe0ff' })
  const lbCod = mkLabel('編碼股', { color: '#e6ecff', worldHeight: 0.36 })
  const lbTpl = mkLabel('模板股', { color: '#b3bfe6', worldHeight: 0.36 })
  const lbPol = mkLabel('RNA 聚合酶', { color: '#b8ccff' })
  const lbMr = mkLabel('mRNA', { color: '#ffd5de' })
  const lbRib = mkLabel('核糖體', { color: '#d6ccff' })
  const lbTr = mkLabel('tRNA', { color: '#cfd9f5', worldHeight: 0.32 })
  const lbProt = mkLabel('蛋白質', { color: '#dbe6ff' })
  let lbRibText = '核糖體'
  let lbProtText = '蛋白質'
  let labelK = 1
  function setLabel(l, x, y, alpha, z = 0.3) {
    const a = clamp(alpha, 0, 1)
    const u = l.userData
    if (u.k == null) u.k = 1
    if (Math.abs(u.k - labelK) > 1e-3) {
      l.scale.multiplyScalar(labelK / u.k)
      u.k = labelK
    }
    l.visible = a > 0.02
    l.material.opacity = a
    l.position.set(x, y, z)
  }

  // ───────── 狀態 ─────────
  let P = 0
  let goal = 0
  let mult = 1
  let playing = false
  let mutView = false
  let sel = -1
  let camKey = ''
  let camPreset = null
  let mb = 0 // 突變視角混合 0..1
  let lastCap = ''
  let lastBadge = ''
  let lastLegend = ''
  let lastStripKey = ''
  let lastSlider = -1
  let lastSeg = -1
  let mutMsg = ''
  let capFrac = 0.16
  let narrow = false
  let frameNo = 0
  function measure() {
    const c = ctx.el.querySelector('.hud-caption')
    const v = ctx.view
    const lg = ctx.el.querySelector('.hud-legend')
    const hs = (c && !c.hidden ? c.offsetHeight : 0) + (lg && !lg.hidden ? lg.offsetHeight : 0)
    const f = hs && v.clientHeight ? hs / v.clientHeight : 0.12
    if (Math.abs(f - capFrac) > 0.004) {
      capFrac = f
      camKey = ''
    }
    const nw = v.clientWidth < 520
    if (nw !== narrow) {
      narrow = nw
      lastLegend = ''
    }
  }
  let dockOK = true
  let changedMax = 0
  const changed = new Array(NP).fill(false)
  const strength = new Array(NP).fill(0)
  let foldPos = FOLD.map((p) => p.clone())
  let pocketLocal = POCKET0.clone()

  function rebuildProtein() {
    seqDirty = true
    an = analyze(seqStr())
    for (let k = 0; k < NP; k++) {
      const o = orig.codons[k]
      const c = an.codons[k]
      const cl = classify(o.dna, c.dna)
      changed[k] = k < an.nAA && cl.kind === 'missense'
      strength[k] = changed[k] ? cl.strength : 0
    }
    changedMax = Math.max(0, ...strength)
    foldPos = FOLD.map((p) => p.clone())
    for (let m = 0; m < NP; m++) {
      if (!changed[m]) continue
      const side = m < 5 ? 1 : -1
      const dir = new V3(0, side * 0.6, 0.6)
      for (let k = 0; k < NP; k++) {
        const w = Math.exp(-((k - m) ** 2) / (2 * 1.2 * 1.2))
        foldPos[k].addScaledVector(dir, strength[m] * 0.5 * w)
        if ((k < 5) === (m < 5)) foldPos[k].y += side * 0.32 * strength[m] // 整段螺旋被推開，口袋變寬
      }
    }
    pocketLocal = POCKET0.clone()
    dockOK = an.nAA === NP && changedMax < 0.5
  }

  // ───────── 由進度 P 推導各子系統的狀態 ─────────
  function derive() {
    const s = {}
    s.amp = P < 1 ? easeInOut(clamp(P, 0, 1)) : 1
    const uT = clamp(P - 1, 0, 1)
    s.pr = 40 * uT
    s.pc = s.pr + 1.5
    s.polyIn = smoothstep(0.2, 0.95, P)
    s.polyOut = smoothstep(33, 37, s.pc)
    s.exp = easeInOut(clamp(P - 2, 0, 1))
    s.ribo = smoothstep(2.6, 3.0, P) * (1 - smoothstep(4.0, 4.3, P))
    const nSteps = an.stopIdx + 1
    const uL = clamp(P - 3, 0, 1)
    const cRaw = uL * nSteps
    s.nSteps = nSteps
    s.ci = Math.min(Math.floor(cRaw), nSteps - 1)
    s.f = P >= 4 ? 1 : cRaw - Math.floor(cRaw)
    s.tl = P > 3.001 && P < 4
    s.fold = easeInOut(clamp((P - 4.08) / 0.85, 0, 1))
    return s
  }

  // ───────── DNA 每幀更新 ─────────
  const cacheCol = {}
  const colOf = (b) => cacheCol[b] || (cacheCol[b] = col(b === 'U' ? COLORS.U : COLORS[b]))
  const tmpC = new THREE.Color()
  const _e1 = new V3()
  const _dir = new V3()
  const _e2 = new V3()
  let seqCache = ''
  let seqDirty = true
  const seqStr = () => {
    if (seqDirty) {
      seqCache = seq.join('')
      seqDirty = false
    }
    return seqCache
  }
  const selCodon = () => (sel >= 0 ? Math.floor(sel / 3) : -1)

  function updateHelix(t, st, dt) {
    const spin = t * 0.45 * ctx.motion
    const scanPhase = ((t * 6 * ctx.motion) % (N + 16)) - 8
    const scanOn = 1 - smoothstep(0.1, 0.6, P)
    const sc = selCodon()
    for (let i = 0; i < N; i++) {
      const d = i - st.pc
      const o = st.amp * smoothstep(-5, -3, d) * (1 - smoothstep(3.5, 5.5, d))
      oOpen[i] = o
      const e = easeInOut(o)
      const a = i * TWIST + spin * (1 - o)
      const x = xOf(i)
      P0[i].set(x, lerp(CY + RAD * Math.cos(a), CY + DOPEN, e), lerp(RAD * Math.sin(a), 0, e))
      P1[i].set(x, lerp(CY - RAD * Math.cos(a), CY - DOPEN, e), lerp(-RAD * Math.sin(a), 0, e))
      if (flash[i] > 0) flash[i] = Math.max(0, flash[i] - dt * 0.7)
    }
    for (let i = 0; i < N; i++) {
      const inSel = sc >= 0 && Math.floor(i / 3) === sc
      const isSel = i === sel
      const r = 0.07 * (isSel ? 1.8 : inSel ? 1.3 : 1)
      const dist = P0[i].distanceTo(P1[i])
      const e = easeInOut(oOpen[i])
      const L = lerp(dist / 2, 0.36, e)
      _dir.subVectors(P1[i], P0[i]).normalize()
      _e1.copy(P0[i]).addScaledVector(_dir, L)
      setBond(rungs, 2 * i, P0[i], _e1, r)
      _e2.copy(P1[i]).addScaledVector(_dir, -L)
      setBond(rungs, 2 * i + 1, P1[i], _e2, r)
      const bright = 1 + flash[i] * 1.6 + (inSel ? 0.35 : 0) + scanOn * 0.9 * Math.exp(-((i - scanPhase) ** 2) / 5)
      rungs.setColorAt(2 * i, tmpC.copy(colOf(seq[i])).multiplyScalar(bright))
      rungs.setColorAt(2 * i + 1, tmpC.copy(colOf(COMP[seq[i]])).multiplyScalar(bright))
      setSphere(bbSph, i, P0[i], 0.125)
      setSphere(bbSph, N + i, P1[i], 0.125)
      if (i < N - 1) {
        setBond(bbBond, i, P0[i], P0[i + 1], 0.045)
        setBond(bbBond, N - 1 + i, P1[i], P1[i + 1], 0.045)
      }
    }
    rungs.instanceMatrix.needsUpdate = rungs.instanceColor.needsUpdate = true
    bbSph.instanceMatrix.needsUpdate = bbBond.instanceMatrix.needsUpdate = true

    // 掃描光（第一眼吸睛）
    const si = clamp(Math.floor(scanPhase), 0, N - 1)
    scanGlow.position.set(xOf(si), CY, 0.2)
    scanGlow.material.opacity = scanOn * 0.6 * (scanPhase < 0 || scanPhase > N ? 0 : 1)

    // 選取框
    if (sc >= 0) {
      const open = (oOpen[3 * sc] + oOpen[3 * sc + 1] + oOpen[3 * sc + 2]) / 3
      dnaBox.visible = true
      dnaBox.scale.set(3 * S + 0.1, lerp(1.75, 2.9, open), 1.7)
      dnaBox.position.set(xCod(sc), CY, 0)
      selGlow.visible = true
      selGlow.position.set(P0[sel].x, P0[sel].y, P0[sel].z + 0.25)
    } else {
      dnaBox.visible = false
      selGlow.visible = false
    }
  }

  // ───────── 聚合酶 ─────────
  function updatePoly(t, st) {
    const a = st.polyIn * (1 - st.polyOut)
    const pcv = Math.min(st.pc, 34)
    poly.visible = a > 0.01
    poly.position.set(xOf(pcv), CY + (1 - st.polyIn) * 3.2, 0)
    poly.scale.setScalar(0.65 + 0.35 * st.polyIn)
    polyMat.opacity = 0.45 * a
    poly.userData.glow.material.opacity = 0.35 * a
    const pulse = 1 + Math.sin(t * 3) * 0.02 * ctx.motion
    poly.scale.multiplyScalar(pulse)
  }

  // ───────── mRNA ─────────
  const _a = new V3()
  const _b = new V3()
  const _c = new V3()
  function updateMRNA(t, st, dt) {
    const rna = seq // 編碼股 = mRNA 序列（T→U）
    for (let j = 0; j < N; j++) {
      if (mrFlash[j] > 0) mrFlash[j] = Math.max(0, mrFlash[j] - dt * 0.7)
      const pres = clamp(st.pr - j, 0, 1)
      if (pres <= 0.001) {
        mrSc[j] = 0
        mrNt.setMatrixAt(j, ZERO)
        continue
      }
      const dx = xOf(j)
      _a.set(dx, CY - DOPEN + 0.36 + 0.26, 0)
      _b.set(dx + 0.5, CY - DOPEN - 0.9, 1.0)
      MR[j].lerpVectors(_b, _a, easeOutCubic(pres))
      const w = smoothstep(1.5, 5.5, st.pr - j)
      _c.set(dx, YROW, 0.15)
      MR[j].lerp(_c, w)
      MR[j].z += 0.7 * Math.sin(Math.PI * w)
      MR[j].y = lerp(MR[j].y, YC, st.exp) + Math.sin(Math.PI * st.exp) * Math.sin(j * 0.5 + st.exp * 8) * 0.22
      MR[j].z = lerp(MR[j].z, 0, st.exp)
      mrSc[j] = 0.16 * (0.4 + 0.6 * pres) * (1 + mrFlash[j] * 0.6)
      setSphere(mrNt, j, MR[j], mrSc[j])
      const b = rna[j] === 'T' ? 'U' : rna[j]
      mrNt.setColorAt(j, tmpC.copy(colOf(b)).multiplyScalar(1 + mrFlash[j] * 1.6))
    }
    for (let j = 0; j < N - 1; j++) setBond(mrBond, j, MR[j], MR[j + 1], mrSc[j] > 0.05 && mrSc[j + 1] > 0.05 ? 0.045 : 0)
    mrNt.instanceMatrix.needsUpdate = mrNt.instanceColor.needsUpdate = mrBond.instanceMatrix.needsUpdate = true
  }

  // ───────── 核糖體 + tRNA + 蛋白質串珠 ─────────
  const beadA = col(0x5f7dff)
  const beadB = col(0x8fd0ff)
  const beadCols = Array.from({ length: NP }, (_, k) => beadA.clone().lerp(beadB, k / 9))
  const beadBase = (k) => beadCols[k]
  const greyC = col(COLORS.inactive)
  const magC = col(COLORS.magenta)
  const ghostC = col(0x2b3560)

  function updateTranslation(t, st, dt) {
    const sc = selCodon()
    // 核糖體位置
    const cur = st.ci
    let xr = xCod(cur)
    if (cur < st.nSteps - 1) xr = lerp(xCod(cur), xCod(cur + 1), easeInOut(smoothstep(0.86, 1.0, st.f)))
    if (P < 3) xr = xCod(0)
    const ra = st.ribo
    const dis = smoothstep(4.0, 4.3, P) // 解體
    riboL.visible = riboSm.visible = ra > 0.02
    const land = 1 - smoothstep(2.6, 3.0, P)
    riboL.position.set(xr - 0.1, YC + 0.85 + land * 1.6 + dis * 1.2, 0)
    riboSm.position.set(xr - 0.1, YC - 0.42 - land * 1.6 - dis * 1.2, 0)
    riboMat.opacity = 0.3 * ra
    riboL.userData.halo.material.opacity = 0.18 * ra
    riboSm.userData.halo.material.opacity = 0.18 * ra
    riboSm.material.opacity = 0.42 * ra

    // tRNA
    const codon = an.codons[Math.min(cur, an.codons.length - 1)]
    const sense = st.tl && cur < an.stopIdx
    const isStop = P > 3.001 && cur === an.stopIdx
    let trA = 0
    if (sense) {
      const f = st.f
      const dock = _a.set(xCod(cur), YC - 0.34, 0.45)
      const start = _b.set(xCod(cur) + 2.6, YC - 2.9, 0.6)
      const end = _c.set(xCod(cur) - 2.4, YC - 3.1, 0.6)
      if (f < 0.32) {
        trna.position.lerpVectors(start, dock, easeOutCubic(f / 0.32))
        trA = smoothstep(0, 0.12, f)
      } else if (f < 0.62) {
        trna.position.copy(dock)
        trA = 1
      } else {
        const q = easeInOut((f - 0.62) / 0.38)
        trna.position.lerpVectors(dock, end, q)
        trA = 1 - q
      }
      trna.visible = trA > 0.02
      for (let i = 0; i < 3; i++) {
        const b = codon.rna[i]
        const cb = b === 'A' ? 'U' : b === 'U' ? 'A' : b === 'G' ? 'C' : 'G'
        antiM[i].color.copy(colOf(cb))
      }
      trBead.visible = f < 0.5
      trBead.material.color.copy(beadBase(cur))
      trna.scale.setScalar(0.6 + 0.4 * trA)
    } else trna.visible = false

    // 蛋白質串珠位置與顏色
    const trunc = an.nAA < NP ? smoothstep(4.0, 4.35, P) : 0
    const ghostAmt = smoothstep(4.0, 4.3, P) * (1 - st.fold)
    let selBead = -1
    for (let k = 0; k < NP; k++) {
      if (pbFlash[k] > 0) pbFlash[k] = Math.max(0, pbFlash[k] - dt * 0.6)
      let scl = 0
      const slot = _a.set(xCod(k), SLOT_Y, 0)
      const p = PB[k]
      p.copy(slot)
      if (k < an.nAA) {
        if (P >= 4) scl = 1
        else if (k < cur) scl = 1
        else if (k === cur && st.tl && cur < an.stopIdx) {
          const f = st.f
          scl = smoothstep(0.48, 0.6, f)
          const drop = smoothstep(0.48, 0.82, f)
          p.set(xCod(k), lerp(YC - 1.47, SLOT_Y, easeOutCubic(drop)), lerp(0.45, 0, drop))
        }
      } else if (P >= 4) scl = 0.55 * ghostAmt // 「本來該有、卻沒有」的部分
      pbSc[k] = scl
      // 折疊
      const fk = easeInOut(clamp(st.fold * 1.6 - k * 0.045, 0, 1))
      if (fk > 0 && k < an.nAA) {
        _c.set(FOLD_C[0] + foldPos[k].x, FOLD_C[1] + foldPos[k].y, FOLD_C[2] + foldPos[k].z)
        p.lerp(_c, fk)
        p.z += Math.sin(Math.PI * fk) * 0.5
      }
      if (k >= an.nAA && st.fold > 0) pbSc[k] = 0
      const isCh = changed[k]
      const c0 = k < an.nAA ? beadBase(k) : ghostC
      tmpC.copy(c0)
      if (isCh) tmpC.copy(magC)
      if (trunc > 0) tmpC.lerp(greyC, trunc)
      tmpC.multiplyScalar(1 + pbFlash[k] * 1.4)
      pbSph.setColorAt(k, tmpC)
      const hi = sc === k && k < an.nAA ? 1.3 : 1
      if (hi > 1) selBead = k
      setSphere(pbSph, k, p, lerp(0.29, 0.36 * FS, st.fold) * pbSc[k] * hi)
    }
    for (let k = 0; k < NP - 1; k++) setBond(pbBond, k, PB[k], PB[k + 1], pbSc[k] > 0.9 && pbSc[k + 1] > 0.9 && k + 1 < an.nAA ? lerp(0.07, 0.13, st.fold) * (k === 4 ? lerp(1, 0.4, st.fold) : 1) : 0)
    pbSph.instanceMatrix.needsUpdate = pbSph.instanceColor.needsUpdate = pbBond.instanceMatrix.needsUpdate = true
    if (selBead >= 0 && pbSc[selBead] > 0.5) {
      beadGlow.visible = true
      beadGlow.position.set(PB[selBead].x, PB[selBead].y, PB[selBead].z + 0.3)
    } else beadGlow.visible = false

    // mRNA 選取框：轉譯中跟著讀取位置，其餘時候跟著選取的密碼子
    let boxC = -1
    if (P > 2.95 && P < 4.05) boxC = cur
    else if (sc >= 0 && P >= 1.95) boxC = sc
    if (boxC >= 0 && mrSc[3 * boxC] > 0.05) {
      mrBox.visible = true
      const cy = (MR[3 * boxC].y + MR[3 * boxC + 2].y) / 2
      mrBox.scale.set(3 * S + 0.1, 0.62, 0.7)
      mrBox.position.set(xCod(boxC), cy, MR[3 * boxC + 1].z)
      const stopNow = P > 3.001 && boxC === an.stopIdx && P < 4.05
      mrBox.userData.edge.material.color.set(stopNow ? COLORS.red : 0xffe08a)
      mrBox.userData.fill.material.color.set(stopNow ? COLORS.red : 0xffe08a)
    } else mrBox.visible = false

    // 蛋白質「口袋」與藥物
    const showProt = st.fold > 0.6 && an.nAA >= 3
    const pk = _b.set(FOLD_C[0] + pocketLocal.x, FOLD_C[1] + pocketLocal.y, FOLD_C[2] + pocketLocal.z)
    const hasPocket = an.nAA === NP
    pocketRing.visible = pocketGlow.visible = showProt && hasPocket
    if (pocketRing.visible) {
      pocketRing.position.copy(pk)
      pocketRing.rotation.set(0, 0, 0)
      pocketRing.scale.set(1 + 0.6 * changedMax, 1, 1)
      pocketRing.material.color.set(dockOK ? 0xbff3ff : 0xff9fc8)
      const ok = dockOK
      pocketRing.material.emissiveIntensity = ok ? 0.9 : 0.35
      pocketGlow.position.copy(pk)
      pocketGlow.material.opacity = (ok ? 0.5 : 0.18) * smoothstep(0.6, 1, st.fold)
    }
    // 表面
    const trunc2 = an.nAA < NP
    blob.visible = st.fold > 0.05 && an.nAA >= 3
    if (blob.visible) {
      const f = st.fold
      const frac = an.nAA / NP
      blob.position.set(FOLD_C[0] + (trunc2 ? 0.2 : 0.06 * changedMax), FOLD_C[1] + (trunc2 ? 0.25 : 0), FOLD_C[2])
      blob.scale.set(lerp(0.3, 1.95 * FS, f) * (trunc2 ? 0.55 + 0.45 * frac : 1 + 0.2 * changedMax), lerp(0.3, 1.5 * FS, f) * (trunc2 ? 0.7 : 1 - 0.08 * changedMax), lerp(0.3, 1.0 * FS, f))
      blob.rotation.z = (trunc2 ? 0.35 : 0.22 * changedMax) * f
      blobMat.color.set(trunc2 ? COLORS.inactive : COLORS.enzyme)
      blobMat.emissive.set(trunc2 ? 0x30384f : 0x2a4aff)
      blobMat.opacity = (trunc2 ? 0.1 : 0.16) * f
      blobHalo.material.color.set(trunc2 ? 0x8a93ad : 0x7f9bff)
      blobHalo.material.opacity = (trunc2 ? 0.08 : 0.18) * f
    }
    const dAmt = smoothstep(4.5, 4.9, P)
    drug.visible = dAmt > 0.02
    if (drug.visible) {
      const cyc = ((t * 0.16 * (ctx.reducedMotion ? 0.5 : 1)) % 1 + 1) % 1
      const Sx = _a.set(FOLD_C[0] + 3.6, FOLD_C[1] + 1.7, 0.6)
      const Ex = _c.set(FOLD_C[0] - 3.6, FOLD_C[1] + 1.8, 0.5)
      let prodMix = 0
      const pos = drug.position
      if (!showProt || !hasPocket) {
        // 沒有蛋白質可以處理：藥物直接飄過
        pos.lerpVectors(Sx, Ex, cyc)
        pos.y += Math.sin(cyc * Math.PI * 2) * 0.2
      } else if (dockOK) {
        if (cyc < 0.35) pos.lerpVectors(Sx, pk, easeInOut(cyc / 0.35))
        else if (cyc < 0.7) {
          pos.copy(pk)
          prodMix = smoothstep(0.45, 0.6, cyc)
        } else {
          pos.lerpVectors(pk, Ex, easeInOut((cyc - 0.7) / 0.3))
          prodMix = 1
        }
      } else {
        // 形狀不對：靠近、卡不進去、彈回
        if (cyc < 0.45) pos.lerpVectors(Sx, pk, 0.68 * easeInOut(cyc / 0.45))
        else if (cyc < 0.7) {
          _d.lerpVectors(Sx, pk, 0.68)
          pos.copy(_d)
          pos.x += Math.sin((cyc - 0.45) * 40) * 0.05
        } else {
          _d.lerpVectors(Sx, pk, 0.68)
          pos.lerpVectors(_d, Ex.set(FOLD_C[0] + 3.9, FOLD_C[1] + 2.4, 0.6), easeInOut((cyc - 0.7) / 0.3))
        }
      }
      drug.scale.setScalar(DRUG_K * dAmt)
      drug.rotation.set(t * 0.8 * ctx.motion, t * 1.1 * ctx.motion, 0)
      for (const m of drugMats) m.color.set(COLORS.drug).lerp(tmpC.set(COLORS.metabolite), prodMix)
      drugGlow.material.color.set(COLORS.drug).lerp(tmpC.set(COLORS.metabolite), prodMix)
    }

    // 標籤：核糖體
    const stopTxt = isStop && st.f > 0.15 ? '終止密碼子：停止' : '核糖體'
    if (stopTxt !== lbRibText) {
      lbRibText = stopTxt
      lbRib.userData.setText(stopTxt)
      lbRib.userData.k = 1
    }
    setLabel(lbRib, Math.min(xr, 4.2), YC + 2.05 + land * 1.6, ra * 0.95)
    setLabel(lbTr, trna.position.x + 0.9, trna.position.y - 0.9, sense ? trA * (cur < 2 ? 0.95 : 0.55) : 0, 0.7)
    setLabel(lbMr, xOf(28), YC + 0.6, smoothstep(2.5, 3.0, P) * (1 - smoothstep(3.3, 3.7, P)), 0.4)
  }

  // ───────── 標籤（DNA 階段）─────────
  function updateLabels(st) {
    const nucA = 1 - smoothstep(0.05, 0.4, P)
    setLabel(lbNuc, 4.6, CY + 1.6, nucA * 0.9)
    setLabel(lbCyt, 4.6, -1.35, smoothstep(2.2, 2.6, P) * (1 - smoothstep(2.9, 3.2, P)) * 0.9)
    const strandA = smoothstep(0.1, 0.5, P) * (1 - smoothstep(1.5, 1.9, P))
    const pcv = Math.min(st.pc, 34)
    setLabel(lbCod, xOf(pcv) + 2.5, CY + 1.45, strandA, 0.3)
    setLabel(lbTpl, xOf(pcv) + 2.5, CY - 1.45, strandA, 0.3)
    setLabel(lbPol, xOf(pcv) + 1.2, CY + 2.0, st.polyIn * (1 - st.polyOut) * (1 - smoothstep(1.95, 2.3, P)) * 0.95, 0.6)
    const protA = smoothstep(4.5, 5, P)
    setLabel(lbProt, FOLD_C[0], FOLD_C[1] - 1.5 * FS - 0.5 - 0.5 * changedMax, protA * 0.95)
    const txt = an.nAA < NP ? `截短的蛋白質（${an.nAA}/${NP} 顆）· 通常失去功能` : changedMax > 0 ? '形狀改變的蛋白質（示意）' : '正常的蛋白質（酵素）'
    if (txt !== lbProtText) {
      lbProtText = txt
      lbProt.userData.setText(txt)
      lbProt.userData.k = 1
    }
  }

  // ───────── 攝影機取景 ─────────
  // 每個關鍵格：[P, 中心x, 中心y, 半寬W, 半高H]
  const KF = [
    [0, 0, 2.2, 5.9, 2.5],
    [2, 0, 2.2, 5.9, 2.5],
    [3, 0, -1.9, 6.4, 3.0],
    [3.4, 0, -3.9, 7.2, 3.0],
    [4, 0, -3.9, 7.2, 3.0],
    [4.6, 0, -4.3, 5.9, 3.7],
    [5, 0, -4.3, 5.9, 3.7],
  ]
  const _cc = new V3()
  const _dc = new V3()
  const WIDE = [0, -3.8, 5.6, 4.3]
  const WIDE_N = [0, -4.7, 4.6, 3.75] // 窄螢幕：只取 mRNA 與蛋白質，讓結果夠大
  function frameFor(p) {
    let i = 0
    while (i < KF.length - 2 && p > KF[i + 1][0]) i++
    const a = KF[i]
    const b = KF[i + 1]
    const t = easeInOut(clamp((p - a[0]) / (b[0] - a[0]), 0, 1))
    return [lerp(a[1], b[1], t), lerp(a[2], b[2], t), lerp(a[3], b[3], t), lerp(a[4], b[4], t)]
  }
  function updateCamera(dt) {
    mb = damp(mb, mutView && P > 4.4 ? 1 : 0, 3, dt)
    const f = frameFor(P)
    const wd = narrow ? WIDE_N : WIDE
    const cx = lerp(f[0], wd[0], mb)
    const cy = lerp(f[1], wd[1], mb)
    const W = lerp(f[2], wd[2], mb)
    const H = lerp(f[3], wd[3], mb)
    const aspect = camera.aspect || 1.3
    const vf = THREE.MathUtils.degToRad(camera.fov)
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect)
    const bp = capFrac + 0.03
    const usable = clamp(1 - 0.13 - bp, 0.4, 0.9)
    const Hv = Math.max(H / usable, (W * 1.06) / aspect)
    const dist = Hv / Math.tan(vf / 2)
    const R = dist * Math.sin(Math.min(vf, hf) / 2)
    const cyAdj = cy - (bp - 0.13) * Hv
    const key = [cx, cyAdj, R].map((v) => v.toFixed(3)).join()
    if (key === camKey) return
    camKey = key
    const c = _cc.set(cx, cyAdj, 0)
    if (!camPreset) {
      camPreset = { azimuth: 0.05, elevation: 0.14 }
      ctx.setFrame(c, R, { azimuth: camPreset.azimuth, elevation: camPreset.elevation, padding: 1 })
    } else {
      // Stage.setFrame 會先搬動 target 再讀方向：先把攝影機跟著平移，視角才不會隨取景中心而傾斜
      camera.position.add(_dc.subVectors(c, ctx.controls.target))
      ctx.setFrame(c, R, { padding: 1 })
    }
  }

  // ───────── HTML：序列讀取條 ─────────
  const strip = document.createElement('div')
  strip.className = 'c2-strip'
  strip.setAttribute('role', 'group')
  strip.setAttribute('aria-label', '示範基因的 33 個字母，每個密碼子由上到下：胺基酸、mRNA、DNA 編碼股')
  const cods = []
  for (let c = 0; c < NCOD; c++) {
    const box = document.createElement('div')
    box.className = 'c2-cod'
    const aaEl = document.createElement('div')
    aaEl.className = 'c2-aa'
    const rnEl = document.createElement('div')
    rnEl.className = 'c2-rn'
    const dn = document.createElement('div')
    dn.className = 'c2-dn'
    const btns = []
    for (let k = 0; k < 3; k++) {
      const b = document.createElement('button')
      b.type = 'button'
      b.dataset.i = String(3 * c + k)
      b.addEventListener('click', () => select(3 * c + k))
      dn.append(b)
      btns.push(b)
    }
    box.append(aaEl, rnEl, dn)
    strip.append(box)
    cods.push({ box, aaEl, rnEl, btns })
  }

  function refreshStrip(st) {
    const mrRev = P >= 2 ? N : Math.floor(st.pr)
    const cur = st.ci
    let aaRev = 0
    if (P >= 4) aaRev = an.stopIdx + 1
    else if (P > 3) aaRev = cur + (st.f > 0.8 ? 1 : 0)
    const key = [seqStr(), sel, mrRev, aaRev].join('|')
    if (key === lastStripKey) return
    lastStripKey = key
    const sc = selCodon()
    for (let c = 0; c < NCOD; c++) {
      const cd = cods[c]
      const info = an.codons[c]
      cd.box.classList.toggle('is-sel', c === sc)
      // 胺基酸列
      const untranslated = c > an.stopIdx
      let aTxt = '·'
      let isMut = false
      if (c < aaRev && !untranslated) {
        aTxt = info.aa === '*' ? '停止' : AA[info.aa][0]
        isMut = c < an.stopIdx && info.aa !== orig.codons[c].aa
        if (c === an.stopIdx && c !== NCOD - 1) isMut = true
      } else if (untranslated && P >= 4) aTxt = '—'
      cd.aaEl.textContent = aTxt
      cd.aaEl.classList.toggle('is-mut', isMut)
      // mRNA 列
      const shown = 3 * c + 2 < mrRev
      cd.rnEl.replaceChildren(
        ...[0, 1, 2].map((k) => {
          const sp = document.createElement('span')
          const b = seq[3 * c + k] === 'T' ? 'U' : seq[3 * c + k]
          sp.textContent = shown ? b : '·'
          sp.style.color = shown ? baseHex(b) : 'var(--muted)'
          return sp
        })
      )
      // DNA 列
      cd.btns.forEach((b, k) => {
        const i = 3 * c + k
        b.textContent = seq[i]
        b.style.color = baseHex(seq[i])
        b.classList.toggle('is-sel', i === sel)
        b.setAttribute('aria-pressed', String(i === sel))
        b.classList.toggle('is-mut', seq[i] !== GENE[i])
        b.classList.toggle('is-lock', isLocked(i))
        b.setAttribute('aria-label', `第 ${i + 1} 個鹼基 ${seq[i]}${isLocked(i) ? '（起始或終止密碼子，本示意不開放改動）' : ''}`)
        b.title = isLocked(i) ? (c === 0 ? '起始密碼子 ATG：本示意不開放改動' : '終止密碼子：本示意不開放改動') : `第 ${i + 1} 個鹼基，點一下選取`
      })
    }
  }

  // ───────── 控制項 ─────────
  ui.root.append(Object.assign(document.createElement('style'), { textContent: CSS }))
  const gFlow = ui.group('流程：DNA → mRNA → 蛋白質')
  const segStage = gFlow.segmented({
    label: '階段（可直接跳）',
    options: ['① 螺旋', '② 解旋', '③ 轉錄', '④ 出核', '⑤ 轉譯', '⑥ 折疊'].map((label, value) => ({ value, label })),
    value: 0,
    onChange: (v) => {
      mutView = false
      playing = false
      mult = 1
      goal = v
      playBtn.textContent = '▶ 自動播放'
    },
  })
  const sld = gFlow.slider({
    label: '進度（可拖曳、倒帶重看）',
    min: 0,
    max: 5,
    step: 0.01,
    value: 0,
    format: (v) => `${Math.round((v / 5) * 100)}%`,
    onInput: (v) => {
      mutView = false
      playing = false
      mult = 1
      P = goal = v
      playBtn.textContent = '▶ 自動播放'
    },
  })
  const row = gFlow.buttons([
    {
      label: '▶ 自動播放',
      kind: 'primary',
      onClick: () => {
        mutView = false
        if (playing) {
          playing = false
          goal = P
          playBtn.textContent = '▶ 繼續播放'
          return
        }
        if (P >= 4.99) P = 0
        goal = 5
        mult = 1
        playing = true
        playBtn.textContent = '⏸ 暫停'
      },
    },
    {
      label: '✎ 動手改字母',
      onClick: () => enterMut(),
    },
    {
      label: '↺ 從頭',
      onClick: () => {
        mutView = false
        playing = false
        P = goal = 0
        mult = 1
        playBtn.textContent = '▶ 自動播放'
      },
    },
  ])
  const playBtn = row.buttons[0]

  const gMut = ui.group('突變實驗：改一個字母，看蛋白質怎麼變（示意序列，不是真實基因）')
  gMut.note('下面三列由上到下是：胺基酸 · mRNA · DNA 編碼股。點 3D 畫面裡的鹼基，或直接點下面的 DNA 字母來選取，再選要換成什麼。第一個（起始）與最後一個（終止）密碼子不開放改動。', {})
  gMut.root.append(strip)
  const segBase = gMut.segmented({
    label: '把選定的字母改成',
    options: ['A', 'T', 'G', 'C'].map((b) => ({ value: b, label: b, color: COLORS[b] })),
    value: 'A',
    onChange: (b) => applyBase(b),
  })
  const rdProt = gMut.readout({ label: '蛋白質的結果', value: '未改動（正常）' })
  gMut.buttons([
    { label: '示範：同義變異', onClick: () => demo(14, 'G') },
    { label: '示範：錯義變異', onClick: () => demo(16, 'G') },
    { label: '示範：無義變異', onClick: () => demo(20, 'A') },
  ])
  gMut.buttons([
    { label: '🎲 隨機改一個', onClick: () => randomMut() },
    { label: '還原原序列', onClick: () => resetSeq() },
  ])
  const rdSel = gMut.readout({ label: '選定的密碼子', value: '（尚未選取）' })
  const rdEff = gMut.readout({ label: '這個改變的類型', value: '—' })
  const descNote = gMut.note('')
  descNote.setAttribute('aria-live', 'polite')
  function setDesc(d) {
    const o = typeof d === 'string' ? { short: d, long: d } : d
    mutMsg = o.short
    descNote.textContent = o.long
  }

  // ───────── 突變邏輯 ─────────
  function codonInfoHtml(c) {
    const o = orig.codons[c]
    const n = an.codons[c]
    const col3 = (s) => [...s].map((b) => `<span style="color:${baseHex(b === 'T' ? 'U' : b)}">${b === 'T' ? 'U' : b}</span>`).join('')
    const aa = AA[n.aa]
    return `${col3(n.dna)} → <b>${aa[0]}</b> ${aa[1]}`
  }
  function effectOf(c) {
    return classify(orig.codons[c].dna, an.codons[c].dna)
  }
  function describe(c) {
    const o = orig.codons[c]
    const n = an.codons[c]
    const cl = effectOf(c)
    const a0 = AA[o.aa]
    const a1 = AA[n.aa]
    const pos = `第 ${c + 1} 個密碼子`
    switch (cl.kind) {
      case 'same':
        return { short: `已選第 ${c + 1} 個密碼子 ${o.dna}（${a0[1]}）：在下方選要換成的字母。`, long: `${pos} ${o.dna}（${a0[1]}${a0[0]}）。選一個字母，把它換成別的，看看流程哪裡會不一樣；起始與終止密碼子不開放改動。` }
      case 'synonymous':
        return { short: `同義變異：${o.dna}→${n.dna}，仍是${a1[1]}，蛋白質序列不變。`, long: `同義變異：${pos} ${o.dna}→${n.dna}，仍然是${a1[1]}（${a1[0]}）。因為好幾個密碼子指到同一種胺基酸，胺基酸沒變，這顆蛋白質看起來一模一樣。（少數同義變異仍可能因影響剪接或表現量而改變功能。）` }
      case 'nonsense':
        return { short: `無義變異：${o.dna}→${n.dna} 變成終止密碼子，只剩前 ${an.nAA} 顆。`, long: `無義變異：${pos} ${o.dna}→${n.dna} 變成終止密碼子，蛋白質在這裡提早中止，只剩前 ${an.nAA} 顆（原本 ${NP} 顆），通常失去功能。CYP2C19*3 的 TGG→TGA 就是同一類型。` }
      default:
        return {
          short: `錯義變異：${a0[1]}→${a1[1]}（${cl.conservative ? '性質相近，變化小' : '性質差很多，形狀可能改變'}）。`,
          long: `錯義變異：${pos} ${o.dna}→${n.dna},${a0[1]}換成${a1[1]}（${CLASS_ZH[a0[2]]}→${CLASS_ZH[a1[2]]}）。${cl.conservative ? '性質相近，示意畫面中形狀變化較小' : '性質差很多，示意畫面中形狀被推開、口袋變寬'}。真實的影響要靠實驗或臨床證據判斷，不能只看換了什麼。`,
        }
    }
  }
  function refreshProt() {
    let txt
    let colr = ''
    if (an.nAA < NP) {
      txt = `截短：只剩 ${an.nAA}/${NP} 顆 · 通常失去功能`
      colr = '#ff9a9a'
    } else if (changedMax > 0) {
      txt = changedMax < 0.5 ? '換了一顆，形狀變化小（示意）' : '換了一顆，形狀明顯改變（示意）'
      colr = '#ff8fbf'
    } else if (seqStr() !== GENE) {
      txt = '胺基酸序列不變（同義）'
      colr = '#7cf2c8'
    } else txt = '未改動（正常）'
    rdProt.set(txt)
    rdProt.setColor(colr)
  }
  function refreshReadouts() {
    refreshProt()
    if (sel < 0) {
      rdSel.set('（尚未選取）')
      rdEff.set('—')
      return
    }
    const c = selCodon()
    rdSel.set(`第 ${c + 1} 個：${codonInfoHtml(c)}`, { html: true })
    const cl = effectOf(c)
    rdEff.set(cl.kind === 'same' ? '尚未改動' : cl.label + (cl.kind === 'missense' ? (cl.conservative ? '（性質相近）' : '（性質差很多）') : ''))
    rdEff.setColor(cl.kind === 'nonsense' ? '#ff9a9a' : cl.kind === 'missense' ? '#ff8fbf' : cl.kind === 'synonymous' ? '#7cf2c8' : '')
  }
  // 只捲動控制面板（不捲動整個頁面），讓突變區的字母與結果在視野內
  function revealMut(target) {
    const box = ctx.el.querySelector('.stage-controls')
    if (!box || box.scrollHeight <= box.clientHeight + 4) return
    const off = (target || gMut.root).getBoundingClientRect().top - box.getBoundingClientRect().top
    box.scrollTo({ top: Math.max(0, box.scrollTop + off - 6), behavior: ctx.reducedMotion ? 'auto' : 'smooth' })
  }
  function enterMut() {
    mult = 1
    playing = false
    playBtn.textContent = '▶ 自動播放'
    goal = 5
    if (P < 4.9) {
      if (ctx.paused) P = 5
      else mult = 2.2
    }
    mutView = true
    lastSeg = -1
    if (sel < 0) select(20)
    else setDesc(describe(selCodon()))
    if (sel >= 0 && !isLocked(sel) && seq[sel] === GENE[sel]) setDesc({ short: '突變實驗：已選好 TGG 的最後一個 G，試著把它改成 A。', long: '突變實驗：已經幫你選好 TGG 的最後一個 G。把它改成 A（或按「示範：無義變異」），看看蛋白質會怎樣。' })
    revealMut(strip)
  }
  function select(i, reveal) {
    sel = i
    segBase.set(seq[i])
    mutView = true
    if (reveal) revealMut(strip)
    setDesc(describe(selCodon()))
    if (isLocked(i)) setDesc({ short: '起始/終止密碼子不開放改動，請選中間的密碼子。', long: (Math.floor(i / 3) === 0 ? '起始密碼子 ATG（甲硫胺酸）標示「從這裡開始讀」；' : '終止密碼子標示「到此為止」；') + '本示意不開放改動，請選中間的密碼子。' })
    refreshReadouts()
    lastStripKey = ''
  }
  function setBase(i, b) {
    if (isLocked(i)) {
      setDesc({ short: '起始/終止密碼子不開放改動，請選中間的密碼子。', long: '起始與終止密碼子在本示意中鎖定，請選中間的密碼子。' })
      mutView = true
      return false
    }
    if (seq[i] === b) return false
    seq[i] = b
    flash[i] = 1
    mrFlash[i] = 1
    pbFlash[Math.floor(i / 3)] = 1
    rebuildProtein()
    return true
  }
  function replay() {
    if (ctx.paused) {
      // 動畫暫停時不重播，直接顯示結果
      P = goal = 5
      mult = 1
      return
    }
    P = 3.0
    goal = 5
    mult = 2.2
  }
  function afterMutation(i, force) {
    sel = i
    mutView = true
    playing = false
    playBtn.textContent = '▶ 自動播放'
    // 已經走到 mRNA 之後（或示範按鈕強制）：從出核重播，讓讀者看見新的字母走完整條流程
    if (P >= 2.95 || force) replay()
    segBase.set(seq[i])
    setDesc(describe(selCodon()))
    refreshReadouts()
    lastStripKey = ''
  }
  function applyBase(b) {
    if (sel < 0) {
      setDesc('先點一個鹼基（3D 畫面或下方的 DNA 字母），再選要換成什麼。')
      mutView = true
      return
    }
    if (setBase(sel, b)) afterMutation(sel)
    else {
      if (seq[sel] === b) setDesc(`第 ${sel + 1} 個鹼基本來就是 ${b}，換一個不同的字母吧。`)
      refreshReadouts()
    }
  }
  function resetSeq(quiet) {
    for (let i = 0; i < N; i++) {
      if (seq[i] !== GENE[i]) {
        seq[i] = GENE[i]
        flash[i] = 0.6
        mrFlash[i] = 0.6
      }
    }
    rebuildProtein()
    lastStripKey = ''
    if (!quiet) {
      setDesc('已還原成原本的序列。選一個字母再改改看，或按示範。')
      mutView = true
      if (P >= 2.95) replay()
      if (sel >= 0) segBase.set(seq[sel])
      refreshReadouts()
    }
  }
  function demo(i, b) {
    resetSeq(true)
    setBase(i, b)
    afterMutation(i, true) // 從頭還沒走完時，示範會直接跳到結尾讓讀者看到結果
  }
  function randomMut() {
    resetSeq(true)
    const c = 1 + Math.floor(Math.random() * (NCOD - 2))
    const i = 3 * c + Math.floor(Math.random() * 3)
    const others = ['A', 'T', 'G', 'C'].filter((b) => b !== GENE[i])
    const b = others[Math.floor(Math.random() * 3)]
    setBase(i, b)
    afterMutation(i, true)
  }

  // ───────── 指標互動：最近的鹼基 / 珠子 ─────────
  function nearest(px, py) {
    const thr = ctx.coarsePointer ? 34 : 22
    let best = null
    let bd = thr
    const test = (v, kind, i, k) => {
      const q = ctx.project(v)
      if (!q.visible) return
      const d = Math.hypot(q.x - px, q.y - py)
      if (d < bd) {
        bd = d
        best = { kind, i, k }
      }
    }
    for (let i = 0; i < N; i++) {
      test(P0[i], 'dna', i)
      test(P1[i], 'dna', i)
    }
    if (P >= 1.95) for (let j = 0; j < N; j++) if (mrSc[j] > 0.08) test(MR[j], 'mrna', j)
    for (let k = 0; k < an.nAA; k++) if (pbSc[k] > 0.5) test(PB[k], 'aa', 3 * k + 1, k)
    return best
  }
  const offPtr = ctx.onPointer((type, e, ptr) => {
    if (type === 'leave' || type === 'cancel') {
      hud.tip(null)
      ctx.setCursor('')
      return
    }
    if (type === 'move' && !ptr.down) {
      if (ctx.coarsePointer) return // 觸控沒有「懸停」：不顯示浮動提示，避免提示卡在畫面上
      const hit = nearest(ptr.px, ptr.py)
      ctx.setCursor(hit ? 'pointer' : '')
      if (!hit) return hud.tip(null)
      const c = Math.floor(hit.i / 3)
      const n = an.codons[c]
      const aa = AA[n.aa]
      const label = hit.kind === 'dna' ? `DNA 第 ${hit.i + 1} 個鹼基：${seq[hit.i]}（對面是 ${COMP[seq[hit.i]]}）` : hit.kind === 'mrna' ? `mRNA 第 ${hit.i + 1} 個鹼基：${seq[hit.i] === 'T' ? 'U' : seq[hit.i]}` : `第 ${hit.k + 1} 顆胺基酸：${aa[0]} ${aa[1]}`
      hud.tip(`${label}<br><span style="color:#9fb0d8">第 ${c + 1} 個密碼子 ${n.rna} → ${aa[0]} ${aa[1]}<br>點一下選取</span>`)
    }
    if (type === 'click') {
      const hit = nearest(ptr.px, ptr.py)
      if (hit) select(hit.i, true)
    }
  })

  // ───────── HUD ─────────
  function stageIndex() {
    return P <= 0.001 ? 0 : Math.min(5, Math.ceil(P - 0.001))
  }
  function updateHud(st) {
    const si = stageIndex()
    const badge = mutView ? '突變實驗' : STAGE_NAMES[si]
    if (badge !== lastBadge) {
      lastBadge = badge
      hud.badge(badge)
    }
    let cap = mutView && mutMsg ? mutMsg : STAGE_CAPTIONS[si]
    if (!mutView && st && st.tl && P > 3.02) {
      const ci = an.codons[st.ci]
      const rn = ci.dna.replace(/T/g, 'U')
      cap += '現在讀的是 ' + rn + ' → ' + (ci.aa === '*' ? '終止訊號' : AA[ci.aa][0] + '（' + AA[ci.aa][1] + '）') + '。'
    }
    if (cap !== lastCap) {
      lastCap = cap
      hud.caption(cap)
      measure()
    }
    const lg = (narrow ? 'n' : 'w') + (P < 4.3 && !mutView ? 'base' : 'prot')
    if (lg !== lastLegend) {
      lastLegend = lg
      if (lg.endsWith('base'))
        hud.legend([
          { color: COLORS.A, label: 'A' },
          { color: COLORS.T, label: 'T' },
          { color: COLORS.G, label: 'G' },
          { color: COLORS.C, label: 'C' },
          { color: COLORS.U, label: 'U(RNA)' },
        ])
      else
        hud.legend([
          { color: COLORS.enzyme, label: '胺基酸' },
          { color: COLORS.magenta, label: '變異' },
          { color: COLORS.inactive, label: narrow ? '無功能' : '通常無功能' },
          ...(narrow ? [] : [{ color: COLORS.drug, label: '藥物（示意）' }]),
        ])
    }
    if (Math.abs(P - lastSlider) > 0.004) {
      lastSlider = P
      sld.set(P)
    }
    if (si !== lastSeg) {
      lastSeg = si
      segStage.set(si)
    }
  }

  rebuildProtein()
  refreshReadouts()
  hud.caption(STAGE_CAPTIONS[0])

  // ───────── 主迴圈 ─────────
  return {
    update(dt, t) {
      // 進度推進
      if (P !== goal) {
        const dir = Math.sign(goal - P)
        const ph = clamp(Math.floor(dir > 0 ? P + 1e-6 : P - 1e-6), 0, 4)
        let v = dir > 0 ? SPEED[ph] * mult : 1.4
        if (Math.abs(goal - P) > 1.6 && mult === 1) v *= 1.7
        P += dir * Math.min(Math.abs(goal - P), v * dt)
        if (Math.abs(goal - P) < 1e-6) P = goal
      }
      if (playing && P >= 4.999) {
        playing = false
        playBtn.textContent = '↻ 重播'
      }
      if (mult !== 1 && P === goal) mult = 1
      if (++frameNo % 45 === 0) measure()
      labelK = clamp(camera.position.distanceTo(ctx.controls.target) / 11, 0.9, 2.0)
      const st = derive()
      updateHelix(t, st, dt)
      updatePoly(t, st)
      updateMRNA(t, st, dt)
      updateTranslation(t, st, dt)
      updateLabels(st)
      refreshStrip(st)
      updateHud(st)
      updateCamera(dt)
      dust.rotation.y = t * 0.01 * ctx.motion
      glowA.material.opacity = 0.13 + 0.03 * Math.sin(t * 0.7 * ctx.motion)
    },
    onStep(i) {
      mult = 1
      playing = false
      playBtn.textContent = '▶ 自動播放'
      if (i <= 5) {
        mutView = false
        goal = i
        lastSeg = -1
      } else {
        enterMut()
      }
    },
    debug: {
      setP(p) {
        P = goal = p
        mult = 1
        playing = false
      },
      mutView(v) {
        mutView = v
      },
      demo,
      reset: resetSeq,
      select,
      applyBase,
      getP: () => P,
    },
    onResize() {
      camKey = ''
      measure()
    },
    onResetView() {
      camKey = ''
      camPreset = null
    },
    dispose() {
      offPtr && offPtr()
    },
  }
}
