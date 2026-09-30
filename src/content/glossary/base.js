// 基礎術語：首頁與學習地圖一開始就會遇到的核心概念。全站每個詞只保留一份定義，其他章節直接用 {{}} 引用。
export default [
  { key: 'genotype', zh: '基因型', en: 'Genotype', level: 1, def: '一個人在某個基因上實際帶有的兩個版本（等位基因）的組合，例如 CYP2C19 的 *1/*2。' },
  { key: 'pharmacogenomics', zh: '藥物基因體學', en: 'Pharmacogenomics', level: 1, aliases: ['PGx', '藥物基因學'], def: '研究一個人的基因（乃至整個基因體）如何影響他對藥物的反應，目的是讓用藥更有效、更安全。' },
  { key: 'precision-medicine', zh: '精準醫療', en: 'Precision medicine', level: 1, aliases: ['個人化醫療', 'personalized medicine'], def: '利用個人的基因、環境與生活型態資訊，來引導預防與治療決策的醫療方式。它多半是把病人分成「反應不同的亞群」，並不是為每個人製造獨一無二的藥。' },
  { key: 'hla', zh: '人類白血球抗原', en: 'Human leukocyte antigen', level: 1, aliases: ['HLA', 'HLA-B', 'HLA class I'], def: '細胞表面用來向免疫系統「展示身分」的蛋白質分子。不同人的 HLA 版本差異很大，某些版本和特定藥物引發的嚴重過敏有關。' },
  { key: 'cpic', zh: '臨床藥物基因體學實施聯盟', en: 'Clinical Pharmacogenetics Implementation Consortium', level: 1, aliases: ['CPIC', '臨床藥物基因體實施聯盟'], def: '國際性的專家團體，公開發表「拿到基因檢測結果後，如何調整用藥」的指引與查表。它的指引只說明已有基因結果時怎麼用，並不規定誰該去做檢測。' },
  { key: 'phenotype', zh: '表現型', en: 'Phenotype', level: 1, def: '基因型表現在外、可以觀察到的功能或特徵。在藥物基因體學裡，常指由基因型推得的藥物代謝能力，例如「不良代謝者」。' },
  { key: 'allele', zh: '等位基因', en: 'Allele', level: 2, aliases: ['對偶基因'], def: '同一個基因位置上可能出現的不同版本。每個人從父母各得到一份，所以一個基因會有兩個等位基因。' },
  { key: 'metabolizer', zh: '代謝型', en: 'Metabolizer phenotype', level: 2, aliases: ['代謝者類別', '代謝者類型', '代謝者'], def: 'CPIC 的標準用語，依預測的酵素活性把人分成超快速、快速、正常、中間、不良代謝者等類別。它是由基因型預測的類別，不是直接測到的酵素活性；不同基因實際使用的類別並不相同。' },
  { key: 'cyp450', zh: '細胞色素 P450', en: 'Cytochrome P450 (CYP450)', level: 2, aliases: ['CYP450', 'CYP', 'P450', 'CYP酵素', 'CYP 酵素', 'Cytochrome P450 (CYP)'], def: '一大群主要在肝臟的酵素，是身體氧化、分解藥物的主力，決定許多藥物被活化或被清除的速度。人類約有 57 個推定具功能的 CYP 基因，但負責大部分藥物代謝的只有十來個。' },
]
