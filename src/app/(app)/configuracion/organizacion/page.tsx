import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { obtenerContexto } from "@/lib/auth/contexto";
import { puedeConfigurar } from "@/lib/auth/permisos";
import { FormularioOrganizacion } from "./formulario-organizacion";

export const metadata: Metadata = { title: "Empresa" };

export default async function OrganizacionPage() {
  const { usuario, organizacion, rol } = await obtenerContexto();
  if (!puedeConfigurar(rol)) notFound();
  return <FormularioOrganizacion usuarioId={usuario.id} organizacion={organizacion} />;
}
