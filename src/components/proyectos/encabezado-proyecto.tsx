"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, UserMinus, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { mensajeDeError } from "@/components/estado/mensaje-de-error";
import { PageHeader } from "@/components/layout/page-header";
import { AvatarPersona, BarraAvance, EtiquetaSalud } from "@/components/tareas/etiquetas";
import { Button } from "@/components/ui/button";
import { ConfirmarAccion, type ConfirmacionPendiente } from "@/components/ui/confirmar-accion";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HojaAdaptable } from "@/components/ui/hoja-adaptable";
import { Selector } from "@/components/ui/selector";
import type { PersonaRef } from "@/lib/data/comun";
import { agregarMiembro, eliminarProyecto, quitarMiembro } from "@/lib/data/proyectos/acciones";
import type { ProyectoDetalle } from "@/lib/data/proyectos/consultas";
import { formatearFecha } from "@/lib/fechas";
import { NOMBRE_ESTADO_PROYECTO } from "@/lib/validaciones/proyectos";
import { FormularioProyecto } from "./formulario-proyecto";

const MAXIMO_AVATARES = 5;

export function EncabezadoProyecto({
  proyecto,
  gestiona,
  puedeBorrar,
  personasEmpresa,
}: {
  proyecto: ProyectoDetalle;
  gestiona: boolean;
  puedeBorrar: boolean;
  personasEmpresa: PersonaRef[];
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [viendoMiembros, setViendoMiembros] = useState(false);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionPendiente | null>(null);

  function pedirBorrado() {
    setConfirmacion({
      titulo: "¿Borrar este proyecto?",
      descripcion: `«${proyecto.nombre}» y sus tareas dejan de verse para todo el equipo.`,
      etiqueta: "Borrar proyecto",
      accion: async () => {
        const resultado = await eliminarProyecto(proyecto.id);
        if (!resultado.ok) {
          toast.error(resultado.error);
          return;
        }
        toast.success("Proyecto borrado.");
        router.push("/proyectos");
      },
    });
  }

  const datos = [proyecto.cliente, NOMBRE_ESTADO_PROYECTO[proyecto.estado]].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader titulo={proyecto.nombre} descripcion={datos} />
      {proyecto.descripcion && <p className="max-w-prose text-sm text-muted-foreground">{proyecto.descripcion}</p>}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <EtiquetaSalud salud={proyecto.salud} />
        <BarraAvance avance={proyecto.avance} className="w-40" />
        {proyecto.fecha_fin_objetivo && (
          <span className="text-xs text-muted-foreground tabular-nums">Objetivo: {formatearFecha(proyecto.fecha_fin_objetivo, { anio: true })}</span>
        )}
        <Button variant="ghost" size="sm" onClick={() => setViendoMiembros(true)} className="-ml-2 gap-2" aria-label={`Miembros del proyecto: ${proyecto.miembros.length}`}>
          <span className="flex -space-x-1.5" aria-hidden>
            {proyecto.miembros.slice(0, MAXIMO_AVATARES).map((m) => (
              <AvatarPersona key={m.id} persona={m} />
            ))}
          </span>
          <Users aria-hidden className="text-muted-foreground" />
          <span className="tabular-nums">{proyecto.miembros.length}</span>
        </Button>
        {(gestiona || puedeBorrar) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Más acciones del proyecto">
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {gestiona && (
                <DropdownMenuItem className="min-h-11" onSelect={() => setEditando(true)}>
                  <Pencil aria-hidden /> Editar proyecto
                </DropdownMenuItem>
              )}
              {puedeBorrar && (
                <DropdownMenuItem className="min-h-11" variant="destructive" onSelect={pedirBorrado}>
                  <Trash2 aria-hidden /> Borrar proyecto
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {editando && (
        <FormularioProyecto
          abierta={editando}
          onCambiar={setEditando}
          proyectoId={proyecto.id}
          personas={personasEmpresa}
          valores={{
            nombre: proyecto.nombre,
            descripcion: proyecto.descripcion ?? "",
            cliente: proyecto.cliente ?? "",
            estado: proyecto.estado,
            responsable_id: proyecto.responsable_id,
            fecha_inicio: proyecto.fecha_inicio ?? "",
            fecha_fin_objetivo: proyecto.fecha_fin_objetivo ?? "",
            horas_presupuestadas: proyecto.horas_presupuestadas === null ? "" : String(proyecto.horas_presupuestadas),
          }}
        />
      )}

      <HojaMiembros abierta={viendoMiembros} onCambiar={setViendoMiembros} proyecto={proyecto} gestiona={gestiona} personasEmpresa={personasEmpresa} />
      <ConfirmarAccion pendiente={confirmacion} onCerrar={() => setConfirmacion(null)} />
    </div>
  );
}

function HojaMiembros({
  abierta,
  onCambiar,
  proyecto,
  gestiona,
  personasEmpresa,
}: {
  abierta: boolean;
  onCambiar: (abierta: boolean) => void;
  proyecto: ProyectoDetalle;
  gestiona: boolean;
  personasEmpresa: PersonaRef[];
}) {
  const [elegido, setElegido] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [conTareas, setConTareas] = useState<{ persona: PersonaRef; cantidad: number } | null>(null);

  const disponibles = personasEmpresa.filter((p) => !proyecto.miembros.some((m) => m.id === p.id));

  async function agregar() {
    if (!elegido) return;
    setEnviando(true);
    try {
      const resultado = await agregarMiembro({ proyectoId: proyecto.id, usuarioId: elegido });
      if (resultado.ok) {
        setElegido("");
        toast.success("Persona sumada al proyecto.");
      } else {
        toast.error(resultado.error);
      }
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  async function quitar(persona: PersonaRef) {
    setConTareas(null);
    try {
      const resultado = await quitarMiembro({ proyectoId: proyecto.id, usuarioId: persona.id });
      if (!resultado.ok) {
        toast.error(resultado.error);
      } else if (!resultado.datos.quitado) {
        setConTareas({ persona, cantidad: resultado.datos.tareasAbiertas });
      } else {
        toast.success(`${persona.nombre} ya no está en el proyecto.`);
      }
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <HojaAdaptable abierta={abierta} onCambiar={onCambiar} titulo="Miembros del proyecto" descripcion={proyecto.nombre}>
      <div className="flex flex-col gap-4">
        {gestiona && (
          <div className="flex items-end gap-2">
            <Selector
              etiquetaAria="Persona para sumar"
              placeholder={disponibles.length === 0 ? "Ya están todos" : "Elegí a quién sumar"}
              valor={elegido}
              onCambiar={setElegido}
              opciones={disponibles.map((p) => ({ valor: p.id, etiqueta: p.nombre }))}
              deshabilitado={disponibles.length === 0}
            />
            <Button onClick={agregar} disabled={!elegido || enviando}>
              <UserPlus aria-hidden /> Sumar
            </Button>
          </div>
        )}

        {conTareas && (
          <div role="alert" className="flex flex-col gap-2 rounded-lg border p-3 text-sm">
            <p>
              {conTareas.persona.nombre} tiene {conTareas.cantidad === 1 ? "1 tarea abierta" : `${conTareas.cantidad} tareas abiertas`} en este proyecto. Reasignalas antes de quitarla.
            </p>
            <Button variant="outline" asChild>
              <Link href={`/proyectos/${proyecto.id}?vista=lista&asignado=${conTareas.persona.id}`} onClick={() => onCambiar(false)}>
                Ver sus tareas
              </Link>
            </Button>
          </div>
        )}

        <ul className="flex flex-col divide-y">
          {proyecto.miembros.map((m) => (
            <li key={m.id} className="flex min-h-12 items-center gap-3">
              <AvatarPersona persona={m} className="size-8" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{m.nombre}</span>
                {m.id === proyecto.responsable_id && <span className="block text-xs text-muted-foreground">Responsable</span>}
              </span>
              {gestiona && m.id !== proyecto.responsable_id && (
                <Button variant="ghost" size="icon" aria-label={`Quitar a ${m.nombre}`} onClick={() => quitar(m)}>
                  <UserMinus aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </HojaAdaptable>
  );
}
