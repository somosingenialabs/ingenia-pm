import type { MetadataRoute } from "next";

// Ficha de la app instalable (PWA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/inicio",
    name: "Ingenia PM",
    short_name: "Ingenia PM",
    description: "Proyectos, tareas, calendario, horas y métricas.",
    lang: "es-AR",
    start_url: "/inicio",
    scope: "/",
    display: "standalone",
    background_color: "#f2f2f7",
    theme_color: "#f2f2f7",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
