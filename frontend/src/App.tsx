import { useEffect, useRef, useState, useCallback } from "react";
import MonacoEditor from "@monaco-editor/react";
import { Mosaic, MosaicWindow, type MosaicNode } from "react-mosaic-component";
import "react-mosaic-component/react-mosaic-component.css";
import { ConnectionPanel } from "./components/ConnectionPanel";
import { ScenePanel } from "./components/ScenePanel";
import { SourcePanel } from "./components/SourcePanel";
import { StatusPanel } from "./components/StatusPanel";
import { WidgetManager } from "./components/WidgetManager";
import { ObsProvider } from "./obs/ObsProvider";
import { setOverlayRoot } from "./overlay/runtime";
import type { Widget, OverlayConfig } from "./types/widget";
import { initSchema } from "./db/schema";
import {
  getConfigs,
  getWidgetsWithState,
  createWidget,
  updateWidget,
  deleteWidget,
  migrateFromLocalStorage,
  setAppState,
  getAppState,
  createDefaultConfigInDb,
} from "./db/queries";
import { subscribeToMountState } from "./overlay/mountTracker";
import "./App.css";

type ViewId = "preview" | "control" | "bottom";

type VideoStatus = "idle" | "binding" | "live" | "error";

function BottomPanel() {
  // Database state
  const [isDbReady, setIsDbReady] = useState(false);
  const [configs, setConfigs] = useState<OverlayConfig[]>([]);
  const [activeConfigId, setActiveConfigId] = useState<string | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);

  // Working copy state
  const [workingJs, setWorkingJs] = useState("");
  const [workingCss, setWorkingCss] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  // UI state
  const [activeTab, setActiveTab] = useState<"status" | "editor" | "logs">(
    "editor",
  );
  const [applied, setApplied] = useState("");
  const [error, setError] = useState("");

  // Define refreshWidgets first so it can be used in effects
  const refreshWidgets = useCallback(async (configId: string) => {
    const widgets = await getWidgetsWithState(configId);
    setConfigs((prev) =>
      prev.map((c) => (c.id === configId ? { ...c, widgets } : c)),
    );
  }, []);

  // Initialize DB and migrate
  useEffect(() => {
    const init = async () => {
      try {
        await initSchema();

        // Migrate old data if needed
        const oldConfigs = JSON.parse(
          localStorage.getItem("obs_overlay_configs") || "[]",
        );
        if (oldConfigs.length > 0) {
          await migrateFromLocalStorage(oldConfigs);
          localStorage.removeItem("obs_overlay_configs"); // Clean up old localStorage
        }

        // Load initial data
        const dbConfigs = await getConfigs();
        setConfigs(dbConfigs);

        let initialActiveConfigId: string | null = null;
        if (dbConfigs.length > 0) {
          const lastActiveConfigId = await getAppState("activeConfigId");
          initialActiveConfigId =
            dbConfigs.find((c) => c.id === lastActiveConfigId)?.id ||
            dbConfigs[0].id;
          setActiveConfigId(initialActiveConfigId);
        } else {
          // If no configs exist, create a default one in DB
          const defaultConfig = await createDefaultConfigInDb();
          setConfigs([defaultConfig]);
          initialActiveConfigId = defaultConfig.id;
          setActiveConfigId(initialActiveConfigId);
        }

        // Restore selected widget
        const lastSelected = await getAppState("selectedWidgetId");
        if (lastSelected) setSelectedWidgetId(lastSelected);

        setIsDbReady(true);
      } catch (err) {
        console.error("Failed to init DB:", err);
        setError("Database initialization failed");
      }
    };
    init();
  }, []);

  // Persist active config ID
  useEffect(() => {
    if (activeConfigId) {
      setAppState("activeConfigId", activeConfigId);
    }
  }, [activeConfigId]);

  // Subscribe to mount state changes (real-time updates)
  useEffect(() => {
    const unsubscribe = subscribeToMountState(() => {
      // Refresh widgets to get new mount status
      if (activeConfigId) {
        refreshWidgets(activeConfigId);
      }
    });
    return unsubscribe;
  }, [activeConfigId, refreshWidgets]);

  // Load widget into editor
  const activeConfig = configs.find((c) => c.id === activeConfigId);
  const selectedWidget =
    activeConfig?.widgets.find((w) => w.id === selectedWidgetId) || null;

  useEffect(() => {
    if (selectedWidget) {
      setWorkingJs(selectedWidget.js);
      setWorkingCss(selectedWidget.css);
      setIsDirty(false);
    } else {
      setWorkingJs("");
      setWorkingCss("");
      setIsDirty(false);
    }
  }, [selectedWidget?.id]);

  const handleSelectWidget = async (widget: Widget) => {
    if (isDirty) {
      const shouldSwitch = confirm(
        "You have unsaved changes. Switch widgets anyway?",
      );
      if (!shouldSwitch) return;
    }
    setSelectedWidgetId(widget.id);
    await setAppState("selectedWidgetId", widget.id);
  };

  const handleWorkingJsChange = (value: string) => {
    setWorkingJs(value);
    setIsDirty(true);
  };

  const handleWorkingCssChange = (value: string) => {
    setWorkingCss(value);
    setIsDirty(true);
  };

  const handleNewWidget = async () => {
    if (!activeConfigId) return;
    const newWidget = await createWidget(activeConfigId, {
      name: `Widget ${activeConfig!.widgets.length + 1}`,
      enabled: true,
    });
    await refreshWidgets(activeConfigId);
    handleSelectWidget(newWidget);
  };

  const handleDeleteWidget = async (widgetId: string) => {
    console.log("[App] handleDeleteWidget called for:", widgetId);
    // SKIPPED: confirm("Are you sure you want to delete this widget?") for testing - always proceed
    console.log("[App] Delete proceeding (no confirm for dev testing)...");
    try {
      console.log("[App] Calling deleteWidget...");
      await deleteWidget(widgetId);
      console.log("[App] deleteWidget SUCCESS");
    } catch (err) {
      console.error("[App] deleteWidget FAILED:", err);
      return;
    }
    console.log("[App] Clearing selection if needed...");
    if (selectedWidgetId === widgetId) {
      setSelectedWidgetId(null);
      await setAppState("selectedWidgetId", "");
    }
    console.log("[App] Refreshing widgets...");
    if (activeConfigId) {
      await refreshWidgets(activeConfigId);
      console.log(
        "[App] Refresh complete. Check config.widgets.length:",
        activeConfig?.widgets?.length || 0,
      );
    }
    console.log("[App] Deletion flow complete");
  };

  const handleUpdateWidget = async (
    widgetId: string,
    updates: Partial<Widget>,
  ) => {
    await updateWidget(widgetId, updates);
    if (activeConfigId) await refreshWidgets(activeConfigId);
  };

  const handleSaveWidget = async () => {
    if (!selectedWidget) return;

    // Check default name pattern
    const defaultNamePattern = /^Widget \d+$/i;
    let nameToSave = selectedWidget.name;

    if (defaultNamePattern.test(selectedWidget.name)) {
      const newName = prompt(
        "Please give this widget a meaningful name before saving:",
        selectedWidget.name,
      );
      if (!newName) return;
      if (newName.trim() === "") {
        alert("Widget name cannot be empty");
        return;
      }
      nameToSave = newName.trim();
    }

    await updateWidget(selectedWidget.id, {
      name: nameToSave,
      js: workingJs,
      css: workingCss,
    });

    if (activeConfigId) await refreshWidgets(activeConfigId);
    setIsDirty(false);
  };

  const applyOverlay = async () => {
    setError("");
    setApplied("");
    try {
      const { injectCSS } = await import("./overlay/runtime");
      const { loadMultipleWidgets } = await import(
        "./overlay/multiWidgetRuntime"
      );

      if (!activeConfig) return;

      // Use working copy for selected widget, DB state for others
      const widgetsToApply = activeConfig.widgets
        .filter((w) => w.enabled)
        .map((w) => {
          if (w.id === selectedWidgetId) {
            return { ...w, js: workingJs, css: workingCss };
          }
          return w;
        });

      const combinedCSS = widgetsToApply.map((w) => w.css).join("\n\n");
      injectCSS(combinedCSS);
      loadMultipleWidgets(widgetsToApply);

      setApplied(`Previewing ${widgetsToApply.length} widget(s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  const clearOverlay = async () => {
    try {
      const { unmountAllWidgets } = await import(
        "./overlay/multiWidgetRuntime"
      );
      unmountAllWidgets();
      setApplied("");
      setError(""); // Clear error on clear
    } catch (err) {
      console.error(err);
    }
  };

  const handleExport = () => {
    // TODO: Implement HTML export with WebSocket
    alert("Export functionality coming soon!");
  };

  if (!isDbReady) {
    return (
      <div style={{ color: "#fff", padding: "20px" }}>Loading database...</div>
    );
  }

  return (
    <div
      className="bf-panel"
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
    >
      {/* Tab buttons */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          padding: "8px 8px 0 8px",
          borderBottom: "1px solid #1f2533",
        }}
      >
        <button
          onClick={() => setActiveTab("status")}
          style={{
            padding: "8px 16px",
            background: activeTab === "status" ? "#1d2433" : "#151b28",
            color: "#e3e8f3",
            border: "1px solid #2a3242",
            borderBottom: activeTab === "status" ? "none" : "1px solid #2a3242",
            borderRadius: "6px 6px 0 0",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.88rem",
          }}
        >
          Status
        </button>
        <button
          onClick={() => setActiveTab("editor")}
          style={{
            padding: "8px 16px",
            background: activeTab === "editor" ? "#1d2433" : "#151b28",
            color: "#e3e8f3",
            border: "1px solid #2a3242",
            borderBottom: activeTab === "editor" ? "none" : "1px solid #2a3242",
            borderRadius: "6px 6px 0 0",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.88rem",
          }}
        >
          Widgets
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          style={{
            padding: "8px 16px",
            background: activeTab === "logs" ? "#1d2433" : "#151b28",
            color: "#e3e8f3",
            border: "1px solid #2a3242",
            borderBottom: activeTab === "logs" ? "none" : "1px solid #2a3242",
            borderRadius: "6px 6px 0 0",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.88rem",
          }}
        >
          Logs
        </button>
      </div>

      {/* Tab content */}
      <div
        className="bf-panel-body"
        style={{
          flex: 1,
          overflow: "hidden",
          padding: activeTab === "editor" ? "8px" : "0.5rem 0.6rem",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {activeTab === "status" && <StatusPanel />}
        {activeTab === "editor" && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "70fr 30fr",
              gap: "8px",
              flex: 1,
              minHeight: 0,
            }}
          >
            {/* Editor side (70%) - Shows editors or empty state */}
            {!selectedWidget ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#7e88a5",
                  fontSize: "0.9rem",
                  fontStyle: "italic",
                  border: "1px solid #1f2533",
                  borderRadius: "8px",
                  background: "#0a0e1a",
                }}
              >
                Select a widget from the file tree to edit
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  minHeight: 0,
                }}
              >
                {/* JavaScript Editor */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#a8c3ff",
                      fontWeight: 600,
                    }}
                  >
                    JavaScript{" "}
                    {isDirty && <span style={{ color: "#ff9f40" }}>●</span>}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      border: "1px solid #1f2533",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <MonacoEditor
                      language="javascript"
                      value={workingJs}
                      onChange={(v) => handleWorkingJsChange(v ?? "")}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "on",
                        wordWrap: "on",
                        automaticLayout: true,
                      }}
                    />
                  </div>
                </div>
                {/* CSS Editor */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "#a8c3ff",
                      fontWeight: 600,
                    }}
                  >
                    CSS {isDirty && <span style={{ color: "#ff9f40" }}>●</span>}
                  </div>
                  <div
                    style={{
                      flex: 1,
                      border: "1px solid #1f2533",
                      borderRadius: "8px",
                      overflow: "hidden",
                    }}
                  >
                    <MonacoEditor
                      language="css"
                      value={workingCss}
                      onChange={(v) => handleWorkingCssChange(v ?? "")}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "on",
                        wordWrap: "on",
                        automaticLayout: true,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Widget Manager side (30%) - ALWAYS visible */}
            {activeConfig && (
              <WidgetManager
                config={activeConfig}
                selectedWidget={selectedWidget}
                onSelectWidget={handleSelectWidget}
                onUpdateWidget={handleUpdateWidget}
                onNewWidget={handleNewWidget}
                onDeleteWidget={handleDeleteWidget}
                onExport={handleExport}
                onApply={applyOverlay}
                onSave={handleSaveWidget}
                onClear={clearOverlay}
                applied={applied}
                error={error}
                isDirty={isDirty}
              />
            )}
          </div>
        )}
        {activeTab === "logs" && (
          <div className="obs-card">
            <div className="obs-label">Event Logs</div>
            <div className="obs-strong">Logs content here</div>
          </div>
        )}
      </div>
    </div>
  );
}

function VideoFeed({ chips }: { chips: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<VideoStatus>("idle");

  useEffect(() => {
    setOverlayRoot(overlayRef.current);
    return () => setOverlayRoot(null);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateFromVideo = () => {
      const hasStream = !!video.srcObject;
      setStatus(hasStream ? "live" : "idle");
    };

    const handleLoaded = () => setStatus("live");
    const handleEmptied = () => setStatus("idle");
    const handleEnded = updateFromVideo;

    updateFromVideo();
    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("play", handleLoaded);
    video.addEventListener("emptied", handleEmptied);
    video.addEventListener("pause", handleEmptied);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("play", handleLoaded);
      video.removeEventListener("emptied", handleEmptied);
      video.removeEventListener("pause", handleEmptied);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  return (
    <div className="bf-video-shell">
      <video
        ref={videoRef}
        className="bf-video"
        autoPlay
        playsInline
        muted
        controls={false}
        data-obs-preview="true"
      />
      <div id="overlay-root" ref={overlayRef} className="bf-overlay-root" />
      {chips ? <div className="bf-video-overlay">{chips}</div> : null}
      <div className={`bf-video-fallback ${status === "live" ? "hidden" : ""}`}>
        <div className="bf-kv-label">OBS Preview</div>
        <div className="bf-kv-value">
          Use OBS VirtualCam/NDI to route program output here.
        </div>
        <div className="bf-kv-value subtle">Status: {status}</div>
      </div>
    </div>
  );
}

function VideoBindingControls() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [status, setStatus] = useState<VideoStatus>("idle");
  const [error, setError] = useState<string>("");
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const refresh = async () => {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const list = await navigator.mediaDevices.enumerateDevices();
      const vids = list.filter((d) => d.kind === "videoinput");
      setDevices(vids);
      if (!selected) {
        const obsCam = vids.find((d) => /obs|virtual/gi.test(d.label));
        setSelected(obsCam?.deviceId ?? vids[0]?.deviceId ?? "");
      }
    };
    void refresh();
    navigator.mediaDevices?.addEventListener("devicechange", refresh);
    return () =>
      navigator.mediaDevices?.removeEventListener("devicechange", refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStatus("idle");
    document
      .querySelectorAll<HTMLVideoElement>("video[data-obs-preview=true]")
      .forEach((el) => {
        el.srcObject = null;
      });
  };

  const bind = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("MediaDevices API not available");
      setStatus("error");
      return;
    }
    setStatus("binding");
    setError("");
    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: selected ? { deviceId: { exact: selected } } : true,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stop();
      streamRef.current = stream;
      setStatus("live");
      document
        .querySelectorAll<HTMLVideoElement>("video[data-obs-preview=true]")
        .forEach((el) => {
          el.srcObject = stream;
        });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  };

  return (
    <div className="obs-card">
      <div className="obs-card-row space-between">
        <div className="obs-label">Preview feed binding (VirtualCam/NDI)</div>
        <span className={`obs-chip ${status}`}>{status.toUpperCase()}</span>
      </div>
      <div className="obs-card-row tight">
        <select
          className="obs-input"
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
        >
          {devices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>
              {d.label || `Camera ${d.deviceId.slice(0, 6)}`}
            </option>
          ))}
          {!devices.length && <option value="">No cameras found</option>}
        </select>
        <button
          className="obs-btn"
          onClick={bind}
          disabled={status === "binding"}
        >
          {status === "live" ? "Rebind" : "Bind"}
        </button>
        <button
          className="obs-btn ghost"
          onClick={stop}
          disabled={status === "idle"}
        >
          Stop
        </button>
      </div>
      {error && <div className="obs-error">{error}</div>}
    </div>
  );
}

function PreviewPanel() {
  return (
    <div className="bf-panel bf-preview">
      <div className="bf-panel-body">
        <VideoFeed chips={null} />
      </div>
    </div>
  );
}

function ControlPanel() {
  return (
    <div className="bf-panel">
      <div className="bf-panel-body obs-stack">
        <ConnectionPanel />
        <ScenePanel />
        <SourcePanel />
        <VideoBindingControls />
      </div>
    </div>
  );
}

const ELEMENT_MAP: Record<ViewId, React.ReactElement> = {
  preview: <PreviewPanel />,
  control: <ControlPanel />,
  bottom: <BottomPanel />,
};

const TITLE_MAP: Record<ViewId, string> = {
  preview: "Preview",
  control: "Control",
  bottom: "Workspace",
};

export default function App() {
  const [currentNode, setCurrentNode] = useState<MosaicNode<ViewId> | null>({
    direction: "column" as const,
    first: {
      direction: "row" as const,
      first: "preview",
      second: "control",
      splitPercentage: 70,
    },
    second: "bottom",
    splitPercentage: 70,
  });

  return (
    <ObsProvider>
      <div className="bf-root">
        <Mosaic<ViewId>
          renderTile={(id, path) => (
            <MosaicWindow<ViewId> path={path} title={TITLE_MAP[id]}>
              {ELEMENT_MAP[id]}
            </MosaicWindow>
          )}
          value={currentNode}
          onChange={setCurrentNode}
        />
      </div>
    </ObsProvider>
  );
}
