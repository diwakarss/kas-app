# Generation Round 3 — Functionality + UX Review

Date: 2026-04-17
Scope: Six custom-vertical specs generated via the real InsForge LLM endpoint
(`localhost:7133/generate-spec`, model = gpt-4o-mini under the hood), each one
pushed through `SpecValidator.validateWithCatalog`, `normalizeSpec`, the UI
spec builders (`buildAnchorSpec` / `buildStorySpec` / `buildCalendarSpec`),
`@json-render/core` `catalog.validate`, and a simulated render of the first
three sample cards.

Harness: `tests/__scratch/validate-specs.test.ts` and
`tests/__scratch/ui-review.test.ts`. Raw outputs:
`.planning/generated-specs-round3/_validation-report.json` and
`.planning/generated-specs-round3/_ui-review-report.json`.

## Executive summary

| What | Count | Notes |
|---|---|---|
| Specs generated | 6 | real estate, wedding planner, personal chef, law firm, tailor, tour guide |
| Pass SpecValidator (catalog) | 5 / 6 | tailor fails: anchor `Order` has no date field for `day_schedule` |
| Pass catalog.validate on Anchor | 6 / 6 | ✅ anchor screens render cleanly |
| Pass catalog.validate on Story | **0 / 6** | ❌ latent runtime bug: see P0-1 |
| Pass catalog.validate on Calendar | 6 / 6 | ✅ |
| Trigger Fix 1B/3A enriched greeting/stats | **0 / 6** | business_type=custom bypasses template-library path |
| Have non-empty `chat_commands` | 0 / 6 | LLM never emits them |
| Have subtitle == time_field | 2 / 6 | personal-chef, real-estate |

The generated specs are structurally correct and the anchor screen renders
well when sample data is present. The Story screen is broken for every single
custom app. That is the single most urgent fix.

## Per-vertical breakdown

Each row shows the anchor entity, the first simulated card, and the
top issue.

| Vertical | Anchor | First card (title · subtitle · time) | Headline issue |
|---|---|---|---|
| Law firm | Matter | "Ramesh Rao · Regular checkup and cleaning · Yesterday" | Generic sample data (dentist copy leaking through seed), missing story_events for TimeEntry / Document / RetainerAccount |
| Personal chef | Booking | "Ramesh Rao · Today · 9:00 AM" | **subtitle == time_field** (`{date}` used twice) → subtitle collapses to same day label as the time column |
| Real estate | Showing | "Ramesh Rao · Today · 9:00 AM" | **subtitle == time_field** (`{scheduled_for}` used twice), missing story_events for Showing and Offer |
| Tailor | Order | "Ramesh Rao · Regular checkup and cleaning · (blank)" | **day_schedule anchor on a non-dated entity**: `time_field` is null, time column blank, calendar tab shows `Fitting` not `Order` |
| Tour guide | Tour | "Piazza del Popolo · Ancient Rome · Yesterday" | Normalizer had to rewrite empty subtitle → `{tour_type}`; clean otherwise |
| Wedding planner | Couple | "Priya & Arjun · Good progress. · Yesterday" | Questionable anchor choice (Couple is a profile, not a schedule); wedding_date is the one-event-far-in-future field; missing story_events for Event, Appointment, Payment |

## Cross-cutting findings

### F1. Story screen is broken on every custom vertical (runtime bug, not LLM)

`src/ui/spec-builders/story.ts:122` emits `type: 'DetailRow'`, but
`DetailRow` is registered in the runtime (`src/ui/registry.tsx:161`) and
exists as a component (`src/components/DetailRow.tsx`) — it is **missing
from the JSON Render catalog Zod union** in `src/ui/catalog.ts`. Every
story spec we build fails `catalog.validate` with:

```
elements.detail-name.type: Invalid option: expected one of "Container"|"Row"|…|"CardGrid"
```

Existing jest tests don't catch this because their mocks pass entity
definitions with empty `fields` arrays, so the detail loop doesn't emit any
`DetailRow` elements. In production any custom-generated app with ≥1 field
on the story entity hits this path.

