-- =====================================================================
-- Ingenia PM · Migración 3: RLS (seguridad por fila)
--
-- Todo dato de negocio se ve y se toca solo en la empresa ACTIVA del token y
-- solo si quien llama es miembro activo. Los helpers van dentro de (select ...)
-- para que Postgres los calcule una vez por consulta y no una vez por fila.
--
-- Ninguna política de lectura filtra eliminado_en: Postgres exige que la fila
-- nueva pase la lectura, así que filtrarla rompería el borrado lógico y Realtime
-- no avisaría a los demás. Filtra la capa de datos.
--
-- Los helpers son security definer: leen sin pasar por el RLS, y por eso las
-- políticas de una tabla no se llaman a sí mismas (sin recursión).
-- =====================================================================

-- Proyectos que quien llama puede ver en la empresa activa.
create or replace function app.proyectos_visibles()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
    select p.id
    from public.proyectos p
    where p.organizacion_id = app.org_actual()
      and (
          app.rol_actual() in ('admin', 'pm')
          or (
              app.rol_actual() = 'colaborador'
              and exists (
                  select 1 from public.proyecto_miembros pm
                  where pm.proyecto_id = p.id and pm.usuario_id = (select auth.uid())
              )
          )
      )
$$;

-- Proyectos donde quien llama es gestor: admin, o pm que es miembro.
create or replace function app.proyectos_gestionados()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
    select p.id
    from public.proyectos p
    where p.organizacion_id = app.org_actual()
      and (
          app.rol_actual() = 'admin'
          or (
              app.rol_actual() = 'pm'
              and exists (
                  select 1 from public.proyecto_miembros pm
                  where pm.proyecto_id = p.id and pm.usuario_id = (select auth.uid())
              )
          )
      )
$$;

create or replace function app.tareas_visibles()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
    select t.id from public.tareas t where t.proyecto_id in (select app.proyectos_visibles())
$$;

create or replace function app.tareas_gestionadas()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
    select t.id from public.tareas t where t.proyecto_id in (select app.proyectos_gestionados())
$$;

revoke execute on function
    app.proyectos_visibles(), app.proyectos_gestionados(), app.tareas_visibles(), app.tareas_gestionadas()
    from public, anon;
grant execute on function
    app.proyectos_visibles(), app.proyectos_gestionados(), app.tareas_visibles(), app.tareas_gestionadas()
    to authenticated;

alter table public.organizaciones enable row level security;
alter table public.perfiles enable row level security;
alter table public.miembros enable row level security;
alter table public.invitaciones enable row level security;
alter table public.proyectos enable row level security;
alter table public.proyecto_miembros enable row level security;
alter table public.tareas enable row level security;
alter table public.tarea_dependencias enable row level security;
alter table public.tarea_historial_estados enable row level security;
alter table public.comentarios enable row level security;
alter table public.registros_tiempo enable row level security;

-- Nadie sin sesión toca nada, tampoco en las tablas de las fases que siguen.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- Supabase da estos permisos por defecto, y TRUNCATE saltea el RLS.
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

-- El historial es inmutable: solo lo escribe su trigger.
revoke insert, update, delete on public.tarea_historial_estados from authenticated;

-- =====================================================================
-- Plataforma
-- =====================================================================

create policy "organizaciones: miembros leen" on public.organizaciones
    for select to authenticated using (app.es_miembro(id));
create policy "organizaciones: admin edita" on public.organizaciones
    for update to authenticated
    using (app.tiene_rol(id, array['admin']))
    with check (app.tiene_rol(id, array['admin']));

create policy "perfiles: propio o compañeros" on public.perfiles
    for select to authenticated
    using (id = (select auth.uid()) or app.comparte_organizacion(id));
create policy "perfiles: edita el propio" on public.perfiles
    for update to authenticated
    using (id = (select auth.uid()))
    with check (id = (select auth.uid()));

create policy "miembros: miembros leen" on public.miembros
    for select to authenticated using (app.es_miembro(organizacion_id));
create policy "miembros: admin crea" on public.miembros
    for insert to authenticated with check (app.tiene_rol(organizacion_id, array['admin']));
create policy "miembros: admin edita" on public.miembros
    for update to authenticated
    using (app.tiene_rol(organizacion_id, array['admin']))
    with check (app.tiene_rol(organizacion_id, array['admin']));

create policy "invitaciones: admin lee" on public.invitaciones
    for select to authenticated
    using (organizacion_id = (select app.org_actual()) and (select app.rol_actual()) = 'admin');
create policy "invitaciones: admin crea" on public.invitaciones
    for insert to authenticated
    with check (organizacion_id = (select app.org_actual()) and (select app.rol_actual()) = 'admin');
