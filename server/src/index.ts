/**
 * Pax Corruption online server: a Cloudflare Worker that routes to one
 * Durable Object (GameRoom) per game. Free plan friendly: requests only on
 * moves, WebSocket hibernation while idle, and only a few keys per game.
 *
 *   POST /api/games            create a game (you are Player 1)
 *   POST /api/games/:id/join   claim Player 2
 *   GET  /api/games/:id/ws     WebSocket (send `hello` with your seat token)
 */
import { GAME_ID_ALPHABET, isGameId, type CreateGameRequest } from "../../lib/online/protocol.ts";
import { GameRoom, type Env } from "./room.ts";

export { GameRoom };

const DEFAULT_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function allowedOrigin(request: Request, env: Env): string | null {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  const allowed = [...DEFAULT_ORIGINS, ...(env.ALLOWED_ORIGINS ?? "").split(",").map((entry) => entry.trim()).filter(Boolean)];
  return allowed.includes(origin) ? origin : null;
}

function cors(request: Request, env: Env): Record<string, string> {
  const origin = allowedOrigin(request, env);
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "86400",
        Vary: "Origin",
      }
    : { Vary: "Origin" };
}

function json(request: Request, env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...cors(request, env) },
  });
}

function newGameId(): string {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => GAME_ID_ALPHABET[byte % GAME_ID_ALPHABET.length]).join("");
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(request, env) });

    if (url.pathname === "/" || url.pathname === "/health") {
      return json(request, env, { ok: true, service: "pax-corruption-server" });
    }

    if (url.pathname === "/api/games" && request.method === "POST") {
      // Only the site may create games (keeps the free quota for real players).
      if (!allowedOrigin(request, env)) return json(request, env, { error: "Origin not allowed" }, 403);
      let body: CreateGameRequest = {};
      try {
        body = (await request.json()) as CreateGameRequest;
      } catch {
        // Defaults.
      }
      const gameId = newGameId();
      const room = env.GAMES.get(env.GAMES.idFromName(gameId));
      const seat = await room.create(body);
      return json(request, env, { gameId, ...seat });
    }

    const match = url.pathname.match(/^\/api\/games\/([^/]+)\/(join|ws)$/);
    if (match && isGameId(match[1]!)) {
      const room = env.GAMES.get(env.GAMES.idFromName(match[1]!));
      if (match[2] === "join" && request.method === "POST") {
        if (!allowedOrigin(request, env)) return json(request, env, { error: "Origin not allowed" }, 403);
        const result = await room.join();
        return "error" in result ? json(request, env, result, 409) : json(request, env, { gameId: match[1], ...result });
      }
      if (match[2] === "ws" && request.method === "GET") {
        if (request.headers.get("Origin") && !allowedOrigin(request, env)) {
          return new Response("Origin not allowed", { status: 403 });
        }
        return room.fetch(request);
      }
    }
    return json(request, env, { error: "Not found" }, 404);
  },
} satisfies ExportedHandler<Env>;
