# Round 4 Analysis

Date: 2026-04-17
Scope: Same 6 LLM-generated specs in `.planning/generated-specs-round3/`
(law-firm, personal-chef, real-estate, tailor, tour-guide, wedding-planner)
re-run through the normalizer after Phase 1/2/3 landed. Output:
`.planning/generated-specs-round3/_validation-report.json` and `_ui-review-report.json`.

No new LLM calls — this is a delta analysis of the *pipeline*, not the models.
Regenerating against the same inputs isolates normalizer improvements.

## What shipped between round-3-post-fix and round-4

### Phase 1 — money close-loop (merged pre-round-4)

| File | Change |
|---|---|
| `src/generation/services/normalizers/money.ts` (new) | `injectBalanceDue` heuristic: when a parent entity has a currency total field AND a payment-role child belongs_to it AND no manual balance field, inject `amount_paid = sum(child.amount WHERE status='Paid')` + `balance_due = formula {total} - {amount_paid}`. |
| `src/generation/services/normalizers/story-events.ts` | `injectBalanceDueStats`: surface `balance_due` on the parent's `story_events.stats_card` so users see the outstanding balance on the Story screen. |
| `src/generation/services/normalizers/entity.ts` | `normalizeStatusForRole`: role-aware status taxonomy for payment/account/document entities so the `status='Paid'` filter actually matches. |

### Phase 2 — normalizer split (non-behavioral)

1393 LOC monolith → 191-LOC orchestrator + 7 focused modules
(`normalizers/entity.ts`, `anchor.ts`, `story-events.ts`, `add-flows.ts`,
`money.ts`, `roles.ts`, `shared.ts`). Same external behavior, smaller blast
radius per change.

### Phase 3 — injection regression fix + harness promotion

| Fix | File | Change |
|---|---|---|
| 3.1 | `src/generation/services/normalizers/story-events.ts:224` | Changed `'Balance Due: ${balance_due}'` → `'Balance Due: {balance_due}'`. The `${…}` form matched `SpecValidator.INJECTION_PATTERNS` (`/\$\{[^}]+\}/`) and tripped template-injection warnings. The `balance_due` computed field already has `prefix:' `so the renderer adds the sign. |
| 3.2 | `tests/generation/normalizer-specs.test.ts`, `tests/generation/normalizer-ui-review.test.ts` | Promoted `tests/__scratch/` harness to real tests with hard assertions: normalized spec must validate, zero injection warnings, catalog ok, zero `BUG:` findings, all builders green. Silenced normalizer `console.log` noise. |
| 3.3 | Deferred — see `TODOS.md` | Multi-hop template resolution (`{order.client.name}`). Polish, not a bug. |

## Pass/fail totals

| Check | Round-3-post-fix | Round 4 |
|---|---|---|
| `SpecValidator.validate(normalized)` passes | 6 / 6 | 6 / 6 |
| `catalog.validate(Anchor)` | 6 / 6 | 6 / 6 |
| `catalog.validate(Story)` | 6 / 6 | 6 / 6 |
| `catalog.validate(Calendar)` | 6 / 6 | 6 / 6 |
| Injection warnings on normalized output | 1 / 6 (tailor `${balance_due}`) | **0 / 6** |
| Greeting contains `{business_name}` | 6 / 6 | 6 / 6 |
| Stats are entity-aware | 6 / 6 | 6 / 6 |
| `chat_commands` non-empty | 6 / 6 | 6 / 6 |
| Subtitle collides with time_field | 0 / 6 | 0 / 6 |
| Story coverage (all entities) | 6 / 6 | 6 / 6 |
| Sample copy matches vertical | 6 / 6 | 6 / 6 |
| Calendar entity matches anchor entity | 6 / 6 | 6 / 6 |
| `add_flow` has picker step when FK exists | — | 6 / 6 (2–4 pickers per vertical) |
| `balance_due` surfaced where money loop applies | — | 1 / 1 (tailor) |

Zero regressions. One pre-existing informational finding remains on law-firm:
`anchor "Matter" has multiple date fields (court_date, filing_deadline) — time_field "court_date" picks one`.
That's expected behavior, not a defect.

