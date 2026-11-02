"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { recuperar } from "@/lib/auth/acciones";
import { esquemaRecuperar, type DatosRecuperar } from "@/lib/validaciones/auth";

export function FormularioRecuperar() {
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DatosRecuperar>({ resolver: zodResolver(esquemaRecuperar) });

  async function enviar(datos: DatosRecuperar) {
    setError(null);
    try {
      const resultado = await recuperar(datos);
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setEnviado(true);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  const volver = (
    <Link href="/ingresar" className="flex min-h-11 items-center justify-center text-sm text-link underline-offset-4 hover:underline">
      Volver a ingresar
    </Link>
  );

  if (enviado) {
    return (
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <p role="status" className="text-sm">
          Si ese mail tiene una cuenta, te llega un enlace en unos minutos. Revisá también el correo no deseado.
        </p>
        {volver}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <Field data-invalid={!!errors.email}>
        <FieldLabel htmlFor="email">Mail</FieldLabel>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
        <FieldError errors={[errors.email]} />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={isSubmitting}>
        {isSubmitting ? "Enviando…" : "Enviar enlace"}
      </Button>
      {volver}
    </form>
  );
}
