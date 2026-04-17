# Round 3 Post-Fix Analysis

Date: 2026-04-17
Scope: Re-ran the same 6 custom-vertical specs from `.planning/generated-specs-round3/`
through the updated normalizer + catalog, then re-ran
`tests/__scratch/validate-specs.test.ts` and `tests/__scratch/ui-review.test.ts`.

Output: `.planning/generated-specs-round3/_ui-review-report.json`,
`.planning/generated-specs-round3/_validation-report.json`.

## What changed in code

### Pass 1 (P0 + P1-1/P1-3)

| Fix | File | Change |
|---|---|---|
| P0-1 | `src/ui/catalog.ts` | Added `DetailRow` to the component Zod union + `kasComponentNames` list |
| P0-2 | `src/generation/services/spec-normalizer.ts` | `normalizeAnchor`: if `subtitle` template resolves to the same field as `time_field`, swap to the first descriptive text field (description/notes/topic/status) |
| P0-3/4 | `src/generation/services/spec-normalizer.ts` | Generalized the dateless-anchor auto-swap so non-person transactional anchors (e.g. Order in tailor) swap to a schedulable child entity; downgrade `anchor.type` to `active_list` when no such child exists; when a swap happens, reset `card_display.title/subtitle/time_field` so LLM templates for the old entity don't leak through |
| P1-1 | `src/generation/services/spec-normalizer.ts` | Greeting: if LLM-emitted `greeting_template` is missing `{business_name}`, append it. Stats: if default "Today / This Week" labels, rewrite to `{anchor_plural} Today / This Week / Active {anchor_plural}` (third stat only when anchor has a status-like choice field). Empty-state message/action made entity-aware. |
| P1-3 | `src/generation/services/spec-normalizer.ts` | New `inferChatCommands`: when spec has no `chat_commands`, emit `add {entity}` for every entity and `show {entity plural} today` for entities with a schedule date field |
| Title chain | `src/generation/services/spec-normalizer.ts` | `findPrimaryTextField` now excludes `_id` fields; new **Phase C** title resolution: when anchor's primary field is weak (FK, choice, number, date), fall back to `{parent.parent_primary}` via any belongs_to chain |

### Pass 2 (P1-2 + P1-4 + P2-2 + calendar alignment)

| Fix | File | Change |
|---|---|---|
| P1-2 | `src/generation/services/spec-normalizer.ts` | New `ensureStoryEventsForAllEntities`: after the belongs_to-target inference runs, fill in a minimal `{events:[], stats_card, origin, context}` block for every remaining entity so leaf entities (Invoice, Payment, Fitting, Fabric, Event, Appointment) all render a Story screen |
| P1-4 | `src/generation/services/sample-seeds.ts` (new), `src/core/context/WebSpecProvider.tsx`, `tests/__scratch/ui-review.test.ts` | Extracted sample-text into a shared `VERTICAL_SAMPLE_TEXT` bucket keyed by vertical (`legal`, `real_estate`, `tailoring`, `tour_guide`, `personal_chef`, `wedding`, `education`, `pet_care`, `fitness`, `health`, `generic`). `detectVertical(spec)` infers the bucket from entity/field names. WebSpecProvider and the offline harness now both generate vertical-appropriate copy instead of dentist-demo text. |
| P2-2 | `src/generation/services/spec-normalizer.ts` | Added `CONTAINER_NAMES` + `isContainerEntity`. New branch in `normalizeAnchor`: when anchor is person/container-like AND a non-person, non-container child with its own schedule date exists, swap to the child. Fires *in addition to* the existing dateless-anchor swap. Wedding-planner's anchor now auto-swaps from Couple → Event. |
| Calendar alignment | `src/generation/services/spec-normalizer.ts` | Root normalizer now computes the anchor first and realigns `calendar.entity` to match the (possibly swapped) anchor when they diverge. Previously the calendar would keep picking the original anchor entity after a swap, so Anchor and Calendar tabs showed different lists. |

All 656 existing tests (44 suites) pass. 2 scratch harness suites pass.

## Before / after per vertical

