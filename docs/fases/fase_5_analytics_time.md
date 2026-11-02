# Fase 5 · Registro de horas, métricas de eficiencia y dashboards

**Rol:** desarrollador senior con criterio de análisis de datos. Ejecutá esta fase completa y frená al cerrarla.

**Antes de empezar, leé:** `docs/estado.md` y `docs/arquitectura.md`, secciones 2 y 4. Reusá `BentoCard`, `tarjetas-inicio.tsx`, `fechas.ts` y el lugar `<SeccionTiempo />` del detalle de tarea. Si tu entorno tiene una skill de visualización de datos (`dataviz`), cargala antes de escribir gráficos.

## Objetivo

Cargar horas sin fricción, y responder con datos tres preguntas: **dónde se traba el trabajo, quién está sobrecargado y qué tan bien estimamos.**

**Termina con:** horas cargadas por temporizador y a mano, y una pantalla de Analítica cuyos números coinciden con los resultados calculados a mano sobre el seed.

## Fuera de esta fase

Costos y tarifas, facturación, aprobación o cierre de horas, exportar a PDF, feriados, comparar contra el mercado.

**Dependencias de esta fase:** `recharts`.

## Paso 1 · Temporizador y carga de horas

### Migración

| Función | Qué hace |
|---|---|
| `public.iniciar_temporizador(p_tarea uuid)` | En una transacción: detiene el que esté corriendo y crea otro con `inicio = now()`, `fecha` = hoy en la zona de la empresa. Usa siempre la hora del servidor, nunca la del navegador |
| `public.detener_temporizador(p_minutos int default null, p_nota text default null)` | Pone `fin = now()` y `minutos = greatest(1, round(duración))`. Si pasó de 24 h, exige `p_minutos`; si no, falla: nadie trabajó eso, se olvidó prendido |
| `public.descartar_temporizador()` | Borra el que está corriendo |

Corren como `security invoker`, con el RLS de `registros_tiempo`. Test en `supabase/tests/tiempo.test.sql`, incluido el cambio de día en la zona de la empresa.

### Pantallas

Archivos: `src/components/tiempo/*`, `src/lib/data/tiempo/`.

- **Temporizador global en el encabezado** (escritorio) y sobre la barra inferior (celular), visible si hay uno corriendo: tarea, tiempo y botón detener.
  - El estado sale de la base: `inicio` del registro abierto. Se calcula `ahora - inicio` en el navegador con un intervalo de 1 segundo, así sobrevive a recargar y a cambiar de dispositivo.
  - Refrescá al volver a la pestaña.
- **Si pasó de 10 h:** al detener pregunta "¿Lo dejaste prendido?" y deja corregir los minutos.
- **`<SeccionTiempo />` en el detalle de tarea:** iniciar y detener, carga manual, total registrado contra estimado, lista de registros.
- **Tablero y Mis tareas:** botón iniciar en la tarjeta, de 44 px.
- **`/horas`:** "Mis horas" con grilla semanal (tareas por día, con totales), navegación por semana y carga manual en un toque.
  - **Carga manual:** tarea, fecha (hoy por defecto), duración. Acepta `1:30`, `1.5` o `90m`, con parser con test.
  - Editar y borrar los propios. Admin corrige ajenos desde un filtro de persona.
  - Avisá si el día supera 12 h, sin impedirlo.
  - A 375 px: lista por día, no grilla.

Prendé Horas y Analítica en la navegación.

## Paso 2 · Métricas

Funciones en `analitica`, con `security invoker` para que siga filtrando el RLS. Todas excluyen lo eliminado y lo cancelado, salvo que se indique; agrupan en la zona de la empresa; devuelven `n` (cuántos datos hay detrás) y se llaman por RPC.

Parámetros comunes: `p_desde date, p_hasta date, p_proyectos uuid[] default null, p_usuarios uuid[] default null`.

**Restricción por rol:** en las funciones por persona, si `app.rol_actual() = 'colaborador'`, se fuerza `p_usuarios := array[auth.uid()]`. Sin esto, un colaborador vería por RPC los números de sus compañeros de proyecto.

| Función | Devuelve | Definición exacta |
|---|---|---|
| `horas_por_periodo` | `periodo, proyecto_id, usuario_id, horas` | Suma de `minutos / 60` por semana, según `fecha`. Excluye temporizadores corriendo |
| `utilizacion` | `usuario_id, horas, capacidad, porcentaje` | Horas registradas / (`horas_semanales` × días hábiles del período / 5). Sin descontar feriados, y debe decirlo |
| `precision_estimacion` | `usuario_id o proyecto_id, mediana_ratio, n` | Sobre tareas `hecha` con `horas_estimadas > 0` y al menos un registro: horas reales / estimadas. 1 = exacto, mayor a 1 = subestimado. Mediana, porque un caso extremo no la mueve |
| `tiempos_de_ciclo` | `mediana_lead_horas, mediana_ciclo_horas, n` | Lead: `creado_en` a `completada_en`. Ciclo: primera entrada a `en_curso` a `completada_en` |
| `tiempo_en_estado` | `estado, mediana_horas, p85_horas, n` | Duración de cada paso por un estado, con `lead(cambiado_en)` sobre el historial. Horas corridas, no laborales. Una tarea que vuelve suma pasos separados |
| `cuellos_de_botella` | `estado, tareas_ahora, trabadas, mediana_horas, n` | Por estado abierto. **Trabada:** lleva en ese estado más que el p85 de ese estado, con `n >= 5`; si no alcanza, más de 7 días |
| `tareas_trabadas` | `tarea_id, proyecto_id, asignado_id, estado, horas_en_estado` | El detalle de las anteriores, ordenado de mayor a menor |
| `rendimiento` | `semana, tareas_hechas` | Tareas completadas por semana |
| `trabajo_en_curso` | `usuario_id, en_curso, en_revision` | Foto de ahora, por persona |
| `cumplimiento_plazos` | `a_tiempo, tarde, porcentaje, n` | Sobre `hecha` con `fecha_limite`: `completada_en` (en la zona de la empresa) en o antes del plazo |
| `consumo_presupuesto` | `proyecto_id, horas, presupuestadas, porcentaje, avance` | Horas registradas contra `horas_presupuestadas`, junto al avance. Si se consumió 80 % y el avance es 40 %, ahí hay un problema |

