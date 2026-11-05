-- =====================================================================
-- Ingenia PM · Migración 6: temporizador de horas
--
-- Las tres funciones son security invoker: corren con el RLS de
-- registros_tiempo de quien llama, así que no abren ningún permiso nuevo.
-- La hora siempre es la del servidor (now()), nunca la del navegador.
-- =====================================================================

-- Detiene el temporizador que esté corriendo y prende otro en p_tarea, en una transacción.
-- La fecha es hoy en la zona de la empresa: current_date está en UTC y a la noche en
-- Argentina ya sería mañana.
-- Si el que corría pasó de 24 h no se cierra solo: nadie trabajó eso, y los minutos los tiene
-- que decir la persona con detener_temporizador.
create or replace function public.iniciar_temporizador(p_tarea uuid)
returns public.registros_tiempo
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_org     uuid := app.org_actual();
    v_usuario uuid := (select auth.uid());
    v_zona    text;
    v_previo  public.registros_tiempo;
    v_nuevo   public.registros_tiempo;
begin
    if v_org is null or v_usuario is null or app.rol_actual() is null then
        raise exception 'No tenés una empresa activa.';
    end if;
    -- Dos pedidos a la vez de la misma persona: el segundo espera al primero.
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_org::text || v_usuario::text, 0));

    -- El RLS de tareas decide si la ve. Una tarea borrada, o de un proyecto borrado, no cuenta.
    if not exists (
        select 1 from public.tareas t
        join public.proyectos p on p.id = t.proyecto_id
        where t.id = p_tarea and t.organizacion_id = v_org
          and t.eliminado_en is null and p.eliminado_en is null
    ) then
        raise exception 'La tarea no existe.';
    end if;

    select * into v_previo from public.registros_tiempo r
    where r.organizacion_id = v_org and r.usuario_id = v_usuario
      and r.origen = 'temporizador' and r.fin is null
    for update;
    if found then
        if now() - v_previo.inicio > interval '24 hours' then
            raise exception 'Tenés un temporizador prendido hace más de 24 h. Detenelo y corregí los minutos.';
        end if;
        update public.registros_tiempo
        set fin = now(),
            minutos = greatest(1, round(extract(epoch from now() - v_previo.inicio) / 60))::int
        where id = v_previo.id;
    end if;

    select o.zona_horaria into v_zona from public.organizaciones o where o.id = v_org;

    insert into public.registros_tiempo (organizacion_id, tarea_id, usuario_id, origen, inicio, fecha)
    values (v_org, p_tarea, v_usuario, 'temporizador', now(), (now() at time zone v_zona)::date)
    returning * into v_nuevo;
    return v_nuevo;
end;
$$;

-- Cierra el temporizador corriendo: fin = now() y minutos = la duración redondeada, mínimo 1.
-- Si pasó de 24 h exige p_minutos. p_minutos también sirve para corregir a la baja (la pantalla
-- lo ofrece desde las 10 h), pero nunca por encima de lo que pasó: eso sería inventar horas.
-- p_nota nula deja la nota como estaba.
create or replace function public.detener_temporizador(p_minutos int default null, p_nota text default null)
returns public.registros_tiempo
language plpgsql
security invoker
set search_path = ''
as $$
declare
    v_org      uuid := app.org_actual();
    v_usuario  uuid := (select auth.uid());
    v_registro public.registros_tiempo;
    v_corridos numeric;
    v_minutos  int;
begin
    select * into v_registro from public.registros_tiempo r
    where r.organizacion_id = v_org and r.usuario_id = v_usuario
      and r.origen = 'temporizador' and r.fin is null
    for update;
    if not found then
        raise exception 'No hay un temporizador corriendo.';
    end if;

    v_corridos := extract(epoch from now() - v_registro.inicio) / 60;
    if p_minutos is null then
        if v_corridos > 1440 then
            raise exception 'El temporizador lleva más de 24 h: decí cuántos minutos trabajaste.';
        end if;
        v_minutos := greatest(1, round(v_corridos))::int;
    else
        if p_minutos < 1 or p_minutos > least(1440, greatest(1, ceil(v_corridos))) then
            raise exception 'Los minutos tienen que ser entre 1 y lo que estuvo prendido.';
        end if;
        v_minutos := p_minutos;
    end if;

    update public.registros_tiempo
    set fin = now(),
        minutos = v_minutos,
        nota = coalesce(nullif(btrim(p_nota), ''), nota)
    where id = v_registro.id
    returning * into v_registro;
    return v_registro;
end;
$$;

-- Borra el temporizador corriendo, sin guardar nada. Sin temporizador, no hace nada.
create or replace function public.descartar_temporizador()
returns void
language sql
security invoker
set search_path = ''
as $$
    delete from public.registros_tiempo r
    where r.organizacion_id = app.org_actual() and r.usuario_id = (select auth.uid())
      and r.origen = 'temporizador' and r.fin is null
$$;

revoke execute on function
    public.iniciar_temporizador(uuid), public.detener_temporizador(int, text), public.descartar_temporizador()
    from public, anon;
grant execute on function
    public.iniciar_temporizador(uuid), public.detener_temporizador(int, text), public.descartar_temporizador()
    to authenticated;
