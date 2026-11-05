# Notes for Claude

Static GitHub Pages site (no build step). Design brief and decisions: `docs/BRIEF.md`.

- `index.html`: markup. Sections in order: pinned scroll scene (#about: intro, student, baseball, golf), #experience timeline, #projects grid, #skills (résumé skills in three plain columns, a logo and a name per line; logos from Simple Icons, CC0; drawn line icons for SQL, LightGBM, NLTK, Power BI and Excel, which have no free logo), #contact.
- `site.js`: scene engine (scroll progress lerped; `measureCard` places the baseball card, which turns over once on the student beat and stays on its back; the back's text fades and the photo window grows out of the card's outline at the merge into a rounded frame, `END` in site.js, so the dark page stays around the baseball and golf photos; on desktop the golf plate is sized to that frame so the whole green and the ball show), suit-to-uniform merge, timeline reveal and details toggles, GitHub repo loader, and the signature "pitch" (clicking a project throws a baseball at the card, then opens it).
- `mascots.js`: the two scene mascots, built in JS and appended to the stage. The ball sits on the card, pushes it over, points at the student line and is pitched into the baseball photo, all scrubbed by scroll; the bat walks in and the hit plays once on a clock (WAAPI), then both leave. Scrolling back above the card merge resets them. Reduced motion: still poses that fade.
- `site.css`: tokens on `:root` (dark, Clarion gold accent). Phone layout under `max-width: 760px`.
- `projects.js`: user-editable config (`githubUser`, `featured`, `hide`, `projects`).

Rules kept so far: no em dashes in visible copy, no invented stats, only numbers from Shawn's résumé. The field photo must stay painted (opacity ≥ 0.02) behind the headshot; hiding it breaks iOS. Verify desktop (1440x900), phone (390x844) and reduced-motion after scroll changes.
