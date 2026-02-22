/// <reference types="vite/client" />

declare module '*.vue' {
  import { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  MathJax?: {
    startup?: { promise?: Promise<void> }
    typesetPromise?: (elements?: HTMLElement[]) => Promise<void>
    typesetClear?: (elements?: HTMLElement[]) => void
    tex?: {
      inlineMath?: Array<[string, string]>
      displayMath?: Array<[string, string]>
    }
    options?: { skipHtmlTags?: string[] }
  }
}
