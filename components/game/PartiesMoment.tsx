"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { calligraphy } from "./fonts";
import { ContinueHint, CountdownBar, LEAVE_MS, readingMs, useScale, voiceLine, VoiceLine, type MomentVoice } from "./moment-kit";
import { usePlayerLabel } from "./players";
import { getParty } from "@/lib/cards/catalog";
import type { PartyIdValue } from "@/lib/cards/schema";
import { otherPlayer, type PlayerId } from "@/lib/game";

/** Both parties are chosen and revealed together (TableMoment.tsx queues it on `partiesRevealed`). */
export type PartiesRevealData = {
  id: number;
  kind: "parties";
  parties: Record<PlayerId, PartyIdValue>;
  firstPlayer: PlayerId;
};

const PARTY_BACK = "/cards/backs/party.png";
const EYEBROW = "The parties are revealed";
/** The rulebook's story ends here, where the game begins. */
const PROLOGUE = "The future of the Vitalic Union awaits.";

/** When the first player is singled out and the headline comes in; reading starts then. */
const FIRST_MS = 2050;

/**
 * The game begins: a band in the brand's red opens across the table, both party cards slide in
 * face down and turn up together, and the lower party number is named first player.
 */
export function PartiesReveal({
  moment,
  viewer,
  voice,
  onDone,
}: {
  moment: PartiesRevealData;
  viewer: PlayerId;
  /** Time Traveller Ty speaks instead of the rulebook's line. */
  voice?: MomentVoice;
  onDone: () => void;
}) {
  const label = usePlayerLabel();
  const scale = useScale();
  const [leaving, setLeaving] = useState(false);

  const first = moment.firstPlayer;
  const second = otherPlayer(first);
  const headline = first === viewer ? "You go first" : `${label(first)} goes first`;
  const keeps = first === viewer ? "You keep 3 of your 4" : `${label(first)} keeps 3 of their 4`;
  const takes = second === viewer ? "you take all 4" : `${label(second)} takes all 4`;
  const detail = `The lower party number goes first. ${keeps} starting cards, and ${takes}.`;
  const names = [viewer, otherPlayer(viewer)].map((player) => getParty(moment.parties[player]).name);

  const spoken = voice ? voiceLine(voice.lines.reveal, moment.id) : null;
  const readFrom = FIRST_MS * scale;
  const hold = readingMs(headline, detail, spoken ?? PROLOGUE, ...names);

  useEffect(() => {
    const leave = window.setTimeout(() => setLeaving(true), readFrom + hold);
    const done = window.setTimeout(onDone, readFrom + hold + LEAVE_MS * scale);
    return () => {
      window.clearTimeout(leave);
      window.clearTimeout(done);
    };
  }, [onDone, scale, readFrom, hold]);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${EYEBROW}: you lead the ${names[0]}, ${label(otherPlayer(viewer))} the ${names[1]}. ${headline}.`}
      data-table-moment="parties"
      // A lesson's coach card moves aside (or folds) while the band covers the table.
      data-modal
      onClick={onDone}
      className="fixed inset-0 z-[70] flex cursor-pointer items-center"
      style={{ "--moment-scale": scale } as CSSProperties}
    >
      <div aria-hidden className={["election-veil absolute inset-0", leaving ? "is-leaving" : ""].join(" ")} />
      <div className={["parties-band relative w-full overflow-hidden", leaving ? "is-leaving" : ""].join(" ")}>
        <div aria-hidden className="parties-sheen" />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center px-4 py-5 text-center sm:py-7 short:py-3">
          <p className="parties-eyebrow text-[0.65rem] font-semibold tracking-[0.22em] text-ember uppercase sm:text-xs">{EYEBROW}</p>

          <div className="parties-row mt-4 flex items-start justify-center gap-3 sm:mt-5 sm:gap-8">
            <PartySide side="left" partyId={moment.parties[viewer]} name="You" color="var(--you)" first={first === viewer} />
            <span
              aria-hidden
              className={`parties-seal ${calligraphy.className} grid shrink-0 place-items-center rounded-full text-xl text-white sm:text-2xl`}
            >
              vs
            </span>
            <PartySide
              side="right"
              partyId={moment.parties[otherPlayer(viewer)]}
              name={label(otherPlayer(viewer))}
              color="var(--opp)"
              first={first !== viewer}
            />
          </div>

          <h2 className="parties-headline mt-4 text-3xl leading-tight font-semibold text-white sm:mt-5 sm:text-5xl short:mt-2 short:text-3xl">{headline}</h2>
          <p className="parties-line mt-2 max-w-lg text-xs leading-relaxed text-stone-300 sm:text-sm short:mt-1 short:max-w-2xl">{detail}</p>
          {voice && spoken ? (
            <VoiceLine voice={voice} line={spoken} delayMs={2650 * scale} className="mt-3 short:mt-1.5" />
          ) : (
            <p className={`parties-prologue ${calligraphy.className} mt-2.5 text-base text-white/85 sm:text-xl short:mt-1 short:text-base`}>{PROLOGUE}</p>
          )}
          <ContinueHint delayMs={readFrom} className="mt-2.5 short:mt-1" />
        </div>
        <CountdownBar delayMs={readFrom} durationMs={hold} inset="inset-x-0" tone="bg-ember/70" />
      </div>
    </div>
  );
}

/** One party card, face down until both turn up, with its leader and number beneath. */
function PartySide({
  side,
  partyId,
  name,
  color,
  first,
}: {
  side: "left" | "right";
  partyId: PartyIdValue;
  name: string;
  color: string;
  first: boolean;
}) {
  const party = getParty(partyId);
  return (
    <div className="flex w-[var(--party-card)] flex-col items-center">
      <div className={`parties-slot parties-slot-${side} relative w-full`}>
        <div className={["parties-lift relative rounded-md", first ? "is-first" : ""].join(" ")}>
          <div className="parties-flip relative">
            {/* eslint-disable-next-line @next/next/no-img-element -- card faces, already in the cache */}
            <img
              src={party.art}
              alt=""
              draggable={false}
              className="parties-face block w-full rounded-md shadow-[0_10px_30px_rgb(0_0_0/0.6)] ring-1 ring-white/20"
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- the party back */}
            <img src={PARTY_BACK} alt="" draggable={false} className="parties-face parties-back absolute inset-0 h-full w-full rounded-md" />
          </div>
          {first ? (
            <span className="parties-first absolute -top-2.5 left-1/2 rounded-full bg-ember px-2 py-0.5 text-[0.55rem] font-bold tracking-[0.12em] whitespace-nowrap text-stone-950 uppercase shadow-lg sm:text-[0.62rem]">
              Goes first
            </span>
          ) : null}
        </div>
      </div>
      <div className="parties-caption mt-2.5 w-[9rem] max-w-[42vw] leading-tight short:mt-1.5">
        <div className="truncate text-xs font-semibold sm:text-sm" style={{ color }}>
          {name}
        </div>
        <div className="mt-0.5 text-xs text-stone-100 sm:text-sm">{party.name}</div>
        <div className="mt-0.5 text-[0.6rem] tracking-[0.14em] text-stone-400 uppercase">Order {party.order}</div>
      </div>
    </div>
  );
}
