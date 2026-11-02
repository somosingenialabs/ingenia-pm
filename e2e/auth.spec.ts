import { expect, test } from "@playwright/test";
import { API_SUPABASE, CLAVE_DESARROLLO, cambiarActivo, elementosChicos, enlaceDelUltimoMail, ingresar, variableLocal } from "./ayudas";

// Cada proyecto de Playwright (escritorio, celular) corre todo. El mail cambia por test para
// que los recorridos en paralelo no se pisen.

test("sin sesión, /inicio redirige a /ingresar", async ({ page }) => {
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/ingresar$/);
});

test("una contraseña incorrecta muestra el error genérico", async ({ page }) => {
  await page.goto("/ingresar");
  await page.getByLabel("Mail").fill("admin.a@prueba.test");
  await page.getByLabel("Contraseña").fill("no-es-la-clave");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("El mail o la contraseña no coinciden.");
  await expect(page).toHaveURL(/\/ingresar$/);
});

test("un mail que no existe muestra el mismo error", async ({ page }) => {
  await page.goto("/ingresar");
  await page.getByLabel("Mail").fill("nadie@prueba.test");
  await page.getByLabel("Contraseña").fill("no-es-la-clave");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("El mail o la contraseña no coinciden.");
});

test("ingresa a /inicio y al salir vuelve a /ingresar", async ({ page }) => {
  await ingresar(page, "pm1.a@prueba.test");
  await expect(page.getByRole("heading", { name: "Hola, Martín Gómez" })).toBeVisible();
  await expect(page.getByText("Empresa A · PM")).toBeVisible();

  await page.getByRole("button", { name: "Menú de usuario" }).click();
  await page.getByRole("menuitem", { name: "Salir" }).click();
  await expect(page).toHaveURL(/\/ingresar$/);

  // Ya sin sesión, las pantallas internas vuelven a pedir ingreso.
  await page.goto("/inicio");
  await expect(page).toHaveURL(/\/ingresar$/);
});

test("con sesión, /ingresar redirige a /inicio", async ({ page }) => {
  await ingresar(page, "pm2.a@prueba.test");
  await page.goto("/ingresar");
  await expect(page).toHaveURL(/\/inicio$/);
});

test("/auth/callback con destino externo no sale del sitio", async ({ page, baseURL }) => {
  await page.goto("/auth/callback?next=https://ejemplo.test");
  expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);

  await page.goto("/auth/callback?code=invalido&next=https://ejemplo.test");
  expect(new URL(page.url()).origin).toBe(new URL(baseURL!).origin);
});

test("/recuperar responde lo mismo exista o no el mail", async ({ page }) => {
  for (const email of ["colab1.b@prueba.test", "nadie@prueba.test"]) {
    await page.goto("/recuperar");
    await page.getByLabel("Mail").fill(email);
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByRole("status")).toHaveText(/Si ese mail tiene una cuenta/);
  }
});

test("el enlace del mail lleva a /nueva-clave y la contraseña nueva queda andando", async ({ page, request }, info) => {
  const email = info.project.name === "celular" ? "colab3.a@prueba.test" : "colab2.a@prueba.test";

  await page.goto("/recuperar");
  await page.getByLabel("Mail").fill(email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("status")).toBeVisible();

  await page.goto(await enlaceDelUltimoMail(request, email));
  await expect(page).toHaveURL(/\/nueva-clave$/);

  async function definir(clave: string) {
    await page.goto("/nueva-clave");
    await page.getByLabel("Contraseña nueva").fill(clave);
    await page.getByLabel("Repetila").fill(clave);
    await page.getByRole("button", { name: "Guardar contraseña" }).click();
    await expect(page).toHaveURL(/\/inicio$/);
  }

  await definir("una-clave-temporal");
  // Se deja la de desarrollo, para que el test se pueda volver a correr.
  await definir(CLAVE_DESARROLLO);
});

