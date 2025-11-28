import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from "react"
import type { ReactNode } from "react"
import type {
  ObsClientLike,
  ObsConnectionState,
  ObsEndpoint,
  ObsEventMap,
  ObsScene,
  ObsSource,
  ObsStatsSnapshot,
  ObsOutputState,
} from "./types"
import { obsClient as defaultObsClient } from "./connection"

type EventLogEntry = { ts: number; type: keyof ObsEventMap | "log"; message: string }

interface ObsState {
  connection: ObsConnectionState
  scenes: ObsScene[]
  activeScene?: string
  sources: ObsSource[]
  stats?: ObsStatsSnapshot
  outputs?: ObsOutputState
  events: EventLogEntry[]
}

type Action =
  | { type: "connection"; payload: ObsConnectionState }
  | { type: "snapshot"; payload: { scenes: ObsScene[]; activeScene?: string; stats?: ObsStatsSnapshot; outputs?: ObsOutputState } }
  | { type: "scenesUpdated"; payload: ObsScene[] }
  | { type: "activeScene"; payload: string }
  | { type: "sourcesUpdated"; payload: ObsSource[] }
  | { type: "sourceVisibility"; payload: { sceneName: string; sourceName: string; enabled: boolean } }
  | { type: "stats"; payload: ObsStatsSnapshot }
  | { type: "streamState"; payload: ObsOutputState }
  | { type: "log"; payload: EventLogEntry }

const initialState: ObsState = {
  connection: { status: "disconnected" },
  scenes: [],
  sources: [],
  events: [],
}

function reducer(state: ObsState, action: Action): ObsState {
  switch (action.type) {
    case "connection":
      return { ...state, connection: action.payload }
    case "snapshot":
      return {
        ...state,
        scenes: action.payload.scenes,
        activeScene: action.payload.activeScene,
        stats: action.payload.stats ?? state.stats,
        outputs: action.payload.outputs ?? state.outputs,
        sources: action.payload.scenes.find((s) => s.name === action.payload.activeScene)?.sources ?? state.sources,
      }
    case "scenesUpdated":
      return { ...state, scenes: action.payload }
    case "activeScene": {
      const sources = state.scenes.find((s) => s.name === action.payload)?.sources ?? state.sources
      return { ...state, activeScene: action.payload, sources }
    }
    case "sourcesUpdated":
      return { ...state, sources: action.payload }
    case "sourceVisibility": {
      if (state.activeScene !== action.payload.sceneName) return state
      return {
        ...state,
        sources: state.sources.map((s) =>
          s.name === action.payload.sourceName ? { ...s, enabled: action.payload.enabled } : s,
        ),
      }
    }
    case "stats":
      return { ...state, stats: action.payload }
    case "streamState":
      return { ...state, outputs: action.payload }
    case "log": {
      const events = [...state.events, action.payload].slice(-150)
      return { ...state, events }
    }
    default:
      return state
  }
}

interface ObsContextShape {
  state: ObsState
  connect: (endpoint: ObsEndpoint) => Promise<void>
  disconnect: () => Promise<void>
  reconnect: () => Promise<void>
  switchScene: (name: string) => Promise<void>
  toggleSource: (sceneName: string, sourceName: string, enabled: boolean) => Promise<void>
  refreshSources: (sceneName: string) => Promise<void>
  client: ObsClientLike
}

const ObsContext = createContext<ObsContextShape | undefined>(undefined)

export function ObsProvider({ children, client = defaultObsClient }: { children: ReactNode; client?: ObsClientLike }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const clientRef = useRef(client)

  // Subscribe once on mount
  useEffect(() => {
    const c = clientRef.current
    const subs = [
      c.subscribe("connection", (payload) => {
        dispatch({ type: "connection", payload })
        log("connection", payload.status)
      }),
      c.subscribe("snapshot", (payload) => dispatch({ type: "snapshot", payload })),
      c.subscribe("scenesUpdated", (payload) => dispatch({ type: "scenesUpdated", payload })),
      c.subscribe("activeScene", ({ name }) => dispatch({ type: "activeScene", payload: name })),
      c.subscribe("sourcesUpdated", (payload) => dispatch({ type: "sourcesUpdated", payload })),
      c.subscribe("sourceVisibility", (payload) => dispatch({ type: "sourceVisibility", payload })),
      c.subscribe("streamState", (payload) => dispatch({ type: "streamState", payload })),
      c.subscribe("stats", (payload) => dispatch({ type: "stats", payload })),
      c.subscribe("error", ({ error }) => log("error", error instanceof Error ? error.message : String(error))),
    ]

    return () => subs.forEach((s) => s.unsubscribe())
  }, [])

  const log = (type: EventLogEntry["type"], message: string) => {
    dispatch({ type: "log", payload: { ts: Date.now(), type, message } })
  }

  const value = useMemo<ObsContextShape>(
    () => ({
      state,
      client: clientRef.current,
      connect: async (endpoint) => {
        await clientRef.current.connect(endpoint)
      },
      disconnect: async () => {
        await clientRef.current.disconnect()
      },
      reconnect: async () => {
        const endpoint = (clientRef.current as any).endpoint as ObsEndpoint | undefined
        if (endpoint) {
          await clientRef.current.connect(endpoint)
        }
      },
      switchScene: async (name) => {
        await clientRef.current.switchScene(name)
        dispatch({ type: "activeScene", payload: name })
        const sources = await clientRef.current.listSources(name)
        dispatch({ type: "sourcesUpdated", payload: sources })
      },
      toggleSource: async (sceneName, sourceName, enabled) => {
        await clientRef.current.setSourceEnabled(sceneName, sourceName, enabled)
        dispatch({ type: "sourceVisibility", payload: { sceneName, sourceName, enabled } })
      },
      refreshSources: async (sceneName) => {
        const sources = await clientRef.current.listSources(sceneName)
        dispatch({ type: "sourcesUpdated", payload: sources })
      },
    }),
    [state],
  )

  return <ObsContext.Provider value={value}>{children}</ObsContext.Provider>
}

export function useObs() {
  const ctx = useContext(ObsContext)
  if (!ctx) throw new Error("useObs must be used within ObsProvider")
  return ctx
}
