import { useMemo } from "react"
import { useObs } from "../obs/ObsProvider"

export function ScenePanel() {
  const { state, switchScene } = useObs()
  const scenes = state.scenes
  const active = state.activeScene

  const sorted = useMemo(() => scenes.slice().sort((a, b) => a.name.localeCompare(b.name)), [scenes])

  return (
    <div className="obs-card">
      <div className="obs-list">
        {sorted.map((scene) => (
          <button
            key={scene.name}
            className={`obs-list-item ${scene.name === active ? "active" : ""}`}
            onClick={() => switchScene(scene.name)}
          >
            <div className="obs-list-title">{scene.name}</div>
            {scene.isActive && <span className="obs-chip">Program</span>}
          </button>
        ))}
      </div>
      <div className="obs-actions inline">
        <button className="obs-btn ghost" disabled>
          Create
        </button>
        <button className="obs-btn ghost" disabled>
          Duplicate
        </button>
        <button className="obs-btn ghost" disabled>
          Delete
        </button>
      </div>
    </div>
  )
}
