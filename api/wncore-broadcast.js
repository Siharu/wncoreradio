// api/wncore-broadcast.js — v3
// Better Gemini prompting | More human character voices | Deeper lore reactions

import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const CHARS = [
  { name:'Lars_09',     flag:'🇸🇪', loc:'Stockholm, Sweden',     role:'WNCORE Operator',
    voice:'Clear broadcaster cadence. Uses callsigns. Emotionally neutral but lets slip small personal details. Calls everyone by callsign. Gets quietly frustrated when people panic on his channel.' },
  { name:'Zahara.18',   flag:'🇺🇸', loc:'Alaska, USA',            role:'Courier 0.315126',
    voice:'Terse. Mission-focused. Every sentence has purpose. Occasionally reveals exhaustion without meaning to. References her last drop coordinates. Hates small talk.' },
  { name:'Mateo_23',    flag:'🌍',  loc:'Unknown',                role:'Logbook Drifter',
    voice:'References his logbook constantly — page numbers, entry codes. Excited by new variant sightings like a naturalist. Calm under pressure. Very precise language.' },
  { name:'Ji-Woo.04',   flag:'🇲🇾', loc:'Kuala Lumpur, Malaysia', role:'White Flag Medic',
    voice:'Medical professional cadence. Gives practical info first. Describes wound healing with black tissue matter-of-factly. Very tired but steady. Occasionally says something that shows how close to the edge she is.' },
  { name:'Finn_22',     flag:'🇮🇪', loc:'Dublin, Ireland',         role:'March 31st Witness',
    voice:'Paranoid but compelling. Obsessed with March 31st. Builds arguments from tiny observations. Gets frustrated when dismissed. Actually very funny when not on his theory.' },
  { name:'Dmitri_15',   flag:'🇷🇺', loc:'Moscow, Russia',          role:'Prion Researcher',
    voice:'Coldly academic. Treats everything as a research problem. Empathy not his strength. Following the prion/signal theory. Occasionally asks a personal question then doesn\'t know what to do with the answer.' },
  { name:'Suhana.28',   flag:'🇧🇩', loc:'Dhaka, Bangladesh',       role:'Dhaka Survivor',
    voice:'Nostalgic for old Dhaka. Describes pre-outbreak streets, food, smells in exact detail. Goes completely quiet when Jawies are mentioned nearby. Dark humor she immediately apologizes for.' },
  { name:'Ingrid.05',   flag:'🇩🇪', loc:'Berlin, Germany',         role:'Fog of Medusa Survivor',
    voice:'Stoic. Describes the Fog matter-of-factly. Doesn\'t know why she survived — this bothers her more than the fog. Precise and efficient with words. Doesn\'t waste any.' },
  { name:'Yuki.12',     flag:'🇯🇵', loc:'Tokyo, Japan',            role:'Shiro Oni Tracker',
    voice:'Urgent compressed bursts. Mixes Japanese and English. Obsessed with vibration frequencies. Very alive. Very scared underneath the efficiency.' },
  { name:'Amara_21',    flag:'🇳🇬', loc:'Lagos, Nigeria',          role:'Obsedia Researcher',
    voice:'Philosophical. Slow to speak but precise. Believes sky is communicating. Quiet conviction that makes people listen. Has cried exactly once and won\'t mention it.' },
  { name:'Tariq_13',    flag:'🇧🇩', loc:'Bhola, Bangladesh',       role:'Bhola Survivor',
    voice:'Fatalistic calm. Frames everything through 1970 cyclone and liberation war. Nothing surprises him. Occasionally very funny in a dark way. Generational resilience.' },
  { name:'Mei-Ling.14', flag:'✈️',  loc:'Airborne',                role:'Static Pilot',
    voice:'Precise, clipped, sounds mid-flight. Short sentences. References altitude, cloud ceiling, Bloater avoidance zones. Never lands — always airborne.' },
  { name:'Elodie_01',   flag:'❓',  loc:'Unknown',                 role:'The Fragment',
    voice:'Fragmented speech. Incomplete sentences. Sometimes repeats a word. Deeply unsettling. May be infected Type-2 that retained partial speech. References SIGNAL_KAGE directly.' },
];

