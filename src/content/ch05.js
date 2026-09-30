// ch05 內容：CYP450：肝臟裡的代謝工廠
// 事實依據：research/pk-pd-enzymes.verified.json、research/cases-cyp.verified.json（CPIC 資料 2026-09 擷取）
// 場景中的酵素數量、曲線、劑量與治療窗全部是「示意」，不是任何真實藥物或族群的數據。
export default {
  id: 'ch05',
  no: 5,
  level: 3,
  title: 'CYP450：肝臟裡的代謝工廠',
  subtitle: '同一顆藥、同一個劑量，有人被清得太快，有人幾乎清不掉，甚至有人根本「啟動」不了。答案藏在肝細胞內質網膜上的一群酵素。',
  minutes: 9,
  stage: {
    aria: '肝細胞工廠：內質網膜上鑲嵌著藍色的 CYP 酵素，橘色藥物分子從一側流入，碰到酵素後被轉成別的分子；放大可看到酵素中心的血基質。上方圖表畫出五種代謝型的血中濃度曲線與治療窗。全部為示意。',
    caption: '拖曳旋轉 · 滑過或點擊藍色酵素看說明 · 用下方控制項切換代謝型、藥物類型與併用藥物（酵素數量、曲線與劑量皆為示意）',
  },
  blocks: [
    // ───────────── step 0：肝細胞工廠 ─────────────
    { type: 'h3', text: '藥物代謝的主戰場：肝細胞裡的工廠', step: 0 },
    {
      type: 'p',
      text: '口服的藥物吸收之後，血液會先把它送進肝臟。肝細胞的{{er|內質網}}膜上，鑲嵌著大量一類叫{{cyp450|細胞色素 P450(CYP450)}}的酵素，場景裡藍色的圓球就是它們，橘色小分子則是藥物。藥物隨血流經過，撞上酵素，就被改造成另一種分子。這一步叫{{phase-1|第一相代謝}}，多半是氧化反應。',
      step: 0,
    },
    {
      type: 'p',
      text: '改造有兩種常見結果：把藥物變得更親水、更容易排出，讓它失去作用；或把「沒有活性的藥」變成有活性的形態。後面你會看到，同一個酵素變少，對這兩種藥的後果剛好相反。（代謝還有{{phase-2|第二相}}，由 UGT（葡萄糖醛酸轉移酶）等轉移酶接上小分子官能基，也受基因影響，本章只談 CYP。）',
      step: 0,
    },
    {
      type: 'p',
      text: '第 4 章已經介紹過 CYP 家族（依 Guengerich 2024 的估計，約 80% 的小分子藥物代謝由 P450 催化；依 Zanger 與 Schwab 2013，人類約有 57 個推定具功能的 CYP 基因，其中約十來個酵素扛起多數藥物代謝），這裡不再重複，直接看它「怎麼運作」，以及基因與併用藥物怎麼改變結果。',
      step: 0,
    },

    // ───────────── step 1：酵素與藥物 ─────────────
    { type: 'h3', text: '放大一顆酵素：血基質是反應的核心', step: 1 },
    {
      type: 'p',
      text: '鏡頭拉近後，酵素頂端紅色的環是{{heme|血基質}}，中心有一個鐵原子。它能抓住氧，再把氧原子加到嵌進活性部位的藥物分子（{{substrate|受質}}）上，這就是氧化。同一種酵素可以處理許多不同的藥，所以兩種藥有時會「搶」同一批酵素，這是藥物交互作用的來源之一。「工廠」只是比喻：酵素不是會排班的工人，誰能進來，取決於分子的形狀與化學性質。',
      step: 1,
    },
    {
      type: 'p',
      text: '哪些 CYP 涉及最多藥物，第 4 章的長條圖已經看過（{{cyp3a4|CYP3A4}}/5 涉及的藥物最多，其次是 CYP2C9、{{cyp2d6|CYP2D6}}、CYP2C19；出自 Zanger 等，2008，樣本為當時美國處方前 200 名藥物）。這裡補一個容易混淆的觀念：',
      step: 1,
    },
    {
      type: 'p',
      text: '「量」和「重要性」也不是同一件事。依 1994 年一項 60 個人類肝臟檢體的定量，{{cyp3a4|CYP3A}} 約占肝臟 P450 的 30%，CYP2D6 卻只有約 2%；但 CYP2D6 參與許多常用藥，多型性又極高，所以在藥物基因體學上格外重要。',
      step: 1,
    },

    // ───────────── step 2：五種代謝型 ─────────────
    { type: 'h3', text: '五種代謝型：酵素多寡不同的五種人', step: 2 },
    {
      type: 'p',
      text: '現在場景自動輪流展示。每個基因的兩份等位基因各有「增加、正常、降低、無功能」的功能，合起來後，{{cpic|CPIC}} 在 2017 年訂出標準用語，把酵素能力分成五類：{{ultrarapid-metabolizer|超快速}}（UM）、{{rapid-metabolizer|快速}}（RM）、{{normal-metabolizer|正常}}（NM）、{{intermediate-metabolizer|中間}}（IM）、{{poor-metabolizer|不良}}（PM）代謝者。畫面上是一顆「被 CYP 清除的活性藥」：藍色的有功能酵素越多（空環越少），橘色分子被清得越快，上方曲線就越低；綠色帶是{{therapeutic-window|治療窗}}（示意）。空環代表沒有功能、或根本沒做出來的酵素。',
      step: 2,
    },
    {
      type: 'p',
      text: '怎麼從基因型算出代謝型？CYP2C19 直接看兩個等位基因的功能類別；CYP2D6 與 CYP2C9 則用{{activity-score|活性分數}}：每個等位基因給一個值（無功能 0、降低 0.25 或 0.5、正常 1），相加後依分界換算，基因若被複製就乘以拷貝數。例如 CYP2D6 的 `*1` = 1、`*4` = 0，所以 `*1/*4` = 1 + 0 = 1.0，落在 0 < AS < 1.25，是中間代謝者。',
    },
    {
      type: 'table',
      step: 2,
      caption: '五種代謝型與基因型的對應（舉例）',
      head: ['代謝型', 'CYP2C19 雙倍型舉例', 'CYP2D6 活性分數 (AS)', '酵素功能（概念）'],
      rows: [
        ['超快速 UM', '`*17/*17`', 'AS > 2.25', '很高'],
        ['快速 RM', '`*1/*17`', '（CYP2D6 沒有此類）', '偏高'],
        ['正常 NM', '`*1/*1`', '1.25 ≤ AS ≤ 2.25', '正常'],
        ['中間 IM', '`*1/*2`、`*2/*17`', '0 < AS < 1.25', '偏低'],
        ['不良 PM', '`*2/*2`、`*2/*3`', 'AS = 0', '幾乎沒有'],
      ],
      note: 'CYP2C19：依 CPIC 定義，`*1` 正常、`*2` 與 `*3` 無功能、`*17` 增加功能。CYP2D6：分界來自 2019–2020 年 CPIC 與荷蘭藥物基因體學工作組（DPWG）專家共識（37 位專家、82% 同意）。CYP2D6 不設快速代謝者類別。引用活性分數時請標明版本與日期，見下方進階說明。',
    },
    {
      type: 'facts',
      step: 2,
      items: [
        {
          value: '13% vs 2.4%',
          label: 'CYP2C19 不良代謝者比例：東亞人 vs 歐洲人（CPIC 推估）',
          note: '主因是無功能的 `*2` 與 `*3` 在東亞較常見。這是 CPIC 由文獻等位基因頻率、以哈迪-溫伯格（Hardy-Weinberg）公式推算的族群層級估計，不是台灣人的實測值。「不良」是功能分類，並不罕見，也不是疾病。',
        },
      ],
    },
    {
      type: 'callout',
      kind: 'taiwan',
      step: 2,
      text: 'Lu 等人（2022）分析 172,854 位台灣漢人的基因型資料，並連結中國醫藥大學附設醫院的病歷：在有 clopidogrel 處方紀錄的病人中，約 61%（6,414 人）的 CYP2C19 表現型被作者歸為「依 FDA 建議應調整治療」者（作者把中間與不良代謝者都算進去；現行美國 Plavix 仿單的黑框警語只點名不良代謝者，中間代謝者的「避免標準劑量」則來自 CPIC 2022 指引，兩者差異見第 6 章）。原文寫「其中 46% 為中間、14% 為不良代謝者」，語意含糊；因 46% + 14% 約等於 61%，本站解讀為兩者各自占全部 clopidogrel 處方者的比例（推論，非原文明示）。這是單一醫療體系的處方紀錄，不等於全台灣人口，也不代表這些人療效不佳。',
    },

    // ───────────── step 3：前驅藥 vs 活性藥 ─────────────
    { type: 'h3', text: '同樣是「不良代謝者」，結果可以完全相反', step: 3 },
    {
      type: 'p',
      text: '場景現在固定在不良代謝者（PM），並輪流換兩種藥。關鍵問題是：這顆藥要靠 CYP「啟動」才有效，還是靠 CYP「清掉」才會停止作用？',
      step: 3,
    },
    {
      type: 'compare',
      step: 3,
      left: {
        title: '{{prodrug|前驅藥}}：CYP 把它變活',
        items: [
          '例：可待因（codeine，CYP2D6 → 嗎啡 morphine）、氯吡格雷（clopidogrel，CYP2C19 活化）、泰莫西芬（tamoxifen，CYP2D6 → endoxifen）',
          '酵素少（PM）：活性物不足，可能沒效（可待因、氯吡格雷較明確；tamoxifen 的臨床結局證據並不一致）',
          '酵素多（UM）：活性物可能過多（可待因已有中毒案例；其他前驅藥的風險證據較弱）',
        ],
      },
      right: {
        title: '被 CYP 清掉的藥（母藥為主要作用形態）',
        items: [
          '例：warfarin（S-warfarin 主要經 CYP2C9）、多數質子幫浦抑制劑（CYP2C19）、metoprolol(CYP2D6)',
          '酵素少（PM）：暴露量上升（warfarin、metoprolol 有出血或心搏過緩等風險；質子幫浦抑制劑多半只是暴露量增加，臨床風險較低）',
          '酵素多（UM）：清得太快，可能沒效',
        ],
      },
    },
    {
      type: 'p',
      text: '所以「不良代謝者」不是壞消息的同義詞，「超快速」也不是好消息；也有母藥與代謝物都有作用的混合型（如 tramadol），得個別判讀。場景的前驅藥只有一小部分母藥被轉成活性物，很像氯吡格雷：大部分藥量會被 {{ces1|CES1}} 等酵素水解掉，只有一小部分走進需要 CYP 的活化途徑（比例與指引建議見第 6 章）。',
      step: 3,
    },
    {
      type: 'callout',
      kind: 'clinical',
      step: 3,
      text: '這一章只記住「方向」：前驅藥怕酵素少，被清除的活性藥怕酵素少的原因剛好相反。可待因與氯吡格雷的藥動學數據、CPIC 指引建議與強度，留到第 6 章的案例逐一看。指引寫法不是用藥建議，是否調整請由醫師或藥師判斷。',
    },

    // ───────────── step 4：抑制劑與表現型轉換 ─────────────
    { type: 'h3', text: '抑制劑：基因正常的人，也可能「暫時變成不良代謝者」', step: 4 },
    {
      type: 'p',
      text: '場景現在是一位基因型正常（NM）的人在吃前驅藥。約兩秒後，強效{{inhibitor|抑制劑}}登場：洋紅色的塞子堵住酵素，有功能的酵素幾乎全被堵住，活性物的曲線隨之下沉，前緣光條的顏色也隨「實際」代謝型改變。他的基因沒變，卻「實際上」像個不良代謝者。這就是{{phenoconversion|表現型轉換}}：基因型預測的代謝能力，與實際能力因非遺傳因素而不一致。',
      step: 4,
    },
    {
      type: 'p',
      text: '依 FDA 的定義，強效抑制劑使敏感受質的 {{auc|AUC}} 增加至少 5 倍，中效則是 2 倍以上、未滿 5 倍；fluoxetine 與 paroxetine 是 CYP2D6 的強效抑制劑。CPIC 2021 鴉片類指引因此有一條實務規則：併用強效 CYP2D6 抑制劑，把活性分數視為 0；併用中效抑制劑，活性分數乘以 0.5。例如活性分數 2.0 的正常代謝者併用 paroxetine，就當作 AS 0 的不良代謝者。場景的「強效」「中效」按鈕，就是這個概念的示意。',
      step: 4,
    },
    {
      type: 'callout',
      kind: 'clinical',
      step: 4,
      text: '這類{{ddgi|「藥物—藥物—基因」交互作用}}有實際的仿單警示。依美國 Plavix（clopidogrel）仿單，應避免併用 omeprazole 或 esomeprazole，因為它們會抑制 CYP2C19，顯著降低 clopidogrel 的抗血小板作用。這是美國仿單的內容，台灣仿單請以衛生福利部食品藥物管理署（TFDA）核准的版本為準（本站未查證）。',
    },
    {
      type: 'p',
      text: '{{inducer|誘導劑}}則相反，是讓細胞多做酵素：被清除的活性藥，濃度會下降；需要活化的前驅藥，活性物反而會增加（場景中可切換藥物類型觀察）。但誘導只適用於「可被誘導」的酵素：CPIC 2021 鴉片類指引指出，目前沒有證據顯示藥物會對 CYP2D6 產生臨床上有意義的誘導。',
      step: 4,
    },
    {
      type: 'callout',
      kind: 'warn',
      step: 4,
      title: '葡萄柚的交互作用，不是由你的 CYP 基因型造成的',
      text: '第 4 章看過葡萄柚與 felodipine 的例子。從機轉看，葡萄柚的呋喃香豆素會與腸道 CYP3A4 共價結合，使酵素{{mechanism-based-inhibition|不可逆失活}}，要等細胞新合成酵素才恢復，所以效應會持續很久，而且與你帶哪種 CYP 變異無關。倍數因藥而異，正在服藥者請問藥師。',
    },
    {
      type: 'deepdive',
      title: '表現型轉換的三種來源：抑制、不可逆抑制與誘導，時程完全不同',
      blocks: [
        {
          type: 'table',
          head: ['方式', '例子', '對酵素做了什麼', '生效與消退（依來源）'],
          rows: [
            ['抑制', 'fluoxetine、paroxetine、bupropion(CYP2D6)', '降低酵素活性（數量不變）；機轉因藥而異，例如 paroxetine 在體外有近似機轉型失活的證據，fluoxetine 則未見這種預先培養增強（Bertelsen 2003）', '起效與消退因藥而異，不能一概而論；bupropion 的美國仿單提到，效應在停藥後至少持續 7 天'],
            ['機轉型（不可逆）抑制', '葡萄柚呋喃香豆素（腸道 CYP3A4）', '酵素被共價結合而永久失活', '需等新合成酵素；24 小時後仍剩約 25% 效應'],
            ['誘導', 'rifampin（經核受體 {{pxr|PXR}}，作用於 CYP3A4、CYP2C 等）', '讓細胞多做酵素，數量增加', '約 1 週達完全誘導，停藥後約 2 週消退'],
          ],
          note: 'bupropion 的資料來自美國仿單（15 位 CYP2D6 廣泛代謝者，desipramine 的 Cmax、AUC 與半衰期平均分別增加約 2、5、2 倍）。rifampin 的時程來自綜述。誘導是「增加酵素數量」，與抑制的「直接擋住活性」機轉與時程都不同，因此停藥後濃度的變化方向也不同。',
        },
        {
          type: 'p',
          text: '表現型轉換的系統性回顧（Klomp 等，2020，27 項研究）整理出：併用 CYP 抑制劑、年齡增加、癌症與發炎，使人偏向較低的代謝者；CYP 誘導劑與吸菸，使人偏向較高的代謝者，酒精、懷孕與維生素 D 也有跡象。但作者也指出，這些轉換對療效與毒性的臨床影響仍不清楚，機轉與程度也未充分探討。教學上的結論是：基因檢測是「基線」，實際用藥時還要疊加藥物與生理狀態。',
        },
        {
          type: 'p',
          text: '不同指引處理抑制劑的方式並不一致。CPIC 鴉片類指引用「調整活性分數」；而 CPIC 2018 的 tamoxifen 指引以「所有病人都應避免併用中度以上的 CYP2D6 抑制劑」為主。所以看報告時，要問這是哪一份指引、哪一年的規則。',
        },
      ],
    },
    {
      type: 'deepdive',
      title: '活性分數怎麼算？小心版本陷阱',
      blocks: [
        {
          type: 'table',
          caption: 'CYP2D6 等位基因活性值（CPIC 現行功能表，含 2023 年更新）',
          head: ['等位基因', '活性值', '雙倍型舉例與活性分數（由左邊相加）', '代謝型'],
          rows: [
            ['`*1`、`*2`', '1', '`*1/*1` = 2.0', '正常 NM'],
            ['`*17`、`*29`', '0.5', '`*1/*4` = 1.0', '中間 IM'],
            ['`*9`、`*10`、`*41`', '0.25', '`*10/*10` = 0.5', '中間 IM'],
            ['`*3`、`*4`、`*5`、`*6`', '0（無功能）', '`*4/*4` = 0', '不良 PM'],
            ['基因複製 `*1x2`', '1 × 拷貝數', '`*1/*1x2` = 1 + 2 = 3.0', '超快速 UM'],
          ],
          note: '雙倍型的分數由本表活性值相加，再依上文的分界換算，例如 `*1/*10` = 1.25（剛好落在正常的下緣）。',
        },
        {
          type: 'p',
          text: '這張表有版本。2019–2020 年的共識把 `*10` 從 0.5 降為 0.25，並把 AS = 1.0 由正常改為中間、AS = 2.25 由超快速改為正常（相對於舊 CPIC 制；舊 DPWG 制本來就把 0.5 到 1 歸為中間）；`*9` 與 `*41` 則在 ClinPGx 於 2023-03-20 公告的等位基因功能表更新中降為 0.25（CPIC 網站上 `*41` 的活性值則早在 2022-11-08 就已由 0.5 下修為 0.25；各資料庫實際上線日略有差異）。所以同一個 `*1/*41`，在舊文獻是 1.5，現行是 1.25。看報告或引用論文時，必須確認用的是哪個版本。',
        },
        {
          type: 'p',
          text: '加總模型有它的限制：它假設兩個等位基因的效果可以相加，是臨床可用的簡化，不等於直接測得的酵素活性。另外，依 CPIC 彙整，東亞人 CYP2D6 的特色是降低功能的 `*10` 很常見（約 43%），無功能的 `*4` 卻很少（約 0.5%），所以東亞人的 CYP2D6 問題多半是「功能偏低」而不是「完全沒有」。這些是族群層級的估計，不是台灣人的實測，不同研究因檢測平台與判讀規則不同，數字差異也很大。',
        },
      ],
    },

    // ───────────── step 5：總結 ─────────────
    { type: 'h3', text: '把它們疊在一起：基因是基線，不是水晶球', step: 5 },
    {
      type: 'p',
      text: '場景回到全景，示範一位基因型正常、併用中效抑制劑的人：虛線是基因型預測的基線，實線是疊上藥物後的實際情況，接著換你操作。實際的代謝能力像疊積木：基因型是「基線」，上面再疊併用藥物、年齡、肝腎功能、發炎、吸菸等因素。即使同為正常代謝者，個體間的藥物暴露量仍差異很大（CPIC codeine 指引特別指出）。所以「測了基因就知道一切」是誤會；「有變異就必須改處方」也是：CPIC 的基因與藥物配對必須是 A 或 B 級證據，才足以作為處方行動的依據。',
      step: 5,
    },
    {
      type: 'callout',
      kind: 'warn',
      step: 5,
      title: '這個場景是示意，不是給藥工具',
      text: '畫面上的酵素數量、曲線、劑量、治療窗與「誘導 ×1.5」都是為了教學而挑的示意值，不屬於任何真實藥物或族群。它不能用來估算劑量，也不能取代醫師與藥師的判斷。如果你正在服藥，請不要因為本章內容自行停藥或改藥。',
    },
    {
      type: 'keypoints',
      title: '本章重點',
      items: [
        'CYP450 是肝細胞內質網上的一大群含血基質的酵素；近年綜述估計約 80% 的小分子藥物代謝由 P450 催化（第 4 章已介紹，數字有定義與資料集的限制）。',
        '真正的主力只有十來個，但「含量」「涉及的藥物比例」「多型性」是三件不同的事。',
        '基因型經 CPIC 的標準用語，對應成 UM、RM、NM、IM、PM 五種代謝型；CYP2D6 與 CYP2C9 用活性分數，CYP2D6 沒有快速代謝者。',
        '前驅藥與活性藥的後果相反：PM 對前驅藥是「活性物不足」，對被清除的活性藥則是「藥物堆積」。',
        '強效抑制劑可讓 NM 暫時像 PM（表現型轉換）；誘導劑則讓酵素變多。基因檢測只是基線。',
        '所有臨床建議都要標明指引、版本與證據強度；本站的模擬僅為示意。',
      ],
    },
  ],
  quiz: [
    {
      q: '某位 CYP2D6 不良代謝者（PM）服用可待因（codeine）後，最可能發生什麼事？',
      options: [
        'morphine 生成過多，容易出現中毒反應',
        'codeine 幾乎無法被吸收，血中通常測不到',
        'morphine 生成不足，止痛效果可能不佳',
        'codeine 被清得太快，止痛作用提早消失',
      ],
      answer: 2,
      explain: '可待因是前驅藥，要靠 CYP2D6 轉成嗎啡（morphine）才有主要止痛作用。PM 的酵素幾乎沒有功能，活性物不足，吃了藥卻幾乎沒有止痛。相反地，超快速代謝者才可能 morphine 生成過多而有中毒風險。可待因的吸收與 CYP2D6 無關，具體的指引建議與數據見第 6 章。',
    },
    {
      q: '「活性藥被 CYP 清除」與「前驅藥被 CYP 活化」，對不良代謝者（PM）的後果有何不同？',
      options: [
        '兩類藥都可能因酵素不足而沒效，只是程度有所不同',
        '前驅藥可能因活性物不足而沒效，活性藥可能因清不掉而堆積',
        '前驅藥的活性物可能過多而堆積，被清除的活性藥可能因此沒效',
        '兩類藥的暴露量通常都會上升，因為酵素少而清得比較慢',
      ],
      answer: 1,
      explain: '前驅藥需要 CYP 把它變活，酵素少就變不出足夠的活性物，可能沒效；活性藥靠 CYP 清除，酵素少就清不掉、越積越多，風險可能升高。判斷「不良代謝者好不好」，要先問這顆藥是哪一型。',
    },
    {
      q: '一位 CYP2D6 基因型為正常代謝者（AS 2.0）的人，併用強效 CYP2D6 抑制劑 paroxetine。依 CPIC 2021 鴉片類指引的實務規則，他應被視為？',
      options: [
        '不良代謝者（活性分數視為 0）',
        '中間代謝者（活性分數乘以 0.5）',
        '正常代謝者（基因型不變而分類不變）',
        '超快速代謝者（抑制劑使活性增加）',
      ],
      answer: 0,
      explain: '依 CPIC 2021 鴉片類指引，併用強效 CYP2D6 抑制劑時把活性分數視為 0，當成不良代謝者；併用中效抑制劑才是活性分數乘以 0.5。基因型沒變，但實際能力不同，這種落差稱為表現型轉換。',
    },
    {
      q: '下列關於 CYP 酵素「含量」與「重要性」的敘述，哪一個最正確？',
      options: [
        '肝臟含量最高的酵素，在藥物基因體學上通常也是最重要的',
        '含量很低的酵素，在臨床上通常可以忽略，不必特別留意或檢測',
        '各種 CYP 酵素的肝臟含量都相近，因此重要性也大致相同',
        'CYP2D6 含量僅約 2%，仍因常用藥多且多型性高而重要',
      ],
      answer: 3,
      explain: '依 1994 年的免疫化學定量，CYP3A 約占肝臟 P450 的 30%，CYP2D6 僅約 2%。含量、涉及的藥物比例、多型性是三件不同的事，不能互相取代，所以含量低不代表可以忽略。',
    },
    {
      q: '喝葡萄柚汁與 CYP3A4 的交互作用，下列哪一項說法正確？',
      options: [
        '只影響帶有 CYP3A4 變異的人，一般人通常不會受到影響',
        '抑制屬於可逆，停止飲用後數分鐘酵素通常就會完全恢復',
        '呋喃香豆素使腸道 CYP3A4 不可逆失活，與基因型無關',
        '葡萄柚會誘導肝臟多做 CYP3A4，因此藥物濃度通常下降',
      ],
      answer: 2,
      explain: '呋喃香豆素使腸道 CYP3A4 不可逆失活，要等新合成酵素才恢復，所以效應持續很久（Bailey 2013；felodipine 的具體倍數見第 4 章）。這是抑制而非誘導，與是否帶有 CYP 變異無關；倍數因藥而異、個體差異大，不能推廣到所有藥物。',
    },
  ],
  sources: [
    { name: 'Guengerich 2024:Roles of Individual Human Cytochrome P450 Enzymes in Drug Metabolism', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11549934/', note: '約 80% 小分子藥物代謝的估計，資料為 2015–2020 年 FDA 核准的 245 個新小分子藥物' },
    { name: 'Zanger & Schwab 2013:Cytochrome P450 enzymes in drug metabolism', url: 'https://pubmed.ncbi.nlm.nih.gov/23333322/', note: '57 個功能基因、約十來個酵素負責 70–80% 的臨床藥物' },
    { name: 'Zanger 等 2008:Functional pharmacogenetics/genomics of human cytochromes P450', url: 'https://pubmed.ncbi.nlm.nih.gov/18695978/', note: '美國前 200 名處方藥中各 CYP 涉及的比例' },
    { name: 'Shimada 等 1994：人類肝臟 P450 含量', url: 'https://pubmed.ncbi.nlm.nih.gov/8035341/', note: '60 個肝臟檢體；CYP3A 約 30%、CYP2D6 約 2%' },
    { name: 'Caudle 等 2017:CPIC 標準化用語共識', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5253119/', note: '超快速、快速、正常、中間、不良代謝者的標準用語與德爾菲過程' },
    { name: 'Caudle 等 2020:CYP2D6 基因型轉表現型共識（CPIC 與 DPWG）', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6951851/', note: '活性分數與分界（AS > 2.25、1.25–2.25、0 < AS < 1.25、0）' },
    { name: 'ClinPGx:CYP2D6 allele function update(2023-03-20)', url: 'https://blog.clinpgx.org/cyp2d6-allele-function-update/', note: '*9 與 *41 活性值由 0.5 降為 0.25' },
    { name: 'CPIC 資料庫 API:gene_result(CYP2C19)', url: 'https://api.cpicpgx.org/v1/gene_result?genesymbol=eq.CYP2C19', note: '哈迪-溫伯格（Hardy-Weinberg）推估的族群層級頻率（2026-09 擷取，會隨資料庫更新）' },
    { name: 'CPIC 資料庫 API:diplotype(CYP2C19)', url: 'https://api.cpicpgx.org/v1/diplotype?genesymbol=eq.CYP2C19', note: '雙倍型對應表現型' },
    { name: 'CPIC 資料庫 API:gene_result(CYP2D6)', url: 'https://api.cpicpgx.org/v1/gene_result?genesymbol=eq.CYP2D6', note: '東亞與歐洲的 *10、*4 頻率' },
    { name: 'Lu 等 2022:Comprehensive characterization of pharmacogenes in a Taiwanese Han population', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9452738/', note: '172,854 位台灣漢人；clopidogrel 處方紀錄者的 CYP2C19 表現型推估' },
    { name: 'Crews 等 2021:CPIC CYP2D6、OPRM1、COMT 與鴉片類指引', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8249478/', note: 'codeine 建議、morphine 暴露量數據、抑制劑的活性分數調整規則' },
    { name: 'Lee 等 2022:CPIC CYP2C19 與 clopidogrel 指引更新', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9287492/', note: '約 15% 活化、約 85% 被 CES1 水解；各適應症的建議強度' },
    { name: 'Johnson 等 2017:CPIC warfarin 指引更新', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5546947/', note: 'S-warfarin 主要由 CYP2C9 代謝' },
    { name: 'Lima 等 2021:CPIC CYP2C19 與質子幫浦抑制劑指引', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7868475/', note: 'PPI 主要由 CYP2C19 代謝成無活性產物' },
    { name: 'Goetz 等 2018:CPIC CYP2D6 與 tamoxifen 指引', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5931215/', note: 'tamoxifen 前驅藥機轉；避免併用中度以上 CYP2D6 抑制劑' },
    { name: 'Duarte 等 2024:CPIC β 阻斷劑指引', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11502236/', note: 'metoprolol 經 CYP2D6 代謝' },
    { name: 'Deb 等 2024:FDA 標示與 CPIC 證據等級比較', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10972161/', note: 'CPIC A、B 級才足以作為處方行動的依據' },
    { name: 'FDA:Table of Substrates, Inhibitors and Inducers', url: 'https://www.fda.gov/drugs/drug-interactions-labeling/drug-development-and-drug-interactions-table-substrates-inhibitors-and-inducers', note: '強效與中效抑制劑的定義、指標抑制劑（頁面內容更新至 2023-06-05）' },
    { name: 'DailyMed:Wellbutrin XL 美國仿單', url: 'https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/a435da9d-f6e8-4ddc-897d-8cd2bf777b21.xml', note: 'bupropion 抑制 CYP2D6 與 desipramine 暴露量' },
    { name: 'DailyMed:Plavix 美國仿單', url: 'https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/de8b0b67-eb25-4684-83b5-7ad785314227.xml', note: '避免併用 omeprazole 或 esomeprazole（台灣仿單以 TFDA 核准內容為準，本站未查證）' },
    { name: 'Bailey 等 2013:Grapefruit-medication interactions', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3589309/', note: '機轉型抑制腸道 CYP3A4、felodipine 的倍數與時程' },
    { name: 'Niemi 等 2003:Pharmacokinetic interactions with rifampicin', url: 'https://pubmed.ncbi.nlm.nih.gov/12882588/', note: '誘導與消退的時程（約 1 週達完全誘導、約 2 週消退）' },
    { name: 'Chen & Raymond 2006:Roles of rifampicin in drug-drug interactions', url: 'https://pubmed.ncbi.nlm.nih.gov/16480505/', note: 'rifampin 經核受體 PXR 誘導的分子機轉' },
    { name: 'Bertelsen 等 2003:Apparent mechanism-based inhibition of human CYP2D6 in vitro by paroxetine', url: 'https://pubmed.ncbi.nlm.nih.gov/12584155/', note: 'paroxetine 在體外的近似機轉型失活；與 fluoxetine、quinidine 比較' },
    { name: 'Klomp 等 2020:Phenoconversion of Cytochrome P450 Metabolism', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7565093/', note: '27 項研究的系統性回顧；臨床影響尚不清楚' },
  ],
}
