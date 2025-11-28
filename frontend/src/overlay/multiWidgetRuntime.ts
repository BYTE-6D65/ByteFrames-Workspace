import { createOverlayRuntime } from "./overlayRuntime"
import type { Widget } from "../types/widget"
import { registerWidgetMount, registerWidgetUnmount } from "./mountTracker"

interface MountedWidget {
    id: string
    unmount: () => void
    container: HTMLElement
}

const mountedWidgets = new Map<string, MountedWidget>()
let rootContainer: HTMLElement | null = null

export function loadMultipleWidgets(widgets: Widget[]) {
    const currentRoot = document.getElementById("overlay-root")

    // Handle root container changes (e.g. React remounts)
    if (currentRoot !== rootContainer) {
        // If the root changed, all previous mount records are invalid as the DOM nodes are gone/detached
        // We should try to clean up if possible, but primarily we need to reset
        if (mountedWidgets.size > 0) {
            console.log("Overlay root changed, resetting mounted widgets")
            // Try to cleanup old runtimes
            for (const [id, widget] of mountedWidgets.entries()) {
                try { widget.unmount() } catch (e) { /* ignore */ }
                registerWidgetUnmount(id)
            }
            mountedWidgets.clear()
        }
        rootContainer = currentRoot
    }

    if (!rootContainer) return

    // Unmount widgets that are no longer in the list
    const newIds = new Set(widgets.map(w => w.id))
    for (const [id, widget] of mountedWidgets.entries()) {
        if (!newIds.has(id)) {
            widget.unmount()
            widget.container.remove()
            mountedWidgets.delete(id)
            registerWidgetUnmount(id)
        }
    }

    // Mount or update widgets
    widgets.forEach(widget => {
        const mounted = mountedWidgets.get(widget.id)

        if (mounted) {
            // Already mounted: Update properties and DOM order
            mounted.container.style.zIndex = (widget.zIndex || 0).toString()

            // Move to end of container to match the current sort order
            // (appendChild on an existing child moves it)
            rootContainer!.appendChild(mounted.container)
            return
        }

        try {
            // Create container for this widget
            const container = document.createElement("div")
            container.id = `widget-${widget.id}`
            container.className = "widget-container"
            // Apply z-index if available (default to 0)
            container.style.zIndex = (widget.zIndex || 0).toString()
            container.style.position = "absolute"
            container.style.inset = "0"
            container.style.pointerEvents = "none" // Allow clicks to pass through by default

            rootContainer!.appendChild(container)

            // Create runtime for this widget
            const runtime = createOverlayRuntime(container)
            runtime.apply(widget.js, widget.css)

            mountedWidgets.set(widget.id, {
                id: widget.id,
                unmount: () => runtime.destroy(),
                container
            })
            registerWidgetMount(widget.id)

        } catch (err) {
            console.error(`Failed to mount widget ${widget.name}:`, err)
        }
    })
}

export function unmountAllWidgets() {
    for (const [id, widget] of mountedWidgets.entries()) {
        widget.unmount()
        widget.container.remove()
        registerWidgetUnmount(id)
    }
    mountedWidgets.clear()
}

export function toggleWidget(widgetId: string, enabled: boolean) {
    const mounted = mountedWidgets.get(widgetId)
    if (!enabled && mounted) {
        mounted.unmount()
        mounted.container.remove()
        mountedWidgets.delete(widgetId)
        registerWidgetUnmount(widgetId)
    } else if (enabled && !mounted) {
        // Re-mount widget (would need widget data)
        console.warn("Re-mounting widgets via toggle not fully implemented without full widget data")
    }
}
