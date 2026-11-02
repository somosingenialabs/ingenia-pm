"use client";

import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Ref } from "@/lib/data/comun";
import { cn } from "@/lib/utils";

/** Espera entre teclas antes de buscar (ms). */
const ESPERA = 200;

/**
 * Elegir un proyecto, una tarea o una persona buscando por nombre. Busca en el
 * servidor (`buscar`), así sirve para miles de registros. En escritorio es un globo; en el
 * celular, una hoja desde abajo con el teclado ya abierto.
 */
export function Combobox({
  id,
  valor,
  onCambiar,
  buscar,
  placeholder = "Elegí una opción",
  etiquetaBusqueda = "Buscar…",
  permitirVacio = true,
  deshabilitado,
  invalido,
  className,
}: {
  id?: string;
  valor: Ref | null;
  onCambiar: (valor: Ref | null) => void;
  buscar: (texto: string) => Promise<Ref[]>;
  placeholder?: string;
  etiquetaBusqueda?: string;
  permitirVacio?: boolean;
  deshabilitado?: boolean;
  invalido?: boolean;
  className?: string;
}) {
  const esCelular = useIsMobile();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const [resultados, setResultados] = useState<Ref[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    const espera = setTimeout(() => {
      setCargando(true);
      setError(null);
      buscar(texto.trim())
        .then((filas) => vigente && setResultados(filas))
        .catch((e: unknown) => vigente && setError(mensajeDeError(e)))
        .finally(() => vigente && setCargando(false));
    }, ESPERA);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [abierto, texto, buscar]);

  function elegir(ref: Ref | null) {
    onCambiar(ref);
    setAbierto(false);
    setTexto("");
  }

  const lista = (
    <Command shouldFilter={false}>
      <CommandInput value={texto} onValueChange={setTexto} placeholder={etiquetaBusqueda} autoFocus />
      <CommandList>
        {cargando && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Buscando…</p>}
        {!cargando && error && (
          <p role="alert" className="px-3 py-6 text-center text-sm">
            {error}
          </p>
        )}
        {!cargando && !error && <CommandEmpty>No encontramos nada con ese nombre.</CommandEmpty>}
        {!cargando && !error && resultados.length > 0 && (
          <CommandGroup>
            {resultados.map((r) => (
              <CommandItem key={r.id} value={r.id} onSelect={() => elegir(r)}>
                <Check className={cn("size-4", valor?.id === r.id ? "opacity-100" : "opacity-0")} aria-hidden />
                <span className="truncate">{r.nombre}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {permitirVacio && valor && (
          <CommandGroup>
            <CommandItem value="__quitar" onSelect={() => elegir(null)}>
              <X className="size-4" aria-hidden />
              Quitar «{valor.nombre}»
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );

  const disparador = (
    <Button
      id={id}
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={abierto}
      aria-invalid={invalido || undefined}
      disabled={deshabilitado}
      onClick={esCelular ? () => setAbierto(true) : undefined}
      className={cn("h-9 w-full justify-between font-normal pointer-coarse:h-11", className)}
    >
      <span className={cn("truncate", !valor && "text-muted-foreground")}>{valor?.nombre ?? placeholder}</span>
      <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden />
    </Button>
  );

  if (esCelular) {
    return (
      <>
        {disparador}
        <Dialog open={abierto} onOpenChange={setAbierto}>
          <DialogContent showCloseButton={false} className="p-0">
            <DialogTitle className="sr-only">{placeholder}</DialogTitle>
            <DialogDescription className="sr-only">{etiquetaBusqueda}</DialogDescription>
            {lista}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Popover open={abierto} onOpenChange={setAbierto}>
      <PopoverTrigger asChild>{disparador}</PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) min-w-64 p-0">
        {lista}
      </PopoverContent>
    </Popover>
  );
}
