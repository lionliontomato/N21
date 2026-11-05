# Neniの存鑽存歌｜v8 防快取修正版

與 v7 相同的版型、九欄表頭、篩選規則、背景與版權均未更動。

## 修復問題
- HTML 原先硬編碼舊小標題「謝謝每一份收藏。」；現在改為空白，從本次試算表取得資料後才顯示。
- 每次重新讀取時清空目前表格、網站主標題及小標題，失敗時不沿用舊內容。
- 先用 fetch(cache:no-store) 讀取 Google Sheets CSV，遇到瀏覽器跨網域問題才退回加唯一查詢參數的 gviz JSONP。
- 每 30 秒、重新開啟分頁、BFCache 還原時重新抓取。
- 網站 CSS 和 JS 使用獨立 v8 檔名和版本參數，避免和 v7 靜態快取混用。

## 重要限制
- 需要 Google Sheets 設為公開可檢視，且使用 gid=0。
- 更新仍受 Google Sheets 自身資料發布延遲及 GitHub Pages 靜態檔案緩存策略影響；前端只能避免沿用瀏覽器舊回應，不能保證 Google 伺服器即時傳出每次編輯。
- 不要把 v8 檔案放入子資料夾；請將 ZIP **內**的所有檔案直接放在 GitHub repository 根目錄。刪除舊版的 index/script/style 檔，避免網站還在部署前一版本。

試算表 ID：1MVOvkG312ke-sExe_DCS-5qAd4qtSLDn513-7XPYeNo。 P=設定名稱，Q=設定內容；Q 欄小標題可空白。

版權：© 2026 LionLionTomato. All Rights Reserved.


## v9 表頭修正
C～I 固定依指定文字顯示：存歌數量🎵、存爆數量🎵、存鑽數量、存圖數量、存LOL數量、存特戰數量、更新時間。即使試算表還在載入，標題列也保留。A、B 在成功讀取後採用試算表的標題，尚未讀取時使用暫時欄名。
