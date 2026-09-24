# SociaMesh Product Requirements Document

**Status:** implementation baseline  
**Version:** 1.0  
**Last verified:** 2026-09-23  
**Target:** a low-cost MVP deployed across Vercel, Cloudflare, an Oracle Ubuntu VPS, Neon, and Upstash

## 1. Executive summary

SociaMesh is a small-team social publishing application. A user connects one or more Facebook Pages, Instagram Professional accounts, and LinkedIn member profiles, creates a post once, selects destinations, uploads media, and either publishes immediately or schedules publication. The dashboard shows drafts, upcoming work, per-destination publishing progress, successful provider post links, and actionable failures.

The MVP deliberately keeps the Oracle VPS lean and focused. The VPS runs the SociaMesh Node.js/Express API behind Caddy alongside a headless Postiz + Temporal publishing engine. Vercel hosts the static React application, Neon hosts PostgreSQL, and Cloudflare R2 stores media. Postiz and Temporal own actual scheduling, durable timers, automatic retries, and provider publishing. Upstash QStash is not used.

SociaMesh must use official OAuth and publishing APIs. It never asks for or stores a social-network password. Scraping, browser automation, stored browser sessions, private endpoints, session cookies, Playwright, and Selenium are prohibited.

## 2. Product goals

1. Connect multiple publishable accounts on each supported platform without collecting social passwords.
2. Create, edit, delete, publish now, schedule, cancel, and retry posts from one interface.
3. Publish through official APIs to:
   - Facebook Pages
   - Instagram Professional accounts supported by Meta's publishing API
   - LinkedIn personal/member profiles
4. Show reliable per-destination state: `DRAFT`, `SCHEDULED`, `PUBLISHING`, `PUBLISHED`, or `FAILED` at the post level, with more granular internal target states.
5. Store social access and refresh tokens encrypted at the application layer.
6. Fit the production API comfortably enough on the existing Oracle VPS: 2 vCPU, approximately 954 MB RAM, 2 GB swap, and approximately 100 GB disk.
7. Keep the recurring cost at or near zero for demo traffic while exposing quota and provider-approval risks honestly.
8. Make future providers and optional automation/AI features additions to stable interfaces, not rewrites.

## 3. Non-goals for MVP

- No publishing to personal Facebook profiles. Facebook support is Pages only.
- No LinkedIn organization-page publishing in the MVP.
- No inbox, direct messages, comments, moderation, listening, engagement analytics, or social CRM.
- No ad creation, boosted posts, campaign management, or paid-media reporting.
- No content generation, AI assistant, approval workflow, n8n integration, or asset transformation pipeline.
- No provider impersonation or unsupported content types.
- No scraping, private APIs, headless browsers, captured cookies, or bypassing app review.
- No mobile application. The responsive web UI is the supported client.
- No enterprise SSO, SCIM, granular custom roles, audit export, or formal compliance claims.
- No self-hosted PostgreSQL, Redis, BullMQ, Kubernetes, Docker Swarm, or Elasticsearch on the VPS.
- No promise of exactly-once publication. External APIs cannot provide that guarantee; the design provides at-least-once delivery with strong idempotency and duplicate suppression.

## 4. Users and access model

### 4.1 Personas

- **Owner:** creates the workspace, manages members, connects/disconnects accounts, manages workspace settings, and can create/publish posts.
- **Member:** can view connected accounts and create, edit, schedule, cancel, publish, and retry posts. A member cannot remove the owner or delete the workspace.

For a single-user demo, registration creates one workspace and one `OWNER` membership automatically. The data model still supports multiple workspaces and members so account ownership is never inferred from a global user ID.

### 4.2 Minimal RBAC matrix

| Capability                           | Owner | Member |
| ------------------------------------ | ----: | -----: |
| View posts/calendar/accounts         |   Yes |    Yes |
| Create/edit/delete drafts            |   Yes |    Yes |
| Schedule/publish/cancel/retry        |   Yes |    Yes |
| Upload/delete unused media           |   Yes |    Yes |
| Connect or reconnect social accounts |   Yes |     No |
| Disconnect social accounts           |   Yes |     No |
| Invite/remove members                |   Yes |     No |
| Edit workspace name/timezone         |   Yes |     No |
| Delete workspace                     |   Yes |     No |

Every API lookup must scope by `workspace_id`; knowing a UUID is never authorization.

