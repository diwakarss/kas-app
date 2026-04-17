# Business-Owner QA — Round-5 Apps

Date: 2026-04-17
Method: end-to-end browser walkthrough (playwright) + static spec analysis
Scope: all 6 round-5 apps (auto-repair, event-dj, food-truck, moving-company, pet-groomer, physio)
Branch: spec-gen-phase-1-2-3-4

## Headline

**The Phase 1/2/3/4 normalizer never runs on served specs.** `backend/functions/generate-spec.ts` stores the raw LLM output and `backend/functions/specs.ts` returns it verbatim. `src/core/context/WebSpecProvider.tsx:176-191` fetches that raw spec and hands it to the renderer without normalizing. The harness that produced the 97.7-avg score in `design-review-round5.md` runs normalization post-fetch, but real users do not.

Every business-owner gap below is downstream of that one missing call.

## Evidence — served-spec survey

All 6 apps, fresh live fetch from `http://localhost:7133/get-spec?id=<uuid>`:

| App | chat_commands | story_events | FK steps in flow | Missing FK steps |
|---|---:|---:|---:|---:|
| auto-repair | **0** | 2/5 | 4/4 | 0 |
| event-dj | **0** | 2/4 | 2/3 | **1** (Booking.client_id) |
| food-truck | **0** | 4/6 | 5/5 | 0 |
| moving-company | **0** | 2/4 | 3/3 | 0 |
| pet-groomer | **0** | 2/4 | 3/3 | 0 |
| physio | **0** | 1/4 | 2/3 | **1** (Session.client_id) |

After running the same specs through `normalizeSpec` locally:
- event-dj → `[normalizeSpec] Injected 1 FK picker step(s) into 'Booking'` + `Inferred 5 chat_commands`
- Story coverage fills in for leaf entities
- Anchor titles get person-name dot-refs
- Greeting template gets `{business_name}`
- Stats label gets entity noun

## Per-screen gaps observed in-browser

### 1. Chat — universally dead [P0]

All 6 apps have a Chat tab in the bottom nav. In all 6, tapping Chat does nothing (no route, no dialog, no commands). Because every served spec has `chat_commands: {}`, the screen has nothing to render. A business owner opening any app taps the speech-bubble icon expecting a natural-language entry point and gets silence.

**Root cause:** `normalizeSpec` has `inferChatCommands` (wired in round-4), but it never runs on the served spec.

### 2. Calendar — events invisible [P0]

Tested on auto-repair. The month grid renders, the current date gets a selected circle, but:
- No dots/indicators on days that have records (Apr 17 has one Job — grid cell looks identical to empty days).
- Tapping a day shows no events list, just a cleared lower half.

A business owner cannot answer "what's on my calendar next Tuesday" from this screen.

### 3. AddFlow — FK fields silently missed [P0]

Concrete case: event-dj Booking add_flow is a 3-step wizard (event_date, venue, deposit). `client_id` — the FK to Client — is not a step. The sample Booking gets saved with `client_id = null`. The Anchor card still shows a client name only because the preview seeds fabricated a client_id field-value. Real production submissions from this flow create orphaned bookings.

Same bug on physio Session: no `client_id` step.

The normalizer's `ensureFkStepsInFlows` (Phase 2-lite) fixes this, but it never fires.

### 4. AddFlow — optional fields have no Skip [P1]

auto-repair Client flow, step 2 "Enter phone": phone is `required: false` in the entity but the step has no `skip_text`, so the wizard shows only "Next" with no way to skip. The business owner types a dummy value to move on. Happens for email/address similarly.

### 5. AddFlow — wrong input keyboards [P1]

auto-repair Client: phone step, email step, address step — all render a generic text `textbox` (no `inputMode="tel"`, no `inputMode="email"`). On mobile web this is a UX gap. The spec-builder pipes `keyboard` into FieldRenderer, but the LLM output rarely sets it on individual steps, and the normalizer doesn't infer it from field type.

### 6. Anchor — date-only time field renders "NaN" [P0]

food-truck shows `12:NaN AM` as the card time. The `DailyOperation.date` field is a `date`-typed value that the anchor config also uses as `time_field`; the time-format helper expects datetime and blows up on `"2026-04-17"`. Visible to a business owner as garbage on the landing screen.

Fix path: the Phase-3 `card_display` normalizer should either (a) set `time_field: null` when the source is a bare date or (b) the time-format helper should render `""`/`"—"` on NaN.

### 7. Anchor — Next-up peek uses raw date when no name exists [P1]

food-truck anchor peek reads `Next: 2026-04-17 · Today`. Because the anchor `title` template is `{Location.name} - {date}`, the peek builder picks the literal composite, and the first non-empty token is the date string. A bare date doesn't read as a "next thing" to a business owner. Only surfaces on apps where the anchor has no person-like title.

### 8. Anchor card click — navigates to parent Story, not anchor entity Story [P1]