test("no hay registro público", async ({ request }) => {
  const respuesta = await request.post(`${API_SUPABASE}/auth/v1/signup`, {
    headers: { apikey: variableLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY") },
    data: { email: "registro.nuevo@prueba.test", password: "una-clave-cualquiera" },
  });
  expect(respuesta.status()).toBe(422);
  expect((await respuesta.json()).error_code).toBe("signup_disabled");
});

test("/nueva-clave sin sesión ofrece pedir otro enlace", async ({ page }) => {
  await page.goto("/nueva-clave");
  await expect(page.getByRole("link", { name: "Pedir un enlace nuevo" })).toBeVisible();
});

test("/inicio muestra el nombre, la empresa y el rol reales", async ({ page }) => {
  await ingresar(page, "admin.a@prueba.test");
  await expect(page.getByRole("heading", { name: "Hola, Lucía Fernández" })).toBeVisible();
  await expect(page.getByText("Empresa A · Admin")).toBeVisible();
});

// Sin el hook, org_id no llega al token y todo el RLS devuelve vacío. Los tests SQL simulan
// el token: este pasa por Auth de verdad.
test("el token real trae la empresa y el RLS responde con ella", async ({ request }) => {
  const apikey = variableLocal("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const ingreso = await request.post(`${API_SUPABASE}/auth/v1/token?grant_type=password`, {
    headers: { apikey },
    data: { email: "colab3.a@prueba.test", password: CLAVE_DESARROLLO },
  });
  expect(ingreso.ok()).toBe(true);
  const { access_token: token } = (await ingreso.json()) as { access_token: string };
  const datos = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString()) as { org_id?: string };
  expect(datos.org_id).toBe("10000000-0000-4000-a000-000000000000");

  const headers = { apikey, Authorization: `Bearer ${token}` };
  const proyectos = await (await request.get(`${API_SUPABASE}/rest/v1/proyectos?select=id`, { headers })).json();
  expect(proyectos).toHaveLength(2);

  // Sin sesión, la API no da nada.
  const sinSesion = await request.get(`${API_SUPABASE}/rest/v1/proyectos?select=id`, { headers: { apikey } });
  expect(sinSesion.ok()).toBe(false);
});

test("sin empresa activa, avisa y deja salir", async ({ page, request }, info) => {
  const [email, id] =
    info.project.name === "celular"
      ? ["colab1.a@prueba.test", "00000000-0000-4000-a000-000000000004"]
      : ["colab1.b@prueba.test", "00000000-0000-4000-b000-000000000002"];
  await cambiarActivo(request, id, false);
  try {
    await page.goto("/ingresar");
    await page.getByLabel("Mail").fill(email);
    await page.getByLabel("Contraseña").fill(CLAVE_DESARROLLO);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/sin-empresa$/);
    await expect(page.getByText("Tu usuario no tiene una empresa activa. Pedile acceso a un administrador.")).toBeVisible();
    expect(await elementosChicos(page), "/sin-empresa").toEqual([]);
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/ingresar$/);
  } finally {
    await cambiarActivo(request, id, true);
  }
});

test("todo control interactivo mide 44 px o más", async ({ page }) => {
  for (const ruta of ["/ingresar", "/recuperar", "/nueva-clave"]) {
    await page.goto(ruta);
    expect(await elementosChicos(page), ruta).toEqual([]);
  }

  await ingresar(page, "admin.b@prueba.test");
  expect(await elementosChicos(page), "/inicio").toEqual([]);

  await page.getByRole("button", { name: "Menú de usuario" }).click();
  await expect(page.getByRole("menuitem", { name: "Salir" })).toBeVisible();
  // El menú entra con una animación de escala: se mide cuando terminó.
  await page.getByRole("menu").evaluate((menu) => Promise.all(menu.getAnimations({ subtree: true }).map((a) => a.finished)));
  expect(await elementosChicos(page), "menú de usuario").toEqual([]);
});
