# Ingenia PM

Gestión de proyectos B2B (tareas, calendario, horas y métricas). Uso interno en Ingenia primero, con miras a venderla. Estado: planificada, sin código.

No confundir con la carpeta `gestion-de-proyectos` de la oficina de Ingenia: esas son otras tres soluciones (tablero M365, puesta en marcha, portal de avance).

## Reglas comunes de Ingenia

@docs/reglas/respuestas.md
@docs/reglas/tono.md

## Ruta a crm-base

`crm-base` es el CRM de ventas de Ingenia, de donde se reusa código. Las fases lo nombran como `<crm-base>`. Solo lectura: nunca lo modifiques desde acá.

- Buscalo primero en `../crm-base` y después en `../../CRM de ventas`.
- Si no está en ninguna, pedí la ruta o proponé clonarlo al lado de esta carpeta desde `https://github.com/somosingenialabs/crm-base`.
- Si un archivo que nombra una fase cambió de lugar, buscalo en `<crm-base>` en vez de reescribirlo de cero.

## Al arrancar una sesión

1. Leé `docs/estado.md`: qué fase sigue y qué dejó la anterior.
2. Si te pasaron una fase, leé **solo** `docs/fases/fase_N_*.md`. No leas las otras fases ni `docs/arquitectura.md` entera: cada fase dice qué sección necesita.
3. Una fase por sesión. Si un pedido se va de la fase, avisá en vez de mezclar.

## Reglas de arquitectura

No se negocian sin una decisión escrita en `docs/decisiones/`.

- **La seguridad real es el RLS de Postgres** (seguridad por fila: la base filtra sola, aunque la pantalla se equivoque). Toda tabla nace con RLS, políticas y test en la misma tanda.
- Toda tabla de negocio lleva `organizacion_id`. El rol se consulta en `miembros` con helpers de `app.*`, nunca se confía al token.
- Migraciones nuevas, nunca editar una aplicada. Funciones `security definer` con `set search_path = ''` y nombres calificados.
- La clave secreta de Supabase solo en el servidor, después de verificar el rol. Nunca en un componente de cliente ni en un log.
- Lecturas: reciben el cliente de Supabase como primer parámetro. Escrituras: Server Actions con Zod que devuelven `Resultado<T>`, sin tirar excepciones para errores esperables.
- Sin modo demo. Se desarrolla con datos de `supabase/seed/` (mails `@prueba.test`). Ningún dato real de un cliente en desarrollo.
- Nombres del dominio en castellano sin acentos ni eñes (`tareas`, `fecha_limite`). Lo técnico en inglés.
- Diseño: `docs/arquitectura.md`, sección 4. Primero celular, 44 px para tocar, contraste AA, el estado nunca solo con color.
- Solo se instalan las dependencias que lista la fase. Otra distinta se pide antes.

## Repo

- Este repo es propio. Antes de cualquier comando de git, confirmá con `git rev-parse --show-toplevel` que devuelve esta carpeta y no una de arriba.
- No se commitea, no se sube y no se crea el repo remoto sin un sí explícito. Ningún secreto en el repo.
- Nada se da por terminado sin lint, tipos, tests y build en verde, mostrando la salida.

## Cómo colaborar con el usuario

Explicá el porqué y definí cada término técnico la primera vez. Las decisiones se proponen con una recomendación.

## Detalles de la PC

- Mirá el sistema operativo antes de dar comandos. En Windows con PowerShell usá `npx.cmd` y `npm.cmd`, y no edites archivos con `Get-Content`/`Set-Content` de PowerShell 5: rompe los acentos.
- Si la ruta de la carpeta tiene espacios, citala siempre entre comillas.
