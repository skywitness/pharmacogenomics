// 煙霧測試 + 截圖:自動開啟某章節的 3D 舞台,操作所有控制項,收集錯誤,輸出截圖給人/agent 檢視。
//
// 用法(在專案根目錄):
//   node scripts/smoke.mjs ch05            # 測單一章節  → test-output/ch05/*.png + report.json
//   node scripts/smoke.mjs ch05 --mobile   # 手機尺寸 (390x844, 觸控)
//   node scripts/smoke.mjs hero            # 測 Hero 背景(完整首頁)
//   node scripts/smoke.mjs all             # 完整頁面:逐一捲到每個舞台,檢查全部(含 WebGL context 數量、錯誤)
//   加上 --steps 會逐一捲動有 data-step 的文字區塊並截圖(驗證 onStep 與文字同步)
//   加上 --url http://127.0.0.1:5173 使用既有 dev server(預設自己啟動一個隨機埠的 Vite)
//   加上 --tag NAME 把輸出放到 test-output/<target>[-mobile]-NAME/(多人同時測同一章時避免互相覆蓋)
//
// 結束碼:0 = 無錯誤;1 = 有 console error / pageerror / 場景錯誤 / 空白畫面。
// 重要:截圖存於 test-output/,請用 Read 工具實際「看」圖片,確認畫面不是空白、構圖合理、沒有文字重疊。

import { createServer } from 'vite'
import { chromium } from 'playwright-core'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const target = args.find((a) => !a.startsWith('--')) || 'all'
const flag = (n) => args.includes('--' + n)
const opt = (n) => {
  const i = args.indexOf('--' + n)
  return i >= 0 ? args[i + 1] : null
}
const mobile = flag('mobile')
const withSteps = flag('steps')
const tag = opt('tag') // 多人同時測同一章時用來分開輸出資料夾:--tag reviewer1
const outRoot = path.join(ROOT, 'test-output', target + (mobile ? '-mobile' : '') + (tag ? '-' + tag : ''))
fs.rmSync(outRoot, { recursive: true, force: true })
fs.mkdirSync(outRoot, { recursive: true })

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p))

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const freePort = () =>
  new Promise((res) => {
    const s = net.createServer()
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address()
      s.close(() => res(port))
    })
  })

/** 極簡 PNG 解碼(8-bit, 非交錯),回傳內容像素比例,用於偵測空白畫面。*/
function pngStats(buf) {
  try {
    let p = 8
    let w = 0,
      hgt = 0,
      bd = 0,
      ct = 0
    const idat = []
    while (p < buf.length) {
      const len = buf.readUInt32BE(p)
      const type = buf.toString('ascii', p + 4, p + 8)
      const data = buf.subarray(p + 8, p + 8 + len)
      if (type === 'IHDR') {
        w = data.readUInt32BE(0)
        hgt = data.readUInt32BE(4)
        bd = data[8]
        ct = data[9]
      } else if (type === 'IDAT') idat.push(data)
      else if (type === 'IEND') break
      p += 12 + len
    }
    if (bd !== 8 || (ct !== 2 && ct !== 6)) return null
    const bpp = ct === 6 ? 4 : 3
    const raw = zlib.inflateSync(Buffer.concat(idat))
    const stride = w * bpp
    const px = Buffer.alloc(stride * hgt)
    let prev = Buffer.alloc(stride)
    for (let y = 0; y < hgt; y++) {
      const f = raw[y * (stride + 1)]
      const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
      const cur = px.subarray(y * stride, (y + 1) * stride)
      for (let x = 0; x < stride; x++) {
        const a = x >= bpp ? cur[x - bpp] : 0
        const b = prev[x]
        const c = x >= bpp ? prev[x - bpp] : 0
        let v = line[x]
        if (f === 1) v += a
        else if (f === 2) v += b
        else if (f === 3) v += (a + b) >> 1
        else if (f === 4) {
          const pp = a + b - c
          const pa = Math.abs(pp - a),
            pb = Math.abs(pp - b),
            pc = Math.abs(pp - c)
          v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
        }
        cur[x] = v & 255
      }
      prev = cur
    }
    let content = 0,
      sum = 0,
      sum2 = 0
    const step = Math.max(1, Math.floor((w * hgt) / 60000))
    let n = 0
    const colors = new Set()
    for (let i = 0; i < w * hgt; i += step) {
      const o = i * bpp
      const r = px[o],
        g = px[o + 1],
        b2 = px[o + 2]
      const mx = Math.max(r, g, b2),
        mn = Math.min(r, g, b2)
      if (mx - mn > 45 || mx > 150) content++
      const l = (r + g + b2) / 3
      sum += l
      sum2 += l * l
      colors.add((r >> 4) * 256 + (g >> 4) * 16 + (b2 >> 4))
      n++
    }
    const mean = sum / n
    return { w, h: hgt, contentRatio: +(content / n).toFixed(4), lumStd: +Math.sqrt(Math.max(0, sum2 / n - mean * mean)).toFixed(2), colorBuckets: colors.size }
  } catch (e) {
    return { error: String(e) }
  }
}

