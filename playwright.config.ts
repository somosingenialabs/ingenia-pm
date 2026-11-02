import { defineConfig, devices } from "@playwright/test";

// Recorridos de punta a punta contra Supabase local (supabase start + seed): no hay modo demo.
// El puerto se puede cambiar con PUERTO_E2E.
const PUERTO = Number(process.env.PUERTO_E2E ?? 3100);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PUERTO}`,
    trace: "retain-on-failure",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
  },
  projects: [
    {
      name: "escritorio",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "celular",
      // Chromium con pantalla táctil de 375 px (solo se instala Chromium).
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 3,
      },
    },
  ],
  webServer: {
    // En esta PC `next dev` compila lento: el CI y los e2e locales usan el build.
    command: `npx next start -p ${PUERTO}`,
    url: `http://localhost:${PUERTO}/ingresar`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
