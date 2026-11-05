# 吃早餐雙管理者雲端版｜啟用說明

新介面：https://sonyawu711003-art.github.io/breakfast-order-manager/cloud.html

目前已完成程式及資料庫結構，但 **尚未建立 Supabase 專案，也尚未設定兩位管理者帳號**；請勿將此視為正式可用的雲端訂單系統。

## 步驟
1. 前往 https://supabase.com/dashboard 建立 Supabase 專案。
2. 在 SQL Editor 執行本儲存庫 supabase/schema.sql。
3. Authentication → Providers 啟用 Email；建議停用公開註冊。Authentication → Users 邀請兩位管理者，兩人分別設定自己的密碼。
4. 從 Authentication → Users 取得兩位的 UUID，於 SQL Editor 寫入 public.admin_users（範例如下）。
5. 在 Project Settings → API 取得 Project URL 與 publishable key（舊版 anon key 亦可），填入 cloud-config.js。**絕對不可使用 service_role 或 secret API key。**
6. Authentication → URL Configuration 將 Site URL 設為 https://sonyawu711003-art.github.io/breakfast-order-manager/ ，允許需要的登入重導網址。
7. 用兩支手機各自登入 cloud.html，測試雙人新增、修改、取消、同步、同時修改衝突、列印、匯出及第三人無權限。

## 兩名管理者授權 SQL 範例
```sql
insert into public.admin_users(user_id,display_name) values
  ('請替換為管理者A的UUID','管理者 A'),
  ('請替換為管理者B的UUID','管理者 B')
on conflict(user_id) do update set display_name=excluded.display_name;
```

## 安全與功能範圍
- 兩位管理者完全同權；所有資料存入同一個 Supabase 資料庫，RLS 只允許名單上的使用者存取。
- 系統使用 server-side audit trigger 記錄操作人、時間、修改前後內容。取消為軟刪除。
- 舊版 index.html 的 localStorage 資料 **不會自動搬進雲端**。必須先備份並驗證明細。
- capture.html 的 LINE OCR 截圖目前是本機待審版，**尚未串接雲端訂單表**；複雜修改仍需人工核對。
- 目前 app 使用 Realtime 通知及約 20 秒輪詢補充，斷網時不能視為已完成儲存。
- GitHub Pages 是公開網站，只能放前端程式，不可放實際客戶名單、登入密碼或秘密金鑰。
- 修改採版本號檢查，避免兩人無聲覆寫同一筆訂單。

## 驗收
- [ ] A/B 個別登入，能讀寫同一筆測試訂單
- [ ] 第三位未授權帳號無法讀寫
- [ ] 兩人同時修改時拒絕舊版本
- [ ] 操作紀錄包含人、時間、修改前後內容
- [ ] iPhone 產出的 A4 訂單卡正確
- [ ] 正式匯入前已核對既有訂單主檔