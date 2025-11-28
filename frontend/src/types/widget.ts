export interface Widget {
  id: string
  name: string
  js: string
  css: string
  enabled: boolean
  isMounted?: boolean
  zIndex?: number
}

export interface OverlayConfig {
  id: string
  name: string
  widgets: Widget[]
}

export const DEFAULT_WIDGET_JS = `export default function Widget(ctx) {
  let raf = 0
  return {
    mount(el) {
      const span = document.createElement('div')
      span.className = 'widget-element'
      el.appendChild(span)
      const tick = () => {
        const now = new Date()
        span.textContent = now.toLocaleTimeString()
        raf = requestAnimationFrame(tick)
      }
      tick()
    },
    unmount() {
      cancelAnimationFrame(raf)
    }
  }
}`

export const DEFAULT_WIDGET_CSS = `.widget-element {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(0,0,0,0.55);
  color: #e5ecff;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 16px;
  pointer-events: none;
}`