### F2. `business_type: custom` skips vertical-specific enrichment

Fix 1B / 3A (enriched greeting + stats) in `spec-normalizer.ts` fires only
for `business_type` values in the template library (`tutor`,
`shopkeeper`, `doctor`, etc.). The LLM sets `business_type: "custom"` for
every non-library vertical, so all six apps land on the generic `Good
{time_of_day}` greeting and `Today / This Week` stats. The enrichment logic
works, it just never runs for the path the LLM actually takes.

### F3. Subtitle duplicates time_field (2/6)

Personal-chef and real-estate both have a single datetime field on the
anchor entity (`date` / `scheduled_for`) and the LLM reuses it for both
title subtitle and card time. The anchor-card renderer humanizes datetimes
to day labels in the subtitle — so the card shows "Today / 9:00 AM" with
no descriptive context about what the booking is actually for.

### F4. Anchor type vs. entity shape mismatch (tailor)

Tailor has `anchor.type = day_schedule` but anchor entity `Order` has no
date/datetime field. This is caught by SpecValidator's business-logic
check, but the builders happily produce an anchor spec anyway (with
`time_field: null`) and the time column simply renders blank. The
calendar tab further diverges: `calendar_entity = Fitting`, so the user
scrolls a calendar full of items that don't match their anchor list.

### F5. `chat_commands` empty on every vertical

The LLM's system prompt doesn't demand `chat_commands` population for
custom business types, and the normalizer doesn't infer them. Every app
ships without the conversational quick-action surface the runtime
supports.

### F6. story_events coverage is partial

Every vertical has 2-4 entities without `story_events` entries. The UX
impact: when a user lands on, say, an Invoice record in the personal-chef
app, they get a generic FieldRenderer screen instead of a timeline-style
story view. Distribution:

- Law firm: missing TimeEntry, Document, RetainerAccount
- Personal chef: missing Invoice
- Real estate: missing Showing, Offer
- Tailor: missing Fitting, Payment, Fabric
- Tour guide: missing Payment
- Wedding planner: missing Event, Appointment, Payment

### F7. Sample-record names are leaking across verticals

The seeder in `WebSpecProvider.generateSampleRecords` hardcodes
`Ramesh Rao / Sunita Menon / Arun Pillai` plus subtitle copy like
"Regular checkup and cleaning" that is literal dentist-app text. For
law-firm, tailor, personal-chef this leaks into the preview card. Not a
blocker for generation but it makes previews feel wrong.

## Prioritized fix list

### P0 — Ship before the next generation round

**P0-1. Add `DetailRow` to the catalog.** `src/ui/catalog.ts` is missing
the `DetailRow` entry. Add it to the component union so
`buildStorySpec` output validates. Regression test: assert
`catalog.validate(buildStorySpec(spec))` passes for a spec where the
story entity has ≥1 field.

**P0-2. Fix subtitle == time_field in normalizer.** In
`spec-normalizer.ts` Phase B, after resolving `card_display.subtitle`,
compare the resolved template to `card_display.time_field`. If equal,
prefer the first descriptive-text field on the entity (notes, description,
topic, reason, title, etc.) and log a normalization_diff. Tested by
re-running the harness on personal-chef / real-estate — subtitles should
switch to `{description}` / `{notes}`.

**P0-3. Reject or repair day_schedule specs whose anchor entity has no
date field.** When the business-logic validator fires this error, the
normalizer should either (a) downgrade `anchor.type` to `list_feed` or
(b) swap `anchor_entity` to the nearest child entity that has a date
(tailor: Order → Fitting). Today we return `valid: false` and the
generated app renders with a blank time column anyway.

**P0-4. Force non-null `time_field` on day_schedule anchors.** If
`anchor.type == day_schedule` and the picked entity has a date field,
`card_display.time_field` must be set. Today it is explicitly null for
tailor even though the validator already flagged the problem.

