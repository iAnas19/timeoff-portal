---
name: frontend-design
description: Restrained, professional UI design — type scale, spacing rhythm, a near-monochrome palette with one accent, semantic status colors, accessible contrast. Apply when building or restyling UI so it reads as deliberate, not auto-generated.
user-invocable: false
---

# Frontend Design

Goal: a calm, trustworthy interface that looks **deliberately designed**, not template-generated. Restraint over decoration. No gratuitous animation, no gradients, no emoji in product UI.

## The "generated UI" smells to avoid

If the design has these, it reads as AI/boilerplate — remove them:

- One saturated blue (`#2563eb`/`#3b82f6`) used for every button, link, heading, and border.
- Everything center-aligned; no real left-aligned reading rhythm.
- Big uniform `border-radius` (12–16px) on every box + a drop shadow on everything.
- Equal visual weight everywhere — no clear primary action, no hierarchy.
- Gradients, glassmorphism, emoji bullets, or decorative icons with no function.
- Cramped or arbitrary spacing (random px values), text at low contrast on tinted panels.

## Principles

**Hierarchy first.** Decide what the eye hits 1st / 2nd / 3rd on each screen and make size, weight, and color serve that order. One primary action per view; everything else is secondary/tertiary (ghost or text buttons).

**Type scale, not ad-hoc sizes.** Pick a small set and reuse it. Suggested rem scale: `0.75 / 0.8125 / 0.875 / 1 / 1.125 / 1.5 / 2`. Body line-height ~1.5; headings ~1.2. Limit to 2 weights in play at once (e.g. 500 + 700). Use the system font stack — it's honest and fast.

**Spacing rhythm.** Use a 4px base (4/8/12/16/24/32). Consistent gaps inside and between components. Whitespace is the cheapest way to look professional; be generous and even.

**Near-monochrome + one accent.** Build on a neutral ramp (warm or cool gray, pick one and commit). Text is ink, not pure black (`#111`–`#1a1a1a`). Borders are hairline neutrals, not the accent. Reserve the accent for: the primary button, focus rings, and at most one emphasis element (e.g. a key number). If you remove all color and the hierarchy still reads, the layout is sound.

**Semantic color is functional, not decorative.** Green = positive/confirmed, amber = caution/needs-verify, red = error/denied. Use them only in badges, banners, and status text — never as page chrome. Keep them desaturated enough to sit on a neutral page.

**Depth, sparingly.** Prefer a 1px hairline border to a shadow. If you use a shadow, use exactly one soft, low token (e.g. `0 1px 2px rgba(0,0,0,.06)`) and apply it consistently. Modest radius (4–8px), consistent everywhere.

**Numbers and data.** For balances/metrics use `font-variant-numeric: tabular-nums` so figures align and don't jitter on update. Make the key figure the largest text in its card; label it quietly underneath.

**Motion.** Functional only — a spinner, a 100–150ms fade on a state change at most. No looping/decorative animation. Respect `prefers-reduced-motion`.

**Accessibility is part of "decent".** Body text contrast ≥ 4.5:1. Visible focus ring (don't remove outlines without replacing them). Hit targets ≥ ~36px. Status must never be conveyed by color alone — pair it with text/icon.

## Implementation notes

- Centralize tokens as CSS custom properties (`--bg`, `--ink`, `--muted`, `--border`, `--accent`, `--ok`, `--warn`, `--danger`, spacing/radius/shadow). Components read tokens; never hardcode the same hex twice.
- Constrain main content width (~60–72ch / ~44–52rem) for readability; left-align body content.
- A status pill/badge should read at a glance: neutral by default, semantic tint only when the state is meaningful.
