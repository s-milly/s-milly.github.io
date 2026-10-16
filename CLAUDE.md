# Notes for Claude

Static GitHub Pages site (no build step). Design brief and decisions: `docs/BRIEF.md`.

- `index.html`: markup. Sections in order: pinned scroll scene (#about: intro, student, baseball, golf), #experience timeline, #projects grid, #contact.
- `site.js`: scene engine (scroll progress lerped, window clip-path keyframes in `FRAMES`), suit-to-uniform merge, timeline reveal and details toggles, GitHub repo loader, and the signature "pitch" (clicking a project throws a baseball at the card, then opens it).
- `site.css`: tokens on `:root` (dark, Clarion gold accent). Phone layout under `max-width: 760px`.
- `projects.js`: user-editable config (`githubUser`, `featured`, `hide`, `projects`).

Rules kept so far: no em dashes in visible copy, no invented stats, only numbers from Shawn's résumé. The field photo must stay painted (opacity ≥ 0.02) behind the headshot; hiding it breaks iOS. Verify desktop (1440x900), phone (390x844) and reduced-motion after scroll changes.
