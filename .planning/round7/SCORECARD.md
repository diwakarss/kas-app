# Round 7 — Post-fix Scorecard

10 fresh specs to validate the 5 upstream gap fixes from round-6. 4 are
intentional A/B re-tests (worst round-6 verticals) + 6 fresh verticals.
All 10 pass `SpecValidator` cleanly.

## URLs for manual verification

| Slug | Business | Preview URL |
|------|----------|-------------|
| dental-practice | Bright Smile Dental | http://localhost:8081/?spec_id=9e086ebf-ae9f-4305-8be4-f58dcc5e25fc |
| beauty-spa | Lotus Wellness Spa | http://localhost:8081/?spec_id=c29f2b23-74d1-44d4-9015-d7039c5dd589 |
| music-school-v2 | Crescendo Academy | http://localhost:8081/?spec_id=e9544c3a-69ef-4533-b692-57478b0d1827 |
| accounting-firm | Ledger & Co | http://localhost:8081/?spec_id=0e83bc29-247b-4ee3-82cb-644346262a62 |
| plumber | Quick Pipe Plumbing | http://localhost:8081/?spec_id=9df6f3d8-85f7-4157-86fc-e78ce491aa29 |
| bakery | Daily Crumb Bakery | http://localhost:8081/?spec_id=9e6a4083-0958-4fa9-8275-471203efacfe |
| house-cleaning-v2 | Sparkle Homes | http://localhost:8081/?spec_id=48aa792c-ea19-4c42-86ac-bb57db9289bc |
| dog-walker | Pawfect Walks | http://localhost:8081/?spec_id=87a54420-5ace-4b23-8db4-6757b26c779c |
| landscaping-v2 | Evergreen Landscapes | http://localhost:8081/?spec_id=49488b49-ae81-460c-85f3-5bf2d4d47744 |
| hair-salon-v2 | Shear Luxe Salon | http://localhost:8081/?spec_id=c01aa486-d803-45aa-aa1a-c802d8a84c3e |

## Scorecard

| # | Spec | Score | Δ r6 | Entities |
|---|------|-------|------|----------|
| 1 | dental-practice | **84** | new | Patient, DentalVisit, **Treatment**, Payment |
| 2 | music-school-v2 | **84** | +6 | Student, Teacher, **LessonPackage**, Lesson |
| 3 | beauty-spa | **82** | new | Client, Appointment, **Package**, **Membership** |
| 4 | accounting-firm | **78** | new | Client, TaxReturn, BookkeepingEntry, Payroll |
| 5 | plumber | **75** | new | Client, Plumber, Job, **Part**, JobPart |
| 6 | bakery | **70** | new | Client, Order, OrderItem, ProductionSchedule |
| 7 | house-cleaning-v2 | **68** | +6 | Client, Job, Cleaner, JobAssignment |
| 8 | landscaping-v2 | **66** | -2 | Client, Crew, Job, WorkOrder |
| 9 | dog-walker | **65** | new | Client, Walker, Walk, WalkRequest |
| 10 | hair-salon-v2 | **62** | +2 | Client, Stylist, Appointment, Payment |

**Average: 73.4/100** (round-6 was 72.5)

## Gap fix verdict

| Gap | Round-6 | Round-7 | Verdict |
|-----|---------|---------|---------|
| 1. 3:30 AM time on cards | 8/10 broken | **10/10 fixed** (all show 09:00) | ✅ shipped |
| 2. "First item in the list" subtitle | 5/10 broken | **0/10 broken** | ✅ shipped |
| 3. Raw ISO on Story DetailRow | broken | fixed (test-locked) | ✅ shipped |
| 4. Service/Package entity (4 expected) | n/a | **3/4 hit** (music ✓, beauty ✓, dental ✓, hair ✗) | ⚠️ partial |
| 5. Property/Location entity (4 expected) | n/a | **0/4 hit** | ❌ prompt didn't bite |

## Per-vertical owner-view notes

