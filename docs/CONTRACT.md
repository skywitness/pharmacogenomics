# 開發契約(所有貢獻者/agent 必讀)

網站:**藥物基因體學互動導覽**(繁體中文,台灣用語),Vite + three.js(r186),純前端靜態站。
讀者由完全外行到進階學生,章節「由淺入深」(L1 入門 → L4 進階)。
工作目錄:`C:\dev\Pharmacogenomics`。Windows + PowerShell/Bash 皆可用。

## 1. 目錄與責任

```
src/main.js                 組裝頁面(不要改,除非任務明確要求)
src/style.css               設計系統(不要改;需要新樣式請寫在你自己的 JS 內以 inline style/CSS 變數,或在 src/styles/chNN.css 新增並於場景/內容中 import)
src/core/                   Stage.js / ui.js / util.js / palette.js / chapter.js / markup.js / quiz.js / terms.js  ← 共用核心,唯讀
src/content/chNN.js         章節內容(資料)          ← 你負責
src/content/glossary/*.js   術語表(一章一檔)        ← 你負責 glossary/chNN.js
src/scenes/chNN.js          3D 場景                  ← 你負責
research/*.verified.json    已查證的事實庫(內容唯一依據)
scripts/smoke.mjs           自動測試 + 截圖
```

**只修改你被指派的檔案。** 若認為核心(`src/core/*`)有 bug 或缺功能,不要自己改,在最終回報的 `coreIssues` 欄位描述(症狀+建議修法),由統籌者處理。
其他章節的檔案絕不能碰(平行開發中)。

## 2. 場景模組 API(src/scenes/chNN.js)

```js
export const options = { fov: 45, camera: [0, 1, 9], target: [0, 0, 0], zoom: false, orbit: true, autoRotate: false,
                         minDistance, maxDistance, minPolarAngle, maxPolarAngle, exposure: 1, envIntensity: 0.4 }
export default async function create(ctx) {   // 可 async
  // 建立 ctx.scene 內容、ctx.ui 控制項、ctx.hud 疊層
  return { update(dt, t) {}, onStep(i, prev) {}, onResize(w, h) {}, onResetView() {}, onKeyRotate(dAzimuthRad, dElevationRad) {}, dispose() {} }  // 全部可省略
}
```

`ctx` 提供(見 `src/core/Stage.js` 的 `_makeCtx`):
- `THREE`(勿另外 import 'three',用它;但 import 'three/addons/...' 需要的模組可以 `import` 之,例如 `three/addons/geometries/RoundedBoxGeometry.js`)
- `util`(`src/core/util.js`,見下)、`palette`(顏色語法)、`scene`、`camera`、`controls`(OrbitControls;預設關閉縮放/平移)、`view`(DOM)
- `ui`:控制面板工廠 → `slider / segmented / toggle / select / button / buttons / readout / note / group / clear`(見 `src/core/ui.js`)
- `hud`:疊在畫面上的說明 → `badge(text) / legend([{color,label}]) / caption(text,{html}) / tip(html,x,y) / clear()`
- `pointer`(NDC `x,y`、像素 `px,py`、`inside`、`down`)、`onPointer((type,e,ptr)=>{})`(type: move/down/up/click/leave/cancel)、`pick(objects)`(raycast)、`project(v3)`(世界→像素)、`setCursor()`
- `setFrame(center, radius, {azimuth, elevation})`:**取景**。以此設定主體大小,視窗變窄(手機)時會自動拉遠,保證主體完整入鏡。**每個場景都必須呼叫**(不要硬寫 camera.position)。
- `motion`(0.15 或 1,reduced-motion 時為 0.15,請乘在「環境裝飾性動畫」速度上;使用者觸發的動畫照常播放)、`reducedMotion`、`coarsePointer`、`paused`、`size`
- `emit(name, detail)`

