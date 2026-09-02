# Pax Corruption — game rules

Source: designer rulebook, FAQ, player-aid cards, and printed card text. Unresolved items live in [open-questions.md](open-questions.md). Do not treat guesses as rules.

Two players, ~30 minutes. Each leads a political party competing to control the Vitalic Union. There are four districts (lanes) and five electorates (the four districts plus the Council of Lords).

## Goal

Win by any one victory path. Victories other than Civil are declared the instant they happen. There is never a simultaneous double win: the first legal declaration ends the game.

| Victory | When | Who wins |
| --- | --- | --- |
| Civil | End-of-phase step 3 of the **final** election (all 4 general election cards are out of the deck) | More election wins; if tied, the winner of that final election |
| Political | Immediately | 3 consecutive election wins |
| Military | Immediately | Recruited partisans 3 or more times more than the opponent |
| Popularity | Immediately | 9 or more more cards in **any one** district support pile than the opponent has there |
| Ideological | Immediately | 4 matching political symbols, and the opponent has fewer than 4 of that type |

Ideological extras:

- Symbol **color does not matter**. Types are `atom`, `chart`, `crown`, `scales`.
- A district policy's symbol is available to **both** players.
- Party and monument symbols are exclusive to their owner.
- Cannot be declared if both players have 4 of the same type.
- Smart Doctrine gives its owner one of each type (not four of one type).

Roman Basilica overrides Civil Victory: its owner always wins Civil at the end of the final election, regardless of election-win count.

## Components (base)

Main deck (108): 24 alliance, 72 civil, 8 conspiracy, 4 general election.

Public / setup cards:

- 4 district overviews, 4 policy overviews
- 4 double-sided district policy cards (plus Neutral, which is "no card")
- 8 monuments, 8 political parties
- 1 double-sided executive power (Emergency State / Legal Review)
- Markers: partisans, per-district support deltas
- Player aids: Actions, Victories (digital: UI chrome, not table cards)

Markers have no rules effect. Digital UI should show the same numbers they exist to track.

## Zones

Per player:

- Hand (limit 5 unless a card raises it; over-limit is legal, you just stop drawing)
- Tableau: civil and alliance cards in play, grouped by district
- 4 support piles (one per district). Always inspectable. Each card = 1 influence in that district unless a card says otherwise
- Policy supporters: cards tucked face-down under the party. Count is public; identities are secret until a referendum
- Consultative Office (only while that Smarbbit policy is active): face-up personal zone beside the player. Move Smarbbit cards **from hand** into it. Cards here are usable as if in hand and do not count toward hand limit
- Party card (permanent)
- Constructed monuments (permanent, next to the party)
- Partisan count (absolute recruits; victory uses the **difference**)

Shared:

- 4 district lanes in a random left-to-right order
- Active policy per district: side A, side B, or Neutral
- Market (5 face-up; 8 during an election phase)
- Draw deck (piles A–E stacked, A on top)
- Available monuments (always 4 face-up, if any remain)
- Monument deck (unused monuments, used to replenish the row)
- Set-aside general election cards
- Executive power (0 or 1 player holds it, one side face-up)
- Election-win history (consecutive and total)

Discard always means "to a support pile" unless the card is a general election or a double-sided public card, which are set aside instead. Default pile: matching **printed district** and **owner**.

**Space Agency** (owner only, whenever they discard): you may send discarded cards to **your** other district piles, at most 1 card per other district. Remaining cards use the default pile. This never moves the opponent’s discards and does not change which cards an action was allowed to spend (Martial Law still looks at printed district).

**United Front:** if the card’s **landing pile** is Smarbbit, it goes to the **non-discarding** player’s Smarbbit pile. If Space Agency routes it to a non-Smarbbit pile, the discarder keeps it.

Cards that land off their printed district still count in the pile they occupy.

## Districts

| Id | Theme | Board color | Overview chart |
| --- | --- | --- | --- |
| `dragonara` | Technocratic | Cream / yellow | Civil-value distribution |
| `horsard` | Commercial | Light blue | Civil-value distribution |
| `shavvinne` | Religious | Mint green | Civil-value distribution |
| `smarbbit` | Populist / media | Pink | Civil-value distribution |

Overview charts count how many civil cards of each value 3–9 exist in that district. They are reference, not a track you move tokens on.

