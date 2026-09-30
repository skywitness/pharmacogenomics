// ch10 主題③:AI 與資料。四個視角：
//   network   基因—藥物—結果 知識網路（+ AI 提出、待驗證的候選連線，示意）
//   ai        AI 預測 vs 實驗功能（示意散布圖；標出不一致的變異）
//   diversity GWAS 參與者族群組成（華夫餅：1000 格，每格 0.1%）
//   biobank   在地大型資料庫（球體體積與人數成正比，半徑 ∝ 人數的立方根）
import { DIVERSITY, DIVERSITY_DATE, allocateCells, BIOBANKS } from './data.js'

export function createAI(ctx, kit) {
  const { THREE, util, palette } = ctx
  const C = palette.COLORS
  const root = new THREE.Group()
  root.visible = false
  const gNet = new THREE.Group()
  const gAI = new THREE.Group()
  const gDiv = new THREE.Group()
  const gBio = new THREE.Group()
  root.add(gNet, gAI, gDiv, gBio)
  const dummy = new THREE.Object3D()
  let view = 'network'
  let viewT = 0

  // ════════════════════ 知識網路 ════════════════════
  const GENES = ['CYP2C19', 'CYP2D6', 'CYP2C9', 'VKORC1', 'CYP4F2', 'SLCO1B1', 'HLA-B', 'NUDT15', 'TPMT']
  const GENE_TIP = {
    CYP2C19: '<b>CYP2C19</b>：與 clopidogrel 這類前驅藥的活化有關（見第 5、6 章）。',
    CYP2D6: '<b>CYP2D6</b>：與 codeine 轉成嗎啡有關；結構變異（缺失、重複、融合）特別常見，文獻稱它是最難分型的藥物基因之一。',
    CYP2C9: '<b>CYP2C9</b>：華法林的代謝酵素。CPIC 2017 指出 CYP2C9、VKORC1、CYP4F2 等常見變異加上非遺傳因素，合計只能解釋約 50% 的劑量變異。',
    VKORC1: '<b>VKORC1</b>：華法林的作用目標（維生素 K 循環）。華法林劑量的主要基因之一。',
    CYP4F2: '<b>CYP4F2</b>：華法林劑量的小效應基因，需要較大樣本才在 GWAS 中被偵測到。',
    SLCO1B1: '<b>SLCO1B1</b>：與 simvastatin 引起的肌病有關。僅 85 病例與 90 對照的 GWAS 就找到它（P = 4×10⁻⁹）。',
    'HLA-B': '<b>HLA-B</b>：免疫辨識的「身分展示櫃」；HLA-B*15:02 與 carbamazepine 的嚴重皮膚反應有關（第 7 章）。',
    NUDT15: '<b>NUDT15</b>：與 thiopurine 毒性有關；一項多重功能分析量測了它 2,922 個錯義變異的蛋白質豐度。',
    TPMT: '<b>TPMT</b>：與 thiopurine 毒性有關的經典藥物基因。',
  }
  const DRUGS = ['clopidogrel', 'codeine', 'warfarin', 'simvastatin', 'carbamazepine', 'thiopurine']
  const OUTS = [
    { name: '療效不足', color: C.green },
    { name: '劑量需求差異', color: C.green },
    { name: '肌病', color: C.red },
    { name: '嚴重皮膚反應', color: C.red },
    { name: '骨髓抑制', color: C.red },
    { name: '嗎啡毒性', color: C.red },
  ]
  const gy = (i) => 2.24 - i * 0.56
  const nodePos = {}
  GENES.forEach((g, i) => (nodePos[g] = new THREE.Vector3(-3.9, gy(i), (i % 3 - 1) * 0.35)))
  const dy = { clopidogrel: gy(0), codeine: gy(1), warfarin: (gy(2) + gy(3) + gy(4)) / 3, simvastatin: gy(5), carbamazepine: gy(6), thiopurine: (gy(7) + gy(8)) / 2 }
  DRUGS.forEach((d, i) => (nodePos[d] = new THREE.Vector3(0, dy[d], ((i + 1) % 3 - 1) * 0.4)))
  const oy = [gy(0), dy.warfarin, gy(5), gy(6), dy.thiopurine, gy(1)]
  OUTS.forEach((o, i) => (nodePos[o.name] = new THREE.Vector3(3.9, oy[i], (i % 3 - 1) * 0.3)))
  const EDGES = [
    ['CYP2C19', 'clopidogrel', 0], ['CYP2D6', 'codeine', 0], ['CYP2C9', 'warfarin', 0], ['VKORC1', 'warfarin', 0], ['CYP4F2', 'warfarin', 0],
    ['SLCO1B1', 'simvastatin', 0], ['HLA-B', 'carbamazepine', 0], ['NUDT15', 'thiopurine', 0], ['TPMT', 'thiopurine', 0],
    ['clopidogrel', '療效不足', 1], ['codeine', '療效不足', 1], ['codeine', '嗎啡毒性', 1], ['warfarin', '劑量需求差異', 1], ['simvastatin', '肌病', 1], ['carbamazepine', '嚴重皮膚反應', 1], ['thiopurine', '骨髓抑制', 1],
  ]
  const DRUG_TIP = {
    clopidogrel: '<b>clopidogrel</b>：前驅藥，需 CYP2C19 活化。',
    codeine: '<b>codeine</b>：前驅藥，由 CYP2D6 轉成嗎啡。代謝過快（超快速代謝者）可能嗎啡過量；代謝過慢則止痛不足。',
    warfarin: '<b>warfarin（華法林）</b>：劑量受 CYP2C9、VKORC1、CYP4F2 等基因與許多非遺傳因素影響。',
    simvastatin: '<b>simvastatin</b>：史他汀類降血脂藥；SLCO1B1 變異與肌病風險有關。',
    carbamazepine: '<b>carbamazepine</b>：抗癲癇藥；HLA-B*15:02 攜帶者的嚴重皮膚反應風險較高。',
    thiopurine: '<b>thiopurine</b>：免疫抑制/抗癌藥；TPMT、NUDT15 功能低下者較易出現毒性。',
  }
  const nodeSprites = []
  const mkNode = (name, kind, color, tip) => {
    const bgs = { gene: 'rgba(6,40,60,0.88)', drug: 'rgba(60,36,8,0.88)', out: 'rgba(50,14,24,0.88)' }
    const hexs = '#' + color.toString(16).padStart(6, '0')
    const s = kit.make(name, { fontSize: 46, worldHeight: 0.46, color: '#f2f6ff', bg: bgs[kind], border: hexs, grow: 0.75 })
    s.position.copy(nodePos[name])
    s.userData.tip = tip
    s.renderOrder = 1000
    nodeSprites.push(s)
    gNet.add(s)
    return s
  }
  GENES.forEach((g) => mkNode(g, 'gene', C.cyan, GENE_TIP[g]))
  DRUGS.forEach((d) => mkNode(d, 'drug', C.drug, DRUG_TIP[d]))
  OUTS.forEach((o) => mkNode(o.name, 'out', o.color, o.name === '嗎啡毒性' ? `<b>${o.name}</b>：CYP2D6 超快速代謝者把 codeine 轉成嗎啡過多，可能造成嗎啡過量。` : o.color === C.red ? `<b>${o.name}</b>：不良反應（或毒性）類結果。` : `<b>${o.name}</b>：療效或劑量需求的個體差異。`))

  const curves = []
  const edgeMats = [new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.42 }), new THREE.MeshBasicMaterial({ color: C.drug, transparent: true, opacity: 0.42 })]
  EDGES.forEach(([a, b, k], i) => {
    const A = nodePos[a]
    const B = nodePos[b]
    const mid = A.clone().add(B).multiplyScalar(0.5)
    mid.z += (i % 2 ? 0.7 : -0.5)
    const curve = new THREE.QuadraticBezierCurve3(A, mid, B)
    curves.push({ curve, k, color: k ? (OUTS.find((o) => o.name === b)?.color ?? C.amber) : C.cyan })
    gNet.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.014, 5, false), edgeMats[k]))
  })
  const pulses = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), EDGES.length * 2)
  pulses.frustumCulled = false
  curves.forEach((c, i) => {
    pulses.setColorAt(i * 2, new THREE.Color(c.color))
    pulses.setColorAt(i * 2 + 1, new THREE.Color(c.color))
  })
  gNet.add(pulses)

  // AI 提出的候選連線（示意）：紫色 ? 節點以虛線連到既有節點
  const GHOSTS = [
    { p: new THREE.Vector3(-1.95, 1.2, 0.6), to: 'warfarin' },
    { p: new THREE.Vector3(1.95, 1.05, 0.5), to: '療效不足' },
    { p: new THREE.Vector3(1.95, -1.5, 0.5), to: 'thiopurine' },
    { p: new THREE.Vector3(-1.95, -0.15, 0.6), to: 'simvastatin' },
  ]
  const ghostMeshes = []
  const ghostLines = []
  GHOSTS.forEach((g, i) => {
    const q = kit.make('?', { fontSize: 56, worldHeight: 0.5, color: '#ffffff', bg: 'rgba(143,123,255,0.95)', border: '#e2d8ff', padding: 14, grow: 0.7 })
    q.position.copy(g.p)
    q.userData.tip = '<b>AI 提出的候選關聯（示意）</b>：AI 常從既有資料中提出「還沒被連上」的線索，但每一條都需要功能實驗與臨床資料驗證。'
    nodeSprites.push(q)
    ghostMeshes.push(q)
    gNet.add(q)
    const to = nodePos[g.to]
    const geo = new THREE.BufferGeometry().setFromPoints([g.p, to])
    const ln = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: C.violet, dashSize: 0.14, gapSize: 0.1, transparent: true, opacity: 0.9 }))
    ln.computeLineDistances()
    gNet.add(ln)
    ghostLines.push(ln)
  })

  // ════════════════════ AI 預測 vs 實驗 ════════════════════
  const PW = 7.4
  const PH = 4.3
  const PXPU = 150 // canvas px per world unit
  const PL = 160,
    PR = 1050,
    PT = 56,
    PB = 560
  const wx = (px) => -PW / 2 + px / PXPU
  const wy = (py) => PH / 2 - py / PXPU
  const panelTex = (() => {
    const cv = document.createElement('canvas')
    cv.width = Math.round(PW * PXPU)
    cv.height = Math.round(PH * PXPU)
    const g = cv.getContext('2d')
    g.fillStyle = 'rgba(8,13,30,0.82)'
    g.beginPath()
    g.roundRect(0, 0, cv.width, cv.height, 26)
    g.fill()
    g.strokeStyle = 'rgba(120,160,255,0.28)'
    g.lineWidth = 2
    g.stroke()
    g.strokeStyle = 'rgba(154,166,196,0.16)'
    g.lineWidth = 2
    for (let i = 0; i <= 4; i++) {
      const x = PL + ((PR - PL) * i) / 4
      const y = PT + ((PB - PT) * i) / 4
      g.beginPath()
      g.moveTo(x, PT)
      g.lineTo(x, PB)
      g.moveTo(PL, y)
      g.lineTo(PR, y)
      g.stroke()
    }
    g.strokeStyle = 'rgba(200,215,255,0.55)'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(PL, PT)
    g.lineTo(PL, PB)
    g.lineTo(PR, PB)
    g.stroke()
    g.setLineDash([12, 12])
    g.strokeStyle = 'rgba(200,215,255,0.35)'
    g.beginPath()
    g.moveTo(PL, PB)
    g.lineTo(PR, PT)
    g.stroke()
    g.setLineDash([])
    g.fillStyle = '#c9d3ee'
    g.font = '700 48px "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif'
    g.textAlign = 'center'
    g.fillText('AI 預測：越右越像「致病」', (PL + PR) / 2, PB + 62)
    g.save()
    g.translate(58, (PT + PB) / 2)
    g.rotate(-Math.PI / 2)
    g.fillText('實驗：功能喪失程度', 0, 0)
    g.restore()
    g.font = '700 42px "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif'
    g.fillStyle = '#9aa6c4'
    g.textAlign = 'center'
    ;['低', '', '', '', '高'].forEach((t, i) => t && g.fillText(t, PL + ((PR - PL) * i) / 4, PB + 30))
    g.textAlign = 'right'
    g.fillText('高', PL - 14, PT + 12)
    g.fillText('低', PL - 14, PB)
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  })()
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(PW, PH), new THREE.MeshBasicMaterial({ map: panelTex, transparent: true, depthWrite: false }))
  panel.position.z = -0.45
  gAI.add(panel)
  // 不一致區（左上）：預測「像良性」但實驗顯示功能喪失
  const zone = new THREE.Mesh(
    new THREE.PlaneGeometry(wx(PL + (PR - PL) * 0.4) - wx(PL), wy(PT) - wy(PT + (PB - PT) * 0.4)),
    new THREE.MeshBasicMaterial({ color: C.red, transparent: true, opacity: 0.16, depthWrite: false })
  )
  zone.position.set((wx(PL) + wx(PL + (PR - PL) * 0.4)) / 2, (wy(PT) + wy(PT + (PB - PT) * 0.4)) / 2, -0.4)
  gAI.add(zone)
  const zoneLbl = kit.make('AI 說「像良性」\n實驗卻顯示功能喪失', { fontSize: 36, worldHeight: 0.62, color: '#ffc0c0', bg: 'rgba(60,12,20,0.72)', border: 'rgba(255,120,120,0.6)' })
  zoneLbl.position.set(wx(PL + (PR - PL) * 0.6), wy(PT + (PB - PT) * 0.09), 0.4)
  gAI.add(zoneLbl)
  const shamLbl = kit.make('示意：比例與相關性皆任意設定\n虛線僅供參考（兩軸單位不同）', { fontSize: 34, worldHeight: 0.58, color: '#ffd98a', bg: 'rgba(60,44,8,0.7)', border: 'rgba(255,196,77,0.5)' })
  shamLbl.position.set(wx(PR) - 1.5, wy(PB) + 0.55, 0.4)
  gAI.add(shamLbl)

  const NPTS = 120
  const pts = []
  {
    const r = util.rng(31)
    const clamp01 = (v) => util.clamp(v, 0.02, 0.98)
    for (let i = 0; i < NPTS; i++) {
      let x, y
      if (i < 10) {
        x = r.range(0.06, 0.34)
        y = r.range(0.68, 0.94)
      } else {
        const b = r()
        y = clamp01(b + (r() - 0.5) * 0.24)
        x = clamp01(b * 0.92 + 0.04 + (r() - 0.5) * 0.28)
        if (x < 0.4 && y > 0.6) y = 0.5 + r() * 0.1
      }
      pts.push({ x, y, z: r.range(-0.3, 0.3), mis: i < 10, ph: r.range(0, 6.28) })
    }
  }
  const pMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 14, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0x223a7a, emissiveIntensity: 0.6 }), NPTS)
  pMesh.frustumCulled = false
  pMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 5) // 固定範圍：進場動畫期間位置會變，cached 的 boundingSphere 會過時
  pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  gAI.add(pMesh)
  const cAgree = new THREE.Color(C.enzyme)
  const cMis = new THREE.Color(C.red)
  let showMis = true
  let misK = 1
  const pWorld = pts.map((p) => new THREE.Vector3(wx(PL + p.x * (PR - PL)), wy(PB - p.y * (PB - PT)), p.z))

  // ════════════════════ 族群華夫餅 ════════════════════
  const COLS = 50
  const ROWS = 20
  const CELL = 0.205
  const cellGroup = []
  {
    const alloc = allocateCells(DIVERSITY, COLS * ROWS)
    DIVERSITY.forEach((d, gi) => {
      for (let k = 0; k < alloc[gi]; k++) cellGroup.push(gi)
    })
  }
  const DCOL = [C.blue, C.amber, C.green, 0xb9c2dd, C.violet, C.magenta]
  const wMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL * 0.82, CELL * 0.82, CELL * 0.82), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, emissive: 0x0a1030, emissiveIntensity: 0.4 }), COLS * ROWS)
  wMesh.frustumCulled = false
  wMesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 6.5)
  wMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  gDiv.add(wMesh)
  cellGroup.forEach((gi, i) => wMesh.setColorAt(i, new THREE.Color(DCOL[gi]).multiplyScalar(0.78)))
  const wPos = (i) => {
    const col = Math.floor(i / ROWS)
    const row = i % ROWS
    return [(col - (COLS - 1) / 2) * CELL, ((ROWS - 1) / 2 - row) * CELL]
  }
  // 預先算好每格位置與少數族群格子的索引，避免每幀配置陣列、也只需在進場後更新會脈動的格子
  const WTOTAL = COLS * ROWS
  const wxy = new Float32Array(WTOTAL * 2)
  for (let i = 0; i < WTOTAL; i++) {
    const p = wPos(i)
    wxy[i * 2] = p[0]
    wxy[i * 2 + 1] = p[1]
  }
  const minorityIdx = []
  for (let i = 0; i < WTOTAL; i++) if (cellGroup[i] > 0) minorityIdx.push(i)
  let wIntroDone = false
  const lblEU = kit.make('歐洲血統 88.18%', { fontSize: 50, worldHeight: 0.5, color: '#dceaff', bg: 'rgba(10,30,70,0.78)', border: 'rgba(74,168,255,0.7)' })
  lblEU.position.set(wPos(20 * ROWS)[0], 0.1, 0.6)
  const lblRest = kit.make('其餘所有族群合計 約 11.8%', { fontSize: 42, worldHeight: 0.42, color: '#ffe7b0', bg: 'rgba(60,44,8,0.8)', border: 'rgba(255,196,77,0.7)' })
  lblRest.position.set(wPos(Math.round(COLS * 0.92) * ROWS)[0] - 0.6, wPos(ROWS - 1)[1] - 0.55, 0.6)
  const lblDate = kit.make(`GWAS Diversity Monitor · 資料檢查日 ${DIVERSITY_DATE} · 每格 = 0.1%`, { fontSize: 36, worldHeight: 0.32, color: '#9aa6c4', bg: null, border: null })
  lblDate.position.set(0, wPos(0)[1] + 0.5, 0.3)
  gDiv.add(lblEU, lblRest, lblDate)

  // ════════════════════ 生物資料庫 ════════════════════
  const bioSpheres = []
  const BPOS = { tpmi: [-3.5, 0.4], twb: [-1.07, 0.4], aou: [0.9, 0.4], ukb: [3.56, 0.4] }
  const BLBL = { tpmi: ['TPMI', '565,390 人'], twb: ['台灣人體', '生物資料庫', '單一研究分析', '103,106 人'], aou: ['All of Us', '245,388 人'], ukb: ['UK Biobank', '約 50 萬人'] }
  const BTECH = { tpmi: '漢人最佳化 SNP 晶片', twb: 'SNP 晶片', aou: '全基因體定序', ukb: '晶片 · 歐洲血統為主' }
  BIOBANKS.forEach((b, i) => {
    const R = Math.cbrt(b.n / 565390) * 1.35
    const g = new THREE.Group()
    g.position.set(BPOS[b.key][0], BPOS[b.key][1], 0)
    const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 36, 24), new THREE.MeshPhysicalMaterial({ color: b.color, transparent: true, opacity: 0.16, roughness: 0.2, clearcoat: 1, depthWrite: false, emissive: b.color, emissiveIntensity: 0.25, side: THREE.DoubleSide }))
    shell.userData.tip = `<b>${b.name}</b><br>${b.tip}`
    g.add(shell)
    const n = Math.round(160 + R * 260)
    const r = util.rng(100 + i)
    const arr = new Float32Array(n * 3)
    for (let k = 0; k < n; k++) {
      const u = r() * 2 - 1
      const th = r() * Math.PI * 2
      const rad = Math.cbrt(r()) * R * 0.94
      const s = Math.sqrt(1 - u * u)
      arr[k * 3] = rad * s * Math.cos(th)
      arr[k * 3 + 1] = rad * u
      arr[k * 3 + 2] = rad * s * Math.sin(th)
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(arr, 3))
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.075, color: b.color, map: util.glowTexture(), transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }))
    g.add(points)
    const glow = util.makeGlow(b.color, R * 3.2, 0.22)
    g.add(glow)
    const nl = BLBL[b.key].length
    const lbl = kit.make(BLBL[b.key].join('\n'), { fontSize: 40, grow: 0.35, worldHeight: 0.4 * nl + 0.12, color: '#f2f6ff', bg: 'rgba(6,9,19,0.78)', border: '#' + b.color.toString(16).padStart(6, '0') })
    lbl.position.set(0, -1.7 - (0.4 * nl + 0.12) / 2 + 0.15, 0.2)
    g.add(lbl)
    const tech = kit.make(BTECH[b.key], { fontSize: 36, grow: 0.35, worldHeight: 0.32, color: '#c9d3ee', bg: null, border: null })
    tech.position.set(0, -1.7 - (0.4 * nl + 0.12) - 0.08, 0.2)
    g.add(tech)
    gBio.add(g)
    bioSpheres.push({ g, points, shell, R, b })
  })

  // ═════════════ 進場動畫 + 更新 ═════════════
  let showMisTarget = true
  const tmpC = new THREE.Color()

  function updateNet(dt, t) {
    const m = ctx.motion
    gNet.rotation.y = Math.sin(t * 0.25 * m) * 0.1
    pulses.visible = true
    curves.forEach((c, i) => {
      for (let k = 0; k < 2; k++) {
        const ph = (t * 0.22 * m + i * 0.173 + k * 0.5) % 1
        c.curve.getPoint(ph, dummy.position)
        dummy.scale.setScalar(0.7 + 0.5 * Math.sin(ph * Math.PI))
        dummy.updateMatrix()
        pulses.setMatrixAt(i * 2 + k, dummy.matrix)
      }
    })
    pulses.instanceMatrix.needsUpdate = true
    ghostMeshes.forEach((q, i) => {
      q.material.opacity = 0.82 + 0.18 * Math.sin(t * 2 * m + i * 1.7)
    })
    ghostLines.forEach((l, i) => (l.material.opacity = 0.5 + 0.4 * Math.sin(t * 2 * m + i * 1.7)))
  }

  function updateAI(dt, t) {
    const m = ctx.motion
    misK = util.damp(misK, showMisTarget ? 1 : 0, 6, dt)
    zone.material.opacity = 0.16 * misK
    zoneLbl.visible = misK > 0.3
    const appear = util.easeOutCubic(util.clamp(viewT / 1.1, 0, 1))
    for (let i = 0; i < NPTS; i++) {
      const p = pts[i]
      const W = pWorld[i]
      const d = (1 - appear) * (1 + (i % 7) * 0.12)
      dummy.position.set(W.x + Math.sin(t * 0.6 * m + p.ph) * 0.02 + (p.ph - 3.1) * 0.2 * d, W.y + Math.cos(t * 0.5 * m + p.ph) * 0.02 - 1.3 * d, W.z)
      const s = p.mis && misK > 0.5 ? 1.35 + 0.15 * Math.sin(t * 4 * m + p.ph) : 1
      dummy.scale.setScalar(s * (0.3 + 0.7 * appear))
      dummy.updateMatrix()
      pMesh.setMatrixAt(i, dummy.matrix)
      tmpC.copy(cAgree)
      if (p.mis) tmpC.lerp(cMis, misK)
      pMesh.setColorAt(i, tmpC)
    }
    pMesh.instanceMatrix.needsUpdate = true
    if (pMesh.instanceColor) pMesh.instanceColor.needsUpdate = true
  }

  function writeCell(i, k, pulse) {
    dummy.position.set(wxy[i * 2], wxy[i * 2 + 1], 0)
    dummy.scale.setScalar(Math.max(0.001, k) * pulse)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    wMesh.setMatrixAt(i, dummy.matrix)
  }
  function updateDiv(dt, t) {
    const m = ctx.motion
    // 由上而下「長出」；進場完成後只有少數族群格子輕微脈動（多數格子的矩陣不再改變）
    const prog = util.clamp(viewT / 1.6, 0, 1)
    if (prog < 1 || !wIntroDone) {
      for (let i = 0; i < WTOTAL; i++) {
        const col = Math.floor(i / ROWS)
        const k = util.easeOutBack(util.clamp(prog * 1.6 - (col / COLS) * 0.6, 0, 1))
        writeCell(i, k, cellGroup[i] > 0 ? 1 + 0.18 * Math.sin(t * 2.5 * m + i * 0.3) : 1)
      }
      if (prog >= 1) wIntroDone = true
    } else {
      for (const i of minorityIdx) writeCell(i, 1, 1 + 0.18 * Math.sin(t * 2.5 * m + i * 0.3))
    }
    wMesh.instanceMatrix.needsUpdate = true
  }

  function updateBio(dt, t) {
    const m = ctx.motion
    const appear = util.easeOutBack(util.clamp(viewT / 0.9, 0, 1))
    bioSpheres.forEach((s, i) => {
      s.points.rotation.y = t * (0.15 + i * 0.03) * m
      s.points.rotation.x = Math.sin(t * 0.2 * m + i) * 0.2
      const k = Math.max(0.001, util.clamp(appear - i * 0.05, 0, 1.2))
      s.g.scale.setScalar(k)
    })
  }

  // ════════════════════ API ════════════════════
  function setView(v) {
    view = v
    viewT = 0
    wIntroDone = false
    gNet.visible = v === 'network'
    gAI.visible = v === 'ai'
    gDiv.visible = v === 'diversity'
    gBio.visible = v === 'biobank'
  }
  setView('network')

  let hover = -1
  return {
    root,
    setView,
    setShowMismatch(b) {
      showMis = b
      showMisTarget = b
    },
    clearHover() {
      hover = -1
    },
    update(dt, t) {
      viewT += dt
      if (ctx.paused) viewT = Math.max(viewT, 3) // 暫停時，切換視角的進場動畫也要直接完成
      if (view === 'network') updateNet(dt, t)
      else if (view === 'ai') updateAI(dt, t)
      else if (view === 'diversity') updateDiv(dt, t)
      else updateBio(dt, t)
    },
    pickTip() {
      if (view === 'network') {
        const hit = ctx.pick(nodeSprites, false)[0]
        return hit ? hit.object.userData.tip : null
      }
      if (view === 'ai') {
        const hit = ctx.pick([pMesh], false)[0]
        if (!hit || hit.instanceId == null) return null
        const p = pts[hit.instanceId]
        const line = `AI 預測致病性 ≈ ${p.x.toFixed(2)}<br>實驗功能喪失 ≈ ${p.y.toFixed(2)}`
        return `<b>示意變異 #${hit.instanceId + 1}</b><br>${line}${p.mis && showMis ? '<br><b style="color:#ff8a8a">預測與實驗不一致</b>' : ''}<br><span style="opacity:.7">示意資料，非真實變異</span>`
      }
      if (view === 'diversity') {
        const hit = ctx.pick([wMesh], false)[0]
        if (!hit || hit.instanceId == null) return null
        const d = DIVERSITY[cellGroup[hit.instanceId]]
        return `<b>${d.label}</b>：${d.pct}%<br><span style="opacity:.75">GWAS Diversity Monitor · 資料檢查日 ${DIVERSITY_DATE} · 探索階段參與者。即時儀表板，數字會隨時間變動。</span>`
      }
      const hit = ctx.pick(bioSpheres.map((s) => s.shell), false)[0]
      return hit ? hit.object.userData.tip : null
    },
  }
}
