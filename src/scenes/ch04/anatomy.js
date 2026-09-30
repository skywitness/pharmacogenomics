// ch04：半透明「全息」人體、器官、血管與粒子路線。全部用基本幾何，不追求真實解剖。
// 座標：x 向右（人物的左手在畫面右側）、y 向上、z 朝向鏡頭。人體高度約 y = -2.7 … 3.7，下半身以 shader 漸層淡出。

export function buildAnatomy(ctx) {
  const { THREE, util, palette } = ctx
  const C = palette.COLORS
  const V = (x, y, z = 0) => new THREE.Vector3(x, y, z)
  const UP = V(0, 1, 0)
  const root = new THREE.Group()
  root.name = 'ch04-anatomy'

  // ───────── 共用材質工具 ─────────
  const yFade = (mat, y0, y1) => {
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vWY;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvWY = (modelMatrix * vec4(transformed, 1.0)).y;')
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vWY;')
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>\ngl_FragColor.a *= smoothstep(${y0.toFixed(2)}, ${y1.toFixed(2)}, vWY);`)
    }
    mat.customProgramCacheKey = () => `yfade${y0}_${y1}`
    return mat
  }

  const bodyMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color(C.cyan) }, uAlert: { value: 0 }, uScan: { value: 9 }, uGlow: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vY = wp.y;
        vec4 mv = viewMatrix * wp;
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlert; uniform float uScan; uniform float uGlow;
      varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){
        float ndv = abs(dot(normalize(vN), normalize(vV)));
        float f = pow(1.0 - ndv, 2.2);
        float fade = smoothstep(-2.75, -1.35, vY);
        float scan = smoothstep(0.16, 0.0, abs(vY - uScan));
        vec3 base = mix(uColor, vec3(1.0, 0.33, 0.33), uAlert);
        float a = (0.05 + 0.6 * f + 0.09 * uGlow + 0.22 * scan) * (1.0 + 1.3 * uAlert) * fade + 0.16 * uAlert * f * fade;
        gl_FragColor = vec4(base * (0.6 + 0.9 * f + 0.6 * scan), a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  })

  const place = (mesh, a, b) => {
    const dir = new THREE.Vector3().subVectors(b, a)
    mesh.position.copy(a).addScaledVector(dir, 0.5)
    mesh.quaternion.setFromUnitVectors(UP, dir.clone().normalize())
    return dir.length()
  }
  const capsule = (a, b, r, mat) => {
    const len = a.distanceTo(b)
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len - r), 6, 20), mat)
    place(m, a, b)
    return m
  }

  // ───────── 人體輪廓（全息） ─────────
  const body = new THREE.Group()
  root.add(body)
  {
    const prof = [
      [0.02, -1.3], [0.5, -1.25], [0.8, -1.0], [0.86, -0.55], [0.79, 0.0], [0.74, 0.5], [0.79, 1.0], [0.9, 1.55], [1.0, 2.0], [0.93, 2.3], [0.6, 2.46], [0.28, 2.58], [0.02, 2.62],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    const torsoGeo = new THREE.LatheGeometry(prof, 56)
    torsoGeo.scale(1, 1, 0.55)
    body.add(new THREE.Mesh(torsoGeo, bodyMat))
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.55, 28, 1, true), bodyMat)
    neck.position.set(0, 2.72, 0)
    body.add(neck)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 28), bodyMat)
    head.scale.set(0.86, 1.08, 0.96)
    head.position.set(0, 3.2, 0)
    body.add(head)
    for (const s of [-1, 1]) {
      const sh = V(s * 1.02, 2.08), el = V(s * 1.38, 0.95), wr = V(s * 1.56, -0.2)
      body.add(capsule(sh, el, 0.235, bodyMat), capsule(el, wr, 0.185, bodyMat))
      body.add(capsule(V(s * 0.42, -1.05), V(s * 0.52, -2.75), 0.36, bodyMat))
    }
  }

  // ───────── 器官 ─────────
  const organs = {}
  const organList = []
  const organMat = (color, opacity = 0.9) =>
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.22, roughness: 0.45, metalness: 0.0, transparent: true, opacity })
  const addOrgan = (key, mesh, base, ebase = 0.22) => {
    mesh.userData.organ = key
    mesh.userData.base = base
    mesh.userData.ebase = ebase
    mesh.userData.hl = 0
    mesh.userData.dim = false
    mesh.userData.dimK = 0
    mesh.userData.colBase = mesh.material.color.clone()
    mesh.renderOrder = 2
    organs[key] = mesh
    organList.push(mesh)
    root.add(mesh)
    return mesh
  }
  const ellipsoid = (key, color, c, r, rot, opacity = 0.9, ebase = 0.22) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 44, 30), organMat(color, opacity))
    m.position.copy(c)
    m.scale.set(r[0], r[1], r[2])
    m.rotation.z = rot
    m.material.emissiveIntensity = ebase
    return addOrgan(key, m, m.scale.clone(), ebase)
  }

  const P = {
    mouth: V(0, 3.06, 0.44),
    heart: V(0.16, 1.88, 0.08),
    stomach: V(0.36, 1.16, 0.05),
    liver: V(-0.36, 1.27, 0.04),
    kidneyR: V(-0.66, 0.55, -0.25), // 人物右腎 = 畫面左側
    kidneyL: V(0.66, 0.52, -0.25),
    bladder: V(0, -0.98, 0.08),
    target: V(1.21, 1.45, 0.0),
    root: V(0.0, 0.18, -0.12), // 腸繫膜根部（靜脈匯集處）
    ivSite: V(-1.56, -0.28, 0),
  }
  const STOMACH_ROT = 0.6
  const STOMACH_R = [0.52, 0.33, 0.3]

  ellipsoid('stomach', 0xea9580, P.stomach, STOMACH_R, STOMACH_ROT, 0.86, 0.28)
  ellipsoid('liver', C.liver, P.liver, [0.56, 0.38, 0.32], -0.18, 0.9, 0.24)
  const heart = ellipsoid('heart', 0xe0405a, P.heart, [0.3, 0.34, 0.26], -0.35, 0.95, 0.3)
  ellipsoid('kidneyR', 0xb85560, P.kidneyR, [0.19, 0.34, 0.15], 0.22, 0.88, 0.24)
  ellipsoid('kidneyL', 0xb85560, P.kidneyL, [0.19, 0.34, 0.15], -0.22, 0.88, 0.24)
  const bladder = ellipsoid('bladder', 0xe6cf7a, P.bladder, [0.24, 0.2, 0.2], 0, 0.75, 0.16)
  // 肺：淡藍色裝飾
  for (const s of [-1, 1]) {
    const lung = new THREE.Mesh(new THREE.SphereGeometry(1, 30, 20), new THREE.MeshStandardMaterial({ color: 0x8fa8dc, emissive: 0x8fa8dc, emissiveIntensity: 0.12, roughness: 0.6, transparent: true, opacity: 0.2, depthWrite: false }))
    lung.position.set(s * 0.58, 2.0, -0.08)
    lung.scale.set(0.4, 0.68, 0.3)
    lung.rotation.z = -s * 0.12
    lung.renderOrder = 1
    root.add(lung)
  }

  // 小腸：蛇行的管
  const smallPts = [V(-0.06, 0.88, 0.06), V(-0.22, 0.78, 0.06), V(-0.32, 0.6, 0.06)]
  const rows = [0.53, 0.35, 0.17, -0.01, -0.19, -0.37]
  rows.forEach((y, i) => {
    const dir = i % 2 === 0 ? 1 : -1
    const xs = dir === 1 ? [-0.3, -0.05, 0.2, 0.45] : [0.45, 0.2, -0.05, -0.3]
    xs.forEach((x, k) => smallPts.push(V(x, y + 0.035 * Math.sin(k * 2.1 + i), 0.06)))
  })
  smallPts.push(V(-0.55, -0.4, 0.06))
  const smallCurve = new THREE.CatmullRomCurve3(smallPts, false, 'centripetal')
  const smallInt = new THREE.Mesh(new THREE.TubeGeometry(smallCurve, 420, 0.068, 12, false), organMat(0xf2a98d, 0.9))
  addOrgan('smallInt', smallInt, smallInt.scale.clone(), 0.24)

  // 大腸：框住小腸
  const colonPts = [V(-0.66, -0.55, 0.02), V(-0.72, 0.0, 0.02), V(-0.7, 0.55, 0.02), V(-0.62, 0.8, 0.02), V(-0.3, 0.84, 0.02), V(0.05, 0.8, 0.02), V(0.4, 0.83, 0.02), V(0.68, 0.76, 0.02), V(0.74, 0.3, 0.02), V(0.7, -0.3, 0.02), V(0.55, -0.62, 0.02), V(0.3, -0.75, 0.04), V(0.08, -0.7, 0.05), V(0.0, -0.86, 0.06), V(0.0, -1.12, 0.06)]
  const colonCurve = new THREE.CatmullRomCurve3(colonPts, false, 'centripetal')
  const colon = new THREE.Mesh(new THREE.TubeGeometry(colonCurve, 240, 0.095, 12, false), organMat(0xc98572, 0.72))
  addOrgan('colon', colon, colon.scale.clone(), 0.16)

  // 食道
  const esoPts = [V(0, 3.02, 0.36), V(0, 2.92, 0.2), V(0, 2.7, 0.02), V(0, 2.35, -0.06), V(0.03, 1.98, -0.08), V(0.14, 1.66, -0.02), V(0.24, 1.44, 0.05)]
  const esoCurve = new THREE.CatmullRomCurve3(esoPts, false, 'centripetal')
  const esophagus = new THREE.Mesh(new THREE.TubeGeometry(esoCurve, 80, 0.05, 10, false), organMat(0xe6a08c, 0.7))
  esophagus.renderOrder = 2
  root.add(esophagus)

  // ───────── 血管 ─────────
  const vesselMat = yFade(new THREE.MeshBasicMaterial({ color: 0xd8456a, transparent: true, opacity: 0.42, depthWrite: false }), -2.7, -1.5)
  const portalMat = new THREE.MeshBasicMaterial({ color: 0xff7a8f, transparent: true, opacity: 0.6, depthWrite: false })
  const branchMat = new THREE.MeshBasicMaterial({ color: 0xd8456a, transparent: true, opacity: 0.32, depthWrite: false })
  const vessels = new THREE.Group()
  root.add(vessels)
  const tube = (pts, r, mat = vesselMat, seg) => {
    const cv = typeof pts.getPointAt === 'function' ? pts : new THREE.CatmullRomCurve3(pts, false, 'centripetal')
    const m = new THREE.Mesh(new THREE.TubeGeometry(cv, seg || Math.max(16, (pts.length || 20) * 8), r, 8, false), mat)
    m.renderOrder = 3
    vessels.add(m)
    return m
  }
  const H = P.heart
  const aortaPts = (yTop, yBot) => {
    const out = []
    const n = Math.max(2, Math.ceil((yTop - yBot) / 0.45))
    for (let i = 0; i <= n; i++) out.push(V(0.12 + 0.015 * Math.sin(i * 1.7), yTop + ((yBot - yTop) * i) / n, -0.28))
    return out
  }
  const ivcPts = (yBot, yTop) => {
    const out = []
    const n = Math.max(2, Math.ceil((yTop - yBot) / 0.45))
    for (let i = 0; i <= n; i++) out.push(V(-0.12 - 0.015 * Math.sin(i * 1.3), yBot + ((yTop - yBot) * i) / n, -0.28))
    return out
  }
  const toAorta = (yEnd) => [H.clone(), V(0.16, 1.7, -0.12), ...aortaPts(1.5, yEnd)]
  const backToHeart = (yFrom) => [...ivcPts(yFrom, 1.5), V(-0.04, 1.75, -0.1), H.clone()]
  const mkCurve = (pts) => new THREE.CatmullRomCurve3(pts, false, 'centripetal')
  const leg = (curve) => ({ curve, len: curve.getLength() })

  // 路線（粒子沿著走）
  const routes = []
  const addRoute = (name, legs, extra = {}) => {
    const r = { name, legs: legs.map((c) => leg(c)), dwell: 0, kill: null, anchor: null, ...extra }
    routes.push(r)
    return routes.length - 1
  }
  const mirrorX = (pts) => pts.map((p) => V(-p.x, p.y, p.z))

  const headPts = [H.clone(), V(0.17, 2.2, 0.0), V(0.2, 2.7, 0.04), V(0.2, 3.2, 0.1), V(0.0, 3.5, 0.08), V(-0.2, 3.2, 0.1), V(-0.2, 2.7, 0.04), V(-0.16, 2.2, 0.0), V(-0.02, 1.98, 0.05), H.clone()]
  const armPts = [H.clone(), V(0.55, 2.2, 0), V(0.98, 2.28, 0), V(1.2, 1.9, 0), V(1.27, 1.45, 0), V(1.4, 0.95, 0), V(1.52, 0.35, 0), V(1.58, -0.3, 0), V(1.47, -0.32, 0), V(1.4, 0.3, 0), V(1.27, 0.95, 0), V(1.14, 1.5, 0), V(1.02, 1.95, 0), V(0.7, 2.06, 0), V(0.4, 2.02, 0.02), H.clone()]
  const legPts = (s) => [...toAorta(-0.7), V(s * 0.2, -0.9, -0.22), V(s * 0.42, -1.3, -0.12), V(s * 0.5, -1.9, -0.06), V(s * 0.53, -2.5, 0), V(s * 0.42, -2.5, 0), V(s * 0.38, -1.9, -0.06), V(s * 0.3, -1.3, -0.12), V(s * 0.0, -0.85, -0.26), ...backToHeart(-0.7)]
  const liverA = [...toAorta(1.4), V(0.0, 1.38, -0.2), V(-0.18, 1.33, -0.08), P.liver.clone().add(V(0.02, 0.0, 0))]
  const liverB = [P.liver.clone(), V(-0.44, 1.5, -0.08), V(-0.24, 1.7, -0.1), V(-0.03, 1.78, -0.02), H.clone()]
  const kidA = (s, K) => [...toAorta(0.86), V(s * 0.08, 0.8, -0.28), V(s * 0.3, 0.72, -0.28), V(s * 0.5, 0.63, -0.27), K.clone()]
  const kidB = (s, K) => [K.clone(), V(s * 0.46, 0.46, -0.27), V(s * 0.22, 0.42, -0.28), V(-0.12, 0.7, -0.28), ...ivcPts(0.9, 1.5), V(-0.04, 1.75, -0.1), H.clone()]
  const ureter = (s, K) => [K.clone(), V(s * 0.62, 0.14, -0.2), V(s * 0.48, -0.34, -0.12), V(s * 0.24, -0.76, -0.02), P.bladder.clone()]

  const R = {}
  R.head = addRoute('head', [mkCurve(headPts)])
  R.armR = addRoute('armR', [mkCurve(armPts)]) // 畫面右手臂（含目標組織）
  R.armL = addRoute('armL', [mkCurve(mirrorX(armPts))])
  R.legR = addRoute('legR', [mkCurve(legPts(1))])
  R.legL = addRoute('legL', [mkCurve(legPts(-1))])
  R.liverPass = addRoute('liverPass', [mkCurve(liverA), mkCurve(liverB)])
  R.kidPassL = addRoute('kidPassL', [mkCurve(kidA(-1, P.kidneyR)), mkCurve(kidB(-1, P.kidneyR))])
  R.kidPassR = addRoute('kidPassR', [mkCurve(kidA(1, P.kidneyL)), mkCurve(kidB(1, P.kidneyL))])
  R.killLiver = addRoute('killLiver', [mkCurve(liverA), mkCurve(liverB)], { dwell: 0.55, kill: 'liver', anchor: P.liver.clone() })
  R.killKidL = addRoute('killKidL', [mkCurve(kidA(-1, P.kidneyR)), mkCurve(ureter(-1, P.kidneyR))], { dwell: 0.4, kill: 'kidney', anchor: P.kidneyR.clone() })
  R.killKidR = addRoute('killKidR', [mkCurve(kidA(1, P.kidneyL)), mkCurve(ureter(1, P.kidneyL))], { dwell: 0.4, kill: 'kidney', anchor: P.kidneyL.clone() })
  // 肝臟出口 → 心臟（口服吸收後進入全身循環的第一段）
  R.entryOral = addRoute('entryOral', [mkCurve([P.liver.clone(), V(-0.42, 1.5, -0.1), V(-0.2, 1.7, -0.06), V(0.02, 1.82, 0.0), H.clone()])])
  const tissueRoutes = [
    [R.head, 0.15],
    [R.armR, 0.27],
    [R.armL, 0.1],
    [R.legR, 0.17],
    [R.legL, 0.15],
    [R.liverPass, 0.08],
    [R.kidPassL, 0.04],
    [R.kidPassR, 0.04],
  ]

  // 靜脈點滴路線（手臂靜脈 → 上腔靜脈 → 心臟）
  const ivCurve = mkCurve([P.ivSite.clone(), V(-1.5, 0.3, 0), V(-1.4, 0.95, 0), V(-1.24, 1.5, 0), V(-1.05, 1.98, 0), V(-0.62, 2.12, 0), V(-0.24, 2.06, 0.02), H.clone()])

  // 裝飾血管
  tube(aortaPts(1.7, -0.7), 0.06)
  tube([...ivcPts(-0.7, 1.5), V(-0.04, 1.75, -0.1), H.clone()], 0.055)
  for (const s of [-1, 1]) {
    tube([V(0.12, -0.7, -0.28), V(s * 0.3, -1.05, -0.2), V(s * 0.42, -1.3, -0.12), V(s * 0.5, -1.9, -0.06), V(s * 0.53, -2.5, 0)], 0.04)
    tube([V(s * 0.42, -2.5, 0), V(s * 0.38, -1.9, -0.06), V(s * 0.3, -1.3, -0.12), V(0.0, -0.85, -0.26), V(-0.12, -0.7, -0.28)], 0.035)
  }
  tube(mkCurve(headPts), 0.03)
  tube(mkCurve(armPts), 0.028)
  tube(mkCurve(mirrorX(armPts)), 0.028)
  tube(mkCurve(liverA), 0.03)
  tube(mkCurve(liverB), 0.03)
  for (const [s, K] of [[-1, P.kidneyR], [1, P.kidneyL]]) {
    tube(mkCurve(kidA(s, K).slice(-5)), 0.03)
    tube(mkCurve(kidB(s, K).slice(0, 4)), 0.03)
    tube(mkCurve(ureter(s, K)), 0.024, new THREE.MeshBasicMaterial({ color: 0xe6cf7a, transparent: true, opacity: 0.5, depthWrite: false }))
  }

  // 門靜脈與腸繫膜分支
  const portalPts = [P.root.clone(), V(-0.02, 0.55, -0.1), V(-0.12, 0.9, -0.05), V(-0.24, 1.12, 0.0), P.liver.clone()]
  const portalCurve = mkCurve(portalPts)
  const portalMesh = tube(portalCurve, 0.05, portalMat, 60)
  const portalGlow = new THREE.Mesh(new THREE.TubeGeometry(portalCurve, 60, 0.075, 10, false), new THREE.MeshBasicMaterial({ color: 0xff8fa8, transparent: true, opacity: 0, depthWrite: false, depthTest: false }))
  portalGlow.renderOrder = 5
  portalGlow.visible = false
  root.add(portalGlow)
  const liverFlash = util.makeGlow(0xd6e4ff, 1.6, 0)
  liverFlash.position.copy(P.liver)
  liverFlash.renderOrder = 5
  root.add(liverFlash)
  const NB = 9
  const branchS = []
  const branches = []
  for (let k = 0; k < NB; k++) {
    const s = 0.1 + (0.8 * k) / (NB - 1)
    branchS.push(s)
    const p0 = smallCurve.getPointAt(s)
    const ctrl = p0.clone().lerp(P.root, 0.5)
    ctrl.z = -0.16
    const bez = new THREE.QuadraticBezierCurve3(p0, ctrl, P.root.clone())
    branches.push({ p0, ctrl, bez })
    tube(bez, 0.016, branchMat, 20)
  }

  // ───────── 目標組織（示意） ─────────
  const targetPick = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), new THREE.MeshBasicMaterial({ visible: false }))
  targetPick.position.copy(P.target)
  targetPick.userData.organ = 'target'
  root.add(targetPick)
  const targetGlow = util.makeGlow(C.green, 1.4, 0.0)
  targetGlow.position.copy(P.target)
  targetGlow.renderOrder = 4
  root.add(targetGlow)
  const targetCore = new THREE.Mesh(new THREE.SphereGeometry(0.17, 20, 14), new THREE.MeshBasicMaterial({ color: C.green, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }))
  targetCore.position.copy(P.target)
  targetCore.renderOrder = 4
  root.add(targetCore)

  // 環形光圈貼圖（基因步驟與目標組織用）
  const ringTex = (() => {
    const c = document.createElement('canvas')
    c.width = c.height = 128
    const g = c.getContext('2d')
    const grd = g.createRadialGradient(64, 64, 30, 64, 64, 62)
    grd.addColorStop(0, 'rgba(255,255,255,0)')
    grd.addColorStop(0.5, 'rgba(255,255,255,0)')
    grd.addColorStop(0.58, 'rgba(255,255,255,1)')
    grd.addColorStop(0.86, 'rgba(255,255,255,1)')
    grd.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grd
    g.fillRect(0, 0, 128, 128)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })()
  const makeRing = (color, size) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, color, transparent: true, opacity: 0, depthWrite: false, depthTest: false }))
    s.scale.setScalar(size)
    s.renderOrder = 6
    root.add(s)
    return s
  }

  // 靜脈點滴袋（只在靜脈模式顯示）
  const ivGroup = new THREE.Group()
  {
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.78, 0.12), new THREE.MeshStandardMaterial({ color: 0x7fb8ff, emissive: 0x4a88ff, emissiveIntensity: 0.45, transparent: true, opacity: 0.6, roughness: 0.3 }))
    bag.position.set(-2.05, 1.7, 0.05)
    const fluid = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.52, 0.13), new THREE.MeshBasicMaterial({ color: C.drug, transparent: true, opacity: 0.8 }))
    fluid.position.set(-2.05, 1.6, 0.05)
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), new THREE.MeshBasicMaterial({ color: 0xb8c4e8 }))
    hook.position.set(-2.05, 2.3, 0.05)
    const line = tube(mkCurve([V(-2.05, 1.3, 0.05), V(-2.0, 0.6, 0.05), V(-1.85, 0.0, 0.03), P.ivSite.clone()]), 0.018, new THREE.MeshBasicMaterial({ color: 0xcfe0ff, transparent: true, opacity: 0.75 }), 30)
    vessels.remove(line)
    ivGroup.add(bag, fluid, hook, line)
  }
  ivGroup.visible = false
  root.add(ivGroup)

  const pickables = [...organList, targetPick]

  const tmpC = new THREE.Color()
  const PORTAL_HOT = new THREE.Color(0xffd0da)
  let tShow = 1
  let portalHl = 0
  const DIM_TINT = new THREE.Color(0x24407f)
  const api = {
    root,
    P,
    organs,
    routes,
    R,
    tissueRoutes,
    smallCurve,
    portalCurve,
    branches,
    branchS,
    NB,
    ivCurve,
    esoCurve,
    stomachRot: STOMACH_ROT,
    stomachR: STOMACH_R,
    pickables,
    bodyMat,
    ivGroup,
    targetGlow,
    targetCore,
    makeRing,
    portalMesh,
    /** 每幀：焦點高亮、心跳、目標組織光暈、膀胱水位 */
    update(dt, tau, s) {
      const m = ctx.motion
      // 掃描光（全息感）
      bodyMat.uniforms.uScan.value = 3.9 - ((tau * 0.42 * m) % 7.0)
      bodyMat.uniforms.uAlert.value = util.damp(bodyMat.uniforms.uAlert.value, s.alert, 3, dt)
      bodyMat.uniforms.uGlow.value = util.damp(bodyMat.uniforms.uGlow.value, s.bodyGlow || 0, 3, dt)
      // 器官高亮與淡化
      for (const o of organList) {
        const key = o.userData.organ
        const want = s.focus[key] || 0
        o.userData.hl = util.damp(o.userData.hl, want, 6, dt)
        let pulse = 0
        if (key === 'liver') pulse = s.liverPulse * 0.9
        if (key === 'kidneyL' || key === 'kidneyR') pulse = s.kidPulse * 0.9
        const dim = s.dimOthers && !s.focus[key]
        // 淡化 = 往背景的藍黑色調靠近（而不是變成灰色的鬼影）
        o.userData.dimK = util.damp(o.userData.dimK, dim ? 1 : 0, 5, dt)
        const dk = o.userData.dimK
        const op = key === 'colon' ? 0.72 : 0.9
        o.material.opacity = op - dk * (op - 0.34)
        o.material.color.lerpColors(o.userData.colBase, DIM_TINT, 0.6 * dk)
        o.material.emissive.copy(o.material.color)
        o.material.emissiveIntensity = (o.userData.ebase + o.userData.hl * (0.55 + 0.25 * Math.sin(tau * 4 * m)) + pulse) * (1 - 0.55 * dk)
      }
      // 心跳
      const ph = (tau * 1.15 * m) % 1
      const beat = Math.pow(Math.max(0, Math.sin(ph * Math.PI * 2)), 8) * 0.1 * (m > 0.5 ? 1 : 0.3)
      heart.scale.set(0.3 * (1 + beat), 0.34 * (1 + beat), 0.26 * (1 + beat))
      // 膀胱水位：顏色與大小
      const bl = s.bladder
      bladder.scale.set(0.24 * (0.85 + 0.35 * bl), 0.2 * (0.85 + 0.35 * bl), 0.2 * (0.85 + 0.35 * bl))
      bladder.material.emissiveIntensity = 0.16 + 0.55 * bl + s.focus.bladder * 0.3
      // 目標組織
      const lvl = s.targetLevel // 0..1.3
      const col = s.zone === 'high' ? C.red : s.zone === 'ok' ? C.green : 0x6f86c8
      tmpC.setHex(col)
      targetGlow.material.color.lerp(tmpC, 0.15)
      targetCore.material.color.lerp(tmpC, 0.15)
      const pulse = 1 + 0.12 * Math.sin(tau * 3.2 * m)
      tShow = util.damp(tShow, s.targetShow === undefined ? 1 : s.targetShow, 5, dt)
      targetGlow.material.opacity = Math.min(0.7, 0.1 + 0.45 * lvl) * (0.85 + 0.15 * pulse) * tShow
      targetGlow.scale.setScalar((0.9 + 0.8 * lvl) * pulse)
      targetCore.material.opacity = Math.min(0.5, 0.05 + 0.32 * lvl) * tShow
      // 門靜脈：第一站說明時發亮
      portalHl = util.damp(portalHl, s.portalHl || 0, 6, dt)
      portalGlow.visible = portalHl > 0.02
      portalGlow.material.opacity = portalHl * (0.5 + 0.2 * Math.sin(tau * 4.5 * m))
      portalMat.color.setHex(0xff7a8f).lerp(PORTAL_HOT, portalHl)
      portalMat.opacity = 0.6 + 0.4 * portalHl
      // 肝臟轉換閃光
      liverFlash.material.opacity = Math.min(0.85, s.liverPulse * 1.0)
      liverFlash.scale.setScalar(1.6 + 0.9 * s.liverPulse)
    },
  }
  return api
}
