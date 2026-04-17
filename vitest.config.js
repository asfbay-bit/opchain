import { defineConfig } from "vitest/config";

export default defineConfig({
  // Replace the build-time version identifier so `src/index.js` imports cleanly.
  define: {
    __OPCHAIN_VERSION__: JSON.stringify("test"),
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.js", "tests/**/*.test.mjs"],
    // The Worker relies on `crypto.subtle` which is available in Node 20+.
    // No additional environment shim needed.
  },
});
