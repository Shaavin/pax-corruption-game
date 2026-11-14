"use client";

/**
 * Card motion: slide cards from where they were to where they are after a move.
 *
 * Call `captureCards()` right before a change is applied (a move, an undo, a server
 * update, a replay step). After React commits the new table, `playCardMotion()`
 * compares positions by card key (`data-card-key`, the card's instance id) and
 * animates each card from its old spot. Cards that appear without an old spot fly
 * in from a hand or the deck (`data-motion-origin`); cards that disappear fade out
 * where they were. Because it works by position, undo animates in reverse for free.
 */

import { motionScale } from "./settings";

type Snap = { rect: DOMRect; src: string | null; faceDown: boolean };

/** Who made the captured change, by seat (null: the table, e.g. setup). */
let pending: { cards: Map<string, Snap>; actor: number | null } | null = null;

const MOVE_MS = 650;
const ENTER_MS = 750;
const EXIT_MS = 450;
/** Gentle in and out, so the eye can follow the card the whole way. */
const EASE = "cubic-bezier(0.45, 0, 0.2, 1)";

/** Off for the system "reduce motion" setting, or when the player turned animations off. */
function reducedMotion(): boolean {
  return (
    typeof window !== "undefined" && (window.matchMedia("(prefers-reduced-motion: reduce)").matches || motionScale() === 0)
  );
}

function measure(): Map<string, Snap> {
  const cards = new Map<string, Snap>();
  for (const element of document.querySelectorAll<HTMLElement>("[data-card-key]")) {
    const key = element.dataset.cardKey!;
    if (cards.has(key)) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const image = element.querySelector("img");
    cards.set(key, { rect, src: image?.currentSrc || image?.src || null, faceDown: element.dataset.faceDown === "1" });
  }
  return cards;
}

/** Remember where every card is, before applying a change made by `actor`. */
export function captureCards(actor: number | null = null): void {
  if (typeof document === "undefined" || reducedMotion()) return;
  pending = { cards: measure(), actor };
}

/** Forget a capture that won't be followed by a change (e.g. an action the server rejects). */
export function dropCapture(): void {
  pending = null;
}

function originRect(name: string): DOMRect | null {
  const element = document.querySelector<HTMLElement>(`[data-motion-origin="${name}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 ? rect : null;
}

/** Where a card with no previous spot comes from: the deck for the Market and draws, else a hand. */
function entryOrigin(element: HTMLElement, actorSide: "you" | "opponent" | null): DOMRect | null {
  const zone = element.closest<HTMLElement>("[data-motion-zone]")?.dataset.motionZone;
  if (zone === "market" || zone === "hand-you") return originRect("deck") ?? originRect("hand-you");
  const side = element.closest<HTMLElement>("[data-motion-side]")?.dataset.motionSide ?? actorSide;
  if (side === "you") return originRect("hand-you");
  if (side === "opponent") return originRect("hand-opponent");
  return null;
}

/**
 * Animate from the last capture to the table as it is now. `viewer` is the seat at
 * the bottom of the screen (so the actor's hand can be found).
 */
export function playCardMotion(viewer: number): void {
  const before = pending;
  pending = null;
  if (!before || reducedMotion()) return;
  const actorSide = before.actor === null ? null : before.actor === viewer ? "you" : "opponent";
  const now = new Map<string, HTMLElement>();
  for (const element of document.querySelectorAll<HTMLElement>("[data-card-key]")) {
    if (!now.has(element.dataset.cardKey!)) now.set(element.dataset.cardKey!, element);
  }

  for (const [key, element] of now) {
    const to = element.getBoundingClientRect();
    if (to.width === 0 || to.height === 0) continue;
    const old = before.cards.get(key);
    const from = old?.rect ?? entryOrigin(element, actorSide);
    if (!from) continue;
    const dx = from.left + from.width / 2 - (to.left + to.width / 2);
    const dy = from.top + from.height / 2 - (to.top + to.height / 2);
    const scale = Math.max(0.2, Math.min(4, from.width / to.width));
    if (Math.abs(dx) < 2 && Math.abs(dy) < 2 && Math.abs(scale - 1) < 0.03) continue;
    const style = getComputedStyle(element);
    const restTranslate = style.translate === "none" ? "0px 0px" : style.translate;
    const restScale = style.scale === "none" ? "1" : style.scale;
    element.animate(
      [
        { translate: `${dx}px ${dy}px`, scale: String(scale), opacity: old ? 1 : 0.2, zIndex: 60 },
        { opacity: 1, offset: 0.35 },
        { translate: restTranslate, scale: restScale, opacity: 1, zIndex: 60 },
      ],
      { duration: (old ? MOVE_MS : ENTER_MS) * motionScale(), easing: EASE },
    );
  }

  // Cards that left the table (discarded, returned to a hidden hand): fade where they were.
  for (const [key, snap] of before.cards) {
    if (now.has(key) || !snap.src) continue;
    const ghost = document.createElement("img");
    ghost.src = snap.src;
    ghost.alt = "";
    ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, {
      position: "fixed",
      left: `${snap.rect.left}px`,
      top: `${snap.rect.top}px`,
      width: `${snap.rect.width}px`,
      height: `${snap.rect.height}px`,
      objectFit: "cover",
      borderRadius: "0.32em",
      pointerEvents: "none",
      zIndex: "60",
    } satisfies Partial<CSSStyleDeclaration>);
    document.body.appendChild(ghost);
    ghost
      .animate([{ opacity: 0.95, scale: "1" }, { opacity: 0, scale: "0.7" }], { duration: EXIT_MS * motionScale(), easing: "ease-in" })
      .finished.finally(() => ghost.remove());
  }
}
