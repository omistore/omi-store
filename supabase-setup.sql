create table if not exists public.orders (
  order_number text primary key,
  created_at timestamptz not null default now(),
  status text not null default 'I ri'
    check (status in ('I ri', 'Konfirmuar', 'Në transport', 'Dorëzuar', 'Anuluar')),
  customer jsonb not null,
  items jsonb not null,
  payment text not null
    check (payment in ('Pagesë në dorëzim', 'Pagesë me kartë')),
  total numeric(10, 2) not null check (total >= 0 and total <= 100000),
  constraint orders_customer_object check (jsonb_typeof(customer) = 'object'),
  constraint orders_items_array check (
    jsonb_typeof(items) = 'array'
    and jsonb_array_length(items) between 1 and 50
  ),
  constraint orders_customer_required check (
    length(trim(coalesce(customer ->> 'name', ''))) between 2 and 120
    and length(trim(coalesce(customer ->> 'phone', ''))) between 5 and 40
    and length(trim(coalesce(customer ->> 'city', ''))) between 2 and 120
    and length(trim(coalesce(customer ->> 'address', ''))) between 3 and 240
  )
);

create table if not exists public.store_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create table if not exists public.store_products (
  name text primary key,
  price numeric(10, 2) not null check (price >= 0),
  active boolean not null default true
);

insert into public.store_products (name, price) values
  ('Sprej Izolues i Zi', 10),
  ('Sprej Izolues i Bardhë', 13),
  ('Riparues Çarjesh', 10),
  ('Çakmak me Orë', 15),
  ('Portë Sigurie', 40),
  ('Go Kart për Fëmijë', 120),
  ('Raft për Banjo', 15),
  ('Drita Solare për Kopsht', 12),
  ('Perde PVC për Verandë', 15)
on conflict (name) do update
set price = excluded.price, active = true;

-- Extend the existing product table before policies reference its new columns.
alter table public.store_products
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists old_price numeric(10, 2) check (old_price is null or old_price >= 0),
  add column if not exists description text not null default '',
  add column if not exists specifications jsonb not null default '[]'::jsonb,
  add column if not exists category text not null default 'Të tjera',
  add column if not exists stock integer not null default 0 check (stock >= 0),
  add column if not exists image_url text,
  add column if not exists created_at timestamptz not null default now();

update public.store_products
set description = 'Produkt i disponueshëm në OMI STORE.'
where description = '';

update public.store_products set stock = 20 where stock = 0;
update public.store_products set image_url = 'sprejizi.jpg.jpg' where name = 'Sprej Izolues i Zi' and image_url is null;
update public.store_products set image_url = 'sprejibardh.jpg.jpg' where name = 'Sprej Izolues i Bardhë' and image_url is null;
update public.store_products set image_url = 'riparues.jpg.png' where name = 'Riparues Çarjesh' and image_url is null;
update public.store_products set image_url = 'cakmak.jpg.jpg' where name = 'Çakmak me Orë' and image_url is null;
update public.store_products set image_url = 'port.jpg.jpg' where name = 'Portë Sigurie' and image_url is null;
update public.store_products set image_url = 'gokart.jpg.jpg' where name = 'Go Kart për Fëmijë' and image_url is null;
update public.store_products set image_url = 'raft.jpg.jpg' where name = 'Raft për Banjo' and image_url is null;
update public.store_products set image_url = 'solare.jpg.jpeg' where name = 'Drita Solare për Kopsht' and image_url is null;
update public.store_products set image_url = 'perde.jpg.jpg' where name = 'Perde PVC për Verandë' and image_url is null;

-- After creating the admin user in Authentication -> Users, copy its UUID
-- and run in the SQL Editor:
-- insert into public.store_admins (user_id)
-- values ('PASTE_AUTH_USER_UUID_HERE');

alter table public.orders enable row level security;
alter table public.store_admins enable row level security;
alter table public.store_products enable row level security;

grant usage on schema public to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant select, update, delete on public.orders to authenticated;
grant select on public.store_admins to authenticated;
grant select on public.store_products to anon, authenticated;

drop policy if exists "Public can view active products" on public.store_products;
create policy "Public can view active products"
  on public.store_products for select to anon, authenticated
  using (active);

