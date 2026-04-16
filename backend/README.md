# KAS App Backend

InsForge-based backend for KAS App spec generation and storage.

## Quick Start

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your API keys
vim .env

# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| InsForge Dashboard | 7130 | Admin UI for InsForge |
| InsForge API | 7131 | REST API endpoints |
| PostgreSQL | 5432 | Database (internal) |
| MinIO S3 API | 9000 | S3-compatible storage |
| MinIO Console | 9001 | Storage admin UI |

## API Endpoints

### Authentication (InsForge built-in)
- `POST /auth/signup` - Create account
- `POST /auth/login` - Sign in
- `POST /auth/logout` - Sign out
- `GET /auth/me` - Current user

### Specs
- `POST /api/specs/generate` - Generate spec from description
- `GET /api/specs` - List user's specs
- `GET /api/specs/:id` - Get spec by ID
- `PUT /api/specs/:id` - Update spec (creates new version)
- `DELETE /api/specs/:id` - Archive spec

### Preview (Public)
- `GET /api/preview/:id` - Get preview data with sample records

## Database Schema

See `schema.sql` for full schema. Key tables:

- `app_instance` - User's generated apps
- `spec_version` - Immutable spec snapshots (version history)
- `generation_run` - Audit trail for generation attempts

## Edge Functions

- `functions/generate-spec.ts` - Spec generation with SSE progress
- `functions/specs.ts` - CRUD operations
- `functions/preview.ts` - Public preview endpoint

## Development

### Database Access
```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U kas -d kas_app

# View tables
\dt

# Query specs
SELECT * FROM app_instance;
```

### Logs
```bash
# All services
docker compose logs -f

# InsForge only
docker compose logs -f insforge

# PostgreSQL only
docker compose logs -f postgres
```

### MinIO Storage
```bash
# Access MinIO Console
open http://localhost:9001
# Login: kas-minio-dev / kas-minio-secret-dev

# List buckets via CLI (if mc installed)
mc alias set kas http://localhost:9000 kas-minio-dev kas-minio-secret-dev
mc ls kas/
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `AUTH_SECRET` | Yes | JWT signing secret |
| `DEEPINFRA_API_KEY` | Yes | DeepInfra API key for LLM |
| `OAUTH_GOOGLE_CLIENT_ID` | No | Google OAuth client ID |
| `OAUTH_GOOGLE_CLIENT_SECRET` | No | Google OAuth client secret |
| `OAUTH_GITHUB_CLIENT_ID` | No | GitHub OAuth client ID |
| `OAUTH_GITHUB_CLIENT_SECRET` | No | GitHub OAuth client secret |
| `MINIO_ROOT_USER` | No | MinIO admin user (default: kas-minio-dev) |
| `MINIO_ROOT_PASSWORD` | No | MinIO admin password |
| `CORS_ORIGINS` | No | Allowed CORS origins (comma-separated) |
| `ENABLE_PROGRESS_SSE` | No | Enable SSE streaming (default: true) |

## Production Deployment

1. Set strong `AUTH_SECRET` (generate with `openssl rand -base64 32`)
2. Use managed PostgreSQL (not local container)
3. Configure rate limiting in InsForge
4. Set up monitoring and alerting
5. Configure backup strategy for database
