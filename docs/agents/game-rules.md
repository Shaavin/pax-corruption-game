# Pax Corruption — game rules

Rules for the **current** base game (rulebook revision of late 2026). The Legacy & Diplomacy expansion is summarized at the end; it is implemented as an option (2026-11-13).

Sources, in priority order:

1. Printed card text on the current cards (see [card-catalog.md](card-catalog.md) for where the current faces live)
2. The base rulebook PDF: `C:\Repos\pax-corruption-marketing\public\rulebook\pax-corruption-rulebook.pdf` (12 pages)
3. This file

Anything the rulebook leaves unclear is listed in [open-questions.md](open-questions.md). Do not fill those gaps yourself.

> **Rules changed in 2026-11.** Policy supporters, political campaigns, the Call Policy Referendum action, executive power (Emergency State / Legal Review), National Priorities, and "3 elections in a row" Political Victory **no longer exist**. They were replaced by the **Senate**, **Propose Policy**, and **decree objectives**. The engine in `lib/game` was migrated to these rules on 2026-11-11.

Two players, about 30 minutes. Each leads a political party competing for the Vitalic Union. There are four districts (lanes) and five electorates: the four districts plus the Council of Lords.

## Components (base)

| Group | Count | Contents |
| --- | --- | --- |
| Main deck | 108 | 72 civil, 24 alliance, 8 conspiracy, 4 General Election |
| Double-sided | 15 | 1 partisans marker, 4 district policies, 8 support markers, 2 player aids |
| Special (single-sided) | 24 | 4 district overviews, 4 policy overviews, 8 monuments, 8 political parties |
| Decree objectives | 4 | Double-sided: inactive side / active side |
| Rulebook | 1 | |

Markers and player aids have no rules effect. In the app they are UI (badges, overlays), not engine state.

## Goal

Five victories. Civil is checked at the end of the final election. **All others are declared during your own Politics step**, and declaring is one of the three mutually exclusive politics options (see below).

