import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hoyEnZona, sumarDias } from "@/lib/fechas";
import type { Database } from "@/lib/supabase/database.types";
import type { ClienteSupabase } from "./comun";
import {
  contarEnCurso,
  contarParaHoy,
  contarProyectosActivos,
  contarSinAsignar,
  contarVencidas,
  listarMiSemana,
  listarProximosPlazos,
  listarProyectosActivos,
} from "./inicio/consultas";
import { listarCalendario } from "./calendario/consultas";
import { listarTareasDeSemana, obtenerCarga } from "./carga/consultas";
import { lunesDe } from "./carga/reglas";
import { listarBloqueosDeProyecto, listarDependenciasDeTarea } from "./dependencias/consultas";
import { listarMiembros } from "./miembros/consultas";
import { listarProyectos, obtenerProyecto } from "./proyectos/consultas";
import { buscarTareas, listarMisTareas, listarTareasDeProyecto, obtenerTarea } from "./tareas/consultas";

// Contra Supabase local y el seed, como los tests SQL: "supabase start" tiene que estar corriendo.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const URL_API = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SECRETA = process.env.SUPABASE_SECRET_KEY!;

const ORG = "10000000-0000-4000-a000-000000000000";
const ORG_B = "20000000-0000-4000-b000-000000000000";
const COLAB1 = "00000000-0000-4000-a000-000000000004";
const P1 = "12000000-0000-4000-a000-000000000001";
const P_BORRADO = "12000000-0000-4000-a000-0000000000e1";
const T_BORRADA = "13000000-0000-4000-a000-0000000000e1";
const T_DE_P_BORRADO = "13000000-0000-4000-a000-0000000000e2";
const TITULO = "Fantasma de integración";

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient<Database>(URL_API, SECRETA, opciones);

async function ingresar(email: string): Promise<ClienteSupabase> {
  const db = createClient<Database>(URL_API, ANON, opciones);
  const { error } = await db.auth.signInWithPassword({ email, password: process.env.CLAVE_PRUEBA ?? "prueba1234" });
  if (error) throw error;
  return db;
}

const HOY = hoyEnZona("America/Argentina/Buenos_Aires");
const ayer = sumarDias(HOY, -1);
const manana = sumarDias(HOY, 1);

async function borrarDatosDeTest() {
  await admin.from("tareas").delete().in("id", [T_BORRADA, T_DE_P_BORRADO]);
  await admin.from("proyectos").delete().eq("id", P_BORRADO);
}

