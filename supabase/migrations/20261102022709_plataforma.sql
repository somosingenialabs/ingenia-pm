-- =====================================================================
-- Ingenia PM · Migración 1: plataforma multi-empresa
-- Empresas, perfiles, miembros, invitaciones, helpers de permisos y el hook
-- que pone la empresa activa en el token de sesión.
--
-- Regla de oro: el RLS (seguridad por fila) filtra todo por la empresa ACTIVA
-- del token (app.org_actual()). El rol NO se toma del token: se consulta en
-- miembros, así un cambio de rol o una baja rigen en el próximo pedido.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

create schema if not exists app;
create schema if not exists analitica;
grant usage on schema app to authenticated;
grant usage on schema analitica to authenticated;

comment on schema app is 'Helpers internos de permisos y triggers. No se expone por la API.';
comment on schema analitica is 'Funciones de métricas (fase 5). security invoker: el RLS sigue filtrando.';

-- ---------------------------------------------------------------------
-- actualizado_en automático
-- ---------------------------------------------------------------------
create or replace function app.marcar_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
    new.actualizado_en := now();
    return new;
end;
$$;

-- ---------------------------------------------------------------------
-- Empresas clientes del producto
-- ---------------------------------------------------------------------
create table public.organizaciones (
    id              uuid primary key default gen_random_uuid(),
    nombre          text not null check (char_length(trim(nombre)) between 2 and 120),
    zona_horaria    text not null default 'America/Argentina/Buenos_Aires',
    logo_url        text,
    color_acento    text check (color_acento ~ '^#[0-9a-fA-F]{6}$'),
    creado_en       timestamptz not null default now(),
    creado_por      uuid references auth.users (id) on delete set null,
    actualizado_en  timestamptz not null default now()
);

comment on table public.organizaciones is 'Cada empresa cliente. Todo dato de negocio cuelga de una por organizacion_id.';

create trigger organizaciones_actualizado before update on public.organizaciones
    for each row execute function app.marcar_actualizado();

-- ---------------------------------------------------------------------
-- Perfiles: 1 a 1 con auth.users
-- ---------------------------------------------------------------------
create table public.perfiles (
    id                      uuid primary key references auth.users (id) on delete cascade,
    nombre_completo         text not null,
    email                   text,
    telefono                text,
    avatar_url              text,
    organizacion_activa_id  uuid references public.organizaciones (id) on delete set null,
    creado_en               timestamptz not null default now(),
    actualizado_en          timestamptz not null default now()
);

create trigger perfiles_actualizado before update on public.perfiles
    for each row execute function app.marcar_actualizado();

-- ---------------------------------------------------------------------
-- Miembros: quién está en qué empresa y con qué rol
-- ---------------------------------------------------------------------
create table public.miembros (
    id               uuid primary key default gen_random_uuid(),
    organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
    usuario_id       uuid not null references public.perfiles (id) on delete cascade,
    rol              text not null default 'colaborador'
                     check (rol in ('admin', 'pm', 'colaborador')),
    activo           boolean not null default true,
    -- Capacidad semanal: la usan la carga (fase 4) y las métricas (fase 5).
    horas_semanales  numeric(4,1) not null default 40 check (horas_semanales between 0 and 80),
    creado_en        timestamptz not null default now(),
    actualizado_en   timestamptz not null default now(),
    unique (organizacion_id, usuario_id)
);

create index miembros_usuario_idx on public.miembros (usuario_id) where activo;

create trigger miembros_actualizado before update on public.miembros
    for each row execute function app.marcar_actualizado();

-- Una empresa nunca se queda sin Admin activo. Traba la fila de la empresa para que
-- dos cambios simultáneos no se saquen el último Admin entre los dos.
create or replace function app.miembros_proteger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    if tg_op = 'UPDATE' and (new.organizacion_id <> old.organizacion_id or new.usuario_id <> old.usuario_id) then
        raise exception 'No se puede cambiar la empresa ni la persona de un miembro.';
    end if;

    if old.rol = 'admin' and old.activo
       and (tg_op = 'DELETE' or new.rol <> 'admin' or not new.activo) then
        perform 1 from public.organizaciones o where o.id = old.organizacion_id for update;
        -- La empresa ya no existe: es el borrado en cascada de la empresa entera.
        if found and not exists (
            select 1 from public.miembros m
            where m.organizacion_id = old.organizacion_id
              and m.id <> old.id
              and m.rol = 'admin'
              and m.activo
        ) then
            raise exception 'La empresa no puede quedarse sin un Admin activo.';
        end if;
    end if;

    if tg_op = 'DELETE' then
        return old;
    end if;
    return new;
end;
$$;

create trigger miembros_proteger before update or delete on public.miembros
    for each row execute function app.miembros_proteger();

