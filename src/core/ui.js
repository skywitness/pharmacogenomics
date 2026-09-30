// 舞台下方「控制面板」的小元件工廠。所有場景都用它來建立滑桿、按鈕、開關…
// 樣式在 style.css 的 .ctl / .seg / .btn / .readout 區塊。

const uid = (() => {
  let n = 0
  return (p = 'ui') => `${p}-${++n}`
})()

function h(tag, attrs = {}, ...kids) {
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

export function createUI(container) {
  const api = {
    root: container,

    /** 滑桿。{label,min,max,step,value,format,onInput,hint} → {el,set(v),get()} */
    slider({ label, min = 0, max = 1, step = 0.01, value = 0, format = (v) => String(v), onInput, hint } = {}) {
      const id = uid('rng')
      const out = h('output', { class: 'ctl-value', for: id })
      const input = h('input', { type: 'range', id, min, max, step, value, class: 'ctl-slider' })
      const paint = () => {
        const pct = ((input.value - min) / (max - min)) * 100
        input.style.setProperty('--pct', pct + '%')
        out.textContent = format(Number(input.value))
        input.setAttribute('aria-valuetext', out.textContent)
      }
      input.addEventListener('input', () => {
        paint()
        onInput && onInput(Number(input.value))
      })
      const el = h('div', { class: 'ctl ctl-range' }, h('label', { class: 'ctl-label', for: id, text: label }), h('div', { class: 'ctl-row' }, input, out))
      if (hint) el.append(h('div', { class: 'ctl-hint', text: hint }))
      container.append(el)
      paint()
      return {
        el,
        input,
        get: () => Number(input.value),
        set(v, silent = true) {
          input.value = v
          paint()
          if (!silent) onInput && onInput(Number(input.value))
        },
      }
    },

    /** 分段按鈕（單選）。options:[{value,label,color?,title?}] → {el,set(v),get()} */
    segmented({ label, options, value, onChange } = {}) {
      let cur = value ?? options[0].value
      const group = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label || '選項' })
      const btns = options.map((opt) => {
        const b = h('button', {
          type: 'button',
          class: 'seg-btn',
          role: 'radio',
          title: opt.title,
          'data-value': opt.value,
          text: opt.label,
        })
        if (opt.color != null) b.style.setProperty('--seg-color', typeof opt.color === 'number' ? '#' + opt.color.toString(16).padStart(6, '0') : opt.color)
        b.addEventListener('click', () => set(opt.value, false))
        group.append(b)
        return b
      })
      function paint() {
        btns.forEach((b, i) => {
          const on = options[i].value === cur
          b.setAttribute('aria-checked', String(on))
          b.tabIndex = on ? 0 : -1 // roving tabindex：整組只佔一個 Tab 停靠點，方向鍵切換
          b.classList.toggle('is-on', on)
        })
      }
      group.addEventListener('keydown', (e) => {
        const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }
        let idx = btns.findIndex((b) => b === document.activeElement)
        if (idx < 0) return
        if (e.key in keys) idx = (idx + keys[e.key] + btns.length) % btns.length
        else if (e.key === 'Home') idx = 0
        else if (e.key === 'End') idx = btns.length - 1
        else return
        e.preventDefault()
        set(options[idx].value, false)
        btns[idx].focus()
      })
      function set(v, silent = true) {
        cur = v
        paint()
        if (!silent) onChange && onChange(v)
      }
      paint()
      const el = h('div', { class: 'ctl ctl-seg' }, label ? h('div', { class: 'ctl-label', text: label }) : null, group)
      container.append(el)
      return { el, get: () => cur, set }
    },

    /** 開關。 → {el,get(),set(v)} */
    toggle({ label, value = false, onChange } = {}) {
      const id = uid('tg')
      const input = h('input', { type: 'checkbox', id, class: 'ctl-toggle-input', role: 'switch' })
      input.checked = !!value
      input.addEventListener('change', () => onChange && onChange(input.checked))
      const el = h('div', { class: 'ctl ctl-toggle' }, input, h('label', { for: id, class: 'ctl-toggle-label' }, h('span', { class: 'ctl-switch', 'aria-hidden': 'true' }), h('span', { text: label })))
      container.append(el)
      return {
        el,
        get: () => input.checked,
        set(v, silent = true) {
          input.checked = !!v
          if (!silent) onChange && onChange(input.checked)
        },
      }
    },

    /** 下拉選單。options:[{value,label}] */
    select({ label, options, value, onChange } = {}) {
      const id = uid('sel')
      const sel = h('select', { id, class: 'ctl-select' })
      options.forEach((o) => sel.append(h('option', { value: o.value, text: o.label })))
      if (value != null) sel.value = value
      sel.addEventListener('change', () => onChange && onChange(sel.value))
      const el = h('div', { class: 'ctl ctl-sel' }, h('label', { class: 'ctl-label', for: id, text: label }), sel)
      container.append(el)
      return { el, get: () => sel.value, set: (v) => (sel.value = v) }
    },

    /** 按鈕。kind: 'primary'|'ghost' */
    button({ label, onClick, kind = 'primary', title } = {}) {
      const b = h('button', { type: 'button', class: `btn btn-${kind}`, text: label, title })
      b.addEventListener('click', (e) => onClick && onClick(e))
      const el = h('div', { class: 'ctl ctl-btn' }, b)
      container.append(el)
      return { el, button: b, setLabel: (t) => (b.textContent = t), setDisabled: (d) => (b.disabled = !!d) }
    },

    /** 一排按鈕（同一列） */
    buttons(list) {
      const row = h('div', { class: 'ctl ctl-btnrow' })
      const out = list.map(({ label, onClick, kind = 'ghost', title }) => {
        const b = h('button', { type: 'button', class: `btn btn-${kind}`, text: label, title })
        b.addEventListener('click', (e) => onClick && onClick(e))
        row.append(b)
        return b
      })
      container.append(row)
      return { el: row, buttons: out }
    },

    /** 數值/文字讀數。→ {el,set(text|html,{html}), setColor(css)} */
    readout({ label, value = '', color, live = false } = {}) {
      // 讀數常常每幀更新，預設不朗讀；只有變動不頻繁、需要即時告知的才傳 live:true
      const val = h('span', { class: 'readout-value', 'aria-live': live ? 'polite' : 'off' })
      val.textContent = value
      const el = h('div', { class: 'readout' }, h('span', { class: 'readout-label', text: label }), val)
      if (color) val.style.color = color
      container.append(el)
      return {
        el,
        set(v, { html = false } = {}) {
          if (html) val.innerHTML = v
          else val.textContent = v
        },
        setColor(c) {
          val.style.color = c
        },
      }
    },

    /** 說明小字。*/
    note(text, { html = false } = {}) {
      const el = h('p', { class: 'ctl-note' })
      if (html) el.innerHTML = text
      else el.textContent = text
      container.append(el)
      return el
    },

    /** 分組（帶標題的區塊）。回傳同樣具備 slider/segmented… 方法的子 UI。*/
    group(title) {
      const g = h('div', { class: 'ctl-group' }, title ? h('div', { class: 'ctl-group-title', text: title }) : null)
      container.append(g)
      return createUI(g)
    },

    /** 清空全部控制項。*/
    clear() {
      container.replaceChildren()
    },
  }
  return api
}