### P1 — Ship in the next enrichment pass

**P1-1. Extend Fix 1B/3A to `business_type: custom`.** Rather than key
enrichment on the `business_type` string, key it on anchor-entity and
entity-set keywords. Map keywords → greeting + stats templates. A tour
guide app should greet "Buon giorno, {business_name}" and stat-row
"Today's Tours / This Week / Guests". A law-firm app should stat-row
"Hearings Today / Deadlines This Week / Active Matters". The keyword map
lives in `spec-normalizer.ts` alongside `ICON_MAP`.

**P1-2. Auto-populate missing `story_events` for child entities.** In
the normalizer, for every entity that has a `belongs_to` relationship
back to the anchor entity (or to any story-entity), emit a default
`story_events` entry with `trigger_entity`, `time_field = first date
field`, and `title_template / description_template` from the entity's
text fields. Targets: Invoice, TimeEntry, Document, Showing, Offer,
Fitting, Payment, Event, Appointment.

**P1-3. Infer `chat_commands` from entities.** The normalizer should
emit a default command set per entity: "add {entity}", "show {entity}
today", "find {entity} for {related}". At minimum this gives the chat
surface something to resolve and prevents the empty-state flash.

**P1-4. Swap leaked sample data for vertical-aware seeds.**
`WebSpecProvider.generateSampleRecords` currently uses dentist copy.
Replace with a per-vertical seed bank keyed on anchor-entity keywords
(patient / client / couple / guest / matter), with subtitle text that
matches the `subtitle_template` field's semantic type (note vs. topic
vs. address).

### P2 — Nice to have

**P2-1. Warn when `calendar_entity != anchor_entity`.** It's legal but
usually confusing. Add a SpecValidator warning (not error) so the preview
UI can flag the divergence.

**P2-2. Flag anchors on non-schedule entities.** Wedding-planner chose
`Couple` (a profile-style entity with a single date far in the future)
as the anchor. It works but a day-level calendar-driven UX is the wrong
shape for this business. Heuristic: if anchor entity has ≤1 date field
and that date's median distance from "now" is >30 days, prefer the
child entity that has high-cardinality dates (Appointment / Event). Emit
a SpecValidator warning and optionally let the normalizer auto-swap.

**P2-3. Harness into CI.** Promote
`tests/__scratch/validate-specs.test.ts` and `ui-review.test.ts` into
`tests/generation/` and run them against a frozen corpus of 6+ generated
specs on each PR. Guards against regressions like P0-1 (catalog drift)
and P1-1 (normalizer keyword expansion).

## Top 5 fixes ranked by user-facing impact

1. **P0-1 DetailRow catalog gap** — every custom story screen crashes
   validation today. Highest-blast-radius bug in the pipeline.
2. **P0-2 subtitle == time_field** — affects 33% of generated apps;
   users see a card that repeats the same day label twice instead of
   context.
3. **P1-1 Enriched greeting + stats for `custom`** — the single biggest
   win in "does this feel like my app?" vs. "does this feel generic?".
4. **P0-3 / P0-4 day_schedule on dateless entity (tailor)** — app looks
   broken (blank time column, calendar shows a different list than
   anchor). Full-app quality failure.
5. **P1-2 Missing story_events** — quietly degrades the second-most-used
   screen in every app.

## References

- Raw outputs:
  `.planning/generated-specs-round3/_validation-report.json`,
  `.planning/generated-specs-round3/_ui-review-report.json`
- Generated specs: `.planning/generated-specs-round3/{law-firm,personal-chef,real-estate,tailor,tour-guide,wedding-planner}.json`
- Harness: `tests/__scratch/validate-specs.test.ts`, `tests/__scratch/ui-review.test.ts`
- Prior review (template-library verticals): `.planning/design-review-2026-04-17.md`
- Mockup prompt constraints: `.planning/mockup-prompt.md`
- Runtime tokens: `DESIGN.md`, `src/core/theme/tokens.ts`
