import { useState } from "react"
import { useObs } from "../obs/ObsProvider"

export function EventConsole() {
  const { state } = useObs()
  const [open, setOpen] = useState(true)

  return (
    <div className="obs-card">
      <div className="obs-card-row space-between">
        <div className="obs-label">Event console</div>
        <button className="obs-btn ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "Collapse" : "Expand"}
        </button>
      </div>
      {open && (
        <div className="obs-console">
          {state.events
            .slice()
            .reverse()
            .map((e) => (
              <div key={e.ts + e.message} className="obs-console-line">
                <span className="obs-console-meta">{new Date(e.ts).toLocaleTimeString()}</span>
                <span className={`obs-console-tag type-${e.type}`}>{e.type}</span>
                <span className="obs-console-text">{e.message}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
