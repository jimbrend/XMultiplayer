// local-relay.js
// Local WebSocket relay — works on the same network (LAN, home wifi, etc.)
// Run: node local-relay.js
// Both users open http://YOUR_LOCAL_IP:3000 and connect to ws://YOUR_LOCAL_IP:8080
//
// To find your local IP:
//   Mac/Linux: ifconfig | grep "inet " | grep -v 127.0.0.1
//   Windows:   ipconfig | findstr "IPv4"

const { WebSocketServer } = require('ws');
const http = require('http');

const WS_PORT = 8080;
const INFO_PORT = 8081;

// Room state: Map<roomCode, Set<WebSocket>>
const rooms = new Map();
// Track handles: Map<WebSocket, { handle, room }>
const clients = new Map();

const wss = new WebSocketServer({ port: WS_PORT });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `ws://localhost`);
  const room = (url.searchParams.get('room') || 'default').toUpperCase();
  const handle = url.searchParams.get('handle') || 'anonymous';

  // Add to room
  if (!rooms.has(room)) rooms.set(room, new Set());
  rooms.get(room).add(ws);
  clients.set(ws, { handle, room });

  const memberCount = rooms.get(room).size;
  console.log(`[${new Date().toLocaleTimeString()}] ${handle} joined room ${room} (${memberCount} members)`);

  // Tell the new joiner how many people are in the room
  ws.send(JSON.stringify({
    type: 'room_info',
    room,
    members: memberCount,
    message: `Joined room ${room} with ${memberCount} member(s)`
  }));

  // Tell everyone else someone joined
  broadcast(room, { type: 'join', handle }, ws);

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    // Rate limiting: max 10 messages/second per client
    const now = Date.now();
    const info = clients.get(ws);
    if (!info) return;
    if (!info.lastMsg) info.lastMsg = [];
    info.lastMsg = info.lastMsg.filter(t => now - t < 1000);
    if (info.lastMsg.length >= 10) {
      ws.send(JSON.stringify({ type: 'error', message: 'Rate limit: slow down' }));
      return;
    }
    info.lastMsg.push(now);

    // Broadcast to room (exclude sender)
    broadcast(room, msg, ws);
  });

  ws.on('close', () => {
    const info = clients.get(ws);
    if (info) {
      rooms.get(info.room)?.delete(ws);
      broadcast(info.room, { type: 'leave', handle: info.handle }, ws);
      console.log(`[${new Date().toLocaleTimeString()}] ${info.handle} left room ${info.room}`);
    }
    clients.delete(ws);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });
});

function broadcast(room, msg, exclude = null) {
  const roomClients = rooms.get(room);
  if (!roomClients) return;
  const data = JSON.stringify(msg);
  roomClients.forEach(client => {
    if (client !== exclude && client.readyState === 1) {
      client.send(data);
    }
  });
}

// Info endpoint: GET http://localhost:8081/rooms — shows active rooms
const infoServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  const info = {};
  rooms.forEach((clients, room) => {
    info[room] = clients.size;
  });
  res.end(JSON.stringify({ rooms: info, uptime: process.uptime() }));
});
infoServer.listen(INFO_PORT);

console.log(`
╔══════════════════════════════════════════════╗
║  𝕏 History Local Relay                       ║
║  WebSocket: ws://localhost:${WS_PORT}              ║
║  Info:      http://localhost:${INFO_PORT}             ║
╚══════════════════════════════════════════════╝

To use on your local network, find your IP and share:
  Mac/Linux: run  ifconfig | grep "inet "
  Windows:   run  ipconfig

Then your friend connects to: ws://YOUR_IP:${WS_PORT}?room=CODE
`);
