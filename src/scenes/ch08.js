// ch08 場景「基因地球」：可旋轉的點陣地球，用立柱表示某個等位基因（或預測表現型）在各族群的頻率。
// 資料全部來自 research/population-frequencies.verified.json 與 pgst-taiwan.verified.json（見 ./ch08/data.js）。
// 第二個檢視「遺傳漂變示意」是通用機制示範（示意模擬），不代表任何特定等位基因的真實歷史。
import { COLORS, hex } from '../core/palette.js'
import { decodeLand, isLand } from './ch08/landmask.js'
import { TOPICS, TOPIC_ORDER, ANCHOR, carrierFromAllele, fmtCarrier, fmtPct } from './ch08/data.js'
import { createDrift, drawDrift, DRIFT_SIZES, DRIFT_GENS } from './ch08/drift.js'

export const options = { fov: 42, camera: [0, 0, 9], target: [0, 0, 0], orbit: false, exposure: 1.1, envIntensity: 0.55 }

const R = 2 // 地球半徑
const HMAX = 1.05 // 柱高滿格
const FULL_R = 2.5 // 取景半徑（完整地球；留一點空間給高柱與 HUD）
const D2R = Math.PI / 180

/** 讓「東亞 / 歐洲 / 台灣」同時朝向鏡頭的預設視角（兩個對照區的面向都 > 0.5）。 */
const CMP_CAM = { lat: 30, lon: 68 }
/** 各題目的預設視角：換題時把該題要比的區域轉到畫面前方。 */
const TOPIC_CAM = {
  cyp2c19_3: { ...CMP_CAM, zoom: FULL_R },
  cyp2c19_17: { ...CMP_CAM, zoom: FULL_R },
  cyp2d6_10: { ...CMP_CAM, zoom: FULL_R },
  hla_1502: { lat: 14, lon: 114, zoom: 2.3 },
  hla_5801: { lat: 22, lon: 108, zoom: 2.3 },
  vkorc1: { ...CMP_CAM, zoom: FULL_R },
  nudt15: { ...CMP_CAM, zoom: FULL_R },
}

/** 各步驟的場景狀態。zoom 為 setFrame 的取景半徑（越小越近）。 */
const STEPS = [
  { intro: true, topic: 'cyp2c19_3', view: 'allele', ...CMP_CAM, zoom: FULL_R, spin: true },
  { topic: 'cyp2c19_3', view: 'allele', ...CMP_CAM, zoom: FULL_R },
  { topic: 'cyp2c19_17', view: 'allele', ...CMP_CAM, zoom: FULL_R },
  { topic: 'cyp2d6_10', view: 'allele', ...CMP_CAM, zoom: FULL_R },
  { topic: 'cyp2d6_10', view: 'pheno', ...CMP_CAM, zoom: FULL_R },
  { topic: 'hla_1502', view: 'allele', ...TOPIC_CAM.hla_1502 },
  { topic: 'hla_5801', view: 'allele', lat: 14, lon: 112, zoom: 2.2, forceTW: true, selectTW: true },
  { mode: 'drift' },
  {
    topic: 'hla_1502',
    view: 'allele',
    lat: 14,
    lon: 105,
    zoom: FULL_R,
    spin: true,
    short: '同一個「亞洲」：日本 0.03% 到越南 13.5%；台灣漢人 4.4%，泰雅、布農兩項小型研究為 0。',
    long: '<b>種族不是基因型的代理</b>：同一個「亞洲」，HLA-B*15:02 從日本 0.03% 到越南京族 13.5%；連台灣內部，漢人約 4.4%,CPIC 收錄的泰雅族（n=106）與布農族（n=101）兩項小型研究皆為 0（其他原住民族未涵蓋，不能類推）。頻率是族群層級的機率，個人要看自己的基因型。',
  },
]

