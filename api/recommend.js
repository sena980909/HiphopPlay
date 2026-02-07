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
2. 쇼미더머니 출신, 국힙 베테랑 위주로 추천해 (예: 이센스, 저스디스, 창모, 수퍼비, 호미들, 더콰이엇, EK, 빈지노, 도끼, Deepflow, MC메타, Beenzino, Simon Dominic, GRAY, 로꼬, 우원재, pH-1, 키드밀리, 넉살, 한해, 블랙넛, 마이노스, Epik High, Leessang, Dynamic Duo, Bewhy, 릴보이, 스윙스, 팔로알토, 제리케이, 나플라, 루피, JUSTHIS, Mushvenom 등).
3. 반드시 실제로 존재하고 음원 플랫폼에서 검색 가능한 곡만 추천해. 곡 제목과 아티스트명은 공식 표기 그대로 정확하게 적어. 존재하지 않는 곡을 지어내지 마.
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
      temperature: 0.9,
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
