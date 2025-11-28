package main

import (
	"byteframes/internal/db"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"time"
)

// App struct
type App struct {
	ctx context.Context
	db  *sql.DB
}

// JSON structs for marshalling
type Widget struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	JSCode    string `json:"js_code"`
	CSSCode   string `json:"css_code"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

type Config struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	IsActive  int64  `json:"is_active"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`
}

type ConfigWidget struct {
	ConfigID  string `json:"config_id"`
	WidgetID  string `json:"widget_id"`
	Enabled   int64  `json:"enabled"`
	ZIndex    int64  `json:"z_index"`
	PositionX int64  `json:"position_x"`
	PositionY int64  `json:"position_y"`
}

type WidgetWithConfig struct {
	Widget
	Enabled   int64 `json:"enabled"`
	ZIndex    int64 `json:"z_index"`
	PositionX int64 `json:"position_x"`
	PositionY int64 `json:"position_y"`
	IsMounted int64 `json:"is_mounted"`
}

type WidgetRuntime struct {
	WidgetID  string `json:"widget_id"`
	IsMounted int64  `json:"is_mounted"`
	MountedAt int64  `json:"mounted_at"`
}

type Setting struct {
	Key       string `json:"key"`
	Value     string `json:"value"`
	UpdatedAt int64  `json:"updated_at"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	database, err := db.Open("byteframes.db")
	if err != nil {
		log.Fatal("DB open error:", err)
	}

	if err := db.Init(database); err != nil {
		log.Fatal("DB init error:", err)
	}

	a.db = database

	// Create default config if database is empty
	a.ensureDefaultConfig()
}

