// src/utils/mathjax.ts
let loaderPromise: Promise<any> | null = null

export function ensureMathJaxReady(): Promise<any> {
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise((resolve, reject) => {
    // 已存在：直接等 startup.promise
    if (window.MathJax?.startup?.promise) {
      window.MathJax.startup.promise.then(resolve).catch(reject)
      return
    }

    // 先配置（必须在脚本加载前）
    ;(window as any).MathJax = {
      loader: {
        load: ['[tex]/ams', '[tex]/boldsymbol'],
      },
      tex: {
        inlineMath: [['$', '$'], ['\\(', '\\)']],
        displayMath: [['$$', '$$']],
        processEscapes: true, // 允许 \$ 这种
        packages: { '[+]': ['ams', 'boldsymbol'] },
      },
      startup: {
        typeset: false, // SPA 里建议关掉自动全页 typeset
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
      },
    }

    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js'
    script.async = true
    script.onload = () => {
      // 脚本加载后，再等 MathJax startup 完成
      const mj = (window as any).MathJax
      if (!mj?.startup?.promise) {
        reject(new Error('MathJax loaded but startup.promise missing'))
        return
      }
      mj.startup.promise.then(resolve).catch(reject)
    }
    script.onerror = () => reject(new Error('Failed to load MathJax script'))

    document.head.appendChild(script)
  })

  return loaderPromise
}

export async function typesetMath(target?: HTMLElement): Promise<void> {
  await ensureMathJaxReady()
  const mj = (window as any).MathJax
  if (!mj?.typesetPromise) return
  await new Promise((resolve) => requestAnimationFrame(resolve))
  if (mj.typesetClear) {
    mj.typesetClear(target ? [target] : undefined)
  }
  await mj.typesetPromise(target ? [target] : undefined)
}
