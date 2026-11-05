"use client";

import { useState } from "react";
import { AlertCircle, Pencil, RotateCw, Trash2, X } from "lucide-react";
import { AvatarPersona } from "@/components/tareas/etiquetas";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PersonaRef } from "@/lib/data/comun";
import type { ComentarioFila } from "@/lib/data/comentarios/consultas";
import { fechaCompleta, tiempoRelativo, type Pendiente } from "@/lib/data/comentarios/reglas";

const SIN_AUTOR: PersonaRef = { id: "", nombre: "Persona", avatarUrl: null };

function Encabezado({ autor, fecha, ahora, extra }: { autor: PersonaRef; fecha: string; ahora: Date; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className="text-sm font-semibold">{autor.nombre}</span>
      <time dateTime={fecha} title={fechaCompleta(fecha)} className="text-xs text-muted-foreground">
        {tiempoRelativo(fecha, ahora)}
      </time>
      {extra}
    </div>
  );
}

/**
 * Un comentario. El cuerpo es texto plano con saltos de línea: nunca se interpreta como HTML, así
 * nadie puede meter código en la pantalla de otro.
 */
export function ItemComentario({
  comentario,
  autor,
  ahora,
  esPropio,
  puedeBorrar,
  alEditar,
  alBorrar,
}: {
  comentario: ComentarioFila;
  autor: PersonaRef | undefined;
  ahora: Date;
  esPropio: boolean;
  puedeBorrar: boolean;
  alEditar: (cuerpo: string) => Promise<string | null>;
  alBorrar: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(comentario.cuerpo);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const persona = autor ?? SIN_AUTOR;

  if (comentario.eliminado_en) {
    return (
      <li className="flex gap-3 py-3">
        <AvatarPersona persona={persona} className="size-8 opacity-50" />
        <p className="self-center text-sm text-muted-foreground italic">Comentario eliminado</p>
      </li>
    );
  }

  async function guardar() {
    setGuardando(true);
    const problema = await alEditar(texto);
    setGuardando(false);
    if (problema) {
      setError(problema);
      return;
    }
    setError(null);
    setEditando(false);
  }

  return (
    <li className="flex gap-3 py-3">
      <AvatarPersona persona={persona} className="size-8" />
      <div className="min-w-0 flex-1">
        <Encabezado
          autor={persona}
          fecha={comentario.creado_en}
          ahora={ahora}
          extra={comentario.editado_en && <span className="text-xs text-muted-foreground" title={`Editado el ${fechaCompleta(comentario.editado_en)}`}>(editado)</span>}
        />
        {editando ? (
          <div className="mt-1 flex flex-col gap-2">
            <Textarea
              aria-label="Editar comentario"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              aria-invalid={!!error || undefined}
              rows={3}
              autoFocus
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditando(false);
                  setTexto(comentario.cuerpo);
                  setError(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={() => void guardar()} disabled={guardando || !texto.trim()}>
                {guardando ? "Guardando…" : "Guardar"}
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-sm break-words whitespace-pre-wrap">{comentario.cuerpo}</p>
        )}
      </div>
      {!editando && (esPropio || puedeBorrar) && (
        <div className="-mr-2 flex shrink-0 items-start">
          {esPropio && (
            <Button type="button" variant="ghost" size="icon" aria-label="Editar comentario" onClick={() => setEditando(true)}>
              <Pencil aria-hidden />
            </Button>
          )}
          {(esPropio || puedeBorrar) && (
            <Button type="button" variant="ghost" size="icon" aria-label="Borrar comentario" onClick={alBorrar}>
              <Trash2 aria-hidden />
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/** Comentario que la base todavía no confirmó. Si falló, el texto queda acá con "Reintentar". */
export function ItemPendiente({
  pendiente,
  autor,
  ahora,
  alReintentar,
  alDescartar,
}: {
  pendiente: Pendiente;
  autor: PersonaRef;
  ahora: Date;
  alReintentar: () => void;
  alDescartar: () => void;
}) {
  const fallo = pendiente.estado === "error";
  return (
    <li className="flex gap-3 py-3" aria-busy={!fallo}>
      <AvatarPersona persona={autor} className="size-8" />
      <div className="min-w-0 flex-1">
        <Encabezado
          autor={autor}
          fecha={pendiente.creado_en}
          ahora={ahora}
          extra={!fallo && <span className="text-xs text-muted-foreground">Enviando…</span>}
        />
        <p className={fallo ? "mt-0.5 text-sm break-words whitespace-pre-wrap" : "mt-0.5 text-sm break-words whitespace-pre-wrap opacity-60"}>{pendiente.cuerpo}</p>
        {fallo && (
          <div className="mt-1 flex flex-col gap-1">
            <p role="alert" className="inline-flex items-center gap-1 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" aria-hidden />
              No se envió. {pendiente.error}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={alReintentar}>
                <RotateCw aria-hidden /> Reintentar
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={alDescartar}>
                <X aria-hidden /> Descartar
              </Button>
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