### 生命週期重要規則
1. **WebGLRenderer 會被回收/重建**(舞台離開視窗就釋放)。場景模組**不可以**建立或持有 `WebGLRenderTarget`、`renderer.*`、需要 renderer 的資源。Scene 圖與 geometry/material 可長期持有。
2. **不要用後處理**(EffectComposer/Bloom)。要發光請用 `util.makeGlow` (加法混合 sprite) 或 `emissive` 材質。
3. 使用 `update(dt, t)` 推進動畫;`dt` 已被限制且暫停時為 0。**不要自己開 requestAnimationFrame / setInterval**;要用 `setTimeout` 也要避免(使用 update 內計時器)。
4. 大量相同物件用 `InstancedMesh`;整個場景 draw call 盡量 < 300,三角形 < 300k(手機也要順)。`renderer` 像素比已限制為 2。
5. 事件用 `ctx.onPointer`;不要在 `window`/`document` 綁事件(會洩漏)。若一定要,必須在 `dispose()` 移除。
6. 文字標籤用 `util.makeLabel(text,{...})`(Sprite,支援中文、可 `.userData.setText()` 更新),或用 `hud.tip/caption` 的 HTML。避免大量 Sprite(<40)。
7. **手機優先可用**:主體必須在 390×~340 px 的舞台裡完整可見且可辨識;觸控可操作(點擊區域夠大)。
8. 所有互動都要有**可見的回饋**與**文字說明**(`hud.caption` 隨狀態更新,並用中文解釋「你現在看到什麼、為什麼」)。
9. 場景要有**初始吸睛狀態**(不是空白或靜止)與**明確的可操作提示**。首次載入 2 秒內畫面要有東西。
10. 依 `onStep(i)`(文字捲動到 `step: i` 的區塊時被呼叫)切換場景狀態(相機聚焦、高亮、階段),`onStep` 可能在 `create` 完成前被要求,Stage 會保證在 create 後補呼叫一次最新步驟。step 0 應是「初始狀態」。

### 共用工具(src/core/util.js)
`clamp lerp smoothstep easeInOut easeOutCubic easeOutBack damp(current,target,lambda,dt) rng(seed) disposeTree`
`makeLabel(text,opts) makeGlow(color,size,opacity) glowTexture() addStudioLights(scene,{intensity}) glowMat glassMat glossMat`
`createPill createPerson createDNA(opts) createParticles createMolecule tubeFromPoints createChartPlane`
`createDNA` 回傳 `{group, pairs[], setBase(i,base), setOpen(t), update(t), height, sequence}`。

### 顏色語法(src/core/palette.js,務必遵守,讓全站一致)
鹼基 A 綠 / T 紅 / G 黃 / C 藍;代謝型 UM 紫 / RM 青 / NM 綠 / IM 黃 / PM 紅;藥物母體 橘(`COLORS.drug`)、活性代謝物 青綠(`COLORS.metabolite`)、無活性 灰(`COLORS.inactive`)、酵素 藍(`COLORS.enzyme`);HLA 亮藍、T 細胞 黃、胜肽 粉。
背景是深藍黑(舞台 CSS 已有漸層,`renderer` 清除色透明),因此物件要有足夠亮度/對比;避免純黑物件。

**鍵盤**:3D 畫面可用 Tab 聚焦,方向鍵旋轉、Home 重設視角(核心已處理)。若場景把 `options.orbit` 設為 false 並自己處理旋轉(如 ch08 的地球),請實作 `onKeyRotate(dAz, dEl)` 讓方向鍵也能操作。

### 舞台版面（核心已處理，場景不需自己處理）
- **桌機**：舞台黏在導覽列下方（右欄），高度不超過視窗；控制面板吃掉舞台剩餘高度並可捲動。
- **手機/平板（≤980px）**：舞台改為**黏在頂端**（畫面高度約 40svh），讀到哪段文字場景就同步變化；控制項收在舞台下方的「⚙ 互動控制項」開關裡。因此：主體與 HUD 要能在約 390×340px 內清楚顯示；**重要的操作提示不要只放在控制面板裡**，要用 `hud.caption` 或場景內提示。
- HUD 排版：badge/按鈕列在頂端；`hud.legend` 與 `hud.caption` 一律沉到底部（圖例在說明文字上方）。不要再用 inline style 把圖例釘在別處，除非有充分理由。
- HUD 的「暫停動畫 / 重設視角」現在可正常點擊（核心已攔截 pointer 事件，避免被 OrbitControls 吃掉）。
- `setFrame(center, radius, {azimuth, elevation})`：「重設視角」的方向只在第一次呼叫或明確給角度時記錄。
- `ui.readout` 預設不朗讀（aria-live off）；變動不頻繁、需要即時告知者才傳 `live: true`。`ui.segmented` 已支援方向鍵。

