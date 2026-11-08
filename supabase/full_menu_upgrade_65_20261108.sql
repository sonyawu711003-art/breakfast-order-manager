-- 吃早餐｜完整菜單升級與匯入 (2026-11-08)
-- 65 種品項：62 種原 Google 商家菜單 + 3 種照片確認的新品。
-- price 是群友價（未提供時與一般售價相同）；regular_price 是一般售價。
-- 品項有時價／待確認，使用 NULL，絕不填 0。
-- 僅操作 breakfast_menu，歷史 breakfast_orders 不會異動。
-- 可以重複執行；若已在系統手動改價，重新執行本檔會再次依此份菜單覆蓋菜單主檔價格。
BEGIN;
ALTER TABLE public.breakfast_menu ADD COLUMN IF NOT EXISTS regular_price NUMERIC(12,2);
ALTER TABLE public.breakfast_menu ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';

-- 合併先前使用的簡稱，避免舊口味與正式名稱變成重複商品。
UPDATE public.breakfast_menu SET name='布里歐帕瑪森-奶油蒜香菲力雞'
 WHERE name='布里歐帕瑪森（手寫副名待確認）'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='布里歐帕瑪森-奶油蒜香菲力雞');
UPDATE public.breakfast_menu SET name='原味炙燒北海道明太子貝果'
 WHERE name='原味明太子'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='原味炙燒北海道明太子貝果');
UPDATE public.breakfast_menu SET name='原味炙燒北海道明太子貝果'
 WHERE name='原味炙燒明太子'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='原味炙燒北海道明太子貝果');
UPDATE public.breakfast_menu SET name='巧克力藍莓乳酪貝果'
 WHERE name='巧克力藍莓乳酪'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='巧克力藍莓乳酪貝果');
UPDATE public.breakfast_menu SET name='牛奶芝麻奶霜貝果'
 WHERE name='牛奶芝麻奶霜'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='牛奶芝麻奶霜貝果');
UPDATE public.breakfast_menu SET name='大甲香芋貝果'
 WHERE name='大甲芋頭'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='大甲香芋貝果');
UPDATE public.breakfast_menu SET name='南瓜焦糖乳酪貝果'
 WHERE name='南瓜焦糖'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='南瓜焦糖乳酪貝果');
UPDATE public.breakfast_menu SET name='起司培根貝果'
 WHERE name='起司培根'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='起司培根貝果');
UPDATE public.breakfast_menu SET name='鐵觀音桂圓貝果'
 WHERE name='鐵觀音桂圓'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='鐵觀音桂圓貝果');
UPDATE public.breakfast_menu SET name='松露鹽之花貝果'
 WHERE name='松露鹽之花'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='松露鹽之花貝果');
UPDATE public.breakfast_menu SET name='抹茶卡士達貝果'
 WHERE name='抹茶卡士達'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='抹茶卡士達貝果');
UPDATE public.breakfast_menu SET name='巧克力阿華田貝果'
 WHERE name='巧克力阿華田'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='巧克力阿華田貝果');
UPDATE public.breakfast_menu SET name='蜂蜜燕麥貝果'
 WHERE name='蜂蜜燕麥'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='蜂蜜燕麥貝果');
UPDATE public.breakfast_menu SET name='玫瑰蔓越莓紅寶石'
 WHERE name='蔓越莓玫瑰紅寶石'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='玫瑰蔓越莓紅寶石');
UPDATE public.breakfast_menu SET name='咖啡核桃貝果'
 WHERE name='咖啡核桃'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='咖啡核桃貝果');
UPDATE public.breakfast_menu SET name='抹茶開心果貝果'
 WHERE name='抹茶開心果'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='抹茶開心果貝果');
UPDATE public.breakfast_menu SET name='古早味紅茶'
 WHERE name='紅茶'
 AND NOT EXISTS (SELECT 1 FROM public.breakfast_menu WHERE name='古早味紅茶');