## 5. Primary user flows

### 5.1 First run

1. User registers with email, password, display name, and workspace name.
2. API normalizes the email, hashes the password with Argon2id, creates the user/workspace/owner membership in one transaction, and creates an opaque session.
3. Browser receives a `Secure`, `HttpOnly`, `SameSite=Lax` session cookie in production.
4. User lands on an empty dashboard with a direct link to connect an account.

### 5.2 Connect a social account

1. Owner opens **Settings > Connected accounts** and chooses Meta or LinkedIn.
2. API starts an OAuth authorization-code flow with a one-time state value and provider-appropriate PKCE.
3. Provider obtains consent. SociaMesh never renders or receives the provider password.
4. API callback validates the exact redirect URI, state, expiry, one-time use, and PKCE verifier before exchanging the code server-side.
5. API discovers accounts the user is permitted to publish to.
6. If more than one Facebook Page or Instagram account is available, the UI asks which resources to add. Repeated authorization can add multiple accounts.
7. API encrypts provider tokens, stores granted scopes and expiry, and records only provider IDs and display metadata needed by the UI.

### 5.3 Compose and publish

1. User creates a draft, writes common copy, selects one or more connected destinations, and optionally uploads media.
2. UI shows provider-specific validation before submission. The API repeats all validation.
3. User chooses **Publish now** or a future date/time in the workspace timezone.
4. API stores UTC instants and the originating IANA timezone, creates per-account `PostTarget` rows, and creates or queues delivery work.
5. The UI moves to the post detail page and polls while any target is publishing.

### 5.4 Failure and recovery

1. A target failure shows a plain-language summary, provider error category, timestamp, and whether retry is safe.
2. Retryable transport/rate-limit/provider failures are retried automatically within policy.
3. Expired/revoked permission failures mark the account `REAUTH_REQUIRED`; the owner reconnects it before retry.
4. Invalid copy/media is terminal until the user edits the post or media.
5. Successfully published targets remain published when another target fails. The user retries only failed targets.

## 6. System architecture

```text
Browser
  |
  | HTTPS
  v
Vercel: React SPA
  |
  | credentials: include, JSON API
  v
api.<domain> -> Cloudflare DNS/TLS -> Caddy on Oracle VPS
                                      |
                                      v
                                 Express API
                            /        |       \
                           v         v        v
                  Neon PostgreSQL  R2 media  Postiz Engine (Headless)
                                                       |
                                                       v
                                            Temporal Durable Scheduler
                                                       |
                                                       v
                                            Official Provider APIs
                                              (Meta / LinkedIn / X)
```

### 6.1 Component ownership

| Component           | Runtime               | Responsibility                                                                 |
| ------------------- | --------------------- | ------------------------------------------------------------------------------ |
| React/Vite/Tailwind | Vercel                | authenticated UI, routing, forms, client cache                                 |
| Express API         | Oracle VPS            | auth, validation, OAuth callbacks, orchestration, provider calls               |
| Caddy               | Oracle VPS            | TLS to origin, reverse proxy, compression, security headers                    |
| PostgreSQL + Prisma | Neon                  | source of truth, sessions, posts, job state, encrypted credentials             |
| Postiz + Temporal   | Oracle VPS (Headless) | social publishing engine, durable timer scheduling, retries, OAuth connections |
| R2                  | Cloudflare            | original media objects and temporary provider-readable media URLs              |
| GitHub Actions      | GitHub                | test/build, artifact deployment, migration gate                                |

### 6.2 Architectural boundaries

- The browser never receives provider client secrets, social access tokens, Postiz API keys, R2 secret keys, or database credentials.
- SociaMesh interacts with Postiz exclusively through a typed backend adapter (apps/api/src/lib/postiz).
- PostgreSQL is the source of truth for SociaMesh user and workspace data; Postiz manages publishing workflows and provider tokens.
- Provider-specific request shapes stay behind adapters. Controllers do not call Graph API or LinkedIn endpoints directly.
- R2 object metadata is stored in PostgreSQL; binary content is not.

## 7. Functional requirements

### 7.1 Authentication and workspace

