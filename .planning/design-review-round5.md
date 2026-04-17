# Round 5 Analysis

Date: 2026-04-17
Scope: 6 fresh LLM-generated specs produced via the insforge edge function
(`POST http://localhost:7133/generate-spec`) against six new verticals not seen
in round-3 or round-4: auto-repair, event-dj, food-truck, moving-company,
pet-groomer, physio. Each ran through `SpecValidator` + `normalizeSpec` and was
scored on the same 100-point rubric used for round-4. Output:
`.planning/generated-specs-round5/_score-report.json`.

Purpose: stress-test the Phase 1/2/3/4 pipeline on inputs the prompt and
normalizer have never seen, and confirm the Phase 4 subtitle-ranking fix
generalizes beyond round-3/round-4 verticals.

## Scores

| Vertical | Score | Anchor | Title | Subtitle | Time |
|---|---:|---|---|---|---|
| auto-repair | **100** | Job | `{client.name}` | `{description}` | scheduled_at |
| physio | **100** | Session | `{client.name}` | `{exercises_performed}` | session_date |
| event-dj | 98 | Booking | `{client.name}` | `{venue}` | event_date |
| moving-company | 98 | Move | `{client.name}` | `{origin}` | move_date |
| pet-groomer | 96 | GroomAppointment | `{pet.name}` | `{groom_package}` | schedule |
| food-truck | 94 | DailyOperation | `{Location.name} - {date}` | `{hours} - {expected_volume} expected` | date |

**Average: 97.7 / 100.** Floor is 94. Every vertical passes validator, zero
injection warnings, story coverage is full, pickers match FK count, money loop
fires or skips correctly (one fire: auto-repair preserves the LLM's manual
`balance_due` on Invoice).

## Round-5 vs round-4

| Metric | Round 4 | Round 5 |
|---|---:|---:|
| Average score | 99.3 | 97.7 |
| Floor | 96 | 94 |
| 100s | 5 / 6 | 2 / 6 |
| `SpecValidator.validate(normalized)` pass | 6 / 6 | 6 / 6 |
| Zero injection warnings | 6 / 6 | 6 / 6 |
| Story coverage full | 6 / 6 | 6 / 6 |
| Pickers match FK count | 6 / 6 | 6 / 6 |
| Subtitle is `{status}` | 0 / 6 | 0 / 6 |
| Subtitle collides with time_field | 0 / 6 | 0 / 6 |

Round-5 is a harder prompt set. The LLM emitted more unusual field names
(`venue`, `origin`, `exercises_performed`, `groom_package`, `expected_volume`)
and one multi-placeholder title (`{Location.name} - {date}`), and the floor
dropped 2 points. Every deduction below 100 is a scorer-strictness call, not a
pipeline defect. Breakdown:

- **event-dj 98, moving-company 98**: subtitles are `{venue}` / `{origin}`.
  Both are real `text` fields with meaningful content. My rubric only awards
  full "rich" credit to text fields matching
  `/address|description|notes|note|summary|topic|reason|activity|service|title|menu|plan/i`
  or named `name`. `venue` and `origin` are information-dense but outside that
  allow-list, so they score 10 ("text") not 12 ("rich"). The pipeline picked
  the right field; the rubric is narrower than real-world readability.
- **pet-groomer 96**: subtitle is `{groom_package}` a category choice. Under
  Phase 4 ranking, category-like choices (`type/package/plan/category/…`)
  rank above status choices but below text, scoring 8. This is by design: the
  anchor has no richer text field (only FKs + schedule + status), so category
  choice is the best available subtitle.
- **food-truck 94**: the LLM emitted title `{Location.name} - {date}` (not a
  single `{parent.field}` dot-ref) and subtitle
  `{hours} - {expected_volume} expected`. Both templates are valid and readable
  but my rubric scores single-placeholder templates higher than
  multi-placeholder composites (8/10 instead of 12/12). Arguably wrong: the
  food-truck rendering is more informative than a bare `{date}`. This is a
  scorer calibration gap, not a pipeline gap.

