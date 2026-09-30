// ch05 術語：CYP450，肝臟裡的代謝工廠
export default [
  { key: 'er', zh: '內質網', en: 'Endoplasmic reticulum (ER)', level: 2, aliases: ['內質網膜'], def: '細胞內由膜構成的網狀結構。肝細胞的內質網膜上鑲嵌許多藥物代謝酵素（例如 CYP），是藥物被改造的主要場所之一。' },
  { key: 'phase-1', zh: '第一相代謝', en: 'Phase I metabolism', level: 3, aliases: ['第一相'], def: '主要由 CYP 進行的氧化、還原或水解反應，在藥物上加上或暴露出反應官能基，通常使藥物更親水、更易排出，有時也會把前驅藥變成活性物。' },
  { key: 'heme', zh: '血基質', en: 'Heme', level: 3, aliases: ['血基質（heme）'], def: '含鐵原子的環狀分子。CYP 酵素的血基質鐵原子能抓住氧，並把氧原子加到藥物上，這是氧化反應的核心。' },
  { key: 'substrate', zh: '受質', en: 'Substrate', level: 3, aliases: ['受質（substrate）'], def: '被某個酵素或轉運蛋白作用（代謝或運送）的藥物或分子。例如 codeine 是 CYP2D6 的受質。' },
  { key: 'cyp3a4', zh: 'CYP3A4', en: 'CYP3A4', level: 3, def: '屬於肝臟含量最高的 CYP3A 家族，在 Zanger 等（2008）的統計中涉及的藥物比例也最高（3A4/5 約 37%）。葡萄柚會使腸道的 CYP3A4 不可逆失活，rifampin 則會誘導它。' },
  { key: 'cyp2d6', zh: 'CYP2D6', en: 'CYP2D6', level: 3, def: '肝臟的藥物代謝酵素基因，處理可待因（codeine）、tamoxifen、metoprolol 等許多藥物。肝臟含量低（約 2%），但多型性極高，含整個基因缺失與多拷貝，因此以活性分數描述、基因型也較難判讀；沒有「快速代謝者」這一類。' },
  { key: 'ces1', zh: 'CES1', en: 'Carboxylesterase 1 (CES1)', level: 3, aliases: ['羧酸酯酶'], def: '一種主要在肝臟的水解酵素。氯吡格雷吃進去後，依 CPIC 的描述約有 85% 被它水解成無活性物質，只有少數走向 CYP2C19 等酵素的活化路徑。' },
  { key: 'inhibitor', zh: '酵素抑制劑', en: 'Enzyme inhibitor', level: 3, aliases: ['抑制劑', 'CYP 抑制劑'], def: '降低酵素活性的藥物（或食物）。FDA 依其使敏感受質 AUC 增加的倍數分級：強效至少 5 倍，中效 2 倍以上、未滿 5 倍。' },
  { key: 'ddgi', zh: '藥物—藥物—基因交互作用', en: 'Drug-drug-gene interaction (DDGI)', level: 4, aliases: ['DDGI'], def: '同時考慮基因型與併用藥物的交互作用，例如 CYP2C19 不良代謝者又併用 CYP2C19 抑制劑。' },
  { key: 'inducer', zh: '酵素誘導劑', en: 'Enzyme inducer', level: 3, aliases: ['誘導劑', '誘導'], def: '讓細胞多製造某種酵素的藥物，例如 rifampin 經核受體 PXR 誘導 CYP3A4。誘導需要時間才達到最大，停藥後也要一段時間才消退。' },
  { key: 'mechanism-based-inhibition', zh: '機轉型抑制', en: 'Mechanism-based inhibition', level: 4, aliases: ['不可逆抑制', '不可逆失活'], def: '抑制劑被酵素轉成反應性產物後，與酵素共價結合而使其永久失活，要等細胞新合成酵素才恢復。例如葡萄柚的呋喃香豆素對腸道 CYP3A4。' },
  { key: 'pxr', zh: 'PXR', en: 'Pregnane X receptor (PXR)', level: 4, aliases: ['孕烷 X 受體'], def: '一種核受體，被 rifampin 等藥物活化後，促進 CYP3A4、CYP2C 與 P-醣蛋白等基因的表現，是酵素誘導的主要途徑之一。' },
]
