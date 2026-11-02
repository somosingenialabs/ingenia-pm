import { expect, test, type Page } from "@playwright/test";
import { crearPersona, crearProyectoDePrueba, crearTareaDePrueba, elementosChicos, ingresar } from "./ayudas";

// Cada test arma sus propios datos: corren en paralelo y en los dos tamaños.

const P1_DEL_SEED = "12000000-0000-4000-a000-000000000001";
const TAREA_DEL_SEED = "13000000-0000-4000-a000-000000000001";

function esCelular(info: { project: { name: string } }) {
  return info.project.name === "celular";
}

async function elegir(page: Page, campo: string, opcion: string) {
  await page.getByRole("combobox", { name: campo }).click();
  await page.getByRole("option", { name: opcion }).click();
}

function columna(page: Page, nombre: string) {
  return page.getByRole("region", { name: `Columna ${nombre}` });
}

test("recorrido completo: el PM crea, suma, asigna; el colaborador mueve la tarea", async ({ page, browser, request, baseURL }, info) => {
  const colab = await crearPersona(request, "colab");
  const unico = `${info.project.name}-${Date.now()}`;
  const nombreProyecto = `Proyecto ${unico}`;
  const titulo = `Tarea ${unico}`;

  // ===== PM =====
  await ingresar(page, "pm1.a@prueba.test");
  await page.goto("/proyectos");
  await page.getByRole("button", { name: "Nuevo proyecto" }).click();
  await page.getByLabel("Nombre").fill(nombreProyecto);
  await page.getByRole("button", { name: "Crear proyecto" }).click();
  await expect(page).toHaveURL(/\/proyectos\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: nombreProyecto })).toBeVisible();
  const url = page.url();

  await page.getByRole("button", { name: /Miembros del proyecto/ }).click();
  await elegir(page, "Persona para sumar", colab.nombre);
  await page.getByRole("button", { name: "Sumar" }).click();
  const hoja = page.getByRole("dialog", { name: "Miembros del proyecto" });
  await expect(hoja.getByText(colab.nombre)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(hoja).toBeHidden();

  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await page.getByLabel("Título").fill(titulo);
  await elegir(page, "Asignado", colab.nombre);
  await page.getByRole("button", { name: "Crear tarea" }).click();
  await expect(page.getByRole("dialog", { name: "Nueva tarea" })).toBeHidden();
  await expect(page.getByRole("link", { name: titulo }).first()).toBeVisible();

  // ===== Colaborador, en otra sesión =====
  const contexto = await browser.newContext({ ...info.project.use, baseURL });
  const pagina = await contexto.newPage();
  await ingresar(pagina, colab.email);
  await pagina.goto("/proyectos");
  await expect(pagina.getByRole("link", { name: new RegExp(nombreProyecto) }).first()).toBeVisible();
  await pagina.goto(url);

  if (esCelular(info)) {
    await pagina.getByRole("button", { name: `Mover a... ${titulo}` }).click();
    await pagina.getByRole("menuitem", { name: "En curso" }).click();
    await pagina.getByRole("radio", { name: /En curso/ }).click();
    await expect(pagina.getByRole("link", { name: titulo })).toBeVisible();
  } else {
    // Arrastre con mouse.
    const agarre = pagina.getByRole("button", { name: `Mover ${titulo}` });
    const origen = (await agarre.boundingBox())!;
    const destino = (await columna(pagina, "En curso").boundingBox())!;
    await pagina.mouse.move(origen.x + origen.width / 2, origen.y + origen.height / 2);
    await pagina.mouse.down();
    await pagina.mouse.move(origen.x + 40, origen.y + 40, { steps: 5 });
    await pagina.mouse.move(destino.x + destino.width / 2, destino.y + 120, { steps: 10 });
    await pagina.mouse.up();
    await expect(columna(pagina, "En curso").getByRole("link", { name: titulo })).toBeVisible();
  }

  // Quedó guardado, y lo ve el PM.
  // La tarjeta del colaborador se mueve antes de que el servidor termine (es optimista), y todavía
  // no hay realtime: el PM recarga hasta verlo. Si el movimiento se perdiera, esto vence y falla.
  await expect(async () => {
    await page.reload();
    if (esCelular(info)) {
      await page.getByRole("radio", { name: /En curso/ }).click();
      await expect(page.getByRole("link", { name: titulo })).toBeVisible({ timeout: 2_000 });
    } else {
      await expect(columna(page, "En curso").getByRole("link", { name: titulo })).toBeVisible({ timeout: 2_000 });
    }
  }).toPass({ timeout: 20_000 });
  await contexto.close();
});

