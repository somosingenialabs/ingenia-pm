const BASE = "http://interno.invalid";

/**
 * Destino al que se puede redirigir después del callback: siempre una ruta de este sitio.
 * Lo que venga de afuera (URL externa, "//otro.sitio", "/\otro.sitio") vuelve al inicio.
 */
export function destinoSeguro(destino: string | null | undefined, porDefecto = "/inicio"): string {
  if (!destino || !destino.startsWith("/")) return porDefecto;
  // Los navegadores tratan "\" como "/" e ignoran tabulaciones y saltos de línea.
  if (/[\\\u0000-\u001f]/.test(destino)) return porDefecto;
  try {
    const url = new URL(destino, BASE);
    if (url.origin !== BASE) return porDefecto;
    return `${url.pathname}${url.search}`;
  } catch {
    return porDefecto;
  }
}
