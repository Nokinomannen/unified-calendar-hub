# Theme toggle + UI zoom

Two small additions to the app shell. Frontend only, no backend.

## 1. Light/dark mode toggle

- Add `src/hooks/use-theme.tsx`: a `ThemeProvider` + `useTheme()` hook that stores choice (`"light" | "dark" | "system"`) in `localStorage["theme"]`, applies/removes `.dark` on `document.documentElement`, and listens to `prefers-color-scheme` when set to `"system"`.
- Wrap the app in `__root.tsx`'s `RootComponent` with `<ThemeProvider>`. Remove the hardcoded `className="dark"` from `<html>` in `RootShell` so the provider is the source of truth (provider sets it on mount; SSR ships without the class — acceptable since this is an authed app).
- Add a theme switcher button in `AppShell` header next to "Sign out": dropdown menu (shadcn `DropdownMenu`) with Sun/Moon/Monitor icons and Light / Dark / System items. Icon swaps based on resolved theme.
- Audit `:root` (light) palette in `src/styles.css` and lift `--primary` to match the dark violet vibe so light mode also looks polished. Add light variants of `--gradient-primary`, `--shadow-elegant`, `--shadow-glow` so components that use those tokens render correctly in light mode.

## 2. UI zoom controls

- Add `src/hooks/use-ui-zoom.tsx`: stores a scale value (0.8 → 1.4, step 0.1) in `localStorage["ui-zoom"]`, default 1. Applies it by setting `document.documentElement.style.fontSize = ${scale * 16}px`. Since the design system uses rem-based Tailwind utilities, this scales the entire UI (text, spacing, sizing) proportionally.
- Add a small zoom control in `AppShell` header: minus button, current % label, plus button, with a reset on label click. Hidden on small screens (md:flex) to save space; mobile users can pinch-zoom.
- Keyboard shortcuts: `Ctrl/Cmd +` / `Ctrl/Cmd -` / `Ctrl/Cmd 0` bound globally inside the provider to step the zoom.

## Files touched

- `src/hooks/use-theme.tsx` — new
- `src/hooks/use-ui-zoom.tsx` — new
- `src/routes/__root.tsx` — wrap providers, drop hardcoded `dark` class
- `src/components/app-shell.tsx` — add theme switcher + zoom controls in header
- `src/styles.css` — refresh light palette + add light-mode gradient/shadow tokens

## Out of scope

- Per-component zoom (only global root font-size scaling)
- Persisting theme/zoom server-side per user
- Accessibility prefs panel (just the two controls in the header)
