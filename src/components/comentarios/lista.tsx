"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PersonaRef } from "@/lib/data/comun";
import type { ComentarioFila } from "@/lib/data/comentarios/consultas";
import { estaAbajo, type Pendiente } from "@/lib/data/comentarios/reglas";
import { ItemComentario, ItemPendiente } from "./item";

/** La hora "de ahora", que avanza sola cada minuto para que "hace 5 minutos" no quede viejo. */
function useAhora() {
  const [ahora, setAhora] = useState(() => new Date());
  useEffect(() => {
    const reloj = setInterval(() => setAhora(new Date()), 60_000);
    return () => clearInterval(reloj);
  }, []);
  return ahora;
}

/**
 * Hilo en orden cronológico. Si quien lee está abajo de todo, lo nuevo se ve solo; si subió a leer
 * algo viejo, no se lo mueve: aparece "Comentarios nuevos". Lo de otros se anuncia en voz baja.
 */
export function ListaComentarios({
  comentarios,
  pendientes,
  autores,
  yo,
  puedeBorrarAjenos,
  alEditar,
  alBorrar,
  alReintentar,
  alDescartar,
}: {
  comentarios: ComentarioFila[];
  pendientes: Pendiente[];
  autores: Map<string, PersonaRef>;
  yo: PersonaRef;
  puedeBorrarAjenos: boolean;
  alEditar: (id: string, cuerpo: string) => Promise<string | null>;
  alBorrar: (comentario: ComentarioFila) => void;
  alReintentar: (id: string) => void;
  alDescartar: (id: string) => void;
}) {
  const ahora = useAhora();
  const contenedor = useRef<HTMLDivElement>(null);
  const abajo = useRef(true);
  const ultimoVisto = useRef<string | null>(null);
  const [hayNuevos, setHayNuevos] = useState(false);

  const ultimo = pendientes.at(-1)?.id ?? comentarios.at(-1)?.id ?? null;

  // Después de pintar: si llegó algo al final, se baja o se avisa.
  useLayoutEffect(() => {
    const anterior = ultimoVisto.current;
    ultimoVisto.current = ultimo;
    const caja = contenedor.current;
    if (!caja || ultimo === null) return;
    if (anterior === null) {
      caja.scrollTop = caja.scrollHeight; // Al abrir, el hilo arranca abajo.
      return;
    }
    if (ultimo === anterior) return;

    const propio = pendientes.some((p) => p.id === ultimo) || comentarios.find((c) => c.id === ultimo)?.autor_id === yo.id;
    if (abajo.current || propio) {
      caja.scrollTop = caja.scrollHeight;
    } else {
      setHayNuevos(true);
    }
  }, [ultimo, comentarios, pendientes, yo.id]);

  // Para lectores de pantalla: la región cambia cuando llega algo de otra persona. Lo que ya
  // estaba al abrir no se anuncia, porque una región aria-live solo avisa cambios.
  const ultimoAjeno = comentarios.findLast((c) => c.autor_id !== yo.id && !c.eliminado_en);
  const anuncio = ultimoAjeno ? `Último comentario de ${autores.get(ultimoAjeno.autor_id)?.nombre ?? "otra persona"}: ${ultimoAjeno.cuerpo.slice(0, 140)}` : "";

  function alDesplazar() {
    const caja = contenedor.current;
    if (!caja) return;
    abajo.current = estaAbajo(caja);
    if (abajo.current) setHayNuevos(false);
  }

  function bajar() {
    const caja = contenedor.current;
    if (caja) caja.scrollTo({ top: caja.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setHayNuevos(false);
  }

  if (comentarios.length === 0 && pendientes.length === 0) {
    return <p className="py-2 text-sm text-muted-foreground">Todavía no hay comentarios. Escribí el primero.</p>;
  }

  return (
    <div className="relative">
      <div ref={contenedor} onScroll={alDesplazar} className="max-h-96 overflow-y-auto overscroll-contain rounded-[14px] border bg-card px-4" tabIndex={0} aria-label="Comentarios">
        <ul className="divide-y">
          {comentarios.map((c) => (
            <ItemComentario
              // Al cambiar el cuerpo (edición de otra sesión), el estado del editor arranca de cero.
              key={`${c.id}-${c.editado_en ?? ""}`}
              comentario={c}
              autor={autores.get(c.autor_id)}
              ahora={ahora}
              esPropio={c.autor_id === yo.id}
              puedeBorrar={c.autor_id === yo.id || puedeBorrarAjenos}
              alEditar={(cuerpo) => alEditar(c.id, cuerpo)}
              alBorrar={() => alBorrar(c)}
            />
          ))}
          {pendientes.map((p) => (
            <ItemPendiente key={p.id} pendiente={p} autor={yo} ahora={ahora} alReintentar={() => alReintentar(p.id)} alDescartar={() => alDescartar(p.id)} />
          ))}
        </ul>
      </div>
      {hayNuevos && (
        <Button type="button" size="sm" onClick={bajar} className="absolute bottom-3 left-1/2 -translate-x-1/2">
          <ArrowDown aria-hidden /> Comentarios nuevos
        </Button>
      )}
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
    </div>
  );
}