create policy "invitaciones: admin edita" on public.invitaciones
    for update to authenticated
    using (organizacion_id = (select app.org_actual()) and (select app.rol_actual()) = 'admin')
    with check (organizacion_id = (select app.org_actual()) and (select app.rol_actual()) = 'admin');

-- =====================================================================
-- Proyectos
-- =====================================================================

-- Admin y PM van por el rol y no por el helper: al crear un proyecto, insert ... returning
-- pasa por esta política, y el helper todavía no ve la fila que se está insertando.
create policy "proyectos: visibles" on public.proyectos
    for select to authenticated
    using (
        organizacion_id = (select app.org_actual())
        and (
            (select app.rol_actual()) in ('admin', 'pm')
            or id in (select app.proyectos_visibles())
        )
    );
create policy "proyectos: admin o pm crean" on public.proyectos
    for insert to authenticated
    with check (organizacion_id = (select app.org_actual()) and (select app.rol_actual()) in ('admin', 'pm'));
create policy "proyectos: gestores editan" on public.proyectos
    for update to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and id in (select app.proyectos_gestionados())
    )
    with check (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and id in (select app.proyectos_gestionados())
    );

create policy "proyecto_miembros: visibles" on public.proyecto_miembros
    for select to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and proyecto_id in (select app.proyectos_visibles())
    );
create policy "proyecto_miembros: gestores agregan" on public.proyecto_miembros
    for insert to authenticated
    with check (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and proyecto_id in (select app.proyectos_gestionados())
    );
create policy "proyecto_miembros: gestores quitan" on public.proyecto_miembros
    for delete to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and proyecto_id in (select app.proyectos_gestionados())
    );

-- =====================================================================
-- Tareas
-- =====================================================================

create policy "tareas: visibles" on public.tareas
    for select to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and proyecto_id in (select app.proyectos_visibles())
    );
create policy "tareas: gestores crean" on public.tareas
    for insert to authenticated
    with check (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and proyecto_id in (select app.proyectos_gestionados())
    );
-- Qué columnas puede cambiar quien no es gestor lo decide app.proteger_tarea.
create policy "tareas: gestores o asignado editan" on public.tareas
    for update to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and (proyecto_id in (select app.proyectos_gestionados()) or asignado_id = (select auth.uid()))
    )
    with check (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and (proyecto_id in (select app.proyectos_gestionados()) or asignado_id = (select auth.uid()))
    );

create policy "tarea_dependencias: visibles" on public.tarea_dependencias
    for select to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and tarea_id in (select app.tareas_visibles())
    );
create policy "tarea_dependencias: gestores agregan" on public.tarea_dependencias
    for insert to authenticated
    with check (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and tarea_id in (select app.tareas_gestionadas())
    );
create policy "tarea_dependencias: gestores quitan" on public.tarea_dependencias
    for delete to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and tarea_id in (select app.tareas_gestionadas())
    );

create policy "tarea_historial_estados: visibles" on public.tarea_historial_estados
    for select to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and proyecto_id in (select app.proyectos_visibles())
    );

-- =====================================================================
-- Comentarios. Borrar comentarios ajenos es una RPC de la fase 4.
-- =====================================================================

create policy "comentarios: visibles" on public.comentarios
    for select to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and tarea_id in (select app.tareas_visibles())
    );
create policy "comentarios: comenta a nombre propio" on public.comentarios
    for insert to authenticated
    with check (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and tarea_id in (select app.tareas_visibles())
        and autor_id = (select auth.uid())
    );
create policy "comentarios: edita el autor" on public.comentarios
    for update to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and autor_id = (select auth.uid())
    )
    with check (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and autor_id = (select auth.uid())
    );

-- =====================================================================
-- Horas. proyecto_id ya viene copiado de la tarea por app.registro_completar.
-- =====================================================================

create policy "registros_tiempo: visibles" on public.registros_tiempo
    for select to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and proyecto_id in (select app.proyectos_visibles())
    );
create policy "registros_tiempo: carga a nombre propio" on public.registros_tiempo
    for insert to authenticated
    with check (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and proyecto_id in (select app.proyectos_visibles())
        and usuario_id = (select auth.uid())
    );
create policy "registros_tiempo: edita el propio o admin" on public.registros_tiempo
    for update to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and (usuario_id = (select auth.uid()) or (select app.rol_actual()) = 'admin')
    )
    with check (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and proyecto_id in (select app.proyectos_visibles())
        and (usuario_id = (select auth.uid()) or (select app.rol_actual()) = 'admin')
    );
create policy "registros_tiempo: borra el propio o admin" on public.registros_tiempo
    for delete to authenticated
    using (
        organizacion_id = (select app.org_actual()) and (select app.rol_actual()) is not null
        and (usuario_id = (select auth.uid()) or (select app.rol_actual()) = 'admin')
    );
