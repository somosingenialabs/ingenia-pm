import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test, type APIRequestContext, type Browser, type Page, type TestInfo } from "@playwright/test";
import { API_SUPABASE, CLAVE_DESARROLLO, crearPersona, escribir, ingresar, ORG_A, ORG_B, variableLocal } from "./ayudas";

// Comentarios y tareas en vivo, con dos sesiones a la vez. Cada test arma sus propios datos.

async function armar(request: APIRequestContext, rotulo: string) {
  const sufijo = `${rotulo} ${Date.now()}`;
  const pm = await crearPersona(request, `pm-com-${rotulo}`, "pm");
  const colab = await crearPersona(request, `colab-com-${rotulo}`);
  const proyecto = await escribir(request, "proyectos", { organizacion_id: ORG_A, nombre: `Comentarios ${sufijo}`, estado: "activo", responsable_id: pm.id });
  await escribir(request, "proyecto_miembros", { organizacion_id: ORG_A, proyecto_id: proyecto.id, usuario_id: colab.id });
  const titulo = `Charlar ${sufijo}`;
  const tarea = await escribir(request, "tareas", { organizacion_id: ORG_A, proyecto_id: proyecto.id, titulo, asignado_id: colab.id });
  return { pm, colab, proyectoId: proyecto.id, tareaId: tarea.id, titulo };
}

async function otraSesion(browser: Browser, info: TestInfo, baseURL: string | undefined, email: string) {
  const contexto = await browser.newContext({ ...info.project.use, baseURL });
  const pagina = await contexto.newPage();
  await ingresar(pagina, email);
  return { contexto, pagina };
}

function seccion(page: Page) {
  return page.getByRole("region", { name: /Comentarios/ });
}

async function comentar(page: Page, texto: string) {
  await page.getByLabel("Escribí un comentario").fill(texto);
  await page.getByRole("button", { name: "Comentar" }).click();
}

test("A escribe, edita y borra; B lo ve sin recargar", async ({ page, browser, request, baseURL }, info) => {
  const datos = await armar(request, "vivo");
  const url = `/proyectos/${datos.proyectoId}?tarea=${datos.tareaId}`;

  await ingresar(page, datos.pm.email);
  await page.goto(url);
  const b = await otraSesion(browser, info, baseURL, datos.colab.email);
  await b.pagina.goto(url);
  await expect(seccion(b.pagina).getByText("Todavía no hay comentarios")).toBeVisible();

  const texto = `Hola desde A ${Date.now()}\nSegunda línea`;
  await comentar(page, texto);
  await expect(seccion(page).getByText("Enviando…")).toHaveCount(0);
  // B lo ve, con el salto de línea y el nombre de A, sin recargar.
  const enB = seccion(b.pagina).getByRole("listitem").filter({ hasText: "Hola desde A" });
  await expect(enB).toBeVisible();
  await expect(enB).toContainText(datos.pm.nombre);
  await expect(enB.getByText(/Segunda línea/)).toBeVisible();
  // Y A lo tiene una sola vez: el evento no duplicó el optimista.
  await expect(seccion(page).getByRole("listitem").filter({ hasText: "Hola desde A" })).toHaveCount(1);

  // A edita.
  await seccion(page).getByRole("button", { name: "Editar comentario" }).click();
  await page.getByLabel("Editar comentario").fill("Texto corregido");
  await seccion(page).getByRole("button", { name: "Guardar" }).click();
  await expect(seccion(b.pagina).getByText("Texto corregido", { exact: true })).toBeVisible();
  await expect(seccion(b.pagina).getByText("(editado)")).toBeVisible();

  // A borra: B ve "Comentario eliminado", sin el texto.
  await seccion(page).getByRole("button", { name: "Borrar comentario" }).click();
  await page.getByRole("dialog", { name: "¿Borrar este comentario?" }).getByRole("button", { name: "Borrar comentario" }).click();
  await expect(seccion(b.pagina).getByText("Comentario eliminado")).toBeVisible();
  await expect(seccion(b.pagina).getByText("Texto corregido", { exact: true })).toHaveCount(0);
  await b.contexto.close();
});

test("tras cortar la red y reconectar, aparece lo que faltó", async ({ page, browser, request, baseURL }, info) => {
  const datos = await armar(request, "red");
  const url = `/proyectos/${datos.proyectoId}?tarea=${datos.tareaId}`;
  await ingresar(page, datos.pm.email);
  await page.goto(url);
  const b = await otraSesion(browser, info, baseURL, datos.colab.email);
  await b.pagina.goto(url);
  await expect(seccion(b.pagina).getByText("Todavía no hay comentarios")).toBeVisible();

  await b.contexto.setOffline(true);
  await expect(seccion(b.pagina).getByText("Reconectando…")).toBeVisible();
  // La caja sigue usable aunque no haya conexión.
  await expect(b.pagina.getByLabel("Escribí un comentario")).toBeEditable();

  await comentar(page, "Mientras B no tenía red");
  await expect(seccion(page).getByText("Enviando…")).toHaveCount(0);
  await b.pagina.waitForTimeout(1000);
  await expect(seccion(b.pagina).getByText("Mientras B no tenía red", { exact: true })).toHaveCount(0);

  await b.contexto.setOffline(false);
  await expect(seccion(b.pagina).getByText("Mientras B no tenía red", { exact: true })).toBeVisible({ timeout: 20_000 });
  await b.contexto.close();
});