## Setup

1. Shuffle the 4 district overviews and line them up as the 4 lanes. Place each policy overview beside its district. Districts start **Neutral**.
2. Shuffle the 8 party cards. Deal 2 to each player. Each chooses one, reveal together. Unused parties leave the game.
3. Lower party **order number** is first player. First player searches the main deck and takes **3 of the 4** listed starting cards. The other player takes **all 4** listed cards. Those 7 cards are out of the deck for the rest of setup.
4. Put the monuments printed on the two chosen parties into the available-monument row (they will appear). Draw 2 more at random from the remaining 6 so 4 monuments are available. The other 4 form the monument deck.

   **National priorities (advanced, later):** after the 2 guaranteed, reveal 4 of the remaining 6. First player boxes 1, then the other player boxes 1. Available = 2 guaranteed + 2 remaining revealed. The 2 boxed stay out. The 2 never-revealed go into the **monument deck** and can be drawn later when a monument is constructed.

5. Remove the 4 general election cards (if not already set aside). Shuffle the remaining **97** non-election cards. Deal **5** face-up as the market. Build piles A–E from the remaining **92**, inserting general elections as the mode table says. Stack E on the bottom through A on top. That stack is the draw deck.

   Deck check: 104 non-GE − 7 starting cards − 5 market = 92 pile cards, which matches the printed A–E totals.

### Draw-deck modes

How to read a cell:

- `X` — pile of X cards, no election
- `X+1` — pile of X, then put a general election on the **bottom** of that pile
- `X&Y` — shuffle Y general elections **into** X cards

| Mode | Term limit | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- | --- |
| Standard | Random | 5 | 9&1 | 24&1 | 44&2 | 10 |
| Tournament | Fixed | 7+1 | 23+1 | 23+1 | 23+1 | 16 |
| Chaos | Hybrid | 12+1 | 10 | 60&3 (C+D are **one** pile) | — | 10 |
| Epic | Hybrid | 2+1 | 30&1 | 8+1 | 42&1 | 10 |

Use the printed pile sizes. They add up once starting hands (7) and the market (5) are already removed. Chaos is four piles: A, B, combined CD, E. GE placement in Chaos: 1 under A, 3 shuffled into the 60.

After the draw deck exists, the game is ready.

## Turn structure

Players alternate. Each turn: **Action → Politics → Income**.

### Action step

Exactly **one** main action is mandatory. Any number of free actions are optional. Main and free may be done in **any order**, but you may not take a free action that leaves you with no legal main action if a different order would have allowed one.

Each alliance or monument grants its free action **once per turn**.

#### Main actions

1. **Play a civil card** from hand into your tableau in its printed district. It gives influence equal to its number in that district's electorate.
2. **Play a conspiracy card.** Resolve immediately: discard **all** civil and alliance cards in that conspiracy's district (both players) to support piles, then discard the conspiracy itself to its owner's matching support pile.
3. **Play an alliance card** from hand into your tableau in its printed district. Illegal if you already have an alliance in that district (unless a card raises the limit). Default: one alliance per player per district. Ability text is mandatory unless it says "may".
4. **Call policy referendum.** Requires 3+ policy supporters already tucked. Discard 2 cards of the same district from hand, then resolve a full referendum (below).
5. **Recruit partisans.** Discard 3 cards of the same district from hand. Gain 1 partisan. If you now lead by 3+, Military Victory.
6. **Construct monument.** Discard 5 cards of the same district from hand to claim an **available** monument of that district. Place it by your party. Draw a random replacement from the monument deck so 4 remain available if any are left. You cannot spend 5 cards without actually claiming a matching available monument.

#### Free actions

Printed on alliances and monuments. Optional, once per source per turn, only during the action step.

### Politics step

Skippable in whole or in part.

You may use **both** of the following on the same turn (designer: they are both available in the Politics step, not instead of each other).

1. **Executive power** (if you have it). You may use the face-up side only on the turn **immediately after** the opponent discarded **any** card. Printed text (authoritative):
   - **Emergency State:** enter Election Phase now. If that happens, this turn's income occurs **during** the election phase.
   - **Legal Review:** set one district’s policy to Neutral. District Governor does **not** block this.
