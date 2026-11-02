import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { EnlaceTarea } from "@/components/tareas/enlace-tarea";
import { BarraAvance, EtiquetaPrioridad, EtiquetaSalud, Persona } from "@/components/tareas/etiquetas";
import { puedeCrearProyecto } from "@/lib/auth/permisos";
import type { Rol } from "@/lib/auth/tipos";
import type { ClienteSupabase } from "@/lib/data/comun";
import {
  contarEnCurso,
  contarParaHoy,
  contarProyectosActivos,
  contarSinAsignar,
  contarVencidas,
  listarMiSemana,
  listarProximosPlazos,
  listarProyectosActivos,
} from "@/lib/data/inicio/consultas";
import { diasLaborales, formatearDia, formatearFecha } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { BentoCard, type TamanoBento } from "./bento-card";
import { ReintentarTarjeta } from "./reintentar-tarjeta";

export type ContextoTarjeta = { db: ClienteSupabase; usuarioId: string; hoy: string; rol: Rol };

/** Lo que dibuja una tarjeta con sus datos. Con `textoVacio`, no hay nada para mostrar. */
type Contenido = { valor?: ReactNode; cuerpo?: ReactNode; textoVacio?: string };

export type DefinicionTarjeta = {
  id: string;
  tamano: TamanoBento;
  titulo: string;
  /** El "qué mide", con la definición escrita. */
  queMide: string;
  href?: string;
  className?: string;
  /** Sin esto, la ven todos los roles. */
  visible?: (rol: Rol) => boolean;
  cargar: (contexto: ContextoTarjeta) => Promise<Contenido>;
};

const claseFila = "flex min-h-11 w-full items-center gap-3 rounded-lg px-2 -mx-2 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

/**
 * Registro de las tarjetas del inicio. Una fase nueva suma una entrada acá, sin tocar la grilla.
 * Una tarjeta sin datos todavía no se registra: no hay tarjetas de "próximamente".
 */