- **AUTH-01:** Register with normalized email, display name, password, and workspace name.
- **AUTH-02:** Sign in/out and revoke all sessions after a password change.
- **AUTH-03:** Passwords use Argon2id. No recoverable password value is stored.
- **AUTH-04:** Session tokens are random opaque values. Only an HMAC/SHA-256 hash of each token is stored.
- **AUTH-05:** Enforce membership and role on every workspace resource.
- **AUTH-06:** Owner can view current workspace members. Invitations may be deferred until after the three-platform demo.

### 7.2 Connected accounts

- **ACC-01:** Connect multiple Facebook Pages, Instagram Professional accounts, and LinkedIn members per workspace.
- **ACC-02:** Prevent duplicate connections for `(workspace, provider, provider_account_id)` while permitting the same provider account in different workspaces only after explicit authorization.
- **ACC-03:** Show provider, display name, handle, avatar, scope health, token expiry when known, last validation, and connection status.
- **ACC-04:** Reconnect in place so posts keep their foreign keys.
- **ACC-05:** Disconnect revokes remotely when an official revocation endpoint is available, then deletes ciphertext locally. Existing published history remains; unpublished targets become failed/cancelled with an actionable reason.
- **ACC-06:** Run a daily lightweight credential-health check only when allowed by provider quotas. Otherwise validate on use and update status from provider errors/webhooks.

### 7.3 Posts

- **POST-01:** Create, read, update, and delete drafts.
- **POST-02:** Select one or many connected accounts. A post may include multiple accounts from the same platform.
- **POST-03:** Store common text plus provider overrides only when a demonstrated provider difference requires them. Do not add override UI before the common flow works.
- **POST-04:** Publish now or schedule in a user-selected IANA timezone; persist the UTC instant.
- **POST-05:** Editing or deleting is allowed only before any target reaches `PUBLISHING`. After partial publication, preserve the immutable historical post and allow “Duplicate as new draft.”
- **POST-06:** Cancel a scheduled post by cancelling every unpublished target and invalidating queued deliveries.
- **POST-07:** Parent status is derived:
  - `DRAFT`: no targets scheduled or dispatched.
  - `SCHEDULED`: at least one target is scheduled/dispatched and none is publishing/published/terminally failed.
  - `PUBLISHING`: at least one target is actively publishing.
  - `PUBLISHED`: every non-cancelled target published successfully.
  - `FAILED`: no target is publishing and at least one non-cancelled target is terminally failed. The UI still shows successful targets.
- **POST-08:** Search/filter by status, provider, account, date range, and creator. MVP search can be case-insensitive PostgreSQL text matching.

### 7.4 Media

- **MEDIA-01:** Support images for the three-platform demo. Video support may be implemented within the MVP schema but is not a demo blocker unless provider approvals and upload processing are proven.
- **MEDIA-02:** Browser uploads directly to R2 with a short-lived presigned `PUT`; API credentials never reach the browser.
- **MEDIA-03:** API validates declared MIME type, maximum bytes, extension, magic bytes or provider-validated content, and dimensions before marking the asset `READY`.
- **MEDIA-04:** Provider capability validation runs for every selected target. One platform's acceptance does not imply another's.
- **MEDIA-05:** Deleting a draft removes only unreferenced objects. Published-post media follows a retention policy and is not immediately deleted.
- **MEDIA-06:** Object keys use unguessable IDs and a workspace prefix, not user-supplied filenames.

### 7.5 Dashboard and calendar

- **DASH-01:** Dashboard sections: scheduled next, recent publishing activity, failed actions, and connection warnings. No fabricated analytics or vanity counts.
- **DASH-02:** Calendar has month/week views with timezone label, status, destinations, and accessible list fallback.
- **DASH-03:** Upcoming items link to edit/cancel; completed items link to provider posts where a stable URL can be constructed or returned.
- **DASH-04:** Empty states provide one concrete action, such as connect an account or create a post.

### 7.6 Reliability

- **REL-01:** Postiz and Temporal durable workflows ensure idempotency, preventing duplicate provider publications.
- **REL-02:** Retry only failures classified as retryable. Respect provider `Retry-After` and rate-limit resets.
- **REL-03:** Record every attempt without logging credentials or full provider payloads.
- **REL-04:** Postiz orchestrator monitors publishing workflow status and records terminal errors if provider delivery fails.
- **REL-05:** All dates use UTC in storage and ISO 8601 over the API.

## 8. Frontend requirements

### 8.1 Routes/pages

