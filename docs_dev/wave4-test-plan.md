# Wave 4: Test Plan

**Created:** 2026-03-20
**Review:** /plan-eng-review artifact

---

## API Integration Tests

### Auth Endpoints

| Test | Endpoint | Assertion |
|------|----------|-----------|
| signup_success | POST /api/auth/signup | 201 + user object |
| signup_duplicate | POST /api/auth/signup | 409 conflict |
| login_success | POST /api/auth/login | 200 + session token |
| login_invalid | POST /api/auth/login | 401 unauthorized |
| logout | POST /api/auth/logout | 200 + session cleared |
| me_authenticated | GET /api/auth/me | 200 + user object |
| me_unauthenticated | GET /api/auth/me | 401 unauthorized |

### Spec Endpoints

| Test | Endpoint | Assertion |
|------|----------|-----------|
| generate_spec | POST /api/specs/generate | 201 + spec object |
| generate_invalid | POST /api/specs/generate | 400 validation error |
| list_specs | GET /api/specs | 200 + array |
| list_specs_empty | GET /api/specs | 200 + [] |
| get_spec_found | GET /api/specs/:id | 200 + spec |
| get_spec_not_found | GET /api/specs/:id | 404 |
| get_spec_unauthorized | GET /api/specs/:id | 403 (other user's spec) |
| update_spec | PUT /api/specs/:id | 200 + updated spec |
| delete_spec | DELETE /api/specs/:id | 204 |

### Preview Endpoints

| Test | Endpoint | Assertion |
|------|----------|-----------|
| preview_public | GET /api/preview/:id | 200 + preview data |
| preview_not_found | GET /api/preview/:id | 404 |
| preview_sample_data | GET /api/preview/:id | Sample data included |

---

## SpecLoader Sync Tests

### Branch Coverage

```
┌─────────────────────────────────────────────────────────────┐
│                     SpecLoader.load()                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌────────────────┐  │
│  │ Check Cache │───▶│ Cache Hit?  │───▶│ Version Match? │  │
│  └─────────────┘    └─────────────┘    └────────────────┘  │
│                           │                    │            │
│                     No    │              Yes   │   No       │
│                           ▼                    ▼   ▼        │
│                    ┌─────────────┐    ┌────────────────┐   │
│                    │ Fetch Cloud │    │ Return Cached  │   │
│                    └─────────────┘    └────────────────┘   │
│                           │                                 │
│                    ┌─────────────┐    ┌────────────────┐   │
│                    │  Offline?   │───▶│ Fallback Cache │   │
│                    └─────────────┘    └────────────────┘   │
│                           │                                 │
│                           ▼                                 │
│                    ┌─────────────┐                          │
│                    │ Run Migrate │                          │
│                    └─────────────┘                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Test Cases

| Branch | Test | Setup | Assertion |
|--------|------|-------|-----------|
| **Cache Hit** | cache_valid | Cache with matching version | Returns cached spec, no network |
| **Cache Miss** | cache_empty | No cache | Fetches from cloud, caches result |
| **Version Mismatch** | cache_stale | Cache with old version | Fetches new, updates cache, runs migration |
| **Offline** | offline_cached | No network, valid cache | Returns cached spec |
| **Offline** | offline_no_cache | No network, no cache | Throws error with offline message |

### Migration on Sync

| Test | Scenario | Assertion |
|------|----------|-----------|
| migration_adds_entity | Server spec has new entity | SQLite table created |
| migration_adds_field | Server spec has new field | Column added |
| migration_no_change | Same spec version | No migration runs |

---

## Existing Test Suites (Regression)

| Suite | Count | Gate |
|-------|-------|------|
| Generation | 100+ | Q1 |
| CRUD Service | 50+ | Q1 |
| Schema Engine | 40+ | Q1 |
| Components | 30+ | Q1 |
| Cost Tracking | 16 | Q1 |
| Latency Benchmarks | 11 | Q1 |

**Total baseline:** 532 tests (must all pass per Q1 gate)

---

## Test Infrastructure

### API Tests Location

```
tests/
  api/
    auth.test.ts       # Auth endpoint tests
    specs.test.ts      # Spec CRUD tests
    preview.test.ts    # Preview endpoint tests
    setup.ts           # Test server setup
```

### Sync Tests Location

```
tests/
  sync/
    spec-loader.test.ts    # SpecLoader branch tests
    migration-sync.test.ts # Migration on sync tests
    offline.test.ts        # Offline behavior tests
```

### Test Utilities

```typescript
// tests/api/setup.ts
export async function createTestUser(): Promise<TestUser>
export async function createTestSpec(user: TestUser): Promise<Spec>
export async function cleanupTestData(): Promise<void>

// tests/sync/mocks.ts
export function mockNetworkOffline(): void
export function mockNetworkOnline(): void
export function mockCloudSpec(spec: Spec): void
```

---

## CI Integration

```yaml
# .github/workflows/ci.yml additions
jobs:
  test-api:
    name: API Integration Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:api

  test-sync:
    name: Sync Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run test:sync
```

---

## Coverage Requirements

| Area | Target |
|------|--------|
| API endpoints | 100% |
| SpecLoader branches | 100% |
| Migration sync | 100% |
| Error handling | 100% |

---

*Generated by /plan-eng-review*
