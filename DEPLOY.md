# 部署指引

本專案需要 Node.js 伺服器才能使用 AI 自由對話。

1. 將 fubinyan-site 資料夾內容放到私有 GitHub repository。
2. 在 Render 建立 Web Service，連接該 repository；或使用 Blueprint 讀取 render.yaml。
3. 設定 OPENAI_API_KEY 為自己的 OpenAI API 金鑰（不要放進 GitHub 或聊天訊息）。
4. Render 部署成功後會提供 HTTPS 網址，在 iPhone Safari 開啟即可。
5. 聊天資料目前只保存在該裝置瀏覽器，請定期從設定頁匯出備份。

注意：免費方案可休眠、受供應商政策調整；OpenAI API 使用會產生獨立費用。請避免公開分享沒有登入保護的網站，否則其他人可能使用你的 API 額度。建議正式長期使用前加入登入驗證、用量限制與雲端同步。
