import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { BentoCard } from "@/components/bento/bento-card";
import { BentoGrid } from "@/components/bento/bento-grid";
import { ReintentarTarjeta } from "@/components/bento/reintentar-tarjeta";
import { EnlaceTarea } from "@/components/tareas/enlace-tarea";
import { BarraAvance, EtiquetaEstado, Persona } from "@/components/tareas/etiquetas";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Analitica } from "@/lib/data/analitica/consultas";
import {
  agruparHorasPorProyecto,
  CLAVE_OTROS,
  consumoSobreAvance,
  DESVIO_PRESUPUESTO,
  hayDatosSuficientes,
  MINIMO_N,
  textoDuracionLarga,
  textoInsuficiente,
  textoPorcentaje,
  textoPrecision,
  variacion,
} from "@/lib/data/analitica/reglas";
import { textoHoras } from "@/lib/data/carga/reglas";
import { NOMBRE_ESTADO } from "@/lib/data/tareas/reglas";
import { formatearFecha } from "@/lib/fechas";
import { GraficoCuellos, GraficoHorasProyecto, GraficoRendimiento, GraficoUtilizacion } from "./graficos";

const MAXIMO_TRABADAS = 10;
const claseFila = "flex min-h-11 w-full items-center gap-3 rounded-lg px-2 -mx-2 hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 outline-none";

/** Una tarjeta cuya función falló: las demás se muestran igual. */
function TarjetaConError({ tamano, titulo, queMide }: Pick<Parameters<typeof BentoCard>[0], "tamano" | "titulo" | "queMide">) {
  return <BentoCard tamano={tamano} titulo={titulo} queMide={queMide} estado="error" accionError={<ReintentarTarjeta />} />;
}

/**
 * Las tarjetas de Analítica. Responden tres preguntas: dónde se traba el trabajo, quién está
 * sobrecargado y qué tan bien estimamos. Sin ranking de personas: se listan por nombre.
 */
