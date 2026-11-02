"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, UserPlus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { EstadoVacio } from "@/components/estado/estado-vacio";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { AvatarPersona } from "@/components/tareas/etiquetas";
import { Button } from "@/components/ui/button";
import { ConfirmarAccion, type ConfirmacionPendiente } from "@/components/ui/confirmar-accion";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { HojaAdaptable } from "@/components/ui/hoja-adaptable";
import { Input } from "@/components/ui/input";
import { Selector } from "@/components/ui/selector";
import { NOMBRE_ROL } from "@/lib/auth/permisos";
import { ROLES, type Rol } from "@/lib/auth/tipos";
import type { Resultado } from "@/lib/data/comun";
import { cambiarHorasSemanales, cambiarRol, desactivarMiembro, invitar, revocarInvitacion } from "@/lib/data/miembros/acciones";
import type { InvitacionPendiente, MiembroFila } from "@/lib/data/miembros/consultas";
import { formatearFecha } from "@/lib/fechas";
import { esquemaInvitar, type EntradaInvitar } from "@/lib/validaciones/miembros";

type Invitacion = InvitacionPendiente & { venceEl: string };

const OPCIONES_ROL = ROLES.map((r) => ({ valor: r, etiqueta: NOMBRE_ROL[r] }));

async function avisar(promesa: Promise<Resultado>, exito: string) {
  try {
    const resultado = await promesa;
    if (resultado.ok) toast.success(exito);
    else toast.error(resultado.error);
  } catch (e) {
    toast.error(mensajeDeError(e));
  }
}

