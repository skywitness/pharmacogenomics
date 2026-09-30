// 「基因型實驗室」個體模式（橫向版面）：
//   母源染色體 ─ 肝細胞裡的酵素 ─ 父源染色體
//   （下方）母源等位基因晶片 ─ 表現型量表 ─ 父源等位基因晶片
// 整體是「一張資訊圖」，所以用近正面的相機，軌道旋轉只給輕微視差。
import { COLORS } from '../../core/palette.js'
import { CHROM_COL, FN, PH, GENES, css, phenotypeOf, enzymeCounts } from './data.js'

export const LAYOUT = {
  chromX: 3.3,
  chromY: 0.55,
  chromS: 0.8,
  cell: { cx: 0, cy: 0.62, rx: 2.15, ry: 1.0 },
  chipY: -1.36,
  chipW: 1.6,
  chipH: 1.1,
  meterY: -1.42,
  meterW: 4.7,
  meterH: 1.15,
}
// 相機取景用的內容外框（世界單位）
export const LAB_BOX = { cx: 0, cy: -0.04, w: 8.7, h: 3.95 }

const rr = (c, x, y, w, h, r) => {
  c.beginPath()
  c.roundRect(x, y, w, h, r)
}

/** 收集一棵物件樹的材質，提供整體淡入淡出（保留各材質原本的不透明度）。 */
function makeFader(objs) {
  const items = []
  const seen = new Set()
  for (const obj of objs) {
    obj.traverse((o) => {
      const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : []
      for (const m of ms) {
        if (seen.has(m)) continue
        seen.add(m)
        items.push({ m, base: m.opacity ?? 1 })
        m.transparent = true
      }
    })
  }
  let last = -1
  return {
    set(k) {
      if (Math.abs(k - last) < 0.002) return
      last = k
      for (const it of items) it.m.opacity = it.base * k
    },
  }
}

