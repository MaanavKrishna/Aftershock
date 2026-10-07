# Aftershock

Aftershock turns a production incident into a regression test that git history proves — it must fail on the commit before the fix and pass on the fix — then guards every pull request against that incident coming back.

- Spec: `docs/superpowers/specs/2026-10-07-aftershock-design.md`
- Plan: `docs/superpowers/plans/2026-10-08-aftershock.md`
- Design: `design/*.dc.html` (source canvas: https://claude.ai/artifact/1ADmvkEsJfPzyNXvGeeBAJ)

## Run locally (no accounts needed)

```bash
npm install
AFTERSHOCK_DEMO=1 npm run dev
```

Open http://127.0.0.1:3000 and choose “Try the demo workspace” on the sign-in page.

The previous RecurGate implementation lives in `legacy/` for reference and is not built.
