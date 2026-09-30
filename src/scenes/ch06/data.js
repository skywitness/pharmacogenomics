// ch06 場景用的資料（純資料，無 three 依賴）。
// 來源：research/cases-cyp.verified.json。所有「效果位置、酵素數量、粒子比例」都是教學示意，不是實測。

export const STRENGTH = {
  Strong: { zh: '強', color: '#35d6ff' },
  Moderate: { zh: '中', color: '#ffc44d' },
  Optional: { zh: '選擇性', color: '#b0b9d6' },
  None: { zh: '無建議', color: '#8a93ad' },
}

// 代謝型顏色沿用 palette（此處以字串，供 HTML 使用）
export const PH_CSS = { UM: '#b06bff', RM: '#35d6ff', NM: '#4be3a0', IM: '#ffc44d', PM: '#ff5c5c' }
export const PH_HEX = { UM: 0xb06bff, RM: 0x35d6ff, NM: 0x4be3a0, IM: 0xffc44d, PM: 0xff5c5c }

// enz = 8 個酵素位點中「功能正常」的數量（示意）；extra = 每次成功活化時額外多產生一個代謝物的機率（超快速）
// e = 藥效位置 0..1（示意）；inh = 血小板被阻斷比例（僅氯吡格雷）
export const CLOP = {
  key: 'clop',
  zh: '氯吡格雷',
  en: 'clopidogrel',
  gene: 'CYP2C19',
  ph: {
    UM: { zh: '超快速代謝者', short: 'UM 超快', diplo: '*17/*17', enz: 8, extra: 0.5, e: 0.92, inh: 0.97 },
    RM: { zh: '快速代謝者', short: 'RM 快速', diplo: '*1/*17', enz: 7, extra: 0.25, e: 0.84, inh: 0.92 },
    NM: { zh: '正常代謝者', short: 'NM 正常', diplo: '*1/*1', enz: 6, extra: 0, e: 0.72, inh: 0.85 },
    IM: { zh: '中間代謝者', short: 'IM 中間', diplo: '*1/*2', enz: 3, extra: 0, e: 0.36, inh: 0.4 },
    PM: { zh: '不良代謝者', short: 'PM 不良', diplo: '*2/*2', enz: 0, extra: 0, e: 0.1, inh: 0.1 },
  },
  zones: [
    { to: 0.5, color: 0xff5c5c, label: '不足', long: '抗血小板效果不足' },
    { to: 1.0, color: 0x4be3a0, label: '足夠', long: '抗血小板效果足夠' },
  ],
  gaugeTitle: '抗血小板效果（示意）',
  altE: 0.82,
}

export const CODE = {
  key: 'code',
  zh: '可待因',
  en: 'codeine',
  gene: 'CYP2D6',
  ph: {
    UM: { zh: '超快速代謝者', short: 'UM 超快', diplo: '活性分數 >2.25', enz: 8, extra: 0.9, e: 0.93, occ: 12 },
    NM: { zh: '正常代謝者', short: 'NM 正常', diplo: '活性分數 1.25–2.25', enz: 6, extra: 0, e: 0.56, occ: 7 },
    IM: { zh: '中間代謝者', short: 'IM 中間', diplo: '活性分數 0 < AS < 1.25', enz: 3, extra: 0, e: 0.4, occ: 4 },
    PM: { zh: '不良代謝者', short: 'PM 不良', diplo: '活性分數 0', enz: 0, extra: 0, e: 0.07, occ: 1 },
  },
  zones: [
    { to: 0.33, color: 0xffc44d, label: '不足', long: '鎮痛不足' },
    { to: 0.76, color: 0x4be3a0, label: '鎮痛', long: '鎮痛範圍' },
    { to: 1.0, color: 0xff5c5c, label: '過量', long: '過量風險' },
  ],
  gaugeTitle: '嗎啡暴露（示意）',
  altE: 0.55,
}

