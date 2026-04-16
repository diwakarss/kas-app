# Wave 4: Delivery — Research Findings

**Created:** 2026-03-20
**Purpose:** Document research, discoveries, and technical findings for Wave 4

---

## InsForge Research

### Overview
- **Repository:** https://github.com/InsForge/InsForge
- **Stars:** ~5K
- **Primary Language:** TypeScript
- **License:** Apache 2.0
- **Tagline:** "The backend built for agentic development"

### Core Features

| Feature | Description | Relevance to Wave 4 |
|---------|-------------|---------------------|
| **Database** | PostgreSQL with auto-API generation | Spec storage, user data |
| **Authentication** | User signup, login, sessions, OAuth | User accounts for shell app |
| **File Storage** | S3-compatible object storage | Spec files, assets |
| **Edge Functions** | Serverless compute | Spec generation API |
| **Realtime** | WebSocket pub/sub | Live preview sync |
| **Model Gateway** | OpenAI-compatible LLM API | Alternative to DeepInfra |

### Self-Hosting

```bash
git clone https://github.com/insforge/insforge.git
cd insforge
cp .env.example .env
docker compose -f docker-compose.prod.yml up
```

**Default ports:**
- Dashboard: http://localhost:7130
- API: http://localhost:7131

### MCP Integration

InsForge provides an MCP (Model Context Protocol) server for AI agent integration. This aligns perfectly with the agentic development approach.

**Setup:** Connect InsForge MCP to Claude Code for backend operations.

---

## Existing Wave 3 Assets (To Reuse)

### Spec Generation (Already Built)

| Component | Location | Status |
|-----------|----------|--------|
| SpecGenerator | `src/generation/services/spec-generator.ts` | ✅ Complete |
| FreshGenerator | `src/generation/services/fresh-generator.ts` | ✅ Complete |
| LLM Providers | `src/generation/providers/` | ✅ DeepInfra, OpenAI |
| Templates | `assets/templates/` | ✅ 4 templates |
| Validation | `src/generation/services/spec-validator.ts` | ✅ Complete |

### Expo App (Waves 1-2)

| Component | Location | Status |
|-----------|----------|--------|
| Screens | `src/screens/` | ✅ 4 screens |
| Components | `src/components/` | ✅ 24 components |
| CRUD | `src/data/crud-service.ts` | ✅ Complete |
| Schema Engine | `src/engines/schema-engine.ts` | ✅ Complete |
| Hooks | `src/hooks/` | ✅ Complete |

---

## API Design (Proposed)

### Endpoints

```
POST   /api/auth/signup        # Create account
POST   /api/auth/login         # Sign in
POST   /api/auth/logout        # Sign out
GET    /api/auth/me            # Current user

POST   /api/specs/generate     # Generate new spec
GET    /api/specs              # List user's specs
GET    /api/specs/:id          # Get spec by ID
PUT    /api/specs/:id          # Update spec
DELETE /api/specs/:id          # Delete spec

GET    /api/preview/:id        # Get preview data (public)
```

### Database Schema (InsForge PostgreSQL)

```sql
-- Users table (InsForge handles this)

-- App instances
CREATE TABLE app_instance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  business_type TEXT NOT NULL,
  spec_version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Spec versions (immutable snapshots)
CREATE TABLE spec_version (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_instance_id UUID NOT NULL REFERENCES app_instance(id),
  version INTEGER NOT NULL,
  spec_json JSONB NOT NULL,
  spec_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(app_instance_id, version)
);

-- Generation runs (audit trail)
CREATE TABLE generation_run (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_instance_id UUID REFERENCES app_instance(id),
  user_id UUID NOT NULL REFERENCES users(id),
  business_description TEXT NOT NULL,
  business_type TEXT,
  latency_ms INTEGER,
  token_count INTEGER,
  cost_usd NUMERIC(10, 6),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Web Preview Architecture

### Approach

1. **Expo Web Build** — Single build that works for both preview and full app
2. **Query Parameter Mode** — `?preview=true&spec_id=xxx`
3. **Sample Data** — Generated on-the-fly based on spec entities
4. **Iframe Embedding** — Secure sandbox with postMessage communication

### Sample Data Generation

```typescript
function generateSampleData(spec: KASAppSpec): Record<string, any[]> {
  const data: Record<string, any[]> = {};

  for (const entity of spec.entities) {
    data[entity.name] = generateSampleRecords(entity, 5);
  }

  return data;
}
```

### Preview vs Full App

| Aspect | Preview Mode | Full App |
|--------|--------------|----------|
| Data | Sample (generated) | Real (SQLite) |
| Auth | None | Required |
| CRUD | Disabled | Enabled |
| Storage | Memory | Persistent |
| Actions | View only | Full |

---

## Website Tech Stack

### Recommended

- **Framework:** Next.js 14+ (App Router)
- **Styling:** Tailwind CSS (matches design tokens)
- **Hosting:** Vercel (free tier) or self-hosted
- **Analytics:** Plausible (privacy-friendly)

### Pages

```
/                   # Landing page
/generate           # Business description form
/preview/:id        # Full-page preview (iframe)
/download           # App store links
/login              # Auth redirect to InsForge
```

---

## Shell App Changes

### New Screens

1. **Auth Screen** — Login/signup with InsForge
2. **App Selector** — If user has multiple apps
3. **Loading Screen** — While fetching spec from cloud

### Data Flow

```
App Launch
    ↓
Check Local Cache
    ↓
[Cache Valid?] ──No──→ Fetch from InsForge
    ↓ Yes                    ↓
Load Local Spec          Store in Cache
    ↓                        ↓
Initialize Database      Initialize Database
    ↓                        ↓
Render App               Render App
```

### Deep Links

```
kas-app://login              # Open auth screen
kas-app://spec/:id           # Load specific spec
kas-app://preview/:id        # Preview mode
```

---

## App Store Requirements

### Google Play

- **Target SDK:** 34 (Android 14)
- **Privacy Policy:** Required
- **Screenshots:** Phone + tablet
- **Description:** <4000 chars
- **Review Time:** ~1-3 days

### Apple App Store

- **iOS Version:** 15.0+
- **Privacy Labels:** Required
- **App Review:** ~1-7 days
- **TestFlight:** For beta testing

### Common Assets Needed

- App icon (1024x1024)
- Feature graphic (1024x500)
- Screenshots (various sizes)
- Short description (<80 chars)
- Full description
- Privacy policy URL
- Support email

---

## Bridge Work Details

### Release Envelope

```typescript
interface ReleaseEnvelope {
  release_id: string;
  spec_version_id: string;
  producer: 'human' | 'agent';
  change_class: 'S' | 'M' | 'I' | 'R';
  validation_status: 'pending' | 'valid' | 'invalid';
  created_at: string;
}
```

### Landing Contract

The website must derive content from template metadata:
- Business type → appropriate hero image
- Template features → feature bullets
- Sample screenshots → from preview

This ensures landing content stays in sync with actual capabilities.

---

## Open Questions

1. **Domain:** kas-app.com available? Alternative?
2. **Pricing:** Free tier? Paid plans?
3. **Terms of Service:** Need legal review?
4. **Support:** Email only? Chat?
5. **Analytics:** What to track?

---

## References

- InsForge Docs: https://docs.insforge.dev
- Expo Web: https://docs.expo.dev/workflow/web/
- EAS Build: https://docs.expo.dev/build/introduction/
- Next.js: https://nextjs.org/docs
