import { expect, test, type APIRequestContext } from "@playwright/test";
import { crearPersona, escribir, ingresar, ORG_A } from "./ayudas";

const ZONA = "America/Argentina/Buenos_Aires";

/** Lunes y viernes de esta semana, en Argentina. */
function semanaActual() {
  const hoy = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date())}T12:00:00Z`);
  const lunes = new Date(hoy);
  lunes.setUTCDate(hoy.getUTCDate() - ((hoy.getUTCDay() + 6) % 7));
  const viernes = new Date(lunes);
  viernes.setUTCDate(lunes.getUTCDate() + 4);
  return { lunes: lunes.toISOString().slice(0, 10), viernes: viernes.toISOString().slice(0, 10) };
}

/** Una persona con 50 h estimadas esta semana (sobre 40 de capacidad) y una tarea sin estimar. */
async function armar(request: APIRequestContext, rotulo: string) {
  const { lunes, viernes } = semanaActual();
  const pm = await crearPersona(request, `pm-carga-${rotulo}`, "pm");
  const colab = await crearPersona(request, `colab-carga-${rotulo}`);
  const proyecto = await escribir(request, "proyectos", { organizacion_id: ORG_A, nombre: `Carga ${rotulo} ${Date.now()}`, estado: "activo", responsable_id: pm.id });
  await escribir(request, "proyecto_miembros", { organizacion_id: ORG_A, proyecto_id: proyecto.id, usuario_id: colab.id });
  const titulo = `Pesada ${rotulo} ${Date.now()}`;
  await escribir(request, "tareas", { organizacion_id: ORG_A, proyecto_id: proyecto.id, titulo, asignado_id: colab.id, fecha_inicio: lunes, fecha_limite: viernes, horas_estimadas: 50 });
  await escribir(request, "tareas", { organizacion_id: ORG_A, proyecto_id: proyecto.id, titulo: `Sin estimar ${rotulo}`, asignado_id: colab.id, fecha_limite: viernes });
  return { pm, colab, proyectoId: proyecto.id, titulo };
}

test("el PM ve la sobrecarga, por qué puede quedar corta y las tareas de la celda", async ({ page, request, isMobile }) => {
  const datos = await armar(request, "pm");
  await ingresar(page, datos.pm.email);
  await page.goto(`/carga?proyecto=${datos.proyectoId}`);
  await expect(page.getByText("Sin contar feriados.", { exact: false }).filter({ visible: true })).toBeVisible();

  const celda = page.getByRole("button", { name: new RegExp(`^${datos.colab.nombre}.*50 h de 40 h, 125`) }).filter({ visible: true });
  await expect(celda).toHaveCount(1);
  await expect(celda).toContainText("Sobrecargada");
  await expect(page.getByText("1 sin estimar").filter({ visible: true })).toBeVisible();

  if (isMobile) await expect(page.getByRole("combobox", { name: "Semana" }).filter({ visible: true })).toContainText("Esta semana");

  await celda.click();
  const hoja = page.getByRole("dialog", { name: datos.colab.nombre });
  await expect(hoja.getByRole("link", { name: datos.titulo })).toBeVisible();
  await expect(hoja.getByRole("heading", { name: "Sin estimar" })).toBeVisible();

  // Abrir la tarea cierra la hoja y muestra el detalle.
  await hoja.getByRole("link", { name: datos.titulo }).click();
  await expect(page.getByRole("dialog", { name: datos.titulo })).toBeVisible();
});

test("el colaborador ve solo su fila", async ({ page, request }) => {
  const datos = await armar(request, "colab");
  await ingresar(page, datos.colab.email);
  await page.goto("/carga");
  await expect(page.getByText("Tus horas asignadas por semana").filter({ visible: true })).toBeVisible();
  const personas = page.getByRole("button", { name: /Ver tareas$/ }).filter({ visible: true });
  // Escritorio: 8 celdas de una sola persona. Celular: una tarjeta.
  await expect(personas.first()).toBeVisible();
  const nombres = await personas.evaluateAll((botones) => [...new Set(botones.map((b) => b.getAttribute("aria-label")!.split(",")[0]!.split(":")[0]))]);
  expect(nombres).toEqual([datos.colab.nombre]);
  await expect(page.getByText(datos.pm.nombre)).toHaveCount(0);
});
