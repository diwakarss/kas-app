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
- [x] 1.1 Set up InsForge locally via Docker Compose
- [x] 1.2 Configure PostgreSQL schema for specs and users
- [x] 1.3 Configure authentication (email + OAuth)
- [x] 1.4 Configure S3-compatible storage for spec files
- [x] 1.5 Deploy spec generation as edge function
- [x] 1.6 Create API endpoints: `/api/generate`, `/api/specs/:id`, `/api/auth/*`

**Files Created:**
- `backend/docker-compose.yml` — InsForge + PostgreSQL + MinIO services
- `backend/schema.sql` — Database schema (app_instance, spec_version, generation_run)
- `backend/functions/generate-spec.ts` — SSE streaming spec generation
- `backend/functions/specs.ts` — CRUD endpoints
- `backend/functions/preview.ts` — Public preview endpoint
- `backend/.env.example` — Environment template (auth, OAuth, MinIO, CORS)
- `backend/README.md` — Backend documentation

**Checkpoint:** ✅ API configured locally with auth, storage, and all endpoints

### Phase 2: Web Preview (3A)
- [x] 2.1 Create Expo Web build configuration
- [x] 2.2 Build preview component that loads spec from URL param
- [x] 2.3 Generate sample data for preview mode (via backend API)
- [x] 2.4 Create PreviewBanner component with loading states
- [x] 2.5 Handle preview-only mode (no persistence, sample data only)

**Files Created:**
- `src/core/context/PreviewContext.tsx` — Preview state management
- `src/components/PreviewBanner.tsx` — Visual indicator for preview mode
- Updated `src/core/context/WebSpecProvider.tsx` — API fetch for preview specs
- Updated `src/engines/spec-initializer.ts` — Added `initializeSpecFromJson`
- Updated `App.tsx` — Integrated PreviewProvider
- Updated `src/core/navigation/RootNavigator.tsx` — Added PreviewBanner

**Checkpoint:** ✅ Can embed `?spec_id=xxx` preview in any webpage

### Phase 3: Website MVP (3D)
- [x] 3.1 Create landing page (Next.js)
- [x] 3.2 Build business description form (GenerateForm component)
- [x] 3.3 Integrate spec generation API (SSE streaming)
- [x] 3.4 Embed web preview iframe (DeviceMockup + PreviewFrame)
- [x] 3.5 Add "Download App" CTA with deep link
- [x] 3.6 Basic styling with design system colors

**Files Created:**
- `website/` — Next.js project
- `website/src/app/page.tsx` — Landing page
- `website/src/components/GenerateForm.tsx` — Business description form
- `website/src/components/ProgressStepper.tsx` — SSE progress steps
- `website/src/components/DeviceMockup.tsx` — Phone frame
- `website/src/components/PreviewFrame.tsx` — Iframe wrapper
- `website/src/lib/api.ts` — SSE API client
- `website/src/lib/tokens.ts` — Design tokens

**Checkpoint:** ✅ kas-app.com shows form → generates spec → shows preview

### Phase 4: Shell App Updates (3B)
- [x] 4.1 Add auth screen (InsForge auth integration)
- [x] 4.2 Implement spec loader from cloud
- [x] 4.3 Add local caching with AsyncStorage
- [x] 4.4 Handle offline mode gracefully (cache fallback)
- [x] 4.5 Add deep link handling for `kas-app://spec/:id`
- [x] 4.6 Sync spec updates on app launch

**Files Created:**
- `src/core/context/AuthContext.tsx` — Auth state management
- `src/core/context/CloudSpecProvider.tsx` — Cloud spec context
- `src/core/navigation/AppNavigator.tsx` — Auth + spec flow
- `src/screens/AuthScreen.tsx` — Sign in/sign up screen
- `src/screens/SpecListScreen.tsx` — User's apps list
- `src/services/cloud-spec-loader.ts` — Cloud fetch + caching
- `src/services/deep-links.ts` — Deep link handling

**Checkpoint:** ✅ App loads user's spec from cloud after sign-in

### Phase 5: App Store Submission (3E) — DEFERRED
- [ ] 5.1 Configure EAS Build for iOS and Android
- [ ] 5.2 Create app store assets (icon, screenshots, description)
- [ ] 5.3 Submit to Google Play Store
- [ ] 5.4 Submit to Apple App Store
- [ ] 5.5 Handle review feedback

**Status:** Deferred — will submit after initial user testing

**Checkpoint:** Apps live in both stores

### Phase 6: Bridge Work (Agentic Patterns)
- [x] 6.1 Create `app_instance` table for version authority (in schema.sql)
- [x] 6.2 Create `spec_version` table with hash tracking (in schema.sql)
- [x] 6.3 Create `generation_run` table for change audit (in schema.sql)
- [x] 6.4 Implement release envelope on spec publish
- [x] 6.5 Add `check:landing-contract` CI validation

**Files Created:**
- `backend/functions/release-envelope.ts` — Hash computation, change classification
- `backend/functions/publish.ts` — Publish endpoint with envelope creation
- `tools/check-landing-contract.ts` — CI validation script

**Checkpoint:** ✅ Server is authoritative for version lineage

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
| backend/docker-compose.yml | InsForge + PostgreSQL + MinIO services | 1 |
| backend/schema.sql | Database schema | 1 |
| backend/functions/generate-spec.ts | SSE spec generation | 1 |
| backend/functions/specs.ts | CRUD endpoints | 1 |
| backend/functions/preview.ts | Public preview | 1 |
| backend/.env.example | Environment template (auth, OAuth, MinIO) | 1 |
| backend/README.md | Backend documentation | 1 |
| docs/designs/wave4-delivery.md | Full design specs | - |
| docs_dev/wave4-test-plan.md | Test plan | - |

---

## Current Status

**Phase:** Wave 4 ✅ COMPLETE (Phases 1-4, 6)
**Blocker:** None
**Deferred:** Phase 5 (App Store) — submit after user testing
**Next Action:** Begin Wave 5 or user testing

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
