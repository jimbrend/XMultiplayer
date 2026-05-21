// ============================================================
// 𝕏 History Dashboard — dashboard.js
// ============================================================
// RELAY CONFIGURATION — fill in your chosen option below.
// Only ONE relay should be active at a time.
// Toggle between them in the Connection Settings panel in the UI.
// ============================================================

// PartyKit (recommended — free, cross-internet)
const PARTYKIT_HOST = 'x-history-relay.YOUR_USERNAME.partykit.dev'; // TODO: replace after deploy

// Local relay (same network — run: node local-relay.js)
const LOCAL_RELAY_HOST = 'localhost:8080';

// Cloudflare Worker (on roadmap — see roadmap.md)
const CF_WORKER_URL = ''; // TODO: wss://x-history.YOUR_SUBDOMAIN.workers.dev

// Supabase (on roadmap — see roadmap.md)
const SUPABASE_URL = '';       // TODO
const SUPABASE_ANON_KEY = '';  // TODO

// Raindrop (demo mode until key added)
const RAINDROP_API_KEY = ''; // TODO: from https://app.raindrop.io/settings/integrations

// ============================================================
// STATE
// ============================================================
let allTweets = [];
let friendTweets = [];
let currentFilter = 'all';
let searchQuery = '';
let mpRoom = null;
let mpConnected = false;
let mpPollInterval = null;
let rdApiKey = RAINDROP_API_KEY;

// WebSocket state
let ws = null;
let wsReconnectTimer = null;
let wsReconnectAttempts = 0;
let activeRelayMode = 'none'; // 'partykit' | 'local' | 'none'
let activeRelayUrl = '';

// ---- LocalStorage keys ----
const LS_HISTORY    = 'xhistory_tweets';
const LS_MP_ROOM    = 'xhistory_mp_room';
const LS_RD_KEY     = 'xhistory_rd_key';
const LS_RELAY_MODE = 'xhistory_relay_mode';
const LS_RELAY_URL  = 'xhistory_relay_url';

// ---- BroadcastChannel (extension → dashboard, same browser) ----
try {
  const bc = new BroadcastChannel('xhistory_channel');
  bc.onmessage = (e) => {
    if (e.data.type === 'NEW_TWEET') handleNewTweet(e.data.data, 'mine');
  };
} catch(e) {}

// ============================================================
// BOOTSTRAP
// ============================================================
document.addEventListener('DOMContentLoaded', init);

function init() {
  loadHistory();
  setupNav();
  setupFilters();
  setupSearch();
  setupMultiplayer();
  setupConnectionSettings();
  setupRaindrop();
  setupClear();
  startLiveSync();

  // Restore saved state
  rdApiKey = localStorage.getItem(LS_RD_KEY) || RAINDROP_API_KEY;
  if (rdApiKey) {
    const el = document.getElementById('rdApiKey');
    if (el) el.value = rdApiKey;
  }

  // Auto-connect relay if previously active
  const savedMode = localStorage.getItem(LS_RELAY_MODE);
  const savedUrl  = localStorage.getItem(LS_RELAY_URL);
  if (savedMode && savedMode !== 'none' && savedUrl) {
    setRelayMode(savedMode, savedUrl, false);
  }

  // Check for ?join= URL param (invite link)
  const params = new URLSearchParams(window.location.search);
  if (params.get('join')) {
    // Switch to multiplayer tab and pre-fill the code
    document.querySelector('[data-page="multiplayer"]').click();
    const joinCodeEl = document.getElementById('mpJoinCode');
    if (joinCodeEl) joinCodeEl.value = params.get('join').toUpperCase();
    document.getElementById('mpJoinBox').style.display = 'block';
    toast('⚡ Invite link detected — enter your handle and click Join', 'mp');
    // Clean up URL
    window.history.replaceState({}, '', window.location.pathname);
  }
}

