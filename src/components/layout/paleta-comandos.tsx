"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, FolderKanban, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import type { Rol } from "@/lib/auth/tipos";
import { buscarTareas } from "@/lib/data/tareas/consultas";
import { crearClienteNavegador } from "@/lib/supabase/client";
import { seccionesVisibles } from "./navegacion";

/** Sin acentos y en minúsculas, para que "configuracion" encuentre "Configuración". */
export function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

/** Espera entre teclas antes de buscar tareas (ms). */
const ESPERA = 200;

/** Proyectos que veo y, de esos, en cuáles puedo crear tareas. */
async function proyectosParaPaleta(usuarioId: string, rol: Rol) {
  const db = crearClienteNavegador();
  const { data, error } = await db
    .from("proyectos")
    .select("id, nombre, proyecto_miembros(usuario_id)")
    .is("eliminado_en", null)
    .not("estado", "in", "(terminado,cancelado)")
    .order("nombre");
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    gestiona: rol === "admin" || (rol === "pm" && p.proyecto_miembros.some((m) => m.usuario_id === usuarioId)),
  }));
}

/** Paleta de comandos (Ctrl/Cmd+K): ir a una sección, a un proyecto o a una tarea, y nueva tarea. */
export function PaletaComandos({ usuarioId, rol }: { usuarioId: string; rol: Rol }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [texto, setTexto] = useState("");
  const [busqueda, setBusqueda] = useState("");

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

  useEffect(() => {
    const espera = setTimeout(() => setBusqueda(texto.trim()), ESPERA);
    return () => clearTimeout(espera);
  }, [texto]);

  const proyectos = useQuery({
    queryKey: ["paleta-proyectos", usuarioId],
    queryFn: () => proyectosParaPaleta(usuarioId, rol),
    enabled: abierta,
  });
  const tareas = useQuery({
    queryKey: ["paleta-tareas", busqueda],
    queryFn: () => buscarTareas(crearClienteNavegador(), busqueda),
    enabled: abierta && busqueda.length >= 2,
  });

  function ir(href: string) {
    setAbierta(false);
    setTexto("");
    router.push(href);
  }

  const filtro = normalizar(texto);
  const coincide = (nombre: string) => normalizar(nombre).includes(filtro);
  const secciones = seccionesVisibles().filter((s) => coincide(s.titulo));
  const proyectosVisibles = (proyectos.data ?? []).filter((p) => coincide(p.nombre)).slice(0, 8);
  const paraNuevaTarea = (proyectos.data ?? [])
    .filter((p) => p.gestiona && (coincide(`Nueva tarea en ${p.nombre}`) || coincide(p.nombre)))
    .slice(0, 5);
  const tareasVisibles = busqueda.length >= 2 ? (tareas.data ?? []) : [];
  const sinNada = secciones.length + proyectosVisibles.length + paraNuevaTarea.length + tareasVisibles.length === 0;

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

      <CommandDialog open={abierta} onOpenChange={setAbierta} titulo="Ir a…" descripcion="Buscá una sección, un proyecto o una tarea.">
        <CommandInput value={texto} onValueChange={setTexto} placeholder="Buscá una sección, un proyecto o una tarea…" />
        <CommandList>
          {sinNada && !proyectos.isPending && !tareas.isFetching && (
            <p className="py-6 text-center text-sm text-muted-foreground">Nada coincide con «{texto}».</p>
          )}
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
          {proyectosVisibles.length > 0 && (
            <CommandGroup heading="Proyectos">
              {proyectosVisibles.map((p) => (
                <CommandItem key={p.id} value={`proyecto-${p.id}`} onSelect={() => ir(`/proyectos/${p.id}`)}>
                  <FolderKanban aria-hidden />
                  {p.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {tareasVisibles.length > 0 && (
            <CommandGroup heading="Tareas">
              {tareasVisibles.map((t) => (
                <CommandItem key={t.id} value={`tarea-${t.id}`} onSelect={() => ir(`/proyectos/${t.proyectoId}?tarea=${t.id}`)}>
                  <CheckCircle2 aria-hidden />
                  {t.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {paraNuevaTarea.length > 0 && (
            <CommandGroup heading="Crear">
              {paraNuevaTarea.map((p) => (
                <CommandItem key={p.id} value={`nueva-${p.id}`} onSelect={() => ir(`/proyectos/${p.id}?nueva-tarea=1`)}>
                  <Plus aria-hidden />
                  Nueva tarea en {p.nombre}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
