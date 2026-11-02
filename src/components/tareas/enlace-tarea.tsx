"use client";

import type { MouseEvent, ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/** La URL actual con un parámetro cambiado. Null lo saca. */
export function useUrlCon() {
  const pathname = usePathname();
  const parametros = useSearchParams();
  return (cambios: Record<string, string | null>) => {
    const nuevos = new URLSearchParams(parametros.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null) nuevos.delete(clave);
      else nuevos.set(clave, valor);
    }
    const texto = nuevos.toString();
    return texto ? `${pathname}?${texto}` : pathname;
  };
}

/**
 * Cambia la URL sin volver a pedirle la pantalla al servidor. Next lo sincroniza con
 * useSearchParams, y queda en el historial: "atrás" funciona y el enlace se puede compartir.
 */
export function navegarSinRecargar(url: string) {
  window.history.pushState(null, "", url);
}

/** Abre el detalle (`?tarea=<id>`) sobre la pantalla actual, sea cual sea. */
export function EnlaceTarea({ id, className, children, etiqueta }: { id: string; className?: string; children: ReactNode; etiqueta?: string }) {
  const urlCon = useUrlCon();
  const href = urlCon({ tarea: id });

  function alTocar(e: MouseEvent<HTMLAnchorElement>) {
    // Ctrl+clic y compañía siguen abriendo otra pestaña.
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navegarSinRecargar(href);
  }

  return (
    <a href={href} onClick={alTocar} className={className} aria-label={etiqueta}>
      {children}
    </a>
  );
}
