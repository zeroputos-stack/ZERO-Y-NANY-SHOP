
-- ZERO-SHOP CLOUD — esquema inicial para Supabase
-- Ejecuta TODO este archivo en Supabase > SQL Editor.
-- No pegues nunca una service_role key en el navegador.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('admin','editor','customer')),
  created_at timestamptz not null default now()
);

create or replace function public.is_zero_shop_admin()
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
      and p.role = 'admin'
  );
$$;

grant execute on function public.is_zero_shop_admin() to anon, authenticated;

create or replace function public.is_zero_shop_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = (select auth.uid())
      and p.role in ('admin','editor')
  );
$$;

grant execute on function public.is_zero_shop_staff() to anon, authenticated;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  duration text not null default '—',
  modality text not null default '',
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  stock integer null check (stock is null or stock >= 0),
  active boolean not null default true,
  image_path text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_catalog_unique unique (category, name, duration, modality)
);

create index if not exists products_active_category_idx
  on public.products (active, category);

create table if not exists public.store_settings (
  id integer primary key default 1 check (id = 1),
  store_name text not null default 'ZERO Y NANY - SHOP',
  whatsapp_number text not null default '526623459707',
  payment_instructions text not null default 'Confirma el método de pago por WhatsApp antes de realizar tu pago.',
  announcement text not null default 'Tu tienda digital, siempre disponible.',
  design jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.store_settings add column if not exists design jsonb not null default '{}'::jsonb;

insert into public.store_settings (id, store_name, whatsapp_number, payment_instructions, announcement, design)
values (1, 'ZERO Y NANY - SHOP', '526623459707',
        'Confirma el método de pago por WhatsApp antes de realizar tu pago.',
        'Tu tienda digital, siempre disponible.', '{}')
on conflict (id) do nothing;

create or replace function public.save_zero_shop_design(p_design jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.profiles
    where user_id = (select auth.uid()) and role in ('admin','editor')
  ) then
    raise exception 'No tienes permisos para modificar el diseño de la tienda.';
  end if;
  if p_design is null or jsonb_typeof(p_design) <> 'object' then
    raise exception 'El diseño enviado no es válido.';
  end if;
  update public.store_settings
  set design = p_design, updated_at = now()
  where id = 1;
  if not found then
    raise exception 'No existe la configuración principal de la tienda.';
  end if;
end;
$$;

revoke all on function public.save_zero_shop_design(jsonb) from public;
grant execute on function public.save_zero_shop_design(jsonb) to authenticated;


create sequence if not exists public.zero_shop_order_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  whatsapp text not null,
  notes text not null default '',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  status text not null default 'new'
    check (status in ('new','confirmed','preparing','completed','cancelled')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending','paid','refunded')),
  stock_restored boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders add column if not exists stock_restored boolean not null default false;

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status, payment_status);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid null references public.products(id) on delete set null,
  product_name text not null,
  product_variant text not null default '',
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

create or replace function public.zero_shop_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.zero_shop_set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.zero_shop_set_updated_at();

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at
before update on public.store_settings
for each row execute function public.zero_shop_set_updated_at();

-- Pedido público seguro: el precio y el stock se validan dentro de PostgreSQL.
create or replace function public.create_zero_shop_order(
  p_customer_name text,
  p_whatsapp text,
  p_notes text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order_id uuid;
  v_order_number text;
  v_total numeric(12,2) := 0;
  v_line record;
  v_product public.products%rowtype;
  v_qty integer;
  v_line_total numeric(12,2);
  v_product_id uuid;
begin
  if length(trim(coalesce(p_customer_name,''))) < 2
     or length(trim(coalesce(p_customer_name,''))) > 100 then
    raise exception 'Escribe un nombre válido.';
  end if;

  if length(regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g')) < 8
     or length(regexp_replace(coalesce(p_whatsapp,''), '\D', '', 'g')) > 18 then
    raise exception 'Escribe un WhatsApp válido.';
  end if;

  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1
     or jsonb_array_length(p_items) > 30 then
    raise exception 'El carrito no es válido.';
  end if;

  v_order_number := 'ZS-' || to_char(now(), 'YYMMDD') || '-' ||
                    lpad(nextval('public.zero_shop_order_seq')::text, 5, '0');

  insert into public.orders (
    order_number, customer_name, whatsapp, notes, subtotal, total, status, payment_status
  ) values (
    v_order_number, trim(p_customer_name),
    regexp_replace(p_whatsapp, '\D', '', 'g'),
    left(coalesce(p_notes,''), 500), 0, 0, 'new', 'pending'
  ) returning id into v_order_id;

  for v_line in
    select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_line.value->>'product_id')::uuid;
      v_qty := (v_line.value->>'quantity')::integer;
    exception when others then
      raise exception 'Un producto del carrito tiene datos inválidos.';
    end;

    if v_qty < 1 or v_qty > 20 then
      raise exception 'La cantidad de un producto no es válida.';
    end if;

    select * into v_product
    from public.products
    where id = v_product_id and active = true
    for update;

    if not found then
      raise exception 'Uno de los productos ya no está disponible.';
    end if;

    if v_product.stock is not null and v_product.stock < v_qty then
      raise exception 'No hay existencias suficientes de %.', v_product.name;
    end if;

    if v_product.stock is not null then
      update public.products
      set stock = stock - v_qty
      where id = v_product.id;
    end if;

    v_line_total := round(v_product.price * v_qty, 2);
    v_total := v_total + v_line_total;

    insert into public.order_items (
      order_id, product_id, product_name, product_variant,
      unit_price, quantity, line_total
    ) values (
      v_order_id, v_product.id, v_product.name,
      concat_ws(' · ', nullif(v_product.duration,'—'), nullif(v_product.modality,'')),
      v_product.price, v_qty, v_line_total
    );
  end loop;

  update public.orders
  set subtotal = v_total, total = v_total
  where id = v_order_id;

  return jsonb_build_object(
    'id', v_order_id,
    'order_number', v_order_number,
    'total', v_total
  );
end;
$$;

revoke all on function public.create_zero_shop_order(text,text,text,jsonb) from public;
grant execute on function public.create_zero_shop_order(text,text,text,jsonb) to anon, authenticated;


-- Actualizar pedido desde el panel. Al cancelar, devuelve una sola vez las unidades
-- descontadas al momento de crear el pedido.
create or replace function public.update_zero_shop_order(
  p_order_id uuid,
  p_status text default null,
  p_payment_status text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_item record;
begin
  if not public.is_zero_shop_admin() then
    raise exception 'No tienes permisos para modificar pedidos.';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'No se encontró el pedido.';
  end if;

  if p_status is not null and p_status not in ('new','confirmed','preparing','completed','cancelled') then
    raise exception 'Estado de pedido no válido.';
  end if;

  if p_payment_status is not null and p_payment_status not in ('pending','paid','refunded') then
    raise exception 'Estado de pago no válido.';
  end if;

  if v_order.status = 'cancelled' and p_status is not null and p_status <> 'cancelled' then
    raise exception 'Un pedido cancelado no se puede reabrir. Registra un pedido nuevo.';
  end if;

  if p_status = 'cancelled' and v_order.status <> 'cancelled' and not v_order.stock_restored then
    for v_item in
      select product_id, quantity
      from public.order_items
      where order_id = p_order_id
    loop
      if v_item.product_id is not null then
        update public.products
        set stock = stock + v_item.quantity
        where id = v_item.product_id and stock is not null;
      end if;
    end loop;
    v_order.stock_restored := true;
  end if;

  update public.orders
  set status = coalesce(p_status, status),
      payment_status = coalesce(p_payment_status, payment_status),
      stock_restored = v_order.stock_restored
  where id = p_order_id;
end;
$$;

revoke all on function public.update_zero_shop_order(uuid,text,text) from public;
grant execute on function public.update_zero_shop_order(uuid,text,text) to authenticated;


-- Activar RLS en todas las tablas expuestas.
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

-- Privilegios explícitos.
grant usage on schema public to anon, authenticated;
grant select on public.products, public.store_settings to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.profiles to authenticated;
grant update on public.store_settings to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

-- Policies de perfiles.
drop policy if exists "profile self or admin read" on public.profiles;
create policy "profile self or admin read"
on public.profiles for select to authenticated
using (user_id = (select auth.uid()) or public.is_zero_shop_admin());

-- Products: catálogo activo público; administradores y editores gestionan el catálogo.
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

-- Public settings, only admin can change them.
drop policy if exists "store settings are public" on public.store_settings;
create policy "store settings are public"
on public.store_settings for select to anon, authenticated
using (true);

drop policy if exists "admins update store settings" on public.store_settings;
create policy "admins update store settings"
on public.store_settings for update to authenticated
using (public.is_zero_shop_admin())
with check (public.is_zero_shop_admin());

-- Orders and order items are private to administrators.
drop policy if exists "admins read orders" on public.orders;
create policy "admins read orders"
on public.orders for select to authenticated
using (public.is_zero_shop_admin());

drop policy if exists "admins update orders" on public.orders;
create policy "admins update orders"
on public.orders for update to authenticated
using (public.is_zero_shop_admin())
with check (public.is_zero_shop_admin());

drop policy if exists "admins read order items" on public.order_items;
create policy "admins read order items"
on public.order_items for select to authenticated
using (public.is_zero_shop_admin());

-- Bucket público para mostrar imágenes; solo administradores pueden modificarlas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true, 5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public can view zero shop product images" on storage.objects;
create policy "public can view zero shop product images"
on storage.objects for select to anon, authenticated
using (bucket_id = 'product-images');

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

-- Habilitar sincronización en tiempo real para catálogo y pedidos.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- Catálogo inicial importado de la versión anterior (53 opciones).
insert into public.products
(category, name, duration, modality, price, stock, active)
values
('ViX', 'ViX', '1 mes', 'Completa', 7.0, NULL, TRUE),
('ViX', 'ViX', '1 mes', 'Perfil', 2.0, NULL, TRUE),
('ViX', 'ViX', '2 meses', 'Completa', 12.0, NULL, TRUE),
('ViX', 'ViX', '2 meses', 'Perfil', 4.0, NULL, TRUE),
('ViX', 'ViX', '3 meses', 'Completa', 15.0, NULL, TRUE),
('ViX', 'ViX', '3 meses', 'Perfil', 5.0, NULL, TRUE),
('ViX', 'ViX', '1 año', 'Completa', 30.0, NULL, TRUE),
('ViX', 'ViX', '1 año', 'Perfil', 7.0, NULL, TRUE),
('Netflix', 'Netflix', '—', 'Completa a sus datos', 198.0, NULL, TRUE),
('Netflix', 'Netflix', '1 mes', 'Perfil', 41.0, NULL, TRUE),
('Netflix', 'Netflix', '2 meses', 'Perfil', 78.0, NULL, TRUE),
('Netflix', 'Netflix', '3 meses', 'Perfil', 110.0, NULL, TRUE),
('Disney+', 'Disney+', '1 mes', 'Completa · Con panel', 65.0, NULL, TRUE),
('Disney+', 'Disney+', '1 mes', 'Perfil', 10.0, NULL, TRUE),
('Disney+', 'Disney+', '2 meses', 'Completa · Con panel', 100.0, NULL, TRUE),
('Disney+', 'Disney+', '2 meses', 'Perfil', 20.0, NULL, TRUE),
('Disney+', 'Disney+', '3 meses', 'Completa · Con panel', 165.0, NULL, TRUE),
('Disney+', 'Disney+', '3 meses', 'Perfil', 30.0, NULL, TRUE),
('Prime Video', 'Prime Video', '1 mes', 'Completa', 25.0, NULL, TRUE),
('Prime Video', 'Prime Video', '1 mes', 'Perfil', 10.0, NULL, TRUE),
('Prime Video', 'Prime Video', '2 meses', 'Completa', 45.0, NULL, TRUE),
('Prime Video', 'Prime Video', '2 meses', 'Perfil', 20.0, NULL, TRUE),
('Prime Video', 'Prime Video', '3 meses', 'Completa', 65.0, NULL, TRUE),
('Prime Video', 'Prime Video', '3 meses', 'Perfil', 30.0, NULL, TRUE),
('Prime Video', 'Prime Video', '1 año', 'Completa', 150.0, NULL, TRUE),
('Prime Video', 'Prime Video', '1 año', 'Perfil', 95.0, NULL, TRUE),
('HBO Max', 'HBO Max', '1 mes', 'Completa', 38.0, NULL, TRUE),
('HBO Max', 'HBO Max', '1 mes', 'Perfil', 10.0, NULL, TRUE),
('HBO Max', 'HBO Max', '2 meses', 'Completa', 60.0, NULL, TRUE),
('HBO Max', 'HBO Max', '2 meses', 'Perfil', 20.0, NULL, TRUE),
('HBO Max', 'HBO Max', '1 año', 'Completa', 250.0, NULL, TRUE),
('HBO Max', 'HBO Max', '1 año', 'Perfil', 100.0, NULL, TRUE),
('Spotify', 'Spotify Familiar', '—', 'Suscripción', 100.0, NULL, TRUE),
('Spotify', 'Spotify Invitación', '1 mes', 'Suscripción', 25.0, NULL, TRUE),
('Spotify', 'Spotify Individual', '1 mes', 'Suscripción', 30.0, NULL, TRUE),
('Spotify', 'Spotify Individual', '2 meses', 'Suscripción', 50.0, NULL, TRUE),
('Spotify', 'Spotify Individual', '3 meses', 'Suscripción', 65.0, NULL, TRUE),
('Spotify', 'Spotify Individual', '6 meses', 'Suscripción', 110.0, NULL, TRUE),
('Spotify', 'Spotify Individual', '1 año', 'Suscripción', 210.0, NULL, TRUE),
('Canva', 'Canva por invitación', '1 mes', 'Invitación', 5.0, NULL, TRUE),
('Canva', 'Canva por invitación', '3 meses', 'Invitación', 9.0, NULL, TRUE),
('Canva', 'Canva por invitación', '6 meses', 'Invitación', 10.0, NULL, TRUE),
('Canva', 'Canva por invitación', '1 año', 'Invitación', 15.0, NULL, TRUE),
('Canva', 'Canva por invitación', '2 años', 'Invitación', 30.0, NULL, TRUE),
('Canva', 'Canva por invitación', '3 años', 'Invitación', 40.0, NULL, TRUE),
('Fox One', 'Fox One', '—', 'Perfil · Con panel', 15.0, NULL, TRUE),
('Fox One', 'Fox One', '—', 'Completa · Con panel', 40.0, NULL, TRUE),
('Paramount+', 'Paramount+', '1 mes', 'Perfil', 7.0, NULL, TRUE),
('Paramount+', 'Paramount+', '—', 'Completa', 30.0, NULL, TRUE),
('Vicky', 'Vicky', '—', 'Completa', 30.0, NULL, TRUE),
('Vicky', 'Vicky', '—', 'Perfil', 12.0, NULL, TRUE),
('Claro Video + Universal', 'Claro Video + Universal', '—', 'Completa', 48.0, NULL, TRUE),
('Claro Video + Universal', 'Claro Video + Universal', '—', 'Perfil', 14.0, NULL, TRUE)
on conflict (category, name, duration, modality) do nothing;

-- IMPORTANTE: crea primero al usuario en Authentication > Users.
-- Después sustituye el correo y ejecuta este SQL para hacerlo administrador:
-- insert into public.profiles (user_id, role)
-- select id, 'admin' from auth.users where email = 'TU_CORREO_DE_ADMIN';


-- EQUIPO: los administradores y editores se crean desde el panel mediante
-- la Edge Function supabase/functions/manage-team. No expongas la service role key.
-- Los usuarios invitados reciben un correo para aceptar la invitación y crear su contraseña.