2. **Political campaign.** Tuck one card from hand face-down under your party as a policy supporter (civil, alliance, or **conspiracy**). Count is public; identity is secret. Each supporter is worth 1 policy support in its printed district, or **2** if it is an alliance. This is not a main action and is not an Action-step free action.

### Income step

Hand limit only gates drawing, never forces discards.

1. If `handSize < handLimit`, take **one** market card of your choice.
2. If still under the limit, draw the top of the draw deck. This still happens during an election phase.
3. Replenish the market to 5 from the deck. **Skip replenish during an election phase.**
4. **Dragon Gate** (if owned): if you have **exactly 4** cards after steps 1–3, draw one more card. A general election here is set aside as usual but does **not** interrupt this step.

If the deck is empty, draws and replenishes give nothing.

If a general election is revealed as a market card or drawn into hand: set it aside, draw a replacement, and trigger an election phase unless one is already in progress. A second election card during an existing election is set aside only (it still counts toward "all 4 are out").

## Policy referendum

Used by the Call Policy Referendum action and by every election's end-of-phase step 2.

Resolve districts **left → right** as laid out at setup. “First player” here is the **setup** first player (lower party order), not the current election first player.

For each district:

1. Both players reveal all policy supporters of that district.
2. Count policy support (1, or 2 if alliance).
3. Higher total **must** change that district’s policy to **the other printed side** or **Neutral**. Tie: no change. Neutral may be active in several districts at once.
4. District Governor (alliance) prevents **that** district’s policy from changing via referendum only. Legal Review still sets the district to Neutral. Supporters are still discarded.
5. Discard all revealed supporters of that district to the appropriate support piles, then move to the next district.

After a full referendum, nobody should still have policy supporters.

## Influence and elections

### What counts as influence in a district electorate

- Your civil cards in that district, each worth its printed number
- +1 per card in **your** support pile for that district (modified by policies such as Populist Forum)
- Policy and alliance adjustments printed on those cards
- Policy supporters **never** add electorate influence

A played alliance is **not** a district elector. It is an elector of the Council of Lords. It does not add district influence unless an ability or policy says so (e.g. Economic Reform: even alliances gain +3 influence in Horsard).

### Council of Lords

Winner: more **printed handshake symbols** on alliances in play across all 4 districts (not 1 per alliance card). Tie: nobody wins it.

### Winning an electorate

You need **strictly more**. Ties: nobody wins that electorate.

Electors awarded to the electorate winner: total **played cards** in that electorate from both players.

- District electorate: played civil cards in that district (alliances do not count here)
- Council of Lords: played alliance cards across all districts

### Election phase

Triggered when a general election is revealed/drawn, or by Emergency State.

Mark who triggered it. Finish the current turn, then run **start of phase**:

1. Fill market to 8 face-up cards (replace any elections you flip while filling).
2. Discard Executive Power (return it to the unowned state).
3. Determine election first player:
   - First election of the game: the player who **did not** just take the triggering turn
   - Later elections: the player who did **not** win the last election (the opposition) **chooses** who goes first this phase

Then players alternate normal turns, except the market is **not** replenished. The phase ends after a turn when the market is empty.

**End of phase:**

1. Determine the election winner: more electorates, then more electors, then incumbency (winner of the previous election; if this is the first election, lower party order number). Winner takes Executive Power and chooses a side. If this is their 3rd consecutive win: Political Victory immediately.
2. Policy referendum (full). **Smart Doctrine:** its owner may swap steps 1 and 2. They must choose at the start of end-of-phase, before either step.

**Planet Next** (if owned) fires immediately **before the winner tally** (step 1, wherever it sits after a Smart Doctrine swap). That player may discard any number of cards from hand. Each discarded card gives **+2 influence this election only** to its printed district, then goes to the matching support pile (Popularity can end the game here).
3. If all 4 general elections are out of the deck, the game ends on Civil Victory (or Roman Basilica). Otherwise continue.
4. Deal a fresh market of 5. The player who did **not** trigger this election takes the next turn. That market deal can immediately trigger another election.

## Card types (rules, not catalog)

**Civil.** District + number. Play to tableau. Influence = number in that district.

**Alliance.** District + handshake icon(s). Play to tableau for text, or tuck as a 2x policy supporter. One per player per district by default. Two District Governors of the same district silence **all** alliance abilities in that district.