## Per-vertical notes

### auto-repair (100)
- **Money loop in action**: LLM emitted `Invoice.balance_due` and
  `Invoice.amount_paid` as manual fields. The normalizer's
  `injectBalanceDue` guard is idempotent and skips when manual balance
  exists. Scorer shows `manual balance preserved on Invoice`. This is the
  second vertical after tailor where the money close-loop pattern
  materializes, and the guard does the right thing.
- Anchor: Job → `{client.name}` via single-hop parent walk.
- Pickers: all 4 FK fields got entity_picker steps.

### physio (100)
- Subtitle `{exercises_performed}` is a `note` field — treated as rich. This
  is the clearest demonstration of the Phase 4 ranking paying off: a
  free-form clinical-notes field beats `status` cleanly.

### event-dj (98), moving-company (98)
- Subtitles picked `{venue}` / `{origin}` which are the most useful fields
  on the anchor after `client.name` (which went to title). `venue` and
  `origin` aren't in the rich-names regex but ARE the right choice. Scorer
  penalty is cosmetic.

### pet-groomer (96)
- Title `{pet.name}` via belongs_to parent walk — the normalizer correctly
  picked Pet (not Client) as the title parent because GroomAppointment
  belongs_to Pet directly.
- Subtitle `{groom_package}` demonstrates the category-choice ranking
  introduced in Phase 4: the anchor has no descriptive text field, but
  `groom_package` is a `package`-named choice so it scores as medium (8)
  rather than being passed over for `status`.

### food-truck (94)
- Anchor `DailyOperation` is an unusual noun — the LLM didn't emit a
  client-like parent, so title is `{Location.name} - {date}`. The normalizer
  preserves the LLM's multi-placeholder template because it validates
  cleanly (every placeholder resolves to a real field), and the rendered
  string is readable: e.g., "Park Ave Food Cart - 2026-04-17".
- Subtitle `{hours} - {expected_volume} expected` is similarly composite
  and readable.
- 6 entities, 5 FK steps, 5 picker steps.

## What this round proves

1. **Phase 4 ranking generalizes.** On 12 total verticals (6 round-4 + 6
   round-5) not one anchor subtitle is `{status}`. The category-over-status
   preference (`package` > `status`, `type` > `status`) fires cleanly on
   pet-groomer's `groom_package` and earlier on yoga's `type`.
2. **Money loop is narrow by design.** It fired on tailor (round 3) and
   auto-repair (round 5, manual balance preserved). Skipped correctly on 10
   verticals where either (a) no payment entity exists or (b) the LLM emitted
   a manual balance field. Zero false positives.
3. **Picker coverage is 100%.** Every FK field in every add_flow across 12
   verticals got an entity_picker step. The Phase 2-lite FK injector is
   doing its job.
4. **Injection regression stays fixed.** Zero `${…}` warnings across 12
   normalized specs.

## Open items (carry-forward)

- **Multi-placeholder title rendering.** food-truck's
  `{Location.name} - {date}` is valid and renders fine, but the rubric
  penalizes it vs single `{parent.field}`. Either tighten the normalizer
  to prefer single-hop dot-refs when available, or widen the scorer's
  "rich" definition for multi-placeholder templates that contain at least
  one parent ref. Lean toward the scorer fix — the LLM template is readable.
- **`venue` / `origin` as rich text.** These aren't in the rich-names
  regex. Decision: add them, or accept that "rich" is a rubric artifact and
  any subtitle that's a bare text field (type=text, non-FK) should score
  ≥10 regardless of name. Low-risk widening.
- **Multi-hop templates (3.3)** — still deferred. Unchanged from round 4.

## Summary

Phase 1/2/3/4 holds on unseen verticals. The pipeline's worst score is 94
and every deduction below 100 is a rubric-calibration question, not a
pipeline defect. The Phase 4 subtitle-ranking fix (category-choice >
status-choice) generalizes — pet-groomer's `groom_package` is exactly the
shape it was designed to catch. Ready to ship.