auto-repair: Anchor shows Job cards; tapping a card opens the **Client** Story, not the Job Story. The Client Story lists that client's Jobs + Invoices, which is useful, but the mental model ("today's jobs → tap → see this job") breaks. This is deliberate if the card title is `{client.name}`, but the resulting UX is confusing. Happens on every app where the anchor card's title is a dot-ref to a parent entity (5 of 6).

### 9. Story coverage thin — leaf entities have no timeline contribution [P2]

event-dj: only Client + Booking have story_events. Equipment and MusicPreference don't show up in any Story timeline. Same shape in moving-company (DamageClaim missing), pet-groomer (GroomAppointment + GroomCreditPack missing), physio (Session + TreatmentPlan + InsuranceBill missing).

The normalizer synthesizes minimal story_events for leaf entities — not running.

## Per-app unique findings

### auto-repair
- ✅ Client → Vehicle after_add chain works, context summary "Client: Acme Customer" renders.
- ✅ StepProgress counter accurate (1→2→3→4→Done), post-fix from commit `a626de1`.
- ⚠ Invoice flow includes manual `total`, `paid`, `balance` steps. With the money-loop guard disabled (no normalization), balance_due isn't auto-injected. Score report claimed it fired; in the live app it does not.

### event-dj
- ⚠ Equipment + MusicPreference use generic 📄 icon in Add menu (no icon in spec; normalizer doesn't infer).
- ⚠ Booking flow missing client_id picker — **orphan risk**.

### food-truck
- ⚠ `12:NaN AM` on anchor card (date-only time_field).
- ⚠ Anchor title `{Location.name} - {date}` shows "2026-04-17" because the sample Location.name fallback fires late.
- 6 entities is the largest count; picker coverage is clean here because LLM output included all FK steps.

### moving-company
- Subtitle `Sample Origin 1` is generic seed text. Harmless in preview but readable.
- No FK gaps.

### pet-groomer
- ✅ Pet title uses `{pet.name}` → "Buddy" correctly (parent walk resolves).
- ✅ Subtitle `{groom_package}` shows "Bath" — category-choice ranking works even without normalizer because the LLM picked it.

### physio
- ⚠ Session flow missing client_id picker — **orphan risk**.
- ⚠ Subtitle reads "Today" — sample record for `exercises_performed` is a generic seed (the field is `text` type, not `note`, so the contextual-text path skips it).

## Recommended fix (ordered)

1. **Run `normalizeSpec` on serve.** One-line fix in `src/core/context/WebSpecProvider.tsx::fetchPreviewSpec`: `const { spec: normalized } = normalizeSpec(spec); return { success: true, data: { spec: normalized, sampleRecords: generateSampleRecords(normalized) } };` This unblocks chat_commands, FK steps, story_events, stats enrichment across every app — immediately, no backend deploy. Cost: ~5ms per page load.
2. **Better home:** move the same call to `backend/functions/generate-spec.ts` so the stored `spec_json` is normalized once at write time. Requires porting `normalizeSpec` to Deno (tree-shake out Node-only deps) or running the normalization step in the generation worker before `db.insert`. Longer-term correct answer; (1) ships today and buys time.
3. **Time-field NaN guard.** In `src/ui/spec-builders/anchor.ts` (or wherever the card time helper is), return `""` when `Date(value)` is Invalid. Prevents `12:NaN AM` from leaking into the card regardless of spec normalization.
4. **Calendar data wiring.** Calendar screen currently renders month grid without reading records. Needs to query `crud.list(anchorEntity)` and decorate days with dots / populate an events panel when a day is selected. Separate from the normalizer fix.
5. **Chat screen route.** Confirm the Chat button wires to an actual screen. Even with normalized chat_commands, a dead tap means the screen isn't mounted.
6. **Story-tap target decision.** Either make anchor cards open the anchor entity's Story (Job, Session, Booking, …) OR keep the parent-story flow but rename the tap target visually (e.g., small chevron on parent name, main tap area opens anchor-entity story). Product call.
7. **Field keyboard inference.** In `normalizers/add-flows.ts`, set `keyboard: 'email-address' | 'phone-pad' | 'numeric'` on steps whose field type matches. Mobile UX win, zero prompt changes.
8. **Auto Skip for optional fields.** In the same normalizer step, if `required: false` and no `skip_text`, default `skip_text: 'Skip'`. No more typing dummy values.

Items 1–3 fix the majority of what a business owner notices in the first 30 seconds. Items 4–6 are the difference between a demo and a usable app.

## What this round proves

The spec-gen pipeline works (harness score: 97.7/100). The problem is the last foot: the artifact users see in the preview is not the artifact the harness scored. The whole Phase 1–4 normalizer is effectively behind a feature flag that is off by default.

## Snapshots

- `auto-repair-calendar-day17.png` — empty calendar after selecting a day with data
- `food-truck-anchor.png` — `12:NaN AM` on card
- `moving-anchor.png`, `pet-groomer-anchor.png`, `physio-anchor.png` — anchor-rendering reference

## Related commits in scope

- `a626de1` fix: AddFlow blank-page + step-counter off-by-one (prior session; still load-bearing for every app's add wizard)