describe("las consultas no devuelven lo borrado", () => {
  let db: ClienteSupabase;

  beforeAll(async () => {
    await borrarDatosDeTest();
    // Cada una a nombre de colab1, para que entre en todas las consultas si el filtro falta.
    const filas = (id: string, proyecto_id: string, eliminado_en: string | null, extra: object) => ({
      id,
      organizacion_id: ORG,
      proyecto_id,
      titulo: TITULO,
      estado: "en_curso",
      asignado_id: COLAB1,
      eliminado_en,
      ...extra,
    });
    const { error: e1 } = await admin.from("proyectos").insert({
      id: P_BORRADO,
      organizacion_id: ORG,
      nombre: TITULO,
      estado: "activo",
      responsable_id: "00000000-0000-4000-a000-000000000002",
    });
    if (e1) throw e1;
    const { error: e2 } = await admin.from("proyecto_miembros").insert({ organizacion_id: ORG, proyecto_id: P_BORRADO, usuario_id: COLAB1 });
    if (e2) throw e2;

    // Primero sin borrar, para comprobar abajo que las consultas sí las encuentran vivas.
    const { error: e3 } = await admin.from("tareas").insert([
      filas(T_BORRADA, P1, null, { fecha_limite: manana }),
      filas(T_DE_P_BORRADO, P_BORRADO, null, { fecha_limite: manana }),
    ]);
    if (e3) throw e3;

    db = await ingresar("colab1.a@prueba.test");
  });

  afterAll(borrarDatosDeTest);

  // Cada función, con cómo se la llama y si la tarea o el proyecto de prueba aparecen en el resultado.
  type Comprobacion = (db: ClienteSupabase) => Promise<number>;
  const contarFantasmas = (filas: { id: string }[]) => filas.filter((f) => f.id === T_BORRADA || f.id === T_DE_P_BORRADO || f.id === P_BORRADO).length;

  const listas: [string, Comprobacion][] = [
    ["listarProyectos", async (d) => contarFantasmas(await listarProyectos(d, { hoy: HOY }))],
    ["obtenerProyecto", async (d) => ((await obtenerProyecto(d, P_BORRADO, HOY)) ? 1 : 0)],
    ["listarTareasDeProyecto (P1)", async (d) => contarFantasmas(await listarTareasDeProyecto(d, P1))],
    ["listarTareasDeProyecto (borrado)", async (d) => contarFantasmas(await listarTareasDeProyecto(d, P_BORRADO))],
    ["listarMisTareas", async (d) => contarFantasmas(await listarMisTareas(d, COLAB1))],
    ["obtenerTarea (borrada)", async (d) => ((await obtenerTarea(d, T_BORRADA)) ? 1 : 0)],
    ["obtenerTarea (de proyecto borrado)", async (d) => ((await obtenerTarea(d, T_DE_P_BORRADO)) ? 1 : 0)],
    ["buscarTareas", async (d) => (await buscarTareas(d, TITULO)).length],
    ["listarProximosPlazos", async (d) => contarFantasmas(await listarProximosPlazos(d, HOY))],
    ["listarProyectosActivos", async (d) => contarFantasmas(await listarProyectosActivos(d, HOY))],
    ["listarMiSemana", async (d) => contarFantasmas(await listarMiSemana(d, COLAB1, [HOY, manana]))],
  ];

  // Los contadores no devuelven filas: se compara contra el valor sin las filas de prueba.
  const contadores: [string, Comprobacion][] = [
    ["contarVencidas", (d) => contarVencidas(d, { usuarioId: COLAB1, hoy: sumarDias(manana, 1) })],
    ["contarParaHoy", (d) => contarParaHoy(d, { usuarioId: COLAB1, hoy: manana })],
    ["contarEnCurso", (d) => contarEnCurso(d, { usuarioId: COLAB1 })],
    ["contarProyectosActivos", (d) => contarProyectosActivos(d)],
  ];

  it("con las filas vivas, las consultas las encuentran (si no, el test no prueba nada)", async () => {
    for (const [nombre, comprobar] of listas) {
      if (nombre === "listarTareasDeProyecto (borrado)" || nombre === "listarTareasDeProyecto (P1)" || nombre.startsWith("obtener")) continue;
      expect(await comprobar(db), nombre).toBeGreaterThan(0);
    }
    expect(await listarTareasDeProyecto(db, P_BORRADO)).toHaveLength(1);
    expect(await obtenerProyecto(db, P_BORRADO, HOY)).not.toBeNull();
    expect(await obtenerTarea(db, T_BORRADA)).not.toBeNull();
  });

  it("con las filas borradas, ninguna función las devuelve", async () => {
    const conFantasmas = Object.fromEntries(await Promise.all(contadores.map(async ([n, c]) => [n, await c(db)] as const)));
    const sinAsignarAntes = await contarSinAsignar(db);

    const ahora = new Date().toISOString();
    // Como lo haría la app: con un Admin de verdad. La clave secreta no pasa app.proteger_tarea.
    const dbAdmin = await ingresar("admin.a@prueba.test");
    const borrarTarea = await dbAdmin.from("tareas").update({ eliminado_en: ahora }).eq("id", T_BORRADA).select("id");
    expect(borrarTarea.data, borrarTarea.error?.message).toHaveLength(1);
    const borrarProyecto = await dbAdmin.from("proyectos").update({ eliminado_en: ahora }).eq("id", P_BORRADO).select("id");
    expect(borrarProyecto.data, borrarProyecto.error?.message).toHaveLength(1);

    for (const [nombre, comprobar] of listas) {
      expect(await comprobar(db), nombre).toBe(0);
    }
    // Una por T_BORRADA y otra por T_DE_P_BORRADO (el proyecto borrado también las saca).
    expect(await contarVencidas(db, { usuarioId: COLAB1, hoy: sumarDias(manana, 1) })).toBe(conFantasmas.contarVencidas! - 2);
    expect(await contarParaHoy(db, { usuarioId: COLAB1, hoy: manana })).toBe(conFantasmas.contarParaHoy! - 2);
    expect(await contarEnCurso(db, { usuarioId: COLAB1 })).toBe(conFantasmas.contarEnCurso! - 2);
    expect(await contarProyectosActivos(db)).toBe(conFantasmas.contarProyectosActivos! - 1);
    expect(await contarSinAsignar(db)).toBe(sinAsignarAntes);
  });

  it("listarMiembros filtra por empresa, aunque la persona esté en más de una", async () => {
    const usuario = "00000000-0000-4000-b000-000000000001"; // admin de B
    await admin.from("miembros").insert({ organizacion_id: ORG, usuario_id: usuario, rol: "colaborador" });
    try {
      const dbAdminB = await ingresar("admin.b@prueba.test");
      const deB = await listarMiembros(dbAdminB, ORG_B);
      expect(deB.map((m) => m.email).every((m) => m?.endsWith(".b@prueba.test"))).toBe(true);
    } finally {
      await admin.from("miembros").delete().eq("organizacion_id", ORG).eq("usuario_id", usuario);
    }
  });

  it("un colaborador de afuera no ve el proyecto", async () => {
    const colab3 = await ingresar("colab3.a@prueba.test");
    expect(await obtenerProyecto(colab3, "12000000-0000-4000-a000-000000000002", HOY)).toBeNull();
    expect(await obtenerTarea(colab3, "13000000-0000-4000-a000-000000000016")).toBeNull();
  });

  it("los días de ayer no cuentan como Próximos plazos", async () => {
    const plazos = await listarProximosPlazos(db, HOY);
    expect(plazos.every((t) => t.fecha_limite! >= HOY && t.fecha_limite! > ayer)).toBe(true);
  });
});

