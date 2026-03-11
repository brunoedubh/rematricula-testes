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

Nuxt 4 full-stack app — frontend and server API in the same project. UI built with **Nuxt UI v4** (component API differs significantly from v2/v3).

### Key layers

- **`app/`** — Frontend (Vue components, pages, layouts, client-side middleware)
- **`server/api/`** — HTTP endpoint handlers (thin — delegate to repositories/utils)
- **`server/repositories/`** — Data access layer sitting between API routes and utils
- **`server/utils/`** — Core server utilities (auto-imported by Nitro): `azure-token.ts`, `databricks.ts`, `db_soft.ts`, `encryption.ts`, `session.ts`, `token-cache.ts`, `url-builder.ts`
- **`types/`** — Shared TypeScript types (re-exported via `types/index.ts`)
- **`composables/`** — Vue composables at project root (`useAuth.ts`, `useTokens.ts`)
- **`database/`** — SQL schema definitions (`schema.sql` covers Databricks/Hive and PostgreSQL tables)

### App-specific UI components (`app/components/app/`)

- `DashAlunos.vue` — Main student search & token generation interface
- `DashPendencias.vue` — Pending issues dashboard backed by `/api/pendencias/*` endpoints
- `SearchBar.vue` — Student search filters input
- `StudentList.vue` — Renders list of `StudentCard` items
- `StudentCard.vue` — Individual student card with per-environment token generation buttons
- `StudentDetailsModal.vue` — Full student academic/contract details in a modal
- `ProductionAccessModal.vue` — Confirmation modal required before accessing production
- `PasswordPromptModal.vue` — Prompts user for password when required (prod, session expired)
- `TokenStatusCard.vue` — Shows cached token status per environment

### Page routes

- `/login` — Public login page (layout: `auth`)
- `/app` — Dashboard de Pendências (`DashPendencias` component)
- `/app/alunos` — Busca de Alunos e geração de tokens (`DashAlunos` component)

### Authentication flow

1. User logs in at `/login` with Microsoft corporate credentials (`username@homolog.animaeducacao.com.br` for dev/hml, `@animaeducacao.com.br` for prod)
2. `server/api/auth/login.post.ts` validates credentials via Azure AD **ROPC flow**
3. Password is AES-256-CBC encrypted (`server/utils/encryption.ts`) and stored in an in-memory session store alongside a JWT cookie (`auth-token`)
4. `app/middleware/auth.global.ts` protects all routes under `/app/*` by calling `/api/auth/me`
5. On login, Azure AD tokens for dev and hml are pre-generated asynchronously in the background

### Session management

Sessions are stored in a `Map<string, SessionUser>` in `server/utils/session.ts` (in-memory, lost on restart). JWTs signed with `SESSION_SECRET` serve as session identifiers. Session duration defaults to 8 hours (configurable via `SESSION_DURATION` in ms).

### Token system

`server/utils/azure-token.ts` provides `getOrGenerateToken(email, password, environment)`:
- Checks `token-cache.ts` (in-memory `Map<email, {dev?, hml?, prod?}>`) for a valid cached token (TTL 60min, 5min safety margin)
- On cache miss, calls Azure AD ROPC endpoint and caches the result
- Production tokens require explicit password confirmation on each request (not pre-cached)
- `url-builder.ts` provides `buildAccessUrl(environment, accessToken, refreshToken, studentCode)` which constructs the full redirect URL

### Data sources

**Databricks** (`server/utils/databricks.ts`):
- Reads from `sb_jira.wv_alunos_rem` view via Databricks SQL Statement Execution API
- Authentication uses Personal Access Token (PAT) directly
- Query results mapped positionally from `data_array` to `Aluno` type
- Access via `server/repositories/databricksRepository.ts` from API routes

**PostgreSQL softlaunch** (`server/utils/db_soft.ts`):
- `pg` connection pool to the softlaunch service DB
- Table `escopo_regra` manages student access permissions (soft launch rules)
- A student is **liberated** when a record exists with `codigoregra = 'a511dd31-b291-4b09-a94f-52e95936d418'` and the current date falls within `datainicio`–`datafim`
- `liberarAluno()` inserts/updates a 23h59 permission window; `unlockStudent()` ends it
- Access via `server/repositories/softLaunchRepository.ts` from API routes

