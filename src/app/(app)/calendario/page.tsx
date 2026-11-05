import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { obtenerContexto } from "@/lib/auth/contexto";
import { listarOpcionesCalendario } from "@/lib/data/calendario/consultas";
import { hoyEnZona } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { CargadorCalendario } from "./cargador-calendario";

export const metadata: Metadata = { title: "Calendario" };

export default async function CalendarioPage() {
  const { usuario, organizacion, rol } = await obtenerContexto();
  const db = await crearClienteServidor();
  const opciones = await listarOpcionesCalendario(db, { organizacionId: organizacion.id, usuarioId: usuario.id, rol });

  return (
    <>
      <PageHeader titulo="Calendario" descripcion="Plazos de las tareas y objetivos de los proyectos." />
      <CargadorCalendario {...opciones} usuarioId={usuario.id} hoy={hoyEnZona(organizacion.zonaHoraria)} />
    </>
  );
}
