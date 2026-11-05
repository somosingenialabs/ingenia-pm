import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Los tests corren en la zona de la empresa: así se ve si una fecha se corre de día cerca de la
// medianoche. Se fija acá para que los procesos de Vitest la hereden desde el arranque.
process.env.TZ = "America/Argentina/Buenos_Aires"

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: true,
  },
})
