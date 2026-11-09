-- ZERO Y NANY - SHOP: roles admin/editor y permisos del equipo
-- Ejecutar UNA SOLA VEZ en Supabase > SQL Editor.
-- Conserva los perfiles y los roles admin que ya existen.

-- Asegurar que el campo de diseño exista, incluso si se instaló antes.
alter table public.store_settings add column if not exists design jsonb not null default '{}'::jsonb;

-- 1) Permitir los nuevos roles sin borrar perfiles actuales.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'editor', 'customer'));

-- 2) Función para comprobar si una cuenta puede editar el catálogo y el diseño.
create or replace function public.is_zero_shop_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role in ('admin', 'editor')
  );
$$;

revoke all on function public.is_zero_shop_staff() from public;
grant execute on function public.is_zero_shop_staff() to anon, authenticated;

-- 3) Guardar el diseño con un RPC: editores pueden cambiar el diseño,
--    pero no pueden cambiar WhatsApp, pagos ni otros ajustes generales.
create or replace function public.save_zero_shop_design(p_design jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = (select auth.uid())
      and role in ('admin', 'editor')
  ) then
    raise exception 'No tienes permisos para modificar el diseño de la tienda.';
  end if;

  if p_design is null or jsonb_typeof(p_design) <> 'object' then
    raise exception 'El diseño enviado no es válido.';
  end if;

  update public.store_settings
  set design = p_design,
      updated_at = now()
  where id = 1;

  if not found then
    raise exception 'No existe la configuración principal de la tienda.';
  end if;
end;
$$;

revoke all on function public.save_zero_shop_design(jsonb) from public;
grant execute on function public.save_zero_shop_design(jsonb) to authenticated;

-- 4) Catálogo: administradores y editores pueden gestionar productos.
drop policy if exists "active products are public" on public.products;
create policy "active products are public"
on public.products for select to anon, authenticated
using (active = true or public.is_zero_shop_staff());

drop policy if exists "admins insert products" on public.products;
drop policy if exists "staff insert products" on public.products;
create policy "staff insert products"
on public.products for insert to authenticated
with check (public.is_zero_shop_staff());

drop policy if exists "admins update products" on public.products;
drop policy if exists "staff update products" on public.products;
create policy "staff update products"
on public.products for update to authenticated
using (public.is_zero_shop_staff())
with check (public.is_zero_shop_staff());

drop policy if exists "admins delete products" on public.products;
drop policy if exists "staff delete products" on public.products;
create policy "staff delete products"
on public.products for delete to authenticated
using (public.is_zero_shop_staff());

-- 5) Imágenes: administradores y editores pueden subir y administrar imágenes.
drop policy if exists "admins upload zero shop product images" on storage.objects;
drop policy if exists "staff upload zero shop product images" on storage.objects;
create policy "staff upload zero shop product images"
on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and public.is_zero_shop_staff());

drop policy if exists "admins update zero shop product images" on storage.objects;
drop policy if exists "staff update zero shop product images" on storage.objects;
create policy "staff update zero shop product images"
on storage.objects for update to authenticated
using (bucket_id = 'product-images' and public.is_zero_shop_staff())
with check (bucket_id = 'product-images' and public.is_zero_shop_staff());

drop policy if exists "admins delete zero shop product images" on storage.objects;
drop policy if exists "staff delete zero shop product images" on storage.objects;
create policy "staff delete zero shop product images"
on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and public.is_zero_shop_staff());

-- 6) Los pedidos, la configuración general y la gestión de usuarios
--    siguen siendo exclusivos del administrador.

select user_id, role
from public.profiles
where role in ('admin', 'editor')
order by created_at;
