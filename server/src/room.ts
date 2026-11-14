import { DurableObject } from "cloudflare:workers";
import { currentActor } from "../../lib/game/engine.ts";
import { IllegalActionError } from "../../lib/game/errors.ts";
import { newReplay, replayRecord, stepReplay, undoReplay, type GameRecord, type Replay } from "../../lib/game/record.ts";
import { redactEvents, redactState } from "../../lib/game/redact.ts";
import { randomUint32 } from "../../lib/game/rng.ts";
import { isGameMode } from "../../lib/game/setup.ts";
import type { Action, GameEvent, PlayerId } from "../../lib/game/types.ts";
import {
  PROTOCOL_VERSION,
  type ClientMessage,
  type CreateGameRequest,
  type GameSettings,
  type ServerMessage,
} from "../../lib/online/protocol.ts";

export type Env = {
  GAMES: DurableObjectNamespace<GameRoom>;
  ALLOWED_ORIGINS?: string;
};

type Meta = {
  seed: number;
  settings: GameSettings;
  /** Seat tokens; seat 1 is null until someone joins. */
  tokens: [string, string | null];
  createdAt: number;
};

/** What a socket remembers across hibernation. */
type Attachment = { seat: PlayerId | null };

/** Delete a game this long after its last move. */
const IDLE_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_MESSAGE_BYTES = 64 * 1024;

function randomToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Constant-time string comparison for seat tokens. */
function sameToken(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const actionKey = (index: number) => `a:${String(index).padStart(6, "0")}`;

/**
 * One online game. Stores only the seed, settings, seat tokens, and the action
 * list; the state is rebuilt by deterministic replay when the object wakes.
 * Uses WebSocket hibernation, so an idle game costs nothing.
 */
export class GameRoom extends DurableObject<Env> {
  private replay: Replay | null = null;
  private meta: Meta | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Keep-alive pings are answered by the runtime without waking this object.
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  async create(request: CreateGameRequest): Promise<{ seat: PlayerId; token: string }> {
    if (await this.ctx.storage.get<Meta>("meta")) throw new Error("Game already exists");
    const settings: GameSettings = {
      mode: isGameMode(request.mode) ? request.mode : "standard",
      expansion: Boolean(request.expansion),
      foreignInfluence: Boolean(request.expansion && request.foreignInfluence),
    };
    const meta: Meta = { seed: randomUint32(), settings, tokens: [randomToken(), null], createdAt: Date.now() };
    await this.ctx.storage.put("meta", meta);
    await this.touch();
    this.meta = meta;
    return { seat: 0, token: meta.tokens[0] };
  }

  /** Public: what's being played and whether Player 2's seat is free. Never the seed or tokens. */
  async info(): Promise<{ settings: GameSettings; open: boolean } | { error: string }> {
    const meta = await this.loadMeta();
    if (!meta) return { error: "No such game" };
    return { settings: meta.settings, open: meta.tokens[1] === null };
  }

  async join(): Promise<{ seat: PlayerId; token: string } | { error: string }> {
    const meta = await this.loadMeta();
    if (!meta) return { error: "No such game" };
    if (meta.tokens[1] !== null) return { error: "This game already has two players" };
    meta.tokens[1] = randomToken();
    await this.ctx.storage.put("meta", meta);
    this.broadcastPresence();
    return { seat: 1, token: meta.tokens[1] };
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Expected a WebSocket", { status: 426 });
    if (!(await this.loadMeta())) return new Response("No such game", { status: 404 });
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ seat: null } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== "string" || raw.length > MAX_MESSAGE_BYTES) return this.send(ws, { t: "error", message: "Message too large" });
    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      return this.send(ws, { t: "error", message: "Malformed message" });
    }
    const attachment = ws.deserializeAttachment() as Attachment;

    if (message.t === "ping") return this.send(ws, { t: "pong" });
    if (message.t === "hello") {
      if (message.protocol !== PROTOCOL_VERSION) {
        return this.send(ws, { t: "error", message: "Please reload: the game was updated" });
      }
      const meta = await this.loadMeta();
      const seat = meta?.tokens.findIndex((token) => token !== null && sameToken(token, String(message.token)));
      if (!meta || seat === undefined || seat < 0) {
        ws.close(4001, "Unknown seat");
        return;
      }
      ws.serializeAttachment({ seat: seat as PlayerId } satisfies Attachment);
      await this.sendState(ws, seat as PlayerId, null, true);
      this.broadcastPresence();
      return;
    }

    const seat = attachment.seat;
    if (seat === null) return this.send(ws, { t: "error", message: "Say hello first" });
    const replay = await this.loadReplay();

    if (message.t === "action") {
      const action = message.action as Action;
      if (!action || typeof action !== "object" || action.player !== seat) {
        return this.send(ws, { t: "error", message: "You can only act for your own seat" });
      }
      if (currentActor(replay.state) !== seat) return this.send(ws, { t: "error", message: "It isn't your move" });
      let next: Replay;
      try {
        next = stepReplay(replay, action);
      } catch (error) {
        const text = error instanceof IllegalActionError ? error.message : "That move isn't allowed";
        return this.send(ws, { t: "error", message: text });
      }
      await this.ctx.storage.put(actionKey(replay.steps.length), action);
      this.replay = next;
      await this.touch();
      await this.broadcastState(next.steps.at(-1)!.events, false);
      return;
    }

    if (message.t === "undo") {
      const last = replay.steps.at(-1);
      if (!last || !last.undoable || last.action.player !== seat || currentActor(replay.state) !== seat) {
        return this.send(ws, { t: "error", message: "Nothing to undo" });
      }
      this.replay = undoReplay(replay);
      await this.ctx.storage.delete(actionKey(replay.steps.length - 1));
      await this.broadcastState(null, true);
    }
  }

  async webSocketClose(ws: WebSocket, code: number): Promise<void> {
    try {
      ws.close(code === 1005 ? 1000 : code, "Closing");
    } catch {
      // Already closed.
    }
    this.broadcastPresence(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.broadcastPresence(ws);
  }

  /** Delete an abandoned game. */
  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll();
    this.replay = null;
    this.meta = null;
  }

  // --- helpers -------------------------------------------------------------------------------

  private async touch(): Promise<void> {
    await this.ctx.storage.setAlarm(Date.now() + IDLE_LIFETIME_MS);
  }

  private async loadMeta(): Promise<Meta | null> {
    if (!this.meta) this.meta = (await this.ctx.storage.get<Meta>("meta")) ?? null;
    return this.meta;
  }

  private async loadReplay(): Promise<Replay> {
    if (this.replay) return this.replay;
    const meta = await this.loadMeta();
    if (!meta) throw new Error("No such game");
    const stored = await this.ctx.storage.list<Action>({ prefix: "a:" });
    const actions = [...stored.values()];
    const record: GameRecord = {
      version: 1,
      seed: meta.seed,
      mode: meta.settings.mode,
      expansion: meta.settings.expansion,
      foreignInfluence: meta.settings.foreignInfluence,
      actions,
    };
    this.replay = actions.length > 0 ? replayRecord(record) : newReplay(meta.seed, meta.settings);
    return this.replay;
  }

  private seats(exclude?: WebSocket): { ws: WebSocket; seat: PlayerId }[] {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws !== exclude)
      .flatMap((ws) => {
        const { seat } = (ws.deserializeAttachment() as Attachment | null) ?? { seat: null };
        return seat === null ? [] : [{ ws, seat }];
      });
  }

  private presence(exclude?: WebSocket): { joined: [boolean, boolean]; connected: [boolean, boolean] } {
    const meta = this.meta;
    const online = this.seats(exclude).map((entry) => entry.seat);
    return {
      joined: [true, Boolean(meta?.tokens[1])],
      connected: [online.includes(0), online.includes(1)],
    };
  }

  private broadcastPresence(exclude?: WebSocket): void {
    const message: ServerMessage = { t: "presence", ...this.presence(exclude) };
    for (const { ws } of this.seats(exclude)) this.send(ws, message);
  }

  private async broadcastState(newEvents: GameEvent[] | null, full: boolean): Promise<void> {
    for (const { ws, seat } of this.seats()) await this.sendState(ws, seat, newEvents, full);
  }

  private async sendState(ws: WebSocket, seat: PlayerId, newEvents: GameEvent[] | null, full: boolean): Promise<void> {
    const replay = await this.loadReplay();
    const meta = (await this.loadMeta())!;
    const last = replay.steps.at(-1);
    const events = full || !newEvents ? replay.steps.flatMap((step) => step.events) : newEvents;
    this.send(ws, {
      t: "state",
      seat,
      settings: meta.settings,
      state: redactState(replay.state, seat),
      events: redactEvents(events, seat),
      full: full || !newEvents,
      canUndo: Boolean(last?.undoable && last.action.player === seat && currentActor(replay.state) === seat),
      ...this.presence(),
    });
  }

  private send(ws: WebSocket, message: ServerMessage): void {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // The socket closed in between.
    }
  }
}