describe("bucket avatares", () => {
  const PNG = new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" });
  const ruta = `${COLAB1}/test-${Date.now()}.png`;

  afterAll(async () => {
    await admin.storage.from("avatares").remove([ruta]);
  });

  it("cada uno sube a su carpeta, y se lee sin sesión", async () => {
    const db = await ingresar("colab1.a@prueba.test");
    const { error } = await db.storage.from("avatares").upload(ruta, PNG, { contentType: "image/png" });
    expect(error).toBeNull();
    const respuesta = await fetch(db.storage.from("avatares").getPublicUrl(ruta).data.publicUrl);
    expect(respuesta.status).toBe(200);
  });

  it("no se sube a la carpeta de otro", async () => {
    const db = await ingresar("colab1.a@prueba.test");
    const { error } = await db.storage.from("avatares").upload("00000000-0000-4000-a000-000000000001/x.png", PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
  });

  it("no acepta más de 2 MB ni archivos que no son imágenes", async () => {
    const db = await ingresar("colab1.a@prueba.test");
    const grande = new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], { type: "image/png" });
    const { error: errorTamano } = await db.storage.from("avatares").upload(`${COLAB1}/grande.png`, grande, { contentType: "image/png" });
    expect(errorTamano).not.toBeNull();
    for (const contentType of ["image/svg+xml", "text/html"]) {
      const { error } = await db.storage.from("avatares").upload(`${COLAB1}/malo-${contentType.length}`, new Blob(["<x/>"], { type: contentType }), { contentType });
      expect(error, contentType).not.toBeNull();
    }
  });

  it("nadie sin sesión sube ni lista", async () => {
    const anon = createClient<Database>(URL_API, ANON, opciones);
    const { error } = await anon.storage.from("avatares").upload(`${COLAB1}/anon.png`, PNG, { contentType: "image/png" });
    expect(error).not.toBeNull();
    const { data } = await anon.storage.from("avatares").list(COLAB1);
    expect(data ?? []).toHaveLength(0);
  });
});

