# Arquitectura · Ingenia PM

Referencia común de las 5 fases. Cada fase indica qué sección leer. Un cambio posterior se escribe en `docs/decisiones/` y manda sobre este archivo.

## 1. Decisiones de base

| Tema | Decisión | Por qué |
|---|---|---|
| Punto de partida | Copiar y adaptar de `crm-base` el marco, el kit de UI y el patrón multi-empresa | Mismo stack, ya probado. Evita reescribir lo que no diferencia al producto |
| Multi-empresa | `organizacion_id` y RLS desde el día 1, aunque arranque con una sola empresa | Agregarlo después obliga a tocar todas las tablas y políticas. Es lo más caro de postergar si se quiere vender |
| Base en desarrollo | Supabase local en Docker. Alternativa: proyecto de desarrollo en Supabase nube (fase 1, paso 0) | Sin costo, datos descartables, se resetea con un comando |
| Asignación | Un solo responsable por tarea | La carga y las métricas por persona quedan sin ambigüedad |
| Estados de tarea | Fijos: `por_hacer`, `en_curso`, `en_revision`, `hecha`, `cancelada` | Las métricas de cuello de botella necesitan estados comparables. Configurables, en una versión posterior |
| Calendario | `react-big-calendar` 1.20 | MIT, soporta React 19, sin polyfill extra. FullCalendar 7 pide `temporal-polyfill`, y sus vistas de recursos no aportan a esta v1 |
| Carga de trabajo | Vista propia (grilla persona por semana) | Ninguna de las dos librerías la resuelve gratis |
| Dependencias | Solo "fin a inicio", dentro del mismo proyecto, con aviso de conflicto | Dibujar flechas es un Gantt, que es otro producto. El valor está en avisar el conflicto |
| Borrado | Lógico con `eliminado_en`. El RLS de lectura no filtra esa columna: filtra la capa de datos | Si la política filtrara, un `update` que marca el borrado falla por RLS y Realtime no avisaría a los demás |

### Fuera de la v1

Adjuntos en tareas, subtareas, menciones y notificaciones por mail, feed ICS, feriados y licencias en la capacidad, costos y tarifas, estados configurables, facturación del SaaS, alta de empresas por autoservicio, Gantt, despliegue a producción.

## 2. Roles

Viven en `miembros.rol`. La regla de la interfaz en `src/lib/auth/permisos.ts` es espejo del RLS; si no coinciden, manda la base.

| Acción | Admin | PM | Colaborador |
|---|---|---|---|
| Ver proyectos y tareas | Todos | Todos | Solo proyectos donde es miembro |
| Crear proyecto | Sí | Sí | No |
| Editar proyecto y sus miembros, crear y editar tareas, dependencias | Todos | Donde es miembro | No |
| Editar una tarea asignada a sí mismo | Sí | Sí | Solo `estado`, `posicion` y `descripcion` |
| Comentar | Sí | Sí | En sus proyectos |
| Editar comentario | El propio | El propio | El propio |
| Borrar comentario | Cualquiera | En sus proyectos | El propio |
| Cargar horas | Propias | Propias | Propias, en sus proyectos |
| Ver horas | Todas | Todas | De sus proyectos |
| Corregir horas ajenas | Sí | No | No |
| Métricas por persona | Todas | Todas | Solo las propias |
| Borrar proyecto, miembros, invitaciones, datos de la empresa | Sí | No | No |

**Gestor de un proyecto:** Admin, o PM que es miembro de ese proyecto. El responsable y quien crea el proyecto quedan como miembros automáticamente.

## 3. Árbol de directorios

Lo marcado con el número de fase nace en esa fase. `[crm]` = se copia y adapta de `crm-base`.

