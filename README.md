````markdown
# Quaker City Roleplay — Contraband System

This repository contains a full static frontend and a Node.js + Express backend to run a contraband market dashboard themed for "Quaker City Roleplay". The frontend can be hosted on GitHub Pages and the backend on Render.com (or any Node hosting).

Project structure (top-level):
- index.html
- style.css
- script.js
- /assets
  - logo.png
  - click.mp3
  - notify.mp3
- /backend
  - server.js
  - package.json
  - drops.json
  - prices.json
  - api_keys.json (created at runtime)

Features
- Frontend visually mirrors the Killadelphia Contraband System layout but rebranded for Quaker City Roleplay.
- Dark Blue (#001f3f), Red (#e60000), White theme.
- Admin login (POST /admin/login) with hardcoded credentials:
  - username: `admin`
  - password: `quakerfm`
- Admin receives an API key which can be used to update drop weights.
- Drop weights stored in backend/drops.json (editable via API).
- Discord webhook logging via POST /log (set DISCORD_WEBHOOK_URL).
- Dynamic mock prices via GET /prices.
- Server uptime via GET /uptime.
- CORS enabled and server binds to process.env.PORT.

Frontend
- index.html, style.css, script.js.
- Settings panel:
  - Backend URL (enter your Render.com backend URL e.g. `https://qcr-backend.onrender.com`)
  - API Key (stored in localStorage)
- Sounds on button clicks (assets/click.mp3 and assets/notify.mp3).
- Live price updates (polls backend every 5s).
- Uptime indicator.

Backend (Express)
- Endpoints:
  - POST /admin/login
    - Request: { username, password }
    - Returns: { apiKey }
  - GET /drops
    - Returns: { drops: [...] }
  - POST /drops/update
    - Headers: x-api-key: <API_KEY>
    - Body: { drops: [...] }
  - POST /log
    - Body: { message: "..." } => forwarded to Discord webhook URL in DISCORD_WEBHOOK_URL
  - GET /prices
    - Returns dynamic mock prices
  - GET /uptime
    - Returns current process uptime (seconds)

How to run locally (backend)
1. cd backend
2. Install dependencies:
   npm install
3. (Optional) Set environment variables:
   - DISCORD_WEBHOOK_URL=your_discord_webhook_url
   - PORT=3000
   On Linux/Mac:
     export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
     export PORT=3000
4. Start server:
   npm start
5. The backend will run on http://localhost:3000 by default.

How to use frontend locally
- You can open index.html directly in your browser. For full API functionality:
  - Set the Backend URL in the Admin panel (e.g. http://localhost:3000).
  - Use Admin -> Login to POST credentials and receive an API key.
  - Save the API key, unlock admin features, edit weights and save.

Deploying frontend to GitHub Pages
1. Commit the repository to a GitHub repo.
2. In repository settings -> Pages:
   - Source: Deploy from branch `main` (root)
   - Save. GitHub Pages will serve index.html at `https://<username>.github.io/<repo>/`
3. Ensure your backend is hosted on a publicly accessible URL (see Render below). Enter that URL in the frontend's Admin -> Backend URL.

Deploying backend to Render.com (free tier)
1. Create a new Web Service on Render.
2. Link to this repo and point the build command to `npm install` and start command to `npm start`.
3. Set environment variables in Render:
   - DISCORD_WEBHOOK_URL (optional)
4. Render will assign a URL such as `https://your-service.onrender.com`.
5. Use that URL in the frontend's Backend URL setting.

Security notes
- Admin credentials are hardcoded for convenience. For production, replace with a proper auth mechanism.
- API keys are simple UUIDs stored in a local file. Rotate or persist to a database for production.
- The Discord webhook URL is read from an environment variable and forwarded as-is — do not share it publicly.

Files you may want to replace
- assets/logo.png — replace with your official logo
- assets/click.mp3 / assets/notify.mp3 — replace with real audio clips

Support
If you need adjustments (additional endpoints, authentication improvements, or front-end tweaks) — edit the files or open an issue.

Enjoy,
Quaker City Roleplay DevOps
````