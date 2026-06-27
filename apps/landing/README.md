# DeskMate AI — Landing

Standalone marketing landing page for **DeskMate AI**. Completely self-contained:
its own Vue 3 + Vite + Tailwind v4 app with no dependency on the Electron desktop
app. All images are bundled locally under `src/assets/` (no remote hotlinks).

## Develop

```bash
cd apps/landing
npm install      # or run from the monorepo root; deps hoist to the workspace
npm run dev      # http://localhost:5200
```

## Build

```bash
npm run build    # type-checks then emits a static site to dist/
npm run preview  # serve the production build
```

## Structure

- `src/App.vue` — the whole page: Hero, Modules carousel, Benefits
- `src/components/` — `AnimatedHeading`, `AnimatedText`, `MaskedImage` (scroll
  reveals), `LandingHeader`, `LandingLogo`, `ModulesCarousel`
- `src/composables/useReveal.ts` — scroll-into-view reveal (zoom-safe; uses
  `getBoundingClientRect` rather than IntersectionObserver because the page
  applies a responsive CSS `zoom`)
- `src/lib/landing-assets.ts` — local asset imports
- `src/styles.css` — Tailwind v4 entry + design tokens (oklch)

The document is uniformly downscaled below a 1728px reference width via a CSS
`zoom` set in `App.vue`; all pixel values in the markup are authored at 1728px.

> The doctor portraits in the modules carousel are placeholders — swap them for
> DeskMate module artwork in `src/assets/` + `src/lib/landing-assets.ts`.