### 排版（繁體中文）
- **中文旁一律使用全形標點**：，。：；！？（）。英文/數字之間維持半形（如 `HLA-B*15:02`、`4,877`、`0.23%`）。
- 寫完後執行 `node scripts/normalize-punct.mjs --write` 自動修正（只會動「緊鄰中文字」的標點），再跑 `node scripts/check-content.mjs`（檢查術語連結、step 連號、測驗、簡體字與中國用語；有 ERROR 必須修）。
- 台灣用語：基因體（非基因組）、酵素（非酶）、多型性（非多態性）、胺基酸（非氨基酸）、標靶（非靶向）、異型/同型合子。藥名以台灣常用名稱為準。

## 3. 內容格式(src/content/chNN.js)

見 `src/core/chapter.js` 檔頭註解(欄位/區塊型別完整列表)。要點:
- 文字標記:`**粗體**`、`` `CYP2C19*2` ``(code)、`{{術語}}` 或 `{{key|顯示文字}}`(連到術語表;**術語必須在 `src/content/glossary/*.js` 存在**,找不到 DEV 主控台會 warn → smoke 的 warnings 會列出)、`[文字](https://…)`。
- 不需要跳脫 `<` `>` `&`(系統會處理);**不要寫 HTML 標籤**。星號 `*` 在基因名裡是普通字元(`CYP2C19*2/*3`),只有連續兩個 `**` 才是粗體。
- 章節結構建議:引子(story/提問)→ 概念(由淺入深,每個新名詞第一次出現時用 `{{}}`)→ 互動說明(帶 `step`)→ `keypoints` → `callout`(台灣觀點 `taiwan`、臨床 `clinical`、注意 `warn`)→ 需要時 `table`/`bars`/`facts` → `deepdive`(進階,可收合)→ `quiz`(3–5 題,含解析)→ `sources`(每個引用的事實都應可在此找到來源)。
- 帶 `step: n` 的區塊 = 與場景同步的「敘事節點」。step 從 0 開始連號,至少 4 個,對應 `onStep(n)`。
- 篇幅:每章可讀時間 6–10 分鐘(約 1800–3200 字,不含表格),`minutes` 據實填寫。
- `stage.aria`:一句話描述場景給螢幕閱讀器;`stage.caption`:操作提示(如「拖曳旋轉 · 點擊分子看說明 · 用下方控制項改變基因型」)。

### 寫作風格
- 台灣繁體中文用語(酵素、基因型、表現型、不良代謝者、藥物不良反應、處方、檢測);第一次出現專有名詞附英文,如「細胞色素 P450(CYP450)」。
- **由淺入深**:L1/L2 以生活比喻與故事開場,不預設任何生物背景;L3/L4 才加入機制細節與數據。每個比喻要說明它的限制,避免誤導。
- 語氣親切、清楚、不誇大;**不做醫療建議**(不要說「你應該停藥/換藥」),臨床建議一律寫成「指引(CPIC/DPWG/FDA 標示)建議…」並註明版本年份。
- **事實只能來自 `research/*.verified.json`**。`verified:true` = 已由兩位獨立查核者確認(或教科書級常識),可直接陳述並附來源;`verified:false` 者(約三分之二,多數信心為 high 但未經獨立查核)只能以**明確歸屬**的措辭使用(「依 CPIC 頻率表…」「該研究報告…」),不可作為標題級數字的唯一依據,且必須回報在 `unverifiedUsed`。`hedge_wording_required:true` 的必須用保留語氣。每個檔案的 `open_issues` 都是必須遵守的但書(例如:醫院世代≠全台人口、CPIC 東亞平均≠台灣實測、等位基因/攜帶者/表現型頻率不可混用)。`must_not_say_zh` 內的說法絕對不可以寫。要引用的數字必須帶來源(在 `sources` 或 `facts.note`)。若事實庫沒有,不要憑記憶補數字——改用定性描述,或在回報中列為 `needsResearch`。
- 場景中的「示意性數據」(例如模擬人群的比例)必須在畫面文字中標明「示意」,不可偽裝成真實統計。
- 不放具體處方劑量建議;不使用恐嚇式措辭;尊重族群,避免把基因等位基因頻率說成「某種族的特質」。

