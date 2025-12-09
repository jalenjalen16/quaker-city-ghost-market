/*
  Frontend behavior for Quaker City Roleplay Contraband System
  - Fetches prices, uptime, drops from backend
  - Provides admin login to retrieve API key
  - Allows editing drop weights when admin unlocked
  - Plays sounds on button clicks
*/

const DEFAULT_BACKEND = ''; // empty default: user should set backend URL in settings

// ---------- Utilities ----------
const qs = sel => document.querySelector(sel);
const qsa = sel => document.querySelectorAll(sel);

const playSound = (elId) => {
  const el = qs(`#${elId}`);
  if (!el) return;
  el.currentTime = 0;
  const promise = el.play();
  if (promise && promise.catch) promise.catch(() => {
    // if audio can't play (autoplay policy), ignore
  });
};

const el = id => qs(id);

// ---------- State ----------
let backendUrl = localStorage.getItem('qcr_backend') || DEFAULT_BACKEND;
let apiKey = localStorage.getItem('qcr_api_key') || '';
let prices = {};
let drops = [];
let items = [
  { id: "cigs", name: "Contraband Cigarettes", thumb: "CIG" },
  { id: "weed", name: "Street Weed", thumb: "WEED" },
  { id: "pills", name: "Prescription Pills", thumb: "PILL" },
  { id: "weap", name: "Illegal Firearm", thumb: "GUN" },
  { id: "chips", name: "Counterfeit Chips", thumb: "CHP" },
  { id: "gold", name: "Illicit Gold", thumb: "GOLD" }
];

// ---------- DOM Elements ----------
const itemsGrid = el('#items-grid');
const pricesList = el('#prices-list');
const pricesUpdated = el('#prices-updated');
const uptimeEl = el('#uptime');
const logList = el('#log-list');
const backendInput = el('#backend-url');
const apiKeyInput = el('#api-key-input');
const btnLogin = el('#btn-login');
const btnUnlock = el('#btn-unlock');
const adminOnly = el('#admin-only');
const weightsEditor = el('#weights-editor');
const btnSaveWeights = el('#btn-save-weights');
const btnSimulateDrop = el('#btn-simulate-drop');
const btnRefreshPrices = el('#btn-refresh-prices');
const btnSettings = el('#btn-settings');
const yearEl = el('#year');

yearEl.textContent = new Date().getFullYear();
backendInput.value = backendUrl;
apiKeyInput.value = apiKey;
if (apiKey) showAdmin(true);

// ---------- Helper functions ----------
function logActivity(text, kind='info'){
  const node = document.createElement('div');
  node.className = 'log-item';
  node.textContent = `[${new Date().toLocaleTimeString()}] ${text}`;
  logList.prepend(node);
  // send to backend webhook (non-blocking)
  if (backendUrl) {
    fetch(`${backendUrl.replace(/\/$/, '')}/log`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ message: text })
    }).catch(()=>{});
  }
}

function backend(path){
  const base = (backendInput.value || backendUrl || '').replace(/\/$/, '');
  if (!base) return null;
  return `${base}${path}`;
}

// ---------- Rendering ----------
function renderItems(){
  itemsGrid.innerHTML = '';
  items.forEach(it => {
    const node = document.createElement('div');
    node.className = 'item';
    node.innerHTML = `
      <div class="thumb">${it.thumb}</div>
      <div class="meta">
        <h4>${it.name}</h4>
        <p>Market price: <span class="price-val" data-id="${it.id}">--</span></p>
      </div>
      <div class="actions">
        <button class="small btn buy" data-id="${it.id}">Buy</button>
        <button class="small btn ghost drop" data-id="${it.id}">Drop</button>
      </div>
    `;
    itemsGrid.appendChild(node);
  });

  // attach listeners
  qsa('.buy').forEach(b=>{
    b.addEventListener('click', (e)=>{
      playSound('audio-click');
      const id = e.currentTarget.dataset.id;
      const price = prices[id]?.toFixed?.(2) ?? 'N/A';
      logActivity(`Bought ${id} for $${price}`);
      playSound('audio-notify');
    });
  });
  qsa('.drop').forEach(b=>{
    b.addEventListener('click', async (e)=>{
      playSound('audio-click');
      const id = e.currentTarget.dataset.id;
      await simulateDrop(); // also triggers logs
    });
  });
}

function renderPrices(){
  pricesList.innerHTML = '';
  Object.keys(prices).forEach(key=>{
    const val = prices[key];
    const row = document.createElement('div');
    row.className = 'price-row';
    row.innerHTML = `<div class="price-name">${key.toUpperCase()}</div><div class="price-value">$${val.toFixed(2)}</div>`;
    pricesList.appendChild(row);
  });
  // update price in items grid
  qsa('.price-val').forEach(el=>{
    const id = el.dataset.id;
    if (prices[id]) el.textContent = `$${prices[id].toFixed(2)}`;
  });
  pricesUpdated.textContent = new Date().toLocaleTimeString();
}

// ---------- API Calls ----------
async function fetchPrices(){
  const url = backend('/prices');
  if (!url) return;
  try{
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch prices');
    const data = await res.json();
    // data expected: { prices: { id: value, ... }, timestamp }
    prices = data.prices || {};
    renderPrices();
  }catch(err){
    logActivity('Unable to fetch prices: '+err.message);
  }
}

async function fetchUptime(){
  const url = backend('/uptime');
  if (!url) return;
  try{
    const res = await fetch(url);
    if (!res.ok) throw new Error('uptime failed');
    const data = await res.json();
    uptimeEl.textContent = Math.floor(data.uptime || 0);
  }catch(err){
    uptimeEl.textContent = '--';
  }
}

