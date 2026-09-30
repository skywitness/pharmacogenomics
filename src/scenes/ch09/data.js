// ch09 場景用的資料：站點、檢測技術、病人情境（全部為示意用的虛構病人；指引文字取自 research/*.verified.json）
import { COLORS } from '../../core/palette.js'

export const STAGE_NAMES = ['總覽', '① 採檢', '② 萃取 DNA', '③ 基因檢測', '④ 判讀', '⑤ 決策支援', '⑥ 處方與界線']

// 流水線：第一列（後排）由左到右 1→3，轉彎後第二列（前排）由右到左 4→6
export const STATIONS = [
  { n: 1, name: '採檢', x: -4.6, row: 'A', tip: '抽血或口腔拭子；先說明用途、簽同意書' },
  { n: 2, name: '萃取', x: 0, row: 'A', tip: '離心、破膜、純化，得到可檢測的 DNA' },
  { n: 3, name: '檢測', x: 4.6, row: 'A', tip: '依技術讀出變異：即時 PCR、基因晶片或定序' },
  { n: 4, name: '判讀', x: 4.6, row: 'B', tip: '星號等位基因 → 雙倍型 → 表現型' },
  { n: 5, name: '決策支援', x: 0, row: 'B', tip: '開藥時，病歷比對基因結果並跳出提示' },
  { n: 6, name: '處方', x: -4.6, row: 'B', tip: '依指引調整處方；由醫師與病人共同決定' },
]

export const TECHS = {
  pcr: {
    key: 'pcr',
    label: '即時 PCR（TaqMan）',
    short: 'TaqMan 即時 PCR',
    cap: '③ 即時 PCR：針對已知位點，用螢光探針判讀。快、直接，但只看事先設計好的變異。',
    pros: '針對少數已知位點，報告快、判讀直接；有研究報告即時檢驗（POCT）系統的 CYP2C19 檢測中位報告時間約 96 分鐘。',
    cons: '只偵測事先設計的變異；罕見變異難以偵測。沒有搭配拷貝數檢測時，結構變異（基因缺失、重複）也會被漏看。示意：這裡把「沒有拷貝數分析的 SNV 探針」畫成漏看；有些 PCR 產品內建 CYP2D6 拷貝數標的。',
    src: '依綜述 van der Lee 2020；即時檢驗時間為 Cavallari 2018 該單一院區的研究結果',
  },
  array: {
    key: 'array',
    label: '基因晶片',
    short: '基因晶片（陣列）',
    cap: '③ 基因晶片：一次讀取大量預先選定的位點。位點雖多，仍只看晶片上有的。',
    pros: '一次讀許多預設位點，通量高，適合「預先」檢測多個基因；商用面板的規模依產品差異很大。',
    cons: '同樣只看晶片設計的位點；CYP2D6 這類有缺失、重複的基因，單靠陣列推論的資料容易誤判（有些產品另含拷貝數標的，此處為示意）。',
    src: '依綜述 van der Lee 2020；CYP2D6 結構變異見 Genetics 2025 的陣列與 PCR 驗證結果比較研究',
  },
  ngs: {
    key: 'ngs',
    label: '次世代定序（NGS）',
    short: '次世代定序（NGS）',
    cap: '③ 次世代定序：讀取整段基因，有機會找到罕見與結構變異；較貴、較久、判讀較複雜。',
    pros: '讀取整段基因，有機會發現罕見變異；搭配專門的分析方法，還能推得結構變異與單倍型資訊（CYP2D6 因假基因干擾，仍需專門的分析流程）。',
    cons: '成本、時間與判讀複雜度較高，也可能帶出意義未明變異與次要（附帶）發現。例：臺大醫院 23 基因 NGS（2026-09 公告）自費 NT$19,000、約 8–12 週，這只是單一醫院的公告。',
    src: '依 van der Lee 2020；臺大醫院公告 2026-09-09',
  },
}

const TONE = { nm: COLORS.NM, none: COLORS.inactive, um: COLORS.UM, risk: COLORS.PM, hla: COLORS.hla, other: COLORS.inactive }
export const toneColor = (t) => TONE[t] ?? COLORS.inactive

const NM_ALLELE = { name: '*1', fn: '正常功能', tone: 'nm' }

