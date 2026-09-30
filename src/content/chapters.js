// 章節註冊表：自動收集 src/content/ch*.js（default export），依 no 排序。
// 要新增章節，只要新增 src/content/chNN.js 與 src/scenes/chNN.js，不必改這裡。

const mods = import.meta.glob('./ch[0-9]*.js', { eager: true })

export const chapters = Object.values(mods)
  .map((m) => m.default)
  .filter(Boolean)
  .sort((a, b) => a.no - b.no)

export const levelInfo = {
  1: {
    zh: '入門',
    en: 'Foundations',
    title: '先搞懂「為什麼」',
    blurb: '不需要任何生物背景。從生活中的用藥經驗出發，認識基因與藥物反應的關係，以及 DNA 如何「寫下」一個人的特質。',
  },
  2: {
    zh: '初階',
    en: 'Core concepts',
    title: '讀懂基因報告的語言',
    blurb: '學會等位基因、基因型、表現型與星號命名，並跟著一顆藥丸走完它在體內的旅程（吸收、分布、代謝、排除）。',
  },
  3: {
    zh: '中階',
    en: 'Mechanisms & cases',
    title: '機制與經典案例',
    blurb: '深入 CYP450 代謝酵素與 HLA 免疫分子，並用氯吡格雷、可待因、華法林、卡巴馬平等真實案例看基因如何改變處方。',
  },
  4: {
    zh: '進階',
    en: 'Practice & frontiers',
    title: '族群、臨床與前沿',
    blurb: '看不同族群（含台灣）的等位基因頻率、檢測如何走進臨床與其倫理法規，以及腫瘤、多基因與 AI 帶來的新方向。',
  },
}
