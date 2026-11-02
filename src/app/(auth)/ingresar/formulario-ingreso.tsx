"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ingresar } from "@/lib/auth/acciones";
import { esquemaIngreso, type DatosIngreso } from "@/lib/validaciones/auth";

export function FormularioIngreso() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DatosIngreso>({ resolver: zodResolver(esquemaIngreso) });

  async function enviar(datos: DatosIngreso) {
    setError(null);
    try {
      const resultado = await ingresar(datos);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.replace("/inicio");
      router.refresh();
    } catch (e) {
      // Sin conexión: que el botón no quede trabado en "Ingresando…".
      setError(mensajeDeError(e));
    }
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor="email">Mail</FieldLabel>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        <FieldError errors={[errors.email]} />
      </Field>
      <Field data-invalid={!!errors.clave}>
        <FieldLabel htmlFor="clave">Contraseña</FieldLabel>
        <Input id="clave" type="password" autoComplete="current-password" aria-invalid={!!errors.clave} {...register("clave")} />
        <FieldError errors={[errors.clave]} />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Ingresando…" : "Ingresar"}
      </Button>
      <Link href="/recuperar" className="flex min-h-11 items-center justify-center text-sm text-link underline-offset-4 hover:underline">
        Olvidé mi contraseña
      </Link>
    </form>
  );
}
