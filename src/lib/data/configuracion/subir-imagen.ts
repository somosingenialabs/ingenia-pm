import { crearClienteNavegador } from "@/lib/supabase/client";
import { TAMANO_MAXIMO_IMAGEN, TIPOS_DE_IMAGEN } from "@/lib/validaciones/configuracion";

const EXTENSION: Record<(typeof TIPOS_DE_IMAGEN)[number], string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * Sube una imagen a la carpeta de quien la elige, en el navegador. El límite y los tipos los hace
 * cumplir el bucket; esto solo avisa antes de hacer esperar. Devuelve la ruta o un mensaje de error.
 */
export async function subirImagen(archivo: File, usuarioId: string, prefijo: string): Promise<{ ruta: string } | { error: string }> {
  const extension = EXTENSION[archivo.type as keyof typeof EXTENSION];
  if (!extension) return { error: "Elegí una imagen PNG, JPG o WebP." };
  if (archivo.size > TAMANO_MAXIMO_IMAGEN) return { error: "La imagen pesa más de 2 MB. Elegí una más liviana." };

  // Nombre nuevo cada vez: así el navegador no sigue mostrando la imagen anterior guardada en su caché.
  const ruta = `${usuarioId}/${prefijo}-${Date.now()}.${extension}`;
  const { error } = await crearClienteNavegador().storage.from("avatares").upload(ruta, archivo, { contentType: archivo.type });
  if (error) return { error: "No pudimos subir la imagen. Probá de nuevo." };
  return { ruta };
}
