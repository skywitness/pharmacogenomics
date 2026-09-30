// 內容靜態檢查:node scripts/check-content.mjs [--json]
// 檢查 src/content/ch*.js 與 src/content/glossary/*.js,以及場景檔內的 {{術語}}。
//   ERROR = 一定要修(會壞掉或違反契約);WARN = 需要人工判斷(多數是台灣用語/標點/風格)。
// 結束碼:有 ERROR → 1。
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const errors = []
const warns = []
const err = (f, m) => errors.push(`${f}: ${m}`)
const warn = (f, m) => warns.push(`${f}: ${m}`)

const BLOCK_TYPES = new Set(['p', 'h3', 'list', 'keypoints', 'callout', 'facts', 'table', 'steps', 'compare', 'bars', 'deepdive'])
const CALLOUT_KINDS = new Set(['info', 'warn', 'taiwan', 'tip', 'clinical'])

// 簡體字(台灣繁體不會出現的字形)
const SIMPLIFIED = '这个们为与业东严丽举乐习书买乱争亏云亚产亲众优伤伦传儿兑冈册写军农冲决况净凉减凤击则刚创刘动务劳势区医华协单卖卢卫却厂历压厅县参双变叙叠号叹后吗员响围图圆场块坏坚坛垄壳处备复够头夹奋奖妇妈娱孙学宁宝实审对导将尔层属岁岛币师带帮广库应庆开异弃张弹强归当录彻忆怀态总恋恶悬惊惯愿户执扩扫扬换损摄摆数断无时显晓术机杀杂权条来杨极构枪标样桥检楼欢残气汉沟没济浓湾灭灯点热爱环现电画疗监盖盘着矿码确础离种积称稳穷窝竞笔笃筑类粮级纪约红纤纯纳纸组细终经结绕给络统继续维综缓编缩网罗罚联肃肠脑脏脚舰艺节药获见观规视览觉计订认讨让训议记讲许论设访证评识诉词译试诚话该详语误说请诸读调谁谈谢谱贝贡财责贵贷费贺资赛赞赢赵车轨转软轮输边达迁过运还进远连迟适选递逻遗邮邻郑酿释钟钢钱铁银错锁锅镇长门闪闭问闲间队阳阴阶际陆陈险随隐难页顶项顺须预领频题颜额风饮饿馆驱验鱼鲜鸟鸡麦黄齐齿龙龟'
const simpSet = new Set(SIMPLIFIED)
// 中國用語 → 台灣用語(WARN,需人工判斷,不一定要改)
// bad 可為字串或 RegExp。合法的酵素名稱(聚合酶、激酶、去氫酶、轉移酶…)與「基因組合」不算錯。
const MAINLAND = [
  ['質量', '品質'], ['軟件', '軟體'], ['信息', '資訊'], ['默認', '預設'], ['視頻', '影片'], ['網絡', '網路'], ['程序', '程式'],
  ['用戶', '使用者'], ['數據庫', '資料庫'], [/基因組(?!合)/, '基因體'], ['靶向', '標靶'], ['靶點', '標靶/作用目標'], ['氨基酸', '胺基酸'],
  ['多態性', '多型性'], ['雜合子', '異型合子'], ['純合子', '同型合子'], ['表型', '表現型'],
  [/(?<![聚合去氫脫激轉移水解羧酸酯核蛋白磷氧還化連錄成])酶/, '酵素(僅酵素名稱如聚合酶、激酶可用「酶」)'], ['優化', '最佳化'],
  ['激活', '啟動/活化'], ['硬盤', '硬碟'], ['內存', '記憶體'], ['服務器', '伺服器'], ['打印', '列印'],
  ['卡馬西平', '卡巴馬平'], ['帶有者', '攜帶者'], ['氯匹格雷', '氯吡格雷(台灣有出處的寫法)'], ['龐氏方格', '龐尼特方格'],
]
const hit = (text, bad) => (bad instanceof RegExp ? bad.test(text) : text.includes(bad))
const key = (bad) => String(bad)

function walk(v, cb, p = '') {
  if (typeof v === 'string') return cb(v, p)
  if (Array.isArray(v)) return v.forEach((x, i) => walk(x, cb, `${p}[${i}]`))
  if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, cb, p ? `${p}.${k}` : k)
}

const contentDir = path.join(ROOT, 'src', 'content')
const glossDir = path.join(contentDir, 'glossary')
const sceneDir = path.join(ROOT, 'src', 'scenes')