export default function create(ctx) {
  const { THREE, util, scene, camera, ui, hud } = ctx
  const { clamp, damp } = util

  util.addStudioLights(scene, { intensity: 1.05 })

  // ───────────── 座標工具 ─────────────
  const UP = new THREE.Vector3(0, 1, 0)
  const FWD = new THREE.Vector3(0, 0, 1)
  const ll2v = (lat, lon, r = 1, out = new THREE.Vector3()) => {
    const p = lat * D2R
    const l = lon * D2R
    return out.set(Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l)).multiplyScalar(r)
  }
  const angDiff = (a, b) => ((a - b + 540) % 360) - 180

  // ───────────── 靜態背景 ─────────────
  const stars = util.createParticles({ count: 260, spread: [30, 18, 6], size: 0.07, color: 0x9fb8ff, opacity: 0.55, seed: 8 })
  stars.position.z = -7
  scene.add(stars)
  const backGlow = util.makeGlow(0x2f7bff, 6.6, 0.26)
  backGlow.position.z = -2.5
  scene.add(backGlow)

  // ───────────── 地球 ─────────────
  const globe = new THREE.Group()
  scene.add(globe)

  const ocean = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.995, 72, 54),
    new THREE.MeshStandardMaterial({ color: 0x0d2454, roughness: 0.78, metalness: 0.05, emissive: 0x0a1c48, emissiveIntensity: 0.95 })
  )
  globe.add(ocean)

  // 陸地點陣：Fibonacci 球面取樣 + 陸地遮罩
  const bits = decodeLand()
  const landDirs = []
  {
    const N = 17000
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N
      const rad = Math.sqrt(1 - y * y)
      const th = golden * i
      const x = Math.cos(th) * rad
      const z = Math.sin(th) * rad
      const lat = Math.asin(y) / D2R
      const lon = Math.atan2(x, z) / D2R
      if (isLand(bits, lat, lon)) landDirs.push(new THREE.Vector3(x, y, z))
    }
  }
  const dots = new THREE.InstancedMesh(
    new THREE.CircleGeometry(1, 6),
    new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x2a4287 }),
    landDirs.length
  )
  {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const c = new THREE.Color()
    const rnd = util.rng(21)
    landDirs.forEach((d, i) => {
      q.setFromUnitVectors(FWD, d)
      s.setScalar(0.0225)
      m.compose(d.clone().multiplyScalar(R * 1.001), q, s)
      dots.setMatrixAt(i, m)
      c.setHex(0x86a8ff).lerp(new THREE.Color(0xb9ccff), rnd() * 0.7)
      dots.setColorAt(i, c)
    })
    dots.instanceMatrix.needsUpdate = true
    dots.instanceColor.needsUpdate = true
  }
  globe.add(dots)

  // 經緯線
  {
    const pts = []
    const seg = 96
    const push = (a, b) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z)
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let i = 0; i < seg; i++) push(ll2v(lat, (i / seg) * 360, R * 1.002), ll2v(lat, ((i + 1) / seg) * 360, R * 1.002))
    }
    for (let lon = 0; lon < 360; lon += 30) {
      for (let i = 0; i < seg / 2; i++) push(ll2v(-90 + (i / (seg / 2)) * 180, lon, R * 1.002), ll2v(-90 + ((i + 1) / (seg / 2)) * 180, lon, R * 1.002))
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    globe.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0x5f86e0, transparent: true, opacity: 0.2, depthWrite: false })))
  }

  // 大氣邊緣光（不旋轉）
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.018, 64, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(0x4aa8ff) } },
      vertexShader: 'varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position,1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'uniform vec3 uColor; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - clamp(dot(vN, vV), 0.0, 1.0), 2.6); gl_FragColor = vec4(uColor * f * 1.35, f * 0.9); }',
    })
  )
  scene.add(rim)

  // ───────────── 立柱 ─────────────
  const pillarGroup = new THREE.Group()
  globe.add(pillarGroup)
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1)
  cylGeo.translate(0, 0.5, 0)
  const ringGeo = new THREE.RingGeometry(1.35, 1.8, 48)
  const hitGeo = cylGeo
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })

  const RAMP = [new THREE.Color(COLORS.cyan), new THREE.Color(COLORS.violet), new THREE.Color(COLORS.magenta)]
  const ramp = (t, out) => {
    t = clamp(t, 0, 1)
    return t < 0.5 ? out.lerpColors(RAMP[0], RAMP[1], t * 2) : out.lerpColors(RAMP[1], RAMP[2], (t - 0.5) * 2)
  }
  const AMBER = new THREE.Color(COLORS.amber)
  const GREY = new THREE.Color(COLORS.inactive)

  const slots = []
  for (let i = 0; i < 14; i++) {
    const grp = new THREE.Group()
    const mat = new THREE.MeshStandardMaterial({ color: COLORS.cyan, emissive: COLORS.cyan, emissiveIntensity: 0.55, roughness: 0.35, metalness: 0.1, transparent: true })
    const body = new THREE.Mesh(cylGeo, mat)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.y = 0.008
    const glow = util.makeGlow(COLORS.cyan, 0.4, 0.7)
    const hit = new THREE.Mesh(hitGeo, hitMat)
    grp.add(body, ring, glow, hit)
    grp.visible = false
    pillarGroup.add(grp)
    const slot = { i, grp, body, mat, ring, ringMat, glow, hit, item: null, active: false, r: 0.08, h: 0, th: 0, hi: 0, color: new THREE.Color(COLORS.cyan), tcolor: new THREE.Color(COLORS.cyan), dir: new THREE.Vector3(), label: null }
    hit.userData.slot = slot
    slots.push(slot)
  }

  // 台灣位置的光圈（不論有沒有資料都標出「台灣在這裡」）
  const beacon = new THREE.Mesh(
    new THREE.RingGeometry(0.92, 1, 64),
    new THREE.MeshBasicMaterial({ color: COLORS.amber, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
  )
  {
    const d = ll2v(ANCHOR.TW.lat, ANCHOR.TW.lon, 1)
    beacon.position.copy(d).multiplyScalar(R * 1.004)
    beacon.quaternion.setFromUnitVectors(FWD, d)
    pillarGroup.add(beacon)
  }

  // ───────────── 標籤 ─────────────
  const labelGroup = new THREE.Group()
  scene.add(labelGroup)
  const labelPool = []
  const mkLabel = (border) => {
    const s = util.makeLabel('　\n　', { fontSize: 40, worldHeight: 0.4, bg: 'rgba(6,9,19,0.82)', border, padding: 14 })
    s.material.toneMapped = false
    s.material.opacity = 0
    s.visible = false
    s.userData.cur = ''
    s.userData.base = s.scale.clone()
    labelGroup.add(s)
    return s
  }
  for (let i = 0; i < 13; i++) labelPool.push(mkLabel('rgba(140,170,255,0.45)'))
  const twLabel = mkLabel('rgba(255,196,77,0.95)')
  twLabel.userData.isTW = true
  let lblK = 1

  const setLabelText = (s, t) => {
    if (s.userData.cur === t) return
    s.userData.cur = t
    s.userData.setText(t)
    if (!t.includes('\n')) s.scale.multiplyScalar(0.56) // 單行標籤：字級與雙行標籤一致
    s.userData.base = s.scale.clone()
  }

  // ───────────── 狀態 ─────────────
  const S = {
    topic: 'cyp2c19_3',
    view: 'allele',
    showTW: true,
    mode: 'globe',
    intro: true,
    sel: null, // item id
    hover: null, // slot
    spin: true,
    ovr: null, // 步驟專用的圖說 {short,long}
    cmp: new Set(), // 目前題目要對照的 id（標籤優先權）
  }
  const cam = { lat: CMP_CAM.lat, lon: CMP_CAM.lon, tLat: CMP_CAM.lat, tLon: CMP_CAM.lon, baseLon: CMP_CAM.lon, r: FULL_R, tR: FULL_R, focus: true, vLon: 0, vLat: 0, lastR: 0, userMoved: false, phase: 0 }
  // 取景中心（y 由 computeFrame 依「上方按鈕列／下方圖例與圖說」之間的可用高度動態決定，見下）
  const CENTER = new THREE.Vector3(0, 0.42, 0)
  // 視窗尺寸（onResize 更新；避免每幀讀 DOM）
  const vp = { w: 600, h: 400 }
  {
    const z = ctx.size
    vp.w = z.w || 600
    vp.h = z.h || 400
  }
  let framePad = 1.15
  const HEADROOM = 0.9 // 地球上方要留給最高柱與標籤的世界單位
  let frameDirty = true
  /** 讓「高柱 + 地球」剛好落在 HUD 上下之間的可用區：回傳完整取景半徑與地球中心的螢幕 y。 */
  function computeFrame() {
    const H = vp.h || 400
    const W = vp.w || 600
    const intrude = 0.3 * safe.bottom // 地球下緣允許稍微伸進半透明的圖例／圖說底下
    const A = Math.max(120, H - safe.top - safe.bottom + intrude)
    const tanV = Math.tan((camera.fov * D2R) / 2)
    const vfov = camera.fov * D2R
    const hfov = 2 * Math.atan(tanV * (W / H))
    const sinMin = Math.sin(Math.min(vfov, hfov) / 2)
    const wpp = Math.max((2 * R + HEADROOM) / A, (2 * R * 1.08) / W) // 完整取景時每像素的世界長度
    const rFull = ((wpp * H) / (2 * tanV)) * sinMin / framePad
    const totalPx = (2 * R + HEADROOM) / wpp
    const gY = safe.top + Math.max(0, A - totalPx) / 2 + (HEADROOM + R) / wpp
    return { rFull, wpp, gY, H }
  }
  const applyFrame = (r) => {
    const g = computeFrame()
    const k = r / FULL_R
    CENTER.y = (g.gY - g.H / 2) * g.wpp * k
    ctx.setFrame(CENTER, g.rFull * k, { padding: framePad })
  }
  ctx.setFrame(CENTER, FULL_R, { azimuth: 0, elevation: 0, padding: framePad })
  cam.lastR = FULL_R

  const curTopic = () => TOPICS[S.topic]
  const curView = () => curTopic().views[S.view] || curTopic().views.allele

  function itemColor(it, view, out) {
    if (it.v == null) return out.copy(GREY)
    return ramp(it.v / view.axisMax, out)
  }

  function releaseLabel(s) {
    if (s.label) {
      s.label.userData.slot = null
      s.label = null
    }
  }

  function configure(s, it, view) {
    s.item = it
    s.active = true
    s.grp.visible = true
    const isTW = it.kind === 'taiwan' || it.kind === 'nodata-tw'
    s.r = it.kind === 'study' || it.kind === 'taiwan' ? 0.062 : 0.085
    s.dir.copy(ll2v(it.lat, it.lon, 1))
    s.grp.position.copy(s.dir).multiplyScalar(R * 0.998)
    s.grp.quaternion.setFromUnitVectors(UP, s.dir)
    const nod = it.v == null
    s.body.visible = !nod
    s.glow.visible = !nod
    s.th = nod ? 0 : it.v === 0 ? 0.02 : 0.06 + clamp(it.v / view.axisMax, 0, 1) * HMAX
    itemColor(it, view, s.tcolor)
    s.mat.opacity = it.lowConf ? 0.5 : 1
    const ringCol = isTW ? AMBER : nod ? GREY : s.tcolor
    s.ringMat.color.copy(ringCol)
    s.ringMat.opacity = nod ? 0.75 : 0.85
    s.ring.scale.setScalar(nod ? 0.1 : s.r)
    // 標籤
    const second = it.kind === 'nodata-tw' ? '未找到實測' : it.v == null ? '無資料' : fmtPct(it.v)
    const text = it.kind === 'study' ? `${it.name} ${second}` : `${it.name}\n${second}`
    let lab = s.label
    if (!lab) {
      lab = isTW ? twLabel : labelPool.find((l) => !l.userData.slot && l !== twLabel)
      if (lab) {
        lab.userData.slot = s
        s.label = lab
      }
    }
    if (lab) setLabelText(lab, text)
  }

  function deactivate(s) {
    s.active = false
    s.glow.visible = false
    releaseLabel(s)
    s.hi = 0
  }

  function clearHover() {
    S.hover = null
    hud.tip(null)
    ctx.setCursor('')
  }

  function showView({ snap = false } = {}) {
    clearHover()
    const view = curView()
    S.cmp = new Set(view.compare || [])
    const items = view.items.filter((it) => S.showTW || !(it.kind === 'taiwan' || it.kind === 'nodata-tw'))
    const prev = new Map(slots.filter((s) => s.active).map((s) => [s.item.id, s]))
    const keep = new Set()
    const plan = items.map((it) => {
      const s = prev.get(it.id) || null
      if (s) keep.add(s)
      return [it, s]
    })
    // 不再需要的 slot 讓它縮回去
    slots.forEach((s) => {
      if (s.active && !keep.has(s)) deactivate(s)
    })
    // 優先使用完全空閒（已隱藏）的 slot
    const pool = slots.filter((s) => !keep.has(s)).sort((a, b) => Number(a.grp.visible) - Number(b.grp.visible))
    for (const p of plan) {
      if (!p[1]) {
        const s = pool.shift()
        s.h = 0
        s.color.copy(itemColor(p[0], view, new THREE.Color()))
        p[1] = s
      }
    }
    plan.forEach(([it, s]) => configure(s, it, view))
    if (snap) plan.forEach(([, s]) => { s.h = s.th; s.color.copy(s.tcolor) })
    if (S.sel && !items.some((it) => it.id === S.sel)) S.sel = null
    syncItemSelect(items)
    if (S.mode === 'globe') hud.badge(view.badge)
    refreshLegend()
    refreshReadouts()
    refreshCaption()
  }

  // ───────────── 讀數與說明 ─────────────
  const segMode = ui.segmented({
    label: '檢視',
    options: [
      { value: 'globe', label: '基因地球' },
      { value: 'drift', label: '遺傳漂變示意' },
    ],
    value: 'globe',
    onChange: (v) => {
      S.intro = false
      setMode(v)
    },
  })
  const selTopic = ui.select({
    label: '選擇基因 / 等位基因',
    options: TOPIC_ORDER.map((k) => ({ value: k, label: TOPICS[k].label })),
    value: S.topic,
    onChange: (v) => {
      S.intro = false
      S.spin = false
      S.ovr = null
      S.sel = null
      setTopic(v, 'allele')
      aimTopic(v)
    },
  })
  const segView = ui.segmented({
    label: '頻率類型（這是兩種不同的數字）',
    options: [
      { value: 'allele', label: '等位基因頻率' },
      { value: 'pheno', label: '預測表現型頻率' },
    ],
    value: 'allele',
    onChange: (v) => {
      S.intro = false
      S.spin = false
      S.ovr = null
      if (!curTopic().views[v]) {
        segView.set('allele')
        hud.caption('這一題沒有「預測表現型」，請看等位基因頻率；想比較表現型可改選 CYP2C19、CYP2D6 或 NUDT15。')
        noteWhy.innerHTML = '<b>這一題沒有「表現型頻率」</b>：HLA 這類基因是看「有沒有帶風險等位基因」（等位基因頻率，或攜帶者比例），不是分成快速/正常/不良代謝者。請換成 CYP2C19、CYP2D6 或 NUDT15 再試。'
        return
      }
      S.view = v
      showView()
    },
  })
  const tgTW = ui.toggle({
    label: '標出台灣',
    value: true,
    onChange: (v) => {
      S.showTW = v
      showView()
    },
  })
  const rowFly = ui.buttons([
    { label: '飛向台灣', onClick: () => { S.intro = false; S.spin = false; S.ovr = null; flyTW() } },
    { label: '看整個地球', onClick: () => { S.intro = false; S.spin = false; S.ovr = null; flyTo(CMP_CAM.lat, CMP_CAM.lon, FULL_R) } },
  ])
  const selItem = ui.select({
    label: '查看某地區的數值（鍵盤與螢幕閱讀器可用）',
    options: [{ value: '', label: '（未選）' }],
    value: '',
    onChange: (v) => {
      S.intro = false
      S.spin = false
      S.ovr = null
      S.sel = v || null
      refreshReadouts()
      refreshCaption()
      const it = v && curView().items.find((x) => x.id === v)
      if (it) focusItem(it)
    },
  })
  const selItemEl = selItem.el.querySelector('select')
  function syncItemSelect(items) {
    if (!selItemEl) return
    selItemEl.replaceChildren()
    const add = (value, text) => {
      const o = document.createElement('option')
      o.value = value
      o.textContent = text
      selItemEl.append(o)
    }
    add('', '（未選）')
    for (const it of items) add(it.id, `${it.full && it.full !== it.name ? it.full : it.name} · ${it.kind === 'nodata-tw' ? '未找到實測' : it.v == null ? '無資料' : fmtPct(it.v)}`)
    selItemEl.value = S.sel && items.some((it) => it.id === S.sel) ? S.sel : ''
  }
  const roCmp = ui.readout({ label: '重點對照（此題）', value: '' })
  const roSel = ui.readout({ label: '點選的柱子', value: '點擊柱子看細節' })
  const noteSel = ui.note('每根柱子的來源、樣本與限制，會在這裡和滑鼠提示中顯示。')
  const noteWhy = ui.note('', { html: true })
  const segN = ui.segmented({
    label: '遺傳漂變示意：族群大小（示意）',
    options: DRIFT_SIZES.map((d) => ({ value: d.value, label: d.label })),
    value: '20',
    onChange: () => {
      S.intro = false
      restartDrift()
    },
  })
  const btnRerun = ui.button({ label: '重新模擬', kind: 'ghost', onClick: () => restartDrift(true) })
  const roDrift = ui.readout({ label: '漂變模擬（示意）', value: '' })

  function slotOf(id) {
    return slots.find((s) => s.active && s.item.id === id)
  }

  function refreshReadouts() {
    const view = curView()
    const parts = []
    for (const id of view.compare || []) {
      const it = view.items.find((x) => x.id === id)
      if (!it) continue
      parts.push(`${it.name} ${it.kind === 'nodata-tw' ? '未找到實測' : it.v == null ? '無資料' : fmtPct(it.v)}`)
    }
    roCmp.set(parts.length ? parts.join(' · ') : '—')
    const it = S.sel && view.items.find((x) => x.id === S.sel)
    if (selItemEl) selItemEl.value = S.sel && view.items.some((x) => x.id === S.sel) ? S.sel : ''
    if (it) {
      const carrier = view === curTopic().views.allele && it.v > 0 ? ` ≈攜帶者約 ${fmtCarrier(it.v)}` : ''
      roSel.set(`${it.name} ${it.v == null ? '無資料' : fmtPct(it.v)}${carrier}`)
      noteSel.textContent = `${view.kindLabel}。${it.full && it.full !== it.name ? it.full + '。' : ''}${it.src ? '來源：' + it.src + '。' : ''}${it.note ? it.note : ''}${carrier ? '「≈攜帶者」是用 1−(1−p)² 自行換算的粗估（哈迪-溫伯格假設，混合族群與加權平均不適用）。' : ''}`
    } else {
      roSel.set('點擊柱子看細節')
      noteSel.textContent = `${view.kindLabel}。柱高以此圖滿格 ${view.axisMax}% 為尺度；來源、樣本與限制會在點選柱子後顯示。`
    }
  }

  const INTRO_SHORT = '柱子越高 = 越常見。拖曳旋轉、點柱子看來源；金圈是台灣。'
  const INTRO_CAPTION = '<b>基因地球</b>：柱子的高度 = 這個等位基因在該地區的頻率（這一題是 CYP2C19*3）。拖曳旋轉、點柱子看來源；金色光圈是台灣；空心圈代表「本章引用的資料沒有這個數字」。'
  const DRIFT_SHORT = '遺傳漂變（示意）：小族群的頻率隨機起伏大，大族群幾乎不動。'
  const DRIFT_CAPTION = '<b>遺傳漂變（示意）</b>：小族群裡，等位基因頻率會因「隨機抽樣」大幅起伏，甚至消失或固定；大族群幾乎不動。這只示範一種機制，<b>不代表</b>任何特定藥物基因的真實歷史。'
  function refreshCaption() {
    let short
    let long
    if (S.mode === 'drift') {
      short = DRIFT_SHORT
      long = DRIFT_CAPTION
    } else if (S.ovr) {
      short = S.ovr.short
      long = S.ovr.long
    } else if (S.intro) {
      short = INTRO_SHORT
      long = INTRO_CAPTION
    } else {
      short = curView().short
      long = curView().caption
    }
    hud.caption(short)
    noteWhy.innerHTML = long
    measureSoon = true
  }
  let narrow = false
  function refreshLegend() {
    if (S.mode === 'drift') {
      hud.legend([])
    } else {
      // 每題的柱高／色階都以「該圖滿格」為尺度，所以把滿格數值直接寫在圖例上；粗細柱標示證據類型
      const mx = curView().axisMax
      const items = curView().items
      const mixed = items.some((it) => it.kind === 'group') && items.some((it) => it.kind === 'study' || it.kind === 'taiwan')
      const list = [
        { color: COLORS.cyan, label: '低' },
        { color: COLORS.magenta, label: `高（滿格 ${mx}%）` },
        { color: COLORS.amber, label: '台灣' },
        { color: COLORS.inactive, label: '無資料' },
      ]
      if (mixed && !narrow) list.push({ color: COLORS.ink, label: '粗柱＝加權平均・細柱＝單一研究' })
      hud.legend(list)
    }
    measureSoon = true
  }

  // 圖例與圖說由核心版面沉到底部（圖例在圖說上方）；標籤可放置區 = 扣掉上方按鈕列、下方圖例與圖說，由 DOM 量測
  const legendEl = ctx.el.querySelector('.hud-legend')
  const captionEl = ctx.el.querySelector('.hud-caption')
  const topEl = ctx.el.querySelector('.hud-top')
  const safe = { top: 44, bottom: 60 }
  let measureSoon = true
  function measureHud() {
    measureSoon = false
    safe.top = topEl ? topEl.offsetHeight + 12 : 44
    const capH = captionEl && !captionEl.hidden ? captionEl.offsetHeight + 6 : 0
    const legH = legendEl && !legendEl.hidden ? legendEl.offsetHeight + 6 : 0
    safe.bottom = capH + legH + 10
  }

  // 依模式顯示對應的控制項
  const globeCtl = [selTopic.el, segView.el, tgTW.el, rowFly.el, selItem.el, roCmp.el, roSel.el, noteSel]
  const driftCtl = [segN.el, btnRerun.el, roDrift.el]
  function syncControls() {
    const d = S.mode === 'drift'
    globeCtl.forEach((e) => (e.hidden = d))
    driftCtl.forEach((e) => (e.hidden = !d))
  }

  // ───────────── 控制 ─────────────
  function setTopic(id, view = 'allele') {
    if (!TOPICS[id]) return
    S.topic = id
    S.view = TOPICS[id].views[view] ? view : 'allele'
    selTopic.set(id)
    segView.set(S.view)
    showView()
  }

  function flyTo(lat, lon, zoom = FULL_R) {
    cam.tLat = clamp(lat, -75, 75)
    cam.tLon = lon
    cam.baseLon = lon
    cam.phase = 0
    cam.tR = zoom
    cam.focus = true
    cam.vLon = cam.vLat = 0
  }
  function flyTW() {
    S.sel = 'TW'
    if (!S.showTW) {
      S.showTW = true
      tgTW.set(true)
      showView()
    }
    flyTo(12, 114, 1.9)
    refreshReadouts()
  }
  /** 換題時，若使用者沒有自己拖過地球，就把視角轉到該題要對照的區域。 */
  function aimTopic(id) {
    if (cam.userMoved) return
    const c = TOPIC_CAM[id]
    if (c) flyTo(c.lat, c.lon, c.zoom)
  }
  function focusItem(it) {
    if (it.id === 'TW') flyTo(12, 114, 1.9)
    else if (cam.tR > 1.6) flyTo(it.lat * 0.45, it.lon, cam.tR)
  }

  // 遺傳漂變
  const drift = createDrift(util.rng)
  const panel = util.createChartPlane({ width: 4.6, height: 2.9, px: 920, bg: 'rgba(8,13,30,0.94)' })
  panel.mesh.renderOrder = 60
  panel.mesh.material.depthTest = false
  panel.mesh.material.toneMapped = false
  panel.mesh.material.opacity = 0
  panel.mesh.visible = false
  scene.add(panel.mesh)
  const driftColors = { ink: hex(COLORS.ink), muted: hex(COLORS.muted), amber: hex(COLORS.amber), alive: hex(COLORS.cyan), lost: hex(COLORS.inactive), fixed: hex(COLORS.amber) }
  let driftSeed = 3
  let driftAcc = 0
  let panelOp = 0
  let driftDirty = true
  function restartDrift(newSeed = false) {
    if (newSeed) driftSeed += 7
    const n = DRIFT_SIZES.find((d) => d.value === segN.get())?.n || 20
    drift.reset(n, driftSeed)
    driftAcc = 0
    driftDirty = true
  }
  restartDrift()
  // 漂變讀數每個世代都會變，不要讓螢幕閱讀器一直重複朗讀
  roDrift.el.querySelector('.readout-value')?.setAttribute('aria-live', 'off')
  function drawPanel() {
    panel.redraw((c, w, h) => drawDrift(c, w, h, drift, driftColors))
    driftDirty = false
    const done = drift.gen >= DRIFT_GENS
    if (drift.gen % 10 === 0 || done) {
      const st = drift.stats()
      const hint = done ? ` · 模擬結束，換成 ${drift.n >= 5000 ? 'N=20' : 'N=5000'} 再比較` : ''
      roDrift.set(`N=${drift.n} · 第${drift.gen}代 · 存在${st.alive} 消失${st.lost} 固定${st.fixed}${hint}`)
    }
  }

  function setMode(m) {
    if (S.mode === m) return
    S.mode = m
    segMode.set(m)
    clearHover()
    if (m === 'drift') {
      panel.mesh.visible = true
      restartDrift()
      hud.tip(null)
    }
    syncControls()
    refreshLegend()
    refreshCaption()
    hud.badge(m === 'drift' ? '遺傳漂變示意' : curView().badge)
  }

  // ───────────── 指標互動 ─────────────
  const drag = { on: false, moved: 0, lx: 0, ly: 0 }
  const tmpV = new THREE.Vector3()
  const tmpU = new THREE.Vector3()

  function pickSlot() {
    const list = [ocean]
    for (const s of slots) if (s.active && s.grp.visible) list.push(s.hit)
    const hits = ctx.pick(list, false)
    if (!hits.length) return null
    const o = hits[0].object
    return o.userData.slot || null
  }

  function tipFor(s) {
    const it = s.item
    const view = curView()
    const val = it.kind === 'nodata-tw' ? '未找到可核實的實測值' : it.v == null ? '無資料' : fmtPct(it.v)
    const carrier = view === curTopic().views.allele && it.v > 0 ? `<div style="opacity:.8">≈ 攜帶者約 ${fmtCarrier(it.v)}（自行換算的粗估）</div>` : ''
    return `<b style="color:#ffd166">${it.full || it.name}</b><div style="font-size:1.05rem"><b>${val}</b></div><div style="opacity:.75">${view.kindLabel}</div>${carrier}${it.src ? `<div style="opacity:.7;font-size:.74rem;margin-top:3px">${it.src}</div>` : ''}${it.note ? `<div style="opacity:.85;font-size:.76rem;margin-top:3px">${it.note}</div>` : ''}`
  }

  const off = ctx.onPointer((type, e, p) => {
    if (S.mode !== 'globe') return
    if (type === 'down') {
      drag.on = true
      drag.moved = 0
      drag.lx = p.px
      drag.ly = p.py
      cam.vLon = cam.vLat = 0
      hud.tip(null)
    } else if (type === 'move') {
      if (drag.on && p.down) {
        const dx = p.px - drag.lx
        const dy = p.py - drag.ly
        drag.lx = p.px
        drag.ly = p.py
        drag.moved += Math.abs(dx) + Math.abs(dy)
        if (drag.moved > 4) {
          const dist = camera.position.distanceTo(CENTER)
          const dpp = clamp(0.33 * ((dist - R) / 4.6), 0.05, 0.4) * (ctx.coarsePointer ? 1.15 : 1)
          cam.lon -= dx * dpp
          cam.lat = clamp(cam.lat + dy * dpp, -75, 75)
          cam.vLon = -dx * dpp * 60
          cam.vLat = dy * dpp * 60
          cam.focus = false
          cam.userMoved = true
          S.spin = false
          hud.tip(null)
        }
      } else if (!p.down) {
        const s = pickSlot()
        if (s !== S.hover) {
          S.hover = s
          ctx.setCursor(s ? 'pointer' : '')
        }
        if (s) hud.tip(tipFor(s))
        else hud.tip(null)
      }
    } else if (type === 'up' || type === 'cancel') {
      drag.on = false
    } else if (type === 'leave') {
      drag.on = false
      S.hover = null
      ctx.setCursor('')
    } else if (type === 'click') {
      const s = pickSlot()
      if (s) {
        S.intro = false
        S.spin = false
        S.ovr = null
        S.sel = s.item.id
        refreshReadouts()
        refreshCaption()
        focusItem(s.item)
        if (ctx.coarsePointer) hud.tip(tipFor(s), p.px, p.py)
      }
    }
  })

  // ───────────── 標籤排版（螢幕空間去重疊） ─────────────
  const rects = []
  const allLabels = [...labelPool, twLabel]
  const camDir = new THREE.Vector3()
  const camUp = new THREE.Vector3()
  const nrm = new THREE.Vector3()
  const topW = new THREE.Vector3()
  const tmpP = new THREE.Vector3()
  const candPool = []
  const SHIFTS = [0, 1.08, -1.08, 2.16]
  function layoutLabels(dt, show) {
    const viewH = vp.h || 400
    const viewW = vp.w || 600
    const tanH = Math.tan((camera.fov * D2R) / 2)
    camDir.copy(camera.position).sub(CENTER).normalize()
    camUp.set(0, 1, 0).applyQuaternion(camera.quaternion)
    const lk = lblK * clamp(cam.r / FULL_R, 0.6, 1) // 放大地球時，標籤在畫面上的大小不要跟著變大
    let n = 0
    for (const lab of allLabels) lab.userData.want = 0
    for (const s of slots) {
      const lab = s.label
      if (!lab || !s.active || !s.grp.visible || !show) continue
      nrm.copy(s.dir).applyQuaternion(globe.quaternion)
      const facing = nrm.dot(camDir)
      topW.set(0, s.h + 0.05 + 0.16 * lk, 0)
      s.grp.localToWorld(topW)
      lab.position.copy(topW)
      const dCam = camera.position.distanceTo(topW)
      const pxPer = viewH / (2 * dCam * tanH)
      lab.scale.set(lab.userData.base.x * lk, lab.userData.base.y * lk, 1)
      tmpP.copy(topW).project(camera)
      const px = ((tmpP.x + 1) / 2) * viewW
      const py = ((1 - tmpP.y) / 2) * viewH
      const isSel = S.sel === s.item.id
      const isHov = S.hover === s
      // 優先權：懸停 > 選取 > 此題要對照的區域（東亞/歐洲/台灣等） > 台灣 > 其他（高值優先）
      const prio = (isHov ? 300 : 0) + (isSel ? 200 : 0) + (S.cmp.has(s.item.id) ? 150 : 0) + (lab.userData.isTW ? 100 : 0) + (s.item.v || 0) * 0.1
      const c = candPool[n] || (candPool[n] = {})
      n++
      c.lab = lab
      c.x = px
      c.y = py
      c.w = lab.scale.x * pxPer
      c.h = lab.scale.y * pxPer
      c.pxPer = pxPer
      c.prio = prio
      c.vis = facing > 0.2 && tmpP.z > -1 && tmpP.z < 1
    }
    const cands = candPool.slice(0, n).sort((a, b) => b.prio - a.prio)
    rects.length = 0
    for (const c of cands) {
      let placed = false
      if (c.vis) {
        for (const k of SHIFTS) {
          const y = c.y - k * c.h // 往畫面上方（負）或下方挪開
          // 完整落在可放置區內才顯示（避開上方按鈕列與下方圖例、圖說）
          const inside = c.x - c.w / 2 >= 4 && c.x + c.w / 2 <= viewW - 4 && y - c.h / 2 >= safe.top && y + c.h / 2 <= viewH - safe.bottom
          if (!inside) continue
          let hit = false
          for (const r of rects) {
            if (Math.abs(c.x - r.x) < (c.w + r.w) / 2 + 2 && Math.abs(y - r.y) < (c.h + r.h) / 2 + 2) {
              hit = true
              break
            }
          }
          if (hit) continue
          rects.push({ x: c.x, y, w: c.w, h: c.h })
          if (k) c.lab.position.addScaledVector(camUp, (k * c.h) / c.pxPer)
          placed = true
          break
        }
      }
      if (!placed && c.vis && c.prio >= 150) {
        // 對照用的重要標籤（東亞／歐洲／台灣、被選取者）放不下時，夾進可放置區而不是直接隱藏
        const y = clamp(c.y, safe.top + c.h / 2, viewH - safe.bottom - c.h / 2)
        const x = clamp(c.x, 4 + c.w / 2, viewW - 4 - c.w / 2)
        if (!rects.some((r) => Math.abs(x - r.x) < (c.w + r.w) / 2 + 2 && Math.abs(y - r.y) < (c.h + r.h) / 2 + 2)) {
          rects.push({ x, y, w: c.w, h: c.h })
          c.lab.position.addScaledVector(camUp, ((c.y - y) * 1) / c.pxPer)
          placed = true
        }
      }
      c.lab.userData.want = placed ? 1 : 0
    }
    for (const lab of allLabels) {
      lab.material.opacity = damp(lab.material.opacity, lab.userData.want, 10, dt)
      lab.visible = lab.material.opacity > 0.02
    }
  }

  // ───────────── 步驟 ─────────────
  function applyStep(i) {
    i = Number.isFinite(i) ? Math.round(i) : 0
    const c = STEPS[Math.min(Math.max(i, 0), STEPS.length - 1)]
    S.intro = !!c.intro
    S.spin = !!c.spin
    S.ovr = c.short ? c : null
    cam.userMoved = false
    if (c.mode === 'drift') {
      setMode('drift')
      return
    }
    setMode('globe')
    if (c.forceTW && !S.showTW) {
      S.showTW = true
      tgTW.set(true)
    }
    S.sel = c.selectTW ? 'TW' : null
    setTopic(c.topic, c.view)
    flyTo(c.lat, c.lon, c.zoom)
  }

  // ───────────── 初始化 ─────────────
  showView()
  syncControls()
  refreshLegend()
  hud.badge(curView().badge)

  let lastNow = performance.now()

  return {
    onStep(i) {
      applyStep(i)
    },
    onResize(w, h) {
      vp.w = w
      vp.h = h
      lblK = clamp(520 / Math.max(200, h), 1, 1.2)
      const pad = h < 420 || w < 520 ? 1.04 : 1.15
      framePad = pad
      frameDirty = true
      if ((w < 520) !== narrow) {
        narrow = w < 520
        refreshLegend()
      }
      measureSoon = true
    },
    // 鍵盤：方向鍵旋轉地球（核心在 OrbitControls 關閉時把方向鍵轉交過來；弧度 → 度）
    onKeyRotate(dAz, dEl) {
      const deg = 180 / Math.PI
      cam.lon -= dAz * deg
      cam.lat = clamp(cam.lat + dEl * deg, -75, 75)
      cam.vLon = cam.vLat = 0
      cam.focus = false
      cam.userMoved = true
      S.spin = false
      hud.tip(null)
    },
    onResetView() {
      S.spin = false
      flyTo(CMP_CAM.lat, CMP_CAM.lon, FULL_R)
    },
    update(dt0, t) {
      const m = ctx.motion
      // 使用者觸發的轉場（飛行、柱子升降、圖表淡入）要在「暫停動畫」時也照常播放，環境動態（自轉、脈動、漂變模擬）才跟著暫停
      const now = performance.now()
      const udt = ctx.paused ? Math.min(0.05, Math.max(0, (now - lastNow) / 1000)) : dt0
      lastNow = now
      const dt = dt0
      if (measureSoon) {
        const t0 = safe.top
        const b0 = safe.bottom
        measureHud()
        if (Math.abs(t0 - safe.top) > 1 || Math.abs(b0 - safe.bottom) > 1) frameDirty = true
      }
      // 旋轉與取景
      if (S.mode === 'globe') {
        if (!drag.on) {
          // 慢速「左右搖擺」代替持續自轉：對照的兩個區域不會轉到背面
          if (S.spin && !S.hover && cam.focus) {
            cam.phase += dt * 0.32 * m
            cam.tLon = cam.baseLon + 24 * Math.sin(cam.phase)
          }
          if (cam.focus) {
            cam.lon += angDiff(cam.tLon, cam.lon) * (1 - Math.exp(-3.2 * udt))
            cam.lat = damp(cam.lat, cam.tLat, 3.2, udt)
          } else {
            cam.lon += cam.vLon * udt
            cam.lat = clamp(cam.lat + cam.vLat * udt, -75, 75)
            cam.vLon *= Math.exp(-3 * udt)
            cam.vLat *= Math.exp(-3 * udt)
          }
        }
        cam.lon = ((cam.lon + 540) % 360) - 180
        cam.r = damp(cam.r, cam.tR, 3, udt)
        if (frameDirty || Math.abs(cam.r - cam.lastR) > 2e-4) {
          frameDirty = false
          applyFrame(cam.r)
          cam.lastR = cam.r
        }
      }
      globe.rotation.set(cam.lat * D2R, -cam.lon * D2R, 0, 'XYZ')
      globe.updateMatrixWorld(true)
      stars.rotation.y = t * 0.01 * m

      // 立柱
      for (const s of slots) {
        if (!s.grp.visible) continue
        s.h = damp(s.h, s.active ? s.th : 0, 4.2, udt)
        if (!s.active && s.h < 0.004) {
          s.grp.visible = false
          continue
        }
        const hiT = S.hover === s || S.sel === (s.item && s.item.id) ? 1 : 0
        s.hi = damp(s.hi, hiT, 10, udt)
        s.color.lerp(s.tcolor, 1 - Math.exp(-6 * udt))
        s.mat.color.copy(s.color)
        s.mat.emissive.copy(s.color)
        s.mat.emissiveIntensity = 0.5 + 0.7 * s.hi + 0.06 * Math.sin(t * 2 + s.i) * m
        const r = s.r * (1 + 0.25 * s.hi)
        s.body.scale.set(r, Math.max(s.h, 0.0001), r)
        s.glow.position.y = s.h + 0.03
        s.glow.scale.setScalar(0.34 + 0.16 * s.hi + 0.03 * Math.sin(t * 2.4 + s.i) * m)
        s.glow.material.color.copy(s.color)
        s.hit.scale.set(s.r * (ctx.coarsePointer ? 3.2 : 2.3), s.h + 0.22, s.r * (ctx.coarsePointer ? 3.2 : 2.3))
        if (s.item.v == null) s.hit.scale.set(0.14, 0.2, 0.14)
        s.ringMat.opacity = (s.item.v == null ? 0.7 : 0.85) * (s.active ? 1 : 0)
        const pulse = S.sel === s.item.id ? 1 + 0.18 * Math.sin(t * 5) : 1
        s.ring.scale.setScalar((s.item.v == null ? 0.1 : s.r) * pulse)
      }

      // 台灣光圈
      const showB = S.mode === 'globe' && S.showTW
      beacon.visible = showB
      if (showB) {
        const k = (t * 0.5 * (0.4 + 0.6 * m)) % 1
        beacon.scale.setScalar(0.05 + 0.3 * k)
        beacon.material.opacity = 0.9 * (1 - k)
      }

      // 遺傳漂變
      const wantPanel = S.mode === 'drift' ? 1 : 0
      panelOp = damp(panelOp, wantPanel, 10, udt)
      if (S.mode === 'drift') {
        driftAcc += dt
        while (driftAcc > 0.07 && drift.gen < DRIFT_GENS) {
          driftAcc -= 0.07
          drift.step()
          driftDirty = true
        }
      }
      if (panel.mesh.visible) {
        if (driftDirty) drawPanel()
        panel.mesh.material.opacity = panelOp
        const d = 3.4
        const fwd = tmpV.set(0, 0, -1).applyQuaternion(camera.quaternion)
        const viewHpx = vp.h || 400
        const visH = 2 * d * Math.tan((camera.fov * D2R) / 2)
        const visW = visH * camera.aspect
        // 圖表放在「上方按鈕列」與「下方圖說」之間的空白區
        const areaTop = safe.top
        const areaBottom = viewHpx - safe.bottom
        const offsetY = ((viewHpx / 2 - (areaTop + areaBottom) / 2) / viewHpx) * visH
        const upV = tmpU.set(0, 1, 0).applyQuaternion(camera.quaternion)
        panel.mesh.position.copy(camera.position).addScaledVector(fwd, d).addScaledVector(upV, offsetY)
        panel.mesh.quaternion.copy(camera.quaternion)
        const availH = ((areaBottom - areaTop) / viewHpx) * visH
        panel.mesh.scale.setScalar(Math.max(0.05, Math.min((0.96 * visW) / 4.6, (0.98 * availH) / 2.9)))
        if (S.mode === 'globe' && panelOp < 0.01) panel.mesh.visible = false
      }
      const globeVisible = panelOp < 0.985
      globe.visible = globeVisible
      rim.visible = globeVisible
      labelGroup.visible = panelOp < 0.05
      backGlow.material.opacity = 0.26 - 0.1 * panelOp

      layoutLabels(udt, S.mode === 'globe')
    },
    dispose() {
      off && off()
    },
  }
}
