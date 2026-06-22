import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { VitePWA } from "vite-plugin-pwa";

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    target: "esnext",
    sourcemap: false, // don't ship source maps publicly (re-enable as "hidden" once Sentry uploads them)
    rollupOptions: {
      // Multi-page: the game (index.html) + the character-cards tool embedded
      // inside the admin dashboard (cards.html).
      input: { main: r("./index.html"), cards: r("./cards.html") },
    },
  },
  plugins: [
    VitePWA({
      registerType: "prompt", // show an in-app "update" banner instead of silent auto-reload
      injectRegister: null, // we call registerSW() ourselves in main.ts
      manifest: {
        name: "Bombermeme",
        short_name: "Bombermeme",
        description: "Real-time Bomberman battles for memecoins.",
        display: "fullscreen",
        display_override: ["fullscreen", "standalone"],
        orientation: "landscape",
        background_color: "#0e1018",
        theme_color: "#0e1018",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          {
            src: "/icons/maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Precache the app shell only; big media is runtime-cached on demand.
        globPatterns: ["**/*.{js,css,html}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [
          /^\/(auth|deposit|withdraw|profile|leaderboard|bank|price|tables|watch|health|ws|tg|admin)\b/,
        ],
        runtimeCaching: [
          {
            urlPattern: /\/sprites\/.*\.(?:webp|png)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "sprites",
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: /\/sounds\/.*\.(?:mp3|ogg|wav)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "sounds",
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            // Background video + poster: cache so refreshes are instant (the
            // server sends no-cache, so without this it re-downloads every load).
            urlPattern: /\/bg\/.*\.(?:mp4|webm|webp)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "bg",
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 12, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
});
