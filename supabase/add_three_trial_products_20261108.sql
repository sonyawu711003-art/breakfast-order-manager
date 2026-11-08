-- Three trial products from user photos dated 2026-11-04.
-- price holds trial price; regular_price is NULL (not yet published).
-- Historical order records are untouched.
alter table public.breakfast_menu add column if not exists regular_price numeric(12,2);
alter table public.breakfast_menu add column if not exists description text not null default '';
insert into public.breakfast_menu(name,category,price,regular_price,description,active)
values
 ('布里歐帕瑪森（手寫副名待確認）','歐式',75,null,'照片手寫：布里歐帕瑪森；第二行副名待確認。新品試吃價 75，正式售價未公布。',true),
 ('明太子燻雞雞蛋三明治','三明治',65,null,'照片新品試吃價 65；正式售價未公布。',true),
 ('法式燻菇培根起司三明治','三明治',65,null,'照片新品試吃價 65；正式售價未公布。',true)
on conflict(name) do update set
 category=excluded.category,
 price=excluded.price,
 regular_price=excluded.regular_price,
 description=excluded.description,
 active=excluded.active;
