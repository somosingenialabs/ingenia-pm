"use client";

import { useState, type ReactNode } from "react";
import { BarChart3, Table2, TriangleAlert } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

// Gráficos de Analítica. Reglas (skill dataviz): una sola escala por gráfico, marcas finas, el
// color sigue a la serie y nunca va solo (leyenda, etiqueta o tabla), y cada gráfico tiene su
// tabla de datos como alternativa accesible.

const formatoNumero = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 });
const horas = (v: number) => `${formatoNumero.format(v)} h`;

/** Color de la serie i (0 a 5), y gris para "Otros". */
export function colorSerie(i: number, otros = false) {
  return otros ? "var(--serie-otros)" : `var(--serie-${(i % 6) + 1})`;
}

const EJE = { fontSize: 12, fill: "var(--muted-foreground)" } as const;

/** Cambia entre el gráfico y su tabla. El botón dice qué va a mostrar. */
export function ConTabla({ tabla, children, className }: { tabla: ReactNode; children: ReactNode; className?: string }) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <div className={cn("flex h-full flex-col gap-2", className)}>
      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" className="min-h-11 -my-2 -mr-2" aria-pressed={verTabla} onClick={() => setVerTabla((v) => !v)}>
          {verTabla ? <BarChart3 aria-hidden /> : <Table2 aria-hidden />}
          {verTabla ? "Ver gráfico" : "Ver tabla"}
        </Button>
      </div>
      <div className="min-h-0 flex-1">{verTabla ? <div className="max-h-80 overflow-auto">{tabla}</div> : children}</div>
    </div>
  );
}

type FilaTooltip = { nombre: string; valor: string; color?: string };