Esqueleto de `tiempo_en_estado`. Los pasos todavía abiertos (`hasta` nulo) no entran en la mediana: se miden contra `now()` solo para detectar trabadas.

```sql
with pasos as (
    select estado_nuevo as estado, cambiado_en as desde,
           lead(cambiado_en) over (partition by tarea_id order by cambiado_en, id) as hasta
    from public.tarea_historial_estados
)
select estado, percentile_cont(0.5) within group (order by extract(epoch from hasta - desde) / 3600), ...
from pasos where hasta is not null and estado not in ('hecha', 'cancelada') ...
```

Si una función tarda más de 500 ms con 50.000 tareas de prueba, sumá índice. Materializar se deja para cuando haya volumen real.

## Paso 3 · Seed con resultados conocidos

`supabase/seed/40_historia.sql`: historia con fechas relativas a `current_date`, cubriendo 12 semanas de la empresa A: tareas con su historial completo y registros de tiempo. Un proyecto deja `en_revision` claramente trabada, para que el cuello de botella se vea.

`supabase/tests/metricas.test.sql`: con un conjunto chico y aislado dentro de la transacción, **calculá a mano** cada resultado y comparalo con la función.

Casos: tarea que vuelve de estado, sin estimación, sin registros, temporizador corriendo, `n` menor al mínimo, colaborador que pide datos de otro, usuario de otra empresa, cambio de día por zona horaria.

## Paso 4 · Pantallas

### `/analitica`

Filtros en la URL: período (4, 12 o 26 semanas, o a medida), proyecto y persona. Admin y PM ven al equipo; Colaborador ve solo su información, sin el filtro de persona.

| Tarjeta | Tamaño | Visual | Responde |
|---|---|---|---|
| Horas registradas | chica | Valor y variación contra el período anterior | Cuánto se trabajó |
| Tareas hechas | chica | Valor y variación | Cuánto salió |
| Cumplimiento de plazos | chica | Porcentaje | Qué tan confiables son los plazos |
| Precisión de estimación | chica | Mediana, en palabras: "Tardamos 1,3 veces lo estimado" | Qué tan bien estimamos |
| Cuellos de botella | ancha | Barras horizontales: mediana por estado y tareas trabadas | Dónde se traba el trabajo |
| Tareas trabadas | grande | Lista, con enlace a cada tarea | Qué destrabar hoy |
| Utilización por persona | grande | Barras con línea de capacidad al 100 % | Quién está sobrecargado |
| Rendimiento semanal | mediana | Línea | Tendencia |
| Horas por proyecto | mediana | Barras apiladas por semana, hasta 6 proyectos y "Otros" | Dónde va el esfuerzo |
| Consumo de presupuesto | ancha | Tabla: horas, presupuesto, consumo, avance | Qué proyecto se está pasando |

En `/inicio`, sumá al registro de tarjetas: "Mis horas de la semana" para todos, y "Tareas trabadas" para Admin y PM.

### Reglas de presentación

- **Con `n` menor a 5 no se muestra el número:** "Todavía no hay datos suficientes (3 de 5)". Un promedio de dos tareas lleva a conclusiones falsas.
- Cada tarjeta dice en una línea qué mide y cómo se calcula. Admite ver la tabla de datos: los gráficos necesitan alternativa accesible.
- Color y etiqueta: nunca solo color, con paleta que funcione en claro y oscuro y para daltónicos. Recharts dentro de un `ResponsiveContainer`. A 375 px, gráficos simplificados sin leyenda lateral.
- Sin datos de ejemplo, sin objetivos inventados, sin "-20 %" ni comparaciones con el mercado. Solo datos medidos.
- **Sin ranking de personas.** Listá por nombre, no por rendimiento. Una tabla de posiciones empuja a inflar horas y empeora los datos. Las métricas sirven para encontrar problemas de flujo y sobrecarga.

## Cierre

**E2E, escritorio y 375 px:**
- Iniciar, recargar la página, ver el tiempo corriendo, detener, ver el registro.
- Iniciar otro detiene el anterior.
- Carga manual con `1:30`.
- Colaborador en `/analitica` ve solo lo suyo, y una llamada directa a la RPC con el id de otro devuelve solo lo suyo.
- Filtros en la URL sobreviven a recargar.
- Con `n` bajo aparece el mensaje.

**En verde y mostrando la salida:** `npm run test:sql`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`.

Mostrá capturas de `/horas` y `/analitica` en claro, oscuro y 375 px. Actualizá `docs/estado.md` y listá lo que falta para producción: despliegue, SMTP, primer Admin real, respaldos. Proponé el commit, no lo hagas sin un sí.
