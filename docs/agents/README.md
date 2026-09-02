# Agent docs

These files are the working brief for anyone (human or agent) building the simulator.

| Doc | Read when |
| --- | --- |
| [game-rules.md](game-rules.md) | Implementing setup, turns, elections, scoring, or victory |
| [card-catalog.md](card-catalog.md) | Adding card data, art, or ability handlers |
| [development-plan.md](development-plan.md) | Choosing what to build next or where code should live |
| [open-questions.md](open-questions.md) | A rule, card, or mode is missing or contradictory |

## Product intent

- Local, one-device, two-player hotseat first.
- Board layout inspired by digital CCGs: your hand along the bottom, opponent card backs along the top, shared board in the middle.
- The four districts are vertical lanes, not a single battlefield row.
- Online multiplayer comes after the rules engine and hotseat UI are trustworthy.

## Hard rules for agents

- The TypeScript engine is the rules authority. React only renders state and dispatches actions.
- Printed card text beats the rulebook summary when they conflict. The rulebook beats marketing copy.
- Do not fill gaps in [open-questions.md](open-questions.md). Ask.
- Expansion-pack cards and victories are out of scope until the base game is playable.
