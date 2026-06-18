import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    port: 5173,
  },
  build: {
    target: "esnext",
    sourcemap: true,
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
          { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          {
            src: "/icons/maskable.svg",
            sizes: "any",
            type: "image/svg+xml",
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
        ],
      },
    }),
  ],
});
