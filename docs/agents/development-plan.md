# Development plan

Local hotseat simulator first. The same rules engine should later run a networked match without a rewrite.

## Where things stand (2026-11-13)

**Phases R (rules migration), 6 (card abilities), 7 (hotseat finish), and 8 (troubleshooting) are done.** Engine, catalog, art, tests, and hotseat UI follow the current rulebook, every base-game card ability works, a hotseat game saves, resumes, and supports undo, and reported games can be replayed step by step at `/troubleshoot`. **Phase 9** is done: setup modes, the Legacy & Diplomacy expansion, and online play (a free Cloudflare server, see `server/README.md`).

| Area | State |
| --- | --- |
| Catalog + art (`lib/cards`, `public/cards`) | Current. Re-ingest any time with `scripts/ingest-tts.py` ([card-catalog.md](card-catalog.md#ingest-status)). |
| Setup (`lib/game/setup.ts`) | Senate 5 + Market 5, 87 pile cards in Standard, Tourney, Chaotic, or Epic piles (`DRAW_PLANS`), decrees inactive, monuments with no district constraint. |
| Turn, main actions (`main.ts`, `income.ts`, `draw.ts`) | 5 main actions, Recruit precondition, construct → Politics draw, income: Market take → refill to 5 → deck draw. |
| Politics step (`senate.ts`, `engine.ts`) | Influence Senate / Propose Policy / Declare Victory / pass. |
| Elections (`election.ts`, `draw.ts`) | GE opens the phase immediately (Market 8, count GEs), turn order unchanged, resolves when the Market is empty after a turn, tie-breaks, winner activates decrees (`decreeChoice` phase), final election → Civil. |
| Victory (`victory.ts`, `decrees.ts`) | All victories declared in Politics except Civil at the final election. Political via decrees; new Ideological math; Roman Basilica and Smart Doctrine (victory-related) implemented. |
| Abilities | All base-game abilities implemented (Phase 6). |
| UI (`components/game`) | Senate + decree row (`SenateRow`), propose flow (reveal → policy → discard), Seat in the Senate, Declare buttons, `DecreeChoice` overlay. Executive, referendum, and first-player UI removed. |
| Action log (`action-log.ts`, `HistoryRail`) | Live: the left rail lists every public action; deck draws stay hidden. |
| Records (`record.ts`, `saved-game.ts`) | A game is its seed + action list. Replay rebuilds it; the browser saves it after every action; the menu offers **Continue game**; Undo replays all but the last action. |
| Troubleshooting (`diagnostics.ts`, `/troubleshoot`) | Bug reports (in-game **Report**), share codes, step-through replay with hidden info, failure and invariant checks, engine version stamps, **Play on from here**. |
| Computer opponent (`lib/game/ai.ts`) | `chooseAiAction(state, seat, level, rng)` picks from `legalActions`. Easy: mostly random but active. Normal: tries every legal move on a copy with the hidden piles reshuffled and keeps the best `positionScore`, with the odd slip. Hard: plans its whole turn, then plays the leading plans on through the opponent's reply and its own next turn. The Ninth: Hard's search with a learned evaluator (see [The Ninth](#the-ninth)). Every level follows an **agenda** that changes from game to game and switches when the board turns. Always declares a victory when it can; never looks at the opponent's hand. `/play?ai=easy\|normal\|hard\|ninth`; records keep `ai` so saves resume against it. See [Computer opponent](#computer-opponent). |
| Card motion (`card-motion.ts`) | Cards carry `data-card-key` (instance id). `captureCards()` runs before every change (move, undo, server update, replay step); `Table` calls `playCardMotion()` after the commit, so cards slide from old to new spots, new cards fly in from a hand or the deck, and removed cards fade. Hotseat handoffs replay the other player's moves since the new seat last looked (final history, so undone moves never show; Skip available). Off with reduced motion. |
| Tutorial (`lib/tutorial`, `components/tutorial`, `/learn`) | **Learn to play** (2026-11-21): 12 short lessons from prepared positions against the three computer personalities, base game first, then an optional Legacy & Diplomacy chapter. See [Tutorial](#tutorial-learn-to-play). |
| How to play (`TableTour.tsx`) | The one walkthrough (it replaced a separate text primer, 2026-11-15): a spotlight tour controlled by `Table` that explains each rule on the component it applies to, and each victory where it is tracked. Opens once per browser (`pax-table-tour-v10`), reopens from **How to play** (desktop) or the ⋯ menu (phone). Steps point at `data-tour` anchors; on phones each step pins the Districts or Senate · Market view. Expansion games get expansion wording (inactive victories, buying events, two-row election Market) and a World step. |

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
  page.tsx                  # menu: new local game (choose mode), continue, seed, troubleshooting
  play/page.tsx             # hotseat table (client island)
lib/
  game/
    types.ts                # state, zones, actions, events
    engine.ts               # apply / legalActions
    setup.ts                # modes, piles, starting hands, Senate, Market, decrees
    influence.ts            # district influence, Lords symbols
    zones.ts / discard.ts   # move helpers, discard-to-support (routing: Space Academy, United Front)
    main.ts                 # the 5 main actions
    senate.ts               # NEW: influence Senate, propose policy, vote math
    income.ts / draw.ts
    election.ts             # trigger, Market 8, resolution, decree activation
    decrees.ts              # NEW: decree conditions
    victory.ts              # declarable victories, Civil at final election, ideological math
    action-log.ts
    record.ts               # game records: replay, undo rules, bug reports, share codes, ENGINE_VERSION
    diagnostics.ts          # simulate a record, invariant checks, readable action lines
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
- Per player: `hand`, `tableau[district]`, `support[district]`, `partyId`, `monuments[]`, `partisans`, `handLimit`, `network` (face-up, outside the hand limit, per enabled district; see `network.ts`; both usable as if in hand; the bank adds +1 Horsard influence per card), `electionWins`
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
| `influence.ts` | Secularism, Populist Forum, Economic Reform, Order of Knights +1, Planet Next (+1 per Horsard network card) |
| `election.ts` | Diet of Saints (wins Shavvinne; discards Shavvinne civils after the election), Divine Inquisitors, Civil Service veto |
| `plays.ts` | Shared building blocks for plays, recruiting, building, Senate, proposals; lane-entry triggers (Model Society, Currency Ballots, Urban Aristocrats); Project Habitat |
| `free-actions.ts` | Kybernetik, Foreign Inc., Century Inc., Architecture Inc., Rebel Inc., Capitol Inc., Intel Network |
| `network.ts` | The network (2026-11-18): which districts are enabled for whom (Consultative Office, Planet Next, East events), moves in and out, cards back to hand when disabled (`syncNetworks`, after every action and step) |
| `choices.ts` | Pending choices: Currency Ballots discard, Urban Aristocrats swap, Intel Network pick, People's Press draw, Space Academy routing (one card) |
| `main.ts` | "As if in hand" zones: hand, network, and Market Dragonara civils with State Enterprise |
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

### Phase 8 — Troubleshooting (done 2026-11-13)

Tools to reproduce and diagnose games that players report as broken. Everything builds on deterministic replay: a game is fully described by its seed and its action list.

- Manual seed entry: start a new game from a typed seed (the menu and `/play?seed=`)
- Game records: export the current game (record version, seed, action list, app build) as a JSON file or copyable code; import one to load that game
- Re-simulate: rebuild a game from its record and step forward and back through its actions, or jump to any action, with every seat's hidden information visible
- Divergence checks: replay validates every action and reports the first one that is illegal or throws, plus engine invariants (card conservation, zone sizes) after each step
- Bug report: one button that bundles the record, the current step, and a short description for the player to send
- Version stamp: records carry the engine version so a record from an older rules build is flagged instead of silently replaying differently

How it works:

| Piece | Where |
| --- | --- |
| Seed entry | Menu → **More options** (a plain GET form to `/play?seed=`); also on `/troubleshoot` |
| Bug report | In-game **Report** (top bar): description + the record → **Download report** (`.json`) or **Copy report code** (`PAX1:` + base64url JSON). `BugReport` and the codec live in `record.ts` |
| Records | `GameRecord` carries `engineVersion` (`ENGINE_VERSION` in `record.ts`) and `build` (git short hash, injected as `PAX_BUILD` by `next.config.ts`) |
| Re-simulate | `/troubleshoot`: paste a code or JSON, open a file, or open this browser's saved game. Step with the slider, buttons, or ←/→/Home/End; view as either seat (both hands face up); tabs for the move list, hidden info (hands, set-aside zones, top of deck, turn and pending choices, the step's events), and the raw state |
| Divergence checks | `simulate()` in `diagnostics.ts` keeps every state, stops at the first move that throws, and runs `invariantIssues()` after each step: no card in two places, card count constant after setup, Senate at 5, Market at most 8, partisans not negative, victory only in `gameOver` |
| Command line | `node --experimental-strip-types --no-warnings scripts/inspect-report.ts <report.json \| PAX1:code \| ->` prints the report, replay health, the moves and events around the reported step, the board there (both hands), and the legal actions. `--step N`, `--around N\|all`, `--state`, `--record`. The `/bug-report` skill (`.claude/skills/bug-report/`) uses it |
| Follow-up | **Play on from here** saves the record up to the current step as this browser's game and opens it in hotseat; **Download / Copy code to here** exports that prefix |

**Bump `ENGINE_VERSION`** whenever a change can make an existing action list replay differently (a rule fix, a new choice, a changed legal action).

Tests: `diagnostics.test.ts` (clean simulation, failure index, invariants, version stamps, share codes, action descriptions).

### Phase 9 — Modes, expansion, then online

- **Done (2026-11-13):** Tourney / Chaotic / Epic as setup options (Chaotic C+D is one `64 & 3` pile). The menu offers all four; `/play?mode=`; records carry `mode` (absent = Standard). Tests: `modes.test.ts`.
- **Done (2026-11-13):** Expansion: Legacy & Diplomacy, as a menu option (`/play?expansion=1`, Foreign Influence `&fi=1`). Records carry `expansion` / `foreignInfluence`.

  | Piece | Where |
  | --- | --- |
  | Card data, art | `lib/cards/expansion.ts`, `public/cards/expansion/` (ingested by `scripts/ingest-tts.py`) |
  | State | `GameState.expansion` (`ExpansionState` in `types.ts`): event deck, box, common area, relations, active victories, East reveal zone, start-of-turn Market snapshot and event costs, election `rowBreak` |
  | Effect queries | `world.ts`: support counts as zero, influence = support, Senate always convinced, icons disabled, military lead, decree flip, East reveal and take, victory activation, relation leads |
  | Buying, legacy, setup | `events.ts`: `setUpExpansion`, `buyEventActions` / `applyBuyEvent`, legacy discard and activation |
  | Event Market | `draw.ts`: spots preserved until the income collapse, events in the last 2 spots leave, 1–2 events kept in the Market, two rows of 5 during elections, reset after an election |
  | Victories | `victory.ts`: Military / Popularity / Ideological gated by activation; Cultural (2+ monuments) and Diplomatic (higher relation with 3 of 4 powers) |
  | UI | Menu form (mode + expansion), Market rows with ◆ cost badges, `BuyEventDialog`, World panel (events in effect, relations, victory cards), East free action and reveal, expansion player aid |

  The game board is not drawn as a separate object: its tracks (support, influence, relations, symbols) are already shown on the table. Tests: `expansion.test.ts`.
- **Done (2026-11-13):** Online play. Cost goal: $0 and no extra Vercel usage, so the realtime server is **not** on Vercel.

  | Piece | Where |
  | --- | --- |
  | Server | `server/`: a Cloudflare Worker + one Durable Object per game (`GameRoom`), Workers Free plan, WebSocket hibernation, runtime-answered pings. Stores seed, settings, seat tokens, and actions; rebuilds state by replay; deletes games 30 days after the last move. Deploy steps: `server/README.md` |
  | Protocol | `lib/online/protocol.ts` (HTTP create / join, WebSocket hello / action / undo, per-seat `state` messages) |
  | Hidden information | `lib/game/redact.ts`: each seat's view hides the opponent's face-down hand, deck order, monument and event decks, the box, secret setup picks, and the **seed** (seed + public moves would rebuild every shuffle). Tests: `redact.test.ts` (no leaks over full games; a seat's legal actions are identical on its view) |
  | Client | `/online` (create), `/online/[id]` (join, invite link, play). `components/online/online-client.ts` (connection hook with reconnect), `HotseatSession` `remote` mode (one seat, no pass-device gate, actions go to the server) |
  | Config | `NEXT_PUBLIC_PAX_SERVER_URL` on Vercel; `ALLOWED_ORIGINS` in `server/wrangler.jsonc` |

  Seats are tokens in `localStorage` (no accounts). Undo works online with the hotseat rules, checked by the server. Bug reports stay hotseat-only (an online record would reveal the opponent's cards).
  `server/smoke.ts` plays two scripted clients against a running server.

## Victory scene

Added 2026-11-21; text and art from Joe 2026-11-22. When someone wins, `VictoryStory` (`components/game/VictoryStory.tsx`) plays before the results: the victory's scene slowly pulls back while its passage types out, under the title of its band in the rulebooks' "Gallery of the Future" ("A Democratic Future" for Civil, "An Autocratic Future" for Political, "A Censored Future" for Ideological, and so on; base rulebook p. 11, Legacy & Diplomacy p. 7). **See the results** opens `GameOverOverlay`; **Skip** or Escape goes there at once, and a click or Enter finishes the passage. Reduced motion (or Motion: off in Settings) shows it still and in full. Lessons (`hideGameOver`) skip both.

The passage is Joe's text for each victory (lightly edited with his OK), filled in from the final table by `victoryPassage` (`lib/game/epilogue.ts`, tested in `epilogue.test.ts`): the winner's party, plus what won it.

| Victory | Filled in |
| --- | --- |
| Civil | the party only |
| Political | two decree objectives the winner met ("Pax Imperium and Profectus"; more than two: the first two in card order) |
| Cultural | the winner's last two monuments, in the order built |
| Diplomatic | every World Power the winner has the higher relation with (West, North, East, South order) |
| Military | the partisan lead, as a word ("the three ambitious partner warlords") |
| Popularity | every district the winner leads by 9+ support |
| Ideological | the ideology: Authority = authoritative order, Science = scientific endeavor, Economy = economic growth, Justice = judicial equality |

The passage is set in Rosarivo Italic, the nearest web font to the rulebook's Kokonor at its light weight (Fondamento, used first, read as bold). The scenes are Joe's band art, already in the band colors (`<Kind> Victory.jpg`, 1204 x 658). `scripts/make-victory-art.py <folder>` trims their frame, enlarges them to 1920 wide, and writes `public/art/victory/<kind>.webp`. The service worker saves them for offline play; their contents are part of its card cache's name, so a redrawn scene reaches installed apps under the same file name.

## Table moments

Added 2026-11-24, so the game's turning points don't pass in silence: the parties revealed, and each election opening and being counted. `components/game/TableMoment.tsx` queues and shows them; the screens are in `PartiesMoment.tsx` (styles under `.parties-*` in `globals.css`) and `ElectionMoment.tsx` (`.election-*`); the timing, countdown bar, and hint they share are in `moment-kit.tsx`.

- **The parties are revealed** (`partiesRevealed`, once both parties are chosen): a band in the brand's pax red opens from the middle of the table, both party cards slide in face down and turn up together, a wax seal comes down between them, and the lower party number is lifted out as "Goes first". The lines say who keeps 3 of 4 starting cards and who takes all 4, then the rulebook's "The future of the Vitalic Union awaits." in the victory passage's calligraphy (`components/game/fonts.ts`). The starting-card choice opens after it.
- **The polls open** (`electionStarted`): a ribbon sweeps across the table, the General Election card flips face up, and a line says what changes (which General Election it is, the Market growing to 8 or opening a second row, and what's at stake when more than one came up or it's the final one).
- **The votes are in** (`electionTallied`): each electorate (the four districts in table order, then the Lords) lights up in its winner's color while the score counts up, then an "Elected" stamp, the winner, the tie-break if one decided it, and what follows (decrees to activate, or Civil Victory). The tally event names each electorate's winner (`districts`, `lords`); an online server from before these fields shows the score without the electorates.

`useTableMoments` watches the events behind the position on screen (`HotseatSession`'s `shownHistory`, so a hotseat replay plays elections again for the other player) and queues one moment per turning point; events that disappear (Undo) drop the queue. A hotseat replay skips setup, so when a player takes the device after the parties were revealed on the other player's pick, `showMissed` plays the reveal for them too. While a moment plays, the table holds still: no computer or lesson opponent move, no replay step, no setup or decree choice, no victory scene, no pass-device screen, and a lesson waits to show its end (`RemoteGame.onMoment`). Moments are marked `data-modal`, so a lesson's coach card moves aside or folds. Each screen stays up long enough to read (`readingMs`: a moment to find the text, then about 240 words a minute), with a bar running down and a "Click or tap to continue" hint; a click, Escape, Enter, or Space moves on sooner. Motion: fast speeds up the animations but not the reading time; Motion: off or reduced motion skips the moments. On short screens (a phone held sideways) the reveal tightens its spacing (the `short:` variant, max-height 520px).

## Tutorial (Learn to play)

Added 2026-11-21; restructured 2026-11-22 from Joe's feedback (fewer lessons, and a "climb the ladder before leading your party" story). Eight lessons, each from a prepared position except the last base lesson, which is a whole game. The opponents are the computer's three personalities, met in order of skill:

| Chapter | Opponent | Lessons |
| --- | --- | --- |
| **Town Hall** | Mayor Mildred: spotted your talent, tired of politics, opens doors higher up | 1. **First Day in Town** (civil cards, alliances, the five electorates, hand limit and income; the goal is winning elections). 2. **Crisis at the Doorstep** (take a conspiracy from the Market before Mildred does, wipe her stronghold, support piles, and win the final election: Civil Victory). No politics: the Senate, decrees, monuments, the victory band, and the special-action cards are off the screen, and the Politics step passes by itself. |
| **The Capital** | Chancellor Crane, Mildred's old friend: the over-the-table game | 3. **The Legislative Branch** (the Politics step, Influence Senate, Propose Policy for Economic Reform, symbols; Ideological Victory is out of reach with a party plus policies, 3 copies at most). 4. **The Executive Branch** (an election with two General Elections, two decrees, Political Victory; the decree's Economy symbol also makes Ideological reachable). |
| **The Old Palace** | Grand Vizier Vex, retired since the Vitalic Wars, still playing politics in the shadows | 5. **The Untold Stories** (Rebel Inc.'s free recruit, building a monument, then Military or Popularity Victory). 6. **A Star is Born** (a whole game from the party deal, against Vex at the Normal level: parties, private symbols, any of the five victories). |
| **Foreign Ministry** (optional) | Vex | 7. **Foreign Affairs** (events, cost, relations). 8. **Into the Future** (inactive victories, legacy events, Cultural and Diplomatic Victory, the two only the expansion has). |

| Piece | Where |
| --- | --- |
| Positions | `lib/tutorial/scenario.ts`: a compact table description (hands, lanes, support piles, Senate, Market, deck top, policies, decrees, monuments, an election under way, expansion relations and events) built into a full `GameState`. Unplaced cards fill the deck (fixed shuffle); the General Elections sit deep unless placed. A lesson can instead be `{ newGame: true }`: a standard base game from setup, dealt afresh for every attempt. |
| Lessons | `lib/tutorial/lessons/base.ts`, `lessons/expansion.ts`. Each has steps (`explain`: read, then Next; `do`: one move, anything else gets a hint; `free`: any legal move until the turn ends or someone wins), the opponent's scripted moves with their lines, intro / outro / loss lines, the table areas to dim (`dim`) or leave off the screen (`hide`), `skipPolitics` (the Politics step passes by itself for both players and the turn panel leaves it out), and `opponentLevel` (the computer's strength once the script runs out, if not the persona's). |
| Several-click moves | `HotseatSession` reports where the player is in a move (`onStage`: a card picked for its district, a Senate seat ready, cards picked to recruit or build, the parts of a proposal, an event being bought). A `do` step's `stages` notes replace its body and spotlight for that part, so the coach always says what to click next. A step asking for one policy or one way to play an event leaves only that choice open in the policy chooser and the event dialog (`canPick`, `allowUse`, from the same `allow` filter). |
| Runner | `lib/tutorial/runner.ts` (pure): which step shows (a step waits for the learner's next decision unless marked `now`), which moves the step allows, the opponent's next move (script first, then the computer), skipped Politics steps, completion and failure. |
| Cast | `lib/tutorial/cast.ts`: names, portraits, and colors from `ai.ts` personas, plus role. |
| UI | `/learn` (lesson list, progress in `localStorage` `pax-tutorial-v1`, lessons unlock in order or all at once), `/learn/play?lesson=<id>` (`TutorialSession`: drives `HotseatSession` through its `remote` interface with `allow`, `label`, `view`, and `hideGameOver`; `CoachCard`: a non-blocking note with a spotlight and the opponent's lines, docked at the top on phones and moved to a corner while a decision overlay is open). Dimmed areas: `.tutorial-dim-<anchor>`; hidden ones `.tutorial-hide-<anchor>`, and `.tutorial-skip-politics` hides the turn panel's Politics step (`globals.css`). |

The notes quote rules and numbers. When a rule or card changes, update the lessons. `lib/tutorial/lessons.test.ts` plays every lesson through the engine (guided moves legal when asked, the opponent's script legal when due, free stretches finishable, card count constant) and checks each number the coach quotes. It also plays the whole game of A Star is Born with the computer in the learner's seat (on several deals, so a strong player beats Normal Vex at least once), and checks that Town Hall skips Politics for both players.

## Computer opponent

Reworked 2026-11-24 so Hard is harder and games against the computer don't all look alike (it used to play civil cards and push the Senate every game, and almost never built a monument or proposed a policy).

| Piece | Where |
| --- | --- |
| Moves | `ai.ts`: `chooseAiAction`, the three levels, Hard's search, the personas |
| Judging a position | `ai-score.ts`: `positionScore(state, seat, weights)` over victory progress and threats, the election outlook, district margins, monuments, Lords, and its own hand's plans. `CLASSIC` holds the weights |
| Agendas | `ai-agenda.ts`: what a seat plays for and how that shifts the weights |
| Measuring | `node --experimental-strip-types --no-warnings scripts/ai-match.ts <level> <level> [games] [--expansion] [--from N]`: wins, how games ended, moves per game, agendas, thinking time. One game is luck; compare a few hundred (run several `--from` ranges in parallel) |

**Agendas.** Elections (Civil: electorates, Lords, elections won), Decrees (Political: win elections, meet decrees), Military (recruit: collect three cards of a district it has support in), Popularity (pile support into one district), Ideology (its symbol), Monuments (hoard one district's cards and build; a built monument is worth more than the set it costs), and Diplomacy (expansion, once the Diplomatic victory is active). Each game a seat leans toward one (a draw from the deal, nudged by its party: Trinity toward Elections for Roman Basilica, Conservative toward Decrees for Smart Doctrine), weighed against how promising each agenda looks on the board. The leaning fades as elections pass. It keeps its agenda until another is better by a margin, so it switches about once a game rather than flip-flopping; the memory resets on Undo or a new game. Normal leans hardest (most personality); Hard follows the board more and leans less.

**Hard's search.** A beam search over its own turn (6 partial turns kept, 8 decisions deep). The four best plans, by first move, are played on through the opponent's reply (Normal-style, from a guessed hand: their face-down cards dealt again from everything Hard can't see, face-up Market takes kept) and its own next turn, on three guesses of the hidden cards. The same guesses are used for every plan, so luck doesn't pick between them. The plan's score and the board after its next turn are blended (0.25 / 0.75), each guess capped at ±5000 so one guess can't decide. About 100 ms a move on a desktop (longest about 300 ms).

**Portraits** (2026-11-24). Each persona has a portrait (`AiPersona.portrait`, `portraitCredit`, `color`): an old-master painting in the public domain from the Art Institute of Chicago, which releases those images under CC0. Mayor Mildred is *Portrait of a Lady* (French or Swiss, 1725–50), Chancellor Crane *Portrait of a Man* (attributed to Nicolaes Maes, c. 1655), Grand Vizier Vex *An Old Man in a Fur Cap* (Karel van der Pluym, c. 1655). `scripts/make-cast-art.py` crops them from the museum's images (its docstring has the links) into `public/art/cast/<id>.webp` (256 px). `components/game/Portrait.tsx` shows one in a ring of their color, drawn inside its own box so it never covers what it sits beside: in the difficulty picker (the credit on hover), in a game (ringed in the opponent's seat color: beside the name and party on desktop, on the party card's corner on phones so the name keeps its room), and in the tutorial (lesson hub, coach card, lesson end). The service worker saves them for offline play with the victory scenes.

**Where it stood (2026-11-24, 200 games each unless noted).** Old Hard beat Normal 68%. New Hard beat old Hard 54% (108/200) and Normal 83% (83/100). New Normal against old Normal: 49% (agendas change its play, not its strength). A self-play hill climb over the `CLASSIC` weights found no single change worth more than ±2%, so the gains came from search and plans, not weights. Measured but not kept: weighing the board right after the opponent's reply (worse, it favored passive plans) and only steering away from plans the opponent wins against (no gain).

### The Ninth

Added 2026-11-24: the hardest opponent, "the harder the better", with an ominous persona (Ian's brief: the mystery of Amon in StarCraft II, without the space squid). The ninth party that was never on any ballot (the game has eight). No face: a dark disc with a faint ember *IX* (`public/art/cast/ninth.svg`). It speaks only at turning points (`AiPersona.voice`): a line when the parties are revealed (in place of the rulebook's), and one when an election is counted, won or lost (`moment-kit.tsx` `VoiceLine`, through `TableMoment`'s `voice`). Its tagline is "There were always nine." (Ian, 2026-11-25: players may wonder "nine what?", which suits it).

Ian's goals (2026-11-25): use every victory condition when the game offers it (Joe noticed the other levels rarely use or watch for Ideological), beat Hard more than 90% of the time, keep improving as it's trained more, and play Legacy & Diplomacy too.

**How it plays.** Hard's search (`planTurn`), judging positions with a learned evaluator instead of `positionScore`: a small network (`lib/game/ai-net.ts`) reading a position as one seat sees it (`lib/game/ai-features.ts`: never the opponent's face-down cards) and giving its chance to win. The rules stay in TypeScript; Python only learns (`training/README.md` has the whole loop: self-play records, encoding, training with TD(λ) targets, measuring). The network runs in plain TypeScript, synchronously: no ONNX runtime, works offline. Two networks with the same inputs: `public/ai/evaluator.bin` for the base game and `public/ai/evaluator-expansion.bin` for Legacy & Diplomacy (one network for both played one of them worse; see round 4). The browser fetches both when a game against The Ninth starts (`components/game/ninth.ts`) and holds its first move until they arrive; the service worker saves them for offline play. Without the main one it plays as Hard; without the expansion one, it plays the expansion with the main one if that learned expansion games (its header says: `NetHeader.expansion`), else as Hard.

**What the evaluator sees** (`pax-features-5`): civil cards counted per district and place (in hand, on each tableau, Senate, Market, seen in the opponent's hand, unseen); alliances and conspiracies named per place; monuments, parties, policies, decrees (active, and who meets them), the phase, election flags; dense counts and margins (support, influence, electorates, electors, Lords, partisans, every victory's progress for both, symbols); timing (deck mode, expected cards until the next and the final General Election, from the mode's piles); and the expansion (each event's place, active victories, relations, cheapest event, Cultural and Diplomatic progress). A victory's condition counts as met only while that victory is active, and "met but inactive" is its own input: in Legacy & Diplomacy most victories start inactive, and before `pax-features-5` the evaluator once rated a three-power Diplomatic lead at 77% to win while Diplomatic Victory was never activated (Hard won by Civil).

**Rounds.** Each round's games are played by the last round's evaluator (`netquick:`, Hard's search for one turn), against itself, against Hard, and against opponents fixed on one agenda (`quick:<agenda>`, `quick:any`) so every road to victory, and its defence, is in the data. Each round trains on all games so far: first on results, then on TD(0.7) targets bootstrapped from that.

| Round | Games (all rounds) | Validation | Against Hard (base) | Notes |
| --- | --- | --- | --- | --- |
| 1 (2026-11-24) | 15,000 (Hard's search for one turn, Normal) | 64.8% of winners, loss 0.606 | 81% (65/80) | `pax-features-2`, base game only |
| 2 | 26,000 (+ its self-play, an Ideology-fixed opponent, 1,500 expansion games) | 68.8%, 0.562 | 80–85% | beat round 1 head to head 13–7; expansion 80% (8/10) |
| 3 (2026-11-25) | 32,000 (+ 2,000 games against Hard, `quick:any`, expansion) | 69.7%, 0.556 | 91% (73/80) | beat round 2 13–7; expansion 78% (31/40) |
| 4 (2026-11-25, shipped) | 38,900 (+ 1,200 base and 5,700 expansion games, against Hard and `quick:any`, mixed deck modes), `pax-features-5` | 70.0%, 0.550 (base network, base games) | 92.5% (111/120) | two networks; expansion 87.5% (70/80) |

Round 4 tried one network for both games first: with expansion positions weighted ×2 it won 90% of expansion games (36/40) but only 80% of base games (64/80); unweighted, 88% base (70/80) and 80% expansion (32/40). Trained apart, the base network (`--expansion-weight 0`) won 94% on those 80 base deals and the ×2 network kept its 90% in the expansion; on 80 fresh deals, the shipped pair won 90% (36/40) and 85% (34/40).

How it wins against Hard (round 4): mostly Popularity, then Military and Political, sometimes Civil; in the expansion, Political, Diplomatic, Popularity, and Civil. Ideological Victory is rare on both sides (the condition is hard to reach: even an opponent fixed on Ideology wins that way only one time in ten), but The Ninth both uses it (about 1–2% of its wins in self-play) and beats an Ideology-fixed opponent 90–95% of the time.

Its losses to Hard are mostly Political and Civil Victories (round 3: mostly Political: Hard wins an election, activates two decrees it can meet, and meets the second before The Ninth reacts (game 715 of `ai-match.ts --from 701`: Hard met Academia, partisans were level, and one recruit met Imperium). The evaluator has the ingredients (per-district influence, partisans, decrees each side meets) but no direct "one step from a second decree" signal).

**Next.** (1) More rounds: generate with the shipped pair (`netquick:` with each network, against Hard, `quick:any`, and itself, base and expansion, mixed deck modes), encode, train both networks again bootstrapped from the last round, and ship when they beat the shipped ones on the same deals. (2) Civil and Political losses: a decree outlook in the features was tried on 2026-11-25 (per side, active decrees met, active decrees one step away, and the best influence lead) and not kept: on round 3's games it trained a hair better (validation loss 0.5548 against 0.5560) but beat Hard less often on the same 80 deals (86% against 91%). Worth trying again with much more data. (3) Ideological Victory: The Ninth defends against it well but rarely wins that way (none in round 4's 200 measured games); opponents fixed on Ideology in the self-play mix are how it learns that road.

Measured on the way, and not kept: naming every card (`pax-features-1`) memorized games instead of generalizing; an agenda nudge on the evaluator (`setNinthEvaluator({ lean })`, off) didn't widen its victories and cost games; predicting the reply with the evaluator (`reply`, off) and a wider search (`width`, default) didn't win more; a bigger network (256×64) was no better on this much data; TD λ 0.5 and 0.9 were no better than 0.7. Timing features (`pax-features-4`) didn't change Standard-mode validation (the deck size already told it) but are there for the other modes.

**Training on this laptop.** 15 GB of memory with only about 2–3 GB free, and Claude Code stops background jobs when memory runs critically low: keep to about 6 self-play processes (`node --max-old-space-size=700`), encode one file at a time (the encoder streams), and don't overlap training with heavy generation. Self-play and encoding both pick up where they stopped.

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
- Civil Victory at the final election; Roman Basilica owner wins Civil at once by winning the 3rd election (3rd General Election card), or at the final election whoever wins it
- Turn order unchanged across an election (GE revealed in A's income → B's turn opens the phase)
- De Jures: lower or tied per district; no civil cards = fail, even when neither player has any (2026-11-17)
- Network: moves in and out during your turn, cards back to hand when disabled (Joe's Consultative Office report), Planet Next +1 per Horsard network card, exclusivity
- Dragon Gate extra draw at end of income; General Election there does not interrupt
- United Front sends Smarbbit discards to the non-discarding player

## What not to do yet

- Accounts, lobby, matchmaking, or persistence beyond `localStorage` replay
- A rules interpreter that reads English card text
- Pixel-perfect Hearthstone animations
- Encoding an answer to anything in [open-questions.md](open-questions.md)
