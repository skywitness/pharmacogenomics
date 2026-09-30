// ch06 場景「案例探索器」：氯吡格雷（CYP2C19）/ 可待因（CYP2D6）/ 華法林（CYP2C9 + VKORC1）
// 共用同一個舞台：左邊是肝細胞（酵素工廠），右邊是各藥的作用目標，最右邊是「效果計」。
// 所有粒子比例、酵素數量、效果位置皆為教學示意，不是實測或劑量計算。
import { CLOP, CODE, WARF, PH_HEX, PH_CSS, CLOP_IND, BLOCK_HEX, clopCard, codeCard, warfCard, cardHTML } from './ch06/data.js'
import { createReactor, createGauge, makeTag } from './ch06/parts.js'
import { createVessel, createBrain, createVitK } from './ch06/targets.js'

export const options = {
  fov: 40,
  camera: [0, 1.2, 12],
  target: [0, 0, 0],
  zoom: false,
  orbit: true,
  minAzimuthAngle: -0.8,
  maxAzimuthAngle: 0.8,
  minPolarAngle: 0.95,
  maxPolarAngle: 1.75,
  exposure: 1.15,
  envIntensity: 0.55,
}

const STEPS = [
  { drug: 'clop', ph: 'NM', adjust: false, intro: true },
  { drug: 'clop', ph: 'PM', adjust: false },
  { drug: 'clop', ph: 'PM', adjust: false }, // 由讀者自己打開「對照」開關，才有前後比較
  { drug: 'code', ph: 'UM', adjust: false },
  { drug: 'code', ph: 'PM', adjust: false },
  { drug: 'warf', v: 'AA', c: '13', adjust: false },
  { drug: 'warf', v: 'AA', c: '13', adjust: false }, // 同上：讀者自己打開對照
]

