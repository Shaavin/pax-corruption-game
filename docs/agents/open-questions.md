# Open questions

Do not invent answers. If a task depends on one of these, stop and ask, then move the answer to **Resolved** with a date.

## Still open (rules revision 2026-11)

None right now. If new card text or a rulebook update conflicts with this file, ask before coding.

## Resolved

### 2026-11-11 (Joe, via Ian)

| Topic | Decision |
| --- | --- |
| Monument setup | Monuments **may** share a district. Setup: the 2 guaranteed by the parties + 2 random from the rest, with **no** district constraint. Replenishing after construction is random too. |
| Turn order around elections | Normal turn order **never changes**. The election phase is just a state of the Market. Example: if player A reveals a General Election during their income step, player B takes the next turn, which is the first turn of the election phase. After resolution, play keeps alternating. No first-player choice. |
| Roman Basilica | Its owner may declare Civil Victory after winning **3 elections** (3 election phases won, not General Election cards). This is a remnant of the old primary win condition; now only the final election wins Civil for everyone else. Declared like other victories, in the owner's Politics step. They may also still win Civil normally at the final election. |
| Planet Next ("bank") | Owner may move Horsard cards **from hand only** into a personal face-up bank. Banked cards don't count toward hand limit. Each banked card gives its owner **+1 influence in the Horsard electorate**. Banked cards can be used later **as if in hand** for any action (play, Recruit, Construct, Influence Senate, Propose Policy reveals, …). When a card leaves the bank, its +1 goes with it. Being further under the hand limit at income is intended. Clarified 2026-11-11: the bank is an **extension of your hand**. You may bank cards only during your own turn. Banked cards have **no other interactions**: conspiracies, policies, alliances, and decrees ignore them, and they are never discarded except when you spend them. |
| General Elections in one phase | A General Election revealed at any time (including mid-turn) **starts the election immediately**; the Market grows to 8 and the turn carries on. Any more revealed during that election are added to it, and the winner activates (chooses) one inactive decree **per General Election** that came up in that election. |
| Century Inc. | Once per turn; counts as playing an alliance (Model Society, Currency Ballots, …). It must **replace** an existing alliance, in your tableau or the opponent's; with no alliance to replace, it can't be used. In the opponent's tableau, their alliance goes to **their** support pile for that district, and your played alliance is then **theirs**, in that district. Replaced cards always go to the support pile of the player whose tableau held them. An alliance naming a district keeps that effect for its **printed** district, but it occupies the lane it's in: a conspiracy there wipes it. The alliance limit is per district, counting whatever alliances sit in that lane regardless of printed district. |
| Discarding events (expansion) | Any event card that would be discarded (conspiracy wipe, legacy event, etc.) goes **back to the box**: removed from the game, never into a support pile. This overrides the expansion rulebook line that sends events played as civil cards to a support pile. |
| Conspiracies vs. events (expansion) | A conspiracy wipes event cards played **as civil cards** (for their number) in its district. Events played for their **effect** (in the common area) are never wiped by conspiracies. |
| Kybernetik Inc. | May be used **before** your main action; using it ends the action step, so it replaces the main action that turn. You still get your **Politics** step; only income is skipped, and that includes the Market refill: if a Market card was taken during the turn (e.g. via State Enterprise), the Market stays short until the next income step that refills it. A General Election drawn this way starts the election as usual. |
| Decree activation | The election winner **chooses** which inactive decree(s) to activate. If more General Elections were set aside than inactive decrees remain, the extras are forgotten. |
| Final election | Every General Election is guaranteed to be drawn before the deck runs out, so the game always reaches a final election unless someone declares a victory first. |
| Influence Senate | **Any** card from hand can be seated. The pushed-out Senator goes to **your** support pile for its district and counts like any other support-pile card (influence, Popularity, Recruit precondition, and so on). |
| Propose Policy matching | Revealed cards only convince Senators of the **same district**. A Horsard civil 6 can convince lower Horsard civil Senators, never Shavvinne, Smarbbit, or Dragonara ones. |
| Election-phase income | The Market doesn't refill during an election, but a player under the hand limit **still draws from the deck**. (Expansion: event cards keep discarding and replenishing by their own rules, including disappearing from the last two spots of their row.) |
| Tie-break cards | Tie-break 2 counts civil cards (both players) in each won district and alliance cards (both players) for a won Council of Lords. |
| De Jures | Compare each district separately. A player with **no** civil cards in a district loses that district's comparison. If **neither** player has civil cards there, it's a tie, which satisfies "tie for lowest" for both. Satisfied only if the player passes in all 4 districts. |

### 2026-11-12 (Joe, via Ian)

| Topic | Decision |
| --- | --- |
| Diet of Saints | "Discard ALL civil cards in Shavvinne after an election" discards **both players'** Shavvinne civils, each to its **owner's** support pile. |
| Currency Ballots | Triggers whenever a **Dragonara-labeled** card goes into a player's lane: civil, alliance, or conspiracy (including alliances played by Century Inc.). |
| Free actions | Once **per card per turn**, and only during the **action step**. Capitol Inc.'s free proposal is **in addition to** the normal Politics-step options. |
| People's Press | Changes the **income-step draw** only: instead of drawing from the deck, you may take a card from your Smarbbit support pile. Other card draws are unaffected. |
| Urban Aristocrats | The swapped civil cards **change owners**: yours goes into the opponent's Dragonara lane and theirs into yours. |
| State Enterprise | Dragonara civil cards in the Market can be used straight from the Market for main and free actions, including playing them, recruiting partisans, and building monuments. The Market stays short until the next refill. Civils only, as printed: Market alliances (even Dragonara ones) can't be used, not even to build or recruit. |
| Consultative Office | Like Planet Next: set cards aside only during your own turn. |
| Diet of Saints vs. Divine Inquisitors (provisional) | If both claim Shavvinne for different players (possible only after Century Inc. moves Diet of Saints), the claims cancel and nobody wins Shavvinne. |
| Propose Policy reveals | Revealed cards go back to your hand (except the one you discard); cards you didn't reveal never leave it. |
| Propose Policy target | The changed policy must be in a district of one of the **revealed** cards. Example: revealing a Smarbbit alliance and a Shavvinne civil lets you change Smarbbit's or Shavvinne's policy, not Horsard's. (Interpretation of "must relate to the revealed cards"; implemented.) |
| Buying an event for its effect (expansion; not yet in the rulebook) | When you purchase an event and play it **for its event effect** (not as a civil card), **draw a card**. This makes playing an event for its effect effectively 1 card cheaper than playing it as a civil card. |

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