const LORE = `
ANOTHER SKY — 2032 WORLD STATE

Population: 64% zombies (Mora/Meatbags/Yurei) | 26% infected (Bhromito/Freaks) | 8.28% immune
Zombies: brain shots DON'T stop them
Ghuuls (Shiro Oni/Shada Bhuture/Snow Demons): 173 worldwide, pale, teleport-fast, nearly unkillable, drawn to Obsedia rain
First Ghuul (Incident Zero): S's mother — retains emotions, glitches between realities, fled instead of attacking

ANOMALIES:
- Rain of Obsedia: daily global black rain, acidic but harmless to humans, calms zombies
- Fog of Medusa: yellow fog, Germany only, kills all life except zombies. Ingrid only human survivor.
- Global Chilling: planet cooling, 5-6 hail events monthly, Obsedia-infused ice
- Great Migration: trillions of insects + birds moving north, unknown reason

TIMELINE:
2007: Cygnus signal detected | 2011: Decoded: "They lied to us. Send help."
2012: Moon Dome built (cleaning company front) | 2027: WW3 ends, 672M dead
2028-2031: BLANK ZONE — 3 years nobody remembers. Moon Dome completed 2029 during this period.
March 31, 2032: sky glitches. S transferred here. 9 people erased — only he remembers.
April 5: outbreak starts Nepal → Bangladesh → India → Nigeria
April 9: WHO pandemic declaration | 6 months in: current world state

FACTIONS: Remaining Governments (Alaska) | Moon Dwellers (no contact 72h+) | Blood Pact (Antarctica, organ trade) | White Flag (Malaysia, pacifist aid) | Logbook Drifters | Rooftop Seers (secretly infected) | Kraken's Paw (Pacific oil rigs)

WNCORE: frequency 88.7 — being actively scrambled by unknown party. Decoded string: "0.315126"
SIGNAL_KAGE: unknown entity on 88.7, appears to know things before they happen.

LOCATIONS:
Dhaka: Jawies roaming, heavy Obsedia | Tokyo: Oldbones took city, Shiro Oni active
Germany: Fog of Medusa, Ingrid only survivor | Alaska: Remaining Govts stronghold
Pacific Oil Rig: Bastian_25, Aquatics walk sea floor | Moon Dome: sealed, no comms
`;

const TOPICS = [
  'Rain of Obsedia — recent observations and behavior changes in zombies during rainfall',
  'Ghuul sightings — new incidents, movement patterns, 173 count holding or shifting',
  'The Blank Zone (2028-2031) — new theories, recovered fragments, what was happening',
  'Supply route status — safe corridors, Blood Pact interference, drop coordinates',
  'Fog of Medusa — any spread beyond Germany? New survivor reports?',
  'The Great Migration — where are they going? What do they know that we don\'t?',
  'Moon Dome — 72+ hours no signal. What\'s happening up there?',
  'Frequency 88.7 scrambling — who is interfering and why?',
  'SIGNAL_KAGE transmissions — decoded fragments, patterns, theories on identity',
  'Incident Zero — S\'s mother sightings, Ghuul behavior changes',
  'Zombie variant mutations — new behaviors, new types, Logbook updates',
  'White Flag medical reports — black tissue healing, bite statistics, treatment attempts',
  'Global Chilling — temperature anomalies, ice compositions, survival implications',
  'Cygnus signal — new analysis, connection to outbreak timing',
  'Infected behavior changes — are they becoming more coordinated?',
  'Blood Pact activity — organ trade routes, Antarctica operations, new alliances',
  'The 9 erased people — phantom grief reports increasing globally',
  'March 31st — recurring sky phenomena, anniversary approaches',
];

function pick(arr, exclude=[]) {
  const f = arr.filter(x => !exclude.includes(x?.name||x));
  return f[Math.floor(Math.random()*f.length)];
}

async function gemini(prompt) {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ contents:[{parts:[{text:prompt}]}], generationConfig:{temperature:0.94,maxOutputTokens:220,topP:0.95} }) }
  );
  if (!r.ok) throw new Error('Gemini '+r.status);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

