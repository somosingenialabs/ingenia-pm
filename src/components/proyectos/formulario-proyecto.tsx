"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm, type Path } from "react-hook-form";
import { toast } from "sonner";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { HojaAdaptable } from "@/components/ui/hoja-adaptable";
import { Input } from "@/components/ui/input";
import { Selector } from "@/components/ui/selector";
import { Textarea } from "@/components/ui/textarea";
import type { PersonaRef } from "@/lib/data/comun";
import { crearProyecto, editarProyecto } from "@/lib/data/proyectos/acciones";
import { esquemaProyecto, ESTADOS_PROYECTO, NOMBRE_ESTADO_PROYECTO, type DatosProyecto, type EstadoProyecto } from "@/lib/validaciones/proyectos";

const OPCIONES_ESTADO = ESTADOS_PROYECTO.map((e) => ({ valor: e, etiqueta: NOMBRE_ESTADO_PROYECTO[e] }));

export type ValoresProyecto = {
  nombre: string;
  descripcion: string;
  cliente: string;
  estado: EstadoProyecto;
  responsable_id: string;
  fecha_inicio: string;
  fecha_fin_objetivo: string;
  horas_presupuestadas: string;
};

/** Alta y edición de un proyecto, en HojaAdaptable. Sin `proyectoId`, crea. */
export function FormularioProyecto({
  abierta,
  onCambiar,
  proyectoId,
  valores,
  personas,
}: {
  abierta: boolean;
  onCambiar: (abierta: boolean) => void;
  proyectoId?: string;
  valores: ValoresProyecto;
  personas: PersonaRef[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError: marcarCampo,
    formState: { errors, isSubmitting },
  } = useForm<ValoresProyecto, unknown, DatosProyecto>({
    resolver: zodResolver(esquemaProyecto) as never,
    defaultValues: valores,
  });

  async function enviar(datos: DatosProyecto) {
    setError(null);
    try {
      if (proyectoId) {
        const resultado = await editarProyecto(proyectoId, datos);
        if (!resultado.ok) return mostrarError(resultado);
        toast.success("Proyecto guardado.");
        onCambiar(false);
        return;
      }
      const resultado = await crearProyecto(datos);
      if (!resultado.ok) return mostrarError(resultado);
      toast.success("Proyecto creado.");
      router.push(`/proyectos/${resultado.datos.id}`);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  function mostrarError(resultado: { error: string; campos?: Record<string, string> }) {
    setError(resultado.error);
    for (const [campo, mensaje] of Object.entries(resultado.campos ?? {})) {
      marcarCampo(campo as Path<ValoresProyecto>, { message: mensaje });
    }
  }

  return (
    <HojaAdaptable
      abierta={abierta}
      onCambiar={onCambiar}
      titulo={proyectoId ? "Editar proyecto" : "Nuevo proyecto"}
      pie={
        <>
          <Button type="button" variant="outline" onClick={() => onCambiar(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="formulario-proyecto" disabled={isSubmitting}>
            {isSubmitting ? "Guardando…" : proyectoId ? "Guardar" : "Crear proyecto"}
          </Button>
        </>
      }
    >
      <form id="formulario-proyecto" onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
        <Field data-invalid={!!errors.nombre}>
          <FieldLabel htmlFor="proyecto-nombre">Nombre</FieldLabel>
          <Input id="proyecto-nombre" aria-invalid={!!errors.nombre} {...register("nombre")} />
          <FieldError errors={[errors.nombre]} />
        </Field>
        <Field data-invalid={!!errors.cliente}>
          <FieldLabel htmlFor="proyecto-cliente">Cliente</FieldLabel>
          <Input id="proyecto-cliente" aria-invalid={!!errors.cliente} {...register("cliente")} />
          <FieldError errors={[errors.cliente]} />
        </Field>
        <Field data-invalid={!!errors.descripcion}>
          <FieldLabel htmlFor="proyecto-descripcion">Descripción</FieldLabel>
          <Textarea id="proyecto-descripcion" rows={3} aria-invalid={!!errors.descripcion} {...register("descripcion")} />
          <FieldError errors={[errors.descripcion]} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field>
            <FieldLabel htmlFor="proyecto-estado">Estado</FieldLabel>
            <Controller
              control={control}
              name="estado"
              render={({ field }) => <Selector id="proyecto-estado" valor={field.value} onCambiar={field.onChange} opciones={OPCIONES_ESTADO} />}
            />
          </Field>
          <Field data-invalid={!!errors.responsable_id}>
            <FieldLabel htmlFor="proyecto-responsable">Responsable</FieldLabel>
            <Controller
              control={control}
              name="responsable_id"
              render={({ field }) => (
                <Selector
                  id="proyecto-responsable"
                  valor={field.value}
                  onCambiar={field.onChange}
                  opciones={personas.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
                  invalido={!!errors.responsable_id}
                />
              )}
            />
            <FieldError errors={[errors.responsable_id]} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field data-invalid={!!errors.fecha_inicio}>
            <FieldLabel htmlFor="proyecto-inicio">Inicio</FieldLabel>
            <Input id="proyecto-inicio" type="date" aria-invalid={!!errors.fecha_inicio} {...register("fecha_inicio")} />
            <FieldError errors={[errors.fecha_inicio]} />
          </Field>
          <Field data-invalid={!!errors.fecha_fin_objetivo}>
            <FieldLabel htmlFor="proyecto-objetivo">Objetivo</FieldLabel>
            <Input id="proyecto-objetivo" type="date" aria-invalid={!!errors.fecha_fin_objetivo} {...register("fecha_fin_objetivo")} />
            <FieldError errors={[errors.fecha_fin_objetivo]} />
          </Field>
        </div>
        <Field data-invalid={!!errors.horas_presupuestadas}>
          <FieldLabel htmlFor="proyecto-horas">Horas presupuestadas</FieldLabel>
          <Input id="proyecto-horas" type="number" min={0} step="1" inputMode="decimal" aria-invalid={!!errors.horas_presupuestadas} {...register("horas_presupuestadas")} />
          <FieldError errors={[errors.horas_presupuestadas]} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </form>
    </HojaAdaptable>
  );
}
