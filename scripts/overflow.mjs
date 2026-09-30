// 找出造成水平溢出的元素:node scripts/overflow.mjs ch05 [--width 390]
import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import net from 'node:net'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const id = process.argv[2] || 'ch05'
const wi = process.argv.indexOf('--width')
const width = wi > 0 ? Number(process.argv[wi + 1]) : 390
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => fs.existsSync(p))
const port = await new Promise((r) => {
  const s = net.createServer()
  s.listen(0, '127.0.0.1', () => {
    const { port } = s.address()
    s.close(() => r(port))
  })
})
const server = await createServer({ root: ROOT, cacheDir: path.join(ROOT, 'node_modules', '.vite-smoke', 'ov' + process.pid), optimizeDeps: { noDiscovery: true, include: [] }, server: { host: '127.0.0.1', port, strictPort: true, watch: null, hmr: false }, logLevel: 'error' })
await server.listen()
const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const page = await (await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 700, hasTouch: width < 700 })).newPage()
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())
await page.goto(`http://127.0.0.1:${port}/?only=${id}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
await page.waitForSelector('.chapter', { timeout: 60000 })
await new Promise((r) => setTimeout(r, 4000))
const out = await page.evaluate(() => {
  const vw = document.documentElement.clientWidth
  const bad = []
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect()
    if (r.width && r.right > vw + 1) {
      const cs = getComputedStyle(el)
      bad.push({ tag: el.tagName.toLowerCase(), cls: (el.className && el.className.toString().slice(0, 60)) || '', right: Math.round(r.right), width: Math.round(r.width), pos: cs.position, disp: cs.display })
    }
  }
  return { vw, sw: document.documentElement.scrollWidth, count: bad.length, first: bad.slice(0, 14) }
})
console.log(JSON.stringify(out, null, 1))
await browser.close()
await server.close()
fs.rmSync(path.join(ROOT, 'node_modules', '.vite-smoke', 'ov' + process.pid), { recursive: true, force: true })
