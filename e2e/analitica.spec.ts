import { expect, test, type APIRequestContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { API_SUPABASE, CLAVE_DESARROLLO, crearPersona, crearProyectoDePrueba, crearTareaDePrueba, escribir, ingresar, ORG_A, variableLocal } from "./ayudas";

// Colab1 del seed: tiene horas y tareas hechas en la historia de 12 semanas.
const COLAB1 = "00000000-0000-4000-a000-000000000004";

const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const haceDias = (dias: number) => {
  const d = new Date(`${hoy()}T12:00:00`);
  d.setDate(d.getDate() - dias);
  return d.toISOString().slice(0, 10);
};

/** Una persona nueva con un proyecto propio, una tarea y 90 minutos cargados hoy. */
async function armar(request: APIRequestContext, rotulo: string) {
  const colab = await crearPersona(request, `colab-analitica-${rotulo}`);
  const nombre = `Analítica ${rotulo} ${Date.now()}`;
  const proyectoId = await crearProyectoDePrueba(request, nombre, [colab.id]);
  const tareaId = await crearTareaDePrueba(request, proyectoId, `Medir ${rotulo} ${Date.now()}`, colab.id);
  await escribir(request, "registros_tiempo", { organizacion_id: ORG_A, tarea_id: tareaId, usuario_id: colab.id, origen: "manual", minutos: 90, fecha: hoy() });
  return { colab, proyectoId, proyectoNombre: nombre };
}

test("el colaborador ve solo lo suyo, y la RPC con el id de otro le devuelve solo lo suyo", async ({ page, request }) => {
  const { colab } = await armar(request, "propio");
  await ingresar(page, colab.email);
  await page.goto("/analitica");

  await expect(page.getByRole("heading", { name: "Analítica" })).toBeVisible();
  await expect(page.getByText("Tus datos medidos").filter({ visible: true })).toBeVisible();
  // Sin filtro de persona ni presupuesto, que es de gestión.
  await expect(page.getByRole("combobox", { name: "Persona" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Consumo de presupuesto" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Horas registradas" })).toContainText("1,5 h");

  // Utilización: solo su fila, aunque hay más gente en la empresa.
  const utilizacion = page.getByRole("region", { name: "Utilización por persona" });
  await utilizacion.getByRole("button", { name: "Ver tabla" }).click();
  const filas = utilizacion.getByRole("row");
  await expect(filas).toHaveCount(2);
  await expect(filas.nth(1)).toContainText(colab.nombre);

  // La base fuerza sus datos aunque pida los de otro por la API.
  const cliente = createClient(API_SUPABASE, variableLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: errorIngreso } = await cliente.auth.signInWithPassword({ email: colab.email, password: CLAVE_DESARROLLO });
  expect(errorIngreso).toBeNull();
  const args = { p_desde: haceDias(83), p_hasta: hoy(), p_usuarios: [COLAB1] };
  const horas = await cliente.schema("analitica").rpc("horas_por_periodo", args);
  expect(horas.error).toBeNull();
  expect(horas.data!.length).toBeGreaterThan(0);
  expect((horas.data as { usuario_id: string }[]).every((f) => f.usuario_id === colab.id)).toBe(true);
  const uso = await cliente.schema("analitica").rpc("utilizacion", args);
  expect((uso.data as { usuario_id: string }[]).map((f) => f.usuario_id)).toEqual([colab.id]);
  const presupuesto = await cliente.schema("analitica").rpc("consumo_presupuesto", args);
  expect(presupuesto.data).toEqual([]);
  await cliente.auth.signOut();
});

test("los filtros van en la URL y sobreviven a recargar", async ({ page, request }) => {
  // Persona y proyecto propios: otros tests cambian a la gente del seed mientras tanto.
  const { colab, proyectoId, proyectoNombre } = await armar(request, "filtros");
  const pm = await crearPersona(request, "pm-analitica", "pm");
  await ingresar(page, pm.email);
  await page.goto("/analitica");

  await page.getByRole("radio", { name: /^4 sem/ }).click();
  await expect(page).toHaveURL(/periodo=4/);
  await page.getByRole("combobox", { name: "Proyecto" }).click();
  await page.getByRole("option", { name: proyectoNombre }).click();
  await expect(page).toHaveURL(new RegExp(`proyecto=${proyectoId}`));
  await page.getByRole("combobox", { name: "Persona" }).click();
  await page.getByRole("option", { name: colab.nombre }).click();
  await expect(page).toHaveURL(new RegExp(`persona=${colab.id}`));

  await page.reload();
  await expect(page.getByRole("radio", { name: /^4 sem/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("combobox", { name: "Proyecto" })).toHaveText(proyectoNombre);
  await expect(page.getByRole("combobox", { name: "Persona" })).toHaveText(colab.nombre);
  await expect(page.getByRole("region", { name: "Horas registradas" })).toContainText("1,5 h");
  // Con el filtro, la utilización es solo de esa persona.
  const utilizacion = page.getByRole("region", { name: "Utilización por persona" });
  await utilizacion.getByRole("button", { name: "Ver tabla" }).click();
  await expect(utilizacion.getByRole("row")).toHaveCount(2);

  // A medida: también queda en la URL.
  await page.getByRole("radio", { name: "A medida" }).click();
  await page.getByLabel("Desde").fill(haceDias(20));
  await page.getByLabel("Hasta").fill(haceDias(10));
  await page.getByRole("button", { name: "Ver período" }).click();
  await expect(page).toHaveURL(/periodo=medida/);
  await expect(page).toHaveURL(new RegExp(`desde=${haceDias(20)}`));
  await expect(page).toHaveURL(new RegExp(`hasta=${haceDias(10)}`));
  await page.reload();
  await expect(page.getByRole("radio", { name: "A medida" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Desde")).toHaveValue(haceDias(20));
});

test("con pocos datos aparece el mensaje en vez del número", async ({ page, request }) => {
  const { colab, proyectoId } = await armar(request, "pocos");
  // Dos tareas hechas con plazo: cumplimiento tiene n = 2.
  for (const n of [1, 2]) {
    await escribir(request, "tareas", {
      organizacion_id: ORG_A, proyecto_id: proyectoId, titulo: `Hecha ${n} ${Date.now()}`, asignado_id: colab.id,
      estado: "hecha", fecha_limite: hoy(), horas_estimadas: 1, posicion: n * 1000,
    });
  }
  await ingresar(page, colab.email);
  await page.goto("/analitica");

  await expect(page.getByRole("region", { name: "Cumplimiento de plazos" })).toContainText("Todavía no hay datos suficientes (2 de 5).");
  await expect(page.getByRole("region", { name: "Cumplimiento de plazos" })).not.toContainText("%");
  // Las dos no tienen horas cargadas: no entran en la precisión.
  await expect(page.getByRole("region", { name: "Precisión de estimación" })).toContainText("Todavía no hay datos suficientes (0 de 5).");
  await expect(page.getByRole("region", { name: "Tareas hechas" })).toContainText("2");
});
