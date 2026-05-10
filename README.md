# My Bracket Picks

My Bracket Picks is a World Cup 2026 tournament predictor built for friends, families, and private groups who want to create and compare full bracket predictions.

Users sign in with Google, join a public or private tournament, rank every group, choose the third-place qualifiers, fill out the knockout bracket, and save their picks for later. Once a tournament locks, brackets become read-only and can be viewed or exported as a printable PDF.

## Features

- Google sign-in through Supabase Auth
- Public and private tournament access
- Multiple brackets per user when a tournament allows it
- Drag-and-drop group-stage rankings
- Third-place qualifier selection
- Full knockout bracket prediction flow
- Autosaved bracket progress
- Read-only mode after tournament lock
- Printable bracket PDF view
- Admin views for tournament management and standings
- Supabase-backed persistence with Postgres and RLS

## Tech Stack

- React 19
- TypeScript
- Vite 8
- Supabase Auth and Postgres
- `@dnd-kit` for drag-and-drop interactions
- ESLint flat config

## Getting Started

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env.local
```

Add your Supabase browser keys:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Start the development server:

```bash
npm run dev
```

The app runs at `http://localhost:5173`.

## Scripts

```bash
npm run dev              # Start the Vite dev server
npm run build            # Type-check and build for production
npm run lint             # Run ESLint
npm run preview          # Preview the production build
npm run seed:tournaments # Seed Supabase tournaments from .env.local
```

## Supabase Setup

The app expects Supabase to provide Auth, Postgres persistence, RPCs, and row-level security policies. SQL migrations live in `supabase/migrations/`.

Local secrets belong in `.env.local`, which is gitignored. Only `VITE_` variables are exposed to the browser. Service-role keys are for local/admin scripts only and should never be imported into `src/`.

To seed tournaments locally, configure:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SEED_ADMIN_USER_IDS=uuid1,uuid2
```

Then run:

```bash
npm run seed:tournaments
```

## Project Structure

```text
src/
  components/   UI for intro, groups, bracket, sharing, admin, and leaderboard views
  context/      App state and auth context providers
  data/         Static team and bracket data
  lib/          Supabase client and persistence helpers
  utils/        Bracket and URL helpers
supabase/
  migrations/   Append-only database migrations
scripts/
  seed-tournaments.mjs
docs/
  Planning and implementation notes
```

## Build Check

Before opening a pull request or shipping a meaningful change, run:

```bash
npm run build
```

This runs `tsc -b` before the production Vite build, which catches type errors that the dev server may not surface.
