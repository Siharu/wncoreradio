// api/world-news.js — VERCEL SERVERLESS FUNCTION
// Multi-provider AI news generation with failover: Gemini → Groq
// Reads from shared LORE_DUMP for consistency
// Requires: GEMINI_API_KEY OR GEMINI_API_KEY_2 OR GROQ_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify API secret (optional but recommended)
  const authKey = req.headers['x-wncore-secret'] || req.body.secret;
  if (process.env.WNCORE_SECRETS && authKey !== process.env.WNCORE_SECRETS) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { action, loreDump, currentYear } = req.body;

  if (action === 'generate') {
    return generateNews(res, loreDump, currentYear);
  }

  return res.status(400).json({ error: 'Invalid action' });
}

async function generateNews(res, loreDump, currentYear) {
  const newsPrompt = buildNewsPrompt(loreDump, currentYear);

  // Try providers in order: Gemini 1 → Gemini 2 → Groq
  const providers = [
    {
      name: 'GEMINI_1',
      key: process.env.GEMINI_API_KEY,
      call: () => callGemini(newsPrompt, process.env.GEMINI_API_KEY),
    },
    {
      name: 'GEMINI_2',
      key: process.env.GEMINI_API_KEY_2,
      call: () => callGemini(newsPrompt, process.env.GEMINI_API_KEY_2),
    },
    {
      name: 'GROQ',
      key: process.env.GROQ_API_KEY,
      call: () => callGroq(newsPrompt, process.env.GROQ_API_KEY),
    },
  ];

  for (const provider of providers) {
    if (!provider.key) continue;

    try {
      const result = await provider.call();
      return res.status(200).json(result);
    } catch (error) {
      console.error(`${provider.name} failed:`, error.message);
      // Continue to next provider
    }
  }

  return res.status(500).json({ error: 'All AI providers unavailable' });
}

async function callGemini(prompt, apiKey) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 400 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  return parseNewsResponse(content);
}

async function callGroq(prompt, apiKey) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mixtral-8x7b-32768',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 400,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  return parseNewsResponse(content);
}

function buildNewsPrompt(loreDump, currentYear) {
  const factions = Object.entries(loreDump.factions)
    .map(([name, data]) => `${name}: ${data.purpose}`)
    .join('\n');

  const variants = Object.entries(loreDump.variants)
    .map(([name, data]) => `${name}: ${data.appearance}`)
    .join('\n');

  return `You are the NARRATOR of the Another Sky world. Generate a realistic news bulletin from ${currentYear}.

WORLD CONTEXT:
- Year: ${currentYear}
- Apocalypse Started: ${loreDump.worldBackground.apocalypseStart}
- Known Factions: ${factions}
- Variant Types: ${variants}
- Main Mystery: The Nine people erased from existence
- Current Focus: Subject S (Som) transfer protocol
- Signal Source: Still transmitting from frequency 88.7 FM

GENERATE A NEWS BULLETIN that:
1. Sounds like official WNCORE reporting
2. References real factions, Ghuuls, Obsedia, or locations
3. Maintains timeline consistency (${currentYear})
4. Is brief (2-3 sentences)
5. Contains cryptic language or hidden meanings
6. Uses emoji prefix (like ⚠ 📡 ❗ etc)

FORMAT YOUR RESPONSE AS:
HEADLINE: [News title]
CONTENT: [Full news bulletin, 1-3 sentences]
CATEGORY: [SUPPLY_UPDATE | VARIANT_ALERT | FACTION_NEWS | SIGNAL_INTERCEPT | WORLD_UPDATE]
REGION: [Geographic region: Dhaka, Eastern Europe, Moon Dome, etc]`;
}

function parseNewsResponse(text) {
  const lines = text.split('\n').filter(l => l.trim());
  let headline = 'WNCORE UPDATE';
  let content = 'Connection lost to remote nodes.';
  let category = 'WORLD_UPDATE';
  let region = 'Unknown';

  lines.forEach(line => {
    if (line.includes('HEADLINE:')) {
      headline = line.replace('HEADLINE:', '').trim();
    } else if (line.includes('CONTENT:')) {
      content = line.replace('CONTENT:', '').trim();
    } else if (line.includes('CATEGORY:')) {
      category = line.replace('CATEGORY:', '').trim();
    } else if (line.includes('REGION:')) {
      region = line.replace('REGION:', '').trim();
    }
  });

  return { headline, content, category, region };
}
