---
name: bug-report
description: Investigate a Pax Corruption bug report end to end — gather context, decode and replay the reported game, verify the claim against the printed cards and rulebook, pause with a verdict, then fix the issue plus any similar problems found in a sweep, with regression tests, on a fix branch. Use when the user submits an error report, a PAX1 share code, a report .json, a screenshot of a problem, or says something in the game is broken.
argument-hint: "<PAX1:code | path/to/report.json | description of the problem>"
---

# Bug report

Take a player's error report from claim to fix. Never change code before the user has seen the verdict (step 4).

Read `AGENTS.md` and `docs/agents/README.md` first if they are not already in context. Their hard rules apply throughout: the engine is the rules authority, the source priority is **printed card (TTS face) > rulebook PDF > docs > marketing**, open questions are never answered by guessing, removed mechanics are never reintroduced, and hidden information never reaches an online client.

## 1. Intake

Collect everything the user gave: a `PAX1:` code, a report `.json` path, a screenshot, pasted text, or a plain description. If you were given a code or file, decode it right away (step 3) — it usually answers most context questions.

You need, at minimum:

| Need | Usually from |
| --- | --- |
| What the player expected vs. what happened | report `description`, or ask |
| Where in the game it happened | report `stepCount`, or ask (turn, card, action) |
| Which build | record `engineVersion` and `build` |
| Setup | record `mode`, `expansion`, `foreignInfluence`, `ai` |
| Hotseat or online | ask if unclear (online games cannot produce reports) |
| Device / screen size (UI bugs only) | report `userAgent`, screenshot, or ask |

If essentials are missing, ask for them **in one message**, not one at a time. Don't ask for anything the record already contains.

## 2. Triage

Classify the report. It decides how you investigate:

| Class | Signs | Investigate with |
| --- | --- | --- |
| Engine / rules | wrong outcome, an action allowed that shouldn't be (or missing), wrong scoring or victory | replay (step 3), `lib/game/*` |
| Card data | wrong name, cost, symbol, text, or art | `lib/cards/*`, TTS faces, `public/cards/` |
| UI / rendering | layout, overlap, motion, tooltips, wrong card shown though state is right | the running app (see **UI bugs** below), `components/` |
| Online / server | desync, rejected move, the opponent's hidden cards visible | `server/`, `lib/game/redact.ts` |
| Not a bug | the game follows the printed card or rulebook; the player misread it | cite the source |
| Open question | the sources don't settle it | stop and ask (step 3) |

A single report can be several classes (for example, the engine is right but the UI makes it look wrong). Say which.

## 3. Reproduce and verify

### Replay the record

```bash
node --experimental-strip-types --no-warnings scripts/inspect-report.ts <report.json | PAX1:code | -> [--step N] [--around N|all] [--state] [--record]
```

It prints the report metadata, version warnings, the first failing action, invariant issues, the moves around the reported step with their events, the board at that step (both hands visible), and the legal actions there. `--state` adds the raw state; `--record` prints the record JSON for a test. Use `--step` to look before and after the moment the player describes.

- **Version mismatch.** If `engineVersion` differs from `ENGINE_VERSION` in `lib/game/record.ts`, the replay may not match what the player saw. Check `git log` on `lib/game` and `lib/cards` since the report's `build` — the bug may already be fixed. If you need the player's exact behavior, replay in a worktree at that build.
- **Replay failure or invariant issue.** That is strong evidence of an engine bug on its own. Note the exact action index.
- **No code or file.** Reproduce from the description: build the position in a test using the helpers in `lib/game/test-helpers.ts`, or play it in the app.

### Verify the claim

Do not decide what the rule is from memory. Check, in priority order:

1. The printed card face (TTS save — paths in `docs/agents/card-catalog.md#sources-of-truth`) for every card involved.
2. The rulebook PDF.
3. `docs/agents/game-rules.md`, `card-catalog.md`, and `open-questions.md` (the **Resolved** section records rulings that override a plain reading).

