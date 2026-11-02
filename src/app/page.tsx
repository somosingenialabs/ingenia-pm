import { redirect } from "next/navigation";

// La raíz no tiene pantalla propia: el inicio es /inicio (el proxy ya mandó a /ingresar si no hay sesión).
export default function Raiz() {
  redirect("/inicio");
}
