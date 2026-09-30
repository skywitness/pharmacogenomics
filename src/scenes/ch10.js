// ch10 場景「前沿導覽」：同一個舞台、三個主題
//   ① 腫瘤標靶（體細胞突變 · EGFR）  ② GWAS 曼哈頓景觀（多基因）  ③ AI 與資料（網路、預測的限制、族群多樣性、在地資料庫）
// 畫面上的增殖高低、曼哈頓圖效應量、AI 散布圖皆為教學「示意」，真實數字僅出現在圖說與正文並附來源。
import { createTumor } from './ch10/tumor.js'
import { createGwas } from './ch10/gwas.js'
import { createAI } from './ch10/ai.js'
import { createLabelKit } from './ch10/labels.js'
import { TRAITS, GW_THRESHOLD } from './ch10/data.js'

export const options = { fov: 42, camera: [0, 0, 12], target: [0, 0, 0], exposure: 1.05, envIntensity: 0.6, minPolarAngle: 0.5, maxPolarAngle: 2.05, minAzimuthAngle: -0.75, maxAzimuthAngle: 0.75 }

// 各視角的取景：c 中心、hw/hh 需完整入鏡的半寬/半高、az/el 預設視角
const FR = {
  cells: { c: [0, -0.18, 0], hw: 4.5, hh: 2.95, az: 0.12, el: 0.1 },
  rec: { c: [1.45, 0.05, 0], hw: 4.6, hh: 3.1, az: 0.12, el: 0.12 },
  gwas: { c: [-0.7, 2.8, 0], hw: 6.4, hh: 3.5, az: 0.3, el: 0.36 },
  network: { c: [0, 0, 0], hw: 5.2, hh: 2.75, az: 0.06, el: 0.06 },
  ai: { c: [0.05, 0.05, 0], hw: 3.95, hh: 2.4, az: 0.06, el: 0.05 },
  diversity: { c: [0, 0, 0], hw: 5.4, hh: 2.85, az: 0.1, el: 0.12 },
  biobank: { c: [0, -0.6, 0], hw: 5.1, hh: 2.45, az: 0.05, el: 0.05 },
}

const NARROW_W = 520 // 舞台寬度低於此值視為窄螢幕
const NARROW_BOOST = 1.4 // 窄螢幕時場景內文字標籤的放大倍率

// 樣本數滑桿的刻度是 0.01（log10）：所有 logN 一律先量化，滑桿顯示與圖說才會是同一個數字
const q2 = (v) => Math.round(v * 100) / 100
const LN = (k) => q2(Math.log10(TRAITS[k].n0))
const fmtN = (n) => (n >= 10000 ? Math.round(n / 1000) * 1000 : n >= 1000 ? Math.round(n / 100) * 100 : Math.round(n)).toLocaleString('en-US')

