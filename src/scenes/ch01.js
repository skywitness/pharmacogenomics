// ch01 場景「藥物反應人群」
// 一群 60 位（模擬示意）的人吃下同一顆藥，結果卻各不相同；換不同的因素把人分組，看誰能把結果「分乾淨」。
// 所有人物、結果都是程式產生的示意資料（見 ./ch01/data.js），不是真實統計，畫面與文字都有標示。
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { N, OUT, FACTORS, FACTOR_KEYS, makePeople, purity, AGE_TXT, WEIGHT_TXT, ORGAN_TXT, COMED_TXT, GENO_TXT } from './ch01/data.js'

export const options = { fov: 42, camera: [0, 7, 9], target: [0, 0.4, 0], zoom: false, orbit: true, minPolarAngle: 0.3, maxPolarAngle: 1.3, exposure: 1.1, envIntensity: 0.55 }

const TAU = Math.PI * 2
const EL = 0.86 // 預設仰角
const PS = 0.85 // 人形縮放
const MOVE_DUR = 1.15

export default function create(ctx) {
  const { THREE, util, palette, scene, camera, controls, ui, hud } = ctx
  const { COLORS, hex } = palette
  const { clamp, lerp, damp, smoothstep, easeInOut, easeOutCubic, easeOutBack } = util
  const people = makePeople()
  const motion = ctx.motion
  util.addStudioLights(scene, { intensity: 1.05 })

  const NEUTRAL = new THREE.Color(0x7088c8)
  const PAD_NEUTRAL = new THREE.Color(0x2c4380)
  const outCol = OUT.map((o) => new THREE.Color(o.color))
  const dummy = new THREE.Object3D()
  const WARN_HI = new THREE.Color(0xffd0d0)
  const rand = util.rng(21)

  // ───────────── 地面 ─────────────
  const groundTex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 512
    const g = c.getContext('2d')
    const grd = g.createRadialGradient(256, 256, 0, 256, 256, 256)
    grd.addColorStop(0, 'rgba(70,110,210,0.55)')
    grd.addColorStop(0.55, 'rgba(38,62,140,0.32)')
    grd.addColorStop(1, 'rgba(20,34,90,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 512, 512)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9.5, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: groundTex, transparent: true, depthWrite: false }))
  ground.renderOrder = -2
  scene.add(ground)

  const ringLines = [2.3, 3.35, 4.4].map((r) => {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.02, r + 0.02, 96).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: COLORS.cyan, transparent: true, opacity: 0.16, depthWrite: false }))
    m.position.y = 0.005
    m.renderOrder = -1
    scene.add(m)
    return m
  })

  const dust = util.createParticles({ count: 180, spread: [22, 9, 22], size: 0.07, color: 0x8fb4ff, opacity: 0.5, seed: 8 })
  dust.position.y = 3
  scene.add(dust)

  // ───────────── 人物（InstancedMesh）─────────────
  const bodyGeo = new THREE.CapsuleGeometry(0.17, 0.34, 6, 14).translate(0, 0.37, 0)
  const headGeo = new THREE.SphereGeometry(0.15, 18, 14).translate(0, 0.86, 0)
  const personGeo = mergeGeometries([bodyGeo, headGeo])
  bodyGeo.dispose()
  headGeo.dispose()
  const emissiveFromInstance = (mat, k) => {
    // 兩種材質的 shader 文字不同（常數 k），快取鍵必須不同，否則會共用同一支 program
    mat.customProgramCacheKey = () => 'ch01-inst-emissive-' + k.toFixed(2)
    mat.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n#ifdef USE_COLOR\n totalEmissiveRadiance += vColor.rgb * ${k.toFixed(2)};\n#endif`)
    }
  }
  const personMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.02 })
  emissiveFromInstance(personMat, 0.26)
  const peopleMesh = new THREE.InstancedMesh(personGeo, personMat, N)
  peopleMesh.frustumCulled = false
  peopleMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 30)
  scene.add(peopleMesh)

  const padMesh = new THREE.InstancedMesh(new THREE.CircleGeometry(0.3, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false }), N)
  padMesh.frustumCulled = false
  padMesh.renderOrder = 1
  scene.add(padMesh)

  const glowPadMesh = new THREE.InstancedMesh(
    new THREE.PlaneGeometry(1.5, 1.5).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: util.glowTexture(), color: 0xffffff, transparent: true, opacity: 0.4, depthWrite: false, blending: THREE.AdditiveBlending }),
    N
  )
  glowPadMesh.frustumCulled = false
  glowPadMesh.renderOrder = 2
  scene.add(glowPadMesh)

  // 標記：有效 = 上升光環 / 沒效 = 橫線 / 副作用 = 閃爍警示三角（不只靠顏色，色覺辨識友善）
  const haloMesh = new THREE.InstancedMesh(new THREE.TorusGeometry(0.26, 0.03, 6, 20).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: outCol[0] }), N * 2)
  const dashMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.36, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: outCol[1] }), N)
  const warnMat = new THREE.MeshBasicMaterial({ color: outCol[2] })
  const warnMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.18, 0.32, 3), warnMat, N)
  // 個別化用藥後「改善」的人：青色圓環 + 上箭頭（持續顯示，才看得出誰變好了）
  const ADJ_COL = new THREE.Color(0x9be8ff)
  const adjRingMesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.33, 0.47, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: ADJ_COL, transparent: true, opacity: 0.95, depthWrite: false }), N)
  const adjArrowMesh = new THREE.InstancedMesh(new THREE.ConeGeometry(0.17, 0.36, 4), new THREE.MeshBasicMaterial({ color: ADJ_COL }), N)
  for (const m of [haloMesh, dashMesh, warnMesh, adjRingMesh, adjArrowMesh]) {
    m.frustumCulled = false
    m.renderOrder = 3
    scene.add(m)
  }

  // ───────────── 藥丸與小藥丸 ─────────────
  const pillG = new THREE.Group()
  const pill = util.createPill({ length: 2.1, radius: 0.58, colorA: COLORS.drug, colorB: 0xfff3dc })
  pillG.add(pill)
  const pillGlow = util.makeGlow(COLORS.drug, 6.5, 0.6)
  pillG.add(pillGlow)
  pillG.position.set(0, 1.9, 0)
  scene.add(pillG)
  const pillLight = new THREE.PointLight(COLORS.drug, 26, 10, 1.7)
  pillLight.position.set(0, 2.4, 0)
  scene.add(pillLight)
  const pedestal = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.05, 8, 56).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: COLORS.drug, transparent: true, opacity: 0.85 }))
  pedestal.position.y = 0.04
  scene.add(pedestal)
  const pedestalGlow = util.makeGlow(COLORS.drug, 3.4, 0.5)
  pedestalGlow.position.y = 0.15
  scene.add(pedestalGlow)
  const adjOrigin = new THREE.Vector3(0, 3.5, 0)
  const adjGlow = util.makeGlow(COLORS.cyan, 3.2, 0)
  adjGlow.position.copy(adjOrigin)
  scene.add(adjGlow)

  const MAXP = 100
  const projMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0 })
  emissiveFromInstance(projMat, 0.9)
  const projMesh = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.055, 0.14, 4, 8).rotateZ(Math.PI / 2), projMat, MAXP)
  projMesh.frustumCulled = false
  projMesh.count = 0
  scene.add(projMesh)
  const DOSE_COL = new THREE.Color(0xfff1d6) // 奶白色，和「沒效」的黃灰色明顯不同

  // ───────────── 分組標籤與長條 ─────────────
  const labels = [0, 1, 2].map(() => {
    const s = util.makeLabel('　', { fontSize: 50, worldHeight: 1.75 })
    s.visible = false
    scene.add(s)
    return s
  })
  const barBackGeo = new THREE.BoxGeometry(1, 0.1, 0.5)
  const barSegGeo = new THREE.BoxGeometry(1, 0.26, 0.4)
  const bars = [0, 1, 2].map(() => {
    const g = new THREE.Group()
    const back = new THREE.Mesh(barBackGeo, new THREE.MeshBasicMaterial({ color: 0x1a2650, transparent: true, opacity: 0.85 }))
    back.position.y = 0
    g.add(back)
    const segs = OUT.map((o, k) => {
      const m = new THREE.Mesh(barSegGeo, new THREE.MeshBasicMaterial({ color: o.color }))
      m.position.y = 0.06
      g.add(m)
      return m
    })
    g.visible = false
    scene.add(g)
    return { g, back, segs, w: [0, 0, 0], W: 2.4 }
  })

  // ───────────── 人物狀態 ─────────────
  const ps = people.map((p, i) => ({
    p,
    x: 0,
    z: 0,
    sx: 0,
    sz: 0,
    tx: 0,
    tz: 0,
    delay: 0,
    revealed: false,
    revealAt: -9,
    out: p.out0,
    col: NEUTRAL.clone(),
    padCol: PAD_NEUTRAL.clone(),
    ph: rand(),
    hover: 0,
    adjS: 0,
  }))
  const order0 = (() => {
    const a = Array.from({ length: N }, (_, i) => i)
    const r = util.rng(5)
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  })()

  // ───────────── 版面 ─────────────
  const SP = 0.6
  function computeLayout(key) {
    const tx = new Float32Array(N)
    const tz = new Float32Array(N)
    if (key === 'none') {
      const rings = [[2.3, 16], [3.35, 20], [4.4, 24]]
      let k = 0
      rings.forEach(([r, n], ri) => {
        for (let s = 0; s < n; s++) {
          const a = (s / n) * TAU + ri * 0.4
          const id = order0[k++]
          tx[id] = Math.cos(a) * r
          tz[id] = Math.sin(a) * r
        }
      })
      return { key, tx, tz, clusters: [], halfW: 5.3, halfH: 4.6, cy: 0.6, cz: 0 }
    }
    const f = FACTORS[key]
    const c = SP * 0.55
    const clusters = f.groups.map((name, g) => {
      const ids = people.filter((p) => p[f.field] === g).map((p) => p.id)
      ids.sort((a, b) => people[a].out0 - people[b].out0 || a - b)
      const n = ids.length
      const pts = Array.from({ length: n }, (_, k) => {
        const rr = c * Math.sqrt(k + 0.5)
        const th = k * 2.399963
        return { x: Math.cos(th) * rr, z: Math.sin(th) * rr, ang: ((Math.atan2(Math.sin(th), Math.cos(th)) % TAU) + TAU) % TAU, r: rr }
      })
      // 依角度排序 → 各結果在圓盤上形成「派」的扇形
      pts.sort((a, b) => a.ang - b.ang || a.r - b.r)
      const rad = Math.max(...pts.map((q) => q.r)) + 0.36
      return { name, ids, pts, n, rad, cx: 0, cz: 0 }
    })
    // 三堆排成一列，置中
    const gap = 0.8
    const w = clusters.reduce((s, q) => s + q.rad * 2, 0) + gap * (clusters.length - 1)
    let x = -w / 2
    for (const q of clusters) {
      q.cx = x + q.rad
      x += q.rad * 2 + gap
      q.ids.forEach((id, k) => {
        tx[id] = q.cx + q.pts[k].x
        tz[id] = q.pts[k].z
      })
    }
    const xmax = Math.max(...clusters.map((q) => Math.abs(q.cx) + q.rad))
    const zmin = Math.min(...clusters.map((q) => q.cz - q.rad))
    const zmax = Math.max(...clusters.map((q) => q.cz + q.rad)) + 1.05 // 含前方的長條
    const halfH = ((zmax - zmin) * Math.sin(EL) + 2.7 * Math.cos(EL)) / 2 + 0.35
    return { key, tx, tz, clusters, halfW: xmax + 0.45, halfH, cy: 0.5, cz: (zmin + zmax) / 2 }
  }

  let layout = computeLayout('none')
  let moveT0 = -99
  let now = 0
  let factor = 'none'
  let taken = false
  let adjust = false
  let dosingT0 = -99
  let pillScale = 1
  let dirty = true
  let tipUntil = 0
  let hoverId = -1
  let lastAspect = 0
  ps.forEach((q, i) => {
    q.tx = q.sx = q.x = layout.tx[i]
    q.tz = q.sz = q.z = layout.tz[i]
  })

  // ───────────── 取景 / 鏡頭動畫 ─────────────
  let dolly = null
  const REF = new THREE.Vector3(0, 0, 1)
  const qTmp = new THREE.Quaternion()
  function frameFor(L) {
    const a = camera.aspect || 1.33
    const R = a >= 1 ? Math.max(L.halfW / a, L.halfH) : Math.max(L.halfW, L.halfH * a)
    return { center: new THREE.Vector3(0, L.cy, L.cz), R }
  }
  // angle=false：只重算距離，保留使用者旋轉出來的視角（視窗縮放時用）
  function applyFrame(L, animate, angle = true) {
    const { center, R } = frameFor(L)
    const offOld = camera.position.clone().sub(controls.target)
    const tgtOld = controls.target.clone()
    const padding = L.key === 'none' ? (compact ? (camera.aspect > 1.2 ? 1.2 : 1.36) : 1.16) : compact ? 1.08 : 1.06
    ctx.setFrame(center, R, angle ? { azimuth: 0.0, elevation: EL, padding } : { padding })
    lastAspect = camera.aspect
    if (animate) {
      const offNew = camera.position.clone().sub(controls.target)
      dolly = {
        t0: now,
        dur: 1.2,
        qOld: new THREE.Quaternion().setFromUnitVectors(REF, offOld.clone().normalize()),
        qNew: new THREE.Quaternion().setFromUnitVectors(REF, offNew.clone().normalize()),
        lenOld: offOld.length(),
        lenNew: offNew.length(),
        tgtOld,
        tgtNew: controls.target.clone(),
      }
      camera.position.copy(tgtOld).add(offOld)
      controls.target.copy(tgtOld)
    }
  }

  // 窄螢幕（手機）HUD 精簡：圖例與說明字級縮小（圖例位置由核心版面沉到底部），主體才不會被遮住
  const hudLegend = ctx.el.querySelector('.hud-legend')
  const hudCaption = ctx.el.querySelector('.hud-caption')
  const hudTip = ctx.el.querySelector('.hud-tooltip')
  let compact = null
  let hudKey = ''
  function applyHudMode(w, h) {
    const c = w < 560 || h < 540
    const key = `${c}|${w < 560}`
    if (key === hudKey) return
    hudKey = key
    compact = c
    if (hudLegend) {
      Object.assign(hudLegend.style, c ? { padding: '3px 8px', fontSize: '0.68rem', gap: '2px 9px' } : { padding: '', fontSize: '', gap: '' })
    }
    if (hudCaption) Object.assign(hudCaption.style, w < 560 ? { fontSize: '0.76rem', lineHeight: '1.45', padding: '5px 9px' } : { fontSize: '', lineHeight: '', padding: '' })
  }
  // 把主體稍微往上推，避開底部的圖例與說明列；觸控裝置的頂端按鈕列較高，分組畫面上方的標籤要再往下移一點
  let vw = 0
  let vh = 0
  let viewDy = 0
  let viewDyT = 0
  function dyFor(key, h) {
    if (!compact) return h * 0.06
    if (!ctx.coarsePointer) return h * 0.05
    return key === 'none' ? h * 0.035 : -h * 0.035
  }
  function applyViewOffset(w, h) {
    applyHudMode(w, h)
    vw = w
    vh = h
    viewDyT = viewDy = dyFor(layout.key, h)
    camera.setViewOffset(w, h, 0, viewDy, w, h)
  }

  // ───────────── 狀態機 ─────────────
  const proj = []
  function setLayout(key) {
    layout = computeLayout(key)
    viewDyT = dyFor(key, vh)
    moveT0 = now
    ps.forEach((q, i) => {
      q.sx = q.x
      q.sz = q.z
      q.tx = layout.tx[i]
      q.tz = layout.tz[i]
      q.delay = Math.min(0.5, Math.hypot(q.tx - q.x, q.tz - q.z) * 0.05) + rand() * 0.15
    })
    applyFrame(layout, true)
    dirty = true
  }

  function launch(i, kind, delay) {
    if (proj.length >= MAXP) return
    const from = kind === 'adjust' ? adjOrigin : pillG.position
    proj.push({ i, kind, t0: now + delay, dur: 0.85 + rand() * 0.3, from: from.clone().add(new THREE.Vector3((rand() - 0.5) * 0.6, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.6)), arc: 1.0 + rand() * 1.1 })
  }
  function reveal(i) {
    const q = ps[i]
    q.revealed = true
    q.revealAt = now
    q.out = q.p.out0
    if (adjust && q.p.flip) launch(i, 'adjust', 0.8 + rand() * 0.5)
    dirty = true
  }
  function takeDrug() {
    if (taken) return
    taken = true
    dosingT0 = now
    // 由近到遠、略帶隨機的發射順序（隨機值先算好，避免排序比較函式不一致）
    const key = ps.map((q) => Math.hypot(q.tx, q.tz) + rand() * 0.8)
    const ids = Array.from({ length: N }, (_, i) => i)
    ids.sort((a, b) => key[a] - key[b])
    ids.forEach((id, k) => launch(id, 'dose', 0.55 + k * 0.03))
    dirty = true
  }
  function resetDrug() {
    taken = false
    proj.length = 0
    ps.forEach((q) => {
      q.revealed = false
      q.out = q.p.out0
    })
    dirty = true
  }
  function setAdjust(on) {
    if (on === adjust) return
    adjust = on
    if (on) {
      if (taken) {
        let k = 0
        ps.forEach((q, i) => {
          if (q.revealed && q.p.flip && q.out !== 0) launch(i, 'adjust', 0.3 + k++ * 0.14)
        })
      }
    } else {
      for (let k = proj.length - 1; k >= 0; k--) if (proj[k].kind === 'adjust') proj.splice(k, 1)
      ps.forEach((q) => {
        if (q.revealed && q.p.flip && q.out !== q.p.out0) {
          q.out = q.p.out0
          q.revealAt = now
        }
      })
    }
    dirty = true
  }
  function setFactor(key) {
    if (key === factor) return
    factor = key
    setLayout(key)
  }

  // ───────────── UI ─────────────
  hud.badge('模擬示意 · 非真實統計')
  // 圖例會隨結果顯示各類人數（見 recount），確保人數永遠看得到
  const legendItems = (c, nflip) => {
    const nm = (o) => (compact && o.key === 'bad' ? '副作用' : o.label)
    const items = OUT.map((o, k) => ({ color: o.color, label: taken ? nm(o) + ' ' + c[k] + ' ' + o.mark : nm(o) + ' ' + o.mark }))
    if (adjust) items.push({ color: ADJ_COL.getHex(), label: (compact ? '↑ 改善 ' : '↑ 調整後改善 ') + nflip })
    return items
  }
  hud.legend(legendItems([0, 0, 0], 0))
  // 圖例與說明文字由核心版面沉到底部（圖例在說明文字上方）

  const btn = ui.button({
    label: '大家一起吃藥',
    onClick: () => {
      if (!taken) takeDrug()
      else {
        resetDrug()
        takeDrug()
      }
      syncUI()
    },
  })
  const seg = ui.segmented({
    label: '用什麼因素來看這群人？',
    options: FACTOR_KEYS.map((k) => ({ value: k, label: FACTORS[k].short })),
    value: 'none',
    onChange: (k) => {
      if (!taken) takeDrug()
      setFactor(k)
      syncUI()
    },
  })
  const tg = ui.toggle({
    label: '依基因型個別化用藥（示意假設）',
    value: false,
    onChange: (on) => {
      if (on) {
        if (!taken) takeDrug()
        setFactor('geno')
      }
      setAdjust(on)
      syncUI()
    },
  })
  const gRes = ui.group('結果人數（模擬示意）')
  const rd = OUT.map((o) => gRes.readout({ label: o.label, value: '0', color: hex(o.color) }))
  const rdPurity = ui.readout({ label: '分群清楚度（示意）', value: '—' })
  const rdGroups = ui.readout({ label: '各組結果', value: '先按「大家一起吃藥」' })
  ui.note('60 位對象與所有結果都是程式產生的示意資料，不是真實統計。可拖曳旋轉，點一下（或滑過）人物看細節。')

  // 還沒吃藥時，讓主按鈕輕輕閃動，提示「從這裡開始」（尊重減少動態偏好）
  let pulse = null
  function syncPulse() {
    const b = btn.button
    if (!taken && !pulse && !ctx.reducedMotion && b && b.animate) {
      pulse = b.animate([{ boxShadow: '0 0 0 0 rgba(53,214,255,0.6)' }, { boxShadow: '0 0 0 12px rgba(53,214,255,0)' }], { duration: 1600, iterations: Infinity })
    } else if ((taken || ctx.reducedMotion) && pulse) {
      pulse.cancel()
      pulse = null
    }
  }
  function syncUI() {
    seg.set(factor)
    tg.set(adjust)
    btn.setLabel(taken ? '↻ 再吃一次' : '大家一起吃藥')
    syncPulse()
  }

  // ───────────── 計數 / 說明 ─────────────
  // 每幀只做便宜的計數；文字/DOM/貼圖只在內容真的改變時、且至少隔 0.35 秒才更新（避免 aria-live 一直被朗讀、貼圖一直重傳）
  const GOOD0 = people.filter((p) => p.out0 === 0).length
  const GOOD1 = people.filter((p) => p.out1 === 0).length
  const BASE_NONE = Math.round(purity(people, 'none', (p) => p.out0) * 100)
  const cnt = [0, 0, 0]
  const gcnt = [[0, 0, 0], [0, 0, 0], [0, 0, 0]]
  const wCnt = [-1, -1, -1]
  const wG = [-1, -1, -1, -1, -1, -1, -1, -1, -1]
  const wLab = ['', '', '']
  let counts = [0, 0, 0]
  let wMeta = ''
  let wNrev = -1
  let wAt = -9
  function recount() {
    cnt[0] = cnt[1] = cnt[2] = 0
    let nrev = 0
    let nflip = 0
    for (let i = 0; i < N; i++) {
      const q = ps[i]
      if (q.revealed) {
        cnt[q.out]++
        nrev++
        if (adjust && q.p.flip && q.out === 0) nflip++
      }
    }
    const cls = layout.clusters
    for (let k = 0; k < 3; k++) {
      gcnt[k][0] = gcnt[k][1] = gcnt[k][2] = 0
      if (k < cls.length) {
        const ids = cls[k].ids
        for (let j = 0; j < ids.length; j++) {
          const q = ps[ids[j]]
          if (q.revealed) gcnt[k][q.out]++
        }
      }
    }
    const all = nrev === N
    const meta = factor + '|' + adjust + '|' + taken + '|' + all
    let changed = dirty || meta !== wMeta || nrev !== wNrev
    if (!changed) {
      for (let k = 0; k < 3 && !changed; k++) if (cnt[k] !== wCnt[k]) changed = true
      for (let k = 0; k < 9 && !changed; k++) if (gcnt[(k / 3) | 0][k % 3] !== wG[k]) changed = true
    }
    if (!changed) return
    // 狀態（因素/吃藥/全數揭曉）改變時立刻寫入；只有人數在動的時候才節流
    const urgent = dirty || meta !== wMeta
    if (!urgent && now - wAt < 0.35) return
    wAt = now
    wMeta = meta
    wNrev = nrev
    dirty = false
    for (let k = 0; k < 3; k++) wCnt[k] = cnt[k]
    for (let k = 0; k < 9; k++) wG[k] = gcnt[(k / 3) | 0][k % 3]
    counts = [cnt[0], cnt[1], cnt[2]]
    rd.forEach((r, k) => r.set(String(cnt[k])))
    hud.legend(legendItems(cnt, nflip))
    cls.forEach((cl, k) => {
      const txt = cl.name + '\n' + cl.n + ' 人\n有效 ' + gcnt[k][0] + '/' + cl.n
      if (wLab[k] !== txt) {
        wLab[k] = txt
        labels[k].userData.setText(txt)
      }
    })
    if (cls.length) {
      rdGroups.set(cls.map((cl, k) => cl.name + '（' + cl.n + ' 人）：有效 ' + gcnt[k][0] + '・沒效 ' + gcnt[k][1] + '・副作用 ' + gcnt[k][2]).join('<br>'), { html: true })
    } else rdGroups.set(taken ? '不分組：全部混在一起' : '先按「大家一起吃藥」')
    let pct = null
    let pre = null
    if (taken && all) {
      pct = Math.round(purity(people, factor, (p) => ps[p.id].out) * 100)
      if (adjust) pre = Math.round(purity(people, factor, (p) => p.out0) * 100)
    }
    // 「不分組」的基準一律用調整前的結果，避免讀者誤以為基因分組沒比較好
    rdPurity.set(pct == null ? '—' : adjust ? '調整後 ' + pct + '%（調整前 ' + pre + '%，不分組 ' + BASE_NONE + '%）' : pct + '%（不分組時 ' + BASE_NONE + '%）')
    hud.caption(captionText(all, pct))
  }

  function captionText(all, pct) {
    const sm = compact // 手機的舞台很矮，說明字要短
    if (!taken) return sm ? '按「大家一起吃藥」或點藥丸，猜猜會怎樣？（模擬示意）' : '60 位模擬對象，同一顆藥、同一劑量。按「大家一起吃藥」（或點中央的藥丸），猜猜會怎樣？（模擬示意）'
    if (!all) return '小藥丸飛向每一個人……'
    const [g, n, b] = counts
    if (adjust) return sm ? '示意假設：有效由 ' + GOOD0 + ' 位增為 ' + GOOD1 + ' 位（+' + (GOOD1 - GOOD0) + '，青圈與箭頭標出）。真實研究的差距小得多。' : '示意假設：依基因型調整用藥後，有效的人由 ' + GOOD0 + ' 位增為 ' + GOOD1 + ' 位（+' + (GOOD1 - GOOD0) + '，青色圓環與箭頭標出的人）。真實研究（例如 PREPARE 試驗）量到的差距小得多，且因藥物與研究設計而異。'
    if (factor === 'none') return '同一顆藥、同一劑量：有效 ' + g + '、沒效 ' + n + '、嚴重副作用 ' + b + '。為什麼？（模擬示意）'
    if (factor === 'geno') return sm ? '依基因型分組：各組幾乎同色。分群清楚度 ' + pct + '%（不分組 ' + BASE_NONE + '%）。示意資料，真實世界沒這麼整齊。' : '依基因型分組：各組幾乎「同色」。分群清楚度 ' + pct + '%（不分組 ' + BASE_NONE + '%）。但這是示意，真實世界不會這麼整齊。'
    return sm ? '依「' + FACTORS[factor].label + '」分組：仍紅黃綠混雜。分群清楚度 ' + pct + '%，和不分組（' + BASE_NONE + '%）差不多，分不開。' : '依「' + FACTORS[factor].label + '」分組：各組仍紅黃綠混雜。分群清楚度 ' + pct + '%，和不分組（' + BASE_NONE + '%）差不多：有影響，但分不乾淨。下方長條是各組綠、黃、紅的比例。'
  }

  // ───────────── 指標 ─────────────
  const tipText = (i) => {
    const q = ps[i]
    const p = q.p
    return '<b>模擬對象 ' + (i + 1) + '</b>（示意）<br>年齡：' + AGE_TXT[p.age] + '・體重：' + WEIGHT_TXT[p.weight] + '<br>肝腎功能：' + ORGAN_TXT[p.organ] + '・併用藥物：' + COMED_TXT[p.comed] + '<br>基因型：' + GENO_TXT[p.geno] + '<br>結果：' + (q.revealed ? '<b style="color:' + hex(OUT[q.out].color) + '">' + OUT[q.out].label + '</b>' : '尚未服藥')
  }
  // 提示框預設出現在指標上方；太靠近上緣時改放到指標下方，避免蓋住左上角的圖例/徽章
  function placeTip(py) {
    if (!hudTip || hudTip.hidden) return
    const th = hudTip.offsetHeight
    if (py - 10 - th < 44) hudTip.style.top = py + 22 + 'px'
  }
  const offPointer = ctx.onPointer((type, e, ptr) => {
    if (type === 'down') dolly = null
    if (type === 'move' || type === 'click') {
      if (ptr.down && type === 'move') {
        hoverId = -1
        hud.tip(null)
        return
      }
      // 還沒吃藥時，中央的藥丸本身也可以點
      if (!taken) {
        const ph = ctx.pick([pill], true)
        if (ph.length) {
          ctx.setCursor('pointer')
          hoverId = -1
          hud.tip(null)
          if (type === 'click') {
            takeDrug()
            syncUI()
          }
          return
        }
      }
      const hits = ctx.pick([peopleMesh], false)
      const id = hits.length && hits[0].instanceId != null ? hits[0].instanceId : -1
      hoverId = id
      ctx.setCursor(id >= 0 ? 'pointer' : '')
      if (id >= 0) {
        hud.tip(tipText(id), ptr.px, ptr.py)
        placeTip(ptr.py)
        if (ctx.coarsePointer || type === 'click') tipUntil = now + 3.2
      } else hud.tip(null)
    } else if (type === 'leave' || type === 'cancel') {
      hoverId = -1
      if (!ctx.coarsePointer) hud.tip(null)
    }
  })

  // ───────────── 初始 ─────────────
  applyViewOffset(ctx.size.w || 800, ctx.size.h || 600)
  applyFrame(layout, false)
  syncUI()
  recount()

  const tmpV = new THREE.Vector3()
  const tmpV2 = new THREE.Vector3()
  const pA = new THREE.Vector3()
  const pB = new THREE.Vector3()
  const X = new THREE.Vector3(1, 0, 0)
  const MESHES = [peopleMesh, padMesh, glowPadMesh, haloMesh, dashMesh, warnMesh, adjRingMesh, adjArrowMesh]
  const setM = (mesh, idx, x, y, z, s, ry = 0) => {
    dummy.position.set(x, y, z)
    dummy.rotation.set(0, ry, 0)
    dummy.scale.setScalar(Math.max(s, 0.0001))
    dummy.updateMatrix()
    mesh.setMatrixAt(idx, dummy.matrix)
  }
  // 小藥丸的拋物線位置（寫進 out，不配置新物件）
  const arcInto = (out, q, tgt, ee) => out.set(lerp(q.from.x, tgt.x, ee), lerp(q.from.y, 0.95 * PS, ee) + Math.sin(Math.PI * ee) * q.arc, lerp(q.from.z, tgt.z, ee))
  const STEPS = [
    { taken: false, factor: 'none', adjust: false },
    { taken: true, factor: 'none', adjust: false },
    { taken: true, factor: 'age', adjust: false },
    { taken: true, factor: 'geno', adjust: false },
    { taken: true, factor: 'geno', adjust: true },
  ]

  return {
    onResize(w, h) {
      const was = compact
      applyViewOffset(w, h)
      if (was !== compact) dirty = true
      if (was !== compact || Math.abs(camera.aspect - lastAspect) > 0.03) applyFrame(layout, false, false)
    },
    onStep(i) {
      const st = STEPS[clamp(i, 0, 4)]
      if (!st.taken) {
        if (taken) resetDrug()
        setAdjust(false)
        setFactor(st.factor)
      } else {
        if (!st.adjust) setAdjust(false)
        setFactor(st.factor)
        takeDrug()
        if (st.adjust) setAdjust(true)
      }
      syncUI()
    },
    update(dt, t) {
      now = t
      const m = motion

      // 鏡頭動畫（用四元數球面內插方向，使用者轉到反面也不會穿過原點）
      if (dolly) {
        const u = clamp((now - dolly.t0) / dolly.dur, 0, 1)
        const e = easeInOut(u)
        tmpV.copy(dolly.tgtOld).lerp(dolly.tgtNew, e)
        controls.target.copy(tmpV)
        qTmp.slerpQuaternions(dolly.qOld, dolly.qNew, e)
        const cur = tmpV2.copy(REF).applyQuaternion(qTmp)
        camera.position.copy(tmpV).addScaledVector(cur, lerp(dolly.lenOld, dolly.lenNew, e))
        if (u >= 1) dolly = null
      }

      // 藥丸
      const dosing = taken ? clamp((now - dosingT0 - 0.45) / 2.0, 0, 1) : 0
      const targetScale = taken ? 1 - smoothstep(0, 1, dosing) : 1
      pillScale = taken ? targetScale : damp(pillScale, 1, 5, dt)
      const shake = taken && now - dosingT0 < 0.5 ? Math.sin(now * 60) * 0.06 * (m > 0.5 ? 1 : 0.2) : 0
      pillG.visible = pillScale > 0.01
      pillG.scale.setScalar(Math.max(pillScale, 0.0001) * (0.6 + 0.4 * Math.min(1, pillScale * 3)))
      pillG.position.set(shake, 1.95 + Math.sin(now * 1.3 * m) * 0.12, 0)
      pill.rotation.set(0.4 + now * 0.35 * m, now * 0.6 * m, 0.5)
      pillGlow.material.opacity = 0.5 + 0.12 * Math.sin(now * 2) * m
      pillLight.intensity = 26 * pillScale
      pedestal.visible = pedestalGlow.visible = pillScale > 0.05
      pedestal.material.opacity = 0.85 * pillScale
      pedestalGlow.material.opacity = 0.5 * pillScale
      let adjPending = 0
      for (let k = 0; k < proj.length; k++) if (proj[k].kind === 'adjust') adjPending++
      adjGlow.material.opacity = damp(adjGlow.material.opacity, adjPending ? 0.85 : 0, 6, dt)
      adjGlow.visible = adjGlow.material.opacity > 0.01
      dust.rotation.y = now * 0.02 * m

      // 視窗偏移平滑過渡（換分組時不要瞬間跳動）
      if (vh && Math.abs(viewDy - viewDyT) > 0.05) {
        viewDy = damp(viewDy, viewDyT, 5, dt)
        camera.setViewOffset(vw, vh, 0, viewDy, vw, vh)
      }

      // 環狀線淡入淡出
      const ringOn = layout.key === 'none' ? 0.16 : 0
      for (let k = 0; k < ringLines.length; k++) ringLines[k].material.opacity = damp(ringLines[k].material.opacity, ringOn, 4, dt)

      // 小藥丸
      let np = 0
      for (let k = proj.length - 1; k >= 0; k--) {
        const q = proj[k]
        const u = (now - q.t0) / q.dur
        if (u >= 1) {
          if (q.kind === 'dose') reveal(q.i)
          else {
            const pq = ps[q.i]
            pq.out = 0
            pq.revealAt = now
            dirty = true
          }
          proj.splice(k, 1)
        }
      }
      for (let k = 0; k < proj.length; k++) {
        const q = proj[k]
        if (np >= MAXP) break
        const u = (now - q.t0) / q.dur
        const col = q.kind === 'adjust' ? ADJ_COL : DOSE_COL
        if (u < 0) {
          // 尚未發射：藏在藥丸位置（縮到看不見）
          setM(projMesh, np, q.from.x, q.from.y, q.from.z, 0)
          projMesh.setColorAt(np, col)
          np++
          continue
        }
        const tgt = ps[q.i]
        const e = easeInOut(clamp(u, 0, 1))
        arcInto(pA, q, tgt, e)
        arcInto(pB, q, tgt, Math.min(1, e + 0.04)).sub(pA)
        dummy.position.copy(pA)
        if (pB.lengthSq() > 1e-8) dummy.quaternion.setFromUnitVectors(X, pB.normalize())
        dummy.scale.setScalar(1.15 - 0.3 * e)
        dummy.updateMatrix()
        projMesh.setMatrixAt(np, dummy.matrix)
        projMesh.setColorAt(np, col)
        np++
      }
      projMesh.count = np
      projMesh.instanceMatrix.needsUpdate = true
      if (projMesh.instanceColor) projMesh.instanceColor.needsUpdate = true

      // 人物
      const kc = 1 - Math.exp(-9 * dt)
      const flash = m > 0.5 ? 0.5 + 0.5 * Math.sin(now * 9) : 0.5
      warnMat.color.copy(outCol[2]).lerp(WARN_HI, flash * 0.55)
      for (let i = 0; i < N; i++) {
        const q = ps[i]
        const u = clamp((now - moveT0 - q.delay) / MOVE_DUR, 0, 1)
        const e = easeInOut(u)
        q.x = lerp(q.sx, q.tx, e)
        q.z = lerp(q.sz, q.tz, e)
        const moving = u > 0 && u < 1
        const hop = moving ? Math.sin(Math.PI * u) * 0.3 : 0
        const idle = !moving ? Math.sin(now * 1.7 + i * 1.3) * 0.022 * m : 0
        const pop = q.revealed ? clamp((now - q.revealAt) / 0.8, 0, 1) : 0
        let bounce = 0
        let jitter = 0
        if (q.revealed && pop < 1) {
          if (q.out === 0) bounce = Math.sin(Math.PI * clamp(pop * 1.8, 0, 1)) * 0.32
          else if (q.out === 2) jitter = Math.sin(now * 55) * 0.05 * (1 - pop) * (m > 0.5 ? 1 : 0.2)
        }
        const hv = hoverId === i ? 1 : 0
        q.hover = damp(q.hover, hv, 14, dt)
        const s = PS * (1 + 0.16 * q.hover)
        setM(peopleMesh, i, q.x + jitter, hop + idle + bounce, q.z, s)

        // 顏色
        const tgtCol = q.revealed ? outCol[q.out] : NEUTRAL
        q.col.lerp(tgtCol, kc)
        peopleMesh.setColorAt(i, q.col)
        const tgtPad = q.revealed ? outCol[q.out] : PAD_NEUTRAL
        q.padCol.lerp(tgtPad, kc)
        padMesh.setColorAt(i, q.padCol)
        glowPadMesh.setColorAt(i, q.padCol)

        const flashPad = q.revealed ? 1 + (1 - easeOutCubic(pop)) * 0.9 : 1
        setM(padMesh, i, q.x, 0.02, q.z, PS * flashPad * (1 + 0.15 * q.hover))
        const gs = q.revealed ? (0.7 + 0.5 * easeOutBack(clamp(pop * 1.2, 0, 1))) * (q.out === 0 ? 1 : 0.85) : 0
        setM(glowPadMesh, i, q.x, 0.015, q.z, PS * gs * 1.2)

        // 標記
        const pp = q.revealed ? easeOutBack(clamp(pop * 1.4, 0, 1)) : 0
        if (q.revealed && q.out === 0) {
          for (let h = 0; h < 2; h++) {
            const fr = (now * 0.5 * (m > 0.5 ? 1 : 0.3) + q.ph + h * 0.5) % 1
            const sc = PS * (1 - 0.5 * smoothstep(0.7, 1, fr)) * clamp(pp, 0, 1)
            setM(haloMesh, i * 2 + h, q.x, 0.08 + fr * 0.98 * PS + hop + idle, q.z, sc)
          }
        } else {
          setM(haloMesh, i * 2, q.x, 0, q.z, 0)
          setM(haloMesh, i * 2 + 1, q.x, 0, q.z, 0)
        }
        if (q.revealed && q.out === 1) setM(dashMesh, i, q.x, 1.2 * PS + 0.12 + Math.sin(now * 2 + i) * 0.03 * m, q.z, PS * 1.1 * pp)
        else setM(dashMesh, i, q.x, 0, q.z, 0)
        if (q.revealed && q.out === 2) setM(warnMesh, i, q.x + jitter, 1.2 * PS + 0.16 + Math.abs(Math.sin(now * 5)) * 0.06 * m, q.z, PS * 1.1 * pp * (1 + 0.28 * (flash - 0.5)), now * 1.5 * m)
        else setM(warnMesh, i, q.x, 0, q.z, 0)

        // 個別化用藥後「改善」的人：持續顯示青色圓環與上箭頭
        const adjOn = adjust && q.revealed && q.p.flip && q.out === 0 ? 1 : 0
        q.adjS = damp(q.adjS, adjOn, 8, dt)
        if (q.adjS > 0.02) {
          setM(adjRingMesh, i, q.x, 0.05, q.z, PS * q.adjS * (1 + 0.1 * Math.sin(now * 3) * m))
          setM(adjArrowMesh, i, q.x, 1.2 * PS + 0.6 + Math.sin(now * 3 + i) * 0.05 * m, q.z, PS * 1.1 * q.adjS)
        } else {
          setM(adjRingMesh, i, q.x, 0, q.z, 0)
          setM(adjArrowMesh, i, q.x, 0, q.z, 0)
        }
      }
      for (let k = 0; k < MESHES.length; k++) {
        const mm = MESHES[k]
        mm.instanceMatrix.needsUpdate = true
        if (mm.instanceColor) mm.instanceColor.needsUpdate = true
      }

      // 分組標籤與長條
      const cls = layout.clusters
      for (let k = 0; k < cls.length; k++) {
        const cl = cls[k]
        const lab = labels[k]
        lab.visible = true
        lab.position.set(cl.cx, 2.05, cl.cz - cl.rad - 0.35)
        const b = bars[k]
        b.g.visible = true
        b.g.position.set(cl.cx, 0.09, cl.cz + cl.rad + 0.7)
        b.W = clamp(cl.rad * 2, 1.9, 2.9)
        b.back.scale.set(b.W + 0.12, 1, 1)
        let acc = -b.W / 2
        for (let o = 0; o < 3; o++) {
          const wTarget = (gcnt[k][o] / cl.n) * b.W
          b.w[o] = damp(b.w[o], wTarget, 8, dt)
          const w = Math.max(b.w[o], 0.0001)
          b.segs[o].scale.set(w, 1, 1)
          b.segs[o].position.x = acc + w / 2
          acc += b.w[o]
        }
      }
      for (let k = cls.length; k < 3; k++) {
        labels[k].visible = false
        bars[k].g.visible = false
      }

      recount()
      if (tipUntil && now > tipUntil) {
        hud.tip(null)
        tipUntil = 0
      }
    },
    dispose() {
      offPointer()
      if (pulse) pulse.cancel()
      pulse = null
      if (hudLegend) Object.assign(hudLegend.style, { padding: '', fontSize: '', gap: '' })
      if (hudCaption) Object.assign(hudCaption.style, { fontSize: '', lineHeight: '', padding: '' })
      hud.clear()
    },
  }
}
