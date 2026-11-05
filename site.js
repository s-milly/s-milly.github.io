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
  const ring = scene.querySelector(".frame-ring");
  const field = scene.querySelector(".plate--field");
  const suit = scene.querySelector(".plate--suit");
  const golf = scene.querySelector(".plate--golf");
  const card = scene.querySelector(".tcard");
  const cardInner = card.querySelector(".tcard__inner");
  const cardBack = card.querySelector(".tcard__back");
  const backText = cardBack.children;
  const cardImg = card.querySelector(".tcard__photo img");
  const lines = scene.querySelector(".wm__grid");
  const introPanel = scene.querySelector(".panel--intro");
  const studentPanel = scene.querySelector(".panel--student");
  const basePanel = scene.querySelector(".panel--baseball");
  const mascots = window.SceneMascots ? SceneMascots.create(scene.querySelector(".stage"), reduce, { golf }) : null;
  const panels = [...scene.querySelectorAll("[data-panel]")].map(el => ({
    el, k: el.dataset.panel.split(",").map(Number)
  }));

  /* The card is placed from the stage size. The photo window sits under the card's
     outline until the merge: [top, right, bottom, left] insets in % of the stage and a
     corner radius in px. `photo` is the card's photo area, where the headshot plate sits,
     and tx/ty offset the field (% of stage) so Shawn is centred in the card as the
     baseball photo opens. Card proportions match the cqw sizes in site.css. */
  const CARD = { ratio: 0.69, pad: 0.034, photo: 1.132, radius: 0.051 };
  let REG = { box: [10, 10, 10, 60], photo: [10, 10, 10, 60], r: 9, tx: 0, ty: 0 };
  /* Where the photo window settles after the merge: a rounded frame with the dark page
     around it, not full bleed. [top, right, bottom, left] insets in % of the stage, corner
     radius in px, tx/ty offset the field (% of stage) so Shawn is centred in the frame,
     and z is the field's scale there (below 1 shows more of the field around him).
     Desktop: right of the text, inside the nav gutter. Phone: above the text. */
  let END = { box: [11, 6, 9, 48], r: 22, tx: 13, ty: 7, z: 0.8 };
  let fieldOrigin = [0, 0], fieldBox = [0, 0];
  function measureEnd() {
    const W = stageW;
    END = phone.matches
      ? { box: [9, 16 / W * 100, 26, 16 / W * 100], r: 18, tx: 0, ty: 0, z: 0.8 }
      : { box: [11, clamp(W * 0.06, 16, 96) / W * 100, 9, 48], r: 22, tx: 13, ty: 7, z: 0.8 };
    // Phone: the field plate is widened to the photo's own shape (600 x 1000), centred,
    // so zooming out shows more of the photo instead of the page behind it.
    const extra = phone.matches ? Math.max(0, (stageH * 0.6 - W) / 2) : 0;
    field.style.left = field.style.right = extra ? -extra + "px" : "";
    fieldBox = [field.offsetLeft, field.offsetWidth];
    fieldOrigin = getComputedStyle(field).transformOrigin.split(" ").map(parseFloat);
    // Desktop: the golf photo is sized to the frame itself (2px over, so rounding never
    // shows the field behind it at an edge). On phones it stays stage-sized and the frame crops it.
    const [t, r, b, l] = END.box;
    Object.assign(golf.style, phone.matches
      ? { top: "", right: "", bottom: "", left: "" }
      : { top: `calc(${t}% - 2px)`, right: `calc(${r}% - 2px)`, bottom: `calc(${b}% - 2px)`, left: `calc(${l}% - 2px)` });
  }
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
      box: [y / H * 100, 100 - (x + w) / W * 100, 100 - (y + h) / H * 100, x / W * 100],
      photo: [T, R, B, L], r: Math.round(w * CARD.radius),
      tx: phone.matches ? cx - 52 : cx - 57,
      ty: phone.matches ? T + 0.44 * hPct - 16 : T + 0.325 * hPct - 18
    };
    // The card's own photo copies the crop of the headshot plate (1% overscan on each side),
    // so swapping between them never shifts the picture.
    Object.assign(cardImg.style, {
      left: -W * 0.01 + "px", top: -H * 0.01 + "px",
      width: pw + W * 0.02 + "px", height: ph + H * 0.02 + "px"
    });
    if (mascots) mascots.measure({ card: { x, y, w, h }, W, H, phone: phone.matches, studentPanel, basePanel });
  }

  function frameAt(p) {
    const t = seg(p, 0.42, 0.56);
    return {
      box: REG.box.map((v, i) => lerp(v, END.box[i], t)),
      r: lerp(REG.r, END.r, t), tx: lerp(REG.tx, END.tx, t), ty: lerp(REG.ty, END.ty, t)
    };
  }

  function render(p) {
    const f = frameAt(p);
    let [t, r, b, l] = f.box;

    // The card turns over once, for the student beat, and stays on its back. Before the
    // merge the back's text fades, leaving a blank card that opens into the baseball photo.
    // Under reduced motion the back fades in instead of turning.
    const flipTo = seg(p, 0.16, 0.27);
    const ang = 180 * flipTo;
    const facing = Math.abs(Math.cos(ang * Math.PI / 180));
    // How much of the front (and its headshot) is showing.
    const front = reduce.matches ? 1 - flipTo : clamp(Math.cos(ang * Math.PI / 180) * 3);
    const blank = 1 - seg(p, 0.36, 0.41);
    for (const el of backText) el.style.opacity = blank;
    if (reduce.matches) {
      cardInner.style.transform = "none";
      cardBack.style.opacity = flipTo;
    } else {
      cardInner.style.transform = `rotateY(${ang}deg) scale(${1 + 0.04 * Math.sin(Math.PI * flipTo)})`;
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
    cardAng = ang; cardLift = 1 + 0.04 * Math.sin(Math.PI * flipTo);
    const gone = seg(p, 0.42, 0.44);
    card.style.opacity = 1 - gone;
    card.style.visibility = gone >= 1 ? "hidden" : "visible";
    // The grid stays through the intro and student beats, easing closer as you scroll, and fade before the merge.
    lines.style.opacity = 1 - seg(p, 0.35, 0.41);
    lines.style.transform = reduce.matches ? "none" : `scale(${(1 + 0.1 * seg(p, 0, 0.41)).toFixed(4)})`;

    // Whole pixels: a fractional clip edge anti-aliases differently per GPU tile and shows as a 1px step.
    const px = (v, s) => Math.round(v * s / 100);
    const it = px(t, stageH), ir = px(r, stageW), ib = px(b, stageH), il = px(l, stageW);
    win.style.clipPath = `inset(${it}px ${ir}px ${ib}px ${il}px round ${f.r}px)`;
    // The frame's edge comes in once the card has gone, and follows the window as it opens.
    const edge = seg(p, 0.44, 0.5);
    ring.style.opacity = edge;
    if (edge > 0) Object.assign(ring.style, {
      transform: `translate(${il}px, ${it}px)`, width: stageW - il - ir + "px",
      height: stageH - it - ib + "px", borderRadius: f.r + "px"
    });
    // The headshot plate holds the card's photo area while the front shows. Once the card
    // is on its back it stays faint, and it is gone by the end of the merge.
    const fade = seg(p, 0.43, 0.53);
    const sb = REG.photo;
    // Overscan by 1% so rounding never leaves a seam; the window clip trims it.
    suit.style.left = (sb[3] - 1) + "%"; suit.style.top = (sb[0] - 1) + "%";
    suit.style.width = (102 - sb[1] - sb[3]) + "%"; suit.style.height = (102 - sb[0] - sb[2]) + "%";
    // Faint, not hidden, while the front is away, so it repaints cleanly on iOS.
    suit.style.opacity = (1 - fade) * Math.max(0.02, front);
    suit.style.visibility = fade >= 1 ? "hidden" : "visible";
    suit.style.transform = reduce.matches ? "none" : `translateY(${-9 * seg(p, 0.42, 0.53)}%) scale(${lerp(1, 1.18, seg(p, 0.42, 0.53))})`;
    const zoom = reduce.matches ? END.z : lerp(1.45, END.z, seg(p, 0.42, 0.6));
    const push = reduce.matches ? 1 : lerp(1, 1.06, seg(p, 0.6, 0.84));
    // Below scale 1 the field is smaller than the stage, so keep its edges outside the
    // window: the offset is clamped so the photo always covers the frame.
    const zs = zoom * push, [ox, oy] = fieldOrigin, [fl, fw] = fieldBox;
    const fx = clamp(f.tx * stageW / 100, stageW - ir - fl - ox - (fw - ox) * zs, il - fl - ox * (1 - zs));
    const fy = clamp(f.ty * stageH / 100, stageH - ib - oy - (stageH - oy) * zs, it - oy * (1 - zs));
    field.style.transform = `translate3d(${fx}px, ${fy}px, 0) scale(${zs})`;
    // Kept faint (not hidden) behind the headshot: edge anti-aliasing would otherwise
    // leak a sliver of it, and fully hidden layers repaint in pieces on iOS.
    field.style.opacity = lerp(0.02, 1, seg(p, 0.41, 0.45));
    const g = seg(p, 0.76, 0.88);
    golf.style.clipPath = `inset(${(1 - g) * 100}% 0 0 0)`;

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

  let target = 0, current = 0, last = -1, prev = 0, cardAng = 0, cardLift = 1, mLast = "";
  // Scene geometry, measured on load and resize rather than every frame.
  let sceneTop = 0, sceneH = 1, total = 1, stageW = 1, stageH = 1;
  // The experience timeline, for the ball that hangs from the tip of its gold line: page top, height,
  // and the line's x on screen. Kept by the timeline code below whenever it reads the timeline's box.
  let tlGeo = null;
  function measureScene() {
    stageW = win.clientWidth; stageH = win.clientHeight;
    sceneTop = scene.getBoundingClientRect().top + scrollY;
    sceneH = scene.offsetHeight;
    // The last --hold vh of the scene keeps progress at 1, holding the golf beat in place.
    const hold = (parseFloat(getComputedStyle(scene).getPropertyValue("--hold")) || 0) * innerHeight / 100;
    total = Math.max(1, scene.offsetHeight - innerHeight - hold);
  }
  // Progress follows scroll at one pace for the whole scene. site.css sets the scene height
  // so every beat gets the slower pace the card and student beats used to have.
  function readScroll() { target = clamp((scrollY - sceneTop) / total); }
  // After the scene the stage scrolls up with the page; the ball leaps from the golf green to the
  // tip of the timeline's gold line (hand 0..1), reached as the timeline's top comes up to 80% of the screen.
  function mascotWorld() {
    const end = sceneTop + sceneH - stageH;          // scroll position where the stage stops being pinned
    const u = Math.max(0, scrollY - end);
    let tip = null, hand = 0;
    if (tlGeo) {
      const top = tlGeo.top - scrollY;
      // The same fill as the timeline code: its tip runs 10px in from each end, level with 72% of the screen.
      const f = reduce.matches ? 1 : clamp((innerHeight * 0.72 - top) / tlGeo.h);
      tip = { x: tlGeo.x, y: top + 10 + f * (tlGeo.h - 20) };
      hand = clamp(u / Math.max(1, tlGeo.top - end - innerHeight * 0.8));
    }
    return { stageY: -u, hand, tip };
  }
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
    if (mascots) {
      const key = current + "|" + scrollY;
      if (key !== mLast) { mascots.render(current, cardAng, cardLift, mascotWorld()); mLast = key; }
    }
    requestAnimationFrame(tick);
  }

  /* Golf framing (desktop): zoom the photo so the frame holds the part that matters,
     from just above Shawn's cap down past the cup, and from the cup across to Shawn,
     so the friend crouching on the right stays out of it. Never smaller than a
     cover fit. Fractions of the desktop golf image (1170 x 1300). Phones keep the CSS crop. */
  const golfImg = golf.querySelector("img");
  const GOLF = { x0: 300 / 1170, x1: 880 / 1170, y0: 520 / 1300, y1: 1200 / 1300 };
  function frameGolf() {
    const st = golfImg.style;
    if (phone.matches || !golfImg.naturalWidth) { st.left = st.top = st.width = st.height = ""; return; }
    const W = golf.clientWidth, H = golf.clientHeight;
    const iw = golfImg.naturalWidth, ih = golfImg.naturalHeight;
    const rw = (GOLF.x1 - GOLF.x0) * iw, rh = (GOLF.y1 - GOLF.y0) * ih;
    const s = Math.max(W / iw, H / ih, Math.min(W / rw, H / rh));
    const cx = (GOLF.x0 + GOLF.x1) / 2 * iw * s, cy = (GOLF.y0 + GOLF.y1) / 2 * ih * s;
    Object.assign(st, {
      width: iw * s + "px", height: ih * s + "px",
      left: clamp(W / 2 - cx, W - iw * s, 0) + "px", top: clamp(H / 2 - cy, H - ih * s, 0) + "px"
    });
  }
  golfImg.addEventListener("load", () => remeasure());
  if (golfImg.complete) frameGolf();

  /* ---------------- nav ---------------- */
  const nav = document.getElementById("nav");
  const navCheck = () => nav.classList.toggle("is-solid", scene.getBoundingClientRect().bottom < innerHeight * 0.6);
  addEventListener("scroll", navCheck, { passive: true });

  /* Gold underline under the nav link for the section in view. Skills has no link, so the line fades out there. */
  const mark = nav.querySelector(".nav__mark");
  const links = [...nav.querySelectorAll("nav a[href^='#']")];
  const marked = links.map(a => [a, document.querySelector(a.getAttribute("href"))]).filter(([, el]) => el);
  let markOn = null;
  const markCheck = () => {
    const line = innerHeight * 0.4, atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 2;
    let on = null;
    for (const [a, el] of marked) {
      const r = el.getBoundingClientRect();
      if ((r.top <= line && r.bottom > line) || (atEnd && a === marked[marked.length - 1][0])) on = a;
    }
    if (on && !on.offsetWidth) on = null; // Experience is hidden on phones
    if (on !== markOn) {
      if (markOn) markOn.removeAttribute("aria-current");
      if (on) on.setAttribute("aria-current", "location");
    }
    if (on) {
      const box = nav.querySelector("nav").getBoundingClientRect(), r = on.getBoundingClientRect(), inset = parseFloat(getComputedStyle(on).paddingLeft);
      // Slide only between links; the first placement snaps so the line does not sweep in from the left.
      mark.classList.toggle("is-moving", !!markOn && mark.classList.contains("is-on"));
      mark.style.transform = `translateX(${r.left - box.left + inset}px) scaleX(${(r.width - inset * 2) / 100})`;
    }
    mark.classList.toggle("is-on", !!on);
    markOn = on;
  };
  let markQueued = false;
  addEventListener("scroll", () => { if (!markQueued) { markQueued = true; requestAnimationFrame(() => { markQueued = false; markCheck(); }); } }, { passive: true });
  addEventListener("resize", () => { mark.classList.remove("is-moving"); markOn && markOn.removeAttribute("aria-current"); markOn = null; markCheck(); });

  /* Email button: copy the address and show "Copied"; the mailto link still opens a mail app if there is one. */
  const email = document.getElementById("email"), emailStatus = document.getElementById("email-status");
  let copiedTimer;
  email.addEventListener("click", () => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(email.href.replace("mailto:", "")).then(() => {
      email.classList.add("is-copied");
      emailStatus.textContent = "Email address copied";
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => { email.classList.remove("is-copied"); emailStatus.textContent = ""; }, 1800);
    }, () => {});
  });

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
    const keep = r => { tlGeo = { top: r.top + scrollY, h: tl.offsetHeight, x: r.left + fill.offsetLeft + 1 }; };
    const update = () => {
      keep(tl.getBoundingClientRect());
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
    };
    let queued = false;
    addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } }, { passive: true });
    addEventListener("resize", update);
    update();
  }

  /* ---------------- boot ---------------- */
  const remeasure = () => { measureScene(); measureEnd(); frameGolf(); measureCard(); last = -1; mLast = ""; markCheck(); };
  measureScene(); measureEnd(); measureCard();
  addEventListener("resize", remeasure);
  phone.addEventListener("change", remeasure);
  addEventListener("load", remeasure);
  if (document.fonts) document.fonts.ready.then(remeasure);
  readScroll(); current = target; render(current); navCheck(); markCheck();
  requestAnimationFrame(tick);
  loadProjects();
})();
