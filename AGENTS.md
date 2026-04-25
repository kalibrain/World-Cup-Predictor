# AGENTS.md

Guidance for AI coding agents working in this repo. Applies to Claude Code, Cursor, Codex, and any other agent that respects `AGENTS.md`.

## What this is

World Cup Predictor — a React 19 + TypeScript + Vite single-page app where users fill out group-stage and knockout bracket predictions for a tournament. Predictions are persisted to Supabase (Postgres + Auth) and gated behind Google sign-in.

## Stack

- **Frontend:** React 19, TypeScript, Vite 8
- **State:** React Context (`src/context/AppContext.tsx`, `src/context/AuthContext.tsx`)
- **Drag & drop:** `@dnd-kit/*`
- **Backend:** Supabase (`@supabase/supabase-js`) — auth, persistence, RLS
- **Lint:** ESLint flat config (`eslint.config.js`)

## Layout

```
src/
  components/   UI (Bracket/, Groups/, Intro/, ThirdPlace/, Share/, Header.tsx, FlagIcon.tsx)
  context/      AppContext (predictions), AuthContext (Supabase session)
  lib/          supabase.ts (client), persistence.ts (load/save)
  utils/        thirdPlaceAssignment.ts, urlEncoding.ts
  data/         static team / fixture data
supabase/
  migrations/   timestamped SQL migrations
scripts/
  seed-tournaments.mjs   admin seeding via service-role key
docs/           planning docs (auth-supabase-plan, persistence-layer-plan)
```

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server on `http://localhost:5173` |
| `npm run build` | Type-check (`tsc -b`) then production build |
| `npm run lint` | ESLint over the repo |
| `npm run preview` | Preview the production build |
| `npm run seed:tournaments` | Seed Supabase tournaments (needs `.env.local` with service-role key) |

Always run `npm run build` before declaring a non-trivial change done — `tsc -b` catches type breakage Vite alone won't.

## Environment

Local secrets live in `.env.local` (gitignored). See `.env.example` for keys:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — exposed to the browser; safe.
- `SUPABASE_SERVICE_ROLE_KEY`, `SEED_ADMIN_USER_IDS` — used **only** by `scripts/seed-tournaments.mjs`. Never import these into `src/` and never prefix a secret with `VITE_`.

## Supabase

- Client is a singleton in `src/lib/supabase.ts` — import from there, don't construct new clients.
- Auth is Google OAuth via Supabase, surfaced through `AuthContext`. The app shows the intro/login screen until a session exists.
- Migrations are append-only timestamped SQL in `supabase/migrations/`. Add new ones with a fresh timestamp; don't edit historical migrations.
- **RLS helper functions must be `SECURITY DEFINER`.** Any function called from an RLS policy that itself reads from an RLS-protected table will recurse forever and fail with `stack depth limit exceeded`. The helpers `is_global_admin`, `user_can_access_tournament`, `user_can_manage_tournament` are set up this way; mirror that pattern for new helpers, and pair with `set search_path = public, pg_temp`.
- Joining tournaments goes through the `join_public_tournament` / `join_private_tournament_by_name` RPCs (both `SECURITY DEFINER`). Direct `INSERT` into `tournament_memberships` from the client is intentionally blocked by RLS — don't add a code path that tries it.
- `upsertBracketShell` deliberately omits `current_step` and `furthest_step` from the payload so existing values are preserved on UPDATE and table defaults apply on INSERT. Autosave (`saveBracketSnapshot`) is the source of truth for step progression — don't reintroduce those columns into the shell payload.

## AppContext invariants

`src/context/AppContext.tsx` runs the persisted state machine. Two things to be careful with when editing it:

- **Don't put `selectedTournament` in `refreshTournaments`'s `useCallback` deps.** It already uses a functional `setSelectedTournament` so the dep isn't needed; adding it back creates a refresh loop with the auth `useEffect` (manifests as hundreds of `/rpc/get_user_tournament_contexts` calls per second).
- **Autosave uses dirty-slice tracking via `lastSavedRef` + `computeSnapshotKeys`.** If you add a new persisted field to `AppState`, extend `computeSnapshotKeys` so the diff notices it — otherwise your field will silently never write. Reset `lastSavedRef.current = null` anywhere you reset `bracketId` (sign-out, `clearTournamentSelection`, `resetApp`, `loadTournamentBracket` with no existing data).

## Browser testing

A Firefox DevTools MCP server is configured in `.mcp.json` and starts at `http://localhost:5173`. Agents that support MCP can navigate, click, fill forms, screenshot, and inspect console/network — use it for end-to-end checks of bracket flows, auth, and persistence rather than describing what the UI "should" do. The dev server (`npm run dev`) must be running first.

## House rules

- Prefer editing existing files. Don't add files (especially `*.md`) unless asked.
- Don't add comments that restate the code. Only comment when the *why* is non-obvious.
- Don't introduce abstractions for hypothetical future needs — three similar lines beats a premature helper.
- Don't add error handling for cases that can't happen. Validate at boundaries (user input, Supabase responses), trust internal calls.
- Match existing patterns (Context for shared state, `lib/` for clients, `utils/` for pure helpers) rather than inventing new ones.
