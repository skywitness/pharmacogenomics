// 內文的極簡標記語言（內容作者請只用這些，一律先跳脫 HTML，不必擔心 < > &）
//
//   **粗體**            → <strong>
//   `code`              → <code>  （基因/等位基因/rsID 建議用，例如 `CYP2C19*2`）
//   {{詞彙}}            → 術語表連結（點擊/聚焦顯示定義）；詞彙需存在於 content/glossary.js 的 zh / en / key / aliases
//   {{詞彙|顯示文字}}   → 同上但顯示不同文字
//   [文字](https://..)  → 外部連結（只允許 http/https 與 # 錨點）
//   換行 \n             → <br>
//
// 注意：星號 * 在基因名稱（如 CYP2C19*2/*3）中是普通字元，只有連續兩個 ** 才是粗體。

import { findTerm } from '../content/glossary.js'

export function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const missing = new Set()

export function inline(text) {
  if (text == null) return ''
  let s = esc(text)
  // code
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  // bold
  s = s.replace(/\*\*([^*][\s\S]*?)\*\*/g, '<strong>$1</strong>')
  // links
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|#[^\s)]*)\)/g, (m, t, u) => {
    const ext = u.startsWith('http')
    return `<a href="${u}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${t}</a>`
  })
  // glossary
  s = s.replace(/\{\{([^}|]+)(?:\|([^}]+))?\}\}/g, (m, term, shown) => {
    const entry = findTerm(term.trim())
    const label = shown || term
    if (!entry) {
      if (import.meta.env && import.meta.env.DEV && !missing.has(term)) {
        missing.add(term)
        console.warn(`[glossary] 找不到術語：${term}`)
      }
      return label
    }
    return `<button type="button" class="term" data-term="${esc(entry.key)}" aria-haspopup="dialog" aria-expanded="false">${label}</button>`
  })
  s = s.replace(/\n/g, '<br>')
  return s
}

/** 建立元素的小工具 */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === 'class') el.className = v
    else if (k === 'text') el.textContent = v
    else if (k === 'html') el.innerHTML = v
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v)
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(kid))
  return el
}
