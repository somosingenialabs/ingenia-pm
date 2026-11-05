"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { SendHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * Caja para comentar. Enter siempre inserta un salto de línea (en el celular no hay otra forma de
 * hacerlo). En escritorio, Ctrl o Cmd + Enter envía. Sigue usable aunque Realtime se caiga: el
 * envío va por una acción del servidor, no por el canal.
 */
export function CajaComentario({ alEnviar }: { alEnviar: (cuerpo: string) => void }) {
  const id = useId();
  const esCelular = useIsMobile();
  const [texto, setTexto] = useState("");
  const vacio = texto.trim().length === 0;

  function enviar() {
    if (vacio) return;
    alEnviar(texto.trim());
    setTexto("");
  }

  function alTeclear(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !esCelular) {
      e.preventDefault();
      enviar();
    }
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
    >
      <Label htmlFor={id} className="sr-only">
        Escribí un comentario
      </Label>
      <Textarea
        id={id}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onKeyDown={alTeclear}
        placeholder="Escribí un comentario"
        rows={3}
        maxLength={5000}
        aria-describedby={esCelular ? undefined : `${id}-ayuda`}
      />
      <div className="flex items-center justify-between gap-2">
        {esCelular ? <span /> : <p id={`${id}-ayuda`} className="text-xs text-muted-foreground">Ctrl o Cmd + Enter para enviar</p>}
        <Button type="submit" disabled={vacio}>
          <SendHorizontal aria-hidden /> Comentar
        </Button>
      </div>
    </form>
  );
}
