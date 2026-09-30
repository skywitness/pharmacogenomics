// 全形標點正規化:node scripts/normalize-punct.mjs [--write] [paths…]
// 把「緊鄰中文字」的半形標點  , ; : ! ? . ( )  轉成全形  ，；：！？。（）。
// 預設只預覽(dry-run);加 --write 才改檔。預設處理 src/ 與 index.html。
//
// 安全性:中文字只會出現在字串或註解裡,程式碼的標點不會緊鄰中文字,因此只看「緊鄰」關係即可。
// 括號成對處理(同一行內):任一側緊鄰中文才轉,且不動 markdown 連結 ](…) 與 URL。
// 執行後請跑:node scripts/check-content.mjs && npx vite build 確認沒壞。
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const write = args.includes('--write')
const targets = args.filter((a) => !a.startsWith('--'))
if (!targets.length) targets.push('src', 'index.html')

const CJK = /[㐀-鿿豈-﫿]/
const FW = /[、-〿＀-￯…]/ // 、。「」『』【】《》…,以及全形標點與全形括號
const like = (c) => !!c && (CJK.test(c) || FW.test(c))
const MAP = { ',': '，', ';': '；', ':': '：', '!': '！', '?': '？' }

function fixLine(line) {
  if (!/[㐀-鿿]/.test(line)) return { line, n: 0 }
  let chars = [...line]
  let n = 0
  // 1) 括號成對
  const stack = []
  const pairs = []
  chars.forEach((c, i) => {
    if (c === '(') stack.push(i)
    else if (c === ')' && stack.length) pairs.push([stack.pop(), i])
  })
  for (const [i, j] of pairs) {
    const inner = chars.slice(i + 1, j).join('')
    const before = chars[i - 1]
    const after = chars[j + 1]
    if (before === ']' || /^(https?:|#)/.test(inner)) continue // markdown 連結
    if (like(before) || like(chars[i + 1]) || like(chars[j - 1]) || like(after)) {
      chars[i] = '（'
      chars[j] = '）'
      n += 2
    }
  }
  // 2) , ; : ! ? .   (前後若隔著 HTML 標籤,例如 </span>? ,看標籤外側的字元)
  // 標記符號  與  對相鄰判斷是透明的:{{術語}}：、**粗體**； 這種情況前一個「有意義」的字元是中文
  const skipMarkBack = (k) => {
    for (;;) {
      if (chars[k] === '}' && chars[k - 1] === '}') k -= 2
      else if (chars[k] === '*' && chars[k - 1] === '*') k -= 2
      else return k
    }
  }
  const skipMarkFwd = (k) => {
    for (;;) {
      if (chars[k] === '{' && chars[k + 1] === '{') k += 2
      else if (chars[k] === '*' && chars[k + 1] === '*') k += 2
      else return k
    }
  }
  const skipTagBack0 = (k) => {
    while (chars[k] === '>') {
      let j = k
      while (j >= 0 && chars[j] !== '<') j--
      if (j < 0 || !/^<\/?[a-zA-Z][^>]*>$/.test(chars.slice(j, k + 1).join(''))) break
      k = j - 1
    }
    return k
  }
  const skipTagBack = (k) => skipMarkBack(skipTagBack0(skipMarkBack(k)))
  const skipTagFwd0 = (k) => {
    while (chars[k] === '<') {
      let j = k
      while (j < chars.length && chars[j] !== '>') j++
      if (j >= chars.length || !/^<\/?[a-zA-Z][^>]*>$/.test(chars.slice(k, j + 1).join(''))) break
      k = j + 1
    }
    return k
  }
  const skipTagFwd = (k) => skipMarkFwd(skipTagFwd0(skipMarkFwd(k)))
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i]
    const prev = chars[skipTagBack(i - 1)]
    const next = chars[skipTagFwd(i + 1)]
    if (c in MAP) {
      if (like(prev) || like(next)) {
        // URL 內的標點(前後都是拉丁字元)不會走到這裡;這裡是緊鄰中文者
        chars[i] = MAP[c]
        n++
        // 全形標點後的多餘空白
        while (chars[i + 1] === ' ' && like(chars[i + 2])) chars.splice(i + 1, 1)
      }
    } else if (c === '.') {
      if (like(prev) && prev !== '.' && next !== '.' && (next === undefined || /[\s'"`)）」』\]}<]/.test(next) || like(next))) {
        chars[i] = '。'
        n++
      }
    }
  }
  return { line: chars.join(''), n }
}

function processFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const eol = src.includes('\r\n') ? '\r\n' : '\n'
  let total = 0
  const out = src
    .split(/\r?\n/)
    .map((l) => {
      const r = fixLine(l)
      total += r.n
      return r.line
    })
    .join(eol)
  return { out, total, changed: out !== src }
}

function* files(p) {
  const abs = path.resolve(ROOT, p)
  const st = fs.statSync(abs)
  if (st.isFile()) return yield abs
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    if (e.isDirectory()) yield* files(path.join(abs, e.name))
    else if (/\.(js|html|css)$/.test(e.name)) yield path.join(abs, e.name)
  }
}

let grand = 0
let touched = 0
for (const t of targets) {
  for (const f of files(t)) {
    if (f.endsWith('.css')) continue // CSS 不含需要處理的中文標點
    const { out, total, changed } = processFile(f)
    if (!changed) continue
    grand += total
    touched++
    console.log(`${write ? 'fixed ' : 'would fix '} ${String(total).padStart(4)}  ${path.relative(ROOT, f)}`)
    if (write) fs.writeFileSync(f, out)
  }
}
console.log(`\n${touched} 個檔案、${grand} 處${write ? '已修改' : '將修改(dry-run;加 --write 套用)'}`)