## 4. 測試與驗收(每個貢獻者都必須做)

```
node scripts/smoke.mjs chNN            # 桌機 1440×900
node scripts/smoke.mjs chNN --mobile   # 手機 390×844 觸控
```
- 會自動操作所有控制項、滑鼠、拖曳、捲動步驟,輸出截圖到 `test-output/chNN/`,並回報 console error、場景錯誤、空白畫面、`[glossary]` 找不到的術語、文字-場景步驟不同步。
- **你必須用 Read 工具實際打開至少 4 張截圖(初始、不同控制項狀態、手機版)親眼檢查**:主體是否完整入鏡、有沒有被 HUD/圖說遮住、顏色/對比是否足夠、標籤是否重疊、是否有 z-fighting/穿模、動畫狀態是否符合文字說明。發現問題就修正再測,直到滿意。
- 也要跑 `npx vite build --outDir test-output/build-chNN --emptyOutDir` 確認可建置(**務必指定獨立 outDir**,多人平行開發時預設的 dist/ 會互相清空)。
- 交付前自我檢查清單:
  - [ ] smoke 桌機與手機 RESULT: PASS,且 warnings 中沒有 `[glossary]` 找不到術語、沒有 `Uncaught`
  - [ ] 截圖親眼檢查過(桌機+手機)
  - [ ] 所有 step 都真的改變了場景;控制項都有效果;重設視角後構圖正確
  - [ ] 沒有使用禁止項(後處理、renderer 相關資源、自行 rAF、window 事件未清)
  - [ ] 內容每個數字/臨床陳述都追溯得到 verified 事實庫
  - [ ] 文字通順、無簡體字/中國用語(質量→品質、軟件→軟體、信息→資訊、視頻→影片…)
  - [ ] 只改了自己的檔案

## 5. 常見陷阱
- `MeshPhysicalMaterial` 的 `transmission` 很吃效能,避免;半透明物件請 `depthWrite=false` 並設定 `renderOrder`。
- Sprite/文字標籤預設 `depthTest:false` 會穿過物體顯示,適合標籤;若要被遮擋請設 `sprite.material.depthTest = true`。
- `InstancedMesh` 更新後要 `instanceMatrix.needsUpdate = true`(顏色 `instanceColor.needsUpdate`)。
- 顏色請用 `new THREE.Color(hex)`;`palette.COLORS` 是整數色碼。
- 本專案 three 為 r186,`THREE.Clock` 已不建議使用(`update(dt,t)` 已提供時間);`THREE.Geometry` 已不存在;`CapsuleGeometry(radius, length, capSegments, radialSegments)`。
- 不要假設 `document` 之外的全域函式庫;如需額外 three addons 請從 `three/addons/...` import。
- **自己建立 CanvasTexture 時,只要 canvas 尺寸會改變(文字變長短、圖表重設大小),就必須先 `tex.dispose()` 再改 canvas.width/height 並 `needsUpdate=true`**,否則主控台會出現 `GL_INVALID_VALUE: glCopySubTextureCHROMIUM: Offset overflows texture dimensions`。優先用 `util.makeLabel`(已處理)與 `util.createChartPlane`(固定尺寸),不要重複實作。smoke 報告的 warnings 出現任何 `GL_INVALID_*` 都視為 bug。
- 中文 Sprite 文字在 canvas 內以系統 CJK 字型繪製;字級請用 `worldHeight` 控制(約 0.3–0.6)。
