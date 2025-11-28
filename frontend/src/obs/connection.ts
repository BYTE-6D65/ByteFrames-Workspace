import OBSWebSocket from "obs-websocket-js"
import { ObsEventBus } from "./events"
import type {
  ObsClientLike,
  ObsConnectionState,
  ObsEndpoint,
  ObsEventName,
  ObsEventHandler,
  ObsSubscription,
  ObsSnapshot,
  ObsScene,
  ObsSource,
  ObsSceneItemTransform,
  ObsStatsSnapshot,
  ObsOutputState,
  ObsWebSocketFactory,
} from "./types"

export class ObsClient implements ObsClientLike {
  private obs: OBSWebSocket
  private readonly bus = new ObsEventBus()
  private connectionState: ObsConnectionState = { status: "disconnected" }
  private reconnectInterval = 3000
  private endpoint?: ObsEndpoint
  private reconnectTimer?: ReturnType<typeof setTimeout>

  constructor(factory?: ObsWebSocketFactory) {
    this.obs = factory ? factory() : new OBSWebSocket()
    this.attachHandlers()
  }

  subscribe<K extends ObsEventName>(event: K, handler: ObsEventHandler<any>): ObsSubscription {
    return this.bus.on(event, handler)
  }

  getConnectionState() {
    return this.connectionState
  }

  async connect(endpoint: ObsEndpoint) {
    this.endpoint = endpoint
    this.setConnectionState({ status: "connecting" })
    try {
      await this.obs.connect(endpoint.url, endpoint.password)
      // @ts-ignore - version property might be missing in types
      const version = this.obs.version || ""
      this.setConnectionState({ status: "connected", server: endpoint.url, version })
      await this.hydrateSnapshot()
    } catch (error) {
      this.handleError(error)
      this.scheduleReconnect()
    }
  }

  async disconnect() {
    this.endpoint = undefined
    clearTimeout(this.reconnectTimer)
    await this.obs.disconnect()
    this.setConnectionState({ status: "disconnected" })
  }

  private attachHandlers() {
    this.obs.on("ConnectionClosed", (err) => {
      this.setConnectionState({ status: "disconnected", reason: err?.message })
      this.scheduleReconnect()
    })

    this.obs.on("ConnectionError", (err) => {
      this.handleError(err)
      this.scheduleReconnect()
    })

    this.obs.on("CurrentProgramSceneChanged", async (payload) => {
      this.bus.emit("activeScene", { name: payload.sceneName })
      const scenes = await this.listScenes()
      this.bus.emit("scenesUpdated", scenes)
    })

    this.obs.on("SceneItemEnableStateChanged", async ({ sceneName, sceneItemId, sceneItemEnabled }) => {
      const scene = await this.getScene(sceneName)
      const source = scene.sources.find((s) => s.id === sceneItemId)
      if (source) {
        this.bus.emit("sourceVisibility", { sceneName, sourceName: source.name, enabled: sceneItemEnabled })
      }
    })

    this.obs.on("SceneItemTransformChanged", async ({ sceneName }) => {
      const sources = await this.listSources(sceneName)
      this.bus.emit("sourcesUpdated", sources)
    })

    this.obs.on("StreamStateChanged", (payload) => {
      const output: ObsOutputState = {
        streaming: payload.outputActive,
        streamTimecode: (payload as any).outputTimecode,
        recording: false,
        virtualCam: false,
        replayBuffer: false,
      }
      this.bus.emit("streamState", output)
    })

    this.obs.on("RecordStateChanged", (payload) => {
      this.bus.emit("streamState", {
        streaming: false,
        recording: payload.outputActive,
        recordingTimecode: (payload as any).outputTimecode,
        virtualCam: false,
        replayBuffer: false,
      })
    })

    // @ts-ignore - Stats event might be missing in types
    this.obs.on("Stats", (stats) => {
      this.bus.emit("stats", this.mapStats(stats))
    })
  }

  private handleError(error: any) {
    const err = error instanceof Error ? error : new Error(String(error))
    this.setConnectionState({ status: "error", error: err })
    this.bus.emit("error", { error: err })
  }

  private scheduleReconnect() {
    if (!this.endpoint) return
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = setTimeout(() => {
      void this.connect(this.endpoint!)
    }, this.reconnectInterval)
  }

  private setConnectionState(state: ObsConnectionState) {
    this.connectionState = state
    this.bus.emit("connection", state)
  }

  async getSnapshot(): Promise<ObsSnapshot> {
    const scenes = await this.listScenes()
    const stats = await this.fetchStats()
    const outputs = await this.fetchOutputs()
    const current = await this.obs.call("GetCurrentProgramScene")
    const preview = await this.obs.call("GetCurrentPreviewScene").catch(() => undefined)

    const snapshot: ObsSnapshot = {
      scenes,
      activeScene: current.sceneName,
      previewScene: preview?.sceneName,
      stats,
      outputs,
    }
    this.bus.emit("snapshot", snapshot)
    return snapshot
  }

  private async hydrateSnapshot() {
    await this.getSnapshot()
  }

  async listScenes(): Promise<ObsScene[]> {
    const [sceneList, current] = await Promise.all([
      this.obs.call("GetSceneList"),
      this.obs.call("GetCurrentProgramScene"),
    ])
    const { scenes } = sceneList
    const activeName = current.sceneName
    const mapped = await Promise.all(
      scenes.map(async (scene) => {
        const name = String(scene.sceneName)
        const sources = await this.listSources(name)
        return {
          name,
          sources,
          isActive: name === activeName,
        }
      }),
    )
    return mapped
  }

