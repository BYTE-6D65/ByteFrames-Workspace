type OverlayInstance = {
  mount: (el: HTMLElement) => void;
  unmount?: () => void;
};

function toCommonJS(source: string) {
  if (/export\s+default/.test(source)) {
    return source.replace(/export\s+default/, "module.exports =");
  }
  return source;
}

export function createOverlayRuntime(root: HTMLElement) {
  let shadow = root.shadowRoot ?? root.attachShadow({ mode: "open" });
  let styleEl = shadow.querySelector(
    "style[data-overlay-style]",
  ) as HTMLStyleElement | null;
  let mountHost = shadow.querySelector(
    ".bf-overlay-surface",
  ) as HTMLElement | null;
  let currentContainer: HTMLElement | null = null;
  let currentInstance: OverlayInstance | null = null;

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.dataset.overlayStyle = "true";
    styleEl.textContent = `
      :host {
        position: absolute;
        inset: 0;
        display: block;
        pointer-events: none;
      }
      .bf-overlay-surface {
        position: absolute;
        inset: 0;
        pointer-events: none;
      }
      .bf-overlay-layer {
        position: absolute;
        inset: 0;
        pointer-events: none;
        box-sizing: border-box;
      }
    `;
    shadow.appendChild(styleEl);
  }

  if (!mountHost) {
    mountHost = document.createElement("div");
    mountHost.className = "bf-overlay-surface";
    shadow.appendChild(mountHost);
  }

  function compile(jsCode: string) {
    try {
      const source = toCommonJS(jsCode);
      const exports: any = {};
      const module: any = { exports };

      const fn = new Function(
        "exports",
        "module",
        "ctx",
        `${source}\nreturn module.exports ?? exports;`,
      );
      const factory = fn(exports, module, { host: mountHost });

      console.log("[Runtime] Factory result:", factory);
      console.log("[Runtime] Factory type:", typeof factory);

      let instance: OverlayInstance | null = null;

      if (typeof factory === "function") {
        // If it's a function, call it with context
        instance = factory({ host: mountHost });
        console.log("[Runtime] Instance from function:", instance);
      } else if (factory && typeof factory === "object") {
        // If it's already an object with mount/unmount, use it directly
        instance = factory;
        console.log("[Runtime] Instance is object:", instance);
      }

      if (!instance) {
        console.error("[Runtime] No instance created, factory was:", factory);
        throw new Error("Widget must export a default function or object");
      }

      if (typeof instance.mount !== "function") {
        console.error("[Runtime] Instance missing mount function:", instance);
        throw new Error(
          "Overlay must export default function returning { mount, unmount }",
        );
      }

      return instance;
    } catch (error) {
      console.error("[Runtime] Compile error:", error);
      console.error("[Runtime] JS Code:", jsCode);
      throw error;
    }
  }

  function apply(jsCode: string, cssCode: string) {
    destroyCurrent();
    // CSS scoped to shadow root
    let userStyle = shadow.querySelector(
      "style[data-overlay-user]",
    ) as HTMLStyleElement | null;
    if (!userStyle) {
      userStyle = document.createElement("style");
      userStyle.dataset.overlayUser = "true";
      shadow.appendChild(userStyle);
    }
    userStyle.textContent = cssCode;

    currentContainer = document.createElement("div");
    currentContainer.className = "bf-overlay-layer";
    mountHost!.appendChild(currentContainer);

    currentInstance = compile(jsCode);
    currentInstance.mount(currentContainer);
  }

  function destroyCurrent() {
    if (currentInstance?.unmount) {
      try {
        currentInstance.unmount();
      } catch (err) {
        console.warn("Overlay unmount error", err);
      }
    }
    currentInstance = null;
    if (currentContainer) {
      currentContainer.remove();
      currentContainer = null;
    }
  }

  function destroy() {
    destroyCurrent();
    const userStyle = shadow.querySelector("style[data-overlay-user]");
    userStyle?.remove();
    // keep base style and surface
  }

  return {
    apply,
    destroy,
  };
}