| Route                 | Page                 | Key behavior                                   |
| --------------------- | -------------------- | ---------------------------------------------- |
| `/login`              | Sign in              | labeled fields, generic auth error, return URL |
| `/register`           | Create account       | password rules, workspace creation             |
| `/`                   | Dashboard            | upcoming, recent, failures, account health     |
| `/posts`              | Post list            | filters, pagination, status and targets        |
| `/posts/new`          | Composer             | copy, target picker, media, now/schedule       |
| `/posts/:id`          | Post detail          | target timeline, attempts, retry/duplicate     |
| `/posts/:id/edit`     | Edit draft/scheduled | optimistic version check, reschedule           |
| `/calendar`           | Calendar             | month/week and accessible agenda list          |
| `/media`              | Media library        | upload state, reusable assets, delete unused   |
| `/settings/accounts`  | Connected accounts   | connect/reconnect/disconnect/status            |
| `/settings/workspace` | Workspace settings   | name, timezone, members                        |
| `*`                   | Not found            | branded 404 with dashboard link                |

### 8.2 Component map

- `AppShell`, `PrimaryNav`, `WorkspaceSwitcher`, `AccountMenu`
- `PostComposer`, `DestinationPicker`, `ProviderCapabilityNotice`, `SchedulePicker`
- `MediaDropzone`, `UploadProgress`, `MediaPreview`, `AltTextField`
- `PostStatusBadge`, `TargetStatusList`, `FailurePanel`, `RetryButton`
- `CalendarGrid`, `AgendaList`, `CalendarItem`
- `ConnectionCard`, `OAuthReturnNotice`, `ReconnectDialog`, `DisconnectDialog`
- shared `Button`, `Dialog`, `Menu`, `Field`, `ErrorSummary`, `Toast`, `Skeleton`, `EmptyState`

Buttons should be rectangular with restrained radii, visible focus rings, and state-driven motion only. No fake reviews, fake usage statistics, decorative counters, generic gradient hero, glassmorphism, or emoji icons.

### 8.3 Client state and query strategy

- TanStack Query owns server state. Query keys include workspace ID and filters.
- React Router owns route/search state. Filter controls serialize into URL search parameters.
- Local component state owns unsaved form fields and dialogs.
- Use React Hook Form only when the composer complexity justifies it; do not add a global client-state library for MVP.
- Mutations invalidate narrowly: a post mutation invalidates its detail, relevant list pages, dashboard, and calendar range.
- Poll post detail every 2 seconds only while a target is `DISPATCHED` or `PUBLISHING`; back off to 10 seconds after one minute and stop in terminal states.
- Do not optimistically mark a post published. Draft text edits may use optimistic concurrency via the `version` field.
- Render server validation errors next to fields and a concise error summary at the top.

### 8.4 Accessibility and responsive behavior

- One `h1` per page, logical headings, landmarks, associated labels, and keyboard-operable dialogs/menus.
- Status is communicated with text/icon as well as color.
- Minimum 44 by 44 CSS pixel touch targets for primary mobile controls.
- Calendar has an agenda/list alternative and does not rely on drag-and-drop.
- Respect `prefers-reduced-motion`.
- Test 320 px, 768 px, 1280 px, and wide desktop without horizontal overflow.

## 9. Express API architecture

### 9.1 Module layout

```text
apps/api/src/
  app.ts
  index.ts
  config/
  db/
  middleware/
    authenticate.ts
    authorize-workspace.ts
    csrf.ts
    error-handler.ts
    rate-limit.ts
    request-id.ts
    validate.ts
  modules/
    auth/
    workspaces/
    accounts/
    oauth/
    posts/
    media/
    publishing/
    scheduler/
    webhooks/
  providers/
    types.ts
    registry.ts
    meta/
    linkedin/
  services/
    encryption.ts
    r2.ts
    postiz/
  generated/prisma/
```

Each feature module uses `route -> controller -> service -> repository/provider`. Controllers translate HTTP only. Services own transactions and policy. Provider adapters translate SociaMesh commands to official APIs.

### 9.2 Middleware order

1. request ID and structured request logger
2. proxy/HTTPS enforcement in production
3. Helmet security headers
4. strict origin-aware CORS with credentials
5. route-specific raw body capture for provider webhook signature verification
6. JSON body limit for normal routes
7. session authentication
8. CSRF/origin validation for cookie-authenticated mutations
9. workspace authorization/RBAC
10. schema validation
11. controller
12. normalized error handler

