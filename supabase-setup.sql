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

-- After creating the admin user in Authentication -> Users, copy its UUID
-- and run in the SQL Editor:
-- insert into public.store_admins (user_id)
-- values ('PASTE_AUTH_USER_UUID_HERE');

alter table public.orders enable row level security;
alter table public.store_admins enable row level security;
alter table public.store_products enable row level security;

grant usage on schema public to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant select, update on public.orders to authenticated;
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

drop policy if exists "Admins can check their own access" on public.store_admins;
create policy "Admins can check their own access"
  on public.store_admins for select to authenticated
  using (user_id = (select auth.uid()));