// ============================================================
// HISTORY LOADING
// ============================================================
function loadHistory() {
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get(['tweetHistory'], (res) => {
      if (res.tweetHistory && res.tweetHistory.length > 0) {
        allTweets = res.tweetHistory;
        localStorage.setItem(LS_HISTORY, JSON.stringify(allTweets));
        document.getElementById('demoBanner').style.display = 'none';
      } else {
        loadFromLocalStorage();
      }
      renderFeed(); updateStats();
    });
  } else {
    loadFromLocalStorage();
  }
}

function loadFromLocalStorage() {
  const saved = localStorage.getItem(LS_HISTORY);
  if (saved) {
    try { allTweets = JSON.parse(saved); } catch(e) { allTweets = []; }
  }
  if (allTweets.length === 0) injectDemoTweets();
  else document.getElementById('demoBanner').style.display = 'none';
}

function injectDemoTweets() {
  allTweets = [
    { id:'d1', author:'Paul Graham', handle:'@paulg', text:'The best startup ideas seem bad at first. If they seemed obviously good, someone would have built them already.', liked:true, bookmarked:false, timestamp:Date.now()-300000 },
    { id:'d2', author:'Andrej Karpathy', handle:'@karpathy', text:'LLMs will change software development more deeply than most people imagine. Not just autocomplete — full intent-understanding systems.', liked:false, bookmarked:true, timestamp:Date.now()-720000 },
    { id:'d3', author:'Naval', handle:'@naval', text:'Specific knowledge cannot be trained for. If society can train you for it, they can replace you with someone cheaper.', liked:true, bookmarked:true, timestamp:Date.now()-1800000 },
    { id:'d4', author:'Lex Fridman', handle:'@lexfridman', text:'Just finished a 6 hour conversation with someone who may be the most interesting mind I have ever spoken with.', liked:false, bookmarked:false, timestamp:Date.now()-3600000 },
    { id:'d5', author:'Sam Altman', handle:'@sama', text:'AGI might be closer than most people think. But the transition period matters just as much as the destination.', liked:true, bookmarked:false, timestamp:Date.now()-7200000 },
  ];
}

// ============================================================
// WEBSOCKET RELAY
// ============================================================
function buildWsUrl(mode, customUrl) {
  if (mode === 'partykit') {
    const host = customUrl || PARTYKIT_HOST;
    return `wss://${host}/party/${mpRoom?.code || 'default'}`;
  }
  if (mode === 'local') {
    const host = customUrl || LOCAL_RELAY_HOST;
    const code = mpRoom?.code || 'default';
    const handle = encodeURIComponent(mpRoom?.myHandle || 'user');
    return `ws://${host}?room=${code}&handle=${handle}`;
  }
  if (mode === 'custom') {
    return customUrl;
  }
  return null;
}

function connectWebSocket(mode, customUrl) {
  disconnectWebSocket();
  const url = buildWsUrl(mode, customUrl);
  if (!url) return;

  activeRelayMode = mode;
  activeRelayUrl = customUrl || '';

  updateRelayStatus('connecting', `Connecting to ${mode}…`);

  try {
    ws = new WebSocket(url);
  } catch(e) {
    updateRelayStatus('error', 'Invalid WebSocket URL');
    return;
  }

  ws.onopen = () => {
    wsReconnectAttempts = 0;
    updateRelayStatus('connected', `${mode === 'partykit' ? 'PartyKit' : mode === 'local' ? 'Local relay' : 'Custom relay'} connected`);
    toast(`⚡ Relay connected (${mode})`, 'mp');
    // Send join event so room knows our handle
    wsSend({ type: 'join', handle: mpRoom?.myHandle || 'user' });
  };

  ws.onmessage = (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    handleWsMessage(msg);
  };

  ws.onclose = (e) => {
    updateRelayStatus('disconnected', 'Disconnected');
    if (mpConnected && wsReconnectAttempts < 5) {
      const delay = Math.min(1000 * Math.pow(2, wsReconnectAttempts), 15000);
      wsReconnectAttempts++;
      updateRelayStatus('reconnecting', `Reconnecting in ${Math.round(delay/1000)}s… (${wsReconnectAttempts}/5)`);
      wsReconnectTimer = setTimeout(() => connectWebSocket(mode, customUrl), delay);
    }
  };

  ws.onerror = () => {
    updateRelayStatus('error', `Connection failed — is the relay running?`);
  };
}

