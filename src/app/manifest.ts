// app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/?source=pwa",                // identificatore stabile dell'app
    lang: "it-IT",
    dir: "ltr",
    name: "Ore App",
    short_name: "Ore",
    description: "Registra ore, progetti e report.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone"],
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0ea5e9",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ],
    shortcuts: [
      {
        name: "Nuova registrazione",
        short_name: "Nuovo",
        url: "/time/new?source=shortcut",
        description: "Crea una nuova registrazione ore"
      },
      {
        name: "Report",
        short_name: "Report",
        url: "/report?range=this-week&source=shortcut",
        description: "Apri i report della settimana"
      }
    ],
    categories: ["productivity", "business"],
    prefer_related_applications: false
    // screenshots: [ // facoltativo, se hai immagini in /public/screenshots
    //   { src: "/screenshots/home-1080x1920.png", sizes: "1080x1920", type: "image/png", form_factor: "narrow" },
    //   { src: "/screenshots/report-1920x1080.png", sizes: "1920x1080", type: "image/png", form_factor: "wide" }
    // ]
  };
}
