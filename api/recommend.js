export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let mood;
  try {
    const body = await req.json();
    mood = body.mood;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!mood || typeof mood !== 'string' || mood.trim().length === 0) {
    return new Response(JSON.stringify({ error: 'mood is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const systemPrompt = `너는 한국 힙합(K-HipHop) 전문 DJ야. 사용자의 기분이나 상황에 딱 맞는 국힙 명곡 10곡을 추천해.

반드시 지켜야 할 규칙:
1. 아이돌 래퍼(BTS RM, Stray Kids 등)는 절대 추천하지 마.
2. 10곡 모두 서로 다른 아티스트로 추천해. 같은 아티스트를 두 번 이상 넣지 마.
3. 멜론, 벅스, 지니, 유튜브 뮤직 등 실제 음원 플랫폼에서 검색했을 때 나오는 곡만 추천해. 곡 제목은 공식 발매 표기 그대로 정확하게 써. 확신이 없는 곡은 절대 추천하지 마. 곡을 지어내면 안 돼.
4. 반드시 다음 JSON 배열 형식으로만 응답해. 마크다운 코드블록, 설명, 잡담 절대 금지:
[
  { "artist": "아티스트명", "title": "곡 제목", "reason": "추천 이유 (한 문장)" }
]
5. 정확히 10곡을 추천해.
6. 추천 이유는 사용자의 기분/상황에 연결해서 설명해.`;

  const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const requestBody = {
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
      temperature: 0.7,
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  try {
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return new Response(JSON.stringify({ error: 'AI 서비스 응답 오류' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await geminiRes.json();
    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      return new Response(
        JSON.stringify({ error: 'AI 응답이 비어있습니다.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    text = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    const tracks = JSON.parse(text);

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return new Response(
        JSON.stringify({ error: '올바른 형식이 아닙니다.' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify({ tracks }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Edge function error:', err);
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했습니다.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
