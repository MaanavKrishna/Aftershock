import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Aftershock",
    short_name: "Aftershock",
    description: "Every incident becomes a test. Git history proves it.",
    start_url: "/overview",
    display: "standalone",
    background_color: "#0A0E14",
    theme_color: "#0A0E14",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
