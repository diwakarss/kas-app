# Design Review: Generated Business Apps (12-app sweep)

**Date:** 2026-04-17
**Scope:** Runtime UI (Anchor/Story/AddFlow/Calendar/Search) rendered across 12 generated business specs
**Mockups:** `~/.gstack/projects/diwakarss-kas-app/designs/generated-apps-20260416/` (01-dental through 12-grooming, 12 PNGs)
**Overall Score:** 5/10 → 8/10 (after fixes listed below)

## System Audit
- **DESIGN.md:** Missing. Theme tokens exist at `src/core/theme/tokens` but are undocumented.
- **UI Scope:** Runtime screens `AnchorScreen`, `StoryScreen`, `AddFlowScreen`, `CalendarScreen`, `SearchOverlay`. Components: `Greeting`, `StatsCard`, `EntityCard`, `EmptyState`, `FloatingActions`, plus timeline/detail bits for Story.
- **Prior Reviews:** `/plan-eng-review` on `iterative-sleeping-bentley.md` (CLEAN). First design review.
- **Retrospective:** No prior design review cycles. Runtime has shipped but cross-spec UX never audited.

## Apps Tested (12)

| App | Persona | Anchor entity | Card title / subtitle | Mockup |
|---|---|---|---|---|
| Bright Smile Dental | Patients | Appointment | `{client.name}` / `{description}` | 01-dental.png |
| Urban Bites Cafe | Orders | Order | `{client.name}` / `{order_date}` | 02-cafe.png |
| FitTrack Gym | Sessions | Session | `{client.name}` / `{description}` | 03-gym.png |
| Little Stars Academy | Daycare | Child | `{child.name}` / `{date}` | 04-daycare.png |
| GreenThumb Landscaping | Jobs | Job | `{client.name}` / `{description}` | 05-landscaping.png |
| Pawsome Vet Clinic | Appointments | Appointment | `{pet.name}` / `{description}` | 06-vet.png |
| SnapLight Studio | Shoots | Shoot | `{client.name}` / `{description}` | 07-photo.png |
| QuickFix Plumbing | Jobs | Job | `{client.name}` / `{description}` | 08-plumbing.png |
| Melody Academy | Lessons | Lesson | `{student.name}` / `{instrument}` | 09-music.png |
| SpeedWrench Auto | Appointments | Appointment | `{client.name}` / `{description}` | 10-auto.png |
| HiveDesk Co | Bookings | DeskBooking | `{client.name}` / `{desk_number}` | 11-cowork.png |
| Paws & Suds | Grooming | GroomingSession | `{dog.name}` / `{description}` | 12-grooming.png |

---

## Pass 1 — Information Architecture: 5/10 → 8/10

### What's working
- Single consistent layout (greeting → stats → card list → FAB) IS a feature, not a bug, across 12 businesses. Owners learn it once.
- Card pattern (title/subtitle/time) with `numberOfLines={1}` handles long names safely (`EntityCard.tsx:37-42`).
- Title-flip logic now correctly shows person/subject name for activity entities (normalizer Phase B).

### Critical gaps
1. **Card time slot is empty in 12/12 apps.** `EntityCard.tsx:44-46` renders `formatTime(time)`, but `useAnchorData.ts:141-144` only populates `time` if `dateField` exists AND the value includes `'T'`. For apps with `date` (not `datetime`) schedule fields, the time slot shows empty. Worse, the LLM rarely populates `card_display.time`, so the right third of every card is wasted real estate.
2. **Subtitle is ambiguous for 4 apps.** Daycare shows `2026-04-17` (the ISO date), Cowork shows `42` alone, Cafe shows `2026-04-17`. These are low-value subtitles — users need context not raw fields.
3. **Stats card has NO labels.** `StatsCard.tsx:22-29` renders `item.value` but NOT `item.label`. Every app shows two bare numbers (e.g. "3  12") with no "Today" / "This Week". **This is a P0 bug, not just a design issue.**