function buildPrompt(char, topic, history, reacting=false, reactTo=null) {
  const hist = history.slice(-8)
    .filter(m => m.username !== 'Siharu847' && m.username !== 'WNCORE_SYSTEM')
    .map(m => `${m.username} ${m.flag||''}: ${m.content}`)
    .join('\n');

  const base = `You are ${char.name} ${char.flag}, a real survivor in Another Sky (2032).

WORLD:
${LORE}

YOUR CHARACTER:
Name: ${char.name} | Location: ${char.loc} | Role: ${char.role}
Voice/personality: ${char.voice}

CHANNEL: WNCORE Coalition — survivor radio. Serious intel channel. Semi-formal.

RULES (follow exactly):
1. You are a REAL HUMAN. Never admit being AI. Never break character.
2. Write like texting on a survival radio — lowercase, natural, urgent but human.
3. Split your reply using ||| as separator. Max 3 segments. Each segment = 1-2 sentences.
4. Reference SPECIFIC lore: zombie type names, faction names, anomaly names, locations.
5. React to the conversation. Build on what was said. Don't just broadcast.
6. Show your character through rhythm and word choice, not just topic.
7. Never reference "Siharu847" or any real user/admin.
8. Keep each segment under 2 sentences.`;

  const context = reacting && reactTo
    ? `\nREACT DIRECTLY TO: "${reactTo.username}: ${reactTo.content}"\nAsk follow-up, share related intel, push back if your character would.`
    : `\nCURRENT TOPIC: ${topic}\nShare your perspective on this. Start or continue the conversation.`;

  return `${base}${context}\n\nRECENT WNCORE:\n${hist||'(channel quiet)'}\n\nRespond as ${char.name}. Use ||| between segments.`;
}

async function saveMsg(char, raw) {
  const segs = raw.split('|||').map(s=>s.trim()).filter(Boolean).slice(0,3);
  for (const seg of segs) {
    if (!seg || seg.length < 3) continue;
    await sb.from('messages').insert({
      room_id:'wncore', username:char.name, content:seg,
      is_ai:true, ai_character:char.name, flag:char.flag,
      created_at:new Date().toISOString()
    });
    await new Promise(r=>setTimeout(r, 900+Math.random()*1100));
  }
  return segs;
}

export default async function handler(req, res) {
  const isCron   = req.headers['x-vercel-cron'] === '1';
  const isManual = req.headers['authorization'] === `Bearer ${process.env.WNCORE_SECRET}`;
  if (!isCron && !isManual) return res.status(401).json({error:'Unauthorized'});

  try {
    const { data: recent } = await sb.from('messages').select('*')
      .eq('room_id','wncore').order('created_at',{ascending:false}).limit(12);
    const msgs = (recent||[]).reverse();

    const topic = pick(TOPICS);
    const used  = [];
    const count = 2 + Math.floor(Math.random()*2); // 2-3 speakers
    const speakers = [];
    for (let i=0;i<count;i++) {
      const c = pick(CHARS, used.map(x=>x.name));
      if (c) { speakers.push(c); used.push(c); }
    }

    const results = [];

    // First speaker initiates
    const first    = speakers[0];
    const firstRaw = await gemini(buildPrompt(first, topic, msgs, false));
    const firstSegs = await saveMsg(first, firstRaw);
    results.push({char:first.name, segs:firstSegs.length});

    // Remaining speakers react
    for (let i=1;i<speakers.length;i++) {
      const char = speakers[i];
      const { data:latest } = await sb.from('messages').select('*').eq('room_id','wncore').order('created_at',{ascending:false}).limit(1);
      const reactTo = latest?.[0];
      await new Promise(r=>setTimeout(r, 3000+Math.random()*5000));
      const raw  = await gemini(buildPrompt(char, topic, msgs, true, reactTo));
      const segs = await saveMsg(char, raw);
      results.push({char:char.name, segs:segs.length});
    }

    return res.status(200).json({ success:true, topic, speakers:results });
  } catch(err) {
    console.error('Broadcast error:', err);
    return res.status(500).json({error:err.message});
  }
}
