# Wave 4: Delivery — Task Plan

**Created:** 2026-03-20
**Status:** Planning
**Goal:** Users can generate and get their app. Web preview works. Shell App loads specs.

---

## Checkpoint (Definition of Done)

> User visits kas-app.com → describes their business → sees live preview → downloads Shell App → signs in → their app loads. End to end.

---

## Backend Decision

**Selected:** InsForge (self-hosted via Docker Compose)
**Why:** Provides auth, database, storage, edge functions out of the box. AI-native design. Self-hostable.
**Replaces:** Original plan of VPS + PostgreSQL + R2 (manual setup)

---

## Phases

### Phase 1: Backend Infrastructure (InsForge Setup)
- [ ] 1.1 Set up InsForge locally via Docker Compose
- [ ] 1.2 Configure PostgreSQL schema for specs and users
- [ ] 1.3 Configure authentication (email + OAuth)
- [ ] 1.4 Configure S3-compatible storage for spec files
- [ ] 1.5 Deploy spec generation as edge function
- [ ] 1.6 Create API endpoints: `/api/generate`, `/api/specs/:id`, `/api/auth/*`

**Checkpoint:** API running locally, can generate and store specs via HTTP

### Phase 2: Web Preview (3A)
- [ ] 2.1 Create Expo Web build configuration
- [ ] 2.2 Build preview component that loads spec from URL param
- [ ] 2.3 Generate sample data for preview mode
- [ ] 2.4 Create iframe embed wrapper with loading states
- [ ] 2.5 Handle preview-only mode (no persistence, sample data only)

**Checkpoint:** Can embed `?spec_id=xxx` preview in any webpage

### Phase 3: Website MVP (3D)
- [ ] 3.1 Create landing page (Next.js or static)
- [ ] 3.2 Build business description form
- [ ] 3.3 Integrate spec generation API
- [ ] 3.4 Embed web preview iframe
- [ ] 3.5 Add "Download App" CTA with deep link
- [ ] 3.6 Basic styling with design system colors

**Checkpoint:** kas-app.com shows form → generates spec → shows preview

### Phase 4: Shell App Updates (3B)
- [ ] 4.1 Add auth screen (InsForge auth integration)
- [ ] 4.2 Implement spec loader from cloud
- [ ] 4.3 Add local caching with SQLite
- [ ] 4.4 Handle offline mode gracefully
- [ ] 4.5 Add deep link handling for `kas-app://spec/:id`
- [ ] 4.6 Sync spec updates on app launch

**Checkpoint:** App loads user's spec from cloud after sign-in

### Phase 5: App Store Submission (3E)
- [ ] 5.1 Configure EAS Build for iOS and Android
- [ ] 5.2 Create app store assets (icon, screenshots, description)
- [ ] 5.3 Submit to Google Play Store
- [ ] 5.4 Submit to Apple App Store
- [ ] 5.5 Handle review feedback

**Checkpoint:** Apps live in both stores

### Phase 6: Bridge Work (Agentic Patterns)
- [ ] 6.1 Create `app_instance` table for version authority
- [ ] 6.2 Create `spec_version` table with hash tracking
- [ ] 6.3 Create `agent_run` table for change audit
- [ ] 6.4 Implement release envelope on spec publish
- [ ] 6.5 Add `check:landing-contract` CI validation

**Checkpoint:** Server is authoritative for version lineage

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Backend platform | InsForge (self-hosted) | Auth, DB, storage, functions built-in |
| Website framework | Next.js | SSR for SEO, React ecosystem |
| Auth method | InsForge OAuth + Email | Built-in, no custom implementation |
| Spec storage | InsForge PostgreSQL | Structured data with API generation |
| File storage | InsForge S3 | Assets, exports |
| Hosting | VPS with Docker Compose | Self-hosted InsForge |

---

## Dependencies

```
Phase 1 (Backend) ─────────────────────────────┐
                                                │
Phase 2 (Web Preview) ──────────────────────────┤
       ↓                                        │
Phase 3 (Website) ──────────────────────────────┤
       ↓                                        │
Phase 4 (Shell App) ────────────────────────────┤
       ↓                                        │
Phase 5 (App Store) ────────────────────────────┘
       ↓
Phase 6 (Bridge Work) ← Can run in parallel
```

---

## Errors Encountered

| Error | Attempt | Resolution |
|-------|---------|------------|
| (none yet) | | |

---

## Files Created/Modified

| File | Purpose | Phase |
|------|---------|-------|
| (to be tracked) | | |

---

## Current Status

**Phase:** Planning
**Blocker:** None
**Next Action:** Begin Phase 1 - InsForge setup

---

## InsForge Integration Map

| Wave 4 Need | InsForge Feature | API/Method |
|-------------|------------------|------------|
| User accounts | Authentication | `/auth/signup`, `/auth/login` |
| Spec storage | Database (PostgreSQL) | Auto-generated CRUD API |
| Spec files | Storage (S3) | `/storage/upload`, `/storage/download` |
| Generation API | Edge Functions | Custom function deployment |
| Live preview sync | Realtime | WebSocket pub/sub |
| OAuth (Google/GitHub) | Authentication | Built-in OAuth providers |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| InsForge learning curve | Start with local Docker setup, use docs |
| App store rejection | Follow guidelines, prepare for iterations |
| Preview performance | Lazy load, skeleton states, optimize bundle |
| Auth complexity | Use InsForge built-in, don't customize |

---

## Timeline Estimate

| Phase | Duration | Parallel? |
|-------|----------|-----------|
| Phase 1: Backend | 3-4 days | No (foundation) |
| Phase 2: Web Preview | 2-3 days | After Phase 1 |
| Phase 3: Website | 2-3 days | After Phase 2 |
| Phase 4: Shell App | 3-4 days | After Phase 1 |
| Phase 5: App Store | 3-5 days | After Phase 4 |
| Phase 6: Bridge | 1-2 days | Parallel |

**Total:** ~2 weeks (with parallelization)

---

*Plan created for Wave 4: Delivery using InsForge backend*
