/**
 * Quaker City Roleplay - Contraband Backend
 * - Express server exposing:
 *   POST /admin/login       -> returns API key for admin
 *   GET  /drops             -> returns drops list (from drops.json)
 *   POST /drops/update      -> update drops.json (requires API key)
 *   POST /log               -> sends message to Discord webhook (env: DISCORD_WEBHOOK_URL)
 *   GET  /prices            -> returns dynamic mock prices
 *   GET  /uptime            -> returns process uptime in seconds
 *
 * Notes:
 * - Bind to process.env.PORT for hosting (Render.com)
 * - CORS enabled
 * - Drop weights stored in backend/drops.json (editable)
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// Storage files
const DATA_DIR = path.join(__dirname);
const DROPS_FILE = path.join(DATA_DIR, 'drops.json');
const PRICES_FILE = path.join(DATA_DIR, 'prices.json');
const KEYS_FILE = path.join(DATA_DIR, 'api_keys.json');

// Ensure files exist
function ensureFile(filePath, fallback) {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
  }
}
ensureFile(DROPS_FILE, {
  drops: [
    { id: 'cigs', weight: 30 },
    { id: 'weed', weight: 25 },
    { id: 'pills', weight: 18 },
    { id: 'weap', weight: 10 },
    { id: 'chips', weight: 10 },
    { id: 'gold', weight: 7 }
  ]
});
ensureFile(PRICES_FILE, {
  // base prices; server will vary them dynamically
  prices: {
    cigs: 12.00,
    weed: 75.00,
    pills: 45.00,
    weap: 350.00,
    chips: 8.00,
    gold: 1200.00
  },
  lastUpdated: Date.now()
});
ensureFile(KEYS_FILE, { keys: [] });

// Simple in-memory API key store (also persisted)
let apiKeys = JSON.parse(fs.readFileSync(KEYS_FILE)).keys || [];

// helper: persist keys
function persistKeys(){
  fs.writeFileSync(KEYS_FILE, JSON.stringify({ keys: apiKeys }, null, 2));
}

// Admin login endpoint (hardcoded credentials)
// POST /admin/login { username, password } -> { apiKey }
app.post('/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === 'admin' && password === 'quakerfm') {
    const apiKey = uuidv4();
    apiKeys.push(apiKey);
    persistKeys();
    return res.json({ apiKey, message: 'Admin API key generated' });
  } else {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
});

// GET /drops -> returns JSON
app.get('/drops', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DROPS_FILE));
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: 'Unable to read drops' });
  }
});

// POST /drops/update -> requires x-api-key header
app.post('/drops/update', (req, res) => {
  const provided = req.headers['x-api-key'] || req.body.apiKey;
  if (!provided || !apiKeys.includes(provided)) {
    return res.status(401).json({ error: 'Missing or invalid API key' });
  }
  const payload = req.body;
  if (!payload || !Array.isArray(payload.drops)) {
    return res.status(400).json({ error: 'Invalid payload. Expected { drops: [...] }' });
  }
  try {
    fs.writeFileSync(DROPS_FILE, JSON.stringify({ drops: payload.drops }, null, 2));
    return res.json({ success: true, drops: payload.drops });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to save drops' });
  }
});

// POST /log -> forwards to Discord webhook (if configured)
app.post('/log', async (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Missing message' });

  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    // still accept the log but inform that webhook isn't set
    console.log('[LOG]', message);
    return res.json({ success: true, forwarded: false, msg: 'No DISCORD_WEBHOOK_URL set' });
  }

  try {
    const payload = { content: `QCR Log: ${message}` };
    const r = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) {
      return res.json({ success: true, forwarded: true });
    } else {
      return res.status(500).json({ error: 'Failed to forward to Discord', status: r.status });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Webhook request failed', detail: err.message });
  }
});

// GET /prices -> returns dynamic mock prices
app.get('/prices', (req, res) => {
  try {
    const pData = JSON.parse(fs.readFileSync(PRICES_FILE));
    const base = pData.prices || {};
    // simple random walk variation based on time
    const now = Date.now();
    const delta = Math.max(1, Math.floor((now - (pData.lastUpdated || now)) / 1000));
    const newPrices = {};
    Object.keys(base).forEach(k=>{
      let b = base[k];
      // fluctuation: +/- up to 3% per second of delta (capped)
      const maxPct = 0.03;
      const pctChange = (Math.random() * maxPct * 2 - maxPct) * Math.min(delta, 8);
      const newVal = Math.max(0.01, b * (1 + pctChange));
      newPrices[k] = Math.round(newVal * 100) / 100;
    });
    // persist lastUpdated and small smoothing to base for continuity
    pData.prices = newPrices;
    pData.lastUpdated = now;
    try {
      fs.writeFileSync(PRICES_FILE, JSON.stringify(pData, null, 2));
    } catch (e) {
      // ignore persistence errors
    }
    return res.json({ prices: newPrices, timestamp: now });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to generate prices' });
  }
});

// GET /uptime -> returns process uptime in seconds
app.get('/uptime', (req, res) => {
  return res.json({ uptime: Math.floor(process.uptime()) });
});

// Basic health
app.get('/', (req, res) => {
  res.json({ status: 'ok', name: 'qcr-contraband-backend', uptime: Math.floor(process.uptime()) });
});

// Start server
app.listen(PORT, () => {
  console.log(`Quaker City Roleplay backend listening on port ${PORT}`);
});