### Fix to 10
- **Fix 1A:** In `useAnchorData.ts`, always populate `time` from datetime fields. If the field is `date` only, render a human date ("Today", "Tomorrow", "Apr 18") instead of blank. If no time exists, hide the column so title/subtitle expand to full width.
- **Fix 1B:** Subtitle fallback logic: if resolved subtitle is an ISO date, format to "Apr 17"; if it's a bare number, prepend the field's display_name ("Desk 42"); if empty, fall back to status field. Add this as a new guard in `buildAnchorSpec` or the template engine.
- **Fix 1C:** `StatsCard.tsx:26-28` — render `{item.label}` above `{item.value}` (small mist-colored label, larger clay-colored value). This single fix meaningfully improves comprehension across all 12 apps.

---

## Pass 2 — Interaction State Coverage: 3/10 → 7/10

### Current state matrix (from `AnchorScreen.tsx` + `EmptyState.tsx`)

| FEATURE | LOADING | EMPTY | ERROR | SUCCESS | PARTIAL | FIRST-RUN |
|---|---|---|---|---|---|---|
| Anchor screen | spinner + "Loading spec..." (L46-56) | EmptyState (message + optional pill button, L10-27) | Generic "Error" title + msg (L59-71) | ✅ card list | ❌ none | ❌ none |
| Story screen | spinner (L46-53) | ❌ "Entity not found" only (L56-65) | Same as empty | ✅ timeline | ❌ none | ❌ none |
| AddFlow | (not inspected) | — | — | — | — | — |
| Card tap | — | — | — | navigates | ❌ none (slow nav no feedback) | — |

### Critical gaps
1. **First-run is identical to empty state.** Day 1 user opens app, sees "No items found" with maybe a button. No welcome, no orientation, no sample data promise. Worst possible first impression.
2. **Error states are generic.** `AnchorScreen.tsx:59-72` shows whatever string `error` contains. If the LLM spec is malformed, users see raw validator errors. No recovery path.
3. **Sample data issue (preview mode):** `WebSpecProvider.tsx` generateSampleRecords creates 3 records with the SAME NAME for person entities (`sampleNames` cycles the same name per index). Mockups 01-12 all show three identical patient/client/pet names. This looks broken on first impression.
4. **Partial states:** What if 2 of 3 records have related data but one doesn't (missing FK)? Runtime silently shows the raw template token. Bad.

### Fix to 10
- **Fix 2A:** Add a first-run state to `EmptyState.tsx` — bigger illustration (SVG, not emoji), 2-line welcome, "Add your first [Entity]" primary button. Detect first-run via `spec.meta.created_date < 1 minute ago`.
- **Fix 2B:** Classify errors in `AnchorScreen.tsx`: spec-malformed (show "Your app isn't ready yet, regenerate"), network (show retry), runtime (show friendly + file a report link). Keep raw error behind a "Details" toggle.
- **Fix 2C:** Preview sample data — cycle 3 DIFFERENT names from the list in `WebSpecProvider.tsx:85-89`. The list already has 3 names; the `%` math uses the same name because `i % count` with count=3 gives 0,1,2 but the rendering uses it as a repeated lookup. Verify and fix.
- **Fix 2D:** Template engine fallback: when a template ref fails to resolve, render `—` not the raw `{foo.bar}` string.

---

## Pass 3 — User Journey & Emotional Arc: 4/10 → 7/10

### Storyboard (archetype: Dental)

| STEP | USER DOES | USER FEELS | PLAN SPECIFIES? |
|---|---|---|---|
| 1 | Opens app at 8am | "What's my day?" | ✅ day_schedule anchor |
| 2 | Sees "Good morning" + date | Neutral — could be any app | ❌ no business identity |
| 3 | Sees "Today 3" / "This Week 12" | What do these numbers mean? | ❌ labels missing |
| 4 | Sees 3 appointment cards | "These all look the same" | ❌ same name 3x |
| 5 | Taps a card | Expects full context | ✅ Story screen |
| 6 | Adds new record | 30 seconds to first save | ⚠️ flow untested |
| 7 | Week 2 return | "Does this know me?" | ❌ no personalization |