export const SCENARIOS = {
  acs: {
    key: 'acs',
    label: '心肌梗塞放支架',
    seg: '心肌梗塞',
    drug: 'clopidogrel',
    gene: 'CYP2C19',
    story: '急性冠心症、剛放冠狀動脈支架，要用抗血小板藥 clopidogrel',
    truth: {
      alleles: [NM_ALLELE, { name: '*2', fn: '無功能', tone: 'none' }],
      diplotype: '*1/*2',
      activity: '',
      phenotype: '中間代謝者 (IM)',
      phColor: COLORS.IM,
      zyg: 'het',
      missed: false,
    },
    interp: 'CYP2C19 的 *1（正常功能）搭配 *2（無功能）→ 依 CPIC 統一用語，判為「中間代謝者」。clopidogrel 是前驅藥，要靠 CYP2C19 活化。',
    alert: { title: 'CYP2C19 中間代謝者', lines: ['clopidogrel 需經 CYP2C19 活化', '此病人的活化量可能不足'], advice: '考慮 prasugrel 或 ticagrelor（無禁忌時）' },
    alt: { short: '替代抗血小板藥', detail: 'prasugrel 或 ticagrelor（無禁忌時）' },
    rec: {
      guide: 'CPIC 2022 更新版',
      text: '急性冠心症/PCI 的病人，CYP2C19 中間代謝者宜避免標準劑量 clopidogrel，無禁忌時改用 prasugrel 或 ticagrelor（強建議）；不良代謝者則應避免 clopidogrel。',
      caveat: '證據並非一面倒：TAILOR-PCI 隨機試驗的主要終點未達統計顯著（HR 0.66，95% CI 0.43–1.02）；CPIC 2022 引述的較早期 ACC/AHA、ESC 指引不建議常規檢測；AHA 2024 科學聲明則認為證據支持用藥前檢測，各家看法仍在演變。',
    },
  },
  codeine: {
    key: 'codeine',
    label: '止痛藥可待因',
    seg: '可待因',
    drug: 'codeine',
    gene: 'CYP2D6',
    story: '需要止痛，醫師考慮開立可待因（codeine）',
    truth: {
      alleles: [NM_ALLELE, { name: '*1×2', fn: '基因重複 → 活性增加', tone: 'um' }],
      diplotype: '*1/*1×2',
      activity: '活性分數 3.0（> 2.25）',
      phenotype: '超快速代謝者 (UM)',
      phColor: COLORS.UM,
      zyg: 'ref',
      missed: false,
    },
    // 只做 SNV 探針、沒有拷貝數檢測時，看不到「基因重複」（示意）
    snvView: {
      alleles: [NM_ALLELE, NM_ALLELE],
      diplotype: '*1/*1',
      activity: '',
      phenotype: '正常代謝者 （NM）？',
      phColor: COLORS.NM,
      zyg: 'ref',
      missed: true,
    },
    interp: 'CYP2D6 的 *1 加上基因重複的 *1×2 → 活性分數 3.0，大於 2.25，CPIC 2021 判為「超快速代謝者」。可待因是前驅藥，會被 CYP2D6 轉成嗎啡。',
    interpMissed: '只用 SNV 探針、沒有搭配拷貝數檢測時，看不到「基因重複」，這位超快速代謝者會被判成 *1/*1 的正常代謝者（示意）。',
    alert: { title: 'CYP2D6 超快速代謝者', lines: ['codeine 會被過度轉成嗎啡', '有中毒與呼吸抑制風險'], advice: '避免 codeine 與 tramadol' },
    alt: { short: '其他止痛方案', detail: '非 codeine、非 tramadol 的止痛方案' },
    rec: {
      guide: 'CPIC 2021',
      text: 'CYP2D6 超快速代謝者（活性分數 > 2.25）與不良代謝者（活性分數 0）宜避免可待因與曲馬多（強建議）——前者嗎啡生成過多而中毒，後者止痛不足。',
      caveat: '美國仿單本來就禁止未滿 12 歲的兒童使用可待因（不必等基因結果），未滿 18 歲的扁桃腺/腺樣體手術後疼痛處置也在禁忌之列。',
    },
  },
  cbz: {
    key: 'cbz',
    label: '癲癇 · 台灣',
    seg: '癲癇（台灣）',
    drug: 'carbamazepine',
    gene: 'HLA-B',
    story: '新診斷癲癇（或三叉神經痛），醫師考慮開立 carbamazepine',
    truth: {
      alleles: [{ name: 'B*15:02', fn: '風險型別', tone: 'risk' }, { name: 'B*（其他）', fn: '一般型別', tone: 'other' }],
      diplotype: '帶有 1 份 B*15:02',
      activity: '',
      phenotype: 'HLA-B*15:02 陽性（風險升高）',
      phColor: COLORS.PM,
      zyg: 'het',
      missed: false,
    },
    interp: 'HLA-B*15:02 不是代謝酵素，而是免疫系統的「身分型別」，結果只有帶有或未帶有。它與 carbamazepine 引起的嚴重皮膚反應（SJS/TEN）高度相關。',
    alert: { title: 'HLA-B*15:02 陽性', lines: ['carbamazepine 可能引起', '嚴重皮膚反應（SJS/TEN）'], advice: '未用過者避免使用 carbamazepine' },
    alt: { short: '其他抗癲癇藥', detail: '由神經科醫師選擇' },
    rec: {
      guide: 'CPIC 2017 更新版；衛生署 2007、2010',
      text: 'HLA-B*15:02 陽性且尚未用過 carbamazepine 者，CPIC 建議不要使用（強建議）。台灣衛生署（現衛福部）自 2007 年起要求仿單註明，可能帶有此基因的亞洲族群「宜考慮」用藥前檢測，並於 2010-06-01 起納入健保給付。',
      caveat: '陽性者多數其實不會發病（陽性預測值偏低，見第 7 章），但事前無法分辨誰會發病，才建議避開；陰性也不代表零風險，出現發燒、廣泛皮疹、口腔或眼睛潰爛等嚴重反應要立即就醫。',
    },
  },
}

export const SCENARIO_ORDER = ['acs', 'codeine', 'cbz']

/** 依檢測技術決定「這個技術讀到了什麼」 */
export function seenBy(sc, techKey) {
  if (sc.snvView && techKey !== 'ngs') return sc.snvView
  return sc.truth
}

// 倫理提醒：在第 6 站停靠時，以關鍵字晶片排成一列貼在畫面上緣（位置由場景依鏡頭計算，這裡只放文字）
export const ETHICS_CHIPS = [
  { text: '隱私' },
  { text: '知情同意' },
  { text: '歧視' },
  { text: '公平' },
  { text: '附帶發現' },
  { text: '限制' },
]
