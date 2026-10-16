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
  const net = scene.querySelector(".net");
  const panels = [...scene.querySelectorAll("[data-panel]")].map(el => ({
    el, k: el.dataset.panel.split(",").map(Number), on: el.classList.contains("panel--intro")
  }));

  // Window shape per beat: [top, right, bottom, left] insets in %, corner radius,
  // and the photo's offset (% of stage) so Shawn stays framed inside the window.
  const FRAMES = {
    desktop: [
      { at: 0.00, box: [13, 7, 13, 56], r: 16, tx: 17.5, ty: 10 },
      { at: 0.15, box: [13, 7, 13, 56], r: 16, tx: 17.5, ty: 10 },
      { at: 0.30, box: [10, 9, 10, 62], r: 16, tx: 19.5, ty: 18 },
      { at: 0.42, box: [10, 9, 10, 62], r: 16, tx: 19.5, ty: 18 },
      { at: 0.56, box: [0, 0, 0, 0], r: 0, tx: 0, ty: 0 },
      { at: 1.00, box: [0, 0, 0, 0], r: 0, tx: 0, ty: 0 }
    ],
    phone: [
      { at: 0.00, box: [8, 12, 50, 12], r: 18, tx: 0, ty: -2 },
      { at: 0.15, box: [8, 12, 50, 12], r: 18, tx: 0, ty: -2 },
      { at: 0.30, box: [9, 20, 52, 20], r: 18, tx: 0, ty: 10 },
      { at: 0.42, box: [9, 20, 52, 20], r: 18, tx: 0, ty: 10 },
      { at: 0.56, box: [0, 0, 0, 0], r: 0, tx: 0, ty: 0 },
      { at: 1.00, box: [0, 0, 0, 0], r: 0, tx: 0, ty: 0 }
    ]
  };

  function frameAt(p) {
    const F = phone.matches ? FRAMES.phone : FRAMES.desktop;
    let i = 0;
    while (i < F.length - 2 && p > F[i + 1].at) i++;
    const a = F[i], b = F[i + 1];
    const t = smooth(clamp((p - a.at) / (b.at - a.at)));
    return {
      box: a.box.map((v, j) => lerp(v, b.box[j], t)),
      r: lerp(a.r, b.r, t), tx: lerp(a.tx, b.tx, t), ty: lerp(a.ty, b.ty, t)
    };
  }

  /* neural-net line drawing behind the student beat */
  const ctx = net.getContext("2d");
  let nodes = [], edges = [], netW = 0, netH = 0;
  function buildNet() {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    netW = net.clientWidth; netH = net.clientHeight;
    net.width = netW * dpr; net.height = netH * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const layers = [4, 6, 6, 5, 3];
    const x0 = phone.matches ? 0.08 : 0.05, x1 = phone.matches ? 0.92 : 0.52;
    const y0 = phone.matches ? 0.50 : 0.14, y1 = phone.matches ? 0.96 : 0.86;
    nodes = []; edges = [];
    layers.forEach((n, li) => {
      const x = lerp(x0, x1, li / (layers.length - 1)) * netW;
      for (let k = 0; k < n; k++) {
        const y = lerp(y0, y1, (k + 0.5) / n) * netH;
        nodes.push({ x, y, li, ph: Math.random() * 6.28 });
      }
    });
    nodes.forEach((a, i) => nodes.forEach((b, j) => {
      if (b.li === a.li + 1 && Math.random() < 0.55) edges.push([i, j, (a.li + Math.random() * 0.9) / (layers.length - 1)]);
    }));
  }
  function drawNet(draw, time) {
    ctx.clearRect(0, 0, netW, netH);
    ctx.lineWidth = 1;
    for (const [i, j, d] of edges) {
      const t = clamp((draw - d * 0.8) / 0.2);
      if (t <= 0) continue;
      const a = nodes[i], b = nodes[j];
      ctx.strokeStyle = "rgba(238,241,245,0.09)";
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(lerp(a.x, b.x, t), lerp(a.y, b.y, t)); ctx.stroke();
    }
    for (const n of nodes) {
      const t = clamp((draw - (n.li / 4) * 0.8) / 0.15);
      if (t <= 0) continue;
      const pulse = reduce.matches ? 0.5 : 0.5 + 0.5 * Math.sin(time / 900 + n.ph);
      ctx.fillStyle = `rgba(227,179,65,${(0.35 + 0.4 * pulse) * t})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, 2.4, 0, 6.283); ctx.fill();
    }
  }

  function render(p, time) {
    const f = frameAt(p);
    const [t, r, b, l] = f.box;
    win.style.clipPath = `inset(${t}% ${r}% ${b}% ${l}% round ${f.r}px)`;
    const bleed = seg(p, 0.42, 0.56);
    // Suit to uniform: the headshot holds the window shape it had at the start of
    // the bleed, swells and fades, while the field zooms out from Shawn's face.
    const fade = seg(p, 0.43, 0.53);
    const sb = frameAt(Math.min(p, 0.42)).box;
    // Overscan by 1% so rounding never leaves a seam; the window clip trims it.
    suit.style.left = (sb[3] - 1) + "%"; suit.style.top = (sb[0] - 1) + "%";
    suit.style.width = (102 - sb[1] - sb[3]) + "%"; suit.style.height = (102 - sb[0] - sb[2]) + "%";
    suit.style.opacity = 1 - fade;
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

    const netAlpha = seg(p, 0.13, 0.22) * (1 - seg(p, 0.42, 0.5));
    net.style.opacity = netAlpha * (phone.matches ? 0.55 : 1);
    if (netAlpha > 0.001) drawNet(seg(p, 0.15, 0.36), time);

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

  let target = 0, current = 0, last = -1;
  function readScroll() {
    const rect = scene.getBoundingClientRect();
    // The last --hold vh of the scene keeps progress at 1, holding the golf beat in place.
    const hold = (parseFloat(getComputedStyle(scene).getPropertyValue("--hold")) || 0) * innerHeight / 100;
    const total = scene.offsetHeight - innerHeight - hold;
    target = clamp(-rect.top / total);
  }
  function tick(time) {
    readScroll();
    const k = reduce.matches ? 1 : (phone.matches ? 0.18 : 0.11);
    current += (target - current) * k;
    if (Math.abs(target - current) < 0.0004) current = target;
    const netLive = current > 0.12 && current < 0.5;
    if (current !== last || netLive) { render(current, time); last = current; }
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
      `<span>View on GitHub →</span>`
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
    // Until there are three projects, "In the bullpen" cards fill out the row.
    grid.innerHTML = list.map(cardHTML).join("") + emptyHTML(Math.max(0, 3 - list.length));
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
      if (reduce.matches) { tl.classList.remove("is-armed"); fill.style.transform = "scaleY(1)"; return; }
      tl.classList.add("is-armed");
      const r = tl.getBoundingClientRect(), line = innerHeight * 0.72;
      fill.style.transform = `scaleY(${clamp((line - r.top) / r.height)})`;
      for (const it of items) if (it.getBoundingClientRect().top < line + 10) it.classList.add("is-in");
    };
    let queued = false;
    addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } }, { passive: true });
    addEventListener("resize", update);
    update();
  }

  /* ---------------- boot ---------------- */
  buildNet();
  addEventListener("resize", () => { buildNet(); last = -1; });
  phone.addEventListener("change", () => { buildNet(); last = -1; });
  readScroll(); current = target; render(current, 0); navCheck();
  requestAnimationFrame(tick);
  loadProjects();
})();
