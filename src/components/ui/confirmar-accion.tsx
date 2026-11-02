"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface ConfirmacionPendiente {
  titulo: string;
  descripcion: string;
  /** Texto del botón de confirmar: un verbo concreto ("Borrar rutina"), no "Aceptar". */
  etiqueta: string;
  accion: () => void;
}

/**
 * Confirmación de una acción destructiva (Apple HIG): dice qué va a pasar, el botón rojo nombra la
 * acción y "Cancelar" queda a mano. En celular sube como una hoja; no usa el cuadro gris del navegador.
 */
export function ConfirmarAccion({
  pendiente,
  onCerrar,
}: {
  pendiente: ConfirmacionPendiente | null;
  onCerrar: () => void;
}) {
  return (
    <Dialog open={!!pendiente} onOpenChange={(abierto) => !abierto && onCerrar()}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{pendiente?.titulo}</DialogTitle>
          <DialogDescription>{pendiente?.descripcion}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="destructive"
            size="lg"
            onClick={() => {
              pendiente?.accion();
              onCerrar();
            }}
          >
            {pendiente?.etiqueta}
          </Button>
          <Button variant="outline" size="lg" onClick={onCerrar} autoFocus>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
