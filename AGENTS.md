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

Do not implement a card ability from memory. Use the catalog (and the printed card image) as the source of truth. If a rule is listed as open, stop and ask.
