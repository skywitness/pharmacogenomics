// Hero：首屏背景。巨大傾斜的 DNA 雙螺旋 + 漂浮藥丸 + 粒子，滑鼠帶視差，一道光沿螺旋掃描。
import { COLORS } from '../core/palette.js'

export const options = { orbit: false, fov: 38, camera: [0, 0, 11], target: [0, 0, 0], exposure: 1.1, envIntensity: 0.7 }

export default function create(ctx) {
  const { THREE, util, scene, camera } = ctx
  util.addStudioLights(scene, { intensity: 1.1 })

  const root = new THREE.Group()
  scene.add(root)

  // DNA
  const dna = util.createDNA({ pairs: 46, radius: 0.85, pitch: 4.8, rise: 0.36, ballSize: 0.17, rungRadius: 0.05, seed: 11 })
  root.add(dna.group)
  root.rotation.z = 0.62

  // 背景光暈
  const glowA = util.makeGlow(COLORS.cyan, 13, 0.32)
  glowA.position.set(1.5, 1, -4)
  const glowB = util.makeGlow(COLORS.magenta, 10, 0.26)
  glowB.position.set(4.5, -3, -5)
  scene.add(glowA, glowB)

  // 粒子
  const dust = util.createParticles({ count: 520, spread: [30, 16, 18], size: 0.09, color: 0x8fb4ff, opacity: 0.7, seed: 4 })
  scene.add(dust)

  // 漂浮藥丸
  const pillDefs = [
    { a: COLORS.magenta, b: 0xf4f7ff, r: 2.9, y: 1.6, s: 0.9, sp: 0.35, ph: 0 },
    { a: COLORS.cyan, b: 0xf4f7ff, r: 3.5, y: -1.8, s: 0.75, sp: -0.27, ph: 2.1 },
    { a: COLORS.amber, b: 0xffffff, r: 2.5, y: -0.2, s: 0.65, sp: 0.42, ph: 4.0 },
    { a: COLORS.green, b: 0xf4f7ff, r: 4.1, y: 2.9, s: 0.7, sp: -0.2, ph: 5.2 },
    { a: COLORS.violet, b: 0xf4f7ff, r: 3.9, y: -3.2, s: 0.8, sp: 0.3, ph: 1.0 },
  ]
  const pills = pillDefs.map((d) => {
    const p = util.createPill({ length: 1.3, radius: 0.34, colorA: d.a, colorB: d.b })
    p.scale.setScalar(d.s)
    root.add(p)
    return { mesh: p, ...d }
  })

  // 掃描光：沿螺旋往上，讓經過的鹼基對發亮
  const scanner = util.makeGlow(COLORS.cyan, 2.2, 0.9)
  dna.group.add(scanner)
  const n = dna.pairs.length

  // 版面：寬螢幕把螺旋放右側，窄螢幕放上方
  function layout() {
    const aspect = camera.aspect
    if (aspect > 1.15) {
      root.position.set(Math.min(4.2, aspect * 1.6), 0, 0)
      root.scale.setScalar(1)
    } else {
      root.position.set(0, 2.2, -1.5)
      root.scale.setScalar(0.72)
    }
  }
  layout()

  const target = { x: 0, y: 0 }
  const cur = { x: 0, y: 0 }

  return {
    onResize: layout,
    update(dt, t) {
      const m = ctx.motion
      dna.group.rotation.y = t * 0.32 * m
      // 視差
      const p = ctx.pointer
      target.x = p.inside ? p.x : 0
      target.y = p.inside ? p.y : 0
      cur.x = util.damp(cur.x, target.x, 3, dt)
      cur.y = util.damp(cur.y, target.y, 3, dt)
      camera.position.x = cur.x * 0.9
      camera.position.y = cur.y * 0.6
      camera.lookAt(0, 0, 0)

      // 掃描光
      const phase = ((t * 5 * m) % (n + 16)) - 8
      const idx = util.clamp(Math.floor(phase), 0, n - 1)
      const pr = dna.pairs[idx]
      scanner.position.set(0, pr.pos[0].y, 0)
      scanner.material.opacity = phase < 0 || phase > n ? 0 : 0.85
      for (let i = 0; i < n; i += 1) {
        const d = i - phase
        const k = Math.exp(-(d * d) / 6)
        const e = 0.3 + 1.6 * k
        dna.pairs[i].meshes.half0.material.emissiveIntensity = e
        dna.pairs[i].meshes.half1.material.emissiveIntensity = e
      }

      // 藥丸繞行
      for (const q of pills) {
        const a = q.ph + t * q.sp * m
        q.mesh.position.set(Math.cos(a) * q.r, q.y + Math.sin(t * 0.8 * m + q.ph) * 0.25, Math.sin(a) * q.r)
        q.mesh.rotation.set(t * 0.4 * m + q.ph, t * 0.6 * m, t * 0.3 * m)
      }
      dust.rotation.y = t * 0.012 * m
    },
    dispose() {},
  }
}