export function GestionMiembros({ miembros, invitaciones, usuarioId }: { miembros: MiembroFila[]; invitaciones: Invitacion[]; usuarioId: string }) {
  const [invitando, setInvitando] = useState(false);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionPendiente | null>(null);

  function pedirDesactivar(m: MiembroFila) {
    setConfirmacion({
      titulo: `¿Desactivar a ${m.nombre}?`,
      descripcion: m.id === usuarioId ? "Es tu propio usuario: vas a perder el acceso a esta empresa." : "Pierde el acceso enseguida. Sus tareas quedan a su nombre.",
      etiqueta: "Desactivar",
      accion: () => void avisar(desactivarMiembro(m.id), "Persona desactivada."),
    });
  }

  function pedirRevocar(i: Invitacion) {
    setConfirmacion({
      titulo: "¿Cancelar esta invitación?",
      descripcion: `El enlace que le mandaste a ${i.email} deja de funcionar.`,
      etiqueta: "Cancelar invitación",
      accion: () => void avisar(revocarInvitacion(i.id), "Invitación cancelada."),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end [&>*]:flex-1 sm:[&>*]:flex-none">
        <Button onClick={() => setInvitando(true)}>
          <UserPlus aria-hidden /> Invitar
        </Button>
      </div>

      <section aria-label="Miembros" className="flex flex-col gap-2">
        <h2 className="texto-titular">Miembros</h2>
        <ul className="flex flex-col divide-y rounded-[14px] border bg-card">
          {miembros.map((m) => (
            <li key={m.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <AvatarPersona persona={m} className="size-9" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {m.nombre}
                    {m.id === usuarioId && " (vos)"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">{m.email}</span>
                </span>
              </div>
              {m.activo ? (
                <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
                  <Selector
                    etiquetaAria={`Rol de ${m.nombre}`}
                    className="md:w-40"
                    valor={m.rol}
                    onCambiar={(rol) => void avisar(cambiarRol({ usuarioId: m.id, rol }), "Rol actualizado.")}
                    opciones={OPCIONES_ROL}
                  />
                  <CampoHoras miembro={m} />
                  <Button variant="ghost" className="col-span-2" onClick={() => pedirDesactivar(m)} aria-label={`Desactivar a ${m.nombre}`}>
                    Desactivar
                  </Button>
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">Desactivado. Para reactivarlo, invitalo de nuevo.</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Invitaciones pendientes" className="flex flex-col gap-2">
        <h2 className="texto-titular">Invitaciones pendientes</h2>
        {invitaciones.length === 0 ? (
          <EstadoVacio className="rounded-[14px] border bg-card py-8" titulo="No hay invitaciones pendientes" texto="Invitá a alguien para sumarlo a la empresa." />
        ) : (
          <ul className="flex flex-col divide-y rounded-[14px] border bg-card">
            {invitaciones.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 p-4">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{i.email}</span>
                  <span className="block text-xs text-muted-foreground">
                    {NOMBRE_ROL[i.rol]} · vence el {formatearFecha(i.venceEl)}
                  </span>
                </span>
                <Button variant="ghost" onClick={() => pedirRevocar(i)} aria-label={`Cancelar la invitación de ${i.email}`}>
                  Cancelar
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {invitando && <HojaInvitar onCerrar={() => setInvitando(false)} />}
      <ConfirmarAccion pendiente={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}

function CampoHoras({ miembro }: { miembro: MiembroFila }) {
  const [valor, setValor] = useState(String(miembro.horasSemanales));

  function guardar() {
    if (valor === String(miembro.horasSemanales)) return;
    void avisar(cambiarHorasSemanales({ usuarioId: miembro.id, horas: valor }), "Horas actualizadas.");
  }

  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      <Input
        type="number"
        min={0}
        max={80}
        step="0.5"
        inputMode="decimal"
        aria-label={`Horas semanales de ${miembro.nombre}`}
        value={valor}
        onChange={(e) => setValor(e.target.value)}
        onBlur={guardar}
        className="w-20 tabular-nums"
      />
      h/sem
    </label>
  );
}

function HojaInvitar({ onCerrar }: { onCerrar: () => void }) {
  const [creada, setCreada] = useState<{ enlace: string; email: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError: marcarCampo,
    formState: { errors, isSubmitting },
  } = useForm<EntradaInvitar>({ resolver: zodResolver(esquemaInvitar), defaultValues: { email: "", rol: "colaborador" } });

  async function enviar(datos: EntradaInvitar) {
    setError(null);
    try {
      const resultado = await invitar(datos);
      if (!resultado.ok) {
        if (resultado.campos?.email) marcarCampo("email", { message: resultado.campos.email });
        setError(resultado.error);
        return;
      }
      setCreada(resultado.datos);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  async function copiar() {
    if (!creada) return;
    try {
      await navigator.clipboard.writeText(creada.enlace);
      setCopiado(true);
    } catch {
      toast.error("No pudimos copiarlo. Seleccionalo y copialo a mano.");
    }
  }

  return (
    <HojaAdaptable
      abierta
      onCambiar={(abierta) => !abierta && onCerrar()}
      titulo="Invitar a la empresa"
      descripcion={creada ? undefined : "Generá un enlace y mandalo por donde quieras."}
      pie={
        creada ? (
          <Button onClick={onCerrar}>Listo</Button>
        ) : (
          <Button type="submit" form="invitar" disabled={isSubmitting}>
            {isSubmitting ? "Generando…" : "Generar enlace"}
          </Button>
        )
      }
    >
      {creada ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm">Mandale este enlace a {creada.email}. Vence en 7 días. Copialo ahora: no se puede volver a ver.</p>
          <Input aria-label="Enlace de invitación" readOnly value={creada.enlace} onFocus={(e) => e.target.select()} />
          <Button variant="outline" onClick={copiar}>
            {copiado ? <Check aria-hidden /> : <Copy aria-hidden />}
            {copiado ? "Copiado" : "Copiar enlace"}
          </Button>
        </div>
      ) : (
        <form id="invitar" onSubmit={handleSubmit(enviar)} noValidate className="flex flex-col gap-4">
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="invitar-mail">Mail</FieldLabel>
            <Input id="invitar-mail" type="email" autoComplete="off" aria-invalid={!!errors.email} {...register("email")} />
            <FieldError errors={[errors.email]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="invitar-rol">Rol</FieldLabel>
            <Controller
              control={control}
              name="rol"
              render={({ field }) => <Selector id="invitar-rol" valor={field.value as Rol} onCambiar={field.onChange} opciones={OPCIONES_ROL} />}
            />
          </Field>
          {error && !errors.email && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
    </HojaAdaptable>
  );
}