INSERT INTO public.breakfast_menu(name,category,price,regular_price,description,active)
VALUES
('日式馬鈴薯蛋沙拉三明治', '三明治', 50, 50, '', TRUE),
('起司厚蛋煙燻豬三明治', '三明治', 60, 60, '', TRUE),
('優格鮪魚三明治', '三明治', 55, 55, '', TRUE),
('花草檸檬雞三明治', '三明治', 55, 55, '', TRUE),
('匈牙利辣味雞排三明治', '三明治', 55, 55, '', TRUE),
('日式叉燒肉溏心蛋三明治', '三明治', 65, 65, '', TRUE),
('碳烤雞腿排三明治', '三明治', 70, 70, '', TRUE),
('地瓜泥燻雞三明治', '三明治', 70, 70, '', TRUE),
('花生豬排蛋三明治', '三明治', 60, 60, '', TRUE),
('義式香草舒肥雞蛋白三明治', '三明治', 70, 70, '', TRUE),
('紐奧良舒肥雞蛋白三明治', '三明治', 70, 70, '', TRUE),
('火山炙燒北海道明太子貝果', '貝果', 85, 85, '', TRUE),
('原味炙燒北海道明太子貝果', '貝果', 65, 70, '', TRUE),
('草莓麻吉乳酪貝果', '貝果', 85, 85, '', TRUE),
('脆皮巧克力OREO貝果', '貝果', 80, 80, '', TRUE),
('絲絨藍莓乳酪貝果', '貝果', 75, 75, '', TRUE),
('巧克力藍莓乳酪貝果', '貝果', 60, 65, '', TRUE),
('牛奶芝麻奶霜貝果', '貝果', 60, 65, '', TRUE),
('大甲香芋貝果', '貝果', 60, 65, '', TRUE),
('白玉紅豆抹茶貝果', '貝果', 70, 75, '', TRUE),
('流沙乳酪碳金貝果', '貝果', 60, 65, '', TRUE),
('蜂蜜燕麥貝果', '貝果', 50, 50, '群友 3 入 $135', TRUE),
('焙茶桂圓貝果', '貝果', 55, 55, '群友 3 入 $150；舊口味，已由鐵觀音桂圓取代', FALSE),
('南瓜焦糖乳酪貝果', '貝果', 60, 65, '', TRUE),
('起司培根貝果', '貝果', 65, 70, '', TRUE),
('美式煙燻雞貝果', '貝果', 65, 70, '', TRUE),
('地瓜泥貝果', '貝果', 70, 70, '', TRUE),
('玫瑰蔓越莓紅寶石', '貝果', 70, 75, '加購乳酪 +$5', TRUE),
('鐵觀音桂圓貝果', '貝果', 60, 65, '有機冠軍鐵觀音、東山龍眼乾', TRUE),
('松露鹽之花貝果', '貝果', 60, 65, '黑胡椒、黑松露、法國鹽之花', TRUE),
('抹茶卡士達貝果', '貝果', 70, 75, '靜岡抹茶卡士達', TRUE),
('巧克力阿華田貝果', '貝果', 70, 75, '阿華田卡士達', TRUE),
('咖啡核桃貝果', '貝果', NULL, NULL, '售價及群友價待確認', TRUE),
('抹茶開心果貝果', '貝果', NULL, NULL, '售價及群友價待確認', TRUE),
('韓式奶油蒜香菲力雞吐司', '韓式吐司', 95, 95, '', TRUE),
('韓式肉肉三重奏吐司', '韓式吐司', 85, 85, '', TRUE),
('招牌韓式松露菇菇豬排吐司', '韓式吐司', 85, 85, '', TRUE),
('韓式花草檸檬雞吐司', '韓式吐司', 90, 90, '', TRUE),
('韓式厚切椒鹽雞排吐司', '韓式吐司', 95, 95, '', TRUE),
('手工布里歐小漢堡-日式鹽麴雪花豬燒肉', '小漢堡', 75, 75, '', TRUE),
('手工布里歐小漢堡-煙燻手拋牛肉排', '小漢堡', 80, 80, '', TRUE),
('龍蝦沙拉輕食堡', '輕食堡', 88, 88, '', TRUE),
('燻雞藜麥毛豆輕食堡', '輕食堡', 70, 70, '', TRUE),
('德式捲捲腸皇后布里歐堡', '歐式', 95, 95, '', TRUE),
('蜜香花生鹹豬帕瑪森堡', '歐式', 95, 95, '', TRUE),
('田園蔬果沙拉', '輕食', 90, 90, '', TRUE),
('檸檬雞排', '沙拉加購', 40, 40, '', TRUE),
('匈牙利辣味雞排', '沙拉加購', 40, 40, '', TRUE),
('碳烤雞腿排', '沙拉加購', 55, 55, '', TRUE),
('奶香蒜味菲力雞排', '沙拉加購', 45, 45, '', TRUE),
('義式香草舒肥雞/紐奧良舒肥雞', '沙拉加購', 50, 50, '', TRUE),
('鮮蝦一尾（時價）', '沙拉加購', NULL, NULL, '時價', TRUE),
('芋頭雪酪', '甜點', 75, 75, '', TRUE),
('芋見花開巴斯克', '甜點', 158, 158, '', TRUE),
('客製化甜點請私訊洽談', '甜點', NULL, NULL, '私訊洽談', TRUE),
('可貴甜燒餅(可可肉桂)', '禮盒', 520, 520, '', TRUE),
('原味甜燒餅(法國派餡)', '禮盒', 400, 400, '', TRUE),
('超酥牽絲焦糖餅乾（2入）', '小禮盒', 188, 188, '', TRUE),
('古早味紅茶', '飲品', 20, 20, '', TRUE),
('鮮奶茶', '飲品', 30, 30, '', TRUE),
('美式咖啡', '飲品', 35, 35, '', TRUE),
('咖啡鮮奶', '飲品', 55, 55, '', TRUE),
('布里歐帕瑪森-奶油蒜香菲力雞', '歐式', 75, NULL, '奶油蒜香菲力雞布里歐帕瑪森；2026/11/04 新品試吃價 $75，正式一般售價尚未公布。', TRUE),
('明太子燻雞雞蛋三明治', '三明治', 65, NULL, '2026/11/04 照片新品試吃價 $65；一般正式售價未公布。', TRUE),
('法式燻菇培根起司三明治', '三明治', 65, NULL, '2026/11/04 照片新品試吃價 $65；一般正式售價未公布。', TRUE)
ON CONFLICT(name) DO UPDATE SET
 category=EXCLUDED.category,
 price=EXCLUDED.price,
 regular_price=EXCLUDED.regular_price,
 description=EXCLUDED.description,
 active=EXCLUDED.active;
