// ch06 共用零件：文字標籤、肝細胞反應室（酵素工廠）、效果計。
import { FONT_STACK } from '../../core/util.js'

/**
 * 會換色的文字標籤 Sprite。sprite.userData.set(text, color?, border?)
 * (顏色需要隨代謝型改變，util.makeLabel 建立後無法換色，所以這裡自己畫；
 *  canvas 尺寸改變前一律先 tex.dispose（），避免 GL_INVALID_VALUE。)
 */
export function makeTag(ctx, text, { color = '#e8ecf8', border = 'rgba(120,160,255,0.38)', fontSize = 40, worldHeight = 0.3, bold = true, bg = 'rgba(6,9,19,0.78)' } = {}) {
  const { THREE } = ctx
  const canvas = document.createElement('canvas')
  const g = canvas.getContext('2d')
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false })
  const sp = new THREE.Sprite(mat)
  sp.renderOrder = 999
  let uploaded = false
  const draw = (t, c = color, b = border) => {
    const lines = String(t).split('\n')
    const font = `${bold ? 700 : 400} ${fontSize}px ${FONT_STACK}`
    g.font = font
    const w = Math.max(...lines.map((l) => g.measureText(l).width))
    const lh = fontSize * 1.26
    const pad = 16
    const cw = Math.ceil(w + pad * 2)
    const chh = Math.ceil(lh * lines.length + pad * 1.2)
    const nw = Math.max(8, cw)
    const nh = Math.max(8, chh)
    if (uploaded && (canvas.width !== nw || canvas.height !== nh)) tex.dispose()
    canvas.width = nw
    canvas.height = nh
    g.font = font
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillStyle = bg
    g.beginPath()
    g.roundRect(1, 1, cw - 2, chh - 2, Math.min(20, chh / 2))
    g.fill()
    g.strokeStyle = b
    g.lineWidth = 2.5
    g.stroke()
    g.fillStyle = c
    lines.forEach((l, i) => g.fillText(l, cw / 2, pad * 0.6 + lh * (i + 0.5)))
    tex.needsUpdate = true
    uploaded = true
    ratio = canvas.width / canvas.height
    applyScale()
  }
  let ratio = 1
  let k = 1
  const applyScale = () => sp.scale.set(worldHeight * k * ratio, worldHeight * k, 1)
  draw(text)
  sp.userData.set = draw
  /** 整體放大倍率（窄螢幕時讓標籤讀得到）；換文字時會保留。 */
  sp.userData.setScale = (v) => {
    k = v
    applyScale()
  }
  return sp
}

const ACT_ORDER = [0, 5, 2, 7, 4, 1, 6, 3]

/**
 * 肝細胞反應室：半透明橢球 + 內質網膜 + 8 個酵素位點。
 * setActive（n）：前 n 個（依 ACT_ORDER）為功能正常。
 */
