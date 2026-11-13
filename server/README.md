# Pax Corruption online server

A Cloudflare Worker with one Durable Object (`GameRoom`) per online game. The
Next.js site on Vercel serves the pages; this server only relays moves.

- **Authoritative.** The server runs the same engine (`lib/game`) and sends each
  player a redacted view (`lib/game/redact.ts`): never the opponent's hand, the
  deck order, or the seed.
- **Free plan.** Runs on the Cloudflare Workers Free plan (SQLite-backed Durable
  Objects). WebSocket hibernation means an idle game costs nothing; keep-alive
  pings are answered by the runtime without waking the game. A game stores only
  its seed, settings, two seat tokens, and the action list (rebuilt by replay),
  and deletes itself 30 days after its last move.
- **No accounts.** Creating a game gives you Player 1's seat token; the invite
  link lets one more browser claim Player 2. Tokens live in each browser's
  `localStorage`.

## Run locally

```sh
cd server
npm install
npm run dev            # http://127.0.0.1:8787
```

Point the site at it with `.env.local` in the repo root:

```
NEXT_PUBLIC_PAX_SERVER_URL=http://127.0.0.1:8787
```

Smoke test (two scripted players over WebSockets):

```sh
node --experimental-strip-types server/smoke.ts http://127.0.0.1:8787 300
node --experimental-strip-types server/smoke.ts http://127.0.0.1:8787 300 expansion
```

## Deploy

1. Create a free Cloudflare account. No paid plan is needed.
2. Set your site's origin in `wrangler.jsonc` → `vars.ALLOWED_ORIGINS`
   (comma-separated, for example `https://your-site.vercel.app`). Only these
   origins (and `localhost:3000`) can create or join games.
3. Deploy:

   ```sh
   cd server
   npx wrangler login
   npm run deploy
   ```

   Wrangler prints the Worker URL, for example `https://pax-corruption-server.<you>.workers.dev`.
4. In Vercel → Project → Settings → Environment Variables, add
   `NEXT_PUBLIC_PAX_SERVER_URL` = that URL, then redeploy the site. Without it,
   `/online` says online play isn't set up, and the rest of the site is unaffected.

## Protocol

`lib/online/protocol.ts` (shared with the client):

| Route | Purpose |
| --- | --- |
| `POST /api/games` | Create a game → `{ gameId, seat: 0, token }` |
| `POST /api/games/:id/join` | Claim seat 1 → `{ gameId, seat: 1, token }` (409 when full) |
| `GET /api/games/:id/ws` | WebSocket. Send `{ t: "hello", token, protocol }`, then `action` / `undo` messages |

The server answers every change with a `state` message per seat (redacted state,
new or full events, `canUndo`, presence). Bump `PROTOCOL_VERSION` when the
messages change; old clients are asked to reload.
