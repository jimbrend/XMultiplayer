# 𝕏 Multiplayer + History Dashboard

Track every post you see on 𝕏. Multiplayer feed sharing with friends anywhere in the world. X character to --->  𝕏 logo replacement with more features (WIP). Raindrop.io integration.

---

## Quick Start Options: download and then open to run it.  Optionally clone from terminal or run from terminal too after opening the extension...

### 1 — Installation

1. Clone or save this repo as **`x-multiplayer`** (folder name matters for the open-dashboard helper).
2. `chrome://extensions/` → enable **Developer mode**
3. **Load unpacked** → select `x-multiplayer/extension/`
4. Browse `x.com` — posts you dwell on 600ms+ are logged automatically
5. **Open Dashboard** in the extension popup → choose **macOS / Linux / Windows** to locate `x-multiplayer/dashboard/index.html`

### 2 — Start the Dashboard (required for full features)

The dashboard **imports your seen history** from the extension when the local server is running:

```bash
cd x-multiplayer
node server.js
# → http://localhost:3000
```

Open **http://localhost:3000** in Chrome (same browser as the extension) — the **multiplayer tutorial** starts automatically on first launch.

**Troubleshooting:** If you only see demo posts, reload the extension at `chrome://extensions`, browse **x.com** for a few seconds, then refresh `localhost:3000`. Turn **Tutorial ON** (top right) to replay the walkthrough.

Or open **`/path-where-you-downloaded-X-Multiplayer-replace-this-to-launch-it/x-multiplayer/dashboard/index.html`** (replace the prefix with your real folder). The extension **Open Dashboard** panel has **Copy** for `node server.js`, links to [source on GitHub](https://github.com/jimbrend/XMultiplayer), and **macOS / Linux / Windows** buttons to open `index.html` in a new tab.

---

## Multiplayer — Getting Two People Connected

The dashboard has a **Connection Settings** panel inside the Multiplayer tab. Click it to expand.

### Option A: PartyKit (recommended — free, cross-internet)

**Deploy once, use forever:**

```bash
npm install -g partykit
npx partykit login          # free account, no credit card
npx partykit deploy         # deploys partykit-server.ts
```

After deploy, PartyKit gives you a URL like:
`x-multiplayer-relay.YOUR_USERNAME.partykit.dev`

1. Open `dashboard/dashboard.js`, set `PARTYKIT_HOST` to your URL
2. In the dashboard → Multiplayer → Connection Settings → click **PartyKit** to turn it ON (indicator turns green)
3. Create a room → copy the invite link → send to friend
4. Friend opens the link, enters their handle, clicks Join
5. Both feeds appear side by side in real time ✓

### Option B: Local Relay (same network — home wifi, LAN)

No deploy needed. Both people must be on the same network.

```bash
node local-relay.js
# WebSocket running at ws://localhost:8080
```

1. Find your LAN IP: `ifconfig` (Mac/Linux) or `ipconfig` (Windows)
2. In Connection Settings → **Local Relay** → enter `YOUR_LAN_IP:8080` → turn ON
3. Your friend opens the dashboard at `http://YOUR_LAN_IP:3000`
4. Same room code flow as above ✓

### Option C: Custom WSS

Point at any WebSocket server. Enter the `wss://` URL in Connection Settings → Custom WSS.
`local-relay.js` deployed to a public VPS (Railway, Fly.io, Render) works perfectly here.

---

## Invite Links

When you create a room, the dashboard generates a shareable link:
```
http://localhost:3000?join=ABC123
```
When your friend opens this link, the room code is pre-filled. They just enter their handle and click Join.

**For cross-internet invites**, replace `localhost:3000` with wherever you're hosting the dashboard (e.g. a shared hosting URL or ngrok tunnel).

---

## Other Relay Options (on roadmap), including standalone application and 𝕏 auth 

See `roadmap.md` and the **Other Options** tabs inside Connection Settings for:
- **Cloudflare Workers + Durable Objects** — global edge, free tier
- **Supabase Realtime** — adds a database for persistent history
- **PeerJS WebRTC** — true P2P, no relay for data once connected

None of these have API keys in source yet. See `roadmap.md` for implementation notes and placeholders.

## Keet (coming soon)

[Keet](https://docs.trykeet.com/overview/introduction) — authenticated APIs for 𝕏 (connect via Keet Link, act on users’ behalf). Open the **🔗 Keet** tab in the dashboard; the enable toggle is **Coming soon** until `KEET_ENABLED` is wired up. See `roadmap.md` and `dashboard/keet-scaffold.js`.

---

## File Structure

```
x-multiplayer/
├── extension/
│   ├── manifest.json       Chrome extension config (Manifest V3)
│   ├── content.js          Logo replacement + feed tracking
│   ├── background.js       Service worker
│   ├── popup.html/js       Extension popup
│   └── logo.svg            𝕏 logo
├── dashboard/
│   ├── index.html          Full dashboard UI
│   └── dashboard.js        All logic — relay, multiplayer, raindrop
├── partykit-server.ts      PartyKit relay server (deploy with npx partykit deploy)
├── partykit.json           PartyKit config
├── local-relay.js          Local WebSocket relay (node local-relay.js)
├── server.js               Static file server for dashboard
├── roadmap.md              Planned features + integration placeholders
├── dashboard/keet-scaffold.js  Keet API examples (not loaded yet)
└── README.md
```

---

## Contributing / Forking

Source on GitHub:
**https://github.com/jimbrend/XMultiplayer**

To add a relay option: implement `connectWebSocket()` in `dashboard.js`, add a toggle card to the Connection Settings panel in `index.html`, deploy steps to `README.md`, and update `roadmap.md`.

To add a Raindrop feature: find `handleRdAction()` in `dashboard.js`, replace the demo `toast()` with real `fetch()` calls to `https://api.raindrop.io/rest/v1/raindrop`.

All API key placeholders are at the top of `dashboard.js`.

---

## Privacy

All data stays in `chrome.storage.local` and browser `localStorage`. Nothing leaves your machine unless you:
- Turn on a WebSocket relay (tweet metadata is broadcast to your room partner only)
- Enter a Raindrop API token (then liked/bookmarked posts sync to your Raindrop account)

WebSocket connections use WSS (TLS encrypted). Room codes are ephemeral and not stored server-side beyond the session.

---

## Keyboard Shortcut

**Alt + X** on any x.com page → opens the dashboard in a new tab.
