# Card catalog

Base-game cards and how to encode them. Expansion art exists on disk but is out of scope until the base game is playable.

Marketing site: [pax-corruption-marketing.vercel.app](https://pax-corruption-marketing.vercel.app/).

## Art on disk

Source (not in git yet):

`C:\Users\ianpe\Downloads\Resized to 825x1125\Resized to 825x1125`

| Folder | What |
| --- | --- |
| `Common Back/<District>/` | Main-deck faces. `A-*` alliance, `B-*` civil, `C-*` conspiracy |
| `District Back/` | 4 district overviews + 4 policy overviews |
| `Monument Back/` | 8 monuments |
| `Party Back/` | 8 parties |
| `Double Sided/` | Policies A/B, executive power, markers, player aids |
| `Common Back.png` etc. | Card backs (common / district / monument / party) |
| `Expansion Pack/` | Ignore for v1 |

Counts match the rulebook: 4 districts × (6 alliance + 18 civil + 2 conspiracy) = 104, plus 4 general election cards.

**General election faces are not in this folder.** Use a placeholder back/face until official files are provided.

Copy into the app as `public/cards/...` (or a web-sized derivative). Keep filenames stable; the catalog points at them.

Suggested in-repo layout after ingest:

```
public/cards/
  backs/{common,district,monument,party}.png
  districts/{dragonara,horsard,shavvinne,smarbbit}/{overview,policy-overview}.png
  parties/party-1.png … party-8.png
  monuments/{intel-network,dragon-gate,...}.png
  policies/{dragonara-a,dragonara-b,...}.png
  executive/{emergency-state,legal-review}.png
  deck/{dragonara-a-1.png,...}
```

## Anatomy (from printed cards)

Shared header: district crest (top-left), type icon (top-right).

| Type | Type icon | Body |
| --- | --- | --- |
| Civil | Person bust, district color | Name, large influence number, same number printed upside-down in the corners (physical-hand convenience, not a second stat) |
| Alliance | Handshake | Ability text, then `OR` / "counts 2× for policy support in {district}" |
| Conspiracy | Flame | Flavor + "Remove and discard ALL cards in {district}, then discard this conspiracy" |
| Party | Political symbol + order number | Flavor, name, 4 starting-card rows, guaranteed monument |
| Monument | Equestrian statue | Ability + political symbol |
| Policy | Temple | Ability + political symbol |
| Executive | President hat or courthouse | Condition + yellow ability band |

District face colors: Dragonara cream, Horsard blue, Shavvinne green, Smarbbit pink.

## Political symbols

Four types. Color is cosmetic.

| Id | Printed as |
| --- | --- |
| `atom` | Nucleus + orbits |
| `chart` | Rising bar chart with arrow |
| `crown` | Three-point crown |
| `scales` | Balance scale |

Sources: party (owner only), constructed monument (owner only), active district policy (both players). **Smart Doctrine** grants the owner one of each type.

## Data shape

Implement catalog entries as typed objects, not free-form strings the UI parses.

Closed sets live as const objects in `lib/cards/schema.ts` and `lib/cards/effects.ts` (`District`, `Symbol`, `CardKind`, `EffectId`, `TriggerWhen`, …). Use those at call sites so the editor can complete them. Do not use TypeScript `enum`. Main-deck instance ids (`dragonara-a-1`) stay strings — they are filenames, not a closed design set.

Every main-deck card needs at least: `id`, `kind`, `district` (except election), `name`, `art`, `copies` (usually 1; civil values repeat as distinct names).

Civil: `influence: number`.
Alliance: `allianceSymbols: number` (handshake count, default 1), `effects`, `policySupportValue: 2`.
Conspiracy: same wipe effect; `district` is the target.
Party: `order: 1–8`, `symbol`, `startingCardIds[4]`, `guaranteedMonumentId`.
Monument: `district`, `symbol[]`, `effects`.
Policy: `district`, `side: "a" | "b"`, `symbol`, `effects`.

Ability `id`s are a registry in the engine (`lib/game/abilities/`). New card text = new handler or a reused generic one. Do not regex card text at runtime.

## Parties (base)

| Order | Party | Symbol (from card) | Starting names (search the deck) | Monument |
| --- | --- | --- | --- | --- |
| 1 | Trinity Party | crown | Architecture Inc.; Divine Inquisitors; 9 – Roman Church; 8 – Fundamentalists | Roman Basilica |
| 2 | Conservative Party | crown | Capitol Inc.; Project Habitat; 8 – Conservatives; 8 – Estate Moguls | Smart Doctrine |
| 3 | Progressive Party | atom | District Governor; Urban Aristocrats; 8 – Grand Justices; 5 – Royal Academy | Intel Network |
| 4 | Innovative Party | atom | Financial Bankers; Foreign Inc.; 8 – Professors; 7 – Regulators | Space Agency |
| 5 | Liberal Party | chart | Rebel Inc.; 8 – Film Industry; 8 – Liberalists; 4 – Influencers | Planet Next |
| 6 | Global Party | scales | People's Press; 8 – Export Giants; 7 – Robot Factories; 6 – Export Bureau | Dragon Gate |
| 7 | Socialist Party | scales | State Enterprise; 9 – Communists; 8 – Socialists; 5 – Local Politicians | Model Society |
| 8 | Republican Party | chart | Century Club; 8 – Civic Council; 7 – Emirates; 6 – Monarch Family | Civil Service |

Starting-card colors on party faces match **district**, not card kind: green Shavvinne, blue Horsard, orange Dragonara, red/pink Smarbbit.

Party symbol colors follow the party, not the monument district. Encode the **type** only.

## Main deck file map

Per district folder `Common Back/<District>/`:

- `A-1` … `A-6` — alliances
- `B-1` … `B-18` — civil
- `C-1`, `C-2` — conspiracies

Verified examples:

- `Dragonara/A-1` = Order of Knights (Dragonara civil +1 influence; conspiracies cannot be played in Dragonara)
- `Dragonara/B-1` = Technocrats (civil 9)
- `Dragonara/C-1` = Theft of Thunder (standard Dragonara wipe)
- `Horsard/B-8` = Consumer Brands (civil 4)

**Phase 0 work:** walk every PNG, record `id`, `name`, `kind`, `district`, `influence` / effects. Until that sheet exists, do not implement unique alliance abilities beyond the handful already transcribed.

## Alliances named in rules or starting hands

These must exist in the catalog even before the full walk:

Architecture Inc., Divine Inquisitors, Capitol Inc., Project Habitat, District Governor, Urban Aristocrats, Financial Bankers, Foreign Inc., Rebel Inc., People's Press, State Enterprise, Century Club, Order of Knights, Diet of Saints.

District Governor (Dragonara A-3, and equivalents in other districts if present). Played text: silences opponent’s alliances in its district; that district’s policy cannot be changed via policy referendum. Does **not** block Legal Review. The `OR` line is the usual alliance alternative (tuck as 2× policy support), not a second in-play mode. Two Governors of the same district silence each other, so no alliance ability is active there (FAQ).

People's Press: retrieve a chosen card from a support pile (FAQ: you may look and choose).

Century Club: replace an alliance (FAQ interaction with Order of Knights).

## Executive power

One physical card, two faces. Election winner chooses the face.

| Face | Title | Use |
| --- | --- | --- |
| President | Emergency State | Politics step, only the turn after opponent discarded any card: enter Election Phase |
| Supreme Court | Legal Review | Same timing: remove any policy |

Rulebook phrasing ("added support") is looser than the card. **Card text wins:** opponent discarded any card last turn.

## Markers (UI only)

`Double Sided/` has per-district `+1` `+2` `+3` `+6` support references and `Partisans x1` / `x2`. Render numeric badges; do not model these as cards in engine state.

## Catalog checklist (phase 0)

- [x] Copy art into `public/cards`
- [x] Placeholder for 4 general election faces (`public/cards/deck/election-1.svg` … `4`)
- [x] Typed catalog in `lib/cards/` (108 main-deck incl. elections, 8 parties, 8 monuments, 8 policies, 2 executive faces)
- [x] Each unique ability mapped to an `Effect.id` in `lib/cards/effects.ts` (handlers still unimplemented)
- [x] `npm test` checks starting-hand names, monument links, counts, and art files

Art layout matches the tree above. Duplicate printed alliances (two District Governors in Dragonara, two Order of Knights in Horsard, two Foreign Inc. in Smarbbit) are separate catalog rows with the same `name`.
