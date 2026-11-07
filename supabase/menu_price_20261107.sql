-- 吃早餐｜兩款新品售價及群友價（可重複執行）
-- price = 群友價，regular_price = 一般售價。
alter table public.breakfast_menu add column if not exists regular_price numeric(12,2);
alter table public.breakfast_menu add column if not exists description text not null default '';
alter table public.breakfast_menu drop constraint if exists breakfast_menu_regular_price_check;
alter table public.breakfast_menu add constraint breakfast_menu_regular_price_check check(regular_price is null or regular_price >= 0);
insert into public.breakfast_menu(name,category,price,regular_price,description,active)
values
 ('抹茶卡士達','貝果',70,75,'日式抹茶貝果搭配靜岡抹茶卡士達，濃郁茶香與滑順口感一次滿足！',true),
 ('巧克力阿華田','貝果',70,75,'巧克力貝果配上香濃阿華田卡士達，熟悉的巧克力風味更加濃郁，巧克力控怎麼能錯過！',true)
on conflict(name) do update set
 category=excluded.category,
 price=excluded.price,
 regular_price=excluded.regular_price,
 description=excluded.description,
 active=excluded.active;
-- 不更新早餐訂單主檔：歷史訂單價格保留。
