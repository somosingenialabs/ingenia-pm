// Regenera package-lock.json desde package.json, con los binarios de cada sistema operativo.
//
// Con estas dependencias, npm 11 necesita dos pasadas para que `npm ci` acepte el lock, y la
// segunda borra los binarios opcionales (npm/cli#4828): sin el de rolldown, Vitest no arranca.
// Por eso se toman de la primera pasada. Después de correrlo: `npm ci`.
//
// Para agregar una dependencia: sumala a package.json a mano, corré esto y después `npm ci`.
import { execSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const LOCK = "package-lock.json";

function pasada() {
  execSync("npm install --package-lock-only --no-audit --no-fund", { stdio: "inherit" });
  return JSON.parse(readFileSync(LOCK, "utf8"));
}

rmSync(LOCK, { force: true });
const primera = pasada();
const estable = pasada();

const binarios = Object.keys(primera.packages).filter((ruta) => {
  const paquete = primera.packages[ruta];
  return !estable.packages[ruta] && paquete.optional && (paquete.os || paquete.cpu);
});
if (binarios.length === 0) {
  console.log("La segunda pasada no perdió binarios: puede que npm ya no tenga este problema.");
}
for (const ruta of binarios) estable.packages[ruta] = primera.packages[ruta];
estable.packages = Object.fromEntries(Object.entries(estable.packages).sort(([a], [b]) => (a < b ? -1 : 1)));

writeFileSync(LOCK, `${JSON.stringify(estable, null, 2)}\n`);
console.log(`${LOCK} listo, con ${binarios.length} binarios recuperados. Ahora corré npm ci.`);
