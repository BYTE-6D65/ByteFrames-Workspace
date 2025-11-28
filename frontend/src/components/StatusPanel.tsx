import { useObs } from "../obs/ObsProvider"

export function StatusPanel() {
  const { state } = useObs()
  const outputs = state.outputs
  const stats = state.stats
  const activeCollection = state.scenes.length ? "Loaded" : "Unknown"

  return (
    <div className="obs-card grid">
      <div>
        <div className="obs-label">Streaming</div>
        <div className="obs-strong">{outputs?.streaming ? "On" : "Off"}</div>
      </div>
      <div>
        <div className="obs-label">Recording</div>
        <div className="obs-strong">{outputs?.recording ? "On" : "Off"}</div>
      </div>
      <div>
        <div className="obs-label">FPS</div>
        <div className="obs-strong">{stats?.fps ?? "--"}</div>
      </div>
      <div>
        <div className="obs-label">Dropped</div>
        <div className="obs-strong">{stats?.outputSkipped ?? 0}</div>
      </div>
      <div>
        <div className="obs-label">CPU</div>
        <div className="obs-strong">{stats ? `${stats.cpuUsage.toFixed(1)}%` : "--"}</div>
      </div>
      <div>
        <div className="obs-label">Memory</div>
        <div className="obs-strong">{stats ? `${stats.memoryUsage.toFixed(1)} MB` : "--"}</div>
      </div>
      <div>
        <div className="obs-label">Active Scene</div>
        <div className="obs-strong">{state.activeScene ?? "--"}</div>
      </div>
      <div>
        <div className="obs-label">Scene Collection</div>
        <div className="obs-strong">{activeCollection}</div>
      </div>
      <div style={{ gridColumn: "1 / -1", borderTop: "1px solid #1f2533", paddingTop: "0.5rem", marginTop: "0.2rem" }}>
        <button
          className="obs-btn ghost"
          style={{ width: "100%", fontSize: "0.8rem", padding: "0.4rem" }}
          onClick={async () => {
            if (confirm("Are you sure? This will delete all widgets and reset to default.")) {
              const { resetToDefault } = await import("../db/queries")
              await resetToDefault()
              window.location.reload()
            }
          }}
        >
          Reset to Default
        </button>
      </div>
    </div>
  )
}
