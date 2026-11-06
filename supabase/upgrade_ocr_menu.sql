-- 吃早餐｜雙管理者：共享截圖審核、可編輯菜單、訂單金額
-- 在已完成 V1 schema.sql 的 Supabase 專案中執行；可重複執行。
-- 不會刪除既有訂單／管理者。
alter table public.breakfast_orders
  add column if not exists total_override numeric(12,2);
alter table public.breakfast_orders
  add column if not exists total_amount numeric(12,2)
  generated always as (coalesce(total_override, price * quantity)) stored;
alter table public.breakfast_orders
  drop constraint if exists breakfast_orders_total_override_check;
alter table public.breakfast_orders
  add constraint breakfast_orders_total_override_check
  check(total_override is null or total_override >= 0);

create table if not exists public.breakfast_menu (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check(length(trim(name)) between 1 and 150),
  category text not null default '其他',
  price numeric(12,2),
  active boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  check(price is null or price >= 0)
);

create table if not exists public.breakfast_proposals (
  id uuid primary key default gen_random_uuid(),
  change_type text not null default 'add'
    check(change_type in ('add','edit','cancel')),
  target_order_id uuid references public.breakfast_orders(id),
  target_version integer,
  customer text not null,
  pickup_date date not null,
  item text not null,
  quantity integer not null check(quantity between 1 and 999),
  price numeric(12,2) check(price is null or price >= 0),
  total_override numeric(12,2) check(total_override is null or total_override >= 0),
  notes text not null default '',
  ocr_text text not null default '',
  source_hash text,
  screenshot_path text,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  submitted_by uuid references auth.users(id),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  review_note text not null default '',
  constraint breakfast_proposals_change_target_check
    check(change_type = 'add' or target_order_id is not null)
);
create unique index if not exists breakfast_proposal_source_hash_uniq
  on public.breakfast_proposals(source_hash) where source_hash is not null;
create index if not exists breakfast_proposal_status_idx
  on public.breakfast_proposals(status,submitted_at desc);

alter table public.breakfast_menu enable row level security;
alter table public.breakfast_proposals enable row level security;
revoke all on public.breakfast_menu from anon,authenticated;
revoke all on public.breakfast_proposals from anon,authenticated;
grant select,insert,update on public.breakfast_menu to authenticated;
grant select,insert on public.breakfast_proposals to authenticated;
drop policy if exists breakfast_menu_select on public.breakfast_menu;
create policy breakfast_menu_select on public.breakfast_menu
 for select to authenticated using ((select private.breakfast_is_manager()));
drop policy if exists breakfast_menu_insert on public.breakfast_menu;
create policy breakfast_menu_insert on public.breakfast_menu
 for insert to authenticated with check ((select private.breakfast_is_manager()));
drop policy if exists breakfast_menu_update on public.breakfast_menu;
create policy breakfast_menu_update on public.breakfast_menu
 for update to authenticated using ((select private.breakfast_is_manager()))
 with check ((select private.breakfast_is_manager()));
drop policy if exists breakfast_proposals_select on public.breakfast_proposals;
create policy breakfast_proposals_select on public.breakfast_proposals
 for select to authenticated using ((select private.breakfast_is_manager()));
drop policy if exists breakfast_proposals_insert on public.breakfast_proposals;
create policy breakfast_proposals_insert on public.breakfast_proposals
 for insert to authenticated
 with check ((select private.breakfast_is_manager()) and submitted_by = (select auth.uid())
   and status='pending' and reviewed_at is null and reviewed_by is null);

create or replace function private.breakfast_menu_stamp()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists breakfast_menu_stamp on public.breakfast_menu;
create trigger breakfast_menu_stamp before insert or update on public.breakfast_menu
 for each row execute function private.breakfast_menu_stamp();