export function createReactor(ctx) {
  const { THREE, util, palette } = ctx
  const { COLORS } = palette
  const group = new THREE.Group()

  const shell = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 24), util.glassMat(COLORS.liver, 0.15))
  shell.scale.set(1.22, 0.98, 0.86)
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(1, 40, 24),
    new THREE.MeshBasicMaterial({ color: 0xff8a6a, transparent: true, opacity: 0.09, side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending })
  )
  rim.scale.copy(shell.scale).multiplyScalar(1.04)
  group.add(shell, rim)

  // 內質網膜（酵素鑲嵌其上）
  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(2.15, 1.2, 0.07),
    new THREE.MeshStandardMaterial({ color: COLORS.membrane, roughness: 0.55, metalness: 0.1, transparent: true, opacity: 0.8, emissive: 0x18265c, emissiveIntensity: 0.45 })
  )
  wall.position.set(0, 0, -0.42)
  group.add(wall)

  const bodyGeo = new THREE.IcosahedronGeometry(0.215, 1)
  const coreGeo = new THREE.SphereGeometry(0.06, 14, 10)
  const slots = []
  const cols = [-0.76, -0.26, 0.26, 0.76]
  const rows = [0.3, -0.24]
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 4; c++) {
      const i = r * 4 + c
      const g = new THREE.Group()
      g.position.set(cols[c], rows[r], -0.3)
      const body = new THREE.Mesh(bodyGeo, new THREE.MeshStandardMaterial({ color: COLORS.enzyme, roughness: 0.36, metalness: 0.08, emissive: COLORS.enzyme, emissiveIntensity: 0.3 }))
      const core = new THREE.Mesh(coreGeo, new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd36a, emissiveIntensity: 1.0, roughness: 0.3 }))
      core.position.set(0, 0.02, 0.17)
      const halo = util.makeGlow(COLORS.enzyme, 0.62, 0.0)
      halo.position.z = 0.05
      g.add(body, core, halo)
      g.rotation.set(0.1 * (c - 1.5), 0.15, 0)
      group.add(g)
      slots.push({ i, group: g, body, core, halo, act: 1, want: 1, hit: 0, phase: i * 0.9, rank: ACT_ORDER.indexOf(i) })
    }
  }

  // 底環：代謝型顏色
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.03, 8, 72), new THREE.MeshBasicMaterial({ color: COLORS.NM, transparent: true, opacity: 0.85 }))
  ring.rotation.x = Math.PI / 2
  ring.position.y = -1.0
  const ringGlow = util.makeGlow(COLORS.NM, 3.6, 0.18)
  ringGlow.position.y = -1.0
  ringGlow.scale.set(3.6, 1.0, 1)
  group.add(ring, ringGlow)

  // 單一標籤：酵素名稱 + 代謝型（隨代謝型換色）
  const tag = makeTag(ctx, '肝細胞\nNM', { worldHeight: 0.62, fontSize: 32 })
  tag.position.set(0, -1.62, 0.3)
  group.add(tag)

  const inactiveC = new THREE.Color(0x565e7a)
  const enzymeC = new THREE.Color(COLORS.enzyme)
  const umC = new THREE.Color(COLORS.UM)
  const umMix = umC.clone().lerp(enzymeC, 0.45)
  const tmp = new THREE.Color()
  let count = 6
  let uml = false
  const ringColor = new THREE.Color(COLORS.NM)
  const ringWant = new THREE.Color(COLORS.NM)

  const api = {
    setTagScale(v) {
      tag.userData.setScale(v)
    },
    group,
    shell,
    slots,
    tag,
    /** 某位點「前方」的世界座標（呼叫前需 updateMatrixWorld） */
    front(i, out) {
      const s = slots[i]
      s.group.getWorldPosition(out)
      out.z += 0.32
      return out
    },
    isActive(i) {
      return slots[i].rank < count
    },
    setActive(n, umlFlag, phColor, phLabel, enzymeName) {
      count = n
      uml = !!umlFlag
      ringWant.setHex(phColor)
      const css = '#' + ringWant.getHexString()
      tag.userData.set(`肝細胞 · ${enzymeName || ''}\n${phLabel}`, css, css)
      for (const s of slots) s.want = s.rank < count ? 1 : 0
    },
    hit(i) {
      slots[i].hit = 1
    },
    update(dt, t) {
      ringColor.lerp(ringWant, 1 - Math.exp(-6 * dt))
      ring.material.color.copy(ringColor)
      ringGlow.material.color.copy(ringColor)
      ringGlow.material.opacity = 0.16 + 0.05 * Math.sin(t * 2.2)
      for (const s of slots) {
        s.act = util.damp(s.act, s.want, 6, dt)
        s.hit = Math.max(0, s.hit - dt * 3.2)
        const a = s.act
        const sc = util.lerp(0.7, uml ? 1.2 : 1.0, a)
        s.body.scale.setScalar(sc * (1 + 0.22 * s.hit))
        tmp.copy(inactiveC).lerp(uml ? umMix : enzymeC, a)
        s.body.material.color.copy(tmp)
        s.body.material.emissive.copy(tmp)
        s.body.material.emissiveIntensity = util.lerp(0.03, (uml ? 0.55 : 0.32) + 0.5 * s.hit, a) + (a < 0.5 ? 0.5 * s.hit : 0)
        s.core.material.emissiveIntensity = a * (0.9 + 0.3 * Math.sin(t * 3 + s.phase)) + 1.5 * s.hit
        s.core.scale.setScalar(0.4 + 0.6 * a)
        s.halo.material.opacity = a * (uml ? 0.3 : 0.14) + 0.3 * s.hit
        s.group.rotation.z = (1 - a) * 0.5 * Math.sin(s.phase)
      }
    },
  }
  return api
}