| Vertical | Before round 3 | After pass 1 | After pass 2 |
|---|---|---|---|
| **Law firm** | title=`{client.name}` · subtitle=`{description}` · stats=`Today / This Week` · story validate=❌ | Same title/subtitle. stats=`Matters Today / This Week / Active Matters`. story validate=✅. card: `Ramesh Rao / Regular checkup and cleaning / Today` (dentist leak) | vertical=`legal`. card: `Ramesh Rao / Drafting settlement agreement / Today`. story coverage 5/5 |
| **Personal chef** | title=`{client.name}` · subtitle=`{date}` collision · story validate=❌ | subtitle auto-swapped to `{status}`. card: `Ramesh Rao / Scheduled / 9:00 AM` | vertical=`personal_chef`. card unchanged. story coverage 3/3 |
| **Real estate** | title=`{client.name}` · subtitle=`{scheduled_for}` collision · story validate=❌ | subtitle auto-swapped to `{status}`. card: `Ramesh Rao / Scheduled / 9:00 AM` | vertical=`real_estate`. card unchanged. story coverage 4/4 |
| **Tailor** | anchor=Order (no date) · time_field=null · calendar=Fitting (mismatch) · story validate=❌ | anchor swapped to Fitting. title via Phase C → `{order.description}`. subtitle=`{notes}`. card: `Regular checkup and cleaning / Good progress. / 9:00 AM` (dentist leak) | vertical=`tailoring`. card: `Bridal lehenga, heavy work / Awaiting fabric delivery / 9:00 AM`. story coverage 5/5 |
| **Tour guide** | title=`{meeting_point}` · subtitle rewritten to `{tour_type}` · story validate=❌ | Same title/subtitle. stats=`Tours Today / This Week / Active Tours`. story validate=✅ | vertical=`tour_guide`. card unchanged. story coverage 4/4 |
| **Wedding planner** | title=`{name}` · subtitle rewritten to `{notes}` · story validate=❌ | Same title/subtitle. stats=`Couples Today / This Week` (no status field, no third stat). story validate=✅ | anchor auto-swapped Couple → Event. title=`{couple.name}`. subtitle=`{notes}`. calendar realigned to Event. card: `Priya & Arjun / Bride wants mandap facing east / Today`. story coverage 5/5 |

## Pass/fail totals

| Check | Round 3 (before) | After pass 1 | After pass 2 |
|---|---|---|---|
| SpecValidator.validate(normalized) passes | 5 / 6 | 6 / 6 | 6 / 6 |
| buildAnchorSpec → catalog.validate | 6 / 6 | 6 / 6 | 6 / 6 |
| buildStorySpec → catalog.validate | 0 / 6 | 6 / 6 | 6 / 6 |
| buildCalendarSpec → catalog.validate | 6 / 6 | 6 / 6 | 6 / 6 |
| Greeting contains `{business_name}` | 0 / 6 | 6 / 6 | 6 / 6 |
| Stats are entity-aware | 0 / 6 | 6 / 6 | 6 / 6 |
| `chat_commands` non-empty | 0 / 6 | 6 / 6 | 6 / 6 |
| Subtitle collides with time_field | 2 / 6 | 0 / 6 | 0 / 6 |
| day_schedule anchor with no date field | 1 / 6 | 0 / 6 | 0 / 6 |
| time_field null on day_schedule | 1 / 6 | 0 / 6 | 0 / 6 |
| story_events covers all entities | 0 / 6 | 0 / 6 | **6 / 6** |
| Sample copy matches vertical | 0 / 6 | 0 / 6 | **6 / 6** |
| Calendar entity matches anchor entity | 5 / 6 | 5 / 6 | **6 / 6** |
| Wedding anchor is day-to-day activity (not Couple) | ❌ | ❌ | ✅ |

After pass 2, the only remaining finding across all 6 specs is one INFO on law-firm:
`anchor "Matter" has multiple date fields (court_date, filing_deadline) — time_field "court_date" picks one`.
That's informational, not a bug — the normalizer correctly picked one.

## Remaining open items

- **Cross-entity chain titles for tailor**: Phase C picks `{order.description}` via the
  Order parent. The richer `{order.client.name}` would require the template engine
  to support multi-hop dot-notation and the anchor data loader to fetch the
  parent's parent. Deferred — the current single-hop title reads fine.
- **Harness promotion**: `tests/__scratch/` harness suites guard against the exact
  regressions we just fixed (DetailRow catalog gap, subtitle/time collision,
  anchor swap breakage, sample-text leakage). Worth promoting to `tests/generation/`
  in a follow-up so CI catches these on every PR.

## Summary

All P0, P1, and P2 fixes from round 3 shipped. Every spec now:

- renders a working day-schedule with the right anchor entity,
- greets the user with their business name,
- labels stats with their entity noun (`Matters Today`, `Fittings Today`),
- shows vertical-appropriate sample copy (bridal lehengas for tailor, settlement
  drafting for law firm, mandap setup for wedding),
- has a Story screen for every entity,
- and has Anchor and Calendar tabs pointing at the same list.

Wedding-planner, which was the weakest anchor choice in round 3 (Couple with
a single far-future date), now auto-swaps to Event — the recurring child
activity — so the home screen shows day-to-day scheduled work.
