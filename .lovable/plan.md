## Goal

Apply the **Muted Editorial** direction across the whole app as a pure visual refresh. No layout, structure, component, or business-logic changes — only design tokens and a few presentational class swaps where saturated colors are currently hard-coded.

## Palette (tokens in `src/styles.css`)

**Light (warm paper):**
- `--background` warm off-white (≈ #F5F2ED) — replaces pure white
- `--foreground` deep ink (≈ #1A1614)
- `--card` slightly lighter warm white (≈ #FBF9F5)
- `--muted` / `--secondary` warm linen (≈ #EBE7E0)
- `--muted-foreground` warm taupe (≈ #7D6F69)
- `--border` low-contrast warm stone
- `--primary` muted terracotta (≈ #A35D43) — replaces saturated violet
- `--accent` soft sand
- `--destructive` dusty rose (desaturated)
- `--ring` terracotta tinted

**Dark (deep ink, same warm hue family):**
- `--background` deep warm charcoal (≈ #1A1715)
- `--card` slightly lifted warm charcoal
- `--foreground` warm cream
- `--primary` softer terracotta that reads on dark
- `--border` low-opacity warm light
- Everything kept in the same warm hue family for harmony

**Status accents (added as new tokens so we stop using neon Tailwind classes inline):**
- `--success` (used for "Free") — desaturated sage (≈ oklch warm green, low chroma)
- `--success-foreground`
- `--conflict` — dusty rose (matches destructive but slightly muted)
- Register both in `@theme inline` so `bg-success` / `text-success` etc. work.

All values authored in `oklch` per house rules.

## Files touched

1. **`src/styles.css`** — rewrite `:root` and `.dark` color tokens with the palette above; add `--success` / `--conflict` tokens + register in `@theme inline`; soften `--shadow-elegant` / `--shadow-glow` (lower opacity, no purple); update `--gradient-primary` / `--gradient-surface` to warm tones; bump `--radius` slightly down (e.g. 0.5rem) for a crisper editorial feel.

2. **Replace hard-coded saturated colors** with semantic tokens. Quick grep targets:
   - `text-emerald-*`, `text-green-*`, `bg-emerald-*` for "Free" pills → `text-success` / `bg-success/10`
   - `text-red-*`, `bg-red-*`, `text-rose-*` for "conflict" → `text-conflict` / `bg-conflict/10`
   - `text-purple-*`, `bg-purple-*`, `from-purple-*`, `to-pink-*`, `via-violet-*` (FABs, sparkle button, work-hours icon, "today" highlight) → `bg-primary`, `text-primary`, or remove gradient and use flat `bg-primary`
   - Any `bg-white` used as a surface → `bg-card` or `bg-background`
   - Any neon glow `shadow-purple-*/shadow-pink-*` → `shadow-elegant` token or remove

3. **FAB softening** (presentational class tweaks only, no behavior): in the floating "+" and sparkle buttons, replace gradient + glow with flat `bg-primary text-primary-foreground` + soft `shadow-sm`, reduce size by ~10% if currently oversized.

4. **Calendar grid presentation** (class tweaks only):
   - Cell borders: `border-border/40` instead of strong borders
   - Out-of-month days: `text-muted-foreground/40` (already similar — just verify token usage)
   - Today highlight: solid `bg-primary text-primary-foreground` rounded chip on the date number (no purple glow)
   - "Free" label: `text-success` small caps tracking-wide

5. **Typography touch-ups** (optional, lightweight): keep system fonts. Add `tracking-tight` to the big "May 2026" header and `uppercase tracking-widest text-[10px]` to section eyebrows ("CALENDAR", weekday headers) — most of this is already in place; just normalize.

## Out of scope

- No changes to routes, hooks, queries, Supabase, event logic, work-logs logic, or component structure.
- No new fonts, no serif swap (keep current font stack — chose this to stay minimal-risk; can add Instrument Serif later in a follow-up if you want).
- No FAB repositioning or icon changes.

## Verification

- Open `/` in both light and dark mode, screenshot, confirm: no pure white surface, no neon violet/green/red, calendar grid reads clearly, "Free" pills are sage not neon, FABs are subtle terracotta, today's date is a clean chip.
- Quick scan with `rg` to confirm no remaining `text-purple-`, `text-emerald-`, `bg-violet-`, `from-pink-` etc. in components.
