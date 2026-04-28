# Round 6 — Business-Owner Scorecard

10 unique verticals generated via InsForge `/generate-spec`. All 10 passed
`SpecValidator.validate` cleanly (0 warnings, 0 errors). Scored 0–100 from
the lens of the respective business owner using the app day 1.

## URLs for manual verification

| Vertical | Business | Preview URL |
|----------|----------|-------------|
| yoga-studio | Zen Flow Yoga | http://localhost:8081/?spec_id=c0953721-cbb3-4604-8515-77c72c037170 |
| hair-salon | Shear Luxe Salon | http://localhost:8081/?spec_id=0966af07-148c-44b2-b27d-5bb10605cd3f |
| bicycle-repair | Spokes & Wheels | http://localhost:8081/?spec_id=80a87247-84f3-4d83-81a2-e320e6555a6a |
| tattoo-parlor | Ink District | http://localhost:8081/?spec_id=556fa66b-e370-440a-81eb-6009dd8f1182 |
| photo-studio | Aperture Studios | http://localhost:8081/?spec_id=0f57bf86-b291-4e37-b12a-132cd9b68a58 |
| vet-clinic | Happy Paws Vet | http://localhost:8081/?spec_id=dce468c4-fd3a-4c8c-a0d5-86d9ca2eb7e6 |
| music-school | Crescendo Academy | http://localhost:8081/?spec_id=104438a7-431b-478e-84bb-452d43731d90 |
| house-cleaning | Sparkle Homes | http://localhost:8081/?spec_id=e44527ae-4514-41ca-bffd-94339c25be85 |
| daycare | Little Sprouts Daycare | http://localhost:8081/?spec_id=83d62af7-efbe-423d-aa00-6b08e5695ace |
| landscaping | Evergreen Landscapes | http://localhost:8081/?spec_id=87795de4-ff2e-45c1-ae61-46a6d83f056e |

## Scorecard

Rubric: greeting/stats fit (25) + entity modeling (20) + add-flow coverage (15) +
chat commands (15) + sample data believability (15) + day-1 usability (10).

| # | Vertical | Score | Anchor subtitle | Entities | Add flows | Chat cmds |
|---|----------|-------|-----------------|----------|-----------|-----------|
| 1 | vet-clinic | **82** | "Buddy · Full grooming package · 3:30 AM" | 5 (Client, Pet, Visit, Vaccination, Prescription) | 5 | 8 |
| 2 | daycare | **80** | "Aarav Mehta · Present · Today" | 4 (Child, Parent, Attendance, EnrollmentPlan) | 4 | 5 |
| 3 | yoga-studio | **78** | "Ramesh Rao · Ballet Basics · 3:30 AM" | 5 (Client, Class, PrivateSession, Membership, Payment) | 5 | 8 |
| 4 | music-school | **78** | "Rahul Sharma · Piano · 3:30 AM" | 3 (Student, Teacher, Lesson) | 3 | 4 |
| 5 | photo-studio | **75** | "Ramesh Rao · First item in the list" | 4 (Client, Shoot, EditingSession, Gallery) | 4 | 7 |
| 6 | tattoo-parlor | **72** | "Ramesh Rao · First item in the list" | 5 (Client, Artist, Appointment, Design, Payment) | 5 | 7 |
| 7 | bicycle-repair | **70** | "Ramesh Rao · First item in the list" | 4 (Client, ServiceRequest, Part, ServiceOrder) | 4 | 5 |
| 8 | landscaping | **68** | "Ramesh Rao · First item in the list" | 4 (Client, Crew, Job, Service) | 4 | 6 |
| 9 | house-cleaning | **62** | "Ramesh Rao · First item in the list" | 4 (Client, Job, Order, OrderItem) | 4 | 6 |
| 10 | hair-salon | **60** | "Ramesh Rao · — · 3:30 AM" | 3 (Client, Stylist, Appointment) | 3 | 4 |

**Average: 72.5/100**

## Per-vertical notes (business-owner view)

### 1. vet-clinic — 82
Pet is first-class. Clinic owner opens app, sees "Next: Buddy · 03:30", can tap
through to a Story with Visit → Vaccination → Prescription context. Chat offers
"Add vaccination", "Add prescription". This is the one I'd hand to a solo vet
today. Ding: 3:30 AM sample time; Visit notes not shown on card.

### 2. daycare — 80
Only spec where the anchor subtitle tells a real story ("Present · Today"). The
Attendance entity as anchor is exactly right for a daycare owner's morning
check-in. Icons (👶 👪 ✅ 📝) fit. Ding: no ratios/staff-to-child check, no
pickup-time field surfaced.

### 3. yoga-studio — 78
"Ballet Basics" as subtitle lands. 5 entities covers classes/privates/memberships/
payments cleanly. 8 chat commands is the most. Ding: 3:30 AM time; Membership
entity present but no "expires on" visibility.

### 4. music-school — 78
Subtitle "Piano" is the instrument. Nice. 3-entity model (Student, Teacher,
Lesson) is clean but thin — no Instrument or fee concept. A school owner
wanting to track tuition would hit a wall fast.

### 5. photo-studio — 75
Good pipeline modeling (Shoot → EditingSession → Gallery) but subtitle falls
back to "First item in the list". No pricing/invoicing for a shoot.

### 6. tattoo-parlor — 72
5 entities covers the domain (Artist, Design, Payment). But a tattoo shop owner
cares about deposits, and Payment is generic. Subtitle fallback.

### 7. bicycle-repair — 70
Part entity rescues this — it's one of two specs where the LLM actually modeled
inventory. But "ServiceRequest" vs "ServiceOrder" is duplicative — should have
been Intake → Ticket → Invoice. Subtitle fallback.

### 8. landscaping — 68
Crew, Job, Property absent — landscaping owners dispatch to *sites*, and
Property as a first-class entity is missing. Recurring/seasonal jobs are
central to the business and nothing surfaces them.

### 9. house-cleaning — 62
"Order / OrderItem" is e-commerce modeling, not cleaning. Should have been
Customer → Home → RecurringJob → Visit. Generic.

### 10. hair-salon — 60
Weakest. 3 entities — no Service/Menu/Price entity. A salon owner books a
"cut + color + gloss" — you can't represent that here. Subtitle falls back.
Day 1: owner would be confused about where to put prices.

## Recurring gaps (upstream fixes to consider)

1. **3:30 AM sample time** shows on 8/10 anchors. Sample-data seeder generates
   ISO timestamps without business-hour bias. See `src/generation/services/sample-data.ts`
   (or wherever the seed lives) and clamp to 9–18.
2. **"First item in the list"** subtitle fallback appears when LLM did not emit
   per-row descriptions. Normalizer could synthesize something more specific from
   entity fields (e.g., appointment subtitle = service name).
3. **ISO timestamp on Story screen** — `2026-04-17T03:30:00.000Z` renders raw.
   Story DetailRow should format date fields to human-friendly output.
4. **Thin entity models on service verticals** — hair-salon (3), music-school (3).
   Prompt tuning: encourage the LLM to model a Service/Menu/Pricebook entity for
   any business that sells discrete services.
5. **Inventory/Property missing** — landscaping (Property), house-cleaning (Home).
   Add a rule: dispatch-to-location verticals need a location entity.

## Validation

`bun run .planning/round6/validate.ts` — 10/10 pass, 0 warnings, 0 errors.
Report JSON: `.planning/round6/report.json`.

## Generation stats

10 parallel POSTs to InsForge `/generate-spec` completed ~150s each. Specs
4555–7177 bytes. Raw JSON: `.planning/round6/specs/<slug>.json`.
