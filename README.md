# SociaMesh

SociaMesh is an internal social-media publishing and management platform designed for client service organizations.

---

## Architectural Principles & Product Contracts

### 1. Single Shared Organization Model

- **"One Postiz organization per SociaMesh installation."**
- A single Postiz instance and organization serves the entire SociaMesh deployment. SociaMesh does not provision or juggle separate Postiz organizations per client workspace.

### 2. Workspace Client Isolation

- **"SociaMesh workspace channel assignments provide client isolation."**
- All connected social accounts exist within the single Postiz organization, but each SociaMesh workspace only has access to channels explicitly mapped to it via `WorkspaceChannel` assignments.
- Client A cannot view, publish to, or schedule on Client B's social accounts. Cross-workspace IDOR protection is strictly enforced at the database and API boundary.

### 3. Separation of Concerns & Media Truth

- **SociaMesh** owns users, workspaces, membership roles (`OWNER`, `MEMBER`), private Cloudflare R2 media storage, editorial drafts, and the UI schedule visualization.
- **Postiz + Temporal** owns upstream social provider OAuth handshakes, durable timer-based scheduling, worker retries, and API publishing execution.
- SociaMesh Cloudflare R2 is the source of media truth. Media handoff to Postiz occurs just-in-time via short-lived presigned GET URLs imported into Postiz.
- SociaMesh operates gracefully in offline mode: users can draft posts, manage media, and configure workspaces even if the Postiz engine is temporarily unreachable.

---

## High-Level Architecture

```
React / Vite Frontend (apps/web)
        |
        v  (HTTP-only session cookies / credentials)
SociaMesh Express API (apps/api)
        |
        +--> SociaMesh PostgreSQL / Neon (Users, Workspaces, Channels, Posts, Targets)
        |
        +--> Cloudflare R2 (Private Media Assets & Presigned URLs)
        |
        +--> Headless Postiz NestJS REST (Publishing, Scheduling & OAuth Engine)
```

---

## Deployment Modes & Configuration Portability

The SociaMesh application is fully portable. The identical codebase and container build run in local development or production VPS environments with zero source modifications.

### Local Development Mode

- **SociaMesh API**: `http://localhost:4000`
- **SociaMesh Web**: `http://localhost:5173`
- **Headless Postiz Backend**: `http://localhost:4008`

Configuration in `apps/api/.env`:

```ini
POSTIZ_BASE_URL="http://localhost:4008"
POSTIZ_API_KEY="your-postiz-api-key"
POSTIZ_TIMEOUT_MS=10000
```

### Production Mode

When deploying Postiz to a VPS or managed container:

```ini
POSTIZ_BASE_URL="https://postiz.yourdomain.com"
POSTIZ_API_KEY="production-secret-api-key"
POSTIZ_TIMEOUT_MS=10000
```

Changing `POSTIZ_BASE_URL` and `POSTIZ_API_KEY` is entirely sufficient.

---

## Workspace Structure

- `apps/api`: Node.js / Express 5 API with Prisma 7, PostgreSQL (Neon), Argon2id, Pino logging, Zod validation, Cloudflare R2 S3 adapter, and typed Postiz adapter.
- `apps/web`: React 19, Vite 8, Tailwind CSS v4, React Router 7, and TanStack Query v5 dashboard application.
- `.github/workflows/ci.yml`: Continuous integration workflow running dependency checks, Prisma generation, typecheck, build, lint, and tests.

---

## Quickstart & Local Setup

### Prerequisites

- Node.js `>= 20.20.0` (LTS 20 or 22)
- `pnpm >= 9.15.0`

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Files

Copy example configuration files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

### 3. Database Bootstrap & Migration

```bash
pnpm prisma:generate
pnpm db:setup
```

### 4. Running the Development Servers

```bash
pnpm dev
```

- API runs at `http://localhost:4000`
- Frontend runs at `http://localhost:5173`

### 5. Running Verification & Tests

```bash
pnpm run typecheck    # Typechecks all packages
pnpm run lint         # Lints all packages
pnpm run build        # Production builds of api and web
pnpm test             # Vitest test suite (65 tests across 4 suites)
pnpm format:check     # Prettier formatting check
```

---

## API Endpoints (`/api/v1`)

### System & Health

- `GET /healthz` — Process liveness
- `GET /readyz` — Database connectivity readiness
- `GET /api/v1/publishing/status` — Publishing engine connectivity health, latency, and status message

### Authentication (`/api/v1/auth`)

- `POST /register` — Register user, workspace, and receive `HttpOnly` session cookie (`sm_session`)
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

### Channels & Accounts (`/api/v1/workspaces/:workspaceId/channels`)

- `GET /` — List channels assigned to this workspace (Workspace members)
- `GET /available` — List all integrations from shared Postiz org with assignment status (Owner only)
- `POST /` — Assign a Postiz integration to this workspace (Owner only)
- `POST /connect-url` — Obtain OAuth connect URL for a provider from Postiz (Owner only)
- `DELETE /:channelId` — Remove channel assignment from this workspace without deleting upstream account (Owner only)
- `DELETE /:channelId/disconnect` — Permanently disconnect provider integration from Postiz and unassign across all workspaces (Owner only)

### Media Library (`/api/v1/workspaces/:workspaceId/media`)

- `GET /` — List media assets with short-lived presigned view URLs
- `POST /upload-url` — Request short-lived presigned PUT URL for direct browser-to-R2 upload
- `GET /:mediaId` — Retrieve single media asset with signed view URL
- `POST /:mediaId/complete` — Verify object in R2 and mark status as `READY`
- `DELETE /:mediaId` — Remove object from R2 and soft-delete record

### Publications (`/api/v1/workspaces/:workspaceId/posts`)

- `GET /` — List workspace posts/drafts with attached media and target channels (filter by `status`)
- `POST /` — Create post / draft with media attachments and target channel IDs
- `GET /:postId` — Get post details, media, and target channels
- `PATCH /:postId` — Update draft copy, media, or channels
- `DELETE /:postId` — Delete post (draft, failed, or cancelled)
- `POST /:postId/publish` — Publish post immediately to assigned channels via Postiz
- `POST /:postId/schedule` — Schedule post via Postiz/Temporal for future release
- `POST /:postId/cancel` — Cancel a scheduled publication in Postiz and mark as CANCELLED