export function TarjetasAnalitica({ datos, veEquipo, dias }: { datos: Analitica; veEquipo: boolean; dias: number }) {
  const deQuien = veEquipo ? "" : " tuyas";
  const contra = `contra los ${dias} días anteriores`;

  return (
    <BentoGrid>
      {/* ===== Chicas ===== */}
      {(() => {
        const t = { tamano: "chica" as const, titulo: "Horas registradas", queMide: `Suma de las horas cargadas${deQuien} en el período, ${contra}.` };
        if (!datos.horas.ok) return <TarjetaConError {...t} />;
        const { actual, anterior } = datos.horas.datos;
        const v = variacion(actual, anterior);
        return <BentoCard {...t} valor={textoHoras(actual)} variacion={v === null ? undefined : { valor: v, subirEsBueno: null }} />;
      })()}

      {(() => {
        const t = { tamano: "chica" as const, titulo: "Tareas hechas", queMide: `Tareas${deQuien} cerradas como Hechas en el período, ${contra}.` };
        if (!datos.hechas.ok) return <TarjetaConError {...t} />;
        const { actual, anterior } = datos.hechas.datos;
        const v = variacion(actual, anterior);
        return <BentoCard {...t} valor={actual} variacion={v === null ? undefined : { valor: v }} />;
      })()}

      {(() => {
        const t = {
          tamano: "chica" as const,
          titulo: "Cumplimiento de plazos",
          queMide: "Tareas hechas con fecha límite que se cerraron ese día o antes.",
        };
        if (!datos.plazos.ok) return <TarjetaConError {...t} />;
        const p = datos.plazos.datos;
        if (!hayDatosSuficientes(p.n) || p.porcentaje === null) return <BentoCard {...t} estado="vacio" textoVacio={textoInsuficiente(p.n)} />;
        return (
          <BentoCard {...t} valor={textoPorcentaje(p.porcentaje)}>
            <p className="text-xs text-muted-foreground tabular-nums">
              {p.aTiempo} a tiempo y {p.tarde} tarde, de {p.n}.
            </p>
          </BentoCard>
        );
      })()}

      {(() => {
        const t = {
          tamano: "chica" as const,
          titulo: "Precisión de estimación",
          queMide: "Mediana de horas reales sobre estimadas, en tareas hechas con estimación y horas cargadas.",
        };
        if (!datos.precision.ok) return <TarjetaConError {...t} />;
        const p = datos.precision.datos;
        if (!hayDatosSuficientes(p.n) || p.mediana === null) return <BentoCard {...t} estado="vacio" textoVacio={textoInsuficiente(p.n)} />;
        return (
          <BentoCard {...t} valor={<span className="block text-xl leading-tight whitespace-normal">{textoPrecision(p.mediana)}</span>}>
            <p className="text-xs text-muted-foreground tabular-nums">Sobre {p.n} tareas. Más de 1 es que nos quedamos cortos.</p>
          </BentoCard>
        );
      })()}

      {/* ===== Cuellos de botella ===== */}
      {(() => {
        const t = {
          tamano: "ancha" as const,
          titulo: "Cuellos de botella",
          queMide: `Mediana de horas corridas que una tarea pasa en cada estado (pasos cerrados en el período). Trabada: lleva más que el 85 % de los pasos de ese estado, o más de 7 días si hay menos de ${MINIMO_N} pasos.`,
        };
        if (!datos.cuellos.ok) return <TarjetaConError {...t} />;
        const filas = datos.cuellos.datos.map((c) => {
          const suficiente = hayDatosSuficientes(c.n) && c.medianaHoras !== null;
          return {
            estado: c.estado,
            nombre: NOMBRE_ESTADO[c.estado],
            mediana: suficiente ? c.medianaHoras : null,
            n: c.n,
            ahora: c.tareasAhora,
            trabadas: c.trabadas,
            textoMediana: suficiente ? textoDuracionLarga(c.medianaHoras!) : `Faltan datos (${c.n} de ${MINIMO_N})`,
          };
        });
        if (filas.every((f) => f.n === 0 && f.ahora === 0)) return <BentoCard {...t} estado="vacio" />;
        return (
          <BentoCard {...t}>
            <GraficoCuellos filas={filas} />
          </BentoCard>
        );
      })()}

      {/* ===== Tareas trabadas ===== */}
      {(() => {
        const t = {
          tamano: "grande" as const,
          titulo: "Tareas trabadas",
          queMide: "Tareas abiertas que llevan en su estado más de lo normal, de la que más lleva a la que menos.",
        };
        if (!datos.trabadas.ok) return <TarjetaConError {...t} />;
        const trabadas = datos.trabadas.datos;
        if (trabadas.length === 0) return <BentoCard {...t} estado="vacio" textoVacio="No hay tareas trabadas." />;
        return (
          <BentoCard {...t} valor={trabadas.length}>
            <ul className="flex flex-col">
              {trabadas.slice(0, MAXIMO_TRABADAS).map((x) => (
                <li key={x.tareaId}>
                  <EnlaceTarea id={x.tareaId} className={`${claseFila} py-1.5`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{x.titulo}</span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="truncate">{x.proyecto}</span>
                        <Persona persona={x.asignado} />
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <EtiquetaEstado estado={x.estado} />
                      <span className="text-xs font-medium tabular-nums">
                        {textoDuracionLarga(x.horasEnEstado)}
                        <span className="sr-only"> en este estado; lo normal es hasta {textoDuracionLarga(x.umbralHoras)}</span>
                      </span>
                    </span>
                  </EnlaceTarea>
                </li>
              ))}
            </ul>
            {trabadas.length > MAXIMO_TRABADAS && (
              <p className="mt-2 text-xs text-muted-foreground">Y {trabadas.length - MAXIMO_TRABADAS} más. Filtrá por proyecto para verlas.</p>
            )}
          </BentoCard>
        );
      })()}

      {/* ===== Utilización ===== */}
      {(() => {
        const t = {
          tamano: "grande" as const,
          titulo: "Utilización por persona",
          queMide: "Horas cargadas sobre capacidad: horas semanales por días hábiles del período. No descuenta feriados ni licencias.",
        };
        if (!datos.utilizacion.ok) return <TarjetaConError {...t} />;
        const filas = datos.utilizacion.datos;
        if (filas.length === 0) return <BentoCard {...t} estado="vacio" textoVacio="No hay personas para este filtro." />;
        return (
          <BentoCard {...t}>
            <GraficoUtilizacion filas={filas.map((u) => ({ nombre: u.persona.nombre, porcentaje: u.porcentaje, horas: u.horas, capacidad: u.capacidad }))} />
          </BentoCard>
        );
      })()}

      {/* ===== Rendimiento ===== */}
      {(() => {
        const t = { tamano: "mediana" as const, titulo: "Rendimiento semanal", queMide: `Tareas${deQuien} cerradas como Hechas cada semana.` };
        if (!datos.hechas.ok) return <TarjetaConError {...t} />;
        const semanas = datos.hechas.datos.semanas;
        if (semanas.every((s) => s.tareasHechas === 0)) return <BentoCard {...t} estado="vacio" textoVacio="No se cerraron tareas en el período." />;
        return (
          <BentoCard {...t}>
            <GraficoRendimiento semanas={semanas.map((s) => ({ semana: s.semana, etiqueta: formatearFecha(s.semana), valor: s.tareasHechas }))} />
          </BentoCard>
        );
      })()}

      {/* ===== Horas por proyecto ===== */}
      {(() => {
        const t = {
          tamano: "mediana" as const,
          titulo: "Horas por proyecto",
          queMide: "Horas cargadas cada semana, por proyecto. Los 6 con más horas, y el resto en Otros.",
        };
        if (!datos.horas.ok) return <TarjetaConError {...t} />;
        if (datos.horas.datos.filas.length === 0) return <BentoCard {...t} estado="vacio" textoVacio="No hay horas cargadas en el período." />;
        const { series, semanas } = agruparHorasPorProyecto(datos.horas.datos.filas, datos.proyectos, datos.semanas);
        return (
          <BentoCard {...t}>
            <GraficoHorasProyecto
              series={series.map((s) => ({ ...s, otros: s.clave === CLAVE_OTROS }))}
              semanas={semanas.map((s) => ({ ...s, etiqueta: formatearFecha(s.semana) }))}
            />
          </BentoCard>
        );
      })()}

      {/* ===== Presupuesto: solo Admin y PM ===== */}
      {veEquipo &&
        (() => {
          const t = {
            tamano: "ancha" as const,
            titulo: "Consumo de presupuesto",
            queMide: `Horas cargadas desde el inicio sobre horas presupuestadas, junto al avance (tareas hechas sobre no canceladas). Se marca si el consumo pasa al avance por más de ${DESVIO_PRESUPUESTO} puntos.`,
          };
          if (!datos.presupuesto.ok) return <TarjetaConError {...t} />;
          const filas = datos.presupuesto.datos;
          if (filas.length === 0) return <BentoCard {...t} estado="vacio" textoVacio="Ningún proyecto activo tiene horas presupuestadas." />;
          return (
            <BentoCard {...t}>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proyecto</TableHead>
                      <TableHead className="text-right">Horas</TableHead>
                      <TableHead className="text-right">Presupuesto</TableHead>
                      <TableHead className="text-right">Consumo</TableHead>
                      <TableHead>Avance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filas.map((p) => {
                      const desvio = consumoSobreAvance(p.porcentaje, p.avance);
                      return (
                        <TableRow key={p.proyecto.id}>
                          <TableCell className="max-w-56">
                            <Link href={`/proyectos/${p.proyecto.id}`} className="inline-flex min-h-11 items-center truncate hover:underline">
                              {p.proyecto.nombre}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{textoHoras(p.horas)}</TableCell>
                          <TableCell className="text-right tabular-nums">{textoHoras(p.presupuestadas)}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            <span className={desvio ? "inline-flex items-center gap-1 font-medium text-[var(--estado-mora)]" : undefined}>
                              {desvio && <TriangleAlert className="size-4" aria-hidden />}
                              {p.porcentaje === null ? "Sin dato" : textoPorcentaje(p.porcentaje)}
                              {desvio && <span className="sr-only">, por encima del avance</span>}
                            </span>
                          </TableCell>
                          <TableCell className="min-w-36">
                            <BarraAvance avance={p.avance === null ? null : p.avance / 100} className="max-w-48" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </BentoCard>
          );
        })()}
    </BentoGrid>
  );
}
