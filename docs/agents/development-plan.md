# Development plan

Local hotseat simulator first. The same rules engine should later run a networked match without a rewrite.

## Where things stand (2026-11)

Phases 0–5 below were built against the **old** rules (policy supporters, referendum, executive power). The rulebook has since changed (see [game-rules.md](game-rules.md)). Before any new feature work, do **Phase R — rules migration**. Code that implements removed mechanics is wrong, not just unfinished.

| Area | State |
| --- | --- |
| Catalog + art (`lib/cards`, `public/cards`) | Civil, conspiracy, policy, overview data is current. Alliances, monuments, party-8, executive, aids, decrees need updating ([card-catalog.md](card-catalog.md#ingest-status)). |
| Setup (`lib/game/setup.ts`) | Old deck math (92 pile cards, no Senate, no decrees). |
| Turn, main actions (`main.ts`, `income.ts`, `draw.ts`) | Mostly valid. Remove Call Referendum; add the Recruit precondition; fix income order. |
| Politics step | Implements campaign + executive power. Must become Influence Senate / Propose Policy / Declare Victory. |
| Elections (`election.ts`) | Old start/end-of-phase flow (EP drop, opposition chooses first, end-of-phase referendum, consecutive wins). |
| Victory (`victory.ts`) | Old Political and Ideological rules; victories checked instantly instead of declared. |
| UI (`components/game`) | Built for the old loop: `ExecutiveSlot`, `PolicyChoice`, `ElectionChoice`, campaign tucks. |
| Action log (uncommitted) | Keep. Event names will change with the migration. |

## Principles

1. **Pure engine.** `lib/game` is TypeScript with no React, no DOM, no Next APIs. `apply(state, action, rng) => { state, events }`.
2. **Actions are the only mutation.** UI, tests, and (later) the server submit the same action types.
3. **Hidden information is real.** The opponent's hand is never sent to the other client later. Hotseat already hides it behind the pass-device gate. (Policy supporters no longer exist; the Senate, Market, support piles, tableaus, and decrees are all public.)
4. **Cards are data + registered effects.** Do not bury unique rules in components.
5. **Deterministic replay.** Seeded RNG + action log reproduces any game.
6. **Printed card text > rulebook > these docs.** If [open-questions.md](open-questions.md) lists it, stop and ask.

## Target UX (hotseat)

One device, two players taking turns.

```
┌───────────────────────────────────────────────────────────────────┐
│  Opponent hand (backs)                party · monuments · partisans │
│  Opponent tableau:  [ D1 ] [ D2 ] [ D3 ] [ D4 ]                      │
│                                                                     │
│  District row: policy, support piles, influence, popularity         │
│  Shared: Senate (5, with vote total) · Market (5 or 8)              │
│          decree objectives (4) · available monuments · deck count   │
│                                                                     │
│  Your tableau:      [ D1 ] [ D2 ] [ D3 ] [ D4 ]                      │
│  Your hand (faces)                     party · monuments · partisans │
└───────────────────────────────────────────────────────────────────┘
```

- Four **vertical lanes**. Each lane holds both tableaus, the policy, and both support piles.
- Your cards face you at the bottom; opponent hand shows backs.
- District hub shows **signed leads** (yours minus theirs): **Influence** and **Popularity** (support-pile counts). Breakdowns go in the (i) tips.
- **Senate row** shows each Senator's votes and the threshold to pass a policy ("4 of 7 needed"). During Propose Policy, highlight which Senators the currently revealed cards convince.
- **Decrees** show inactive/active side and, when active, whether each player currently meets the condition. That makes Political Victory readable.
- **Victory readiness**: since victories are declared, show which victories you could declare this Politics step.
- Click a hand card → legal targets highlight (lane, Senate, market, monument, discard-for-action).
- After you end your turn, a full-screen **Pass to {other player}** gate hides the hand until they confirm.

Do not clone Hearthstone chrome. Use Pax art, district colors, and a political-table feel. The layout contract: **my hand bottom, their backs top, board center**.

## Code layout

```
app/
  page.tsx                  # menu: new local game, mode
  play/page.tsx             # hotseat table (client island)
lib/
  game/
    types.ts                # state, zones, actions, events
    engine.ts               # apply / legalActions
    setup.ts                # modes, piles, starting hands, Senate, Market, decrees
    influence.ts            # district influence, Lords symbols
    zones.ts / discard.ts   # move helpers, discard-to-support (routing: Space Agency, United Front)
    main.ts                 # the 5 main actions
    senate.ts               # NEW: influence Senate, propose policy, vote math
    income.ts / draw.ts
    election.ts             # trigger, Market 8, resolution, decree activation
    decrees.ts              # NEW: decree conditions
    victory.ts              # declarable victories, Civil at final election, ideological math
    action-log.ts
    abilities/              # one file per effect id or family
  cards/
    catalog.ts, deck.ts, setup-cards.ts, schema.ts, effects.ts
components/game/            # Table, DistrictHub, Hand, Market, Senate (new), Decrees (new), …
public/cards/               # ingested art
docs/agents/                # these files
```

Keep the engine importable from Node tests: no `"use client"` in `lib/game`.

## Engine state (current rules)

- `phase`: `setup` | `action` | `politics` | `income` | `gameOver`, plus `election: { active: boolean, generalElectionsSetAside: number } | null`
- `activePlayer`, `firstPlayer`, `incumbent` (winner of the last election, or null)
- Per player: `hand`, `tableau[district]`, `support[district]`, `partyId`, `monuments[]`, `partisans`, `handLimit`, `consultativeOffice` and `planetNextBank` (face-up set-aside zones; both usable as if in hand; the bank adds +1 Horsard influence per card), `electionWins`
- Shared: `districtOrder`, `policy[district]` (`"a" | "b" | null`), `senate` (5 card instances, left → right), `market`, `deck`, `availableMonuments`, `monumentDeck`, `decrees[]` (`{ id, active }`), `generalElectionsOut`
- `turn`: main action taken, free actions used (per source), monument constructed this turn (for the Politics draw), politics option used
- Card instance: `{ instanceId, cardId, occupiedDistrict? }` (`occupiedDistrict` for Century Inc. cross-district replacements)

Removed from state: `policySupporters`, `executive`, `consecutiveWins`, `lastTurn.discarded`, election-first-player choice.

`legalActions(state, viewer)` drives every button. The UI never invents an action.

Victories are **declared** (except Civil): `legalActions` offers `declareVictory(kind)` in the Politics step only when its condition holds. Do not auto-end the game on Military, Popularity, Political, or Ideological.

## Build order

### Phase R — Rules migration (do this next)

Work in this order; keep `npm test` green at each step.

1. **Catalog.** Re-ingest current faces and text per the [checklist](card-catalog.md#re-ingest-checklist). Add decree objectives. Remove executive power. Swap `policySupportValue` for `senateVotes`.
2. **Setup.** Deal Senate (5) and Market (5); build piles from 87 cards with the new mode table; place decrees inactive; 2 guaranteed + 2 random monuments with no district constraint.
3. **Actions.** Delete Call Referendum. Add the Recruit precondition. Income order: Market take → replenish → deck draw.
4. **Politics step.** Delete campaign and executive power. Add the monument draw, then exactly one of Influence Senate / Propose Policy / Declare Victory.
5. **Elections.** Turn order never changes; trigger fills Market to 8 and counts General Elections; resolve when Market is empty after a turn; tie-breaks (electorates → cards in won electorates → incumbent / first player); winner activates decrees; refill to 5. Remove EP drop, opposition-chooses-first, end-of-phase referendum, and consecutive-win Political Victory.
6. **Victory.** Declared victories; Political via decrees; new Ideological math; Civil at final election.
7. **UI.** Remove `ExecutiveSlot`, campaign tucks, referendum `PolicyChoice` flow, and `ElectionChoice` (first-player pick). Add Senate row, Propose Policy reveal flow, decree row, Declare Victory control.
8. Delete dead code (`referendum.ts`, executive handlers) once nothing imports it.

Exit: a full Standard game plays end to end under the current rulebook with generic (no-ability) alliances and monuments.

### Phase 6 — Card abilities

Implement handlers in dependency order:

1. Policies (they change core math)
2. Monuments (hand limit, free actions, Smart Doctrine symbols)
3. Alliances in starting hands and the FAQ
4. Remaining alliances

Each ability gets at least one engine test. An unimplemented ability is unusable (cannot activate). If the card can still be played for its slot/symbols, show "ability not implemented" and allow the play.

### Phase 7 — Hotseat finish

- Legal-action highlighting everywhere
- Victory banners and declare prompts
- Log / replay (action log)
- Undo last action (local only)
- Player aids as overlay (current Victories / Actions art)

### Phase 8 — Later, not now

- Online: host the engine on a server, two clients, same actions
- Tourney / Chaotic / Epic as setup options (Chaotic C+D is one `64 & 3` pile)
- Expansion: Legacy & Diplomacy (event deck, relations, game board, 7 victories)

## Testing

Colocate engine tests with the engine. Prefer replaying action lists over UI snapshots.

Must-have cases:

- Standard setup: 7 starting + 5 Senate + 5 Market + 87 pile cards; printed A–E sizes; 4 General Elections placed per mode
- First player starting hand is 3 of 4; second is all 4
- Recruit illegal with an empty support pile in that district
- Military at exactly 3 partisan difference; Popularity at exactly 9 support difference (declared, not automatic)
- Influence Senate: rightmost leaves to the actor's pile; Senate stays at 5
- Propose Policy: vote threshold "more than half"; civil needs higher same-district value; alliance needs same-district alliance; conspiracy never convinced; one card convincing several Senators; neutral ↔ side only
- District Governor blocks proposals in its district; two Governors cancel
- Election: Market fills to 8; second General Election in the same phase is counted, not a new phase; resolution after Market empties; tie-breaks; decree activation count
- Political Victory with 2 satisfied active decrees
- Ideological: rulebook example (Player 2 wins with scales 4 vs atom 3); private copies counted only from the player with more; no ties allowed
- Civil Victory at the final election; Roman Basilica owner can declare Civil after 3 election wins (and not before)
- Turn order unchanged across an election (GE revealed in A's income → B's turn opens the phase)
- De Jures: lower or tied per district; no civil cards = fail unless both players have none
- Planet Next bank: +1 Horsard influence per banked card; spending a banked card removes its +1; banked cards ignore hand limit
- Dragon Gate extra draw at end of income; General Election there does not interrupt
- United Front sends Smarbbit discards to the non-discarding player

## What not to do yet

- Accounts, lobby, matchmaking, or persistence beyond `localStorage` replay
- A rules interpreter that reads English card text
- Pixel-perfect Hearthstone animations
- Encoding an answer to anything in [open-questions.md](open-questions.md)
- Anything from the expansion