-- ---------------------------------------------------------------------
-- Invitaciones por mail. Se guarda el hash del token, nunca el token.
-- ---------------------------------------------------------------------
create table public.invitaciones (
    id               uuid primary key default gen_random_uuid(),
    organizacion_id  uuid not null references public.organizaciones (id) on delete cascade,
    email            text not null check (email = lower(trim(email)) and email like '%_@_%'),
    rol              text not null default 'colaborador'
                     check (rol in ('admin', 'pm', 'colaborador')),
    token_hash       text not null unique,
    invitado_por     uuid references public.perfiles (id) on delete set null,
    vence_en         timestamptz not null default now() + interval '7 days',
    aceptada_en      timestamptz,
    revocada_en      timestamptz,
    creado_en        timestamptz not null default now()
);

-- Una sola invitación pendiente por mail y empresa.
create unique index invitaciones_pendiente_unica on public.invitaciones (organizacion_id, email)
    where aceptada_en is null and revocada_en is null;

-- ---------------------------------------------------------------------
-- Helpers de permisos
-- ---------------------------------------------------------------------

-- Empresa activa según el token (la pone el hook). Nula si no hay ninguna.
create or replace function app.org_actual()
returns uuid
language sql
stable
set search_path = ''
as $$
    select nullif((select auth.jwt()) ->> 'org_id', '')::uuid
$$;

-- Rol de quien llama en la empresa activa; nulo si no es miembro activo.
-- security definer: lee miembros sin depender del RLS de miembros.
create or replace function app.rol_actual()
returns text
language sql
stable
security definer
set search_path = ''
as $$
    select m.rol
    from public.miembros m
    where m.organizacion_id = app.org_actual()
      and m.usuario_id = (select auth.uid())
      and m.activo
$$;

-- ¿Quien llama es miembro activo de esa empresa?
create or replace function app.es_miembro(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.miembros m
        where m.organizacion_id = p_org
          and m.usuario_id = (select auth.uid())
          and m.activo
    )
$$;

-- ¿Quien llama tiene alguno de esos roles en esa empresa?
create or replace function app.tiene_rol(p_org uuid, p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.miembros m
        where m.organizacion_id = p_org
          and m.usuario_id = (select auth.uid())
          and m.activo
          and m.rol = any (p_roles)
    )
$$;

-- ¿Ese usuario es miembro activo de esa empresa?
create or replace function app.usuario_es_miembro(p_usuario uuid, p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1 from public.miembros m
        where m.organizacion_id = p_org and m.usuario_id = p_usuario and m.activo
    )
$$;

-- ¿Quien llama comparte alguna empresa con ese usuario? (para ver perfiles ajenos)
create or replace function app.comparte_organizacion(p_usuario uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.miembros yo
        join public.miembros otro on otro.organizacion_id = yo.organizacion_id
        where yo.usuario_id = (select auth.uid()) and yo.activo
          and otro.usuario_id = p_usuario
    )
$$;

revoke execute on all functions in schema app from public, anon;
grant execute on function
    app.org_actual(), app.rol_actual(), app.es_miembro(uuid), app.tiene_rol(uuid, text[]),
    app.usuario_es_miembro(uuid, uuid), app.comparte_organizacion(uuid)
    to authenticated;

-- ---------------------------------------------------------------------
-- Perfil automático al crear el usuario
-- ---------------------------------------------------------------------
create or replace function app.crear_perfil()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.perfiles (id, email, nombre_completo)
    values (
        new.id,
        new.email,
        coalesce(nullif(trim(new.raw_user_meta_data ->> 'nombre_completo'), ''), split_part(new.email, '@', 1))
    )
    on conflict (id) do nothing;
    return new;
end;
$$;

revoke execute on function app.crear_perfil() from public, anon, authenticated;

create trigger al_crear_usuario after insert on auth.users
    for each row execute function app.crear_perfil();

-- ---------------------------------------------------------------------
-- Hook de Auth: agrega org_id al token si la persona es miembro activo de
-- su empresa activa. Lo ejecuta supabase_auth_admin al emitir cada token.
-- ---------------------------------------------------------------------
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
    v_claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
    v_org    uuid;
begin
    select p.organizacion_activa_id into v_org
    from public.perfiles p
    where p.id = (event ->> 'user_id')::uuid
      and exists (
          select 1 from public.miembros m
          where m.organizacion_id = p.organizacion_activa_id
            and m.usuario_id = p.id
            and m.activo
      );

    if v_org is not null then
        v_claims := jsonb_set(v_claims, '{org_id}', to_jsonb(v_org::text));
    else
        v_claims := v_claims - 'org_id';
    end if;

    return jsonb_set(event, '{claims}', v_claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from public, anon, authenticated;
