# Fase 3 · Dashboard Bento y CRUD de proyectos y tareas

**Rol:** desarrollador senior de producto, con ojo de diseño. Ejecutá esta fase completa y frená al cerrarla.

**Antes de empezar, leé:** `docs/estado.md` y `docs/arquitectura.md`, secciones 2 y 4. El esquema lo tenés en `src/lib/supabase/database.types.ts` y `supabase/migrations/`.

**Referencia de patrón (solo lectura), en `<crm-base>`:** `src/lib/data/comun.ts`, `src/lib/data/oportunidades/`, `src/lib/data/miembros/`, `src/components/ui/data-table.tsx` y `hoja-adaptable.tsx`, `src/app/(auth)/invitacion/`, `docs/decisiones/101-contratos-de-la-etapa-0.md`.

## Objetivo

La herramienta ya sirve para trabajar: inicio Bento, proyectos, tareas en tablero y lista, y gestión de miembros con invitaciones.

**Termina con:** un PM crea un proyecto, suma a un colaborador, crea y asigna una tarea; el colaborador entra y la mueve de columna en escritorio y en celular.

## Fuera de esta fase

Comentarios (dejá el lugar en el panel), calendario, carga, dependencias, realtime, temporizador y métricas.

**Dependencias de esta fase:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `@tanstack/react-query`, `@tanstack/react-table`, `@tanstack/react-virtual`, `date-fns`.

## Paso 1 · Capa de datos

Según la decisión 101 de `crm-base`. Copiá `comun.ts`.

```
src/lib/fechas.ts                      la única puerta para columnas `date`
src/lib/validaciones/{proyectos,tareas,miembros}.ts   Zod compartido entre cliente y servidor
src/lib/data/proyectos/{consultas,acciones}.ts
src/lib/data/tareas/{consultas,acciones}.ts
src/lib/data/miembros/{consultas,acciones}.ts
src/lib/data/inicio/consultas.ts
```

- `fechas.ts`: `fechaDesdeBase("2026-11-03")` construye la fecha local. **Nunca `new Date("2026-11-03")`:** se interpreta en UTC y en Argentina muestra el día anterior. Con test.
- Toda consulta filtra `.is("eliminado_en", null)`. Un test lo verifica por función, contra el seed.
- Las acciones validan con Zod y devuelven `Resultado<T>`. Traducí los errores de Postgres a mensajes claros con `mensaje-de-error.ts`: dependencia cíclica, asignado no miembro, RLS.
- Las acciones `revalidatePath` solo lo necesario.

| Módulo | Funciones |
|---|---|
| proyectos | `listarProyectos(db, filtros)` con avance, `obtenerProyecto(db, id)`, `crearProyecto`, `editarProyecto`, `eliminarProyecto`, `agregarMiembro`, `quitarMiembro` |
| tareas | `listarTareasDeProyecto(db, id, filtros)`, `listarMisTareas(db)`, `obtenerTarea(db, id)`, `crearTarea`, `editarTarea`, `moverTarea({ id, estado, posicion })`, `eliminarTarea` |
| miembros | `listarMiembros(db)`, `invitar`, `revocarInvitacion`, `aceptarInvitacion`, `cambiarRol`, `cambiarHorasSemanales`, `desactivarMiembro` |
| inicio | Una función por tarjeta |

`moverTarea` calcula la posición como punto medio entre vecinas; al final de la columna, última + 1000.

`quitarMiembro`, si la persona tiene tareas abiertas en ese proyecto: no quita, y devuelve el conteo para que la pantalla pida reasignarlas.

## Paso 2 · Pantallas

### `/inicio` (Bento)

Registro simple en `src/components/bento/tarjetas-inicio.tsx`: la fase 5 suma ahí, sin rehacer la grilla. No muestres tarjetas de "próximamente".

| Tarjeta | Tamaño | Qué muestra | Toca y lleva a |
|---|---|---|---|
| Vencidas | chica | Mis tareas con `fecha_limite` pasada y no cerradas | Mis tareas |
| Para hoy | chica | Mis tareas que vencen hoy | Mis tareas |
| En curso | chica | Mis tareas `en_curso` | Mis tareas |
| Proyectos activos | chica | Cantidad visible | Proyectos |
| Próximos plazos | grande | Próximos 7 días, con proyecto y responsable | La tarea |
| Proyectos | grande | Activos, con avance y estado de salud | El proyecto |
| Mi semana | ancha | Tareas por día, lunes a viernes | La tarea |

Admin y PM ven además una tarjeta chica "Sin asignar".

Cada tarjeta carga sola con su `Suspense`. Si falla una, las demás siguen.

