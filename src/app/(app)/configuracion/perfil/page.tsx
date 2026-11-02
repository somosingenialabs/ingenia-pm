import type { Metadata } from "next";
import { obtenerContexto } from "@/lib/auth/contexto";
import { FormularioPerfil } from "./formulario-perfil";

export const metadata: Metadata = { title: "Perfil" };

export default async function PerfilPage() {
  const { usuario } = await obtenerContexto();
  return <FormularioPerfil usuarioId={usuario.id} nombre={usuario.nombre} email={usuario.email} avatarUrl={usuario.avatarUrl} />;
}