COMMIT;
NOTIFY pgrst, 'reload schema';

-- 驗收：確認 Google 菜單中的 65 個品項皆已存在
SELECT COUNT(*) AS imported_menu_items
FROM public.breakfast_menu
WHERE name IN (
  '日式馬鈴薯蛋沙拉三明治',
  '起司厚蛋煙燻豬三明治',
  '優格鮪魚三明治',
  '花草檸檬雞三明治',
  '匈牙利辣味雞排三明治',
  '日式叉燒肉溏心蛋三明治',
  '碳烤雞腿排三明治',
  '地瓜泥燻雞三明治',
  '花生豬排蛋三明治',
  '義式香草舒肥雞蛋白三明治',
  '紐奧良舒肥雞蛋白三明治',
  '火山炙燒北海道明太子貝果',
  '原味炙燒北海道明太子貝果',
  '草莓麻吉乳酪貝果',
  '脆皮巧克力OREO貝果',
  '絲絨藍莓乳酪貝果',
  '巧克力藍莓乳酪貝果',
  '牛奶芝麻奶霜貝果',
  '大甲香芋貝果',
  '白玉紅豆抹茶貝果',
  '流沙乳酪碳金貝果',
  '蜂蜜燕麥貝果',
  '焙茶桂圓貝果',
  '南瓜焦糖乳酪貝果',
  '起司培根貝果',
  '美式煙燻雞貝果',
  '地瓜泥貝果',
  '玫瑰蔓越莓紅寶石',
  '鐵觀音桂圓貝果',
  '松露鹽之花貝果',
  '抹茶卡士達貝果',
  '巧克力阿華田貝果',
  '咖啡核桃貝果',
  '抹茶開心果貝果',
  '韓式奶油蒜香菲力雞吐司',
  '韓式肉肉三重奏吐司',
  '招牌韓式松露菇菇豬排吐司',
  '韓式花草檸檬雞吐司',
  '韓式厚切椒鹽雞排吐司',
  '手工布里歐小漢堡-日式鹽麴雪花豬燒肉',
  '手工布里歐小漢堡-煙燻手拋牛肉排',
  '龍蝦沙拉輕食堡',
  '燻雞藜麥毛豆輕食堡',
  '德式捲捲腸皇后布里歐堡',
  '蜜香花生鹹豬帕瑪森堡',
  '田園蔬果沙拉',
  '檸檬雞排',
  '匈牙利辣味雞排',
  '碳烤雞腿排',
  '奶香蒜味菲力雞排',
  '義式香草舒肥雞/紐奧良舒肥雞',
  '鮮蝦一尾（時價）',
  '芋頭雪酪',
  '芋見花開巴斯克',
  '客製化甜點請私訊洽談',
  '可貴甜燒餅(可可肉桂)',
  '原味甜燒餅(法國派餡)',
  '超酥牽絲焦糖餅乾（2入）',
  '古早味紅茶',
  '鮮奶茶',
  '美式咖啡',
  '咖啡鮮奶',
  '布里歐帕瑪森-奶油蒜香菲力雞',
  '明太子燻雞雞蛋三明治',
  '法式燻菇培根起司三明治'
);
