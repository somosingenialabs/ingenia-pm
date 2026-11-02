# Ingenia PM · Cómo arrancar

Luciano, esta carpeta tiene todo el plan para construir Ingenia PM con Claude desde tu cuenta. Todavía no hay código: lo va escribiendo Claude, fase por fase.

## Qué es

Una app de gestión de proyectos: tareas en tablero y lista, calendario, carga por persona, comentarios en vivo, registro de horas y métricas. Primero para uso interno de Ingenia, con miras a venderla.

**Stack:** Next.js, Supabase y Tailwind. Reusa buena parte de `crm-base`, el CRM de ventas de Ingenia.

## Qué necesitás instalar

| Programa | Para qué |
|---|---|
| Claude Code (app de escritorio o terminal), con tu cuenta | Es quien construye el proyecto |
| [Git](https://git-scm.com/downloads) | Guardar versiones y bajar `crm-base` |
| [Node.js](https://nodejs.org) 22.12 o más | Correr la app |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Levantar la base de datos en tu PC. En Windows puede pedir activar WSL2 y reiniciar |

Si no podés instalar Docker, avisale a Claude en la fase 1: hay una alternativa con un proyecto de desarrollo en Supabase nube.

## Pasos

**1. Descomprimí el zip** donde trabajes. Queda una carpeta `ingenia-pm`.

**2. Bajá `crm-base` al lado de esa carpeta.** Corré esto en la carpeta que contiene a `ingenia-pm`. Si te lo pide, entrá con tu cuenta de GitHub, la que tiene acceso a `somosingenialabs`.

```bash
git clone https://github.com/somosingenialabs/crm-base.git
```

Tiene que quedar así:

```
tu-carpeta/
├─ crm-base/
└─ ingenia-pm/
```

**3. Abrí una sesión de Claude en la carpeta `ingenia-pm`.** No en la de arriba: así carga las reglas del proyecto.

**4. Pegá este pedido:**

> Ejecutá `docs/fases/fase_1_setup_auth.md`.

Claude va a verificar tu PC antes de tocar nada, y te va a pedir el sí para crear el repo local.

## Cómo se trabaja

- **Una sesión nueva por fase.** Cada fase lee solo lo suyo, y así se gastan menos tokens. Para la siguiente, abrí otra sesión y pedí lo mismo con el archivo que corresponda.
- **`docs/estado.md` es la memoria entre fases.** Cada fase lo actualiza al cerrar. Si vas a retomar, empezá por ahí.
- **Una fase no está terminada** hasta que lint, tipos, tests y build den verde, con la salida a la vista.
- **Claude no commitea ni sube nada sin tu sí.** Pediselo al cerrar cada fase.

| Orden | Archivo | Termina con |
|---|---|---|
| 1 | `docs/fases/fase_1_setup_auth.md` | Login andando y marco visual |
| 2 | `docs/fases/fase_2_schema_db.md` | Base de datos con seguridad por fila, probada |
| 3 | `docs/fases/fase_3_core_ui_bento.md` | Inicio, proyectos, tablero, lista e invitaciones |
| 4 | `docs/fases/fase_4_calendar_realtime.md` | Calendario, carga, dependencias y comentarios en vivo |
| 5 | `docs/fases/fase_5_analytics_time.md` | Temporizador, horas y métricas |

## Lo que tenés que saber

- **El SQL de la fase 2 nunca se ejecutó.** Se escribió sin una base disponible, así que puede necesitar ajustes. Los tests de esa fase lo validan.
- **El repo en GitHub no existe todavía.** El nombre propuesto es `somosingenialabs/ingenia-pm`. Conviene crearlo al cerrar la fase 1, para no tener el trabajo solo en tu PC.
- **`crm-base` es solo para leer y copiar.** No se modifica desde este proyecto.
- **Producción no entra en las 5 fases.** Dónde se despliega, el servidor de mail y el primer Admin real quedan como pendientes en `docs/estado.md`.
- **Las decisiones de diseño y de roles** están en `docs/arquitectura.md`. Si querés cambiar alguna, pedile a Claude que la escriba en `docs/decisiones/`.
- **Datos:** en desarrollo van solo personas ficticias con mails `@prueba.test`. Nada de datos reales de clientes ni de Delpack.