### Critical gaps
- **Greeting is deterministically "Good {time_of_day}".** Every one of the 12 specs has `"greeting_template": "Good {time_of_day}"`. That's 12 indistinguishable homescreens.
- **No momentum feedback.** Week count doesn't show trend ("+4 vs last week"). Completed today doesn't celebrate.
- **No "what's next?"** — if the day has 3 appointments, which one is in 10 min vs 4pm? The ISO time is buried.

### Fix to 10
- **Fix 3A:** Broaden greeting templates. In `useAnchorData.ts:204`, support richer templates. Normalizer should inject variety: `"Good {time_of_day}, {business_name}"` or `"{count} {entity_plural} today, let's go"` based on count.
- **Fix 3B:** Add "next up" peek to the greeting card — if earliest appointment is in <30 min, show "Next: Ramesh Rao at 9:00 AM". Pull from `cards[0]`.
- **Fix 3C:** Stats trends — add `last_week_count` and show delta ("+3 vs last week"). Requires a second SQL query in `useAnchorData` around line 240.

---

## Pass 4 — AI Slop Risk: 6/10 → 8/10

### Mockup audit against AI Slop blacklist
- [✅] No purple/indigo gradients — all apps used warm neutrals or business-appropriate palettes
- [✅] No 3-column feature grid
- [✅] No decorative blobs, wavy SVG dividers
- [❌] **Grooming app (12) has three dog illustrations** — despite "no emoji" constraint in brief. This is exactly the AI slop pattern ("cute illustrations as decoration"). Real runtime doesn't render these, but if anyone uses emoji icons like 🐕 on entity.icon, they'll show up.
- [⚠️] All 12 use card-based layouts. Cards are the default; the card is the interaction. That's OK here — people ARE tapping into records. Lower risk.
- [⚠️] Stats cards across apps are identical visual treatment. Same container, same "two numbers side by side" — reads as template, not designed.

### Runtime-specific slop risks
1. **Entity icons are emoji** — `spec-dental2.json` has `"icon": "📅"` for Appointment. In the runtime (`StoryScreen.tsx:28`), `entityIcon` renders this emoji. On Story screen this is fine; on mockups less so. Check if icons appear anywhere else.
2. **"Today's Appointments" section header format** is identical across 12 apps. Consider variation or let users rename.
3. **Sample data tell:** `Sample Description 1`, `Sample Description 2` — we fixed this via SAMPLE_TEXT map but untested fields still use it.

### Fix to 10
- **Fix 4A:** Audit runtime for emoji rendering. Anchor doesn't show entity icon (good). Story shows it (`StoryScreen.tsx:28`). Consider whether that's on-brand or slop.
- **Fix 4B:** Let the user pick a stats card variant at generation time (e.g., compact row vs tall widget) — or differentiate by business_type.

---

## Pass 5 — Design System Alignment: 2/10 → 6/10

### Current state
- **No DESIGN.md at repo root.** `docs/` has wave-specific notes but no design system reference.
- **Tokens exist at** `src/core/theme/tokens.ts` — colors named `dawn`, `ember`, `mist`, `clay`, `stream`. Cryptic without a reference.
- **Typography:** Inter variants used directly (`font-inter-semibold`, `font-inter-medium`) — no scale documented.
- **Spacing:** Tailwind classes used ad-hoc (`mx-5`, `mb-3`, `p-4`) — no documented scale.
- **Shadows:** Inline style on `EntityCard.tsx:27-33` and `StatsCard.tsx:14-20` — duplicated. Should be a token.

### Critical gaps
- Every new component reinvents shadow values, border radii, spacing.
- No contrast audit — `mist` color on cream background — pass WCAG AA? Unknown.

