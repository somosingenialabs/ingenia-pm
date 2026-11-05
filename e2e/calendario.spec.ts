import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { API_SUPABASE, crearPersona, escribir, ingresar, ORG_A, variableLocal } from "./ayudas";

// Cada test arma su proyecto y lo filtra con ?proyecto=, así no lo molestan los demás datos.

const ZONA = "America/Argentina/Buenos_Aires";

/** Fecha de hoy en Argentina, con el día cambiado. */
function diaDelMes(dia: number) {
  const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
  return `${hoy.slice(0, 8)}${String(dia).padStart(2, "0")}`;
}

function hoyEnArgentina() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA }).format(new Date());
}

async function armarProyecto(request: APIRequestContext, rotulo: string, fechaLimite: string) {
  const pm = await crearPersona(request, `pm-cal-${rotulo}`, "pm");
  const colab = await crearPersona(request, `colab-cal-${rotulo}`);
  const proyecto = await escribir(request, "proyectos", { organizacion_id: ORG_A, nombre: `Calendario ${rotulo} ${Date.now()}`, estado: "activo", responsable_id: pm.id });
  await escribir(request, "proyecto_miembros", { organizacion_id: ORG_A, proyecto_id: proyecto.id, usuario_id: colab.id });
  const titulo = `Plazo ${rotulo} ${Date.now()}`;
  const tarea = await escribir(request, "tareas", { organizacion_id: ORG_A, proyecto_id: proyecto.id, titulo, asignado_id: colab.id, fecha_limite: fechaLimite });
  return { pm, colab, proyectoId: proyecto.id, tareaId: tarea.id, titulo };
}

async function fechaLimite(request: APIRequestContext, tareaId: string) {
  const clave = variableLocal("SUPABASE_SECRET_KEY");
  const respuesta = await request.get(`${API_SUPABASE}/rest/v1/tareas?id=eq.${tareaId}&select=fecha_limite`, {
    headers: { apikey: clave, Authorization: `Bearer ${clave}` },
  });
  return ((await respuesta.json()) as { fecha_limite: string }[])[0]!.fecha_limite;
}

/** Arrastra el evento al día `dia` del mes que se ve, con el mouse. */
async function arrastrarAlDia(page: Page, titulo: string, dia: number) {
  const evento = page.locator(".rbc-event", { hasText: titulo });
  const destino = page.locator(".rbc-date-cell:not(.rbc-off-range)").getByRole("button", { name: String(dia), exact: true });
  const origen = (await evento.boundingBox())!;
  const caja = (await destino.boundingBox())!;
  await page.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2);
  await page.mouse.down();
  await page.mouse.move(origen.x + origen.width / 2 + 10, origen.y + origen.height / 2 + 5, { steps: 5 });
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height + 20, { steps: 15 });
  await page.mouse.up();
}

test.describe("escritorio", () => {
  test.skip(({ isMobile }) => isMobile, "En el celular no se arrastra");

  test("el gestor arrastra y cambia la fecha; el colaborador no puede", async ({ page, browser, request, baseURL }, info) => {
    const datos = await armarProyecto(request, "arrastre", diaDelMes(10));

    await ingresar(page, datos.pm.email);
    await page.goto(`/calendario?proyecto=${datos.proyectoId}`);
    await expect(page.locator(".rbc-event", { hasText: datos.titulo })).toBeVisible();
    await arrastrarAlDia(page, datos.titulo, 12);
    await expect.poll(() => fechaLimite(request, datos.tareaId)).toBe(diaDelMes(12));

    // El colaborador ve la tarea, pero arrastrarla no cambia nada.
    const contexto = await browser.newContext({ ...info.project.use, baseURL });
    const pagina = await contexto.newPage();
    await ingresar(pagina, datos.colab.email);
    await pagina.goto(`/calendario?proyecto=${datos.proyectoId}`);
    await expect(pagina.locator(".rbc-event", { hasText: datos.titulo })).toBeVisible();
    await expect(pagina.getByText("Para cambiar una fecha, abrí la tarea.")).toBeVisible();
    await arrastrarAlDia(pagina, datos.titulo, 15);
    await pagina.waitForTimeout(1500);
    expect(await fechaLimite(request, datos.tareaId)).toBe(diaDelMes(12));
    await contexto.close();
  });

  test("clic abre el detalle y Duración dibuja de inicio a límite", async ({ page, request }) => {
    const datos = await armarProyecto(request, "clic", diaDelMes(14));
    await ingresar(page, datos.pm.email);
    await page.goto(`/calendario?proyecto=${datos.proyectoId}`);
    await page.getByRole("button", { name: new RegExp(datos.titulo) }).click();
    await expect(page).toHaveURL(new RegExp(`tarea=${datos.tareaId}`));
    await expect(page.getByRole("dialog", { name: datos.titulo })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("radio", { name: "Duración" }).click();
    await expect(page).toHaveURL(/modo=duracion/);
    await expect(page.locator(".rbc-event", { hasText: datos.titulo })).toBeVisible();
  });
});

test("a 375 px abre en Agenda", async ({ page, request, isMobile }) => {
  test.skip(!isMobile, "Solo celular");
  const datos = await armarProyecto(request, "agenda", hoyEnArgentina());
  await ingresar(page, datos.pm.email);
  await page.goto(`/calendario?proyecto=${datos.proyectoId}`);
  await expect(page.getByRole("radio", { name: "Agenda" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: "Semana" })).toHaveCount(0);
  await expect(page.locator(".rbc-agenda-view").getByText(datos.titulo)).toBeVisible();
});

test("a las 23:30 de Argentina, la tarea de hoy sigue en hoy", async ({ page, request }) => {
  const hoy = hoyEnArgentina();
  const datos = await armarProyecto(request, "medianoche", hoy);
  await ingresar(page, datos.pm.email);

  // 23:30 en Argentina ya es el día siguiente en UTC: si algo usara UTC, la tarea se correría.
  await page.clock.install({ time: new Date(`${hoy}T23:30:00-03:00`) });
  await page.goto(`/calendario?proyecto=${datos.proyectoId}`);
  const agenda = page.getByRole("radio", { name: "Agenda" });
  if ((await agenda.getAttribute("aria-checked")) !== "true") await agenda.click();

  const fila = page.locator(".rbc-agenda-view tr", { hasText: datos.titulo });
  const etiqueta = new Intl.DateTimeFormat("es-AR", { timeZone: ZONA, day: "numeric" }).format(new Date(`${hoy}T12:00:00-03:00`));
  await expect(fila.locator(".rbc-agenda-date-cell")).toContainText(new RegExp(`\\b${etiqueta}\\b`));
  // Y es la primera fecha de la Agenda: arranca hoy, no mañana.
  await expect(page.locator(".rbc-agenda-date-cell").first()).toContainText(new RegExp(`\\b${etiqueta}\\b`));
});
