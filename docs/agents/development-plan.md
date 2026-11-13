# Development plan

Local hotseat simulator first. The same rules engine should later run a networked match without a rewrite.

## Where things stand (2026-11-13)

**Phase R (rules migration), Phase 6 (card abilities), and Phase 7 (hotseat finish) are done.** Engine, catalog, art, tests, and hotseat UI follow the current rulebook, every base-game card ability works, and a hotseat game saves, resumes, and supports undo. Next up is **Phase 8 — troubleshooting**.

| Area | State |
| --- | --- |
| Catalog + art (`lib/cards`, `public/cards`) | Current. Re-ingest any time with `scripts/ingest-tts.py` ([card-catalog.md](card-catalog.md#ingest-status)). |
| Setup (`lib/game/setup.ts`) | Senate 5 + Market 5, 87 pile cards (Standard only), decrees inactive, monuments with no district constraint. |
| Turn, main actions (`main.ts`, `income.ts`, `draw.ts`) | 5 main actions, Recruit precondition, construct → Politics draw, income: Market take → refill to 5 → deck draw. |
| Politics step (`senate.ts`, `engine.ts`) | Influence Senate / Propose Policy / Declare Victory / pass. |
| Elections (`election.ts`, `draw.ts`) | GE opens the phase immediately (Market 8, count GEs), turn order unchanged, resolves when the Market is empty after a turn, tie-breaks, winner activates decrees (`decreeChoice` phase), final election → Civil. |
| Victory (`victory.ts`, `decrees.ts`) | All victories declared in Politics except Civil at the final election. Political via decrees; new Ideological math; Roman Basilica and Smart Doctrine (victory-related) implemented. |
| Abilities | All base-game abilities implemented (Phase 6). |
| UI (`components/game`) | Senate + decree row (`SenateRow`), propose flow (reveal → policy → discard), Seat in the Senate, Declare buttons, `DecreeChoice` overlay. Executive, referendum, and first-player UI removed. |
| Action log (`action-log.ts`, `HistoryRail`) | Live: the left rail lists every public action; deck draws stay hidden. |
| Records (`record.ts`, `saved-game.ts`) | A game is its seed + action list. Replay rebuilds it; the browser saves it after every action; the menu offers **Continue game**; Undo replays all but the last action. |
| Lint | Two pre-existing `react-hooks/set-state-in-effect` errors in `TableTour.tsx` (not from the migration). |

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
    record.ts               # game records: replay, undo rules, record parsing
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

### Phase R — Rules migration (done 2026-11-11)

Catalog and art re-ingested; setup, actions, Politics step, elections, decrees, and victories rewritten; `referendum.ts`, executive power, and their UI deleted; tests rewritten (`lib/game/*.test.ts`, shared helpers in `test-helpers.ts`).

### Phase 6 — Card abilities

Implement handlers in dependency order:

1. Policies (they change core math)
2. Monuments (hand limit, free actions, Smart Doctrine symbols)
3. Alliances in starting hands and the FAQ
4. Remaining alliances

**Done (2026-11-12): every base-game ability is implemented and tested.**

| Module | What lives there |
| --- | --- |
| `abilities.ts` | Continuous effects: silencing (District Governor, Financial Bankers), live-effect lookups, hand and alliance limits, Market Regulation, Martial Law, Order of Knights blocks, policy freeze, United Front |
| `influence.ts` | Secularism, Populist Forum, Economic Reform, Order of Knights +1, Planet Next bank |
| `election.ts` | Diet of Saints (wins Shavvinne; discards Shavvinne civils after the election), Divine Inquisitors, Civil Service veto |
| `plays.ts` | Shared building blocks for plays, recruiting, building, Senate, proposals; lane-entry triggers (Model Society, Currency Ballots, Urban Aristocrats); Project Habitat |
| `free-actions.ts` | Kybernetik, Foreign Inc., Century Inc., Architecture Inc., Rebel Inc., Capitol Inc., Intel Network; setting cards aside (Planet Next, Consultative Office) |
| `choices.ts` | Pending choices: Currency Ballots discard, Urban Aristocrats swap, Intel Network pick, People's Press draw, Space Agency routing |
| `main.ts` | "As if in hand" zones: hand, Consultative Office, Planet Next bank, and Market Dragonara civils with State Enterprise |
| `income.ts` | Turn flow with `proceed` / `resumeAfterChoice`: a pending choice pauses the turn and it resumes where it left off; the action step stays open after the main action while a free action is available |

Tests: `abilities.test.ts` (continuous) and `free-actions.test.ts` (free actions and choices).

Each ability gets at least one engine test. An unimplemented ability is unusable (cannot activate). If the card can still be played for its slot/symbols, show "ability not implemented" and allow the play.

### Phase 7 — Hotseat finish (done 2026-11-13)

- Legal-action highlighting everywhere: hand, lanes, Market (labelled **Use** for State Enterprise in the action step, **Take** at income), monuments, and the Senator who leaves when you seat a card
- Victory banners and declare prompts: the turn dock shows a victory you can declare now, one in reach for your Politics step, or the opponent's threat; the game-over screen names the victory and why, and can be dismissed to review the table
- Log / replay: the history rail is the action log; `lib/game/record.ts` replays a seed + action list into the same state (RNG included). The browser keeps the current game (`localStorage`, `pax-hotseat-game-v1`), and `/play?resume=1` (menu: **Continue game**) rebuilds it
- Undo (local only): **Undo** button or Ctrl+Z. Only while the same player is still acting and the action revealed nothing hidden (no deck draws, Market or monument refills, General Elections, Intel Network); never during setup or after the game ends
- Player aid overlay (Actions and Victories art) from the top bar

Tests: `record.test.ts` (replay determinism, JSON round trip, `ReplayError` index, undo rules).

### Phase 8 — Troubleshooting

Tools to reproduce and diagnose games that players report as broken. Everything builds on deterministic replay: a game is fully described by its seed and its action list.

- Manual seed entry: start a new game from a typed seed (the menu and `/play?seed=`)
- Game records: export the current game (record version, seed, action list, app build) as a JSON file or copyable code; import one to load that game
- Re-simulate: rebuild a game from its record and step forward and back through its actions, or jump to any action, with every seat's hidden information visible
- Divergence checks: replay validates every action and reports the first one that is illegal or throws, plus engine invariants (card conservation, zone sizes) after each step
- Bug report: one button that bundles the record, the current step, and a short description for the player to send
- Version stamp: records carry the engine version so a record from an older rules build is flagged instead of silently replaying differently

### Phase 9 — Later, not now

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
