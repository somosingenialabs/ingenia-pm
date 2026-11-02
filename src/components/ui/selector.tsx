"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** Radix no acepta "" como valor: este representa "ninguno" o "todos". */
export const NINGUNO = "__ninguno";

export type OpcionSelector = { valor: string; etiqueta: string };

/** Lista desplegable de pocas opciones, con 44 px para tocar. */
export function Selector({
  id,
  valor,
  onCambiar,
  opciones,
  etiquetaAria,
  placeholder,
  deshabilitado,
  invalido,
  className,
}: {
  id?: string;
  valor: string;
  onCambiar: (valor: string) => void;
  opciones: readonly OpcionSelector[];
  etiquetaAria?: string;
  placeholder?: string;
  deshabilitado?: boolean;
  invalido?: boolean;
  className?: string;
}) {
  return (
    <Select value={valor} onValueChange={onCambiar} disabled={deshabilitado}>
      <SelectTrigger id={id} aria-label={etiquetaAria} aria-invalid={invalido || undefined} className={cn("w-full", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent position="popper">
        {opciones.map((o) => (
          <SelectItem key={o.valor} value={o.valor} className="min-h-11">
            {o.etiqueta}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
