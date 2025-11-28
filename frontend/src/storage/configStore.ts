import type { OverlayConfig, Widget } from "../types/widget"
import { DEFAULT_WIDGET_CSS, DEFAULT_WIDGET_JS } from "../types/widget"

const STORAGE_KEY = "byteframes_configs"
const ACTIVE_CONFIG_KEY = "byteframes_active_config"

export function getConfigs(): OverlayConfig[] {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
        const defaultConfig = createDefaultConfig()
        saveConfigs([defaultConfig])
        return [defaultConfig]
    }
    return JSON.parse(stored)
}

export function saveConfigs(configs: OverlayConfig[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
}

export function getActiveConfigId(): string | null {
    return localStorage.getItem(ACTIVE_CONFIG_KEY)
}

export function setActiveConfigId(id: string): void {
    localStorage.setItem(ACTIVE_CONFIG_KEY, id)
}

export function createDefaultConfig(): OverlayConfig {
    return {
        id: crypto.randomUUID(),
        name: "Default Overlay Config",
        widgets: [
            {
                id: crypto.randomUUID(),
                name: "Clock Widget",
                enabled: true,
                js: DEFAULT_WIDGET_JS,
                css: DEFAULT_WIDGET_CSS,
            },
        ],
    }
}

export function createWidget(name: string): Widget {
    return {
        id: crypto.randomUUID(),
        name,
        enabled: true,
        js: DEFAULT_WIDGET_JS,
        css: DEFAULT_WIDGET_CSS,
    }
}

export function updateWidget(configId: string, widgetId: string, updates: Partial<Widget>): void {
    const configs = getConfigs()
    const config = configs.find((c) => c.id === configId)
    if (!config) return

    const widget = config.widgets.find((w) => w.id === widgetId)
    if (!widget) return

    Object.assign(widget, updates)
    saveConfigs(configs)
}

export function deleteWidget(configId: string, widgetId: string): void {
    const configs = getConfigs()
    const config = configs.find((c) => c.id === configId)
    if (!config) return

    config.widgets = config.widgets.filter((w) => w.id !== widgetId)
    saveConfigs(configs)
}

export function addWidget(configId: string, widget: Widget): void {
    const configs = getConfigs()
    const config = configs.find((c) => c.id === configId)
    if (!config) return

    config.widgets.push(widget)
    saveConfigs(configs)
}