export default function create(ctx) {
  const { THREE, util, palette, scene, camera, hud, ui } = ctx
  const { COLORS } = palette
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z)

  util.addStudioLights(scene, { intensity: 1.0 })
  const root = new THREE.Group()
  scene.add(root)

  // ───────────────────────── 佈局 ─────────────────────────
  const LIVER = V3(-2.75, 0.95, 0)
  const INLET = V3(-4.25, 0.95, 0)
  const EXIT = V3(-1.5, 0.95, 0.1)
  const TARGET = V3(1.05, 0.95, 0)
  const GAUGE = V3(1.05, -1.22, 0)
  const CES = V3(-4.3, -0.05, 0.25)

  // 背景光暈與塵埃
  const gA = util.makeGlow(COLORS.liver, 8, 0.12)
  gA.position.set(-3.2, 0.3, -2.5)
  const gB = util.makeGlow(COLORS.cyan, 9, 0.1)
  gB.position.set(1.6, 0.3, -3)
  scene.add(gA, gB)
  const dust = util.createParticles({ count: 160, spread: [16, 8, 6], size: 0.06, color: 0x8fb4ff, opacity: 0.45, seed: 9 })
  dust.position.z = -1.5
  scene.add(dust)

  // 肝細胞
  const reactor = createReactor(ctx)
  reactor.group.position.copy(LIVER)
  root.add(reactor.group)
  root.updateMatrixWorld(true)
  const fronts = reactor.slots.map((s) => reactor.front(s.i, V3(0, 0, 0)))

  // CES1（氯吡格雷的另一條路：多數被水解成無活性物）
  const ces = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: 0x7c86a6, roughness: 0.4, emissive: 0x2b3350, emissiveIntensity: 0.6 }))
  ces.position.copy(CES)
  // 場景內的文字標籤都包在一層 Group 裡，窄螢幕時整組放大（標籤文字才讀得到）
  const tagWraps = []
  function placeTag(tag, x, y, z) {
    const g = new THREE.Group()
    g.position.set(x, y, z)
    tag.position.set(0, 0, 0)
    g.add(tag)
    root.add(g)
    tagWraps.push(g)
    return g
  }
  const cesTag = makeTag(ctx, 'CES1 分解\n（多數，示意）', { worldHeight: 0.5, fontSize: 30, color: '#c8d0e8' })
  const cesWrap = placeTag(cesTag, CES.x + 0.05, CES.y - 0.58, 0.25)
  root.add(ces)

  const IN_TAG = { text: '吃進的藥', color: '#ffd9a0', border: 'rgba(255,179,71,0.55)' }
  const ALT_TAG = { text: '替代藥\n（不靠該基因活化）', color: '#efe4ff', border: 'rgba(232,217,255,0.7)' }
  const inTag = makeTag(ctx, IN_TAG.text, { worldHeight: 0.3, fontSize: 34, color: IN_TAG.color, border: IN_TAG.border })
  placeTag(inTag, -4.05, 1.86, 0.2)

  // 三個目標
  const vessel = createVessel(ctx, TARGET)
  const brain = createBrain(ctx, TARGET.clone().add(V3(0, -0.25, 0)))
  brain.group.scale.setScalar(0.84)
  const vitk = createVitK(ctx, TARGET.clone().add(V3(0.15, 0.12, 0)))
  vitk.group.scale.setScalar(0.8)
  const targets = { clop: vessel, code: brain, warf: vitk }
  root.add(vessel.group, brain.group, vitk.group)

  // 目標名稱（隨案例改變）
  const nameTag = makeTag(ctx, '血管 · 血小板', { worldHeight: 0.3, fontSize: 36 })
  placeTag(nameTag, TARGET.x, -0.2, 0.3)
  const TARGET_NAME = { clop: '血管 · 血小板', code: '腦 · μ 鴉片受體（放大示意）', warf: '維生素 K 循環' }

  // 效果計
  const gauge = createGauge(ctx, { W: 3.0 })
  gauge.group.position.copy(GAUGE)
  root.add(gauge.group)

  // ───────────────────────── 粒子池 ─────────────────────────
  const ALT_COLOR = 0xe8d9ff // 替代藥粒子與圖例的顏色（淡紫白，和青綠色的代謝物區分）
  const NPART = 120
  const partGeo = new THREE.SphereGeometry(1, 14, 10)
  const pCore = new THREE.InstancedMesh(partGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }), NPART)
  const pHalo = new THREE.InstancedMesh(partGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.17, depthWrite: false, blending: THREE.AdditiveBlending }), NPART)
  pCore.frustumCulled = false
  pHalo.frustumCulled = false
  pCore.renderOrder = 6
  pHalo.renderOrder = 7
  root.add(pCore, pHalo)
  const C = {
    drug: new THREE.Color(COLORS.drug),
    metab: new THREE.Color(COLORS.metabolite),
    gray: new THREE.Color(COLORS.inactive),
    alt: new THREE.Color(ALT_COLOR),
  }
  const P = Array.from({ length: NPART }, () => ({
    alive: false,
    state: '',
    t: 0,
    dur: 1,
    a: V3(0, 0, 0),
    b: V3(0, 0, 0),
    c: V3(0, 0, 0),
    pos: V3(0, 0, 0),
    col0: new THREE.Color(),
    col: new THREE.Color(),
    size: 0.085,
    slot: 0,
    att: null,
    fade: 1,
  }))
  const dummy = new THREE.Object3D()
  const tmp = V3(0, 0, 0)
  const freeP = () => P.find((p) => !p.alive) || null
  const bez = (p, u, out) => {
    const k = 1 - u
    return out.set(k * k * p.a.x + 2 * k * u * p.c.x + u * u * p.b.x, k * k * p.a.y + 2 * k * u * p.c.y + u * u * p.b.y, k * k * p.a.z + 2 * k * u * p.c.z + u * u * p.b.z)
  }
  const rnd = (a, b) => a + Math.random() * (b - a)

  // ───────────────────────── 狀態 ─────────────────────────
  const S = { drug: 'clop', ph: { clop: 'NM', code: 'NM' }, v: 'GG', c: '11', ind: 'acs', adjust: false, intro: true }
  let cur = null // derive() 的結果

  function derive() {
    const c = { drug: S.drug }
    if (S.drug === 'clop') {
      const k = S.ph.clop
      const p = CLOP.ph[k]
      const alt = S.adjust && (k === 'IM' || k === 'PM')
      const inh = alt ? 0.9 : p.inh
      Object.assign(c, {
        route: 'prodrug', divert: true, residual: k === 'PM' ? 0.05 : 0.02, enz: p.enz, extra: p.extra, uml: k === 'UM', phKey: k,
        phLabel: `${k} ${p.zh}
${p.diplo}`, enzName: 'CYP2C19', alt, e: alt ? CLOP.altE : p.e, zones: CLOP.zones, gaugeTitle: CLOP.gaugeTitle, rate: 1,
        tState: { inh, clot: Math.max(0, 1 - inh - 0.3) / 0.7 },
      })
      c.enzText = `${p.enz} / 8 個酵素位點功能正常`
      const cap = {
        UM: '超快速：活化更多，血小板抑制充分。CPIC 對 UM、RM、NM 都是標準劑量。',
        RM: '快速：活化略多，血小板抑制充分。CPIC 對 UM、RM、NM 都是標準劑量。',
        NM: '正常：酵素把一小部分藥活化，活性代謝物（青綠）擋住血小板受體，血小板（綠）不易聚集。',
        IM: '中間：活化偏低 → 部分血小板沒被擋住（粉紅）→ 支架處開始有血栓風險（示意）。',
        PM: '不良：幾乎沒有活性代謝物 → 血小板照樣聚集成團（紅）→ 支架血栓風險最高（示意）。',
      }
      c.caption = alt ? '改用 prasugrel / ticagrelor（主要不靠 CYP2C19 活化；示意：粒子直接飛向血小板）→ 血小板抑制回到「足夠」範圍。' : S.adjust ? '此代謝型依指引本來就用標準劑量氯吡格雷，所以畫面不變。' : cap[k]
      const capS = { UM: '超快速：活化更多，血小板抑制充分。', RM: '快速：活化略多，血小板抑制充分。', NM: '正常：藥被活化，血小板被擋住（綠）。', IM: '中間：活化偏低，部分血小板照樣聚集。', PM: '不良：幾乎沒活化，血小板聚集，血栓風險高。' }
      c.short = alt ? '改用 prasugrel/ticagrelor：不需 CYP2C19 活化。' : S.adjust ? '此型別依指引本來就用標準劑量。' : capS[k]
      c.legend = [
        ...(alt ? [{ color: ALT_COLOR, label: '替代藥' }] : [{ color: COLORS.drug, label: '前驅藥' }]),
        { color: COLORS.metabolite, label: '活性代謝物' },
        { color: BLOCK_HEX, label: '血小板已阻斷' },
        { color: COLORS.magenta, label: narrow ? '會聚集' : '會聚集（粉紅→紅）' },
        ...(alt ? [] : [{ color: COLORS.inactive, label: narrow ? '失能/CES1' : '失能酵素/CES1' }]),
      ]
      c.card = cardHTML(
        clopCard(k, S.ind),
        k === 'IM' || k === 'PM' ? '依 CPIC 頻率表估算，東亞族群 CYP2C19 中間代謝者約 46%、不良代謝者約 13%（多研究推算值，不是台灣實測）。' : '指引只說明「已有基因結果時怎麼用」，並未規定誰該做檢測。'
      )
      c.tip = {
        liver: '<b>肝細胞</b><br>CYP2C19 把前驅藥氯吡格雷「活化」。灰色、縮小的酵素 = 功能喪失（示意）。',
        target: '<b>血管與血小板</b><br>活性代謝物不可逆地結合血小板的 P2Y12 受體；被擋住的血小板（綠）不易聚集。',
        gauge: '<b>效果計（示意）</b><br>指標在紅色區 = 抗血小板效果不足。',
      }
    } else if (S.drug === 'code') {
      const k = S.ph.code
      const p = CODE.ph[k]
      const alt = S.adjust && (k === 'UM' || k === 'PM')
      const e = alt ? CODE.altE : p.e
      Object.assign(c, {
        route: 'prodrug', divert: false, residual: k === 'PM' ? 0.04 : 0.02, enz: p.enz, extra: p.extra, uml: k === 'UM', phKey: k,
        phLabel: `${k} ${p.zh}
${p.diplo}`, enzName: 'CYP2D6', alt, e, zones: CODE.zones, gaugeTitle: CODE.gaugeTitle, rate: 1,
        tState: { occ: alt ? 7 : p.occ, zoneColor: e > 0.76 ? 0xff5c5c : e > 0.33 ? 0x4be3a0 : 0xffc44d, overdose: !alt && k === 'UM' },
      })
      c.enzText = `${p.enz} / 8 個酵素位點功能正常`
      const cap = {
        UM: '超快速：大量轉成嗎啡 → 受體被占滿 → 過量與呼吸抑制風險（兒童尤其危險）。',
        NM: '正常：部分可待因轉成嗎啡 → 占據適量的受體 → 有鎮痛效果。',
        IM: '中間：轉出的嗎啡較少 → 鎮痛偏弱；依仿單使用，無效再考慮換藥。',
        PM: '不良：幾乎轉不出嗎啡 → 受體大多空著 → 鎮痛不足。',
      }
      c.caption = alt ? '改用 CPIC 建議方向的替代止痛（非曲馬多的其他鴉片類或非鴉片類，示意）→ 效果回到「鎮痛」範圍。' : S.adjust ? '此代謝型依指引本來就依仿單使用，所以畫面不變。' : cap[k]
      const capS = { UM: '超快速：嗎啡過多，受體被占滿，有中毒風險。', NM: '正常：嗎啡適量，有鎮痛效果。', IM: '中間：嗎啡較少，鎮痛偏弱；依仿單使用。', PM: '不良：幾乎沒有嗎啡，鎮痛不足。' }
      c.short = alt ? '改用非曲馬多的替代止痛（示意）。' : S.adjust ? '此型別依指引本來就依仿單使用。' : capS[k]
      c.legend = [
        ...(alt ? [{ color: ALT_COLOR, label: '替代藥' }] : [{ color: COLORS.drug, label: '可待因' }]),
        { color: COLORS.metabolite, label: '嗎啡（活性）' },
        { color: COLORS.enzyme, label: 'CYP2D6' },
        { color: COLORS.inactive, label: '失能酵素' },
      ]
      c.card = cardHTML(codeCard(k), k === 'UM' || k === 'PM' ? '現行美國可待因仿單：未滿 12 歲兒童，以及未滿 18 歲的扁桃腺/腺樣體切除術後止痛，皆為禁忌。' : '')
      c.tip = {
        liver: '<b>肝細胞</b><br>CYP2D6 把可待因去甲基化成嗎啡。酵素越多 → 嗎啡越多。',
        target: '<b>腦部 μ 鴉片受體（放大示意）</b><br>嗎啡占據受體 → 鎮痛；占據太多 → 呼吸抑制。',
        gauge: '<b>嗎啡暴露（示意）</b><br>太低鎮痛不足；太高有過量風險。',
      }
    } else {
      const vk = S.v
      const cy = S.c
      const tier = WARF.tier[vk][cy]
      const e = S.adjust ? WARF.adjE : WARF.tierE[tier]
      const cp = WARF.cy[cy]
      Object.assign(c, {
        route: 'clear', divert: false, residual: cy === '33' ? 0.05 : 0.03, enz: cp.enz, extra: 0, uml: false, phKey: cp.ph,
        phLabel: `${cp.ph} ${cp.zh}
${cp.short}`, enzName: 'CYP2C9', alt: false, e, zones: WARF.zones, gaugeTitle: WARF.gaugeTitle,
        rate: S.adjust ? WARF.tierRate[tier] : 1, tState: { e, gatesOn: WARF.vk[vk].gates, label: `VKORC1 ${vk}（標靶）` },
      })
      c.enzText = `CYP2C9 ${cp.enz}/8 · VKORC1 標靶 ${WARF.vk[vk].gates} 個`
      const capT = {
        high: '同樣的常規起始劑量 → 落在目標範圍附近（這組基因的劑量需求較高）。',
        mid: '同樣的常規起始劑量 → 偏向目標範圍上緣（這組基因的劑量需求中等，常規起始劑量容易偏高；僅示意方向）。',
        low: '同樣的常規起始劑量 → 標靶少、清得慢 → 容易過度抗凝（出血風險）。',
      }
      c.caption = S.adjust
        ? tier === 'high'
          ? '這組基因的常規起始劑量本來就在目標範圍附近，所以畫面幾乎不變（示意）。'
          : '依基因調整起始劑量（橘色粒子變少）→ 抗凝強度回到 INR 2–3 的目標範圍（示意）。'
        : capT[tier]
      const capS = { high: '常規起始劑量：落在目標範圍附近。', mid: '常規起始劑量：偏向範圍上緣。', low: '常規起始劑量：過度抗凝，出血風險高。' }
      c.short = S.adjust ? (tier === 'high' ? '這組基因本來就在範圍附近，畫面幾乎不變。' : '依基因調整起始劑量：回到 INR 2–3。') : capS[tier]
      c.legend = [
        { color: COLORS.drug, label: '華法林' },
        { color: COLORS.inactive, label: '被清除/失能' },
        { color: COLORS.green, label: '還原型 K' },
        { color: 0xff6b6b, label: '凝血因子' },
      ]
      c.card = cardHTML(
        warfCard(vk, cy),
        `FDA 仿單（Jantoven）預期維持劑量表的分級：這組基因為「${WARF.tierZh[tier]}」劑量需求（僅示意，不可作為處方依據）。基因導向劑量對臨床結局的證據並不一致。`
      )
      c.tip = {
        liver: '<b>肝細胞</b><br>CYP2C9 清除效力較強的 S-華法林。酵素弱 → 清得慢 → 更多藥到達標靶。',
        target: '<b>維生素 K 循環</b><br>華法林堵住 VKORC1，還原型維生素 K 變少 → 凝血因子活化變慢。',
        gauge: '<b>抗凝血強度（示意）</b><br>綠色 = 目標 INR 2–3；紅色 = 過度抗凝。',
      }
    }
    const z = c.zones.find((zz) => c.e <= zz.to) || c.zones[c.zones.length - 1]
    c.zone = z
    return c
  }

  // ───────────────────────── 控制項 ─────────────────────────
  const refs = {}
  const drugSeg = ui.segmented({
    label: '選一個案例',
    options: [
      { value: 'clop', label: '氯吡格雷' },
      { value: 'code', label: '可待因' },
      { value: 'warf', label: '華法林' },
    ],
    value: 'clop',
    onChange: (v) => setState({ drug: v, intro: false }),
  })
  const adjToggle = ui.toggle({ label: '依指引調整處方', value: false, onChange: (v) => setState({ adjust: v, intro: false }) })
  // 控制面板要能完整看到（尤其是 CPIC 摘要卡）：不做內部捲動，改由 fitStage() 縮小舞台畫面來讓整個 stage 塞進視窗
  Object.assign(ui.root.style, { paddingTop: '8px', paddingBottom: '2px', gap: '6px 16px' })
  // 桌機：不做內部捲動，改由 fitStage() 縮小舞台畫面；手機/平板（≤980px）沿用核心的 max-height + 內部捲動，避免舞台高過視窗而切掉控制項
  adjToggle.el.style.alignSelf = 'end'
  adjToggle.el.style.paddingBottom = '6px'
  const drugLabel = drugSeg.el.querySelector('.ctl-label')
  if (drugLabel) drugLabel.style.display = 'none' // 三顆藥的按鈕本身就清楚；省一行高度給摘要卡
  const phBox = ui.group('')
  const card = ui.note('', { html: true })
  card.style.gridColumn = '1 / -1'
  card.style.fontSize = 'inherit'
  card.style.margin = '0'
  card.setAttribute('aria-live', 'polite')

  const phOpts = (def) => Object.entries(def.ph).map(([k, p]) => ({ value: k, label: p.short, color: PH_HEX[k], title: `${p.zh}(${p.diplo})` }))

  function buildPh() {
    phBox.clear()
    refs.ph = refs.ind = refs.v = refs.c = null
    if (S.drug === 'clop') {
      refs.ph = phBox.segmented({ label: 'CYP2C19 代謝型', options: phOpts(CLOP), value: S.ph.clop, onChange: (v) => setState({ ph: { ...S.ph, clop: v }, intro: false }) })
      refs.ind = phBox.segmented({
        label: '適應症（證據強度不同）',
        options: Object.entries(CLOP_IND).map(([k, v]) => ({ value: k, label: v.label })),
        value: S.ind,
        onChange: (v) => setState({ ind: v, intro: false }),
      })
    } else if (S.drug === 'code') {
      refs.ph = phBox.segmented({ label: 'CYP2D6 代謝型（活性分數）', options: phOpts(CODE), value: S.ph.code, onChange: (v) => setState({ ph: { ...S.ph, code: v }, intro: false }) })
    } else {
      refs.v = phBox.segmented({
        label: 'VKORC1 −1639G>A（標靶表現量）',
        options: Object.entries(WARF.vk).map(([k, v]) => ({ value: k, label: v.short, title: v.zh })),
        value: S.v,
        onChange: (v) => setState({ v, intro: false }),
      })
      refs.c = phBox.segmented({
        label: 'CYP2C9 雙倍型（清除速度）',
        options: Object.entries(WARF.cy).map(([k, v]) => ({ value: k, label: v.short, title: v.zh })),
        value: S.c,
        onChange: (v) => setState({ c: v, intro: false }),
      })
    }
    const touchMin = ctx.coarsePointer || (typeof matchMedia === 'function' && matchMedia('(max-width: 620px)').matches) ? '44px' : '32px'
    for (const r of [refs.ph, refs.ind, refs.v, refs.c]) if (r) r.el.querySelectorAll('.seg-btn').forEach((b) => Object.assign(b.style, { padding: '4px 5px', fontSize: '0.78rem', minHeight: touchMin }))
    drugSeg.el.querySelectorAll('.seg-btn').forEach((b) => Object.assign(b.style, { minHeight: touchMin }))
    const lab = adjToggle.el.querySelector('.ctl-toggle-label span:last-child')
    if (lab) lab.textContent = S.drug === 'warf' ? '對照：依基因調整起始劑量' : '對照：依 CPIC 指引調整處方'
  }

  function syncUI() {
    drugSeg.set(S.drug)
    adjToggle.set(S.adjust)
    if (refs.ph) refs.ph.set(S.drug === 'clop' ? S.ph.clop : S.ph.code)
    if (refs.ind) refs.ind.set(S.ind)
    if (refs.v) refs.v.set(S.v)
    if (refs.c) refs.c.set(S.c)
  }

  function setState(patch) {
    const drugChanged = patch.drug && patch.drug !== S.drug
    Object.assign(S, patch)
    if (drugChanged) buildPh()
    syncUI()
    apply()
  }

  // ───────────────────────── 套用狀態 ─────────────────────────
  let visTarget = null
  let prevDrug = null
  let prevAlt = null
  let tipKind = null
  let keepTip = null // 觸控裝置：點一下顯示的說明要留住（Stage 會在 pointerleave 時把它清掉）
  let keepTipT = 0
  function clearTip() {
    keepTip = null
    keepTipT = 0
    tipKind = null
    hud.tip(null)
  }
  function apply() {
    cur = derive()
    if (prevDrug !== null && (prevDrug !== cur.drug || prevAlt !== cur.alt)) {
      // 換藥或切換替代藥時，還在飛的粒子要依舊目標/舊路徑作廢（否則會飛向已隱藏的目標）
      for (const p of P) if (p.alive && (p.state === 'out2' || p.state === 'alt')) p.alive = false
    }
    if (prevDrug !== null && prevDrug !== cur.drug) clearTip()
    prevDrug = cur.drug
    prevAlt = cur.alt
    reactor.setActive(cur.enz, cur.uml, PH_HEX[cur.phKey], cur.phLabel, cur.enzName)
    gauge.setZones(cur.zones, cur.gaugeTitle)
    gauge.setValue(cur.e)
    for (const k of Object.keys(targets)) targets[k].group.visible = k === cur.drug
    visTarget = targets[cur.drug]
    visTarget.setState(cur.tState)
    ces.visible = cesTag.visible = !!cur.divert && !cur.alt
    const it = cur.alt ? ALT_TAG : IN_TAG
    if (inTag.userData.mode !== it) {
      inTag.userData.mode = it
      inTag.userData.set(it.text, it.color, it.border)
    }
    hud.legend(cur.legend)
    nameTag.userData.set(TARGET_NAME[cur.drug])
    refreshCaption()
    card.innerHTML = cur.card
  }
  let narrow = false
  let compact = false // 窄螢幕，或舞台畫面很矮（小筆電）：用短版圖說，讓出空間給主體
  function refreshCaption() {
    if (!cur) return
    hud.caption(S.intro ? (compact ? '基準：氯吡格雷 × 正常代謝者。↓ 點下方按鈕換案例或代謝型。' : '基準：氯吡格雷 × 正常代謝者。橘色 = 吃進的藥，青綠 = 活性代謝物；切換案例或代謝型看結果怎麼變。') : compact ? cur.short : cur.caption)
  }

  buildPh()

  // ───────────────────────── 粒子邏輯 ─────────────────────────
  function launch(p) {
    p.alive = true
    p.t = 0
    p.att = null
    p.fade = 1
    p.size = 0.085
  }

  function spawn() {
    if (!cur) return
    const p = freeP()
    if (!p) return
    launch(p)
    p.a.set(INLET.x, INLET.y + rnd(-0.3, 0.3), rnd(-0.15, 0.15))
    if (cur.alt) {
      // 替代藥：繞過肝臟酵素，直接飛往目標
      p.state = 'alt'
      p.col0.copy(C.alt)
      p.att = visTarget.attach()
      p.b.set(0, 0, 0)
      p.c.set(-1.4, 2.5, 0.5)
      p.dur = 3.2
      return
    }
    if (cur.divert && Math.random() < 0.7) {
      p.state = 'div'
      p.col0.copy(C.drug)
      p.b.copy(CES)
      p.c.set(-4.7, 0.3, 0.3)
      p.dur = 1.1
      return
    }
    p.state = 'in'
    p.slot = Math.floor(Math.random() * 8)
    p.col0.copy(C.drug)
    p.b.copy(fronts[p.slot])
    p.c.set((p.a.x + p.b.x) / 2, p.b.y + rnd(-0.3, 0.7), 0.55)
    p.dur = rnd(1.3, 1.7)
  }

  function toOut1(p, color) {
    p.state = 'out1'
    p.t = 0
    p.dur = 0.75
    p.a.copy(fronts[p.slot])
    p.b.set(EXIT.x, EXIT.y + rnd(-0.18, 0.18), EXIT.z + rnd(-0.1, 0.1))
    p.c.set((p.a.x + p.b.x) / 2, p.a.y + 0.55, 0.65)
    p.col0.copy(color)
  }
  function toFail(p, sinkColor = true) {
    p.state = 'fail'
    p.t = 0
    p.dur = 1.3
    p.a.copy(fronts[p.slot])
    p.b.set(p.a.x + rnd(0.5, 1.3), -0.55, 0.3)
    p.c.set(p.a.x + 0.3, p.a.y - 0.2, 0.7)
  }
  function resolve(p) {
    const active = reactor.isActive(p.slot)
    reactor.hit(p.slot)
    const ok = active || Math.random() < cur.residual
    if (cur.route === 'prodrug') {
      if (ok) {
        toOut1(p, C.metab)
        if (Math.random() < cur.extra) {
          const q = freeP()
          if (q) {
            launch(q)
            q.slot = p.slot
            toOut1(q, C.metab)
            q.t = -0.25 // 稍晚出發
          }
        }
      } else {
        p.col0.copy(C.drug)
        toFail(p)
      }
    } else if (ok) {
      p.col0.copy(C.drug)
      toFail(p) // 被 CYP2C9 清除 → 變灰、離開
    } else {
      toOut1(p, C.drug)
    }
  }
  function toOut2(p) {
    p.state = 'out2'
    p.t = 0
    p.a.copy(p.pos)
    p.att = visTarget.attach()
    p.att.getPos(p.b)
    p.c.set((p.a.x + p.b.x) / 2, Math.max(p.a.y, p.b.y) + 0.35, 0.5)
    p.dur = 1.45
  }
  function kill(p) {
    p.alive = false
  }

  function stepParticles(dt) {
    for (const p of P) {
      if (!p.alive) continue
      p.t += dt
      if (p.t < 0) {
        p.fade = 0
        continue
      }
      const u = Math.min(1, p.t / p.dur)
      p.fade = 1
      p.size = 0.085
      p.col.copy(p.col0)
      switch (p.state) {
        case 'in': {
          bez(p, u, p.pos)
          p.fade = Math.min(1, p.t * 4)
          if (u >= 1) {
            p.state = 'react'
            p.t = 0
            p.dur = 0.4
          }
          break
        }
        case 'react': {
          p.pos.copy(fronts[p.slot])
          p.pos.z += 0.08
          p.size = 0.085 * (1 + 0.7 * Math.sin(u * Math.PI))
          if (p.t >= p.dur) resolve(p)
          break
        }
        case 'out1': {
          bez(p, u, p.pos)
          if (u >= 1) toOut2(p)
          break
        }
        case 'out2': {
          p.att.getPos(p.b)
          bez(p, u, p.pos)
          if (u >= 1) {
            visTarget.arrive(p.att)
            kill(p)
          }
          break
        }
        case 'alt': {
          p.att.getPos(p.b)
          bez(p, u, p.pos)
          p.fade = Math.min(1, p.t * 4)
          if (u >= 1) {
            visTarget.arrive(p.att)
            kill(p)
          }
          break
        }
        case 'fail': {
          bez(p, u, p.pos)
          p.col.copy(p.col0).lerp(C.gray, util.smoothstep(0, 0.6, u))
          p.fade = 1 - util.smoothstep(0.7, 1, u)
          if (u >= 1) kill(p)
          break
        }
        case 'div': {
          bez(p, u, p.pos)
          p.fade = Math.min(1, p.t * 4)
          p.col.copy(p.col0).lerp(C.gray, util.smoothstep(0.55, 1, u))
          if (u >= 1) kill(p)
          break
        }
      }
    }
  }

  function writeParticles() {
    // 只寫入還活著、看得見的粒子，並把 instance count 縮到那個數量（不再每幀畫 240 個「藏起來」的球）
    let n = 0
    for (let i = 0; i < NPART; i++) {
      const p = P[i]
      if (!p.alive || p.fade <= 0.001) continue
      dummy.position.copy(p.pos)
      dummy.scale.setScalar(p.size * p.fade)
      dummy.updateMatrix()
      pCore.setMatrixAt(n, dummy.matrix)
      pCore.setColorAt(n, p.col)
      dummy.scale.multiplyScalar(2.1)
      dummy.updateMatrix()
      pHalo.setMatrixAt(n, dummy.matrix)
      pHalo.setColorAt(n, p.col)
      n++
    }
    pCore.count = pHalo.count = n
    pCore.instanceMatrix.needsUpdate = true
    pHalo.instanceMatrix.needsUpdate = true
    if (pCore.instanceColor) pCore.instanceColor.needsUpdate = true
    if (pHalo.instanceColor) pHalo.instanceColor.needsUpdate = true
  }

  // ───────────────────────── 取景與 HUD 版面 ─────────────────────────
  // 主體（肝細胞 + 目標 + 效果計）的世界座標範圍；HUD（上方按鈕列、下方圖例 + 圖說）會佔掉舞台上下兩帶，
  // 所以以「扣掉 HUD 之後的空白帶」為取景區，讓主體完整落在不被遮住的地方（手機與桌機皆然）。
  const X_MIN = -4.95
  const X_MAX = 2.85
  const Y_MIN = -1.8
  const Y_MAX = 2.3
  const captionEl = ctx.el.querySelector('.hud-caption')
  const legendEl = ctx.el.querySelector('.hud-legend')
  const hudTop = ctx.el.querySelector('.hud-top')
  const badgeEl = ctx.el.querySelector('.hud-badge')
  function styleHud() {
    const fs = narrow ? 12 : 13.5
    if (captionEl) Object.assign(captionEl.style, { padding: '6px 10px', lineHeight: '1.45', fontSize: fs + 'px', minHeight: Math.ceil((compact && !narrow ? 1 : 2) * fs * 1.45 + 14) + 'px' })
    if (legendEl) Object.assign(legendEl.style, { fontSize: (narrow ? 11 : 12) + 'px', padding: narrow ? '2px 8px' : '3px 10px', gap: '1px 10px', marginTop: 'auto', marginBottom: '5px' })
    if (badgeEl) Object.assign(badgeEl.style, { fontSize: narrow ? '11px' : '12px', padding: narrow ? '3px 8px' : '4px 10px', letterSpacing: '0.04em' })
    phBox.root.style.gridTemplateColumns = narrow ? '1fr' : '5fr 3fr'
    hud.badge(narrow ? '示意模型' : '示意模型 · 非實測 · 非用藥建議')
    // 窄螢幕：場景縮得比較小，標籤整組放大才讀得到
    const k = narrow ? 1.32 : 1
    for (const g of tagWraps) g.scale.setScalar(k)
    cesWrap.scale.setScalar(narrow ? 1.08 : 1) // 窄螢幕時避免與肝細胞標籤右下角相碰
    for (const t of Object.values(targets)) t.setTagScale(k)
    reactor.setTagScale(k)
    gauge.setTagScale(k)
  }
  function measure(h) {
    let T = 46
    let B = narrow ? 100 : 100
    const vr = ctx.view.getBoundingClientRect()
    if (vr.height > 40) {
      if (hudTop) T = hudTop.getBoundingClientRect().bottom - vr.top + 6
      const firstEl = legendEl && !legendEl.hidden ? legendEl : captionEl
      if (firstEl && !firstEl.hidden) B = vr.bottom - firstEl.getBoundingClientRect().top + 6
    }
    return { T: Math.min(T, h * 0.3), B: Math.min(B, h * 0.5) }
  }
  let framedKey = ''
  function frame(w, h, first = false) {
    if (!w || !h) return
    const aspect = w / h
    const nn = aspect < 1.25
    const cc = nn || h < 440
    if (nn !== narrow || cc !== compact || first) {
      narrow = nn
      compact = cc
      styleHud()
      refreshCaption()
      if (cur) {
        cur.legend = derive().legend // 圖例文字在窄螢幕用短版
        hud.legend(cur.legend)
      }
    }
    const { T, B } = measure(h)
    const key = [w, h, Math.round(T), Math.round(B)].join(',')
    if (!first && key === framedKey) return
    framedKey = key
    const vfov = THREE.MathUtils.degToRad(camera.fov)
    const pad = 1.06
    const free = Math.max(60, h - T - B)
    const hView = Math.max(((Y_MAX - Y_MIN) * pad * h) / free, ((X_MAX - X_MIN) * pad) / aspect)
    const dist = hView / 2 / Math.tan(vfov / 2)
    const shift = (((T - B) / 2) / h) * hView // 主體要落在空白帶正中央 → 目標點上移，主體下移
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect)
    const r = dist * Math.sin(Math.min(vfov, hfov) / 2)
    ctx.setFrame(V3((X_MIN + X_MAX) / 2, (Y_MIN + Y_MAX) / 2 + shift, 0), r, first ? { azimuth: 0, elevation: 0.2, padding: 1 } : { padding: 1 })
  }
  {
    const w0 = ctx.view.clientWidth || 800
    const h0 = ctx.view.clientHeight || 600
    narrow = w0 / h0 < 1.25
    compact = narrow || h0 < 440
    styleHud()
  }

  // 桌機的舞台是 sticky 的：整個 stage（畫面 + 控制項 + 圖說）必須塞得進視窗，否則底下的控制項與 CPIC 摘要卡會被切掉。
  // 控制項不捲動，改由這裡把 3D 畫面的高度縮到剛好（手機版面的舞台不是 sticky，維持原本高度）。
  const stageEl = ctx.view.closest('.stage')
  const figEl = stageEl && stageEl.querySelector('.stage-figcap')
  function fitStage() {
    if (!stageEl || !stageEl.offsetHeight) return
    let maxH = ''
    let minH = ''
    if (figEl) figEl.style.display = ''
    const desktop = window.innerWidth > 980
    // 桌機不做控制項內部捲動；手機/平板清掉行內覆寫，讓核心的 max-height + overflow:auto 生效
    ui.root.style.maxHeight = desktop ? 'none' : ''
    ui.root.style.overflow = desktop ? 'visible' : ''
    if (desktop) {
      let other = stageEl.offsetHeight - ctx.view.offsetHeight // 控制項 + 圖說 + 邊框
      const avail = window.innerHeight - 60 - 14 - 12 // --nav-h + sticky 間距 + 底部留白
      // 視窗很矮時，寧可隱藏最下面的操作提示（舞台內的圖說與徽章已有同樣的提示），也要讓 3D 畫面保有足夠高度
      if (figEl && avail - other < 330) {
        other -= figEl.offsetHeight
        figEl.style.display = 'none'
      }
      const mh = Math.round(Math.max(230, Math.min(avail - other, 0.54 * window.innerHeight)))
      maxH = mh + 'px'
      minH = Math.min(300, mh) + 'px'
    }
    if (ctx.view.style.maxHeight !== maxH) ctx.view.style.maxHeight = maxH
    if (ctx.view.style.minHeight !== minH) ctx.view.style.minHeight = minH
  }
  // 在 ResizeObserver 回呼裡直接改 view 的尺寸會觸發 "ResizeObserver loop" 錯誤，所以延到下一個 frame 再做（合併重複請求）
  let fitRaf = 0
  const fitSoon = () => {
    if (fitRaf) return
    fitRaf = requestAnimationFrame(() => {
      fitRaf = 0
      fitStage()
    })
  }
  window.addEventListener('resize', fitSoon)
  const fitRO = typeof ResizeObserver === 'function' ? new ResizeObserver(fitSoon) : null
  if (fitRO) fitRO.observe(ui.root)
  fitSoon()

  // ───────────────────────── 懸停說明 ─────────────────────────
  // HUD 上的「暫停 / 重設視角」按鈕位在 3D 畫面裡：按下時 pointerdown 會冒泡到 OrbitControls，它會 setPointerCapture,
  // 讓 click 被改派給畫面而不是按鈕（結果按鈕沒反應）。在按鈕上擋掉 pointerdown 的冒泡即可（核心層的問題，見回報）。
  const hudBtns = [...ctx.el.querySelectorAll('.hud-actions button')]
  const stopDown = (e) => e.stopPropagation()
  for (const b of hudBtns) b.addEventListener('pointerdown', stopDown)

  // 不可見的點選區（material.visible=false：不畫，但 Raycaster 仍會命中）
  const gaugeHit = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.3, 0.6), new THREE.MeshBasicMaterial({ visible: false }))
  gaugeHit.position.set(0, 0.1, 0)
  gauge.group.add(gaugeHit)
  const hotspots = () => [reactor.shell, visTarget.hotspot, gaugeHit]
  const offPointer = ctx.onPointer((type, e, ptr) => {
    if (type === 'leave' || type === 'cancel') {
      // 觸控：手指離開後 Stage 會立刻清掉說明；點過的說明要留幾秒（這個 handler 在 Stage 清除之後才執行）
      if (type === 'leave' && ctx.coarsePointer && keepTip) hud.tip(keepTip.html, keepTip.x, keepTip.y)
      else {
        hud.tip(null)
        tipKind = null
      }
      return
    }
    if (type !== 'move' && type !== 'click') return
    if (ctx.coarsePointer && type === 'move') return
    const hits = ctx.pick(hotspots(), false)
    if (!hits.length) {
      if (tipKind || keepTip) clearTip()
      return
    }
    const o = hits[0].object
    const kind = o === reactor.shell ? 'liver' : o === gaugeHit ? 'gauge' : 'target'
    tipKind = kind
    hud.tip(cur.tip[kind], ptr.px, ptr.py)
    if (ctx.coarsePointer && type === 'click') {
      keepTip = { html: cur.tip[kind], x: ptr.px, y: ptr.py }
      keepTipT = 5
    }
  })

  apply()
  frame(ctx.view.clientWidth || 800, ctx.view.clientHeight || 600, true)

  // ───────────────────────── 模擬 ─────────────────────────
  let spawnAcc = 0
  let simT = 0
  function step(dt) {
    // 減少動態：只放慢「氛圍」動態（血流、循環、受體漂浮、粒子流速）；控制項觸發的狀態轉換（damp）仍用真實 dt
    const rm = ctx.reducedMotion
    simT += dt * (rm ? 0.3 : 1)
    spawnAcc += dt * (rm ? 0.6 : 1)
    const interval = 0.15 / Math.max(0.2, cur.rate)
    while (spawnAcc >= interval) {
      spawnAcc -= interval
      spawn()
    }
    stepParticles(dt * (rm ? 0.6 : 1))
    reactor.update(dt, simT)
    visTarget.update(dt, simT)
    gauge.update(dt, simT)
  }
  for (let i = 0; i < 100; i++) step(1 / 30) // 預熱，讓第一幀就有粒子在流動
  writeParticles()

  return {
    update(dt, t) {
      step(dt)
      writeParticles()
      if (keepTip && (keepTipT -= dt) <= 0) clearTip()
      dust.rotation.y = Math.sin(t * 0.05) * 0.1 * ctx.motion
    },
    onStep(i) {
      const s = STEPS[Math.min(i, STEPS.length - 1)]
      if (!s) return
      const patch = { drug: s.drug, adjust: !!s.adjust, intro: !!s.intro }
      if (s.drug === 'clop') patch.ph = { ...S.ph, clop: s.ph }
      if (s.drug === 'code') patch.ph = { ...S.ph, code: s.ph }
      if (s.drug === 'warf') {
        patch.v = s.v
        patch.c = s.c
      }
      if (s.drug === 'clop') patch.ind = 'acs'
      setState(patch)
    },
    onResize(w, h) {
      frame(w, h)
    },
    onResetView() {
      // Stage.setFrame 每次都會把「回到初始視角」改成目前（可能已被使用者旋轉）的視角；
      // 所以按下重設時，自己重新以標準角度取景一次
      framedKey = ''
      frame(ctx.view.clientWidth || 800, ctx.view.clientHeight || 600, true)
    },
    dispose() {
      offPointer && offPointer()
      for (const b of hudBtns) b.removeEventListener('pointerdown', stopDown)
      window.removeEventListener('resize', fitSoon)
      if (fitRO) fitRO.disconnect()
      if (fitRaf) cancelAnimationFrame(fitRaf)
    },
  }
}
