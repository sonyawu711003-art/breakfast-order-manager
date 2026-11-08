-- 吃早餐｜2026-11-08 Google 商家菜單：12 類、62 項
-- 來源：使用者上傳 Excel，price=群友價，regular_price=一般售價
-- 不更改 breakfast_orders 歷史訂單；未知價格保留 NULL。
-- 焙茶桂圓已由鐵觀音桂圓取代，因此設為停用。
begin;
alter table public.breakfast_menu add column if not exists regular_price numeric(12,2);
alter table public.breakfast_menu add column if not exists description text not null default '';
-- 維持舊有記錄的 ID，讓既有菜單簡稱合併至正式品名。
update public.breakfast_menu set name='原味炙燒北海道明太子貝果' where name='原味明太子' and not exists(select 1 from public.breakfast_menu where name='原味炙燒北海道明太子貝果');
update public.breakfast_menu set name='巧克力藍莓乳酪貝果' where name='巧克力藍莓乳酪' and not exists(select 1 from public.breakfast_menu where name='巧克力藍莓乳酪貝果');
update public.breakfast_menu set name='牛奶芝麻奶霜貝果' where name='牛奶芝麻奶霜' and not exists(select 1 from public.breakfast_menu where name='牛奶芝麻奶霜貝果');
update public.breakfast_menu set name='大甲香芋貝果' where name='大甲芋頭' and not exists(select 1 from public.breakfast_menu where name='大甲香芋貝果');
update public.breakfast_menu set name='南瓜焦糖乳酪貝果' where name='南瓜焦糖' and not exists(select 1 from public.breakfast_menu where name='南瓜焦糖乳酪貝果');
update public.breakfast_menu set name='起司培根貝果' where name='起司培根' and not exists(select 1 from public.breakfast_menu where name='起司培根貝果');
update public.breakfast_menu set name='鐵觀音桂圓貝果' where name='鐵觀音桂圓' and not exists(select 1 from public.breakfast_menu where name='鐵觀音桂圓貝果');
update public.breakfast_menu set name='松露鹽之花貝果' where name='松露鹽之花' and not exists(select 1 from public.breakfast_menu where name='松露鹽之花貝果');
update public.breakfast_menu set name='抹茶卡士達貝果' where name='抹茶卡士達' and not exists(select 1 from public.breakfast_menu where name='抹茶卡士達貝果');
update public.breakfast_menu set name='巧克力阿華田貝果' where name='巧克力阿華田' and not exists(select 1 from public.breakfast_menu where name='巧克力阿華田貝果');
update public.breakfast_menu set name='蜂蜜燕麥貝果' where name='蜂蜜燕麥' and not exists(select 1 from public.breakfast_menu where name='蜂蜜燕麥貝果');
update public.breakfast_menu set name='玫瑰蔓越莓紅寶石' where name='蔓越莓玫瑰紅寶石' and not exists(select 1 from public.breakfast_menu where name='玫瑰蔓越莓紅寶石');
update public.breakfast_menu set name='咖啡核桃貝果' where name='咖啡核桃' and not exists(select 1 from public.breakfast_menu where name='咖啡核桃貝果');
update public.breakfast_menu set name='抹茶開心果貝果' where name='抹茶開心果' and not exists(select 1 from public.breakfast_menu where name='抹茶開心果貝果');
update public.breakfast_menu set name='古早味紅茶' where name='紅茶' and not exists(select 1 from public.breakfast_menu where name='古早味紅茶');
insert into public.breakfast_menu(name,category,price,regular_price,description,active)
values
('日式馬鈴薯蛋沙拉三明治','三明治',50,50,'',true),
('起司厚蛋煙燻豬三明治','三明治',60,60,'',true),
('優格鮪魚三明治','三明治',55,55,'',true),
('花草檸檬雞三明治','三明治',55,55,'',true),
('匈牙利辣味雞排三明治','三明治',55,55,'',true),
('日式叉燒肉溏心蛋三明治','三明治',65,65,'',true),
('碳烤雞腿排三明治','三明治',70,70,'',true),
('地瓜泥燻雞三明治','三明治',70,70,'',true),
('花生豬排蛋三明治','三明治',60,60,'',true),
('義式香草舒肥雞蛋白三明治','三明治',70,70,'',true),
('紐奧良舒肥雞蛋白三明治','三明治',70,70,'',true),
('火山炙燒北海道明太子貝果','貝果',85,85,'',true),
('原味炙燒北海道明太子貝果','貝果',65,70,'',true),
('草莓麻吉乳酪貝果','貝果',85,85,'',true),
('脆皮巧克力OREO貝果','貝果',80,80,'',true),
('絲絨藍莓乳酪貝果','貝果',75,75,'',true),
('巧克力藍莓乳酪貝果','貝果',60,65,'',true),
('牛奶芝麻奶霜貝果','貝果',60,65,'',true),
('大甲香芋貝果','貝果',60,65,'',true),
('白玉紅豆抹茶貝果','貝果',70,75,'',true),
('流沙乳酪碳金貝果','貝果',60,65,'',true),
('蜂蜜燕麥貝果','貝果',50,50,'群友 3 入 $135',true),
('焙茶桂圓貝果','貝果',55,55,'群友 3 入 $150；舊口味，已由鐵觀音桂圓取代',false),
('南瓜焦糖乳酪貝果','貝果',60,65,'',true),
('起司培根貝果','貝果',65,70,'',true),
('美式煙燻雞貝果','貝果',65,70,'',true),
('地瓜泥貝果','貝果',70,70,'',true),
('玫瑰蔓越莓紅寶石','貝果',70,75,'加購乳酪 +$5',true),
('鐵觀音桂圓貝果','貝果',60,65,'有機冠軍鐵觀音、東山龍眼乾',true),
('松露鹽之花貝果','貝果',60,65,'黑胡椒、黑松露、法國鹽之花',true),
('抹茶卡士達貝果','貝果',70,75,'靜岡抹茶卡士達',true),
('巧克力阿華田貝果','貝果',70,75,'阿華田卡士達',true),
('咖啡核桃貝果','貝果',NULL,NULL,'售價及群友價待確認',true),
('抹茶開心果貝果','貝果',NULL,NULL,'售價及群友價待確認',true),
('韓式奶油蒜香菲力雞吐司','韓式吐司',95,95,'',true),
('韓式肉肉三重奏吐司','韓式吐司',85,85,'',true),
('招牌韓式松露菇菇豬排吐司','韓式吐司',85,85,'',true),
('韓式花草檸檬雞吐司','韓式吐司',90,90,'',true),
('韓式厚切椒鹽雞排吐司','韓式吐司',95,95,'',true),
('手工布里歐小漢堡-日式鹽麴雪花豬燒肉','小漢堡',75,75,'',true),
('手工布里歐小漢堡-煙燻手拋牛肉排','小漢堡',80,80,'',true),
('龍蝦沙拉輕食堡','輕食堡',88,88,'',true),
('燻雞藜麥毛豆輕食堡','輕食堡',70,70,'',true),
('德式捲捲腸皇后布里歐堡','歐式',95,95,'',true),
('蜜香花生鹹豬帕瑪森堡','歐式',95,95,'',true),
('田園蔬果沙拉','輕食',90,90,'',true),
('檸檬雞排','沙拉加購',40,40,'',true),
('匈牙利辣味雞排','沙拉加購',40,40,'',true),
('碳烤雞腿排','沙拉加購',55,55,'',true),
('奶香蒜味菲力雞排','沙拉加購',45,45,'',true),
('義式香草舒肥雞/紐奧良舒肥雞','沙拉加購',50,50,'',true),
('鮮蝦一尾（時價）','沙拉加購',NULL,NULL,'時價',true),
('芋頭雪酪','甜點',75,75,'',true),
('芋見花開巴斯克','甜點',158,158,'',true),
('客製化甜點請私訊洽談','甜點',NULL,NULL,'私訊洽談',true),
('可貴甜燒餅(可可肉桂)','禮盒',520,520,'',true),
('原味甜燒餅(法國派餡)','禮盒',400,400,'',true),
('超酥牽絲焦糖餅乾（2入）','小禮盒',188,188,'',true),
('古早味紅茶','飲品',20,20,'',true),
('鮮奶茶','飲品',30,30,'',true),
('美式咖啡','飲品',35,35,'',true),
('咖啡鮮奶','飲品',55,55,'',true)
on conflict(name) do update set
  category=excluded.category,
  price=excluded.price,
  regular_price=excluded.regular_price,
  description=excluded.description,
  active=excluded.active;
commit;
-- 執行完成後，可在 breakfast_menu 中檢查各品項的售價與群友價。
