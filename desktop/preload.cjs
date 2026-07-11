/**
 * Preload keeps the renderer sandboxed; expose a tiny read-only bridge if needed later.
 */
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("gatestageDesktop", {
  isDesktop: true,
});
