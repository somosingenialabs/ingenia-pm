import { readFileSync } from "node:fs";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

// Usuarios del seed (supabase/seed/10_usuarios.sql). Contraseña de desarrollo: ver README.
export const CLAVE_DESARROLLO = process.env.CLAVE_PRUEBA ?? "prueba1234";

export async function ingresar(page: Page, email: string) {
  await page.goto("/ingresar");
  await page.getByLabel("Mail").fill(email);
  await page.getByLabel("Contraseña").fill(CLAVE_DESARROLLO);
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page).toHaveURL(/\/inicio$/);
}

// Bandeja de mails de Supabase local (Mailpit), con el puerto de supabase/config.toml.
const MAILPIT = "http://127.0.0.1:55324";

/** Enlace del mail más nuevo que le llegó a `email`. Espera a que llegue. */
export async function enlaceDelUltimoMail(request: APIRequestContext, email: string) {
  const desde = Date.now();
  let enlace = "";
  await expect(async () => {
    const busqueda = await request.get(`${MAILPIT}/api/v1/search`, { params: { query: `to:"${email}"`, limit: "1" } });
    const { messages } = (await busqueda.json()) as { messages: { ID: string; Created: string }[] };
    const ultimo = messages[0];
    expect(ultimo && Date.parse(ultimo.Created)).toBeGreaterThan(desde - 30_000);
    const mail = (await (await request.get(`${MAILPIT}/api/v1/message/${ultimo!.ID}`)).json()) as { Text: string };
    enlace = mail.Text.match(/https?:\/\/\S+\/auth\/v1\/verify\S+/)?.[0] ?? "";
    expect(enlace).not.toBe("");
  }).toPass({ timeout: 15_000 });
  return enlace;
}

/** Variable de .env.local: Playwright no la carga sola. */
export function variableLocal(nombre: string) {
  const env = readFileSync(".env.local", "utf8");
  return env.match(new RegExp(`^${nombre}=(.+)$`, "m"))?.[1]?.trim() ?? "";
}

export const API_SUPABASE = "http://127.0.0.1:55321";

/** Activa o desactiva a una persona con la clave secreta. Solo para preparar un test. */
export async function cambiarActivo(request: APIRequestContext, usuarioId: string, activo: boolean) {
  const clave = variableLocal("SUPABASE_SECRET_KEY");
  const respuesta = await request.patch(`${API_SUPABASE}/rest/v1/miembros?usuario_id=eq.${usuarioId}`, {
    headers: { apikey: clave, Authorization: `Bearer ${clave}` },
    data: { activo },
  });
  expect(respuesta.ok()).toBe(true);
}

export const ORG_A = "10000000-0000-4000-a000-000000000000";
export const ORG_B = "20000000-0000-4000-b000-000000000000";
export const PM1 = "00000000-0000-4000-a000-000000000002";

function encabezadosSecretos() {
  const clave = variableLocal("SUPABASE_SECRET_KEY");
  return { apikey: clave, Authorization: `Bearer ${clave}`, Prefer: "return=representation" };
}

/** Escribe en la base con la clave secreta. Solo para preparar un test. */
export async function escribir(request: APIRequestContext, tabla: string, data: object) {
  const respuesta = await request.post(`${API_SUPABASE}/rest/v1/${tabla}`, { headers: encabezadosSecretos(), data });
  expect(respuesta.ok(), await respuesta.text()).toBe(true);
  return ((await respuesta.json()) as { id: string }[])[0]!;
}

export async function actualizar(request: APIRequestContext, ruta: string, data: object) {
  const respuesta = await request.patch(`${API_SUPABASE}/rest/v1/${ruta}`, { headers: encabezadosSecretos(), data });
  expect(respuesta.ok(), await respuesta.text()).toBe(true);
}

/**
 * Persona nueva con su empresa. Los usuarios del seed los cambian otros tests en paralelo (la
 * contraseña, o los desactivan), y los tests SQL cuentan sus proyectos: acá no se tocan.
 */
export async function crearPersona(request: APIRequestContext, rotulo: string, rol: "colaborador" | "pm" | "admin" = "colaborador", org = ORG_A) {
  const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `${rotulo}-${sufijo}@prueba.test`;
  const nombre = `Persona ${rotulo} ${sufijo}`;
  const respuesta = await request.post(`${API_SUPABASE}/auth/v1/admin/users`, {
    headers: encabezadosSecretos(),
    data: { email, password: CLAVE_DESARROLLO, email_confirm: true, user_metadata: { nombre_completo: nombre } },
  });
  expect(respuesta.ok(), await respuesta.text()).toBe(true);
  const { id } = (await respuesta.json()) as { id: string };
  await escribir(request, "miembros", { organizacion_id: org, usuario_id: id, rol });
  await actualizar(request, `perfiles?id=eq.${id}`, { organizacion_activa_id: org });
  return { id, email, nombre };
}

/** Proyecto de la empresa A, a cargo de pm1, con esos miembros de más. */
export async function crearProyectoDePrueba(request: APIRequestContext, nombre: string, miembros: string[] = []) {
  const { id } = await escribir(request, "proyectos", { organizacion_id: ORG_A, nombre, estado: "activo", responsable_id: PM1 });
  for (const usuario_id of miembros) {
    await request.post(`${API_SUPABASE}/rest/v1/proyecto_miembros`, {
      headers: encabezadosSecretos(),
      data: { organizacion_id: ORG_A, proyecto_id: id, usuario_id },
    });
  }
  return id;
}

export async function crearTareaDePrueba(request: APIRequestContext, proyectoId: string, titulo: string, asignadoId: string | null, posicion = 1000) {
  const { id } = await escribir(request, "tareas", { organizacion_id: ORG_A, proyecto_id: proyectoId, titulo, asignado_id: asignadoId, posicion });
  return id;
}

const MINIMO_TACTIL = 44;

/** Todo lo que se toca y se ve, con su tamaño. */
export async function elementosChicos(page: Page) {
  const todos = await page.evaluate(() => {
    const selector =
      "a[href], button, input, select, textarea, [role=button], [role=tab], [role=radio], [role=combobox], [role=checkbox], [role=switch], [role=menuitem], [role=menuitemradio]";
    return [...document.querySelectorAll<HTMLElement>(selector)].flatMap((el) => {
      const r = el.getBoundingClientRect();
      const estilo = getComputedStyle(el);
      const visible = r.width > 1 && r.height > 1 && estilo.visibility !== "hidden" && estilo.display !== "none";
      if (!visible || el.closest("[aria-hidden=true], [inert]")) return [];
      const nombre = (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40);
      return [{ el: `${el.tagName.toLowerCase()} "${nombre}"`, ancho: Math.round(r.width), alto: Math.round(r.height) }];
    });
  });
  return todos.filter((m) => m.ancho < MINIMO_TACTIL || m.alto < MINIMO_TACTIL);
}
