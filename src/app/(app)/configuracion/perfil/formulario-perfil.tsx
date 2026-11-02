"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { AvatarPersona } from "@/components/tareas/etiquetas";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { definirClave } from "@/lib/auth/acciones";
import { guardarAvatar, guardarPerfil } from "@/lib/data/configuracion/acciones";
import { subirImagen } from "@/lib/data/configuracion/subir-imagen";
import { esquemaNuevaClave, type DatosNuevaClave } from "@/lib/validaciones/auth";
import { esquemaPerfil, TIPOS_DE_IMAGEN, type EntradaPerfil } from "@/lib/validaciones/configuracion";

export function FormularioPerfil({ usuarioId, nombre, email, avatarUrl }: { usuarioId: string; nombre: string; email: string | null; avatarUrl: string | null }) {
  return (
    <div className="grid max-w-2xl gap-6">
      <TarjetaDatos usuarioId={usuarioId} nombre={nombre} email={email} avatarUrl={avatarUrl} />
      <TarjetaClave />
    </div>
  );
}

function TarjetaDatos({ usuarioId, nombre, email, avatarUrl }: { usuarioId: string; nombre: string; email: string | null; avatarUrl: string | null }) {
  const archivo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EntradaPerfil>({ resolver: zodResolver(esquemaPerfil), defaultValues: { nombre_completo: nombre } });

  async function enviar(datos: EntradaPerfil) {
    try {
      const resultado = await guardarPerfil(datos);
      if (resultado.ok) toast.success("Perfil guardado.");
      else toast.error(resultado.error);
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  async function alElegir(e: ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0];
    e.target.value = "";
    if (!elegido) return;
    setSubiendo(true);
    try {
      const subida = await subirImagen(elegido, usuarioId, "avatar");
      if ("error" in subida) {
        toast.error(subida.error);
        return;
      }
      const resultado = await guardarAvatar(subida.ruta);
      if (resultado.ok) toast.success("Foto actualizada.");
      else toast.error(resultado.error);
    } catch (error) {
      toast.error(mensajeDeError(error));
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarFoto() {
    const resultado = await guardarAvatar(null);
    if (!resultado.ok) toast.error(resultado.error);
  }

  return (
    <section aria-label="Tus datos" className="flex flex-col gap-4 rounded-[14px] border bg-card p-5">
      <h2 className="texto-titular">Tus datos</h2>
      <div className="flex flex-wrap items-center gap-3">
        <AvatarPersona persona={{ id: usuarioId, nombre, avatarUrl }} className="size-16" />
        <input ref={archivo} type="file" accept={TIPOS_DE_IMAGEN.join(",")} className="sr-only" tabIndex={-1} aria-label="Archivo de foto" aria-hidden onChange={alElegir} />
        <Button type="button" variant="outline" disabled={subiendo} onClick={() => archivo.current?.click()}>
          {subiendo ? "Subiendo…" : "Cambiar foto"}
        </Button>
        {avatarUrl && (
          <Button type="button" variant="ghost" onClick={quitarFoto}>
            Quitar foto
          </Button>
        )}
        <p className="w-full text-xs text-muted-foreground">PNG, JPG o WebP, hasta 2 MB.</p>
      </div>
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
        <Field data-invalid={!!errors.nombre_completo}>
          <FieldLabel htmlFor="perfil-nombre">Nombre</FieldLabel>
          <Input id="perfil-nombre" autoComplete="name" aria-invalid={!!errors.nombre_completo} {...register("nombre_completo")} />
          <FieldError errors={[errors.nombre_completo]} />
        </Field>
        {email && (
          <Field>
            <FieldLabel htmlFor="perfil-mail">Mail</FieldLabel>
            <Input id="perfil-mail" value={email} disabled readOnly />
          </Field>
        )}
        <Button type="submit" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Guardando…" : "Guardar"}
        </Button>
      </form>
    </section>
  );
}

function TarjetaClave() {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DatosNuevaClave>({ resolver: zodResolver(esquemaNuevaClave) });

  async function enviar(datos: DatosNuevaClave) {
    setError(null);
    try {
      const resultado = await definirClave(datos);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      reset({ clave: "", repetida: "" });
      toast.success("Contraseña actualizada.");
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <section aria-label="Contraseña" className="flex flex-col gap-4 rounded-[14px] border bg-card p-5">
      <h2 className="texto-titular">Contraseña</h2>
      <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
        <Field data-invalid={!!errors.clave}>
          <FieldLabel htmlFor="perfil-clave">Contraseña nueva</FieldLabel>
          <Input id="perfil-clave" type="password" autoComplete="new-password" aria-invalid={!!errors.clave} {...register("clave")} />
          <FieldError errors={[errors.clave]} />
        </Field>
        <Field data-invalid={!!errors.repetida}>
          <FieldLabel htmlFor="perfil-repetida">Repetila</FieldLabel>
          <Input id="perfil-repetida" type="password" autoComplete="new-password" aria-invalid={!!errors.repetida} {...register("repetida")} />
          <FieldError errors={[errors.repetida]} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" variant="outline" disabled={isSubmitting} className="self-start">
          {isSubmitting ? "Guardando…" : "Cambiar contraseña"}
        </Button>
      </form>
    </section>
  );
}