test("un cambio de tarea en otra sesión se ve en el tablero", async ({ page, request }) => {
  const datos = await armar(request, "tablero");
  await ingresar(page, datos.colab.email);
  await page.goto(`/proyectos/${datos.proyectoId}`);
  await expect(page.getByRole("link", { name: datos.titulo }).filter({ visible: true })).toBeVisible();

  // Otra sesión: el PM cambia el título con su propio token, por la API.
  const pm = await clienteCon(datos.pm.email);
  const nuevo = `${datos.titulo} (renombrada)`;
  const { error } = await pm.from("tareas").update({ titulo: nuevo }).eq("id", datos.tareaId);
  expect(error).toBeNull();

  await expect(page.getByRole("link", { name: nuevo }).filter({ visible: true })).toBeVisible({ timeout: 15_000 });
  await pm.auth.signOut();
});

// ===== Fuga entre empresas: el test más importante de la fase =====

async function clienteCon(email: string): Promise<SupabaseClient> {
  const cliente = createClient(API_SUPABASE, variableLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await cliente.auth.signInWithPassword({ email, password: CLAVE_DESARROLLO });
  expect(error).toBeNull();
  return cliente;
}

async function escuchar(cliente: SupabaseClient, nombre: string, filtro?: string) {
  const recibidos: unknown[] = [];
  const canal: RealtimeChannel = cliente.channel(nombre).on(
    "postgres_changes",
    { event: "*", schema: "public", table: "comentarios", ...(filtro ? { filter: filtro } : {}) },
    (p) => recibidos.push(p),
  );
  await new Promise<void>((listo, falla) =>
    canal.subscribe((estado, error) => {
      if (estado === "SUBSCRIBED") listo();
      else if (estado === "CHANNEL_ERROR" || estado === "TIMED_OUT") falla(error ?? new Error(estado));
    }),
  );
  return { recibidos, cerrar: () => cliente.removeChannel(canal) };
}

test("nadie de afuera recibe comentarios de la tarea, ni de la empresa B ni de otro proyecto", async ({ request, isMobile }) => {
  test.skip(isMobile, "No depende del tamaño de pantalla: corre una vez");
  const datos = await armar(request, "fuga");
  const ajeno = await crearPersona(request, "colab-ajeno"); // Empresa A, pero no es miembro del proyecto.
  const deB = await crearPersona(request, "colab-empresa-b", "colaborador", ORG_B);
  const filtro = `tarea_id=eq.${datos.tareaId}`;

  const miembro = await escuchar(await clienteCon(datos.colab.email), `prueba:miembro:${datos.tareaId}`, filtro);
  const deAfuera = await escuchar(await clienteCon(ajeno.email), `prueba:ajeno:${datos.tareaId}`, filtro);
  const empresaB = await escuchar(await clienteCon(deB.email), `prueba:empresa-b:${datos.tareaId}`, filtro);
  // Sin filtro tampoco: el RLS decide, no el filtro.
  const empresaBSinFiltro = await escuchar(await clienteCon(deB.email), `prueba:empresa-b-todo:${datos.tareaId}`);

  // Con carga, Realtime puede tardar en empezar a emitir después de SUBSCRIBED: se comenta cada
  // 2 s hasta que el miembro reciba algo. Cada comentario de más es otra oportunidad de fuga.
  let enviados = 0;
  await expect(async () => {
    await escribir(request, "comentarios", {
      id: crypto.randomUUID(),
      organizacion_id: ORG_A,
      tarea_id: datos.tareaId,
      autor_id: datos.pm.id,
      cuerpo: `Solo para el equipo del proyecto ${++enviados}`,
    });
    // Control: el miembro sí lo recibe. Si no, el test no probaría nada.
    await expect.poll(() => miembro.recibidos.length, { timeout: 2000 }).toBeGreaterThan(0);
  }).toPass({ timeout: 20_000 });
  // Margen para que, si algo se filtrara, llegue.
  await new Promise((r) => setTimeout(r, 3000));
  expect(deAfuera.recibidos).toHaveLength(0);
  expect(empresaB.recibidos).toHaveLength(0);
  expect(empresaBSinFiltro.recibidos).toHaveLength(0);

  await Promise.all([miembro.cerrar(), deAfuera.cerrar(), empresaB.cerrar(), empresaBSinFiltro.cerrar()]);
});