export function createLab(ctx) {
  const { THREE, util } = ctx
  const root = new THREE.Group()
  root.name = 'lab'
  const FONT = util.FONT_STACK
  const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z)
  const L = LAYOUT

  // ───────── 染色體 ─────────
  function buildChromosome(color) {
    const g = new THREE.Group()
    const mat = util.glossMat(color, { emissive: color, emissiveIntensity: 0.18 })
    const r = 0.2
    const defs = [
      [-0.3, 1, 0.72],
      [0.3, 1, 0.72],
      [-0.22, -1, 1.05],
      [0.22, -1, 1.05],
    ]
    const dirs = []
    defs.forEach(([dx, dy, len]) => {
      const dir = V3(dx, dy, 0).normalize()
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat)
      m.position.copy(dir).multiplyScalar((len + 2 * r) / 2 - r * 0.5)
      m.quaternion.setFromUnitVectors(V3(0, 1, 0), dir)
      g.add(m)
      dirs.push(dir)
    })
    const cen = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 14), util.glossMat(0xffffff, { emissive: color, emissiveIntensity: 0.3 }))
    g.add(cen)

    // 基因座：兩條姐妹染色分體（已複製）上各有一個相同的亮環
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x4be3a0, emissive: 0x4be3a0, emissiveIntensity: 1.4, roughness: 0.3 })
    const ringGeo = new THREE.TorusGeometry(r * 1.32, 0.055, 12, 40)
    const rings = []
    for (const k of [2, 3]) {
      const ring = new THREE.Mesh(ringGeo, ringMat)
      ring.position.copy(dirs[k]).multiplyScalar(0.92)
      ring.quaternion.setFromUnitVectors(V3(0, 0, 1), dirs[k])
      g.add(ring)
      rings.push(ring)
    }
    const glow = util.makeGlow(0x4be3a0, 1.35, 0.7)
    glow.position.copy(rings[0].position).add(rings[1].position).multiplyScalar(0.5)
    glow.position.z = 0.15
    g.add(glow)
    // 染色體背後的柔光，增加層次
    const halo = util.makeGlow(color, 4.2, 0.22)
    halo.position.set(0, -0.15, -0.5)
    g.add(halo)

    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.7, 1), new THREE.MeshBasicMaterial({ visible: false }))
    hit.position.set(0, -0.15, 0)
    g.add(hit)
    return { group: g, ringMat, glow, hit, mat }
  }

  // 標籤註冊表：窄螢幕時換成較短的字並放大，維持可讀
  const labels = []
  const regLabel = (sprite, full, short) => {
    labels.push({ sprite, full, short: short ?? full })
    return sprite
  }
  const locusLbl = []
  const chroms = { mom: buildChromosome(CHROM_COL.mom), dad: buildChromosome(CHROM_COL.dad) }
  for (const [s, sign] of [
    ['mom', -1],
    ['dad', 1],
  ]) {
    const c = chroms[s]
    c.group.position.set(sign * L.chromX, L.chromY, 0)
    c.group.scale.setScalar(L.chromS)
    c.hit.userData.side = s
    root.add(c.group)
    const nm = s === 'mom' ? '來自母親' : '來自父親'
    const name = regLabel(util.makeLabel(nm, { fontSize: 36, worldHeight: 0.4, color: css(CHROM_COL[s]), bg: 'rgba(6,9,19,0.55)', border: null }), nm)
    name.position.set(sign * L.chromX, 1.72, 0.3)
    root.add(name)
    // 基因座說明（步驟 0-1 顯示，使用者一動手就淡出）
    const loc = regLabel(util.makeLabel('▲ CYP2C19 基因座', { fontSize: 34, worldHeight: 0.34, color: '#4be3a0', bg: 'rgba(6,9,19,0.7)', border: null }), '▲ CYP2C19 基因座', '▲ 基因座')
    loc.position.set(sign * L.chromX, -0.6, 0.35)
    loc.material.opacity = 0
    loc.visible = false
    root.add(loc)
    locusLbl.push(loc)
  }

  // ───────── 等位基因晶片（canvas 平面） ─────────
  const tags = {}
  for (const [s, sign] of [
    ['mom', -1],
    ['dad', 1],
  ]) {
    const p = util.createChartPlane({ width: L.chipW, height: L.chipH, px: 320, bg: null })
    p.mesh.position.set(sign * L.chromX, L.chipY, 0.3)
    p.mesh.material.depthTest = false
    p.mesh.renderOrder = 20
    p.mesh.userData.side = s
    p.sc = 1
    root.add(p.mesh)
    tags[s] = p
  }
  function drawTag(side, al, showVariant) {
    const col = css(CHROM_COL[side])
    tags[side].redraw((c, W, H) => {
      rr(c, 4, 4, W - 8, H - 8, 26)
      c.fillStyle = 'rgba(6,9,19,0.9)'
      c.fill()
      c.lineWidth = 6
      c.strokeStyle = col
      c.stroke()
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      c.fillStyle = '#ffffff'
      c.font = `800 ${showVariant ? 88 : 100}px ${FONT}`
      c.fillText(al.id, W / 2, showVariant ? 66 : 84)
      c.fillStyle = css(FN[al.fn].color)
      c.font = `800 46px ${FONT}`
      c.fillText(FN[al.fn].zh, W / 2, showVariant ? 136 : 164)
      if (showVariant) {
        c.fillStyle = '#c9d3f0'
        c.font = `700 34px ${FONT}`
        c.fillText(al.chip, W / 2, 188)
      }
    })
  }

  // ───────── 肝細胞（示意） ─────────
  const { cx, cy, rx, ry } = L.cell
  const cellGroup = new THREE.Group()
  root.add(cellGroup)
  const cell = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), util.glassMat(0x6c8cff, 0.12))
  cell.scale.set(rx, ry, 1.1)
  cell.position.set(cx, cy, 0)
  cell.renderOrder = 2
  cellGroup.add(cell)
  const ell = new THREE.EllipseCurve(0, 0, rx, ry, 0, Math.PI * 2, false, 0)
  const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ell.getPoints(96).map((p) => V3(p.x, p.y, 0))), new THREE.LineBasicMaterial({ color: 0x9db8ff, transparent: true, opacity: 0.8 }))
  outline.position.set(cx, cy, 0)
  cellGroup.add(outline)
  for (const [side, thetaStart, col] of [
    ['mom', Math.PI / 2, CHROM_COL.mom],
    ['dad', -Math.PI / 2, CHROM_COL.dad],
  ]) {
    const half = new THREE.Mesh(new THREE.CircleGeometry(1, 48, thetaStart, Math.PI), new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false, side: THREE.DoubleSide }))
    half.scale.set(rx, ry, 1)
    half.position.set(cx, cy, -0.5)
    cellGroup.add(half)
  }
  const divider = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(cx, cy + ry * 0.98, -0.2), V3(cx, cy - ry * 0.98, -0.2)]), new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }))
  cellGroup.add(divider)
  const lblOpt = { fontSize: 34, worldHeight: 0.34, bg: 'rgba(6,9,19,0.6)', border: null, bold: true }
  const lblCell = regLabel(util.makeLabel('肝細胞裡的酵素（示意）', { ...lblOpt, color: '#c9d3f0' }), '肝細胞裡的酵素（示意）', '肝細胞酵素（示意）')
  lblCell.position.set(cx, cy + ry + 0.22, 0.4)
  const lblMom = regLabel(util.makeLabel('母源基因做的酵素', { ...lblOpt, color: css(CHROM_COL.mom) }), '母源基因做的酵素', '母源酵素')
  const lblDad = regLabel(util.makeLabel('父源基因做的酵素', { ...lblOpt, color: css(CHROM_COL.dad) }), '父源基因做的酵素', '父源酵素')
  lblMom.position.set(-1.2, cy - ry - 0.2, 0.4)
  lblDad.position.set(1.2, cy - ry - 0.2, 0.4)
  cellGroup.add(lblCell, lblMom, lblDad)

  // ───────── 酵素分子（InstancedMesh） ─────────
  const rand = util.rng(11)
  const sideSlots = (sign) => {
    const pts = []
    let minD = 0.66
    let guard = 0
    while (pts.length < 9 && guard++ < 4000) {
      const x = sign * (0.42 + rand() * (rx * 0.86 - 0.42))
      const y = (rand() - 0.5) * ry * 1.7
      if ((x / (rx * 0.9)) ** 2 + (y / (ry * 0.82)) ** 2 > 1) continue
      const z = (rand() - 0.5) * 0.7
      if (pts.every((q) => Math.hypot(q.x - x, q.y - (cy + y), (q.z - z) * 0.6) > minD)) pts.push(V3(x, cy + y, z))
      if (guard % 300 === 0) minD *= 0.93
    }
    return pts
  }
  const sphereGeo = new THREE.IcosahedronGeometry(0.22, 2)
  const dotGeo = new THREE.SphereGeometry(0.078, 12, 10)
  const shardGeo = new THREE.OctahedronGeometry(0.21, 0)
  const dotMat = new THREE.MeshStandardMaterial({ color: 0xd8f6ff, emissive: 0xaeeaff, emissiveIntensity: 1.6 })
  const shardMat = util.glossMat(COLORS.inactive, { roughness: 0.8, metalness: 0.05, flatShading: true, emissive: 0x1c2233, emissiveIntensity: 1 })
  const enz = {}
  for (const [side, sign] of [
    ['mom', -1],
    ['dad', 1],
  ]) {
    const mat = util.glossMat(COLORS.enzyme, { emissive: COLORS.enzyme, emissiveIntensity: 0.4 })
    const spheres = new THREE.InstancedMesh(sphereGeo, mat, 9)
    const dots = new THREE.InstancedMesh(dotGeo, dotMat, 9)
    const shards = new THREE.InstancedMesh(shardGeo, shardMat, 6)
    for (const m of [spheres, dots, shards]) {
      m.frustumCulled = false
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
      cellGroup.add(m)
    }
    const glow = util.makeGlow(COLORS.enzyme, 3.4, 0)
    glow.position.set(sign * 1.1, cy, -0.6)
    cellGroup.add(glow)
    enz[side] = {
      sign,
      mat,
      spheres,
      dots,
      shards,
      glow,
      glowLvl: 0,
      glowTarget: 0,
      slots: sideSlots(sign),
      sw: new Array(9).fill(0),
      sb: new Array(6).fill(0),
      working: 6,
      broken: 0,
      phase: Array.from({ length: 9 }, () => rand() * 6.28),
    }
  }
  const cellFade = makeFader([cell, outline, divider, ...cellGroup.children.filter((o) => o.isMesh && o.geometry.type === 'CircleGeometry'), ...['mom', 'dad'].flatMap((s) => [enz[s].spheres, enz[s].dots, enz[s].shards])])

  // ───────── 轉錄產物流（粒子）：基因座 → 細胞 ─────────
  const N = 28
  const streams = {}
  for (const side of ['mom', 'dad']) {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    const mat = new THREE.PointsMaterial({ size: 0.32, map: util.glowTexture(), color: 0x4be3a0, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true })
    const pts = new THREE.Points(geo, mat)
    pts.frustumCulled = false
    root.add(pts)
    const s = side === 'mom' ? -1 : 1
    streams[side] = { pts, mat, geo, a: V3(s * (L.chromX - 0.28), -0.05, 0.2), c: V3(s * 3.0, 0.95, 0.3), b: V3(s * 1.85, cy + 0.05, 0.1), n: 20, speed: 0.4 }
  }

  // ───────── 表現型量表（canvas） ─────────
  const M = { w: L.meterW, h: L.meterH }
  const meter = util.createChartPlane({ width: M.w, height: M.h, px: 940, bg: 'rgba(8,13,30,0.88)' })
  meter.mesh.position.set(0, L.meterY, 0.2)
  meter.mesh.renderOrder = 15
  root.add(meter.mesh)
  function drawMeter(st) {
    const gene = GENES[st.gene]
    const ph = phenotypeOf(st.gene, st.a, st.b)
    meter.redraw((c, W) => {
      const x0 = 14
      const segW = (W - 28) / 5
      const barY = 16
      const barH = 92
      const activeIdx = gene.kind === 'score' ? Math.round(ph.score * 2) : gene.ladder.indexOf(ph.key)
      c.textAlign = 'center'
      c.textBaseline = 'middle'
      for (let i = 0; i < 5; i++) {
        const key = gene.ladder[i]
        const on = i === activeIdx
        const x = x0 + i * segW
        c.globalAlpha = on ? 1 : 0.46
        rr(c, x + 4, barY - (on ? 7 : 0), segW - 8, barH + (on ? 14 : 0), 14)
        c.fillStyle = css(PH[key].color)
        c.fill()
        c.globalAlpha = 1
        if (on) {
          c.lineWidth = 5
          c.strokeStyle = '#ffffff'
          c.stroke()
        }
        c.fillStyle = on ? '#0a1024' : 'rgba(255,255,255,0.9)'
        c.font = `800 ${gene.kind === 'score' ? 58 : 54}px ${FONT}`
        c.fillText(gene.kind === 'score' ? (i / 2).toFixed(1) : PH[key].short, x + segW / 2, barY + barH / 2 + 2)
      }
      const mx = x0 + activeIdx * segW + segW / 2
      c.fillStyle = css(PH[ph.key].color)
      c.beginPath()
      c.moveTo(mx, barY + barH + 12)
      c.lineTo(mx - 14, barY + barH + 32)
      c.lineTo(mx + 14, barY + barH + 32)
      c.closePath()
      c.fill()
      c.font = `800 64px ${FONT}`
      c.fillText(`預測：${PH[ph.key].zh}（${ph.key}）`, W / 2, 190)
    })
  }

  // ───────── 狀態 ─────────
  let cur = { gene: 'CYP2C19', a: '*1', b: '*2', showVariant: false }
  const K = { chip: 1, cell: 1, meter: 1 } // 目前的淡入程度
  const KT = { chip: 1, cell: 1, meter: 1 } // 目標
  let hover = null
  let cue = false // 提示可點擊：染色體與晶片輕輕脈動
  let narrow = false
  let locusK = 0
  let locusT = 0

  function set(st) {
    cur = { ...cur, ...st }
    const gene = GENES[cur.gene]
    for (const side of ['mom', 'dad']) {
      const id = side === 'mom' ? cur.a : cur.b
      const al = gene.alleles[id]
      const col = FN[al.fn].color
      const ch = chroms[side]
      ch.ringMat.color.setHex(col)
      ch.ringMat.emissive.setHex(col)
      ch.glow.material.color.setHex(col)
      streams[side].mat.color.setHex(col)
      const cnt = enzymeCounts(cur.gene, id)
      const E = enz[side]
      E.working = cnt.working
      E.broken = cnt.broken
      E.glowTarget = al.act > 1 ? 0.45 : 0
      streams[side].n = al.fn === 'none' ? 7 : al.fn === 'decreased' ? 13 : al.fn === 'increased' ? 28 : 20
      streams[side].speed = al.fn === 'none' ? 0.28 : al.fn === 'increased' ? 0.62 : 0.4
      drawTag(side, al, cur.showVariant)
    }
    drawMeter(cur)
  }
  set({})

  const tmpM = new THREE.Matrix4()
  const tmpQ = new THREE.Quaternion()
  const tmpE = new THREE.Euler()
  const tmpS = new THREE.Vector3()
  const tmpP = new THREE.Vector3()
  const tmpD = new THREE.Vector3()
  const up = V3(0, 0.2, 0)

  function update(dt, t) {
    const m = ctx.motion
    for (const k of ['chip', 'cell', 'meter']) K[k] = util.damp(K[k], KT[k], 5, dt)
    const cueP = cue ? 0.5 + 0.5 * Math.sin(t * 3.2) : 0
    locusK = util.damp(locusK, locusT, 6, dt)
    for (const l of locusLbl) {
      l.material.opacity = locusK
      l.visible = locusK > 0.02
    }
    // 染色體輕微擺動 + 基因座脈動
    for (const side of ['mom', 'dad']) {
      const ch = chroms[side]
      const ph = side === 'mom' ? 0 : 2
      ch.group.rotation.y = Math.sin(t * 0.55 + ph) * 0.32 * m
      ch.group.rotation.z = Math.sin(t * 0.4 + ph) * 0.05 * m
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4 + ph)
      const boost = (hover === side || hover === 'both' ? 0.9 : 0) + cueP * 0.55
      ch.ringMat.emissiveIntensity = 1.1 + 0.7 * pulse * (m > 0.5 ? 1 : 0.3) + boost
      ch.glow.material.opacity = 0.5 + 0.3 * pulse + boost * 0.3
      ch.glow.scale.setScalar(1.15 + 0.2 * pulse + boost * 0.3)
      // 晶片：淡入 + 指到時放大
      const tg = tags[side]
      tg.mesh.material.opacity = K.chip
      tg.sc = util.damp(tg.sc, (hover === side || hover === 'both' ? 1.09 : 1) + cueP * 0.045, 10, dt)
      tg.mesh.scale.setScalar(tg.sc)
    }
    // 酵素
    cellGroup.visible = K.cell > 0.015
    cellFade.set(K.cell)
    // 標籤是教學文字：細胞淡出時仍維持足夠對比（不低於 0.85）
    for (const l of [lblCell, lblMom, lblDad]) l.material.opacity = 0.85 + 0.15 * K.cell
    for (const side of ['mom', 'dad']) {
      const E = enz[side]
      for (let i = 0; i < 9; i++) {
        E.sw[i] = util.damp(E.sw[i], i < E.working ? 1 : 0, 6, dt)
        const s = E.sw[i]
        const slot = E.slots[i]
        tmpP.set(slot.x, slot.y + Math.sin(t * 1.2 + E.phase[i]) * 0.045 * m, slot.z)
        tmpQ.setFromEuler(tmpE.set(t * 0.3 * m + E.phase[i], t * 0.4 * m + E.phase[i] * 2, 0))
        tmpM.compose(tmpP, tmpQ, tmpS.setScalar(Math.max(s, 0.0001)))
        E.spheres.setMatrixAt(i, tmpM)
        tmpD.copy(up).applyQuaternion(tmpQ).multiplyScalar(s * 1.05)
        const blink = 0.85 + 0.25 * Math.sin(t * 3 + E.phase[i] * 3) * m
        tmpM.compose(tmpP.add(tmpD), tmpQ, tmpS.setScalar(Math.max(s * blink, 0.0001)))
        E.dots.setMatrixAt(i, tmpM)
      }
      for (let j = 0; j < 6; j++) {
        E.sb[j] = util.damp(E.sb[j], j < E.broken ? 1 : 0, 6, dt)
        const s = E.sb[j]
        const slot = E.slots[(E.working + j) % 9]
        tmpP.set(slot.x, slot.y - 0.02 + Math.sin(t * 0.8 + E.phase[j]) * 0.02 * m, slot.z)
        tmpQ.setFromEuler(tmpE.set(0.5 + E.phase[j], 0.9 + E.phase[j] * 1.3, 0.3))
        tmpS.set(1.05 * Math.max(s, 0.0001), 0.5 * Math.max(s, 0.0001), 0.8 * Math.max(s, 0.0001))
        tmpM.compose(tmpP, tmpQ, tmpS)
        E.shards.setMatrixAt(j, tmpM)
      }
      E.spheres.instanceMatrix.needsUpdate = true
      E.dots.instanceMatrix.needsUpdate = true
      E.shards.instanceMatrix.needsUpdate = true
      E.glowLvl = util.damp(E.glowLvl, E.glowTarget * (0.8 + 0.2 * Math.sin(t * 2)), 4, dt)
      E.glow.material.opacity = E.glowLvl * K.cell
      E.mat.emissiveIntensity = util.damp(E.mat.emissiveIntensity, E.glowTarget > 0 ? 1.1 : 0.4, 4, dt)
    }
    // 粒子流
    for (const side of ['mom', 'dad']) {
      const S = streams[side]
      const arr = S.geo.attributes.position.array
      for (let i = 0; i < N; i++) {
        const u = (i / N + t * S.speed * m) % 1
        const w = 1 - u
        arr[i * 3] = w * w * S.a.x + 2 * w * u * S.c.x + u * u * S.b.x + Math.sin(i * 3.1 + t * 2) * 0.05
        arr[i * 3 + 1] = w * w * S.a.y + 2 * w * u * S.c.y + u * u * S.b.y
        arr[i * 3 + 2] = w * w * S.a.z + 2 * w * u * S.c.z + u * u * S.b.z + Math.cos(i * 2.3) * 0.08
      }
      S.geo.attributes.position.needsUpdate = true
      S.geo.setDrawRange(0, S.n)
      S.mat.opacity = 0.95 * (0.3 + 0.7 * K.cell)
    }
    // 量表
    meter.mesh.material.opacity = K.meter
    meter.mesh.visible = K.meter > 0.02
  }

  return {
    root,
    chroms,
    hits: [chroms.mom.hit, chroms.dad.hit, tags.mom.mesh, tags.dad.mesh],
    set,
    get state() {
      return cur
    },
    setHover(side) {
      hover = side
    },
    /** 尚未操作時的「可以點」提示脈動 */
    setCue(v) {
      cue = !!v
    },
    /** 基因座名稱標籤顯示與否 */
    setLocusLabel(v) {
      locusT = v ? 1 : 0
    },
    /** 窄螢幕：換短字、放大標籤 */
    setNarrow(v) {
      v = !!v
      if (v === narrow) return
      narrow = v
      for (const l of labels) {
        l.sprite.userData.setText(v ? l.short : l.full)
        if (v) l.sprite.scale.multiplyScalar(1.28)
      }
    },
    /** 各區塊的可見度目標 0..1（chip 晶片 / cell 細胞酵素 / meter 量表） */
    setVis(v) {
      Object.assign(KT, v)
    },
    snapVis() {
      Object.assign(K, KT)
    },
    update,
    dispose() {
      util.disposeTree(root)
    },
  }
}
