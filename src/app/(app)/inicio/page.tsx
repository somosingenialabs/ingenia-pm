import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FolderKanban } from "lucide-react";
import { EstadoVacio } from "@/components/estado/estado-vacio";
import { PageHeader } from "@/components/layout/page-header";
import { obtenerUsuario } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Inicio" };

export default async function InicioPage() {
  const usuario = await obtenerUsuario();
  if (!usuario) redirect("/ingresar");
  return (
    <>
      <PageHeader titulo="Inicio" descripcion={`Hola, ${usuario.email}`} />
      <EstadoVacio
        icono={<FolderKanban />}
        titulo="Todavía no hay nada para mostrar"
        texto="Cuando tengas proyectos y tareas, los vas a ver acá."
        className="rounded-xl border bg-card"
      />
    </>
  );
}
