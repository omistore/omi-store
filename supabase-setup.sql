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

-- After creating the admin user in Authentication -> Users, copy its UUID
-- and run in the SQL Editor:
-- insert into public.store_admins (user_id)
-- values ('PASTE_AUTH_USER_UUID_HERE');

alter table public.orders enable row level security;
alter table public.store_admins enable row level security;

grant usage on schema public to anon, authenticated;
grant insert on public.orders to anon, authenticated;
grant select, update on public.orders to authenticated;
grant select on public.store_admins to authenticated;

drop policy if exists "Public can submit orders" on public.orders;
create policy "Public can submit orders"
  on public.orders for insert to anon, authenticated
  with check (status = 'I ri');

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
