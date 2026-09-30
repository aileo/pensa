# Design system

Every colour in the interface comes from a named token declared once, in the
`@theme` block of `apps/web/src/index.css`. Components never hard-code a hex
value — they use `bg-brand-600`, `text-ink-500`, `border-line` and so on, which
means changing the look of the app is a change to one file.

## Tokens

| Family | Role | Hue |
| --- | --- | --- |
| `brand` | primary colour: buttons, links, selection, active states | rosewood |
| `clay` | secondary accent: urgency, admin badges, off-list gifts | terracotta |
| `sage` | completed steps and finished progress | sage green |
| `ink` | body text and neutral icons | warm grey |

Plus `surface` and `surface-soft` for backgrounds, and three separator tokens:
`line` and `line-soft` are decorative, while `line-strong` is used for borders
that identify a control, such as input fields.

## Contrast is measured, not judged

A soft palette is exactly the kind where legibility is lost without anyone
noticing, so every token pair the interface actually uses is measured against
WCAG 2.1 AA before being adopted:

| Usage | Minimum ratio | Measured |
| --- | --- | --- |
| Body text on the app background (`ink-900` / `surface`) | 4.5:1 | 13.8:1 |
| Secondary text (`ink-500` / white) | 4.5:1 | 5.7:1 |
| Primary button (white / `brand-600`) | 4.5:1 | 6.3:1 |
| Link or accent on white (`brand-600`) | 4.5:1 | 6.3:1 |
| Chip (`brand-700` / `brand-50`) | 4.5:1 | 8.2:1 |
| Urgency badge (`clay-700` / `clay-100`) | 4.5:1 | 7.1:1 |
| Completed step (white / `sage-600`) | 4.5:1 | 6.8:1 |
| Input border at rest (`line-strong` / white) | 3:1 | 3.4:1 |
| Focus ring (`brand-500` / white) | 3:1 | 4.5:1 |
| Focus ring over a tinted pill (`brand-500` / `brand-100`) | 3:1 | 3.7:1 |
| Upcoming step outline (`brand-400` / white) | 3:1 | 3.3:1 |

**Re-measure after any change of hue.** If you audit contrast from inside the
page, beware of one trap: reading a computed colour through a 1×1 canvas
without clearing it first returns the *previous* pixel for transparent values,
so background equals foreground and every ratio comes out at a perfect 1.00.
Clear the canvas before each read. And parse colours through the canvas rather
than with a regular expression — Tailwind v4 emits `oklab(...)`, not hex.

## Two rules that must keep holding

- **Colour never carries information on its own** (WCAG 1.4.1). The
  reserved/bought/wrapped/given tracker keeps its step numbers and its check
  mark, the urgency badge keeps the word *Bientôt*, and off-list gift cards keep
  their label. Check by squinting, or in greyscale.
- **The focus indicator stays visible everywhere.** The global `:focus-visible`
  rule draws a `brand-500` outline plus a white halo, so focus remains legible
  on white backgrounds and on tinted pills alike. Do not add
  `focus:outline-none` to a component without providing an equally visible
  replacement.

## Icons

Icons come from a small in-house set — the `paths` record in `App.tsx` — drawn
as strokes on a 24×24 grid, with no external dependency. They are rendered with
`aria-hidden`, because they always accompany a text label.
