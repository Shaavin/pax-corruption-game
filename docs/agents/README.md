# Agent docs

The working brief for anyone (human or agent) building the simulator.

| Doc | Read when |
| --- | --- |
| [game-rules.md](game-rules.md) | Implementing setup, turns, the Senate, elections, decrees, or victory |
| [card-catalog.md](card-catalog.md) | Adding card data, art, or ability handlers; re-ingesting card faces |
| [development-plan.md](development-plan.md) | Choosing what to build next or where code should live |
| [open-questions.md](open-questions.md) | A rule, card, or mode is missing or contradictory |

## Current status

The game's rules were revised in 2026-11. The Senate, Propose Policy, and decree objectives replaced policy supporters, the referendum, and executive power. The engine, catalog, and hotseat UI were migrated on 2026-11-11 (Phase R). Card abilities (Phase 6) were completed on 2026-11-12. **Next work is Phase 7 — hotseat finish** in [development-plan.md](development-plan.md).

## Product intent

- Local, one-device, two-player hotseat first.
- Board layout inspired by digital CCGs: your hand along the bottom, opponent card backs along the top, shared board in the middle.
- The four districts are vertical lanes, not a single battlefield row.
- Online multiplayer comes after the rules engine and hotseat UI are trustworthy.

## Hard rules for agents

- The TypeScript engine is the rules authority. React only renders state and dispatches actions.
- Source priority: **current printed card text** (TTS save faces) > **current rulebook PDF** > these docs > marketing copy. Paths are in [card-catalog.md](card-catalog.md#sources-of-truth).
- Do not fill gaps in [open-questions.md](open-questions.md). Ask, then record the answer there.
- Do not implement anything listed under "Obsolete" in [open-questions.md](open-questions.md).
- Expansion cards and victories are out of scope until the base game is playable.