export default function create(ctx) {
  const { THREE, util, scene, camera, controls, ui, hud, palette } = ctx
  const C = palette.COLORS
  util.addStudioLights(scene, { intensity: 1 })
  const dust = util.createParticles({ count: 260, spread: [26, 14, 6], size: 0.07, color: 0x8fb4ff, opacity: 0.45, seed: 8 })
  dust.position.z = -5
  scene.add(dust)

  // 窄螢幕旗標只在建立與 onResize 時更新；不要在 sync() 等熱路徑讀 clientWidth（會強制 layout）
  let isNarrow = (ctx.size.w || 800) < NARROW_W
  const kit = createLabelKit(ctx)
  kit.setBoost(isNarrow ? NARROW_BOOST : 1)
  const tumor = createTumor(ctx, kit)
  const gwas = createGwas(ctx, kit)
  const ai = createAI(ctx, kit)
  scene.add(tumor.root, gwas.root, ai.root)

  // ── 狀態 ──
  const S = { theme: 'tumor', tview: 'cells', egfr: 'wt', drug: 'none', resist: false, trait: 'warfarin', logN: LN('warfarin'), aview: 'network', mismatch: true }
  const viewKey = () => (S.theme === 'tumor' ? S.tview : S.theme === 'gwas' ? 'gwas' : S.aview)
  let lastKey = null
  let anim = null
  let framedAspect = 0
  let framedH = 0
  let hinted = false // 讀者是否已經點過/滑過物件（之前圖說尾端會附一句操作提示）

  // ── 取景 ──（把畫面上方按鈕列、下方圖例+圖說所佔的空間扣掉，讓主體落在剩下的區域）
  const legendEl = ctx.el.querySelector('.hud-legend')
  const captionEl = ctx.el.querySelector('.hud-caption')
  function hudMetrics() {
    const H = ctx.view.clientHeight || 400
    const bottom = (legendEl && !legendEl.hidden ? legendEl.offsetHeight + 8 : 0) + (captionEl && !captionEl.hidden ? captionEl.offsetHeight + 4 : 0) + 6
    const top = 44
    const usable = util.clamp((H - top - bottom) / H, 0.4, 0.92)
    return { H, top, bottom, usable }
  }
  function frame(key, animate, withAngles = true) {
    const f = FR[key]
    const a = camera.aspect || 1.5
    const hm = hudMetrics()
    const r = Math.max(f.hh / hm.usable, f.hw / a)
    const pad = 1.06
    // 主體中心應落在「可用區」的中央，而不是舞台正中央
    const shiftPx = hm.H / 2 - (hm.top + (hm.H - hm.top - hm.bottom) / 2)
    const worldPerPx = (2 * r * pad * 1.04) / hm.H
    const center = new THREE.Vector3(f.c[0], f.c[1] - shiftPx * worldPerPx, f.c[2])
    const from = animate ? { p: camera.position.clone(), t: controls.target.clone() } : null
    ctx.setFrame(center, r, withAngles ? { azimuth: f.az, elevation: f.el, padding: pad } : { padding: pad })
    framedAspect = a
    framedH = hm.H
    if (from) {
      const to = { p: camera.position.clone(), t: controls.target.clone() }
      camera.position.copy(from.p)
      controls.target.copy(from.t)
      anim = { from, to, k: 0 }
    } else anim = null
  }

  // ── 控制項 ──
  // 版面原則（桌機控制面板高度有上限，主要控制項不能被擠到捲動區之下）：
  //   第一列 = 主題 + 該主題的「看什麼」；第二列起 = 該主題的細部控制。
  const themeSeg = ui.segmented({
    label: '主題',
    options: [
      { value: 'tumor', label: '① 腫瘤' },
      { value: 'gwas', label: '② GWAS' },
      { value: 'ai', label: '③ AI 與資料' },
    ],
    value: S.theme,
    onChange: (v) => go({ theme: v }),
  })
  const tviewSeg = ui.segmented({
    label: '觀察尺度',
    options: [
      { value: 'cells', label: '細胞' },
      { value: 'rec', label: '分子：EGFR' },
    ],
    value: S.tview,
    onChange: (v) => go({ tview: v }),
  })
  const traitSeg = ui.segmented({
    label: '要解釋的性狀',
    options: Object.entries(TRAITS).map(([k, v]) => ({ value: k, label: v.label })),
    value: S.trait,
    onChange: (v) => go({ trait: v, logN: LN(v) }),
  })
  const aviewSeg = ui.segmented({
    label: '看什麼',
    options: [
      { value: 'network', label: '知識網路' },
      { value: 'ai', label: 'AI 預測 vs 實驗' },
      { value: 'diversity', label: '資料多樣性' },
      { value: 'biobank', label: '在地資料庫' },
    ],
    value: S.aview,
    onChange: (v) => go({ aview: v }),
  })

  const gT = ui.group()
  const drugSeg = gT.segmented({
    label: '標靶藥（TKI）',
    options: [
      { value: 'none', label: '不用藥' },
      { value: 'gen1', label: '第一代' },
      { value: 't790m', label: '針對 T790M' },
    ],
    value: S.drug,
    onChange: (v) => go({ drug: v, tview: 'rec' }),
  })
  const egfrSeg = gT.segmented({
    label: '這顆腫瘤的 EGFR',
    options: [
      { value: 'wt', label: '野生型' },
      { value: 'mut', label: '活化突變型' },
    ],
    value: S.egfr,
    onChange: (v) => go({ egfr: v, tview: 'rec' }),
  })
  const resistTg = gT.toggle({
    label: '腫瘤演化：出現 T790M',
    value: S.resist,
    onChange: (v) => go({ resist: v, tview: 'rec' }),
  })
  const rdProlif = gT.readout({ label: '增殖訊號（示意）', value: '—' })

  const gW = ui.group()
  const nSlider = gW.slider({
    label: '研究樣本數 n（示意，對數刻度）',
    min: 2,
    max: 5.3,
    step: 0.01,
    value: S.logN,
    format: (v) => `約 ${fmtN(Math.pow(10, v))} 人`,
    // 拖曳時只走快速路徑（更新地形+數字），不重建圖例、不重設所有控制項
    onInput: (v) => {
      S.logN = v
      gwas.setLogN(v)
      numDirty = true
    },
  })
  const rdGwas = gW.readout({ label: '越過紅色門檻的山峰 · 浮現的基因', value: '—' })
  // 讀數與圖說在拖曳時每 0.3 秒才更新一次，避免螢幕閱讀器被 aria-live 洗版
  rdGwas.el.querySelector('.readout-value')?.setAttribute('aria-live', 'off')

  const gA = ui.group()
  const mismatchTg = gA.toggle({
    label: '標出預測與實驗不一致（示意）',
    value: S.mismatch,
    onChange: (v) => go({ mismatch: v }),
  })

  // ── 圖說 / 圖例 ──（窄螢幕改用短版，避免圖說吃掉大半個舞台）
  const pick = (long, short) => (isNarrow ? short : long)
  const LEG = {
    cells: [
      { color: C.blue, label: '生殖細胞變異' },
      { color: C.red, label: '體細胞突變（只在腫瘤）' },
    ],
    rec: [
      { color: C.cyan, label: '增殖訊號' },
      { color: 0xfff0b8, label: 'ATP' },
      { color: C.drug, label: '標靶藥 TKI' },
      { color: C.red, label: '體細胞突變' },
    ],
    gwas: [
      { color: 0xffc44d, label: '越過門檻' },
      { color: C.blue, label: '一般位點' },
      { color: C.red, label: '紅面 = 顯著門檻' },
    ],
    network: [
      { color: C.cyan, label: '基因' },
      { color: C.drug, label: '藥物' },
      { color: C.green, label: '療效/劑量' },
      { color: C.red, label: '不良反應' },
      { color: C.violet, label: '? AI 候選（示意）' },
    ],
    ai: [
      { color: C.enzyme, label: '預測與實驗一致' },
      { color: C.red, label: '不一致（示意）' },
    ],
    diversity: [
      { color: C.blue, label: '歐洲 88.18%' },
      { color: C.amber, label: '亞洲 6.17%' },
      { color: C.green, label: '非裔美/加勒比 2.75%' },
      { color: 0xb9c2dd, label: '其他/混合 1.33%' },
      { color: C.violet, label: '西語/拉丁 1.28%' },
      { color: C.magenta, label: '非洲 0.28%' },
    ],
    biobank: [
      { color: 0xff5c9e, label: 'TPMI' },
      { color: C.amber, label: '台灣人體生物資料庫' },
      { color: C.cyan, label: 'All of Us' },
      { color: C.violet, label: 'UK Biobank' },
    ],
  }
  // 窄螢幕的精簡圖例（cells 的圖說已用 ◆ ★ 說明顏色，省下高度給主體；biobank 的球體下方已有標籤）
  const LEGN = {
    cells: [],
    rec: [
      { color: C.cyan, label: '訊號' },
      { color: 0xfff0b8, label: 'ATP' },
      { color: C.drug, label: '藥物' },
      { color: C.red, label: '突變' },
    ],
    gwas: [
      { color: 0xffc44d, label: '越過門檻' },
      { color: C.red, label: '紅面 = 顯著門檻' },
    ],
    network: [], // 節點本身已標示名稱；紫色「？」由圖說說明
    diversity: [
      { color: C.blue, label: '歐洲 88.18%' },
      { color: C.amber, label: '亞洲 6.17%' },
      { color: C.magenta, label: '非洲 0.28%' },
    ],
  }
  const legendFor = (key) => (key === 'biobank' ? [] : isNarrow && LEGN[key] ? LEGN[key] : LEG[key])
  const BADGE = {
    cells: '① 腫瘤標靶 · 體細胞 vs 生殖細胞',
    rec: '① 腫瘤標靶 · EGFR 受體（示意）',
    gwas: '② GWAS 曼哈頓景觀（示意資料）',
    network: '③ AI 與資料 · 基因—藥物—結果',
    ai: '③ AI 與資料 · 預測 vs 實驗（示意）',
    diversity: '③ AI 與資料 · GWAS 參與者族群組成',
    biobank: '③ AI 與資料 · 在地大型資料庫',
  }
  const badgeText = (key) => (isNarrow ? BADGE[key].split(' · ')[0].replace(/[(（].*[)）]/, '') : BADGE[key])
  // 第一次讀到某個視角時，圖說尾端附一句操作提示；點過或滑過任何物件後就不再附
  const HINT = {
    cells: '點一下細胞看說明',
    rec: '點一下分子或口袋看說明',
    gwas: '點一下山峰看說明',
    network: '點一下節點看說明',
    ai: '點一下圓點看說明',
    diversity: '點一下方塊看說明',
    biobank: '點一下球體看說明',
  }
  const withHint = (key, text) => (hinted ? text : `${text} ▸ ${isNarrow ? '點物件看說明' : HINT[key]}`)

  function recCaption() {
    const mut = S.egfr === 'mut'
    const drugOn = S.drug !== 'none'
    const docks = drugOn && (!S.resist || S.drug === 't790m')
    if (!mut && !drugOn) return pick('野生型 EGFR 要等生長因子（粉紅）來敲門才會短暫啟動；這顆腫瘤的增殖主要靠「其他驅動途徑」維持。試試切成「活化突變型」。', '野生型要等生長因子（粉紅）敲門才短暫啟動；增殖靠其他途徑（示意）。')
    if (!mut && drugOn) return pick('野生型腫瘤：藥物占住了 EGFR，但腫瘤本來就不靠它增殖，增殖幾乎不受影響——這就是用藥前要先檢測腫瘤基因的原因。', '沒有突變：藥物占住 EGFR 也沒差，增殖幾乎不變——所以用藥前要先檢測。')
    if (mut && !drugOn) {
      if (S.resist) return pick('突變 EGFR 持續啟動；紅色守門員（T790M）已出現，但還沒用藥時看不出差別。加入標靶藥看看。', '守門員（T790M）已出現，但還沒用藥，看不出差別。')
      return pick('活化突變型 EGFR 不需要生長因子也持續「開機」，訊號（青色）不斷湧向細胞核，腫瘤細胞增殖。加入標靶藥看看。', '突變 EGFR 不需生長因子就持續開機，訊號（青色）湧向細胞核。')
    }
    if (docks) return S.resist ? pick('針對 T790M 設計的 TKI 仍能阻斷訊號，增殖再度下降（示意）。', '針對 T790M 的藥仍能阻斷訊號，增殖再度下降（示意）。') : pick('標靶藥占住 ATP 口袋，ATP 進不來，訊號中斷，增殖大幅下降。', '藥物占住 ATP 口袋，訊號中斷，增殖大幅下降。')
    return pick('腫瘤演化出 T790M：守門員讓激酶與 ATP 結合得更緊，與 ATP 競爭的第一代 TKI 效力大減，訊號恢復——這就是後天抗藥性（機轉示意）。', '守門員（T790M）讓 ATP 更容易勝出，第一代藥效力下降，訊號恢復。')
  }
  function gwasCaption() {
    const s = gwas.summary()
    const hint =
      S.trait === 'warfarin'
        ? pick('大效應基因（VKORC1、CYP2C9）先浮現；效應微小的 CYP4F2（場景中刻意畫得很小）需要更多人才看得見。', '大效應基因先浮現；小效應的 CYP4F2 要更多人才看得見。')
        : S.trait === 'statin'
          ? pick('大效應變異：僅一百多人的樣本，SLCO1B1 就浮出水面。', '大效應變異：百來人，SLCO1B1 就浮現。')
          : pick('沒有明顯高峰，只有無數低矮丘陵：許多微小效應疊加。把樣本拉到最大，也只有寥寥幾個越過門檻。', '沒有高峰，只有無數低丘：許多微小效應疊加。')
    return `${hint}（樣本約 ${fmtN(s.n)} 人、越過門檻 ${s.peaks} 個，山峰高度為示意）`
  }
  const CAP = {
    cells: () => pick('同樣是「基因變異」：藍色的生殖細胞變異遺傳自父母，存在每個細胞；紅色的體細胞突變出生後才出現，只在腫瘤裡，不會傳給子女。', '藍◆遺傳自父母、每個細胞都有；紅★出生後才出現，只在腫瘤。'),
    network: () => pick('每條線背後都是一批研究。AI 想在這張網裡找出「還沒被連上」的線——但它只能從「資料裡有的」學起。', '每條線背後都是一批研究；紫色「？」是 AI 提出、待驗證的候選線，但它只能從已有資料學起。'),
    ai: () => pick('通用預測器預測的是一般致病性，不是某個藥物的代謝功能。開啟標示，看預測與實驗不一致的變異（示意；比例與相關性皆為任意設定）。', '通用預測器預測的是一般致病性，不是某藥物的代謝功能（示意）。'),
    diversity: () => pick('GWAS 參與者約 88% 為歐洲血統，亞洲 6.17%、非洲僅 0.28%（GWAS Diversity Monitor，資料檢查日 2026-09-16）。資料偏一邊，模型就偏一邊。', 'GWAS 參與者約 88% 為歐洲血統，非洲僅 0.28%（2026-09-16）。'),
    biobank: () => pick('補足缺口的做法之一：建立在地大型資料庫。球體體積與各來源所列的人數成正比（台灣人體生物資料庫為單一研究分析的人數），技術與定義不同（晶片 vs 全基因體），不宜直接比大小。', '在地大型資料庫可補足缺口；球體體積與所列人數成正比，技術不同，別直接比大小。'),
  }
  function aiCaption() {
    if (S.aview === 'ai') return S.mismatch ? pick('紅點：AI 判為「像良性」，功能實驗卻顯示活性喪失（示意）。所以 AI 只是初篩，仍需針對藥物與受質的功能實驗。', '紅點：AI 說像良性、實驗卻顯示功能喪失（示意）。AI 只是初篩。') : CAP.ai()
    return CAP[S.aview]()
  }
  const captionFor = (key) => withHint(key, S.theme === 'tumor' ? (key === 'cells' ? CAP.cells() : recCaption()) : S.theme === 'gwas' ? gwasCaption() : aiCaption())

  // ── 狀態同步 ──
  let lastLevel = ''
  let numDirty = false // 樣本數滑桿拖曳中，讀數/圖說尚待（節流）更新
  let numAt = 0
  function readProlif() {
    const lv = tumor.level
    if (lv === lastLevel) return
    lastLevel = lv
    rdProlif.set(lv === '高' ? '高（腫瘤持續增殖）' : lv === '中' ? '中' : '低（增殖受抑制）')
    rdProlif.setColor(lv === '高' ? '#ff8a8a' : lv === '中' ? '#ffc44d' : '#4be3a0')
  }
  function refreshGwas() {
    const s = gwas.summary()
    rdGwas.set(`${s.peaks} 個 · ${s.named.length ? s.named.join('、') : '尚無基因'}`)
    hud.caption(captionFor('gwas'))
    numDirty = false
    numAt = performance.now()
  }
  const show = (el, on) => {
    el.style.display = on ? '' : 'none'
  }
  function sync() {
    const key = viewKey()
    themeSeg.set(S.theme)
    show(tviewSeg.el, S.theme === 'tumor')
    show(traitSeg.el, S.theme === 'gwas')
    show(aviewSeg.el, S.theme === 'ai')
    show(gT.root, S.theme === 'tumor')
    show(gW.root, S.theme === 'gwas')
    show(gA.root, S.theme === 'ai' && S.aview === 'ai')
    tumor.root.visible = S.theme === 'tumor'
    gwas.root.visible = S.theme === 'gwas'
    ai.root.visible = S.theme === 'ai'
    tviewSeg.set(S.tview)
    egfrSeg.set(S.egfr)
    drugSeg.set(S.drug)
    resistTg.set(S.resist)
    traitSeg.set(S.trait)
    aviewSeg.set(S.aview)
    mismatchTg.set(S.mismatch)
    if (S.theme === 'tumor') {
      if (key !== lastKey) tumor.setView(S.tview)
      tumor.setState({ mutant: S.egfr === 'mut', drug: S.drug, resist: S.resist })
      lastLevel = ''
      readProlif()
    } else if (S.theme === 'gwas') {
      if (gwas.trait !== S.trait) gwas.setTrait(S.trait)
      if (Math.abs(gwas.logN - S.logN) > 1e-6) gwas.setLogN(S.logN)
      nSlider.set(S.logN)
    } else {
      if (key !== lastKey) ai.setView(S.aview)
      ai.setShowMismatch(S.mismatch)
    }
    hud.badge(badgeText(key))
    hud.legend(legendFor(key))
    if (S.theme === 'gwas') refreshGwas()
    else hud.caption(captionFor(key))
    hud.tip(null)
  }
  function go(patch) {
    const prevTheme = S.theme
    Object.assign(S, patch)
    if (S.theme === 'gwas' && prevTheme !== 'gwas') gwas.replay()
    sync()
    const key = viewKey()
    if (key !== lastKey) {
      frame(key, lastKey != null)
      lastKey = key
    }
  }

  // ── 文字步驟 ──
  const STEPS = [
    { theme: 'tumor', tview: 'cells' },
    { theme: 'tumor', tview: 'rec', egfr: 'mut', drug: 'none', resist: false },
    { theme: 'tumor', tview: 'rec', egfr: 'mut', drug: 'gen1', resist: false },
    { theme: 'tumor', tview: 'rec', egfr: 'mut', drug: 'gen1', resist: true },
    { theme: 'tumor', tview: 'rec', egfr: 'wt', drug: 'gen1', resist: false },
    { theme: 'gwas', trait: 'warfarin', logN: LN('warfarin') },
    { theme: 'gwas', trait: 'statin', logN: LN('statin') },
    { theme: 'gwas', trait: 'antidep', logN: 5.3 },
    { theme: 'ai', aview: 'network' },
    { theme: 'ai', aview: 'ai', mismatch: true },
    { theme: 'ai', aview: 'diversity' },
    { theme: 'ai', aview: 'biobank' },
  ]

  // ── 指標：提示 ──
  const current = () => (S.theme === 'tumor' ? tumor : S.theme === 'gwas' ? gwas : ai)
  const showTip = () => {
    const html = current().pickTip()
    if (html) {
      hinted = true
      hud.tip(html)
      ctx.setCursor('pointer')
    } else {
      hud.tip(null)
      ctx.setCursor('')
    }
  }
  const offPointer = ctx.onPointer((type, e, ptr) => {
    if (type === 'move') {
      if (!ctx.coarsePointer && !ptr.down) showTip()
      else if (ptr.down) hud.tip(null)
    } else if (type === 'click') showTip()
    else if (type === 'leave' || type === 'cancel') {
      hud.tip(null)
      ai.clearHover()
      tumor.clearHover()
    }
  })

  // ── 初始化 ──
  go({})

  return {
    update(dt, t) {
      if (anim) {
        // 暫停時（dt = 0）換視角的鏡頭移動也要直接完成，否則會卡在舊構圖
        anim.k = ctx.paused ? 1 : Math.min(1, anim.k + dt / 0.85)
        const e = util.easeInOut(anim.k)
        camera.position.lerpVectors(anim.from.p, anim.to.p, e)
        controls.target.lerpVectors(anim.from.t, anim.to.t, e)
        if (anim.k >= 1) anim = null
      }
      dust.rotation.z = t * 0.01 * ctx.motion
      if (S.theme === 'tumor') {
        tumor.update(dt, t)
        readProlif()
      } else if (S.theme === 'gwas') {
        gwas.update(dt, t)
        if (numDirty && performance.now() - numAt > 300) refreshGwas()
      } else ai.update(dt, t)
    },
    onStep(i) {
      const st = STEPS[Math.min(i, STEPS.length - 1)]
      if (!st) return
      // 步驟給的是完整狀態，未列出的欄位沿用預設，確保每個 step 的畫面可重現
      const base = { tview: 'cells', egfr: 'wt', drug: 'none', resist: false, trait: 'warfarin', logN: LN('warfarin'), aview: 'network', mismatch: true }
      go({ ...base, ...st })
    },
    onResize(w, h) {
      const a = camera.aspect || 1
      const nw = (w || ctx.size.w || 800) < NARROW_W
      if (nw !== isNarrow) {
        isNarrow = nw
        kit.setBoost(nw ? NARROW_BOOST : 1)
        sync()
      }
      if (framedAspect && (Math.abs(a - framedAspect) / framedAspect > 0.05 || Math.abs((h || ctx.view.clientHeight) - framedH) > 24)) frame(viewKey(), false, false)
    },
    onResetView() {
      // Stage.resetView 還原的是「上一次 setFrame 當下的鏡頭」，而視窗縮放會用使用者轉過的角度重設它；
      // 這裡重新套用預設方位角/仰角，並把 home 寫回真正的預設
      frame(viewKey(), false, true)
    },
    dispose() {
      offPointer()
      util.disposeTree(tumor.root)
      util.disposeTree(gwas.root)
      util.disposeTree(ai.root)
    },
  }
}
