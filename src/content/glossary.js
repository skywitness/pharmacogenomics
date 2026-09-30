// 術語表聚合器。
// 每個檔案 src/content/glossary/*.js 都 `export default [ ...terms ]`，這裡自動合併（章節作者各寫各的，不會互相衝突）。
// 每一筆：{ key, zh, en, def, level(1-4), aliases?:[] }
//   key     : 唯一鍵，通常用英文縮寫或英文名（比對時不分大小寫）
//   def     : 白話定義，1–2 句
// 內文用 {{key}} / {{zh}} / {{en}} / {{alias}} 都能連到。重複 key 以先出現者為準（檔名排序）。

const mods = import.meta.glob('./glossary/*.js', { eager: true })

export const glossary = []
const index = new Map()

for (const path of Object.keys(mods).sort()) {
  const list = mods[path].default || []
  for (const g of list) {
    if (!g || !g.key) continue
    if (index.has(String(g.key).toLowerCase())) continue
    glossary.push(g)
    for (const k of [g.key, g.zh, g.en, ...(g.aliases || [])]) {
      if (k && !index.has(String(k).toLowerCase())) index.set(String(k).toLowerCase(), g)
    }
  }
}

export function findTerm(name) {
  return index.get(String(name).toLowerCase()) || null
}
