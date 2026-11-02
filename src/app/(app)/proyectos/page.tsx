import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { TablaProyectos } from "@/components/proyectos/tabla-proyectos";
import { obtenerContexto } from "@/lib/auth/contexto";
import { puedeCrearProyecto } from "@/lib/auth/permisos";
import { listarMiembros } from "@/lib/data/miembros/consultas";
import { listarProyectos } from "@/lib/data/proyectos/consultas";
import { hoyEnZona } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Proyectos" };

export default async function ProyectosPage() {
  const { usuario, organizacion, rol } = await obtenerContexto();
  const db = await crearClienteServidor();
  const [proyectos, miembros] = await Promise.all([
    listarProyectos(db, { hoy: hoyEnZona(organizacion.zonaHoraria) }),
    listarMiembros(db, organizacion.id),
  ]);

  return (
    <>
      <PageHeader titulo="Proyectos" descripcion="Avance y salud de cada proyecto." />
      <TablaProyectos
        proyectos={proyectos}
        personas={miembros.filter((m) => m.activo)}
        puedeCrear={puedeCrearProyecto(rol)}
        usuarioId={usuario.id}
      />
    </>
  );
}