// ── 術語表 ──
const gIndex = new Map()
const dupHits = new Set()
const gDefs = []
for (const f of fs.readdirSync(glossDir).filter((x) => x.endsWith('.js')).sort()) {
  const list = (await import(pathToFileURL(path.join(glossDir, f)).href)).default
  if (!Array.isArray(list)) {
    err(`glossary/${f}`, 'default export 不是陣列')
    continue
  }
  for (const g of list) {
    const where = `glossary/${f}#${g && g.key}`
    for (const k of ['key', 'zh', 'def', 'level']) if (!g || g[k] == null || g[k] === '') err(where, `缺少欄位 ${k}`)
    if (g && g.level != null && ![1, 2, 3, 4].includes(g.level)) err(where, `level 必須是 1-4,現為 ${g.level}`)
    if (g && g.def && g.def.length > 260) warn(where, `定義偏長(${g.def.length} 字),術語提示框建議 1-2 句`)
    const names = [g.key, g.zh, g.en, ...(g.aliases || [])].filter(Boolean).map((s) => String(s).toLowerCase())
    for (const n of names) {
      if (gIndex.has(n) && gIndex.get(n).file !== f) dupHits.add(`${where} ⇐ glossary/${gIndex.get(n).file}#${gIndex.get(n).key}`)
      else if (!gIndex.has(n)) gIndex.set(n, { file: f, key: g.key })
    }
    gDefs.push({ f, g })
  }
}

for (const d of dupHits) warn('glossary-dup', d + '(名稱重複,以先出現者為準)')

// ── 章節內容 ──
const chapters = []
const quizStats = []
for (const f of fs.readdirSync(contentDir).filter((x) => /^ch\d+\.js$/.test(x)).sort()) {
  const mod = await import(pathToFileURL(path.join(contentDir, f)).href)
  const ch = mod.default
  const id = f.replace('.js', '')
  chapters.push(ch)
  if (!ch) {
    err(f, '沒有 default export')
    continue
  }
  if (ch.id !== id) err(f, `id ${ch.id} 與檔名不符`)
  if (![1, 2, 3, 4].includes(ch.level)) err(f, 'level 必須是 1-4')
  for (const k of ['title', 'subtitle', 'minutes', 'blocks']) if (!ch[k]) err(f, `缺少 ${k}`)

  // blocks 結構、step 編號
  const steps = []
  let prose = 0
  const visit = (blocks, nested = false) => {
    for (const b of blocks || []) {
      if (!BLOCK_TYPES.has(b.type)) err(f, `未知 block 類型 ${b.type}`)
      if (b.type === 'callout' && !CALLOUT_KINDS.has(b.kind || 'info')) err(f, `callout.kind 不合法:${b.kind}`)
      if (b.step != null) steps.push(b.step)
      if (b.type === 'deepdive') visit(b.blocks, true)
      if (b.type === 'table') for (const r of b.rows || []) if (r.length !== b.head.length) err(f, `table「${b.caption || ''}」有列的欄數(${r.length})與表頭(${b.head.length})不同`)
    }
  }
  visit(ch.blocks)
  const uniq = [...new Set(steps)].sort((a, b) => a - b)
  if (!uniq.length) err(f, '沒有任何帶 step 的區塊')
  else {
    if (uniq[0] !== 0) err(f, `step 必須從 0 開始,現為 ${uniq[0]}`)
    for (let i = 1; i < uniq.length; i++) if (uniq[i] !== uniq[i - 1] + 1) err(f, `step 不連號:${uniq.join(',')}`)
    if (uniq.length < 4) warn(f, `step 少於 4 個(${uniq.length})`)
    let last = -1
    for (const s of steps) {
      if (s < last) warn(f, `step 順序在文字中倒退(${last} → ${s})`)
      last = Math.max(last, s)
    }
  }
  // 字數
  let chars = 0
  walk(ch.blocks, (s) => {
    chars += (s.match(/[一-鿿]/g) || []).length
  })
  if (chars < 1500) warn(f, `中文字數偏少(${chars})`)
  if (chars > 5500) warn(f, `中文字數偏多(${chars}),讀者可能讀不完`)

  // 測驗
  const qz = ch.quiz || []
  if (qz.length < 3) warn(f, `測驗題數 ${qz.length} (< 3)`)
  const pos = {}
  qz.forEach((q, i) => {
    if (!q.q || !Array.isArray(q.options) || q.options.length < 2) err(f, `quiz[${i}] 結構不完整`)
    else if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) err(f, `quiz[${i}].answer 超出範圍`)
    if (!q.explain) warn(f, `quiz[${i}] 沒有解析`)
    pos[q.answer] = (pos[q.answer] || 0) + 1
  })
  if (qz.length >= 4 && Object.values(pos).some((n) => n / qz.length > 0.6)) warn(f, `測驗答案位置過於集中:${JSON.stringify(pos)}`)
  // 選項長度偏誤:正確答案若總是最長/最詳細,學生不讀內容也能猜對
  if (qz.length >= 3) {
    let longest = 0
    let ratioSum = 0
    for (const q of qz) {
      if (!Array.isArray(q.options) || !Number.isInteger(q.answer)) continue
      const lens = q.options.map((o) => [...String(o)].length)
      const a = lens[q.answer]
      const others = lens.filter((_, i) => i !== q.answer)
      if (a > Math.max(...others)) longest++
      ratioSum += a / (others.reduce((x, y) => x + y, 0) / others.length)
    }
    const avg = ratioSum / qz.length
    if (longest / qz.length >= 0.6) warn(f, `測驗:正確選項在 ${longest}/${qz.length} 題是最長的(容易被猜中)`)
    if (avg > 1.35) warn(f, `測驗:正確選項平均長度是其他選項的 ${avg.toFixed(2)} 倍(目標 ≤ 1.3)`)
    quizStats.push([id, longest, qz.length, avg.toFixed(2), JSON.stringify(pos)])
  }

  // 來源
  if (!(ch.sources || []).length) warn(f, '沒有 sources')
  for (const s of ch.sources || []) if (!s.name || !/^https?:\/\//.test(s.url || '')) err(f, `sources 項目不合法:${JSON.stringify(s).slice(0, 80)}`)

  // 字串層級檢查
  const seenSimp = new Set()
  const seenMain = new Set()
  walk(ch, (s, p) => {
    for (const m of s.matchAll(/\{\{([^}|]+)(?:\|[^}]+)?\}\}/g)) {
      if (!gIndex.has(m[1].trim().toLowerCase())) err(f, `術語 {{${m[1].trim()}}} 不在術語表(${p})`)
    }
    for (const ch2 of s) if (simpSet.has(ch2) && !seenSimp.has(ch2)) (seenSimp.add(ch2), warn(f, `疑似簡體字「${ch2}」(${p}):${s.slice(Math.max(0, s.indexOf(ch2) - 8), s.indexOf(ch2) + 8)}`))
    for (const [bad, good] of MAINLAND) if (hit(s, bad) && !seenMain.has(key(bad))) (seenMain.add(key(bad)), warn(f, `用語「${bad}」→ 台灣較常用「${good}」(${p})`))
  })
  // 標點:CJK 旁的半形標點
  let asciiPunct = 0
  walk(ch, (s) => {
    asciiPunct += (s.match(/[一-鿿][,;:!?]|[,;:!?][一-鿿]|[一-鿿]\(|\)[一-鿿]/g) || []).length
  })
  if (asciiPunct) warn(f, `${asciiPunct} 處中文旁使用半形標點(可用 node scripts/normalize-punct.mjs 自動處理)`)
}