**Conspiracy.** Flame icon, printed district. Wipe that district's tableaus (both sides), then discard itself.

**General election.** Never goes to a support pile. Set aside. Triggers (or deepens) an election phase.

**Party.** Permanent. Order number, starting-card list, guaranteed monument, one political symbol.

**Monument.** Permanent once built. Matching-district 5-card cost. Ability + political symbol(s).

**District policy.** One of: printed A, printed B, Neutral. A referendum change in a district is to that district’s other printed side or Neutral. Policy symbols are shared.

## Known policy effects (base)

All districts start Neutral.

| District | Side | Name | Symbol | Effect |
| --- | --- | --- | --- | --- |
| Dragonara | A | Currency Ballots | atom | When you play a card in Dragonara, immediately draw, then discard a card from hand. A GE drawn here does not delay the discard. |
| Dragonara | B | Populist Forum | chart | Each discard in Dragonara provides 2 influence |
| Horsard | A | Economic Reform | chart | Each played card in Horsard, even alliance, gains +3 influence |
| Horsard | B | Market Regulation | crown | Civil cards of 8+ cannot be played in Horsard |
| Shavvinne | A | Martial Law | crown | Shavvinne only: −1 alliance limit; discard-cost actions may spend at most 1 Shavvinne card. Other districts unaffected. Shavvinne conspiracy is illegal while this is active. |
| Shavvinne | B | Secularism | scales | Civil cards in Shavvinne of 5 or lower each count influence twice |
| Smarbbit | A | United Front | scales | If a card **lands** in Smarbbit, it goes to the **non-discarding** player's Smarbbit pile. A card routed elsewhere stays with the discarder. |
| Smarbbit | B | Consultative Office | atom | From hand, set aside face-up Smarbbit cards into a personal zone beside you. Use them later as if in hand; they ignore hand limit. |

## Known monument effects (base)

| Monument | District | Party that guarantees it | Symbol | Effect |
| --- | --- | --- | --- | --- |
| Intel Network | Dragonara | Progressive | atom | Free action: inspect top 5 of deck, move one to the top |
| Dragon Gate | Dragonara | Global | scales | +2 hand limit. After normal income, if you have exactly 4 cards, draw one more. A GE on that extra draw does not interrupt the step. |
| Planet Next | Horsard | Liberal | chart | Before election results, you may discard cards from hand. Each gives +2 influence this election only to its printed district, then sits in the support pile (and can trip Popularity). |
| Space Agency | Horsard | Innovative | atom | Whenever you discard, you may send cards to your other district piles (max 1 each). Owner only. United Front applies only if the landing pile is Smarbbit. |
| Roman Basilica | Shavvinne | Trinity | crown | You always win Civil Victory at the end of the final election |
| Civil Service | Shavvinne | Republican | chart | Opponent cannot win a district where they do not have more civil cards |
| Model Society | Smarbbit | Socialist | scales | You can have 2 alliances in a district |
| Smart Doctrine | Smarbbit | Conservative | atom + chart + crown + scales | You may host the policy referendum before or after tallying election wins. Owner scores one of each symbol type. |

## FAQ (authoritative clarifications)

- Over hand limit: never forced to discard. Limit only blocks income draws.
- Empty draw deck: skip the draw / replenish.
- Two District Governors in the same district: they silence each other, so **no** alliance ability is active in that district.
- People's Press: you may look through your support pile and choose which card to retrieve, including cards that landed there from other districts.
- You may not take a free action that makes a mandatory main action impossible if another order would have allowed one.
- Century Club replacing a Horsard alliance with Shavvinne Order of Knights: conspiracy-prevention is printed for **Shavvinne**, so Horsard can still be conspired. The new alliance occupies the slot it replaced. When discarded, it goes to the pile of the district it occupied.
- Civil Service vs Diet of Saints / Divine Inquisitors: separate effects. Civil Service forces a tie instead of an opponent win when they do not have more civil cards. Diet of Saints raises Shavvinne influence. Divine Inquisitors change how the Shavvinne electorate is decided, but the opponent still needs more Shavvinne civil cards in play to possibly win it.

## Things this file is not

- Card-by-card alliance and civil lists → [card-catalog.md](card-catalog.md)
- File layout, UI, and build order → [development-plan.md](development-plan.md)
- Unresolved rules → [open-questions.md](open-questions.md)