async function main() {
  if (!CHROME) throw new Error('找不到 Chrome/Edge')
  let server
  let base = opt('url')
  if (!base) {
    const port = await freePort()
    // 多個 agent 可能同時執行:各自獨立的快取目錄,並關閉依賴預打包(避免共用 node_modules/.vite 時互相覆蓋造成整頁 reload)
    server = await createServer({
      root: ROOT,
      cacheDir: path.join(ROOT, 'node_modules', '.vite-smoke', String(process.pid)),
      optimizeDeps: { noDiscovery: true, include: [] },
      server: { host: '127.0.0.1', port, strictPort: true, watch: null, hmr: false },
      logLevel: 'error',
      clearScreen: false,
    })
    await server.listen()
    base = `http://127.0.0.1:${port}`
  }

  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl', '--disable-gpu-sandbox', '--autoplay-policy=no-user-gesture-required'],
  })
  const ctxOpts = mobile
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 }
  const context = await browser.newContext({ ...ctxOpts, locale: 'zh-TW' })
  const page = await context.newPage()

  const problems = []
  const warnings = []
  const log = []
  page.on('console', (m) => {
    const t = m.type()
    const text = m.text()
    if (/fonts\.(googleapis|gstatic)/.test(text) || /Failed to load resource.*(font|ERR_INTERNET|ERR_NAME|net::ERR_FAILED)/i.test(text)) return
    if (/GPU stall due to ReadPixels|WebGL: INVALID_OPERATION.*texImage|Automatic fallback to software WebGL/i.test(text)) return
    if (t === 'error') problems.push(`console.error: ${text}`)
    else if (t === 'warning') warnings.push(`console.warn: ${text}`)
  })
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}\n${(e.stack || '').split('\n').slice(0, 4).join('\n')}`))
  page.on('requestfailed', (r) => {
    const u = r.url()
    if (/fonts\.(googleapis|gstatic)/.test(u)) return
    warnings.push(`requestfailed: ${u} ${r.failure()?.errorText}`)
  })
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort())

  const isAll = target === 'all'
  const isHero = target === 'hero'
  const url = isAll || isHero ? `${base}/` : `${base}/?only=${target}`
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForSelector('#main', { timeout: 30000 })

  const ids = isAll ? await page.$$eval('.chapter', (els) => els.map((e) => e.id)) : isHero ? ['hero'] : [target]
  const results = []

  async function waitReady(id, timeout = 90000) {
    await page.waitForFunction((sid) => {
      const s = window.__pgx && window.__pgx.stages.get(sid)
      return s && (s.state === 'ready' || s.state === 'error') && (s.state === 'error' || s.frames > 6)
    }, id, { timeout, polling: 250 })
  }
  async function stageInfo(id) {
    return page.evaluate((sid) => {
      const s = window.__pgx.stages.get(sid)
      if (!s) return null
      return { state: s.state, frames: s.frames, hasRenderer: !!s.renderer, error: s.error ? String(s.error.message || s.error) : null, step: s.step, t: +s.t.toFixed(2) }
    }, id)
  }
  async function shot(el, name, res) {
    const file = path.join(outRoot, `${res.id}-${name}.png`)
    const buf = await el.screenshot({ path: file, animations: 'allow' })
    const st = pngStats(buf)
    res.shots.push({ name, file: path.relative(ROOT, file).replace(/\\/g, '/'), stats: st })
    return st
  }

  for (const id of ids) {
    const res = { id, ok: true, notes: [], shots: [] }
    results.push(res)
    const sel = id === 'hero' ? '#stage-hero' : `#stage-${id}`
    const stageEl = await page.$(sel)
    if (!stageEl) {
      res.ok = false
      res.notes.push('找不到舞台元素 ' + sel)
      continue
    }
    await stageEl.scrollIntoViewIfNeeded()
    await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), sel)
    try {
      await waitReady(id)
    } catch {
      res.ok = false
      res.notes.push('等待場景就緒逾時(90 秒)')
    }
    await sleep(700)
    const info0 = await stageInfo(id)
    res.stage = info0
    if (!info0 || info0.state !== 'ready' || info0.error) {
      res.ok = false
      res.notes.push(`舞台狀態異常: ${JSON.stringify(info0)}`)
    }
    const view = id === 'hero' ? await page.$('#top') : await page.$(`${sel} .stage-view`)
    const st0 = await shot(view, '01-initial', res)
    if (st0 && !st0.error && st0.contentRatio < 0.004) {
      res.ok = false
      res.notes.push(`初始畫面幾乎空白 (contentRatio=${st0.contentRatio})`)
    }

    if (id !== 'hero') {
      // ── 操作控制項(每次重新查詢並跳過看不見的元素;場景可能在操作後重建/隱藏控制項)──
      const ctlSel = `${sel} .stage-controls`
      // 手機版控制項收在抽屜裡:先展開
      try {
        const tg = await page.$(`${sel} .stage-controls-toggle`)
        if (tg && (await tg.isVisible())) {
          await tg.click()
          await sleep(300)
        }
      } catch {}
      let shotCount = 1
      const maxShots = 9
      const note = (m) => res.notes.push(m)
      const visible = async (h) => {
        try {
          return await h.isVisible()
        } catch {
          return false
        }
      }
      const segCount = (await page.$$(`${ctlSel} .seg`)).length
      for (let si = 0; si < segCount; si++) {
        const nBtns = await (async () => {
          const g = (await page.$$(`${ctlSel} .seg`))[si]
          return g ? (await g.$$('.seg-btn')).length : 0
        })()
        for (let bi = 0; bi < nBtns; bi++) {
          try {
            const g = (await page.$$(`${ctlSel} .seg`))[si]
            const b = g && (await g.$$('.seg-btn'))[bi]
            if (!b || !(await visible(b))) continue
            await b.scrollIntoViewIfNeeded({ timeout: 10000 })
            await b.click({ timeout: 10000 })
            await sleep(450)
            if (shotCount < maxShots && (bi === nBtns - 1 || bi === Math.floor(nBtns / 2))) {
              await stageEl.scrollIntoViewIfNeeded()
              await shot(view, `seg${si}-opt${bi}`, res)
              shotCount++
            }
          } catch (e) {
            note(`segmented[${si}][${bi}] 操作失敗: ${String(e.message).split('\n')[0]}`)
          }
        }
        try {
          const g = (await page.$$(`${ctlSel} .seg`))[si]
          const b0 = g && (await g.$$('.seg-btn'))[0]
          if (b0 && (await visible(b0))) await b0.click({ timeout: 3000 })
        } catch {}
      }
      const sliderCount = (await page.$$(`${ctlSel} input[type=range]`)).length
      for (let i = 0; i < sliderCount; i++) {
        try {
          const s = (await page.$$(`${ctlSel} input[type=range]`))[i]
          if (!s) continue
          const vals = await s.evaluate((el) => [el.min, el.max, el.value])
          for (const v of [vals[0], vals[1], vals[2]]) {
            const s2 = (await page.$$(`${ctlSel} input[type=range]`))[i]
            if (!s2) break
            await s2.evaluate((el, val) => {
              el.value = val
              el.dispatchEvent(new Event('input', { bubbles: true }))
            }, v)
            await sleep(300)
            if (v === vals[1] && shotCount < maxShots) {
              await shot(view, `slider${i}-max`, res)
              shotCount++
            }
          }
        } catch (e) {
          note(`slider[${i}] 操作失敗: ${String(e.message).split('\n')[0]}`)
        }
      }
      const toggleCount = (await page.$$(`${ctlSel} .ctl-toggle-input`)).length
      for (let i = 0; i < toggleCount; i++) {
        try {
          const t = (await page.$$(`${ctlSel} .ctl-toggle-input`))[i]
          if (!t) continue
          await t.evaluate((el) => el.click())
          await sleep(1400)
          if (shotCount < maxShots) {
            await shot(view, `toggle${i}-flip`, res)
            shotCount++
          }
          const t2 = (await page.$$(`${ctlSel} .ctl-toggle-input`))[i]
          if (t2) await t2.evaluate((el) => el.click())
          await sleep(200)
        } catch (e) {
          note(`toggle[${i}] 操作失敗: ${String(e.message).split('\n')[0]}`)
        }
      }
      const selectCount = (await page.$$(`${ctlSel} select`)).length
      for (let i = 0; i < selectCount; i++) {
        try {
          const s = (await page.$$(`${ctlSel} select`))[i]
          if (!s) continue
          const opts = await s.$$eval('option', (os) => os.map((o) => o.value))
          for (const o of opts) {
            const s2 = (await page.$$(`${ctlSel} select`))[i]
            if (!s2) break
            if (!(await visible(s2))) {
              // 場景刻意隱藏的控制項:直接用 DOM 改值,仍可測到 change 事件處理
              await s2.evaluate((el, val) => {
                el.value = val
                el.dispatchEvent(new Event('change', { bubbles: true }))
              }, o)
            } else {
              await s2.selectOption(o, { timeout: 10000 })
            }
            await sleep(350)
          }
          if (shotCount < maxShots) {
            await shot(view, `select${i}-last`, res)
            shotCount++
          }
        } catch (e) {
          note(`select[${i}] 操作失敗: ${String(e.message).split('\n')[0]}`)
        }
      }
      const btnCount = (await page.$$(`${ctlSel} .btn`)).length
      for (let i = 0; i < btnCount; i++) {
        try {
          const b = (await page.$$(`${ctlSel} .btn`))[i]
          if (!b || !(await visible(b)) || (await b.isDisabled())) continue
          await b.scrollIntoViewIfNeeded({ timeout: 10000 })
          await b.click({ timeout: 10000 })
          await sleep(900)
          if (shotCount < maxShots) {
            await stageEl.scrollIntoViewIfNeeded()
            await shot(view, `btn${i}`, res)
            shotCount++
          }
        } catch (e) {
          note(`button[${i}] 操作失敗: ${String(e.message).split('\n')[0]}`)
        }
      }

      // ── 滑鼠 / 觸控互動 ──
      await stageEl.scrollIntoViewIfNeeded()
      const box = await view.boundingBox()
      if (box) {
        const pts = []
        for (let gy = 1; gy <= 4; gy++) for (let gx = 1; gx <= 5; gx++) pts.push([box.x + (box.width * gx) / 6, box.y + (box.height * gy) / 5])
        for (const [x, y] of pts) {
          await page.mouse.move(x, y)
          await sleep(60)
        }
        for (const [fx, fy] of [[0.5, 0.5], [0.3, 0.4], [0.7, 0.4], [0.5, 0.75], [0.5, 0.25]]) {
          await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy)
          await sleep(350)
        }
        // 拖曳旋轉
        await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.45, { steps: 8 })
        await page.mouse.up()
        await sleep(500)
        await shot(view, 'after-drag', res)
        // 重設視角、暫停
        const reset = await page.$(`${sel} [data-act=reset]`)
        if (reset) await reset.click()
        const pause = await page.$(`${sel} [data-act=pause]`)
        if (pause) {
          await pause.click()
          await sleep(200)
          await pause.click()
        }
      }

      // ── 文字步驟同步 ──
      if (withSteps || id !== 'hero') {
        const stepEls = await page.$$(`#${id} .prose [data-step]`)
        const seen = []
        const scrollToBand = (el) => {
          // 把區塊捲到「觸發帶中心」:桌機=視窗中央;手機=黏頂舞台的下方(與 main.js 的算法一致)
          const m = window.matchMedia('(max-width: 1100px)').matches
          const stage = el.closest('.chapter').querySelector('.stage')
          const r = el.getBoundingClientRect()
          const center = m ? Math.min(innerHeight * 0.7, 60 + 6 + stage.offsetHeight + 14) + 40 : innerHeight / 2
          window.scrollTo({ top: window.scrollY + (r.top + r.height / 2) - center, behavior: 'instant' })
        }
        for (let i = 0; i < stepEls.length; i++) {
          await stepEls[i].evaluate(scrollToBand)
          const want = await stepEls[i].evaluate((el) => Number(el.dataset.step))
          // 軟體 WebGL 很慢,IntersectionObserver 回呼可能延遲數秒:輪詢最多 6 秒
          let info = await stageInfo(id)
          for (let t = 0; t < 24 && info && info.step !== want; t++) {
            await sleep(250)
            info = await stageInfo(id)
          }
          seen.push([want, info && info.step])
          // step 0 是初始狀態:頁面太短、無法把它捲到觸發帶時,舞台 step 仍為 null 是正常的
          if (info && info.step !== want && !(want === 0 && info.step === null)) res.notes.push(`步驟同步: 文字 step=${want} 但舞台 step=${info.step}`)
          if (withSteps && i < 16) {
            await sleep(1500)
            await shot(view, `step${String(i).padStart(2, '0')}-s${want}`, res)
          }
        }
        res.stepsChecked = seen.length
      }
    }

    // 最終狀態
    const info1 = await stageInfo(id)
    res.stageAfter = info1
    if (info1 && info1.error) {
      res.ok = false
      res.notes.push('場景執行期錯誤: ' + info1.error)
    }
    if (id !== 'hero') {
      await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), sel)
      await sleep(400)
      const stEnd = await shot(view, 'final', res)
      if (stEnd && !stEnd.error && stEnd.contentRatio < 0.004) {
        res.ok = false
        res.notes.push(`最終畫面幾乎空白 (contentRatio=${stEnd.contentRatio})`)
      }
    }
  }

  // 手機版:檢查水平捲動(版面溢出)
  const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))
  if (overflow.sw > overflow.cw + 2) problems.push(`頁面水平溢出: scrollWidth=${overflow.sw} > clientWidth=${overflow.cw}`)

  // 全頁模式:同時存在的 WebGL renderer 數量
  const live = await page.evaluate(() => [...window.__pgx.stages.values()].filter((s) => s.renderer).length)
  const pgxErrors = await page.evaluate(() => window.__pgx.errors)

  const report = { target, mobile, url, results, live, pgxErrors, problems, warnings: [...new Set(warnings)].slice(0, 40) }
  fs.writeFileSync(path.join(outRoot, 'report.json'), JSON.stringify(report, null, 2))

  await browser.close()
  if (server) await server.close()
  fs.rmSync(path.join(ROOT, 'node_modules', '.vite-smoke', String(process.pid)), { recursive: true, force: true })

  // ── 輸出摘要 ──
  let bad = problems.length > 0 || pgxErrors.length > 0
  console.log(`\n=== smoke: ${target}${mobile ? ' (mobile)' : ''} ===`)
  for (const r of results) {
    if (!r.ok) bad = true
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}  frames=${r.stageAfter?.frames ?? '-'}  shots=${r.shots.length}`)
    for (const n of r.notes) console.log('   - ' + n)
    for (const s of r.shots.slice(0, 3)) console.log(`   · ${s.file}  content=${s.stats?.contentRatio}`)
  }
  console.log(`live WebGL renderers at end: ${live}`)
  if (pgxErrors.length) console.log('stage errors:\n' + pgxErrors.map((e) => `  [${e.id}] ${e.message}`).join('\n'))
  if (problems.length) console.log('problems:\n' + [...new Set(problems)].map((p) => '  ' + p).join('\n'))
  if (report.warnings.length) console.log('warnings (前 15 項):\n' + report.warnings.slice(0, 15).map((w) => '  ' + w).join('\n'))
  console.log(`\nscreenshots + report.json → ${path.relative(ROOT, outRoot)}`)
  console.log(bad ? 'RESULT: FAIL' : 'RESULT: PASS')
  process.exit(bad ? 1 : 0)
}

main().catch((e) => {
  console.error('smoke crashed:', e)
  process.exit(2)
})
