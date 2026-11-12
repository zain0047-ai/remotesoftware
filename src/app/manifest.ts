import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ClarityTrack",
    short_name: "ClarityTrack",
    description:
      "Installable WFH employee tracker — sessions, tasks, meetings, and company portals.",
    start_url: "/install",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f7faf8",
    theme_color: "#0f6b5c",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