Do not globally parse provider webhook bodies before signature verification if the signature scheme depends on raw bytes.

## 10. Provider abstraction

```ts
interface SocialPublisher {
  readonly provider: SocialProvider;
  getAuthorizationUrl(input: OAuthStart): Promise<OAuthRedirect>;
  exchangeAuthorizationCode(input: OAuthCallback): Promise<TokenSet>;
  discoverAccounts(tokens: TokenSet): Promise<DiscoveredAccount[]>;
  validateConnection(
    account: DecryptedSocialAccount,
  ): Promise<ConnectionHealth>;
  validatePost(input: NormalizedPost): Promise<ValidationIssue[]>;
  publish(input: PublishCommand): Promise<PublishResult>;
  revoke?(account: DecryptedSocialAccount): Promise<void>;
  refreshTokens?(account: DecryptedSocialAccount): Promise<TokenSet>;
}
```

`PublishResult` contains provider post ID, stable URL when available, provider request ID, and sanitized metadata. Provider errors are mapped to:

- `AUTH_RECONNECT_REQUIRED`
- `PERMISSION_MISSING`
- `CONTENT_INVALID`
- `MEDIA_INVALID`
- `RATE_LIMITED`
- `PROVIDER_UNAVAILABLE`
- `NETWORK_ERROR`
- `DUPLICATE_SUSPECTED`
- `UNKNOWN_PROVIDER_ERROR`

Only `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, and most `NETWORK_ERROR` outcomes are automatically retryable. A timeout after a provider may have accepted a write is `DUPLICATE_SUSPECTED` and requires provider lookup when available or a manual decision; blindly retrying risks a duplicate post.

## 11. OAuth and account connection design

### 11.1 Common authorization-code flow

1. Authenticated owner calls `POST /api/v1/oauth/:provider/start` with workspace ID and intended return path.
2. API generates at least 32 random bytes for `state`, stores only `SHA-256(state)` with workspace, user, provider, redirect path, and a 10-minute expiry. Store a PKCE verifier if the provider flow supports/requires it.
3. API returns or redirects to the provider authorization URL. The browser must not construct scopes itself.
4. Provider redirects to a fixed HTTPS API callback URI.
5. Callback rejects missing/mismatched/expired/consumed state, provider mismatch, OAuth error, or reused code. State is consumed transactionally.
6. API exchanges the code from the server using the provider client secret and exact registered redirect URI.
7. API checks required scopes, discovers publishable resources, and stores a short-lived encrypted pending connection or immediately saves the only available resource.
8. For multiple resources, browser receives a one-time selection handle, not raw access tokens. Owner selects resources through `POST /oauth/:provider/complete`.
9. API upserts account records, encrypts tokens with account-bound associated data, writes an audit event, and redirects to the allowlisted return path with a success/error code only.

### 11.2 Meta flow for Facebook Pages and Instagram

The MVP uses Meta's official Facebook Login for Business path so one consent can discover Pages and Page-linked Instagram Professional accounts. Required permissions must be confirmed against the pinned Graph API version during implementation; expected permissions include Page listing/read/publish and Instagram basic/publish scopes such as `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `instagram_basic`, and `instagram_content_publish`. Do not hard-code an API version in source; set and test `META_GRAPH_API_VERSION`.

After token exchange:

1. Exchange the short-lived user token for the supported longer-lived form when Meta permits it.
2. Request the Pages the user manages, their Page access tokens, and linked Instagram Professional account metadata through documented Graph edges.
3. Present Facebook Pages and eligible Instagram accounts as separate SociaMesh destinations.
4. Store the correct resource-scoped token per destination, encrypted. Never expose Page tokens to the browser.
5. Record the exact granted scopes and mark missing-publish-scope resources unavailable.

Meta development mode works only for app-role/test users. Publishing for arbitrary users requires correct app configuration, privacy/data-deletion URLs, business verification where required, and App Review/advanced access. These approvals are a product dependency, not an engineering workaround.

Instagram publishing uses the documented container flow: create a media container, wait/poll for processing when required, then call media publish. Consumer/personal Instagram accounts are not supported. For this MVP path, the Instagram Professional account must satisfy Meta's current eligibility and Page-link requirements.

### 11.3 LinkedIn member flow

