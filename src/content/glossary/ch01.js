// ch01 術語：同一顆藥，為什麼效果不一樣？
export default [
  { key: 'adr', zh: '藥物不良反應', en: 'Adverse drug reaction', level: 1, aliases: ['ADR', '不良反應'], def: '在一般用法用量下，藥物造成的有害且非預期的反應。有些和基因有關，許多則和劑量、併用藥物、年齡與器官功能等有關。' },
  { key: 'snp', zh: '單一核苷酸多型性', en: 'Single nucleotide polymorphism', level: 1, aliases: ['SNP', 'SNV', '單核苷酸多型性', '單核苷酸變異', '單一核苷酸變異', '單一字母變異', 'Single-nucleotide variant'], def: 'DNA 上單一個「字母」（鹼基）的差異，正式名稱是單核苷酸變異（SNV）；在族群中出現頻率達 1% 以上者，才習慣稱為 SNP（單一核苷酸多型性）。SNP 平均約每 1,000 個鹼基出現一次，多數不影響蛋白質功能，有沒有影響要看位置與機制。' },
  { key: 'nnt', zh: '需治療人數', en: 'Number needed to treat', level: 1, aliases: ['NNT'], def: '平均要治療幾位病人，才會比對照組多一位達到療效。它不等於「有效者的比例」。' },
  { key: 'ddi', zh: '藥物交互作用', en: 'Drug-drug interaction', level: 1, aliases: ['DDI'], def: '同時使用兩種以上的藥物時，一種藥改變了另一種藥的濃度或作用，使療效變弱或副作用變多。' },
  { key: 'adherence', zh: '服藥遵從性', en: 'Adherence', level: 1, aliases: ['服藥順從性'], def: '病人是否照醫囑的時間與劑量服藥。沒有規律服藥是治療效果不如預期時常被忽略的原因。' },
  { key: 'phenoconversion', zh: '表現型轉換', en: 'Phenoconversion', level: 1, aliases: ['表型轉換'], def: '基因所預測的代謝能力，因併用藥物、疾病、年齡、吸菸等非遺傳因素而與實際情況不符的現象。基因本身沒有變，只是「表現出來的功能」在這些因素存在時偏離了，例如強效抑制劑（會壓低酵素活性的藥）可讓代謝正常的人表現得像不良代謝者。' },
  { key: 'pharmacogenetics', zh: '藥物遺傳學', en: 'Pharmacogenetics', level: 1, aliases: ['PGt'], def: '只看 DNA 序列的變異如何影響藥物反應的學問。依國際規範 ICH E15，它是藥物基因體學的子集；日常兩個詞常被互換使用。' },
  { key: 'pk', zh: '藥物動力學', en: 'Pharmacokinetics', level: 1, aliases: ['PK'], def: '身體怎麼「處理」藥物：吸收、分布、代謝、排除。也就是藥物在體內的濃度如何隨時間變化。' },
  { key: 'metabolizing-enzyme', zh: '藥物代謝酵素', en: 'Drug-metabolizing enzyme', level: 1, aliases: ['代謝酵素'], def: '主要在肝臟裡，把藥物轉變成別的分子（活化、失活或方便排出）的蛋白質。每個人這類酵素的數量與活性可能不同。' },
  { key: 'pd', zh: '藥效學', en: 'Pharmacodynamics', level: 1, aliases: ['PD'], def: '藥物怎麼「影響」身體：藥物和它的作用目標（例如受體）結合後，產生的療效與副作用。' },
  { key: 'sjs-ten', zh: '史蒂芬強森症候群/毒性表皮壞死溶解症', en: 'SJS/TEN', level: 1, aliases: ['SJS', 'TEN', 'Stevens-Johnson syndrome', 'Stevens-Johnson syndrome / toxic epidermal necrolysis', 'Toxic epidermal necrolysis', '史蒂芬強森症候群', '史蒂文斯強生症候群', '史蒂文生-強生症候群', '史蒂文生-強生症候群與毒性表皮溶解症', '毒性表皮壞死溶解症', '毒性表皮溶解症', '中毒性表皮壞死溶解症'], def: '罕見但嚴重的藥物過敏反應，表皮大面積剝離、皮膚與黏膜受損，需要立刻就醫。依剝離占體表面積的比例，小於 10% 稱為 SJS、大於 30% 稱為 TEN、介於其間為重疊型，是同一疾病譜的兩端。' },
  { key: 'g6pd', zh: 'G6PD 缺乏症', en: 'G6PD deficiency', level: 1, aliases: ['蠶豆症', 'G6PD', 'Glucose-6-phosphate dehydrogenase deficiency', '葡萄糖-6-磷酸脫氫酶缺乏症'], def: '缺少 G6PD 這種酵素的遺傳狀況，俗稱蠶豆症；基因位於 X 染色體，男性較常見，女性攜帶者的表現不一。多數人平常沒有症狀，但紅血球較容易受氧化傷害，接觸蠶豆或某些藥物時可能急性溶血（紅血球大量破裂）。' },
  { key: 'actionable-variant', zh: '可採取行動的變異', en: 'Actionable variant', level: 1, aliases: ['可行動變異'], def: '檢測結果足以讓指引建議「改變選藥或劑量」的基因變異。定義因研究與指引而異，所以各研究的比例不能直接比較。' },
]
