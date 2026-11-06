import type { Metadata } from "next";
import { FiltrosAnalitica } from "@/components/analitica/filtros-analitica";
import { TarjetasAnalitica } from "@/components/analitica/tarjetas-analitica";
import { PageHeader } from "@/components/layout/page-header";
import { obtenerContexto } from "@/lib/auth/contexto";
import { veMetricasDeEquipo } from "@/lib/auth/permisos";
import { obtenerAnalitica } from "@/lib/data/analitica/consultas";
import { resolverPeriodo, textoPeriodo } from "@/lib/data/analitica/reglas";
import { listarMiembros } from "@/lib/data/miembros/consultas";
import { hoyEnZona } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { idValido } from "@/lib/validaciones/comun";

export const metadata: Metadata = { title: "Analítica" };

type Parametros = { periodo?: string; desde?: string; hasta?: string; proyecto?: string; persona?: string };

/**
 * Analítica: dónde se traba el trabajo, quién está sobrecargado y qué tan bien estimamos.
 * Filtros en la URL. Admin y PM ven al equipo; el colaborador, solo lo suyo y sin filtro de
 * persona (la base igual se lo fuerza: un ?persona= ajeno no le cambia nada).
 */
export default async function AnaliticaPage({ searchParams }: { searchParams: Promise<Parametros> }) {
  const parametros = await searchParams;
  const { organizacion, rol } = await obtenerContexto();
  const db = await crearClienteServidor();
  const veEquipo = veMetricasDeEquipo(rol);

  const hoy = hoyEnZona(organizacion.zonaHoraria);
  const periodo = resolverPeriodo(parametros, hoy);
  const valido = (id?: string) => (id && idValido.safeParse(id).success ? id : null);

  const [proyectos, miembros] = await Promise.all([
    db.from("proyectos").select("id, nombre").is("eliminado_en", null).order("nombre"),
    veEquipo ? listarMiembros(db, organizacion.id) : Promise.resolve([]),
  ]);
  if (proyectos.error) throw proyectos.error;
  const personas = miembros.filter((m) => m.activo).map((m) => ({ id: m.id, nombre: m.nombre }));

  const proyectoId = proyectos.data.some((p) => p.id === valido(parametros.proyecto)) ? parametros.proyecto! : null;
  const personaId = veEquipo && personas.some((p) => p.id === valido(parametros.persona)) ? parametros.persona! : null;

  const datos = await obtenerAnalitica(db, { organizacionId: organizacion.id, periodo, proyectoId, personaId });

  return (
    <>
      <PageHeader
        titulo="Analítica"
        descripcion={`${veEquipo ? "Datos medidos del equipo" : "Tus datos medidos"}, del ${textoPeriodo(periodo)}.`}
      />
      <FiltrosAnalitica
        periodo={periodo.clave}
        desde={periodo.desde}
        hasta={periodo.hasta}
        hoy={hoy}
        proyectos={proyectos.data.map((p) => ({ id: p.id, nombre: p.nombre }))}
        proyectoId={proyectoId}
        personas={personas}
        personaId={personaId}
      />
      <TarjetasAnalitica datos={datos} veEquipo={veEquipo} dias={periodo.dias} />
    </>
  );
}