1. Configure **Sign in with LinkedIn using OpenID Connect** and **Share on LinkedIn** in the LinkedIn Developer Portal.
2. Request only `openid`, `profile`, `email` when email is needed, and `w_member_social` for posting.
3. Use authorization code plus PKCE when supported by the registered application.
4. Exchange server-side and obtain the member identifier from the documented userinfo/profile endpoint.
5. Store the member as `LINKEDIN_MEMBER` with its encrypted token and granted scopes.
6. Publish through the current versioned LinkedIn Posts API. Send the required `LinkedIn-Version` and `X-Restli-Protocol-Version` headers from configuration.

The current Posts API replaces legacy `ugcPosts`; do not start new implementation on deprecated examples. The MVP posts only on behalf of the consenting member. Organization posting requires different permissions and is future scope.

### 11.4 Multiple accounts

- Facebook/Instagram: one Meta authorization may reveal several resources; the owner selects any number.
- LinkedIn: each connection maps to the consenting LinkedIn member. Adding a second member requires a fresh authorization in a provider session that selects that member.
- A single user can repeat connection flows. Uniqueness prevents accidental duplicate rows.
- Tokens are stored per destination even if their source authorization was shared, so reconnect/disconnect behavior is explicit.

## 12. Publishing and scheduling

### 12.1 Publish-now flow

1. Validate membership, target ownership/status, post content, media readiness, provider capabilities, and optimistic `version`.
2. Ensure media assets stored in R2 have public or signed URLs accessible to Postiz.
3. SociaMesh Express API calls Postiz REST endpoint `POST /api/public/v1/posts` with `type: "now"`.
4. Postiz starts a Temporal workflow to dispatch publishing immediately to selected social platforms.
5. SociaMesh records the publication attempt and updates local post status.

### 12.2 Durable scheduling with Postiz + Temporal

Postiz uses Temporal durable timers rather than cron or rolling schedulers.

1. When a post is scheduled via `POST /api/public/v1/posts` with `type: "schedule"` and `date: ISO_DATE`, Postiz starts a Temporal workflow (`postWorkflowV112`).
2. Temporal puts the workflow to sleep until the scheduled timestamp (`workflow.sleep(diffInMs)`). State is persisted durably in PostgreSQL.
3. If the server or container restarts, Temporal wakes up the timer exactly on schedule without missed or duplicate posts.
4. If a scheduled post is cancelled via `DELETE /api/public/v1/posts/:id`, Postiz terminates the Temporal workflow immediately.

### 12.3 Security and boundaries

- SociaMesh communicates with Postiz over HTTP using `POSTIZ_BASE_URL` and `POSTIZ_API_KEY` (backend-only).
- Neither Postiz API keys nor provider tokens are ever exposed to the web frontend.
- Provider secrets reside securely inside the Postiz environment.

### 12.4 Retry policy

- Temporal activities handle retries with exponential backoff (initial interval 10s, max 10 attempts).
- Application retry: maximum 5 provider attempts per target over 24 hours, with provider `Retry-After` taking precedence.
- Backoff baseline: 1 minute, 5 minutes, 30 minutes, 2 hours, 8 hours plus jitter.
- Authentication, permission, validation, and unsupported-media errors are terminal until user action.
- On exhausted retries, mark target `FAILED`, store sanitized detail, and expose manual retry after revalidation.
- Reconciliation runs from the dispatcher: targets `PUBLISHING` longer than 15 minutes are inspected. If a provider lookup cannot establish success, mark `DUPLICATE_SUSPECTED` instead of republishing automatically.

## 13. Media and R2 design

### 13.1 Upload flow

1. Client requests `POST /media/upload-url` with filename, MIME type, byte size, and kind.
2. API validates coarse limits, creates `MediaAsset(PENDING_UPLOAD)`, and returns a short-lived R2 S3 presigned `PUT` limited to one object key/content type.
3. Browser uploads directly to R2 and reports progress locally.
4. Client calls `/media/:id/complete` with checksum/metadata.
5. API performs `HEAD`, verifies size/type/checksum, and performs or queues content inspection. Only then set `READY`.
6. Failed/incomplete uploads are cleaned after 24 hours.

R2 CORS allows only the production web origin and local development origin, required methods, and required headers. Presigned URLs are bearer credentials and should expire in minutes.

### 13.2 URLs used by providers

