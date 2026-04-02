// api/lore-manager.js — Centralized lore management
// Serves lore items to both ticker.js and broadcast systems
// Allows adding/updating lore dynamically from admin panel

import { createClient } from '@supabase/supabase-js';

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

// Lore categories for organization
const LORE_CATEGORIES = {
  'WNCORE_BROADCAST': 'Ticker & broadcasts',
  'ANOMALY_REPORT': 'Environmental anomalies',
  'VARIANT_ALERT': 'Zombie variant data',
  'SUPPLY_DROP': 'Supply broadcast',
  'FACTION_NEWS': 'Faction updates',
  'SIGNAL_INTERCEPT': 'Frequency 88.7 content',
  'BLANK_ZONE': 'Blank Zone theories',
  'PLAYER_EVENT': 'Custom event/story',
};

// Default lore items (fallback if DB is unavailable)
const DEFAULT_LORE = [
  { id: 1, category: 'WNCORE_BROADCAST', content: '⚠ WNCORE BROADCAST — Rain of ████████ reported over Japan, UK, Russia, Bangladesh, Nepal, Bhutan, Australia, Singapore, India, UAE — 3rd consecutive day. Signal loss in non-WNCORE sectors; global blackout in effect.', active: true, created_at: new Date().toISOString() },
  { id: 2, category: 'SIGNAL_INTERCEPT', content: '📡 SIGNAL DETECTED — Frequency 88.7 intermittent. Decoded transmission (2011) re-looping: "THEY LIED TO US. SEND HELP. ANY WAY POSSIBLE. NO MATTER WHO IS OUT THERE."', active: true, created_at: new Date().toISOString() },
  { id: 3, category: 'ANOMALY_REPORT', content: '❗ CRITICAL ALERT — Unknown yellow ████ spreading beyond German borders. Contact renders water supplies toxic; fatal to all fauna and humans. Maintain 30m minimum distance from low-altitude smoke.', active: true, created_at: new Date().toISOString() },
  { id: 4, category: 'VARIANT_ALERT', content: '☣ VARIANT IDENTIFIED — "████████ ZERO" variant spotted in South Asian sectors. High-speed movement confirmed between ████████ zones. Origin: unknown.', active: true, created_at: new Date().toISOString() },
  { id: 5, category: 'ANOMALY_REPORT', content: '❄ GLOBAL CHILLING — Rapid temperature drops recorded across 47 regions. Severe hail warning issued. ████████-infused ice crystals detected in multiple samples.', active: true, created_at: new Date().toISOString() },
];

// Fetch active lore from database
async function fetchActiveLore() {
  try {
    const { data, error } = await sb
      .from('lore_items')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data && data.length > 0 ? data : DEFAULT_LORE;
  } catch (err) {
    console.warn('Lore DB fetch failed, using defaults:', err.message);
    return DEFAULT_LORE;
  }
}

// Save new lore item to database
async function addLoreItem(category, content, author = 'Siharu847') {
  if (!LORE_CATEGORIES[category]) {
    throw new Error(`Invalid category. Valid: ${Object.keys(LORE_CATEGORIES).join(', ')}`);
  }

  if (content.length < 10) {
    throw new Error('Lore content must be at least 10 characters');
  }

  try {
    const { data, error } = await sb.from('lore_items').insert({
      category,
      content,
      author,
      active: true,
      created_at: new Date().toISOString(),
    }).select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (err) {
    console.error('Add lore error:', err.message);
    throw err;
  }
}

// Toggle lore item active status
async function toggleLore(id, active) {
  try {
    const { data, error } = await sb
      .from('lore_items')
      .update({ active })
      .eq('id', id)
      .select();

    if (error) throw error;
    return data?.[0] || null;
  } catch (err) {
    console.error('Toggle lore error:', err.message);
    throw err;
  }
}

// Delete lore item
async function deleteLore(id) {
  try {
    const { error } = await sb.from('lore_items').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Delete lore error:', err.message);
    throw err;
  }
}

// Get lore by category
async function getLoreByCategory(category) {
  try {
    const { data, error } = await sb
      .from('lore_items')
      .select('*')
      .eq('category', category)
      .eq('active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (err) {
    console.warn(`Get lore by category failed (${category}):`, err.message);
    return [];
  }
}

// GET: Handle GET requests
export async function handleGet(req, res) {
  const { category, action } = req.query;

  try {
    if (action === 'categories') {
      return res.status(200).json(LORE_CATEGORIES);
    }

    if (category) {
      const lore = await getLoreByCategory(category);
      return res.status(200).json(lore);
    }

    const lore = await fetchActiveLore();
    return res.status(200).json(lore);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// POST: Add new lore
export async function handlePost(req, res) {
  const { category, content, author } = req.body;

  if (!category || !content) {
    return res.status(400).json({ error: 'Missing category or content' });
  }

  try {
    const item = await addLoreItem(category, content, author || 'Anonymous');
    return res.status(201).json({ success: true, item });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}

// PUT: Update lore (toggle active)
export async function handlePut(req, res) {
  const { id, active } = req.body;

  if (!id || active === undefined) {
    return res.status(400).json({ error: 'Missing id or active status' });
  }

  try {
    const item = await toggleLore(id, active);
    return res.status(200).json({ success: true, item });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// DELETE: Remove lore
export async function handleDelete(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Missing id' });
  }

  try {
    await deleteLore(id);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Main handler
export default async function handler(req, res) {
  const { method } = req;

  try {
    if (method === 'GET') return handleGet(req, res);
    if (method === 'POST') return handlePost(req, res);
    if (method === 'PUT') return handlePut(req, res);
    if (method === 'DELETE') return handleDelete(req, res);

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Lore manager error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Export for use in other API files
export { fetchActiveLore, addLoreItem, getLoreByCategory };
