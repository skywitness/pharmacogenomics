// ch03「基因型實驗室」：一對同源染色體 → 兩個等位基因 → 酵素量 → 預測表現型；以及「遺傳」龐尼特方格。
// 事實來源：research/molecular-basics.verified.json（CYP2C19 雙倍型表 #30、CYP2C9 活性分數 #31、*2/*3/*17 機制 #21/#23/#24）。
// 酵素分子的數量是教學示意；親代雙倍型是假設的例子。
import { createLab, LAB_BOX } from './ch03/lab.js'
import { createPunnett, PUN_BOX } from './ch03/punnett.js'
import { GENES, FN, PH, CHROM_COL, css, phenotypeOf, dipLabel, allDiplotypes, enzymeCounts } from './ch03/data.js'

export const options = {
  fov: 26,
  camera: [0, 0.3, 22],
  target: [0, 0, 0],
  zoom: false,
  minAzimuthAngle: -0.3,
  maxAzimuthAngle: 0.3,
  minPolarAngle: 1.4,
  maxPolarAngle: 1.72,
  exposure: 1.05,
  envIntensity: 0.55,
}

// 每個步驟的場景狀態（step 0 = 初始畫面）。vis = [晶片，細胞酵素，量表] 的顯示程度；使用者一動手就全部亮起。
const STEP_DEF = [
  { gene: 'CYP2C19', al: ['*1', '*2'], vis: [0.65, 0.2, 0], variant: false, hover: null },
  { gene: 'CYP2C19', al: ['*1', '*2'], vis: [1, 0.2, 0], variant: false, hover: 'both' },
  { gene: 'CYP2C19', al: ['*1', '*2'], vis: [1, 0.2, 0], variant: true, hover: null, still: 0, demo: [['*1', '*2'], ['*1', '*3'], ['*1', '*17']] },
  { gene: 'CYP2C19', vis: [1, 1, 0], variant: true, demo: [['*1', '*1'], ['*1', '*2'], ['*2', '*2'], ['*17', '*17']] },
  { gene: 'CYP2C19', vis: [1, 1, 1], variant: true, demo: [['*1', '*1'], ['*1', '*17'], ['*17', '*17'], ['*1', '*2'], ['*2', '*2']] },
  { gene: 'CYP2C9', vis: [1, 1, 1], variant: true, demo: [['*1', '*1'], ['*1', '*2'], ['*2', '*2'], ['*1', '*3'], ['*2', '*3'], ['*3', '*3']] },
  { gene: 'CYP2C19', vis: [1, 1, 1], inherit: true, parents: { mom: ['*1', '*2'], dad: ['*1', '*2'] } },
]

