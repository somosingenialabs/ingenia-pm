import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { obtenerContexto } from "@/lib/auth/contexto";

// Marco de todas las pantallas con sesión y empresa activa (el grupo "(app)" no aparece en la URL).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const contexto = await obtenerContexto();
  return <AppShell contexto={contexto}>{children}</AppShell>;
}