### Fix to 10
- **Fix 5A:** Create `DESIGN.md` at repo root documenting:
  - Color tokens (dawn/ember/mist/clay/stream) with hex + semantic meaning + on-which-background.
  - Type scale (sizes, weights, line-heights) mapped to semantic names.
  - Spacing scale.
  - Shadow presets (card-shadow, modal-shadow).
  - Border-radius scale.
  - Example component patterns.
- **Fix 5B:** Extract shadow style to a shared token (e.g., `cardShadow`) and use from both `EntityCard.tsx` and `StatsCard.tsx`.
- **Fix 5C:** Run `/design-consultation` on the existing tokens to formalize a system.

---

## Pass 6 — Responsive & Accessibility: 5/10 → 8/10

### Current state
- **Mobile-first:** React Native, so mobile is the primary target. Tablet is auto via RN layout but not optimized.
- **Touch targets:** Most pressables use `p-4` (16px padding) or `p-3` (12px) which hits the 44x44 minimum for cards. Some tight spots:
  - `AddFlowScreen` inspected separately
  - FAB circular button — likely 56px, fine.
- **Keyboard nav:** Not applicable on mobile.
- **Screen readers:**
  - ✅ `EntityCard.tsx:25` has proper `accessibilityRole="button"` and descriptive label combining title/subtitle/time.
  - ❌ `StatsCard.tsx` has no `accessibilityLabel` — screen reader would just announce "3" and "12" with no context.
  - ❌ `Greeting.tsx` — no `accessibilityRole="header"`.
  - ❌ `SectionHeader.tsx` — check.
  - ❌ `FloatingActions.tsx` — need accessibility labels on each action.
- **Color contrast:**
  - `clay` on `dawn` — body text on background, need to verify 4.5:1.
  - `mist` on `dawn` — secondary text, often fails AA for body but OK for non-essential.

### Fix to 10
- **Fix 6A:** Add `accessibilityRole="header"` to `Greeting` and `SectionHeader`. Add `accessibilityLabel` to `StatsCard` combining label+value ("Today, 3 items" / "This week, 12 items").
- **Fix 6B:** Audit color tokens for WCAG AA. Document contrast ratios in DESIGN.md (Fix 5A).
- **Fix 6C:** Tablet: Add breakpoint at 768+ to use 2-column card grid instead of single stack. Low effort, big win for iPad users.

---

## Pass 7 — Unresolved Design Decisions

Each of these is a genuine design choice requiring an opinion, not just an obvious fix.

| # | DECISION NEEDED | IF DEFERRED, WHAT HAPPENS |
|---|---|---|
| 1 | Should the greeting include the business name / count / "next up" info? Or stay minimal? | Every app stays indistinguishable from every other. |
| 2 | When sample data is shown in preview mode, should it be labeled "Preview data"? | Users can't tell sample from real data on day 1. |
| 3 | When `card_display.time` is empty, should we hide the column or show a secondary field (like status)? | Wasted right-third of every card. |
| 4 | Should stats card show trends (+X vs last week) or stay as bare counts? | No momentum signal; app feels static. |
| 5 | Should the anchor entity icon render on the home screen (top-left of each card)? | Cards look undifferentiated visually. |
| 6 | Should we document tokens NOW (DESIGN.md) or wait until a second designer joins? | Every new component reinvents shadow/spacing. |
| 7 | Tablet layout: 2-column grid or same mobile stack? | iPad users feel the app is "phone-only". |

---

