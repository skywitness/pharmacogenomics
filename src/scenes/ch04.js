// ch04「一顆藥的旅程」：半透明全息人體 + 粒子藥物沿血管旅行（吸收 → 分布 → 代謝 → 排除）+ 濃度—時間曲線與治療窗。
// 全部是教學示意：數值來自 ch04/pk.js 的一室模型（非任何真實藥物），畫面上一律標「示意」。
// 事實來源：research/pk-pd-enzymes.verified.json（PK/PD 定義 #01、首渡效應 #05、半衰期 #04）。
import { buildAnatomy } from './ch04/anatomy.js'
import * as PK from './ch04/pk.js'

export const options = {
  fov: 40,
  camera: [0, 1.4, 14],
  target: [0, 1.2, 0],
  zoom: false,
  minAzimuthAngle: -1.2,
  maxAzimuthAngle: 1.2,
  minPolarAngle: 0.85,
  maxPolarAngle: 2.1,
  exposure: 1.05,
  envIntensity: 0.5,
}

// ───────── 時間軸 ─────────
// clk = 動畫秒數；tau = 示意的「小時」。前 1 小時（藥丸吞下、崩解、排空、開始吸收）刻意放慢：6 秒 = 1 小時。
const CLK_SLOW = 6
const CLK_END = 46
const tauOf = (c) => (c < CLK_SLOW ? c / CLK_SLOW : 1 + ((c - CLK_SLOW) * (PK.T_END - 1)) / (CLK_END - CLK_SLOW))

const N_ORAL = 150
const N_IV = Math.round(N_ORAL * (1 - PK.model(1, 'oral').E))
const MAXP = 190
const D_CHART = 8

// ───────── 步驟設定 ─────────
// focus: [x,y,z，半高，半寬（省略=半高）];from/to：此步驟循環播放的動畫秒數區間；labels：顯示哪些器官標籤
// tgt：是否顯示「作用標的」的光（只在說明到它的步驟出現，避免出現在沒有交代的畫面上）
const STEPS = [
  { focus: [0.05, 1.3, 0, 2.5, 1.85], from: 0, to: CLK_END, labels: ['target'], chart: 1, tgt: 1 },
  { focus: [0.0, 0.95, 0.05, 1.55], from: 2.6, to: 16, labels: ['stomach', 'smallInt'], on: { stomach: 1, smallInt: 1 }, dim: true, chart: 1, oral: true },
  { focus: [0.2, 1.5, 0, 2.5], from: 9, to: 34, labels: ['heart', 'target'], on: { heart: 1 }, dim: true, chart: 1, ring: ['target'], tgt: 1 },
  { focus: [-0.3, 1.15, 0, 1.4], from: 6.4, to: 22, labels: ['liver', 'portal'], on: { liver: 1, smallInt: 0.6 }, dim: true, chart: 1, oral: true },
  { focus: [0.0, 0.2, -0.05, 1.85], from: 20, to: CLK_END, labels: ['kidney', 'bladder'], on: { kidneyL: 1, kidneyR: 1, bladder: 1 }, dim: true, chart: 1 },
  { focus: [0.05, 1.3, 0, 2.5, 1.85], from: 0, to: CLK_END, labels: [], chart: 1.3, hot: true, tgt: 1 },
  { focus: [0.05, 1.3, 0, 2.5, 1.85], from: 12, to: CLK_END, labels: ['g1', 'g2', 'g3'], chart: 1.05, ring: ['g1', 'g2', 'g3'], ghost: true, tgt: 1 },
]

const CAPTIONS = [
  '示意動畫：口服藥依序經過吸收、分布、代謝、排除。指到器官可看說明。',
  '吸收：藥丸在胃裡崩解，顆粒穿過小腸壁進入血液（前 1 小時刻意放慢）。',
  '分布：心臟把含藥的血液送往全身；標的組織的光色代表濃度（綠色=在治療窗內）。',
  '代謝：腸道吸收的血液先經門靜脈到肝臟，部分藥物被改造成灰色的無活性代謝物（首渡效應）。',
  '排除：代謝物與（在這個示意藥物中占少數的）原型藥物經腎臟進入膀胱，隨尿排出；真實藥物的比例各不相同。',
  '濃度—時間曲線：上升、峰值、下降；綠帶是治療窗。拉動「肝臟代謝速率」試試。',
  '基因可能改變旅程的三個地方：代謝酵素、轉運蛋白、作用標的。滑桿只是示意，不是特定基因型。',
]
// 靜脈點滴路徑下與口服不同的說明（沒列出的步驟兩種路徑通用；步驟 1、3 需要口服，會自動切回口服）
const CAPTIONS_IV = {
  0: '示意動畫：靜脈點滴把藥直接送進血液，略過吸收與首渡代謝，再經分布、代謝、排除。指到器官可看說明。',
  5: '濃度—時間曲線：靜脈給藥上升較快、峰值較早出現。（示意的靜脈劑量設為口服實際進入血液的量，方便比較。）',
}

const ORGAN_INFO = {
  stomach: ['胃', '藥丸在這裡崩解成小顆粒。胃排空的快慢，會影響藥物開始被吸收的時間。'],
  smallInt: ['小腸', '口服藥主要在這裡穿過腸壁、進入血液。腸壁上也有酵素與轉運蛋白。'],
  colon: ['大腸', '沒有被吸收的部分繼續往下走，最後隨糞便排出。'],
  liver: ['肝臟', '腸道吸收的血液先經門靜脈流到肝臟。口服藥第一次經過時，一部分就被酵素改造掉，稱為「首渡效應」；之後每次流經肝臟，也會繼續被清除。'],
  heart: ['心臟', '把含藥的血液打送到全身，藥物因此被「分布」到各組織。'],
  kidneyL: ['腎臟', '從血液中把藥物與代謝物送進尿液。'],
  kidneyR: ['腎臟', '從血液中把藥物與代謝物送進尿液。'],
  bladder: ['膀胱', '暫存尿液；藥物與代謝物之後由此經尿道排出（顏色與大小會隨累積量變化）。'],
  target: ['作用標的組織（示意）', '藥物在這裡與受體或酵素結合而產生療效（藥效學）。光色：藍灰=濃度太低、綠=在治療窗內、紅=太高。'],
}

const hexRGB = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]

