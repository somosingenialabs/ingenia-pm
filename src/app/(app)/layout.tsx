import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { obtenerUsuario } from "@/lib/auth/sesion";

// Marco de todas las pantallas con sesión (el grupo "(app)" no aparece en la URL).
export default async function AppLayout({ children }: { children: ReactNode }) {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/ingresar");
  return <AppShell email={usuario.email ?? ""}>{children}</AppShell>;
}