/** 橫向「效果計」：分段色帶 + 移動的指標。value 0..1。長度 W，中心在原點。 */
export function createGauge(ctx, { W = 3.3 } = {}) {
  const { THREE, util } = ctx
  const group = new THREE.Group()
  const x0 = -W / 2
  const segs = []
  const labels = []
  const segMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, transparent: true, opacity: 0.75, emissive: 0xffffff, emissiveIntensity: 0.28 })
  const box = new THREE.BoxGeometry(1, 1, 1)
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(box, segMat())
    m.scale.set(0.5, 0.22, 0.22)
    group.add(m)
    segs.push(m)
    const lb = makeTag(ctx, '—', { worldHeight: 0.29, fontSize: 38, bold: true })
    lb.position.y = -0.36
    group.add(lb)
    labels.push(lb)
  }
  const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(W, 0.26, 0.26)), new THREE.LineBasicMaterial({ color: 0xbfd0ff, transparent: true, opacity: 0.55 }))
  group.add(frame)

  const marker = new THREE.Group()
  const pointer = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.26, 16), util.glowMat(0xffffff, 1.1))
  pointer.rotation.z = Math.PI // 尖端朝下
  pointer.position.y = 0.3
  const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), util.glowMat(0xffffff, 1.4))
  const glow = util.makeGlow(0xffffff, 0.8, 0.55)
  marker.add(pointer, orb, glow)
  group.add(marker)

  const title = makeTag(ctx, '效果（示意）', { worldHeight: 0.27, fontSize: 36, bg: 'rgba(6,9,19,0.6)' })
  title.position.set(0, 0.6, 0)
  group.add(title)

  const markerColor = new THREE.Color(0xffffff)
  const want = new THREE.Color(0xffffff)
  let value = 0.5
  let target = 0.5
  let zones = []
  const zoneAt = (v) => zones.find((z) => v <= z.to) || zones[zones.length - 1]
  const api = {
    setTagScale(v) {
      title.userData.setScale(v)
      for (const l of labels) l.userData.setScale(v)
    },
    group,
    W,
    setZones(list, titleText) {
      zones = list
      let prev = 0
      for (let i = 0; i < 3; i++) {
        const z = list[i]
        if (!z) {
          segs[i].visible = false
          labels[i].visible = false
          continue
        }
        segs[i].visible = true
        labels[i].visible = true
        const w = (z.to - prev) * W
        segs[i].scale.x = w - 0.02
        segs[i].position.x = x0 + prev * W + w / 2
        segs[i].material.color.setHex(z.color)
        segs[i].material.emissive.setHex(z.color)
        labels[i].position.x = x0 + prev * W + w / 2
        const css = '#' + new THREE.Color(z.color).getHexString()
        labels[i].userData.set(z.label, css, css)
        prev = z.to
      }
      title.userData.set(titleText)
    },
    setValue(v) {
      target = v
    },
    zone: () => zoneAt(target),
    update(dt, t) {
      value = util.damp(value, target, 4, dt)
      marker.position.x = x0 + value * W
      const z = zoneAt(value)
      want.setHex(z.color)
      markerColor.lerp(want, 1 - Math.exp(-8 * dt))
      pointer.material.color.copy(markerColor)
      pointer.material.emissive.copy(markerColor)
      orb.material.color.copy(markerColor)
      orb.material.emissive.copy(markerColor)
      glow.material.color.copy(markerColor)
      glow.scale.setScalar(0.8 + 0.12 * Math.sin(t * 4))
    },
  }
  return api
}
