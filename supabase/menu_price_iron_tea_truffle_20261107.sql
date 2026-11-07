-- 2026-11-07 吃早餐貝果：一般售價 65、群友價 60
-- 須先執行 supabase/menu_price_20261107.sql 以建立 regular_price、description 欄位。
-- 僅更新菜單主檔，不回溯已成立訂單。
insert into public.breakfast_menu(name,category,price,regular_price,description,active)
values
('鐵觀音桂圓','貝果',60,65,'台灣茶韻 × 東山桂圓香。嚴選有機冠軍鐵觀音揉入軟Q麵團，內餡包入東山龍眼乾，焙火茶韻與自然蜜甜交織。',true),
('松露鹽之花','貝果',60,65,'黑胡椒粒揉入原味貝果麵團，出爐後刷上頂級黑松露，再撒上法國鹽之花，濃郁松露香氣搭配細緻鹹味。',true)
on conflict(name) do update set
 category=excluded.category,
 price=excluded.price,
 regular_price=excluded.regular_price,
 description=excluded.description,
 active=excluded.active;
