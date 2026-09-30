// ch08 場景用資料：全部取自 research/population-frequencies.verified.json 與 pgst-taiwan.verified.json。
// 每個數值都標了事實庫編號（fid）與是否已查證（ok:true = verified）。未查證者只在畫面上以「依 CPIC 頻率表」等歸屬字樣出現。
// v = null 代表「本章引用的資料沒有這個區域的數值」，畫面上顯示「無資料」，不做任何推測。

/** CPIC 生物地理族群的示意錨點（緯度，經度）。這只是「把柱子放在哪裡」，不代表該族群只住在那裡。 */
export const ANCHOR = {
  EA: { lat: 33, lon: 108, zh: '東亞', full: 'CPIC 東亞（加權平均）' },
  CSA: { lat: 23, lon: 79, zh: '中南亞', full: 'CPIC 中南亞（加權平均）' },
  EU: { lat: 49, lon: 14, zh: '歐洲', full: 'CPIC 歐洲（加權平均）' },
  SSA: { lat: 3, lon: 22, zh: '撒哈拉以南非洲', full: 'CPIC 撒哈拉以南非洲（加權平均）' },
  AFAM: { lat: 34, lon: -88, zh: '非裔美人', full: 'CPIC 非裔美人/加勒比非裔（加權平均）' },
  NE: { lat: 29, lon: 43, zh: '近東', full: 'CPIC 近東（加權平均）' },
  OC: { lat: -6, lon: 147, zh: '大洋洲', full: 'CPIC 大洋洲（加權平均，研究少）' },
  LA: { lat: -12, lon: -58, zh: '拉丁裔', full: 'CPIC 拉丁裔（Latino，混合族群；位置只是示意）' },
  TW: { lat: 23.7, lon: 121, zh: '台灣', full: '台灣' },
}

const NOTE_NODATA = '本章引用的資料沒有這個區域的數值（不代表該區沒有研究）。'

function g(key, v, extra = {}) {
  const a = ANCHOR[key]
  return { id: key, name: a.zh, full: a.full, lat: a.lat, lon: a.lon, v, kind: 'group', ...extra }
}
function nodata(key, note = NOTE_NODATA) {
  const a = ANCHOR[key]
  return { id: key, name: a.zh, full: a.full, lat: a.lat, lon: a.lon, v: null, kind: 'nodata', note }
}
function tw(v, extra = {}) {
  return { id: 'TW', name: '台灣', full: '台灣', lat: ANCHOR.TW.lat, lon: ANCHOR.TW.lon, v, kind: v == null ? 'nodata-tw' : 'taiwan', ...extra }
}

const SRC = {
  c2c19: 'CPIC CYP2C19 頻率表（文獻加權平均；表格最後修訂 2022-03-11）',
  c2d6: 'CPIC CYP2D6 頻率表（文獻加權平均；表格最後修訂 2024-10-17）',
  hlab: 'CPIC HLA-B 頻率表（表格最後修訂 2020-02-27）',
  vkorc1: 'CPIC VKORC1 頻率表',
  nudt15: 'CPIC NUDT15 頻率表（表格最後修訂 2022-03-11）',
  ntuh: 'Lin 等 2026：臺大醫院全外顯子世代（n=3,562；醫院世代，非隨機抽樣）',
  cmuh: 'Lu 等 2022：中國醫藥大學附設醫院陣列（n=172,854；醫院世代）',
  wang: 'Wang 2014 台灣健康成人研究（n=1,038,CPIC 頻率表收錄）',
  lee: 'Lee 2009 台灣漢人研究（n=307,CPIC 頻率表收錄）',
  afnd: 'CPIC HLA-B 頻率表 References（單一研究挑選值，多轉引自 Allele Frequency Net）',
}

/**
 * TOPICS: 每個「題目」有 allele（等位基因頻率）與/或 pheno（預測表現型頻率）兩種檢視。
 * view.axisMax = 柱高滿格對應的百分比。
 * view.compare = 讀數列要並排的 id。
 */