function disconnectWebSocket() {
  clearTimeout(wsReconnectTimer);
  if (ws) {
    ws.onclose = null; // prevent reconnect loop
    ws.close();
    ws = null;
  }
  wsReconnectAttempts = 0;
}

function wsSend(data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function handleWsMessage(msg) {
  if (msg.type === 'tweet' || msg.type === 'catchup') {
    const tweets = msg.type === 'catchup' ? (msg.tweets || []) : [msg];
    tweets.forEach(event => {
      if (!event.data) return;
      const tweet = event.data;
      if (friendTweets.find(t => t.id === tweet.id)) return;
      friendTweets.unshift(tweet);

      const feed = document.getElementById('mpFriendFeed');
      if (feed) {
        const empty = feed.querySelector('.empty-state');
        if (empty) feed.innerHTML = '';
        feed.insertBefore(buildTweetCard(tweet, true), feed.firstChild);
      }
      if (event.handle) {
        document.getElementById('mpFriendColTitle').textContent = event.handle;
        document.getElementById('mpFriendColHandle').textContent = 'live feed';
        document.getElementById('friendDot').className = 'mp-status-dot connected';
      }
    });
    if (msg.type === 'tweet') toast(`Friend saw: ${msg.data?.author || 'a post'}`, 'mp');
  }

  if (msg.type === 'join') {
    toast(`⚡ ${msg.handle} joined the room`, 'mp');
    document.getElementById('mpFriendColTitle').textContent = msg.handle;
    document.getElementById('friendDot').className = 'mp-status-dot connected';
    updateSessionStatus('connected', `Connected with ${msg.handle}`);
  }

  if (msg.type === 'leave') {
    toast(`${msg.handle} left the room`, 'mp');
    document.getElementById('friendDot').className = 'mp-status-dot waiting';
    updateSessionStatus('waiting', 'Friend disconnected — waiting…');
  }

  if (msg.type === 'room_info') {
    updateSessionStatus('connected', msg.message);
  }
}

function broadcastMyTweet(tweet) {
  // WebSocket relay (real cross-internet)
  if (ws && ws.readyState === WebSocket.OPEN) {
    wsSend({ type: 'tweet', handle: mpRoom?.myHandle || 'user', data: tweet });
    return;
  }
  // Fallback: localStorage relay (same machine only)
  const key = `xmp_room_${mpRoom?.code}`;
  const roomData = localStorage.getItem(key);
  if (!roomData) return;
  const room = JSON.parse(roomData);
  const feedKey = mpRoom?.role === 'host' ? 'hostFeed' : 'guestFeed';
  if (!room[feedKey]) room[feedKey] = [];
  room[feedKey].unshift(tweet);
  room[feedKey] = room[feedKey].slice(0, 200);
  localStorage.setItem(key, JSON.stringify(room));
}

// ============================================================
// CONNECTION SETTINGS PANEL
// ============================================================
function setupConnectionSettings() {
  // Relay toggle buttons
  document.querySelectorAll('.relay-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.relay;
      const currentlyActive = btn.classList.contains('relay-active');

      if (currentlyActive) {
        // Turn off
        setRelayMode('none', '', true);
      } else {
        // Turn on
        let customUrl = '';
        if (mode === 'local') {
          customUrl = document.getElementById('localRelayUrl')?.value.trim() || LOCAL_RELAY_HOST;
        }
        if (mode === 'custom') {
          customUrl = document.getElementById('customRelayUrl')?.value.trim() || '';
          if (!customUrl) { toast('Enter a WebSocket URL first'); return; }
        }
        setRelayMode(mode, customUrl, true);
      }
    });
  });

  // Copy invite link button
  document.getElementById('copyInviteLink')?.addEventListener('click', copyInviteLink);

  // Other options tabs in connection settings
  document.querySelectorAll('.conn-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.conn-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.conn-panel').forEach(p => p.style.display = 'none');
      tab.classList.add('active');
      const panel = document.getElementById(`connPanel_${tab.dataset.conn}`);
      if (panel) panel.style.display = 'block';
    });
  });
}

