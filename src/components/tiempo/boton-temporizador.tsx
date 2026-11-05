"use client";

import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTiempo } from "./proveedor-tiempo";

/**
 * Iniciar o detener el temporizador en una tarea, en 44 px. Si corre en otra, iniciar acá la
 * detiene y guarda lo de aquella (lo hace la base, en una transacción).
 * `conTexto`: botón con palabra, para el detalle; sin, solo ícono con nombre accesible, para tarjetas.
 */
export function BotonTemporizador({ tareaId, titulo, conTexto = false }: { tareaId: string; titulo: string; conTexto?: boolean }) {
  const { temporizador, ocupado, iniciar, pedirDetener } = useTiempo();
  const corriendoAca = temporizador?.tareaId === tareaId;
  const etiqueta = corriendoAca ? `Detener el temporizador de ${titulo}` : `Iniciar el temporizador en ${titulo}`;
  const Icono = corriendoAca ? Square : Play;

  return (
    <Button
      type="button"
      size={conTexto ? "default" : "icon"}
      variant={corriendoAca ? "secondary" : conTexto ? "outline" : "ghost"}
      disabled={ocupado}
      onClick={() => (corriendoAca ? pedirDetener() : void iniciar(tareaId))}
      aria-label={conTexto ? undefined : etiqueta}
      title={conTexto ? undefined : etiqueta}
    >
      <Icono aria-hidden className={corriendoAca ? "fill-current" : undefined} />
      {conTexto && (corriendoAca ? "Detener" : "Iniciar temporizador")}
    </Button>
  );
}
