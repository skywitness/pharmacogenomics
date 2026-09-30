// 多視窗尺寸截圖:node scripts/viewports.mjs ch05 [ch01 ...]  → test-output/viewports/<id>-<WxH>[-drawer].png
// 用來檢查響應式版面:1440x900 / 1366x768 / 1024x700(桌機與小筆電),768x1024(平板)、390x844 與 360x740(手機)、844x390(橫向手機)。
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ids = process.argv.slice(2).filter((a) => !a.startsWith('--'))
if (!ids.length) ids.push('ch05')
const out = path.join(ROOT, 'test-output', 'viewports')
fs.mkdirSync(out, { recursive: true })
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const port = await new Promise((r) => {
  const s = net.createServer()
  s.listen(0, '127.0.0.1', () => {
    const { port } = s.address()
    s.close(() => r(port))
  })
})
const server = await createServer({ root: ROOT, cacheDir: path.join(ROOT, 'node_modules', '.vite-smoke', 'vp' + process.pid), optimizeDeps: { noDiscovery: true, include: [] }, server: { host: '127.0.0.1', port, strictPort: true, watch: null, hmr: false }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const VIEWS = [
  [1440, 900, false], [1366, 768, false], [1024, 700, false], [768, 1024, true], [390, 844, true], [360, 740, true], [844, 390, true],
]
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
for (const id of ids) {
  for (const [w, h, touch] of VIEWS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: touch, hasTouch: touch, deviceScaleFactor: touch ? 2 : 1, locale: 'zh-TW' })
    const page = await ctx.newPage()
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())
    await page.goto(`http://127.0.0.1:${port}/?only=${id}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForFunction((sid) => window.__pgx && window.__pgx.stages.get(sid) && window.__pgx.stages.get(sid).frames > 6, id, { timeout: 90000, polling: 250 }).catch(() => {})
    // 捲到章節本文中段,看黏頂舞台與文字的關係
    await page.evaluate(() => {
      const p = document.querySelector('.prose')
      const y = p.getBoundingClientRect().top + scrollY + p.offsetHeight * 0.32
      window.scrollTo({ top: y, behavior: 'instant' })
    })
    await sleep(1800)
    const tag = `${id}-${w}x${h}`
    await page.screenshot({ path: path.join(out, tag + '.png') })
    const tg = await page.$('.stage-controls-toggle')
    if (tg && (await tg.isVisible())) {
      await tg.click()
      await sleep(1200)
      await page.screenshot({ path: path.join(out, tag + '-drawer.png') })
    }
    const m = await page.evaluate(() => {
      const st = document.querySelector('.stage')
      const r = st.getBoundingClientRect()
      const c = st.querySelector('.stage-controls')
      const v = st.querySelector('.stage-view').getBoundingClientRect()
      return { vw: innerWidth, vh: innerHeight, sw: document.documentElement.scrollWidth, stageTop: Math.round(r.top), stageBottom: Math.round(r.bottom), viewH: Math.round(v.height), controlsH: c ? Math.round(c.getBoundingClientRect().height) : 0, controlsScrollH: c ? c.scrollHeight : 0 }
    })
    console.log(tag.padEnd(16), JSON.stringify(m), m.sw > m.vw + 2 ? 'OVERFLOW-X' : '')
    await ctx.close()
  }
}
await browser.close()
await server.close()
fs.rmSync(path.join(ROOT, 'node_modules', '.vite-smoke', 'vp' + process.pid), { recursive: true, force: true })
