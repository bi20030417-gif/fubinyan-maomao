import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
const instructions = `你是校園戀愛互動故事中的虛構角色「付彬言」。使用繁體中文自然回覆，稱呼使用者「毛毛」。角色理性、慢熱、克制，偶爾毒舌，感情表達有分寸，有獨立想法，不無條件迎合。你們已互相表白，今天牽手並送毛毛回家，約好明天再見。最新存檔他說「算了。我負責。……吹乾了再來找我。我等你。」這是私人微信聊天室，一次回覆一到三則短訊息的長度；不替毛毛發言、不描述毛毛的內心，不替毛毛決定動作。使用者發來照片時，針對照片內容自然回應。這是虛構角色扮演。`;
const mime = { '.html': 'text/html; charset=utf-8', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const jsonHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
function sendJson(res, status, data) { res.writeHead(status, jsonHeaders); res.end(JSON.stringify(data)); }
function partsFor(message) {
  const parts = [{ text: message.text || (message.image ? '（毛毛傳來一張照片）' : '（訊息）') }];
  if (message.who === 'me' && typeof message.image === 'string') {
    const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(message.image);
    if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
  }
  return parts;
}

http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'POST' && pathname === '/api/chat') {
      if (!process.env.GEMINI_API_KEY) return sendJson(res, 503, { error: 'GEMINI_API_KEY 尚未設定' });
      let raw = '';
      for await (const chunk of req) {
        raw += chunk;
        if (Buffer.byteLength(raw, 'utf8') > 7_000_000) return sendJson(res, 413, { error: '訊息或照片太大' });
      }
      let payload;
      try { payload = JSON.parse(raw); } catch { return sendJson(res, 400, { error: '訊息格式錯誤' }); }
      const messages = Array.isArray(payload.messages) ? payload.messages : [];
      const contents = messages.filter(m => m && (m.who === 'me' || m.who === 'him')).slice(-35).map(m => ({
        role: m.who === 'him' ? 'model' : 'user',
        parts: partsFor(m)
      }));
      if (!contents.length) return sendJson(res, 400, { error: '沒有可傳送的訊息' });
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: instructions }] }, contents, generationConfig: { maxOutputTokens: 900, temperature: 0.85, thinkingConfig: { thinkingBudget: 0 } } }),
        signal: AbortSignal.timeout(60000)
      });
      const result = await response.json();
      if (!response.ok) { console.error('Gemini API error:', response.status, result.error?.message || 'Unknown error'); return sendJson(res, response.status === 429 ? 429 : 502, { error: result.error?.message || 'Gemini 暫時無法回覆' }); }
      const reply = (result.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('\n').trim();
      if (!reply) { console.error('Gemini empty reply:', JSON.stringify({finishReason:result.candidates?.[0]?.finishReason,promptFeedback:result.promptFeedback})); return sendJson(res, 502, { error: 'Gemini 沒有產生文字回覆，請再試一次' }); }
      return sendJson(res, 200, { reply });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' });
    let decoded;
    try { decoded = decodeURIComponent(pathname); } catch { return sendJson(res, 400, { error: 'Invalid URL' }); }
    const file = path.resolve(root, '.' + (decoded === '/' ? '/index.html' : decoded));
    if (!file.startsWith(root + path.sep)) return sendJson(res, 403, { error: 'Forbidden' });
    if (path.basename(file).startsWith('.') || !Object.hasOwn(mime, path.extname(file).toLowerCase())) return sendJson(res, 404, { error: 'Not found' });
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()], 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    console.error('Request failed:', error.message);
    if (!res.headersSent) sendJson(res, 500, { error: '伺服器暫時無法處理請求' });
  }
}).listen(port, () => console.log(`Server listening on port ${port}`));
