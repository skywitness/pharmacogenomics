// 無障礙檢查(axe-core):node scripts/a11y.mjs [chNN ...]   預設檢查首頁(桌機/手機)與指定章節
// 另外驗證:鍵盤操作 3D 畫面、Esc 關閉選單並把焦點還給按鈕、術語提示 aria-expanded、測驗作答後焦點不掉。
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const axeSrc = fs.readFileSync(path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8')
const port = await new Promise((r) => {
  const s = net.createServer()
  s.listen(0, '127.0.0.1', () => {
    const { port } = s.address()
    s.close(() => r(port))
  })
})
const server = await createServer({ root: ROOT, cacheDir: path.join(ROOT, 'node_modules', '.vite-smoke', 'ax' + process.pid), optimizeDeps: { noDiscovery: true, include: [] }, server: { host: '127.0.0.1', port, strictPort: true, watch: null, hmr: false }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let bad = 0

async function runAxe(page, label) {
  await page.evaluate(axeSrc)
  const res = await page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } })
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes.slice(0, 2).map((n) => n.target.join(' ').slice(0, 90)) }))
  })
  const serious = res.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  console.log(`\n[axe] ${label}: ${res.length} 類違規(serious/critical ${serious.length})`)
  for (const v of res) console.log(`  ${v.impact?.padEnd(9)} ${v.id} ×${v.n} — ${v.help}\n      ${v.sample.join(' | ')}`)
  if (serious.length) bad++
}

for (const [name, vp, mobile] of [['desktop 1440x900', { width: 1440, height: 900 }, false], ['mobile 390x844', { width: 390, height: 844 }, true]]) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, locale: 'zh-TW' })
  const page = await ctx.newPage()
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForSelector('#main', { timeout: 60000 })
  await sleep(2500)
  await runAxe(page, `首頁 ${name}`)
  for (const id of ids) {
    await page.goto(`http://127.0.0.1:${port}/?only=${id}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForSelector('.chapter', { timeout: 60000 })
    await sleep(2500)
    if (mobile) {
      const tg = await page.$('.stage-controls-toggle')
      if (tg && (await tg.isVisible())) await tg.click()
    }
    await runAxe(page, `${id} ${name}`)
  }
  await ctx.close()
}

// ── 行為測試(桌機) ──
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'zh-TW' })
  const page = await ctx.newPage()
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())
  const id = ids[0] || 'ch05'
  await page.goto(`http://127.0.0.1:${port}/?only=${id}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction((sid) => window.__pgx?.stages.get(sid)?.frames > 5, id, { timeout: 90000 }).catch(() => {})
  const check = (name, ok, extra = '') => {
    console.log(`  ${ok ? '✔' : '✗'} ${name} ${extra}`)
    if (!ok) bad++
  }
  console.log('\n[行為檢查]')
  // Esc 關閉選單 → 焦點回到按鈕
  await page.focus('.nav-menu-btn')
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await page.keyboard.press('Escape')
  check('Esc 關閉導覽選單並把焦點還給「目錄」按鈕', await page.evaluate(() => document.activeElement?.classList.contains('nav-menu-btn') && document.querySelector('.nav-menu').hidden))
  // 3D 畫面可聚焦、方向鍵會旋轉
  await sleep(5000) // 等場景的進場鏡頭動畫結束
  const before = await page.evaluate((sid) => window.__pgx.stages.get(sid).camera.position.toArray().map((x) => +x.toFixed(3)), id)
  await page.focus(`#stage-${id} .stage-view`)
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight')
  await sleep(600)
  const after = await page.evaluate((sid) => window.__pgx.stages.get(sid).camera.position.toArray().map((x) => +x.toFixed(3)), id)
  check('3D 畫面可用鍵盤聚焦,方向鍵旋轉視角', JSON.stringify(before) !== JSON.stringify(after), `${before} → ${after}`)
  await page.keyboard.press('Home')
  await sleep(300)
  // HUD 按鈕用「真實滑鼠」也能點(不被 OrbitControls 的 pointer capture 吃掉)
  await page.click(`#stage-${id} [data-act="pause"]`)
  check('HUD「暫停動畫」可用滑鼠點擊', (await page.getAttribute(`#stage-${id} [data-act="pause"]`, 'aria-pressed')) === 'true')
  await page.click(`#stage-${id} [data-act="pause"]`)
  // 術語按鈕
  const term = await page.$('.prose .term')
  if (term) {
    await term.focus()
    await page.keyboard.press('Enter')
    check('術語按鈕開啟後 aria-expanded=true', (await term.getAttribute('aria-expanded')) === 'true')
    await page.keyboard.press('Escape')
    check('Esc 關閉術語提示', (await term.getAttribute('aria-expanded')) === 'false')
  }
  // 測驗:作答後焦點不掉到 body
  const opt = await page.$('.quiz-opt')
  if (opt) {
    await opt.focus()
    await page.keyboard.press('Enter')
    check('測驗作答後焦點仍在該選項', await page.evaluate(() => document.activeElement?.classList.contains('quiz-opt')))
    check('作答結果有文字標記(不只靠顏色)', (await page.$$('.quiz-mark')).length > 0)
  }
  await ctx.close()
}

await browser.close()
await server.close()
fs.rmSync(path.join(ROOT, 'node_modules', '.vite-smoke', 'ax' + process.pid), { recursive: true, force: true })
console.log(bad ? '\nRESULT: FAIL' : '\nRESULT: PASS')
process.exit(bad ? 1 : 0)
