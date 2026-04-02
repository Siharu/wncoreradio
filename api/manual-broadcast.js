import broadcastHandler from './wncore-broadcast.js';

export default async function handler(req, res) {
  // Optional: add a secret so only you can trigger it
  const auth = req.headers['authorization'];
  if (auth !== `Bearer ${process.env.WNCORE_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await broadcastHandler(
      { headers: { 'x-vercel-cron': '1' } }, // mimic cron
      res
    );
  } catch (err) {
    console.error('Manual trigger error:', err);
    return res.status(500).json({ error: err.message });
  }
}