export default function create(ctx) {
  const { THREE, util, palette, scene, camera, controls, ui, hud } = ctx
  const C = palette.COLORS
  const V3 = THREE.Vector3
  const A = buildAnatomy(ctx)
  scene.add(A.root)
  util.addStudioLights(scene, { intensity: 0.9 })
  scene.add(camera) // 圖表貼在相機上，固定在畫面一角

  // 背景光暈與底座
  const halo = util.makeGlow(C.cyan, 11, 0.1)
  halo.position.set(0, 1.4, -2)
  scene.add(halo)
  const baseRings = new THREE.Group()
  for (const [r, o] of [[1.5, 0.35], [2.05, 0.2], [2.6, 0.1]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.02, r, 96), new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false }))
    ring.rotation.x = -Math.PI / 2
    baseRings.add(ring)
  }
  baseRings.position.set(0, -1.32, 0)
  scene.add(baseRings)

  // ───────── 藥丸 ─────────
  const pill = util.createPill({ length: 0.44, radius: 0.11, colorA: C.drug, colorB: 0xf4f7ff })
  const pillGlow = util.makeGlow(C.drug, 0.55, 0.4)
  pill.add(pillGlow)
  pill.traverse((o) => {
    o.renderOrder = 9
    if (o.material) o.material.depthTest = false
  })
  pill.userData.base = 1.7
  A.root.add(pill)
  const pillCurve = new THREE.CatmullRomCurve3([new V3(0.1, 3.45, 1.2), new V3(0.03, 3.25, 0.85), A.P.mouth.clone(), ...A.esoCurve.getPoints(10), A.P.stomach.clone().add(new V3(-0.04, 0.03, 0.1))], false, 'centripetal')
  // 藥丸在嘴邊停一下（曲線上最接近嘴的位置），再滑進食道
  const U_MOUTH = (() => {
    let best = 0
    let bd = 1e9
    for (let i = 0; i <= 200; i++) {
      const d = pillCurve.getPointAt(i / 200).distanceTo(A.P.mouth)
      if (d < bd) {
        bd = d
        best = i / 200
      }
    }
    return best
  })()
  const pillQ = new THREE.Quaternion()
  const X_AXIS = new V3(1, 0, 0)

  // ───────── 粒子（一個 Points，自訂 shader 畫出發光圓點）─────────
  const pos = new Float32Array(MAXP * 3)
  const colA = new Float32Array(MAXP * 3)
  const sizA = new Float32Array(MAXP)
  const alpA = new Float32Array(MAXP)
  const grayA = new Float32Array(MAXP)
  const pgeo = new THREE.BufferGeometry()
  pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  pgeo.setAttribute('aColor', new THREE.BufferAttribute(colA, 3))
  pgeo.setAttribute('aSize', new THREE.BufferAttribute(sizA, 1))
  pgeo.setAttribute('aAlpha', new THREE.BufferAttribute(alpA, 1))
  pgeo.setAttribute('aGray', new THREE.BufferAttribute(grayA, 1))
  // 藥物分子（橘色）用加色混合畫出發光圓點；已代謝（灰色）改用一般混合 + 深色描邊，才不會在亮色器官上糊成白點。
  const pVert = /* glsl */ `
      attribute vec3 aColor; attribute float aSize; attribute float aAlpha; attribute float aGray; uniform float uScale;
      varying vec3 vC; varying float vA; varying float vG;
      void main(){
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aSize * uScale / max(0.1, -mv.z);
        vC = aColor; vA = aAlpha; vG = aGray;
      }`
  const pmat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 300 } },
    vertexShader: pVert,
    fragmentShader: /* glsl */ `
      varying vec3 vC; varying float vA; varying float vG;
      void main(){
        if (vG > 0.5) discard;
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float core = smoothstep(0.5, 0.0, d);
        float halo = smoothstep(1.0, 0.0, d);
        vec3 c = vC * (0.55 + 0.8 * halo) + vec3(1.0) * core * 0.3;
        gl_FragColor = vec4(c, vA * (0.3 + 0.7 * halo));
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const gmat = new THREE.ShaderMaterial({
    uniforms: pmat.uniforms,
    vertexShader: pVert,
    fragmentShader: /* glsl */ `
      varying vec3 vC; varying float vA; varying float vG;
      void main(){
        if (vG < 0.5) discard;
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        float edge = smoothstep(1.0, 0.86, d);
        float ring = smoothstep(0.58, 0.74, d);
        vec3 c = mix(vC, vec3(0.04, 0.06, 0.15), ring);
        gl_FragColor = vec4(c, vA * edge);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NormalBlending,
  })
  const points = new THREE.Points(pgeo, pmat)
  points.frustumCulled = false
  points.renderOrder = 8
  A.root.add(points)
  const pointsG = new THREE.Points(pgeo, gmat)
  pointsG.frustumCulled = false
  pointsG.renderOrder = 9
  A.root.add(pointsG)

  const DRUG = hexRGB(C.drug)
  const GRAY_HEX = 0xb4bfe0
  const GRAY = hexRGB(GRAY_HEX)
  const parts = Array.from({ length: MAXP }, () => ({ on: false }))

  // ───────── 圖表（貼在相機上）─────────
  const chart = util.createChartPlane({ width: 1.6, height: 1.0, px: 640, bg: 'rgba(8,13,30,0.88)' })
  chart.mesh.material.toneMapped = false
  chart.mesh.material.depthTest = false
  chart.mesh.renderOrder = 50
  const chartGroup = new THREE.Group()
  chartGroup.add(chart.mesh)
  camera.add(chartGroup)

  // ───────── 標籤與光環 ─────────
  // LABELS[key] = [文字，標籤位置，指向的器官位置（引線終點），選項]
  const P = A.P
  const v3 = (x, y, z = 0.3) => new V3(x, y, z)
  const cssHex = (n) => palette.hex(n)
  const LABELS = {
    swallow: ['吞下', v3(0.95, 3.3, 0.5), v3(0.2, 3.08, 0.46)],
    stomach: ['胃', v3(1.2, 0.98), v3(0.8, 1.1, 0.3)],
    smallInt: ['小腸（吸收）', v3(1.4, 0.02), v3(0.5, -0.01, 0.1)],
    portal: ['門靜脈', v3(-1.05, 0.78), v3(-0.12, 0.8, 0.02)],
    liver: ['肝臟', v3(-1.25, 1.78), v3(-0.72, 1.45, 0.3)],
    heart: ['心臟', v3(-0.95, 2.4), v3(-0.02, 2.0, 0.3)],
    kidney: ['腎臟', v3(1.4, 0.62), v3(0.84, 0.55, 0.0)],
    bladder: ['膀胱', v3(1.15, -0.92), v3(0.26, -0.98, 0.2)],
    target: ['作用標的（示意）', v3(1.75, 2.05), v3(1.27, 1.55, 0.3)],
    g1: ['① 代謝酵素\n(PK)', v3(-1.4, 1.95), v3(-0.75, 1.4, 0.3), { border: cssHex(C.enzyme), two: true }],
    g2: ['② 轉運蛋白\n(PK)', v3(1.45, 0.05), v3(0.55, 0.16, 0.2), { border: cssHex(C.cyan), two: true }],
    g3: ['③ 作用標的\n(PD)', v3(1.75, 2.1), v3(1.3, 1.6, 0.3), { border: cssHex(C.green), two: true }],
  }
  const labels = {}
  const labelList = []
  const leaderMat = new THREE.LineBasicMaterial({ color: 0xdfe8ff, transparent: true, opacity: 0, depthTest: false, depthWrite: false })
  for (const [k, [text, at, anchor, opt = {}]] of Object.entries(LABELS)) {
    const s = util.makeLabel(text, { fontSize: 40, worldHeight: opt.two ? 0.56 : 0.34, color: '#ffffff', ...(opt.border ? { border: opt.border } : {}) })
    s.material.opacity = 0
    s.visible = false
    s.position.copy(at)
    s.userData.base = s.scale.clone()
    s.userData.want = 0
    s.userData.at = at
    s.userData.anchor = anchor
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
    const line = new THREE.Line(lineGeo, leaderMat.clone())
    line.frustumCulled = false
    line.renderOrder = 998
    line.visible = false
    s.userData.line = line
    const dot = util.makeGlow(0xffffff, 0.2, 0)
    dot.renderOrder = 998
    dot.material.depthTest = false
    dot.position.copy(anchor)
    dot.visible = false
    s.userData.dot = dot
    A.root.add(s, line, dot)
    labels[k] = s
    labelList.push(s)
  }
  leaderMat.dispose()
  // g1~g3 的環：半透明實心邊（一般混合），顏色與標籤外框一致
  const ringDefs = {
    target: [C.green, () => P.target, 1.5],
    g1: [C.enzyme, () => P.liver, 1.6],
    g2: [C.cyan, () => v3(0.4, 0.17, 0.1), 1.3],
    g3: [C.green, () => P.target, 1.5],
  }
  const rings = {}
  const ringList = []
  for (const [k, [col, at, size]] of Object.entries(ringDefs)) {
    const r = A.makeRing(col, size)
    r.position.copy(at())
    r.userData.size = size
    r.userData.want = 0
    r.visible = false
    rings[k] = r
    ringList.push(r)
  }

  // ───────── 狀態 ─────────
  const S = { alert: 0, bodyGlow: 0, targetShow: 1, portalHl: 0, focus: {}, dimOthers: false, liverPulse: 0, kidPulse: 0, bladder: 0, targetLevel: 0, zone: 'low' }
  const FOCUS_KEYS = ['stomach', 'liver', 'heart', 'kidneyR', 'kidneyL', 'bladder', 'smallInt', 'colon']
  const setFocus = (obj) => {
    S.focus = {}
    for (const k of FOCUS_KEYS) S.focus[k] = (obj && obj[k]) || 0
  }
  setFocus(null)

  let route = 'oral'
  let rv = 1 // 肝臟代謝速率（相對）
  let speed = 1
  let playing = !ctx.reducedMotion // 偏好減少動態的使用者：預設暫停在有內容的畫面，可自行按播放
  let step = 0
  let M = PK.model(rv, route)
  let Mb = PK.model(1, route)
  let clk = 0
  let tau = 0
  let rand = util.rng(11)
  let absorbed = 0
  let ivEmitted = 0
  let eliminated = 0
  let hold = 0
  let hover = null
  let capOverride = 0
  let restartIn = -1
  const gutList = []

  // 血管 leg 快取
  const legOf = (route, j) => A.routes[route].legs[j]
  const branchLegs = A.branches.map((b) => ({ curve: b.bez, len: b.bez.getLength() }))
  const portalLeg = { curve: A.portalCurve, len: A.portalCurve.getLength() }
  const ivLeg = { curve: A.ivCurve, len: A.ivCurve.getLength() }
  const liverB = legOf(A.R.liverPass, 1)
  const liverA = legOf(A.R.killLiver, 0)
  const kid = [
    [legOf(A.R.killKidL, 0), legOf(A.R.killKidL, 1)],
    [legOf(A.R.killKidR, 0), legOf(A.R.killKidR, 1)],
  ]
  const smallStart = A.smallCurve.getPointAt(0)
  const tmp = new V3()
  const tmp2 = new V3()

  function alloc() {
    for (const p of parts) if (!p.on) return p
    return null
  }
  function init(p, mode) {
    Object.assign(p, { on: true, mode, stage: '', x: 0, y: 0, z: 0, ox: 0, oy: 0, oz: 0, offK: 0, col: DRUG, sz: 0.14, a: 0.95, legs: null, li: 0, s: 0, v: 2.4, dwell: 0, dreason: '', gray: false, tin: -1, life: 0, k: 0, s0: 0, ph: rand() * 6.28, ts: 0, u: 0, side: 0, gx: 0, gy: 0, gz: 0 })
    return p
  }
  function go(p, legs, stage, v) {
    p.mode = 'legs'
    p.legs = legs
    p.li = 0
    p.s = 0
    p.stage = stage
    p.v = v || 2.2 + rand() * 0.7
  }
  const setGray = (p) => {
    p.gray = true
    p.col = GRAY
    p.sz = 0.17
  }

  function stomachPoint(p) {
    // 在（旋轉過的）胃橢球內隨機取點
    let x, y, z
    do {
      x = rand() * 2 - 1
      y = rand() * 2 - 1
      z = rand() * 2 - 1
    } while (x * x + y * y + z * z > 1)
    const R = A.stomachR
    const lx = x * R[0] * 0.72
    const ly = y * R[1] * 0.72
    const c = Math.cos(A.stomachRot)
    const s = Math.sin(A.stomachRot)
    p.gx = P.stomach.x + lx * c - ly * s
    p.gy = P.stomach.y + lx * s + ly * c
    p.gz = P.stomach.z + z * R[2] * 0.6 + 0.04
  }

  function toHeart(p) {
    if (p.tin < 0) p.tin = tau
    if (p.gray) {
      goKidney(p)
      return
    }
    if (tau - p.tin > p.life) {
      if (rand() < M.fH) go(p, [liverA], 'killL', 2.6)
      else goKidney(p)
      return
    }
    // 依血流比例挑一條組織路線
    let r = rand()
    let pick = A.tissueRoutes[A.tissueRoutes.length - 1][0]
    for (const [idx, w] of A.tissueRoutes) {
      if (r < w) {
        pick = idx
        break
      }
      r -= w
    }
    go(p, A.routes[pick].legs, 'loop', 2.6 + rand() * 0.6)
  }
  function goKidney(p) {
    p.side = rand() < 0.5 ? 0 : 1
    go(p, [kid[p.side][0]], 'killK', 2.6)
  }

  function endOfLegs(p) {
    switch (p.stage) {
      case 'portal':
        if (rand() < M.E) {
          p.dwell = 0.5
          p.dreason = 'metab'
        } else go(p, [liverB], 'exitLiver', 2.4)
        break
      case 'killL':
        p.dwell = 0.5
        p.dreason = 'metab'
        break
      case 'exitLiver':
      case 'iv':
      case 'loop':
        toHeart(p)
        break
      case 'killK':
        p.dwell = 0.4
        p.dreason = 'filt'
        break
      case 'toBladder':
        p.mode = 'done'
        eliminated++
        break
      default:
        p.mode = 'done'
    }
  }
  function afterDwell(p) {
    if (p.dreason === 'metab') {
      setGray(p)
      S.liverPulse = Math.min(1, S.liverPulse + 0.45)
      go(p, [liverB], 'exitLiver', 2.4)
    } else {
      S.kidPulse = Math.min(1, S.kidPulse + 0.3)
      go(p, [kid[p.side][1]], 'toBladder', 2.0)
    }
  }

  function absorbOne() {
    const gi = Math.floor(rand() * gutList.length)
    const p = gutList[gi]
    gutList[gi] = gutList[gutList.length - 1]
    gutList.pop()
    const bl = branchLegs[p.k]
    bl.curve.getPointAt(0, tmp)
    p.ox = p.x - tmp.x
    p.oy = p.y - tmp.y
    p.oz = p.z - tmp.z
    p.offK = 1
    p.sz = 0.14
    p.life = PK.expQ(rand(), M.ke)
    go(p, [bl, portalLeg], 'portal', 1.6)
  }
  function spawnIV() {
    const p = alloc()
    if (!p) return
    init(p, 'legs')
    p.life = PK.expQ(rand(), M.ke)
    go(p, [ivLeg], 'iv', 2.2 + rand() * 0.5)
  }

  function updateParticle(p, d) {
    if (p.mode === 'stomach') {
      const rev = util.smoothstep(3.0, 4.2, clk)
      p.a = rev * 0.42
      p.sz = 0.085
      p.x = p.gx + Math.sin(clk * 2.1 + p.ph) * 0.03
      p.y = p.gy + Math.cos(clk * 1.7 + p.ph) * 0.03
      p.z = p.gz
      if (clk > p.ts) {
        p.mode = 'transit'
        p.u = 0
      }
    } else if (p.mode === 'transit') {
      p.u = Math.min(1, p.u + d / 1.3)
      const u = p.u
      if (u < 0.25) {
        const t = u / 0.25
        p.x = util.lerp(p.gx, smallStart.x, t)
        p.y = util.lerp(p.gy, smallStart.y, t)
        p.z = util.lerp(p.gz, smallStart.z, t)
      } else {
        A.smallCurve.getPointAt(((u - 0.25) / 0.75) * p.s0, tmp)
        p.x = tmp.x
        p.y = tmp.y
        p.z = tmp.z
      }
      if (u >= 1) {
        A.smallCurve.getPointAt(p.s0, tmp)
        p.gx = tmp.x + (rand() - 0.5) * 0.05
        p.gy = tmp.y + (rand() - 0.5) * 0.05
        p.gz = tmp.z + (rand() - 0.5) * 0.05
        p.mode = 'gut'
        p.sz = 0.11
        gutList.push(p)
      }
    } else if (p.mode === 'gut') {
      p.x = p.gx + Math.sin(clk * 1.6 + p.ph) * 0.025
      p.y = p.gy + Math.cos(clk * 1.9 + p.ph) * 0.025
      p.z = p.gz
    } else if (p.mode === 'legs') {
      if (p.dwell > 0) {
        p.dwell -= d
        p.x += Math.sin(clk * 30 + p.ph) * 0.004
        p.y += Math.cos(clk * 27 + p.ph) * 0.004
        if (p.dwell <= 0) afterDwell(p)
        return
      }
      const leg = p.legs[p.li]
      p.s += p.v * d
      let u = p.s / leg.len
      if (u >= 1) {
        leg.curve.getPointAt(1, tmp)
        p.x = tmp.x
        p.y = tmp.y
        p.z = tmp.z
        if (p.li < p.legs.length - 1) {
          p.s -= leg.len
          p.li++
        } else endOfLegs(p)
        return
      }
      leg.curve.getPointAt(u, tmp)
      p.offK = Math.max(0, p.offK - d * 1.4)
      p.x = tmp.x + p.ox * p.offK
      p.y = tmp.y + p.oy * p.offK
      p.z = tmp.z + p.oz * p.offK
    } else if (p.mode === 'done') {
      p.a -= d * 2.5
      if (p.a <= 0) p.on = false
    }
  }

  function reset() {
    rand = util.rng(11)
    M = PK.model(rv, route)
    Mb = PK.model(1, route)
    for (const p of parts) p.on = false
    gutList.length = 0
    clk = 0
    tau = 0
    absorbed = 0
    ivEmitted = 0
    eliminated = 0
    hold = 0
    S.liverPulse = 0
    S.kidPulse = 0
    S.bladder = 0
    A.ivGroup.visible = route === 'iv'
    pill.visible = route === 'oral'
    pill.scale.setScalar(pill.userData.base)
    if (route === 'oral') {
      for (let i = 0; i < N_ORAL; i++) {
        const p = init(alloc(), 'stomach')
        p.a = 0
        p.k = i % A.NB
        p.s0 = util.clamp(A.branchS[p.k] + (rand() - 0.5) * 0.07, 0.06, 0.94)
        p.ts = 4.2 + rand() * 0.7
        stomachPoint(p)
      }
    }
    updateState()
  }

  function updatePill() {
    if (route !== 'oral') return
    if (clk >= 4.0) {
      pill.visible = false
      return
    }
    pill.visible = true
    // 0–0.7 s：從嘴前滑到嘴；0.7–1.6 s：停在嘴邊（顯示「吞下」）；之後沿食道滑進胃
    let u
    if (clk < 0.7) u = U_MOUTH * util.easeInOut(clk / 0.7)
    else if (clk < 1.6) u = U_MOUTH
    else u = U_MOUTH + (1 - U_MOUTH) * util.easeInOut(util.clamp((clk - 1.6) / 1.5, 0, 1))
    pillCurve.getPointAt(u, tmp)
    pill.position.copy(tmp)
    pillCurve.getTangentAt(Math.min(0.999, u + 0.001), tmp2)
    pillQ.setFromUnitVectors(X_AXIS, tmp2.normalize())
    pill.quaternion.copy(pillQ)
    pill.scale.setScalar(pill.userData.base * (clk < 3.1 ? 1 : 1 - util.smoothstep(3.1, 4.0, clk)))
    pillGlow.material.opacity = 0.32 + 0.1 * Math.sin(clk * 6)
  }

  function updateState() {
    const conc = M.conc(tau)
    S.targetLevel = Math.min(1.4, conc / PK.WIN_HI)
    S.zone = PK.zone(conc)
    S.alert = S.zone === 'high' ? 0.85 : 0
    S.bladder = util.clamp(eliminated / (N_ORAL * 0.55), 0, 1)
    S.conc = conc
  }

  function advance(d) {
    clk += d
    if (clk > CLK_END) clk = CLK_END
    tau = tauOf(clk)
    updatePill()
    if (route === 'oral') {
      if (tau > PK.LAG) {
        const target = Math.floor(N_ORAL * (1 - Math.exp(-PK.KA * (tau - PK.LAG))))
        while (absorbed < target && gutList.length) {
          absorbOne()
          absorbed++
        }
      }
    } else {
      const target = Math.floor(N_IV * (1 - Math.exp(-PK.KIV * tau)))
      while (ivEmitted < target) {
        spawnIV()
        ivEmitted++
      }
      const f = 1 - ivEmitted / N_IV
      const fluid = A.ivGroup.children[1]
      if (fluid) {
        fluid.scale.y = Math.max(0.04, f)
        fluid.position.y = 1.34 + 0.26 * Math.max(0.04, f)
      }
    }
    for (const p of parts) if (p.on) updateParticle(p, d)
    S.liverPulse = Math.max(0, S.liverPulse - d * 1.4)
    S.kidPulse = Math.max(0, S.kidPulse - d * 1.4)
    updateState()
  }

  function seek(c) {
    reset()
    while (clk < c - 1e-6) advance(Math.min(0.2, c - clk))
    chartDirty = true
    lastChartTau = -1
  }

  // ───────── 圖表繪製 ─────────
  let chartDirty = true
  let lastChartTau = -1
  let fk = 1 // 圖表字級倍率：圖表在小螢幕上顯示得很小，文字要放大才讀得到
  const css = (n, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`
  const FONT = util.FONT_STACK
  const ZONE_COL = { low: 0x8fa8dc, ok: C.green, high: C.red }

  function drawCurve(g, X, Y, m, t0, t1, n = 120) {
    g.beginPath()
    for (let i = 0; i <= n; i++) {
      const t = t0 + ((t1 - t0) * i) / n
      const x = X(t)
      const y = Y(m.conc(t))
      if (i === 0) g.moveTo(x, y)
      else g.lineTo(x, y)
    }
    g.stroke()
  }
  function drawChart(g, W, H) {
    const px = (n) => Math.round(n * fk)
    const L = 40
    const R = 16
    const T = px(34) + 24
    const B = px(30) + 22
    const pw = W - L - R
    const ph = H - T - B
    const X = (t) => L + (t / PK.T_END) * pw
    const Y = (c) => T + ph * (1 - Math.min(c, PK.Y_MAX) / PK.Y_MAX)
    // 區帶
    g.fillStyle = 'rgba(255,92,92,0.16)'
    g.fillRect(L, T, pw, Y(PK.WIN_HI) - T)
    g.fillStyle = 'rgba(75,227,160,0.22)'
    g.fillRect(L, Y(PK.WIN_HI), pw, Y(PK.WIN_LO) - Y(PK.WIN_HI))
    g.fillStyle = 'rgba(120,145,205,0.12)'
    g.fillRect(L, Y(PK.WIN_LO), pw, T + ph - Y(PK.WIN_LO))
    g.font = `700 ${px(28)}px ${FONT}`
    g.textBaseline = 'middle'
    g.textAlign = 'left'
    g.fillStyle = 'rgba(255,140,140,0.95)'
    g.fillText('太高', L + 10, (T + Y(PK.WIN_HI)) / 2 + 2)
    g.fillStyle = 'rgba(110,240,180,0.98)'
    g.fillText('治療窗', L + 10, (Y(PK.WIN_HI) + Y(PK.WIN_LO)) / 2)
    g.textAlign = 'right'
    g.fillStyle = 'rgba(160,180,230,0.95)'
    g.fillText('太低', L + pw - 8, Y(0.26))
    // 座標軸
    g.strokeStyle = 'rgba(200,215,255,0.55)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(L, T)
    g.lineTo(L, T + ph)
    g.lineTo(L + pw, T + ph)
    g.stroke()
    g.fillStyle = 'rgba(200,215,255,0.9)'
    g.font = `600 ${px(26)}px ${FONT}`
    g.textAlign = 'center'
    const rowY = T + ph + 10 + px(14)
    for (const t of [0, 4, 8, 12]) {
      if (t < 12) g.fillText(String(t), X(t), rowY)
      g.beginPath()
      g.moveTo(X(t), T + ph)
      g.lineTo(X(t), T + ph + 7)
      g.stroke()
    }
    g.textAlign = 'right'
    g.fillText('12 小時', W - 2, rowY)
    g.textAlign = 'left'
    g.fillStyle = 'rgba(232,236,248,0.95)'
    g.font = `700 ${px(28)}px ${FONT}`
    g.fillText('血中濃度—時間（示意）', L, T / 2 - 2)

    const st = STEPS[step]
    g.lineJoin = 'round'
    // 對照曲線：名稱寫在右上方的紅色帶（那裡沒有任何曲線），前面附一小段同色線
    if (st.ghost) {
      g.lineWidth = 3
      g.strokeStyle = css(C.PM, 0.75)
      drawCurve(g, X, Y, PK.model(0.5, route), 0, PK.T_END)
      g.strokeStyle = css(C.UM, 0.8)
      drawCurve(g, X, Y, PK.model(2, route), 0, PK.T_END)
      g.font = `700 ${px(22)}px ${FONT}`
      g.textAlign = 'right'
      g.textBaseline = 'middle'
      const lh = px(28)
      const entries = [
        ['酵素慢（50%）', C.PM, T + lh * 0.75],
        ['酵素快（200%）', C.UM, T + lh * 1.75],
      ]
      for (const [txt, col, yy] of entries) {
        const xr = W - R - 8
        const tw = g.measureText(txt).width
        g.fillStyle = css(col, 1)
        g.fillText(txt, xr, yy)
        g.strokeStyle = css(col, 0.95)
        g.lineWidth = 4
        g.beginPath()
        g.moveTo(xr - tw - 42, yy)
        g.lineTo(xr - tw - 8, yy)
        g.stroke()
      }
    }
    if (Math.abs(rv - 1) > 0.01) {
      g.setLineDash([9, 8])
      g.lineWidth = 3
      g.strokeStyle = 'rgba(200,210,235,0.6)'
      drawCurve(g, X, Y, Mb, 0, PK.T_END)
      g.setLineDash([])
    }
    // 目前曲線：未來部分淡、已走過部分亮
    g.lineWidth = 4
    g.strokeStyle = css(C.drug, 0.28)
    drawCurve(g, X, Y, M, 0, PK.T_END)
    const tNow = Math.max(0.001, tau)
    // AUC 填色
    g.beginPath()
    g.moveTo(X(0), Y(0))
    for (let i = 0; i <= 100; i++) {
      const t = (tNow * i) / 100
      g.lineTo(X(t), Y(M.conc(t)))
    }
    g.lineTo(X(tNow), Y(0))
    g.closePath()
    g.fillStyle = css(C.drug, st.hot ? 0.3 : 0.16)
    g.fill()
    g.lineWidth = 6
    g.strokeStyle = css(C.drug, 1)
    drawCurve(g, X, Y, M, 0, tNow, 140)
    // Cmax 標記（標籤寫在峰值的右上方，避開游標與區帶名稱）
    if (tau > M.tmax + 0.05 || st.hot) {
      const mx = X(M.tmax)
      const my = Y(M.cmax)
      if (tau > M.tmax) {
        g.fillStyle = 'rgba(255,255,255,0.9)'
        g.beginPath()
        g.arc(mx, my, 6, 0, 6.29)
        g.fill()
        g.font = `700 ${px(22)}px ${FONT}`
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        g.fillText('峰值', mx + 12, my - px(14))
      }
    }
    // 游標
    const cy = Y(M.conc(tNow))
    const cx = X(tNow)
    g.strokeStyle = 'rgba(255,255,255,0.35)'
    g.lineWidth = 2
    g.setLineDash([4, 6])
    g.beginPath()
    g.moveTo(cx, T)
    g.lineTo(cx, T + ph)
    g.stroke()
    g.setLineDash([])
    g.fillStyle = css(ZONE_COL[S.zone], 0.35)
    g.beginPath()
    g.arc(cx, cy, 17, 0, 6.29)
    g.fill()
    g.fillStyle = css(ZONE_COL[S.zone], 1)
    g.beginPath()
    g.arc(cx, cy, 9, 0, 6.29)
    g.fill()
    g.strokeStyle = '#fff'
    g.lineWidth = 3
    g.stroke()
  }

  // ───────── 版面 / 取景 ─────────
  const safe = { l: 0, r: 0.4, t: 0.1, b: 0.26 }
  const focusCur = { c: new V3(...STEPS[0].focus.slice(0, 3)), r: STEPS[0].focus[3], rw: STEPS[0].focus[4] || STEPS[0].focus[3] }
  let chartScale = 1
  let hudBottom = 0.26
  let hudTopPx = 44
  let snap = true
  const chartRect = { x0: 0, x1: 0, y0: 0, y1: 0 } // NDC
  // 每幀都會用到的尺寸先快取起來（避免每幀讀取版面造成強制回流）；縮放、換說明時才更新
  const dims = { w: 1, h: 1, hostH: 1 }
  const refreshDims = () => {
    dims.w = ctx.view.clientWidth || 1
    dims.h = ctx.view.clientHeight || 1
    dims.hostH = ctx.size.h || dims.h
  }
  // 重複使用的暫存向量（避免每幀配置）
  const _right = new V3()
  const _up = new V3()
  const _T = new V3()
  const _yUp = new V3(0, 1, 0)
  const _cr = new V3()
  const _lp = new V3()
  const _lv = new V3()

  const legendEl = ctx.view.querySelector('.hud-legend')
  const hudTopEl = ctx.view.querySelector('.hud-top')
  let legendShown = true
  let capPx = 40
  let legendPx = 0
  function measureHud() {
    refreshDims()
    const vh = dims.h
    const wide = camera.aspect >= 1.2
    // 很矮的舞台：圖例會吃掉太多高度，先收起來（說明文字已經交代顏色的意思）
    const wantLegend = vh >= 360
    if (wantLegend !== legendShown) {
      legendShown = wantLegend
      hud.legend(wantLegend ? LEGEND_ITEMS : [])
    }
    const cap = ctx.view.querySelector('.hud-caption')
    capPx = cap && !cap.hidden ? cap.offsetHeight : 0
    hudTopPx = hudTopEl ? Math.max(44, hudTopEl.offsetHeight + 8) : 44
    if (legendEl) {
      if (wide) {
        // 寬螢幕：圖例固定在右下（圖表下方）的小直列，避免擋住人體
        Object.assign(legendEl.style, { position: 'absolute', left: 'auto', right: '10px', margin: '0', padding: '5px 9px', flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'flex-start', gap: '2px', maxWidth: '48%', fontSize: '0.72rem', lineHeight: '1.35' })
        legendEl.style.bottom = capPx + 20 + 'px'
      } else {
        // 窄螢幕：交給核心版面（圖例在說明文字上方、沉到底部），不再自己釘位置
        legendEl.removeAttribute('style')
      }
      legendPx = legendEl.hidden ? 0 : legendEl.offsetHeight
    }
    hudBottom = util.clamp((capPx + 20 + (wide ? 0 : legendPx + 6)) / vh, 0.08, 0.5)
  }

  function layoutChart(dt) {
    const aspect = camera.aspect
    const wide = aspect >= 1.2
    const want = STEPS[step].chart
    chartScale = snap ? want : util.damp(chartScale, want, 4, dt)
    const scl = wide ? chartScale : Math.min(chartScale, 1.15)
    const th = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const vh = 2 * D_CHART * th
    const vw = vh * aspect
    // 手機的舞台很窄：圖表縮到約 45% 寬，把左邊留給人體
    let cw = (wide ? 0.42 : 0.44) * scl * vw
    cw = Math.min(cw, wide ? 0.66 * vw : 0.52 * vw)
    let chh = cw / 1.6
    const viewH = dims.h
    const topFrac = util.clamp(hudTopPx / viewH, 0.1, 0.3)
    const block = wide ? (capPx + 20 + legendPx + 6) / viewH : hudBottom
    const maxH = (1 - topFrac - 0.01 - block - 0.02) * vh
    if (chh > maxH) {
      chh = maxH
      cw = chh * 1.6
    }
    // 依圖表實際顯示的寬度決定字級倍率（量化到 0.1，避免縮放動畫期間一直重畫）
    const dispW = Math.max(60, (cw / vw) * dims.w)
    const wantFk = util.clamp(Math.round(((11.5 * 640) / (dispW * 28)) * 10) / 10, 1, 1.5)
    if (wantFk !== fk) {
      fk = wantFk
      chartDirty = true
    }
    const mx = 0.02 * vw
    const topY = topFrac * vh
    const cx = vw / 2 - mx - cw / 2
    const cy = vh / 2 - topY - chh / 2
    chartGroup.position.set(cx, cy, -D_CHART)
    chartGroup.scale.setScalar(cw / 1.6)
    chartRect.x0 = (cx - cw / 2) / (vw / 2)
    chartRect.x1 = (cx + cw / 2) / (vw / 2)
    chartRect.y0 = (cy - chh / 2) / (vh / 2)
    chartRect.y1 = (cy + chh / 2) / (vh / 2)
    safe.l = 0
    safe.r = (cw + 2 * mx) / vw + 0.005
    safe.t = topFrac
    safe.b = hudBottom
  }

  function updateCamera(dt) {
    const f = STEPS[step].focus
    const k = snap ? 1 : 1 - Math.exp(-3.2 * dt)
    focusCur.c.x += (f[0] - focusCur.c.x) * k
    focusCur.c.y += (f[1] - focusCur.c.y) * k
    focusCur.c.z += (f[2] - focusCur.c.z) * k
    focusCur.r += (f[3] - focusCur.r) * k
    // 靜脈模式的點滴袋在人體左側，全身取景時要多留一點寬度
    focusCur.rw += ((f[4] ? f[4] + (route === 'iv' ? 0.5 : 0) : f[3]) - focusCur.rw) * k
    const th = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const aw = Math.max(0.2, 1 - safe.l - safe.r)
    const ah = Math.max(0.2, 1 - safe.t - safe.b)
    const dist = Math.max(focusCur.r / (ah * th), focusCur.rw / (aw * camera.aspect * th)) * 1.04
    const dir = tmp.copy(camera.position).sub(controls.target)
    if (dir.lengthSq() < 1e-6) dir.set(0, 0.1, 1)
    dir.normalize()
    const fwd = tmp2.copy(dir).negate()
    _right.crossVectors(fwd, _yUp).normalize()
    _up.crossVectors(_right, fwd).normalize()
    const visH = 2 * dist * th
    const visW = visH * camera.aspect
    const cxn = safe.l - safe.r
    const cyn = safe.b - safe.t
    _T.copy(focusCur.c).addScaledVector(_right, -(cxn * visW) / 2).addScaledVector(_up, -(cyn * visH) / 2)
    controls.target.copy(_T)
    camera.position.copy(_T).addScaledVector(dir, dist)
    camera.updateMatrixWorld()
  }

  // ───────── 步驟 ─────────
  // 減少動態時停在「畫面上有東西」的時間點
  const startClk = (st) => (ctx.reducedMotion ? Math.min(st.to - 1, Math.max(st.from, 16)) : st.from)
  const capFor = (i) => (route === 'iv' && CAPTIONS_IV[i]) || CAPTIONS[i]
  let userRoute = 'oral' // 使用者自己選的給藥途徑（步驟 1、3 需要口服時會暫時切換，之後還原）
  function applyStep(i, prev) {
    step = util.clamp(i, 0, STEPS.length - 1)
    const st = STEPS[step]
    setFocus(st.on)
    S.dimOthers = !!st.dim
    S.targetShow = st.tgt ? 1 : 0
    S.portalHl = st.labels.includes('portal') ? 1 : 0
    let forced = false
    if (st.oral && route !== 'oral') {
      route = 'oral'
      routeSeg.set('oral')
      forced = true
    } else if (!st.oral && route !== userRoute) {
      route = userRoute
      routeSeg.set(userRoute)
    }
    for (const [k, l] of Object.entries(labels)) if (k !== 'swallow') l.userData.want = st.labels.includes(k) ? 1 : 0
    for (const [k, r] of Object.entries(rings)) r.userData.want = st.ring && st.ring.includes(k) ? 1 : 0
    setCaption(capFor(step))
    capOverride = 0
    if (forced) {
      setCaption('這一步要看的是口服藥的吸收與首渡效應，已自動切換為口服；往下捲動可再選靜脈點滴。')
      capOverride = 4.5
    }
    seek(startClk(st))
    snap = prev == null
    chartDirty = true
  }

  function setCaption(text) {
    hud.caption(text)
    measureHud()
  }

  // ───────── 控制項 ─────────
  const routeSeg = ui.segmented({
    label: '給藥途徑',
    options: [
      { value: 'oral', label: '口服（吞下去）' },
      { value: 'iv', label: '靜脈點滴' },
    ],
    value: 'oral',
    onChange: (v) => {
      route = v
      userRoute = v
      seek(startClk(STEPS[step]))
      setCaption(capFor(step))
      capOverride = 0
      updateReadouts()
    },
  })
  const speedSeg = ui.segmented({
    label: '播放速度',
    options: [
      { value: 0.5, label: '0.5×' },
      { value: 1, label: '1×' },
      { value: 2, label: '2×' },
    ],
    value: 1,
    onChange: (v) => {
      speed = v
    },
  })
  const liverSlider = ui.slider({
    label: '肝臟代謝速率（示意）',
    min: 0.5,
    max: 2,
    step: 0.05,
    value: 1,
    format: (v) => `${Math.round(v * 100)}%`,
    hint: '100% 為基準；真實基因型見第 5 章。',
    onInput: (v) => {
      rv = v
      restartIn = 0.35
      M = PK.model(rv, route)
      chartDirty = true
      updateReadouts()
    },
  })
  const btns = ui.buttons([
    {
      label: ctx.reducedMotion ? '▶ 播放時間軸' : '⏸ 暫停時間軸',
      onClick: (e) => {
        playing = !playing
        e.currentTarget.textContent = playing ? '⏸ 暫停時間軸' : '▶ 播放時間軸'
        e.currentTarget.setAttribute('aria-pressed', String(!playing))
      },
    },
    {
      label: '↺ 重新開始',
      onClick: () => {
        seek(startClk(STEPS[step]))
      },
    },
  ])
  const roNow = ui.readout({ label: '目前血中濃度（示意單位）', value: '—' })
  const roRun = ui.readout({ label: '這一輪的曲線（示意）', value: '—' })
  // 讀數每 0.25 秒就會變，不能讓螢幕閱讀器一直朗讀
  for (const ro of [roNow, roRun]) {
    const v = ro.el.querySelector('.readout-value')
    if (v) v.setAttribute('aria-live', 'off')
  }

  hud.badge('示意動畫 · 非特定藥物')
  const LEGEND_ITEMS = [
    { color: C.drug, label: '藥物分子' },
    { color: GRAY_HEX, label: '已代謝（無活性）' },
    { color: C.green, label: '標的光色：綠=窗內 紅=太高' },
  ]
  hud.legend(LEGEND_ITEMS)

  const ZONE_TEXT = { low: '太低（效果可能不足）', ok: '在治療窗內', high: '太高（風險上升）' }
  const ZONE_CSS = { low: '#9fb4e6', ok: '#4be3a0', high: '#ff7a7a' }
  let roT = 0
  let lastNow = ''
  let lastRun = ''
  function updateReadouts() {
    const c = S.conc || 0
    const a = `${c.toFixed(2)} · ${ZONE_TEXT[S.zone]}`
    if (a !== lastNow) {
      lastNow = a
      roNow.set(a)
      roNow.setColor(ZONE_CSS[S.zone])
    }
    let inWin = 0
    for (let t = 0; t < PK.T_END; t += 0.1) if (PK.zone(M.conc(t)) === 'ok') inWin += 0.1
    const b = `峰值 ${M.cmax.toFixed(2)} · t½ ${M.tHalf.toFixed(1)} h · 治療窗內 ${inWin.toFixed(1)} h`
    if (b !== lastRun) {
      lastRun = b
      roRun.set(b)
    }
  }

  // ───────── 指標互動 ─────────
  function organAt() {
    const p = ctx.pointer
    if (p.x > chartRect.x0 && p.x < chartRect.x1 && p.y > chartRect.y0 && p.y < chartRect.y1) return null
    const hit = ctx.pick(A.pickables, false)[0]
    return hit ? hit.object.userData.organ : null
  }
  const offPointer = ctx.onPointer((type) => {
    if (type === 'leave' || type === 'cancel') {
      hover = null
      return
    }
    if (type === 'move' || type === 'click') {
      const k = organAt()
      hover = k
      ctx.setCursor(k ? 'pointer' : '')
      if (type === 'move' && k) {
        const [name, info] = ORGAN_INFO[k]
        hud.tip(`<strong>${name}</strong><br>${info}`)
      } else if (type === 'move') hud.tip(null)
      if (type === 'click' && k) {
        const [name, info] = ORGAN_INFO[k]
        hud.caption(`${name}：${info}`)
        measureHud()
        capOverride = 6
      }
    }
  })

  // ───────── 初始 ─────────
  ctx.setFrame(new V3(...STEPS[0].focus.slice(0, 3)), STEPS[0].focus[3], { azimuth: 0.32, elevation: 0.12 })
  reset()
  setCaption(capFor(0))
  measureHud()
  seek(ctx.reducedMotion ? startClk(STEPS[0]) : 0)

  // 標籤位置：被相機轉到畫面左右邊緣之外時，沿著畫面橫向推回來（不要被裁掉）；並更新指向器官的引線
  const labelWorld = new V3()
  function placeLabel(l, rScale) {
    const at = l.userData.at
    const anchor = l.userData.anchor
    const hw = (l.userData.base.x * rScale) / 2
    const hh = (l.userData.base.y * rScale) / 2
    labelWorld.copy(at)
    _lp.copy(at).applyMatrix4(camera.matrixWorldInverse)
    const depth = Math.max(0.5, -_lp.z)
    const th = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2)
    const ndcPerWorld = 1 / (depth * th * camera.aspect)
    _lv.copy(at).project(camera)
    const halfN = hw * ndcPerWorld
    let shiftN = 0
    if (_lv.x - halfN < -0.97) shiftN = -0.97 + halfN - _lv.x
    else if (_lv.x + halfN > 0.97) shiftN = 0.97 - halfN - _lv.x
    _cr.setFromMatrixColumn(camera.matrixWorld, 0)
    _up.setFromMatrixColumn(camera.matrixWorld, 1)
    if (shiftN !== 0) labelWorld.addScaledVector(_cr, shiftN / ndcPerWorld)
    l.position.copy(labelWorld)
    const line = l.userData.line
    const pa = line.geometry.attributes.position
    _lp.copy(anchor).sub(labelWorld)
    const dx = util.clamp(_lp.dot(_cr), -hw, hw)
    const dy = util.clamp(_lp.dot(_up), -hh, hh)
    pa.setXYZ(0, labelWorld.x + _cr.x * dx + _up.x * dy, labelWorld.y + _cr.y * dx + _up.y * dy, labelWorld.z + _cr.z * dx + _up.z * dy)
    pa.setXYZ(1, anchor.x, anchor.y, anchor.z)
    pa.needsUpdate = true
  }

  const fObj = {}
  let lastWall = performance.now()
  let frameN = 0

  return {
    update(dt, t) {
      // 暫停動畫時 Stage 傳進來的 dt 是 0：時間軸和環境動態要停住，但使用者觸發的動畫
      // （換步驟的鏡頭移動、標籤淡入、拉滑桿後重新播放）仍要照常進行，所以另外用牆上時鐘算一個 udt。
      const now = performance.now()
      const wall = Math.min(0.05, (now - lastWall) / 1000)
      lastWall = now
      const udt = dt > 0 ? dt : ctx.paused ? wall : 0
      if ((frameN++ & 31) === 0) refreshDims()

      if (restartIn >= 0) {
        restartIn -= udt
        if (restartIn < 0) {
          const st = STEPS[step]
          seek(ctx.reducedMotion ? startClk(st) : route === 'oral' ? Math.max(st.from, 5.0) : st.from)
          updateReadouts()
        }
      }
      if (capOverride > 0) {
        capOverride -= udt
        if (capOverride <= 0) setCaption(capFor(step))
      }
      const st = STEPS[step]
      if (playing && dt > 0) {
        if (clk < st.to - 1e-6) advance(Math.min(0.12, dt * speed))
        else {
          hold += dt
          if (hold > 2.4) {
            seek(st.from)
            lastChartTau = -1
          }
        }
      }
      roT -= udt
      if (roT <= 0) {
        roT = 0.25
        updateReadouts()
      }

      // 相機與版面
      layoutChart(udt)
      updateCamera(udt)
      snap = false

      // 粒子緩衝
      pmat.uniforms.uScale.value = (dims.hostH * Math.min(window.devicePixelRatio || 1, 2)) / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2))
      const sizeK = 0.5 + 0.5 * (focusCur.r / 2.5)
      for (let i = 0; i < MAXP; i++) {
        const p = parts[i]
        if (p.on) {
          pos[i * 3] = p.x
          pos[i * 3 + 1] = p.y
          pos[i * 3 + 2] = p.z
          colA[i * 3] = p.col[0]
          colA[i * 3 + 1] = p.col[1]
          colA[i * 3 + 2] = p.col[2]
          sizA[i] = p.sz * sizeK
          alpA[i] = p.a
          grayA[i] = p.gray ? 1 : 0
        } else alpA[i] = 0
      }
      pgeo.attributes.position.needsUpdate = true
      pgeo.attributes.aColor.needsUpdate = true
      pgeo.attributes.aSize.needsUpdate = true
      pgeo.attributes.aAlpha.needsUpdate = true
      pgeo.attributes.aGray.needsUpdate = true

      // 解剖與高亮
      for (const k of FOCUS_KEYS) fObj[k] = S.focus[k]
      const baseFocus = S.focus
      if (hover && fObj[hover] !== undefined) fObj[hover] = Math.max(fObj[hover], 0.7)
      S.focus = fObj
      A.update(udt, t, S)
      S.focus = baseFocus

      // 標籤與光環
      const rScale = 0.6 + 0.4 * (focusCur.r / 2.5)
      labels.swallow.userData.want = step === 0 && route === 'oral' && clk > 0.15 && clk < 2.0 ? 1 : 0
      for (const l of labelList) {
        const o = util.damp(l.material.opacity, l.userData.want, 6, udt)
        l.material.opacity = o
        l.visible = o > 0.02
        const line = l.userData.line
        line.visible = l.visible
        l.userData.dot.visible = l.visible
        l.userData.dot.material.opacity = o * 0.9
        if (l.visible) {
          l.scale.set(l.userData.base.x * rScale, l.userData.base.y * rScale, 1)
          line.material.opacity = o * 0.95
          placeLabel(l, rScale)
        }
      }
      for (const r of ringList) {
        const w = r.userData.want
        r.visible = w > 0 || r.material.opacity > 0.02
        const pulse = 1 + 0.1 * Math.sin(t * 3.2 * ctx.motion)
        r.material.opacity = util.damp(r.material.opacity, w ? 0.62 : 0, 5, udt)
        r.scale.setScalar(r.userData.size * pulse * rScale)
      }
      baseRings.rotation.y = t * 0.1 * ctx.motion

      // 圖表
      if (chartDirty || Math.abs(tau - lastChartTau) > 0.012) {
        chart.redraw(drawChart)
        lastChartTau = tau
        chartDirty = false
      }
    },
    onStep(i, prev) {
      applyStep(i, prev)
    },
    // 測試用：直接跳到某個動畫秒數並回報「血液中」的粒子數，用來核對粒子密度與曲線是否一致
    debugProbe(c) {
      seek(c)
      let n = 0
      let gray = 0
      for (const p of parts) {
        if (!p.on) continue
        if (p.gray) gray++
        else if (p.mode === 'legs' && ['loop', 'exitLiver', 'iv', 'killL', 'killK'].includes(p.stage)) n++
      }
      return { clk, tau, blood: n, gray, conc: M.conc(tau), eliminated }
    },
    onResize() {
      measureHud()
      chartDirty = true
    },
    onResetView() {
      snap = true
    },
    dispose() {
      offPointer && offPointer()
      if (legendEl) legendEl.removeAttribute('style')
      camera.remove(chartGroup)
      chart.mesh.geometry.dispose()
      chart.mesh.material.dispose()
      if (chart.tex && chart.tex.dispose) chart.tex.dispose()
      pgeo.dispose()
      pmat.dispose()
      gmat.dispose()
      scene.remove(camera)
    },
  }
}