// 華法林：VKORC1 −1639G>A(GG/AG/AA)× CYP2C9(*1/*1、*1/*3、*3/*3)
export const WARF = {
  key: 'warf',
  zh: '華法林',
  en: 'warfarin',
  gene: 'CYP2C9 + VKORC1',
  vk: {
    GG: { zh: 'GG（對華法林較不敏感）', short: 'GG', gates: 6 },
    AG: { zh: 'AG（中等敏感）', short: 'AG', gates: 4 },
    AA: { zh: 'AA（較敏感）', short: 'AA', gates: 2 },
  },
  cy: {
    11: { zh: '正常代謝者', short: '*1/*1', enz: 6, ph: 'NM' },
    13: { zh: '中間代謝者', short: '*1/*3', enz: 3, ph: 'IM' },
    33: { zh: '不良代謝者', short: '*3/*3', enz: 0, ph: 'PM' },
  },
  // 依 FDA 仿單（Jantoven）預期維持劑量表的分級：high / mid / low（只保留相對高低，不放 mg）
  tier: {
    GG: { 11: 'high', 13: 'mid', 33: 'low' },
    AG: { 11: 'high', 13: 'mid', 33: 'low' },
    AA: { 11: 'mid', 13: 'low', 33: 'low' },
  },
  tierZh: { high: '較高', mid: '中等', low: '偏低' },
  // 「同一個常規起始劑量」下的抗凝血強度位置（示意）：敏感度越高越容易過度抗凝
  tierE: { high: 0.5, mid: 0.64, low: 0.9 },
  tierRate: { high: 1, mid: 0.66, low: 0.4 },
  zones: [
    { to: 0.3, color: 0xffc44d, label: '不足', long: '抗凝不足' },
    { to: 0.7, color: 0x4be3a0, label: 'INR 2–3', long: '在目標 INR 2–3' },
    { to: 1.0, color: 0xff5c5c, label: '過度', long: '過度抗凝（出血風險）' },
  ],
  gaugeTitle: '抗凝血強度（示意）',
  adjE: 0.5,
}

export function chip(text, color) {
  return `<span style="display:inline-block;padding:1px 8px;margin-left:6px;border-radius:999px;font-size:.72rem;font-weight:700;color:#06101f;background:${color}">${text}</span>`
}

export const CLOP_IND = {
  acs: { label: 'ACS/PCI', full: '急性冠心症與/或接受經皮冠狀動脈介入（ACS/PCI）' },
  cv: { label: '其他心血管', full: '非 ACS、非 PCI 的心血管適應症（如週邊動脈疾病）' },
  neuro: { label: '中風/TIA', full: '神經血管適應症（缺血性中風/TIA）' },
}

/** CPIC 建議摘要（全部來自 cases-cyp-07/08/09/17；版本年份寫在 ref）。 */
export function clopCard(ph, ind) {
  const ref = `CPIC 2022 · 氯吡格雷 × CYP2C19 · ${CLOP_IND[ind].full}`
  let s = 'None'
  let text = ''
  if (ind === 'acs') {
    if (ph === 'IM') {
      s = 'Strong'
      text = '盡量避免標準劑量的氯吡格雷；無禁忌時，改用標準劑量的 prasugrel 或 ticagrelor。'
    } else if (ph === 'PM') {
      s = 'Strong'
      text = '盡量避免氯吡格雷本身；無禁忌時，改用標準劑量的 prasugrel 或 ticagrelor。CPIC 指出加倍劑量仍無法讓不良代謝者達到足夠的血小板抑制。'
    } else {
      s = 'Strong'
      text = '若使用氯吡格雷，採標準劑量。'
    }
  } else if (ind === 'cv') {
    if (ph === 'NM') {
      s = 'Strong'
      text = '若使用氯吡格雷，採標準劑量（75 mg/日）。'
    } else if (ph === 'PM') {
      s = 'Moderate'
      text = '盡量避免氯吡格雷；無禁忌時，改用標準劑量的 prasugrel 或 ticagrelor。'
    } else if (ph === 'IM') {
      s = 'None'
      text = '此情境對中間代謝者「無建議」。'
    } else {
      s = 'None'
      text = 'CPIC 對此情境的快速/超快速代謝者「無建議」（證據不足）。'
    }
  } else {
    if (ph === 'NM') {
      s = 'Strong'
      text = '若使用氯吡格雷，採標準劑量（75 mg/日）。'
    } else if (ph === 'IM') {
      s = 'Moderate'
      text = '考慮改用標準劑量的其他 P2Y12 抑制劑（如 ticagrelor 或 ticlopidine;ticlopidine 有嚴重血液副作用）。prasugrel 對有中風/TIA 病史者為禁忌。'
    } else if (ph === 'PM') {
      s = 'Moderate'
      text = '盡量避免氯吡格雷；有臨床需要且無禁忌時，考慮改用標準劑量的其他 P2Y12 抑制劑（如 ticagrelor）。prasugrel 對有中風/TIA 病史者為禁忌。'
    } else {
      s = 'None'
      text = 'CPIC 對此情境的快速/超快速代謝者「無建議」（證據不足）。'
    }
  }
  return { ref, who: `${CLOP.ph[ph].zh}(${ph})`, s, text }
}

