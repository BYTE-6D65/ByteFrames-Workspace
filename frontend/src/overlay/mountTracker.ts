import { setWidgetMounted } from "../db/queries"

// Track which widgets are currently mounted in the DOM
const mountedWidgets = new Set<string>()
const listeners = new Set<() => void>()

export function registerWidgetMount(widgetId: string) {
    mountedWidgets.add(widgetId)
    setWidgetMounted(widgetId, true)
    notifyListeners()
}

export function registerWidgetUnmount(widgetId: string) {
    mountedWidgets.delete(widgetId)
    setWidgetMounted(widgetId, false)
    notifyListeners()
}

export function isWidgetMounted(widgetId: string): boolean {
    return mountedWidgets.has(widgetId)
}

export function subscribeToMountState(callback: () => void) {
    listeners.add(callback)
    return () => { listeners.delete(callback) }
}

function notifyListeners() {
    listeners.forEach(cb => cb())
}
