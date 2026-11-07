import { fileURLToPath, URL } from "node:url"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"

// The check page and the proof page are built from web/ into dist/,
// alongside the static pages and assets in public/. Wrangler serves dist/.
export default defineConfig({
  root: "web",
  publicDir: "../public",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./web/src", import.meta.url)) },
  },
  build: {
    outDir: "../dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./web/index.html", import.meta.url)),
        proof: fileURLToPath(new URL("./web/proof/index.html", import.meta.url)),
      },
    },
  },
  server: {
    proxy: { "/api": "http://127.0.0.1:8787", "/agent.json": "http://127.0.0.1:8787" },
  },
})