function setRelayMode(mode, customUrl, save) {
  // Update active relay
  activeRelayMode = mode;
  activeRelayUrl = customUrl;

  if (save) {
    localStorage.setItem(LS_RELAY_MODE, mode);
    localStorage.setItem(LS_RELAY_URL, customUrl);
  }

  // Update toggle button states
  document.querySelectorAll('.relay-option-btn').forEach(btn => {
    btn.classList.remove('relay-active');
    const indicator = btn.querySelector('.relay-indicator');
    if (indicator) { indicator.style.background = 'var(--dimmer)'; }
    btn.querySelector('.relay-status-text') &&
      (btn.querySelector('.relay-status-text').textContent = 'OFF');
  });

  const relayStatusBar = document.getElementById('relayStatusBar');

  if (mode === 'none') {
    disconnectWebSocket();
    if (relayStatusBar) {
      relayStatusBar.style.display = 'none';
    }
    return;
  }

  // Activate the matching button
  const activeBtn = document.querySelector(`.relay-option-btn[data-relay="${mode}"]`);
  if (activeBtn) {
    activeBtn.classList.add('relay-active');
    const indicator = activeBtn.querySelector('.relay-indicator');
    if (indicator) indicator.style.background = 'var(--green)';
    const txt = activeBtn.querySelector('.relay-status-text');
    if (txt) txt.textContent = 'ON';
  }

  if (relayStatusBar) relayStatusBar.style.display = 'flex';

  // Connect websocket if in a room
  if (mpRoom) {
    connectWebSocket(mode, customUrl);
  } else {
    updateRelayStatus('ready', `${mode} relay ready — create or join a room to connect`);
  }
}

function updateRelayStatus(state, message) {
  const bar = document.getElementById('relayStatusBar');
  const dot = document.getElementById('relayStatusDot');
  const text = document.getElementById('relayStatusText');
  if (!bar || !dot || !text) return;

  const colors = {
    connected: 'var(--green)',
    connecting: 'var(--gold)',
    reconnecting: 'var(--gold)',
    disconnected: 'var(--dim)',
    error: 'var(--red)',
    ready: 'var(--blue)',
  };
  dot.style.background = colors[state] || 'var(--dim)';
  text.textContent = message;
}

function updateSessionStatus(state, message) {
  const el = document.getElementById('mpStatusText');
  if (el) el.textContent = message;
}

function copyInviteLink() {
  if (!mpRoom) { toast('Create a room first to get an invite link'); return; }
  const url = `${window.location.origin}${window.location.pathname}?join=${mpRoom.code}`;
  navigator.clipboard.writeText(url).then(() => {
    toast('📋 Invite link copied — send it to your friend!');
  });
}

// ============================================================
// LIVE SYNC
// ============================================================
function startLiveSync() {
  setInterval(() => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.get(['tweetHistory'], (res) => {
        if (!res.tweetHistory) return;
        const existingIds = new Set(allTweets.map(t => t.id));
        res.tweetHistory.filter(t => !existingIds.has(t.id)).forEach(t => handleNewTweet(t, 'mine'));
      });
    }
    // localStorage fallback polling for friend feed (same machine)
    if (mpRoom && (!ws || ws.readyState !== WebSocket.OPEN)) {
      pollFriendFeedLocalStorage();
    }
  }, 2000);

  document.getElementById('liveDot').style.background = 'var(--green)';
  document.getElementById('liveLabel').textContent = 'live';
}

