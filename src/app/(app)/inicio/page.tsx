import type { Metadata } from "next";
import { FolderKanban } from "lucide-react";
import { EstadoVacio } from "@/components/estado/estado-vacio";
import { PageHeader } from "@/components/layout/page-header";
import { obtenerContexto } from "@/lib/auth/contexto";
import { NOMBRE_ROL } from "@/lib/auth/permisos";

export const metadata: Metadata = { title: "Inicio" };

export default async function InicioPage() {
  const { usuario, organizacion, rol } = await obtenerContexto();
  return (
    <>
      <PageHeader titulo={`Hola, ${usuario.nombre}`} descripcion={`${organizacion.nombre} · ${NOMBRE_ROL[rol]}`} />
      <EstadoVacio
        icono={<FolderKanban />}
        titulo="Todavía no hay nada para mostrar"
        texto="Cuando tengas proyectos y tareas, los vas a ver acá."
        className="rounded-xl border bg-card"
      />
    </>
  );
}
