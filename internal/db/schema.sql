-- BYTE Frames Database Schema
-- Clean schema designed for Wails native app

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Overlay configurations (presets/scenes)
CREATE TABLE IF NOT EXISTS configs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Widgets (reusable overlay components)
CREATE TABLE IF NOT EXISTS widgets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    js_code TEXT NOT NULL DEFAULT '',
    css_code TEXT NOT NULL DEFAULT '',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- Junction table: which widgets belong to which configs
CREATE TABLE IF NOT EXISTS config_widgets (
    config_id TEXT NOT NULL,
    widget_id TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    z_index INTEGER DEFAULT 0,
    position_x INTEGER DEFAULT 0,
    position_y INTEGER DEFAULT 0,
    PRIMARY KEY (config_id, widget_id),
    FOREIGN KEY (config_id) REFERENCES configs(id) ON DELETE CASCADE,
    FOREIGN KEY (widget_id) REFERENCES widgets(id) ON DELETE CASCADE
);

-- Widget runtime state (transient, not persisted long-term)
CREATE TABLE IF NOT EXISTS widget_runtime (
    widget_id TEXT PRIMARY KEY,
    is_mounted INTEGER DEFAULT 0,
    mounted_at INTEGER,
    FOREIGN KEY (widget_id) REFERENCES widgets(id) ON DELETE CASCADE
);

-- Application settings (key-value store)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at INTEGER NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_config_widgets_config ON config_widgets(config_id);
CREATE INDEX IF NOT EXISTS idx_config_widgets_widget ON config_widgets(widget_id);
CREATE INDEX IF NOT EXISTS idx_configs_active ON configs(is_active);
