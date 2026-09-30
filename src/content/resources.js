// 延伸資源。分組顯示在頁面底部「資源」區。star:true 的群組會被強調（台灣本地資源）。
// 每筆：{ name, url, desc }。網址皆來自 research/*.verified.json 的來源清單（已由研究員實際開啟過）。

export const resources = [
  {
    title: '台灣本地資源',
    star: true,
    items: [
      {
        name: '台灣藥物基因體學會 PGST 官網',
        url: 'https://www.pgst.org.tw/index.php',
        desc: '學會（2021 年成立）的官方網站，有最新消息、學會活動、學術新知、Podcast、文件下載（偏重 GCP 與 LDT 等法規）與相關連結。它比較像學會入口，而不是逐藥的基因-藥物指引資料庫。',
      },
      { name: 'PGST 學術新知', url: 'https://www.pgst.org.tw/learn.php', desc: '學會整理的新知文章與學者專欄，適合當作中文延伸閱讀。' },
      { name: 'PGST Podcast', url: 'https://www.pgst.org.tw/podcast.php', desc: '用聽的認識 GWAS、多基因風險分數、基因數據倫理與生物資料庫等主題。' },
      { name: '臺大醫院 藥物基因體與智慧用藥網', url: 'https://ntuhpgx.ntuh.gov.tw/', desc: '以繁體中文呈現 ClinPGx 的資料，提供「查藥物」「查基因」功能；僅供教育與臨床輔助參考，不能作為自行停藥或調整劑量的依據。' },
      { name: '台灣人體生物資料庫', url: 'https://www.twbiobank.org.tw/', desc: '台灣大規模的健康世代研究，是許多台灣族群基因頻率研究的資料來源。' },
      { name: '衛福部新聞稿：含 carbamazepine 藥品效益仍高於風險', url: 'https://www.mohw.gov.tw/cp-3161-26506-1.html', desc: '2010 年官方說明，含 HLA-B*1502 檢測納入健保給付與用藥須知。' },
      { name: '臺灣藥害救濟基金會：抗癲癇藥物與 HLA 基因', url: 'https://www.tdrf.org.tw/2024/12/10/vol_88-special-report-3/', desc: '用白話整理 HLA 基因型與抗癲癇藥嚴重皮膚不良反應的關係與檢測效益。' },
    ],
  },
  {
    title: '臨床指引與資料庫',
    items: [
      { name: 'ClinPGx（整合 PharmGKB、CPIC、PharmCAT）', url: 'https://www.clinpgx.org/', desc: '藥物基因體知識庫：基因-藥物註解、臨床指引、藥品標示與路徑圖。CPIC 指引現於此平台提供。' },
      { name: 'CPIC — 臨床藥物基因體學實施聯盟', url: 'https://www.clinpgx.org/cpic', desc: '針對「基因型→用藥調整」的國際臨床指引與基因-藥物配對分級（A/B/C/D）；官網已於 2026 年整併進 ClinPGx。' },
      { name: 'PharmVar', url: 'https://www.pharmvar.org/', desc: '藥物代謝酵素等位基因（星號命名）的官方命名資料庫。' },
      { name: 'FDA：藥物基因學關聯表', url: 'https://www.fda.gov/medical-devices/precision-medicine/table-pharmacogenetic-associations', desc: '美國 FDA 依證據強度整理各藥物-基因配對在仿單中的敘述。' },
      { name: 'FDA：藥品仿單中的藥物基因體生物標記表', url: 'https://www.fda.gov/drugs/science-and-research-drugs/table-pharmacogenomic-biomarkers-drug-labeling', desc: '列出仿單提及基因生物標記的藥物（如 abacavir、carbamazepine、capecitabine…）。' },
    ],
  },
  {
    title: '台灣團隊的關鍵研究（多數可免費閱讀；Chung 2004、Chen 2011 僅摘要免費）',
    items: [
      { name: 'Chung 等人 2004《Nature》：HLA-B*1502 與 carbamazepine 引起的 SJS', url: 'https://pubmed.ncbi.nlm.nih.gov/15057820/', desc: '在漢人中發現強烈關聯的開創性研究（長庚團隊）。' },
      { name: 'Hung 等人 2005《PNAS》：HLA-B*5801 與 allopurinol 嚴重皮膚反應', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC554812/', desc: '台灣漢人病例對照研究全文。' },
      { name: 'Chen 等人 2011《NEJM》：台灣 HLA-B*1502 篩檢前瞻研究', url: 'https://pubmed.ncbi.nlm.nih.gov/21428768/', desc: '4,877 位候選受試者的前瞻篩檢研究摘要與關鍵數字。' },
      { name: 'Ko 等人 2015《BMJ》：台灣 HLA-B*58:01 篩檢前瞻研究', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4579807/', desc: '台灣全國前瞻性世代研究全文。' },
      { name: 'Wei 等人 2025《Nature Communications》：TPMI 藥物基因體風險變異', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC12241563/', desc: '以 486,956 位台灣精準醫療計畫參與者分析藥物基因體風險變異的臨床影響。' },
    ],
  },
  {
    title: '進階與綜論',
    items: [
      { name: 'CPIC 十年回顧（PMC）', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6925644/', desc: '了解 CPIC 證據等級 A/B（可據以行動）與 C/D 的意義。' },
      { name: 'Hung 等人 2024《Nature Reviews Disease Primers》：嚴重皮膚不良反應', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC13052379/', desc: 'SCAR 流行病學、機制模型與篩檢的最新綜論。' },
      { name: 'CPIC 2017:HLA-A、HLA-B 與 carbamazepine/oxcarbazepine 指引', url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC5847474/', desc: '建議強度、族群頻率與預測值（敏感度、特異度、PPV、NPV）。' },
    ],
  },
]
