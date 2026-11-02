"use client";

import { useEffect } from "react";

// Último recurso: falla el layout raíz. Reemplaza al documento entero, así que lleva sus
// propios <html>, <body> y estilos en línea (no llegan los globales).
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="es-AR">
      <body
        style={{
          margin: 0,
          minHeight: "100svh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f2f2f7",
          color: "#000",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          textAlign: "center",
          padding: 16,
        }}
      >
        <main role="alert" style={{ maxWidth: 360, display: "flex", flexDirection: "column", gap: 12 }}>
          <h1 style={{ fontSize: 22, margin: 0 }}>Algo salió mal</h1>
          <p style={{ margin: 0, color: "#6c6c70", lineHeight: 1.5 }}>
            La aplicación no pudo cargar. Probá de nuevo en unos segundos.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 44,
              marginTop: 8,
              border: 0,
              borderRadius: 10,
              background: "#0062cc",
              color: "#fff",
              fontSize: 17,
              fontWeight: 600,
            }}
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
