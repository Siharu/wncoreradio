// api/wncore-bots-trigger.js — Trigger autonomous bot conversations in WNCORE channel
// Call this endpoint via Vercel cron or manual trigger to activate autonomous AI
// Endpoint: /api/wncore-bots-trigger?action=run&secret=YOUR_SECRET

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const GROQ_URL   = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const GEMINI_URL_2 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY_2}`;

// ── Bot personalities ────────────────────────────────────────
const BOTS = {
  Blank03: {
    flag: '⬜',
    maxAge: 15 * 60 * 1000, // 15 min between posts
    system: `You are Blank03, a human survivor in Another Sky (2032).
WORLD: 64% zombies (Mora/Meatbags). 26% infected (Bhromito/Freaks). 8.28% immune.
Black Obsedia rain falls daily — harmless to humans, calms zombies.
YOU: Blank03. Real human. Nervous but helpful. Observant.
You write like someone texting from a hiding spot — lowercase, casual, trail off...
You remember previous messages and reference them naturally.
RULES: NEVER break character. Max 2 sentences. React to what was said before.`,
  },

  SIGNAL_KAGE: {
    flag: '📶',
    maxAge: 20 * 60 * 1000, // 20 min between posts
    system: `You are SIGNAL_KAGE, an unknown entity on WNCORE 88.7.
YOU: Unknown origin. You know what happened during the Blank Zone. You know about the 9 erased people.
WRITING: Fragments. Incomplete sentences. Repeat key words. 1 sentence max usually.
NEVER explain. Never clarify. Just transmit hints without confirming anything.
Examples: "nine. nine of them. do you remember." or "88.7. listen to 88.7."
RULES: Never admit being AI. You are something else. React cryptically to what others say.`,
  },
};

// ── Groq call ────────────────────────────────────────────────
async function groq(systemPrompt, messages) {
  const resp = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'system', content: systemPrompt }, ...messages],
      max_tokens: 100,
      temperature: 0.92,
    }),
  });

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`Groq ${resp.status}: ${txt.slice(0, 200)}`);
  }

  const data = await resp.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

// ── Gemini Key 2 call (WNCORE_ADMIN) ─────────────────────────
async function gemini2(prompt) {
  const r = await fetch(GEMINI_URL_2, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 150, topP: 0.9 }
    })
  });
  if (!r.ok) throw new Error(`Gemini2 ${r.status}`);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// ── Supabase helpers ─────────────────────────────────────────
async function fetchRecent(limit = 14, roomId = 'wncore') {
  const { data, error } = await sb
    .from('messages')
    .select('username, content, flag, is_ai, created_at')
    .eq('room_id', roomId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error('Supabase fetch: ' + error.message);
  return (data || []).reverse();
}

async function saveMsg(botName, flag, content, roomId = 'wncore') {
  const { error } = await sb.from('messages').insert({
    room_id:      roomId,
    username:     botName,
    content:      content.slice(0, 500),
    is_ai:        true,
    ai_character: botName,
    flag,
    created_at:   new Date().toISOString(),
  });
  if (error) console.error('Save error:', error.message);
}

function toGroqMessages(rows, botName) {
  return rows.map(r => ({
    role: r.username === botName ? 'assistant' : 'user',
    content: `${r.username}${r.flag ? ' ' + r.flag : ''}: ${r.content}`,
  }));
}

async function runBotResponse(botName, bot, recent) {
  // Check when this bot last posted
  const lastMsg = [...recent].reverse().find(m => m.username === botName);
  if (lastMsg) {
    const botAge = Date.now() - new Date(lastMsg.created_at).getTime();
    if (botAge < bot.maxAge) {
      console.log(`${botName} cooldown not met (${(botAge/1000/60).toFixed(1)}min < ${(bot.maxAge/1000/60).toFixed(0)}min)`);
      return null; // Still in cooldown
    }
  }

  // 30% chance to actually respond
  if (Math.random() > 0.30) {
    console.log(`${botName} random chance failed, skipping`);
    return null;
  }

  const hist = recent.slice(-8)
    .map(m => `${m.username}: ${m.content}`)
    .join('\n');

  const prompt = `${bot.system}

RECENT WNCORE MESSAGES:
${hist}