async function fetchDrops(){
  const url = backend('/drops');
  if (!url) {
    // fallback: local default
    drops = [
      { id: 'cigs', weight: 30 },
      { id: 'weed', weight: 25 },
      { id: 'pills', weight: 18 },
      { id: 'weap', weight: 10 },
      { id: 'chips', weight: 10 },
      { id: 'gold', weight: 7 }
    ];
    renderWeightsEditor();
    return;
  }
  try{
    const res = await fetch(url);
    if (!res.ok) throw new Error('drops fetch failed');
    const data = await res.json();
    drops = data.drops || [];
    renderWeightsEditor();
  }catch(err){
    logActivity('Unable to fetch drops: '+err.message);
  }
}

// Simulate drop using weights returned from backend
async function simulateDrop(){
  await fetchDrops();
  if (!drops || !drops.length) {
    logActivity('No drops configured.');
    return;
  }
  const total = drops.reduce((s,i)=>s+(i.weight||0),0);
  let r = Math.random()*total;
  let chosen = drops[0];
  for (const d of drops){
    r -= (d.weight||0);
    if (r <= 0){
      chosen = d;
      break;
    }
  }
  logActivity(`Simulated Drop -> ${chosen.id} (weight ${chosen.weight})`);
  playSound('audio-notify');
}

// Admin login
async function adminLogin(){
  const url = backend('/admin/login');
  if (!url) {
    alert('Set backend URL in Admin panel first.');
    return;
  }
  const username = prompt('Admin username (hint: admin)');
  const password = prompt('Admin password (hint: quakerfm)');
  if (!username || !password) return;
  try{
    const res = await fetch(url, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username, password })
    });
    if (!res.ok){
      const txt = await res.text();
      throw new Error(txt || 'Login failed');
    }
    const data = await res.json();
    apiKey = data.apiKey;
    localStorage.setItem('qcr_api_key', apiKey);
    apiKeyInput.value = apiKey;
    showAdmin(true);
    logActivity('Admin logged in and API key stored locally.');
  }catch(err){
    alert('Login failed: '+err.message);
  }
}

// Save weights (admin)
async function saveWeights(){
  if (!apiKey) {
    alert('Unlock admin features first.');
    return;
  }
  const payload = { drops: drops };
  const url = backend('/drops/update');
  if (!url) {
    alert('Backend URL is required.');
    return;
  }
  try{
    const res = await fetch(url, {
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok){
      const txt = await res.text();
      throw new Error(txt || 'save failed');
    }
    const data = await res.json();
    logActivity('Weights saved to backend.');
    await fetchDrops();
  }catch(err){
    alert('Failed to save weights: '+err.message);
  }
}

// Render the editable weights in admin panel
function renderWeightsEditor(){
  weightsEditor.innerHTML = '';
  drops.forEach(d=>{
    const row = document.createElement('div');
    row.className = 'weight-row';
    row.innerHTML = `
      <div class="w-name">${d.id.toUpperCase()}</div>
      <input type="number" min="0" step="1" class="w-input" data-id="${d.id}" value="${d.weight}" />
    `;
    weightsEditor.appendChild(row);
  });
  // attach change events
  qsa('.w-input').forEach(inp=>{
    inp.addEventListener('change', (e)=>{
      const id = e.currentTarget.dataset.id;
      const val = Number(e.currentTarget.value) || 0;
      const idx = drops.findIndex(x=>x.id===id);
      if (idx>=0) drops[idx].weight = val;
    });
  });
}

// Unlock admin features by entering API key
function showAdmin(force=false){
  const key = apiKeyInput.value || apiKey || localStorage.getItem('qcr_api_key');
  if (force) apiKey = key;
  if (key){
    apiKey = key;
    localStorage.setItem('qcr_api_key', apiKey);
    adminOnly.classList.remove('hidden');
    renderWeightsEditor();
  } else {
    adminOnly.classList.add('hidden');
  }
}

// ---------- Events ----------
btnSettings.addEventListener('click', ()=>{
  document.querySelector('.admin-panel').scrollIntoView({behavior:'smooth', block:'center'});
  playSound('audio-click');
});

btnRefreshPrices.addEventListener('click', async ()=>{
  playSound('audio-click');
  await fetchPrices();
});

btnSimulateDrop.addEventListener('click', async ()=>{
  playSound('audio-click');
  await simulateDrop();
});

btnLogin.addEventListener('click', async ()=>{
  playSound('audio-click');
  await adminLogin();
});

btnUnlock.addEventListener('click', ()=>{
  playSound('audio-click');
  showAdmin(true);
});

btnSaveWeights.addEventListener('click', async ()=>{
  playSound('audio-click');
  await saveWeights();
});

// update backend url when changed
backendInput.addEventListener('change', ()=>{
  backendUrl = backendInput.value;
  localStorage.setItem('qcr_backend', backendUrl);
  logActivity('Backend URL updated.');
});

// manual api key input store
apiKeyInput.addEventListener('change', ()=>{
  apiKey = apiKeyInput.value;
  localStorage.setItem('qcr_api_key', apiKey);
  showAdmin(true);
});

// ---------- Init ----------
renderItems();
fetchDrops();
fetchPrices();
fetchUptime();
setInterval(fetchPrices, 5000); // live price updates every 5 seconds
setInterval(fetchUptime, 5000);

// initial logs
logActivity('Frontend initialized.');
