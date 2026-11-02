import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { obtenerContexto } from "@/lib/auth/contexto";
import { puedeConfigurar } from "@/lib/auth/permisos";
import { listarInvitacionesPendientes, listarMiembros } from "@/lib/data/miembros/consultas";
import { hoyEnZona } from "@/lib/fechas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { GestionMiembros } from "./gestion-miembros";

export const metadata: Metadata = { title: "Miembros" };

export default async function MiembrosPage() {
  const { usuario, organizacion, rol } = await obtenerContexto();
  if (!puedeConfigurar(rol)) notFound();

  const db = await crearClienteServidor();
  const [miembros, invitaciones] = await Promise.all([
    listarMiembros(db, organizacion.id),
    listarInvitacionesPendientes(db, organizacion.id),
  ]);
  // La fecha se arma acá, en la zona de la empresa: en el navegador podría dar otro día que en el servidor.
  const conFecha = invitaciones.map((i) => ({ ...i, venceEl: hoyEnZona(organizacion.zonaHoraria, new Date(i.venceEn)) }));
  return <GestionMiembros miembros={miembros} invitaciones={conFecha} usuarioId={usuario.id} />;
}
