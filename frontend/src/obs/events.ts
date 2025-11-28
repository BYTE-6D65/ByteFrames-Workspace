import type { ObsEventHandler, ObsEventMap, ObsEventName, ObsSubscription } from "./types"

export class ObsEventBus {
  private listeners: {
    [K in ObsEventName]?: Set<ObsEventHandler<ObsEventMap[K]>>
  } = {}

  emit<K extends ObsEventName>(name: K, payload: ObsEventMap[K]) {
    this.listeners[name]?.forEach((handler) => {
      try {
        handler(payload)
      } catch (err) {
        // swallow to keep bus alive
        console.warn("OBS event handler error", err)
      }
    })
  }

  on<K extends ObsEventName>(name: K, handler: ObsEventHandler<ObsEventMap[K]>): ObsSubscription {
    if (!this.listeners[name]) {
      this.listeners[name] = new Set() as any
    }
    (this.listeners[name] as Set<any>).add(handler)
    return {
      unsubscribe: () => {
        this.listeners[name]?.delete(handler)
      },
    }
  }
}
