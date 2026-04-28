# Scaffold Guide Reference

How to generate the initial project structure after spec approval. The scaffold must be immediately runnable after USER setup tasks.

---

## Principles

1. **Runs on first try.** After USER fills in .env, `npm run dev` works. No missing dependencies, no broken imports.
2. **Mirrors the architecture.** Directory structure matches what's in the architecture doc. No surprises.
3. **Minimal but complete.** Everything needed to start building features. No placeholder files with TODO comments.
4. **Environment-documented.** Every .env variable has a comment explaining what it is, where to get it, and which phase needs it.

---

## Scaffold Contents

Every scaffold includes:

| Item | Purpose |
|---|---|
| Directory structure | Matches architecture doc |
| `package.json` / `requirements.txt` | All dependencies with pinned versions |
| Config files | ESLint, Prettier, TypeScript, Tailwind, PostCSS |
| `.env.example` | Every variable documented (service, URL to get it, which phase) |
| Initial migration | Tables from the data model |
| Seed script | Realistic dev data (not Lorem ipsum) |
| Test setup | Vitest/Jest config, test utilities, first smoke test |
| CI pipeline | Lint → type check → test → build |
| `.gitignore` | node_modules, .env, .next, dist, coverage |
| `README.md` | Setup instructions (clone → install → env → db → run) |

---

## Stack: Next.js + Supabase (TypeScript)

```
project-name/
├── .github/
│   ├── workflows/ci.yml
│   └── PULL_REQUEST_TEMPLATE.md
├── public/
│   └── favicon.ico
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── page.tsx                # Home/landing
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── signup/page.tsx
│   │   └── (dashboard)/
│   │       ├── layout.tsx          # Dashboard layout + sidebar
│   │       └── page.tsx
│   ├── components/
│   │   ├── ui/                     # Base components (shadcn or custom)
│   │   └── [feature]/              # Feature-specific components
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts           # Browser client
│   │   │   ├── server.ts           # Server client (RSC/API routes)
│   │   │   └── middleware.ts       # Auth middleware
│   │   ├── queries/                # Read operations (one file per entity)
│   │   ├── mutations/              # Write operations (one file per entity)
│   │   └── utils.ts
│   ├── hooks/
│   ├── types/
│   │   └── database.ts             # Auto-generated from Supabase
│   └── test/
│       ├── setup.ts                # Test globals, mocks
│       ├── factories/              # Data factory functions
│       └── utils.ts                # Render helpers, test utilities
├── supabase/
│   ├── migrations/
│   │   └── 20240101000000_initial_schema.sql
│   ├── seed.sql
│   └── config.toml
├── .env.example
├── .eslintrc.json
├── .gitignore
├── .prettierrc
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## Stack: React SPA + Express API

```
project-name/
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   ├── types/
│   │   ├── test/
│   │   │   ├── setup.ts
│   │   │   └── factories/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── server/
│   ├── src/
│   │   ├── routes/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── test/
│   │   │   ├── setup.ts
│   │   │   └── factories/
│   │   └── index.ts
│   ├── package.json
│   └── tsconfig.json
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Stack: Python (FastAPI + React)

```
project-name/
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── endpoints/
│   │   │   └── router.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   └── security.py
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── tests/
│   │   ├── conftest.py             # Fixtures, factories
│   │   └── factories/
│   ├── alembic/versions/
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/                        # Same as React SPA client/
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## .env.example Convention

Every variable gets three things: what it is, where to get it, and which phase needs it.

```bash
# ============================================================
# [App Name] Environment Variables
# Copy to .env and fill in values. Never commit .env.
# ============================================================

# --- Supabase (Phase 1) ---
# Get from: https://supabase.com/dashboard/project/YOUR_PROJECT/settings/api
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# --- Payments (Phase 3) ---
# Get from: https://dashboard.stripe.com/test/apikeys
# STRIPE_PUBLISHABLE_KEY=
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=

# --- Email (Phase 2) ---
# Get from: https://resend.com/api-keys
# RESEND_API_KEY=

# --- App Config ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

