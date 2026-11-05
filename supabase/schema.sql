-- 吃早餐雙管理者雲端資料庫 V1
-- Run in your OWN Supabase project's SQL Editor. Do not place any service_role key in GitHub Pages.
create schema if not exists private;
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '管理者',
  created_at timestamptz not null default now()
);
create table if not exists public.breakfast_orders (
  id uuid primary key default gen_random_uuid(),
  customer text not null check(length(trim(customer)) between 1 and 100),
  pickup_date date not null,
  item text not null check(length(trim(item)) between 1 and 200),
  quantity integer not null check(quantity between 1 and 999),
  price numeric(10,2) check(price is null or price >= 0),
  notes text not null default '',
  status text not null default 'active' check(status in ('active','cancelled')),
  source text not null default '手動',
  version integer not null default 1,
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists breakfast_orders_pickup_idx on public.breakfast_orders(pickup_date,status);
create table if not exists public.breakfast_order_audit (
  audit_id bigint generated always as identity primary key,
  order_id uuid not null,
  event text not null check(event in ('INSERT','UPDATE')),
  actor uuid references auth.users(id),
  before_row jsonb,
  after_row jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists breakfast_audit_order_idx on public.breakfast_order_audit(order_id,occurred_at desc);

-- Only admin user IDs inserted by the database owner are members.
create or replace function private.breakfast_is_manager()
returns boolean language sql stable security definer set search_path = ''
as $$ select exists(select 1 from public.admin_users a where a.user_id = (select auth.uid())); $$;
revoke all on function private.breakfast_is_manager() from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.breakfast_is_manager() to authenticated;

alter table public.admin_users enable row level security;
alter table public.breakfast_orders enable row level security;
alter table public.breakfast_order_audit enable row level security;
revoke all on public.admin_users from anon, authenticated;
revoke all on public.breakfast_orders from anon, authenticated;
revoke all on public.breakfast_order_audit from anon, authenticated;
grant select on public.admin_users to authenticated;
grant select,insert,update on public.breakfast_orders to authenticated;
grant select on public.breakfast_order_audit to authenticated;

drop policy if exists "manager can view own membership" on public.admin_users;
create policy "manager can view own membership" on public.admin_users for select to authenticated
using(user_id=(select auth.uid()));
drop policy if exists "two managers read orders" on public.breakfast_orders;
create policy "two managers read orders" on public.breakfast_orders for select to authenticated
using((select private.breakfast_is_manager()));
drop policy if exists "two managers insert orders" on public.breakfast_orders;
create policy "two managers insert orders" on public.breakfast_orders for insert to authenticated
with check((select private.breakfast_is_manager()));
drop policy if exists "two managers update orders" on public.breakfast_orders;
create policy "two managers update orders" on public.breakfast_orders for update to authenticated
using((select private.breakfast_is_manager())) with check((select private.breakfast_is_manager()));
drop policy if exists "two managers read audit" on public.breakfast_order_audit;
create policy "two managers read audit" on public.breakfast_order_audit for select to authenticated
using((select private.breakfast_is_manager()));

-- Set audit actor / timestamps on server; no client is trusted to write audit information.
create or replace function private.breakfast_order_before()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if tg_op='INSERT' then
   new.version:=1;
   new.created_at:=now();
   new.updated_at:=now();
   new.created_by:=auth.uid();
   new.updated_by:=auth.uid();
 else
   new.id:=old.id;
   new.created_at:=old.created_at;
   new.created_by:=old.created_by;
   new.version:=old.version+1;
   new.updated_at:=now();
   new.updated_by:=auth.uid();
 end if;
 return new;
end $$;
create or replace function private.breakfast_order_after()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
 insert into public.breakfast_order_audit(order_id,event,actor,before_row,after_row)
 values(new.id,tg_op,auth.uid(),case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return null;
end $$;
drop trigger if exists breakfast_before on public.breakfast_orders;
create trigger breakfast_before before insert or update on public.breakfast_orders for each row execute function private.breakfast_order_before();
drop trigger if exists breakfast_after on public.breakfast_orders;
create trigger breakfast_after after insert or update on public.breakfast_orders for each row execute function private.breakfast_order_after();

-- Realtime publication: if not already published.
do $$
begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='breakfast_orders') then
   alter publication supabase_realtime add table public.breakfast_orders;
 end if;
end $$;

-- After you invite BOTH users under Supabase Authentication > Users and they accept,
-- run the following statements with your two actual UUIDs (not their passwords):
-- insert into public.admin_users(user_id,display_name) values
-- ('REPLACE-WITH-USER-A-UUID','管理者 A'),
-- ('REPLACE-WITH-USER-B-UUID','管理者 B')
-- on conflict(user_id) do update set display_name=excluded.display_name;
