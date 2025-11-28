import { useMemo, useState } from "react"
import { useObs } from "../obs/ObsProvider"

export function ConnectionPanel() {
  const { state, connect, disconnect, reconnect } = useObs()
  const [url, setUrl] = useState("ws://localhost:4455")
  const [password, setPassword] = useState("")

  const statusLabel = useMemo(() => {
    switch (state.connection.status) {
      case "connected":
        return "Connected"
      case "connecting":
        return "Connecting"
      case "authenticating":
        return "Authenticating"
      case "error":
        return "Error"
      default:
        return "Disconnected"
    }
  }, [state.connection.status])

  const errorText = state.connection.status === "error" ? `${state.connection.error}` : undefined

  return (
    <div className="obs-card">
      <div className="obs-card-row tight">
        <label className="obs-label">WebSocket URL</label>
        <input
          className="obs-input"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="ws://localhost:4455"
        />
      </div>
      <div className="obs-card-row tight">
        <label className="obs-label">Password</label>
        <input
          className="obs-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="optional"
        />
      </div>
      <div className="obs-actions">
        <button className="obs-btn" onClick={() => connect({ url, password: password || undefined })}>
          Connect
        </button>
        <button className="obs-btn" onClick={() => reconnect()}>Reconnect</button>
        <button className="obs-btn" onClick={() => disconnect()}>Disconnect</button>
      </div>
      <div className="obs-status">
        <span className={`obs-dot ${state.connection.status}`}></span>
        <span>{statusLabel}</span>
        {state.connection.status === "connected" && state.connection.server && (
          <span className="obs-chip">{state.connection.server}</span>
        )}
        {state.connection.status === "error" && errorText && <span className="obs-error">{errorText}</span>}
      </div>
    </div>
  )
}
