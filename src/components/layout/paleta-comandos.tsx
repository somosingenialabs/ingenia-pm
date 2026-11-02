"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { seccionesVisibles } from "./navegacion";

/** Sin acentos y en minúsculas, para que "configuracion" encuentre "Configuración". */
export function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Paleta de comandos (Ctrl/Cmd+K): por ahora, ir a una sección. */
export function PaletaComandos() {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [texto, setTexto] = useState("");

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAbierta((a) => !a);
      }
    }
    document.addEventListener("keydown", alTeclear);
    return () => document.removeEventListener("keydown", alTeclear);
  }, []);

  function ir(href: string) {
    setAbierta(false);
    setTexto("");
    router.push(href);
  }

  const filtro = normalizar(texto);
  const secciones = seccionesVisibles().filter((s) => normalizar(s.titulo).includes(filtro));

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setAbierta(true)}
        aria-label="Ir a… (Ctrl+K)"
        className="gap-2 text-muted-foreground"
      >
        <Search aria-hidden />
        <span className="hidden sm:inline">Ir a</span>
        <kbd className="hidden rounded border px-1.5 font-mono text-[10px] md:inline">Ctrl K</kbd>
      </Button>

      <CommandDialog open={abierta} onOpenChange={setAbierta} titulo="Ir a…" descripcion="Escribí o elegí una sección.">
        <CommandInput value={texto} onValueChange={setTexto} placeholder="Ir a…" />
        <CommandList>
          {secciones.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Nada coincide con «{texto}».</p>}
          {secciones.length > 0 && (
            <CommandGroup heading="Ir a">
              {secciones.map(({ href, titulo, icono: Icono }) => (
                <CommandItem key={href} value={href} onSelect={() => ir(href)}>
                  <Icono aria-hidden />
                  {titulo}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
