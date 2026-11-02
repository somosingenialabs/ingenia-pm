import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ListaMisTareas } from "@/components/tareas/lista-mis-tareas";
import { obtenerContexto } from "@/lib/auth/contexto";
import { listarMisTareas } from "@/lib/data/tareas/consultas";
import { hoyEnZona } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mis tareas" };

export default async function MisTareasPage() {
  const { usuario, organizacion } = await obtenerContexto();
  const db = await crearClienteServidor();
  const tareas = await listarMisTareas(db, usuario.id);

  return (
    <>
      <PageHeader titulo="Mis tareas" descripcion="Lo abierto a tu nombre, por fecha límite." />
      <ListaMisTareas tareas={tareas} hoy={hoyEnZona(organizacion.zonaHoraria)} />
    </>
  );
}
