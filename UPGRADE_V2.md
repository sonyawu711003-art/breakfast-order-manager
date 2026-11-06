# 🥯 吃早餐手機系統 V2：LINE 截圖、雙人審核、可改菜單與訂單金額

## 啟用前務必先做（一次）
1. 開啟 Supabase Dashboard → SQL Editor → New query，確認專案是「吃早餐」專案。
2. 開啟本儲存庫 [upgrade_ocr_menu.sql](./supabase/upgrade_ocr_menu.sql)，點 Raw 複製**完整 SQL**，貼到 Supabase SQL Editor，執行 Run。
3. 看到 `Success. No rows returned` 後，檢查 Table Editor 裡有 `breakfast_menu`、`breakfast_proposals`，`breakfast_orders` 多出 `total_override` 與 `total_amount` 欄位，Storage 有私密 bucket `breakfast-line-shots`。
4. 兩個管理者各自登入 [雲端版](https://sonyawu711003-art.github.io/breakfast-order-manager/cloud.html)，在「菜單」查看/修改價格。
5. 雲端版的首頁新增「上傳 LINE 截圖」入口；亦可直接打開 [截圖雲端匯入](https://sonyawu711003-art.github.io/breakfast-order-manager/cloud-capture.html)。
6. 上傳一張**測試用**截圖，先校正 OCR 文字、姓名、取餐日、品項數量與加減料。選新增／修改／取消，送出共同待審。
7. 第二位管理者在「審核」確認或退回，核准後回到「訂單」及「統計」查看是否同步。
8. 驗證菜單價格、單價覆寫、整筆總額覆寫與 A4 訂單卡；測試完成後將測試單取消。

## 價格的計算規則
- 菜單是**預設單價**，例如蜂蜜燕麥貝果 $50。可直接在「菜單」新增、改價或停用。
- 新增訂單挑選菜單後，自動帶入單價；實際總金額預設為**單價 × 數量**。
- 特殊客製／個人優惠可以直接修改該筆訂單的**單價**。也可以在「手動調整整筆總金額」欄填一個總額，以該金額為準。
- 留白表示未知價格，不能自動計作 $0；統計已定價合計時會提示還有幾筆未定價。
- 菜單日後調價**不會修改歷史訂單已儲存的單價或總額**。
- 截圖產生的候選單可修改單價／總額，送入待審核後由管理者審核。

## 個資與審核安全
- 兩人都用各自 Supabase Auth 登入；RLS 僅允許 `admin_users` 內的帳號存取。
- 原始 LINE 截圖放進**非公開 Storage bucket**，必須登入授權管理者才可取得有效短期網址；不放在 GitHub 程式庫。
- OCR 透過瀏覽器的 Tesseract.js 辨識文字，OCR 模組／語言模型需下載。文字解析為輔助，**不保證能正確辨識改單或多品項訊息**。
- OCR 不能直接改正式訂單；新增/修改/取消全部先成為 `breakfast_proposals` 待審。
- 待審由任一管理者審核，透過伺服器 RPC 一次完成狀態與訂單更新；第二次審核會拒絕，舊版本修改也會拒絕。
- 相同截圖與候選行再次提交會產生重複指紋錯誤。仍需人工核對不同截圖中的相同訂單。
- 原本的 cloud.html 正式資料不會因執行 SQL 被刪除；此升級**不會自動匯入過往 LINE 歷史訂單**。
- 主系統在 Supabase migration 執行前，菜單與審核清單會顯示尚未建立資料表。

## 驗收狀態
- [x] GitHub：新增 SQL migration、手機截圖雲端匯入、共享審核、菜單價格、手動總額欄位
- [x] 程式碼：JavaScript 基本語法檢查通過
- [ ] Supabase：由專案管理者執行升級 SQL
- [ ] iPhone：實際截圖 OCR、私密上傳及共同審核測試
- [ ] 雙管理者：新增/修改/取消衝突及 A4 列印測試

如執行 SQL 出現 Error，**不要反覆執行或刪除舊資料表**，保留畫面提供錯誤內容以便修正。