### Server API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/auth/login` | Login with Microsoft ROPC |
| POST | `/api/auth/logout` | Logout, clears session & token cache |
| GET  | `/api/auth/me` | Validate current session |
| POST | `/api/students/search` | Search students in Databricks |
| POST | `/api/students/block-status` | Check soft launch block status |
| POST | `/api/students/liberar` | Liberate student in soft launch |
| POST | `/api/students/unlock` | Block/end liberation in soft launch |
| POST | `/api/tokens/generate-url` | Generate Azure AD token & return access URL |
| GET  | `/api/tokens/status` | Check cached token status for environments |
| GET  | `/api/softlaunch/search` | Search directly in softlaunch DB |
| POST | `/api/databricks/auth` | Test Databricks auth |
| GET  | `/api/pendencias/resumo` | Aggregate counts: aptos, com pendências, ativas |
| GET  | `/api/pendencias/por-tipo` | All 11 pending types with affected student counts |
| GET  | `/api/pendencias/alunos` | Top 200 students with pending issues (sorted by count) |

### URL pattern for generated links

```
{URL_BASE_{ENV}}/autorizacao-idp/token/{access_token}/{refresh_token}/{cod_aluno}
```

## Environment variables

Required in `.env`:
- `ENCRYPTION_KEY` — 32 random bytes (hex) for AES-256 encryption
- `SESSION_SECRET` — JWT signing secret
- `SESSION_DURATION` — Session TTL in ms (default: `28800000` = 8h)
- `AZURE_CLIENT_ID_DEV` / `AZURE_CLIENT_ID_PROD` — Azure AD app registrations
- `AZURE_SCOPE_DEV` / `AZURE_SCOPE_PROD` — OAuth2 scopes
- `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, `DATABRICKS_WAREHOUSE_ID`
- `DATABRICKS_CATALOG` (default: `hive_metastore`), `DATABRICKS_SCHEMA` (default: `default`)
- `DB_SOFT_HOST`, `DB_SOFT_NAME`, `DB_SOFT_USER`, `DB_SOFT_PASSWORD`
- `DB_SOFT_PORT` (default: `5432`), `DB_SOFT_SSL` (default: `true`), `DB_SOFT_SCHEMA` (production value: `servicorematriculaadministrativo`)
- `URL_BASE_DEV`, `URL_BASE_HML`, `URL_BASE_PROD`
- `ALLOWED_DOMAIN` (default: `animaeducacao.com.br`)

Generate keys:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Pending issues data model (`database/schema.sql`)

The pending issues system uses four tables in Databricks (`hive_metastore.sb_jira.*`):
- `tipo_pendencia` — 11 issue types (e.g. `aptos`, `persona`, `turma_vaga`, `curso_contrato_financeiro`)
- `pendencias` — Registry of individual issues with active status and reference codes
- `aluno_pendencias` — Maps students (`cod_pessoa`) to their pending issues
- `alunos_aptos` — Students eligible for enrollment, with status fields like `ind_aptos`, `ind_calouro`, `ind_formando`

## Important conventions

- TypeScript strict mode is expected throughout
- Server utils in `server/utils/` are auto-imported by Nitro (no import needed for `useRuntimeConfig`, `getCookie`, etc.)
- All types are exported from `types/index.ts`
- SQL queries against Databricks use string sanitization (not parameterized) — see `databricks.ts` for the `sanitizeString`/`sanitizeNumber` helpers
- Indicator fields (`IND_*`) use `'S'` / `'N'` string values
- API request bodies are validated with **Zod v4** (`zod` package)
- Nuxt modules in use: `@nuxt/ui`, `@nuxt/image`, `@vueuse/nuxt`
- UI components use **Nuxt UI v4** (`@nuxt/ui ^4`) — consult v4 docs, not v2/v3
- Icon sets available: `heroicons`, `lucide`, `simple-icons` (via `@iconify-json/*`)
- UI primary color is `blue` (set in `app/app.config.ts`); Ânima brand purple `#6B2C91` is used in CSS/assets
