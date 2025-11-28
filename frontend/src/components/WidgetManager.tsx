import { useState } from "react"
import type { Widget, OverlayConfig } from "../types/widget"

interface WidgetManagerProps {
    config: OverlayConfig
    selectedWidget: Widget | null
    onSelectWidget: (widget: Widget) => void
    onUpdateWidget: (widgetId: string, updates: Partial<Widget>) => void
    onNewWidget: () => void
    onDeleteWidget: (widgetId: string) => void
    onExport: () => void
    onApply: () => void
    onSave: () => void
    onClear: () => void
    applied: string
    error: string
    isDirty: boolean
}

export function WidgetManager({
    config,
    selectedWidget,
    onSelectWidget,
    onUpdateWidget,
    onNewWidget,
    onDeleteWidget,
    onExport,
    onApply,
    onSave,
    onClear,
    applied,
    error,
    isDirty,
}: WidgetManagerProps) {
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState("")

    const handleStartEdit = (widget: Widget) => {
        setEditingId(widget.id)
        setEditingName(widget.name)
    }

    const handleFinishEdit = (widgetId: string) => {
        if (editingName.trim()) {
            onUpdateWidget(widgetId, { name: editingName.trim() })
        }
        setEditingId(null)
        setEditingName("")
    }

    const handleKeyDown = (e: React.KeyboardEvent, widgetId: string) => {
        if (e.key === "Enter") {
            handleFinishEdit(widgetId)
        } else if (e.key === "Escape") {
            setEditingId(null)
            setEditingName("")
        }
    }

    // Check if any widgets are enabled for Apply/Clear buttons
    const hasEnabledWidgets = config.widgets.some(w => w.enabled)
    const canApply = selectedWidget !== null || hasEnabledWidgets

    return (
        <div className="widget-manager">
            <div className="widget-manager-header">
                <div style={{ display: "flex", gap: "4px" }}>
                    <button className="obs-btn" onClick={onNewWidget} style={{ fontSize: "0.75rem", padding: "4px 8px" }}>
                        + New
                    </button>
                    <button className="obs-btn" onClick={onExport} style={{ fontSize: "0.75rem", padding: "4px 8px" }}>
                        Export
                    </button>
                </div>
            </div>

            <div className="widget-list">
                {/* Root index.html with chevron */}
                <div
                    style={{
                        padding: "6px 8px",
                        fontSize: "0.85rem",
                        color: "#a8c3ff",
                        fontWeight: 600,
                        borderBottom: "1px solid #1f2533",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                    }}
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    <svg
                        className={`tree-icon tree-icon-chevron ${isCollapsed ? "" : "expanded"}`}
                        viewBox="0 0 16 16"
                        fill="currentColor"
                    >
                        <path d="M6 4l4 4-4 4V4z" />
                    </svg>
                    <svg className="tree-icon" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M2 3h5l2 2h5v8H2V3z" />
                    </svg>
                    index.html
                </div>

                {/* Widget folders */}
                {!isCollapsed && (
                    <div style={{ paddingLeft: "12px" }}>
                        {config.widgets.map((widget) => (
                            <div
                                key={widget.id}
                                className={`widget-item ${selectedWidget?.id === widget.id ? "selected" : ""}`}
                                onClick={() => onSelectWidget(widget)}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
                                    <input
                                        type="checkbox"
                                        checked={widget.enabled}
                                        onChange={(e) => {
                                            e.stopPropagation()
                                            onUpdateWidget(widget.id, { enabled: !widget.enabled })
                                        }}
                                        className="widget-checkbox"
                                        title={widget.enabled ? "Enabled (Apply to mount)" : "Disabled (Apply to unmount)"}
                                    />
                                    <div className="tree-item-content" style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "6px" }}>
                                        <svg className="tree-icon" viewBox="0 0 16 16" fill="currentColor">
                                            <path d="M2 3h5l2 2h5v8H2V3z" />
                                        </svg>

                                        {/* Mount Status Indicator */}
                                        {widget.isMounted && (
                                            <div
                                                style={{
                                                    width: "6px",
                                                    height: "6px",
                                                    borderRadius: "50%",
                                                    background: "#4ade80",
                                                    boxShadow: "0 0 4px #4ade80"
                                                }}
                                                title="Currently Mounted in DOM"
                                            />
                                        )}

                                        {editingId === widget.id ? (
                                            <input
                                                type="text"
                                                value={editingName}
                                                onChange={(e) => setEditingName(e.target.value)}
                                                onBlur={() => handleFinishEdit(widget.id)}
                                                onKeyDown={(e) => handleKeyDown(e, widget.id)}
                                                onClick={(e) => e.stopPropagation()}
                                                autoFocus
                                                className="widget-name-input"
                                            />
                                        ) : (
                                            <span
                                                className="widget-name"
                                                onDoubleClick={(e) => {
                                                    e.stopPropagation()
                                                    handleStartEdit(widget)
                                                }}
                                                title="Double-click to rename"
                                            >
                                                {widget.name}
                                            </span>
                                        )}
                                    </div>

                                    {/* Z-Index Control */}
                                    <div
                                        style={{ display: "flex", flexDirection: "column", gap: "1px", marginRight: "4px" }}
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        <button
                                            style={{
                                                background: "none", border: "none", color: "#6b7280",
                                                cursor: "pointer", fontSize: "8px", padding: 0, lineHeight: 1
                                            }}
                                            onClick={() => onUpdateWidget(widget.id, { zIndex: (widget.zIndex || 0) + 1 })}
                                            title="Move Layer Up"
                                        >
                                            ▲
                                        </button>
                                        <button
                                            style={{
                                                background: "none", border: "none", color: "#6b7280",
                                                cursor: "pointer", fontSize: "8px", padding: 0, lineHeight: 1
                                            }}
                                            onClick={() => onUpdateWidget(widget.id, { zIndex: (widget.zIndex || 0) - 1 })}
                                            title="Move Layer Down"
                                        >
                                            ▼
                                        </button>
                                    </div>
                                </div>
                                <button
                                    className="widget-delete"
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        onDeleteWidget(widget.id)
                                    }}
                                    title="Delete widget"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Apply/Save section - fixed at bottom */}
            <div className="widget-actions">
                <button
                    className="obs-btn"
                    onClick={onSave}
                    disabled={!isDirty || !selectedWidget}
                    title={!selectedWidget ? "Select a widget to save" : !isDirty ? "No changes to save" : "Save changes to file"}
                >
                    {isDirty ? "Save ●" : "Save"}
                </button>
                <button
                    className="obs-btn ghost"
                    onClick={onApply}
                    disabled={!canApply}
                    title={!canApply ? "Enable at least one widget to preview" : "Preview changes without saving"}
                >
                    Apply Preview
                </button>
                <button
                    className="obs-btn ghost"
                    onClick={onClear}
                    title="Clear all widgets from preview"
                >
                    Clear
                </button>
                {applied && !error && (
                    <div className="obs-chip live" style={{ fontSize: "0.75rem", marginTop: "4px" }}>
                        {applied}
                    </div>
                )}
                {error && (
                    <div className="obs-error" style={{ fontSize: "0.75rem", marginTop: "4px" }}>
                        {error}
                    </div>
                )}
            </div>
        </div>
    )
}
