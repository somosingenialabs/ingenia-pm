-- =====================================================================
-- Ingenia PM · Migración 4: aceptar invitaciones y bucket de avatares
--
-- Aceptar una invitación lo hace quien todavía no es miembro: no hay RLS que
-- lo cubra. Lo resuelven dos funciones que solo puede llamar la clave secreta,
-- y la validación contra el hash del token vive acá, en una sola transacción.
-- =====================================================================

-- Datos para la pantalla /invitacion/[token]. Sin el token_hash en la salida.
-- usuario_existe sale de auth.users y no de perfiles: perfiles.email lo edita su dueño.
create or replace function public.invitacion_por_token(p_token_hash text)
returns table (
    id                  uuid,
    organizacion_nombre text,
    email               text,
    rol                 text,
    vence_en            timestamptz,
    aceptada_en         timestamptz,
    revocada_en         timestamptz,
    usuario_existe      boolean
)
language sql
stable
security definer
set search_path = ''
as $$
    select i.id, o.nombre, i.email, i.rol, i.vence_en, i.aceptada_en, i.revocada_en,
           exists (select 1 from auth.users u where lower(u.email) = i.email)
    from public.invitaciones i
    join public.organizaciones o on o.id = i.organizacion_id
    where i.token_hash = p_token_hash
$$;

-- Suma la membresía, deja esa empresa como activa y marca la invitación como usada, todo
-- junto. El for update hace que dos pedidos simultáneos con el mismo token no pasen los dos.
-- Quien ya era miembro activo conserva su rol: una invitación no le baja el rol a nadie.
create or replace function public.aceptar_invitacion(p_token_hash text, p_usuario uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_inv   public.invitaciones;
    v_email text;
begin
    select * into v_inv from public.invitaciones i where i.token_hash = p_token_hash for update;
    if not found then
        raise exception 'La invitación no es válida.';
    end if;
    if v_inv.revocada_en is not null then
        raise exception 'La invitación fue revocada.';
    end if;
    if v_inv.aceptada_en is not null then
        raise exception 'La invitación ya se usó.';
    end if;
    if v_inv.vence_en <= now() then
        raise exception 'La invitación venció.';
    end if;

    select lower(u.email) into v_email from auth.users u where u.id = p_usuario;
    if v_email is distinct from v_inv.email then
        raise exception 'La invitación es para otro mail.';
    end if;

    insert into public.miembros (organizacion_id, usuario_id, rol)
    values (v_inv.organizacion_id, p_usuario, v_inv.rol)
    on conflict (organizacion_id, usuario_id) do update
        set activo = true,
            rol = case when public.miembros.activo then public.miembros.rol else excluded.rol end;

    update public.perfiles set organizacion_activa_id = v_inv.organizacion_id where id = p_usuario;
    update public.invitaciones set aceptada_en = now() where id = v_inv.id;

    return v_inv.organizacion_id;
end;
$$;

revoke execute on function public.invitacion_por_token(text), public.aceptar_invitacion(text, uuid)
    from public, anon, authenticated;
grant execute on function public.invitacion_por_token(text), public.aceptar_invitacion(text, uuid)
    to service_role;

-- ---------------------------------------------------------------------
-- Avatares. El límite y los tipos los hace cumplir Storage al subir.
-- Sin SVG: un SVG puede traer scripts y el bucket se sirve público.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;

-- La lectura pública pasa por la URL del bucket y no necesita política. Esta deja a cada uno
-- listar lo suyo (la pide reemplazar un archivo) sin que nadie enumere los ids de los demás.
create policy "avatares: cada uno ve su carpeta" on storage.objects
    for select to authenticated
    using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatares: cada uno sube a su carpeta" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatares: cada uno reemplaza lo suyo" on storage.objects
    for update to authenticated
    using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text)
    with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatares: cada uno borra lo suyo" on storage.objects
    for delete to authenticated
    using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
