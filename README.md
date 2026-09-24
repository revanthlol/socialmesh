# SociaMesh

SociaMesh is a small-team social-media management and publishing application.

## High-Level Architecture

```
React / Vite Frontend (apps/web)
        |
        v  (HTTP-only session cookies / credentials)
SociaMesh Express API (apps/api)
        |
        +--> SociaMesh PostgreSQL / Neon (Database & Session Store)
        |
        +--> Cloudflare R2 (Private Media Storage & Presigned Uploads)
        |
        +--> Postiz Publishing Adapter (`apps/api/src/lib/postiz` - Active Typed Client Boundary)
```

### Ownership Boundaries

- **SociaMesh Core (Active & Implemented):**
  - Application users & authentication (Argon2id password hashing, opaque session token cookies, session invalidation)
  - Workspaces & RBAC (`OWNER`, `MEMBER`)
  - Media Library (Cloudflare R2 presigned direct uploads, metadata tracking, secure short-lived view URLs)
  - Editorial domain & Post drafting (authoring copy, attaching media assets, version incrementation, draft lifecycles)
  - Application shell & Dashboard UI (Overview, Compose, Media Library, Posts, Calendar, Connected Accounts placeholder, Settings)
  - Centralized API client & TanStack Query state caching
  - Typed Postiz client adapter (`apps/api/src/lib/postiz`) encapsulating all public Postiz REST endpoints

- **Postiz Infrastructure (Managed Separately):**
  - Headless NestJS engine & Temporal orchestrator
  - Social network OAuth handshakes & credentials storage
  - Upstream provider post dispatch & durable timer-based scheduling
  - Provider post links & automated worker retries
  - *Note: Postiz integration is managed independently; the SociaMesh core foundation does not touch Postiz containers, database, Redis, or Temporal.*

---

## Workspace Structure

- `apps/api`: Node.js / Express 5 API with Prisma 7, PostgreSQL, Argon2id, Pino logging, Zod validation, and Cloudflare R2 S3 adapter.
- `apps/web`: React 19, Vite 8, Tailwind CSS v4, React Router 7, and TanStack Query v5 dashboard application.
- `.github/workflows/ci.yml`: Continuous integration workflow running dependency checks, Prisma generation, typecheck, build, and lint.

---

## Quickstart & Local Setup

### Prerequisites
- Node.js `>= 20.20.0` (LTS 20 or 22 recommended)
- `pnpm >= 9.15.0`

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Configure Environment Files

#### API Configuration (`apps/api/.env`)
Copy the example configuration:
```bash
cp apps/api/.env.example apps/api/.env
```
Populate the values:
```ini
NODE_ENV=development
PORT=4000
APP_BASE_URL=http://localhost:4000
WEB_BASE_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173

# Neon PostgreSQL
DATABASE_URL="postgresql://user:password@endpoint-pooler.region.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:password@endpoint.region.aws.neon.tech/neondb?sslmode=require"

# Application Secrets
SESSION_SECRET="your-32-byte-random-session-secret"
TOKEN_ENCRYPTION_KEY="your-base64-encryption-key"

# Cloudflare R2
R2_ACCOUNT_ID="your-cloudflare-account-id"
R2_ACCESS_KEY_ID="your-r2-access-key-id"
R2_SECRET_ACCESS_KEY="your-r2-secret-access-key"
R2_BUCKET_NAME="socialmesh-media"
R2_ENDPOINT="https://<account-id>.r2.cloudflarestorage.com"
```

#### Web Configuration (`apps/web/.env`)
```ini
VITE_API_BASE_URL=http://localhost:4000/api/v1
```

### 3. Database Generation & Migration
Generate the Prisma client:
```bash
pnpm prisma:generate
```

Bootstrap PostgreSQL extensions (`citext`, `uuid-ossp`, `pgcrypto`) and deploy migrations:
```bash
pnpm db:setup
```

Or verify database migration status:
```bash
pnpm --filter @socialmesh/api exec prisma migrate status
```

### 4. Running the Development Servers
Run both API and Web concurrently:
```bash
pnpm dev
```
Or run individually:
- API (port 4000): `pnpm --filter @socialmesh/api dev`
- Web (port 5173): `pnpm --filter @socialmesh/web dev`

### 5. Running Verification & Tests
- Full repository typecheck: `pnpm run typecheck`
- Full repository build: `pnpm run build`
- Full repository lint: `pnpm run lint`
- Full test suite: `pnpm test`
- Postiz adapter unit tests (mocked HTTP): `pnpm --filter @socialmesh/api run test:unit`


---

## API Endpoints (`/api/v1`)

### Health & Readiness
- `GET /healthz` — Process liveness
- `GET /readyz` — Database connectivity readiness

### Authentication (`/api/v1/auth`)
- `POST /register` — Register user, workspace, and owner session cookie (`sm_session`)
- `POST /login` — Authenticate and receive `HttpOnly` session cookie
- `POST /logout` — Revoke active session and clear cookie
- `POST /logout-all` — Revoke all sessions for current user
- `GET /me` — Retrieve active user profile and workspace memberships

### Workspaces (`/api/v1/workspaces`)
- `GET /` — List user's workspaces
- `POST /` — Create a new workspace
- `GET /:workspaceId` — Retrieve workspace details and stats
- `PATCH /:workspaceId` — Update workspace name and timezone (Owner only)
- `GET /:workspaceId/members` — List workspace members and roles

### Media Library (`/api/v1/workspaces/:workspaceId/media`)
- `GET /` — List non-deleted media assets with short-lived presigned view URLs
- `POST /upload-url` — Request short-lived presigned PUT URL for direct browser-to-R2 upload
- `GET /:mediaId` — Retrieve single media asset with signed view URL
- `POST /:mediaId/complete` — Verify object in R2 and mark status as `READY`
- `DELETE /:mediaId` — Remove object from R2 and soft-delete record

### Post Drafts (`/api/v1/workspaces/:workspaceId/posts`)
- `GET /` — List workspace posts/drafts with attached media
- `POST /` — Create a new draft with optional media attachments
- `GET /:postId` — Get post details and attached media
- `PATCH /:postId` — Update draft copy and attached media (increments version)
- `DELETE /:postId` — Delete draft post
