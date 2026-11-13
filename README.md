# The Vespero Experience

An interactive, scroll-driven comic told in hand-engraved line art. Every frame is drawn
to two canvases (flat colour + "shade" data) and a WebGL2 shader turns them into living
hatching lines.

**Interactions:** hold & move to reveal the hidden face · choose a flavour · hold & pour ·
hold to dive. Works with mouse and touch (mobile shows a hold button).

```bash
npm install
npm run dev      # local development
npm run build    # production build in dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`.

_Vespero is a fictional brand created for this project._