If the answer depends on something in **Still open**, or on anything the sources don't settle, **stop and ask**. Don't guess. After the user rules, record the answer under **Resolved** with today's date.

### UI bugs

Use the `run` skill (or the browser tools) to start the app and reproduce at the reported viewport. **Play on from here** at `/troubleshoot` loads a report at any step in hotseat. Check phone and desktop widths, and light and dark themes if colors are involved.

## 4. Verdict — pause here

Before editing anything, tell the user:

- **Verdict:** Confirmed / Not a bug / Cannot reproduce / Needs a ruling
- **Evidence:** the replay excerpt (step numbers and events), plus the card text or rulebook passage quoted with where it came from
- **Root cause** (if confirmed): file and function, and why it goes wrong
- **Plan:** the fix, and the sweep areas you will check (step 6)

Then wait for the go-ahead. For **Not a bug**, write a short explanation the user can pass on to the player, citing the rule. For **Cannot reproduce**, say what you tried and what extra information would help.

## 5. Regression test first

Write a test that fails on the current code before fixing:

- Engine bugs: replay the report's own record (`--record`, trimmed to the shortest prefix that still shows the bug), or build a minimal position with `test-helpers.ts`. Assert the correct behavior from the source you cited.
- Add it to the most relevant existing `lib/game/*.test.ts` file. If you create a new test file, add it to the `test` script in `package.json`, which lists every file.
- UI bugs often can't be unit-tested. Record the reproduction steps and the viewport in the commit message instead.

Run it and confirm it fails for the reason you expect.

## 6. Sweep for siblings

The same cause usually appears in more than one place. Check whichever of these apply, and keep a list of what you checked:

- **Same effect, other cards.** Search `lib/cards` for the effect id or ability family; check every card that uses it.
- **Same helper, other callers.** Search for the faulty function; check each call site.
- **Mirror cases.** The other seat, every district (and district order), both policy sides, active and inactive decrees, the Senate and the Market.
- **Timing.** Mid-turn General Election, Politics step vs. action step, free actions, once-per-turn flags, undo (`undoBlockReason`).
- **Setups.** Base game vs. Legacy & Diplomacy (with and without Foreign Influence), and each mode (Standard, Tourney, Chaotic, Epic). Base games must play exactly as before.
- **Other surfaces.** The engine is right, but does the UI show it? Does `redact.ts` hide it online? Does the AI (`ai.ts`) or `explain.ts` / `progress.ts` assume the old behavior?
- **UI siblings.** The same component at other breakpoints, other cards in the same component, the other theme.

Write a test for each real sibling you find. If the sweep turns up something large or unrelated to this cause, **list it for the user instead of fixing it** — don't widen the change without asking.

## 7. Fix

- Fix the root cause, not the symptom. Keep the change as small as the cause allows.
- Bump `ENGINE_VERSION` in `lib/game/record.ts` (date plus counter format, e.g. `2026-11-17.1`) if any old record could now replay differently.
- Don't edit card text away from the printed face, don't reintroduce removed mechanics, and don't send hidden information to online clients.

## 8. Validate

```bash
npm test
npm run lint
```

Both must pass. For UI fixes, check the result in the running app at the reported viewport and at the opposite (phone or desktop) width. If the report had a code, rerun `scripts/inspect-report.ts` on it and confirm the reported step now behaves correctly (or now fails cleanly, if the old record is no longer legal).

## 9. Commit

- Work on a branch: `git switch -c fix/<short-slug>` from `main`. Never commit to `main` for this.
- Use conventional commits matching the history: `fix: <what now works>` (or `test:` for a test-only commit). Write the subject as the corrected behavior, like `fix: Show North-flipped decrees on their current side`.
- One commit per distinct root cause, each with its own tests. Don't push.

## 10. Report back

Finish with:

- **Verdict** and the root cause, in one or two sentences
- **Fixed:** each issue with its commit and test
- **Sweep:** what you checked, what was clean, and anything you listed but didn't fix
- **Version:** whether `ENGINE_VERSION` was bumped, and why
- **For the player** (optional): one or two plain sentences the user can send back