| Victory | Condition (player aid wording) | Detail |
| --- | --- | --- |
| Civil | Win the final election of the game | Triggers at game end, not declared. Final election = the election phase in which the last General Election leaves the deck. Exception: Roman Basilica's owner wins it automatically by winning the 3rd election (the one featuring the 3rd General Election card), or when the final election is over, whoever won it. |
| Political | Achieve 2 active decree objectives | You must currently satisfy the conditions of 2 **active** decrees. Decrees are shared; it does not matter who activated them. |
| Military | Lead by 3+ partisans | You have recruited partisans 3+ more times than the opponent. |
| Popularity | Lead by 9+ support in a district | 9+ more cards in **one** of your support piles than the opponent's pile for that district. |
| Ideological | Most total copies of your ideology (at least 4) | See [Ideological Victory](#ideological-victory). |

The rulebook calls these "active victories". In the base game all five are always active. (The expansion adds inactive victories.)

## Zones

Per player:

- **Hand.** Limit 5 unless a card raises it. Over the limit is legal; the limit only gates income.
- **Tableau.** Civil and alliance cards in play, by district lane. Default limit: one alliance per player per district.
- **Support piles.** Four, one per district. Always public. Each card is 1 influence for its owner in that district unless a card says otherwise.
- **Party** (permanent) and **constructed monuments** (permanent, next to the party).
- **Partisans.** Number of times you recruited. Victory uses the difference.
- **Network** (only for districts an ability enables): a revealed part of your hand that doesn't count toward the hand limit. See [Network](#network).

Shared:

- 4 district lanes, always left to right: Shavvinne, Horsard, Dragonara, Smarbbit (the TTS table, from the default seat)
- Active policy per district: side A, side B, or neutral (no card)
- **Senate**: always 5 face-up cards in a row, left to right
- **Market**: 5 face-up cards (8, in two rows, during an election phase)
- Draw deck (piles A–E, A on top)
- Available monuments (4) and the monument deck
- **Decree objectives**: 4 cards, each inactive or active
- Set-aside General Elections
- Election history (who won each election, for the incumbent tie-break)

**Discard** always means "to a support pile": the pile matching the card's **printed district** and the **discarding player**, unless a card or policy reroutes it (Space Agency, United Front). General Elections never go to support piles; they are set aside.

## Districts

| Id | Theme | Color | Policy A | Policy B |
| --- | --- | --- | --- | --- |
| `dragonara` | the Technocrats | Yellow / cream | Currency Ballots | Populist Forum |
| `horsard` | the Prosperous | Blue | Economic Reform | Market Regulation |
| `shavvinne` | the Divine | Green | Martial Law | Secularism |
| `smarbbit` | the Vocals | Pink / red | United Front | Consultative Office |

District overview cards show how many civil cards of each value (3–9) exist in that district. They are reference only.

## Setup

1. **District layout.** Line up the 4 district overviews in any order (digital: random) as the 4 lanes. Put each policy overview beside its district. All policies start neutral.
2. **Choose party and starting hand.** Shuffle the 8 parties and deal 2 to each player. Each picks one; reveal together. Unused parties leave the game. The lower order number (top-left of the party card) is the **first player**. The first player searches the deck and takes **any 3 of the 4** cards listed on their party. The second player takes **all 4** listed cards.
3. **Monuments.** The monuments printed at the bottom of both chosen parties are guaranteed available. Draw 2 more at random from the rest so there are 4 available. The rest form the monument deck. The rulebook says "each from a different district", but Joe has ruled that monuments **may share a district**: no district constraint at setup or on replenish.
4. **Senate and Market.** Take out the 4 General Elections and shuffle the rest of the main deck. Deal 5 face-up as the **Senate**, then 5 face-up as the **Market**.
5. **Decree objectives.** Place all 4 decrees inactive side up beside the Market.
6. **Draw deck.** Build piles A–E (A on top) from the remaining **87** cards, using the mode table.

Deck check: 104 non-election cards − 7 starting cards − 5 Senate − 5 Market = **87**, which matches every mode's pile totals.

### Draw-deck modes

How to read a cell:

- `X`: a pile of X cards, no election
- `X + 1`: a pile of X, then put a General Election **after** it (at the bottom of that pile)
- `X & Y`: shuffle Y General Elections **into** the X cards

| Mode | Term | A | B | C | D | E |
| --- | --- | --- | --- | --- | --- | --- |
| Standard | Random | 5 | 9 & 1 | 24 & 1 | 44 & 2 | 5 |
| Tourney | Fixed | 10 + 1 | 22 + 1 | 20 + 1 | 18 + 1 | 17 |
| Chaotic | Hybrid | 8 + 1 | 10 | 64 & 3 (C and D are **one** pile) | — | 5 |
| Epic | Hybrid | 4 + 1 | 20 + 1 | 8 | 35 & 1 | 20 & 1 |

Every mode uses all 4 General Elections. All four are implemented (`DRAW_PLANS` in `lib/game/setup.ts`); players pick one on the menu, and the mode is stored in the game record. Piles without a General Election are not reshuffled, so Standard deals exactly as it did before modes existed.

## Turn structure

Players alternate. Each turn: **Action → Politics → Income**.

### Action step

Exactly **one** main action (mandatory) and any number of free actions, in any order. Each alliance or monument grants its free action **once per turn**. You may not take a free action that leaves you unable to do a main action (FAQ).

**Main-action ruling (Ian, 2026-11-14).** If you can reach a main action this turn, directly or by way of free actions (e.g. an East event taking a card from the Market), you must take one. Before your main action, a free action that would leave no main action reachable is not allowed (Kybernetik Inc. counts: it ends the action step in place of the main action). If no main action can be reached at all, you are **stuck**: draw a card (even past the hand limit) instead of the main action, take **no** free actions that turn, then play Politics and Income as usual. Setting cards aside (Planet Next bank, Consultative Office, East reveal) is not a free action and is unaffected.

Main actions:

1. **Play a civil card** to your tableau in its printed district. It gives influence equal to its number in that district's electorate.
2. **Play a conspiracy.** Discard **all** civil and alliance cards in that district, both players', to their owners' support piles. Then discard the conspiracy.
3. **Play an alliance** to your tableau in its printed district. One per player per district unless a card changes it.
4. **Recruit partisans.** Discard 3 cards of the same district from hand. Gain 1 partisan. **Only legal if you already have at least one card in your support pile for that district.**
5. **Construct a monument.** Discard 5 cards of the same district from hand to claim an **available** monument of that district. Place it by your party. Shuffle the monument deck and draw one at random so 4 are available again (if any remain). You may not do this just to discard; a matching monument must be available.

### Politics step

1. If you constructed a monument this turn, **draw a card**.
2. Then you may do **one** of:
   - **Influence Senate**
   - **Propose Policy**
   - **Declare an active victory**

#### Influence Senate

Discard the **rightmost** Senate card (to **your** support pile), shift the others right, and play **any** card from your hand into the **leftmost** spot. The Senate always has exactly 5 cards. The pushed-out Senator counts like any other card in your support pile (influence, Popularity, the Recruit precondition).

#### Propose Policy

Each Senator has votes: civil **1**, conspiracy **1**, alliance **2**. To pass a policy you must convince **more than half** of the Senate's total votes.

Reveal cards from your hand. One revealed card may convince several Senators. Every revealed card must convince at least one Senator, and no Senator may be convinced by two revealed cards: to convince two civil Senators of one district, reveal a single higher card, not a higher and a lower one (Ian, 2026-11-15). If South events alone already convince a majority, you may propose without revealing or discarding anything.

- A **civil** Senator is convinced by a revealed civil card of the **same district** with a **higher value**.
- An **alliance** Senator is convinced by another revealed alliance of the **same district**.
- A **conspiracy** Senator can never be convinced, but its vote still counts toward the total.

Districts must match: a Horsard civil 6 convinces lower Horsard civil Senators only, never Shavvinne, Smarbbit, or Dragonara ones.

If you reach the threshold: discard **one** of the revealed cards, then change the policy of **one district** where you **convinced a Senator** (by a revealed card or a South event; Joe, 2026-11-15, refining the 2026-11-14 ruling that replaced "any district"). Allowed changes: neutral → either printed side, or a printed side → neutral. You may **not** go directly from one side to the other.

Rulebook example: Senate is People's Press (2), Local Politicians 5 (1), Civil Advocates 4 (1), Financial Bankers (2), Broken Chains (1) = 7 votes; 4 needed. Revealing Capitol Inc. (Smarbbit alliance) convinces People's Press; revealing TuWang Gang 8 (Shavvinne) convinces both Shavvinne civils. 2 + 1 + 1 = 4.

District Governor makes its district's policy an illegal target for policy proposal (see card catalog).

### Income step

The hand limit gates drawing. It never forces a discard.

1. If you have fewer cards than your hand limit, take **one** card of your choice from the Market.
2. Replenish the Market back to 5 from the draw deck. **Skip this during an election phase.**
3. If you are still under your hand limit, draw one card from the top of the draw deck. This still happens during an election phase.
4. Dragon Gate (if owned): at the end of income, if you have exactly 4 cards, draw a card.

If the draw deck is empty, nothing is replenished or drawn (FAQ).

The Market only refills during an income step. A player who skips income (e.g. Kybernetik Inc.) also skips the refill, even if a Market card was taken during their turn.

## Influence and electorates

Influence in a district electorate, per player:

- Each of your civil cards there: its printed number
- +1 per card in **your** support pile for that district
- Horsard only, with Planet Next: +1 per card in your Horsard network
- Plus any policy, alliance, or monument modifiers

Alliances are not district influence (Economic Reform is an exception: "each played card in Horsard, even alliance, gains +3 influence").

**District electorate:** strictly more influence wins it. Tie: nobody wins it.

**Council of Lords:** strictly more **alliance symbols** (printed handshakes) across all your alliances in play. Financial Bankers has 2. Tie: nobody wins it.

## Election phase

### Trigger

When a General Election appears in the **Market** or in a **player's hand** (by any draw), the election phase starts right away:

1. Set the General Election aside and replace it with a new card from the deck.
2. Fill the Market to **8 cards**, in two rows.
3. Play continues normally, except the Market is **not** replenished during income.

If another General Election appears during the phase, set it aside and replace it as usual. It does **not** start a second phase, but it counts for decree activation (below).

### Winning an election

After a turn ends with **no cards in the Market**, decide the winner:

1. More electorates won (out of 5).
2. Tie: more total **cards in the electorates each player won** (cards in a district electorate = civil cards there; Council of Lords = alliance cards in play).
3. Still tied: the **incumbent** (winner of the previous election). In the first election, the first player.

### Resolving an election

1. The winner **chooses** and activates as many inactive decree objectives as the number of General Elections set aside during this phase (every General Election revealed during the election counts, including mid-turn ones; extras beyond the remaining inactive decrees are forgotten). (Beginner tip: by default, pick one whose symbol matches your party.)
2. Roman Basilica: if this election featured the game's 3rd General Election card and the Basilica owner won it, they win Civil Victory at once. If this was the final election, the Basilica owner wins Civil Victory whoever won it.
3. Otherwise, if this was the final election, the game ends with Civil Victory for its winner.
3. Otherwise replenish the Market to 5. Play resumes normally. A General Election revealed by this replenish starts a new phase.

**Turn order never changes.** The election phase is only a state of the Market. If player A reveals a General Election during their income step, player B takes the next turn, which is the first turn of the phase. After resolution, play keeps alternating. Nobody chooses a first player.

## Decree objectives

Four double-sided cards. Each starts on its grey **inactive** side ("Win an election to activate this decree"). Once activated, it stays active and its political symbol counts as a **shared** copy for Ideological Victory.

| Inactive side | Active side | Symbol | Condition (when active) |
| --- | --- | --- | --- |
| Unruly Clans | Imperium | crown | Have more partisans than the opponent. |
| Turmoil Land | Profectus | chart | Have 4+ more **total** support than the opponent. (Joe, 2026-11-16; was 7+.) |
| Emigration | Academia | atom | Have 20+ more influence than the opponent in a district. |
| Class Schism | De Jures | scales | Have the lowest (or tied for lowest) civil card in all 4 districts. See below. |

**De Jures** is checked district by district. In each district, compare each player's lowest civil card. You pass that district if yours is lower or tied. A player with **no** civil cards in a district fails it, even if **neither** player has any there (both fail; ruled 2026-11-17). You satisfy De Jures only if you pass all 4 districts.

Political Victory = you satisfy 2 active decrees at the time you declare.

## Ideological Victory

Four political symbols: `crown` (authority), `chart` (economy), `atom` (science), `scales` (justice). Color does not matter.

- **Private copies** come from your party and your constructed monuments (and Smart Doctrine).
- **Shared copies** come from active district policies and active decrees.
- **Total copies** of a symbol = shared copies + the private copies of **whichever player has more** private copies of that symbol. The other player's private copies of that symbol are ignored.

You may declare Ideological Victory with symbol X when **all** of these hold:

1. You have **more** private copies of X than the opponent.
2. Total copies of X are **at least 4**.
3. Total copies of X are **strictly more** than the total of every other symbol (no ties).

Rulebook example: Player 1 has Innovative Party + Space Academy (2 atom private). Player 2 has Progressive Party + Model Society (1 atom, 1 scales private). Active policies: Secularism (scales), United Front (scales), Currency Ballots (atom). Active decrees: Profectus (chart), De Jures (scales). Totals: crown 0, chart 1, atom 2 + 1 = 3 (Player 2's atom is ignored), scales 1 + 3 = 4. Player 2 has more private scales, 4 ≥ 4, and 4 > 3, so Player 2 can declare.

## Card types

**Civil.** District + number. Play to tableau. Influence = number in that district.

**Alliance.** District + handshake symbol(s). Play to tableau for its ability. In the Senate it carries 2 votes (every alliance prints "OR — It counts 2x many votes in the Senate" as a reminder). Ability text is mandatory unless it says "may".

**Conspiracy.** Flame icon, printed district. Wipes that district (both sides), then discards itself. All 8 share the same effect.

**General Election.** Never goes to a support pile. Set aside. Starts an election phase, or adds to the decree count of the current one.

**Party.** Permanent. Order number, one political symbol, four starting cards, one guaranteed monument.

**Monument.** Permanent once built. Costs 5 same-district cards. Ability + political symbol.

**District policy.** Printed side A, side B, or neutral. Active policy symbols are shared.

## Policy effects

All districts start neutral.

| District | Name | Symbol | Printed effect |
| --- | --- | --- | --- |
| Dragonara | Currency Ballots | atom | When you play a card in Dragonara, immediately draw a card, then discard a card from hand. |
| Dragonara | Populist Forum | chart | Each discard in Dragonara now provides 2 influence. |
| Horsard | Economic Reform | chart | Each played card in Horsard, even alliance, gains +3 influence. |
| Horsard | Market Regulation | crown | Civil cards of 8 or higher cannot be played in Horsard. |
| Shavvinne | Martial Law | crown | Each player gets −1 alliance limit and can only use actions that discard up to 1 card in Shavvinne. |
| Shavvinne | Secularism | scales | Civil cards in Shavvinne of 5 or lower each count influence twice. |
| Smarbbit | United Front | scales | Cards to be discarded in Smarbbit now go to the opponent's pile instead. |
| Smarbbit | Consultative Office | atom | The network is enabled for both players in Smarbbit. |

Rulings carried over from earlier play (still consistent with current text):

- **Martial Law** applies only to Shavvinne: −1 alliance limit there; any action that would discard 2+ Shavvinne cards is illegal. A Shavvinne conspiracy is therefore illegal while it is active. When it passes, each player discards their Shavvinne alliances down to the new limit, to their own support pile (ruled 2026-11-18). With Model Society (limit 1) and two alliances there, the owner picks which one goes.
- **United Front** looks at the **landing** pile. A card discarded to Smarbbit goes to the non-discarding player's Smarbbit pile. If Space Agency sends it elsewhere, the discarder keeps it. Applies to every discard source and can feed Popularity.
- **Consultative Office**: enables the Smarbbit [network](#network) for **both** players. When the policy changes, everyone's Smarbbit network cards go back to hand.
- **Currency Ballots**: a General Election drawn by this effect does not delay the mandatory discard. Finish draw-then-discard, then handle the election.

## Monument effects

| Monument | District | Guaranteed by | Symbol | Printed effect |
| --- | --- | --- | --- | --- |
| Dragon Gate | Dragonara | Global (6) | scales | You now have +2 hand limit. Draw a card at the end of income step if you have exactly 4 cards. |
| Intel Network | Dragonara | Progressive (3) | atom | As a free action, you may inspect the top 5 cards of the draw deck, then move one to the top of the deck. |
| Planet Next | Horsard | Liberal (5) | chart | You enable network in Horsard. Each card in your Horsard network provides +1 influence in Horsard. |
| Space Academy | Horsard | Innovative (4) | atom | You may discard up to 1 of the cards to another support pile each time you discard. |
| Civil Service | Shavvinne | Republican (8) | chart | Opponent cannot win a district where they don't have more civil cards. |
| Roman Basilica | Shavvinne | Trinity (1) | crown | You immediately win Civil Victory when 1) you win the 3rd election or 2) the final election is over. |
| Model Society | Smarbbit | Socialist (7) | scales | You can now have 2 alliances in a district. Draw a card when you play an alliance. |
| Smart Doctrine | Smarbbit | Conservative (2) | all four, dotted (conditional) | This monument provides a matching ideological symbol for each active decree currently. |

Notes:

- **Space Academy** (was Space Agency; revised 2026-11-18): owner only; each time you discard, you may move **one** of those cards to another of your piles. It never moves the opponent's discards and does not change which printed districts an action spent (Martial Law still checks printed district).
- **Dragon Gate**: the extra draw is its own step at the end of income. A General Election drawn there is set aside as usual and does not interrupt the step.
- **Smart Doctrine**: one private copy of each active decree's symbol (0–4 copies).
- **Roman Basilica** (revised 2026-11-18): nothing to declare. Its owner wins Civil Victory **at once** when they win the 3rd election, meaning the election in which the game's 3rd General Election card came up (not the 3rd election phase). Separately, when the final election is over, the owner wins Civil Victory **whoever won it**. Only counts while they own the Basilica.
- **Planet Next** (revised 2026-11-18): enables the Horsard [network](#network) for its owner. Each card in the owner's Horsard network gives +1 influence in Horsard (it goes when the card leaves the network).

### Network

Defined 2026-11-18 (Joe, via Ian). A **network** is a voluntarily revealed part of your hand that does **not** count toward your hand limit.

- Disabled by default. An ability enables it for one district; only cards of that district can go into that network.
- **Exclusive by default**: it belongs to the ability's owner (Planet Next's owner, an East event's buyer) unless the card says "both players" (Consultative Office). Foreign Influence setup events have no owner and apply to both.
- During your own turn (action, politics, or income step) you may freely move cards from hand into an enabled network, and back out.
- Network cards are usable **as if in hand** for any action. Nothing else interacts with them: conspiracies don't wipe them, and they are never discarded except when spent.
- When a network is **disabled** (the policy changes, the event leaves play), its cards go straight back to the hand, even past the hand limit. No discard; you just can't take a Market card or draw at income until you're under the limit.
- Enabled by: Consultative Office (Smarbbit, both players), Planet Next (Horsard, owner), East events Magic Realms / Private Islands / Rocky Bunkers / Unaccounted Pop. (their district, buyer).

## FAQ (rulebook)

- Two District Governors in the same district silence each other, and that district's policy is **no longer frozen**.
- You may not trigger a free action that leaves you unable to do a main action.
- Support piles are open to inspection at any time.
- Draw deck exhausted: no card is replenished to the Market and no card is drawn.

Beginner tips (strategy, not rules): elections activate decrees; recruiting partisans threatens Military Victory; plan for the turns after building a monument; watch discards, because partisans (3×) and monuments (5×) move Popularity fast.

## Expansion: Legacy & Diplomacy

Rulebook: `C:\Repos\pax-corruption-marketing\public\rulebook\legacy-and-diplomacy-rulebook.pdf`. Requires the base game. Card text: `lib/cards/expansion.ts`. Rulings: [open-questions.md](open-questions.md) (2026-11-13).

- **Event deck** (40): 10 per World Power (North, South, West, East): 8 regular events (2 per district) and 2 legacy events. Setup: set the 8 legacy events aside, remove 3 random regular events per power, and shuffle the remaining 20 with the legacy events (28). Events sit in the Market. At income you may buy one instead of taking a card, by discarding cards equal to the number of non-event cards to its right. Buying needs no room in hand, since the event never enters it: a player at the hand limit (who can't take a Market card) may still buy an affordable event, or pass (Ian, 2026-11-16). Events are played immediately: as a common effect, or into a district like a civil card. Each purchase gives +1 relation with that World Power. A conspiracy wipes events played as civil cards in its district, but never events played for their effect. A discarded event always goes back to the box, never to a support pile. House rule (2026-11-12, not yet in the rulebook): buying an event and playing it for its effect also draws you a card. East event effects are exclusive to their buyer.
- **Game board** with tracks for support, alliance, influence, diplomacy, partisans, and symbols.
- **Seven victories.** Adds Cultural (2+ more monuments) and Diplomatic (higher relation with 3 of 4 powers). Military, Popularity, Ideological, Cultural, and Diplomatic start **inactive** and are activated by legacy events. Civil and Political work as in the base game.
- Market and election-phase replenish rules change so 1–2 event cards are always in the Market. Cards flow left to right like a conveyor: new cards enter on the left and older cards slide right, so an event gets cheaper as it drifts right until it leaves from the last 2 spots (Ian, 2026-11-16). At the income refill the new event goes in first, sliding up against the older cards, and main-deck cards follow into the spots to its left (Joe, 2026-11-21). Event cards keep discarding and replenishing during an election phase by their own rules, including disappearing from the last two spots of their row. When an election ends, any events left in the Market leave the game, so the Market is empty, and it then refills to 5 with the new event in spot 1, costing 4 (Ian, 2026-11-15; kept on 2026-11-21). When an election opens with 2 events in the Market, the later (left-most) one drops into the same spot of the second row; nothing else moves, and open spots fill in place from the main deck (Ian, 2026-11-15).
- Foreign Influence variant: after the normal event setup (3 random regular events removed per power; the other 20 shuffled with the 8 legacy events into the event deck), take **3 random events from the 12 removed** and put them in play as the starting events. The other 9 stay out of the game (Ian, 2026-11-15).

Event effects by power (each district has one of each of its power's two effects):

| Power | Effects | Civil-side value |
| --- | --- | --- |
| East | Enable network in <district> · As a free action, take a <district> card from the Market (both exclusive to the buyer) | 7–11 |
| North | Military Victory needs +1 partisans (stacks) · Flip Pax <decree> to its other side while in effect | 10 |
| South | Influence in <district> is reduced to support · <district> Senators are always convinced | 7–11 |
| West | Disable all ideological icons in <district> · District support in <district> counts as zero | 2 |

Implementation: `lib/game/world.ts` (effect queries), `lib/game/events.ts` (setup, buying, legacy), `lib/game/draw.ts` (event Market, election rows).