export default function create(ctx) {
  const { THREE, util, scene, ui, hud, camera } = ctx
  util.addStudioLights(scene, { intensity: 1 })
  const dust = util.createParticles({ count: 240, spread: [18, 11, 6], size: 0.07, color: 0x8fb4ff, opacity: 0.55, seed: 9 })
  dust.position.set(0, -0.2, -3.2)
  scene.add(dust)

  const lab = createLab(ctx)
  const punnett = createPunnett(ctx)
  scene.add(lab.root, punnett.root)

  // ───────── 狀態 ─────────
  const S = {
    gene: 'CYP2C19',
    al: { CYP2C19: ['*1', '*2'], CYP2C9: ['*1', '*3'] },
    parents: { CYP2C19: { mom: ['*1', '*2'], dad: ['*1', '*2'] }, CYP2C9: { mom: ['*1', '*2'], dad: ['*1', '*2'] } },
    inherit: false,
    step: 0,
    variant: false,
    touched: false,
    demo: null,
    demoI: 0,
    demoT: 0,
  }

  // ───────── 取景：依舞台實際大小，讓內容外框落在「上方徽章列」與「下方說明」之間 ─────────
  const V = (x, y, z) => new THREE.Vector3(x, y, z)
  const tmpC = new THREE.Vector3()
  let lastWall = 0
  const AZ = 0
  const EL = 0.05
  function frameFor(box) {
    const W = ctx.size.w || 600
    const H = ctx.size.h || 450
    const narrow = W < 480
    lab.setNarrow(narrow)
    const top = narrow ? 44 : 60
    const bottom = narrow ? 118 : 122
    const s = Math.max(12, Math.min((W - 20) / box.w, (H - top - bottom) / box.h))
    const vf = THREE.MathUtils.degToRad(camera.fov)
    const d = H / s / (2 * Math.tan(vf / 2))
    const hf = 2 * Math.atan(Math.tan(vf / 2) * (W / H))
    return { x: box.cx, y: box.cy + (top - bottom) / 2 / s, r: d * Math.sin(Math.min(vf, hf) / 2) }
  }
  const boxNow = () => (S.inherit ? PUN_BOX : LAB_BOX)
  let fc = frameFor(LAB_BOX)
  let ft = fc
  ctx.setFrame(V(fc.x, fc.y, 0), fc.r, { azimuth: AZ, elevation: EL, padding: 1 })

  // ───────── 控制項 ─────────
  const optsFor = (geneKey) =>
    GENES[geneKey].order.map((id) => {
      const al = GENES[geneKey].alleles[id]
      return { value: id, label: `${id} ${FN[al.fn].short}`, color: FN[al.fn].color, title: `${id}：${FN[al.fn].zh}（${al.variant}）` }
    })

  const segGene = ui.segmented({
    label: '選一個基因',
    options: [
      { value: 'CYP2C19', label: 'CYP2C19 分級', title: 'CYP2C19：依等位基因功能分級' },
      { value: 'CYP2C9', label: 'CYP2C9 分數', title: 'CYP2C9：活性分數相加' },
    ],
    value: S.gene,
    onChange: (v) => {
      touch()
      S.gene = v
      if (S.inherit) punnett.set({ gene: v, ...S.parents[v] })
      sync()
    },
  })
  const tglInherit = ui.toggle({
    label: '遺傳模式：看父母的等位基因怎麼傳給孩子',
    value: false,
    onChange: (v) => {
      touch()
      setInherit(v)
    },
  })

  const btns = ui.buttons([
    {
      label: '生一位孩子（隨機抽）',
      kind: 'primary',
      onClick: () => {
        touch()
        punnett.draw()
        sync()
      },
    },
    {
      label: '清除抽樣',
      kind: 'ghost',
      onClick: () => {
        punnett.resetTally()
        punnett.select(null)
        sync()
      },
    },
  ])
  const labCtl = {}
  const inhCtl = {}
  for (const key of ['CYP2C19', 'CYP2C9']) {
    const g = ui.group('兩個等位基因（也可點 3D 染色體）')
    // 讓兩個等位基因選單並排、占滿整列，控制面板比較矮
    Object.assign(g.root.style, { gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px 18px' })
    const gt = g.root.querySelector('.ctl-group-title')
    if (gt) gt.style.gridColumn = '1 / -1'
    labCtl[key] = {
      g,
      mom: g.segmented({
        label: '來自母親的等位基因（粉紅）',
        options: optsFor(key),
        value: S.al[key][0],
        onChange: (v) => {
          touch()
          S.al[key][0] = v
          sync()
        },
      }),
      dad: g.segmented({
        label: '來自父親的等位基因（藍）',
        options: optsFor(key),
        value: S.al[key][1],
        onChange: (v) => {
          touch()
          S.al[key][1] = v
          sync()
        },
      }),
    }
    const opts = allDiplotypes(key).map(([a, b]) => ({ value: `${a}|${b}`, label: `${a}/${b} · ${PH[phenotypeOf(key, a, b).key].short}` }))
    const gi = ui.group('兩位親代（假設的例子）')
    inhCtl[key] = {
      g: gi,
      mom: gi.select({
        label: '母親的雙倍型',
        options: opts,
        value: S.parents[key].mom.join('|'),
        onChange: (v) => {
          touch()
          S.parents[key].mom = v.split('|')
          punnett.set({ gene: key, ...S.parents[key] })
          sync()
        },
      }),
      dad: gi.select({
        label: '父親的雙倍型',
        options: opts,
        value: S.parents[key].dad.join('|'),
        onChange: (v) => {
          touch()
          S.parents[key].dad = v.split('|')
          punnett.set({ gene: key, ...S.parents[key] })
          sync()
        },
      }),
    }
  }
  const roMain = ui.readout({ label: '雙倍型 → 預測表現型（依 CPIC 查表）', value: '' })
  const roLabel = roMain.el.querySelector('.readout-label')
  const roValue = roMain.el.querySelector('.readout-value')
  // 讀數只給螢幕閱讀器（視覺上已有徽章、量表與說明文字），避免控制面板過高
  Object.assign(roMain.el.style, { position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', clipPath: 'inset(50%)', whiteSpace: 'nowrap' })

  // ───────── 狀態同步 ─────────
  function touch() {
    S.touched = true
    S.demo = null
  }

  function updateLegend() {
    // 遺傳模式的晶片自己就標示卵子/精子，不需要圖例
    if (S.inherit) return hud.legend([])
    const list = S.gene === 'CYP2C19' ? ['normal', 'none', 'increased'] : ['normal', 'decreased', 'none']
    hud.legend(list.map((k) => ({ color: FN[k].color, label: FN[k].zh })))
  }

  function captionText() {
    const [a, b] = S.al[S.gene]
    const gene = GENES[S.gene]
    const dip = dipLabel(a, b)
    const ph = phenotypeOf(S.gene, a, b)
    if (S.inherit) {
      const p = S.parents[S.gene]
      const sel = punnett.selected
      if (sel) {
        const k = punnett.kids[sel.r][sel.c]
        return `這位孩子：母源 ${k.a} + 父源 ${k.b} = ${k.dip} → ${PH[k.ph.key].zh}（這個組合機率 25%）。${punnett.tallyText()}`
      }
      return `母 ${dipLabel(...p.mom)} × 父 ${dipLabel(...p.dad)} → 孩子：${punnett.summary()}。點方格看每位孩子。`
    }
    if (!S.touched && S.step <= 2) {
      if (S.step === 0) return '你的 CYP2C19 有幾份？兩份：母親給一份、父親給一份。點染色體可換版本。'
      if (S.step === 1) return `同一個基因座的兩個版本就是兩個等位基因：母源 ${a}、父源 ${b}，合稱雙倍型 ${dip}。`
      const pick = gene.alleles[a].id !== '*1' ? gene.alleles[a] : gene.alleles[b]
      return `星號只是編號，背後是具體的 DNA 差異：${pick.id} = ${pick.variant}（${pick.how}）。`
    }
    if (S.step === 3 && !S.touched) {
      const ca = enzymeCounts(S.gene, a)
      const cb = enzymeCounts(S.gene, b)
      return `${dip}：有功能的酵素（藍）${ca.working + cb.working} 個、無功能殘片（灰）${ca.broken + cb.broken} 個。數量為示意${gene.alleles[a].fn === 'increased' || gene.alleles[b].fn === 'increased' ? '（「增加」只是多畫幾個，不是活性值）' : ''}。`
    }
    const why = gene.kind === 'score' ? `活性分數 ${ph.parts}` : ph.parts
    return `${dip}：${why} → 預測為${PH[ph.key].zh}（${ph.key}）。`
  }

  function applyVis() {
    const def = STEP_DEF[Math.min(S.step, STEP_DEF.length - 1)]
    const v = S.touched || S.inherit ? [1, 1, 1] : def.vis
    lab.setVis({ chip: v[0], cell: v[1], meter: v[2] })
  }

  function sync() {
    const [a, b] = S.al[S.gene]
    const ph = phenotypeOf(S.gene, a, b)
    segGene.set(S.gene)
    tglInherit.set(S.inherit)
    for (const key of ['CYP2C19', 'CYP2C9']) {
      const show = key === S.gene
      labCtl[key].g.root.style.display = !show || S.inherit ? 'none' : 'grid'
      inhCtl[key].g.root.hidden = !show || !S.inherit
      labCtl[key].mom.set(S.al[key][0])
      labCtl[key].dad.set(S.al[key][1])
      inhCtl[key].mom.set(S.parents[key].mom.join('|'))
      inhCtl[key].dad.set(S.parents[key].dad.join('|'))
    }
    btns.el.hidden = !S.inherit
    // 自動示範時關閉 aria-live，避免螢幕閱讀器被連續播報
    roValue.setAttribute('aria-live', S.demo ? 'off' : 'polite')

    lab.set({ gene: S.gene, a, b, showVariant: S.variant })
    applyVis()

    if (S.inherit) {
      const sel = punnett.selected
      if (sel) {
        const k = punnett.kids[sel.r][sel.c]
        roLabel.textContent = '你點選的孩子'
        roMain.set(`${k.dip} → ${PH[k.ph.key].zh}`)
        roMain.setColor(css(PH[k.ph.key].color))
      } else {
        roLabel.textContent = '子代表現型機率（每位孩子各自獨立）'
        roMain.set(punnett.summary())
        roMain.setColor('')
      }
    } else {
      roLabel.textContent = '雙倍型 → 預測表現型（依 CPIC 查表）'
      roMain.set(`${dipLabel(a, b)} → ${PH[ph.key].zh}（${ph.key}）`)
      roMain.setColor(css(PH[ph.key].color))
    }
    const hint = !S.touched && !S.inherit && S.step <= 1
    lab.setCue(hint)
    lab.setLocusLabel(hint)
    hud.badge(S.inherit ? `${S.gene} · 遺傳` : `${S.gene} ${dipLabel(a, b)}`)
    updateLegend()
    hud.caption(captionText())
  }

  function setInherit(v) {
    S.inherit = v
    if (v) {
      punnett.set({ gene: S.gene, ...S.parents[S.gene] })
      punnett.show(true)
      lab.root.visible = false
    } else {
      punnett.show(false)
      lab.root.visible = true
    }
    ft = frameFor(boxNow())
    sync()
  }

  // ───────── 步驟 ─────────
  function applyStep(i) {
    // 同一步驟重複回報（例如版面改變）時，不要洗掉使用者已做的選擇
    if (i === S.step && S.touched) return
    const def = STEP_DEF[Math.min(i, STEP_DEF.length - 1)]
    S.step = i
    S.touched = false
    S.gene = def.gene
    S.variant = !!def.variant
    if (def.al) S.al[def.gene] = [...def.al]
    if (def.parents) S.parents[def.gene] = { mom: [...def.parents.mom], dad: [...def.parents.dad] }
    lab.setHover(def.hover || null)
    if (def.demo && !ctx.reducedMotion) {
      S.demo = def.demo
      S.demoI = 0
      S.demoT = 0
      S.al[def.gene] = [...def.demo[0]]
    } else {
      S.demo = null
      if (def.demo) S.al[def.gene] = [...def.demo[def.still ?? (def.demo.length > 3 ? 3 : 1)]]
    }
    if (!!def.inherit !== S.inherit) setInherit(!!def.inherit)
    else if (def.inherit) punnett.set({ gene: S.gene, ...S.parents[S.gene] })
    if (!def.inherit) punnett.select(null)
    sync()
  }

  // ───────── 指標互動 ─────────
  const sideName = { mom: '母親', dad: '父親' }
  const off = ctx.onPointer((type, e, ptr) => {
    if (type === 'leave' || type === 'cancel') {
      lab.setHover(S.step === 1 && !S.touched ? 'both' : null)
      hud.tip(null)
      ctx.setCursor('')
      return
    }
    if (type !== 'move' && type !== 'click') return
    if (S.inherit) {
      const hit = ctx.pick(punnett.cards, false)[0]
      if (type === 'move') ctx.setCursor(hit ? 'pointer' : '')
      if (type === 'click' && hit) {
        touch()
        punnett.select(hit.object.userData.r, hit.object.userData.c)
        sync()
      }
      return
    }
    const hit = ctx.pick(lab.hits, false)[0]
    const side = hit ? hit.object.userData.side : null
    if (type === 'move') {
      lab.setHover(side || (S.step === 1 && !S.touched ? 'both' : null))
      ctx.setCursor(side ? 'pointer' : '')
      if (side) {
        const gene = GENES[S.gene]
        const id = S.al[S.gene][side === 'mom' ? 0 : 1]
        const al = gene.alleles[id]
        hud.tip(`<b>${sideName[side]}給的 ${id}</b><br>${FN[al.fn].zh}：${al.how}<br><small>點一下換下一個等位基因</small>`)
      } else hud.tip(null)
    } else if (type === 'click' && side) {
      touch()
      const order = GENES[S.gene].order
      const idx = side === 'mom' ? 0 : 1
      const cur = S.al[S.gene][idx]
      S.al[S.gene][idx] = order[(order.indexOf(cur) + 1) % order.length]
      sync()
    }
  })

  // ───────── 首次同步 ─────────
  applyStep(0)
  lab.snapVis()

  return {
    onStep(i) {
      applyStep(i)
    },
    onResize() {
      fc = ft = frameFor(boxNow())
      ctx.setFrame(V(fc.x, fc.y, 0), fc.r, { padding: 1 })
      updateLegend()
    },
    onResetView() {
      fc = ft = frameFor(boxNow())
      ctx.setFrame(V(fc.x, fc.y, 0), fc.r, { azimuth: AZ, elevation: EL, padding: 1 })
    },
    update(dt, t) {
      // 暫停時 Stage 傳 dt = 0，但使用者觸發的轉場（龐尼特方格進場、淡入、取景）仍要能播完；
      // 環境動態用 t（暫停時凍結），自動示範計時仍用真正的 dt，所以暫停時示範不會前進。
      const now = performance.now()
      const wall = Math.min(0.05, (now - (lastWall || now)) / 1000)
      lastWall = now
      const d = dt > 0 ? dt : ctx.paused ? wall : 0
      // 取景動畫（只在有差距時呼叫 setFrame）
      const dx = ft.x - fc.x
      const dy = ft.y - fc.y
      const dr = ft.r - fc.r
      if (Math.abs(dx) + Math.abs(dy) + Math.abs(dr) > 0.002) {
        fc = { x: util.damp(fc.x, ft.x, 3.2, d), y: util.damp(fc.y, ft.y, 3.2, d), r: util.damp(fc.r, ft.r, 3.2, d) }
        ctx.setFrame(tmpC.set(fc.x, fc.y, 0), fc.r, { padding: 1 })
      }
      // 自動示範（使用者一操作就停止）
      if (S.demo && !S.inherit) {
        S.demoT += dt
        if (S.demoT > 2.8) {
          S.demoT = 0
          S.demoI = (S.demoI + 1) % S.demo.length
          S.al[S.gene] = [...S.demo[S.demoI]]
          sync()
        }
      }
      dust.rotation.y = t * 0.01 * ctx.motion
      lab.update(d, t)
      punnett.update(d, t)
    },
    dispose() {
      off()
      lab.dispose()
      punnett.dispose()
    },
  }
}
