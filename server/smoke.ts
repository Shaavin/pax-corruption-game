/**
 * End-to-end smoke test against a running server (default: `npm run dev` on :8787).
 *
 *   node --experimental-strip-types server/smoke.ts [http://127.0.0.1:8787] [moves] [expansion]
 *
 * Two clients create and join a game, then play it over WebSockets, choosing
 * moves from their own redacted views with the same engine the browser uses.
 */
import { currentActor, legalActions } from "../lib/game/engine.ts";
import { HIDDEN_CARD_ID } from "../lib/game/redact.ts";
import { createSeededRng } from "../lib/game/rng.ts";
import type { GameState, PlayerId } from "../lib/game/types.ts";
import { PROTOCOL_VERSION, type ClientMessage, type ServerMessage } from "../lib/online/protocol.ts";

const base = process.argv[2] ?? "http://127.0.0.1:8787";
const moves = Number(process.argv[3] ?? 300);
const expansion = process.argv[4] === "expansion";
const origin = "http://localhost:3000";
const failures: string[] = [];
const check = (ok: unknown, message: string) => {
  if (!ok) failures.push(message);
};

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(base + path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });
  return (await response.json()) as T;
}

type Client = { seat: PlayerId; ws: WebSocket; state: GameState | null; messages: ServerMessage[]; errors: string[] };

function connect(gameId: string, token: string, seat: PlayerId): Promise<Client> {
  const ws = new WebSocket(`${base.replace(/^http/, "ws")}/api/games/${gameId}/ws`);
  const client: Client = { seat, ws, state: null, messages: [], errors: [] };
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as ServerMessage;
    client.messages.push(message);
    if (message.t === "state") client.state = message.state;
    if (message.t === "error") client.errors.push(message.message);
  });
  return new Promise((resolve, reject) => {
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ t: "hello", token, protocol: PROTOCOL_VERSION } satisfies ClientMessage));
      resolve(client);
    });
    ws.addEventListener("error", () => reject(new Error("WebSocket error")));
  });
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function until(predicate: () => boolean, label: string, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${label}`);
    await wait(10);
  }
}

const created = await post<{ gameId: string; seat: PlayerId; token: string }>("/api/games", { mode: "standard", expansion });
check(created.gameId && created.seat === 0, "Create returns a game and seat 0");
const joined = await post<{ seat: PlayerId; token: string }>(`/api/games/${created.gameId}/join`, {});
check(joined.seat === 1, "Join returns seat 1");
const third = await post<{ error?: string }>(`/api/games/${created.gameId}/join`, {});
check(third.error, "A third player can't join");

const p0 = await connect(created.gameId, created.token, 0);
const p1 = await connect(created.gameId, joined.token, 1);
await until(() => Boolean(p0.state && p1.state), "initial state");

const clients = [p0, p1];
const chooser = createSeededRng(7);
let played = 0;
let undone = 0;
for (; played < moves; played++) {
  const state = p0.state!;
  if (state.victory) break;
  const actor = currentActor(state);
  const client = clients[actor]!;
  const view = client.state!;
  // The opponent's hidden cards never reach this client.
  const other = clients[actor === 0 ? 1 : 0]!;
  check(
    view.players[other.seat].hand.every((card) => card.faceUp || card.cardId === HIDDEN_CARD_ID),
    "Opponent's face-down hand is hidden",
  );
  check(view.seed === 0, "Seed is never sent");
  const options = legalActions(view, client.seat);
  if (options.length === 0) {
    failures.push(`No legal actions for seat ${client.seat} at move ${played}`);
    break;
  }
  const busy = options.filter((a) => a.type !== "endAction" && a.type !== "endPolitics");
  const pool = busy.length > 0 && chooser.nextInt(4) > 0 ? busy : options;
  const action = pool[chooser.nextInt(pool.length)]!;
  const before = client.messages.length;
  const otherBefore = other.messages.length;
  client.ws.send(JSON.stringify({ t: "action", action } satisfies ClientMessage));
  await until(() => client.messages.length > before && other.messages.length > otherBefore, `move ${played} broadcast`);
  check(client.errors.length === 0, `Server rejected a legal move: ${client.errors.join("; ")}`);
  client.errors.length = 0;

  // Now and then, take a move back.
  const last = client.messages.at(-1);
  if (last?.t === "state" && last.canUndo && chooser.nextInt(10) === 0) {
    const mark = client.messages.length;
    client.ws.send(JSON.stringify({ t: "undo" } satisfies ClientMessage));
    await until(() => client.messages.length > mark, "undo");
    undone += 1;
  }
}

// Acting out of turn is refused.
{
  const state = p0.state!;
  if (!state.victory) {
    const idle = clients[currentActor(state) === 0 ? 1 : 0]!;
    const mark = idle.messages.length;
    idle.ws.send(JSON.stringify({ t: "action", action: { type: "endPolitics", player: idle.seat } } satisfies ClientMessage));
    await until(() => idle.messages.length > mark, "out-of-turn reply");
    check(idle.errors.length > 0, "Out-of-turn moves are refused");
  }
}

// Reconnecting gets the full state back.
p1.ws.close();
const again = await connect(created.gameId, joined.token, 1);
await until(() => Boolean(again.state), "reconnect state");
check(JSON.stringify(again.state!.market) === JSON.stringify(p0.state!.market), "Reconnect sees the same table");

for (const client of [p0, again]) client.ws.close();
console.log(
  failures.length === 0
    ? `Smoke ok: ${played} moves (${undone} undone)${p0.state!.victory ? `, game over (${p0.state!.victory.kind})` : ""}, expansion ${expansion}.`
    : failures.slice(0, 10).join("\n"),
);
process.exit(failures.length === 0 ? 0 : 1);
