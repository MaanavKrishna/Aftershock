# Fault Line, the Aftershock design system

Quiet surfaces, one instrument. Aftershock's interface follows Apple's restraint (type hierarchy, materials, springs) and borrows a few Aceternity-style effects for the marketing pages only. Every value lives in [`app/globals.css`](../app/globals.css); every primitive lives in [`components/ui`](../components/ui). The live reference is [`/styleguide`](https://aftershock-mk.vercel.app/styleguide).

## Principles

1. **Colour means something.** Proven, recur, safe, inconclusive and flaky are verdict colours, and nothing else uses them. Signal blue marks what you can act on: links, focus, the main call to action. Everything else is neutral.
2. **Never colour alone.** Every verdict has an icon, a word and a tint (`Verdict`).
3. **Motion confirms, never decorates** in the app. Effects are allowed on marketing pages, at three moments: an incident hits, a test is proven, a pull request is guarded.
4. **One measure, one rhythm.** A 4px spacing grid, three surface levels, hairline borders.
5. **Both themes are first class.** Dark is the hero; light is fully supported and follows the system unless the toggle sets it.

## Colour

| Token | Light | Dark | Use |
|---|---|---|---|
| `canvas` | #FAFAFB | #08090C | Page background |
| `s1` / `s2` / `s3` | #FFFFFF / #F3F4F6 / #EAECF0 | #0F1115 / #16191F / #1E222A | Cards, then wells and hovers, then pressed |
| `sunken` | #F3F4F6 | #050608 | Code and logs |
| `border` / `border-soft` / `border-strong` | ink at 8% / 5% / 16% | white at 8% / 5% / 14% | Hairlines |
| `field` | ink at 32% | white at 26% | Input borders (3:1 against the surface) |
| `fg` / `fg-2` / `fg-3` | #0B0D12 / #4A5263 / #626B7A | #EDEFF3 / #A9B0BC / #828A98 | Primary, secondary, tertiary text |
| `signal` | #0A5CBF | #5EB1FF | Interactive accent; text on it is `on-signal` |
| `proven` | #126A40 | #3DD68C | Proven, healthy |
| `recur` | #A8380A | #FF7A45 | Recur, failing, destructive |
| `safe` | #0B6680 | #4FC3D9 | Safe pull request |
| `inconclusive` | #875004 | #F0B44C | Inconclusive, weak, awaiting fix |
| `flaky` | #7341D6 | #B49CFF | Flaky, drifted, AI draft |

Each verdict colour has a `-soft` tint (10–13%). Every text pair, including verdict text on its own tint, meets WCAG AA (4.5:1) on `canvas`, `s1`, `s2` and `s3` in both themes.

Use only these names: raw hex, arbitrary colours (`text-[#…]`), pixel font sizes (`text-[13px]`) and one-off radii (`rounded-[…]`) are not used in `app/` or `components/` (the OG image and the README badge, which can't read CSS variables, are the exceptions).

## Type

Geist Sans for everything, Geist Mono for code, commit SHAs and test names. Weights 400, 500 and 600 only. Nothing below 12px. Tables use tabular figures.

| Utility | Size / line | Tracking | Use |
|---|---|---|---|
| `text-display-1` | 48→80 / 1.0 | −0.035em | Home hero |
| `text-display-2` | 40→56 / 1.05 | −0.03em | Section titles on marketing pages |
| `text-title-1` | 28 / 34 | −0.02em | Page titles in the app |
| `text-title-2` | 22 / 28 | −0.015em | Section titles |
| `text-title-3` | 18 / 24 | −0.01em | Card and dialog titles |
| `text-lede` | 18 / 28 | | Introductions |
| `text-body` | 15 / 22 | | Marketing text |
| `text-ui` | 14 / 20 | | App text (the default) |
| `text-callout` | 13 / 18 | | Labels, secondary text |
| `text-caption` | 12 / 16 | +0.01em | Metadata, hints |

## Space, radius, elevation

- **Spacing:** 4, 8, 12, 16, 20, 24, 32, 40, 56, 80, 120. Marketing sections are 120 apart (80 on phones).
- **Radius:** `chip` 6, `control` 10, `card` 14, `stage` 20 (marketing stages, dialogs), full for pills. A nested corner is the outer radius minus the padding.
- **Elevation:** `shadow-e1` for cards (a top highlight in dark, a 1px shadow in light); `shadow-e2` for popovers, menus and dialogs.
- **Material:** `glass` (canvas at 72%, 20px blur, 1.6 saturation) for the site header, app sidebar, command palette and dialogs. It turns solid when transparency is reduced or forced colours are on. Never glass on glass, never on content cards.
- **Layout:** marketing pages are 12 columns at 1200px max; the app has a 240px sidebar (an icon rail below 1024px) and content up to 1280px. Breakpoints 390, 768, 1024, 1440.

## Motion

From [`lib/motion.ts`](../lib/motion.ts), using `motion` under `MotionRoot` (reduced motion is respected everywhere).

| Preset | Spring | Use |
|---|---|---|
| `SNAPPY` | 500 / 38 | Toggles, pills, tabs |
| `SMOOTH` | 260 / 30 | Panels, sheets, rows expanding |
| `GENTLE` | 140 / 22 | Marketing reveals |

Timed transitions use `ease-fl` (cubic-bezier(.22, 1, .36, 1)): 120ms hover, 200ms UI changes, 320ms entrances, exits about 70% of that. Animate transform and opacity only. Under reduced motion, springs become short fades and effects show their final frame.

**Marketing effects (allowed):** the seismic hero (a trace drawn once under a spotlight), the bento grid with one card glow, a moving border on the single primary call to action, a dot grid that fades to the edges, one text reveal in the hero.
**Banned everywhere:** meteors, vortex, sparkles, aurora, 3D cards, globes, WebGL, cursor followers, parallax heroes, looping motion in the app.

## Components

| Component | File | Notes |
|---|---|---|
| `Button`, `ButtonLink`, `IconButton` | `Button.tsx` | `primary`, `accent`, `secondary`, `quiet`, `danger`, `dangerOutline`; sizes `sm` 32, `md` 40, `lg` 48 |
| `Card`, `CardHead`, `CardBody`, `Stat` | `Card.tsx` | `s1` with hairline and `e1` |
| `Verdict` | `Verdict.tsx` | Every status. `StatusPill` and `VerdictPill` in `Pill.tsx` map domain states to it |
| `Pill`, `Badge` | `Pill.tsx`, `Feedback.tsx` | Neutral labels and counts |
| `TextField`, `TextArea`, `SelectField`, `FormMessage` | `Field.tsx` | Errors set `aria-invalid` and are linked with `aria-describedby` |
| `Tabs`, `Segmented` | `Tabs.tsx` | Tabs are links with `aria-current`; segmented is radio inputs |
| `Table`, `THead`, `Th`, `Tr`, `Td` | `Table.tsx` | 40px rows, sticky header, `aria-sort` |
| `Dialog` | `Dialog.tsx` | Native `<dialog>`; `side` makes a sheet |
| `Skeleton`, `EmptyState`, `Kbd`, `Tooltip`, `PageHeader` | `Feedback.tsx` | |
| `CodeBlock`, `CopyText`, `ThemeToggle`, `LogoMark`, `Wordmark` | | |
| Icons | `icons.tsx` | Inline SVG, 24 grid, 1.75 stroke, `currentColor` |

## Accessibility

- Focus: a 2px signal outline, 2px offset, on everything focusable.
- Targets: 24px minimum, 40px for buttons, 44px for touch-first controls.
- Every page is checked with axe in light and dark (`e2e/site.spec.ts`, `e2e/shell.spec.ts`).
- Forced colours: verdicts gain a border; glass becomes solid.
- The strict nonce CSP on signed-in pages allows no inline scripts except the theme script (by hash), so effects are CSS and SVG, and `motion` sets styles from script.
