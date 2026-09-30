// ch06 三個「作用目標」：血管（氯吡格雷）、腦部受體（可待因）、維生素 K 循環（華法林）。
// 每個都提供：group / tag / attach() / arrive(att) / update(dt,t,state) / hotspots
import { makeTag } from './parts.js'
import { BLOCK_HEX } from './data.js'

/** 標籤包進一層 Group（以標籤中心為錨點），讓窄螢幕時整組可以放大。回傳 { wrap, setScale }。 */
function tagWrapper(group) {
  const list = []
  return {
    place(tag, x, y, z) {
      const g = new group.constructor()
      g.position.set(x, y, z)
      tag.position.set(0, 0, 0)
      g.add(tag)
      group.add(g)
      list.push(g)
    },
    setScale(k) {
      for (const g of list) g.scale.setScalar(k)
    },
  }
}


// ───────────────────────────── 血管 + 血小板 ─────────────────────────────
export function createVessel(ctx, origin) {
  const { THREE, util, palette } = ctx
  const { COLORS } = palette
  const group = new THREE.Group()
  group.position.copy(origin)
  const L = 3.1
  const R = 0.85

  const tube = new THREE.Mesh(new THREE.CylinderGeometry(R, R, L, 40, 1, true), util.glassMat(0xe0546a, 0.14))
  tube.rotation.z = Math.PI / 2
  tube.renderOrder = 2
  group.add(tube)
  for (const sx of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(R, 0.025, 8, 48), new THREE.MeshBasicMaterial({ color: 0xff8fa0, transparent: true, opacity: 0.55 }))
    r.rotation.y = Math.PI / 2
    r.position.x = sx * (L / 2)
    group.add(r)
  }
  // 支架（線框圓筒）
  const stentX = 0.45
  const stent = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.93, R * 0.93, 1.05, 18, 6, true),
    new THREE.MeshBasicMaterial({ color: 0xb8c6f0, wireframe: true, transparent: true, opacity: 0.55, depthWrite: false })
  )
  stent.rotation.z = Math.PI / 2
  stent.position.x = stentX
  group.add(stent)

  const r = util.rng(21)
  // 紅血球
  const NR = 30
  const rbc = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshStandardMaterial({ color: 0x9a2638, roughness: 0.5, emissive: 0x3a0a14, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }), NR)
  rbc.frustumCulled = false
  const rbcs = Array.from({ length: NR }, () => ({ x0: r.range(-L / 2, L / 2), rr: Math.sqrt(r()) * (R - 0.16), a: r.range(0, 6.28), sp: r.range(0.55, 0.85), tilt: r.range(0, 3) }))
  group.add(rbc)

  // 血小板
  const NP = 26
  const pltGeo = new THREE.IcosahedronGeometry(1, 1)
  const plt = new THREE.InstancedMesh(pltGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.38, metalness: 0.05 }), NP)
  const pltHalo = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.11, depthWrite: false, blending: THREE.AdditiveBlending }), NP)
  plt.frustumCulled = false
  pltHalo.frustumCulled = false
  plt.renderOrder = 3
  pltHalo.renderOrder = 4
  group.add(plt, pltHalo)
  const P = Array.from({ length: NP }, (_, i) => ({
    x0: r.range(-L / 2, L / 2),
    rr: Math.sqrt(r()) * (R - 0.2),
    a: r.range(0, 6.28),
    sp: r.range(0.42, 0.7),
    spin: r.range(-0.6, 0.6),
    inh: 0,
    stuck: 0,
    flash: 0,
    ph: r.range(0, 6.28),
    pos: new THREE.Vector3(),
  }))
  const SLOTS = 12
  const slots = Array.from({ length: SLOTS }, (_, k) => {
    const ang = k * 2.399
    const rr = 0.62 + 0.08 * ((k * 7) % 3)
    return new THREE.Vector3(stentX + 0.4 * Math.sin(k * 1.7), rr * Math.sin(ang), rr * Math.cos(ang))
  })

  // 血栓團塊
  const clotMat = new THREE.MeshStandardMaterial({ color: 0xd81f3a, emissive: 0xff2a4a, emissiveIntensity: 0.7, roughness: 0.4, transparent: true, opacity: 0.5, depthWrite: false })
  const clot = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), clotMat)
  clot.position.set(stentX, 0, 0)
  clot.renderOrder = 5
  const clotGlow = util.makeGlow(0xff3355, 2.4, 0.0)
  clotGlow.position.copy(clot.position)
  group.add(clot, clotGlow)

  const tw = tagWrapper(group)
  const clotTag = makeTag(ctx, '支架處血栓 ↑', { worldHeight: 0.3, fontSize: 36, color: '#ffb3b3', border: 'rgba(255,92,92,0.8)' })
  tw.place(clotTag, 0.45, 1.16, 0.3)

  const cMag = new THREE.Color(COLORS.magenta)
  const cGreen = new THREE.Color(BLOCK_HEX) // 被阻斷的血小板：比活性代謝物（淺薄荷）深的翠綠
  const cRed = new THREE.Color(0xff3b4e)
  const cWhite = new THREE.Color(0xffffff)
  const col = new THREE.Color()
  const dummy = new THREE.Object3D()
  const V = new THREE.Vector3()
  let inhCount = 19
  let clotK = 0
  const stuckSlot = new Int16Array(NP).fill(-1) // 卡在支架處的血小板 → 它在血栓團塊裡的位置（-1 = 沒卡住）
  let clotAmt = 0
  let inhFrac = 0.7

  function flowPos(p, t, out) {
    let x = ((p.x0 + p.sp * t + L / 2) % L)
    if (x < 0) x += L
    x -= L / 2
    const a = p.a + t * p.spin * 0.5
    return out.set(x, p.rr * Math.sin(a), p.rr * Math.cos(a))
  }

  const api = {
    group,
    hotspot: tube,
    setState({ inh, clot }) {
      inhFrac = inh
      inhCount = Math.round(NP * inh)
      clotK = Math.round(SLOTS * clot)
      stuckSlot.fill(-1)
      let n = 0
      for (let i = inhCount; i < NP && n < clotK; i++) {
        stuckSlot[i] = n
        n++
      }
    },
    setTagScale(k) {
      tw.setScale(k)
    },
    /** 活性代謝物要飛向的血小板（優先已被阻斷者） */
    attach() {
      const idx = inhCount > 0 ? Math.floor(Math.random() * inhCount) : Math.floor(Math.random() * NP)
      return {
        idx,
        getPos: (out) => out.copy(P[idx].pos).add(group.position),
      }
    },
    arrive(att) {
      if (att && att.idx != null) P[att.idx].flash = 1
    },
    update(dt, t) {
      // 紅血球
      for (let i = 0; i < NR; i++) {
        const p = rbcs[i]
        let x = (p.x0 + p.sp * t + L / 2) % L
        if (x < 0) x += L
        x -= L / 2
        dummy.position.set(x, p.rr * Math.sin(p.a), p.rr * Math.cos(p.a))
        dummy.rotation.set(p.tilt + t * 0.5, p.tilt * 0.7, t * 0.3)
        dummy.scale.set(0.15, 0.06, 0.15)
        dummy.updateMatrix()
        rbc.setMatrixAt(i, dummy.matrix)
      }
      rbc.instanceMatrix.needsUpdate = true

      clotAmt = util.damp(clotAmt, clotK / SLOTS, 3, dt)
      for (let i = 0; i < NP; i++) {
        const p = P[i]
        p.inh = util.damp(p.inh, i < inhCount ? 1 : 0, 4, dt)
        const isStuck = stuckSlot[i] >= 0
        p.stuck = util.damp(p.stuck, isStuck ? 1 : 0, 2.6, dt)
        p.flash = Math.max(0, p.flash - dt * 1.6)
        flowPos(p, t, V)
        if (p.stuck > 0.003) {
          const k = stuckSlot[i]
          const slot = slots[(k < 0 ? i : k) % SLOTS]
          V.lerp(slot, util.easeInOut(util.clamp(p.stuck, 0, 1)))
        }
        p.pos.copy(V)
        dummy.position.copy(V)
        const act = 1 - p.inh
        // 已阻斷：光滑扁圓盤；未阻斷：膨大、帶刺（以旋轉的低多邊形表示）
        const sx = util.lerp(0.15, 0.16, act) * (1 + 0.28 * p.flash) * (1 + 0.25 * p.stuck)
        const sy = util.lerp(0.06, 0.16, act) * (1 + 0.28 * p.flash) * (1 + 0.25 * p.stuck)
        dummy.scale.set(sx, sy, sx)
        dummy.rotation.set(act * (t * 1.4 + p.ph), act * t * 0.9 + p.ph, 0.4 * (1 - act) * Math.sin(t + p.ph))
        dummy.updateMatrix()
        plt.setMatrixAt(i, dummy.matrix)
        col.copy(cMag).lerp(cGreen, util.clamp(p.inh, 0, 1)).lerp(cRed, util.clamp(p.stuck, 0, 1) * 0.8).lerp(cWhite, util.clamp(p.flash, 0, 1) * 0.45)
        plt.setColorAt(i, col)
        dummy.scale.setScalar(Math.max(sx, sy) * (1.55 + 0.25 * p.flash))
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        pltHalo.setMatrixAt(i, dummy.matrix)
        pltHalo.setColorAt(i, col)
      }
      plt.instanceMatrix.needsUpdate = true
      pltHalo.instanceMatrix.needsUpdate = true
      if (plt.instanceColor) plt.instanceColor.needsUpdate = true
      if (pltHalo.instanceColor) pltHalo.instanceColor.needsUpdate = true

      // 血栓團塊
      const s = 0.08 + 0.42 * clotAmt
      clot.scale.set(s * 0.9, s, s)
      clot.visible = clotAmt > 0.04
      clot.material.opacity = 0.18 + 0.4 * clotAmt
      clot.material.emissiveIntensity = 0.5 + 0.35 * Math.sin(t * 5) * clotAmt
      clotGlow.material.opacity = 0.55 * clotAmt
      clotTag.visible = clotAmt > 0.3
    },
  }
  return api
}

