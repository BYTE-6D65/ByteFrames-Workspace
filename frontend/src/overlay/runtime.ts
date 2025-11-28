let overlayRoot: HTMLElement | null = null
let currentContainer: HTMLElement | null = null
let currentUnmount: (() => void) | null = null

export function setOverlayRoot(el: HTMLElement | null) {
  overlayRoot = el
  if (!overlayRoot) {
    teardown()
  }
}

export function injectCSS(cssText: string) {
  let style = document.getElementById("bf-overlay-style") as HTMLStyleElement | null
  if (!style) {
    style = document.createElement("style")
    style.id = "bf-overlay-style"
    document.head.appendChild(style)
  }
  style.textContent = cssText
}

export function loadOverlayComponent(jsText: string, ctx: Record<string, unknown>) {
  if (!overlayRoot) throw new Error("Overlay root not ready")
  teardown()

  const { component, error } = compileComponent(jsText, ctx)
  if (error) throw error
  if (!component) throw new Error("No component exported")

  const container = document.createElement("div")
  container.className = "bf-overlay-layer"
  overlayRoot.appendChild(container)
  currentContainer = container

  const result = component.mount(container)
  currentUnmount = () => {
    try {
      component.unmount?.()
    } catch (err) {
      console.warn("Overlay unmount error", err)
    }
    container.remove()
    currentContainer = null
  }

  return result
}

function compileComponent(jsText: string, ctx: Record<string, unknown>) {
  try {
    const source = toCommonJS(jsText)
    const exports: any = {}
    const module: any = { exports }
    const factory = new Function("exports", "module", "ctx", `${source}\nreturn module.exports ?? exports;`)
    const result = factory(exports, module, ctx)
    const maybeFactory = result?.default ?? result
    const component = typeof maybeFactory === "function" ? maybeFactory(ctx) : maybeFactory

    if (!component || typeof component.mount !== "function") {
      return { error: new Error("Overlay must export default function returning { mount, unmount }") }
    }
    return { component }
  } catch (error: any) {
    return { error }
  }
}

function toCommonJS(source: string) {
  if (/export\s+default/.test(source)) {
    return source.replace(/export\s+default/, "module.exports =")
  }
  return source
}

export function teardown() {
  if (currentUnmount) {
    currentUnmount()
    currentUnmount = null
  }
  if (currentContainer) {
    currentContainer.remove()
    currentContainer = null
  }
}
