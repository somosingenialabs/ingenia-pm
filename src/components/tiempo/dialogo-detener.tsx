"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { RegistroFila } from "@/lib/data/tiempo/consultas";
import { AYUDA_DURACION, duracionParaCampo, MAX_MINUTOS, minutosAlDetener, parsearDuracion, textoDuracion } from "@/lib/data/tiempo/reglas";

/**
 * "¿Lo dejaste prendido?": desde las 10 h, antes de guardar se puede corregir la duración. Desde
 * las 24 h es obligatorio, porque la base no guarda tanto.
 */
export function DialogoDetener({
  temporizador,
  ocupado,
  onCerrar,
  onGuardar,
}: {
  temporizador: RegistroFila | null;
  ocupado: boolean;
  onCerrar: () => void;
  onGuardar: (minutos: number) => Promise<boolean>;
}) {
  return (
    <Dialog open={!!temporizador} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent className="sm:max-w-md">
        {temporizador?.inicio && (
          // key: cada temporizador arranca el formulario de cero.
          <Contenido key={temporizador.id} temporizador={temporizador} inicio={temporizador.inicio} ocupado={ocupado} onGuardar={onGuardar} onCancelar={onCerrar} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Contenido({
  temporizador,
  inicio,
  ocupado,
  onGuardar,
  onCancelar,
}: {
  temporizador: RegistroFila;
  inicio: string;
  ocupado: boolean;
  onGuardar: (minutos: number) => Promise<boolean>;
  onCancelar: () => void;
}) {
  // Se mide una vez, al abrir: lo que se muestra y el tope de la corrección son lo mismo.
  const [corridos] = useState(() => minutosAlDetener(inicio, Date.now()));
  const pasoDelLimite = corridos > MAX_MINUTOS;
  const [texto, setTexto] = useState(pasoDelLimite ? "" : duracionParaCampo(corridos));
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    const minutos = parsearDuracion(texto);
    if (minutos === null) return setError(`No entendimos la duración. ${AYUDA_DURACION} Hasta 24 h.`);
    if (minutos > corridos) return setError(`No puede ser más de lo que estuvo prendido (${textoDuracion(Math.min(corridos, MAX_MINUTOS))}).`);
    setError(null);
    await onGuardar(minutos);
  }

  return (
    <form onSubmit={guardar} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>¿Lo dejaste prendido?</DialogTitle>
        <DialogDescription>
          El temporizador de «{temporizador.tareaTitulo}» lleva {pasoDelLimite ? "más de 24 h" : textoDuracion(corridos)}.{" "}
          {pasoDelLimite ? "Escribí cuánto trabajaste de verdad." : "Si no trabajaste todo ese tiempo, corregí la duración."}
        </DialogDescription>
      </DialogHeader>
      <Field data-invalid={!!error || undefined}>
        <FieldLabel htmlFor="duracion-detener">Duración</FieldLabel>
        <Input
          id="duracion-detener"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          autoComplete="off"
          aria-invalid={!!error || undefined}
          aria-describedby="duracion-detener-ayuda"
        />
        <FieldDescription id="duracion-detener-ayuda">{AYUDA_DURACION}</FieldDescription>
        {error && <FieldError>{error}</FieldError>}
      </Field>
      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button type="submit" disabled={ocupado}>
          {ocupado ? "Guardando…" : "Guardar"}
        </Button>
      </DialogFooter>
    </form>
  );
}