// ───────────────────────────── 腦部 μ 鴉片受體 ─────────────────────────────
export function createBrain(ctx, origin) {
  const { THREE, util, palette } = ctx
  const { COLORS } = palette
  const group = new THREE.Group()
  group.position.copy(origin)

  // 腦（示意）
  const bg = new THREE.IcosahedronGeometry(0.6, 4)
  const pos = bg.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const n = v.clone().normalize()
    let f = 1 + 0.06 * Math.sin(9 * n.x + 3 * n.y) * Math.sin(8 * n.y - 2 * n.z) + 0.035 * Math.sin(14 * n.z + 4 * n.x)
    if (Math.abs(n.x) < 0.07 && n.y > -0.2) f *= 0.9
    v.copy(n).multiplyScalar(0.6 * f)
    v.x *= 1.22
    v.y *= 0.88
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  bg.computeVertexNormals()
  const brainMat = new THREE.MeshStandardMaterial({ color: 0xeaa9c2, roughness: 0.55, emissive: 0x4a1226, emissiveIntensity: 0.5 })
  const brain = new THREE.Mesh(bg, brainMat)
  brain.position.set(0, 1.12, -0.3)
  brain.scale.setScalar(0.8)
  group.add(brain)
  const brainGlow = util.makeGlow(0x4be3a0, 2.7, 0.35)
  brainGlow.position.copy(brain.position)
  brainGlow.position.z -= 0.2
  group.add(brainGlow)

  // 放大示意線
  const lineGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.42, 0.78, -0.3),
    new THREE.Vector3(-1.5, -0.28, -0.55),
    new THREE.Vector3(0.42, 0.78, -0.3),
    new THREE.Vector3(1.5, -0.28, -0.55),
  ])
  const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ color: 0xbfd0ff, transparent: true, opacity: 0.28 }))
  group.add(lines)

  // 神經元膜
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(3.0, 0.16, 1.5),
    new THREE.MeshStandardMaterial({ color: 0x3a4f96, roughness: 0.45, metalness: 0.1, emissive: 0x1b2a66, emissiveIntensity: 0.6 })
  )
  slab.position.set(0, -0.36, -0.05)
  group.add(slab)
  const slabTop = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.03, 1.5), new THREE.MeshBasicMaterial({ color: 0x8fb0ff, transparent: true, opacity: 0.35 }))
  slabTop.position.set(0, -0.27, -0.05)
  group.add(slabTop)

  // 受體
  const bowlGeo = new THREE.SphereGeometry(0.2, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
  const stemGeo = new THREE.CylinderGeometry(0.055, 0.085, 0.3, 10)
  const coreGeo = new THREE.SphereGeometry(0.1, 16, 12)
  const REC = []
  const cols = 4
  const rowsN = 3
  const perm = [5, 0, 10, 3, 7, 2, 9, 4, 11, 1, 6, 8]
  for (let rr = 0; rr < rowsN; rr++) {
    for (let c = 0; c < cols; c++) {
      const i = rr * cols + c
      const g = new THREE.Group()
      g.position.set((c - 1.5) * 0.7, -0.27, (rr - 1) * 0.42 - 0.05)
      const stem = new THREE.Mesh(stemGeo, new THREE.MeshStandardMaterial({ color: 0x9aa8e8, roughness: 0.4, emissive: 0x27305e, emissiveIntensity: 0.5 }))
      stem.position.y = 0.15
      const bowl = new THREE.Mesh(bowlGeo, new THREE.MeshStandardMaterial({ color: 0xc6d0ff, roughness: 0.3, emissive: 0x3a4690, emissiveIntensity: 0.55, side: THREE.DoubleSide }))
      bowl.position.y = 0.42
      const core = new THREE.Mesh(coreGeo, new THREE.MeshStandardMaterial({ color: COLORS.metabolite, emissive: COLORS.metabolite, emissiveIntensity: 1.6 }))
      core.position.y = 0.4
      core.scale.setScalar(0.001)
      const halo = util.makeGlow(COLORS.metabolite, 0.9, 0)
      halo.position.y = 0.45
      g.add(stem, bowl, core, halo)
      group.add(g)
      REC.push({ g, bowl, core, halo, rank: perm.indexOf(i), occ: 0, want: 0, flash: 0 })
    }
  }

  const tw = tagWrapper(group)
  const warn = makeTag(ctx, '⚠ 呼吸抑制風險', { worldHeight: 0.3, fontSize: 36, color: '#ffc9c9', border: 'rgba(255,92,92,0.85)' })
  tw.place(warn, 1.05, 1.2, 0.3)

  // 不可見的點選區：涵蓋腦與整片神經元膜，手指/滑鼠不必瞄準細小的受體
  const hit = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.5, 1.6), new THREE.MeshBasicMaterial({ visible: false }))
  hit.position.set(0, 0.4, -0.1)
  group.add(hit)

  const zoneCol = new THREE.Color(0x4be3a0)
  const wantCol = new THREE.Color(0x4be3a0)
  const GREEN = new THREE.Color(0x4be3a0)
  const BASE_EMI = new THREE.Color(0x3a4690)
  let occCount = 7
  let over = false

  const api = {
    group,
    hotspot: hit,
    setTagScale(k) {
      tw.setScale(k)
    },
    setState({ occ, zoneColor, overdose }) {
      occCount = occ
      over = !!overdose
      wantCol.setHex(zoneColor)
      for (const r of REC) r.want = r.rank < occCount ? 1 : 0
    },
    attach() {
      const occupied = REC.filter((r) => r.rank < occCount)
      const pool = occupied.length ? occupied : REC
      const rec = pool[Math.floor(Math.random() * pool.length)]
      return { rec, getPos: (out) => out.set(0, 0.4, 0).add(rec.g.position).add(group.position) }
    },
    arrive(att) {
      if (att && att.rec) att.rec.flash = 1
    },
    update(dt, t) {
      zoneCol.lerp(wantCol, 1 - Math.exp(-6 * dt))
      brainGlow.material.color.copy(zoneCol)
      brainGlow.material.opacity = 0.28 + 0.12 * Math.sin(t * (over ? 7 : 2.2)) + (over ? 0.12 : 0)
      brain.scale.setScalar(0.8 * (1 + (over ? 0.03 * Math.sin(t * 7) : 0.012 * Math.sin(t * 1.6))))
      warn.visible = over
      warn.material.opacity = over ? 0.75 + 0.25 * Math.sin(t * 7) : 1
      for (const r of REC) {
        r.occ = util.damp(r.occ, r.want, 5, dt)
        r.flash = Math.max(0, r.flash - dt * 2.2)
        const o = r.occ
        r.core.scale.setScalar(Math.max(0.001, o * (1 + 0.6 * r.flash)))
        r.core.material.emissiveIntensity = 1.4 + 1.6 * r.flash
        r.halo.material.opacity = o * 0.5 + 0.5 * r.flash
        r.bowl.material.emissive.copy(BASE_EMI).lerp(GREEN, o * 0.5)
        r.g.position.y = -0.27 + 0.02 * Math.sin(t * 1.5 + r.rank)
      }
    },
  }
  return api
}

