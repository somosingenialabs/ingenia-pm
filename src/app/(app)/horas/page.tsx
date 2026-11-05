import type { Metadata } from "next";
import { MisHoras } from "@/components/tiempo/mis-horas";
import { obtenerContexto } from "@/lib/auth/contexto";
import { lunesDe } from "@/lib/data/carga/reglas";
import type { PersonaRef } from "@/lib/data/comun";
import { listarMiembros } from "@/lib/data/miembros/consultas";
import { esFechaDeBase, hoyEnZona } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Horas" };

/**
 * Mis horas, por semana. `?semana=` es cualquier día de la semana que se quiere ver; `?persona=`
 * solo lo usa un Admin, para corregir horas ajenas. Las horas se leen desde el navegador.
 */
export default async function HorasPage({ searchParams }: { searchParams: Promise<{ semana?: string; persona?: string }> }) {
  const parametros = await searchParams;
  const { usuario, organizacion, rol } = await obtenerContexto();

  const hoy = hoyEnZona(organizacion.zonaHoraria);
  const lunesActual = lunesDe(hoy);
  const lunes = parametros.semana && esFechaDeBase(parametros.semana) ? lunesDe(parametros.semana) : lunesActual;

  let personas: PersonaRef[] = [];
  if (rol === "admin") {
    const db = await crearClienteServidor();
    personas = (await listarMiembros(db, organizacion.id)).map(({ id, nombre, avatarUrl }) => ({ id, nombre, avatarUrl }));
  }
  // Una persona que no es de la empresa, o un id raro, vuelve a las propias.
  const persona = personas.find((p) => p.id === parametros.persona && p.id !== usuario.id) ?? null;

  return <MisHoras lunes={lunes} lunesActual={lunesActual} persona={persona} personas={personas} />;
}