```
Gestion de proyectos/
├─ CLAUDE.md
├─ README.md                          F1  cómo levantarlo
├─ package.json, tsconfig.json, next.config.ts, eslint.config.mjs,
│  components.json, vitest.config.ts, playwright.config.ts   F1 [crm]
├─ .env.example, .gitignore           F1 [crm]
├─ docs/
│  ├─ arquitectura.md
│  ├─ estado.md
│  ├─ decisiones/                     desvíos y decisiones nuevas, numeradas desde 001
│  └─ fases/fase_1 ... fase_5
├─ scripts/
│  └─ test-sql.mjs                    F2  corre supabase/tests/*.sql
├─ e2e/                               F1+ Playwright, escritorio y 375 px
├─ public/                            F1  íconos
├─ supabase/
│  ├─ config.toml                     F1  puertos propios, hook de token en F2
│  ├─ migrations/                     F2 esquema y RLS · F4 RPC y realtime · F5 temporizador y analítica
│  ├─ seed/
│  │  ├─ 10_usuarios.sql              F1
│  │  ├─ 20_organizaciones.sql        F2
│  │  ├─ 30_proyectos.sql             F2
│  │  └─ 40_historia.sql              F5  historia con resultados conocidos
│  └─ tests/                          F2+ tests SQL de RLS y métricas
└─ src/
   ├─ proxy.ts                        F1 [crm]
   ├─ app/
   │  ├─ layout.tsx, globals.css, providers.tsx, manifest.ts   F1 [crm]
   │  ├─ (auth)/
   │  │  ├─ ingresar/, recuperar/, nueva-clave/   F1
   │  │  └─ invitacion/[token]/       F3
   │  ├─ auth/callback/route.ts       F1
   │  └─ (app)/
   │     ├─ layout.tsx                F1 [crm] marco: barra lateral y pestañas
   │     ├─ inicio/                   F1 mínima · F3 Bento · F5 suma tarjetas
   │     ├─ proyectos/, proyectos/[id]/   F3  tablero y lista, tarea con ?tarea=<id>
   │     ├─ mis-tareas/               F3
   │     ├─ calendario/               F4
   │     ├─ carga/                    F4
   │     ├─ horas/                    F5
   │     ├─ analitica/                F5
   │     └─ configuracion/{perfil,miembros,organizacion}/   F3
   ├─ components/
   │  ├─ ui/, estado/, layout/, bento/   F1 [crm]
   │  ├─ proyectos/, tareas/          F3
   │  ├─ comentarios/, calendario/, carga/   F4
   │  ├─ tiempo/, analitica/          F5
   ├─ hooks/                          F1 [crm] · F4 use-canal-realtime
   └─ lib/
      ├─ config.ts, utils.ts          F1 [crm]
      ├─ supabase/{client,server,database.types}.ts   F1 [crm], tipos en F2
      ├─ auth/{contexto,permisos,tipos}.ts   F2
      ├─ validaciones/                F3
      ├─ fechas.ts                    F3  la única puerta para columnas `date`
      ├─ data/{comun.ts,proyectos,tareas,miembros,inicio}/   F3
      ├─ data/{comentarios,calendario,carga}/   F4
      └─ data/{tiempo,analitica}/     F5
```

## 4. Diseño

Inspirado en Apple HIG con paneles Bento, estrictamente minimalista. Es un producto, así que no sigue el manual de la landing. Coincide con él en colores porque la paleta de Ingenia ya es la de Apple.

**Fundamentos**
- Letra del sistema (SF Pro en Apple) con Inter de respaldo. Números con `tabular-nums`.
- Escala: Large Title 34, Title 28/22/20, Headline 17 semibold, Body 17 en celular y 13 a 15 en escritorio, Caption 12.
- Grilla de 8 px, mucho aire, una sola acción primaria por pantalla. Sin sombras decorativas ni gradientes en datos.
- Radios: 8 (controles), 14 (tarjetas), 22 (hojas).

**Color (variables CSS, claro y oscuro)**

| Token | Claro | Oscuro |
|---|---|---|
| fondo | `#F2F2F7` | `#000000` |
| superficie | `#FFFFFF` | `#1C1C1E` |
| elevada | `#FFFFFF` | `#2C2C2E` |
| texto | `#1C1C1E` | `#FFFFFF` |
| texto secundario | `#636366` | `#8E8E93` |
| borde | `#D1D1D6` | `#38383A` |
| acento (botón con texto blanco) | `#0062CC` | `#0062CC` |
| acento (texto chico) | `#0062CC` | `#409CFF` |
| positivo | `#30B0C7` | `#30B0C7` |
| alerta | `#F59E0B` | `#F59E0B` |

El acento se puede pisar por empresa con `organizaciones.color_acento`. El gris `#8E8E93` no se usa para texto chico en fondo claro: no llega a AA.

**Interacción**
- Materiales: barra lateral, encabezado, pestañas y hojas con `backdrop-blur`. Sólido si el usuario pidió reducir transparencia.
- Animaciones cortas que respetan "reducir movimiento". 44 px para tocar. Foco visible.
- El estado siempre lleva texto o ícono además del color.
- Lo destructivo pasa por `ConfirmarAccion`.
- Escritorio: barra lateral colapsable, paleta de comandos (Ctrl/Cmd+K), detalle en panel lateral.
- Celular: barra inferior con Inicio, Proyectos, Calendario, Horas y Más. Detalle en hoja desde abajo (`HojaAdaptable`).

**Bento**
- 12 columnas en escritorio, 6 en tablet, 1 en celular. Tamaños: chica 3×1, mediana 6×2, grande 6×3, ancha 12×2.
- Cada tarjeta trae título, "qué mide" en una línea, valor y estados propios de carga, vacío y error.

**Textos de la app**
- Voseo, sin rayas largas, frases cortas. La marca se escribe "Ingenia".
- Nada de métricas de ejemplo ni promesas de resultados.
