# Development plan

Local hotseat simulator first. Same rules engine should later run a networked match without being rewritten.

## Principles

1. **Pure engine.** `lib/game` is TypeScript with no React, no DOM, no Next APIs. `apply(state, action, rng) => { state, events }`.
2. **Actions are the only mutation.** UI, tests, and (later) the server all submit the same action types.
3. **Hidden information is real.** Policy-supporter identities and the opponent hand are not sent to the other client later. Hotseat must already treat them as secret (pass-device veil).
4. **Cards are data + registered effects.** Do not bury unique rules inside components.
5. **Deterministic replay.** Seeded RNG + action log = reproduce any game. This is how we debug elections.
6. **Printed card text > rulebook > this plan.** If [open-questions.md](open-questions.md) still lists it, stop.

## Target UX (hotseat)

One device, two players taking turns.

```
┌─────────────────────────────────────────────────────────────┐
│  Opponent hand (card backs)     party · monuments · partisans│
│  Opponent tableau:  [ D1 ] [ D2 ] [ D3 ] [ D4 ]              │
│                                                              │
│  District row: crests, active policy, support Δ, electors    │
│  Shared: market (5 or 8) · available monuments · deck count  │
│                                                              │
│  Your tableau:      [ D1 ] [ D2 ] [ D3 ] [ D4 ]              │
│  Your hand (faces)              party · monuments · EP       │
└─────────────────────────────────────────────────────────────┘
```

- Four **vertical lanes**, not one shared row of minions. Each lane holds both tableaus, the policy, and both support piles.
- Your cards face you at the bottom; opponent faces are hidden (backs) except public zones (tableau, market, monuments, support piles, party, partisan/EP).
- Click a hand card → legal targets highlight (lane, market, monument, discard-for-action).
- After you end your turn, a full-screen **Pass to {other player}** gate hides the hand and tucked supporter identities until they confirm.

Do not clone Hearthstone chrome. Use Pax art, district colors, and a political-table feel. The layout contract is: **my hand bottom, their backs top, board center**.

## Suggested tree

```
app/
  page.tsx                  # menu: new local game, mode, (later) join
  play/page.tsx             # hotseat table
  layout.tsx
lib/
  game/
    types.ts                # state, zones, actions
    engine.ts               # apply / legalActions / checkVictory
    setup.ts                # modes, piles, starting hands
    zones.ts                # move helpers, discard-to-support
    election.ts
    referendum.ts
    abilities/              # one file per effect id or family
  cards/
    catalog.ts
    schema.ts
components/
  game/
    Table.tsx
    DistrictLane.tsx
    Hand.tsx
    Market.tsx
    CardView.tsx
    PassDeviceGate.tsx
public/cards/               # ingested art
docs/agents/                # these files
```

Keep the engine importable from tests with `tsx` or Node — no `"use client"` in `lib/game`.

The play page is a client island. The menu can stay a server component.

## Engine sketch

State (minimum):

- `phase`: `setup` | `action` | `politics` | `income` | `electionStart` | `electionEnd` | `gameOver`
- `activePlayer`, `firstPlayer`, `electionTriggerer`
- Per-player: `hand`, `tableau[district]`, `support[district]`, `policySupporters[]`, `partyId`, `monuments[]`, `partisans`, `handLimit`, `electionWins`, `consecutiveWins`, `symbols`
- Shared: `districtOrder`, `policy[district]`, `market`, `deck`, `availableMonuments`, `monumentDeck`, `electionsOut`, `executive: { owner, side } | null`
- `lastTurn: { discarded: boolean, addedSupport: boolean }`
- `flags` for one-shot free actions this turn

Every card in a zone is an instance `{ instanceId, cardId, faceUp, occupiedDistrict? }`. `occupiedDistrict` matters when Century Club (etc.) parks a card off its printed district.

`legalActions(state, viewer)` returns the buttons the UI may show. Never let the UI invent an action the engine would reject.

Victory checks run after every state change that can create a lead (discard to support, recruit, symbol gain, election end).

## RNG

Pass an injected `Rng` (`nextInt`, `shuffle`). Setup, monument replenish, and any "random" card effect use it. Tests pass a fixed sequence.