  private async getScene(sceneName: string): Promise<ObsScene> {
    const sources = await this.listSources(sceneName)
    return { name: sceneName, sources, isActive: false }
  }

  async listSources(sceneName: string): Promise<ObsSource[]> {
    const { sceneItems } = await this.obs.call("GetSceneItemList", { sceneName })
    return Promise.all(
      sceneItems.map(async (item) => {
        const transform = await this.obs.call("GetSceneItemTransform", {
          sceneName,
          sceneItemId: item.sceneItemId as number,
        })
        return {
          id: Number(item.sceneItemId),
          name: String(item.sourceName),
          type: String(item.inputKind ?? item.sourceKind ?? "unknown"),
          enabled: Boolean(item.sceneItemEnabled),
          parentScene: sceneName,
          transform: this.mapTransform(transform.sceneItemTransform),
        }
      }),
    )
  }

  async switchScene(name: string) {
    await this.obs.call("SetCurrentProgramScene", { sceneName: name })
  }

  async createScene(name: string) {
    await this.obs.call("CreateScene", { sceneName: name })
  }

  async removeScene(name: string) {
    await this.obs.call("RemoveScene", { sceneName: name })
  }

  async renameScene(oldName: string, newName: string) {
    await this.obs.call("SetSceneName", { sceneName: oldName, newSceneName: newName })
  }

  async createSceneCollection(name: string) {
    await this.obs.call("CreateSceneCollection", { sceneCollectionName: name })
  }

  async setSceneCollection(name: string) {
    await this.obs.call("SetCurrentSceneCollection", { sceneCollectionName: name })
    await this.hydrateSnapshot()
  }

  async setSourceEnabled(sceneName: string, sourceName: string, enabled: boolean) {
    const itemId = await this.getSceneItemId(sceneName, sourceName)
    await this.obs.call("SetSceneItemEnabled", { sceneName, sceneItemId: itemId, sceneItemEnabled: enabled })
  }

  async transformSource(sceneName: string, sourceName: string, transform: Partial<ObsSceneItemTransform>) {
    const itemId = await this.getSceneItemId(sceneName, sourceName)
    await this.obs.call("SetSceneItemTransform", {
      sceneName,
      sceneItemId: itemId,
      sceneItemTransform: transform,
    })
  }

  async createInput(sceneName: string, inputName: string, kind: string, settings?: Record<string, unknown>) {
    await this.obs.call("CreateInput", {
      sceneName,
      inputName,
      inputKind: kind,
      inputSettings: (settings ?? {}) as any,
    })
  }

  async removeSource(sceneName: string, sourceName: string) {
    const id = await this.getSceneItemId(sceneName, sourceName)
    await this.obs.call("RemoveSceneItem", { sceneName, sceneItemId: id })
  }

  async updateInputSettings(inputName: string, settings: Record<string, unknown>) {
    await this.obs.call("SetInputSettings", { inputName, inputSettings: settings as any, overlay: true })
  }

  // Utility lookup
  private async getSceneItemId(sceneName: string, sourceName: string) {
    const { sceneItemId } = await this.obs.call("GetSceneItemId", { sceneName, sourceName })
    return sceneItemId
  }

  private mapTransform(t: any): ObsSceneItemTransform {
    return {
      positionX: t.positionX,
      positionY: t.positionY,
      scaleX: t.scaleX,
      scaleY: t.scaleY,
      rotation: t.rotation,
      width: t.width,
      height: t.height,
      cropLeft: t.cropLeft,
      cropRight: t.cropRight,
      cropTop: t.cropTop,
      cropBottom: t.cropBottom,
    }
  }

  private mapStats(stats: any): ObsStatsSnapshot {
    return {
      fps: stats.activeFps ?? stats.averageFrameRate ?? 0,
      averageFrameTime: stats.averageFrameTime ?? 0,
      renderSkipped: stats.renderSkippedFrames ?? 0,
      outputSkipped: stats.outputSkippedFrames ?? 0,
      outputTotal: stats.outputTotalFrames ?? 0,
      cpuUsage: stats.cpuUsage ?? 0,
      memoryUsage: stats.memoryUsage ?? 0,
      availableDiskSpace: stats.availableDiskSpace ?? 0,
      activeFps: stats.activeFps ?? 0,
    }
  }

  private async fetchStats(): Promise<ObsStatsSnapshot> {
    const response = await this.obs.call("GetStats")
    return this.mapStats(response)
  }

  private async fetchOutputs(): Promise<ObsOutputState> {
    const stream = await this.obs.call("GetStreamStatus").catch(() => undefined)
    const record = await this.obs.call("GetRecordStatus").catch(() => undefined)
    const vc = await this.obs.call("GetVirtualCamStatus").catch(() => undefined)
    const replay = await this.obs.call("GetReplayBufferStatus").catch(() => undefined)

    return {
      streaming: !!stream?.outputActive,
      recording: !!record?.outputActive,
      virtualCam: !!vc?.outputActive,
      replayBuffer: !!replay?.outputActive,
      streamTimecode: (stream as any)?.outputTimecode,
      recordingTimecode: (record as any)?.outputTimecode,
    }
  }
}

export const obsClient = new ObsClient()
