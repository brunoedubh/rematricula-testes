# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start development server (http://localhost:3000)
pnpm build        # Build for production
pnpm preview      # Preview production build
pnpm lint         # Run ESLint
pnpm typecheck    # Run TypeScript type checking (nuxt typecheck)
```

Use **pnpm** (not npm or yarn). Node.js 22+ required.

## Architecture

Nuxt 4 full-stack app — frontend and server API in the same project.

### Key layers

- **`app/`** — Frontend (Vue components, pages, layouts, client-side middleware)
- **`server/`** — Backend (API routes, utils, repositories)
- **`types/`** — Shared TypeScript types (re-exported via `types/index.ts`)
- **`composables/`** — Vue composables (`useAuth.ts`, `useTokens.ts`)

### Authentication flow

1. User logs in at `/login` with Microsoft corporate credentials (`username@homolog.animaeducacao.com.br` for dev/hml, `@animaeducacao.com.br` for prod)
2. `server/api/auth/login.post.ts` validates credentials via Azure AD **ROPC flow**
3. Password is AES-256-CBC encrypted (`server/utils/encryption.ts`) and stored in an in-memory session store alongside a JWT cookie (`auth-token`)
4. `app/middleware/auth.global.ts` protects all routes under `/app/*` by calling `/api/auth/me`
5. On login, Azure AD tokens for dev and hml are pre-generated asynchronously in the background

### Session management

Sessions are stored in a `Map<string, SessionUser>` in `server/utils/session.ts` (in-memory, lost on restart). JWTs signed with `SESSION_SECRET` serve as session identifiers. Session duration defaults to 8 hours.

### Token system

`server/utils/azure-token.ts` provides `getOrGenerateToken(email, password, environment)`:
- Checks `token-cache.ts` (in-memory Map) for a valid cached token (TTL 60min, 5min safety margin)
- On cache miss, calls Azure AD ROPC endpoint and caches the result
- Cache key: `"email:environment"`
- Production tokens require explicit password confirmation on each request (not pre-cached)

### Data sources

**Databricks** (`server/utils/databricks.ts`):
- Reads from `sb_jira.wv_alunos_rem` view via Databricks SQL Statement Execution API
- Authentication uses Personal Access Token (PAT) directly
- Query results mapped positionally from `data_array` to `Aluno` type

**PostgreSQL softlaunch** (`server/utils/db_soft.ts`):
- `pg` connection pool to the softlaunch service DB
- Table `escopo_regra` manages student access permissions (soft launch rules)
- `liberarAluno()` inserts/updates a 23h59 permission window; `unlockStudent()` ends it

### URL pattern for generated links

```
{URL_BASE_{ENV}}/autorizacao-idp/token/{access_token}/{refresh_token}/{cod_aluno}
```

## Environment variables

Required in `.env` (see `.env.example` or README.md for full list):
- `ENCRYPTION_KEY` — 32 random bytes (hex) for AES-256 encryption
- `SESSION_SECRET` — JWT signing secret
- `AZURE_CLIENT_ID_DEV` / `AZURE_CLIENT_ID_PROD` — Azure AD app registrations
- `AZURE_SCOPE_DEV` / `AZURE_SCOPE_PROD` — OAuth2 scopes
- `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`
- `DB_SOFT_HOST`, `DB_SOFT_NAME`, `DB_SOFT_USER`, `DB_SOFT_PASSWORD`

Generate keys:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Important conventions

- TypeScript strict mode is expected throughout
- Server utils in `server/utils/` are auto-imported by Nitro (no import needed for `useRuntimeConfig`, `getCookie`, etc.)
- All types are exported from `types/index.ts`
- SQL queries against Databricks use string sanitization (not parameterized) — see `databricks.ts` for the `sanitizeString`/`sanitizeNumber` helpers
- Indicator fields (`IND_*`) use `'S'` / `'N'` string values