drop policy if exists "Public can submit orders" on public.orders;
create policy "Public can submit orders"
  on public.orders for insert to anon, authenticated
  with check (
    status = 'I ri'
    and total = (
      select coalesce(sum((item ->> 'price')::numeric * (item ->> 'quantity')::integer), 0)
      from jsonb_array_elements(items) as item
    )
    and not exists (
      select 1
      from jsonb_array_elements(items) as item
      where coalesce(item ->> 'quantity', '') !~ '^[1-9][0-9]{0,2}$'
        or not exists (
          select 1
          from public.store_products as product
          where product.name = item ->> 'name'
            and product.price = (item ->> 'price')::numeric
            and product.active
            and product.stock >= (item ->> 'quantity')::integer
        )
    )
  );

drop policy if exists "Store admins can read orders" on public.orders;
create policy "Store admins can read orders"
  on public.orders for select to authenticated
  using (
    exists (
      select 1
      from public.store_admins
      where store_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "Store admins can update orders" on public.orders;
create policy "Store admins can update orders"
  on public.orders for update to authenticated
  using (
    exists (
      select 1
      from public.store_admins
      where store_admins.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.store_admins
      where store_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "Store admins can delete orders" on public.orders;
create policy "Store admins can delete orders"
  on public.orders for delete to authenticated
  using (
    exists (
      select 1
      from public.store_admins
      where store_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "Admins can check their own access" on public.store_admins;
create policy "Admins can check their own access"
  on public.store_admins for select to authenticated
  using (user_id = (select auth.uid()));

create unique index if not exists store_products_id_unique on public.store_products(id);

grant insert, update, delete on public.store_products to authenticated;

drop policy if exists "Public can view active products" on public.store_products;
create policy "Public can view active products"
  on public.store_products for select to anon, authenticated
  using (active);

drop policy if exists "Store admins can manage products" on public.store_products;
create policy "Store admins can manage products"
  on public.store_products for all to authenticated
  using (
    exists (
      select 1 from public.store_admins
      where store_admins.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.store_admins
      where store_admins.user_id = (select auth.uid())
    )
  );

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true, name = excluded.name;

drop policy if exists "Public can view product images" on storage.objects;
create policy "Public can view product images"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Store admins can upload product images" on storage.objects;
create policy "Store admins can upload product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.store_admins
      where store_admins.user_id = (select auth.uid())
    )
  );

drop policy if exists "Store admins can replace product images" on storage.objects;
create policy "Store admins can replace product images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.store_admins
      where store_admins.user_id = (select auth.uid())
    )
  )
  with check (bucket_id = 'product-images');

drop policy if exists "Store admins can delete product images" on storage.objects;
create policy "Store admins can delete product images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.store_admins
      where store_admins.user_id = (select auth.uid())
    )
  );

-- Homepage hero photo and message, editable from the admin panel.
create table if not exists public.store_site_settings (
  id integer primary key default 1 check (id = 1),
  hero_image_url text,
  hero_message text check (hero_message is null or length(hero_message) <= 240),
  updated_at timestamptz not null default now()
);

insert into public.store_site_settings (id) values (1)
on conflict (id) do nothing;

alter table public.store_site_settings
  add column if not exists hero_badge text check (hero_badge is null or length(hero_badge) <= 60),
  add column if not exists banner_label text check (banner_label is null or length(banner_label) <= 40),
  add column if not exists banner_active boolean not null default false,
  add column if not exists banner_title text check (banner_title is null or length(banner_title) <= 120),
  add column if not exists banner_message text check (banner_message is null or length(banner_message) <= 300),
  add column if not exists banner_button_text text check (banner_button_text is null or length(banner_button_text) <= 40),
  add column if not exists banner_button_link text check (banner_button_link is null or length(banner_button_link) <= 200);

alter table public.store_site_settings enable row level security;

grant select on public.store_site_settings to anon, authenticated;
grant update on public.store_site_settings to authenticated;

drop policy if exists "Public can view site settings" on public.store_site_settings;
create policy "Public can view site settings"
  on public.store_site_settings for select to anon, authenticated
  using (true);

drop policy if exists "Store admins can update site settings" on public.store_site_settings;
create policy "Store admins can update site settings"
  on public.store_site_settings for update to authenticated
  using (
    exists (
      select 1 from public.store_admins
      where store_admins.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.store_admins
      where store_admins.user_id = (select auth.uid())
    )
  );