## Build order

Ship Standard first. Chaos pile construction is now specified (combined CD = `60&3`). National Priorities and expansion still wait.

### Phase 0 — Catalog and art

- Ingest art into `public/cards`
- Transcribe every base card into `lib/cards/catalog.ts`
- Placeholder general-election faces
- Map each unique ability to an `Effect.id` (handler can be `unimplemented` and illegal to trigger)

Exit: starting-hand names resolve; `npm test` (or equivalent) covers catalog integrity.

### Phase 1 — Empty table

- Full-viewport board chrome with 4 empty lanes, market rail, two hands
- CardView renders real art at hand / board sizes
- No rules yet; fixtures for layout and hover/zoom

Exit: both desktop and a narrow laptop width look like a playable table, not a document.

### Phase 2 — Setup flow

- District shuffle, party deal/choose/reveal, starting-hand search (first 3 of 4, second all 4), monuments, then shuffle remaining non-GE and deal market 5 + exact Standard piles (92 cards)
- Hotseat already uses the pass gate between secret steps (party choice, starting-hand search)

Exit: two humans can sit down and reach turn 1 with a legal Standard seed.

### Phase 3 — Core turn without unique abilities

- Play civil
- Income (market take, deck draw, replenish)
- End turn / pass gate
- Support piles and influence readout (civil + support only)

Exit: a full dummy game of "only play civil and draw" runs.

### Phase 4 — Remaining main actions

- Conspiracy wipe
- Alliance play (slot limit, no effect yet beyond occupying the slot and Lords symbols)
- Campaign (tuck 1)
- Referendum (2-card cost + resolve)
- Recruit (3) + Military check
- Construct (5) + monument row replenish + Popularity check on every discard

Exit: all 6 main actions and politics campaign work with generic cards.

### Phase 5 — Election phase

- GE reveal/draw, start-of-phase (market 8, drop EP, opposition chooses first)
- No market replenish, end when market empty
- Electorates / electors / incumbency
- End-of-phase referendum, Civil / Political checks, refresh market
- Emergency State as the first real EP handler

Exit: scripted tests cover first election, consecutive wins, final-election Civil, chained GE on refresh.

### Phase 6 — Card abilities

Implement handlers in dependency order:

1. Policies (they mutate core math)
2. Monuments (free actions + election timing)
3. Alliances named in the FAQ / starting hands
4. Remaining alliances

Each ability gets at least one engine test. Unimplemented abilities stay unusable (cannot play / cannot activate) rather than silently doing nothing — unless the card can be played for its slot/symbols alone, in which case show "ability not implemented" and still allow the play.

### Phase 7 — Hotseat finish

- Legal-action highlighting
- Victory banners
- Log / replay
- Undo last action (local only)
- Player aids as overlay (Actions / Victories art)

### Phase 8 — Later, not now

- Online: host engine on the server, two clients, same actions
- Tournament / Epic / Chaos as setup options (Chaos CD is one 60&3 pile)
- National Priorities (never-revealed monuments go to the monument deck)
- Expansion (Legacy Victory, agendas, extra conspiracies)

## Testing

Colocate engine tests with the engine. Prefer replaying action lists over UI snapshots for rules.

Must-have cases:

- Standard: 7 starting cards + 5 market + 92 pile cards; printed A–E sizes
- First player starting hand is 3 of 4; second player is all 4
- Popularity at exactly 9 difference
- Military at exactly 3 partisan difference
- Ideological: shared policy symbol + owner-only monument/party; blocked when both have 4
- Election tie break: electorates → electors → incumbent / order number
- GE during income, during market fill, and during an existing election
- Two District Governors silence a district
- Roman Basilica vs normal Civil
- Smart Doctrine order swap and one-of-each symbols
- Dragon Gate extra draw after income; GE does not interrupt that step
- United Front sends Smarbbit discards to the non-discarding player

## What not to do yet

- Accounts, lobby, matchmaking, or persistence beyond `localStorage` replay
- A rules interpreter that reads English card text
- Pixel-perfect Hearthstone animations
- Encoding an answer from [open-questions.md](open-questions.md)
- Expansion victories
