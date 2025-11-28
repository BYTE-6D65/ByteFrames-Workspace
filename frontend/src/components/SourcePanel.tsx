import { useMemo } from "react"
import { useObs } from "../obs/ObsProvider"

export function SourcePanel() {
  const { state, toggleSource, refreshSources } = useObs()
  const sceneName = state.activeScene
  const sources = state.sources

  const sorted = useMemo(() => sources.slice().sort((a, b) => a.name.localeCompare(b.name)), [sources])

  if (!sceneName) {
    return <div className="obs-card">No active scene.</div>
  }

  return (
    <div className="obs-card">
      <div className="obs-card-row tight space-between">
        <div className="obs-label">Sources in {sceneName}</div>
        <button className="obs-btn ghost" onClick={() => refreshSources(sceneName)}>
          Refresh
        </button>
      </div>
      <div className="obs-list">
        {sorted.map((source) => (
          <div key={source.id} className="obs-list-item row">
            <div className="obs-list-col">
              <div className="obs-list-title">{source.name}</div>
              <div className="obs-list-meta">{source.type}</div>
            </div>
            <label className="obs-toggle">
              <input
                type="checkbox"
                checked={source.enabled}
                onChange={(e) => toggleSource(sceneName, source.name, e.target.checked)}
              />
              <span>{source.enabled ? "Visible" : "Hidden"}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  )
}
