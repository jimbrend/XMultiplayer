// partykit-server.ts
// Deploy with: npx partykit deploy
// Free tier at partykit.dev — no credit card needed
//
// Each room code becomes its own Party instance.
// Clients connect via WSS and broadcast tweet events to each other.

import type * as Party from "partykit/server";

export interface TweetEvent {
  type: "tweet" | "ping" | "join" | "leave";
  handle?: string;
  data?: Record<string, unknown>;
}

export default class XHistoryRoom implements Party.Server {
  constructor(readonly room: Party.Room) {}

  // Called when a new client connects
  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    // Send them the last 50 tweets in room storage so they catch up
    this.room.storage.get<TweetEvent[]>("recentTweets").then((tweets) => {
      if (tweets && tweets.length > 0) {
        conn.send(JSON.stringify({ type: "catchup", tweets }));
      }
    });
  }

  // Called when a client sends a message
  async onMessage(message: string, sender: Party.Connection) {
    let event: TweetEvent;
    try {
      event = JSON.parse(message);
    } catch {
      return;
    }

    // Store recent tweets for catch-up (new joiners)
    if (event.type === "tweet") {
      const tweets = (await this.room.storage.get<TweetEvent[]>("recentTweets")) ?? [];
      tweets.unshift(event);
      await this.room.storage.put("recentTweets", tweets.slice(0, 50));
    }

    // Broadcast to everyone except the sender
    this.room.broadcast(message, [sender.id]);
  }

  onClose(conn: Party.Connection) {
    this.room.broadcast(
      JSON.stringify({ type: "leave", connectionId: conn.id }),
      [conn.id]
    );
  }
}

// partykit.json config (create this file in same folder):
// {
//   "name": "x-history-relay",
//   "main": "partykit-server.ts"
// }
