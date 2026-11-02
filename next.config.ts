import type { NextConfig } from "next";

// Cabeceras de seguridad (SEG-03). La CSP va sin nonce: el nonce exige renderizado
// dinámico en todas las rutas (guía de Next
// 16, "Content Security Policy"). Por eso script-src lleva 'unsafe-inline': la CSP
// igual frena scripts y conexiones de otros orígenes.
const esDesarrollo = process.env.NODE_ENV === "development";

// Origen de Supabase. El WebSocket de Realtime
// usa el mismo host con wss:// (ws:// si la base es http, como en local).
function origenesSupabase(): string[] {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return [];
  try {
    const { origin, host, protocol } = new URL(url);
    return [origin, `${protocol === "https:" ? "wss" : "ws"}://${host}`];
  } catch {
    return [];
  }
}

const supabase = origenesSupabase();
const supabaseHttp = supabase.filter((o) => o.startsWith("http"));

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esDesarrollo ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data: ${supabaseHttp.join(" ")}`.trim(),
  `media-src 'self' blob: data: ${supabaseHttp.join(" ")}`.trim(),
  "font-src 'self' data:",
  `connect-src 'self' blob: data: ${supabase.join(" ")}${esDesarrollo ? " ws://localhost:* ws://127.0.0.1:*" : ""}`.trim(),
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
