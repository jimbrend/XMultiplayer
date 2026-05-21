# 𝕏 History — Roadmap & Integration Plans

This file tracks planned features and integration options.
PRs welcome — see **Contributing** section at the bottom.

---

## 🔌 Multiplayer Relay Options

### ✅ Implemented
- **localStorage relay** — same browser/machine only. Zero setup, works out of the box.
- **Local WebSocket relay** (`local-relay.js`) — same network (LAN/home wifi). Run `node local-relay.js`, share your IP.
- **PartyKit** (`partykit-server.ts`) — cross-internet, free tier. Deploy once with `npx partykit deploy`.

### 🗺️ On Roadmap (no API key in source yet)

#### Cloudflare Workers + Durable Objects
- **Pros:** Global edge network (~0ms latency), generous free tier (100k req/day), no server to manage, Durable Objects give persistent room state
- **Cons:** Requires Cloudflare account, slightly more complex deploy than PartyKit, Durable Objects need paid plan for production scale
- **Placeholder:** `// TODO: CF_WORKER_URL = 'wss://x-history.YOUR_SUBDOMAIN.workers.dev'`
- **Implementation:** Replace `connectWebSocket()` relay URL in `dashboard.js` with your Worker URL

#### Supabase Realtime
- **Pros:** Free tier, adds a real database (persist history server-side, user accounts), excellent JS SDK, built-in auth
- **Cons:** More setup than PartyKit, slight latency vs edge workers, requires Supabase account
- **Placeholder:** `// TODO: SUPABASE_URL = '' and SUPABASE_ANON_KEY = ''`
- **Implementation:** Replace WebSocket calls in `dashboard.js` with `supabase.channel(roomCode).on('broadcast', ...)` 

#### Self-hosted Node.js (`local-relay.js` extended)
- **Pros:** Full control, no vendor, can run on a $5 VPS (Railway, Fly.io, Render free tier)
- **Cons:** You maintain it, need a server with a public IP
- **Placeholder:** `// TODO: SELF_HOSTED_RELAY_URL = 'wss://your-vps.example.com:8080'`
- **Deploy:** `node local-relay.js` on any public VPS, point dashboard at it

#### PeerJS (WebRTC P2P)
- **Pros:** Truly peer-to-peer (no relay server once connected), very low latency, free PeerJS cloud signaling
- **Cons:** Needs signaling server for initial handshake, NAT traversal can fail (~10% of connections), more complex setup
- **Placeholder:** `// TODO: PEERJS_KEY = '' — get free key at peerjs.com`
- **Implementation:** Replace WebSocket transport in `connectWebSocket()` with `new Peer(roomCode, { key: PEERJS_KEY })`

---

## 💧 Raindrop.io Integration

All features below are demoed in the Raindrop tab. Real API calls require a token from https://app.raindrop.io/settings/integrations

- **Auto-save liked posts** → `POST https://api.raindrop.io/rest/v1/raindrop` with collection "X Likes"
- **Auto-save bookmarks** → same endpoint, collection "X Bookmarks"  
- **Full history export** → batch create via `POST https://api.raindrop.io/rest/v1/raindrops`
- **AI tagging** → pipe each post through Claude API before saving → add `tags[]` to Raindrop payload
- **Broken link scanner** → `GET https://api.raindrop.io/rest/v1/raindrops/{collectionId}` + check tweet URLs
- **Daily digest** → scheduled job (cron or browser alarm) → create Raindrop collection with date title
- **Multiplayer shared collection** → both users write to same Raindrop collection ID
- **Per-author collections** → extract handle → find/create matching Raindrop collection

**Placeholder in source:** `const RAINDROP_API_KEY = ''; // TODO: add your token`

---

## 🔗 Keet — Authenticated 𝕏 API ([docs](https://docs.trykeet.com/overview/introduction))

[Keet](https://docs.trykeet.com/overview/introduction) provides APIs for sites that do not expose public APIs — including **𝕏**. Users connect accounts via Keet Link (no Chrome extension required for your end users); Keet maintains authenticated sessions so your app can act on their behalf.

### 🗺️ Coming soon (scaffold in dashboard — toggle disabled)

Planned capabilities for this project:

- **Connect 𝕏 via Keet Link** — replace or supplement extension-only tracking with server-side session access
- **Sync timeline / likes / bookmarks** — pull history into the dashboard without scraping x.com in-browser
- **Post on behalf of user** — e.g. `keetClient.integrations.x.post("…")` for digest or multiplayer highlights
- **Cross-service flows** — same Keet session pattern as LinkedIn, Instagram, etc. (see [supported integrations](https://docs.trykeet.com/overview/introduction))

**Placeholder in source:** `const KEET_API_KEY = ''; // TODO: from Keet dashboard`

**Scaffold files:**

- `dashboard/dashboard.js` — `setupKeet()`, `connectKeet()`, `syncKeetXHistory()` (stubs; UI toggle shows **Coming Soon**)
- `dashboard/keet-scaffold.js` — commented client examples for when the integration ships

**Implementation notes:**

1. Add Keet API key at top of `dashboard.js` (never commit real keys)
2. Wire Keet Link component for OAuth-style account linking
3. Map Keet 𝕏 responses into existing `allTweets` / history storage shape
4. Enable the **Keet** header tab toggle once `connectKeet()` is implemented

---

## 🤖 AI Features (Claude API)

- **Auto-summarize posts** — 1-sentence digest of long threads
- **Topic clustering** — group your history by inferred topic (tech, finance, humor, etc.)
- **"Read later" prioritization** — score posts by estimated reading value
- **Weekly personal digest** — Claude writes a narrative summary of your week on 𝕏

**Placeholder:** `const CLAUDE_API_KEY = ''; // TODO: add Anthropic API key`

---

## 🔧 Other Planned Features

- [ ] Firefox extension support (manifest v2 compat layer)
- [ ] Safari extension (using Safari Web Extension Converter)
- [ ] Export to Notion / Obsidian markdown
- [ ] Per-user Raindrop collections in multiplayer mode
- [ ] Keyboard shortcuts (navigate history, open tweet, toggle filter)
- [ ] Dark/light theme toggle
- [ ] Tweet image/media capture in history
- [ ] Browser alarm API for scheduled Raindrop sync

---

## 🤝 Contributing

Source code lives here — fork, PR, or open issues:

> **[github.com/jimbrend/XMultiplayer](https://github.com/jimbrend/XMultiplayer)**

### To add a relay option:
1. Implement `connectWebSocket(url)` and `disconnectWebSocket()` in `dashboard.js`
2. Add your option to the **Connection Settings** panel in `index.html`
3. Add deployment steps to `README.md`
4. Update this roadmap

### To add a Raindrop feature:
1. Find the `handleRdAction()` function in `dashboard.js`
2. Replace the `toast()` demo with a real `fetch()` to the Raindrop API
3. Add your `RAINDROP_API_KEY` placeholder to the top of `dashboard.js`