### dental-practice — 84
Patient + DentalVisit + Treatment + Payment is the right model. Treatment as a
catalog entity covers the "what was done" billing question. Strongest of the
fresh verticals.

### music-school-v2 — 84 (was 78)
Big win. Round-6 had only Student/Teacher/Lesson (3 entities, no pricing).
Round-7 added LessonPackage — now a school owner can map a student to a
12-lesson package and track tuition. Direct win from the prompt rule.

### beauty-spa — 82
Package + Membership both present. Owner can sell a 5-facial package or a
monthly membership and track usage. Fits the "spa with packages" prompt.

### accounting-firm — 78
Three activity entities (TaxReturn, BookkeepingEntry, Payroll) is interesting —
real firms often track these as separate streams of work. Solid model. Misses:
no Engagement entity tying multi-year work together.

### plumber — 75
Part + JobPart (junction) is the cleanest inventory model in any round. But
no Property/Home — every job points at a Client, not the address being
serviced. A plumber dispatching to "12 Oak Lane" can't model that today.

### bakery — 70
Order + OrderItem + ProductionSchedule is well-shaped for custom orders.
Missing Product entity (no SKU catalog). Owner can't say "we sold 18
chocolate eclairs today" because there's no Product to count against.

### house-cleaning-v2 — 68 (was 62)
Renamed OrderItem → JobAssignment, which is more cleaning-domain-fit. But
still no Home/Property — the dispatch-vertical Property rule didn't fire.

### landscaping-v2 — 66 (was 68)
Slight regression. Round-6 had a `Service` entity; round-7 dropped it for
WorkOrder. WorkOrder is fine, but losing Service means landscaping owners
can't list "lawn mow $80, hedge prune $120" prices.

### dog-walker — 65
Walk + WalkRequest is OK, but no Pet entity — a dog-walking app without
dog records is missing the obvious. Also no Home/Address.

### hair-salon-v2 — 62 (was 60)
Tiny bump. Still no Service entity despite the explicit prompt rule. Salon
owners still can't model "haircut $40, color $120, gloss $30". The prompt
rule worked for spa/dental/music but missed hair. Likely because hair-salon
description mentions "stylists taking appointments" which steered the LLM
toward Stylist+Appointment without a service catalog.

## What worked, what didn't

**Worked (Gap 4 partial):**
- Spa, dental, music school all picked up the prompt and emitted Package /
  Treatment / LessonPackage. The rule "include Service entity for businesses
  that sell discrete services" landed for 3/4 verticals.

**Didn't work (Gap 5):**
- 0/4 dispatch verticals (cleaning, landscaping, plumber, dog-walker) emitted
  a Property/Home/Location entity, despite the explicit prompt rule. The LLM
  kept defaulting to Job/WorkOrder/Walk patterns and packed the address into
  the activity entity.

## Next-step recommendations

1. **Strengthen Gap 5**: move from prompt-only to normalizer enforcement. If
   the spec mentions dispatch keywords (cleaning, landscaping, plumber, walker)
   AND has no Property/Home entity, inject one in `entity.ts` normalizer.
2. **Strengthen Gap 4 for hair-salon**: add explicit example to the prompt
   ("e.g. for a salon: Service entity with name='Haircut', price=40").
3. **Add `bakery` and `professional_services` vertical buckets** to
   sample-seeds — accounting-firm, dog-walker, bakery currently route to
   `generic` and get "Initial consultation" sample text.
4. **Add Pet to dog-walker** — same kind of normalizer rule: dog-walking
   without a Pet entity is broken.

## Generation stats

10 specs, 5072–7255 bytes each. First batch of 10 in parallel: 5 succeeded,
5 hit the Deno worker's 60s timeout. Sequential retry of the 5 succeeded after
bumping `WORKER_TIMEOUT_MS` to 300000 in `.env`. Postgres volume needed a fresh
DEEPINFRA_API_KEY (encrypted via AES-GCM with SHA-256(JWT_SECRET) and pushed
into `system.secrets`).
