# Design system ("Aftershock DS 2")

The public site uses DS 2; the app moves to it in v0.2's app redesign. Everything is defined once in `app/globals.css` and rendered at `/styleguide`.

## Ideas

- **Night shift.** Incidents happen at 3 a.m. Dark is the primary design, and the light theme ("day shift") is built to the same contrast. Both follow the system setting or the toggle, applied before first paint so there is no flash.
- **Status is never colour alone.** Signal blue means proven or safe (✓), quake orange means recur or failing (✕), amber means inconclusive (◐), violet marks AI drafts (✎). Each always comes with its mark and word.
- **One memorable thing per page.** On the home page it is the proof replay, where a seismic trace settles flat when a test is proven. Everything else stays quiet.

## Tokens

| Token | Use |
|---|---|
| `canvas`, `raised`, `raised-2`, `sunken` | Surfaces, from page background to code wells |
| `fg`, `fg-2`, `fg-3` | Text: primary, secondary, tertiary (all AA on their surfaces) |
| `rule`, `rule-strong` | Hairlines and control borders |
| `signal`, `quake`, `amber`, `violet` (+ `-soft`) | Status only |
| `font-display` (Instrument Sans), `font-ui` (Inter), `font-code` (JetBrains Mono) | Type roles |
| `text-d1`, `d2`, `d3`, `lede` | Fluid type scale |
| `rounded-chip` 6, `control` 10, `panel` 16, `stage` 24 | Radii by role |

Components use these Tailwind names (`bg-raised`, `text-fg-2`, `border-rule`, `text-signal`) and never raw hex values.

## Motion

`motion` (pinned) is loaded through `LazyMotion` with DOM animation features only, under `MotionConfig reducedMotion="user"`. With reduced motion, animated pieces show their finished state at once. Content is never hidden before it animates, so screenshots and assistive technology always get the full content.

## Quality gates

`e2e/site.spec.ts` checks every public page in both themes: exactly one `h1`, no serious or critical axe violations (WCAG 2.1 AA), no horizontal scroll at 390px, reduced motion, the theme toggle, security headers, sitemap, robots, RSS and the social image.