- Keep the bucket private by default.
- For providers that accept binary uploads, the API streams the R2 object to the provider's official upload endpoint. Do not buffer a whole video in RAM.
- For Instagram's URL-fetch flow, generate a provider-specific presigned `GET` URL from the R2 S3 API domain immediately before container creation. R2 presigned URLs support expiries up to seven days but should use the shortest period that covers provider fetch/processing, initially one hour for images and longer only when documented processing requires it.
- R2 presigned URLs do not work on an R2 custom domain. If a stable public media host is required later, attach `media.<domain>` to a public R2 bucket and use unguessable immutable keys; understand that anyone with the URL can read the object.
- Never place access tokens in media URLs. Log only object IDs, not full signed URLs.

### 13.3 Retention

- Pending uploads: delete after 24 hours.
- Unreferenced ready assets: owner-deletable; optionally clean after 30 days.
- Assets referenced by scheduled posts: retain until all targets are terminal.
- Published assets: retain for the configured workspace policy, default 90 days for MVP, then delete only if no draft/scheduled references remain.

## 14. PostgreSQL and Prisma data model

The starter schema in `apps/api/prisma/schema.prisma` is the implementation baseline.

### 14.1 Core tables

| Table              | Purpose and important fields                                                                           |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| `users`            | normalized unique email, Argon2id hash, display name, timestamps                                       |
| `sessions`         | hashed opaque token, user, expiry, last seen, optional hashed IP/user agent                            |
| `workspaces`       | name and IANA timezone                                                                                 |
| `memberships`      | user/workspace unique pair and `OWNER`/`MEMBER` role                                                   |
| `oauth_states`     | hashed state, provider, PKCE verifier, expiry, consumed timestamp                                      |
| `social_accounts`  | workspace/provider/resource ID, status, encrypted tokens, scopes, expiry, provider metadata            |
| `posts`            | common content, derived status, schedule, timezone, version, error summary                             |
| `post_targets`     | one selected social account, granular state, target dispatch generation, provider result, retry fields |
| `media_assets`     | R2 object key, kind, verified metadata, lifecycle status                                               |
| `post_media`       | ordered many-to-many link between posts and media                                                      |
| `publish_attempts` | immutable attempt outcome and idempotency record                                                       |
| `webhook_events`   | deduplicated raw provider event record and processing state                                            |
| `audit_logs`       | security/product actions without secret material                                                       |

### 14.2 Required indexes and constraints

- Unique normalized `users.email`.
- Unique `(user_id, workspace_id)` membership.
- Unique `(workspace_id, provider, provider_account_id)` social account.
- Unique `(post_id, social_account_id)` target.
- `posts(workspace_id, status, scheduled_for)` for lists and calendar.
- `post_targets(status, scheduled_for)` for rolling dispatch.
- `post_targets(status, next_attempt_at)` for retry/reconciliation.
- Unique provider/attempt idempotency identifiers where present.
- Unique R2 `object_key`.
- Unique `(post_id, position)` media ordering.
- Webhook provider event uniqueness where the provider supplies an ID; otherwise dedupe by provider, type, payload hash, and a bounded received-time check.

### 14.3 Concurrency rules

- `posts.version` increments on every user edit. `PATCH` requires `If-Match` or the current version in the body and returns `409` on stale edits.
- Scheduler selects/claims batches under row locking; network calls happen after commit.
- Publishing claims a target with a single conditional update. Zero updated rows means another delivery owns it or it is stale.
- Parent status recalculation and target terminal update occur in one transaction.
- Avoid long transactions around provider, R2, or Postiz network calls.

## 15. Token encryption and secret handling

1. Generate a 32-byte master key outside the repository and store it as base64 in the VPS environment/secret store.
2. Encrypt each token independently with AES-256-GCM using a fresh 96-bit random nonce.
3. Bind ciphertext to `workspace_id`, `social_account_id`, provider, token type, and key version as authenticated associated data. Moving ciphertext to another row then fails authentication.
4. Store an envelope containing version, nonce, authentication tag, and ciphertext in the `Bytes` field. Never use deterministic encryption.
5. Keep `encryption_key_version`; support current and previous keys during rotation. Re-encrypt lazily after successful decrypt or through a bounded rotation command.
6. Decrypt only inside the provider service immediately before use. Do not return, stringify, inspect, or log plaintext tokens.
7. Application secrets never use `VITE_` prefixes. Only `VITE_API_BASE_URL` is public.
8. Password hashing and token encryption keys are independent. Session pepper is also independent.