function CajaTooltip({ titulo, filas }: { titulo: string; filas: FilaTooltip[] }) {
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground">
      <p className="mb-1 font-medium">{titulo}</p>
      <ul className="flex flex-col gap-0.5">
        {filas.map((f) => (
          <li key={f.nombre} className="flex items-center gap-2">
            {f.color && <span aria-hidden className="size-2.5 shrink-0 rounded-[3px]" style={{ background: f.color }} />}
            <span className="flex-1 text-muted-foreground">{f.nombre}</span>
            <span className="font-medium tabular-nums">{f.valor}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TablaSimple({ columnas, filas, alinearDerechaDesde = 1 }: { columnas: string[]; filas: ReactNode[][]; alinearDerechaDesde?: number }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columnas.map((c, i) => (
            <TableHead key={c} className={i >= alinearDerechaDesde ? "text-right" : undefined}>
              {c}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filas.map((fila, i) => (
          <TableRow key={i}>
            {fila.map((celda, j) => (
              <TableCell key={j} className={j >= alinearDerechaDesde ? "text-right tabular-nums" : undefined}>
                {celda}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ---------------------------------------------------------------------------------------------
// Cuellos de botella: mediana de horas por estado, y cuántas tareas hay y cuántas trabadas
// ---------------------------------------------------------------------------------------------

export type FilaCuello = {
  estado: string;
  nombre: string;
  /** Null: menos de 5 pasos medidos, no se muestra. */
  mediana: number | null;
  n: number;
  ahora: number;
  trabadas: number;
  textoMediana: string;
};

export function GraficoCuellos({ filas }: { filas: FilaCuello[] }) {
  const datos = filas.map((f) => ({ ...f, valor: f.mediana ?? 0 }));
  const tabla = (
    <TablaSimple
      columnas={["Estado", "Mediana", "Pasos medidos", "Tareas ahora", "Trabadas"]}
      filas={filas.map((f) => [f.nombre, f.textoMediana, f.n, f.ahora, f.trabadas])}
    />
  );
  return (
    <ConTabla tabla={tabla}>
      <div className="grid h-full gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="h-44" role="img" aria-label={`Mediana de horas en cada estado: ${filas.map((f) => `${f.nombre}, ${f.textoMediana}`).join("; ")}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} layout="vertical" margin={{ top: 0, right: 120, bottom: 0, left: 0 }} barCategoryGap={10}>
              <CartesianGrid horizontal={false} stroke="var(--grafico-grilla)" />
              <XAxis type="number" tick={EJE} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v} h`} />
              <YAxis type="category" dataKey="nombre" tick={EJE} tickLine={false} axisLine={false} width={88} />
              <Tooltip
                cursor={{ fill: "var(--accent)" }}
                content={({ active, payload }) => {
                  const f = active ? (payload?.[0]?.payload as FilaCuello | undefined) : undefined;
                  if (!f) return null;
                  return (
                    <CajaTooltip
                      titulo={f.nombre}
                      filas={[
                        { nombre: "Mediana", valor: f.textoMediana },
                        { nombre: "Pasos medidos", valor: String(f.n) },
                        { nombre: "Tareas ahora", valor: String(f.ahora) },
                        { nombre: "Trabadas", valor: String(f.trabadas) },
                      ]}
                    />
                  );
                }}
              />
              <Bar dataKey="valor" fill={colorSerie(0)} radius={[0, 4, 4, 0]} maxBarSize={28} minPointSize={2} isAnimationActive={false}>
                <LabelList dataKey="textoMediana" position="right" style={{ fontSize: 12, fill: "var(--foreground)" }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <ul className="flex flex-col justify-center gap-2 text-sm" aria-label="Tareas en cada estado ahora">
          {filas.map((f) => (
            <li key={f.estado} className="flex items-center justify-between gap-2">
              <span>{f.nombre}</span>
              <span className="flex items-center gap-2 tabular-nums">
                <span className="text-muted-foreground">{f.ahora} ahora</span>
                {f.trabadas > 0 ? (
                  <span className="inline-flex items-center gap-1 font-medium text-[var(--estado-mora)]">
                    <TriangleAlert className="size-4" aria-hidden />
                    {f.trabadas} {f.trabadas === 1 ? "trabada" : "trabadas"}
                  </span>
                ) : (
                  <span className="text-muted-foreground">0 trabadas</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ConTabla>
  );
}

// ---------------------------------------------------------------------------------------------
// Utilización por persona: barras con la línea de capacidad al 100 %
// ---------------------------------------------------------------------------------------------

export type FilaUtilizacion = { nombre: string; porcentaje: number | null; horas: number; capacidad: number };

export function GraficoUtilizacion({ filas }: { filas: FilaUtilizacion[] }) {
  const movil = useIsMobile();
  const datos = filas.map((f) => ({
    ...f,
    valor: f.porcentaje ?? 0,
    etiqueta: f.porcentaje === null ? "Sin capacidad" : `${formatoNumero.format(f.porcentaje)} %${f.porcentaje > 100 ? " · sobre capacidad" : ""}`,
  }));
  const maximo = Math.max(120, ...datos.map((d) => d.valor + 10));
  const tabla = (
    <TablaSimple
      columnas={["Persona", "Horas", "Capacidad", "Utilización"]}
      filas={datos.map((f) => [f.nombre, horas(f.horas), horas(f.capacidad), f.etiqueta])}
    />
  );
  return (
    <ConTabla tabla={tabla}>
      <div style={{ height: Math.max(140, datos.length * 40 + 32) }} role="img" aria-label={`Utilización: ${datos.map((d) => `${d.nombre}, ${d.etiqueta}`).join("; ")}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} layout="vertical" margin={{ top: 16, right: movil ? 56 : 132, bottom: 0, left: 0 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke="var(--grafico-grilla)" />
            <XAxis type="number" domain={[0, maximo]} tick={EJE} tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v} %`} />
            <YAxis type="category" dataKey="nombre" tick={EJE} tickLine={false} axisLine={false} width={movil ? 84 : 120} />
            <Tooltip
              cursor={{ fill: "var(--accent)" }}
              content={({ active, payload }) => {
                const f = active ? (payload?.[0]?.payload as (typeof datos)[number] | undefined) : undefined;
                if (!f) return null;
                return (
                  <CajaTooltip
                    titulo={f.nombre}
                    filas={[
                      { nombre: "Utilización", valor: f.etiqueta },
                      { nombre: "Horas", valor: horas(f.horas) },
                      { nombre: "Capacidad", valor: horas(f.capacidad) },
                    ]}
                  />
                );
              }}
            />
            <ReferenceLine
              x={100}
              stroke="var(--foreground)"
              strokeDasharray="4 4"
              label={{ value: "Capacidad", position: "top", fontSize: 12, fill: "var(--muted-foreground)" }}
            />
            {/* minPointSize: con 0 % igual se dibuja la etiqueta. */}
            <Bar dataKey="valor" fill={colorSerie(0)} radius={[0, 4, 4, 0]} maxBarSize={24} minPointSize={2} isAnimationActive={false}>
              <LabelList dataKey={movil ? "valor" : "etiqueta"} position="right" formatter={movil ? (v: unknown) => `${formatoNumero.format(Number(v))} %` : undefined} style={{ fontSize: 12, fill: "var(--foreground)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ConTabla>
  );
}

// ---------------------------------------------------------------------------------------------
// Rendimiento semanal: línea
// ---------------------------------------------------------------------------------------------

export type PuntoSemana = { semana: string; etiqueta: string; valor: number };

export function GraficoRendimiento({ semanas }: { semanas: PuntoSemana[] }) {
  const movil = useIsMobile();
  const tabla = <TablaSimple columnas={["Semana", "Tareas hechas"]} filas={semanas.map((s) => [`Semana del ${s.etiqueta}`, s.valor])} />;
  return (
    <ConTabla tabla={tabla}>
      <div className="h-56" role="img" aria-label={`Tareas hechas por semana: ${semanas.map((s) => `${s.etiqueta}, ${s.valor}`).join("; ")}.`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={semanas} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grafico-grilla)" />
            <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={movil ? 24 : 12} />
            <YAxis allowDecimals={false} tick={EJE} tickLine={false} axisLine={false} width={32} />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              content={({ active, payload }) => {
                const s = active ? (payload?.[0]?.payload as PuntoSemana | undefined) : undefined;
                if (!s) return null;
                return <CajaTooltip titulo={`Semana del ${s.etiqueta}`} filas={[{ nombre: "Tareas hechas", valor: String(s.valor), color: colorSerie(0) }]} />;
              }}
            />
            <Line
              // Recta entre semanas: una curva inventaría valores que no se midieron.
              type="linear"
              dataKey="valor"
              stroke={colorSerie(0)}
              strokeWidth={2}
              dot={{ r: 4, fill: colorSerie(0), stroke: "var(--card)", strokeWidth: 2 }}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ConTabla>
  );
}

// ---------------------------------------------------------------------------------------------
// Horas por proyecto: barras apiladas por semana, hasta 6 proyectos y "Otros"
// ---------------------------------------------------------------------------------------------

export type SerieGrafico = { clave: string; nombre: string; total: number; otros: boolean };
export type SemanaGrafico = { semana: string; etiqueta: string; total: number; valores: Record<string, number> };

export function GraficoHorasProyecto({ series, semanas }: { series: SerieGrafico[]; semanas: SemanaGrafico[] }) {
  const movil = useIsMobile();
  const color = (s: SerieGrafico, i: number) => colorSerie(i, s.otros);
  const datos = semanas.map((s) => ({ etiqueta: s.etiqueta, semana: s.semana, total: s.total, ...s.valores }));
  const tabla = (
    <TablaSimple
      columnas={["Semana", ...series.map((s) => s.nombre), "Total"]}
      filas={semanas.map((s) => [`Semana del ${s.etiqueta}`, ...series.map((x) => horas(s.valores[x.clave] ?? 0)), horas(s.total)])}
    />
  );
  return (
    <ConTabla tabla={tabla}>
      <div className="flex h-full flex-col gap-2">
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Proyectos del gráfico">
          {series.map((s, i) => (
            <li key={s.clave} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="size-2.5 rounded-[3px]" style={{ background: color(s, i) }} />
              <span>{s.nombre}</span>
              <span className="text-muted-foreground tabular-nums">{horas(s.total)}</span>
            </li>
          ))}
        </ul>
        <div className="h-52" role="img" aria-label={`Horas por proyecto y semana. Totales del período: ${series.map((s) => `${s.nombre}, ${horas(s.total)}`).join("; ")}.`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={datos} margin={{ top: 4, right: 4, bottom: 0, left: 0 }} barCategoryGap={movil ? 2 : 6}>
              <CartesianGrid vertical={false} stroke="var(--grafico-grilla)" />
              <XAxis dataKey="etiqueta" tick={EJE} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={movil ? 24 : 12} />
              <YAxis tick={EJE} tickLine={false} axisLine={false} width={52} tickFormatter={(v: number) => `${v} h`} />
              <Tooltip
                cursor={{ fill: "var(--accent)" }}
                content={({ active, payload }) => {
                  const fila = active ? (payload?.[0]?.payload as (typeof datos)[number] | undefined) : undefined;
                  if (!fila) return null;
                  const valores = fila as unknown as Record<string, number>;
                  return (
                    <CajaTooltip
                      titulo={`Semana del ${fila.etiqueta}`}
                      filas={[
                        ...series.filter((s) => valores[s.clave]).map((s) => ({ nombre: s.nombre, valor: horas(valores[s.clave]!), color: color(s, series.indexOf(s)) })),
                        { nombre: "Total", valor: horas(fila.total) },
                      ]}
                    />
                  );
                }}
              />
              {series.map((s, i) => (
                <Bar
                  key={s.clave}
                  dataKey={s.clave}
                  name={s.nombre}
                  stackId="horas"
                  fill={color(s, i)}
                  // 2 px de separación entre segmentos, del color de la tarjeta.
                  stroke="var(--card)"
                  strokeWidth={1}
                  maxBarSize={36}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ConTabla>
  );
}
