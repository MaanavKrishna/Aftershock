# Contributing

Thanks for helping. Aftershock is small on purpose; changes that keep it that way are the easiest to accept.

## Getting started

```bash
npm install
cp .env.example .env.local   # set AUTH_SECRET to 32+ random characters
AFTERSHOCK_DEMO=1 npm run dev
```

Docker (Docker Desktop or Colima) is needed for the runner tests and for real time travel locally.

## Before you open a pull request

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```

- Write the failing test first, then the fix. Bugs need a regression test.
- Keep decision logic in `lib/domain/` pure and unit-tested; put I/O at the edges.
- Every query goes through `scoped(workspaceId)`.
- After changing `lib/db/schema.ts`, run `npm run db:generate` and commit the migration.

## Rules that never bend

A model never marks anything proven or safe. A test that passes before its fix is rejected. Mixed results are never green. Nothing is pushed to a default branch. Sandboxed runs get no secrets. Pull requests that weaken these will not be merged.

By contributing you agree that your contributions are licensed under the [Apache License 2.0](LICENSE).
