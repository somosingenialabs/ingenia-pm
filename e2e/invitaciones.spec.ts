import { expect, test, type Page } from "@playwright/test";
import { actualizar, CLAVE_DESARROLLO, crearPersona, ingresar, ORG_B } from "./ayudas";

async function generarEnlace(page: Page, email: string) {
  await page.goto("/configuracion/miembros");
  await page.getByRole("button", { name: "Invitar" }).click();
  await page.getByLabel("Mail").fill(email);
  await page.getByRole("button", { name: "Generar enlace" }).click();
  const campo = page.getByLabel("Enlace de invitación");
  await expect(campo).toBeVisible();
  const enlace = await campo.inputValue();
  await page.getByRole("button", { name: "Listo" }).click();
  return enlace;
}

function mailUnico(rotulo: string, proyecto: string) {
  return `${rotulo}-${proyecto}-${Date.now()}@prueba.test`;
}

test("invitación de punta a punta: persona nueva", async ({ page, browser, baseURL }, info) => {
  const email = mailUnico("nueva", info.project.name);
  const nombre = `Invitada ${info.project.name}`;

  await ingresar(page, "admin.a@prueba.test");
  const enlace = await generarEnlace(page, email);
  // En la tabla queda la pendiente, y nunca el token.
  await expect(page.getByRole("region", { name: "Invitaciones pendientes" }).getByText(email)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(enlace.split("/").at(-1)!);

  const contexto = await browser.newContext({ ...info.project.use, baseURL });
  const pagina = await contexto.newPage();
  await pagina.goto(enlace);
  await expect(pagina.getByRole("heading", { name: /Sumate a Empresa A/ })).toBeVisible();
  await pagina.getByLabel("Tu nombre").fill(nombre);
  await pagina.getByLabel("Contraseña nueva").fill("una-clave-de-prueba");
  await pagina.getByLabel("Repetila").fill("una-clave-de-prueba");
  await pagina.getByRole("button", { name: "Crear cuenta y entrar" }).click();

  // Entra con la empresa activa en el token: el RLS ya le responde.
  await expect(pagina).toHaveURL(/\/inicio$/);
  await expect(pagina.getByRole("heading", { name: `Hola, ${nombre}` })).toBeVisible();
  await expect(pagina.getByText("Empresa A · Colaborador")).toBeVisible();
  await expect(pagina.getByRole("region", { name: "Mi semana" })).toBeVisible();
  await contexto.close();

  // Ya usado.
  const otra = await browser.newContext({ ...info.project.use, baseURL });
  const tercera = await otra.newPage();
  await tercera.goto(enlace);
  await expect(tercera.getByText("Esta invitación ya se usó.")).toBeVisible();
  await otra.close();

  await page.reload();
  await expect(page.getByRole("region", { name: "Miembros" }).getByText(email)).toBeVisible();
});

test("si el mail ya existe, pide ingresar y suma la membresía", async ({ page, browser, request, baseURL }, info) => {
  const deB = await crearPersona(request, "existente", "colaborador", ORG_B);

  await ingresar(page, "admin.a@prueba.test");
  const enlace = await generarEnlace(page, deB.email);

  const contexto = await browser.newContext({ ...info.project.use, baseURL });
  const pagina = await contexto.newPage();
  await pagina.goto(enlace);
  await expect(pagina.getByLabel("Tu nombre")).toHaveCount(0);

  await pagina.getByLabel("Contraseña").fill("no-es-la-clave");
  await pagina.getByRole("button", { name: "Ingresar y aceptar" }).click();
  await expect(pagina.locator("form").getByRole("alert")).toHaveText("La contraseña no coincide.");

  await pagina.getByLabel("Contraseña").fill(CLAVE_DESARROLLO);
  await pagina.getByRole("button", { name: "Ingresar y aceptar" }).click();
  await expect(pagina).toHaveURL(/\/inicio$/);
  await expect(pagina.getByText("Empresa A · Colaborador")).toBeVisible();
  await contexto.close();
});

test("con la sesión de otra persona, pide salir", async ({ page }, info) => {
  const email = mailUnico("otra-sesion", info.project.name);
  await ingresar(page, "admin.a@prueba.test");
  const enlace = await generarEnlace(page, email);
  await page.goto(enlace);
  await expect(page.getByText(/Ahora estás con admin.a@prueba.test/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Salir" })).toBeVisible();
});

test("token adulterado, vencido y revocado no entran", async ({ page, browser, request, baseURL }, info) => {
  await ingresar(page, "admin.a@prueba.test");
  const contexto = await browser.newContext({ ...info.project.use, baseURL });
  const sinSesion = await contexto.newPage();

  // Adulterado: el mismo largo, otro contenido. Y otro largo.
  const adulterable = await generarEnlace(page, mailUnico("adulterado", info.project.name));
  const ultimo = adulterable.at(-1) === "A" ? "B" : "A";
  await sinSesion.goto(`${adulterable.slice(0, -1)}${ultimo}`);
  await expect(sinSesion.getByText("Este enlace no es válido.", { exact: false })).toBeVisible();
  await sinSesion.goto(`${adulterable}x`);
  await expect(sinSesion.getByText("Este enlace no es válido.", { exact: false })).toBeVisible();

  // Vencido.
  const mailVencido = mailUnico("vencido", info.project.name);
  const vencido = await generarEnlace(page, mailVencido);
  await actualizar(request, `invitaciones?email=eq.${encodeURIComponent(mailVencido)}`, { vence_en: new Date(Date.now() - 60_000).toISOString() });
  await sinSesion.goto(vencido);
  await expect(sinSesion.getByText("Este enlace venció.", { exact: false })).toBeVisible();

  // Una vencida no traba volver a invitar a ese mail.
  const nuevo = await generarEnlace(page, mailVencido);
  await sinSesion.goto(nuevo);
  await expect(sinSesion.getByLabel("Tu nombre")).toBeVisible();

  // Revocado.
  const mailRevocado = mailUnico("revocado", info.project.name);
  const revocado = await generarEnlace(page, mailRevocado);
  await page.getByRole("button", { name: `Cancelar la invitación de ${mailRevocado}` }).click();
  await page.getByRole("button", { name: "Cancelar invitación" }).click();
  await expect(page.getByText("Invitación cancelada.")).toBeVisible();
  await sinSesion.goto(revocado);
  await expect(sinSesion.getByText("Esta invitación se canceló.", { exact: false })).toBeVisible();

  await contexto.close();
});