## Per-vertical diff vs round-3-post-fix

| Vertical | Change in round 4 | Why (or why not) |
|---|---|---|
| **Law firm** | No normalizer-visible change | No Payment entity with belongs_to → Matter. Money loop correctly skips. |
| **Personal chef** | No normalizer-visible change | Invoice *is* the payment artifact (no separate Payment child), Booking has no currency total. Correctly skips. |
| **Real estate** | No normalizer-visible change | No Payment entity. Correctly skips. |
| **Tailor** | **Gained `Order.amount_paid` + `Order.balance_due` + Story stat `Balance Due: {balance_due}`**. Was previously the vertical that tripped the `${balance_due}` injection warning — now clean. | Order has `total_cost` (currency), Payment belongs_to Order with `amount` + `status`. Heuristic fires, injection regression fixed. |
| **Tour guide** | No normalizer-visible change | Booking already has a manual `balance_due` field from the LLM; the normalizer preserves it and skips injection (heuristic guard is idempotent). |
| **Wedding planner** | No normalizer-visible change | Payment belongs_to Couple (person-role, no currency total). Correctly skips. |

## Money close-loop narrowness — is 1/6 the right number?

Yes. Walked through each skip:

- **personal-chef**: `Invoice` IS the payment ledger (has `amount` + `paid` boolean), and `Booking` has no billable total. Injecting `balance_due` on Booking would invent money that doesn't exist in the spec.
- **real-estate**: No payment entity at all — it's a CRM, not a billing app.
- **law-firm**: Matter tracks `billable_hours` but no child Payment entity. A future improvement could inject `balance_due = billable_hours * rate - payments_received` but that requires the LLM to emit an hourly-rate field and a Payment child, which it didn't.
- **tour-guide**: LLM already emitted a manual `balance_due` on Booking. Injection would overwrite human intent.
- **wedding-planner**: Payment belongs_to Couple (person). No currency total on Couple to subtract from.

The heuristic is conservative by design: fire only when the pattern is
unambiguous (parent has billable total + payment-role child with status). False
positives would invent money flows the user didn't ask for.

## Anchor details (for reference)

| Vertical | Anchor entity | Title | Subtitle | Time | Stats |
|---|---|---|---|---|---|
| Law firm | Matter | `{client.name}` | `{description}` | court_date | Matters Today / This Week / Active Matters |
| Personal chef | Booking | `{client.name}` | `{status}` | date | Bookings Today / This Week / Active Bookings |
| Real estate | Showing | `{client.name}` | `{status}` | scheduled_for | Showings Today / This Week / Active Showings |
| Tailor | Fitting | `{order.description}` | `{notes}` | scheduled_at | Fittings Today / This Week / Active Fittings |
| Tour guide | Tour | `{meeting_point}` | `{tour_type}` | date | Tours Today / This Week / Active Tours |
| Wedding planner | Event | `{couple.name}` | `{notes}` | date | Events Today / This Week / Active Events |

## Open items (carry-forward)

- **Multi-hop templates (3.3)** — tailor's title reads `{order.description}` via single-hop. The richer `{order.client.name}` needs template-engine chain resolution + anchor data loader grandparent fetch. Deferred in `TODOS.md`, effort M.
- **Thin subtitles** — personal-chef and real-estate both fall back to `{status}`. That's the correct P0 fix (avoids the subtitle/time collision from round 3), but `Scheduled` as a subtitle is information-poor. Future work: rank non-date text fields by information density (notes > menu_plan > status) in `normalizeAnchor` subtitle selection.
- **Money loop expansion** — law-firm-style hourly billing isn't covered. Adding an `hourly_rate` heuristic would cover a second vertical, but the LLM has to emit the rate field first.

## Summary

Phase 3 strictly improves over round-3-post-fix. The 6-vertical harness now
asserts zero injection warnings, zero builder errors, full story coverage,
and entity-matched calendar alignment on every run. The money close-loop
fires on the one vertical where the pattern unambiguously applies (tailor),
and correctly skips the five where injecting `balance_due` would fabricate
data. Next round-4 step (when LLM keys return) is to generate fresh specs
for 6–10 new verticals and watch for patterns the current heuristics miss.