export const TARJETAS_INICIO: readonly DefinicionTarjeta[] = [
  {
    id: "vencidas",
    tamano: "chica",
    titulo: "Vencidas",
    queMide: "Mis tareas con fecha límite pasada y sin cerrar.",
    href: "/mis-tareas",
    cargar: async ({ db, usuarioId, hoy }) => ({ valor: await contarVencidas(db, { usuarioId, hoy }) }),
  },
  {
    id: "para-hoy",
    tamano: "chica",
    titulo: "Para hoy",
    queMide: "Mis tareas que vencen hoy.",
    href: "/mis-tareas",
    cargar: async ({ db, usuarioId, hoy }) => ({ valor: await contarParaHoy(db, { usuarioId, hoy }) }),
  },
  {
    id: "en-curso",
    tamano: "chica",
    titulo: "En curso",
    queMide: "Mis tareas en estado En curso.",
    href: "/mis-tareas",
    cargar: async ({ db, usuarioId }) => ({ valor: await contarEnCurso(db, { usuarioId }) }),
  },
  {
    id: "proyectos-activos",
    tamano: "chica",
    titulo: "Proyectos activos",
    queMide: "Proyectos en estado Activo que podés ver.",
    href: "/proyectos",
    cargar: async ({ db }) => ({ valor: await contarProyectosActivos(db) }),
  },
  {
    id: "sin-asignar",
    tamano: "chica",
    titulo: "Sin asignar",
    queMide: "Tareas abiertas sin responsable, en todos los proyectos.",
    href: "/proyectos",
    // Es la quinta chica de la fila: ocupa todo el ancho para no dejar un hueco.
    className: "md:col-span-6 xl:col-span-12",
    visible: puedeCrearProyecto,
    cargar: async ({ db }) => ({ valor: await contarSinAsignar(db) }),
  },
  {
    id: "proximos-plazos",
    tamano: "grande",
    titulo: "Próximos plazos",
    queMide: "Tareas abiertas que vencen en los próximos 7 días, con proyecto y responsable.",
    cargar: async ({ db, hoy }) => {
      const tareas = await listarProximosPlazos(db, hoy);
      if (tareas.length === 0) return { textoVacio: "No hay plazos en los próximos 7 días." };
      return {
        cuerpo: (
          <ul className="flex flex-col">
            {tareas.map((t) => (
              <li key={t.id}>
                <EnlaceTarea id={t.id} className={`${claseFila} py-1.5`}>
                  <span className="w-12 shrink-0 text-xs font-medium tabular-nums">{formatearFecha(t.fecha_limite!)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{t.titulo}</span>
                    <span className="block truncate text-xs text-muted-foreground">{t.proyecto.nombre}</span>
                  </span>
                  <span className="hidden max-w-32 sm:inline-flex">
                    <Persona persona={t.asignado} />
                  </span>
                </EnlaceTarea>
              </li>
            ))}
          </ul>
        ),
      };
    },
  },
  {
    id: "proyectos",
    tamano: "grande",
    titulo: "Proyectos",
    queMide: "Activos. Avance: hechas sobre no canceladas. Salud: Atrasado, En riesgo o Al día, según objetivo y tareas vencidas.",
    cargar: async ({ db, hoy, rol }) => {
      const proyectos = await listarProyectosActivos(db, hoy);
      if (proyectos.length === 0) {
        return {
          textoVacio: puedeCrearProyecto(rol)
            ? "No hay proyectos activos. Creá el primero desde Proyectos."
            : "Todavía no te sumaron a un proyecto activo.",
        };
      }
      return {
        cuerpo: (
          <ul className="flex flex-col">
            {proyectos.map((p) => (
              <li key={p.id}>
                <Link href={`/proyectos/${p.id}`} className={`${claseFila} py-1.5`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{p.nombre}</span>
                    <BarraAvance avance={p.avance} className="max-w-48" />
                  </span>
                  <EtiquetaSalud salud={p.salud} />
                </Link>
              </li>
            ))}
          </ul>
        ),
      };
    },
  },
  {
    id: "mi-semana",
    tamano: "ancha",
    titulo: "Mi semana",
    queMide: "Mis tareas abiertas que vencen cada día, de lunes a viernes.",
    cargar: async ({ db, usuarioId, hoy }) => {
      const dias = diasLaborales(hoy);
      const tareas = await listarMiSemana(db, usuarioId, dias);
      return {
        cuerpo: (
          <div className="grid gap-3 md:grid-cols-5">
            {dias.map((dia) => {
              const delDia = tareas.filter((t) => t.fecha_limite === dia);
              return (
                <div key={dia} className="min-w-0">
                  <h3 className={`mb-1 text-xs font-medium capitalize ${dia === hoy ? "text-link" : "text-muted-foreground"}`}>
                    {formatearDia(dia)}
                    {dia === hoy && " · hoy"}
                  </h3>
                  {delDia.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin tareas</p>
                  ) : (
                    <ul className="flex flex-col">
                      {delDia.map((t) => (
                        <li key={t.id}>
                          <EnlaceTarea id={t.id} className={`${claseFila} py-1`}>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm">{t.titulo}</span>
                              <EtiquetaPrioridad prioridad={t.prioridad} />
                            </span>
                          </EnlaceTarea>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ),
      };
    },
  },
];

/** Una tarjeta en su propio Suspense: carga sola. El try hace que, si falla, las demás sigan. */
async function CuerpoTarjeta({ tarjeta, usuarioId, hoy, rol }: { tarjeta: DefinicionTarjeta; usuarioId: string; hoy: string; rol: Rol }) {
  const { id, tamano, titulo, queMide, href, className } = tarjeta;
  const comunes = { tamano, titulo, queMide, className };
  let contenido: Contenido;
  try {
    const db = await crearClienteServidor();
    contenido = await tarjeta.cargar({ db, usuarioId, hoy, rol });
  } catch (error) {
    console.error(`tarjeta ${id}:`, (error as { code?: string }).code ?? "sin código");
    return <BentoCard {...comunes} estado="error" accionError={<ReintentarTarjeta />} />;
  }
  if (contenido.textoVacio) return <BentoCard {...comunes} estado="vacio" textoVacio={contenido.textoVacio} href={href} />;
  return (
    <BentoCard {...comunes} href={href} valor={contenido.valor}>
      {contenido.cuerpo}
    </BentoCard>
  );
}

export function TarjetasInicio({ usuarioId, hoy, rol }: { usuarioId: string; hoy: string; rol: Rol }) {
  return TARJETAS_INICIO.filter((t) => !t.visible || t.visible(rol)).map((t) => (
    <Suspense key={t.id} fallback={<BentoCard tamano={t.tamano} titulo={t.titulo} queMide={t.queMide} className={t.className} estado="cargando" />}>
      <CuerpoTarjeta tarjeta={t} usuarioId={usuarioId} hoy={hoy} rol={rol} />
    </Suspense>
  ));
}
