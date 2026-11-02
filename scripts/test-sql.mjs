// Corre supabase/tests/*.test.sql contra DATABASE_URL y sale con error si alguno falla.
// Con Node y pg, no con `docker exec psql`, para que ande igual en local y en nube.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

const CARPETA = join("supabase", "tests");

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL. Copiala de .env.example a .env.local.");
  process.exit(1);
}

const archivos = readdirSync(CARPETA)
  .filter((a) => a.endsWith(".test.sql"))
  .sort();
if (archivos.length === 0) {
  console.error(`No hay tests en ${CARPETA}.`);
  process.exit(1);
}

let fallaron = 0;
for (const archivo of archivos) {
  // Un cliente por archivo: si uno falla, su transacción muere con la conexión.
  const cliente = new pg.Client({ connectionString: url });
  const avisos = [];
  cliente.on("notice", (n) => avisos.push(n.message));
  await cliente.connect();
  try {
    await cliente.query(readFileSync(join(CARPETA, archivo), "utf8"));
    console.log(`ok     ${archivo}: ${avisos.at(-1) ?? "sin comprobaciones informadas"}`);
  } catch (e) {
    fallaron += 1;
    console.error(`FALLA  ${archivo}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await cliente.end();
  }
}

console.log(`\n${archivos.length - fallaron} de ${archivos.length} archivos en verde.`);
process.exit(fallaron === 0 ? 0 : 1);
