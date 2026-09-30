// 閱讀模式測試:node scripts/reading-mode.mjs
// 驗證(手機 390x844):收合後 3D 不載入/不繪製、偏好記在 localStorage、重新整理仍收合(場景仍是 idle)、
// 從導覽選單的開關切回、切換時閱讀位置不跳走;桌機忽略此偏好。截圖存於 test-output/reading/。
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(ROOT, 'test-output', 'reading')
fs.mkdirSync(out, { recursive: true })
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const port = await new Promise((r) => {
  const s = net.createServer()
  s.listen(0, '127.0.0.1', () => {
    const { port } = s.address()
    s.close(() => r(port))
  })
})
const cache = path.join(ROOT, 'node_modules', '.vite-smoke', 'rd' + process.pid)
const server = await createServer({ root: ROOT, cacheDir: cache, optimizeDeps: { noDiscovery: true, include: [] }, server: { host: '127.0.0.1', port, strictPort: true, watch: null, hmr: false }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let bad = 0
const check = (name, ok, extra = '') => {
  console.log(`  ${ok ? '✔' : '✗'} ${name} ${extra}`)
  if (!ok) bad++
}
const stageInfo = (page, id) =>
  page.evaluate((sid) => {
    const s = window.__pgx.stages.get(sid)
    const el = document.querySelector('#stage-' + sid) || document.querySelector('#stage-hero')
    const cs = getComputedStyle(el)
    return { state: s.state, collapsed: s.collapsed, hasRenderer: !!s.renderer, frames: s.frames, cls: el.className, h: Math.round(el.getBoundingClientRect().height), pos: cs.position, disp: cs.display }
  }, id)

async function newPage(mobile, pref) {
  const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript((p) => {
    try {
      if (p != null && !sessionStorage.getItem('__seeded')) {
        localStorage.setItem('pgx.reading.v1', p)
        sessionStorage.setItem('__seeded', '1')
      }
    } catch {}
  }, pref)
  const page = await ctx.newPage()
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())
  return page
}
const goto = async (page, p) => {
  await page.goto(`http://127.0.0.1:${port}${p}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForSelector('#main', { timeout: 60000 })
}

console.log('\n[手機] 章節頁 ch05')
{
  const page = await newPage(true, null)
  await goto(page, '/?only=ch05')
  await page.waitForFunction(() => window.__pgx.stages.get('ch05')?.frames > 5, null, { timeout: 90000 })
  const before = await stageInfo(page, 'ch05')
  check('預設:動畫區展開且正在繪製', !before.collapsed && before.hasRenderer, `stage 高度 ${before.h}px`)
  await page.screenshot({ path: path.join(out, '1-expanded.png') })

  // 往下捲到章節中段,記錄某段文字的位置,再收合,檢查位置沒跳走
  await page.evaluate(() => {
    const p = document.querySelector('.prose')
    window.scrollTo({ top: p.getBoundingClientRect().top + scrollY + p.offsetHeight * 0.4, behavior: 'instant' })
  })
  await sleep(800)
  const anchorTop = () =>
    page.evaluate(() => {
      const el = document.elementFromPoint(innerWidth / 2, innerHeight * 0.6)?.closest('.prose > *')
      window.__anchor = window.__anchor || el
      return window.__anchor ? Math.round(window.__anchor.getBoundingClientRect().top) : null
    })
  const t0 = await anchorTop()
  await page.click('.stage-collapse-btn')
  await sleep(900)
  const t1 = await anchorTop()
  const collapsed = await stageInfo(page, 'ch05')
  check('按「隱藏動畫」後動畫區收合', collapsed.collapsed && /is-collapsed/.test(collapsed.cls))
  check('收合後不再繪製(renderer 已釋放)', !collapsed.hasRenderer)
  check('收合後不再黏頂、只剩細列', collapsed.pos === 'static' && collapsed.h < 70, `position=${collapsed.pos}, 高度 ${collapsed.h}px`)
  check('按鈕文字變成「顯示 3D 動畫」', (await page.textContent('.stage-collapse-btn')).includes('顯示 3D 動畫'))
  check('偏好寫入 localStorage', (await page.evaluate(() => localStorage.getItem('pgx.reading.v1'))) === '1')
  check('切換時閱讀位置沒有跳走(< 8px)', t0 != null && t1 != null && Math.abs(t1 - t0) < 8, `錨點 top ${t0} → ${t1}`)
  await page.screenshot({ path: path.join(out, '2-collapsed.png') })

  // 重新整理:仍收合,且場景根本沒被載入
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#main')
  await sleep(2500)
  const re = await stageInfo(page, 'ch05')
  check('重新整理後仍是收合', re.collapsed)
  check('收合狀態下場景沒有被載入(state=idle)', re.state === 'idle', `state=${re.state}`)

  // 用導覽選單的開關切回來
  await page.click('.nav-menu-btn')
  const sw = await page.$('.menu-switch')
  check('導覽選單有「閱讀模式」開關且為開啟狀態', !!sw && (await sw.getAttribute('aria-checked')) === 'true')
  await sw.click()
  await page.waitForFunction(() => window.__pgx.stages.get('ch05')?.frames > 5, null, { timeout: 90000 }).catch(() => {})
  const back = await stageInfo(page, 'ch05')
  check('關閉閱讀模式後動畫區展開並開始繪製', !back.collapsed && back.hasRenderer && back.state === 'ready', `state=${back.state}, frames=${back.frames}`)
  check('偏好已更新為關閉', (await page.evaluate(() => localStorage.getItem('pgx.reading.v1'))) === '0')
  await page.screenshot({ path: path.join(out, '3-restored.png') })
  await page.context().close()
}

console.log('\n[手機] 首頁(含 Hero)開啟閱讀模式')
{
  const page = await newPage(true, '1')
  await goto(page, '/')
  await sleep(3000)
  const hero = await stageInfo(page, 'hero')
  check('Hero 3D 背景也被收起且沒載入', hero.collapsed && hero.state === 'idle' && hero.disp === 'none', `state=${hero.state}, display=${hero.disp}`)
  const live = await page.evaluate(() => [...window.__pgx.stages.values()].filter((s) => s.renderer).length)
  const loaded = await page.evaluate(() => [...window.__pgx.stages.values()].filter((s) => s.state !== 'idle').length)
  check('整頁沒有任何 WebGL renderer,也沒有場景被載入', live === 0 && loaded === 0, `renderer=${live}, 已載入場景=${loaded}`)
  await page.screenshot({ path: path.join(out, '4-home-reading.png') })
  await page.evaluate(() => document.querySelector('#ch03').scrollIntoView({ behavior: 'instant' }))
  await sleep(700)
  await page.screenshot({ path: path.join(out, '5-chapter-reading.png') })
  await page.context().close()
}

console.log('\n[桌機] 偏好為開啟時不受影響')
{
  const page = await newPage(false, '1')
  await goto(page, '/?only=ch05')
  await page.waitForFunction(() => window.__pgx.stages.get('ch05')?.frames > 5, null, { timeout: 90000 })
  const d = await stageInfo(page, 'ch05')
  check('桌機忽略閱讀模式,動畫區仍正常顯示', !d.collapsed && d.hasRenderer)
  check('桌機看不到「隱藏動畫」按鈕與選單開關', !(await page.isVisible('.stage-collapse-btn')))
  await page.context().close()
}

await browser.close()
await server.close()
fs.rmSync(cache, { recursive: true, force: true })
console.log(bad ? '\nRESULT: FAIL' : '\nRESULT: PASS')
process.exit(bad ? 1 : 0)
