/**
 * Traduce un error técnico (red, sesión vencida, permisos, Postgres) a una frase que entienda
 * quien usa la app. El detalle crudo se deja en la consola, no en pantalla.
 */
export function mensajeDeError(error: unknown): string {
  const texto = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const t = texto.toLowerCase();
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return "Parece que no hay conexión. Revisá tu internet y probá de nuevo.";
  }
  if (/failed to fetch|networkerror|load failed|network request failed|fetch failed|timeout|timed out/.test(t)) {
    return "No pudimos conectarnos. Revisá tu internet y probá de nuevo.";
  }
  if (/jwt|refresh token|not authenticated|sesi[oó]n/.test(t)) {
    return "Tu sesión venció. Ingresá de nuevo para seguir.";
  }
  if (/row-level security|permission denied|not allowed|no autorizado|forbidden/.test(t)) {
    return "No tenés permiso para hacer esto.";
  }
  if (/duplicate key|unique constraint|ya existe|already/.test(t)) {
    return "Eso ya estaba registrado. Actualizá la pantalla para verlo.";
  }
  return "Algo salió mal de nuestro lado. Probá de nuevo; si sigue, avisá a soporte.";
}

/** ¿Es un error de sesión vencida? Las pantallas pueden ofrecer ir a /ingresar. */
export function esSesionVencida(error: unknown): boolean {
  const texto = error instanceof Error ? error.message : "";
  return /jwt|refresh token|not authenticated/i.test(texto);
}