Commented-out variables = not needed until that phase. Uncomment when ready.

---

## Testing Infrastructure

### Test Setup (vitest.config.ts)
```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

### Data Factories
Generate realistic test data without hardcoding:

```typescript
// src/test/factories/user.ts
let counter = 0;
export function buildUser(overrides = {}) {
  counter++;
  return {
    id: `user-${counter}`,
    email: `user${counter}@test.com`,
    display_name: `Test User ${counter}`,
    role: 'analyst',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}
```

Use factories in tests: `const user = buildUser({ role: 'admin' })`.

### Mock Supabase Client
```typescript
// src/test/mocks/supabase.ts
export const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
  })),
  auth: {
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
  },
};
```

---

## Seed Data

Seed scripts populate the database with realistic development data. Not Lorem ipsum — use plausible names, dates, and quantities.

```sql
-- supabase/seed.sql
-- Dev seed data. Run with: npx supabase db reset

INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'alice@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'bob@example.com');

INSERT INTO profiles (id, display_name, role) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Alice Chen', 'manager'),
  ('22222222-2222-2222-2222-222222222222', 'Bob Park', 'analyst');

-- Add 5-10 records for the primary entity so the app doesn't feel empty
INSERT INTO items (title, status, owner_id, created_at) VALUES
  ('Update CRM field mappings', 'in_progress', '22222222-2222-2222-2222-222222222222', now() - interval '3 days'),
  ('Add new lead source dropdown', 'submitted', '22222222-2222-2222-2222-222222222222', now() - interval '1 day');
```

---

## Development Workflow

### Git Branching
```
main              ← production-ready, deploy on merge
└── feature/T1.3-create-users-table   ← branch per task or small group of tasks
└── feature/T1.4-auth-flow
```

Branch naming: `feature/T[phase].[step]-short-description`

### Commit Convention
```
feat(T1.3): create users table migration
fix(T1.4): handle expired session redirect
chore: update dependencies
```

Prefix with task ID when applicable. Keep commits atomic — one concern per commit.

### PR Template
```markdown
## What
[One sentence: what this PR does]

## Task Reference
[T1.3, T1.4 — link to roadmap]

## How to Test
1. [Step-by-step verification]

## Screenshots
[If UI changes]
```

---

## Local Development

### Docker Compose (when needed)
Use when the stack includes services beyond what the BaaS provides (Redis, custom Postgres, etc.):

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: app_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'

volumes:
  pgdata:
```

For Supabase projects: use `npx supabase start` instead of Docker Compose. It runs Postgres, Auth, Storage, and Edge Functions locally.

### Available Scripts
Every scaffold includes these npm scripts:

| Script | Command | Purpose |
|---|---|---|
| `dev` | `next dev` | Start dev server with hot reload |
| `build` | `next build` | Production build |
| `start` | `next start` | Run production build |
| `lint` | `eslint . --ext .ts,.tsx` | Lint check |
| `format` | `prettier --write .` | Auto-format |
| `test` | `vitest` | Run tests (watch mode) |
| `test:ci` | `vitest run` | Run tests once (CI) |
| `db:migrate` | `supabase db push` | Apply migrations |
| `db:reset` | `supabase db reset` | Reset + re-seed |
| `db:types` | `supabase gen types typescript` | Regenerate TypeScript types |

---

## Post-Scaffold Smoke Test

After generating the scaffold, verify before handing to the user:

- [ ] `npm install` completes without errors
- [ ] `npm run dev` starts without errors
- [ ] `npm run build` succeeds
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (even if only 1 smoke test)
- [ ] TypeScript compiles with no errors
- [ ] `.env.example` has every variable the code references
- [ ] `.gitignore` covers: node_modules, .env, .next, dist, coverage, .DS_Store
- [ ] README setup instructions are complete and accurate

---

## What NOT to Scaffold

- Placeholder files with TODO comments — write real code or don't create the file
- Components not needed in Phase 1
- Test files without actual tests
- Complex config for features not yet built
- Multiple environment configs — start with dev + prod, add staging when needed
