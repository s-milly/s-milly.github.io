(() => {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const phone = matchMedia("(max-width: 760px)");
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const seg = (p, a, b) => smooth(clamp((p - a) / (b - a)));

  /* ---------------- the continuous scene ---------------- */
  const scene = document.querySelector(".scene");
  const win = scene.querySelector(".window");
  const field = scene.querySelector(".plate--field");
  const suit = scene.querySelector(".plate--suit");
  const golf = scene.querySelector(".plate--golf");
  const scrim = scene.querySelector(".scrim");
  const golfScrim = scene.querySelector(".scrim--golf");
  const card = scene.querySelector(".tcard");
  const cardInner = card.querySelector(".tcard__inner");
  const cardBack = card.querySelector(".tcard__back");
  const cardImg = card.querySelector(".tcard__photo img");
  const [wmMiller, wmStudent] = scene.querySelectorAll(".wm__word");
  const introPanel = scene.querySelector(".panel--intro");
  const studentPanel = scene.querySelector(".panel--student");
  const mascots = window.SceneMascots ? SceneMascots.create(scene.querySelector(".stage"), reduce) : null;
  const panels = [...scene.querySelectorAll("[data-panel]")].map(el => ({
    el, k: el.dataset.panel.split(",").map(Number)
  }));

  /* The card is placed from the stage size. Its photo area is where the photo window
     sits until the merge: [top, right, bottom, left] insets in % of the stage, a corner
     radius in px, and the field's offset (% of stage) so Shawn's face lines up when
     the baseball photo takes over. Card proportions match the cqw sizes in site.css. */
  const CARD = { ratio: 0.69, pad: 0.034, photo: 1.132, radius: 0.017 };
  let REG = { box: [10, 10, 10, 60], r: 9, tx: 0, ty: 0 };
  function measureCard() {
    const W = stageW, H = stageH;
    let w, h, x, y;
    if (phone.matches) {
      const top = Math.max(60, H * 0.075);
      const floor = Math.min(introPanel.offsetTop, studentPanel.offsetTop) - 22;
      h = Math.min(floor - top, (W * 0.74) / CARD.ratio);
      w = h * CARD.ratio;
      x = (W - w) / 2; y = top + Math.max(0, (floor - top - h) / 2);
    } else {
      const gutter = clamp(W * 0.06, 16, 96);
      h = Math.min(H * 0.84, (W * 0.38) / CARD.ratio);
      w = h * CARD.ratio;
      x = (W * 0.52 + W - gutter) / 2 - w / 2;
      y = Math.min(Math.max(76, (H - h) / 2 + 20), H - 16 - h);
    }
    w = Math.round(w); h = Math.round(h); x = Math.round(x); y = Math.round(y);
    Object.assign(card.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" });
    const pad = w * CARD.pad, pw = w - 2 * pad, ph = w * CARD.photo;
    const L = (x + pad) / W * 100, T = (y + pad) / H * 100;
    const R = 100 - L - pw / W * 100, B = 100 - T - ph / H * 100;
    const hPct = ph / H * 100, cx = L + pw / W * 50;
    REG = {
      box: [T, R, B, L], r: Math.round(w * CARD.radius),
      tx: phone.matches ? cx - 52 : cx - 57,
      ty: phone.matches ? T + 0.44 * hPct - 16 : T + 0.325 * hPct - 18
    };
    // The card's own photo copies the crop of the headshot plate (1% overscan on each side),
    // so swapping between them never shifts the picture.
    Object.assign(cardImg.style, {
      left: -W * 0.01 + "px", top: -H * 0.01 + "px",
      width: pw + W * 0.02 + "px", height: ph + H * 0.02 + "px"
    });
    if (mascots) mascots.measure({ card: { x, y, w, h }, W, H, phone: phone.matches, studentPanel });
  }

  function frameAt(p) {
    const t = seg(p, 0.42, 0.56);
    return {
      box: REG.box.map(v => lerp(v, 0, t)),
      r: lerp(REG.r, 0, t), tx: lerp(REG.tx, 0, t), ty: lerp(REG.ty, 0, t)
    };
  }

  function render(p) {
    const f = frameAt(p);
    let [t, r, b, l] = f.box;

    // The card turns over for the student beat and keeps turning the same way back to
    // the front before the merge. Under reduced motion the back fades in instead.
    const flipTo = seg(p, 0.16, 0.27), flipBack = seg(p, 0.35, 0.41);
    const ang = 180 * (flipTo + flipBack);
    const facing = Math.abs(Math.cos(ang * Math.PI / 180));
    if (reduce.matches) {
      cardInner.style.transform = "none";
      cardBack.style.opacity = flipTo - flipBack;
    } else {
      cardInner.style.transform = `rotateY(${ang}deg) scale(${1 + 0.04 * Math.sin(Math.PI * (flipTo + flipBack))})`;
      cardBack.style.opacity = "";
      // The photo window sits under the card. While it turns, shrink the window to stay
      // inside the card's outline so the flat photo never peeks out at the edges.
      if (facing < 1) {
        const sx = 0.8 * facing, sy = 0.75 + 0.25 * facing;
        const cw = 100 - l - r, ch = 100 - t - b;
        l += cw * (1 - sx) / 2; r += cw * (1 - sx) / 2;
        t += ch * (1 - sy) / 2; b += ch * (1 - sy) / 2;
      }
    }
    if (mascots) mascots.render(p, ang, 1 + 0.04 * Math.sin(Math.PI * (flipTo + flipBack)));
    const gone = seg(p, 0.42, 0.44);
    card.style.opacity = 1 - gone;
    card.style.visibility = gone >= 1 ? "hidden" : "visible";
    wmMiller.style.opacity = 1 - seg(p, 0.12, 0.18);
    wmStudent.style.opacity = seg(p, 0.2, 0.27) * (1 - seg(p, 0.35, 0.41));

    // Whole pixels: a fractional clip edge anti-aliases differently per GPU tile and shows as a 1px step.
    const px = (v, s) => Math.round(v * s / 100);
    win.style.clipPath = `inset(${px(t, stageH)}px ${px(r, stageW)}px ${px(b, stageH)}px ${px(l, stageW)}px round ${f.r}px)`;
    const bleed = seg(p, 0.42, 0.56);
    // Suit to uniform: the headshot holds the card's photo area, swells and fades,
    // while the field zooms out from Shawn's face.
    const fade = seg(p, 0.43, 0.53);
    const sb = REG.box;
    // Overscan by 1% so rounding never leaves a seam; the window clip trims it.
    suit.style.left = (sb[3] - 1) + "%"; suit.style.top = (sb[0] - 1) + "%";
    suit.style.width = (102 - sb[1] - sb[3]) + "%"; suit.style.height = (102 - sb[0] - sb[2]) + "%";
    // Faint, not hidden, while the card is edge-on, so it repaints cleanly on iOS.
    suit.style.opacity = (1 - fade) * (reduce.matches ? 1 : Math.max(0.02, clamp(facing * 3)));
    suit.style.visibility = fade >= 1 ? "hidden" : "visible";
    suit.style.transform = reduce.matches ? "none" : `translateY(${-9 * seg(p, 0.42, 0.53)}%) scale(${lerp(1, 1.18, seg(p, 0.42, 0.53))})`;
    const zoom = reduce.matches ? 1 : lerp(1.45, 1, seg(p, 0.42, 0.6));
    const push = reduce.matches ? 1 : lerp(1, 1.06, seg(p, 0.6, 0.84));
    field.style.transform = `translate3d(${f.tx}%, ${f.ty}%, 0) scale(${zoom * push})`;
    // Kept faint (not hidden) behind the headshot: edge anti-aliasing would otherwise
    // leak a sliver of it, and fully hidden layers repaint in pieces on iOS.
    field.style.opacity = lerp(0.02, 1, seg(p, 0.41, 0.45));
    const g = seg(p, 0.76, 0.88);
    golf.style.clipPath = `inset(${(1 - g) * 100}% 0 0 0)`;
    scrim.style.opacity = bleed * (1 - g);
    golfScrim.style.opacity = g;

    for (const pn of panels) {
      const [a0, a1, o0, o1] = pn.k;
      const vin = a1 === 0 ? 1 : seg(p, a0, a1);
      const vout = seg(p, o0, o1);
      const o = vin * (1 - vout);
      const y = (1 - vin) * 28 - vout * 28;
      pn.el.style.opacity = o;
      pn.el.style.visibility = o < 0.01 ? "hidden" : "visible";
      pn.el.style.translate = `0 ${reduce.matches ? 0 : y}px`;
    }
  }

  let target = 0, current = 0, last = -1, prev = 0;
  // Scene geometry, measured on load and resize rather than every frame.
  let sceneTop = 0, total = 1, stageW = 1, stageH = 1;
  function measureScene() {
    stageW = win.clientWidth; stageH = win.clientHeight;
    sceneTop = scene.getBoundingClientRect().top + scrollY;
    // The last --hold vh of the scene keeps progress at 1, holding the golf beat in place.
    const hold = (parseFloat(getComputedStyle(scene).getPropertyValue("--hold")) || 0) * innerHeight / 100;
    total = Math.max(1, scene.offsetHeight - innerHeight - hold);
  }
  // The card and student beats (progress 0 to INTRO) get SLOW times as much scroll per unit
  // as the rest, so the mascots' opening moves are easy to follow. site.css makes the scene
  // taller by the same amount, so the baseball and golf beats keep their pace.
  const INTRO = 0.44, SLOW = 1.6;
  const SPLIT = INTRO * SLOW / (INTRO * SLOW + 1 - INTRO);   // scroll fraction where the intro ends
  const remap = u => u < SPLIT ? INTRO * u / SPLIT : INTRO + (u - SPLIT) / (1 - SPLIT) * (1 - INTRO);
  function readScroll() { target = remap(clamp((scrollY - sceneTop) / total)); }
  function tick(time) {
    readScroll();
    // Catch-up rate is set per 60Hz frame and scaled by elapsed time, so the scene
    // feels the same on 60Hz and 120Hz screens.
    const dt = prev ? Math.min(time - prev, 100) : 16.67;
    prev = time;
    const k60 = phone.matches ? 0.18 : 0.11;
    const k = reduce.matches ? 1 : 1 - Math.pow(1 - k60, dt / 16.67);
    current += (target - current) * k;
    if (Math.abs(target - current) < 0.0004) current = target;
    if (current !== last) { render(current); last = current; }
    requestAnimationFrame(tick);
  }

  /* Golf framing: fit the window so Shawn's cap clears the menu and the white
     ball rolling toward the cup stays above the bottom edge, whatever the
     window shape. Positions are fractions of the desktop golf image height. */
  const golfImg = golf.querySelector("img");
  const GOLF = { cap: 555 / 1300, ball: 1045 / 1300 };
  function frameGolf() {
    if (phone.matches || !golfImg.naturalWidth) { golfImg.style.objectPosition = ""; return; }
    const W = golf.clientWidth, H = golf.clientHeight;
    const scale = Math.max(W / golfImg.naturalWidth, H / golfImg.naturalHeight);
    const I = golfImg.naturalHeight * scale;
    if (I <= H) return;
    const top = 70, bottom = H - 36;                       // clear of the menu, clear of the edge
    const mid = (GOLF.cap + GOLF.ball) / 2 * I;
    const off = clamp(mid - (top + bottom) / 2, 0, I - H);
    golfImg.style.objectPosition = `50% ${(off / (I - H)) * 100}%`;
  }
  golfImg.addEventListener("load", frameGolf);
  addEventListener("resize", frameGolf);
  phone.addEventListener("change", frameGolf);
  if (golfImg.complete) frameGolf();

  /* ---------------- nav ---------------- */
  const nav = document.getElementById("nav");
  const navCheck = () => nav.classList.toggle("is-solid", scene.getBoundingClientRect().bottom < innerHeight * 0.6);
  addEventListener("scroll", navCheck, { passive: true });

  /* ---------------- projects ---------------- */
  const S = window.SITE || {};
  const grid = document.getElementById("grid");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const month = d => d ? new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
  const pretty = n => n.replace(/[-_]+/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  function cardHTML(p) {
    const stats = [
      p.stars ? `<span>★ ${p.stars}</span>` : "",
      p.updated ? `<span>Updated ${month(p.updated)}</span>` : "",
      `<span>${esc(p.cta || "View on GitHub →")}</span>`
    ].join("");
    return `<li><a class="card" href="${esc(p.url)}" target="_blank" rel="noopener" data-pitch>
      <span class="card__stamp" aria-hidden="true">Strike</span>
      <div class="card__body">
        ${p.language ? `<div class="card__lang"><i></i>${esc(p.language)}</div>` : ""}
        <h3>${esc(p.title || pretty(p.name))}</h3>
        ${p.description ? `<p>${esc(p.description)}</p>` : ""}
      </div>
      <div class="card__stats">${stats}</div>
    </a></li>`;
  }
  const emptyHTML = n => Array.from({ length: n }, () => `<li><div class="card card--empty">
      <h3>In the bullpen</h3><p>New work lands here as it ships.</p></div></li>`).join("");

  async function loadProjects() {
    const manual = (S.projects || []).map(p => ({ ...p, url: p.url || (S.githubUser ? `https://github.com/${S.githubUser}/${p.name}` : "#") }));
    let repos = [];
    if (S.githubUser) {
      try {
        const res = await fetch(`https://api.github.com/users/${encodeURIComponent(S.githubUser)}/repos?per_page=100&sort=updated`);
        if (res.ok) repos = (await res.json())
          .filter(r => !r.fork && !r.archived && r.name.toLowerCase() !== `${S.githubUser}.github.io`.toLowerCase())
          .map(r => ({ name: r.name, description: r.description, url: r.html_url, language: r.language, stars: r.stargazers_count, updated: r.pushed_at }));
      } catch (e) { /* offline or rate-limited: fall back to the manual list */ }
    }
    const byName = new Map(repos.map(r => [r.name.toLowerCase(), r]));
    for (const m of manual) {
      const key = (m.name || "").toLowerCase();
      byName.set(key, { ...(byName.get(key) || {}), ...m });
    }
    const hide = new Set((S.hide || []).map(s => s.toLowerCase()));
    const order = (S.featured || []).map(s => s.toLowerCase());
    const list = [...byName.entries()].filter(([k]) => !hide.has(k)).map(([, v]) => v)
      .sort((a, b) => {
        const ia = order.indexOf(a.name.toLowerCase()), ib = order.indexOf(b.name.toLowerCase());
        if (ia !== ib) return (ia < 0 ? 1e3 : ia) - (ib < 0 ? 1e3 : ib);
        return new Date(b.updated || 0) - new Date(a.updated || 0);
      });
    // An "In the bullpen" card always follows the projects, and fills out the row until there are three.
    grid.innerHTML = list.map(cardHTML).join("") + emptyHTML(Math.max(1, 3 - list.length));
  }

  /* ---------------- signature: the pitch ---------------- */
  const ball = document.getElementById("ball");
  let throwing = false;
  // Safari and every iOS browser (WebKit) only allow a new tab about 1s after the
  // click; Chrome, Edge and Firefox allow several. Pace the pitch to fit.
  const ua = navigator.userAgent;
  const webkit = /AppleWebKit/.test(ua) && !/(Chrome|Chromium|Edg)\//.test(ua);
  const PACE = webkit ? { flight: 620, hold: 260 } : { flight: 900, hold: 750 };

  let dropAnim = null;
  function pitch(card, url) {
    throwing = true;
    if (dropAnim) { dropAnim.cancel(); dropAnim = null; }
    const fx = 0.42 + Math.random() * 0.16, fy = 0.38 + Math.random() * 0.2;
    let r = card.getBoundingClientRect();
    // Released from just below the bottom edge, as if from the viewer's side of the plate.
    const sx = innerWidth * (r.left + r.width * fx < innerWidth / 2 ? 0.72 : 0.28), sy = innerHeight + 60;
    const dur = PACE.flight, t0 = performance.now();
    let tx, ty;
    ball.style.opacity = 1;

    function step(now) {
      // Re-aim every frame so the pitch still lands if the page scrolls mid-flight.
      r = card.getBoundingClientRect();
      tx = r.left + r.width * fx; ty = r.top + r.height * fy;
      const cx = (sx + tx) / 2, cy = Math.min(sy, ty) - Math.min(220, innerHeight * 0.22);
      const u = clamp((now - t0) / dur);
      const e = u * u * (1.6 - 0.6 * u);              // slight late acceleration, like a pitch
      const x = (1 - e) * (1 - e) * sx + 2 * (1 - e) * e * cx + e * e * tx;
      const y = (1 - e) * (1 - e) * sy + 2 * (1 - e) * e * cy + e * e * ty;
      const s = lerp(2.1, 0.75, e);                     // big near the viewer, small at the card
      ball.style.transform = `translate3d(${x - 20}px, ${y - 20}px, 0) scale(${s}) rotate(${e * 900}deg)`;
      if (u < 1) return requestAnimationFrame(step);

      const ring = document.createElement("div");
      ring.className = "impact"; ring.style.left = tx + "px"; ring.style.top = ty + "px";
      document.body.appendChild(ring);
      setTimeout(() => ring.remove(), 600);
      card.classList.remove("is-hit", "is-strike"); void card.offsetWidth; card.classList.add("is-hit", "is-strike");
      setTimeout(() => card.classList.remove("is-strike"), PACE.hold + 1400);
      dropAnim = ball.animate([
        { transform: ball.style.transform, opacity: 1 },
        { transform: `translate3d(${tx - 20}px, ${ty + 30}px, 0) scale(.6) rotate(1000deg)`, opacity: 0 }
      ], { duration: 260, easing: "ease-in", fill: "forwards" });
      // Release the held end frame, or it overrides the next throw's inline styles.
      dropAnim.onfinish = () => { ball.style.opacity = 0; dropAnim.cancel(); dropAnim = null; };

      setTimeout(() => {
        throwing = false;
        let w = null;
        try { w = window.open(url, "_blank"); } catch (e) { /* sandboxed */ }
        if (w) { w.opener = null; return; }
        // Popup refused (embedded previews do this): let the card's own link do it.
        card.dataset.thrown = "1";
        card.click();
      }, PACE.hold);
    }
    requestAnimationFrame(step);
  }

  grid.addEventListener("click", e => {
    const card = e.target.closest("a[data-pitch]");
    if (!card || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    if (card.dataset.thrown) { delete card.dataset.thrown; return; }   // follow-through click after the pitch
    const url = card.href;
    if (!url || url.endsWith("#") || reduce.matches) return;   // default link behaviour
    e.preventDefault();
    if (!throwing) pitch(card, url);
  });

  /* ---------------- experience timeline ---------------- */
  const tl = document.querySelector(".tl");
  if (tl) {
    const fill = document.createElement("div");
    fill.className = "tl__fill"; fill.setAttribute("aria-hidden", "true");
    tl.prepend(fill);
    const items = [...tl.querySelectorAll(".tl__item")];
    // Details start closed once JS is running; without JS they simply show.
    tl.querySelectorAll(".tl__toggle").forEach(btn => {
      const panel = document.getElementById(btn.getAttribute("aria-controls"));
      panel.classList.add("is-closed"); panel.inert = true;
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("aria-expanded") !== "true";
        btn.setAttribute("aria-expanded", open);
        btn.textContent = open ? "Hide details" : "Show details";
        panel.classList.toggle("is-closed", !open); panel.inert = !open;
        if (open) requestAnimationFrame(update);
      });
    });
    const update = () => {
      if (reduce.matches) {
        tl.classList.remove("is-armed"); fill.style.transform = "scaleY(1)";
        for (const it of items) it.classList.add("is-lit");
        return;
      }
      tl.classList.add("is-armed");
      const r = tl.getBoundingClientRect(), line = innerHeight * 0.72;
      const s = clamp((line - r.top) / r.height);
      fill.style.transform = `scaleY(${s})`;
      // The fill runs from 10px below the top to 10px above the bottom; a dot lights once the tip reaches its centre.
      const tip = 10 + s * (tl.offsetHeight - 20);
      for (const it of items) it.classList.toggle("is-lit", tip >= it.offsetTop + 14);
      for (const it of items) if (it.getBoundingClientRect().top < line + 10) it.classList.add("is-in");
    };
    let queued = false;
    addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } }, { passive: true });
    addEventListener("resize", update);
    update();
  }

  /* ---------------- boot ---------------- */
  const remeasure = () => { measureScene(); measureCard(); last = -1; };
  measureScene(); measureCard();
  addEventListener("resize", remeasure);
  phone.addEventListener("change", remeasure);
  addEventListener("load", remeasure);
  if (document.fonts) document.fonts.ready.then(remeasure);
  readScroll(); current = target; render(current); navCheck();
  requestAnimationFrame(tick);
  loadProjects();
})();