// ── 術語定義中的簡體字/標點 ──
for (const { f, g } of gDefs) {
  const text = [g.zh, g.def].join(' ')
  for (const c of text) if (simpSet.has(c)) warn(`glossary/${f}#${g.key}`, `疑似簡體字「${c}」`)
  for (const [bad, good] of MAINLAND) if (hit(text, bad)) warn(`glossary/${f}#${g.key}`, `用語「${bad}」→「${good}」`)
  if (/[一-鿿][,;:!?]|[,;:!?][一-鿿]|[一-鿿]\(|\)[一-鿿]/.test(text)) warn(`glossary/${f}#${g.key}`, '中文旁使用半形標點')
}

// ── 場景檔內的 {{術語}} ──
const scanScene = (file) => {
  const txt = fs.readFileSync(file, 'utf8')
  for (const m of txt.matchAll(/\{\{([^}|]+)(?:\|[^}]+)?\}\}/g)) if (!gIndex.has(m[1].trim().toLowerCase())) err(path.relative(ROOT, file), `術語 {{${m[1].trim()}}} 不在術語表`)
  if (/\r\n/.test(txt)) warn(path.relative(ROOT, file), 'CRLF 換行(專案統一使用 LF)')
}
const walkDir = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walkDir(path.join(d, e.name)) : e.name.endsWith('.js') && scanScene(path.join(d, e.name))))
walkDir(sceneDir)

// ── 章節層級一致 ──
const nos = chapters.map((c) => c && c.no)
if (new Set(nos).size !== nos.length) err('chapters', `章節編號重複:${nos}`)
const lv = chapters.map((c) => c && c.level)
for (let i = 1; i < lv.length; i++) if (lv[i] < lv[i - 1]) err('chapters', '章節層級沒有由淺入深遞增')

if (process.argv.includes('--quiz')) {
  console.log('章節  正確選項最長題數  總題數  平均長度比  答案位置分布')
  for (const r of quizStats) console.log(r.join('   '))
}
if (process.argv.includes('--json')) console.log(JSON.stringify({ errors, warns }, null, 1))
else {
  console.log(`章節 ${chapters.length} 個,術語 ${gDefs.length} 個(不重複名稱 ${gIndex.size})`)
  if (errors.length) console.log(`\nERROR (${errors.length})\n` + errors.map((e) => '  ✗ ' + e).join('\n'))
  if (warns.length) console.log(`\nWARN (${warns.length})\n` + warns.map((w) => '  · ' + w).join('\n'))
  console.log(errors.length ? '\nRESULT: FAIL' : '\nRESULT: PASS')
}
process.exit(errors.length ? 1 : 0)