Production should eventually use a managed KMS for envelope encryption. For this constrained MVP, a root-readable systemd `EnvironmentFile` with strict permissions is acceptable, provided backups exclude plaintext environment files.

## 16. REST API inventory

All responses are JSON except OAuth redirects and health. Prefix product routes with `/api/v1`.

### 16.1 Auth/workspace

| Method  | Path                      | Purpose                               |
| ------- | ------------------------- | ------------------------------------- |
| `POST`  | `/auth/register`          | create user, workspace, owner session |
| `POST`  | `/auth/login`             | create session cookie                 |
| `POST`  | `/auth/logout`            | revoke current session                |
| `POST`  | `/auth/logout-all`        | revoke all user sessions              |
| `GET`   | `/auth/me`                | current user/workspaces/session       |
| `GET`   | `/workspaces/:id`         | workspace details                     |
| `PATCH` | `/workspaces/:id`         | owner updates name/timezone           |
| `GET`   | `/workspaces/:id/members` | list members                          |

### 16.2 Connections/OAuth

| Method   | Path                                            | Purpose                      |
| -------- | ----------------------------------------------- | ---------------------------- |
| `GET`    | `/workspaces/:id/accounts`                      | list account health          |
| `POST`   | `/workspaces/:id/oauth/:provider/start`         | begin OAuth                  |
| `GET`    | `/oauth/:provider/callback`                     | fixed provider callback      |
| `POST`   | `/workspaces/:id/oauth/:provider/complete`      | select discovered resources  |
| `POST`   | `/workspaces/:id/accounts/:accountId/reconnect` | begin replacement OAuth      |
| `DELETE` | `/workspaces/:id/accounts/:accountId`           | revoke/disconnect            |
| `POST`   | `/workspaces/:id/accounts/:accountId/validate`  | owner-triggered health check |

### 16.3 Posts/calendar

| Method   | Path                                                    | Purpose                    |
| -------- | ------------------------------------------------------- | -------------------------- |
| `GET`    | `/workspaces/:id/posts`                                 | paginated filtered list    |
| `POST`   | `/workspaces/:id/posts`                                 | create draft               |
| `GET`    | `/workspaces/:id/posts/:postId`                         | detail, targets, attempts  |
| `PATCH`  | `/workspaces/:id/posts/:postId`                         | edit with version check    |
| `DELETE` | `/workspaces/:id/posts/:postId`                         | delete draft only          |
| `POST`   | `/workspaces/:id/posts/:postId/schedule`                | validate and schedule      |
| `POST`   | `/workspaces/:id/posts/:postId/publish`                 | publish now, returns 202   |
| `POST`   | `/workspaces/:id/posts/:postId/cancel`                  | cancel unpublished targets |
| `POST`   | `/workspaces/:id/posts/:postId/targets/:targetId/retry` | retry one failed target    |
| `POST`   | `/workspaces/:id/posts/:postId/duplicate`               | duplicate as new draft     |
| `GET`    | `/workspaces/:id/calendar?from=&to=`                    | scheduled/published range  |

### 16.4 Media and internal callbacks

| Method     | Path                                      | Purpose                                  |
| ---------- | ----------------------------------------- | ---------------------------------------- |
| `GET`      | `/workspaces/:id/media`                   | paginated media library                  |
| `POST`     | `/workspaces/:id/media/upload-url`        | create asset and signed PUT              |
| `POST`     | `/workspaces/:id/media/:mediaId/complete` | verify uploaded object                   |
| `DELETE`   | `/workspaces/:id/media/:mediaId`          | delete unused asset                      |
| `POST`     | `/internal/jobs/cleanup`                  | Internal retention cleanup               |
| `GET/POST` | `/webhooks/meta`                          | Meta verification and signed events      |
| `POST`     | `/webhooks/linkedin`                      | LinkedIn events if enabled/required      |
| `GET`      | `/healthz`                                | process liveness, no secret details      |
| `GET`      | `/readyz`                                 | database readiness for deployment checks |

List endpoints use cursor pagination and a bounded default page size. Errors use a stable envelope:

```json
{
  "error": {
    "code": "CONTENT_INVALID",
    "message": "This image is not supported by Instagram.",
    "details": [{ "field": "media[0]", "reason": "aspect_ratio" }],
    "requestId": "..."
  }
}
```
