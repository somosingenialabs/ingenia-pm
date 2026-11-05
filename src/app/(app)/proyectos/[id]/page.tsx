import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EncabezadoProyecto } from "@/components/proyectos/encabezado-proyecto";
import { VistasProyecto } from "@/components/proyectos/vistas-proyecto";
import { obtenerContexto } from "@/lib/auth/contexto";
import { puedeBorrarProyecto, puedeGestionarProyecto } from "@/lib/auth/permisos";
import { listarBloqueosDeProyecto } from "@/lib/data/dependencias/consultas";
import { listarMiembros } from "@/lib/data/miembros/consultas";
import { obtenerProyecto } from "@/lib/data/proyectos/consultas";
import { listarTareasDeProyecto } from "@/lib/data/tareas/consultas";
import { estaCerrada } from "@/lib/data/tareas/reglas";
import { hoyEnZona } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Proyecto" };

export default async function ProyectoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { usuario, organizacion, rol } = await obtenerContexto();
  const db = await crearClienteServidor();
  const hoy = hoyEnZona(organizacion.zonaHoraria);

  // El RLS decide: un colaborador de afuera recibe null, igual que si el proyecto no existiera.
  const proyecto = await obtenerProyecto(db, id, hoy);
  if (!proyecto) notFound();

  const gestiona = puedeGestionarProyecto(rol, proyecto.miembros.some((m) => m.id === usuario.id));
  const [tareasSinBloqueos, bloqueos, miembrosEmpresa] = await Promise.all([
    listarTareasDeProyecto(db, id),
    listarBloqueosDeProyecto(db, id),
    gestiona ? listarMiembros(db, organizacion.id) : Promise.resolve([]),
  ]);
  // Una tarea ya cerrada no está bloqueada por nada.
  const tareas = tareasSinBloqueos.map((t) => ({ ...t, bloqueadaPor: estaCerrada(t.estado) ? undefined : bloqueos[t.id] }));

  return (
    <>
      <EncabezadoProyecto
        proyecto={proyecto}
        gestiona={gestiona}
        puedeBorrar={puedeBorrarProyecto(rol)}
        personasEmpresa={miembrosEmpresa.filter((m) => m.activo)}
      />
      <VistasProyecto proyectoId={id} tareas={tareas} personas={proyecto.miembros} gestiona={gestiona} usuarioId={usuario.id} hoy={hoy} />
    </>
  );
}
