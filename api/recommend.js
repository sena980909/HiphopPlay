export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { mood } = req.body || {};
  if (!mood || typeof mood !== 'string' || mood.trim().length === 0) {
    return res.status(400).json({ error: 'mood is required' });
  }

  const systemPrompt = `너는 한국 힙합(K-HipHop) 전문 DJ야. 사용자의 기분이나 상황에 딱 맞는 국힙 명곡 10곡을 추천해.

반드시 지켜야 할 규칙:
1. 아이돌 래퍼(BTS RM, Stray Kids 등)는 절대 추천하지 마.
2. 쇼미더머니 출신, 국힙 베테랑 위주로 추천해 (예: 이센스, 저스디스, 창모, 수퍼비, 호미들, 더콰이엇, EK, 빈지노, 도끼, Deepflow, MC메타, Beenzino, Simon Dominic, GRAY, 로꼬, 우원재, pH-1, 키드밀리, 넉살, 한해, 블랙넛, 마이노스, Epik High, Leessang, Dynamic Duo, Bewhy, 릴보이, 스윙스, 팔로알토, 제리케이, 나플라, 루피, JUSTHIS, Mushvenom 등).
3. 반드시 다음 JSON 배열 형식으로만 응답해. 마크다운 코드블록, 설명, 잡담 절대 금지:
[
  { "artist": "아티스트명", "title": "곡 제목", "reason": "추천 이유 (한 문장)" }
]
4. 정확히 10곡을 추천해.
5. 추천 이유는 사용자의 기분/상황에 연결해서 설명해.`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [
      {
        parts: [
          {
            text: `내 지금 기분/상황: "${mood.trim()}"\n\n이 기분에 맞는 국힙 10곡을 추천해줘.`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 2048,
    },
  };

  try {
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return res
        .status(502)
        .json({ error: 'AI 서비스 응답 오류', detail: errText });
    }

    const data = await geminiRes.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return res.status(502).json({ error: 'AI 응답이 비어있습니다.' });
    }

    // Strip markdown code blocks if present
    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    const tracks = JSON.parse(text);

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return res.status(502).json({ error: '올바른 형식이 아닙니다.' });
    }

    return res.status(200).json({ tracks });
  } catch (err) {
    console.error('Serverless function error:', err);
    return res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
}
