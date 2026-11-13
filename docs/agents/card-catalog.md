# Card catalog

Base-game and Legacy & Diplomacy cards, where their current faces live, and how to encode them.

Marketing site: [pax-corruption-marketing.vercel.app](https://pax-corruption-marketing.vercel.app/).

## Sources of truth

| Source | Status | Use for |
| --- | --- | --- |
| Tabletop Simulator save **"Pax Corruption - Full Game"** (`C:\Users\ianpe\OneDrive\Documents\My Games\Tabletop Simulator\Saves\TS_Save_1.json`) and its cached sheets in `...\Tabletop Simulator\Mods\Images\` | **Current** (2026-11) | Printed card text and art |
| Base rulebook PDF (`C:\Repos\pax-corruption-marketing\public\rulebook\pax-corruption-rulebook.pdf`) | **Current** | Rules, components, examples |
| `C:\Users\ianpe\Downloads\Resized to 825x1125\...` (what `public/cards/` was built from) | **Stale** for alliances, monuments, the Republican party, executive power, and player aids | Civil cards, conspiracies, policies, overviews (unchanged) |

When text in `lib/cards` disagrees with the TTS faces, the TTS faces win.

### TTS deck map

`TS_Save_1.json` has 21 `CustomDeck` entries. Sheets are 10×7 grids of 880×1232 cards (8800×8624 px). Cached file name = the URL with every non-alphanumeric character removed. `CardID = deckId * 100 + index`.

| Deck | Contents |
| --- | --- |
| 2, 3 | Main deck (108), including real **General Election** art (replaces the placeholder SVGs) |
| 4 | District overviews + policy overviews (8) |
| 5 | Monuments (8) |
| 6 | Parties (8) |
| 7 | District policies (4 double-sided; unique backs = the other side) |
| 17–20 | Decree objectives (face = inactive side, back = active side) |
| 21 | Base player aid (Victories / Actions) |
| 1 | Expansion player aid (Actions / Victories) |
| 8, 9, 10, 11 | Expansion events: East, North, South, West (10 each, TTS order = `EVENTS` in `lib/cards/expansion.ts`) |
| 12–16 | Expansion victory cards: Military, Ideological, Popularity, Cultural, Diplomatic (face = inactive, back = active) |

## Ingest status

**Current as of 2026-11-11.** `scripts/ingest-tts.py` sliced the TTS sheets into `public/cards/` (main deck, monuments, parties, decrees, player aids, General Election), and `lib/cards` was re-transcribed:

- 15 alliance faces with new text (✱ below); every alliance's `OR` line now reads "It counts 2x many votes in the Senate." `AllianceCard.senateVotes` replaces `policySupportValue`.
- `horsard-a-5` renamed **Century Club → Century Inc.**
- Planet Next, Roman Basilica, Model Society, Smart Doctrine: new text and effect ids.
- Republican Party starting cards: Century Inc.; 8 – Civic Council; 6 – Monarch Family; **5 – Patrons of Art**.
- Executive power removed (art and catalog).
- Decree objectives added (`DECREES`, `public/cards/decrees/`; square 972×972 art).
- One General Election face (`public/cards/deck/election.png`) replaces the placeholder SVGs.

**Expansion (2026-11-13):** `public/cards/expansion/` holds the 40 events (`events/<power>-<slug>.png`, plus `back.png`), the 5 victory cards (`victories/<id>.png` and `<id>-inactive.png`, 700×700), and the player aid (`aids/`). `lib/cards/expansion.ts` transcribes every event: name, power, district, effect, civil-side name and value (printed upside down in the corners, like base civils). In the catalog, a regular event's id resolves to its **civil side** (a `CivilCard`); legacy events are `kind: "event"`. Use `getEvent` for the event side.

Re-run the script whenever Joe updates the TTS save: `python scripts/ingest-tts.py` (needs Pillow). Then compare text against `lib/cards` by hand; the script only moves art. If the dev server shows stale card images afterwards, delete `.next/dev/cache/images`.

## Components

| Group | Count | Contents |
| --- | --- | --- |
| Main deck | 108 | Per district: 6 alliance + 18 civil + 2 conspiracy (×4 = 104), plus 4 General Election |
| Double-sided | 15 | Partisans marker, 4 district policies, 8 support markers, 2 player aids |
| Special | 24 | 4 district overviews, 4 policy overviews, 8 monuments, 8 parties |
| Decree objectives | 4 | Inactive / active sides |

## Anatomy

Shared header: district crest (top-left), type icon (top-right).

| Type | Type icon | Body |
| --- | --- | --- |
| Civil | Person bust, district color | Name, large influence number. The number repeats upside-down in the corners (hand convenience, not a second stat). 6 and 9 are underlined. |
| Alliance | Handshake (Financial Bankers has 2) | Ability text, then `OR` / "It counts 2x many votes in the Senate." |
| Conspiracy | Flame | Flavor + "Remove and discard ALL cards in {district}, then discard this conspiracy." |
| Party | Political symbol + order number | Flavor, name, 4 starting cards (colored by **district**), guaranteed monument |
| Monument | Equestrian statue | Ability + political symbol |
| Policy | Temple | Ability + political symbol |
| Decree objective | Rosette (inactive) / "Pax" stamp (active) | Inactive: "Win an election to activate this decree." Active: condition + political symbol |

District face colors: Dragonara yellow, Horsard blue, Shavvinne green, Smarbbit pink.

## Political symbols

| Id | Printed as | Theme |
| --- | --- | --- |
| `atom` | Nucleus + orbits | science |
| `chart` | Rising bar chart with arrow | economy |
| `crown` | Three-point crown | authority |
| `scales` | Balance scale | justice |

Color is cosmetic. Sources: party and monuments (private, owner only), active policies and active decrees (shared). Smart Doctrine adds private copies matching active decrees. Scoring rules: [game-rules.md#ideological-victory](game-rules.md#ideological-victory).

## Data shape

Implement entries as typed objects, not free-form strings the UI parses.

Closed sets live as const objects in `lib/cards/schema.ts` and `lib/cards/effects.ts` (`District`, `Symbol`, `CardKind`, `EffectId`, `TriggerWhen`, …). Use them at call sites. Do not use TypeScript `enum`. Main-deck instance ids (`dragonara-a-1`) stay strings; they double as filenames.

Every main-deck card: `id`, `kind`, `district` (except election), `name`, `art`, `copies`.

- Civil: `influence`. Senate votes: 1.
- Alliance: `allianceSymbols` (handshake count, default 1), `effects`, `senateVotes: 2` (replaces `policySupportValue`).
- Conspiracy: `district` is the target. Senate votes: 1.
- Party: `order` 1–8, `symbol`, `startingCards[4]`, `guaranteedMonumentId`.
- Monument: `district`, `symbols[]`, `effects`.
- Policy: `district`, `side: "a" | "b"`, `symbol`, `effects`.
- **Decree objective** (new): `id`, `inactiveName`, `activeName`, `symbol`, `condition` (an `EffectId`-style id, not text).

Ability ids are a registry in the engine. New card text means a new handler or a reused generic one. Never regex card text at runtime.

## Parties

| Order | Party | Symbol | Starting cards (district) | Monument |
| --- | --- | --- | --- | --- |
| 1 | Trinity Party | crown | Architecture Inc. (S); Divine Inquisitors (S); 9 – Roman Church (S); 8 – Fundamentalists (M) | Roman Basilica |
| 2 | Conservative Party | crown | Capitol Inc. (M); Project Habitat (M); 8 – Conservatives (M); 8 – Estate Moguls (H) | Smart Doctrine |
| 3 | Progressive Party | atom | District Governor (D); Urban Aristocrats (D); 8 – Grand Justices (D); 5 – Royal Academy (S) | Intel Network |
| 4 | Innovative Party | atom | Financial Bankers (H); Foreign Inc. (H); 8 – Professors (D); 7 – Regulators (H) | Space Agency |
| 5 | Liberal Party | chart | Rebel Inc. (S); 8 – Film Industry (H); 8 – Liberalists (M); 4 – Influencers (H) | Planet Next |
| 6 | Global Party | scales | People's Press (M); 8 – Export Giants (H); 7 – Robot Factories (D); 6 – Export Bureau (D) | Dragon Gate |
| 7 | Socialist Party | scales | State Enterprise (D); 9 – Communists (M); 8 – Socialists (M); 5 – Local Politicians (S) | Model Society |
| 8 | Republican Party | chart | **Century Inc.** (H); 8 – Civic Council (D); 6 – Monarch Family (S); **5 – Patrons of Art** (S) | Civil Service |

D = Dragonara, H = Horsard, S = Shavvinne, M = Smarbbit. Where a name has several copies (District Governor, Foreign Inc.), the starting card is the one in the listed district.

Guaranteed monuments that share a district: Progressive + Global (Dragonara), Innovative + Liberal (Horsard), Trinity + Republican (Shavvinne), Conservative + Socialist (Smarbbit). Ruled 2026-11-11: that's fine; available monuments may share a district.

## Alliances (base, 24)

Current printed text. Every alliance also prints `OR — It counts 2x many votes in the Senate.` (omitted below). ✱ = changed in the 2026-11 revision (now matched by `lib/cards/deck.ts`).

| Id | Name | Text |
| --- | --- | --- |
| `dragonara-a-1` | Order of Knights | Each of your Dragonara civil cards now gives you +1 influence. Conspiracy cannot be played in Dragonara. |
| `dragonara-a-2` | Kybernetik Inc. ✱ | As a free action, you may draw to hand limit. If you do, **end your action step** and skip income step this turn. |
| `dragonara-a-3`, `-a-4` | District Governor ✱ | This card silences opponent's alliances in Dragonara. The policy in Dragonara cannot be targeted by **policy proposal**. |
| `dragonara-a-5` | Urban Aristocrats | After playing a civil card in Dragonara, you may swap one of your civil cards with an opponent's in Dragonara. |
| `dragonara-a-6` | State Enterprise ✱ | You treat Dragonara **civil** cards in market as if they are in your hand when you do your main or free actions. |
| `horsard-a-1`, `-a-2` | Order of Knights | (Horsard version of the above) |
| `horsard-a-3` | Foreign Inc. ✱ | As a free action, you may once **influence Senate** with a Horsard card, then draw a card. |
| `horsard-a-4` | District Governor ✱ | (Horsard version of the above) |
| `horsard-a-5` | **Century Inc.** ✱ (was Century Club) | As a free action, **play an alliance** to replace your own or opponent's alliance, even when districts are unmatched. |
| `horsard-a-6` | Financial Bankers (2 handshakes) | This card counts as 2 alliances during elections. This ability cannot be silenced. |
| `shavvinne-a-1` | Order of Knights | (Shavvinne version) |
| `shavvinne-a-2` | Architecture Inc. ✱ | As a free action, you may **construct a monument with only 4 cards of the same matching color**. |
| `shavvinne-a-3` | Foreign Inc. ✱ | (Shavvinne version of Foreign Inc.) |
| `shavvinne-a-4` | Rebel Inc. | As a free action, you may recruit partisans. |
| `shavvinne-a-5` | Diet of Saints | You always have higher influence in Shavvinne. Discard ALL civil cards in Shavvinne after an election. |
| `shavvinne-a-6` | Divine Inquisitors ✱ | You win Shavvinne during elections **if this is the only alliance card in the district**. |
| `smarbbit-a-1`, `-a-3` | Foreign Inc. ✱ | (Smarbbit version of Foreign Inc.) |
| `smarbbit-a-2` | Capitol Inc. ✱ | As a free action, you may **propose new policy**. |
| `smarbbit-a-4` | People's Press | When drawing from deck, you may now draw from your Smarbbit support pile instead. |
| `smarbbit-a-5` | District Governor ✱ | (Smarbbit version) |
| `smarbbit-a-6` | Project Habitat | Conspiracy no longer discards your already played civil cards in Smarbbit. |

Rulings that still apply:

- **Two District Governors** in the same district silence each other: no alliance ability is active there, and the policy is no longer frozen (rulebook FAQ).
- **People's Press**: you may look through your Smarbbit support pile and choose the card.
- **Century Inc.** (ruled 2026-11-11): see the Century Inc. entry under Resolved in [open-questions.md](open-questions.md). In short: once per turn; counts as playing an alliance; swaps out an existing alliance (yours or theirs); in the opponent's tableau the new alliance becomes theirs; district-named text follows the printed district, but conspiracies in the occupied lane wipe it.

## Conspiracies (8)

All share one effect: wipe the printed district, then discard the conspiracy.

Dragonara: Theft of Thunder, Broken Chains. Horsard: Grassroot Media, Idle Proliferation. Shavvinne: Q'iat av Shah Riot, Hub of Assassins. Smarbbit: Separatists of the Ublozisky Plateau, Power Vacuum.

## Civil cards (72)

Unchanged. Each district has 18 civil cards valued 3–9. `lib/cards/deck.ts` (`*-b-*`) matches the current faces name-for-name and value-for-value.

## Decree objectives (4)

| Id (suggested) | Inactive | Active | Symbol | Condition |
| --- | --- | --- | --- | --- |
| `decree-imperium` | Unruly Clans | Imperium | crown | Have more partisans than opponent does. |
| `decree-profectus` | Turmoil Land | Profectus | chart | Have 7+ more total support than opponent does. |
| `decree-academia` | Emigration | Academia | atom | Have 20+ more influence than opponent in a district. |
| `decree-de-jures` | Class Schism | De Jures | scales | Have the lowest (or tie for lowest) civil card in all 4 districts. |

## Markers (UI only)

Support markers (+1 / +3 sides, per district) and the partisans marker (×1 / ×2) are references for numbers the engine already tracks. Render badges; do not model them as cards.
