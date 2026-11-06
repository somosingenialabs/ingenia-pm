// Regenera package-lock.json desde package.json, con los binarios de cada sistema operativo.
//
// Con estas dependencias, npm 11 necesita dos pasadas para que `npm ci` acepte el lock, y la
// segunda borra los binarios opcionales (npm/cli#4828): sin el de rolldown, Vitest no arranca.
// Además, en una PC npm solo resuelve los binarios de su propio sistema: si se arma el lock de
// cero en Windows, se pierden los de Linux y Mac. Por eso se parte del lock actual y se
// recuperan los binarios que se perdieron (del lock anterior o de la primera pasada), siempre
// que algún paquete del lock nuevo los siga pidiendo en esa misma versión.
//
// Para agregar una dependencia: sumala a package.json a mano, corré esto y después `npm ci`.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const LOCK = "package-lock.json";

const leer = () => JSON.parse(readFileSync(LOCK, "utf8"));
function pasada() {
  execSync("npm install --package-lock-only --no-audit --no-fund", { stdio: "inherit" });
  return leer();
}

const esBinario = (p) => p && p.optional && (p.os || p.cpu);
const nombreDe = (ruta) => ruta.slice(ruta.lastIndexOf("node_modules/") + "node_modules/".length);

const previo = existsSync(LOCK) ? leer() : { packages: {} };
const primera = pasada();
const estable = pasada();

// Qué pide el lock nuevo de cada binario. Una versión exacta tiene que coincidir; un rango
// (como el ~2.3.3 de fsevents) alcanza con que alguien lo siga pidiendo.
const pedidos = new Map();
for (const p of Object.values(estable.packages)) {
  for (const tipo of ["optionalDependencies", "peerDependencies", "dependencies"]) {
    for (const [nombre, pedido] of Object.entries(p[tipo] ?? {})) {
      pedidos.set(nombre, [...(pedidos.get(nombre) ?? []), pedido]);
    }
  }
}
const sigueSiendoPedido = (nombre, version) =>
  (pedidos.get(nombre) ?? []).some((pedido) => pedido === version || !/^\d/.test(pedido));

let recuperados = 0;
for (const origen of [primera, previo]) {
  for (const [ruta, paquete] of Object.entries(origen.packages)) {
    if (estable.packages[ruta] || !esBinario(paquete)) continue;
    if (!sigueSiendoPedido(nombreDe(ruta), paquete.version)) continue;
    estable.packages[ruta] = paquete;
    recuperados += 1;
  }
}
estable.packages = Object.fromEntries(Object.entries(estable.packages).sort(([a], [b]) => (a < b ? -1 : 1)));

writeFileSync(LOCK, `${JSON.stringify(estable, null, 2)}\n`);
const antes = Object.entries(previo.packages).filter(([, p]) => esBinario(p)).length;
const despues = Object.entries(estable.packages).filter(([, p]) => esBinario(p)).length;
console.log(`${LOCK} listo: ${recuperados} binarios recuperados; binarios opcionales antes ${antes}, ahora ${despues}.`);
console.log("Ahora corré npm ci.");