-- To avoid bypassing audit and state machine, proposal changes are processed
-- only via RPC, not via client UPDATE.
create or replace function public.breakfast_review_proposal(
  proposal_id uuid, decision text, note text default ''
)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.breakfast_proposals%rowtype;
declare target public.breakfast_orders%rowtype;
declare existing_id uuid;
declare chosen_id uuid;
begin
  if not private.breakfast_is_manager() then
    raise exception 'not authorized';
  end if;
  if decision not in ('approve','reject') then
    raise exception 'invalid decision';
  end if;
  select * into p from public.breakfast_proposals where id=proposal_id for update;
  if not found then raise exception 'proposal not found'; end if;
  if p.status <> 'pending' then raise exception 'proposal already reviewed'; end if;

  if decision = 'approve' then
    if p.change_type='add' then
      -- Identify likely duplicate rather than silently combining orders.
      select o.id into existing_id
      from public.breakfast_orders o
      where o.status='active'
        and o.customer=p.customer and o.pickup_date=p.pickup_date
        and o.item=p.item and o.quantity=p.quantity and o.notes=p.notes
      limit 1;
      if existing_id is not null then raise exception 'possible duplicate order; review first'; end if;
      insert into public.breakfast_orders
        (customer,pickup_date,item,quantity,price,total_override,notes,source)
      values
        (p.customer,p.pickup_date,p.item,p.quantity,p.price,p.total_override,p.notes,'LINE 截圖／共同審核')
      returning id into chosen_id;
    else
      select * into target from public.breakfast_orders where id=p.target_order_id for update;
      if not found then raise exception 'original order missing'; end if;
      if p.target_version is distinct from target.version then
        raise exception 'original order changed; refresh and resubmit';
      end if;
      if p.change_type='cancel' then
        update public.breakfast_orders set status='cancelled'
        where id=target.id returning id into chosen_id;
      else
        update public.breakfast_orders
          set customer=p.customer,pickup_date=p.pickup_date,item=p.item,
            quantity=p.quantity,price=p.price,total_override=p.total_override,
            notes=p.notes
        where id=target.id returning id into chosen_id;
      end if;
    end if;
  end if;
  update public.breakfast_proposals
    set status=case when decision='approve' then 'approved' else 'rejected' end,
      reviewed_by=auth.uid(),reviewed_at=now(),review_note=coalesce(note,'')
  where id=proposal_id;
  return chosen_id;
end $$;
revoke all on function public.breakfast_review_proposal(uuid,text,text) from public,anon;
grant execute on function public.breakfast_review_proposal(uuid,text,text) to authenticated;

-- Store original LINE images in a PRIVATE bucket; policies require signed-in manager.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('breakfast-line-shots','breakfast-line-shots',false,10485760,
 array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=10485760,
 allowed_mime_types=array['image/jpeg','image/png','image/webp'];

drop policy if exists breakfast_line_upload on storage.objects;
create policy breakfast_line_upload on storage.objects
 for insert to authenticated with check (
 bucket_id='breakfast-line-shots' and (select private.breakfast_is_manager())
);
drop policy if exists breakfast_line_view on storage.objects;
create policy breakfast_line_view on storage.objects
 for select to authenticated using (
 bucket_id='breakfast-line-shots' and (select private.breakfast_is_manager())
);

-- Starter price list for confirmed general/member bagel prices.
-- Edit as needed in the app; existing user-edited prices are never overwritten.
insert into public.breakfast_menu(name,category,price) values
 ('松露鹽之花','貝果',60),
 ('鐵觀音桂圓','貝果',60),
 ('蜂蜜燕麥','貝果',50),
 ('巧克力藍莓乳酪','貝果',60),
 ('起司三重奏','貝果',65),
 ('原味明太子','貝果',65),
 ('抹茶卡士達','貝果',70),
 ('巧克力阿華田','貝果',70),
 ('草莓麻吉乳酪','貝果',80),
 ('檸檬雞沙拉','沙拉',100),
 ('菲力雞沙拉','沙拉',100),
 ('紐奧良沙拉','沙拉',100),
 ('紅茶','飲料',20)
on conflict(name) do nothing;

-- Realtime publication for review queue and menu changes.
do $$
begin
 if not exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public' and tablename='breakfast_proposals') then
   alter publication supabase_realtime add table public.breakfast_proposals;
 end if;
 if not exists(select 1 from pg_publication_tables
   where pubname='supabase_realtime' and schemaname='public' and tablename='breakfast_menu') then
   alter publication supabase_realtime add table public.breakfast_menu;
 end if;
end $$;
