/**
 * Test backend connectivity
 * Run this in browser console: window.testBackend()
 */

import * as App from "../../wailsjs/go/main/App";

export async function testBackend() {
  console.log("=== Testing Backend Connectivity ===");

  try {
    console.log("1. Testing Greet...");
    const greet = await App.Greet("Test");
    console.log("   Greet result:", greet);

    console.log("2. Testing GetConfigs...");
    const configsRaw = await App.GetConfigs();
    console.log("   GetConfigs raw:", configsRaw);
    const configs = JSON.parse(configsRaw);
    console.log("   GetConfigs parsed:", configs);

    console.log("3. Testing GetWidgets...");
    const widgetsRaw = await App.GetWidgets();
    console.log("   GetWidgets raw:", widgetsRaw);
    const widgets = JSON.parse(widgetsRaw);
    console.log("   GetWidgets parsed:", widgets);

    if (widgets.length > 0) {
      console.log("4. Testing GetWidgetRuntime for first widget...");
      const runtimeRaw = await App.GetWidgetRuntime(widgets[0].id);
      console.log("   GetWidgetRuntime raw:", runtimeRaw);
      const runtime = JSON.parse(runtimeRaw);
      console.log("   GetWidgetRuntime parsed:", runtime);
    }

    console.log("5. Testing GetSetting...");
    const stateRaw = await App.GetSetting("testKey");
    console.log("   GetSetting raw:", stateRaw);
    const state = JSON.parse(stateRaw);
    console.log("   GetSetting parsed:", state);

    console.log("=== All backend tests passed! ===");
  } catch (error) {
    console.error("=== Backend test failed ===", error);
  }
}

// Expose to window for manual testing
if (typeof window !== "undefined") {
  (window as any).testBackend = testBackend;
}