export const TOPICS = {
  cyp2c19_3: {
    label: 'CYP2C19*3（無功能等位基因）',
    gene: 'CYP2C19',
    views: {
      allele: {
        title: 'CYP2C19*3 等位基因頻率',
        short: 'CYP2C19*3：東亞 7.25%，歐洲僅 0.16%（等位基因頻率）',
        badge: 'CYP2C19*3',
        kindLabel: '等位基因頻率',
        axisMax: 16,
        items: [
          g('EA', 7.25, { src: SRC.c2c19, note: '各研究範圍 0%–20.7%。', fid: '07', ok: true }),
          g('CSA', 1.57, { src: SRC.c2c19, fid: '07', ok: true }),
          g('EU', 0.16, { src: SRC.c2c19, fid: '07', ok: true }),
          g('SSA', 0.27, { src: SRC.c2c19, fid: '07', ok: true }),
          g('AFAM', 0.28, { src: SRC.c2c19, fid: '07', ok: true }),
          g('OC', 14.6, { src: SRC.c2c19, note: '大洋洲研究很少、各研究範圍 1.7%–33%，不確定性大，請小心解讀。', lowConf: true, fid: '07', ok: true }),
          tw(5.8, { src: SRC.wang, note: '這是健康成人小型研究，不是全台隨機抽樣。', fid: '09', ok: true }),
          nodata('NE'),
          nodata('LA'),
        ],
        caption: '<b>CYP2C19*3</b>:CPIC 東亞加權平均 7.25%，歐洲只有 0.16%。這是<b>等位基因頻率</b>（所有染色體中的比例），不是「有多少人帶有」。',
        compare: ['TW', 'EA', 'EU'],
      },
      pheno: {
        title: 'CYP2C19 預測不良代謝者（PM）比例',
        short: '預測不良代謝者：東亞約 13.0%，歐洲約 2.4%（推估）',
        badge: 'CYP2C19 預測PM',
        kindLabel: '預測表現型頻率（由基因型推估，非實測酵素活性）',
        axisMax: 16,
        items: [
          g('EA', 13.0, { src: SRC.c2c19 + '；以 Hardy-Weinberg 推估', fid: '05', ok: true }),
          g('CSA', 8.2, { src: SRC.c2c19 + '；以 Hardy-Weinberg 推估', fid: '05', ok: true }),
          g('EU', 2.4, { src: SRC.c2c19 + '；以 Hardy-Weinberg 推估', fid: '05', ok: true }),
          g('SSA', 3.7, { src: SRC.c2c19 + '；以 Hardy-Weinberg 推估', fid: '05', ok: true }),
          g('AFAM', 4.1, { src: SRC.c2c19 + '；以 Hardy-Weinberg 推估', fid: '05', ok: true }),
          tw(13.9, { src: SRC.ntuh, note: '另有中間代謝者 47.0%，兩者合計 60.9%。', fid: '09', ok: true }),
          nodata('NE'),
          nodata('OC'),
          nodata('LA'),
        ],
        caption: '改看<b>預測不良代謝者（PM）</b>：東亞約 13.0%、歐洲 2.4%。這是由基因型推估的比例，<b>不是</b>「13% 的人吃藥一定無效」。',
        compare: ['TW', 'EA', 'EU'],
      },
    },
  },

  cyp2c19_17: {
    label: 'CYP2C19*17（增加功能等位基因）',
    gene: 'CYP2C19',
    views: {
      allele: {
        title: 'CYP2C19*17 等位基因頻率',
        short: 'CYP2C19*17 方向相反：歐洲 21.5%，東亞 2.05%',
        badge: 'CYP2C19*17',
        kindLabel: '等位基因頻率',
        axisMax: 25,
        items: [
          g('EU', 21.5, { src: SRC.c2c19, fid: '08', ok: false }),
          g('AFAM', 20.7, { src: SRC.c2c19, fid: '08', ok: false }),
          g('SSA', 17.3, { src: SRC.c2c19, fid: '08', ok: false }),
          g('CSA', 17.1, { src: SRC.c2c19, fid: '08', ok: false }),
          g('EA', 2.05, { src: SRC.c2c19, fid: '08', ok: false }),
          tw(0.6, { src: SRC.ntuh, fid: '08', ok: false }),
          nodata('NE'),
          nodata('OC'),
          nodata('LA'),
        ],
        caption: '<b>CYP2C19*17</b>（增加功能）：依 CPIC 頻率表，方向<b>反過來</b>——歐洲 21.5%、東亞僅 2.05%。頻率差異不是「亞洲人變異比較多」，而是各變異各有各的地理分布。',
        compare: ['TW', 'EA', 'EU'],
      },
      pheno: {
        title: 'CYP2C19 預測快速+超快速代謝者（RM+UM）比例',
        short: '預測快速+超快速：歐洲約 31.8%，東亞約 2.6%',
        badge: 'CYP2C19 RM+UM',
        kindLabel: '預測表現型頻率（由基因型推估，非實測酵素活性）',
        axisMax: 35,
        items: [
          g('EU', 31.8, { src: SRC.c2c19 + '；以 Hardy-Weinberg 推估', fid: '05', ok: true }),
          g('AFAM', 28.0, { src: SRC.c2c19 + '；以 Hardy-Weinberg 推估', fid: '05', ok: true }),
          g('SSA', 24.1, { src: SRC.c2c19 + '；以 Hardy-Weinberg 推估', fid: '05', ok: true }),
          g('CSA', 21.5, { src: SRC.c2c19 + '；以 Hardy-Weinberg 推估', fid: '05', ok: true }),
          g('EA', 2.6, { src: SRC.c2c19 + '；以 Hardy-Weinberg 推估', fid: '05', ok: true }),
          tw(null, { note: '本章引用的資料沒有台灣快速/超快速代謝者的比例（僅有 *17 等位基因 0.6%，見「等位基因」檢視）。' }),
          nodata('NE'),
          nodata('OC'),
          nodata('LA'),
        ],
        caption: '<b>快速+超快速代謝者（RM+UM）</b>：歐洲約 31.8%，東亞僅約 2.6%（CPIC 依 Hardy-Weinberg 推估）。台灣沒有可引用的對應數字，所以是空心圈。',
        compare: ['EA', 'EU'],
      },
    },
  },

  cyp2d6_10: {
    label: 'CYP2D6*10（降低功能等位基因）',
    gene: 'CYP2D6',
    views: {
      allele: {
        title: 'CYP2D6*10 等位基因頻率',
        short: 'CYP2D6*10：東亞約 43%；台灣是空心圈（未找到實測）',
        badge: 'CYP2D6*10',
        kindLabel: '等位基因頻率',
        axisMax: 50,
        items: [
          g('EA', 42.8, { src: SRC.c2d6, note: '以 67 項有報告 *10 的東亞研究（n=19,808）加權；單一研究範圍 8.6%–64.1%，且 CPIC 提醒 *10 可能被高估，請當成範圍看。', fid: '10', ok: true }),
          g('CSA', 7.6, { src: SRC.c2d6, fid: '10', ok: true }),
          g('NE', 6.8, { src: SRC.c2d6, fid: '10', ok: true }),
          g('OC', 5.7, { src: SRC.c2d6, fid: '10', ok: true }),
          g('SSA', 4.9, { src: SRC.c2d6, fid: '10', ok: true }),
          g('AFAM', 3.8, { src: SRC.c2d6, fid: '10', ok: true }),
          g('EU', 1.6, { src: SRC.c2d6, fid: '10', ok: true }),
          tw(null, { note: '本次沒有找到可核實的台灣本土 CYP2D6*10 實測頻率（大型陣列與外顯子研究因技術限制排除了 CYP2D6）。東亞的 42.8% 不能直接當成台灣的數字。' }),
          nodata('LA'),
        ],
        caption: '<b>CYP2D6*10</b>：東亞加權平均約 43%，歐洲約 1.6%。台灣是<b>空心圈</b>：本次沒有找到可核實的台灣實測值，不把東亞平均硬當成台灣。',
        compare: ['EA', 'EU'],
      },
      pheno: {
        title: 'CYP2D6 預測不良代謝者（PM，活性分數 0）比例',
        short: '預測不良代謝者：歐洲約 6.5%，東亞僅約 0.8%',
        badge: 'CYP2D6 預測PM',
        kindLabel: '預測表現型頻率（依 CPIC 切點自行換算的 Hardy-Weinberg 推估）',
        axisMax: 8,
        items: [
          g('EU', 6.5, { src: SRC.c2d6 + '；依 CPIC 切點自行換算', note: '東亞、歐洲各有 6.7%、3.7% 因資料缺漏無法分類。', fid: '31', ok: true }),
          g('EA', 0.8, { src: SRC.c2d6 + '；依 CPIC 切點自行換算', fid: '31', ok: true }),
          g('SSA', 2.0, { src: SRC.c2d6 + '；依 CPIC 切點自行換算', fid: '31', ok: true }),
          g('AFAM', 2.3, { src: SRC.c2d6 + '；依 CPIC 切點自行換算', fid: '31', ok: true }),
          g('CSA', 2.4, { src: SRC.c2d6 + '；依 CPIC 切點自行換算', fid: '31', ok: true }),
          tw(null, { note: '本次沒有找到可核實的台灣 CYP2D6 表現型頻率。' }),
          nodata('NE'),
          nodata('OC'),
          nodata('LA'),
        ],
        caption: '同一個基因改看<b>不良代謝者（PM）</b>：東亞約 0.8%、歐洲約 6.5%。<b>等位基因頻率高，不代表 PM 多</b>——整體中間代謝者兩地都約 38%，東亞的特色是 *10 造成活性分數 0.25–0.5 的一群偏多（約 29% 對歐洲 9.5%）。',
        compare: ['EA', 'EU'],
      },
    },
  },

  hla_1502: {
    label: 'HLA-B*15:02（carbamazepine 皮膚反應風險）',
    gene: 'HLA-B',
    views: {
      allele: {
        title: 'HLA-B*15:02 等位基因頻率',
        short: 'HLA-B*15:02：日本 0.03% → 台灣 4.4% → 越南 13.5%',
        badge: 'HLA-B*15:02',
        kindLabel: '等位基因頻率',
        axisMax: 15,
        items: [
          { id: 'JP', name: '日本', lat: 36, lon: 138, v: 0.03, kind: 'study', src: SRC.afnd, note: 'n=18,604 的單一研究。', fid: '15', ok: true },
          { id: 'KR', name: '南韓', lat: 36.5, lon: 128, v: 0.33, kind: 'study', src: SRC.afnd, note: 'n=4,128 的單一研究。', fid: '15', ok: true },
          { id: 'CN', name: '北方漢人', full: '中國北方漢人（北京/天津/石家莊）', lat: 39, lon: 116, v: 2.4, kind: 'study', src: SRC.afnd, note: '北京/天津/石家莊漢人，n=618。', fid: '15', ok: true },
          { id: 'HK', name: '香港華人', lat: 22.3, lon: 114.2, v: 9.4, kind: 'study', src: SRC.afnd, note: '骨髓庫，n=7,595；CPIC 中泰國、香港的其他研究列約 8.4%–10.2%。', fid: '15', ok: true },
          { id: 'TH', name: '泰國', lat: 15, lon: 101, v: 8.2, kind: 'study', src: SRC.afnd, note: 'n=986 的單一研究；CPIC 中泰國、香港的其他研究列約 8.4%–10.2%。', fid: '15', ok: true },
          { id: 'VN', name: '越南', full: '越南京族（河內）', lat: 21, lon: 105.8, v: 13.5, kind: 'study', src: SRC.afnd, note: '河內京族，n=170，樣本小。', fid: '15', ok: true },
          { id: 'MY', name: '馬來半島', full: '馬來半島馬來人', lat: 4.5, lon: 102, v: 12.3, kind: 'study', src: SRC.afnd, note: '馬來人，n=951。', fid: '15', ok: true },
          { id: 'JV', name: '爪哇', full: '西爪哇', lat: -7, lon: 107, v: 12.2, kind: 'study', src: SRC.afnd, note: 'n=236 的單一研究。', fid: '15', ok: true },
          tw(4.4, { src: SRC.ntuh + '；中國醫藥大學附設醫院陣列推算亦為 4.4%', note: '台灣各研究約 4.2%–6.0%；攜帶者（陽性者）實測 7.7%–8.8%。CPIC 收錄的台灣泰雅族（n=106）、布農族（n=101）兩項小型原住民族研究皆為 0，不能推論到其他原住民族。', fid: '17', ok: true }),
          g('CSA', 2.59, { src: SRC.hlab, fid: '14', ok: false }),
          g('EU', 0.01, { src: SRC.hlab, fid: '14', ok: false }),
          g('SSA', 0, { src: SRC.hlab, fid: '14', ok: false }),
          g('LA', 0.03, { src: SRC.hlab, fid: '14', ok: false }),
        ],
        caption: '<b>HLA-B*15:02</b>：日本 0.03%、南韓 0.33% → 台灣 4.4% → 泰國 8.2%、越南 13.5%。<b>「亞洲」不是一個數字</b>。（國別為單一研究挑選值）',
        compare: ['JP', 'TW', 'VN'],
      },
    },
  },

  hla_5801: {
    label: 'HLA-B*58:01（allopurinol 皮膚反應風險）',
    gene: 'HLA-B',
    views: {
      allele: {
        title: 'HLA-B*58:01 等位基因頻率',
        short: 'HLA-B*58:01：台灣約 11%,CPIC 東亞平均 6.0%',
        badge: 'HLA-B*58:01',
        kindLabel: '等位基因頻率',
        axisMax: 12,
        items: [
          tw(11.0, { src: SRC.ntuh, note: '台灣各研究約 9%–11.4%（CPIC 收錄的台灣研究最低約 8.8%；含 CPIC 收錄的漢人研究與中國醫藥大學附設醫院陣列）。NTUH 世代約每 5 位有 1 位是攜帶者（21.1%）。', fid: '20', ok: true }),
          g('EA', 6.0, { src: SRC.hlab, note: '含日本、韓國、中國、台灣等地的合併平均；日本約 0.6%–0.8%、韓國約 6%–7%、泰國 8.6%、香港 8.9%。', fid: '20', ok: true }),
          g('SSA', 4.35, { src: SRC.hlab, fid: '20', ok: true }),
          g('CSA', 4.19, { src: SRC.hlab, fid: '20', ok: true }),
          g('AFAM', 3.82, { src: SRC.hlab, fid: '20', ok: true }),
          g('NE', 1.87, { src: SRC.hlab, fid: '20', ok: true }),
          g('LA', 1.35, { src: SRC.hlab, fid: '20', ok: true }),
          g('EU', 0.77, { src: SRC.hlab, fid: '20', ok: true }),
          nodata('OC'),
        ],
        caption: '<b>HLA-B*58:01</b>：台灣約 11%（醫院世代），CPIC 東亞平均 6.0%，歐洲 0.77%。<b>東亞平均 ≠ 台灣</b>，所以需要本土資料。',
        compare: ['TW', 'EA', 'EU'],
      },
    },
  },

  vkorc1: {
    label: 'VKORC1 -1639G>A（啟動子變異）',
    gene: 'VKORC1',
    views: {
      allele: {
        title: 'VKORC1 -1639A（rs9923231 T 等位基因）頻率',
        short: 'VKORC1 -1639A：東亞約 87%，歐洲約 41%',
        badge: 'VKORC1 -1639A',
        kindLabel: '等位基因頻率',
        axisMax: 100,
        items: [
          g('EA', 86.6, { src: SRC.vkorc1, fid: '13', ok: true }),
          g('EU', 41.3, { src: SRC.vkorc1, fid: '13', ok: true }),
          g('CSA', 15.6, { src: SRC.vkorc1, fid: '13', ok: true }),
          g('SSA', 10.8, { src: SRC.vkorc1, fid: '13', ok: true }),
          g('AFAM', 10.1, { src: SRC.vkorc1, fid: '13', ok: true }),
          tw(88.5, { src: SRC.lee, note: '中國醫藥大學附設醫院陣列（n=172,854）約 0.89，約 80% 為 TT 基因型。華法林實際劑量需用含 CYP2C9 等因子的完整演算法，不能只看這一個頻率。', fid: '13', ok: true }),
          nodata('NE'),
          nodata('OC'),
          nodata('LA'),
        ],
        caption: '<b>VKORC1 -1639A</b>：在東亞是「多數」（約 87%），在歐洲 41%、非洲約 10%。「變異等位基因」不一定是少數。',
        compare: ['TW', 'EA', 'EU'],
      },
    },
  },

  nudt15: {
    label: 'NUDT15（硫嘌呤毒性相關）',
    gene: 'NUDT15',
    views: {
      allele: {
        title: 'NUDT15 無功能等位基因（*2 + *3）頻率',
        short: 'NUDT15 *2+*3：台灣約 10.5%，歐洲約 0.2%（僅計 *2 與 *3，未含其他等位基因）',
        badge: 'NUDT15 *2+*3',
        kindLabel: '等位基因頻率（*2 與 *3 合計）',
        axisMax: 12,
        items: [
          tw(10.5, { src: SRC.ntuh, note: '台灣 NUDT15 無功能等位基因（*2 與 *3）合計。', fid: '23', ok: true }),
          g('EA', 9.6, { src: SRC.nudt15 + ';*3 6.05% + *2 3.50%（自行加總）', fid: '22', ok: false }),
          g('LA', 4.4, { src: SRC.nudt15 + ';*3 0.75% + *2 3.65%（自行加總）', fid: '22', ok: false }),
          g('EU', 0.2, { src: SRC.nudt15, note: '歐洲 *3 為 0.20%、*2 為 0。', fid: '23', ok: true }),
          g('CSA', 6.7, { src: SRC.nudt15 + ';*3 6.70% + *2 0%（自行加總）', note: 'CPIC 表中中南亞的 *2 列為 0，但可能是沒有被檢測，而不是確定沒有，所以合計 6.7% 可能偏低。', fid: '22', ok: false }),
          nodata('NE'),
          nodata('OC'),
        ],
        caption: '<b>NUDT15</b> 無功能等位基因（*2 + *3 合計，未含其他等位基因）：台灣約 10.5%、東亞（CPIC 加總）約 9.6%、歐洲約 0.2%。這也是東亞硫嘌呤毒性要優先看 NUDT15 的原因。',
        compare: ['TW', 'EA', 'EU'],
      },
      pheno: {
        title: 'NUDT15 預測中間代謝者（IM）比例',
        short: 'NUDT15 預測中間代謝者：東亞約 19.4%，歐洲 1.36%',
        badge: 'NUDT15 預測IM',
        kindLabel: '預測表現型頻率（由基因型推估，非實測酵素活性）',
        axisMax: 22,
        items: [
          g('EA', 19.4, { src: SRC.nudt15 + '；以 Hardy-Weinberg 推估', note: '不良代謝者（PM）另有約 1.46%（推估）。', fid: '23', ok: true }),
          g('CSA', 12.9, { src: SRC.nudt15 + '；以 Hardy-Weinberg 推估', fid: '23', ok: true }),
          g('LA', 11.9, { src: SRC.nudt15 + '；以 Hardy-Weinberg 推估', fid: '23', ok: true }),
          g('EU', 1.36, { src: SRC.nudt15 + '；以 Hardy-Weinberg 推估', fid: '23', ok: true }),
          tw(18.6, { src: SRC.ntuh, note: '不良代謝者（PM）另有 0.9%。', fid: '23', ok: true }),
          nodata('NE'),
          nodata('OC'),
        ],
        caption: '<b>NUDT15 預測中間代謝者</b>：東亞約 19.4%、台灣（NTUH）18.6%、歐洲 1.36%。',
        compare: ['TW', 'EA', 'EU'],
      },
    },
  },
}

export const TOPIC_ORDER = ['cyp2c19_3', 'cyp2c19_17', 'cyp2d6_10', 'hla_1502', 'hla_5801', 'vkorc1', 'nudt15']

/** 把等位基因頻率 p（%）粗估成攜帶者比例 1-(1-p)^2（自行換算，假設 Hardy-Weinberg）。 */
export function carrierFromAllele(pct) {
  const p = pct / 100
  return (1 - (1 - p) * (1 - p)) * 100
}

export function fmtPct(v) {
  if (v == null) return '無資料'
  if (v === 0) return '0%'
  return v.toFixed(2).replace(/(\.\d)0$/, '$1') + '%'
}

/** 攜帶者粗估的顯示：只給概略整數（避免假精確）。 */
export function fmtCarrier(pct) {
  const c = carrierFromAllele(pct)
  if (c < 0.1) return '<0.1%'
  if (c < 1) return c.toFixed(1) + '%'
  return Math.round(c) + '%'
}
