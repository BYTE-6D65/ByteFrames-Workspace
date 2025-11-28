/**
 * Wails Database Adapter - New Clean Schema
 * Direct mapping to native Go backend
 */

import * as App from "../../wailsjs/go/main/App";
import type { Widget, OverlayConfig } from "../types/widget";
import { withTimeout } from "./timeout";

// Extended Widget type with config-specific properties
export interface WidgetWithState extends Widget {
  isMounted: boolean;
  zIndex: number;
}

// --- Configs ---

export async function getConfigs(): Promise<OverlayConfig[]> {
  try {
    console.log("[DB] Fetching configs...");
    const result = await withTimeout(App.GetConfigs(), 5000, "GetConfigs");
    console.log("[DB] GetConfigs raw result:", result);
    const configs = JSON.parse(result);

    if (configs.error) {
      console.error("[DB] GetConfigs error:", configs.error);
      throw new Error(configs.error);
    }

    console.log("[DB] Parsed configs:", configs);

    // Get widgets for each config
    const configsWithWidgets = await Promise.all(
      configs.map(async (config: any) => {
        console.log("[DB] Fetching widgets for config:", config.id);
        const widgets = await getWidgetsWithState(config.id);
        console.log("[DB] Got widgets for config:", config.id, widgets);
        return {
          id: config.id,
          name: config.name,
          widgets,
        };
      }),
    );

    console.log("[DB] Final configs with widgets:", configsWithWidgets);
    return configsWithWidgets;
  } catch (error) {
    console.error("[DB] getConfigs failed:", error);
    throw error;
  }
}

export async function createConfig(name: string): Promise<OverlayConfig> {
  const result = await App.CreateConfig(name);
  const config = JSON.parse(result);

  if (config.error) {
    throw new Error(config.error);
  }

  return {
    id: config.id,
    name: config.name,
    widgets: [],
  };
}

export async function setConfigActive(
  id: string,
  active: boolean,
): Promise<void> {
  const result = await App.SetConfigActive(id, active ? 1 : 0);
  const response = JSON.parse(result);

  if (response.error) {
    throw new Error(response.error);
  }
}

// --- Widgets ---

export async function getWidgetsWithState(
  configId: string,
): Promise<WidgetWithState[]> {
  try {
    console.log("[DB] getWidgetsWithState for config:", configId);
    const result = await withTimeout(
      App.GetConfigWidgets(configId),
      5000,
      "GetConfigWidgets",
    );
    console.log("[DB] GetConfigWidgets raw result:", result);
    const widgets = JSON.parse(result);

    if (widgets.error) {
      console.error("[DB] GetConfigWidgets error:", widgets.error);
      throw new Error(widgets.error);
    }

    console.log("[DB] Config widgets:", widgets);

    // Transform backend format to frontend format
    const widgetsWithState = widgets.map((w: any) => ({
      id: w.id,
      name: w.name,
      js: w.js_code,
      css: w.css_code,
      enabled: Boolean(w.enabled),
      isMounted: Boolean(w.is_mounted),
      zIndex: Number(w.z_index),
    }));

    console.log("[DB] Final widgets with state:", widgetsWithState);
    return widgetsWithState;
  } catch (error) {
    console.error("[DB] getWidgetsWithState failed:", error);
    throw error;
  }
}

export async function createWidget(
  configId: string,
  widget: Partial<Widget>,
): Promise<WidgetWithState> {
  // Create the widget first
  const result = await App.CreateWidget(
    widget.name || "New Widget",
    widget.js || "",
    widget.css || "",
  );
  const created = JSON.parse(result);

  if (created.error) {
    throw new Error(created.error);
  }

  // Add it to the config
  const linkResult = await App.AddWidgetToConfig(
    configId,
    created.id,
    widget.enabled ? 1 : 0,
    0, // default z-index
  );
  const linkResponse = JSON.parse(linkResult);

  if (linkResponse.error) {
    throw new Error(linkResponse.error);
  }

  return {
    id: created.id,
    name: created.name,
    js: created.js_code,
    css: created.css_code,
    enabled: Boolean(widget.enabled),
    isMounted: false,
    zIndex: 0,
  };
}

export async function updateWidget(
  id: string,
  updates: Partial<WidgetWithState>,
): Promise<void> {
  // Get current widget to preserve non-updated values
  const widgetsResult = await App.GetWidgets();
  const widgets = JSON.parse(widgetsResult);
  const currentWidget = widgets.find((w: any) => w.id === id);

  if (!currentWidget) {
    throw new Error(`Widget ${id} not found`);
  }

  const result = await App.UpdateWidget(
    id,
    updates.name ?? currentWidget.name,
    updates.js ?? currentWidget.js_code,
    updates.css ?? currentWidget.css_code,
  );
  const response = JSON.parse(result);

  if (response.error) {
    throw new Error(response.error);
  }
}

export async function deleteWidget(id: string): Promise<void> {
  const result = await App.DeleteWidget(id);
  const response = JSON.parse(result);

  if (response.error) {
    throw new Error(response.error);
  }
}

// --- Runtime State ---

export async function setWidgetMounted(
  id: string,
  isMounted: boolean,
): Promise<void> {
  const mountedAt = isMounted ? Date.now() : 0;
  const result = await App.SetWidgetMounted(id, isMounted ? 1 : 0, mountedAt);
  const response = JSON.parse(result);

  if (response.error) {
    throw new Error(response.error);
  }
}

// --- Settings (renamed from AppState) ---

export async function getAppState(key: string): Promise<string | null> {
  const result = await App.GetSetting(key);
  const response = JSON.parse(result);

  if (response.error) {
    throw new Error(response.error);
  }

  // Empty object means no value found
  if (!response.value) {
    return null;
  }

  return response.value;
}

export async function setAppState(key: string, value: string): Promise<void> {
  const result = await App.SetSetting(key, value);
  const response = JSON.parse(result);

  if (response.error) {
    throw new Error(response.error);
  }
}

// --- Schema & Migration ---

export async function initSchema(): Promise<void> {
  // Schema is initialized by the Go backend on startup
  return Promise.resolve();
}

export async function migrateFromLocalStorage(
  _oldConfigs: OverlayConfig[],
): Promise<void> {
  // Migration not needed in new schema
  return Promise.resolve();
}

export async function createDefaultConfigInDb(): Promise<OverlayConfig> {
  // Default config is created automatically by Go backend
  // Just fetch the configs
  const configs = await getConfigs();
  return configs[0] || createConfig("Default Scene");
}

export async function resetToDefault(): Promise<void> {
  console.warn("resetToDefault not implemented in Wails backend");
}
