import { defineConfig } from "vite";
export default defineConfig({
  base: "/enishi/",
  build: {
    outDir: "../server/src/main/resources/static/enishi",
    emptyOutDir: true,
  },
  server: { proxy: { "/api": "http://127.0.0.1:8085" } },
});