// ───────────────────────────── 維生素 K 循環 ─────────────────────────────
export function createVitK(ctx, origin) {
  const { THREE, util, palette } = ctx
  const { COLORS } = palette
  const group = new THREE.Group()
  group.position.copy(origin)
  const CX = -0.55
  const CY = 0.12
  const RAD = 0.85

  const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(RAD, 0.028, 10, 90), new THREE.MeshBasicMaterial({ color: 0x6f86d8, transparent: true, opacity: 0.55 }))
  ringMesh.position.set(CX, CY, 0)
  group.add(ringMesh)
  // 不可見的點選區（環本身只有約 2 px 寬，幾乎點不到）
  const pick = new THREE.Mesh(new THREE.CircleGeometry(RAD + 0.45, 32), new THREE.MeshBasicMaterial({ visible: false }))
  pick.position.set(CX, CY, 0)
  group.add(pick)

  // 環上的分子
  const M = 22
  const beads = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }), M)
  const beadHalo = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }), M)
  beads.frustumCulled = false
  beadHalo.frustumCulled = false
  group.add(beads, beadHalo)

  // 因子（離開環的紅色小球）
  const NF = 16
  const fac = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), NF)
  fac.frustumCulled = false
  group.add(fac)
  const F = Array.from({ length: NF }, () => ({ age: 99, life: 2.4, off: 0 }))

  // VKORC1 位點（環下方）與 γ-羧化酶（環上方）
  const gateGeo = new THREE.IcosahedronGeometry(0.15, 1)
  const gates = []
  const NG = 6
  for (let i = 0; i < NG; i++) {
    const ang = -Math.PI / 2 + (i - (NG - 1) / 2) * 0.34
    const body = new THREE.Mesh(gateGeo, new THREE.MeshStandardMaterial({ color: COLORS.enzyme, roughness: 0.3, emissive: COLORS.enzyme, emissiveIntensity: 0.45 }))
    body.position.set(CX + Math.cos(ang) * (RAD + 0.3), CY + Math.sin(ang) * (RAD + 0.3), 0)
    const blocker = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshStandardMaterial({ color: COLORS.drug, emissive: COLORS.drug, emissiveIntensity: 1.1, roughness: 0.3 }))
    blocker.position.set(CX + Math.cos(ang) * (RAD + 0.52), CY + Math.sin(ang) * (RAD + 0.52), 0)
    blocker.scale.setScalar(0.001)
    const halo = util.makeGlow(COLORS.drug, 0.7, 0)
    halo.position.copy(blocker.position)
    group.add(body, blocker, halo)
    gates.push({ body, blocker, halo, on: 1, want: 1, blk: 0, blkWant: 0, flash: 0, ang })
  }
  const ggcx = new THREE.Mesh(new THREE.IcosahedronGeometry(0.24, 1), new THREE.MeshStandardMaterial({ color: COLORS.violet, roughness: 0.3, emissive: COLORS.violet, emissiveIntensity: 0.6 }))
  ggcx.position.set(CX, CY + RAD + 0.3, 0)
  group.add(ggcx)

  const tw = tagWrapper(group)
  const tagV = makeTag(ctx, 'VKORC1（標靶）', { worldHeight: 0.3, fontSize: 36 })
  tw.place(tagV, CX + 1.4, CY - RAD - 0.32, 0.2)
  const tagF = makeTag(ctx, '活化凝血因子 →', { worldHeight: 0.3, fontSize: 36, color: '#ffc9c9', border: 'rgba(255,107,107,0.7)' })
  tw.place(tagF, CX + 1.4, CY + RAD + 0.36, 0.2)

  const dummy = new THREE.Object3D()
  const cRed = new THREE.Color(COLORS.green)
  const cGray = new THREE.Color(0xa8b2d0)
  const cFac = new THREE.Color(0xff6b6b)
  const col = new THREE.Color()
  let phase = 0
  let open = 0.5
  let openWant = 0.5
  let emitAcc = 0
  let nGates = 6
  let blockFrac = 0.5
  const world = new THREE.Vector3()

  const api = {
    group,
    hotspot: pick,
    setTagScale(k) {
      tw.setScale(k)
    },
    setState({ e, gatesOn, label }) {
      if (label) tagV.userData.set(label)
      nGates = gatesOn
      openWant = 1 - util.clamp(e, 0, 1) * 0.92
      blockFrac = util.clamp(e / 0.92, 0, 1)
      const blocked = Math.round(gatesOn * blockFrac)
      // 從中間向外開啟 gatesOn 個位點
      const order = [2, 3, 1, 4, 0, 5]
      gates.forEach((g, i) => {
        const rank = order.indexOf(i)
        g.want = rank < gatesOn ? 1 : 0
        g.blkWant = rank < blocked ? 1 : 0
      })
    },
    attach() {
      const active = gates.filter((g) => g.want > 0.5)
      const g = active.length ? active[Math.floor(Math.random() * active.length)] : gates[2]
      return { g, getPos: (out) => out.copy(g.body.position).add(group.position) }
    },
    arrive(att) {
      if (att && att.g) att.g.flash = 1
    },
    update(dt, t, extra) {
      open = util.damp(open, openWant, 3, dt)
      phase = (phase + dt * 0.11 * (0.12 + open)) % 1
      for (let i = 0; i < M; i++) {
        const u = (i / M + phase) % 1
        const ang = -Math.PI / 2 + u * Math.PI * 2
        dummy.position.set(CX + Math.cos(ang) * RAD, CY + Math.sin(ang) * RAD, 0)
        dummy.scale.setScalar(0.085)
        dummy.updateMatrix()
        beads.setMatrixAt(i, dummy.matrix)
        // 0..0.5 還原型（綠），0.5..1 氧化型（灰）
        const k = u < 0.5 ? 0 : 1
        col.copy(cRed).lerp(cGray, k)
        beads.setColorAt(i, col)
        dummy.scale.setScalar(0.19)
        dummy.updateMatrix()
        beadHalo.setMatrixAt(i, dummy.matrix)
        beadHalo.setColorAt(i, col)
      }
      beads.instanceMatrix.needsUpdate = true
      beadHalo.instanceMatrix.needsUpdate = true
      if (beads.instanceColor) beads.instanceColor.needsUpdate = true
      if (beadHalo.instanceColor) beadHalo.instanceColor.needsUpdate = true

      // 凝血因子：速率 ∝ 環的流速
      emitAcc += dt * (0.4 + 2.6 * open)
      while (emitAcc >= 1) {
        emitAcc -= 1
        const f = F.find((x) => x.age >= x.life)
        if (f) {
          f.age = 0
          f.life = 2.4 + Math.random() * 0.4
          f.off = (Math.random() - 0.5) * 0.24
        }
      }
      for (let i = 0; i < NF; i++) {
        const f = F[i]
        f.age += dt
        if (f.age >= f.life) {
          dummy.scale.setScalar(0.0001)
          dummy.position.set(0, 0, 0)
        } else {
          const u = f.age / f.life
          dummy.position.set(CX + 0.1 + u * 1.9, CY + RAD + 0.3 + f.off + 0.18 * Math.sin(u * 6), 0)
          dummy.scale.setScalar(0.09 * (1 - u * u))
        }
        dummy.updateMatrix()
        fac.setMatrixAt(i, dummy.matrix)
        fac.setColorAt(i, cFac)
      }
      fac.instanceMatrix.needsUpdate = true
      if (fac.instanceColor) fac.instanceColor.needsUpdate = true

      for (const g of gates) {
        g.on = util.damp(g.on, g.want, 5, dt)
        g.blk = util.damp(g.blk, g.blkWant * g.want, 5, dt)
        g.flash = Math.max(0, g.flash - dt * 2)
        g.body.scale.setScalar(Math.max(0.001, g.on) * (1 + 0.3 * g.flash))
        g.blocker.scale.setScalar(Math.max(0.001, g.blk) * (1 + 0.3 * g.flash))
        g.halo.material.opacity = g.blk * 0.5 + 0.4 * g.flash
        g.body.material.emissiveIntensity = 0.45 + 1.2 * g.flash
      }
      ggcx.scale.setScalar(1 + 0.06 * Math.sin(t * 3))
      ggcx.material.emissiveIntensity = 0.4 + 0.5 * open
    },
  }
  return api
}
