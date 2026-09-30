// ch07 場景「免疫辨識」：HLA 展示櫃 + T 細胞受體 + 藥物，以及「篩檢的意義」1,000 人點陣。
// 全部為示意：分子形狀、尺度已簡化；1,000 人點陣是依研究比例換算的模擬人群，不是真實個案。
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createFit, createLabels } from './ch07/layout.js'

export const options = {
  fov: 42,
  camera: [4, 3, 12],
  target: [0, 1.9, 0],
  orbit: true,
  minPolarAngle: 0.55,
  maxPolarAngle: 1.68,
  exposure: 1.12,
  envIntensity: 0.65,
}

export default function create(ctx) {
  const { THREE, util, scene, camera, ui, hud, view } = ctx
  const C = ctx.palette.COLORS
  const hex = ctx.palette.hex
  const V3 = THREE.Vector3
  const { clamp, lerp, damp, easeInOut, smoothstep } = util
  const motion = ctx.motion
  const TCOL = 0xe9de78 // T 細胞：偏綠的淡黃，和藥物的橘紅拉開色相
  const DRUG_COL = 0xff8a3d // 藥物：偏紅的橘
  const NEUTRAL = 0x8a90a0 // 不攜帶者：中性灰（不再是藍色系）

  util.addStudioLights(scene, { intensity: 1.2 })

  // ───────────────────────── 取景 ─────────────────────────
  const FRAME_C = new V3(0, 1.9, 0)
  const AZ = 0.42
  const EL = 0.14
  const FRAME_R = 2.8
  ctx.setFrame(FRAME_C, FRAME_R, { azimuth: AZ, elevation: EL })

  // ───────────────────────── 狀態 ─────────────────────────
  // dotMode: mixed 不篩檢（混在一起） / group 依 HLA 分組 / screen 篩檢後陽性者改用替代藥
  const S = { view: 'mech', hla: 'risk', drug: false, model: 'pi', dotMode: 'mixed', step: 0, free: false }
  const A = { drugIn: 0, dock: 0, engage: 0, act: 0, zoom: 0, dmg: 0, vm: 0, split: 0, screened: 0 }
  const CAP_BY_STEP = [0, 0, 1, 3, 3, 3]
  const pending = { mode: null, t: 0 }

  // ───────────────────────── 場景骨架 ─────────────────────────
  const world = new THREE.Group() // 機制場景（縮放以切換分子/組織視角）
  const sheet = new THREE.Group() // 表皮上層：損傷時整片抬起
  scene.add(world)
  world.add(sheet)

  const glowA = util.makeGlow(C.hla, 17, 0.2)
  glowA.position.set(-2, 2.5, -6)
  const glowB = util.makeGlow(C.magenta, 13, 0.13)
  glowB.position.set(5, 4.5, -7)
  scene.add(glowA, glowB)
  const dust = util.createParticles({ count: 240, spread: [16, 11, 9], size: 0.07, color: 0x8fb4ff, opacity: 0.5, seed: 21 })
  dust.position.copy(FRAME_C)
  scene.add(dust)

  // ───────────────────────── 材質 ─────────────────────────
  const M = {
    hla: util.glossMat(C.hla, { emissive: C.hla, emissiveIntensity: 0.2 }),
    hlaDark: util.glossMat(0x2f7dc4, { emissive: 0x18508c, emissiveIntensity: 0.25 }),
    hlaLight: util.glossMat(0xa8ddff, { emissive: 0x4aa8e0, emissiveIntensity: 0.18 }),
    pep: util.glossMat(C.peptide, { emissive: C.peptide, emissiveIntensity: 0.4 }),
    pepAlt: util.glossMat(0xffb0e0, { emissive: 0xff5cb8, emissiveIntensity: 0.6 }),
    tcell: util.glossMat(TCOL, { emissive: 0xc9ae1c, emissiveIntensity: 0.12 }),
    tcellBump: util.glossMat(0xf3eca8, { emissive: 0xd8bc30, emissiveIntensity: 0.15 }),
    tcr: util.glossMat(0xf5efb8, { emissive: 0xe0c440, emissiveIntensity: 0.3 }),
    ring: new THREE.MeshStandardMaterial({ color: C.cyan, emissive: C.cyan, emissiveIntensity: 1.6, roughness: 0.4 }),
    pocketDark: new THREE.MeshStandardMaterial({ color: 0x07142c, roughness: 0.9 }),
  }

  // ───────────────────────── 皮膚組織（3 層 × 5×3 細胞） ─────────────────────────
  const CW = 1.9
  const LY = [-0.39, -1.09, -1.79]
  const LIFT = 0.6
  const cellMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, emissive: 0x2a0d1a, emissiveIntensity: 0.55 })
  const cells = new THREE.InstancedMesh(new RoundedBoxGeometry(1.78, 0.6, 1.78, 3, 0.13), cellMat, 45)
  const capMat = new THREE.MeshStandardMaterial({ color: 0x3a56ac, roughness: 0.35, metalness: 0.05, emissive: 0x122868, emissiveIntensity: 0.7 })
  const caps = new THREE.InstancedMesh(new RoundedBoxGeometry(1.8, 0.1, 1.8, 2, 0.04), capMat, 15)
  cells.frustumCulled = false
  caps.frustumCulled = false
  world.add(cells, caps)
  const fluid = new THREE.Mesh(
    new THREE.BoxGeometry(8.6, 1, 5.2),
    new THREE.MeshStandardMaterial({ color: 0xffe2cf, emissive: 0x6a3a28, emissiveIntensity: 0.6, transparent: true, opacity: 0.26, depthWrite: false, roughness: 0.3 })
  )
  fluid.renderOrder = 2
  fluid.visible = false
  world.add(fluid)

  const rand = util.rng(11)
  const jit = Array.from({ length: 45 }, () => [rand(), rand()])
  const baseCol = [new THREE.Color(0xf2b3b0), new THREE.Color(0xe3969b), new THREE.Color(0xb8607c)]
  const deadCol = new THREE.Color(0x8c8ea6)
  const m4 = new THREE.Matrix4()
  const qq = new THREE.Quaternion()
  const ee = new THREE.Euler()
  const pv = new V3()
  const sv = new V3()
  const col = new THREE.Color()
  let lastDmgApplied = -1

  function setTissue(d) {
    let n = 0
    for (let L = 0; L < 3; L++) {
      for (let zi = 0; zi < 3; zi++) {
        for (let xi = 0; xi < 5; xi++) {
          const idx = n++
          const isCenter = L === 0 && xi === 2 && zi === 1
          const top = L < 2
          const [r1, r2] = jit[idx]
          let x = (xi - 2) * CW
          let y = LY[L]
          let z = (zi - 1) * CW
          let rz = 0
          let rx = 0
          let sy = 1
          let dead = 0
          if (top) {
            const k = isCenter ? 0 : d
            x += (xi - 2) * 0.16 * k
            z += (zi - 1) * 0.16 * k
            y += LIFT * d + r1 * 0.3 * k
            rz = (r1 - 0.5) * 0.8 * k
            rx = (r2 - 0.5) * 0.6 * k
            sy = 1 - 0.22 * k * r2
            dead = d * (isCenter ? 0.55 : 0.45 + 0.55 * r2)
          }
          m4.compose(pv.set(x, y, z), qq.setFromEuler(ee.set(rx, 0, rz)), sv.set(1, sy, 1))
          cells.setMatrixAt(idx, m4)
          cells.setColorAt(idx, col.copy(baseCol[L]).lerp(deadCol, dead))
          if (L === 0) {
            m4.compose(pv.set(x, y + 0.35 * sy, z), qq, sv.set(1, 1, 1))
            caps.setMatrixAt(xi + zi * 5, m4)
          }
        }
      }
    }
    cells.instanceMatrix.needsUpdate = true
    caps.instanceMatrix.needsUpdate = true
    if (cells.instanceColor) cells.instanceColor.needsUpdate = true
    const gapTop = LY[1] - 0.3 + LIFT * d
    const gapBot = LY[2] + 0.3
    fluid.visible = d > 0.03
    fluid.scale.y = Math.max(0.01, gapTop - gapBot)
    fluid.position.y = (gapTop + gapBot) / 2
    fluid.material.opacity = 0.05 + 0.24 * d
    sheet.position.y = LIFT * d
    lastDmgApplied = d
  }
  setTissue(0)

  // ───────────────────────── HLA class I 分子（示意） ─────────────────────────
  const hla = new THREE.Group()
  sheet.add(hla)
  const pickables = []
  const tag = (obj, html) => {
    obj.traverse((o) => (o.userData.tip = html))
    pickables.push(obj)
  }

  function add(parent, mesh, x = 0, y = 0, z = 0) {
    mesh.position.set(x, y, z)
    parent.add(mesh)
    return mesh
  }
  const hlaBody = new THREE.Group()
  hla.add(hlaBody)
  add(hlaBody, new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.62, 20), M.hlaDark), 0, 0.26, 0)
  const a3 = add(hlaBody, new THREE.Mesh(new THREE.SphereGeometry(1, 28, 18), M.hlaDark), 0.02, 0.72, 0)
  a3.scale.set(0.52, 0.32, 0.4)
  add(hlaBody, new THREE.Mesh(new THREE.SphereGeometry(0.25, 22, 16), M.hlaLight), -0.3, 0.66, 0.1)
  add(hlaBody, new THREE.Mesh(new RoundedBoxGeometry(1.7, 0.2, 0.9, 3, 0.07), M.hla), 0, 1.0, 0)

  function rod(z) {
    const g = new THREE.Group()
    const core = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 1.42, 6, 14), M.hla)
    core.rotation.z = Math.PI / 2
    g.add(core)
    const pts = []
    const N = 70
    for (let i = 0; i <= N; i++) {
      const u = i / N
      const a = u * Math.PI * 2 * 6
      pts.push(new V3(lerp(-0.7, 0.7, u), Math.cos(a) * 0.15, Math.sin(a) * 0.15))
    }
    const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.028, 6, false), M.hlaLight)
    g.add(coil)
    g.position.set(0, 1.28, z)
    return g
  }
  hlaBody.add(rod(0.335), rod(-0.335))
  tag(hlaBody, '<b>HLA-B 分子（HLA class I）</b><br>像細胞表面的「展示櫃」：把細胞內蛋白質切下的胜肽放在抗原結合溝（俗稱凹槽）裡，讓 T 細胞檢查。')

  function makePeptide(mat, arch, seedSign) {
    const g = new THREE.Group()
    const pts = []
    for (let i = 0; i < 9; i++) {
      const u = i / 8
      const x = lerp(-0.68, 0.34, u)
      const y = 1.155 + arch * Math.sin(u * Math.PI) + (i % 2 ? 0.02 : -0.01)
      const z = (i % 2 ? 0.05 : -0.05) * seedSign
      pts.push(new V3(x, y, z))
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.075 + (i === 4 ? 0.015 : 0), 14, 10), mat)
      b.position.copy(pts[i])
      g.add(b)
    }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.028, 6, false), mat))
    return g
  }
  const pepA = makePeptide(M.pep, 0, 1)
  const pepB = makePeptide(M.pepAlt, 0.2, -1)
  hla.add(pepA, pepB)
  pepB.scale.setScalar(0.001)
  tag(pepA, '<b>胜肽</b><br>細胞內蛋白質的小碎片。平常展示的都是「自己的」胜肽，T 細胞看了不會攻擊。')
  tag(pepB, '<b>另一批自體胜肽</b><br>「改變胜肽庫」模型的示意：藥物改變凹槽形狀後，HLA 改呈現原本不呈現的自己的胜肽。')

  const POCKET = new V3(0.56, 1.13, 0)
  const pocketRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.028, 10, 36), M.ring)
  pocketRing.rotation.x = Math.PI / 2
  pocketRing.position.copy(POCKET)
  const pocketDisc = new THREE.Mesh(new THREE.CircleGeometry(0.15, 28), M.pocketDark)
  pocketDisc.rotation.x = -Math.PI / 2
  pocketDisc.position.set(POCKET.x, POCKET.y - 0.008, POCKET.z)
  const plug = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), M.hlaDark)
  plug.position.set(POCKET.x, POCKET.y + 0.03, POCKET.z)
  plug.scale.y = 0.8
  hla.add(pocketRing, pocketDisc, plug)
  const pocketGlow = util.makeGlow(C.cyan, 1.1, 0.5)
  pocketGlow.position.set(POCKET.x, POCKET.y + 0.05, POCKET.z)
  hla.add(pocketGlow)
  tag(pocketRing, '<b>HLA-B*15:02 的凹槽（示意）</b><br>這一型的凹槽形狀讓卡巴馬平可能嵌進去（示意）；其他 HLA-B 型別的形狀不同，藥物較難結合。')
  tag(plug, '<b>被擋住的凹槽（示意）</b><br>其他 HLA-B 型別的凹槽形狀不同，藥物較難嵌入（示意）。')

  // 其他背景 HLA（小）
  const miniN = 11
  const miniBase = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.13, 0.42, 12), M.hlaDark, miniN)
  const miniHead = new THREE.InstancedMesh(new RoundedBoxGeometry(0.62, 0.16, 0.34, 2, 0.05), M.hla, miniN)
  const mr = util.rng(5)
  for (let i = 0; i < miniN; i++) {
    let x
    let z
    do {
      x = mr.range(-4.2, 4.2)
      z = mr.range(-2.4, 2.4)
    } while (Math.abs(x) < 1.5 && Math.abs(z) < 1.3)
    const ry = mr.range(0, Math.PI)
    m4.compose(pv.set(x, 0.2, z), qq.setFromEuler(ee.set(0, ry, 0)), sv.set(1, 1, 1))
    miniBase.setMatrixAt(i, m4)
    m4.compose(pv.set(x, 0.5, z), qq, sv)
    miniHead.setMatrixAt(i, m4)
  }
  miniBase.frustumCulled = miniHead.frustumCulled = false
  sheet.add(miniBase, miniHead)

  // ───────────────────────── T 細胞 + TCR ─────────────────────────
  const TR = 1.5
  const TX = 0.3
  const T0 = 4.22
  const tGroup = new THREE.Group()
  tGroup.position.set(TX, T0, 0)
  sheet.add(tGroup)
  const tBody = new THREE.Mesh(new THREE.SphereGeometry(TR, 56, 36), M.tcell)
  tGroup.add(tBody)
  tag(tBody, '<b>T 細胞</b><br>免疫系統的巡邏兵。用表面的 T 細胞受體（TCR）檢查每個 HLA 展示的東西。')
  const tHalo = util.makeGlow(TCOL, 6.2, 0)
  tHalo.position.set(0, -0.2, -0.5)
  tGroup.add(tHalo)

  const bumpN = 36
  const bumps = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 8), M.tcellBump, bumpN)
  const tr = util.rng(33)
  for (let i = 0; i < bumpN; i++) {
    const u = tr.range(-1, 0.2)
    const a = tr.range(0, Math.PI * 2)
    const s = Math.sqrt(1 - u * u)
    const n = new V3(Math.cos(a) * s, u, Math.sin(a) * s)
    m4.compose(pv.copy(n).multiplyScalar(TR * 0.985), qq.identity(), sv.setScalar(tr.range(0.7, 1.4)))
    bumps.setMatrixAt(i, m4)
  }
  bumps.frustumCulled = false
  tGroup.add(bumps)

  const TLEN = 0.72
  const otherDirs = []
  for (let ring = 0; ring < 2; ring++) {
    const cnt = ring === 0 ? 6 : 9
    const th = ring === 0 ? 0.5 : 0.95
    for (let k = 0; k < cnt; k++) otherDirs.push([th, (k / cnt) * Math.PI * 2 + ring * 0.4])
  }
  const tcrStalks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.045, TLEN, 8), M.tcr, otherDirs.length)
  const tcrHeads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), M.tcr, otherDirs.length * 2)
  otherDirs.forEach(([th, az], i) => {
    const n = new V3(Math.sin(th) * Math.cos(az), -Math.cos(th), Math.sin(th) * Math.sin(az))
    const base = n.clone().multiplyScalar(TR)
    const dirQ = new THREE.Quaternion().setFromUnitVectors(new V3(0, -1, 0), n)
    const mid = base.clone().addScaledVector(n, TLEN / 2)
    m4.compose(mid, dirQ, sv.set(1, 1, 1))
    tcrStalks.setMatrixAt(i, m4)
    const tip = base.clone().addScaledVector(n, TLEN)
    const side = new V3(1, 0, 0).applyQuaternion(dirQ).multiplyScalar(0.08)
    m4.compose(tip.clone().add(side), qq.identity(), sv.set(1, 1, 1))
    tcrHeads.setMatrixAt(i * 2, m4)
    m4.compose(tip.clone().sub(side), qq.identity(), sv)
    tcrHeads.setMatrixAt(i * 2 + 1, m4)
  })
  tcrStalks.frustumCulled = tcrHeads.frustumCulled = false
  tGroup.add(tcrStalks, tcrHeads)

  const TCR_LEN = 1.02
  const tcrMain = new THREE.Group()
  const tcrStalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.065, TCR_LEN, 10), M.tcr)
  tcrStalk.position.y = -TR - TCR_LEN / 2 + 0.02
  const tcrHeadA = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), M.tcr)
  const tcrHeadB = tcrHeadA.clone()
  tcrHeadA.position.set(-0.12, -TR - TCR_LEN, 0)
  tcrHeadB.position.set(0.12, -TR - TCR_LEN, 0)
  const tcrFork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.26, 8), M.tcr)
  tcrFork.rotation.z = Math.PI / 2
  tcrFork.position.set(0, -TR - TCR_LEN + 0.04, 0)
  tcrMain.add(tcrStalk, tcrHeadA, tcrHeadB, tcrFork)
  tGroup.add(tcrMain)
  tag(tcrMain, '<b>T 細胞受體（TCR）</b><br>T 細胞的「掃描器」，專門辨識 HLA 展示的東西。辨識成「異物」才會啟動攻擊。')
  const TCR_TIP_LOCAL = new V3(0, -TR - TCR_LEN, 0)

  const contactGlow = util.makeGlow(TCOL, 1.6, 0)
  hla.add(contactGlow)
  const scanGlow = util.makeGlow(C.green, 1.7, 0)
  scanGlow.position.set(-0.1, 1.22, 0)
  hla.add(scanGlow)

  // 細胞毒性顆粒（示意）
  const NP = 64
  const gran = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7f7f }), NP)
  gran.frustumCulled = false
  sheet.add(gran)
  const gr = util.rng(77)
  const gp = Array.from({ length: NP }, () => ({
    ph: gr(),
    sp: 0.35 + gr() * 0.4,
    sx: TX + (gr() - 0.5) * 1.6,
    sz: (gr() - 0.5) * 1.6,
    ex: (gr() - 0.5) * 6.4,
    ez: (gr() - 0.5) * 3.6,
    arc: 0.4 + gr() * 0.8,
  }))

  // ───────────────────────── 藥物分子（卡巴馬平，示意） ─────────────────────────
  const drugs = []
  const DRUG_N = 6
  for (let i = 0; i < DRUG_N; i++) {
    const m = util.createMolecule({ atoms: 5, radius: i === 0 ? 0.17 : 0.13, color: DRUG_COL, seed: 3 + i * 2, accent: 0xfff0c8 })
    m.visible = false
    sheet.add(m)
    drugs.push({
      m,
      a0: (i / DRUG_N) * Math.PI * 2 + 0.6,
      sp: (0.18 + (i % 3) * 0.05) * (i % 2 ? -1 : 1),
      rx: 2.3 + (i % 3) * 0.35,
      rz: 1.1 + (i % 2) * 0.5,
      y: 0.8 + (i % 4) * 0.3,
    })
    tag(m, '<b>卡巴馬平（carbamazepine）</b><br>常用於癲癇與三叉神經痛的藥物。此處為示意的小分子，不是真實結構。')
  }
  const drugGlow = util.makeGlow(DRUG_COL, 1.2, 0)
  sheet.add(drugGlow)

  // ───────────────────────── 1,000 人點陣（永遠正對鏡頭的看板） ─────────────────────────
  const N = 1000
  const COLS = 50
  const SP = 0.2
  const ROWS_MIXED = 20
  const ROWS_SPLIT = 22 // 陰性 19 列 + 空 1 列 + 陽性 2 列
  const GRID_W = (COLS - 1) * SP + 0.3
  const GRID_ASPECT = 2.35
  const dotsGroup = new THREE.Group()
  dotsGroup.position.copy(FRAME_C)
  scene.add(dotsGroup)
  const dots = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.078, 1), new THREE.MeshBasicMaterial({ color: 0xffffff }), N)
  dots.frustumCulled = false
  dots.boundingSphere = new THREE.Sphere(new V3(0, 0, 0), 7)
  dotsGroup.add(dots)

  const dr = util.rng(2024)
  const order = Array.from({ length: N }, (_, i) => i)
  for (let i = N - 1; i > 0; i--) {
    const j = Math.floor(dr() * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  const CARRIERS = 77 // Chen 2011：篩檢族群中陽性 7.7%
  const CASE_SLOTS = [58, 71] // 0.23% × 1,000 ≈ 2.3（示意，取整為 2）；放在陽性者的下排，方便標示
  const SHIFT = 0.7 // 篩檢後陽性者被帶離用藥隊伍的位移（世界單位）
  const carrier = new Uint8Array(N)
  const isCase = new Uint8Array(N)
  order.slice(0, CARRIERS).forEach((id) => {
    carrier[id] = 1
  })
  {
    let cc = 0
    for (let i = 0; i < N; i++) {
      if (!carrier[i]) continue
      if (CASE_SLOTS.includes(cc)) isCase[i] = 1
      cc++
    }
  }
  const posMixed = new Float32Array(N * 2)
  const posSplit = new Float32Array(N * 2)
  const delay = new Float32Array(N)
  const colFrac = new Float32Array(N)
  {
    let nn = 0
    let cc = 0
    for (let i = 0; i < N; i++) {
      const col0 = i % COLS
      const row0 = Math.floor(i / COLS)
      posMixed[i * 2] = (col0 - (COLS - 1) / 2) * SP
      posMixed[i * 2 + 1] = ((ROWS_MIXED - 1) / 2 - row0) * SP
      let slot
      let rowOff
      if (carrier[i]) {
        slot = cc++
        rowOff = 20 // 陽性者放在最下方兩列
      } else {
        slot = nn++
        rowOff = 0
      }
      const col1 = slot % COLS
      const row1 = Math.floor(slot / COLS) + rowOff
      posSplit[i * 2] = (col1 - (COLS - 1) / 2) * SP
      posSplit[i * 2 + 1] = ((ROWS_SPLIT - 1) / 2 - row1) * SP
      delay[i] = dr()
      colFrac[i] = col0 / (COLS - 1)
    }
  }
  const cSlate = new THREE.Color(NEUTRAL)
  const cSafe = new THREE.Color(C.green).lerp(cSlate, 0.4)
  const cGhost = new THREE.Color(0x7a3346)
  const cCarrier = new THREE.Color(C.hla)
  const cCase = new THREE.Color(C.red)
  const dotCur = Array.from({ length: N }, () => new THREE.Color(NEUTRAL))
  const caseIds = [...Array(N).keys()].filter((i) => isCase[i])
  const caseGlows = caseIds.map(() => {
    const g = util.makeGlow(C.red, 0.7, 0.9)
    dotsGroup.add(g)
    return g
  })
  // 篩檢後：被避免的 2 例以紅色虛圈標示；陽性者外框表示「改用替代藥」
  const ghostRings = caseIds.map(() => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.195, 28), new THREE.MeshBasicMaterial({ color: C.red, transparent: true, opacity: 0, depthWrite: false }))
    m.visible = false
    dotsGroup.add(m)
    return m
  })
  const caseXY = caseIds.map(() => ({ x: 0, y: 0 }))
  const boxGeo = new THREE.BufferGeometry().setFromPoints([new V3(-5.0, -1.72, 0), new V3(5.0, -1.72, 0), new V3(5.0, -2.28, 0), new V3(-5.0, -2.28, 0), new V3(-5.0, -1.72, 0)])
  const carrierBox = new THREE.Line(boxGeo, new THREE.LineDashedMaterial({ color: C.hla, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0, depthWrite: false }))
  carrierBox.computeLineDistances()
  carrierBox.visible = false
  dotsGroup.add(carrierBox)
  let hovered = -1
  const tmpC = new THREE.Color()
  const tmpC2 = new THREE.Color()
  const tiltQ = new THREE.Quaternion()
  const tiltE = new THREE.Euler()
  const tilt = { x: 0, y: 0 }

  function updateDots(dt, t, vmE) {
    const scr = A.screened
    let ci = 0
    for (let i = 0; i < N; i++) {
      const k = easeInOut(clamp(A.split * 1.5 - delay[i] * 0.5, 0, 1))
      const x = lerp(posMixed[i * 2], posSplit[i * 2], k)
      const y = lerp(posMixed[i * 2 + 1], posSplit[i * 2 + 1], k) - (carrier[i] ? SHIFT * scr * k : 0) // 篩檢後：陽性者被帶離用藥隊伍
      const reveal = smoothstep(0, 1, vmE * 1.8 - colFrac[i] * 0.8)
      let s = 1
      let target = scr > 0.01 && !carrier[i] ? tmpC2.copy(cSlate).lerp(cSafe, scr) : cSlate
      if (carrier[i]) target = cCarrier
      if (isCase[i]) {
        target = tmpC.copy(cCase).lerp(cGhost, scr)
        s = lerp(1.9, 1.15, scr)
        const g = caseGlows[ci]
        g.position.set(x, y, 0.02)
        g.material.opacity = lerp(0.85 + 0.15 * Math.sin(t * 5), 0, scr) * reveal
        g.scale.setScalar(lerp(0.75, 0.55, scr) * (1 + 0.15 * Math.sin(t * 5) * (1 - scr)))
        const ring = ghostRings[ci]
        ring.position.set(x, y, 0.03)
        ring.visible = scr > 0.02
        ring.material.opacity = scr * 0.95 * reveal
        caseXY[ci].x = x
        caseXY[ci].y = y
        ci++
      } else if (carrier[i]) s = 1.25
      if (i === hovered) s *= 1.7
      dotCur[i].lerp(target, 1 - Math.exp(-9 * Math.max(dt, 0.001)))
      dots.setColorAt(i, dotCur[i])
      m4.compose(pv.set(x, y, 0), qq.identity(), sv.setScalar(s * reveal))
      dots.setMatrixAt(i, m4)
    }
    dots.instanceMatrix.needsUpdate = true
    dots.instanceColor.needsUpdate = true
    carrierBox.visible = scr > 0.02
    carrierBox.position.y = -SHIFT * scr * easeInOut(clamp(A.split * 1.5 - 0.25, 0, 1))
    carrierBox.material.opacity = 0.85 * scr * vmE
  }
  for (let i = 0; i < N; i++) dots.setColorAt(i, dotCur[i])

  // ───────────────────────── 版面（安全區縮放）與標籤 ─────────────────────────
  const fit = createFit(ctx)
  const labels = createLabels(ctx, fit.region)
  const isNarrow = () => view.clientWidth < 520
  const anc = (parent, x, y, z) => {
    const v = new V3()
    return () => parent.localToWorld(v.set(x, y, z))
  }
  const mechOn = (f = () => true) => () => S.view === 'mech' && A.zoom < 0.4 && f()
  labels.add('hla', { text: 'HLA-B 分子（展示櫃）', short: 'HLA-B', side: 'l', core: true, color: hex(C.hla), anchor: anc(hla, -0.62, 0.72, 0.25), on: mechOn() })
  labels.add('pep', { text: '胜肽（蛋白質碎片）', short: '胜肽', side: 'l', color: hex(C.peptide), anchor: anc(hla, -0.45, 1.16, 0), on: mechOn(), dy: -6 })
  labels.add('pocket', { text: '凹槽（藥物可能結合處，示意）', short: '凹槽（示意）', side: 'r', core: true, color: hex(C.cyan), anchor: anc(hla, POCKET.x + 0.1, 1.1, 0.05), on: mechOn(() => !S.drug), dy: 8 })
  labels.add('tcr', { text: 'T 細胞受體（TCR）', short: 'TCR', side: 'r', core: true, color: hex(TCOL), anchor: (() => {
      const v = new V3()
      return () => tGroup.localToWorld(v.set(0.05, -TR - TCR_LEN * 0.55, 0))
    })(), on: mechOn() })
  labels.add('tc', { text: 'T 細胞', side: 'l', color: hex(TCOL), anchor: (() => {
      const v = new V3()
      return () => tGroup.localToWorld(v.set(-1.0, -0.85, 0.5))
    })(), on: mechOn() })
  labels.add('drug', { text: '卡巴馬平（藥物）', short: '藥物', side: 'l', core: true, color: hex(DRUG_COL), anchor: (() => {
      const v = new V3()
      return () => drugs[0].m.getWorldPosition(v)
    })(), on: mechOn(() => A.drugIn > 0.5), gap: 30, dy: -34 })
  labels.add('ok', { text: '✓ 自己人，放行', short: '✓ 自己人', side: 'r', core: true, color: hex(C.green), anchor: anc(hla, -0.1, 1.3, 0), on: () => S.view === 'mech' && !S.drug && S.step === 1 && !S.free && scanV > 0.45, gap: 26, dy: -20 })
  labels.add('cell', { text: '皮膚細胞表面', side: 'r', color: '#7da0ff', anchor: anc(sheet, 2.6, -0.05, 1.3), on: mechOn(), dy: 4 })
  labels.add('skin', { text: '表皮剝離（SJS/TEN 示意）', short: '表皮剝離（示意）', side: 'r', core: true, color: hex(C.red), anchor: anc(world, 4.0, -1.35, 0.8), on: () => S.view === 'mech' && A.dmg > 0.6 })
  labels.add('tcT', { text: '被活化的 T 細胞', short: '活化的 T 細胞', side: 'r', core: true, color: hex(TCOL), anchor: (() => {
      const v = new V3()
      return () => tGroup.localToWorld(v.set(1.2, 0.8, 0))
    })(), on: () => S.view === 'mech' && A.zoom > 0.6 })
  const dotsOn = (f = () => true) => () => S.view === 'screen' && A.vm > 0.7 && f()
  const dotAnchor = (x, y) => {
    const v = new V3()
    return () => dotsGroup.localToWorld(v.set(x, y, 0))
  }
  const TOP_Y = ((ROWS_SPLIT - 1) / 2) * SP + 0.05
  labels.add('top', { text: '每一點代表 1 人，共 1,000 人（示意）', short: '每點 1 人，共 1,000 人（示意）', side: 't', core: true, color: '#9aa6c4', anchor: dotAnchor(0, TOP_Y), on: dotsOn(() => S.dotMode === 'mixed'), gap: 8 })
  labels.add('neg', { text: '不帶有 HLA-B*15:02 者：923 人，幾乎無人發病（示意）', short: '不帶有 923 人：幾乎無人發病', side: 't', core: true, color: '#9aa6c4', anchor: dotAnchor(0, TOP_Y), on: dotsOn(() => S.dotMode === 'group'), gap: 8 })
  labels.add('neg2', { text: '陰性 923 人：照常使用', short: '陰性 923 人：照常使用', side: 't', core: true, color: '#9aa6c4', anchor: dotAnchor(0, TOP_Y), on: dotsOn(() => S.dotMode === 'screen'), gap: 8 })
  labels.add('pos', { text: '攜帶者 77 人：其中約 2 人發病（示意）', short: '攜帶者 77 人：約 2 人發病', side: 'b', core: true, color: hex(C.hla), anchor: dotAnchor(0, -TOP_Y), on: dotsOn(() => S.dotMode === 'group'), gap: 8 })
  // 篩檢後：標籤放在「陰性隊伍」與「陽性者」之間的空隙（不擠到底部圖例）
  const pos2Anchor = new V3()
  labels.add('pos2', { text: '陽性 77 人：研究中建議避開，改用替代藥（需謹慎選擇）', short: '陽性 77 人：改用替代藥', side: 't', core: true, color: hex(C.hla), anchor: () => dotsGroup.localToWorld(pos2Anchor.set(0, -1.72 - SHIFT * A.screened, 0)), on: dotsOn(() => S.dotMode === 'screen'), gap: 5 })
  const ghostAnchor = new V3()
  labels.add('ghost', { text: '紅圈：原本約 2 例，篩檢後避開（示意）', short: '紅圈：原約 2 例（示意）', side: 'r', core: true, color: hex(C.red), anchor: () => dotsGroup.localToWorld(ghostAnchor.set(0.3, -2.1 - SHIFT * A.screened, 0)), on: dotsOn(() => S.dotMode === 'screen' && A.screened > 0.8), gap: 14 })

  // ───────────────────────── 控制項 ─────────────────────────
  const uiView = ui.segmented({
    label: '檢視',
    options: [
      { value: 'mech', label: '機制：免疫辨識' },
      { value: 'screen', label: '篩檢的意義' },
    ],
    value: 'mech',
    onChange: (v) => {
      S.view = v
      S.free = true
      pending.mode = null
      resetPointerUi()
      syncUi()
    },
  })
  const uiHla = ui.segmented({
    label: '細胞表面的 HLA-B 型別',
    options: [
      { value: 'risk', label: 'HLA-B*15:02（風險型）', color: C.hla },
      { value: 'other', label: '其他 HLA-B', color: C.inactive },
    ],
    value: 'risk',
    onChange: (v) => {
      S.hla = v
      S.free = true
      syncUi()
    },
  })
  const uiDrug = ui.toggle({
    label: '加入藥物（卡巴馬平）',
    value: false,
    onChange: (v) => {
      S.drug = v
      S.free = true
      drugTouched = true
      syncUi()
    },
  })
  const uiModel = ui.segmented({
    label: '機制模型（示意，學界並存數種假說）',
    options: [
      { value: 'pi', label: '藥物直接嵌入 (p-i)' },
      { value: 'rep', label: '改變胜肽庫' },
    ],
    value: 'pi',
    onChange: (v) => {
      S.model = v
      S.free = true
      syncUi()
    },
  })
  const uiDot = ui.segmented({
    label: '1,000 位準備用藥的人（示意）',
    options: [
      { value: 'mixed', label: '① 不篩檢' },
      { value: 'group', label: '② 依 HLA 分組' },
      { value: 'screen', label: '③ 篩檢、陽性改用替代藥' },
    ],
    value: 'mixed',
    onChange: (v) => {
      S.dotMode = v
      S.free = true
      pending.mode = null
      resetPointerUi()
      syncUi()
    },
  })
  const ro1 = ui.readout({ label: '', value: '' })
  const ro2 = ui.readout({ label: '', value: '' })
  ui.note('全部為示意圖：分子形狀與尺度已簡化；1,000 人點陣依 Chen 等人 2011 (NEJM) 的比例換算，不是真實個案。點擊分子或圓點可看說明。')

  function resetPointerUi() {
    hovered = -1
    hud.tip(null)
    ctx.setCursor('')
  }
  function syncUi() {
    uiView.set(S.view)
    uiHla.set(S.hla)
    uiDrug.set(S.drug)
    uiModel.set(S.model)
    uiDot.set(S.dotMode)
    const mech = S.view === 'mech'
    uiHla.el.style.display = uiDrug.el.style.display = uiModel.el.style.display = mech ? '' : 'none'
    uiDot.el.style.display = mech ? 'none' : ''
  }
  const roCache = new Map()
  const setRo = (ro, label, value, color) => {
    const k = label + '|' + value + '|' + (color || '')
    if (roCache.get(ro) === k) return
    roCache.set(ro, k)
    ro.el.querySelector('.readout-label').textContent = label
    ro.set(value)
    ro.setColor(color || '')
  }

  // ───────────────────────── 說明文字（寬螢幕長版 / 窄螢幕短版） ─────────────────────────
  const CAP = () => (S.free ? 3 : CAP_BY_STEP[S.step] ?? 0)
  function captionText() {
    const nr = isNarrow()
    const pick = (long, short) => (nr ? short : long)
    if (S.view === 'screen') {
      if (S.dotMode === 'screen')
        return pick(
          '篩檢後：陽性者（藍）在研究中被建議改用替代藥（需謹慎選擇），陰性者（綠）照常用藥；紅色空心圈是原本約 2 例（示意）。Chen 2011：陰性且服藥者 0 例，研究內歷史預期約 10 例（單組設計）。',
          '篩檢後陽性者改用替代藥。Chen 2011：陰性服藥者 0 例，研究內歷史預期約 10 例。'
        )
      if (S.dotMode === 'group')
        return pick(
          '依 HLA 分組：77 位攜帶者中約 2 人發病（示意），其餘 923 人幾乎沒有人發病（不是零）。所以陽性預測值低、陰性預測值高。',
          '示意：77 位攜帶者中約 2 人發病；其餘 923 人幾乎無人發病。'
        )
      return pick(
        '1,000 人（示意）都要開始吃卡巴馬平：約 77 人（7.7%）帶有 HLA-B*15:02（亮藍），依歷史發生率 0.23% 推算約 2 人發病（紅）。事前分不出是誰；點紅點看說明。',
        '示意：1,000 人同時用藥。亮藍點=攜帶者（7.7%），紅點=發病者（約 2 人），點紅點看說明。'
      )
    }
    const hit = S.hla === 'risk' && S.drug
    if (!S.drug) {
      if (S.step === 1 && !S.free)
        return pick('正常呈現：HLA 端出「自己的」胜肽，T 細胞用受體（TCR）碰一下、認出是自己人，就繼續巡邏，不會攻擊。', '正常：TCR 認出是「自己的」胜肽，T 細胞放行。')
      return pick('HLA 像細胞表面的「展示櫃」，把細胞內蛋白質的碎片（胜肽）擺出來，讓 T 細胞巡邏檢查。試試「加入藥物」。', 'HLA 是細胞的「展示櫃」，擺出胜肽讓 T 細胞檢查。試試加入藥物。')
    }
    if (!hit) return pick('這一型 HLA-B 的凹槽與卡巴馬平不合（示意）：藥物擦身而過，呈現的胜肽沒變，T 細胞沒有新訊號，所以沒有反應。', '凹槽不合（示意）：藥物放不進去，T 細胞沒有新訊號。')
    if (A.dmg > 0.5) return pick('T 細胞攻擊皮膚細胞，整層表皮與真皮分離，這就是 SJS/TEN 的示意（遲發型過敏，多在用藥後數天到數週出現）。注意：實際上多數攜帶者用藥後不會走到這一步。', 'T 細胞攻擊皮膚，表皮剝離：SJS/TEN 示意。多數攜帶者不會發展到此。')
    if (A.act > 0.5) return pick('TCR 把「HLA + 藥物 + 胜肽」認成異物，T 細胞被活化，釋放細胞毒性物質（示意）。', 'TCR 認成異物，T 細胞活化並釋放毒性物質（示意）。')
    if (A.dock > 0.5)
      return S.model === 'pi'
        ? pick('藥物嵌進 HLA-B*15:02 的凹槽（p-i 模型示意）：藥物本身露在表面，成為 T 細胞看得到的新特徵。實際機制尚無單一定論。', 'p-i 模型示意：藥物嵌入凹槽、露在表面。機制尚無定論。')
        : pick('藥物嵌進凹槽，改變了凹槽形狀，HLA 改呈現另一批自體胜肽（改變胜肽庫模型示意）。實際機制尚無單一定論。', '改變胜肽庫示意：HLA 改呈現另一批自體胜肽。機制尚無定論。')
    return '藥物分子漂向 HLA-B*15:02 的凹槽……'
  }
  function legendFor() {
    if (isNarrow()) return [] // 窄螢幕舞台太矮：顏色改由圖說與標籤說明，把空間留給主體
    if (S.view === 'screen' && S.dotMode === 'screen')
      return [
        { color: cSafe.getHex(), label: '陰性：照常用藥' },
        { color: C.hla, label: '陽性：改用替代藥' },
        { color: C.red, label: '紅圈：原約 2 例（示意）' },
      ]
    if (S.view === 'screen')
      return [
        { color: NEUTRAL, label: '不帶有' },
        { color: C.hla, label: '帶有 HLA-B*15:02' },
        { color: C.red, label: '發病（示意）' },
      ]
    if (A.zoom > 0.5)
      return [
        { color: 0xf2b3b0, label: '表皮' },
        { color: 0xb8607c, label: '真皮' },
        { color: 0x8c8ea6, label: '受攻擊的細胞' },
        { color: TCOL, label: '活化的 T 細胞' },
      ]
    return [
      { color: C.hla, label: 'HLA-B' },
      { color: C.peptide, label: '胜肽' },
      { color: DRUG_COL, label: '藥物' },
      { color: TCOL, label: 'T 細胞' },
    ]
  }
  let legendKey = ''
  let capKey = ''
  function refreshText() {
    const lk = S.view + (S.view === 'screen' ? S.dotMode : A.zoom > 0.5 ? 'z' : '') + (isNarrow() ? 'n' : 'w')
    if (lk !== legendKey) {
      legendKey = lk
      hud.legend(legendFor())
      hud.badge(isNarrow() ? (S.view === 'screen' ? '示意：模擬人群' : '示意圖') : S.view === 'screen' ? '示意：比例換算的模擬人群' : '示意圖：形狀與尺度已簡化')
      fit.markDirty()
    }
    const hit = S.hla === 'risk' && S.drug
    const text = captionText()
    const key = S.view + text
    if (key !== capKey) {
      capKey = key
      hud.caption(text)
      fit.markDirty()
    }
    if (S.view === 'screen') {
      setRo(ro1, '篩檢陽性（建議避開此藥）', '77 / 1,000 人（7.7%）', hex(C.hla))
      setRo(
        ro2,
        S.dotMode === 'screen' ? '研究（4,877 人）陰性且服藥者的 SJS/TEN' : S.dotMode === 'group' ? '示意：各組的發病人數' : '不篩檢時的 SJS/TEN（歷史發生率推算）',
        S.dotMode === 'screen' ? '0 例；歷史預期約 10 例（人數與本圖不同）' : S.dotMode === 'group' ? '攜帶者約 2/77；非攜帶者約 0/923' : '約 2 例 / 1,000 人（0.23%）',
        S.dotMode === 'screen' ? hex(C.green) : hex(C.red)
      )
    } else {
      setRo(ro1, 'HLA 與藥物', !S.drug ? '未加入藥物' : hit ? (A.dock > 0.5 ? '藥物嵌入凹槽（示意）' : '藥物接近中…') : '藥物擦身而過（不合）', S.drug ? (hit ? hex(DRUG_COL) : hex(C.inactive)) : '')
      setRo(
        ro2,
        'T 細胞判讀',
        A.dmg > 0.5 ? '攻擊皮膚細胞（示意）' : A.act > 0.5 ? '偵測到異物訊號 → 活化' : hit && A.dock > 0.5 && CAP() < 2 ? '尚未接觸' : '巡邏中：判定為「自己」',
        A.dmg > 0.5 ? hex(C.red) : A.act > 0.5 ? hex(TCOL) : hex(C.green)
      )
    }
  }

  // ───────────────────────── 指標：點擊 / 懸停 ─────────────────────────
  function dotTip(i) {
    const m = S.dotMode
    if (isCase[i] && m !== 'screen') return '<b>發生 SJS/TEN 的人（示意）</b><br>依歷史發生率 0.23% 推算，每 1,000 人約 2 位。'
    if (isCase[i]) return '<b>原本可能發病的人（示意）</b><br>依歷史發生率推算，不篩檢時每 1,000 人約 2 位；篩檢後這類人改用替代藥。這是換算的示意，不是實測個案。'
    if (carrier[i]) return m === 'screen' ? '<b>HLA-B*15:02 陽性</b><br>研究中被建議避開卡巴馬平、改用替代藥（替代藥也需謹慎選擇）。' : '<b>HLA-B*15:02 攜帶者</b><br>風險較高，但多數攜帶者不會發病，事前無法分辨。'
    return m === 'screen' ? '<b>HLA-B*15:02 陰性</b><br>依研究流程照常使用；仍須留意皮疹等症狀。Chen 2011：陰性且服藥者追蹤 2 個月無人發生 SJS/TEN。' : '<b>不帶有 HLA-B*15:02</b><br>發生 SJS/TEN 的機會很低（不是零）。'
  }
  const pickV = new V3()
  const isShown = (o) => {
    for (; o; o = o.parent) if (o.visible === false) return false
    return true
  }
  const unsub = ctx.onPointer((type) => {
    if (S.view === 'screen' && A.vm > 0.5) {
      if (type === 'move' || type === 'click') {
        const hit = ctx.pick([dots], false)
        let id = hit.length ? hit[0].instanceId : -1
        // 兩個紅點太小，手指/滑鼠很難點中：在半徑內就近吸附
        if (id < 0 || !isCase[id]) {
          const pt = ctx.pointer
          const rad = ctx.coarsePointer ? 26 : 12
          let best = rad * rad
          for (let k = 0; k < caseIds.length; k++) {
            if (S.dotMode === 'screen' && A.screened < 0.5) break
            const q = ctx.project(dotsGroup.localToWorld(pickV.set(caseXY[k].x, caseXY[k].y, 0)))
            const d2 = (q.x - pt.px) ** 2 + (q.y - pt.py) ** 2
            if (d2 < best) {
              best = d2
              id = caseIds[k]
            }
          }
        }
        if (type === 'move') {
          if (id !== hovered) {
            hovered = id
            hud.tip(id >= 0 ? dotTip(id) : null)
          }
        } else {
          hovered = id
          hud.tip(id >= 0 ? dotTip(id) : null)
        }
        ctx.setCursor(id >= 0 ? 'pointer' : '')
      } else if (type === 'leave' || type === 'cancel') {
        hovered = -1
        hud.tip(null)
      }
      return
    }
    if (S.view === 'mech' && (type === 'click' || type === 'move')) {
      const hits = ctx.pick(pickables)
      let html = null
      for (const h of hits) {
        let o = h.object
        while (o && !o.userData.tip) o = o.parent
        if (o && o.userData.tip && isShown(o)) {
          html = o.userData.tip
          break
        }
      }
      if (type === 'click') hud.tip(html)
      else ctx.setCursor(html ? 'pointer' : '')
    }
    if (type === 'leave') {
      hud.tip(null)
      ctx.setCursor('')
    }
  })

  // ───────────────────────── 步驟預設 ─────────────────────────
  const PRESETS = [
    { view: 'mech', hla: 'risk', drug: false },
    { view: 'mech', hla: 'risk', drug: false },
    { view: 'mech', hla: 'risk', drug: true },
    { view: 'mech', hla: 'risk', drug: true },
    { view: 'screen', dotMode: 'mixed' },
    { view: 'screen', dotMode: 'screen' },
  ]
  function applyStep(i) {
    const p = PRESETS[Math.min(i, PRESETS.length - 1)]
    S.step = i
    Object.assign(S, p)
    S.free = false
    pending.mode = i === 4 ? 'group' : null // 第 4 步：先看到全部混在一起，稍後自動依 HLA 分組
    pending.t = 0
    hud.tip(null)
    syncUi()
  }

  // ───────────────────────── 每幀 ─────────────────────────
  const ringCyan = new THREE.Color(C.cyan)
  const ringDrug = new THREE.Color(DRUG_COL)
  const dockPos = new V3()
  const nearPos = new V3(0.95, 1.75, 0.7)
  const tmpMid = new V3()
  const tmpFrom = new V3()
  const tmpTip = new V3()
  const Tg = {}
  const LAM = { drugIn: 3.2, dock: 3, engage: 3.5, act: 2.6, zoom: 1.7, dmg: 1.1, vm: 3.2, split: 1.6, screened: 2.2 }
  let scanV = 0
  let lastWall = performance.now()
  let drugTouched = false
  let pulseKey = ''
  function update(dt0, t) {
    // 暫停時環境動畫凍結（dt=0），但使用者操作觸發的轉場與取景仍要播放：改用實際經過的時間
    const now = performance.now()
    const wall = Math.min(0.05, Math.max(0, (now - lastWall) / 1000))
    lastWall = now
    const dt = ctx.paused ? wall : dt0
    const hit = S.hla === 'risk' && S.drug
    const cap = CAP()

    if (pending.mode && S.view === 'screen' && A.vm > 0.9) {
      pending.t += dt
      if (pending.t > 1.6) {
        S.dotMode = pending.mode
        pending.mode = null
        syncUi()
      }
    }

    Tg.drugIn = S.drug ? 1 : 0
    Tg.dock = hit && A.drugIn > 0.8 && cap >= 1 ? 1 : 0
    Tg.engage = hit && A.dock > 0.85 && cap >= 2 ? 1 : 0
    Tg.act = A.engage > 0.85 ? 1 : 0
    Tg.zoom = hit && A.act > 0.7 && cap >= 3 ? 1 : 0
    Tg.dmg = A.zoom > 0.8 ? 1 : 0
    Tg.vm = S.view === 'screen' ? 1 : 0
    Tg.split = S.dotMode !== 'mixed' ? 1 : 0
    Tg.screened = S.dotMode === 'screen' ? 1 : 0
    for (const k in Tg) A[k] = damp(A[k], Tg[k], LAM[k], dt)

    // 世界縮放：分子視角 ↔ 組織視角 ↔ 點陣
    const zE = easeInOut(A.zoom)
    const vmE = easeInOut(clamp(A.vm, 0, 1))
    const mechVis = clamp(1 - vmE * 1.6, 0, 1)
    const s = lerp(1.9, 0.8, zE)
    const focusY = lerp(2.0, 1.85, zE)
    world.scale.setScalar(Math.max(0.0001, s * mechVis))
    world.position.set(0, FRAME_C.y - s * mechVis * focusY, 0)
    world.visible = mechVis > 0.01

    // 點陣看板：永遠正對鏡頭，大小以「未縮放時占視窗寬度 94%」為準（再由安全區縮放）
    const W = view.clientWidth
    const H = view.clientHeight
    dotsGroup.visible = vmE > 0.01
    if (dotsGroup.visible && W && H) {
      const d = camera.position.distanceTo(FRAME_C)
      const worldH = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const sc = (((W * 0.94) / H) * worldH) / GRID_W
      const p = ctx.pointer
      tilt.x = damp(tilt.x, p.inside ? p.y * 0.1 : 0, 4, dt)
      tilt.y = damp(tilt.y, p.inside ? p.x * 0.14 : 0, 4, dt)
      tiltQ.setFromEuler(tiltE.set(-tilt.x, tilt.y, 0))
      dotsGroup.quaternion.copy(camera.quaternion).multiply(tiltQ)
      dotsGroup.scale.setScalar(Math.max(0.0001, sc * (0.85 + 0.15 * vmE)))
      dotsGroup.position.copy(FRAME_C)
      updateDots(dt, t, vmE)
    }

    // 安全區縮放：機制檢視的主體約是視窗短邊的 85%；點陣檢視的主體是 94% 寬 × （寬/長寬比）
    const D0 = 0.8 * Math.min(W, H)
    const gW = W * 0.94
    // 篩檢後陽性者下移 SHIFT 個世界單位：把這段高度算進主體；上下各留約 36px 給標籤
    const shiftPx = (gW / GRID_W) * SHIFT * A.screened
    fit.update(dt, { w: lerp(D0, gW, vmE), h: lerp(D0, gW / GRID_ASPECT + shiftPx, vmE), padY: 76 * vmE })

    if (Math.abs(A.dmg - lastDmgApplied) > 0.002) setTissue(A.dmg)

    // HLA：凹槽標記與胜肽
    const risk = S.hla === 'risk'
    pocketRing.visible = pocketDisc.visible = risk
    plug.visible = !risk
    pocketGlow.visible = risk
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 * motion)
    M.ring.emissiveIntensity = lerp(1.2 + 1.2 * pulse, 0.5, A.dock)
    M.ring.color.copy(ringCyan).lerp(ringDrug, A.dock)
    M.ring.emissive.copy(M.ring.color)
    pocketGlow.material.opacity = (1 - A.dock) * (0.25 + 0.3 * pulse)
    const repl = S.model === 'rep' ? easeInOut(A.dock) : 0
    pepA.scale.setScalar(Math.max(0.001, 1 - repl))
    pepB.scale.setScalar(Math.max(0.001, repl))
    pepA.visible = repl < 0.98
    pepB.visible = repl > 0.02

    // 藥物分子
    dockPos.set(POCKET.x, S.model === 'pi' ? 1.34 : 1.24, POCKET.z)
    drugs.forEach((d, i) => {
      const vis = clamp(A.drugIn * 1.4 - i * 0.12, 0, 1)
      d.m.visible = vis > 0.01
      if (!d.m.visible) return
      const ang = d.a0 + t * d.sp * motion
      const far = lerp(1.9, 1, easeInOut(vis))
      const bob = Math.sin(t * 1.3 + i * 1.7) * 0.12 * motion
      const ox = TX * 0.3 + Math.cos(ang) * d.rx * far
      const oz = Math.sin(ang) * d.rz * far
      const oy = d.y + bob
      let x = ox
      let y = oy
      let z = oz
      if (i === 0) {
        const approach = hit ? 0 : 0.5 * (0.5 - 0.5 * Math.cos(t * 1.6)) * A.drugIn
        const q = hit ? easeInOut(A.dock) : approach
                if (hit) {
          const mid = tmpMid.lerpVectors(tmpFrom.set(ox, oy, oz), nearPos, clamp(A.drugIn, 0, 1) * 0.6)
          x = lerp(mid.x, dockPos.x, q)
          y = lerp(mid.y, dockPos.y, q) + Math.sin(q * Math.PI) * 0.35
          z = lerp(mid.z, dockPos.z, q)
        } else {
          x = lerp(ox, nearPos.x, approach)
          y = lerp(oy, nearPos.y, approach)
          z = lerp(oz, nearPos.z, approach)
        }
      }
      d.m.position.set(x, y, z)
      d.m.rotation.set(t * 0.6 * motion + i, t * 0.8 * motion, i * 0.7)
      d.m.scale.setScalar(vis * (i === 0 ? 1.15 + 0.45 * (hit ? easeInOut(A.dock) : 0) : 1))
    })
    const d0 = drugs[0]
    drugGlow.position.copy(d0.m.position)
    drugGlow.material.opacity = 0.55 * clamp(A.drugIn, 0, 1) * (hit ? 0.5 + 0.5 * A.dock : 0.5)

    // T 細胞：巡邏（輕碰） → 接觸 → 活化
    // 第 1 步（正常巡邏）把「碰一下、檢查通過」演得明顯：週期約 3 秒、下探較深、綠光較亮
    const demo = !S.drug && S.step === 1 && !S.free
    const scanWave = Math.pow(0.5 - 0.5 * Math.cos(t * (demo ? 2.1 : 1.15)), demo ? 1.2 : 1.6)
    const scanning = (1 - A.engage) * (1 - A.dock * 0.9)
    scanV = scanWave * scanning
    const touchDrop = (demo ? 0.3 : 0.15) * scanWave * scanning * motion + 0.31 * easeInOut(A.engage)
    const actPulse = A.act * (0.5 + 0.5 * Math.sin(t * 7))
    tGroup.position.set(TX + Math.sin(t * 0.5) * 0.05 * motion, T0 - touchDrop + Math.sin(t * 0.9) * 0.05 * motion, 0)
    tBody.scale.setScalar(1 + 0.018 * actPulse)
    M.tcell.emissiveIntensity = 0.12 + 0.75 * A.act * (0.6 + 0.4 * Math.sin(t * 7))
    M.tcr.emissiveIntensity = 0.3 + 1.2 * A.engage
    tHalo.material.opacity = 0.18 + 0.5 * A.act * (0.75 + 0.25 * Math.sin(t * 6))
    tcrMain.rotation.z = Math.sin(t * 1.4) * 0.03 * (1 - A.engage) * motion
    scanGlow.material.opacity = (demo ? 1 : 0.75) * scanWave * scanning * (1 - A.dock)
    world.updateMatrixWorld(true)
    const tipW = tGroup.localToWorld(tmpTip.copy(TCR_TIP_LOCAL))
    contactGlow.position.copy(hla.worldToLocal(tipW))
    contactGlow.material.opacity = 0.8 * A.engage * (0.7 + 0.3 * Math.sin(t * 8))
    contactGlow.scale.setScalar(1.3 + 0.35 * A.engage)

    // 細胞毒性顆粒
    if (A.act > 0.03) {
      for (let i = 0; i < NP; i++) {
        const g = gp[i]
        g.ph += dt0 * g.sp
        if (g.ph > 1) g.ph -= 1
        const u = g.ph
        const x = lerp(g.sx, g.ex, u)
        const z = lerp(g.sz, g.ez, u)
        const y = lerp(2.75, 0.12, u * u) + Math.sin(u * Math.PI) * g.arc
        const on = A.act * Math.sin(Math.PI * u) * (i < NP * A.act ? 1 : 0)
        m4.compose(pv.set(x, y, z), qq.identity(), sv.setScalar(Math.max(0.0001, on * 1.3)))
        gran.setMatrixAt(i, m4)
      }
      gran.instanceMatrix.needsUpdate = true
      gran.visible = true
    } else gran.visible = false

    dust.rotation.y = t * 0.02 * motion
    glowA.material.opacity = 0.2 + 0.03 * Math.sin(t * 0.6) * motion

    // 尚未碰過「加入藥物」時，讓開關輕輕發光，新手一眼就找得到
    const nudge = !drugTouched && !S.drug && S.view === 'mech'
    const pk = nudge ? (motion ? Math.round(pulse * 8) : 4) : -1
    if (String(pk) !== pulseKey) {
      pulseKey = String(pk)
      const st = uiDrug.el.style
      if (nudge) {
        const p = pk / 8
        st.boxShadow = `0 0 0 ${(1 + 2 * p).toFixed(1)}px rgba(255,138,61,${(0.25 + 0.45 * p).toFixed(2)})`
        st.borderRadius = '10px'
      } else {
        st.boxShadow = ''
        st.borderRadius = ''
      }
    }

    refreshText()
    dotsGroup.updateMatrixWorld(true)
    camera.updateMatrixWorld()
    labels.update()
  }

  // 除錯/測試用：立刻把所有動畫推進到穩定值
  function jump() {
    for (let i = 0; i < 70; i++) update(0.3, i * 0.3)
  }

  applyStep(0)
  refreshText()

  return {
    update,
    onStep(i) {
      applyStep(i)
    },
    onResize() {
      labels.resetSizes()
      fit.invalidate()
      fit.markDirty()
    },
    onResetView() {},
    dispose() {
      unsub()
      labels.dispose()
      fit.dispose()
    },
    debug: {
      S,
      A,
      jump,
      applyStep,
      syncUi,
      fit,
      pending,
      get scanV() {
        return scanV
      },
    },
  }
}
