<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Pax Corruption

Digital simulator for the two-player political card game. Local hotseat first; online play later.

Before changing game rules, engine code, or board UI, read:

1. [docs/agents/README.md](docs/agents/README.md) — which doc to open
2. [docs/agents/game-rules.md](docs/agents/game-rules.md) — how the game is played
3. [docs/agents/card-catalog.md](docs/agents/card-catalog.md) — cards, art, data shape
4. [docs/agents/development-plan.md](docs/agents/development-plan.md) — architecture and build order
5. [docs/agents/open-questions.md](docs/agents/open-questions.md) — unresolved rules (do not invent answers)

The rules were revised in 2026-11: the Senate and decree objectives replaced policy supporters, referendums, and executive power. The engine and UI were migrated to these rules on 2026-11-11; card abilities (Phase 6) followed on 2026-11-12 the hotseat finish (Phase 7) and troubleshooting tools (Phase 8) on 2026-11-13. **Phase 9** is under way: setup modes are done, the Legacy & Diplomacy expansion is next, and online play comes later. Bump `ENGINE_VERSION` in `lib/game/record.ts` when a change can make old game records replay differently. Do not reintroduce removed mechanics.

Source priority: current printed card text (the Tabletop Simulator save faces) > the current rulebook PDF > these docs > marketing copy. Paths are in [card-catalog.md](docs/agents/card-catalog.md#sources-of-truth).

Do not implement a card ability from memory. Use the catalog and the current printed card image. If a rule is listed as open, stop and ask.
