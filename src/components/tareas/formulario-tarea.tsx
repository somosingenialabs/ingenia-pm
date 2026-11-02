"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Path } from "react-hook-form";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NINGUNO, Selector } from "@/components/ui/selector";
import { Textarea } from "@/components/ui/textarea";
import type { PersonaRef, Resultado } from "@/lib/data/comun";
import { NOMBRE_ESTADO, NOMBRE_PRIORIDAD } from "@/lib/data/tareas/reglas";
import { esquemaEdicionTarea, ESTADOS_TAREA, PRIORIDADES, type EntradaEdicionTarea } from "@/lib/validaciones/tareas";

const OPCIONES_ESTADO = ESTADOS_TAREA.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO[e] }));
const OPCIONES_PRIORIDAD = PRIORIDADES.map((p) => ({ valor: p, etiqueta: NOMBRE_PRIORIDAD[p] }));

export type ValoresTarea = {
  titulo: string;
  descripcion: string;
  estado: EntradaEdicionTarea["estado"];
  prioridad: EntradaEdicionTarea["prioridad"];
  asignado_id: string | null;
  fecha_inicio: string;
  fecha_limite: string;
  horas_estimadas: string;
};

/** Qué campos se pueden tocar. Lo que no, se ve como solo lectura, sin dejar el campo activo. */
export type PermisosCampos = { todo: boolean; estadoYDescripcion: boolean };

/**
 * Campos de una tarea, para crear y para editar. `enviar` recibe solo lo que la persona puede
 * cambiar: el asignado que no gestiona manda estado y descripción, y nada más.
 */
export function FormularioTarea({
  id,
  valores,
  personas,
  permisos,
  enviar,
  alGuardar,
  alEnviando,
}: {
  id: string;
  valores: ValoresTarea;
  personas: PersonaRef[];
  permisos: PermisosCampos;
  enviar: (datos: EntradaEdicionTarea) => Promise<Resultado<unknown>>;
  alGuardar: () => void;
  alEnviando?: (enviando: boolean) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError: marcarCampo,
    formState: { errors },
  } = useForm<ValoresTarea, unknown, EntradaEdicionTarea>({
    // `resolver` valida con el mismo esquema que el servidor.
    resolver: zodResolver(esquemaEdicionTarea) as never,
    defaultValues: valores,
  });

  async function alEnviar(datos: EntradaEdicionTarea) {
    setError(null);
    alEnviando?.(true);
    try {
      const carga = permisos.todo ? datos : { estado: datos.estado, descripcion: datos.descripcion };
      const resultado = await enviar(carga);
      if (!resultado.ok) {
        setError(resultado.error);
        for (const [campo, mensaje] of Object.entries(resultado.campos ?? {})) {
          marcarCampo(campo as Path<ValoresTarea>, { message: mensaje });
        }
        return;
      }
      alGuardar();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      alEnviando?.(false);
    }
  }

  const soloLectura = !permisos.todo;
  const descripcionFija = !permisos.todo && !permisos.estadoYDescripcion;
  const opcionesAsignado = [
    { valor: NINGUNO, etiqueta: "Sin asignar" },
    ...personas.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
  ];

  return (
    <form id={id} onSubmit={handleSubmit(alEnviar)} noValidate className="flex flex-col gap-4">
      <Field data-invalid={!!errors.titulo}>
        <FieldLabel htmlFor={`${id}-titulo`}>Título</FieldLabel>
        <Input id={`${id}-titulo`} disabled={soloLectura} aria-invalid={!!errors.titulo} {...register("titulo")} />
        <FieldError errors={[errors.titulo]} />
      </Field>

      <Field data-invalid={!!errors.descripcion}>
        <FieldLabel htmlFor={`${id}-descripcion`}>Descripción</FieldLabel>
        <Textarea id={`${id}-descripcion`} rows={4} disabled={descripcionFija} aria-invalid={!!errors.descripcion} {...register("descripcion")} />
        <FieldError errors={[errors.descripcion]} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor={`${id}-estado`}>Estado</FieldLabel>
          <Controller
            control={control}
            name="estado"
            render={({ field }) => (
              <Selector id={`${id}-estado`} valor={field.value ?? "por_hacer"} onCambiar={field.onChange} opciones={OPCIONES_ESTADO} deshabilitado={descripcionFija} />
            )}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-prioridad`}>Prioridad</FieldLabel>
          <Controller
            control={control}
            name="prioridad"
            render={({ field }) => (
              <Selector id={`${id}-prioridad`} valor={field.value ?? "media"} onCambiar={field.onChange} opciones={OPCIONES_PRIORIDAD} deshabilitado={soloLectura} />
            )}
          />
        </Field>
      </div>

      <Field data-invalid={!!errors.asignado_id}>
        <FieldLabel htmlFor={`${id}-asignado`}>Asignado</FieldLabel>
        <Controller
          control={control}
          name="asignado_id"
          render={({ field }) => {
            // Alguien que ya no es miembro puede seguir asignado: se muestra igual, sin ofrecerlo a otras tareas.
            const opciones =
              field.value && !personas.some((p) => p.id === field.value)
                ? [...opcionesAsignado, { valor: field.value, etiqueta: "Ya no es miembro del proyecto" }]
                : opcionesAsignado;
            return (
              <Selector
                id={`${id}-asignado`}
                valor={field.value ?? NINGUNO}
                onCambiar={(v) => field.onChange(v === NINGUNO ? null : v)}
                opciones={opciones}
                deshabilitado={soloLectura}
                invalido={!!errors.asignado_id}
              />
            );
          }}
        />
        <FieldError errors={[errors.asignado_id]} />
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field data-invalid={!!errors.fecha_inicio}>
          <FieldLabel htmlFor={`${id}-inicio`}>Inicio</FieldLabel>
          <Input id={`${id}-inicio`} type="date" disabled={soloLectura} aria-invalid={!!errors.fecha_inicio} {...register("fecha_inicio")} />
          <FieldError errors={[errors.fecha_inicio]} />
        </Field>
        <Field data-invalid={!!errors.fecha_limite}>
          <FieldLabel htmlFor={`${id}-limite`}>Fecha límite</FieldLabel>
          <Input id={`${id}-limite`} type="date" disabled={soloLectura} aria-invalid={!!errors.fecha_limite} {...register("fecha_limite")} />
          <FieldError errors={[errors.fecha_limite]} />
        </Field>
      </div>

      <Field data-invalid={!!errors.horas_estimadas}>
        <FieldLabel htmlFor={`${id}-horas`}>Horas estimadas</FieldLabel>
        <Input id={`${id}-horas`} type="number" min={0} step="0.5" inputMode="decimal" disabled={soloLectura} aria-invalid={!!errors.horas_estimadas} {...register("horas_estimadas")} />
        <FieldError errors={[errors.horas_estimadas]} />
      </Field>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
