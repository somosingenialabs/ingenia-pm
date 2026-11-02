"use client";

import { useState, type FormEvent } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { Resultado } from "@/lib/data/comun";
import { aceptarInvitacion } from "@/lib/data/miembros/acciones";
import { esquemaCuentaNueva, type EntradaCuentaNueva } from "@/lib/validaciones/miembros";

/** Persona nueva, mail que ya tiene cuenta, o sesión abierta con ese mail. */
export function FormularioInvitacion({ token, modo, email }: { token: string; modo: "nueva" | "existente" | "sesion"; email: string }) {
  const router = useRouter();

  function alEntrar() {
    router.replace("/inicio");
    router.refresh();
  }

  if (modo === "nueva") return <CuentaNueva token={token} alEntrar={alEntrar} />;
  return <CuentaExistente token={token} email={email} conSesion={modo === "sesion"} alEntrar={alEntrar} />;
}

function CuentaNueva({ token, alEntrar }: { token: string; alEntrar: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EntradaCuentaNueva>({ resolver: zodResolver(esquemaCuentaNueva) });

  async function enviar(cuenta: EntradaCuentaNueva) {
    setError(null);
    try {
      const resultado = await aceptarInvitacion({ token, cuenta });
      if (resultado.ok) alEntrar();
      else setError(resultado.error);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <form onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <Field data-invalid={!!errors.nombre}>
        <FieldLabel htmlFor="nombre">Tu nombre</FieldLabel>
        <Input id="nombre" autoComplete="name" aria-invalid={!!errors.nombre} {...register("nombre")} />
        <FieldError errors={[errors.nombre]} />
      </Field>
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
        {isSubmitting ? "Creando tu cuenta…" : "Crear cuenta y entrar"}
      </Button>
    </form>
  );
}

function CuentaExistente({ token, email, conSesion, alEntrar }: { token: string; email: string; conSesion: boolean; alEntrar: () => void }) {
  const [clave, setClave] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const resultado: Resultado = await aceptarInvitacion({ token, clave });
      if (resultado.ok) alEntrar();
      else setError(resultado.error);
    } catch (err) {
      setError(mensajeDeError(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      {!conSesion && (
        <>
          <p className="text-sm text-muted-foreground">Ese mail ya tiene una cuenta. Ingresá para sumar esta empresa.</p>
          <Field>
            <FieldLabel htmlFor="mail">Mail</FieldLabel>
            <Input id="mail" type="email" value={email} readOnly disabled autoComplete="email" />
          </Field>
          <Field data-invalid={!!error}>
            <FieldLabel htmlFor="clave">Contraseña</FieldLabel>
            <Input id="clave" type="password" autoComplete="current-password" value={clave} onChange={(e) => setClave(e.target.value)} />
          </Field>
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={enviando}>
        {enviando ? "Sumándote…" : conSesion ? "Aceptar invitación" : "Ingresar y aceptar"}
      </Button>
    </form>
  );
}