function handleNewTweet(tweet, source) {
  if (source === 'mine') {
    if (allTweets.find(t => t.id === tweet.id)) return;
    allTweets.unshift(tweet);
    localStorage.setItem(LS_HISTORY, JSON.stringify(allTweets));
    updateStats();

    if (document.getElementById('myFeedPage').classList.contains('active')) {
      const feed = document.getElementById('mainFeed');
      const card = buildTweetCard(tweet, true);
      const first = feed.querySelector('.tweet-card');
      first ? feed.insertBefore(card, first) : feed.appendChild(card);
    }

    if (mpConnected) {
      const mpFeed = document.getElementById('mpMyFeed');
      if (mpFeed) mpFeed.insertBefore(buildTweetCard(tweet, true), mpFeed.firstChild);
      broadcastMyTweet(tweet);
    }
    toast(`Seen: ${tweet.author}`);
  }
}

// localStorage polling fallback (same machine only)
function pollFriendFeedLocalStorage() {
  if (!mpRoom) return;
  const key = `xmp_room_${mpRoom.code}`;
  const roomData = localStorage.getItem(key);
  if (!roomData) return;
  const room = JSON.parse(roomData);
  const friendFeedKey = mpRoom.role === 'host' ? 'guestFeed' : 'hostFeed';
  const incoming = room[friendFeedKey] || [];
  const existingIds = new Set(friendTweets.map(t => t.id));
  incoming.filter(t => !existingIds.has(t.id)).forEach(tweet => {
    friendTweets.unshift(tweet);
    const feed = document.getElementById('mpFriendFeed');
    if (feed) {
      const empty = feed.querySelector('.empty-state');
      if (empty) feed.innerHTML = '';
      feed.insertBefore(buildTweetCard(tweet, true), feed.firstChild);
    }
  });
  // Push my tweets to shared storage
  const myFeedKey = mpRoom.role === 'host' ? 'hostFeed' : 'guestFeed';
  const myRoomFeed = room[myFeedKey] || [];
  const myRoomIds = new Set(myRoomFeed.map(t => t.id));
  const myNew = allTweets.filter(t => !myRoomIds.has(t.id)).slice(0, 10);
  if (myNew.length > 0) {
    room[myFeedKey] = [...myNew, ...myRoomFeed].slice(0, 200);
    localStorage.setItem(key, JSON.stringify(room));
  }
}

