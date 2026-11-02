"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Selector } from "@/components/ui/selector";
import type { OrganizacionActiva } from "@/lib/auth/tipos";
import { guardarLogo, guardarOrganizacion } from "@/lib/data/configuracion/acciones";
import { subirImagen } from "@/lib/data/configuracion/subir-imagen";
import { esquemaOrganizacion, TIPOS_DE_IMAGEN, type EntradaOrganizacion } from "@/lib/validaciones/configuracion";

const COLOR_POR_DEFECTO = "#0062CC";

export function FormularioOrganizacion({ usuarioId, organizacion }: { usuarioId: string; organizacion: OrganizacionActiva }) {
  const archivo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EntradaOrganizacion>({
    resolver: zodResolver(esquemaOrganizacion),
    defaultValues: { nombre: organizacion.nombre, zona_horaria: organizacion.zonaHoraria, color_acento: organizacion.colorAcento },
  });

  // La zona guardada va siempre en la lista: el navegador puede nombrarla distinto.
  const zonas = useMemo(() => {
    const todas = new Set([organizacion.zonaHoraria, ...Intl.supportedValuesOf("timeZone")]);
    return [...todas].sort().map((z) => ({ valor: z, etiqueta: z.replaceAll("_", " ") }));
  }, [organizacion.zonaHoraria]);

  async function enviar(datos: EntradaOrganizacion) {
    setError(null);
    try {
      const resultado = await guardarOrganizacion(datos);
      if (resultado.ok) toast.success("Datos de la empresa guardados.");
      else setError(resultado.error);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function alElegirLogo(e: ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0];
    e.target.value = "";
    if (!elegido) return;
    setSubiendo(true);
    try {
      const subida = await subirImagen(elegido, usuarioId, "logo");
      if ("error" in subida) {
        toast.error(subida.error);
        return;
      }
      const resultado = await guardarLogo(subida.ruta);
      if (resultado.ok) toast.success("Logo actualizado.");
      else toast.error(resultado.error);
    } catch (err) {
      toast.error(mensajeDeError(err));
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarLogo() {
    const resultado = await guardarLogo(null);
    if (!resultado.ok) toast.error(resultado.error);
  }

  return (
    <section aria-label="Datos de la empresa" className="flex max-w-2xl flex-col gap-4 rounded-[14px] border bg-card p-5">
      <div className="flex flex-wrap items-center gap-3">
        {organizacion.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- lo sube cada empresa; no pasa por el optimizador.
          <img src={organizacion.logoUrl} alt="Logo actual" className="size-16 rounded-lg border object-contain" />
        ) : (
          <div className="flex size-16 items-center justify-center rounded-lg border text-xs text-muted-foreground">Sin logo</div>
        )}
        <input ref={archivo} type="file" accept={TIPOS_DE_IMAGEN.join(",")} className="sr-only" tabIndex={-1} aria-label="Archivo de logo" aria-hidden onChange={alElegirLogo} />
        <Button type="button" variant="outline" disabled={subiendo} onClick={() => archivo.current?.click()}>
          {subiendo ? "Subiendo…" : "Cambiar logo"}
        </Button>
        {organizacion.logoUrl && (
          <Button type="button" variant="ghost" onClick={quitarLogo}>
            Quitar logo
          </Button>
        )}
        <p className="w-full text-xs text-muted-foreground">PNG, JPG o WebP, hasta 2 MB.</p>
      </div>

      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
        <Field data-invalid={!!errors.nombre}>
          <FieldLabel htmlFor="org-nombre">Nombre</FieldLabel>
          <Input id="org-nombre" aria-invalid={!!errors.nombre} {...register("nombre")} />
          <FieldError errors={[errors.nombre]} />
        </Field>
        <Field data-invalid={!!errors.zona_horaria}>
          <FieldLabel htmlFor="org-zona">Zona horaria</FieldLabel>
          <Controller
            control={control}
            name="zona_horaria"
            render={({ field }) => <Selector id="org-zona" valor={field.value} onCambiar={field.onChange} opciones={zonas} invalido={!!errors.zona_horaria} />}
          />
          <FieldError errors={[errors.zona_horaria]} />
        </Field>
        <Field data-invalid={!!errors.color_acento}>
          <FieldLabel htmlFor="org-color">Color de acento</FieldLabel>
          <Controller
            control={control}
            name="color_acento"
            render={({ field }) => (
              <div className="flex items-center gap-2">
                <input
                  id="org-color"
                  type="color"
                  value={field.value ?? COLOR_POR_DEFECTO}
                  onChange={(e) => field.onChange(e.target.value)}
                  className="size-11 shrink-0 cursor-pointer rounded-lg border bg-transparent p-1"
                />
                <span className="text-sm tabular-nums">{field.value ?? "Azul de Ingenia"}</span>
                {field.value && (
                  <Button type="button" variant="ghost" onClick={() => field.onChange(null)}>
                    Volver al azul
                  </Button>
                )}
              </div>
            )}
          />
          <FieldError errors={[errors.color_acento]} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </section>
  );
}
