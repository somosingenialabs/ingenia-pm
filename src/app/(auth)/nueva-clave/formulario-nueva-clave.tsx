"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { definirClave } from "@/lib/auth/acciones";
import { esquemaNuevaClave, type DatosNuevaClave } from "@/lib/validaciones/auth";

export function FormularioNuevaClave() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
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
      router.replace("/inicio");
      router.refresh();
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <Field data-invalid={!!errors.clave}>
        <FieldLabel htmlFor="clave">Contraseña nueva</FieldLabel>
        <Input id="clave" type="password" autoComplete="new-password" aria-invalid={!!errors.clave} {...register("clave")} />
        <FieldError errors={[errors.clave]} />
      </Field>
      <Field data-invalid={!!errors.repetida}>
        <FieldLabel htmlFor="repetida">Repetila</FieldLabel>
        <Input id="repetida" type="password" autoComplete="new-password" aria-invalid={!!errors.repetida} {...register("repetida")} />
        <FieldError errors={[errors.repetida]} />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Guardando…" : "Guardar contraseña"}
      </Button>
    </form>
  );
}
