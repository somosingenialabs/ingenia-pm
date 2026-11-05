import { expect, test, type APIRequestContext } from "@playwright/test";
import { crearPersona, escribir, ingresar, ORG_A } from "./ayudas";

const ZONA = "America/Argentina/Buenos_Aires";

function diaDesdeHoy(dias: number) {
  const hoy = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date())}T12:00:00-03:00`);
  hoy.setUTCDate(hoy.getUTCDate() + dias);
  return hoy.toISOString().slice(0, 10);
}

/** Proyecto con dos tareas: A arranca hoy, y B termina en 5 días (si A depende de B, choca). */
async function armar(request: APIRequestContext, rotulo: string) {
  const sufijo = `${rotulo} ${Date.now()}`;
  const pm = await crearPersona(request, `pm-dep-${rotulo}`, "pm");
  const colab = await crearPersona(request, `colab-dep-${rotulo}`);
  const proyecto = await escribir(request, "proyectos", { organizacion_id: ORG_A, nombre: `Dependencias ${sufijo}`, estado: "activo", responsable_id: pm.id });
  await escribir(request, "proyecto_miembros", { organizacion_id: ORG_A, proyecto_id: proyecto.id, usuario_id: colab.id });
  const tarea = async (titulo: string, inicio: string | null, limite: string) =>
    (await escribir(request, "tareas", { organizacion_id: ORG_A, proyecto_id: proyecto.id, titulo, asignado_id: colab.id, fecha_inicio: inicio, fecha_limite: limite })).id;
  const a = { titulo: `Montar ${sufijo}`, id: await tarea(`Montar ${sufijo}`, diaDesdeHoy(0), diaDesdeHoy(2)) };
  const b = { titulo: `Comprar ${sufijo}`, id: await tarea(`Comprar ${sufijo}`, null, diaDesdeHoy(5)) };
  return { pm, colab, proyectoId: proyecto.id, a, b };
}

test("el gestor suma una dependencia: avisa el conflicto y marca el tablero", async ({ page, request }) => {
  const datos = await armar(request, "gestor");
  await ingresar(page, datos.pm.email);

  await page.goto(`/proyectos/${datos.proyectoId}?tarea=${datos.a.id}`);
  const detalle = page.getByRole("dialog", { name: datos.a.titulo });
  await expect(detalle.getByRole("heading", { name: "Dependencias" })).toBeVisible();
  await detalle.getByRole("combobox", { name: "Tarea de la que depende" }).click();
  await page.getByRole("option", { name: datos.b.titulo }).click();
  await detalle.getByRole("button", { name: "Agregar" }).first().click();

  // Se guarda igual, y avisa que A arranca antes de que termine B.
  await expect(page.getByText(`Esta tarea arranca antes de que termine «${datos.b.titulo}».`)).toBeVisible();
  await expect(detalle.getByRole("link", { name: datos.b.titulo })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(detalle).toBeHidden();
  await expect(page.getByText(`Bloqueada por «${datos.b.titulo}»`).filter({ visible: true }).first()).toBeVisible();

  // Del otro lado, B muestra que bloquea a A.
  await page.goto(`/proyectos/${datos.proyectoId}?tarea=${datos.b.id}`);
  const otro = page.getByRole("dialog", { name: datos.b.titulo });
  await expect(otro.getByRole("link", { name: datos.a.titulo })).toBeVisible();
});

test("la base rechaza un ciclo con un mensaje claro", async ({ page, request }) => {
  const datos = await armar(request, "ciclo");
  const c = (await escribir(request, "tareas", { organizacion_id: ORG_A, proyecto_id: datos.proyectoId, titulo: `Probar ${Date.now()}` })).id;
  // A depende de B, y C de A. Si B dependiera de C, se cerraría el círculo.
  await escribir(request, "tarea_dependencias", { organizacion_id: ORG_A, tarea_id: datos.a.id, depende_de_id: datos.b.id });
  await escribir(request, "tarea_dependencias", { organizacion_id: ORG_A, tarea_id: c, depende_de_id: datos.a.id });

  await ingresar(page, datos.pm.email);
  await page.goto(`/proyectos/${datos.proyectoId}?tarea=${datos.b.id}`);
  const detalle = page.getByRole("dialog", { name: datos.b.titulo });
  await detalle.getByRole("combobox", { name: "Tarea de la que depende" }).click();
  await page.getByRole("option", { name: /^Probar/ }).click();
  await detalle.getByRole("button", { name: "Agregar" }).first().click();
  await expect(detalle.getByRole("alert")).toHaveText("Esa dependencia arma un ciclo entre tareas. Sacá una de las dos.");
});

test("el colaborador ve que está bloqueada, pero no edita dependencias", async ({ page, request }) => {
  const datos = await armar(request, "colab");
  await escribir(request, "tarea_dependencias", { organizacion_id: ORG_A, tarea_id: datos.a.id, depende_de_id: datos.b.id });

  await ingresar(page, datos.colab.email);
  await page.goto(`/proyectos/${datos.proyectoId}`);
  await expect(page.getByText(`Bloqueada por «${datos.b.titulo}»`).filter({ visible: true }).first()).toBeVisible();
  await page.goto(`/proyectos/${datos.proyectoId}?tarea=${datos.a.id}`);
  const detalle = page.getByRole("dialog", { name: datos.a.titulo });
  await expect(detalle.getByLabel("Título")).toBeVisible();
  await expect(detalle.getByRole("heading", { name: "Dependencias" })).toHaveCount(0);
});

test("en el calendario, elegir una tarea resalta sus dependencias", async ({ page, request, isMobile }) => {
  test.skip(isMobile, "En el celular arranca en Agenda; el resaltado se prueba en Mes");
  const datos = await armar(request, "resaltado");
  await escribir(request, "tarea_dependencias", { organizacion_id: ORG_A, tarea_id: datos.a.id, depende_de_id: datos.b.id });

  await ingresar(page, datos.pm.email);
  await page.goto(`/calendario?proyecto=${datos.proyectoId}`);
  await page.locator(".rbc-event", { hasText: datos.a.titulo }).getByRole("button").click();
  await page.keyboard.press("Escape");
  await expect(page.getByText(`«${datos.a.titulo}» depende de 1 tarea y bloquea 0 tareas.`)).toBeVisible();
  await expect(page.locator(".rbc-event", { hasText: datos.b.titulo })).toHaveClass(/evento-relacionado/);
  // El aviso de conflicto también está en el evento, con texto accesible.
  await expect(page.locator(".rbc-event", { hasText: datos.a.titulo }).getByRole("button")).toHaveAccessibleName(/Conflicto: arranca antes de que termine/);
});
