// ch08 術語：族群差異與台灣
export default [
  { key: 'phenotype-frequency', zh: '表現型頻率', en: 'Phenotype frequency', level: 4, def: '族群中被預測為某種代謝者類型（例如不良代謝者）的人所占的比例。CPIC 表中的數字是由等位基因頻率以哈迪-溫伯格公式推估，不是實測的酵素活性，也不是臨床結果。' },
  { key: 'hospital-cohort', zh: '醫院世代', en: 'Hospital-based cohort', level: 4, aliases: ['醫院世代研究'], def: '由醫院就診或受檢的病人組成的研究族群，不是從全體民眾隨機抽樣。本章引用的臺大醫院（NTUH）與中國醫藥大學附設醫院（CMUH）數字都屬於這一類，不能直接當成「全台灣人」的比例。' },
  { key: 'biogeographic-group', zh: '生物地理族群', en: 'Biogeographic group', level: 4, aliases: ['CPIC 族群分類'], def: 'CPIC 與 PharmGKB/ClinPGx 為了統一比較各研究的頻率，而使用的 9 個粗略族群分類（如東亞、歐洲、撒哈拉以南非洲）。原作者承認這是對人類多樣性的過度簡化；它不是個人身分，也不等於任何單一國家。' },
  { key: 'weighted-average', zh: '加權平均', en: 'Weighted average', level: 4, def: '把多項研究的頻率依樣本數加權後平均，樣本越多的研究影響越大。CPIC 頻率表的族群數字就是這樣得來的，因此受到原始研究（多為小型、非隨機取樣）品質的限制。' },
  { key: 'cnv', zh: '拷貝數變異', en: 'Copy number variation (CNV)', level: 4, def: '基因整段缺失或多出幾份的變異（結構變異的一種），例如 CYP2D6*5 是整個基因缺失。基因型陣列與外顯子定序常難以完整判讀，這是台灣大型研究缺少 CYP2D6 實測頻率的原因之一。' },
  { key: 'wes', zh: '全外顯子定序', en: 'Whole-exome sequencing (WES)', level: 4, aliases: ['WES', '外顯子定序'], def: '只定序基因中會製成蛋白質的外顯子區域，成本較低，但難以判讀拷貝數變異等結構複雜的基因（如 CYP2D6）。' },
  { key: 'twb', zh: '台灣人體生物資料庫', en: 'Taiwan Biobank (TWB)', level: 4, aliases: ['Taiwan Biobank', 'TWB'], def: '設於中央研究院的台灣大型人群研究資料庫。官網顯示截至 2026 年 8 月 31 日有 203,147 人參與（「參與」不等於已完成基因定型）。' },
  { key: 'genetic-drift', zh: '遺傳漂變', en: 'Genetic drift', level: 4, def: '等位基因頻率在世代之間的隨機波動。族群越小，波動越大，甚至可能讓等位基因消失或固定；大族群則相對穩定。' },
  { key: 'founder-effect', zh: '創始者效應', en: 'Founder effect', level: 4, def: '一小群個體從大族群分離出去建立新族群時，新族群的遺傳變異度降低，某些等位基因可能因此偏高或消失。' },
  { key: 'gene-flow', zh: '基因流動', en: 'Gene flow', level: 4, aliases: ['遷徙', 'migration'], def: '族群之間因遷徙與通婚而交換等位基因，會讓各族群的頻率趨於接近或發生改變。' },
  { key: 'natural-selection', zh: '天擇', en: 'Natural selection', level: 4, aliases: ['自然選擇'], def: '帶有某些等位基因的個體較容易存活或生育，使該等位基因在族群中變多或變少。' },
  { key: 'balanced-polymorphism', zh: '平衡多型性', en: 'Balanced polymorphism', level: 4, def: '天擇讓兩種以上的等位基因長期同時留在族群中。文獻認為 G6PD 缺乏與瘧疾流行地區高度相關，可能是異型合子受到瘧疾保護所致（假說）。' },
  { key: 'race', zh: '種族', en: 'Race', level: 4, def: '社會與政治建構出來的分類方式。美國國家科學院 2023 年報告建議，研究者不要把種族當作人類遺傳變異的代理，應改用更精確的描述（如遺傳祖源）。' },
  { key: 'genetic-ancestry', zh: '遺傳祖源', en: 'Genetic ancestry', level: 4, aliases: ['祖源'], def: '一個人的 DNA 是沿著哪些祖先的家族路徑遺傳而來。它是每個人各自不同的連續分布，和「種族」這種社會分類不是同一件事。' },
  { key: 'gnomad', zh: 'gnomAD 資料庫', en: 'Genome Aggregation Database (gnomAD)', level: 4, aliases: ['gnomAD'], def: '彙整大量外顯子與全基因體定序的公開變異資料庫。它的「東亞」等群組是以遺傳祖源推定的，沒有獨立的台灣群，所以與 CPIC 或台灣研究的數字會有差距。' },
]
