import type { Metadata } from "next";
import { GrillaCarga } from "@/components/carga/grilla-carga";
import { PageHeader } from "@/components/layout/page-header";
import { obtenerContexto } from "@/lib/auth/contexto";
import { veMetricasDeEquipo } from "@/lib/auth/permisos";
import { obtenerCarga } from "@/lib/data/carga/consultas";
import { lunesDe } from "@/lib/data/carga/reglas";
import { esFechaDeBase, hoyEnZona } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { idValido } from "@/lib/validaciones/comun";

export const metadata: Metadata = { title: "Carga" };

export default async function CargaPage({ searchParams }: { searchParams: Promise<{ desde?: string; proyecto?: string }> }) {
  const parametros = await searchParams;
  const { organizacion, rol } = await obtenerContexto();
  const db = await crearClienteServidor();

  // Semanas con lunes en la zona de la empresa. Un ?desde= raro vuelve a esta semana.
  const hoy = hoyEnZona(organizacion.zonaHoraria);
  const lunesActual = lunesDe(hoy);
  const desde = parametros.desde && esFechaDeBase(parametros.desde) ? lunesDe(parametros.desde) : lunesActual;
  const proyectoId = parametros.proyecto && idValido.safeParse(parametros.proyecto).success ? parametros.proyecto : null;

  const [carga, proyectos] = await Promise.all([
    obtenerCarga(db, { organizacionId: organizacion.id, desde, proyectoId }),
    db.from("proyectos").select("id, nombre").is("eliminado_en", null).not("estado", "in", "(terminado,cancelado)").order("nombre"),
  ]);
  if (proyectos.error) throw proyectos.error;

  return (
    <>
      <PageHeader
        titulo="Carga"
        descripcion={
          veMetricasDeEquipo(rol)
            ? "Horas asignadas a cada persona por semana, contra su capacidad."
            : "Tus horas asignadas por semana, contra tu capacidad."
        }
      />
      <GrillaCarga
        carga={carga}
        proyectos={proyectos.data.map((p) => ({ id: p.id, nombre: p.nombre }))}
        proyectoId={proyectoId}
        lunesActual={lunesActual}
        hoy={hoy}
      />
    </>
  );
}
