import type OBSWebSocket from "obs-websocket-js"
import type { OBSWebSocketError } from "obs-websocket-js"

export type ObsConnectionState =
  | { status: "disconnected"; reason?: string }
  | { status: "connecting" }
  | { status: "authenticating" }
  | { status: "connected"; server: string; version: string }
  | { status: "error"; error: OBSWebSocketError | Error | string }

export interface ObsEndpoint {
  url: string
  password?: string
}

export interface ObsSceneItemTransform {
  positionX: number
  positionY: number
  scaleX: number
  scaleY: number
  rotation: number
  width: number
  height: number
  cropLeft: number
  cropRight: number
  cropTop: number
  cropBottom: number
}

export interface ObsSource {
  id: number
  name: string
  type: string
  enabled: boolean
  parentScene: string
  transform?: ObsSceneItemTransform
}

export interface ObsScene {
  name: string
  sources: ObsSource[]
  isActive: boolean
}

export interface ObsStatsSnapshot {
  fps: number
  averageFrameTime: number
  renderSkipped: number
  outputSkipped: number
  outputTotal: number
  cpuUsage: number
  memoryUsage: number
  availableDiskSpace: number
  activeFps: number
}

export interface ObsOutputState {
  streaming: boolean
  recording: boolean
  virtualCam: boolean
  replayBuffer: boolean
  streamTimecode?: string
  recordingTimecode?: string
}

export interface ObsSnapshot {
  scenes: ObsScene[]
  activeScene?: string
  previewScene?: string
  stats?: ObsStatsSnapshot
  outputs?: ObsOutputState
}

export type ObsEventHandler<T> = (payload: T) => void

export type ObsEventMap = {
  connection: ObsConnectionState
  snapshot: ObsSnapshot
  scenesUpdated: ObsScene[]
  activeScene: { name: string }
  sourcesUpdated: ObsSource[]
  sourceVisibility: { sceneName: string; sourceName: string; enabled: boolean }
  streamState: ObsOutputState
  stats: ObsStatsSnapshot
  error: { error: OBSWebSocketError | Error | string }
}

export type ObsEventName = keyof ObsEventMap

export interface ObsSubscription {
  unsubscribe: () => void
}

export interface ObsClientLike {
  connect(endpoint: ObsEndpoint): Promise<void>
  disconnect(): Promise<void>
  getSnapshot(): Promise<ObsSnapshot>
  switchScene(name: string): Promise<void>
  createScene(name: string): Promise<void>
  removeScene(name: string): Promise<void>
  renameScene(oldName: string, newName: string): Promise<void>
  createSceneCollection(name: string): Promise<void>
  setSceneCollection(name: string): Promise<void>
  listScenes(): Promise<ObsScene[]>
  listSources(sceneName: string): Promise<ObsSource[]>
  createInput(sceneName: string, inputName: string, kind: string, settings?: Record<string, unknown>): Promise<void>
  removeSource(sceneName: string, sourceName: string): Promise<void>
  setSourceEnabled(sceneName: string, sourceName: string, enabled: boolean): Promise<void>
  transformSource(sceneName: string, sourceName: string, transform: Partial<ObsSceneItemTransform>): Promise<void>
  updateInputSettings(inputName: string, settings: Record<string, unknown>): Promise<void>
  subscribe<K extends ObsEventName>(event: K, handler: ObsEventHandler<ObsEventMap[K]>): ObsSubscription
  getConnectionState(): ObsConnectionState
}

export type ObsWebSocketFactory = () => OBSWebSocket
