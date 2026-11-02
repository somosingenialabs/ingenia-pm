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