// ensureDefaultConfig creates a default config with a clock widget if none exist
func (a *App) ensureDefaultConfig() {
	row := a.db.QueryRow(`SELECT COUNT(*) FROM configs`)
	var count int
	if err := row.Scan(&count); err != nil {
		log.Println("Error checking configs:", err)
		return
	}

	if count == 0 {
		now := time.Now().Unix()
		configID := fmt.Sprintf("cfg_%d", now)
		widgetID := fmt.Sprintf("wid_%d", now)

		// Create default config
		_, err := a.db.Exec(`INSERT INTO configs (id, name, is_active, created_at, updated_at) VALUES (?, ?, 1, ?, ?)`,
			configID, "Default Scene", now, now)
		if err != nil {
			log.Println("Error creating default config:", err)
			return
		}

		// Create default clock widget
		defaultJS := `export default function Widget(ctx) {
  let raf = 0
  return {
    mount(el) {
      const span = document.createElement('div')
      span.className = 'widget-element'
      el.appendChild(span)
      const tick = () => {
        const now = new Date()
        span.textContent = now.toLocaleTimeString()
        raf = requestAnimationFrame(tick)
      }
      tick()
    },
    unmount() {
      cancelAnimationFrame(raf)
    }
  }
}`

		defaultCSS := `.widget-element {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 8px 12px;
  border-radius: 10px;
  background: rgba(0,0,0,0.55);
  color: #e5ecff;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: 16px;
  pointer-events: none;
}`

		_, err = a.db.Exec(`INSERT INTO widgets (id, name, js_code, css_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
			widgetID, "Clock Widget", defaultJS, defaultCSS, now, now)
		if err != nil {
			log.Println("Error creating default widget:", err)
			return
		}

		// Add widget to config
		_, err = a.db.Exec(`INSERT INTO config_widgets (config_id, widget_id, enabled, z_index) VALUES (?, ?, 1, 0)`,
			configID, widgetID)
		if err != nil {
			log.Println("Error linking widget to config:", err)
			return
		}

		// Initialize widget runtime
		_, err = a.db.Exec(`INSERT INTO widget_runtime (widget_id, is_mounted) VALUES (?, 0)`, widgetID)
		if err != nil {
			log.Println("Error creating widget runtime:", err)
		}

		log.Println("Created default config and clock widget")
	}
}

// Greet returns a greeting for the given name
func (a *App) Greet(name string) string {
	return fmt.Sprintf("Hello %s, It's show time!", name)
}

// ===== Configs =====

func (a *App) GetConfigs() string {
	rows, err := a.db.Query(`SELECT id, name, is_active, created_at, updated_at FROM configs ORDER BY created_at DESC`)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	defer rows.Close()

	configs := make([]Config, 0)
	for rows.Next() {
		var c Config
		if err := rows.Scan(&c.ID, &c.Name, &c.IsActive, &c.CreatedAt, &c.UpdatedAt); err != nil {
			continue
		}
		configs = append(configs, c)
	}
	bs, _ := json.Marshal(configs)
	return string(bs)
}

func (a *App) CreateConfig(name string) string {
	now := time.Now().Unix()
	id := fmt.Sprintf("cfg_%d", time.Now().UnixNano())
	_, err := a.db.Exec(`INSERT INTO configs (id, name, is_active, created_at, updated_at) VALUES (?, ?, 0, ?, ?)`,
		id, name, now, now)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	c := Config{
		ID:        id,
		Name:      name,
		IsActive:  0,
		CreatedAt: now,
		UpdatedAt: now,
	}
	bs, _ := json.Marshal(c)
	return string(bs)
}

func (a *App) SetConfigActive(id string, active int64) string {
	now := time.Now().Unix()
	// First, deactivate all configs
	if active == 1 {
		a.db.Exec(`UPDATE configs SET is_active = 0`)
	}
	// Then activate the requested one
	_, err := a.db.Exec(`UPDATE configs SET is_active = ?, updated_at = ? WHERE id = ?`, active, now, id)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return `{"success": true}`
}

// ===== Widgets =====

func (a *App) GetWidgets() string {
	rows, err := a.db.Query(`SELECT id, name, js_code, css_code, created_at, updated_at FROM widgets ORDER BY created_at DESC`)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	defer rows.Close()

	widgets := make([]Widget, 0)
	for rows.Next() {
		var w Widget
		if err := rows.Scan(&w.ID, &w.Name, &w.JSCode, &w.CSSCode, &w.CreatedAt, &w.UpdatedAt); err != nil {
			continue
		}
		widgets = append(widgets, w)
	}
	bs, _ := json.Marshal(widgets)
	return string(bs)
}

func (a *App) GetConfigWidgets(configID string) string {
	query := `
		SELECT
			w.id, w.name, w.js_code, w.css_code, w.created_at, w.updated_at,
			cw.enabled, cw.z_index, cw.position_x, cw.position_y,
			COALESCE(wr.is_mounted, 0) as is_mounted
		FROM widgets w
		INNER JOIN config_widgets cw ON w.id = cw.widget_id
		LEFT JOIN widget_runtime wr ON w.id = wr.widget_id
		WHERE cw.config_id = ?
		ORDER BY cw.z_index ASC, w.created_at ASC
	`
	rows, err := a.db.Query(query, configID)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	defer rows.Close()

	widgets := make([]WidgetWithConfig, 0)
	for rows.Next() {
		var w WidgetWithConfig
		if err := rows.Scan(&w.ID, &w.Name, &w.JSCode, &w.CSSCode, &w.CreatedAt, &w.UpdatedAt,
			&w.Enabled, &w.ZIndex, &w.PositionX, &w.PositionY, &w.IsMounted); err != nil {
			continue
		}
		widgets = append(widgets, w)
	}
	bs, _ := json.Marshal(widgets)
	return string(bs)
}

func (a *App) CreateWidget(name, jsCode, cssCode string) string {
	now := time.Now().Unix()
	id := fmt.Sprintf("wid_%d", time.Now().UnixNano())
	_, err := a.db.Exec(`INSERT INTO widgets (id, name, js_code, css_code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		id, name, jsCode, cssCode, now, now)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}

	// Initialize runtime state
	a.db.Exec(`INSERT INTO widget_runtime (widget_id, is_mounted) VALUES (?, 0)`, id)

	w := Widget{
		ID:        id,
		Name:      name,
		JSCode:    jsCode,
		CSSCode:   cssCode,
		CreatedAt: now,
		UpdatedAt: now,
	}
	bs, _ := json.Marshal(w)
	return string(bs)
}

func (a *App) UpdateWidget(id, name, jsCode, cssCode string) string {
	now := time.Now().Unix()
	_, err := a.db.Exec(`UPDATE widgets SET name = ?, js_code = ?, css_code = ?, updated_at = ? WHERE id = ?`,
		name, jsCode, cssCode, now, id)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return `{"success": true}`
}

func (a *App) DeleteWidget(id string) string {
	_, err := a.db.Exec(`DELETE FROM widgets WHERE id = ?`, id)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return `{"success": true}`
}

// ===== Config <-> Widget Links =====

func (a *App) AddWidgetToConfig(configID, widgetID string, enabled, zIndex int64) string {
	_, err := a.db.Exec(`INSERT OR REPLACE INTO config_widgets (config_id, widget_id, enabled, z_index) VALUES (?, ?, ?, ?)`,
		configID, widgetID, enabled, zIndex)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return `{"success": true}`
}

func (a *App) RemoveWidgetFromConfig(configID, widgetID string) string {
	_, err := a.db.Exec(`DELETE FROM config_widgets WHERE config_id = ? AND widget_id = ?`, configID, widgetID)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return `{"success": true}`
}

func (a *App) UpdateConfigWidget(configID, widgetID string, enabled, zIndex int64) string {
	_, err := a.db.Exec(`UPDATE config_widgets SET enabled = ?, z_index = ? WHERE config_id = ? AND widget_id = ?`,
		enabled, zIndex, configID, widgetID)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return `{"success": true}`
}

// ===== Widget Runtime =====

func (a *App) GetWidgetRuntime(widgetID string) string {
	row := a.db.QueryRow(`SELECT widget_id, is_mounted, mounted_at FROM widget_runtime WHERE widget_id = ?`, widgetID)
	var wr WidgetRuntime
	err := row.Scan(&wr.WidgetID, &wr.IsMounted, &wr.MountedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return `{"widget_id": "", "is_mounted": 0, "mounted_at": 0}`
		}
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	bs, _ := json.Marshal(wr)
	return string(bs)
}

func (a *App) SetWidgetMounted(widgetID string, isMounted int64, mountedAt int64) string {
	_, err := a.db.Exec(`INSERT OR REPLACE INTO widget_runtime (widget_id, is_mounted, mounted_at) VALUES (?, ?, ?)`,
		widgetID, isMounted, mountedAt)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return `{"success": true}`
}

// ===== Settings =====

func (a *App) GetSetting(key string) string {
	row := a.db.QueryRow(`SELECT value, updated_at FROM settings WHERE key = ?`, key)
	var value string
	var updatedAt int64
	err := row.Scan(&value, &updatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return `{}`
		}
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	s := Setting{
		Key:       key,
		Value:     value,
		UpdatedAt: updatedAt,
	}
	bs, _ := json.Marshal(s)
	return string(bs)
}

func (a *App) SetSetting(key string, value string) string {
	now := time.Now().Unix()
	_, err := a.db.Exec(`INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)`, key, value, now)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	return `{"success": true}`
}

func (a *App) GetAllSettings() string {
	rows, err := a.db.Query(`SELECT key, value, updated_at FROM settings`)
	if err != nil {
		return fmt.Sprintf(`{"error": "%s"}`, err.Error())
	}
	defer rows.Close()

	settings := make([]Setting, 0)
	for rows.Next() {
		var s Setting
		if err := rows.Scan(&s.Key, &s.Value, &s.UpdatedAt); err != nil {
			continue
		}
		settings = append(settings, s)
	}
	bs, _ := json.Marshal(settings)
	return string(bs)
}
