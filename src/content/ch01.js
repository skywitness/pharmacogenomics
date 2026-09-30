// ch01 內容：同一顆藥，為什麼效果不一樣？（L1 入門）
// 事實來源：research/intro-history.verified.json。
// 標「（未查核）」註記的事實，內文一律以明確歸屬的措辭使用。
export default {
  id: 'ch01',
  no: 1,
  level: 1,
  title: '同一顆藥，為什麼效果不一樣？',
  subtitle: '從三個人的故事，看見「個體差異」，以及藥物基因體學想解開的謎',
  minutes: 10,
  stage: {
    aria: '互動式 3D 場景：60 位模擬的人圍著一顆發光的藥丸，吃藥後依結果亮起綠色（有效）、黃灰色（沒效）或紅色（嚴重副作用），並可依年齡、體重、肝腎功能、併用藥物或基因型重新分組觀察。',
    caption: '拖曳旋轉 · 點一下人物看細節 · 按「大家一起吃藥」，再用下方選項換個角度看這群人（全部為模擬示意）',
  },
  blocks: [
    // ───────── step 0：故事與初始畫面 ─────────
    { type: 'h3', text: '三個人，同一顆藥', step: 0 },
    {
      type: 'p',
      text: '先想像三個人。以下是**虛構**的情境，但類似的事每天都在診間發生。',
      step: 0,
    },
    {
      type: 'p',
      text: '小雅、阿明和老周得了同一種病，拿到同一種藥、同一個劑量，也都照著醫囑按時吃。一星期後：小雅的症狀明顯好轉；阿明幾乎沒有感覺，醫師只好換藥；老周卻出現嚴重的不良反應，必須立刻處理。',
    },
    {
      type: 'p',
      text: '同一顆藥，三種結局。這不只是「誰比較聽話」或「誰運氣比較差」。畫面中是 60 位**模擬**的人圍成一圈，中央是一顆發光的藥丸。這些人和他們的結果，全部是程式產生的**示意資料**，不是真實統計，只是幫你把「人人不同」看清楚。',
    },

    // ───────── step 1：吃藥 → 結果分布 ─────────
    { type: 'h3', text: '吃下去之後，結果不會一樣', step: 1 },
    {
      type: 'p',
      text: '捲到這裡時，畫面中的小藥丸會飛向每個人；想再看一次，可以按「大家一起吃藥」（手機請點舞台下方的「⚙ 互動控制項」展開操作區）。綠色代表有效、黃灰色代表沒效、紅色代表嚴重副作用（除了顏色，也分別用上升的光環、橫線和閃爍的警示三角標示）。同一顆藥、同一個劑量，卻一次出現三種結果。',
      step: 1,
    },
    {
      type: 'p',
      text: '這只是示意，但現實中也有類似的訊號。下面兩個數字都來自已發表的研究，請留意每一條的但書：',
    },
    {
      type: 'facts',
      items: [
        {
          value: '6.5%',
          label: '英國兩家大型醫院的 18,820 名入院病人中，1,225 人的入院與{{adr|藥物不良反應}}有關',
          note: 'Pirmohamed 等，BMJ 2004（英格蘭默西塞德郡）。最常涉及低劑量阿斯匹靈、利尿劑、warfarin（抗凝血藥）與非阿斯匹靈類消炎止痛藥，研究並未評估基因原因。',
        },
        {
          value: '約 500 萬',
          label: '一般人的基因體與參考基因體相比，平均帶有的{{snv|單核苷酸變異}}（SNV，單一字母的差異）數量',
          note: 'NHGRI Fact Sheet：Human Genomic Variation。多數變異對藥物反應沒有影響，但這說明了「每個人的底層設定都略有不同」。',
        },
      ],
    },
    {
      type: 'p',
      text: '你也許在新聞裡看過「暢銷藥只對少數人有效」這類說法。這種數字很容易被誤讀（例如把{{nnt|需治療人數}}當成有效者的比例），文末的進階說明會一步步拆解。',
    },

    // ───────── step 2：換因素看分組 ─────────
    { type: 'h3', text: '影響藥物反應的，不只是基因', step: 2 },
    {
      type: 'p',
      text: '為什麼同一顆藥的結果不同？原因通常不只一個。畫面中的「用什麼因素來看這群人？」可以讓人群依不同因素重新排列、分組。先選「年齡」試試看：',
      step: 2,
    },
    {
      type: 'list',
      items: [
        '**年齡**：年長者的肝腎功能與身體組成常和年輕人不同，藥物留在體內的時間與濃度也跟著改變。',
        '**體重**：同樣的劑量，分散到不同體型的身體裡，濃度會不一樣。',
        '**肝腎功能**：肝臟負責代謝藥物、腎臟負責排出，功能較弱時，藥留得更久。',
        '**{{ddi|併用藥物}}**：一種藥可能加強或削弱另一種藥的作用。',
        '**{{adherence|服藥遵從性}}、飲食與抽菸**：有沒有規律服藥，常被低估；吸菸也可能改變某些酵素的活性。',
        '**基因**：本章的主角，稍後登場。',
      ],
    },
    {
      type: 'p',
      text: '選「年齡」後，人群會分成三堆。你會發現每一堆裡仍是紅黃綠混雜：年齡有影響，但分不乾淨。畫面說明列與讀數裡的「分群清楚度」就在量這件事：各組中「占多數的結果」平均占幾成（全體不分組時約 52%）；如果分組後的數字和不分組差不多，就代表這個因素分不開結果。每組下方的長條，則是該組綠、黃、紅三種結果的比例。逐一試試體重、肝腎功能與併用藥物，你會看到類似的情形。',
    },
    {
      type: 'p',
      text: '這些因素還會互相牽動。一篇系統性回顧（Klomp 等，2020）整理發現：併用會抑制酵素的藥物、年齡增加、癌症與發炎，會使實際的代謝能力低於基因的預測；併用誘導酵素的藥物與吸菸則相反。這種現象叫{{phenoconversion|表現型轉換}}（表現型是身體實際表現出來的特徵，例如此刻的代謝能力；檢測報告常給的是「由基因型預測」的表現型，第 3 章會細講）。基因型終身不變，但一個人「此刻」的實際反應，卻可能因為這些因素而不同，不過這些差異對臨床療效與副作用的實際影響，目前研究仍不明確。',
    },

    // ───────── step 3：基因分組 ─────────
    { type: 'h3', text: '基因：其中一個「可以檢測」的因素', step: 3 },
    {
      type: 'p',
      text: '現在把因素換成{{genotype|基因型}}（一個人在某個基因上實際帶有的版本組合）。這裡的基因是虛構的，共有三種版本，「甲、乙、丙」只是方便稱呼的代號。在這份示意資料裡，同一基因型的人幾乎都是同一種顏色：基因型甲的人多半有效，乙多半沒效，丙多半出現副作用。這是刻意設計成「最容易看懂」的情境；真實世界裡，不同的藥、不同的基因，各組結果不會分得這麼乾淨。',
      step: 3,
    },
    {
      type: 'p',
      text: '基因為什麼會造成這種差別？因為 DNA 上的差異，可能改變處理藥物的酵素、運送藥物的轉運蛋白，或藥物作用的目標蛋白，使同一劑量在不同人身上產生不同的結果（Evans 與 Relling,Science 1999）。把這件事系統化研究的學問，就是{{pharmacogenomics|藥物基因體學}}：它研究 DNA 與 RNA 特徵的變異和藥物反應之間的關係；只看 DNA 序列變異的{{pharmacogenetics|藥物遺傳學}}是它的子集，日常兩個詞常被互換使用（正式定義見文末進階說明）。',
    },
    {
      type: 'callout',
      kind: 'warn',
      title: '別被「太乾淨」的畫面騙了',
      text: '**基因是重要的拼圖，但不是全部：真實世界的結果不會像這個畫面這麼整齊。**這份資料是為了教學而整理的。以最常被引用的經典範例之一 warfarin（華法林，一種抗凝血藥）為例，國際 Warfarin 藥物遺傳學聯盟（IWPC）2009 年的研究報告指出：在 1,009 人的驗證世代中，納入基因資訊的演算法可解釋約 43% 的穩定劑量變異，只用臨床變項（如年齡、體重）為 26%。加了基因之後，仍有一半以上的差異來自其他或未知的因素。（這是預測劑量的統計模型，不等於已證實能改善臨床結果。）',
    },

    // ───────── step 4：個別化用藥 ─────────
    { type: 'h3', text: '如果事先知道，可以怎麼用？', step: 4 },
    {
      type: 'p',
      text: '打開「依基因型個別化用藥（示意假設）」：畫面中，基因型乙、丙裡原本沒效或有副作用的人，有一部分因為調整了用藥而改善，綠色的人變多了（改善的人會被青色圓環與箭頭標出來）。請注意，**改善幅度是我們自己假設的**，並不是任何研究的結果，只是說明「事先知道」可能帶來的方向。',
      step: 4,
    },
    {
      type: 'compare',
      left: {
        title: '一體適用',
        items: ['所有人同一種藥、同一個起始劑量', '好處：簡單、成本低，對多數人適用', '限制：對帶有特定基因變異的人，可能無效或風險較高', '往往要等結果不理想，才知道需要換藥'],
      },
      right: {
        title: '參考基因結果調整',
        items: ['用藥前先取得相關基因的檢測結果', '指引（如 CPIC、DPWG）依基因型建議選藥或調整劑量', '限制：只適用於已有證據的「基因—藥物配對」', '基因只是因素之一，仍需搭配年齡、肝腎功能等臨床資訊'],
      },
    },
    {
      type: 'p',
      text: '真實研究量到的差距小得多，而且因藥物與研究設計而異。例如歐洲的 PREPARE 試驗依 12 個基因的面板調整用藥，不良反應確實少了一些，但幅度遠不如這個示意畫面，也不代表每個人都會受益（數字與但書見文末進階說明）。',
    },
    {
      type: 'p',
      text: '你可能聽過「幾乎每個人都帶有至少一個可採取行動的變異」。那是把多個基因累計起來的結果，並不代表每個處方都得改（細節見文末的進階說明）。另外，「個人化醫療」容易被誤會成「為每個人設計專屬的藥」；有文獻引述美國國家研究委員會（NRC）2011 年報告的立場，認為「{{precision-medicine|精準醫療}}」一詞更貼切，因為重點是把病人分成疾病或治療反應不同的亞群。',
    },

    // ───────── 三條途徑 ─────────
    { type: 'h3', text: '基因影響藥物反應的三條路' },
    {
      type: 'p',
      text: '接下來的章節會一條一條走。現在先在腦中放一張地圖，只點到為止：',
    },
    {
      type: 'steps',
      title: '三條作用途徑',
      items: [
        { title: '① 藥怎麼被「處理」', text: '藥物在身體裡被吸收、代謝、排出的過程稱為{{pk|藥物動力學}}。{{metabolizing-enzyme|代謝酵素}}或轉運蛋白的差異，會讓藥物濃度太高或太低。' },
        { title: '② 藥「作用的目標」', text: '藥物影響身體的方式稱為{{pd|藥效學}}。受體或其他標靶蛋白的差異，可能讓相同濃度的藥，作用強弱不同。' },
        { title: '③ 免疫系統的「誤判」', text: '某些{{hla|HLA}}版本的人，遇到特定藥物時，免疫系統可能誤認並發動攻擊，造成嚴重過敏。這和「藥太多或太少」是不同的機制。' },
      ],
    },
    {
      type: 'p',
      text: '前兩條對應 Evans 與 Relling（1999）所整理的「代謝酵素、轉運蛋白、受體與其他藥物標靶蛋白的多型性」；而 1957 年 Motulsky 在 JAMA 的經典文章，已經把「免疫機制的藥物過敏」與「藥效過度或不足」分開來談。',
    },
    {
      type: 'table',
      caption: '三條途徑各舉一個例子（細節在後面的章節）',
      head: ['途徑', '白話說法', '例子', '本站章節'],
      rows: [
        ['① 處理', '藥被轉化得太快或太慢', '{{cyp2c19|CYP2C19}}（一個基因，製造肝臟裡處理藥物的酵素）與抗血小板藥 clopidogrel（用來預防血栓）', '第 4、5、6 章'],
        ['② 目標', '藥的作用目標不同', '抗凝血藥 warfarin 的作用目標 `VKORC1`', '第 6 章'],
        ['③ 免疫', '免疫系統誤判', '`HLA-B*15:02` 與抗癲癇藥 carbamazepine（與 SJS/TEN 這種嚴重皮膚過敏有關）', '第 7 章'],
      ],
      note: '這只是「配對」的示意，不是用藥建議。各配對的證據強度與指引內容，請見對應章節。',
    },
    {
      type: 'callout',
      kind: 'taiwan',
      title: '台灣的一個重要發現（預告）',
      text: '**一句話版本：台灣的研究發現，用藥前先篩檢 `HLA-B*15:02`，陽性者改用其他藥，篩檢陰性而使用 carbamazepine（卡巴馬平，常用的抗癲癇藥）的人，沒有人發生嚴重的皮膚過敏 {{sjs-ten|SJS/TEN}}。**\n數字如下：Chen 等（NEJM 2011）在 23 家醫院，對 4,877 名尚未使用該藥的受試者先做篩檢，其中 7.7% 為陽性，被建議避開該藥；陰性者使用後無人發生 SJS/TEN，依歷史發生率 0.23% 推估，原本約會有 10 例。\n讀這個結果請留意兩點：它是以歷史發生率當對照，並非隨機分派，證據強度不如隨機試驗；而且陽性不等於一定發病，多數陽性者其實不會發病。\n當時衛生署的新聞稿表示，自 2010 年 6 月 1 日起，用藥前的 `HLA-B*15:02` 檢測納入全民健保給付（現行給付條件請以健保署最新規定為準）。第 7 章會詳細介紹。',
    },

    // ───────── 整理 ─────────
    {
      type: 'keypoints',
      title: '這一章的重點',
      items: [
        '同一顆藥、同一個劑量，人人反應不同是「常態」，不是例外。',
        '原因是多重的：年齡、體重、肝腎功能、併用藥物、服藥習慣，以及基因。',
        '基因是其中一個「可以檢測、終身不變」的因素，但只解釋一部分：連 warfarin，基因加臨床資料也只解釋約 43% 的劑量變異（IWPC,2009）。',
        '藥物基因體學研究基因變異如何影響藥物反應，目標是讓用藥更有效、更安全；它是精準醫療的一部分，不是萬能的預言。',
        '基因影響藥物的三條路：藥怎麼被處理、藥作用的目標、免疫系統的誤判。',
        '基因檢測給的是機率與建議，不是判決；帶有某個基因變異，不代表一定會出事。',
      ],
    },
    {
      type: 'callout',
      kind: 'warn',
      title: '本站是科普，不是醫療建議',
      text: '**看完之後，請不要自行停藥、換藥或調整劑量。**是否需要基因檢測、結果怎麼應用，請與醫師或藥師討論。指引（如 CPIC、DPWG、FDA 藥品標示）是寫給醫療人員的參考，而且會隨證據更新。CPIC 的說明也指出，它的指引是幫助醫師運用「已經取得」的檢測結果，並不建議誰應該去做檢測。',
    },

    // ───────── 進階 ─────────
    {
      type: 'deepdive',
      title: '這不是新科學：一段簡短的歷史',
      blocks: [
        { type: 'p', text: '「藥物基因體學」聽起來很新，但它的思想源頭可以追溯到一百多年前。下表的早期細節多取自各篇文獻的摘要與回顧，年份請視為概略脈絡。' },
        {
          type: 'table',
          head: ['年份', '事件', '備註'],
          rows: [
            ['1908', 'Archibald Garrod 發表〈先天代謝異常〉演講', '依 2008 年百年回顧，這系列演講後來被公認為醫學遺傳學的基礎'],
            ['1956', 'Alving 等人報告：服用抗瘧藥 primaquine 後溶血者的紅血球有酵素缺陷', '後來確認為 {{g6pd|G6PD}} 缺乏'],
            ['1957', 'Motulsky 在 JAMA 主張遺傳性酵素差異可解釋相同劑量下的異常反應', '一般認為是藥物遺傳學的奠基文獻之一'],
            ['1959', 'Friedrich Vogel 提出「pharmacogenetics」一詞', '這是通行說法；Kalow 於 1962 年出版同名專書'],
            ['2003', '人類基因體計畫宣布產出實質完整的人類基因體序列', '完整無缺口的序列到 2022 年才由 T2T 聯盟宣布'],
            ['2009', '臨床藥物基因體學實施聯盟（{{cpic|CPIC}}）成立', '目標是提供免費、經同儕審查、可更新的基因—藥物指引'],
          ],
          note: '近二十年的主要變化，不是「發現了基因會影響藥物」，而是基因體技術、知識庫與臨床指引的成熟。',
        },
        { type: 'p', text: '至於兩個名詞的關係：依國際規範 ICH E15（2007），{{pharmacogenomics|藥物基因體學}}研究 DNA 與 RNA 特徵的變異和藥物反應之間的關係，只看 DNA 序列變異的{{pharmacogenetics|藥物遺傳學}}是它的子集；實務上兩個詞常被互換使用。' },
      ],
    },
    {
      type: 'deepdive',
      title: '真實研究量到的差距：歐洲 PREPARE 試驗',
      blocks: [
        { type: 'p', text: '歐洲 PREPARE 試驗（Swen 等，Lancet 2023；7 個國家、納入 6,944 名新開藥病人，分析約 6,193 人）依 12 個基因（50 個變異）的面板結果調整用藥。若把全部納入分析的病人一起算，臨床相關的不良反應在基因導向組為 21.5%、一般照護組為 28.6%，勝算比 0.70（95% 信賴區間 0.61–0.79）。勝算比是比較兩組發生「機會」的指標，不等於風險降低 30%；絕對差約 7 個百分點。' },
        { type: 'p', text: '上面是全體病人的數字。若只看對當次處方藥有「可行動結果」的子群（1,558 人；這也是試驗的主要（守門）分析族群），兩組分別為 21.0% 與 27.7%（勝算比同樣是 0.70）。兩組數字來自同一項試驗、不同的分析族群，不是互相矛盾（第 9 章有更完整的解讀）。這類病人依摘要數字推算（1,558 / 6,193）只占約四分之一，也就是在這個試驗的 12 基因面板下，約四分之三的人不需要因基因而改變該次處方；換一組基因、藥物或指引，比例會不同。' },
        { type: 'p', text: '讀這個結果請留意：它是「開放標示」（醫師與病人都知道分組）的群集隨機交叉試驗，結果可能受到知道分組的影響；受試者約 97.7% 自述為歐洲、地中海或中東族裔，不宜直接推論到其他族群（包括台灣）。' },
      ],
    },
    {
      type: 'deepdive',
      title: '「幾乎每個人都有可行動變異」該怎麼讀？',
      blocks: [
        {
          type: 'bars',
          title: '至少帶有一個「可採取行動」變異的比例（各研究定義與基因集不同，請勿直接比較）',
          unit: '%',
          max: 100,
          data: [
            { label: 'Van Driest 2014', value: 91, color: 0x4aa8ff, note: '美國 Vanderbilt,9,589 人；5 組藥物—基因配對（涉及 6 個基因）' },
            { label: 'Ji 2016', value: 99, color: 0x35d6ff, note: '1,013 人；5 個基因合併（定序）' },
            { label: 'Lu 2022（台灣漢人）', value: 99.9, color: 0x4be3a0, note: '172,854 人；14 個基因（含 4 個 HLA 基因），依 FDA 藥物基因體標記表篩選，含證據較弱者；以晶片資料推算。世代來自醫院與生物資料庫，不等於全台人口的代表性抽樣' },
          ],
          note: '「可行動」的意思是：結果足以讓臨床決策支援或指引建議改變選藥或劑量。基因愈多、定義愈寬，比例自然愈高。比例很高也不代表每個處方都要改藥，可對照上一則進階說明：PREPARE 試驗中，對當次處方藥有可行動結果的病人只占約四分之一。',
        },
        { type: 'p', text: '再看一次 {{actionable-variant|可採取行動的變異}} 這個詞：它描述的是「有某個基因的結果值得參考」，而不是「這個人必須換藥」。' },
      ],
    },
    {
      type: 'deepdive',
      title: '統計上的提醒：為什麼不能說「25% 的人有效」',
      blocks: [
        { type: 'p', text: 'Schork（Nature 2015）寫到美國營收最高的十種藥「只對服用者中的 1/25 到 1/4 有幫助」。那是一篇倡議 N-of-1 試驗的評論，不是藥物基因體學的系統性分析，也沒有說差異全來自基因。這個數字是由「需治療人數」推論而來。NNT = 4 的意思是：平均而言，每治療 4 人，會比對照組（安慰劑或另一種藥）多 1 人達到療效。這和「4 個人裡只有 1 個人有效」是兩回事。' },
        { type: 'p', text: '舉個生活化的例子：假設對照組幾乎沒人有效：藥物讓「每個人」有效的機率都提高 25 個百分點，和「只有 25% 的人有效、其他人完全沒效」，算出來的 NNT 一樣，但真實情況天差地別。統計學者 Senn 在 2018 年的一篇部落格文章中指出，NNT 無法區分這兩種情形；要區分，原則上需要對同一個人重複給藥的試驗設計（這也是 N-of-1 試驗的想法）。他在 2016 年的論文（Stat Med）也認為，「治療反應有強烈的個人成分」這個常見信念缺乏穩固的統計證據。' },
        { type: 'p', text: '所以在讀「某某藥只對多少人有效」這類說法時，先問：這個數字是怎麼算出來的？它是平均效果、還是每個人的反應？' },
      ],
    },
  ],
  quiz: [
    {
      q: '「同一顆藥、同一個劑量，每個人的反應卻不一樣」，本章想傳達的是什麼？',
      options: ['這種差異很罕見，通常只出現在體質特殊或患有慢性病的少數人身上', '差異幾乎全由基因決定，只要做了基因檢測，就能預測每個人的反應', '這種差異很常見，通常由年齡、體重、器官功能、併用藥物與基因等共同造成', '差異主要來自有沒有按時服藥，藥物本身與身體條件的影響通常很小'],
      answer: 2,
      explain: '個體差異很普遍，原因通常不只一個。年齡、體重、肝腎功能、併用藥物、服藥習慣與基因等，都可能影響結果，基因只是其中「可檢測」的一環，也不是唯一的決定因素。',
    },
    {
      q: '在畫面中選「年齡」分組後，每一堆裡仍是紅黃綠混雜，分群清楚度也和不分組差不多。這最能說明什麼？',
      options: ['年齡對藥物反應通常沒有影響，所以判斷藥物反應時可以不必考慮年齡', '年齡可能有影響，但單靠年齡分不開結果，影響因素通常不只一個', '這代表資料通常是出了錯，因為只要選對因素，結果就能分得很乾淨', '只要把年齡、體重與肝腎功能合併考慮，通常就能準確預測每個人的結果'],
      answer: 1,
      explain: '年齡、體重、肝腎功能、併用藥物等都可能影響藥物反應，但單一因素常常分不乾淨。「分群清楚度」和不分組差不多，就代表這個因素沒能把結果分開；即使把幾個因素合併，也不保證能準確預測個人結果。下一步的基因型分組，是刻意設計得很乾淨的示意情境。',
    },
    {
      q: '畫面中依「基因型」分組時，各組幾乎都是同一種顏色。這代表什麼？',
      options: ['這是為教學刻意簡化的示意資料，真實世界中基因通常只解釋一部分差異', '基因型甲的人不論吃什麼藥通常都有效，因為基因已經決定了一切', '真實世界中只要挑對基因，各組結果通常也會分得一樣乾淨整齊', '這證明年齡、併用藥物等其他因素通常不重要，可以不必再考慮'],
      answer: 0,
      explain: '示意資料為了教學而簡化。以 warfarin 為例，IWPC（2009）報告中基因加臨床變項也只解釋約 43% 的劑量變異，臨床變項單獨為 26%，其餘仍來自其他或未知的因素。',
    },
    {
      q: '某些人使用特定藥物後出現嚴重皮膚過敏，例如 `HLA-B*15:02` 與 carbamazepine。依本章的三條途徑，這最接近哪一條？',
      options: ['藥怎麼被處理（藥物動力學）', '藥作用的目標（藥效學）', '服藥習慣的差異（遵從性）', '免疫系統的誤判（過敏）'],
      answer: 3,
      explain: '`HLA-B*15:02` 與 carbamazepine 的關聯屬於免疫機制引起的嚴重過敏，和「藥物濃度太高或太低」是不同的機制。服藥遵從性是影響藥物反應的因素之一，但不是基因影響藥物的三條途徑。第 7 章會詳細說明。',
    },
    {
      q: '下列關於台灣 `HLA-B*15:02` 篩檢研究（Chen 等，NEJM 2011）的敘述，哪一項正確？',
      options: ['陽性者使用該藥後通常都會發病，所以陽性幾乎就等於一定發生 SJS/TEN', '這是隨機對照試驗，所以證據強度通常屬於最高等級，不必再有疑慮', '陰性者使用後無人發生 SJS/TEN，但對照是歷史發生率，不是隨機分組', '陰性代表完全沒有風險，所以篩檢陰性後通常不必再留意任何症狀'],
      answer: 2,
      explain: '4,877 人中有 7.7% 陽性；陰性者使用該藥沒有人發生 SJS/TEN，而依歷史發生率原本約會有 10 例。但它不是隨機分派，證據強度不如隨機試驗；陽性也不等於必然發病（多數陽性者其實不會發病）。FDA 標示只說陰性者風險「被認為低」，並未說零風險。',
    },
  ],
  sources: [
    { name: 'Schork NJ. Personalized medicine: Time for one-person trials. Nature 2015', url: 'https://www.nature.com/articles/520609a', note: '「1/25 到 1/4」的原始出處' },
    { name: 'Senn S. Mastering variation: variance components and personalised medicine. Stat Med 2016', url: 'https://pubmed.ncbi.nlm.nih.gov/26415869/', note: '「治療反應有強烈個人成分」的信念缺乏穩固統計證據' },
    { name: 'Senn S. Personal perils: are numbers needed to treat misleading us as to the scope for personalised medicine? (guest post, Error Statistics blog, 2018)', url: 'https://errorstatistics.com/2018/07/11/s-senn-personal-perils-are-numbers-needed-to-treat-misleading-us-as-to-the-scope-for-personalised-medicine-guest-post/', note: '對 Schork「1/25 到 1/4」以 NNT 推論的批評（部落格文章，非同儕審查）' },
    { name: 'Pirmohamed M, et al. Adverse drug reactions as cause of admission to hospital. BMJ 2004', url: 'https://pubmed.ncbi.nlm.nih.gov/15231615/', note: '英國默西塞德郡兩家大型醫院，18,820 名入院病人' },
    { name: 'NHGRI Fact Sheet:Human Genomic Variation', url: 'https://www.genome.gov/about-genomics/educational-resources/fact-sheets/human-genomic-variation', note: '與參考基因體相比，一般人平均約 500 萬個單核苷酸變異（SNV）；頻率達 1% 以上者才稱 SNP' },
    { name: 'Evans WE, Relling MV. Pharmacogenomics: translating functional genomics into rational therapeutics. Science 1999', url: 'https://pubmed.ncbi.nlm.nih.gov/10521338/', note: '基因多型性與藥物療效、毒性差異' },
    { name: 'ICH E15:Definitions for genomic biomarkers, pharmacogenomics, pharmacogenetics…（2007）', url: 'https://database.ich.org/sites/default/files/E15_Guideline.pdf', note: '藥物基因體學與藥物遺傳學的法規定義' },
    { name: 'Klomp SD, et al. Phenoconversion of Cytochrome P450 Metabolism: A Systematic Review. J Clin Med 2020', url: 'https://pubmed.ncbi.nlm.nih.gov/32906709/', note: '表現型轉換；摘要指出對臨床療效與毒性的影響仍不明確' },
    { name: 'IWPC. Estimation of the warfarin dose with clinical and pharmacogenetic data. N Engl J Med 2009', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC2722908/', note: '基因加臨床變項解釋 43% 的劑量變異（驗證世代表 2）' },
    { name: 'Swen JJ, et al. A 12-gene pharmacogenetic panel to prevent adverse drug reactions (PREPARE). Lancet 2023', url: 'https://pubmed.ncbi.nlm.nih.gov/36739136/', note: '群集隨機交叉試驗' },
    { name: 'Nakanishi. Precision medicine. Braz J Otorhinolaryngol 2018（引述 NRC 2011）', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9449242/', note: '精準醫療與個人化醫療用語（二手引述）' },
    { name: 'Van Driest SL, et al. Clinically actionable genotypes among 10,000 patients… Clin Pharmacol Ther 2014', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3961508/', note: '91% 帶有至少一個可行動變異' },
    { name: 'Ji Y, et al. Preemptive pharmacogenomic testing… J Mol Diagn 2016', url: 'https://pubmed.ncbi.nlm.nih.gov/26947514/', note: '五基因合併 99%' },
    { name: 'Lu et al. Comprehensive characterization of pharmacogenes in a Taiwanese Han population. Front Genet 2022', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC9452738/', note: '172,854 位台灣漢人，14 個基因' },
    { name: 'Chen P, et al. Carbamazepine-induced toxic effects and HLA-B*1502 screening in Taiwan. N Engl J Med 2011', url: 'https://pubmed.ncbi.nlm.nih.gov/21428768/', note: '台灣 HLA-B*15:02 篩檢研究' },
    { name: '衛生福利部（存檔）：含 Carbamazepine 成分藥品的臨床效益仍高於風險…（衛生署 2010-05-20 新聞稿）', url: 'https://www.mohw.gov.tw/cp-3161-26506-1.html', note: '2010 年 6 月 1 日起 HLA-B*1502 檢測納入健保給付（新聞稿，非正式公告）' },
    { name: 'Caudle KE, et al. CPIC 指引制定流程（2014）', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3977533/', note: 'CPIC 指引是幫助臨床人員運用已有的檢測結果，而非規定是否該送檢' },
    { name: 'The centenary of Garrod\'s Croonian lectures. Clin Med 2008', url: 'https://pubmed.ncbi.nlm.nih.gov/18624044/', note: '1908 年演講' },
    { name: 'Alving AS, et al. Enzymatic deficiency in primaquine-sensitive erythrocytes. Science 1956', url: 'https://pubmed.ncbi.nlm.nih.gov/13360274/', note: 'G6PD 缺乏的發現' },
    { name: 'Motulsky AG. Drug reactions, enzymes, and biochemical genetics. JAMA 1957', url: 'https://jamanetwork.com/journals/jama/fullarticle/321669', note: '藥物遺傳學奠基文獻之一（未經獨立查核）' },
    { name: 'Kalow W. Human pharmacogenomics: the development of a science. Hum Genomics 2004', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC3525104', note: 'Vogel 1959、Kalow 1962' },
    { name: 'NHGRI：人類基因體計畫簡介（Fact Sheet）', url: 'https://www.genome.gov/about-genomics/educational-resources/fact-sheets/human-genome-project', note: '2003 年完成、2022 年 T2T' },
    { name: 'FDA:Table of Pharmacogenomic Biomarkers in Drug Labeling（含 Tegretol 標籤）', url: 'https://www.fda.gov/media/124784/download', note: '標籤指出篩檢陰性者 SJS/TEN 風險「被認為低」而非零' },
    { name: 'The Clinical Pharmacogenetics Implementation Consortium: 10 Years Later', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6925644/', note: 'CPIC 2009 年成立' },
  ],
}
