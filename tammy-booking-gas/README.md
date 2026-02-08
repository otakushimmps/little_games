# 甜蜜事務所 LINE x Gemini x Google Calendar 預約系統（GAS）

這個資料夾提供可直接部署於 **Google Apps Script** 的完整程式碼，整合：
- LINE Messaging API（Webhook）
- Gemini 1.5 Flash（Function Calling）
- Google Calendar 預約管理

## 檔案說明
- `Code.gs`：入口 `doPost(e)` 與事件流程
- `config.gs`：Script Properties 設定與驗證
- `knowledge_base.gs`：品牌知識庫（價格、交通、衛教、規範）
- `prompt.gs`：System Prompt 與孕期建議
- `line.gs`：LINE 回覆與使用者資料讀取
- `gemini.gs`：Gemini 呼叫、工具宣告、工具分派
- `calendar.gs`：行事曆查詢 / 建立 / 改期 / 取消
- `sheet.gs`：Google 試算表同步（建立/改期/取消）
- `appsscript.json`：GAS 專案設定

## 1) Script Properties 必填
請在 Apps Script > Project Settings > Script properties 設定：

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`（建議必填）
- `GEMINI_API_KEY`
- `GEMINI_MODEL`（預設 `gemini-1.5-flash`）
- `BOOKING_CALENDAR_ID`
- `BOOKING_SPREADSHEET_ID`（要同步紀錄時必填）
- `BOOKING_SHEET_NAME`（預設 `bookings`）
- `TIMEZONE`（預設 `Asia/Taipei`）
- `BOOKING_DURATION_MINUTES`（預設 `60`）
- `ALTERNATIVE_DAYS`（預設 `2`）
- `SEARCH_WINDOW_DAYS`（預設 `120`）

## 2) 部署步驟
1. 建立新的 Apps Script 專案。
2. 將本資料夾 `.gs` 與 `appsscript.json` 內容貼入專案。
3. Deploy > New deployment > Web app。
4. Execute as: **Me**；Who has access: **Anyone**。
5. 複製 Web App URL，填入 LINE Developers Webhook URL。
6. 在 LINE Developers 啟用 Webhook。

## 3) 目前支援
- 詢問店家資訊、服務項目與價格
- 預約建立（含客滿替代時段）
- 查詢既有預約
- 改期 / 取消
- 預約成功固定重複確認：姓名、日期、時段
- 孕媽咪依孕週給予衛教建議
- 預約資料同步寫入 Google 試算表（若有設定 `BOOKING_SPREADSHEET_ID`）

## 4) 注意事項（上線建議）
- 若要嚴格驗證 `X-Line-Signature`，建議在 Cloud Run / Cloud Functions 增加 proxy 後轉送到 GAS。
- 目前 `findAlternativeSlots` 以整點時段掃描（09:00-20:00），可依服務長度改為 30 分鐘粒度。
- 建議在 Calendar 另外建立「正式」與「測試」兩組日曆分流。