**Definiciones, escritas en el "qué mide" de cada tarjeta:**
- **Avance:** tareas `hecha` / tareas no canceladas. Sin tareas, "Sin tareas", no 0 %.
- **Salud del proyecto:**
  - Atrasado: `fecha_fin_objetivo` pasada y el proyecto sigue abierto, o tarea `urgente` vencida.
  - En riesgo: alguna tarea vencida, o menos de 7 días al objetivo y avance menor a 80 %.
  - Al día: el resto.
  - Siempre con ícono y texto, nunca solo color. Los umbrales van en una constante con test.

### `/proyectos`

- Tabla densa en escritorio (TanStack Table): nombre, cliente, responsable, estado, avance, objetivo, salud. Orden y filtros por estado y responsable.
- Tarjetas en celular.
- Crear y editar en `HojaAdaptable`, con React Hook Form + Zod. El botón solo aparece a Admin y PM.

### `/proyectos/[id]`

- Encabezado con datos y miembros. Pestañas con control segmentado: **Tablero** y **Lista** (`?vista=`).
- **Tablero:** 4 columnas (por hacer, en curso, en revisión, hecha). `cancelada` no se muestra: se filtra en Lista.
  - Arrastre con `@dnd-kit`: mouse, dedo y teclado. Actualización optimista; si falla, vuelve a su lugar con un aviso.
  - La tarjeta muestra título, prioridad (ícono y texto), asignado, fecha, y "Vencida" en texto si corresponde.
  - **A 375 px no hay columnas lado a lado:** control segmentado por estado y lista de tarjetas. Se mueve con un menú "Mover a...", no arrastrando, porque choca con el scroll.
  - Colaborador: arrastra solo sus tareas. Las demás se ven sin agarre.
- **Lista:** TanStack Table + Virtual, filtros por estado, asignado y prioridad, selección múltiple para cambiar estado o asignado (solo gestor).

### Detalle de tarea, `?tarea=<id>` en cualquier pantalla

Panel lateral en escritorio y hoja desde abajo en celular. Con el id en la URL se puede compartir el enlace y volver atrás.

Campos: título, descripción, estado, prioridad, asignado, fechas, horas estimadas. Colaborador ve como solo lectura lo que no puede cambiar, sin dejar el campo activo.

Dejá dos lugares marcados, sin contenido visible:
- `<SeccionComentarios tareaId />`, para la fase 4.
- `<SeccionTiempo tareaId />`, para la fase 5.

### `/mis-tareas`

Agrupadas en Vencidas, Hoy, Próximas y Sin fecha. Cambio de estado en un toque.

### `/configuracion`

- `perfil`: nombre, avatar y contraseña. Bucket `avatares` en una migración de esta fase: público de lectura, cada usuario escribe solo en `avatares/<su id>/*`, hasta 2 MB, solo imágenes, con test.
- `miembros` (solo Admin): lista, rol, horas semanales, desactivar, invitaciones pendientes.
- `organizacion` (solo Admin): nombre, zona horaria, logo y color de acento.

### Invitaciones

**Sin depender de SMTP:**
1. Admin ingresa mail y rol. La Server Action verifica el rol, genera un token, guarda **solo el hash** y devuelve el enlace.
2. La pantalla lo muestra para copiar y mandar por donde quieran, con vencimiento de 7 días.
3. `/invitacion/[token]`: la persona pone nombre y contraseña. La acción valida, crea el usuario con `auth.admin.createUser` (`email_confirm: true`) usando la clave secreta, inserta en `miembros`, pone `organizacion_activa_id`, marca `aceptada_en` e inicia sesión.
4. Si el mail ya existe: pide ingresar y suma la membresía.

Todo el paso 3 se valida en el servidor contra el hash. Test: token vencido, revocado, ya usado y adulterado.

## Paso 3 · Calidad

- Estados de carga, vacío y error en cada pantalla, con `components/estado/`. Los vacíos invitan a la acción que corresponde al rol.
- Paleta de comandos: ir a proyecto, ir a tarea, nueva tarea.
- Navegación: prendé Inicio, Proyectos, Mis tareas, Configuración.

**E2E, escritorio y 375 px:**
- Recorrido completo del objetivo, con dos sesiones.
- Colaborador no ve el proyecto ajeno, ni escribiendo la URL.
- Colaborador no ve controles de gestor.
- Mover tarjeta con teclado.
- Invitación de punta a punta.
- 44 px, sin scroll horizontal a 375 px.

**Tests unitarios:** salud, avance, cálculo de posición, `fechas.ts`, esquemas Zod.

## Cierre

**En verde y mostrando la salida:** `npm run test:sql`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`.

Mostrá capturas de inicio, tablero y detalle, en claro, oscuro y 375 px. Actualizá `docs/estado.md`. Proponé el commit, no lo hagas sin un sí.
