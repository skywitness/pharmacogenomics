// ch02 內容：從 DNA 到蛋白質：遺傳的語言（L1 入門）
// 事實來源：research/molecular-basics.verified.json。
// 使用了 verified:false 的事實時，內文一律以明確歸屬的措辭呈現（NHGRI、MedlinePlus、dbSNP、PharmVar 教學文章、Wei 2021 等）。
import { CODON_TABLE, AA } from '../scenes/ch02/data.js'

// 遺傳密碼表（以 DNA 編碼股的字母表示），由場景共用的標準密碼表產生，避免手抄出錯
const B4 = ['T', 'C', 'A', 'G']
const codeRows = []
for (const a of B4)
  for (const b of B4)
    codeRows.push([
      a + b,
      ...B4.map((c) => {
        const l = CODON_TABLE[a + b + c]
        return l === '*' ? '**停止**' : AA[l][0] + (a + b + c === 'ATG' ? '（起始）' : '')
      }),
    ])

export default {
  id: 'ch02',
  no: 2,
  level: 1,
  title: '從 DNA 到蛋白質：遺傳的語言',
  subtitle: '四個字母如何寫成密碼、變成蛋白質，以及「改一個字母」會發生什麼事',
  minutes: 8,
  stage: {
    aria: '互動式 3D 場景：一段水平的 DNA 雙股螺旋位於細胞核內。依序演示局部解旋、RNA 聚合酶轉錄出 mRNA、mRNA 穿過核孔到細胞質、核糖體每讀三個字母接上一顆胺基酸、串珠折疊成蛋白質並處理藥物分子。使用者可以選取一個鹼基改成 A、T、G 或 C，觀察同義、錯義或無義變異對蛋白質的影響。序列為教學用的示意基因。',
    caption: '按「▶ 自動播放」看完整流程，或拖曳進度條 · 點 3D 裡的鹼基（或下方的 DNA 字母）選取後，選 A/T/G/C 改字母 · 拖曳可旋轉視角（序列為教學用的示意基因，並非任何真實基因）',
  },
  blocks: [
    // ───────── step 0:DNA 是四個字母寫成的密碼 ─────────
    { type: 'h3', text: '一本只用四個字母寫成的食譜', step: 0 },
    {
      type: 'p',
      text: '想像你身體裡絕大多數的細胞都是一間小廚房，細胞核裡收著一本食譜書。這本書只用四種字母寫成：A、T、G、C。這就是 {{dna|DNA}}。畫面裡發亮的螺旋，就是這本書中的一小段（整個畫面是**示意**，不是真實比例）。',
      step: 0,
    },
    {
      type: 'p',
      text: '螺旋的兩條長鏈之間，是一對對配好的{{base|鹼基}}：**A 只會配 T、G 只會配 C**（畫面裡 A 綠、T 紅、G 黃、C 藍）。所以只要讀出其中一股，另一股就能推算出來。這個「互補」的規則，是後面抄寫基因、甚至實驗室檢測基因型的共同基礎。',
    },
    {
      type: 'p',
      text: '這本書很厚。依美國 NIGMS 的通俗說法，人類{{genome|基因體}}約有 32 億個鹼基對（不同來源的估計略有出入，約在 30 至 32 億之間），其中約 2 萬個{{gene|基因}}帶有製造蛋白質的指令，而這些基因中真正編碼蛋白質的序列（不含內含子），只占整本書不到 2%。這些都是**概數**，不同資料庫的數字略有出入。',
    },
    {
      type: 'p',
      text: '更關鍵的是：你我的這兩本書幾乎一模一樣。NHGRI 指出，「任兩人的基因體約 99.9% 相同」是常見的說法；若把各種類型的差異都算進去，平均約 99.6% 相同。「99.9%」與「數百萬個差異」並不矛盾：只算單一字母的差異，或連插入、缺失等一併算入，算法不同，得到的百分比也不同，而且都是概數。剩下的差異比例雖小，卻分布在數百萬個位置上：與參考基因體相比，一般人平均約有 500 萬個{{snv|單核苷酸變異}}（SNV，也就是「單一個字母的差異」）。藥物基因體學關心的，是這些差異裡少數會改變「處理藥物的蛋白質」的。',
    },
    {
      type: 'p',
      text: '這個食譜比喻有個限制：真的食譜可以端到廚房去照著做，但 DNA 本體不會離開細胞核。細胞讀的其實是「影印本」，這就是下一步要發生的事。',
    },

    // ───────── step 1：解旋 ─────────
    { type: 'h3', text: '第一步：只打開要讀的那一小段', step: 1 },
    {
      type: 'p',
      text: '要使用某個基因，細胞不會把整本書攤開，而是只讓那一小段的雙股暫時分開。畫面裡半透明的藍色大分子是 {{rna-polymerase|RNA 聚合酶}}，它停在基因的起點，周圍的 DNA 被打開：上方是**編碼股**，下方是{{template-strand|模板股}}；其餘的 DNA 仍然閉合。為什麼要分兩股？可以把它想成一張相片和它的底片：聚合酶讀的是「底片」（模板股），洗出來的副本，看起來卻和「相片」（編碼股）一樣。（這個比喻的限制：真正的做法不是翻拍，而是一個字母一個字母地互補配對。）',
      step: 1,
    },

    // ───────── step 2：轉錄 ─────────
    { type: 'h3', text: '第二步：轉錄，影印出一份 mRNA', step: 2 },
    {
      type: 'p',
      text: '聚合酶沿著模板股前進，遇到什麼字母，就配上互補的字母。這個過程叫{{transcription|轉錄}}：把基因的 DNA 資訊複製成{{mrna|傳訊 RNA(mRNA)}}。RNA 用 **U** 取代 T，所以模板股上的 A，配上的是 U。舉例來說，模板股上的 `TAC`，配出來的 mRNA 就是 `AUG`。做出來的 mRNA 和編碼股的字母一樣，只是 T 換成 U（畫面裡 U 是淡粉紅色）。',
      step: 2,
    },
    {
      type: 'p',
      text: '聚合酶走過之後，DNA 又重新閉合：母本完好如初，離開的只是副本。畫面下方逐漸變長的彩色珠串，就是正在長出來的 mRNA。',
    },
    {
      type: 'p',
      text: '另一個限制：真實的基因由{{splicing|外顯子}}（會留在成熟 mRNA 裡的片段）與內含子（會被切掉的片段）交錯組成，mRNA 在離開細胞核之前，內含子會被切除、外顯子被接起來，這叫{{splicing|剪接}}（依 NHGRI 詞彙表）。這個示意把這一步省略了。',
    },

    // ───────── step 3：出核 ─────────
    { type: 'h3', text: '第三步：副本離開細胞核', step: 3 },
    {
      type: 'p',
      text: '做好的 mRNA 穿過{{nucleus|細胞核}}膜上的核孔，來到細胞質，而 DNA 本體始終留在核內。畫面把整條 mRNA 畫成一起下移（**示意**；真實的 mRNA 是一端一端穿出）。到了細胞質，{{ribosome|核糖體}}會抓住 mRNA 的開頭。',
      step: 3,
    },

    // ───────── step 4：轉譯 ─────────
    { type: 'h3', text: '第四步：轉譯，三個字母對應一顆胺基酸', step: 4 },
    {
      type: 'p',
      text: '核糖體沿著 mRNA 移動，**每次讀三個字母**，這三個字母叫一個{{codon|密碼子}}。{{trna|轉送 RNA(tRNA)}} 一端認得密碼子、另一端帶著對應的{{amino-acid|胺基酸}}，把它送到核糖體，接在鏈的尾端。讀完一個，核糖體往前一格，直到遇到{{stop-codon|終止密碼子}}才停止。這個過程叫{{translation|轉譯}}。',
      step: 4,
    },
    {
      type: 'p',
      text: '四種字母、每次三個，共有 4×4×4=64 種密碼子。其中 61 種指定胺基酸，3 種是終止訊號，這份對照表叫{{genetic-code|遺傳密碼}}。人體蛋白質只用 20 種胺基酸，64 比 20 多，所以**好幾個密碼子會指到同一種胺基酸**。例如畫面裡的 GGA 和 GGG，指的都是甘胺酸（Gly）。這個「冗餘」是「同義變異」的關鍵。',
    },
    {
      type: 'p',
      text: '畫面中的 33 個字母是教學用的示意基因（自行設計的序列，11 個密碼子：1 個起始 ATG、9 個胺基酸、1 個終止），不是任何真實基因的序列。',
    },

    // ───────── step 5：折疊成蛋白質 ─────────
    { type: 'h3', text: '第五步：折成立體形狀，才是蛋白質', step: 5 },
    {
      type: 'p',
      text: '串好的胺基酸鏈會自己折成特定的立體形狀，這才是有功能的{{protein|蛋白質}}。形狀決定功能：能分解藥物的{{enzyme|酵素}}、當作藥物目標的{{receptor|受體}}、負責把藥物運進運出細胞的{{transporter|轉運蛋白}}，全都是蛋白質。畫面裡橘色小分子代表藥物（**示意**）：形狀正確的酵素口袋，能抓住它並加以處理，處理後的產物會變成青綠色離開。',
      step: 5,
    },
    {
      type: 'p',
      text: '把這條線接起來，就是{{central-dogma|中心法則}}。藥物基因體學的核心想法就建立在它之上：**基因不同，做出來的蛋白質在數量或形狀上可能不同，處理藥物的能力也就可能不同**。不過{{genotype|基因型}}與{{phenotype|表現型}}通常不是一對一：表現型由基因型與環境共同決定（依 NHGRI 詞彙表）。下一章會細講這一點。',
    },
    {
      type: 'steps',
      title: '中心法則，一張清單說完',
      items: [
        { title: '轉錄', text: 'RNA 聚合酶依模板股，在細胞核內做出 mRNA(T 換成 U)' },
        { title: '出核', text: 'mRNA 經核孔到細胞質（真實情況還有剪接等加工）' },
        { title: '轉譯', text: '核糖體每讀三個字母，tRNA 就送來一顆胺基酸，串成鏈' },
        { title: '折疊', text: '胺基酸鏈折成立體形狀，成為酵素、受體或轉運蛋白' },
      ],
    },
    {
      type: 'keypoints',
      title: '到這裡，你已經知道',
      items: [
        'DNA 是用 A、T、G、C 寫成的密碼，兩股互補（A–T、G–C）。',
        '基因先「轉錄」成 mRNA，再由核糖體「轉譯」成蛋白質：DNA → RNA → 蛋白質。',
        '每 3 個字母是 1 個密碼子；64 種密碼子中，61 種指定胺基酸、3 種是終止訊號。',
        '蛋白質的形狀決定功能；藥物代謝酵素、受體與轉運蛋白都是蛋白質。',
      ],
    },

    // ───────── step 6：突變實驗 ─────────
    { type: 'h3', text: '動手改一個字母', step: 6 },
    {
      type: 'p',
      text: '現在輪到你了。點 3D 畫面裡的一個鹼基（或下方控制區的 DNA 字母）選取它，再選 A、T、G、C 把它改掉。你會看到新字母走完整條流程：DNA 變了、mRNA 跟著變、密碼子變了，最後看蛋白質有什麼不同。不知道從哪裡下手？先按控制區裡的三個「示範」按鈕看看。起始密碼子（ATG）與最後的終止密碼子在這個示意裡是鎖住的，點了不會有反應。',
      step: 6,
    },
    {
      type: 'table',
      caption: '改一個字母，可能有三種結果（下表用的是畫面上的示範基因）',
      head: ['類型', '示範', '胺基酸', '蛋白質'],
      rows: [
        ['{{synonymous|同義變異}}', '`GGA`→`GGG`', 'Gly→Gly（不變）', '胺基酸沒變，多數情況下蛋白質看起來一樣'],
        ['{{missense|錯義變異}}', '`GAC`→`GGC`', 'Asp→Gly（換一顆）', '有一顆珠子被換掉，形狀可能改變，影響大小不一'],
        ['{{nonsense|無義變異}}', '`TGG`→`TGA`', 'Trp→停止', '蛋白質在這裡提早中止，通常失去功能'],
      ],
      note: '「錯義變異」的影響可以從幾乎沒有到完全失去功能。畫面裡形狀改變的程度，是依「換掉的胺基酸性質相不相近」做的**示意**（相近者變化小、差很多者變化大）；真實影響要靠實驗與臨床證據判斷，不能只看換了什麼。',
    },
    {
      type: 'callout',
      kind: 'clinical',
      title: '真實世界的例子：CYP2C19*3',
      text: '**真實的藥物基因裡，也有你剛剛做過的那種「提早終止」變異。**{{cyp2c19|CYP2C19}} 是製造一種肝臟酵素的基因（這種酵素參與活化預防血栓的藥 clopidogrel），它的 `*3` 就是一個無義變異：位於第 4 外顯子（基因中被保留下來、用來編碼的片段之一），編碼序列第 636 號位置的 G 變成 A，密碼子 TGG 變成 TGA，於是原本色胺酸的位置提早出現終止訊號。這個變異在 1994 年首先於日本人的「不良代謝者」（代謝特定藥物特別慢的人，早期譯作弱代謝者）中被發現。你在畫面上做的「TGG→TGA」與它是同一**類型**，但畫面的序列是自行設計的。',
    },
    {
      type: 'p',
      text: '不是每個變異的影響，都來自「胺基酸被換掉」：有些變異改變 RNA 的加工方式（剪接），有些只改變蛋白質「做多少」，例如 `CYP2C19*17` 位在基因上游的{{promoter|調控區}}，增加轉錄，卻沒有改變任何一顆胺基酸。（`*2`、`*3`、`*17` 是研究者替變異取的名字，星號命名是下一章的主題。）想看細節，請展開下方的進階說明。',
    },
    {
      type: 'callout',
      kind: 'taiwan',
      title: '台灣觀點：有變異很普遍，不等於需要改藥',
      text: '**帶有「可能影響用藥」的基因變異其實很常見，但這不等於需要換藥。**台灣人體生物資料庫（Taiwan Biobank）曾用晶片為 103,106 名參與者做基因型分型，該研究（Wei 等，2021）報告 87.3% 的人至少帶有一個「可能影響用藥選擇或劑量」的變異。這個比例來自該研究的參與者，不代表全台灣人口的實測比例，也**不等於**這些人需要換藥；它只說明：可能影響藥物處理的基因差異相當普遍。',
    },
    {
      type: 'deepdive',
      title: '進階：CYP2C19 三個著名變異，三種不同機制',
      blocks: [
        {
          type: 'p',
          text: '`CYP2C19*2` 是著名的失去功能變異：位於第 5 外顯子，編碼序列第 681 號位置的單一字母 G 變成 A。它製造出異常的剪接位點，讓{{frameshift|讀框}}（密碼子三個一組的分組方式）整個位移，在下游約 20 個胺基酸處提早終止，得到截短而無功能的蛋白質。資料庫 dbSNP 在蛋白質層級把它註解為「同義」（胺基酸不變），實際上卻是靠**剪接**造成失能。所以「同義」不等於「一定沒事」：「胺基酸有沒有變」只是判斷的一部分。',
        },
        {
          type: 'table',
          caption: 'CYP2C19 三個著名變異，三種不同機制',
          head: ['變異名稱', '發生在哪裡', '機制', '結果'],
          rows: [
            ['`CYP2C19*2`', '第 5 外顯子', '異常剪接，讀框位移、提早終止', '截短、無功能的蛋白質'],
            ['`CYP2C19*3`', '第 4 外顯子', '無義變異：TGG→TGA', '提早終止，無功能'],
            ['`CYP2C19*17`', '基因上游的{{promoter|調控區}}', '增加轉錄，不改變胺基酸序列', '酵素表現量與活性上升'],
          ],
          note: '三者的差別在於「機制」：有的改剪接、有的改胺基酸（讓它變成終止訊號）、有的只改變做多少。各變異對藥物反應的意義，是下一章的主題。',
        },
      ],
    },
    {
      type: 'deepdive',
      title: '進階：變異的「座標」與資料庫編號',
      blocks: [
        {
          type: 'p',
          text: '`c.636G>A` 這類寫法（HGVS 命名）的意思是「編碼序列第 636 號位置的 G 變成 A」；`p.Trp212Ter` 則表示蛋白質的第 212 顆胺基酸（色胺酸）變成終止訊號（636÷3=212）。`rs` 開頭的編號是 dbSNP 資料庫給每個變異的識別碼。',
        },
        {
          type: 'table',
          caption: 'CYP2C19 三個變異的座標（僅供查閱）',
          head: ['等位基因', '座標', 'rs 編號'],
          rows: [
            ['`CYP2C19*2`', 'c.681G>A（第 5 外顯子）', 'rs4244285'],
            ['`CYP2C19*3`', 'c.636G>A,p.Trp212Ter（第 4 外顯子）', 'rs4986893'],
            ['`CYP2C19*17`', 'c.-806C>T（起始密碼子上游的調控區，「-」表示在它之前）', 'rs12248560'],
          ],
          note: '以前 `*2` 由 c.332-23A>G、c.681G>A、c.991A>G 三個變異定義；依 2026 年 Turner 等人的報告，PharmVar 現行的核心定義只含 c.681G>A。星號命名與各基因型的功能，是下一章的主題。',
        },
      ],
    },
    {
      type: 'deepdive',
      title: '進階：不只是「換字母」，還有這些改法',
      blocks: [
        {
          type: 'p',
          text: '依 MedlinePlus 的整理，基因變異除了錯義與無義，還包括插入、缺失、重複，以及{{frameshift|移碼}}：增加或減少的字母數若不是 3 的倍數，下游所有密碼子的分組都會跟著位移。',
        },
        {
          type: 'list',
          items: [
            '**剪接位點**：像 `CYP2C19*2`，字母改變製造出異常的剪接位點，使 mRNA 的讀框位移。',
            '**{{promoter|啟動子/調控區}}**：像 `CYP2C19*17`，不動蛋白質序列，只改變「做多少」。',
            '**拷貝數**：依 PharmVar 的教學文章（Turner 等，2023），`CYP2D6` 旁邊有高度相似的假基因（CYP2D7、CYP2D8），因此容易出現整個基因缺失或多份拷貝，直接改變酵素的總量。',
          ],
        },
      ],
    },
    {
      type: 'deepdive',
      title: '進階：完整的遺傳密碼表（64 個密碼子）',
      blocks: [
        {
          type: 'table',
          caption: '標準遺傳密碼（以 DNA 編碼股的字母表示；換成 mRNA 只要把 T 讀成 U）',
          head: ['前兩個字母', '第三個字母 T', 'C', 'A', 'G'],
          rows: codeRows,
          note: '共 64 個密碼子：61 個指定胺基酸、3 個是終止訊號（TAA、TAG、TGA）。ATG 指定甲硫胺酸（Met），同時通常作為起始密碼子。此表由場景使用的標準密碼表產生。',
        },
      ],
    },
  ],
  quiz: [
    {
      q: '轉錄時，模板股上的字母是 A，新做出的 mRNA 在對應位置會接上哪個字母？',
      options: ['A', 'U', 'T', 'G'],
      answer: 1,
      explain: '轉錄是依模板股配上互補的字母，而 RNA 用 U 取代 T，所以模板股上的 A 配上的是 U。反過來，模板股上如果是 T，接上的則是 A（例如模板股 TAC 配出 mRNA 的 AUG）。',
    },
    {
      q: '遺傳密碼一共有多少種密碼子？其中有多少種是「終止訊號」？',
      options: ['20 種，其中 1 種是終止', '64 種，其中 1 種是終止', '16 種，其中 3 種是終止', '64 種，其中 3 種是終止'],
      answer: 3,
      explain: '四種字母、每次三個，共 4×4×4=64 種密碼子；61 種指定胺基酸、3 種（UAA、UAG、UGA）是終止訊號。其中 61 種指定胺基酸，所以 61 不是總數；而 16 是只讀兩個字母時的組合數（4×4）。',
    },
    {
      q: '密碼子 GGA 變成 GGG，兩者指定的都是甘胺酸（Gly）。這種改變叫什麼？',
      options: ['錯義變異', '無義變異', '同義變異', '移碼變異'],
      answer: 2,
      explain: '字母變了，但因為好幾個密碼子可以指到同一種胺基酸，胺基酸沒有改變，所以叫同義變異。多數情況下蛋白質不變，不過若影響剪接或表現量，仍可能造成功能差異。',
    },
    {
      q: '`CYP2C19*3` 是密碼子 TGG（色胺酸）的最後一個字母 G 變成 A，變成 TGA。最合適的描述是？',
      options: ['錯義變異，一顆胺基酸被換成另一顆', '無義變異，蛋白質在此提早中止而變短', '同義變異，胺基酸與蛋白質長度都不變', '調控變異，只改變蛋白質做出來的量'],
      answer: 1,
      explain: 'TGA 是終止密碼子，核糖體讀到這裡就停下來，蛋白質提早中止而變短。依 de Morais 等人 1994 年的原始報告，`CYP2C19*3`（第 4 外顯子的 G>A）會製造出提早終止、無功能的蛋白質。',
    },
    {
      q: '`CYP2C19*17` 沒有改變任何一顆胺基酸，卻會讓酵素活性上升。最合理的原因是？',
      options: ['位在上游調控區，增加轉錄使酵素做得更多', '改變 RNA 的剪接方式，使讀框發生位移', '讓終止密碼子消失，使蛋白質變得更長', '讓蛋白質折成更緊密的形狀，提高活性'],
      answer: 0,
      explain: '`CYP2C19*17` 位在基因上游的調控區，透過增加轉錄提高酵素的表現量與活性，而不是改變胺基酸序列。這說明影響蛋白質的，不只是「密碼」本身。',
    },
  ],
  sources: [
    { name: 'NHGRI Talking Glossary:Deoxyribonucleic Acid(DNA)', url: 'https://www.genome.gov/genetics-glossary/Deoxyribonucleic-Acid-DNA', note: 'DNA 雙股螺旋、A–T 與 C–G 配對' },
    { name: 'NIGMS:Genetics by the Numbers(2024)', url: 'https://nigms.nih.gov/biobeat/2024/04/genetics-by-the-numbers', note: '約 32 億鹼基對、約 2 萬個編碼蛋白質的基因、編碼區不到 2%（通俗概數）' },
    { name: 'NHGRI Fact Sheet:Human Genomic Variation', url: 'https://www.genome.gov/about-genomics/educational-resources/fact-sheets/human-genomic-variation', note: '99.9% 與 99.6% 相同的說法；SNV 與 SNP 的定義與數量' },
    { name: 'MedlinePlus Genetics:How do genes direct the production of proteins?', url: 'https://medlineplus.gov/genetics/understanding/howgeneswork/makingprotein/', note: '轉錄、轉譯、密碼子與終止密碼子' },
    { name: 'NHGRI Talking Glossary:Codon', url: 'https://www.genome.gov/genetics-glossary/Codon', note: '64 種密碼子：61 種指定胺基酸、3 種終止' },
    { name: 'NHGRI Talking Glossary:Exon', url: 'https://www.genome.gov/genetics-glossary/Exon', note: '外顯子、內含子與剪接' },
    { name: 'NHGRI Talking Glossary:Phenotype', url: 'https://www.genome.gov/genetics-glossary/Phenotype', note: '基因型、表現型與環境的關係' },
    { name: 'MedlinePlus Genetics:What kinds of gene variants are possible?', url: 'https://medlineplus.gov/genetics/understanding/mutationsanddisorders/possiblemutations/', note: '錯義、無義、插入、缺失、移碼等變異類型' },
    { name: 'de Morais SM, et al. Mol Pharmacol 1994(CYP2C19*3)', url: 'https://pubmed.ncbi.nlm.nih.gov/7969038/', note: 'CYP2C19*3 的發現（c.636G>A，無義變異）' },
    { name: 'de Morais SM, et al. J Biol Chem 1994(CYP2C19*2)', url: 'https://pubmed.ncbi.nlm.nih.gov/8195181/', note: 'CYP2C19*2 的剪接缺陷' },
    { name: 'Sim SC, et al. Clin Pharmacol Ther 2006(CYP2C19*17)', url: 'https://pubmed.ncbi.nlm.nih.gov/16413245/', note: 'CYP2C19*17 位於調控區，增加轉錄' },
    { name: 'NCBI dbSNP:rs4244285', url: 'https://www.ncbi.nlm.nih.gov/snp/rs4244285', note: 'rsID 頁面（蛋白質層級註解為同義變異）' },
    { name: 'Turner AJ, et al. Clin Transl Sci 2026（CYP2C19*2 核心定義）', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC13425612/', note: 'PharmVar 已將 *2 的核心定義修訂為僅 c.681G>A' },
    { name: 'Turner AJ, et al. PharmVar Tutorial on CYP2D6 Structural Variation. Clin Pharmacol Ther 2023', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC10840842/', note: 'CYP2D6 基因缺失、重複與假基因' },
    { name: 'Wei CY, et al. Genetic profiles of 103,106 individuals in the Taiwan Biobank. npj Genom Med 2021', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC7878858/', note: '台灣人體生物資料庫的晶片資料與用藥相關變異比例' },
  ],
}
