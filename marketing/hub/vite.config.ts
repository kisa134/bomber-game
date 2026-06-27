import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// Served as a sub-app of the admin dashboard at /admin/marketing/ (HashRouter
// handles the in-app routes). Built in isolation — this folder is intentionally
// OUTSIDE the pnpm workspace, so a marketing build can never break the main
// game deploy; its dist is served statically by the game server.
export default defineConfig({
  base: "/admin/marketing/",
  plugins: [react()],
  server: { port: 3000 },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
})