export function codeCard(ph) {
  const ref = 'CPIC 2021 · 可待因 × CYP2D6（鴉片類指引）'
  const who = `${CODE.ph[ph].zh}(${ph})`
  if (ph === 'UM') return { ref, who, s: 'Strong', text: '避免使用可待因：嗎啡生成過多，有中毒風險。FDA 對兒童另有黑框警語。若需改藥，不要換成同樣依賴 CYP2D6 的曲馬多。' }
  if (ph === 'PM') return { ref, who, s: 'Strong', text: '避免使用可待因：幾乎轉不出嗎啡，止痛不足。若需改藥，不要換成同樣依賴 CYP2D6 的曲馬多。' }
  if (ph === 'IM') return { ref, who, s: 'Moderate', text: '依仿單的年齡/體重劑量使用；若止痛無效，再考慮其他鴉片類（避免曲馬多）。' }
  return { ref, who, s: 'Strong', text: '依仿單的年齡/體重劑量使用。' }
}

export function warfCard(vk, cy) {
  const ref = 'CPIC 2017 · 華法林 × CYP2C9 / VKORC1（目標 INR 2–3）'
  const tier = WARF.tier[vk][cy]
  let text = '非非洲族群：以納入 VKORC1 −1639G>A 與 CYP2C9 *2、*3 的已發表藥物基因體演算法來估算維持劑量。'
  if (cy === '33') text += ' CYP2C9 不良代謝者可考慮改用其他口服抗凝血劑。'
  return { ref, who: `VKORC1 ${vk} × CYP2C9 ${WARF.cy[cy].short}`, s: 'Strong', text, tier }
}

export function cardHTML(c, extra = '') {
  const st = STRENGTH[c.s]
  const strength = c.s === 'None' ? chip('無建議', st.color) : chip(`推薦強度 ${c.s}(${st.zh})`, st.color)
  return (
    `<div style="border:1px solid rgba(130,165,255,.34);border-radius:12px;padding:10px 12px;background:rgba(6,9,19,.55)">` +
    `<div style="font-size:.72rem;color:#8f9bbd;line-height:1.45">${c.ref}</div>` +
    `<div style="margin:3px 0 4px;color:#fff;font-size:.9rem"><b>${c.who}</b>${strength}</div>` +
    `<div style="color:#dfe5f7;font-size:.84rem;line-height:1.6">${c.text}</div>` +
    (extra ? `<div style="margin-top:5px;color:#9aa6c4;font-size:.76rem;line-height:1.55">${extra}</div>` : '') +
    `</div>`
  )
}

/** 「被阻斷的血小板」顏色：比活性代謝物（淺薄荷）深、偏翠綠，圖例與場景共用。 */
export const BLOCK_HEX = 0x1fae7a