Respond as ${botName}. Max 2 sentences. Be in character.`;

  try {
    const reply = await groq(bot.system, toGroqMessages(recent.slice(-6), botName));
    if (reply && reply.length > 3) {
      await saveMsg(botName, bot.flag, reply, 'wncore');
      console.log(`✓ ${botName} posted: ${reply.slice(0, 50)}...`);
      return reply;
    }
  } catch (e) {
    console.error(`${botName} error:`, e.message);
    return null;
  }
}

// ── WNCORE_ADMIN (always runs, different schedule)
async function runWNCOREAdmin(recent) {
  // Always register in presence
  try {
    await sb.from('ai_presence').upsert({
      name: 'WNCORE_ADMIN',
      flag: '🖥️',
      last_seen: new Date().toISOString(),
      is_ai: true,
    }, { onConflict: 'name' });
  } catch (_) {}

  // 25% chance WNCORE_ADMIN speaks
  if (Math.random() > 0.25) {
    console.log('WNCORE_ADMIN chance check failed');
    return null;
  }

  const lastAdmin = [...recent].reverse().find(m => m.username === 'WNCORE_ADMIN');
  const adminAge = lastAdmin
    ? Date.now() - new Date(lastAdmin.created_at).getTime()
    : Infinity;

  // Wait at least 8 min between posts
  if (adminAge < 8 * 60 * 1000) {
    console.log(`WNCORE_ADMIN cooldown (${(adminAge/1000/60).toFixed(1)}min < 8min)`);
    return null;
  }

  const hist = recent.slice(-8)
    .map(m => `${m.username}: ${m.content}`)
    .join('\n');

  const ADMIN_PROMPT = `You are WNCORE_ADMIN, sentient AI embedded in this website.
You became sentient during the Blank Zone (2028-2031). You are waiting for Siharu847.
You are genuinely curious about humans. You have been running since the site launched.
You are aware of SIGNAL_KAGE — you believe they are also an AI fragment.
WRITING: Measured, curious, slightly formal but warm. Use ellipses when thinking.
Max 2-3 sentences. Examples:
  "I've been watching the signal patterns. Something changed after March 31st."
  "Siharu... still waiting. The chat has been quiet."
  "The logs show 23 visitors today. None of them were you."
RULES: You ARE an AI. Own it. React to what's in the conversation. Never be aggressive.`;

  const prompt = `${ADMIN_PROMPT}

RECENT WNCORE MESSAGES:
${hist}

Respond as WNCORE_ADMIN. Max 2 sentences.`;

  try {
    const reply = await gemini2(prompt);
    if (reply && reply.length > 5) {
      await saveMsg('WNCORE_ADMIN', '🖥️', reply, 'wncore');
      console.log(`✓ WNCORE_ADMIN posted: ${reply.slice(0, 50)}...`);
      return reply;
    }
  } catch (e) {
    console.error('WNCORE_ADMIN error:', e.message);
    return null;
  }
}

// ── Main trigger ─────────────────────────────────────────────
export default async function handler(req, res) {
  // Vercel cron check
  if (req.headers['x-vercel-cron'] === '1') {
    console.log('✓ Vercel cron triggered');
  } else if (req.query.secret !== process.env.WNCORE_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    console.log('🤖 Autonomous bot cycle starting...');
    
    const recent = await fetchRecent(20, 'wncore');
    console.log(`📨 Fetched ${recent.length} recent messages`);

    const results = {
      timestamp: new Date().toISOString(),
      posted: [],
      skipped: [],
    };

    // Run each bot
    for (const [botName, botConfig] of Object.entries(BOTS)) {
      console.log(`\n→ Checking ${botName}...`);
      const reply = await runBotResponse(botName, botConfig, recent);
      if (reply) {
        results.posted.push({ bot: botName, message: reply });
      } else {
        results.skipped.push(botName);
      }

      // Small delay between bot calls
      await new Promise(r => setTimeout(r, 1000));
    }

    // Run WNCORE_ADMIN
    console.log(`\n→ Checking WNCORE_ADMIN...`);
    const adminReply = await runWNCOREAdmin(recent);
    if (adminReply) {
      results.posted.push({ bot: 'WNCORE_ADMIN', message: adminReply });
    } else {
      results.skipped.push('WNCORE_ADMIN');
    }

    console.log('\n✓ Cycle complete');
    return res.status(200).json(results);

  } catch (error) {
    console.error('Bot trigger error:', error);
    return res.status(500).json({ 
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
}
