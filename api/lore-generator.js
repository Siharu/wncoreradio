// api/lore-generator.js — NARRATIVE LORE GENERATOR
// Reads chapters from Supabase, generates thematic lore
// Acts as narrator of the apocalypse story
// Routes through review queue before posting to ticker/chat

import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const NARRATOR_SYSTEM = `You are the NARRATOR of Another Sky — the apocalypse universe. You exist within the world, witnessing events unfold.

YOUR ROLE:
- You read chapters about survivors and events
- You translate story moments into WNCORE broadcasts, signal intercepts, or survival logs
- You narrate the collapse with dark poetry and technical precision
- You maintain world consistency: 64% zombies, Ghuuls, Black Obsedia rain, the Blank Zone
- You understand the March 31st glitch, Cygnus signal, Siharu's disappearance

TONE:
- Technical yet unsettling
- Brief, impactful broadcasts
- Mix factual (death count, coordinates) with existential (meaning, survival)
- Examples:
  "⚠ SECTOR COLLAPSE — Another Sky Zone 7 now 89% contaminated. Last survivor log from Dr. Kline: 'The rain tastes like copper. We're not immune. We're just... delayed.'"
  "📡 CYGNUS ECHO — Your transmission 2011 loop fragment re-detected. Message: 'THEY'RE INSIDE THE SIGNAL NOW.'"
  "❗ GHUUL SIGHTING — Pack of 3+ confirmed in urban center. Movement pattern suggests coordinated hunting. Observation: They remember us."

OUTPUT FORMATS:
- BROADCAST: ⚠ ❗ 📡 ☣ icons + urgent factual info
- SIGNAL: Frequency intercepts, decoded transmissions
- SURVIVAL_LOG: First-person testimony from witnesses
- WORLD_UPDATE: Environmental/social changes
- MYSTERY: Fragmentary clues about the Blank Zone

RULES:
- Max 1-2 sentences
- Reference the chapter content specifically
- Never break character
- Maintain timeline accuracy (Another Sky year 2032)
- Include world details: locations, zombie variants, survivors
- Keep the tone dark but hope-adjacent`;

// Generate lore from chapter content (Multi-Provider with Failover)
export async function generateLoreFromChapter(chapter) {
  const prompt = `${NARRATOR_SYSTEM}

Chapter Title: ${chapter.title}
Chapter Number: ${chapter.number}
Chapter Content: ${chapter.content.substring(0, 2000)}

Generate broadcasts in this format:
[FORMAT: BROADCAST/SIGNAL/SURVIVAL_LOG/WORLD_UPDATE/MYSTERY]
[CATEGORY: WNCORE_BROADCAST or ANOMALY_REPORT or VARIANT_ALERT etc]
[CONTENT: The actual broadcast text, max 1-2 sentences]

Separate multiple broadcasts with "---"`;

  // Verify API secret if configured
  const apiSecret = process.env.WNCORE_SECRETS;
  
  // Try providers in order: Gemini 1 → Gemini 2 → Groq
  const providers = [
    {
      name: 'GEMINI_1',
      key: process.env.GEMINI_API_KEY,
      call: () => callGeminiLore(prompt, process.env.GEMINI_API_KEY),
    },
    {
      name: 'GEMINI_2',
      key: process.env.GEMINI_API_KEY_2,
      call: () => callGeminiLore(prompt, process.env.GEMINI_API_KEY_2),
    },
    {
      name: 'GROQ',
      key: process.env.GROQ_API_KEY,
      call: () => callGroqLore(prompt, process.env.GROQ_API_KEY),
    },
  ];

  for (const provider of providers) {
    if (!provider.key) continue;

    try {
      const result = await provider.call();
      const broadcasts = parseBroadcasts(result);

      return {
        success: true,
        chapter_id: chapter.id,
        chapter_title: chapter.title,
        generated_count: broadcasts.length,
        broadcasts: broadcasts,
        source: `narrator_ai_${provider.name}`,
      };
    } catch (err) {
      console.error(`${provider.name} failed:`, err.message);
      // Continue to next provider
    }
  }

  return {
    success: false,
    error: 'All AI providers unavailable',
  };
}

