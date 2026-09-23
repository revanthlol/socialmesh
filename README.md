# SociaMesh

SociaMesh is an MVP social publishing dashboard for Facebook Pages, Instagram Professional accounts, and LinkedIn member profiles. The React frontend deploys to Vercel; the Express API runs on the Oracle VPS. It uses official OAuth and publishing APIs only.

## Repository

- `apps/web`: React, Vite, Tailwind CSS, and TanStack Query frontend
- `apps/api`: Express API, Prisma schema, publishing callbacks, and provider adapters
- `PRD.md`: implementation-ready product and technical requirements
- `SETUP.md`: local and production setup, including every external dashboard prerequisite

Start with [SETUP.md](./SETUP.md). Do not add provider secrets to source control.
