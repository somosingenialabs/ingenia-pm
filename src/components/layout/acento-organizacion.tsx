"use client";

import { useEffect } from "react";
import { textoSobre } from "@/lib/color";

/**
 * Aplica el color de acento que eligió la empresa a toda la página (también a lo que se
 * abre en un portal: hojas, menús, diálogos) y calcula un color de texto legible encima.
 * Sin color, queda el azul por defecto de globals.css.
 */
export function AcentoOrganizacion({ color }: { color: string | null }) {
  useEffect(() => {
    if (!color || !/^#[0-9a-fA-F]{6}$/.test(color)) return;
    const raiz = document.documentElement;
    raiz.style.setProperty("--acento", color);
    raiz.style.setProperty("--primary-foreground", textoSobre(color));
    raiz.style.setProperty("--sidebar-primary-foreground", textoSobre(color));
    return () => {
      raiz.style.removeProperty("--acento");
      raiz.style.removeProperty("--primary-foreground");
      raiz.style.removeProperty("--sidebar-primary-foreground");
    };
  }, [color]);
  return null;
}
