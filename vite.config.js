import { defineConfig } from 'vite'

// 使用相對路徑 base,方便部署到任何靜態空間(GitHub Pages、Netlify、學會主機子目錄…)
export default defineConfig({
  base: './',
  server: { host: '127.0.0.1', port: 5173, strictPort: false },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        // three.js 幾乎不變,獨立成一個可長期快取的 chunk;內容/程式更新時回訪者不必重新下載
        codeSplitting: { groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }] },
      },
    },
  },
})
