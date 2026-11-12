# Open questions

Do not invent answers. If a task depends on one of these, stop and ask, then move the answer to **Resolved** with a date.

## Still open (rules revision 2026-11)

These come from the current rulebook and card faces. Ask Joe.

| # | Topic | Question | Where it bites |
| --- | --- | --- | --- |
| 1 | Mid-turn trigger | Turn order is settled (see Resolved). Remaining detail: if a General Election is revealed **mid-turn** (e.g. Currency Ballots, Kybernetik, Model Society draws, or a Market refill in the action step), does the Market grow to 8 immediately while the current turn continues? | `draw.ts`, `income.ts` |
| 2 | Decree activation | Does the winner choose which inactive decrees to activate? (Beginner tips imply yes.) What happens if more General Elections were set aside than inactive decrees remain? | `election.ts` |
| 3 | Final election | "Final election" = the election phase during which the 4th General Election leaves the deck. If the deck runs out with a General Election still unrevealed (it can't in any printed mode, but check), when does the game end? | Civil Victory |
| 4 | Planet Next (remaining) | The "bank" model is settled (see Resolved). Still unknown: **a.** When can you set cards aside (any time, action step only, once per turn, any limit)? **b.** Are banked cards safe: does a Horsard conspiracy wipe them, and are they ever discarded (e.g. after an election)? **c.** Interactions: do banked cards count as Horsard cards in play for Order of Knights (+1), Economic Reform (+3), Secularism, Civil Service, or De Jures? Ian's expectation: **no interactions**, but unconfirmed. | Monument handler |
| 5 | Influence Senate source | Can any card from hand be placed in the Senate (civil, alliance, conspiracy)? Does the pushed-out Senator count as **your** discard for United Front, Space Agency, Popularity, and the Recruit precondition? (Rulebook: "Discard the rightmost card (to your support pile).") | Politics step |
| 6 | Propose Policy details | Can a revealed civil convince a civil Senator only, or can any card type with a number? Must the changed district relate to the revealed cards? Do the non-discarded revealed cards simply return to hand? | Politics step |
| 7 | Election-phase income | During an election phase the Market is not replenished. Can a player under the hand limit still draw from the deck at income step 3? (Rulebook order implies yes.) | `income.ts` |
| 8 | Tie-break cards | Tie-break 2 counts "the total number of cards in electorates won." Confirm: civil cards (both players) in a won district, and alliance cards (both players) for a won Council of Lords. | `election.ts` |
| 9 | Century Inc. as free action | Century Inc. now plays an alliance as a **free action**. Does that free play also trigger Model Society's draw and count as "playing an alliance" for other effects? Does the replaced alliance go to its owner's support pile? | Alliance handler |
| 10 | Kybernetik Inc. | "End your action step": if you haven't done your main action yet, is that allowed (skipping the mandatory main action), or must the main action come first? | Alliance handler |

## Resolved

### 2026-11-11 (Joe, via Ian)

| Topic | Decision |
| --- | --- |
| Monument setup | Monuments **may** share a district. Setup: the 2 guaranteed by the parties + 2 random from the rest, with **no** district constraint. Replenishing after construction is random too. |
| Turn order around elections | Normal turn order **never changes**. The election phase is just a state of the Market. Example: if player A reveals a General Election during their income step, player B takes the next turn, which is the first turn of the election phase. After resolution, play keeps alternating. No first-player choice. |
| Roman Basilica | Its owner may declare Civil Victory after winning **3 elections** (3 election phases won, not General Election cards). This is a remnant of the old primary win condition; now only the final election wins Civil for everyone else. Declared like other victories, in the owner's Politics step. They may also still win Civil normally at the final election. |
| Planet Next ("bank") | Owner may move Horsard cards **from hand only** into a personal face-up bank. Banked cards don't count toward hand limit. Each banked card gives its owner **+1 influence in the Horsard electorate**. Banked cards can be used later **as if in hand** for any action (play, Recruit, Construct, Influence Senate, Propose Policy reveals, …). When a card leaves the bank, its +1 goes with it. Being further under the hand limit at income is intended. Timing, safety, and interactions are still open (#4). |
| De Jures | Compare each district separately. A player with **no** civil cards in a district loses that district's comparison. If **neither** player has civil cards there, it's a tie, which satisfies "tie for lowest" for both. Satisfied only if the player passes in all 4 districts. |

### Earlier rulings still valid under the current rules

| Topic | Decision |
| --- | --- |
| Starting hands | First player takes **3 of 4** listed cards. Second player takes **all 4**. Done before the Senate and Market are dealt. |
| Deck math | 104 non-election − 7 starting − 5 Senate − 5 Market = **87**, matching every mode's printed piles. (Was 92 before the Senate existed.) |
| Chaotic piles | A `8 + 1`, B `10`, C+D one pile `64 & 3`, E `5`. |
| Digital seating | District order locked at setup; always left-to-right as displayed. |
| Martial Law | Applies **only in Shavvinne**. −1 alliance limit there (default 1 → 0; Model Society 2 → 1). Any action that would discard 2+ Shavvinne cards is illegal, including a Shavvinne conspiracy. |
| Consultative Office | Personal face-up zone. Move Smarbbit cards **from hand** into it. Usable later **as if in hand**; they don't count toward hand limit. |
| Currency Ballots | A General Election drawn by this effect does **not** delay the mandatory discard. Finish draw-then-discard, then handle the election. |
| United Front | Looks at the **landing** pile. A card discarded to Smarbbit goes to the **non-discarding** player's Smarbbit pile. If Space Agency sends it elsewhere, the discarder keeps it. All discard sources. Can feed Popularity. |
| Space Agency | Whenever **you** discard, you may send cards to **your** other district piles, at most 1 per other district. Never moves the opponent's discards. Does not change Martial Law spend checks. |
| Dragon Gate | Extra draw is its **own step at the end of income**. A General Election drawn there does **not** interrupt that step. |
| Council of Lords | Count **printed handshake symbols** (Financial Bankers = 2). |
| Policy change options | Neutral → either printed side, or side → neutral. Never side → side. (Now printed in the rulebook.) |
| Recruit precondition | Illegal unless you already have at least one card in your support pile for that district. (Now printed in the rulebook.) |
| Two District Governors | Silence each other; the district's policy is no longer frozen. (Rulebook FAQ.) |
| General Election art | Real art now exists in the TTS save (deck 3). Placeholders can go. |

## Obsolete (rules removed in 2026-11)

These rulings applied to mechanics that no longer exist. Keep them only as a record; do not implement them.

- Executive power (Emergency State / Legal Review), its timing, and who holds it at the start
- Political campaign / policy supporters / Call Policy Referendum, referendum district order, Politics-step pairing
- National Priorities monument variant
- Old Planet Next (discard before results for +2) and old Smart Doctrine (swap referendum order; one of each symbol)
- Political Victory on 3 consecutive election wins
- Opposition chooses the election's first player; the non-triggering player takes the turn after an election
