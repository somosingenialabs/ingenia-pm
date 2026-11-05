import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { crearPersona, crearProyectoDePrueba, crearTareaDePrueba, elementosChicos, ingresar } from "./ayudas";

/** Una persona nueva con dos tareas a su nombre, en un proyecto propio. */
async function armar(request: APIRequestContext, rotulo: string) {
  const colab = await crearPersona(request, `colab-horas-${rotulo}`);
  const proyectoId = await crearProyectoDePrueba(request, `Horas ${rotulo} ${Date.now()}`, [colab.id]);
  const titulo1 = `Medir A ${rotulo} ${Date.now()}`;
  const titulo2 = `Medir B ${rotulo} ${Date.now()}`;
  const t1 = await crearTareaDePrueba(request, proyectoId, titulo1, colab.id);
  const t2 = await crearTareaDePrueba(request, proyectoId, titulo2, colab.id, 2000);
  return { colab, t1: { id: t1, titulo: titulo1 }, t2: { id: t2, titulo: titulo2 } };
}

/** El temporizador visible: en el encabezado (escritorio) o sobre la barra de pestañas (celular). */
const temporizador = (page: Page) => page.getByRole("group", { name: "Temporizador" }).filter({ visible: true });

test("iniciar, recargar, ver el tiempo corriendo, detener y ver el registro", async ({ page, request }) => {
  const { colab, t1 } = await armar(request, "recargar");
  await ingresar(page, colab.email);
  await page.goto("/mis-tareas");

  await page.getByRole("button", { name: `Iniciar el temporizador en ${t1.titulo}` }).click();
  await expect(temporizador(page)).toContainText(t1.titulo);
  await expect(temporizador(page).getByRole("timer")).toHaveText(/^0:00:\d\d$/);

  // El estado sale de la base: sobrevive a recargar, y el reloj sigue desde el inicio guardado.
  await page.reload();
  await expect(temporizador(page)).toContainText(t1.titulo);
  await expect(temporizador(page).getByRole("timer")).not.toHaveText("0:00:00");
  await expect(temporizador(page).getByRole("timer")).not.toHaveText("0:00:01");

  await temporizador(page).getByRole("button", { name: "Detener" }).click();
  await expect(page.getByText(`Guardaste 1 min en «${t1.titulo}».`)).toBeVisible();
  await expect(temporizador(page)).toHaveCount(0);

  // El registro aparece en el detalle de la tarea, con su origen en palabras.
  await page.getByRole("link", { name: t1.titulo }).click();
  const detalle = page.getByRole("dialog", { name: t1.titulo });
  const horas = detalle.getByRole("region", { name: "Horas" });
  await expect(horas).toContainText("1 min registradas");
  await expect(horas.getByRole("listitem")).toHaveCount(1);
  await expect(horas.getByRole("listitem")).toContainText("Temporizador");
});

test("iniciar otro temporizador detiene el anterior y guarda lo suyo", async ({ page, request }) => {
  const { colab, t1, t2 } = await armar(request, "cambiar");
  await ingresar(page, colab.email);
  await page.goto("/mis-tareas");

  await page.getByRole("button", { name: `Iniciar el temporizador en ${t1.titulo}` }).click();
  await expect(temporizador(page)).toContainText(t1.titulo);
  await page.getByRole("button", { name: `Iniciar el temporizador en ${t2.titulo}` }).click();
  await expect(page.getByText(`Se guardó lo de «${t1.titulo}»`)).toBeVisible();
  await expect(temporizador(page)).toContainText(t2.titulo);
  await expect(temporizador(page)).not.toContainText(t1.titulo);
  // La primera ya no corre: su botón vuelve a "Iniciar", y la segunda ofrece "Detener".
  await expect(page.getByRole("button", { name: `Iniciar el temporizador en ${t1.titulo}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Detener el temporizador de ${t2.titulo}` })).toBeVisible();

  await page.goto(`/mis-tareas?tarea=${t1.id}`);
  await expect(page.getByRole("dialog", { name: t1.titulo }).getByRole("region", { name: "Horas" })).toContainText("1 min registradas");

  // Dejar la base limpia para los demás tests de esta persona.
  await page.goto("/mis-tareas");
  await temporizador(page).getByRole("button", { name: "Detener" }).click();
  await expect(temporizador(page)).toHaveCount(0);
});

test("carga manual con 1:30 desde Mis horas", async ({ page, request, isMobile }) => {
  const { colab, t1 } = await armar(request, "manual");
  await ingresar(page, colab.email);
  await page.goto("/horas");
  await expect(page.getByRole("heading", { name: "Mis horas", level: 1 })).toBeVisible();

  await page.getByRole("button", { name: "Cargar horas", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Cargar horas" });
  await dialogo.getByRole("combobox", { name: "Tarea" }).click();
  await page.getByPlaceholder("Buscar tarea…").fill(t1.titulo);
  await page.getByRole("option", { name: new RegExp(t1.titulo) }).click();
  await dialogo.getByLabel("Duración").fill("1:30");
  await dialogo.getByRole("button", { name: "Cargar", exact: true }).click();
  await expect(page.getByText("Horas cargadas.")).toBeVisible();

  if (isMobile) {
    // A 375 px: lista por día, no grilla.
    await expect(page.getByRole("table")).toBeHidden();
    await expect(page.getByRole("listitem").filter({ hasText: t1.titulo })).toContainText("1 h 30 min");
  } else {
    const fila = page.getByRole("row", { name: new RegExp(t1.titulo) });
    await expect(fila.getByRole("button", { name: /1 h 30 min\. Ver registros$/ })).toHaveText("1:30");
    await expect(page.getByRole("row", { name: /^Total/ })).toContainText("1:30");
  }
  expect(await elementosChicos(page)).toEqual([]);
});

test("una duración que no se entiende no se carga", async ({ page, request }) => {
  const { colab, t1 } = await armar(request, "invalida");
  await ingresar(page, colab.email);
  await page.goto(`/mis-tareas?tarea=${t1.id}`);
  const horas = page.getByRole("dialog", { name: t1.titulo }).getByRole("region", { name: "Horas" });
  await horas.getByRole("button", { name: "Cargar horas", exact: true }).click();
  const dialogo = page.getByRole("dialog", { name: "Cargar horas" });
  await dialogo.getByLabel("Duración").fill("una hora");
  await dialogo.getByRole("button", { name: "Cargar", exact: true }).click();
  await expect(dialogo.getByText("No entendimos la duración.")).toBeVisible();
  await dialogo.getByLabel("Duración").fill("45m");
  await dialogo.getByRole("button", { name: "Cargar", exact: true }).click();
  await expect(horas).toContainText("45 min registradas");
});
