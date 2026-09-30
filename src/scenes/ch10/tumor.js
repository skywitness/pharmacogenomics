// ch10 主題①：腫瘤標靶。兩個觀察尺度：
//   cells 細胞：生殖細胞變異（藍，每個細胞都有） vs 體細胞突變（紅，只在腫瘤細胞）
//   rec   分子：EGFR 受體（二聚體）——ATP 口袋、標靶藥 TKI、T790M 守門員
// 畫面上的訊號強度與增殖高低皆為教學示意。

const SIGNAL_MAX = 56

export function createTumor(ctx, kit) {
  const { THREE, util, palette } = ctx
  const C = palette.COLORS
  const root = new THREE.Group()
  root.visible = false
  const cellsG = new THREE.Group()
  const recG = new THREE.Group() // 分子視角總群組（標籤不旋轉）
  const mol = new THREE.Group() // 分子本體：繞 z 轉 90 度，讓「細胞外 → 細胞質 → 細胞核」由左到右，配合寬螢幕
  mol.rotation.z = Math.PI / 2
  recG.add(mol)
  root.add(cellsG, recG)

  const tipTargets = []
  const addTip = (obj, tip) => {
    obj.userData.tip = tip
    tipTargets.push(obj)
    return obj
  }

  let view = 'cells'
  const st = { mutant: false, drug: 'none', resist: false }
  let level = '中'

  // ════════════════════════ 細胞尺度 ════════════════════════
  const cellDefs = []
  {
    const r = util.rng(91)
    const tc = new THREE.Vector2(1.55, 0.15)
    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 9; col++) {
        const x = -3.9 + col * 0.98 + (row % 2 ? 0.49 : 0) + r.range(-0.07, 0.07)
        const y = -2.05 + row * 0.82 + r.range(-0.06, 0.06)
        if (x > 4.4) continue
        const d = Math.hypot(x - tc.x, y - tc.y)
        cellDefs.push({ x, y, z: r.range(-0.12, 0.12), tumor: d < 1.5, ph: r.range(0, 6.28), sp: r.range(0.6, 1.3) })
      }
    }
  }
  const nCells = cellDefs.length
  const tumorIdx = cellDefs.map((c, i) => (c.tumor ? i : -1)).filter((i) => i >= 0)

  const memMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.34, roughness: 0.25, clearcoat: 0.8, depthWrite: false, emissive: 0x1a2c66, emissiveIntensity: 0.5 })
  const memMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 20, 14), memMat, nCells)
  memMesh.renderOrder = 2
  const nucMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, emissive: 0x22366e, emissiveIntensity: 0.5 })
  const nucMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), nucMat, nCells)
  const gemMat = new THREE.MeshStandardMaterial({ color: C.blue, emissive: C.blue, emissiveIntensity: 1.4, roughness: 0.25 })
  const gemMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), gemMat, nCells)
  const starMat = new THREE.MeshStandardMaterial({ color: C.red, emissive: C.red, emissiveIntensity: 1.6, roughness: 0.3 })
  const starMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), starMat, tumorIdx.length)
  const starMesh2 = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), starMat, tumorIdx.length)
  ;[memMesh, nucMesh, gemMesh, starMesh, starMesh2].forEach((m) => {
    m.frustumCulled = false
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    cellsG.add(m)
  })
  // InstancedMesh 的 boundingSphere 只算一次（細胞還沒長出來時是空的），會讓 raycast 在邊緣漏掉；給一個固定的大範圍
  memMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0.2, 0, 0), 6.5)
  const cNormalMem = new THREE.Color(0x4a78d8)
  const cTumorMem = new THREE.Color(0xd85a78)
  const cNormalNuc = new THREE.Color(0x8fb4ff)
  const cTumorNuc = new THREE.Color(0xff8fa4)
  cellDefs.forEach((c, i) => {
    memMesh.setColorAt(i, c.tumor ? cTumorMem : cNormalMem)
    nucMesh.setColorAt(i, c.tumor ? cTumorNuc : cNormalNuc)
  })
  const starGlows = tumorIdx.map(() => {
    const g = util.makeGlow(C.red, 0.95, 0)
    cellsG.add(g)
    return g
  })
  const lblNormal = kit.make('正常組織細胞', { fontSize: 40, worldHeight: 0.42, color: '#cfe0ff' })
  lblNormal.position.set(-2.6, -2.85, 0.8)
  const lblTumor = kit.make('腫瘤細胞群', { fontSize: 40, worldHeight: 0.42, color: '#ffd0d8', bg: 'rgba(60,12,24,0.75)', border: 'rgba(255,120,150,0.55)' })
  lblTumor.position.set(1.55, 2.5, 0.8)
  cellsG.add(lblNormal, lblTumor)

  const dummy = new THREE.Object3D()
  let cellsT = 0
  let sel = -1

  function updateCells(dt, t) {
    cellsT += ctx.paused ? 10 : dt // 暫停時，切換視角的進場動畫也要直接完成
    const m = ctx.motion
    const appear = util.easeOutCubic(util.clamp(cellsT / 0.9, 0, 1))
    const pop = util.easeOutBack(util.clamp((cellsT - 1.3) / 0.7, 0, 1))
    for (let i = 0; i < nCells; i++) {
      const c = cellDefs[i]
      const pulse = c.tumor ? 1 + 0.06 * Math.sin(t * 2.4 * c.sp * m + c.ph) : 1 + 0.015 * Math.sin(t * 0.9 * m + c.ph)
      const rad = (c.tumor ? 0.5 : 0.43) * appear * pulse * (i === sel ? 1.12 : 1)
      const wob = c.tumor ? 0.04 : 0.02
      const x = c.x + Math.sin(t * 0.6 * m + c.ph) * wob
      const y = c.y + Math.cos(t * 0.5 * m + c.ph * 1.3) * wob
      dummy.position.set(x, y, c.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(rad * (c.tumor ? 1.08 : 1), rad * (c.tumor ? 0.94 : 1), rad)
      dummy.updateMatrix()
      memMesh.setMatrixAt(i, dummy.matrix)
      const nr = (c.tumor ? 0.3 : 0.22) * appear
      dummy.position.set(x, y, c.z)
      dummy.scale.setScalar(nr)
      dummy.updateMatrix()
      nucMesh.setMatrixAt(i, dummy.matrix)
      // 藍色菱形：生殖細胞變異，一開始就在（所有細胞）
      dummy.position.set(x + 0.12 * (c.tumor ? 1.2 : 1), y + 0.1, c.z + (c.tumor ? 0.3 : 0.22))
      dummy.rotation.set(0.4, t * 0.8 * m + c.ph, 0)
      dummy.scale.setScalar(0.12 * appear)
      dummy.updateMatrix()
      gemMesh.setMatrixAt(i, dummy.matrix)
    }
    tumorIdx.forEach((ci, k) => {
      const c = cellDefs[ci]
      const x = c.x + Math.sin(t * 0.6 * m + c.ph) * 0.04
      const y = c.y + Math.cos(t * 0.5 * m + c.ph * 1.3) * 0.04
      const s = 0.26 * Math.max(0, pop) * (1 + 0.12 * Math.sin(t * 5 * m + c.ph))
      dummy.position.set(x - 0.1, y - 0.08, c.z + 0.34)
      dummy.rotation.set(0.3, 0, t * 1.2 * m + c.ph)
      dummy.scale.set(s, s, s * 0.6)
      dummy.updateMatrix()
      starMesh.setMatrixAt(k, dummy.matrix)
      dummy.rotation.z += Math.PI / 4
      dummy.updateMatrix()
      starMesh2.setMatrixAt(k, dummy.matrix)
      starGlows[k].position.set(x - 0.1, y - 0.08, c.z + 0.4)
      starGlows[k].material.opacity = 0.75 * util.clamp(pop, 0, 1) * (0.7 + 0.3 * Math.sin(t * 4 * m + c.ph))
    })
    ;[memMesh, nucMesh, gemMesh, starMesh, starMesh2].forEach((mm) => (mm.instanceMatrix.needsUpdate = true))
  }

  // ════════════════════════ 分子尺度：EGFR ════════════════════════
  const recMat = (c, ei = 0.12) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.35, clearcoat: 0.7, emissive: c, emissiveIntensity: ei })

  // 細胞膜：兩層脂質頭 + 半透明本體
  {
    const heads = []
    for (let layer = 0; layer < 2; layer++) {
      for (let ix = 0; ix < 25; ix++) {
        for (let iz = 0; iz < 6; iz++) {
          const x = -2.64 + ix * 0.22
          const z = -0.55 + iz * 0.22
          if ((Math.abs(x - 0.85) < 0.34 || Math.abs(x + 0.85) < 0.34) && Math.abs(z) < 0.42) continue
          heads.push([x, layer ? 0.66 : 0.14, z])
        }
      }
    }
    const hm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.095, 12, 8), new THREE.MeshStandardMaterial({ color: 0x5f86e8, emissive: 0x2b4aa8, emissiveIntensity: 0.6, roughness: 0.4 }), heads.length)
    heads.forEach((p, i) => {
      dummy.position.set(...p)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      hm.setMatrixAt(i, dummy.matrix)
    })
    mol.add(hm)
    const slab = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.42, 1.4), new THREE.MeshStandardMaterial({ color: 0x24397a, transparent: true, opacity: 0.55, roughness: 0.6, emissive: 0x152660, emissiveIntensity: 0.5, depthWrite: false }))
    slab.position.y = 0.4
    mol.add(slab)
  }

  // 細胞核（下方；局部座標 -y 方向，旋轉後在右側）
  const NUC_C = new THREE.Vector3(0, -4.5, 0)
  const NUC_R = 1.4
  const nucleus = new THREE.Mesh(
    new THREE.SphereGeometry(NUC_R, 48, 32),
    new THREE.MeshPhysicalMaterial({ color: 0x1c2f70, roughness: 0.4, clearcoat: 0.6, transparent: true, opacity: 0.62, emissive: C.cyan, emissiveIntensity: 0.1, depthWrite: false })
  )
  nucleus.position.copy(NUC_C)
  nucleus.renderOrder = 2
  addTip(nucleus, () => '<b>細胞核</b>：增殖訊號抵達後，啟動與細胞分裂有關的基因（示意）。這裡的亮度代表增殖訊號強弱。')
  mol.add(nucleus)
  // 核內的染色質（點雲），亮度隨增殖訊號變化
  const chrom = (() => {
    const r = util.rng(66)
    const n = 220
    const arr = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) {
      const u = r() * 2 - 1
      const th = r() * Math.PI * 2
      const rad = Math.cbrt(r()) * NUC_R * 0.85
      const q = Math.sqrt(1 - u * u)
      arr[k * 3] = NUC_C.x + rad * q * Math.cos(th)
      arr[k * 3 + 1] = NUC_C.y + rad * u
      arr[k * 3 + 2] = NUC_C.z + rad * q * Math.sin(th)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.11, color: C.cyan, map: util.glowTexture(), transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending }))
    mol.add(pts)
    return pts
  })()
  const nucGlow = util.makeGlow(C.cyan, 5.5, 0.2)
  nucGlow.position.set(0, -4.1, -0.6)
  mol.add(nucGlow)
  const rings = [0, 1, 2].map((k) => {
    const rm = new THREE.Mesh(new THREE.TorusGeometry(1, 0.018, 8, 64), new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0, depthWrite: false }))
    rm.position.set(0, -4.5, 0)
    rm.rotation.x = Math.PI / 2
    rm.renderOrder = 4
    mol.add(rm)
    return rm
  })

  // 兩個 EGFR（二聚體）
  const recs = [-1, 1].map((sx) => {
    const g = new THREE.Group()
    g.position.set(sx * 0.85, 0, 0)
    mol.add(g)
    // 細胞外區（可傾斜）
    const ext = new THREE.Group()
    ext.position.set(0, 0.7, 0)
    g.add(ext)
    const capsule = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 1.2, 8, 20), recMat(0x4a68d8, 0.06))
    capsule.position.y = 0.85
    ext.add(capsule)
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(0.36, 24, 18), recMat(0x7a94f5, 0.1))
    lobe.position.set(-sx * 0.05, 1.6, 0.02)
    ext.add(lobe)
    addTip(capsule, () => '<b>EGFR 細胞外區</b>：接收生長因子（粉紅）。野生型要等生長因子結合、兩個受體靠攏，才會啟動；活化突變型則不需要。')
    addTip(lobe, () => '<b>EGFR 細胞外區</b>：接收生長因子（粉紅）。野生型要等生長因子結合、兩個受體靠攏，才會啟動；活化突變型則不需要。')
    // 穿膜螺旋
    const tm = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.9, 16), recMat(0x9ab4ff, 0.3))
    tm.position.y = 0.4
    g.add(tm)
    // 激酶區
    const kin = new THREE.Group()
    kin.position.set(0, -0.85, 0)
    g.add(kin)
    const kMat = recMat(0x3f5fd0, 0.05)
    const nLobe = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), kMat)
    nLobe.scale.set(0.58, 0.34, 0.46)
    nLobe.position.set(0, 0.28, 0)
    const cLobe = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), kMat)
    cLobe.scale.set(0.72, 0.5, 0.56)
    cLobe.position.set(0, -0.42, 0)
    kin.add(nLobe, cLobe)
    const kTip = () => {
      if (st.mutant) return '<b>激酶區</b>：把 ATP 的磷酸接到下游蛋白質，把「增殖」的訊號往細胞核送。<b>活化突變</b>（紅星）讓它不需要生長因子也持續開機。'
      return '<b>激酶區</b>：把 ATP 的磷酸接到下游蛋白質，把「增殖」的訊號往細胞核送。野生型只在生長因子結合時短暫啟動。'
    }
    addTip(nLobe, kTip)
    addTip(cLobe, kTip)
    // ATP 口袋（兩葉之間的裂縫，朝外）
    const P = new THREE.Vector3(sx * 0.66, -0.14, 0.05) // 相對 kin 的口袋中心
    const hole = new THREE.Mesh(new THREE.SphereGeometry(0.25, 20, 14), new THREE.MeshStandardMaterial({ color: 0x0a1030, roughness: 0.9 }))
    hole.position.copy(P)
    kin.add(hole)
    const ringM = new THREE.MeshBasicMaterial({ color: 0x8fb4ff, transparent: true, opacity: 0.9 })
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.04, 10, 28), ringM)
    ring.position.copy(P)
    ring.rotation.y = Math.PI / 2
    kin.add(ring)
    addTip(ring, () => '<b>ATP 口袋</b>：ATP 進來，激酶才能傳遞訊號。標靶藥（TKI）的策略就是占住這裡，讓 ATP 進不來。')
    addTip(hole, () => '<b>ATP 口袋</b>：ATP 進來，激酶才能傳遞訊號。標靶藥（TKI）的策略就是占住這裡，讓 ATP 進不來。')
    // 活化光暈
    const aura = util.makeGlow(C.cyan, 2.6, 0)
    aura.position.set(0, -0.9, -0.2)
    g.add(aura)
    // 體細胞突變（紅星）
    const star = new THREE.Group()
    const s1 = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), new THREE.MeshStandardMaterial({ color: C.red, emissive: C.red, emissiveIntensity: 1.6 }))
    const s2 = s1.clone()
    s2.rotation.z = Math.PI / 4
    s2.scale.set(1, 1, 0.6)
    s1.scale.set(1, 1, 0.6)
    star.add(s1, s2)
    const sg = util.makeGlow(C.red, 0.85, 0.7)
    star.add(sg)
    star.position.set(-sx * 0.12, -0.5, 0.45)
    g.add(star)
    addTip(s1, () => '<b>體細胞突變</b>：只發生在腫瘤細胞的 EGFR 激酶區，出生後才出現，不會遺傳給子女。')
    addTip(s2, () => '<b>體細胞突變</b>：只發生在腫瘤細胞的 EGFR 激酶區，出生後才出現，不會遺傳給子女。')
    // T790M 守門員
    const gate = new THREE.Group()
    const gm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), new THREE.MeshStandardMaterial({ color: 0xff3d3d, emissive: 0xff2a2a, emissiveIntensity: 1.1, roughness: 0.3 }))
    gate.add(gm, util.makeGlow(C.red, 0.7, 0.6))
    gate.position.set(P.x + sx * 0.12, P.y + 0.16, P.z + 0.3)
    kin.add(gate)
    addTip(gm, () => '<b>T790M（守門員）</b>：EGFR 的第二個突變，常在第一代 TKI 使用一段時間後出現。它讓激酶與 ATP 結合得更緊，與 ATP 競爭的藥物效力下降，是後天抗藥性的原因之一（機轉示意）。')
    // ATP 分子（口袋專用）
    const atp = new THREE.Group()
    const am = new THREE.MeshStandardMaterial({ color: 0xfff0b8, emissive: 0xffe08a, emissiveIntensity: 0.9, roughness: 0.3 })
    const a0 = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), am)
    atp.add(a0)
    for (let k = 1; k <= 3; k++) {
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffb0c0, emissive: 0xff7a9a, emissiveIntensity: 0.8 }))
      p.position.set(k * 0.12, 0, 0)
      atp.add(p)
    }
    atp.scale.setScalar(1.6)
    atp.position.copy(P).add(new THREE.Vector3(sx * 0.6, 0.3, 0.1))
    kin.add(atp)
    addTip(a0, () => '<b>ATP</b>：細胞的能量貨幣。激酶用它的末端磷酸去「磷酸化」下游蛋白質，傳遞訊號。')
    // 標靶藥
    const drug = new THREE.Group()
    const dm = util.createMolecule({ atoms: 6, radius: 0.15, color: C.drug, seed: 12 + (sx > 0 ? 1 : 0), accent: 0xffe2b0 })
    drug.add(dm)
    const hook = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshStandardMaterial({ color: C.cyan, emissive: C.cyan, emissiveIntensity: 1 }))
    hook.position.set(sx * 0.12, 0.22, 0.12)
    drug.add(hook)
    drug.add(util.makeGlow(C.drug, 0.9, 0.5))
    drug.position.set(sx * 3.8, -1.2, 0.4)
    drug.scale.setScalar(0.001)
    kin.add(drug)
    addTip(dm, () => (st.drug === 't790m' ? '<b>針對 T790M 設計的 TKI</b>（如 osimertinib 這類藥）：能抑制 EGFR 的敏感型突變，也能抑制 T790M 抗藥突變。' : '<b>第一代 EGFR 標靶藥（TKI）</b>（如 gefitinib、erlotinib）：像一把插進 ATP 口袋的鑰匙，占住位置，ATP 就進不來。'))
    return {
      sx, g, ext, kin, nLobe, cLobe, kMat, P, hole, ring, ringM, aura, star, gate, atp, drug, hook, sg,
      act: 0, actT: 0, dockK: 0, dPos: new THREE.Vector3(), aPos: new THREE.Vector3(), tilt: sx * 0.3, spawn: Math.random(),
    }
  })

  // 生長因子（配體）
  const ligand = new THREE.Group()
  {
    const lm = new THREE.MeshStandardMaterial({ color: C.peptide, emissive: C.peptide, emissiveIntensity: 1.0, roughness: 0.3 })
    ;[[0, 0, 0, 0.17], [0.15, 0.1, 0, 0.12], [-0.14, 0.08, 0.04, 0.11]].forEach(([x, y, z, r]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), lm)
      m.position.set(x, y, z)
      ligand.add(m)
      addTip(m, () => '<b>生長因子（如 EGF）</b>：像敲門的訊息分子。野生型 EGFR 要它來敲門才會啟動。')
    })
    ligand.add(util.makeGlow(C.peptide, 1.0, 0.6))
  }
  mol.add(ligand)
  ligand.position.set(-2.8, 2.8, 0.2)

  // 標籤（世界座標，不隨分子旋轉）
  const mkL = (t, x, y, z = 0.9, extra = {}) => {
    const s = kit.make(t, { fontSize: 40, worldHeight: 0.42, color: '#cfd8f5', ...extra })
    s.position.set(x, y, z)
    recG.add(s)
    return s
  }
  mkL('細胞外', -2.75, 2.75)
  mkL('細胞膜', -0.4, 2.75)
  mkL('細胞質', 1.9, 2.75)
  mkL('細胞核', 4.5, 1.95)
  const lblOther = mkL('其他驅動途徑（示意）', 2.9, -2.7, 0.9, { color: '#e2d8ff', bg: 'rgba(40,20,80,0.75)', border: 'rgba(143,123,255,0.6)' })
  const lblPocket = mkL('ATP 口袋', 1.05, 2.05, 0.9, { color: '#ffe9a8', bg: 'rgba(60,44,8,0.72)', border: 'rgba(255,196,77,0.55)' })

  // 浮動 ATP（氛圍）
  const floatN = 9
  const floatATP = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfff0b8, emissive: 0xffe08a, emissiveIntensity: 0.8 }), floatN)
  floatATP.frustumCulled = false
  mol.add(floatATP)
  const fr = util.rng(5)
  const floatDefs = Array.from({ length: floatN }, () => ({ x: fr.range(-2.3, 2.3), y: fr.range(-3.0, -0.5), z: fr.range(-0.4, 0.5), ph: fr.range(0, 6.28), sp: fr.range(0.4, 0.9) }))

  // 訊號粒子池
  const sigMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), SIGNAL_MAX)
  sigMesh.frustumCulled = false
  sigMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mol.add(sigMesh)
  const sigs = Array.from({ length: SIGNAL_MAX }, () => ({ alive: false, t: 0, sp: 1, path: 0 }))
  const col = new THREE.Color()
  for (let i = 0; i < SIGNAL_MAX; i++) sigMesh.setColorAt(i, col.set(C.cyan))
  const bez = (p0, p1, p2, t, out) => {
    const u = 1 - t
    return out.set(u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y, u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z)
  }
  const PATHS = [
    [new THREE.Vector3(-0.85, -1.95, 0.05), new THREE.Vector3(-1.4, -2.75, 0.2), new THREE.Vector3(-0.45, -3.22, 0)],
    [new THREE.Vector3(0.85, -1.95, 0.05), new THREE.Vector3(1.4, -2.65, 0.2), new THREE.Vector3(0.45, -3.22, 0)],
    [new THREE.Vector3(-2.5, -1.4, 0.1), new THREE.Vector3(-2.6, -3.0, 0.2), new THREE.Vector3(-0.95, -3.5, 0)],
    [new THREE.Vector3(2.5, -1.4, 0.1), new THREE.Vector3(2.6, -3.0, 0.2), new THREE.Vector3(0.95, -3.5, 0)],
  ]
  let nucFlash = 0
  function spawn(path) {
    const s = sigs.find((x) => !x.alive)
    if (!s) return
    s.alive = true
    s.t = 0
    s.sp = 0.42 + Math.random() * 0.2
    s.path = path
    const k = sigs.indexOf(s)
    sigMesh.setColorAt(k, col.set(path < 2 ? C.cyan : C.violet))
    if (sigMesh.instanceColor) sigMesh.instanceColor.needsUpdate = true
  }

  // 狀態
  let prolif = 0.4
  let prolifT = 0.4
  let ligT = 0
  const _lp = new THREE.Vector3()
  const _v2 = new THREE.Vector3()
  const _target = new THREE.Vector3()
  const _at = new THREE.Vector3()
  const _off = new THREE.Vector3()
  const spawnAcc = [0, 0, 0, 0]

  function dockInfo() {
    const drugOn = st.drug !== 'none'
    const docks = drugOn && (!st.resist || st.drug === 't790m')
    const blocked = drugOn && !docks
    return { drugOn, docks, blocked }
  }

  function applyState() {
    const { docks } = dockInfo()
    let lv
    if (st.mutant) lv = docks ? 0.1 : 1
    else lv = 0.45
    prolifT = lv
    level = lv > 0.75 ? '高' : lv > 0.3 ? '中' : '低'
  }

  function updateRec(dt, realDt, t) {
    // dt：狀態平滑用的步長。暫停時 realDt = 0，但使用者切換藥物/突變後畫面仍要收斂到新狀態，所以平滑量改用固定步長
    const m = ctx.motion
    const { drugOn, docks, blocked } = dockInfo()
    ligT += realDt
    // 野生型：生長因子每 9 秒來敲一次門
    const cyc = ligT % 9
    let bound = 0
    const lp = _lp
    if (st.mutant) lp.set(-2.8, 3.4, 0.2)
    else if (cyc < 2.5) lp.set(-2.8, 2.8, 0.2).lerp(_v2.set(0, 2.62, 0.05), util.easeInOut(cyc / 2.5))
    else if (cyc < 6.5) {
      lp.set(0, 2.62 + Math.sin(t * 3) * 0.02, 0.05)
      bound = 1
    } else if (cyc < 8) lp.set(0, 2.62, 0.05).lerp(_v2.set(2.8, 3.0, 0.2), util.easeInOut((cyc - 6.5) / 1.5))
    else lp.set(2.8, 3.0, 0.2)
    ligand.position.lerp(lp, 1 - Math.exp(-8 * dt))
    ligand.visible = !st.mutant
    ligand.children.forEach((c) => c.isMesh && (c.rotation.y += realDt))

    const actTarget = docks ? 0.04 : st.mutant ? 1 : bound ? 1 : 0.06
    let anyFlow = 0
    recs.forEach((r, ri) => {
      r.act = util.damp(r.act, actTarget, 6, dt)
      // 傾斜：啟動時兩個細胞外區靠攏
      const tiltT = r.sx * (0.32 - 0.36 * (st.mutant ? 1 : bound))
      r.tilt = util.damp(r.tilt, tiltT, 4, dt)
      r.ext.rotation.z = -r.tilt * 0.9
      // 激酶發光
      const a = r.act
      r.kMat.emissive.setHex(a > 0.5 ? C.cyan : 0x3f5fd0)
      r.kMat.emissiveIntensity = 0.05 + a * 0.6
      r.aura.material.opacity = a * 0.5 * (0.8 + 0.2 * Math.sin(t * 3 * m + ri))
      // 突變星、守門員
      r.star.visible = st.mutant
      r.star.rotation.z = t * 0.9 * m
      r.gate.visible = st.resist
      // 藥物
      const target = _target
      if (!drugOn) {
        target.set(r.sx * 3.8, -1.0 + Math.sin(t * 0.8 + ri) * 0.2, 0.4)
        r.dockK = util.damp(r.dockK, 0, 4, dt)
        const sc = util.damp(r.drug.scale.x, 0.001, 6, dt)
        r.drug.scale.setScalar(Math.max(0.001, sc))
      } else {
        if (r.drug.scale.x < 0.1) {
          r.drug.position.set(r.sx * 3.4, -1.0, 0.4)
        }
        r.drug.scale.setScalar(util.damp(r.drug.scale.x, 1.7, 5, dt))
        if (docks) target.copy(r.P)
        else {
          // 被守門員擋住：不斷嘗試靠近、彈回
          const bump = 0.5 + 0.5 * Math.sin(t * 3.2 + ri * 1.7)
          target.copy(r.P).add(_off.set(r.sx * (0.62 - 0.22 * bump), 0.2 + 0.05 * Math.sin(t * 5), 0.4))
        }
      }
      r.drug.position.lerp(target, 1 - Math.exp(-(docks ? 3.4 : 9) * dt))
      r.drug.rotation.y += realDt * (docks ? 0.3 : 1.4)
      // ATP
      const at = _at
      if (docks) {
        // ATP 被擋在外面繞圈
        const ang = t * 1.6 + ri * 2
        at.set(r.P.x + r.sx * (0.55 + 0.1 * Math.sin(ang)), r.P.y + 0.42 * Math.sin(ang * 0.9) - 0.1, r.P.z + 0.25 + 0.15 * Math.cos(ang))
      } else if (a > 0.5) {
        at.copy(r.P)
      } else {
        at.set(r.P.x + r.sx * (0.75 + 0.1 * Math.sin(t * 1.3 + ri)), r.P.y + 0.3 + 0.1 * Math.sin(t * 1.7 + ri), r.P.z + 0.12)
      }
      r.atp.position.lerp(at, 1 - Math.exp(-6 * dt))
      r.atp.rotation.z = r.sx > 0 ? 0 : Math.PI
      // 口袋環顏色
      r.ringM.color.setHex(docks ? C.drug : a > 0.5 ? 0xffe08a : 0x8fb4ff)
      // 訊號
      if (a > 0.5 && !docks) {
        anyFlow += 1
        spawnAcc[ri] += realDt * (st.mutant ? 3.6 : 2.4)
        while (spawnAcc[ri] > 1) {
          spawnAcc[ri] -= 1
          spawn(ri)
        }
      }
    })
    // 其他驅動途徑（野生型腫瘤）：紫色訊號
    if (!st.mutant) {
      for (let k = 2; k < 4; k++) {
        spawnAcc[k] += realDt * 1.6
        while (spawnAcc[k] > 1) {
          spawnAcc[k] -= 1
          spawn(k)
        }
      }
    }
    lblOther.visible = !st.mutant
    lblPocket.visible = true
    // 訊號粒子推進
    for (let i = 0; i < SIGNAL_MAX; i++) {
      const s = sigs[i]
      if (!s.alive) {
        dummy.scale.setScalar(0.0001)
        dummy.position.set(0, 0, 0)
        dummy.updateMatrix()
        sigMesh.setMatrixAt(i, dummy.matrix)
        continue
      }
      s.t += realDt * s.sp
      if (s.t >= 1) {
        s.alive = false
        nucFlash = Math.min(1, nucFlash + 0.18)
        continue
      }
      const P = PATHS[s.path]
      bez(P[0], P[1], P[2], s.t, dummy.position)
      dummy.position.x += Math.sin(s.t * 12 + i) * 0.04
      dummy.scale.setScalar(0.8 + 0.5 * Math.sin(s.t * Math.PI))
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      sigMesh.setMatrixAt(i, dummy.matrix)
    }
    sigMesh.instanceMatrix.needsUpdate = true

    // 浮動 ATP
    for (let i = 0; i < floatN; i++) {
      const d = floatDefs[i]
      dummy.position.set(d.x + Math.sin(t * d.sp + d.ph) * 0.35, d.y + Math.cos(t * d.sp * 1.3 + d.ph) * 0.25, d.z)
      dummy.scale.setScalar(1)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      floatATP.setMatrixAt(i, dummy.matrix)
    }
    floatATP.instanceMatrix.needsUpdate = true

    // 細胞核 / 增殖
    prolif = util.damp(prolif, prolifT, 2.5, dt)
    nucFlash = util.damp(nucFlash, 0, 3, realDt)
    const nm = nucleus.material
    const lvc = 0.08 + prolif * 0.55 + nucFlash * 0.3
    nm.emissiveIntensity = lvc
    nm.emissive.setHex(st.mutant || prolif > 0.3 ? (prolif > 0.7 ? 0x35d6ff : 0x6c8cff) : 0x2b3f7a)
    nucGlow.material.opacity = 0.06 + prolif * 0.34 + nucFlash * 0.2
    chrom.material.opacity = 0.25 + prolif * 0.7 + nucFlash * 0.2
    chrom.rotation.y = t * 0.15 * m
    rings.forEach((rm, k) => {
      const ph = ((t * (0.25 + prolif * 0.6) * m + k / 3) % 1 + 1) % 1
      const s = 0.5 + ph * 1.8
      rm.scale.set(s, s, s)
      rm.material.opacity = prolif * 0.55 * (1 - ph)
      rm.material.color.setHex(C.cyan)
    })
  }

  // ════════════════════════ API ════════════════════════
  function setView(v) {
    view = v
    cellsG.visible = v === 'cells'
    recG.visible = v === 'rec'
    sel = -1
    if (v === 'cells') cellsT = 0
    if (v === 'rec') ligT = 0
  }
  setView('cells')
  applyState()

  function pickTip() {
    if (view === 'cells') {
      const hit = ctx.pick([memMesh], false)[0]
      if (!hit || hit.instanceId == null) {
        sel = -1
        return null
      }
      sel = hit.instanceId
      const c = cellDefs[sel]
      return c.tumor
        ? '<b>腫瘤細胞</b><br><span style="color:#4aa8ff">◆ 生殖細胞變異</span>：有（遺傳自父母，和其他細胞一樣）<br><span style="color:#ff7a7a">★ 體細胞突變</span>：<b>有</b>（出生後才發生，只在這群細胞）'
        : '<b>正常組織細胞</b><br><span style="color:#4aa8ff">◆ 生殖細胞變異</span>：有<br><span style="color:#ff7a7a">★ 體細胞突變</span>：沒有'
    }
    const hits = ctx.pick(tipTargets.filter((o) => o.visible !== false), false)
    for (const h of hits) {
      let o = h.object
      // 被隱藏的父層不算
      let vis = true
      for (let p = o; p; p = p.parent) if (p.visible === false) vis = false
      if (!vis) continue
      const tip = o.userData.tip
      if (tip) return tip()
    }
    return null
  }

  return {
    root,
    get level() {
      return level
    },
    setView,
    setState(s) {
      const drugChanged = s.drug !== st.drug
      Object.assign(st, s)
      if (drugChanged && st.drug !== 'none') recs.forEach((r) => r.drug.position.set(r.sx * 3.4, -1.0, 0.4))
      applyState()
    },
    update(dt, t) {
      if (view === 'cells') updateCells(dt, t)
      else updateRec(ctx.paused ? 0.25 : dt, dt, t)
    },
    clearHover() {
      sel = -1
    },
    pickTip() {
      const t = pickTip()
      return t
    },
  }
}
