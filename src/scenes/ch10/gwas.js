// ch10 主題②:GWAS 曼哈頓景觀（3D）。全部為示意資料。
import { buildGenome, layoutTrait, binNl, displayNl, GW_THRESHOLD, NL_KNEE, NL_MAX_DISPLAY, TRAITS, locusIndex } from './data.js'

const W = 11 // 景觀總寬度
const LANES = 4 // 沿深度方向的列數（讓景觀有「地形」感）
const LANE_GAP = 0.34
const HS = 0.34 // 每 1 個 −log10p 對應的世界高度
const LANE_FACTOR = [1, 0.8, 0.66, 0.52]

export function createGwas(ctx, kit) {
  const { THREE, util, palette } = ctx
  const C = palette.COLORS
  const root = new THREE.Group()
  root.visible = false

  const genome = buildGenome()
  const nBins = genome.total
  const colW = W / nBins
  const count = nBins * LANES
  const laneNoise = []
  {
    const r = util.rng(4242)
    for (let l = 0; l < LANES; l++) {
      laneNoise.push(Float32Array.from({ length: nBins }, (_, i) => (l === 0 ? genome.bins[i].noise : Math.min(3.3, -Math.log10(Math.max(1e-6, r())) * 0.85))))
    }
  }
  const x0 = -W / 2
  const xOf = (i) => x0 + (i + 0.5) * colW
  const zOf = (l) => (l - (LANES - 1) / 2) * LANE_GAP

  // ── 柱子 ──
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1, emissive: 0x223a7a, emissiveIntensity: 0.55 })
  const mesh = new THREE.InstancedMesh(geo, mat, count)
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
  mesh.frustumCulled = false
  // InstancedMesh 的 boundingSphere 只算一次，柱子長出來後就過時；給一個固定的大範圍讓 raycast 不漏掉
  mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 2.2, 0), 9)
  const colA = new THREE.Color(0x4aa8ff)
  const colB = new THREE.Color(0x35d6ff).lerp(new THREE.Color(0x8f7bff), 0.5)
  const colHot = new THREE.Color(0xffc44d)
  const chromColor = new Map(genome.chromInfo.map((c, k) => [c.name, k % 2 ? colB : colA]))
  const binChrom = new Array(nBins)
  for (const c of genome.chromInfo) for (let k = 0; k < c.count; k++) binChrom[c.start + k] = c.name
  for (let i = 0; i < count; i++) mesh.setColorAt(i, colA)
  root.add(mesh)

  // 每根柱子的目標與目前高度（以 −log10p 為單位，未壓縮）
  const targetNl = new Float32Array(count)
  const curH = new Float32Array(count) // 目前「顯示高度」（世界單位）
  const dummy = new THREE.Object3D()
  let laid = null
  let trait = 'warfarin'
  let logN = Math.log10(TRAITS.warfarin.n0)
  let dirty = true
  let binMax = new Float32Array(nBins)
  let named = []

  function recompute() {
    laid = layoutTrait(genome, trait)
    const n = Math.pow(10, logN)
    binMax.fill(0)
    for (let l = 0; l < LANES; l++) {
      for (let i = 0; i < nBins; i++) {
        const nl = binNl(laneNoise[l][i], laid.r2[i] * LANE_FACTOR[l], n)
        targetNl[l * nBins + i] = nl
        if (nl > binMax[i]) binMax[i] = nl
      }
    }
    // 命名的峰
    named = []
    for (const L of TRAITS[trait].loci) {
      const c = locusIndex(genome, L.chr, L.pos)
      const nl = binMax[c]
      named.push({ gene: L.gene, idx: c, nl, pass: nl > GW_THRESHOLD, x: xOf(c) })
    }
    // 標籤
    labels.forEach((lb) => (lb.visible = false))
    named.forEach((p, k) => {
      const lb = labels[k]
      if (!lb) return
      if (lb.userData.gene !== p.gene) {
        lb.userData.setText(p.gene)
        lb.userData.gene = p.gene
      }
    })
    dirty = true
  }

  // ── 地面、軸 ──
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 1.2, LANES * LANE_GAP + 1.0),
    new THREE.MeshStandardMaterial({ color: 0x0b1428, roughness: 0.9, metalness: 0.1, transparent: true, opacity: 0.85 })
  )
  floor.rotation.x = -Math.PI / 2
  floor.position.y = -0.01
  root.add(floor)

  // 染色體色帶（貼在地面前緣）
  const strips = new THREE.Group()
  for (const c of genome.chromInfo) {
    const w = c.count * colW
    const m = new THREE.Mesh(new THREE.BoxGeometry(w - 0.02, 0.05, 0.1), new THREE.MeshStandardMaterial({ color: chromColor.get(c.name), emissive: chromColor.get(c.name), emissiveIntensity: 0.5, roughness: 0.5 }))
    m.position.set(x0 + (c.start + c.count / 2) * colW, 0.0, zOf(LANES - 1) + LANE_GAP * 0.9)
    strips.add(m)
  }
  root.add(strips)

  // 軸標籤貼圖（固定尺寸，只畫一次）
  const chromTex = (() => {
    const cv = document.createElement('canvas')
    cv.width = 2048
    cv.height = 150
    const g = cv.getContext('2d')
    g.font = '700 72px "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    for (const c of genome.chromInfo) {
      const cx = ((c.start + c.count / 2) / nBins) * cv.width
      g.fillStyle = '#' + chromColor.get(c.name).getHexString()
      // 窄的染色體只在寬度足夠時標示
      const num = Number(c.name)
      // 較窄的染色體（17–22）若都標數字會黏成一團（如「18 20 22」讀成 2022），所以只標 1–16 的偶數與 X
      if (c.name === 'X' || num <= 10 || (num % 2 === 0 && num <= 16)) g.fillText(c.name, cx, 50)
    }
    g.fillStyle = '#9aa6c4'
    g.font = '700 54px "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif'
    g.fillText('染色體 1 → 22、X', cv.width / 2, 114)
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    return t
  })()
  const chromPlane = new THREE.Mesh(new THREE.PlaneGeometry(W, (W * 150) / 2048), new THREE.MeshBasicMaterial({ map: chromTex, transparent: true, depthWrite: false }))
  chromPlane.position.set(0, -0.2, zOf(LANES - 1) + LANE_GAP * 0.9 + 0.32)
  chromPlane.rotation.x = -0.35
  root.add(chromPlane)

  // Y 軸（−log10 p）
  const yAxis = (() => {
    const cv = document.createElement('canvas')
    cv.width = 400
    cv.height = 1100
    const g = cv.getContext('2d')
    const H = NL_MAX_DISPLAY * HS
    const y = (nl) => cv.height - (displayNl(nl) / NL_MAX_DISPLAY) * cv.height
    g.strokeStyle = 'rgba(154,166,196,0.5)'
    g.lineWidth = 3
    g.beginPath()
    g.moveTo(388, 0)
    g.lineTo(388, cv.height)
    g.stroke()
    g.textAlign = 'right'
    g.textBaseline = 'middle'
    for (const v of [0, 5, 10, 12]) {
      g.fillStyle = '#c9d3ee'
      g.font = '700 78px system-ui,sans-serif'
      g.fillText(String(v), 350, Math.min(cv.height - 24, Math.max(24, y(v))))
      g.fillRect(372, Math.min(cv.height - 2, y(v)), 16, 4)
    }
    g.fillStyle = '#ff8a8a'
    g.font = '700 70px system-ui,sans-serif'
    g.fillText('7.3', 350, y(GW_THRESHOLD))
    g.fillStyle = '#9aa6c4'
    g.font = '700 66px "Noto Sans TC","Microsoft JhengHei",system-ui,sans-serif'
    g.fillText('≥12 壓縮', 388, 40)
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    const m = new THREE.Mesh(new THREE.PlaneGeometry((H * 400) / 1100, H), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }))
    return m
  })()
  yAxis.position.set(x0 - 0.15 - yAxis.geometry.parameters.width / 2, (NL_MAX_DISPLAY * HS) / 2, zOf(0) - 0.1)
  root.add(yAxis)
  const yTitle = kit.make('−log₁₀ p（越高越顯著）', { fontSize: 44, worldHeight: 0.5, color: '#c9d3ee', bg: null, border: null, left: x0 + 0.15 })
  yTitle.position.set(0, NL_MAX_DISPLAY * HS + 0.3, zOf(0))
  root.add(yTitle)

  // 顯著門檻：半透明紅色面 + 紅線
  const hThr = GW_THRESHOLD * HS
  const thr = new THREE.Mesh(
    new THREE.PlaneGeometry(W, LANES * LANE_GAP + 0.3),
    new THREE.MeshBasicMaterial({ color: C.red, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  )
  thr.rotation.x = -Math.PI / 2
  thr.position.y = hThr
  thr.renderOrder = 3
  root.add(thr)
  const thrLine = new THREE.Mesh(new THREE.BoxGeometry(W, 0.028, 0.028), new THREE.MeshBasicMaterial({ color: 0xff7a7a }))
  thrLine.position.set(0, hThr, zOf(LANES - 1) + 0.22)
  root.add(thrLine)
  const thrLabel = kit.make('全基因體顯著門檻 5×10⁻⁸', { fontSize: 38, worldHeight: 0.36, color: '#ffb0b0', bg: 'rgba(60,12,20,0.7)', border: 'rgba(255,120,120,0.5)' })
  thrLabel.position.set(W / 2 - 2.0, hThr + 0.28, zOf(LANES - 1) + 0.22)
  root.add(thrLabel)

  const badge = kit.make('示意資料 · 非真實 GWAS · 後排為示意副本', { fontSize: 38, worldHeight: 0.42, color: '#ffd98a', bg: 'rgba(60,44,8,0.7)', border: 'rgba(255,196,77,0.5)', left: x0 + 0.15 })
  // 放在 y 軸標題正下方（左上角：只有低矮的背景柱），不和右側會長高的基因標籤（如 VKORC1）相撞
  badge.position.set(0, NL_MAX_DISPLAY * HS - 0.3, zOf(0))
  root.add(badge)

  // 基因標籤 + 光暈
  const labels = []
  const glows = []
  for (let k = 0; k < 3; k++) {
    const lb = kit.make('GENE', { fontSize: 44, worldHeight: 0.42, color: '#fff3c8', bg: 'rgba(60,44,8,0.78)', border: 'rgba(255,196,77,0.7)' })
    lb.userData.gene = 'GENE'
    lb.visible = false
    labels.push(lb)
    root.add(lb)
    const gl = util.makeGlow(C.amber, 1.7, 0)
    glows.push(gl)
    root.add(gl)
  }

  recompute()

  function peakCount() {
    let peaks = 0
    let inPeak = false
    for (let i = 0; i < nBins; i++) {
      const p = binMax[i] > GW_THRESHOLD
      if (p && !inPeak) peaks++
      inPeak = p
    }
    return peaks
  }

  const tmpC = new THREE.Color()
  function writeInstances(t) {
    let moved = false
    for (let l = 0; l < LANES; l++) {
      for (let i = 0; i < nBins; i++) {
        const k = l * nBins + i
        const nl = targetNl[k]
        const tgt = displayNl(nl) * HS + 0.02
        const cur = curH[k]
        if (cur === tgt && !dirty) continue
        let h = cur
        if (cur !== tgt) {
          const d = tgt - cur
          h = Math.abs(d) > 0.002 ? cur + d * step : tgt
          if (h !== cur) {
            curH[k] = h
            moved = true
          }
        }
        dummy.position.set(xOf(i), h / 2, zOf(l))
        dummy.scale.set(colW * 0.86, h, 0.26)
        dummy.updateMatrix()
        mesh.setMatrixAt(k, dummy.matrix)
        // 顏色：越過門檻 → 琥珀色
        if (nl > GW_THRESHOLD) tmpC.copy(colHot)
        else tmpC.copy(chromColor.get(binChrom[i]))
        mesh.setColorAt(k, tmpC)
      }
    }
    if (moved || dirty) {
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }
    dirty = false
    return moved
  }
  let step = 0.2

  // 首次把所有柱子放到位（從 0 長出來）
  step = 1
  writeInstances(0)
  curH.fill(0.02)
  step = 0.2
  dirty = true

  const raycastMesh = mesh

  return {
    root,
    get trait() {
      return trait
    },
    get logN() {
      return logN
    },
    /** 重新「長出」地形（切換到這個主題時呼叫） */
    replay() {
      curH.fill(0.02)
      dirty = true
    },
    setTrait(k) {
      trait = k
      recompute()
    },
    setLogN(v) {
      logN = v
      recompute()
    },
    summary() {
      let maxNl = 0
      for (let i = 0; i < nBins; i++) if (binMax[i] > maxNl) maxNl = binMax[i]
      return { n: Math.pow(10, logN), peaks: peakCount(), maxNl, named: named.filter((p) => p.pass).map((p) => p.gene) }
    },
    update(dt, t) {
      // 暫停（dt = 0）時，切換性狀/樣本數的地形變化仍要直接到位
      step = ctx.paused ? 1 : 1 - Math.exp(-6 * dt)
      writeInstances(t)
      const m = ctx.motion
      for (let k = named.length; k < labels.length; k++) {
        labels[k].visible = false
        glows[k].material.opacity = 0
      }
      named.forEach((p, k) => {
        const lb = labels[k]
        const gl = glows[k]
        if (!lb) return
        const h = displayNl(p.nl) * HS
        lb.visible = p.pass
        lb.position.set(p.x, h + 0.55, zOf(1))
        gl.position.set(p.x, h, zOf(1))
        gl.material.opacity = p.pass ? 0.55 + 0.25 * Math.sin(t * 2.5 * m + k) : 0
      })
      thr.material.opacity = 0.14 + 0.05 * Math.sin(t * 1.6 * m)
    },
    pickTip() {
      const hit = ctx.pick([raycastMesh], false)[0]
      if (!hit || hit.instanceId == null) return null
      const k = hit.instanceId
      const i = k % nBins
      const nl = targetNl[k]
      const gene = laid.gene[i]
      const pass = nl > GW_THRESHOLD
      const lane = Math.floor(k / nBins)
      const head = lane > 0 ? '後排：背景噪音／示意副本（不是重複的研究）' : gene && pass ? `<b>${gene}</b> 所在的峰（示意）` : `染色體 ${binChrom[i]} 上的一個示意位點`
      return `${head}<br>−log₁₀ p ≈ ${nl.toFixed(1)}${pass ? ' · <b style="color:#ffc44d">越過顯著門檻</b>' : ' · 未達門檻'}<br><span style="opacity:.7">示意資料，非真實統計</span>`
    },
  }
}