// ============================================================
// RENDERING
// ============================================================
function renderFeed() {
  const feed = document.getElementById('mainFeed');
  const banner = document.getElementById('demoBanner');
  feed.innerHTML = '';
  if (banner) feed.appendChild(banner);

  const filtered = getFiltered();
  if (filtered.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-x">𝕏</div>
      <div class="empty-title">Nothing here yet</div>
      <div class="empty-desc">${
        currentFilter === 'all' ? 'Install the extension and browse x.com to populate your history.'
        : currentFilter === 'liked' ? 'No liked posts in your history yet.'
        : 'No bookmarked posts in your history yet.'
      }</div>`;
    feed.appendChild(empty);
    return;
  }
  filtered.forEach(t => feed.appendChild(buildTweetCard(t, false)));
}

function getFiltered() {
  let list = [...allTweets];
  if (currentFilter === 'liked') list = list.filter(t => t.liked);
  if (currentFilter === 'bookmarked') list = list.filter(t => t.bookmarked);
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(t =>
      t.text?.toLowerCase().includes(q) ||
      t.author?.toLowerCase().includes(q) ||
      t.handle?.toLowerCase().includes(q)
    );
  }
  return list;
}

function buildTweetCard(tweet, isNew = false) {
  const card = document.createElement('div');
  card.className = 'tweet-card' + (isNew ? ' new-tweet' : '');
  card.dataset.id = tweet.id;
  const badges = [];
  if (tweet.liked)      badges.push('<span class="badge liked">♥ liked</span>');
  if (tweet.bookmarked) badges.push('<span class="badge bookmarked">⊘ saved</span>');
  if (!tweet.liked && !tweet.bookmarked) badges.push('<span class="badge seen">👁 seen</span>');
  const avatarHtml = tweet.avatar
    ? `<img class="tweet-avatar" src="${tweet.avatar}" alt="" onerror="this.style.display='none'">`
    : `<div class="tweet-avatar-placeholder">${(tweet.author||'?')[0]}</div>`;
  card.innerHTML = `
    <div class="tweet-header">
      ${avatarHtml}
      <div class="tweet-meta">
        <div class="tweet-author">${escHtml(tweet.author||'Unknown')}</div>
        <div class="tweet-handle">${escHtml(tweet.handle||'')}</div>
      </div>
      <div class="tweet-time">${getTimeAgo(tweet.timestamp)}</div>
    </div>
    <div class="tweet-text">${escHtml(tweet.text||'')}</div>
    <div class="tweet-badges">${badges.join('')}</div>
    ${tweet.url?`<a class="tweet-link-btn" href="${tweet.url}" target="_blank">View on 𝕏 ↗</a>`:''}
  `;
  if (isNew) setTimeout(() => card.classList.remove('new-tweet'), 700);
  return card;
}

function updateStats() {
  const total = allTweets.length;
  const liked = allTweets.filter(t => t.liked).length;
  const bm    = allTweets.filter(t => t.bookmarked).length;
  document.getElementById('totalCount').textContent = total;
  document.getElementById('likedStatCount').textContent = liked;
  document.getElementById('bookmarkStatCount').textContent = bm;
  document.getElementById('countAll').textContent = total;
  document.getElementById('countLiked').textContent = liked;
  document.getElementById('countBookmarked').textContent = bm;
}

// ============================================================
// NAVIGATION
// ============================================================
function setupNav() {
  document.querySelectorAll('.header-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.header-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      const map = { myFeed:'myFeedPage', multiplayer:'multiplayerPage', raindrop:'raindropPage' };
      document.getElementById(map[btn.dataset.page])?.classList.add('active');
      document.getElementById('sidebar').style.display = btn.dataset.page === 'myFeed' ? 'flex' : 'none';
    });
  });
}

// ============================================================
// FILTERS & SEARCH
// ============================================================
function setupFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      renderFeed();
    });
  });
}

function setupSearch() {
  document.getElementById('searchInput')?.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderFeed();
  });
}

function setupClear() {
  document.getElementById('clearHistoryBtn')?.addEventListener('click', () => {
    if (!confirm('Clear all tweet history?')) return;
    allTweets = [];
    localStorage.removeItem(LS_HISTORY);
    if (typeof chrome !== 'undefined' && chrome.storage) chrome.storage.local.set({ tweetHistory: [] });
    updateStats(); renderFeed();
    toast('History cleared');
  });
}

// ============================================================
// MULTIPLAYER
// ============================================================
function setupMultiplayer() {
  document.getElementById('mpCreateRoom')?.addEventListener('click', createRoom);
  document.getElementById('mpJoinBtn')?.addEventListener('click', () => {
    document.getElementById('mpJoinBox').style.display = 'block';
    document.getElementById('mpInviteBox').style.display = 'none';
  });
  document.getElementById('mpConfirmJoin')?.addEventListener('click', joinRoom);
  document.getElementById('mpDisconnectBtn')?.addEventListener('click', disconnectRoom);
  document.getElementById('mpRoomCode')?.addEventListener('click', () => {
    navigator.clipboard.writeText(document.getElementById('mpRoomCode').textContent)
      .then(() => toast('Room code copied!'));
  });
  document.getElementById('copyInviteLink')?.addEventListener('click', copyInviteLink);

  const saved = localStorage.getItem(LS_MP_ROOM);
  if (saved) { try { mpRoom = JSON.parse(saved); activateSession(); } catch(e) {} }
}

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function createRoom() {
  const handle = document.getElementById('mpMyHandle').value.trim() || '@you';
  const code = generateCode();
  mpRoom = { code, myHandle: handle, friendHandle: null, role: 'host' };
  localStorage.setItem(LS_MP_ROOM, JSON.stringify(mpRoom));

  // localStorage fallback room for same-machine mode
  localStorage.setItem(`xmp_room_${code}`, JSON.stringify({
    host: handle, hostFeed: [], guestFeed: [], created: Date.now(), guestHandle: null
  }));

  document.getElementById('mpRoomCode').textContent = code;
  document.getElementById('mpInviteBox').style.display = 'block';
  document.getElementById('mpJoinBox').style.display = 'none';
  document.getElementById('mpStatusBadge').textContent = 'WAITING';

  // Show invite link
  const url = `${window.location.origin}${window.location.pathname}?join=${code}`;
  const linkEl = document.getElementById('mpInviteUrl');
  if (linkEl) { linkEl.textContent = url; linkEl.style.display = 'block'; }

  // Connect WebSocket relay now that we have a room
  if (activeRelayMode !== 'none') {
    connectWebSocket(activeRelayMode, activeRelayUrl);
  }

  // Poll for localStorage guest join (same-machine fallback)
  mpPollInterval = setInterval(() => {
    const room = JSON.parse(localStorage.getItem(`xmp_room_${code}`) || '{}');
    if (room.guestHandle) {
      mpRoom.friendHandle = room.guestHandle;
      localStorage.setItem(LS_MP_ROOM, JSON.stringify(mpRoom));
      clearInterval(mpPollInterval);
      activateSession();
      toast(`⚡ ${room.guestHandle} joined your room!`, 'mp');
    }
  }, 1000);
}

function joinRoom() {
  const code = document.getElementById('mpJoinCode').value.trim().toUpperCase();
  const handle = document.getElementById('mpMyHandle').value.trim() || '@guest';
  if (!code) { toast('Enter a room code'); return; }

  mpRoom = { code, myHandle: handle, friendHandle: null, role: 'guest' };
  localStorage.setItem(LS_MP_ROOM, JSON.stringify(mpRoom));

  // Update localStorage room if it exists (same-machine)
  const roomData = localStorage.getItem(`xmp_room_${code}`);
  if (roomData) {
    const room = JSON.parse(roomData);
    room.guestHandle = handle;
    localStorage.setItem(`xmp_room_${code}`, JSON.stringify(room));
    mpRoom.friendHandle = room.host;
  }

  // Connect WebSocket relay
  if (activeRelayMode !== 'none') {
    connectWebSocket(activeRelayMode, activeRelayUrl);
  }

  activateSession();
  toast(`⚡ Joined room ${code}!`, 'mp');
}

function activateSession() {
  mpConnected = true;
  document.getElementById('mpSetup').style.display = 'none';
  document.getElementById('mpSession').style.display = 'flex';
  document.getElementById('mpStatusBadge').textContent = activeRelayMode !== 'none' ? 'LIVE' : 'LOCAL';

  document.getElementById('mpMyColTitle').textContent = mpRoom.myHandle || 'You';
  if (mpRoom.friendHandle) {
    document.getElementById('mpFriendColTitle').textContent = mpRoom.friendHandle;
    document.getElementById('mpFriendColHandle').textContent = 'live feed';
  }

  // Populate my column
  const myFeed = document.getElementById('mpMyFeed');
  if (myFeed) {
    myFeed.innerHTML = '';
    allTweets.slice(0, 30).forEach(t => myFeed.appendChild(buildTweetCard(t, false)));
  }
}

function disconnectRoom() {
  if (!confirm('Disconnect from this room?')) return;
  mpConnected = false;
  clearInterval(mpPollInterval);
  disconnectWebSocket();
  if (mpRoom) localStorage.removeItem(`xmp_room_${mpRoom.code}`);
  mpRoom = null;
  localStorage.removeItem(LS_MP_ROOM);
  friendTweets = [];

  document.getElementById('mpSetup').style.display = 'block';
  document.getElementById('mpSession').style.display = 'none';
  document.getElementById('mpStatusBadge').textContent = 'OFFLINE';
  document.getElementById('mpInviteBox').style.display = 'none';
  document.getElementById('mpJoinBox').style.display = 'none';
  document.getElementById('mpJoinCode').value = '';
  toast('Disconnected from room');
}

// ============================================================
// RAINDROP DEMO
// ============================================================
function setupRaindrop() {
  const features = [
    { title:'Auto-save Liked Posts', desc:'Every post you like is saved to a "X Likes" Raindrop collection.', action:'Sync Liked Now', color:'var(--red)', id:'sync-liked' },
    { title:'Auto-save Bookmarks', desc:'Bookmarked posts sync to "X Bookmarks" for reading later.', action:'Sync Bookmarks', color:'var(--blue)', id:'sync-bookmarks' },
    { title:'Full History Export', desc:'Push your entire seen history to Raindrop with metadata.', action:'Export History', color:'var(--green)', id:'export-history' },
    { title:'AI Tagging', desc:'Claude AI auto-tags each post by topic before saving.', action:'Configure AI Tags', color:'var(--gold)', id:'ai-tags' },
    { title:'Broken Link Monitor', desc:'Weekly scan for deleted or private tweets in your collections.', action:'Run Scan', color:'var(--mp-accent)', id:'broken-links' },
    { title:'Daily Digest', desc:'Generates a shareable daily digest collection in Raindrop.', action:'Generate Digest', color:'var(--blue)', id:'daily-digest' },
    { title:'Multiplayer Shared Collection', desc:'Both you and your multiplayer friend write to the same collection.', action:'Create Shared', color:'var(--mp-accent)', id:'mp-shared' },
    { title:'Collections by Author', desc:'Auto-sort saved posts into per-author Raindrop sub-collections.', action:'Set Up', color:'var(--white)', id:'by-author' },
  ];

  const grid = document.getElementById('rdGrid');
  if (!grid) return;
  features.forEach(f => {
    const card = document.createElement('div');
    card.className = 'rd-card placeholder';
    card.style.borderLeftColor = f.color;
    card.innerHTML = `
      <h4>${f.title}</h4>
      <p>${f.desc}</p>
      <div class="rd-action">
        <button class="rd-btn disabled" data-feature="${f.id}">${f.action}</button>
        <span style="font-size:10px;color:var(--dim);margin-left:8px;margin-top:7px">Requires API key</span>
      </div>`;
    grid.appendChild(card);
  });

  document.getElementById('rdConnectBtn')?.addEventListener('click', () => {
    const key = document.getElementById('rdApiKey').value.trim();
    if (!key) { toast('Enter your Raindrop API token'); return; }
    rdApiKey = key;
    localStorage.setItem(LS_RD_KEY, key);
    document.getElementById('rdStatus').textContent = '✓ Connected';
    document.getElementById('rdStatus').style.color = 'var(--green)';
    document.querySelectorAll('.rd-btn.disabled').forEach(btn => {
      btn.classList.remove('disabled');
      btn.addEventListener('click', e => handleRdAction(e.target.dataset.feature));
    });
    document.querySelectorAll('.rd-card').forEach(c => c.classList.remove('placeholder'));
    toast('💧 Raindrop connected!');
  });
}

function handleRdAction(id) {
  const msgs = {
    'sync-liked': `Would save ${allTweets.filter(t=>t.liked).length} liked posts to "X Likes"`,
    'sync-bookmarks': `Would save ${allTweets.filter(t=>t.bookmarked).length} bookmarks to "X Bookmarks"`,
    'export-history': `Would export ${allTweets.length} posts to Raindrop`,
    'ai-tags': 'Would tag each bookmark via Claude AI',
    'broken-links': 'Would scan for deleted/private tweets',
    'daily-digest': 'Would generate a daily digest collection',
    'mp-shared': 'Would create a shared collection with your multiplayer friend',
    'by-author': 'Would organize by author into sub-collections',
  };
  toast(`📌 Demo: ${msgs[id] || 'Action triggered'}`);
  console.log('[Raindrop Demo]', id, '→ POST https://api.raindrop.io/rest/v1/raindrop');
}

// ============================================================
// UTILITIES
// ============================================================
function getTimeAgo(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 60000) return 'just now';
  if (d < 3600000) return `${Math.floor(d/60000)}m ago`;
  if (d < 86400000) return `${Math.floor(d/3600000)}h ago`;
  return `${Math.floor(d/86400000)}d ago`;
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, type = '') {
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'mp' ? ' mp' : '');
  t.textContent = msg;
  document.getElementById('toastContainer').appendChild(t);
  setTimeout(() => t.remove(), 3500);
}
