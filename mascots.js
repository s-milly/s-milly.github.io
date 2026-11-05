/* The two scene mascots: a baseball that turns the card, points at the student line and is
   pitched into the field photo, and a bat that hits it off the screen on the baseball beat.
   Everything up to the hit follows scroll progress (p, the same 0..1 value as the scene).
   The hit itself plays once on a clock, because a swing scrubbed slowly by scroll looks limp.
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

  const BALL = `<svg viewBox="0 0 100 104" xmlns="${NS}">
    <g class="m-limbs">${leg("m-leg--l", 43, 74)}${leg("m-leg--r", 57, 74)}${arm("m-arm--l", 28, 58)}${arm("m-arm--r", 72, 58)}</g>
    <circle cx="50" cy="52" r="26" fill="${CREAM}" stroke="${NAVY}" stroke-width="2"/>
    <path d="M31 36 C40 46 40 60 31 70 M69 36 C60 46 60 60 69 70" fill="none" stroke="${RED}" stroke-width="2" stroke-dasharray="3 3"/>
    <path d="M25.5 44 Q25 20 50 20 Q75 20 74.5 44 Z" fill="${NAVY}" stroke="${GOLD}" stroke-width="1.5"/>
    <path d="M58 43 h30" stroke="${GOLD}" stroke-width="5" stroke-linecap="round"/>
    <circle cx="50" cy="20" r="2.5" fill="${GOLD}"/>
    ${eyes(53, 55)}
    <path d="M47 65 Q53 70 59 65" fill="none" stroke="${NAVY}" stroke-width="2.2" stroke-linecap="round"/></svg>`;

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

  function create(stage, reduce) {
    const ball = make("mascot--ball", BALL), bat = make("mascot--bat", BAT), burst = make("mascot--burst", BURST);
    stage.append(ball, bat, burst);
    const q = (el, s) => el.querySelector(s);
    const B = {
      body: q(ball, ".mascot__body"), limbs: q(ball, ".m-limbs"),
      armL: q(ball, ".m-arm--l"), armR: q(ball, ".m-arm--r"), legL: q(ball, ".m-leg--l"), legR: q(ball, ".m-leg--r")
    };
    const T = {
      body: q(bat, ".mascot__body"), swing: q(bat, ".m-swing"),
      armL: q(bat, ".m-arm--l"), armR: q(bat, ".m-arm--r"), legL: q(bat, ".m-leg--l"), legR: q(bat, ".m-leg--r")
    };

    // Measured anchors, in stage pixels (top-left of each mascot box).
    let G = null;
    function measure(ctx) {
      const { card, W, H, phone, studentPanel } = ctx;
      const s = phone ? 44 : 64, h = s * 1.04;            // ball box
      const bs = phone ? 56 : 96, bh = bs * 1.04;          // bat box
      const sr = stage.getBoundingClientRect();
      // Panels are moved with `translate`; take it back out so the anchor is the resting spot.
      const ty = parseFloat((studentPanel.style.translate || "0 0").split(" ")[1]) || 0;
      const rect = el => { const r = el.getBoundingClientRect(); return { l: r.left - sr.left, r: r.right - sr.left, t: r.top - sr.top - ty, b: r.bottom - sr.top - ty }; };
      const para = rect(studentPanel.querySelector(".feats")), head = rect(studentPanel.querySelector("h2"));

      // The bat stands in open grass to the right of Shawn; the ball meets the barrel at the
      // end of the swing (72 units long from the feet, swung 70 degrees to the left).
      const spot = phone ? { x: W - bs - 6, y: H * 0.17 } : { x: W * 0.8, y: H * 0.5 };
      const k = bs / 100, a = -70 * Math.PI / 180, reach = 52;
      const contact = { x: spot.x + (50 + Math.sin(a) * reach) * k, y: spot.y + (84 - Math.cos(a) * reach) * k };
      const fs = 0.85;                                      // the ball is a little smaller in flight
      G = {
        s, h, bs, bh, W, H, phone, card, bat: spot, fs,
        // Sitting on the card's top edge near the left corner, legs over the front.
        rest: { x: card.x + card.w * 0.1, y: card.y - s * 0.76 },
        // On phones the student line sits under the card, so the ball points at it from the left margin.
        pushY: card.y + card.h * (phone ? 0.6 : 0.45) - h / 2,
        point: phone ? { x: 18, y: head.t - h - 4 } : { x: para.r + 8, y: para.t - h * 0.25 },
        contact: { x: contact.x - 50 * (s / 100), y: contact.y - 52 * (s / 100) },
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

    // Where the card's left edge sits on screen when the card is turned `ang` degrees
    // (rotateY with the card's 1800px perspective and its small lift while turning).
    // That edge swings toward the viewer and inward, so the ball pushes it from the left
    // and never has to cross the card.
    function edgeX(ang, lift) {
      const c = G.card, half = c.w / 2, r = ang * Math.PI / 180;
      return c.x + half - (half * Math.cos(r) * 1800) / (1800 - half * Math.sin(r)) * lift;
    }

    // Hit state: "ready" until the swing, "hit" while it plays, "gone" after.
    let state = "ready", anims = [];
    function reset() {
      anims.forEach(a => a.cancel()); anims = [];
      state = "ready";
      ball.style.visibility = bat.style.visibility = "";
      burst.style.opacity = 0;
    }

    function hit() {
      state = "hit";
      const g = G, c = g.contact;
      const at = (x, y, extra = "") => `translate3d(${x}px, ${y}px, 0) ${extra}`;
      const play = (el, frames, opts) => { const a = el.animate(frames, { fill: "forwards", easing: EASE_OUT, ...opts }); anims.push(a); return a; };
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
      // The ball sails off past the top right corner, spinning.
      play(ball, [{ transform: at(c.x, c.y) }, { transform: at(g.W + g.s, -g.h * 2) }], { duration: 560, delay: 100 });
      play(B.body, [{ transform: `rotate(0deg) scale(${g.fs})` }, { transform: `rotate(-540deg) scale(${g.fs * 0.7})` }], { duration: 560, delay: 100 });
      // The bat rests on its shoulder, waves and jogs off the right edge.
      play(T.swing, [{ transform: "rotate(-75deg)" }, { transform: "rotate(-10deg)" }], { duration: 200, delay: 260 });
      play(T.armL, [{ transform: "rotate(60deg)" }, { transform: "rotate(150deg)" }], { duration: 200, delay: 260 });
      play(T.legL, [{ transform: "rotate(-30deg)" }, { transform: "rotate(30deg)" }], { duration: 110, delay: 300, iterations: 4, direction: "alternate", easing: "ease-in-out" });
      play(T.legR, [{ transform: "rotate(30deg)" }, { transform: "rotate(-30deg)" }], { duration: 110, delay: 300, iterations: 4, direction: "alternate", easing: "ease-in-out" });
      const off = play(bat, [{ transform: at(g.bat.x, g.bat.y) }, { transform: at(g.W + g.bs * 0.4, g.bat.y) }],
        { duration: 440, delay: 300, easing: "cubic-bezier(0.77, 0, 0.175, 1)" });   // on-screen movement: ease-in-out
      off.finished.then(() => {
        if (state !== "hit") return;
        state = "gone";
        ball.style.visibility = bat.style.visibility = "hidden";
        anims.forEach(a => a.cancel()); anims = [];
      }).catch(() => {});
    }

    function renderReduced(p) {
      // No running, flying or swinging: still poses that fade between spots.
      const g = G;
      place(ball, g.rest.x, g.rest.y);
      let o = 1 - seg(p, 0.14, 0.18), at = g.rest, ps = { armL: 150, armR: 20, legL: -10, legR: 10 }, flip = false;
      const oPoint = seg(p, 0.27, 0.31) * (1 - seg(p, 0.36, 0.4));
      const oSide = seg(p, 0.52, 0.56) * (1 - seg(p, 0.62, 0.66));
      if (oPoint > 0) { o = oPoint; at = g.point; flip = !g.phone; ps = g.phone ? { armL: 20, armR: 40 } : { armL: 20, armR: 100 }; }
      else if (oSide > 0) { o = oSide; at = g.side; ps = { armL: 15, armR: 15 }; }
      place(ball, at.x, at.y);
      B.body.style.transform = flip ? "scaleX(-1)" : "none";
      pose(B, ps);
      ball.style.opacity = o;
      ball.classList.remove("is-sitting");
      place(bat, g.bat.x, g.bat.y);
      bat.style.opacity = oSide;
      bat.style.visibility = oSide > 0 ? "visible" : "hidden";
      T.body.style.transform = "none";
      rot(T.swing, -8);
      pose(T, { armL: 25, armR: 25 });
    }

    function render(p, ang, lift) {
      if (!G) return;
      if (reduce.matches) { if (state !== "ready") reset(); renderReduced(p); return; }
      ball.style.opacity = bat.style.opacity = "";
      // Scrolling back to the card brings the ball home and re-arms the bat.
      if (state !== "ready") { if (p < 0.42) reset(); else return; }
      if (p >= 0.7) { state = "gone"; ball.style.visibility = bat.style.visibility = "hidden"; return; }
      if (p >= 0.585) { hit(); return; }

      const g = G;
      let x, y, flip = false, spin = 0, scale = 1, lean = 0, limbs = 1;
      let ps = { armL: 150, armR: 20, legL: -10, legR: 10 };     // sitting on the card, waving
      const sitting = p < 0.12;

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
      ball.classList.toggle("is-sitting", sitting);

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
