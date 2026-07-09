import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  define: {
    global: "globalThis",
  },
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        // Split large third-party libraries into separate, independently-cacheable
        // chunks. Charts (Recharts/d3) and maps (Leaflet) load only with the pages
        // that use them; React core is cached across deploys since it rarely changes.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("recharts") || id.includes("/d3-") || id.includes("victory-vendor")) {
            return "charts";
          }
          if (id.includes("leaflet")) return "maps";
          if (id.includes("@stomp") || id.includes("sockjs")) return "realtime";
          // Keep the whole React ecosystem (incl. router + its history dep) in one
          // chunk so it never forms a dependency cycle with the generic vendor chunk.
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("react-router") ||
            id.includes("@remix-run") ||
            id.includes("/history/") ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor";
          }
          return "vendor";
        },
      },
    },
  },
});
