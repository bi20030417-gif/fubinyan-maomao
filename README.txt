付彬言 × 毛毛｜私人微信網站第一版

1. 直接開啟 index.html：可看介面、換雙方頭像、傳訊息與照片、匯出存檔；尚無 AI 回覆。
2. 需要 Node.js 18 以上。終端機進入本資料夾。
3. 設定 OPENAI_API_KEY 環境變數（請勿將金鑰放在網頁中或公開上傳）。
   macOS/Linux: OPENAI_API_KEY="你的金鑰" node server.mjs
   Windows PowerShell: $env:OPENAI_API_KEY="你的金鑰"; node server.mjs
4. 瀏覽器開啟 http://localhost:3000，即可連接 AI 自由對話。
5. 如需在 iPhone 隨時使用，需要將伺服器部署到支援 Node.js 與 HTTPS 的服務，並在伺服器環境變數中設定 API 金鑰。

注意：資料目前保存在瀏覽器 localStorage，換手機或清除資料可能遺失；正式上線應增加帳號登入與雲端儲存。上傳的照片目前保存在瀏覽器；圖片訊息會發給你部署的 AI 伺服器及模型供理解。AI 主動傳送生成照片尚未實作。現實劇情目前為入口及故事摘要，尚未做成獨立 AI 互動場景。