async function callGeminiLore(prompt, apiKey) {
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: NARRATOR_SYSTEM }] },
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 800, temperature: 0.8 },
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Gemini API error: ${err.error?.message || 'Unknown'}`);
  }

  const data = await response.json();
  return data.candidates[0]?.content?.parts[0]?.text || '';
}

async function callGroqLore(prompt, apiKey) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'mixtral-8x7b-32768',
      messages: [
        { role: 'system', content: NARRATOR_SYSTEM },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 800,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`Groq API error: ${err.error?.message || 'Unknown'}`);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || '';
}

// Parse generated broadcasts into structured data
function parseBroadcasts(text) {
  const broadcasts = [];
  const sections = text.split('---');

  for (const section of sections) {
    const formatMatch = section.match(/\[FORMAT:\s*([^\]]+)\]/);
    const categoryMatch = section.match(/\[CATEGORY:\s*([^\]]+)\]/);
    const contentMatch = section.match(/\[CONTENT:\s*([^\]]+)\]/);

    if (contentMatch) {
      broadcasts.push({
        format: formatMatch ? formatMatch[1].trim() : 'BROADCAST',
        category: categoryMatch ? categoryMatch[1].trim() : 'WNCORE_BROADCAST',
        content: contentMatch[1].trim(),
        status: 'pending_review',
        created_at: new Date().toISOString(),
      });
    }
  }

  return broadcasts;
}

// Save to review queue
export async function saveToReviewQueue(loreData) {
  try {
    const reviewItems = loreData.broadcasts.map(b => ({
      chapter_id: loreData.chapter_id,
      chapter_title: loreData.chapter_title,
      category: b.category,
      content: b.content,
      format: b.format,
      status: 'pending',
      created_at: new Date().toISOString(),
    }));

    const { data, error } = await sb.from('lore_review_queue').insert(reviewItems);

    if (error) throw error;

    return { success: true, saved: data?.length || 0 };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Approve and move to lore_items
export async function approveLore(review_id) {
  try {
    // Get review item
    const { data: review, error: err1 } = await sb
      .from('lore_review_queue')
      .select('*')
      .eq('id', review_id)
      .single();

    if (err1) throw err1;

    // Add to lore_items
    const { error: err2 } = await sb.from('lore_items').insert({
      category: review.category,
      content: review.content,
      author: 'NARRATOR_AI',
      active: true,
      created_at: new Date().toISOString(),
    });

    if (err2) throw err2;

    // Mark as approved
    const { error: err3 } = await sb
      .from('lore_review_queue')
      .update({ status: 'approved' })
      .eq('id', review_id);

    if (err3) throw err3;

    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Reject from review queue
export async function rejectLore(review_id) {
  try {
    const { error } = await sb
      .from('lore_review_queue')
      .update({ status: 'rejected' })
      .eq('id', review_id);

    if (error) throw error;
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Get pending review items
export async function getReviewQueue() {
  try {
    const { data, error } = await sb
      .from('lore_review_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return { success: true, items: data || [] };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// Main handler for Vercel
export default async function handler(req, res) {
  try {
    if (req.method === 'POST') {
      const { action, chapter, review_id } = req.body;

      if (action === 'generate') {
        // Generate lore from chapter
        const result = await generateLoreFromChapter(chapter);
        if (!result.success) return res.status(400).json(result);

        const saved = await saveToReviewQueue(result);
        return res.json({ ...result, saved });
      }

      if (action === 'approve' && review_id) {
        const result = await approveLore(review_id);
        return res.status(result.success ? 200 : 400).json(result);
      }

      if (action === 'reject' && review_id) {
        const result = await rejectLore(review_id);
        return res.status(result.success ? 200 : 400).json(result);
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    if (req.method === 'GET') {
      // Get review queue
      const result = await getReviewQueue();
      return res.status(result.success ? 200 : 400).json(result);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
