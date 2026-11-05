/* The two scene mascots. The baseball turns the card, points at the student line, is pitched
   into the field photo and hit back by the bat to stand on "mound" in the baseball heading. On the golf beat it
   walks into the photo and tends the flag at the cup, and after the scene it leaps onto the
   gold line of the experience timeline and hangs from its tip. It never leaves the screen.
   Everything follows scroll progress (p, the same 0..1 value as the scene) except the hit and
   the flight back, which play once on a clock, because a swing scrubbed slowly by scroll looks limp.
   The ball is fixed to the viewport so it can leave the pinned stage; the bat stays in the stage.
   site.js owns the scene and calls measure() on resize and render() each frame. */
window.SceneMascots = (() => {
  const NS = "http://www.w3.org/2000/svg";
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const seg = (p, a, b) => smooth(clamp((p - a) / (b - a)));
  const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";   // the site's --ease

  const NAVY = "#0E1A2B", CREAM = "#F4EFE4", GOLD = "#E3B341", RED = "#C8323C", LIMB = "#C9D1DC";
  // Limbs are drawn hanging straight down and turned at the shoulder or hip.
  const arm = (cls, x, y) => `<g class="m-arm ${cls}" style="transform-origin:${x}px ${y}px">
      <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 19}" stroke="${LIMB}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="${x}" cy="${y + 19}" r="5" fill="#fff" stroke="${NAVY}" stroke-width="2"/></g>`;
  const leg = (cls, x, y) => `<g class="m-leg ${cls}" style="transform-origin:${x}px ${y}px">
      <line x1="${x}" y1="${y}" x2="${x}" y2="${y + 17}" stroke="${LIMB}" stroke-width="5" stroke-linecap="round"/>
      <ellipse cx="${x + 2}" cy="${y + 19}" rx="7" ry="4.5" fill="${GOLD}"/></g>`;
  const eyes = (cx, cy) => `<g class="m-eyes" style="transform-origin:${cx}px ${cy}px">
      <ellipse cx="${cx - 7}" cy="${cy}" rx="3.2" ry="4.4" fill="${NAVY}"/><ellipse cx="${cx + 7}" cy="${cy}" rx="3.2" ry="4.4" fill="${NAVY}"/>
      <circle cx="${cx - 6}" cy="${cy - 1.6}" r="1.1" fill="#fff"/><circle cx="${cx + 8}" cy="${cy - 1.6}" r="1.1" fill="#fff"/></g>`;

  // Small gold stars for the moment the ball lands on the heading, a little dazed.
  const star = (x, y) => `<path transform="translate(${x} ${y})" d="M0 -4.5 L1.2 -1.2 L4.5 0 L1.2 1.2 L0 4.5 L-1.2 1.2 L-4.5 0 L-1.2 -1.2 Z" fill="${GOLD}"/>`;
  const BALL = `<svg viewBox="0 0 100 104" xmlns="${NS}">
    <g class="m-limbs">${leg("m-leg--l", 43, 74)}${leg("m-leg--r", 57, 74)}${arm("m-arm--l", 28, 58)}${arm("m-arm--r", 72, 58)}</g>
    <circle cx="50" cy="52" r="26" fill="${CREAM}" stroke="${NAVY}" stroke-width="2"/>
    <path d="M31 36 C40 46 40 60 31 70 M69 36 C60 46 60 60 69 70" fill="none" stroke="${RED}" stroke-width="2" stroke-dasharray="3 3"/>
    <path d="M25.5 44 Q25 20 50 20 Q75 20 74.5 44 Z" fill="${NAVY}" stroke="${GOLD}" stroke-width="1.5"/>
    <path d="M58 43 h30" stroke="${GOLD}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="50" cy="20" r="2.5" fill="${GOLD}"/>
    ${eyes(53, 55)}
    <path d="M47 65 Q53 70 59 65" fill="none" stroke="${NAVY}" stroke-width="2.2" stroke-linecap="round"/>
    <g class="m-daze" opacity="0" style="transform-origin:50px 8px">${star(66, 8)}${star(42, 21.9)}${star(42, -5.9)}</g></svg>`;

  // The flagstick that stands in the cup on the golf photo (drawn inside the golf plate, so it is revealed with it).
  const FLAG = `<svg viewBox="0 0 40 100" xmlns="${NS}">
    <line x1="4" y1="3" x2="4" y2="100" stroke="${CREAM}" stroke-width="2.4" stroke-linecap="round"/>
    <path class="m-flag" d="M5 4 Q20 7 35 13 Q20 18 5 23 Z" fill="${GOLD}" stroke="${NAVY}" stroke-width="1.2" stroke-linejoin="round"/></svg>`;

  const BAT = `<svg viewBox="0 0 100 104" xmlns="${NS}">
    ${leg("m-leg--l", 44, 84)}${leg("m-leg--r", 56, 84)}
    <g class="m-swing" style="transform-origin:50px 84px">
      <path d="M44 84 L41 40 Q40 14 50 12 Q60 14 59 40 L56 84 Z" fill="#C98B4A" stroke="${NAVY}" stroke-width="2"/>
      <path d="M47 50 Q46 30 50 24" stroke="#E2B07A" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <rect x="43" y="66" width="14" height="14" rx="2" fill="${NAVY}"/>
      <path d="M43 70 h14 M43 75 h14" stroke="${GOLD}" stroke-width="1.4"/>
      ${eyes(47, 36)}
      <path d="M43 44 Q47 47 51 44" fill="none" stroke="${NAVY}" stroke-width="2" stroke-linecap="round"/>
    </g>
    ${arm("m-arm--l", 42, 60)}${arm("m-arm--r", 58, 60)}</svg>`;

  // A gold burst at the moment of contact.
  const BURST = `<svg viewBox="-50 -50 100 100" xmlns="${NS}"><g stroke="${GOLD}" stroke-width="4" stroke-linecap="round">${
    [0, 45, 90, 135, 180, 225, 270, 315].map(a => `<line x1="0" y1="-30" x2="0" y2="-46" transform="rotate(${a})"/>`).join("")}</g></svg>`;

  function make(cls, svg) {
    const el = document.createElement("div");
    el.className = "mascot " + cls;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<div class="mascot__body">${svg}</div>`;
    return el;
  }


  function create(stage, reduce, { layer = document.body, golf } = {}) {
    const ball = make("mascot--ball", BALL), bat = make("mascot--bat", BAT), burst = make("mascot--burst", BURST);
    const flag = make("mascot--flag", FLAG);
    // The ball is fixed to the viewport so it can follow the page past the pinned stage.
    layer.append(ball);
    stage.append(bat, burst);
    if (golf) golf.append(flag);
    const q = (el, s) => el.querySelector(s);
    const B = {
      body: q(ball, ".mascot__body"), svg: q(ball, "svg"), limbs: q(ball, ".m-limbs"), daze: q(ball, ".m-daze"),
      armL: q(ball, ".m-arm--l"), armR: q(ball, ".m-arm--r"), legL: q(ball, ".m-leg--l"), legR: q(ball, ".m-leg--r")
    };
    const T = {
      body: q(bat, ".mascot__body"), swing: q(bat, ".m-swing"),
      armL: q(bat, ".m-arm--l"), armR: q(bat, ".m-arm--r"), legL: q(bat, ".m-leg--l"), legR: q(bat, ".m-leg--r")
    };

    // Measured anchors, in stage pixels (top-left of each mascot box).
    let G = null;
    function measure(ctx) {
      const { card, W, H, phone, studentPanel, basePanel } = ctx;
      const s = phone ? 44 : 64, h = s * 1.04;            // ball box
      const bs = phone ? 56 : 96, bh = bs * 1.04;          // bat box
      const sr = stage.getBoundingClientRect();
      // Panels are moved with `translate`; take it back out so the anchor is the resting spot.
      const shift = el => parseFloat((el.style.translate || "0 0").split(" ")[1]) || 0;
      const toStage = (r, ty) => ({ l: r.left - sr.left, r: r.right - sr.left, t: r.top - sr.top - ty, b: r.bottom - sr.top - ty });
      const sty = shift(studentPanel);
      const para = toStage(studentPanel.querySelector(".feats").getBoundingClientRect(), sty);
      const head = toStage(studentPanel.querySelector("h2").getBoundingClientRect(), sty);

      // The "n" of "mound" in the baseball heading: the ball lands standing on it after the hit
      // (its top is closed, unlike the "u" in the middle of the word).
      const h2 = basePanel.querySelector("h2"), range = document.createRange();
      const text = h2.firstChild, at = text && text.nodeType === 3 ? text.data.indexOf("mound") : -1;
      if (at >= 0) { range.setStart(text, at + 3); range.setEnd(text, at + 4); } else range.selectNodeContents(h2);
      const word = toStage(range.getClientRects()[0] || h2.getBoundingClientRect(), shift(basePanel));
      // Top of the lowercase letters (the x-height), measured down from the top of the text box.
      const xTop = word.t + parseFloat(getComputedStyle(h2).fontSize) * 0.33;

      // The bat stands in open grass to the right of Shawn, inside the photo frame; the ball meets the barrel at the
      // end of the swing (72 units long from the feet, swung 70 degrees to the left).
      const spot = phone ? { x: W - bs - 22, y: H * 0.17 } : { x: W * 0.8, y: H * 0.5 };
      const k = bs / 100, a = -70 * Math.PI / 180, reach = 52;
      const contact = { x: spot.x + (50 + Math.sin(a) * reach) * k, y: spot.y + (84 - Math.cos(a) * reach) * k };
      const fs = 0.85;                                      // the ball is a little smaller in flight

      // The cup in the golf photo, from where the photo is drawn (object-fit: cover) and the cup's place in each image.
      let stand = { x: W * 0.6, y: H * 0.7 };
      const img = golf && golf.querySelector("img");
      if (img && img.naturalWidth) {
        const [fx, fy] = /golf-m/.test(img.currentSrc || img.src) ? [0.214, 0.661] : [0.316, 0.872];
        const bw = img.offsetWidth, bhh = img.offsetHeight, iw = img.naturalWidth, ih = img.naturalHeight;
        const sc = Math.max(bw / iw, bhh / ih), rw = iw * sc, rh = ih * sc;
        const [ox, oy] = getComputedStyle(img).objectPosition.split(" ").map(v => parseFloat(v) / 100);
        const cx = img.offsetLeft + (bw - rw) * ox + fx * rw, cy = img.offsetTop + (bhh - rh) * oy + fy * rh;
        // The flagstick stands in the cup: its pole is 4 of the flag's 40 units from the left.
        const fw = s * 0.9, fh = fw * 2.5;
        Object.assign(flag.style, { width: fw + "px", transform: `translate3d(${(cx - fw * 0.1).toFixed(1)}px, ${(cy - fh * 0.98).toFixed(1)}px, 0)` });
        // The ball stands just behind and to the left of the cup, its right hand (arm raised 120 degrees) on the pole.
        const gx = golf.offsetLeft + cx, gy = golf.offsetTop + cy;
        stand = { x: gx - s * 0.885, y: gy - s * 1.08 };
      }

      G = {
        s, h, bs, bh, W, H, phone, card, bat: spot, fs, stand,
        // Sitting on the card's top edge near the left corner, legs over the front.
        rest: { x: card.x + card.w * 0.1, y: card.y - s * 0.76 },
        // On phones the student line sits under the card, so the ball points at it from the left margin.
        pushY: card.y + card.h * (phone ? 0.6 : 0.45) - h / 2,
        point: phone ? { x: 18, y: head.t - h - 4 } : { x: para.r + 8, y: para.t - h * 0.25 },
        contact: { x: contact.x - 50 * (s / 100), y: contact.y - 52 * (s / 100) },
        // Standing on the "n" of "mound" (a pitcher's mound).
        sit: { x: (word.l + word.r) / 2 - s / 2, y: xTop - s * 0.975 },
        // Reduced motion: the ball waits on the grass beside the bat instead of in the air.
        side: { x: spot.x - s * 0.95, y: spot.y + bh - h }
      };
      ball.style.setProperty("--s", s + "px");
      bat.style.setProperty("--s", bs + "px");
      burst.style.setProperty("--s", s * 1.8 + "px");
    }

    const place = (el, x, y) => { el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`; };
    const rot = (el, d) => { el.style.transform = `rotate(${d.toFixed(1)}deg)`; };
    // Limb angles are "away from the body": 0 hangs down, 90 is straight out, 180 is straight up.
    function pose(R, { armL = 15, armR = 15, legL = -6, legR = 6 }) {
      rot(R.armL, armL); rot(R.armR, -armR); rot(R.legL, legL); rot(R.legR, legR);
    }
    const run = (phase, amt = 30) => ({ legL: Math.sin(phase) * amt, legR: -Math.sin(phase) * amt });
    const mode = cls => { for (const c of ["is-sitting", "is-tending", "is-hanging"]) ball.classList.toggle(c, c === cls); };

    // Where the card's left edge sits on screen when the card is turned `ang` degrees
    // (rotateY with the card's 1800px perspective and its small lift while turning).
    // That edge swings toward the viewer and inward, so the ball pushes it from the left
    // and never has to cross the card.
    function edgeX(ang, lift) {
      const c = G.card, half = c.w / 2, r = ang * Math.PI / 180;
      return c.x + half - (half * Math.cos(r) * 1800) / (1800 - half * Math.sin(r)) * lift;
    }

    // Hit state: "ready" until the swing, "hit" while the swing and the flight back play, "landed" after.
    // `anims` are cancelled on landing so scroll takes over again; `soft` (the landing squash and the
    // dazed stars) touch nothing scroll sets, so they are left to finish.
    let state = "ready", anims = [], soft = [], lastArgs = null;
    function stop() {
      anims.forEach(a => a.cancel()); anims = [];
      burst.style.opacity = 0;
    }
    function reset() {
      stop(); soft.forEach(a => a.cancel()); soft = [];
      state = "ready";
      bat.style.visibility = "";
    }

    function hit() {
      state = "hit";
      const g = G, c = g.contact, L = g.sit;
      const at = (x, y, extra = "") => `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${extra}`;
      const play = (el, frames, opts, list = anims) => { const a = el.animate(frames, { fill: "forwards", easing: EASE_OUT, ...opts }); list.push(a); return a; };
      // Swing through: barrel from wound-up (+55) to across the body (-75).
      play(T.swing, [{ transform: "rotate(55deg)" }, { transform: "rotate(-75deg)" }], { duration: 140 });
      play(T.armL, [{ transform: "rotate(150deg)" }, { transform: "rotate(60deg)" }], { duration: 140 });
      play(T.armR, [{ transform: "rotate(-120deg)" }, { transform: "rotate(-80deg)" }], { duration: 140 });
      // Contact flash, centred on the ball.
      const bx = c.x + g.s / 2, by = c.y + g.h / 2, bw = g.s * 1.8;
      place(burst, bx - bw / 2, by - bw / 2);
      // Opacity on the outer box, scale on the inner one: the `scale` property would also scale the translate.
      play(burst, [{ opacity: 0 }, { opacity: 1, offset: 0.25, easing: EASE_OUT }, { opacity: 0 }], { duration: 260, delay: 40, easing: "linear" });
      play(burst.firstElementChild, [{ transform: "scale(0.9)" }, { transform: "scale(1.15)" }], { duration: 260, delay: 40 });
      // The ball flies back over to the baseball heading, spinning: steady across, an arc up and down.
      const FLY = 820, N = 16, arc = g.H * (g.phone ? 0.14 : 0.26), path = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        path.push({ transform: at(lerp(c.x, L.x, t), lerp(c.y, L.y, t) - Math.sin(Math.PI * t) * arc) });
      }
      const fly = play(ball, path, { duration: FLY, delay: 100, easing: "linear" });
      play(B.body, [{ transform: `rotate(0deg) scale(${g.fs})` }, { transform: "rotate(-540deg) scale(1)" }], { duration: FLY, delay: 100 });
      // Lands with a squash from its feet, limbs back out, and a few stars round its head.
      const land = 100 + FLY;
      play(B.limbs, [{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: land - 60 });
      B.svg.style.transformOrigin = "50% 94%";
      play(B.svg, [{ transform: "scale(1.14, 0.82)" }, { transform: "scale(0.96, 1.05)", offset: 0.5 }, { transform: "none" }],
        { duration: 320, delay: land, fill: "none" }, soft);
      play(B.daze, [{ opacity: 0, transform: "rotate(0deg)" }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.75 }, { opacity: 0, transform: "rotate(360deg)" }],
        { duration: 1100, delay: land + 60, easing: "linear", fill: "none" }, soft);
      // The bat rests on its shoulder, waves and jogs off the right edge.
      play(T.swing, [{ transform: "rotate(-75deg)" }, { transform: "rotate(-10deg)" }], { duration: 200, delay: 260 });
      play(T.armL, [{ transform: "rotate(60deg)" }, { transform: "rotate(150deg)" }], { duration: 200, delay: 260 });
      play(T.legL, [{ transform: "rotate(-30deg)" }, { transform: "rotate(30deg)" }], { duration: 110, delay: 300, iterations: 4, direction: "alternate", easing: "ease-in-out" });
      play(T.legR, [{ transform: "rotate(30deg)" }, { transform: "rotate(-30deg)" }], { duration: 110, delay: 300, iterations: 4, direction: "alternate", easing: "ease-in-out" });
      const off = play(bat, [{ transform: at(g.bat.x, g.bat.y) }, { transform: at(g.W + g.bs * 0.4, g.bat.y) }],
        { duration: 440, delay: 300, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });   // on-screen movement: ease-in-out
      off.finished.then(() => { if (state === "hit") bat.style.visibility = "hidden"; }).catch(() => {});
      fly.finished.then(() => {
        if (state !== "hit") return;
        state = "landed";
        stop();
        if (lastArgs) render(...lastArgs);
      }).catch(() => {});
    }

    // Where the ball is once it has been hit back: on the heading, walking to the cup, tending the flag,
    // then (past the scene) leaping to the timeline's gold line and hanging from its tip.
    function after(p, w) {
      const g = G;
      bat.style.visibility = "hidden";
      let x, y, flip = false, o = 1, cls = "", ps;
      if (p < 0.73) {
        // Standing on "mound". Scrolled back above the beat, it fades out with the heading.
        const vin = seg(p, 0.54, 0.6);
        x = g.sit.x; y = g.sit.y + (1 - vin) * 28; o = vin;
        ps = { armL: 20, armR: 20 };
      } else if (p < 0.86) {
        // Hops off the heading and walks into the golf photo, to the cup.
        const t = seg(p, 0.73, 0.86);
        x = lerp(g.sit.x, g.stand.x, t); y = lerp(g.sit.y, g.stand.y, t) - Math.sin(Math.PI * t) * g.h * 1.4;
        flip = g.stand.x < g.sit.x;
        ps = { armL: 35, armR: 35, ...run(t * 22) };
      } else {
        // Tending the flag: the right hand goes to the pole. The free hand waves now and then (site.css).
        const r = seg(p, 0.86, 0.9);
        x = g.stand.x; y = g.stand.y;
        ps = { armL: 20, armR: lerp(35, 120, r) }; cls = r >= 1 ? "is-tending" : "";
      }
      y += w.stageY;
      if (w.hand > 0 && w.tip) {
        // The hand on the line's tip; the leap goes from the green (moving up with the page) in a short arc.
        const e = smooth(w.hand);
        const hx = w.tip.x - 0.77 * g.s, hy = w.tip.y - 0.4 * g.s;
        x = lerp(x, hx, e); y = lerp(y, hy, e) - Math.sin(Math.PI * e) * g.H * 0.12;
        flip = false; o = 1;
        if (w.hand < 1) { ps = { armL: 150, armR: lerp(150, 165, e), legL: -16, legR: 16 }; cls = ""; }
        else { ps = { armL: 22, armR: 165, legL: -8, legR: 8 }; cls = "is-hanging"; }
      }
      place(ball, x, y);
      B.body.style.transform = flip ? "scaleX(-1)" : "none";
      B.limbs.style.opacity = 1;
      ball.style.opacity = o;
      pose(B, ps);
      mode(cls);
    }

    function renderReduced(p, w) {
      // No running, flying or swinging: still poses that fade between spots.
      const g = G;
      const spots = [
        { o: 1 - seg(p, 0.14, 0.18), at: g.rest, ps: { armL: 150, armR: 20, legL: -10, legR: 10 } },
        { o: seg(p, 0.27, 0.31) * (1 - seg(p, 0.36, 0.4)), at: g.point, flip: !g.phone, ps: g.phone ? { armL: 20, armR: 40 } : { armL: 20, armR: 100 } },
        { o: seg(p, 0.52, 0.56) * (1 - seg(p, 0.57, 0.59)), at: g.side, ps: { armL: 15, armR: 15 } },
        { o: seg(p, 0.6, 0.63) * (1 - seg(p, 0.73, 0.77)), at: g.sit, ps: { armL: 20, armR: 20 } },
        { o: seg(p, 0.86, 0.9) * (1 - seg(w.hand, 0, 0.4)), at: { x: g.stand.x, y: g.stand.y + w.stageY }, ps: { armL: 20, armR: 120 } }
      ];
      // Past the scene, it hangs still from the bottom of the (already full) gold line.
      if (w.tip && w.hand >= 0.5) spots.push({ o: 1, at: { x: w.tip.x - 0.77 * g.s, y: w.tip.y - 0.4 * g.s }, ps: { armL: 22, armR: 165 } });
      const sp = spots.reduce((a, b) => (b.o > a.o ? b : a));
      place(ball, sp.at.x, sp.at.y);
      B.body.style.transform = sp.flip ? "scaleX(-1)" : "none";
      B.limbs.style.opacity = 1;
      pose(B, sp.ps);
      ball.style.opacity = sp.o;
      mode("");
      const oSide = seg(p, 0.52, 0.56) * (1 - seg(p, 0.62, 0.66));
      place(bat, g.bat.x, g.bat.y);
      bat.style.opacity = oSide;
      bat.style.visibility = oSide > 0 ? "visible" : "hidden";
      T.body.style.transform = "none";
      rot(T.swing, -8);
      pose(T, { armL: 25, armR: 25 });
    }

    // w: { stageY (how far the stage has scrolled up after the scene), hand (0..1 leap to the line), tip (line tip on screen) }
    function render(p, ang, lift, w = { stageY: 0, hand: 0, tip: null }) {
      if (!G) return;
      lastArgs = [p, ang, lift, w];
      if (reduce.matches) { if (state !== "ready") reset(); renderReduced(p, w); return; }
      bat.style.opacity = "";
      if (state === "hit") {
        // Scrolled far either way while the hit plays: drop the clock and let scroll place the ball.
        if (p < 0.42) reset();
        else if (p > 0.72) { stop(); soft.forEach(a => a.cancel()); soft = []; state = "landed"; }
        else return;
      }
      // Scrolling back to the card brings the ball home and re-arms the bat.
      if (state === "landed" && p < 0.42) reset();
      if (state === "ready" && p >= 0.585) {
        if (p < 0.7) { hit(); return; }
        state = "landed";                                        // arrived here in one jump: no hit to watch
      }
      if (state === "landed") { after(p, w); return; }
      ball.style.opacity = "";
      mode(p < 0.12 ? "is-sitting" : "");

      const g = G;
      let x, y, flip = false, spin = 0, scale = 1, lean = 0, limbs = 1;
      let ps = { armL: 150, armR: 20, legL: -10, legR: 10 };     // sitting on the card, waving

      const pushStart = { x: edgeX(0, 1) - g.s * 0.92, y: g.pushY };
      const REL = 0.202, relAng = 60;                            // lets go once the card is 60 degrees round
      if (p < 0.16) {
        // Hop off the top edge and drop down beside the card's left edge: out to the side first, then falling.
        const t = seg(p, 0.12, 0.16);
        x = lerp(g.rest.x, pushStart.x, 1 - (1 - t) * (1 - t)); y = lerp(g.rest.y, pushStart.y, t * t) - Math.sin(Math.PI * t) * g.h * 0.5;
        if (t > 0) ps = { armL: 40, armR: 40, ...run(t * 14) };
      } else if (p < REL) {
        // Push the edge round: the ball follows the edge as it swings away.
        x = edgeX(ang, lift) - g.s * 0.92; y = g.pushY;
        lean = 14;                                               // leans into the card
        ps = { armL: 15, armR: 80, legL: -28, legR: -8 };
      } else {
        // Let go, then walk over to the student line (and stay there pointing).
        const from = { x: edgeX(relAng, 1) - g.s * 0.92, y: g.pushY };
        const t = seg(p, REL, 0.29);
        x = lerp(from.x, g.point.x, t); y = lerp(from.y, g.point.y, t) - Math.sin(Math.PI * t) * g.h * 0.5;
        flip = !g.phone;                                         // desktop: faces left, toward the text
        ps = t < 1 ? { armL: 35, armR: 35, ...run(t * 18) } : (g.phone ? { armL: 20, armR: 40 } : { armL: 20, armR: 100 });
        // Curl up and get pitched into the field photo, arriving at the bat's swing.
        const c = seg(p, 0.37, 0.41);
        if (c > 0) { limbs = 1 - c; ps = { armL: lerp(20, 170, c), armR: lerp(g.phone ? 40 : 100, 170, c), legL: -6, legR: 6 }; }
        const f = clamp((p - 0.41) / (0.585 - 0.41));
        if (f > 0) {
          const e = f * f * (1.6 - 0.6 * f);                   // slight late acceleration, like the project pitch
          x = lerp(g.point.x, g.contact.x, e);
          y = lerp(g.point.y, g.contact.y, e) - Math.sin(Math.PI * e) * g.H * (g.phone ? 0.06 : 0.22);
          spin = -720 * e; scale = lerp(1, g.fs, e); limbs = 0;
        }
      }
      place(ball, x, y);
      B.body.style.transform = `${flip ? "scaleX(-1) " : ""}rotate(${(lean + spin).toFixed(1)}deg) scale(${scale.toFixed(3)})`;
      B.limbs.style.opacity = limbs;
      pose(B, ps);

      // The bat walks in from the right edge, then winds up as the ball arrives.
      const walk = seg(p, 0.5, 0.555), wind = seg(p, 0.555, 0.585);
      bat.style.visibility = p > 0.5 ? "visible" : "hidden";
      place(bat, lerp(g.W + g.bs * 0.2, g.bat.x, walk), g.bat.y);
      rot(T.swing, lerp(-8, 55, wind));
      pose(T, walk < 1 ? { armL: 25, armR: 25, ...run(walk * 16) } : { armL: lerp(25, 150, wind), armR: lerp(25, 120, wind), legL: -28, legR: -8 });
    }

    reset();
    return { measure, render };
  }

  return { create };
})();