test("el colaborador no ve el proyecto ajeno, ni escribiendo la URL", async ({ page, request }) => {
  const colab = await crearPersona(request, "ajeno");
  await ingresar(page, colab.email);

  await page.goto(`/proyectos/${P1_DEL_SEED}`);
  await expect(page.getByText("No encontramos esa página")).toBeVisible();

  await page.goto(`/inicio?tarea=${TAREA_DEL_SEED}`);
  await expect(page.getByText("No encontramos esta tarea")).toBeVisible();

  await page.goto("/proyectos");
  await expect(page.getByText("Todavía no hay proyectos").filter({ visible: true }).first()).toBeVisible();
  await expect(page.getByText("Puesta en marcha línea 2")).toHaveCount(0);
});

test("el colaborador no ve controles de gestor", async ({ page, request }, info) => {
  const colab = await crearPersona(request, "sin-gestion");
  const unico = `${info.project.name}-${Date.now()}`;
  const proyecto = await crearProyectoDePrueba(request, `Solo lectura ${unico}`, [colab.id]);
  const mia = `Mía ${unico}`;
  const ajena = `Ajena ${unico}`;
  await crearTareaDePrueba(request, proyecto, mia, colab.id, 1000);
  await crearTareaDePrueba(request, proyecto, ajena, null, 2000);

  await ingresar(page, colab.email);
  await page.goto("/proyectos");
  await expect(page.getByRole("button", { name: "Nuevo proyecto" })).toHaveCount(0);

  await page.goto(`/proyectos/${proyecto}`);
  await expect(page.getByRole("link", { name: mia }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Nueva tarea" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Más acciones del proyecto" })).toHaveCount(0);

  // Agarre solo en la propia.
  const prefijo = esCelular(info) ? "Mover a... " : "Mover ";
  await expect(page.getByRole("button", { name: `${prefijo}${mia}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `${prefijo}${ajena}` })).toHaveCount(0);

  // Lista: sin selección múltiple.
  await page.getByRole("radio", { name: "Lista" }).click();
  await expect(page.getByRole("link", { name: mia }).first()).toBeVisible();
  await expect(page.getByRole("checkbox")).toHaveCount(0);

  // En la propia: estado y descripción activos, el resto de solo lectura, y sin borrar.
  await page.getByRole("link", { name: mia }).first().click();
  const panel = page.getByRole("dialog", { name: mia });
  await expect(panel.getByLabel("Descripción")).toBeEnabled();
  await expect(panel.getByLabel("Título")).toBeDisabled();
  await expect(panel.getByRole("combobox", { name: "Asignado" })).toBeDisabled();
  await expect(panel.getByRole("button", { name: "Borrar" })).toHaveCount(0);
  await panel.getByLabel("Descripción").fill("La edité yo");
  await panel.getByRole("button", { name: "Guardar" }).click();
  await expect(page.getByText("Cambios guardados.")).toBeVisible();

  // En la ajena: nada activo.
  await page.goto(`/proyectos/${proyecto}?vista=lista`);
  await page.getByRole("link", { name: ajena }).first().click();
  const otro = page.getByRole("dialog", { name: ajena });
  await expect(otro.getByText("Solo lectura: esta tarea no está a tu nombre.")).toBeVisible();
  await expect(otro.getByLabel("Descripción")).toBeDisabled();
  await expect(otro.getByRole("button", { name: "Guardar" })).toHaveCount(0);

  // Configuración de la empresa: ni la pestaña ni la pantalla.
  await page.goto("/configuracion/perfil");
  await expect(page.getByRole("link", { name: "Miembros" })).toHaveCount(0);
  await page.goto("/configuracion/miembros");
  await expect(page.getByText("No encontramos esa página")).toBeVisible();
});

test("mover una tarjeta con el teclado", async ({ page, request }, info) => {
  test.skip(esCelular(info), "A 375 px no hay arrastre: se mueve con el menú.");
  const colab = await crearPersona(request, "teclado");
  const unico = Date.now();
  const proyecto = await crearProyectoDePrueba(request, `Teclado ${unico}`, [colab.id]);
  const titulo = `Con teclado ${unico}`;
  await crearTareaDePrueba(request, proyecto, titulo, colab.id);

  await ingresar(page, colab.email);
  await page.goto(`/proyectos/${proyecto}`);
  await page.getByRole("button", { name: `Mover ${titulo}` }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");
  await expect(columna(page, "En curso").getByRole("link", { name: titulo })).toBeVisible();

  await expect(async () => {
    await page.reload();
    await expect(columna(page, "En curso").getByRole("link", { name: titulo })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
});

test("si el movimiento falla, la tarjeta vuelve a su lugar con un aviso", async ({ page, request }, info) => {
  test.skip(esCelular(info), "El camino optimista es el mismo; se prueba una vez.");
  const colab = await crearPersona(request, "falla");
  const unico = Date.now();
  const proyecto = await crearProyectoDePrueba(request, `Falla ${unico}`, [colab.id]);
  const titulo = `Se cae ${unico}`;
  await crearTareaDePrueba(request, proyecto, titulo, colab.id);

  await ingresar(page, colab.email);
  await page.goto(`/proyectos/${proyecto}`);
  await page.route("**/proyectos/**", (ruta) => (ruta.request().method() === "POST" ? ruta.abort() : ruta.continue()));

  await page.getByRole("button", { name: `Mover ${titulo}` }).focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Space");

  await expect(page.getByText(/No pudimos mover la tarea/)).toBeVisible();
  await expect(columna(page, "Por hacer").getByRole("link", { name: titulo })).toBeVisible();
});

test("el detalle se abre por URL y vuelve atrás", async ({ page, request }, info) => {
  const unico = `${info.project.name}-${Date.now()}`;
  const proyecto = await crearProyectoDePrueba(request, `Enlace ${unico}`);
  const titulo = `Compartible ${unico}`;
  const tarea = await crearTareaDePrueba(request, proyecto, titulo, null);

  await ingresar(page, "pm1.a@prueba.test");
  await page.goto(`/proyectos/${proyecto}`);
  await page.getByRole("link", { name: titulo }).first().click();
  await expect(page).toHaveURL(new RegExp(`tarea=${tarea}`));
  await expect(page.getByRole("dialog", { name: titulo })).toBeVisible();

  await page.goBack();
  await expect(page.getByRole("dialog", { name: titulo })).toBeHidden();

  // También desde otra pantalla, con el enlace en la mano.
  await page.goto(`/mis-tareas?tarea=${tarea}`);
  await expect(page.getByRole("dialog", { name: titulo })).toBeVisible();
});

test("quitar a alguien con tareas abiertas pide reasignarlas", async ({ page, request }, info) => {
  const colab = await crearPersona(request, "quitar");
  const unico = `${info.project.name}-${Date.now()}`;
  const proyecto = await crearProyectoDePrueba(request, `Quitar ${unico}`, [colab.id]);
  const tarea = `Abierta ${unico}`;
  await crearTareaDePrueba(request, proyecto, tarea, colab.id);

  await ingresar(page, "pm1.a@prueba.test");
  await page.goto(`/proyectos/${proyecto}`);
  await page.getByRole("button", { name: /Miembros del proyecto/ }).click();
  await page.getByRole("button", { name: `Quitar a ${colab.nombre}` }).click();
  await expect(page.getByRole("alert").filter({ hasText: "1 tarea abierta" })).toBeVisible();
  // Sigue siendo miembro.
  await expect(page.getByRole("button", { name: `Quitar a ${colab.nombre}` })).toBeVisible();

  await page.getByRole("link", { name: "Ver sus tareas" }).click();
  await expect(page).toHaveURL(/vista=lista&asignado=/);
  await expect(page.getByRole("link", { name: tarea }).first()).toBeVisible();

  // Reasignadas con la selección múltiple, ya se la puede quitar.
  await page.getByRole("checkbox", { name: `Seleccionar ${tarea}` }).filter({ visible: true }).click();
  await elegir(page, "Cambiar asignado de las seleccionadas", "Sin asignar");
  await expect(page.getByText("Tarea actualizada.")).toBeVisible();

  await page.getByRole("button", { name: /Miembros del proyecto/ }).click();
  await page.getByRole("button", { name: `Quitar a ${colab.nombre}` }).click();
  await expect(page.getByText(`${colab.nombre} ya no está en el proyecto.`)).toBeVisible();
});

test("Mis tareas agrupa y cambia el estado en un toque", async ({ page, request }, info) => {
  const colab = await crearPersona(request, "mis");
  const unico = `${info.project.name}-${Date.now()}`;
  const proyecto = await crearProyectoDePrueba(request, `Mis ${unico}`, [colab.id]);
  const titulo = `Sin fecha ${unico}`;
  await crearTareaDePrueba(request, proyecto, titulo, colab.id);

  await ingresar(page, colab.email);
  await page.goto("/mis-tareas");
  await expect(page.getByRole("region", { name: "Sin fecha" }).getByRole("link", { name: titulo })).toBeVisible();

  await page.getByRole("button", { name: `Empezar: ${titulo}` }).click();
  await expect(page.getByRole("button", { name: `A revisión: ${titulo}` })).toBeVisible();

  await page.goto("/inicio");
  await expect(page.getByRole("region", { name: "En curso" }).getByText("1", { exact: true })).toBeVisible();
});

test("el inicio muestra sus tarjetas, y Sin asignar solo a quien gestiona", async ({ page, request }) => {
  await ingresar(page, "admin.a@prueba.test");
  for (const titulo of ["Vencidas", "Para hoy", "En curso", "Proyectos activos", "Sin asignar", "Próximos plazos", "Proyectos", "Mi semana"]) {
    await expect(page.getByRole("region", { name: titulo, exact: true })).toBeVisible();
  }
  await expect(page.getByRole("region", { name: "Proyectos", exact: true }).getByRole("link").first()).toBeVisible();

  const colab = await crearPersona(request, "inicio");
  await page.getByRole("button", { name: "Menú de usuario" }).click();
  await page.getByRole("menuitem", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/ingresar$/);
  await ingresar(page, colab.email);
  await expect(page.getByRole("region", { name: "Mi semana" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Sin asignar" })).toHaveCount(0);
  await expect(page.getByText("Todavía no te sumaron a un proyecto activo.")).toBeVisible();
});

test("la paleta lleva a un proyecto, a una tarea y a nueva tarea", async ({ page, request }, info) => {
  test.skip(esCelular(info), "El atajo es de teclado; en el celular es el mismo componente.");
  const unico = Date.now();
  const nombre = `Paleta ${unico}`;
  const proyecto = await crearProyectoDePrueba(request, nombre);
  const titulo = `Buscable ${unico}`;
  const tarea = await crearTareaDePrueba(request, proyecto, titulo, null);

  await ingresar(page, "pm1.a@prueba.test");
  const buscar = async (texto: string) => {
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder("Buscá una sección, un proyecto o una tarea…").fill(texto);
  };

  await buscar(nombre);
  await page.getByRole("option", { name: nombre, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/proyectos/${proyecto}$`));

  await buscar(titulo);
  await page.getByRole("option", { name: titulo }).click();
  await expect(page).toHaveURL(new RegExp(`tarea=${tarea}`));
  const panel = page.getByRole("dialog", { name: titulo });
  await expect(panel).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();

  await buscar(nombre);
  await page.getByRole("option", { name: `Nueva tarea en ${nombre}` }).click();
  await expect(page.getByRole("dialog", { name: "Nueva tarea" })).toBeVisible();
});

test("44 px y sin scroll horizontal en todas las pantallas", async ({ page }) => {
  await ingresar(page, "admin.a@prueba.test");
  for (const ruta of [
    "/inicio",
    "/proyectos",
    `/proyectos/${P1_DEL_SEED}`,
    `/proyectos/${P1_DEL_SEED}?vista=lista`,
    "/mis-tareas",
    "/configuracion/perfil",
    "/configuracion/miembros",
    "/configuracion/organizacion",
  ]) {
    await page.goto(ruta);
    await page.waitForLoadState("networkidle");
    expect(await elementosChicos(page), ruta).toEqual([]);
    const { ancho, visible } = await page.evaluate(() => ({ ancho: document.documentElement.scrollWidth, visible: document.documentElement.clientWidth }));
    expect(ancho, `${ruta}: scroll horizontal`).toBeLessThanOrEqual(visible);
  }
});
