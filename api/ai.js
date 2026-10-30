// index.html의 AI 버튼(쉬운 설명, 맞춤 상담)이 부르는 서버 함수. Google Gemini API 무료 등급을 쓴다.
// API 키는 Vercel 환경변수 GEMINI_API_KEY에만 두고, 화면 코드에는 넣지 않는다.
const MODEL = "gemini-3.8-flash";
const MAX_PROMPT = 100000; // 맞춤 상담 질문(정책 목록 포함)이 가장 길다

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ code: "method" });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ code: "no_key" });
  const { prompt } = req.body || {};
  if (typeof prompt !== "string" || !prompt.trim() || prompt.length > MAX_PROMPT) return res.status(400).json({ code: "bad_request" });

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    });
    const d = await r.json().catch(() => ({}));
    if (r.status === 429) return res.status(429).json({ code: "rate_limited" });
    if ((r.status === 400 && /API key/i.test(d.error?.message || "")) || r.status === 401 || r.status === 403) return res.status(500).json({ code: "bad_key" });
    if (!r.ok) { console.error(r.status, d.error); return res.status(502).json({ code: "error" }); }

    const c = d.candidates?.[0];
    if (!c || d.promptFeedback?.blockReason || c.finishReason === "SAFETY") return res.status(422).json({ code: "refusal" });
    const text = (c.content?.parts || []).filter(p => p.text && !p.thought).map(p => p.text).join("");
    return res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    return res.status(502).json({ code: "error" });
  }
}