describe("dependencias y calendario (fase 4)", () => {
  // Seed: la 2 depende de la 1 (en curso), la 3 de la 2 (en revisión, 2 días de desfase) y la 5
  // de la 4 (cancelada: ya no bloquea).
  const tarea = (n: number) => `13000000-0000-4000-a000-${String(n).padStart(12, "0")}`;

  it("listarBloqueosDeProyecto da solo predecesoras abiertas", async () => {
    const db = await ingresar("pm1.a@prueba.test");
    const bloqueos = await listarBloqueosDeProyecto(db, P1);
    expect(bloqueos[tarea(2)]).toEqual(["Tarea de ejemplo 1"]);
    expect(bloqueos[tarea(3)]).toEqual(["Tarea de ejemplo 2"]);
    expect(bloqueos[tarea(5)]).toBeUndefined();
  });

  it("listarDependenciasDeTarea trae los dos lados con el desfase", async () => {
    const db = await ingresar("pm1.a@prueba.test");
    const deps = await listarDependenciasDeTarea(db, tarea(2));
    expect(deps.dependeDe.map((t) => [t.id, t.desfaseDias])).toEqual([[tarea(1), 0]]);
    expect(deps.bloquea.map((t) => [t.id, t.desfaseDias])).toEqual([[tarea(3), 2]]);
  });

  it("otra empresa no ve los bloqueos de A", async () => {
    const db = await ingresar("admin.b@prueba.test");
    expect(await listarBloqueosDeProyecto(db, P1)).toEqual({});
  });

  it("listarCalendario trae el período sin canceladas, y solo dependencias de lo que trajo", async () => {
    const db = await ingresar("pm1.a@prueba.test");
    const datos = await listarCalendario(db, { desde: sumarDias(HOY, -20), hasta: sumarDias(HOY, 20), proyectoId: P1 });
    expect(datos.tareas.length).toBeGreaterThan(0);
    expect(datos.tareas.every((t) => t.estado !== "cancelada" && t.proyectoId === P1)).toBe(true);
    expect(datos.tareas.every((t) => t.fechaLimite >= sumarDias(HOY, -20))).toBe(true);
    const ids = new Set(datos.tareas.map((t) => t.id));
    expect(datos.dependencias.every((d) => ids.has(d.tareaId) || ids.has(d.dependeDeId))).toBe(true);
    for (const d of datos.dependencias) expect(datos.titulos[d.tareaId] && datos.titulos[d.dependeDeId]).toBeTruthy();
  });
});

describe("carga por persona (fase 4)", () => {
  const lunes = lunesDe(HOY);

  it("el colaborador recibe solo su fila; el PM, a todos los activos de la empresa", async () => {
    const colab = await obtenerCarga(await ingresar("colab1.a@prueba.test"), { organizacionId: ORG, desde: lunes });
    expect(colab.semanas).toHaveLength(8);
    expect(colab.personas.map((p) => p.persona.id)).toEqual([COLAB1]);
    expect(colab.personas[0]!.persona.nombre).toBe("Diego Paz");

    const db = await ingresar("pm1.a@prueba.test");
    const pm = await obtenerCarga(db, { organizacionId: ORG, desde: lunes });
    const activos = (await listarMiembros(db, ORG)).filter((m) => m.activo).length;
    expect(pm.personas).toHaveLength(activos);
    expect(pm.personas.every((p) => p.semanas.length === 8)).toBe(true);
  });

  it("las tareas de una celda son abiertas y tocan esa semana; en la de hoy, también las vencidas", async () => {
    const db = await ingresar("pm1.a@prueba.test");
    const tareas = await listarTareasDeSemana(db, { personaId: COLAB1, lunes, hoy: HOY });
    for (const t of tareas) {
      expect(["por_hacer", "en_curso", "en_revision"]).toContain(t.estado);
      expect(t.fechaLimite >= lunes || t.atrasada).toBe(true);
      expect(t.atrasada).toBe(t.fechaLimite < HOY);
      expect((t.fechaInicio ?? t.fechaLimite) <= sumarDias(lunes, 6)).toBe(true);
    }
    // Otra semana no trae vencidas.
    const siguiente = await listarTareasDeSemana(db, { personaId: COLAB1, lunes: sumarDias(lunes, 7), hoy: HOY });
    expect(siguiente.every((t) => !t.atrasada && t.fechaLimite >= sumarDias(lunes, 7))).toBe(true);
  });
});