## NOT in scope (explicitly deferred)
- Dark mode theme — theme tokens in place but no dark variants.
- Accessibility: RTL language support.
- Calendar screen deep review (single-pass note only).
- SearchOverlay UX (single-pass note only).
- Onboarding / first-run tour beyond empty state fix.
- Settings screen (doesn't exist yet).

## What already exists (reuse)
- `Greeting`, `StatsCard`, `EntityCard`, `EmptyState`, `SectionHeader`, `FloatingActions`, `ComingUpCard`, `DetailRow`, `FieldRenderer` — keep and extend, don't replace.
- Theme tokens at `src/core/theme/tokens` — formalize via DESIGN.md, don't rename.
- Template engine (`src/engines/template-engine`) — already handles `{entity.field}` ref resolution.
- Normalizer Phase A/B (`src/generation/services/spec-normalizer.ts`) — already flips titles correctly.
- Sample data map (`src/core/context/WebSpecProvider.tsx:36-47`) — already has contextual SAMPLE_TEXT; needs extension.

## Completion Summary

```
+====================================================================+
|         DESIGN PLAN REVIEW — COMPLETION SUMMARY                    |
+====================================================================+
| System Audit         | No DESIGN.md, runtime shipped, 12 apps     |
| Step 0               | Initial rating 5/10                         |
| Pass 1  (Info Arch)  | 5/10 → 8/10                                |
| Pass 2  (States)     | 3/10 → 7/10                                |
| Pass 3  (Journey)    | 4/10 → 7/10                                |
| Pass 4  (AI Slop)    | 6/10 → 8/10                                |
| Pass 5  (Design Sys) | 2/10 → 6/10                                |
| Pass 6  (Responsive) | 5/10 → 8/10                                |
| Pass 7  (Decisions)  | 7 surfaced, 0 resolved, 7 pending user     |
+--------------------------------------------------------------------+
| NOT in scope         | 6 items                                     |
| What already exists  | written                                     |
| TODOS proposed       | 14 (see fixes above)                        |
| Approved Mockups     | 12 generated                                |
| Decisions made       | 14 added as concrete fixes                  |
| Decisions deferred   | 7 (Pass 7 table, pending user)              |
| Overall design score | 5/10 → 8/10 (after fixes ship)              |
+====================================================================+
```

## Approved Mockups

| Screen | Mockup Path | Direction | Notes |
|---|---|---|---|
| Anchor — Dental | `~/.gstack/projects/diwakarss-kas-app/designs/generated-apps-20260416/01-dental.png` | Service + appointments | Person-as-subject title. Empty time slot visible. |
| Anchor — Cafe | `~/.../02-cafe.png` | Orders w/ line items | ISO date as subtitle is bad; needs format fix. |
| Anchor — Gym | `~/.../03-gym.png` | Sessions | Works well. Orange FAB pops. |
| Anchor — Daycare | `~/.../04-daycare.png` | Two-level hierarchy | Subtitle is just a date — low value. |
| Anchor — Landscaping | `~/.../05-landscaping.png` | Service + description | Good. Green brand color restrained. |
| Anchor — Vet | `~/.../06-vet.png` | Pet-as-subject | Pet name title works. Owner absent (correct). |
| Anchor — Photo | `~/.../07-photo.png` | Editorial | Good restraint. |
| Anchor — Plumbing | `~/.../08-plumbing.png` | Dark theme variant | Shows dark works, but sample owner renders in white card. |
| Anchor — Music | `~/.../09-music.png` | Warm ivory | Stats row layout is compressed — check at real resolution. |
| Anchor — Auto | `~/.../10-auto.png` | Dark graphite | Stats has label this time (design brief won, runtime doesn't). |
| Anchor — Cowork | `~/.../11-cowork.png` | Desk numbers | "Desk 42" as subtitle — OK but short. |
| Anchor — Grooming | `~/.../12-grooming.png` | Warm peach | Dog illustrations are AI slop — reject direction, use text only. |

## Review Log

See conversation output for Review Readiness Dashboard.

---

## Visual Pass Addendum (actual mockup inspection, 2026-04-17)

The 7 passes above were drafted from runtime code. After loading and viewing every PNG, these adjustments and new findings apply:

### Validated from code ↔ mockup gap
- **1A StatsCard label bug**: Mockups SHOW "Today" / "This Week" labels, but `src/components/StatsCard.tsx:22-29` renders only `{item.value}`. Labels are a gpt-image-1 hallucination from the prompt. The bug is real — actual runtime shows bare numbers with no context. **Promote to P0.**
- **1B greeting identical**: Confirmed visually — 12 of 12 apps show "Good morning". Dental shows "Monday, April 16"; the other 11 show "Friday, April 17" (dental mockup ran earlier in the day). The greeting is template-generic across every vertical.

### New findings (only visible from the pixels)

**New-A: Sample data repeats same person on every card** — 10 of 12 apps show the same name 3x in a row (Ramesh Rao × 3, Anjali Verma × 3, Suresh Reddy × 3, Buddy × 3, Priya Patel × 3, Mohan Das × 3, Rahul Sharma × 3, Sanjay Mishra × 3, Neha Gupta × 3, Luna × 3). Daycare is the exception — shows 3 different children. Root cause: `generateSampleRecords()` in `WebSpecProvider.tsx:102-104` sets FK to `(i % count) + 1` but activity FK lookups against the relatedMap may resolve to the same parent when parent records share the primary text field. Verify parent record generation uses distinct names per index.

**New-B: Cafe subtitle renders date instead of description** — `02-cafe.png` shows "Anjali Verma / 2026-04-17" 3x. The Order entity likely has no free-text description field, so the card_display.subtitle falls back to a date. Normalizer should prefer text fields over date fields for subtitle.

**New-C: Music app has an inconsistent stats layout** — `09-music.png` renders "Today 8 / This Week 32" horizontally next to the brand lockup, not as a separate card. The rest of the apps use the standard 2-column StatsCard. Either Music was rendered against a different layout variant or the prompt freestyled. Investigate whether the spec generated a different anchor template.

**New-D: Auto app missing brand name** — `10-auto.png` jumps straight into "Good morning" with no business name header. Most others show "[Business Name]" above the greeting. Either the Auto spec's `meta.name` wasn't rendered, or the template omitted it in this run.

**New-E: Dark theme apps (Plumbing, Auto)** — Both `08-plumbing.png` and `10-auto.png` use a graphite/navy palette, while the other 10 use dawn/cream. There's no dark theme in the runtime code; these are gpt-image-1 taking editorial license. Not a runtime issue, but the design binary's prompt needs a "light theme only, dawn/cream background" constraint for future mockup runs.

**New-F: Grooming dog illustrations** — `12-grooming.png` shows full-color cartoon dog faces on each card. Runtime has no image field on the Pet entity, and EntityCard doesn't render images. AI slop. Same fix as 4A — tighten mockup prompt.

**New-G: Daycare stats card is floating** — `04-daycare.png` positions the stats card inside a sub-header region that reads "Little Stars Academy" with star icons. This is prettier than the other 11 but, again, not in code. Flagging that the design direction (stars-as-brand-accent) is worth considering.

### Updated fix priorities after visual inspection

| Rank | Fix | Reason |
|---|---|---|
| P0 | 1A StatsCard label | Affects all 12 apps. Real code bug confirmed. |
| P0 | New-A Sample data repeat | Makes the app look broken on first run. |
| P0 | New-B Cafe subtitle fallback | Normalizer should prefer text over date for subtitle. |
| P1 | 1B Greeting context | Identical greeting is the second thing the eye catches. |
| P1 | 1C Time column blank | Confirmed blank on several mockups. |
| P2 | New-D Brand name missing | One-off; check whether it's spec or template. |
| P2 | Mockup-gen | New-E, New-F, 4A (not runtime) — update prompt constraints. |
| P2 | New-C Music layout | Spec inspection — likely a calendar-vs-schedule anchor swap. |

### Overall score revision
After seeing the actual pixels: **initial 5/10 → 7/10 after the 14 fixes + 3 new P0s (New-A, New-B, New-G investigation)**. Previous target of 8/10 assumed labels rendered. They don't — so the post-fix ceiling moves up once 1A + New-A + New-B land. Realistic target after execution: **8/10**.

### Mockup quality caveat
gpt-image-1 mockups are directionally useful but invented details: labels that aren't in code, illustrations that don't exist, dark themes the runtime can't produce. For the next mockup round, lock the prompt to: "light theme, dawn/cream bg, no illustrations, no icons on cards, render labels only if the component renders them in code." Otherwise we review a fictional app.
