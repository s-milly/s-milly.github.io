// Four Fronts, browser version.
//
// A line-by-line port of four_fronts.cpp (C++, OpenGL and GLUT) to the HTML canvas.
// The world is still 600 x 800 with y pointing up, so every number matches the original.
// The canvas is scaled to fit the screen, and the parts that never change (the background
// and the platform) are drawn once into a saved image, the same job the display lists did.
//
// Controls:
//   Arrow keys / W A S D - stab with the sword left, right, up, or down
//   Click or tap         - stab toward the side of the screen you click
//   R restart, X back to the title page

(function () {
  "use strict";

  const PI = Math.PI;
  const WINDOW_WIDTH = 600;
  const WINDOW_HEIGHT = 800;

  const CENTER_X = 300;
  const CENTER_Y = 400;
  const TILE_SIZE = 76;
  const ARM_TILES = 3;

  // Half the width of the square each soldier fills (a tile is 76 wide, so these fill most of a tile)
  const PLAYER_RADIUS = 32;
  const ENEMY_RADIUS = 29;
  const ATTACK_REACH_TILES = 1;
  const ATTACK_TIME = 0.16;
  const SWORD_STAB = 14;
  const SWORD_CONTACT = 0.40;
  const POOF_TIME = 0.45;

  // The background is a grid of chunky pixels (BG_PIXEL world units wide)
  const BG_PIXEL = 8;
  const BG_COLS = WINDOW_WIDTH / BG_PIXEL;
  const BG_ROWS = WINDOW_HEIGHT / BG_PIXEL;

  // How much of the ground turns into dirt (a smaller number gives more dirt)
  const DIRT_LEVEL = 0.60;

  // What each spot of the background is made of
  const BG_NONE = -1;
  const BG_LIGHT = 0;
  const BG_LIGHT2 = 1;
  const BG_SHADE = 2;
  const BG_DEEP = 3;
  const BG_SUN = 4;
  const BG_DIRT = 5;
  const BG_DIRT_EDGE = 6;
  const BG_DIRT_SPECK = 7;
  const BG_PEBBLE = 8;
  const HIT_COOLDOWN = 0.10;
  const MISS_COOLDOWN = 0.25;

  // How long an enemy soldier waits on a tile, and how often new enemy soldiers arrive, at Speed 1.
  // Both get shorter (faster) by SPEED_FACTOR for every speed level above Speed 1.
  const START_STEP_TIME = 0.45;
  const MIN_STEP_TIME = 0.10;
  const START_SPAWN_TIME = 0.80;
  const MIN_SPAWN_TIME = 0.20;
  const SPEED_FACTOR = 0.88;
  const START_SPEED = 1;
  const SLIDE_TIME = 0.08;

  const MAX_ENEMIES = 8;
  const MAX_EFFECTS = 10;
  const ENERGY_PER_KILL = 10;

  // How much energy the meter loses every second at Speed 1 (the whole meter is 100)
  const METER_DRAIN_PER_SECOND = 5;
  const FURY_TIME = 0.5;
  const FURY_SWORDS = 12;
  const GAME_OVER_DELAY = 1.0;
  const REST_TIME = 2.5;

  const STATE_TITLE = 0;
  const STATE_PLAYING = 1;
  const STATE_OVER = 2;

  // Colors of the stone platform
  const STONE = [0.74, 0.69, 0.58];
  const STONE_LIGHT = [0.84, 0.79, 0.68];
  const STONE_DARK = [0.60, 0.55, 0.45];
  const STONE_OUTLINE = [0.45, 0.38, 0.29];
  const STONE_FRONT = [0.55, 0.47, 0.36];

  // Colors of the soldiers: silver armor with blue accents for the hero, dark armor with red accents for the enemies
  const HERO_ARMOR = [0.66, 0.70, 0.76];
  const ENEMY_ARMOR = [0.38, 0.37, 0.40];
  const BLUE_ACCENT = [0.18, 0.38, 0.90];
  const RED_ACCENT = [0.88, 0.18, 0.18];

  // Lane (arm) numbers: 0 = left, 1 = right, 2 = up, 3 = down
  const laneDx = [-1, 1, 0, 0];
  const laneDy = [0, 0, 1, -1];

  // The fonts that stand in for GLUT's bitmap fonts
  const FONT_BIG = "24px 'Times New Roman', Times, serif";
  const FONT_MEDIUM = "18px Helvetica, Arial, sans-serif";

  const enemies = [];
  const effects = [];
  for (let i = 0; i < MAX_ENEMIES; i++) enemies.push({ active: false, lane: 0, tile: 0, slide: 0, moveTimer: 0 });
  for (let i = 0; i < MAX_EFFECTS; i++) effects.push({ active: false, lane: 0, x: 0, y: 0, delay: 0, timeLeft: 0 });

  let gameState = STATE_TITLE;
  let score = 0;
  let highScore = 0;
  let speedLevel = START_SPEED - 1;
  let energy = 0;

  let facing = 1;
  let attackTimer = 0;
  let attackCooldown = 0;
  let furyTimer = 0;
  let hurtTimer = 0;
  let spawnTimer = 0;
  let restTimer = 0;
  let overTimer = 0;

  let needRedraw = true;
  let lastMs = 0;

  const canvas = document.getElementById("game");
  const screen = canvas.getContext("2d");

  // The canvas being drawn on: the screen, or the saved scene while it is being built
  let g = screen;
  let scene = null;

  // Saved best score, kept between visits when the browser allows it
  try { highScore = parseInt(localStorage.getItem("fourFrontsBest"), 10) || 0; } catch (e) { highScore = 0; }

  // Returns the x position of a spot that is "tiles" tiles out along a lane
  function laneX(lane, tiles) {
    return CENTER_X + laneDx[lane] * tiles * TILE_SIZE;
  }

  // Returns the y position of a spot that is "tiles" tiles out along a lane
  function laneY(lane, tiles) {
    return CENTER_Y + laneDy[lane] * tiles * TILE_SIZE;
  }

  // Turns an OpenGL color (0.0 to 1.0 for each part) into a canvas color
  function color(r, gr, b, a) {
    const c = v => Math.round(Math.min(1, Math.max(0, v)) * 255);
    return a === undefined ? `rgb(${c(r)},${c(gr)},${c(b)})` : `rgba(${c(r)},${c(gr)},${c(b)},${a})`;
  }

  // Fills a shape given as a list of x, y pairs
  function fillPoints(points, style) {
    g.fillStyle = style;
    g.beginPath();
    g.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
    g.closePath();
    g.fill();
  }

  // Draws the outline of a shape given as a list of x, y pairs
  function strokePoints(points, style, width, closed) {
    g.strokeStyle = style;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(points[0], points[1]);
    for (let i = 2; i < points.length; i += 2) g.lineTo(points[i], points[i + 1]);
    if (closed) g.closePath();
    g.stroke();
  }

  // Draws a filled rectangle
  function drawRectangle(x1, y1, x2, y2, r, gr, b) {
    g.fillStyle = color(r, gr, b);
    g.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  }

  // Draws the outline of a square centered at (x, y)
  function drawSquareOutline(x, y, half, width, style) {
    strokePoints([x - half, y - half, x + half, y - half, x + half, y + half, x - half, y + half], style, width, true);
  }

  // Draws one solid disc (a filled circle with no outline)
  function drawDisc(x, y, radius, r, gr, b, a) {
    g.fillStyle = color(r, gr, b, a);
    g.beginPath();
    g.arc(x, y, Math.max(0, radius), 0, 2 * PI);
    g.fill();
  }

  // Draws a filled circle with a dark outline
  function drawFilledCircle(x, y, radius, r, gr, b) {
    drawDisc(x, y, radius, r, gr, b);
    g.strokeStyle = "#000";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, radius, 0, 2 * PI);
    g.stroke();
  }

  // Draws text with its left end at (x, y). The world is upside down for the canvas,
  // so the text is flipped back to read the right way up.
  function drawTextAt(x, y, text, font, style) {
    g.save();
    g.translate(x, y);
    g.scale(1, -1);
    g.font = font;
    g.fillStyle = style;
    g.textBaseline = "alphabetic";
    g.fillText(text, 0, 0);
    g.restore();
  }

  // Returns how wide a line of text is in the given font
  function textWidth(text, font) {
    g.font = font;
    return g.measureText(text).width;
  }

  // Draws text in the given font, centered left to right on the window
  function drawCenteredText(y, text, font, style) {
    drawTextAt((WINDOW_WIDTH - textWidth(text, font)) / 2, y, text, font, style);
  }

  // Draws a big light box with large text, centered left to right on the window
  function drawBigTextBox(y, text) {
    const width = textWidth(text, FONT_BIG) + 28;
    const height = 40;
    const x = (WINDOW_WIDTH - width) / 2;

    drawRectangle(x, y, x + width, y + height, 1.0, 1.0, 0.8);
    strokePoints([x, y, x + width, y, x + width, y + height, x, y + height], "#000", 2, true);
    drawTextAt(x + 14, y + 12, text, FONT_BIG, "#000");
  }

  // Puts everything back to the beginning (without starting the game)
  function resetGame() {
    for (const e of enemies) e.active = false;
    for (const e of effects) e.active = false;

    score = 0;
    speedLevel = START_SPEED - 1;
    energy = 0;
    facing = 1;
    attackTimer = 0;
    attackCooldown = 0;
    furyTimer = 0;
    hurtTimer = 0;
    spawnTimer = 0.4;
    restTimer = 0;
    overTimer = 0;
    needRedraw = true;
  }

  // Starts a new game
  function startGame() {
    resetGame();
    gameState = STATE_PLAYING;
  }

  // Starts a game from the title page, or from the game over screen after a short delay
  function tryStartGame() {
    // The title page can always be dismissed
    if (gameState === STATE_TITLE) {
      startGame();
    }
    // The game over screen waits a moment so an attack in progress does not restart it by accident
    else if (gameState === STATE_OVER && overTimer <= 0) {
      startGame();
    }
  }

  // Goes back to the title page (the browser version of X, which exits the desktop version)
  function showTitle() {
    resetGame();
    gameState = STATE_TITLE;
  }

  // Turns an enemy soldier into a poof after "delay" seconds (the time the sword takes to reach it)
  function addPoof(x, y, delay, lane) {
    for (const e of effects) {
      // Use the first free effect slot
      if (!e.active) {
        e.active = true;
        e.lane = lane;
        e.x = x;
        e.y = y;
        e.delay = delay;
        e.timeLeft = POOF_TIME;
        return;
      }
    }
  }

  // Returns how long an enemy soldier waits on a tile before hopping to the next one
  function stepTime() {
    return Math.max(MIN_STEP_TIME, START_STEP_TIME * Math.pow(SPEED_FACTOR, speedLevel));
  }

  // Returns how long it takes for the next enemy soldier to arrive
  function spawnInterval() {
    return Math.max(MIN_SPAWN_TIME, START_SPAWN_TIME * Math.pow(SPEED_FACTOR, speedLevel));
  }

  // Returns how much energy the meter loses each second. It drains faster as enemy soldiers arrive faster.
  function meterDrain() {
    return METER_DRAIN_PER_SECOND * (START_SPAWN_TIME / spawnInterval());
  }

  // Returns true if no enemy soldier is on (or still hopping off of) this tile number on any arm
  function tileNumberFree(number) {
    for (const e of enemies) {
      // Only enemy soldiers that are still walking count
      if (e.active) {
        // An enemy soldier standing on this tile number blocks it
        if (e.tile === number) return false;

        // An enemy soldier still hopping off this tile number blocks it too
        if (e.slide > 0 && e.tile + 1 === number) return false;
      }
    }
    return true;
  }

  // Sends a new enemy soldier onto the outer tile of a random arm
  function spawnEnemy() {
    for (const e of enemies) {
      // Take the first free enemy slot
      if (!e.active) {
        e.active = true;
        e.lane = Math.floor(Math.random() * 4);
        e.tile = ARM_TILES;
        e.slide = 0;
        e.moveTimer = stepTime();
        return;
      }
    }
  }

  // Fury attack: knocks out every enemy soldier on the screen
  function furyAttack() {
    furyTimer = FURY_TIME;

    for (const e of enemies) {
      // Knock out every enemy soldier that is still walking
      if (e.active) {
        const tiles = e.tile + e.slide;
        e.active = false;
        score++;
        addPoof(laneX(e.lane, tiles), laneY(e.lane, tiles), 0, e.lane);
      }
    }
  }

  // Adds energy to the meter. A completely full meter speeds up the game and sets off the fury attack.
  function addEnergy(amount) {
    energy = energy + amount;

    // The meter is full: it empties, the game gets faster, and the fury attack happens by itself
    if (energy >= 100) {
      energy = 0;
      speedLevel++;
      restTimer = REST_TIME;
      furyAttack();
    }
  }

  // The hero stabs with his sword along an arm and hits the closest enemy soldier in reach
  function attack(lane) {
    // Ignore attacks before the game starts, after it ends, or while still recovering
    if (gameState !== STATE_PLAYING || attackCooldown > 0) return;

    facing = lane;
    attackTimer = ATTACK_TIME;

    let target = -1;
    for (let i = 0; i < MAX_ENEMIES; i++) {
      // Look for an enemy soldier on this arm that is close enough for the sword to reach
      if (enemies[i].active && enemies[i].lane === lane && enemies[i].tile <= ATTACK_REACH_TILES) target = i;
    }

    // An enemy soldier was in reach, so it is knocked out
    if (target !== -1) {
      const tiles = enemies[target].tile;

      enemies[target].active = false;
      score++;
      addPoof(laneX(lane, tiles), laneY(lane, tiles), SWORD_CONTACT * ATTACK_TIME, lane);
      attackCooldown = HIT_COOLDOWN;
      addEnergy(ENERGY_PER_KILL);
    }
    // Nobody was in reach, so the stab misses
    else {
      attackCooldown = MISS_COOLDOWN;
    }
  }

  // An enemy soldier reached the hero. He has only one life, so the game is over.
  function hurtPlayer() {
    gameState = STATE_OVER;
    overTimer = GAME_OVER_DELAY;
    hurtTimer = 1.0;
    needRedraw = true;

    // Remember the best score
    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem("fourFrontsBest", String(highScore)); } catch (e) { /* storage is blocked */ }
    }
  }

  // Moves every enemy soldier: hop to the next tile when its timer runs out, or strike from tile 1
  function updateEnemies(dt) {
    for (const e of enemies) {
      // Skip empty slots
      if (!e.active) continue;

      // The enemy soldier is in the middle of a hop, so just let the hop finish
      if (e.slide > 0) {
        e.slide = Math.max(0, e.slide - dt / SLIDE_TIME);
        continue;
      }

      e.moveTimer = e.moveTimer - dt;

      // Not time to move yet
      if (e.moveTimer > 0) continue;

      // An enemy soldier on tile 1 strikes the hero
      if (e.tile === 1) {
        e.active = false;
        hurtPlayer();
      }
      // Otherwise hop to the next tile, but only if no other arm has an enemy soldier on that tile number
      else if (tileNumberFree(e.tile - 1)) {
        e.tile = e.tile - 1;
        e.slide = 1;
        e.moveTimer = stepTime();
      }
    }
  }

  // Moves everything forward by dt seconds
  function update(dt) {
    // The game over screen counts down before it accepts a new game
    if (gameState === STATE_OVER && overTimer > 0) {
      overTimer = overTimer - dt;
      needRedraw = true;
    }

    // Nothing moves on the title page or after the game is over
    if (gameState !== STATE_PLAYING) return;

    if (attackTimer > 0) attackTimer = attackTimer - dt;
    if (attackCooldown > 0) attackCooldown = attackCooldown - dt;
    if (furyTimer > 0) furyTimer = furyTimer - dt;

    // The meter slowly loses energy as time goes on
    if (energy > 0) energy = Math.max(0, energy - meterDrain() * dt);

    updateEnemies(dt);

    // After the fury attack, no new enemy soldiers arrive for a couple of seconds so the player can rest
    if (restTimer > 0) {
      restTimer = restTimer - dt;
      spawnTimer = 0;
    }
    // Otherwise enemy soldiers keep arriving as usual
    else {
      spawnTimer = spawnTimer + dt;

      // Time for the next enemy soldier, and the outer tile number must be free
      if (spawnTimer >= spawnInterval() && tileNumberFree(ARM_TILES)) {
        spawnTimer = 0;
        spawnEnemy();
      }
    }

    for (const e of effects) {
      // Effects fade after a short time
      if (e.active) {
        // The enemy soldier is still waiting for the blade to reach it, or the poof is playing
        if (e.delay > 0) e.delay = e.delay - dt;
        else e.timeLeft = e.timeLeft - dt;

        // This effect is finished
        if (e.timeLeft <= 0) e.active = false;
      }
    }
  }

  // The colors used by the background (the numbers match the BG_ constants above)
  const bgColors = [
    [0.62, 0.80, 0.36],
    [0.68, 0.86, 0.42],
    [0.33, 0.62, 0.34],
    [0.22, 0.48, 0.28],
    [0.93, 0.93, 0.60],
    [0.78, 0.64, 0.44],
    [0.62, 0.49, 0.33],
    [0.87, 0.76, 0.57],
    [0.67, 0.63, 0.59]
  ];

  // Returns a repeatable pseudo-random number from 0.0 to 1.0 for a spot on the grid.
  // Math.imul and >>> 0 copy the C++ unsigned int math, so the pattern matches the original.
  function hashNoise(x, y, seed) {
    let n = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 2246822519)) >>> 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177) >>> 0;
    n = (n ^ (n >>> 16)) >>> 0;
    return (n & 0xFFFF) / 65535;
  }

  // Returns smooth noise: a blobby pattern that changes slowly from place to place
  function smoothNoise(x, y, seed) {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    let fx = x - xi;
    let fy = y - yi;

    fx = fx * fx * (3 - 2 * fx);
    fy = fy * fy * (3 - 2 * fy);

    const a = hashNoise(xi, yi, seed);
    const b = hashNoise(xi + 1, yi, seed);
    const c = hashNoise(xi, yi + 1, seed);
    const d = hashNoise(xi + 1, yi + 1, seed);

    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }

  // Two layers of smooth noise: big blobs with smaller wiggles along their edges
  function blobNoise(x, y, seed) {
    return 0.7 * smoothNoise(x, y, seed) + 0.3 * smoothNoise(x * 2.3, y * 2.3, seed + 11);
  }

  // Returns true if this spot is under the stone platform (nothing needs to be drawn there)
  function underPlatform(x, y) {
    const reach = TILE_SIZE * (ARM_TILES + 0.5) - 2;
    const half = TILE_SIZE / 2 - 2;

    const inHorizontalArm = Math.abs(x - CENTER_X) < reach && y > CENTER_Y - half - 18 && y < CENTER_Y + half;
    const inVerticalArm = Math.abs(x - CENTER_X) < half && y > CENTER_Y - reach - 18 && y < CENTER_Y + reach;

    return inHorizontalArm || inVerticalArm;
  }

  // Draws a small rock from a few rectangles: a dark base, a rounded body, and a light top
  function drawRock(x, y, r, gr, b) {
    const p = BG_PIXEL;

    drawRectangle(x - 2.5 * p, y, x + 2.5 * p, y + p, r * 0.55, gr * 0.55, b * 0.55);
    drawRectangle(x - 3.5 * p, y + p, x + 3.5 * p, y + 2 * p, r * 0.8, gr * 0.8, b * 0.8);
    drawRectangle(x - 3.5 * p, y + 2 * p, x + 3.5 * p, y + 3 * p, r, gr, b);
    drawRectangle(x - 2.5 * p, y + 3 * p, x + 2.5 * p, y + 4 * p, r * 1.12, gr * 1.12, b * 1.12);
    drawRectangle(x - 1.5 * p, y + 4 * p, x + 0.5 * p, y + 5 * p, r * 1.22, gr * 1.22, b * 1.22);
  }

  // Draws a small tuft of grass: three thin blades of different heights
  function drawTuft(x, y, r, gr, b, p) {
    drawRectangle(x - p, y, x - p * 0.5, y + 2 * p, r, gr, b);
    drawRectangle(x, y, x + p * 0.5, y + 3 * p, r, gr, b);
    drawRectangle(x + p, y, x + p * 1.5, y + 2 * p, r, gr, b);
  }

  // Returns the x position of a spot measured in a figure's own directions: "forward" is the way the
  // figure faces (fx, fy) and "side" is to its left
  function partX(x, fx, fy, forward, side) {
    return x + fx * forward - fy * side;
  }

  // Returns the y position of a spot measured in a figure's own directions (see partX)
  function partY(y, fx, fy, forward, side) {
    return y + fy * forward + fx * side;
  }

  // Draws a filled shape given in the figure's own directions, with a thin dark outline
  function drawPart(x, y, fx, fy, forward, side, r, gr, b) {
    const points = [];
    for (let i = 0; i < forward.length; i++) {
      points.push(partX(x, fx, fy, forward[i], side[i]), partY(y, fx, fy, forward[i], side[i]));
    }
    fillPoints(points, color(r, gr, b));
    strokePoints(points, color(0.12, 0.10, 0.10), 1.5, true);
  }

  // Draws a rectangle in a figure's own directions, from forward1 to forward2 and from side1 to side2
  function drawPartRect(x, y, fx, fy, forward1, forward2, side1, side2, r, gr, b) {
    drawPart(x, y, fx, fy, [forward1, forward2, forward2, forward1], [side1, side1, side2, side2], r, gr, b);
  }

  // Draws a soldier seen from above, facing the way (fx, fy) points: a square helmet with a square
  // shoulder pad on each side. radius is half the width of the square he fills.
  function drawSoldier(x, y, fx, fy, R, armor, accent) {
    // Square shoulder pads on both sides, in the accent color
    drawPartRect(x, y, fx, fy, -0.55 * R, 0.50 * R, 0.62 * R, 1.00 * R, accent[0], accent[1], accent[2]);
    drawPartRect(x, y, fx, fy, -0.55 * R, 0.50 * R, -1.00 * R, -0.62 * R, accent[0], accent[1], accent[2]);

    // The square helmet in armor color, with its stripe and the dark visor slit at the front
    drawPartRect(x, y, fx, fy, -0.55 * R, 0.50 * R, -0.47 * R, 0.47 * R, armor[0], armor[1], armor[2]);
    drawPartRect(x, y, fx, fy, -0.55 * R, 0.50 * R, -0.08 * R, 0.08 * R, accent[0], accent[1], accent[2]);
    drawPartRect(x, y, fx, fy, 0.26 * R, 0.42 * R, -0.32 * R, 0.32 * R, 0.10, 0.10, 0.12);
  }

  // Draws a see-through dark disc, used for the soft shadow under things lying on the ground
  function drawShadowDisc(x, y, radius, alpha) {
    drawDisc(x, y, radius, 0, 0, 0, alpha);
  }

  // Draws a fallen soldier lying on the ground. angle is the way the head points.
  function drawFallenSoldier(x, y, angle, armor, accent) {
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);

    drawShadowDisc(x + 3, y - 4, 22, 0.22);

    // Legs, arms, then the body, the shoulder pads, and the helmet with its stripe
    drawPartRect(x, y, fx, fy, -34, -12, 2, 8, 0.28, 0.28, 0.31);
    drawPartRect(x, y, fx, fy, -34, -12, -8, -2, 0.28, 0.28, 0.31);
    drawPartRect(x, y, fx, fy, -2, 15, 13, 20, armor[0] * 0.85, armor[1] * 0.85, armor[2] * 0.85);
    drawPartRect(x, y, fx, fy, -2, 15, -20, -13, armor[0] * 0.85, armor[1] * 0.85, armor[2] * 0.85);
    drawPart(x, y, fx, fy, [-12, -8, 8, 12, 12, 8, -8, -12], [-11, -16, -16, -11, 11, 16, 16, 11], armor[0] * 0.9, armor[1] * 0.9, armor[2] * 0.9);
    drawPartRect(x, y, fx, fy, -1, 11, 10, 21, accent[0] * 0.9, accent[1] * 0.9, accent[2] * 0.9);
    drawPartRect(x, y, fx, fy, -1, 11, -21, -10, accent[0] * 0.9, accent[1] * 0.9, accent[2] * 0.9);
    drawPartRect(x, y, fx, fy, 11, 29, -9, 9, 0.62, 0.64, 0.68);
    drawPartRect(x, y, fx, fy, 11, 29, -1.6, 1.6, accent[0] * 0.9, accent[1] * 0.9, accent[2] * 0.9);
  }

  // Draws a sword lying on the ground, with the tip pointing at the given angle
  function drawGroundSword(x, y, angle, length, r, gr, b) {
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);

    drawShadowDisc(x + fx * length * 0.4 + 2, y + fy * length * 0.4 - 3, 9, 0.15);

    drawPart(x, y, fx, fy, [0, length * 0.85, length, length * 0.85, 0], [-2.6, -2.0, 0, 2.0, 2.6], r, gr, b);
    drawPartRect(x, y, fx, fy, -3, 1.5, -7, 7, 0.78, 0.62, 0.22);
    drawPartRect(x, y, fx, fy, -12, -3, -2, 2, 0.40, 0.26, 0.12);
  }

  // Draws a round shield lying on the ground, with a colored rim
  function drawShield(x, y, radius, accent) {
    drawShadowDisc(x + 3, y - 4, radius, 0.20);
    drawFilledCircle(x, y, radius, accent[0] * 0.9, accent[1] * 0.9, accent[2] * 0.9);
    drawFilledCircle(x, y, radius * 0.70, 0.58, 0.60, 0.64);
    drawFilledCircle(x, y, radius * 0.24, 0.36, 0.37, 0.41);
  }

  // Draws a helmet lying on the ground, with a highlight on top and a dark visor slit
  function drawHelmetPiece(x, y, angle) {
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);

    drawShadowDisc(x + 2, y - 3, 11, 0.20);
    drawFilledCircle(x, y, 11, 0.50, 0.52, 0.57);
    drawFilledCircle(partX(x, fx, fy, -2, 2.5), partY(y, fx, fy, -2, 2.5), 5, 0.68, 0.70, 0.75);
    drawPartRect(x, y, fx, fy, 4, 10, -5, 5, 0.12, 0.12, 0.14);
  }

  // Draws a breastplate lying on the ground, with a stripe in the accent color
  function drawBreastplate(x, y, angle, accent) {
    const fx = Math.cos(angle);
    const fy = Math.sin(angle);

    drawShadowDisc(x + 3, y - 4, 16, 0.20);
    drawPart(x, y, fx, fy, [-13, -9, 9, 13, 13, 9, -9, -13], [-9, -15, -15, -9, 9, 15, 15, 9], 0.58, 0.60, 0.64);
    drawPartRect(x, y, fx, fy, -9, 9, -2, 2, accent[0] * 0.9, accent[1] * 0.9, accent[2] * 0.9);
  }

  // Draws what is left of a battle in the background: fallen soldiers, swords, and pieces of armor
  function drawBattlefieldProps() {
    drawFallenSoldier(130, 545, 0.45, HERO_ARMOR, BLUE_ACCENT);
    drawFallenSoldier(455, 600, 3.50, ENEMY_ARMOR, RED_ACCENT);
    drawFallenSoldier(110, 270, 1.95, ENEMY_ARMOR, RED_ACCENT);
    drawFallenSoldier(470, 255, 2.80, HERO_ARMOR, BLUE_ACCENT);
    drawFallenSoldier(215, 70, 0.35, ENEMY_ARMOR, RED_ACCENT);
    drawFallenSoldier(425, 75, 5.70, HERO_ARMOR, BLUE_ACCENT);

    drawGroundSword(205, 505, 0.60, 38, 0.78, 0.80, 0.84);
    drawGroundSword(395, 530, 2.20, 34, 0.66, 0.60, 0.56);
    drawGroundSword(60, 300, 1.40, 36, 0.78, 0.80, 0.84);
    drawGroundSword(535, 290, 0.25, 32, 0.66, 0.60, 0.56);
    drawGroundSword(175, 135, 3.50, 38, 0.78, 0.80, 0.84);
    drawGroundSword(360, 150, 1.15, 34, 0.66, 0.60, 0.56);
    drawGroundSword(300, 55, 1.75, 36, 0.78, 0.80, 0.84);
    drawGroundSword(100, 650, 2.80, 36, 0.66, 0.60, 0.56);
    drawGroundSword(495, 665, 0.70, 38, 0.78, 0.80, 0.84);
    drawGroundSword(205, 600, 1.20, 30, 0.66, 0.60, 0.56);

    drawShield(180, 650, 17, BLUE_ACCENT);
    drawShield(430, 500, 17, RED_ACCENT);
    drawHelmetPiece(85, 235, 0.8);
    drawHelmetPiece(520, 225, 2.4);
    drawHelmetPiece(250, 60, 4.0);
    drawHelmetPiece(385, 625, 5.2);
    drawBreastplate(180, 240, 0.3, BLUE_ACCENT);
    drawBreastplate(410, 200, 1.2, RED_ACCENT);
  }

  // Works out what each chunky pixel of the background is made of: grass, shade, sun, or dirt
  function backgroundCells() {
    const cells = [];

    for (let row = 0; row < BG_ROWS; row++) {
      cells.push(new Array(BG_COLS));
      for (let col = 0; col < BG_COLS; col++) {
        const x = (col + 0.5) * BG_PIXEL;
        const y = (row + 0.5) * BG_PIXEL;

        // Nothing is drawn under the stone platform
        if (underPlatform(x, y)) {
          cells[row][col] = BG_NONE;
          continue;
        }

        let shade = blobNoise(col / 12, row / 12, 1);
        let dirt = blobNoise(col / 10 + 20, row / 10 + 9, 2);
        const sun = blobNoise(col / 8 + 70, row / 8 + 5, 3);

        // The top of the screen is in deep shade so the score and the meter are easy to see
        if (y > 560) shade = shade + (y - 560) / 130 * 0.55;

        // How far this spot is from the platform arms (more dirt is worn into the ground close to them)
        let pathDistance = Math.abs(y - CENTER_Y);
        if (y > 100 && y < 700 && Math.abs(x - CENTER_X) < pathDistance) pathDistance = Math.abs(x - CENTER_X);
        if (pathDistance < 110) dirt = dirt + (110 - pathDistance) / 110 * 0.10;

        let type = BG_LIGHT;

        // Deep shade, then shade, then sunlit patches on the plain light grass
        if (shade > 0.76) type = BG_DEEP;
        else if (shade > 0.64) type = BG_SHADE;
        else if (sun > 0.70) type = BG_SUN;

        // Dirt patches go on top of everything except the very top of the screen
        if (dirt > DIRT_LEVEL && y < 680) type = BG_DIRT;

        // A few lighter specks in the plain grass
        if (type === BG_LIGHT && hashNoise(col, row, 5) < 0.05) type = BG_LIGHT2;

        cells[row][col] = type;
      }
    }

    // Give each dirt patch a darker edge, a few lighter specks inside, and a few small pebbles
    for (let row = 1; row < BG_ROWS - 1; row++) {
      for (let col = 1; col < BG_COLS - 1; col++) {
        if (cells[row][col] !== BG_DIRT) continue;

        const grass = (r, c) => cells[r][c] !== BG_DIRT && cells[r][c] !== BG_NONE;
        const edge = grass(row, col - 1) || grass(row, col + 1) || grass(row - 1, col) || grass(row + 1, col);
        const chance = hashNoise(col, row, 6);

        if (edge) cells[row][col] = BG_DIRT_EDGE;
        else if (chance < 0.07) cells[row][col] = BG_DIRT_SPECK;
        else if (chance > 0.97) cells[row][col] = BG_PEBBLE;
      }
    }
    return cells;
  }

  // Draws the outline of the whole cross shape as one shape. dx and dy move it, and grow makes it bigger.
  function drawCrossShape(dx, dy, grow, style) {
    const half = TILE_SIZE / 2 + grow;
    const reach = TILE_SIZE * (ARM_TILES + 0.5) + grow;
    const cx = CENTER_X + dx;
    const cy = CENTER_Y + dy;

    fillPoints([
      cx - reach, cy - half, cx - half, cy - half, cx - half, cy - reach, cx + half, cy - reach,
      cx + half, cy - half, cx + reach, cy - half, cx + reach, cy + half, cx + half, cy + half,
      cx + half, cy + reach, cx - half, cy + reach, cx - half, cy + half, cx - reach, cy + half
    ], style);
  }

  // Draws one square stone tile centered at (cx, cy)
  function drawTile(cx, cy) {
    const half = TILE_SIZE / 2;
    const seedX = Math.trunc(cx);
    const seedY = Math.trunc(cy);

    // Each tile is a tiny bit lighter or darker than the others
    const variation = (hashNoise(seedX, seedY, 31) - 0.5) * 0.07;

    drawRectangle(cx - half, cy - half, cx + half, cy + half, STONE[0] + variation, STONE[1] + variation, STONE[2] + variation);

    // Light edge along the top and left, dark edge along the bottom and right
    drawRectangle(cx - half, cy + half - 4, cx + half, cy + half, STONE_LIGHT[0], STONE_LIGHT[1], STONE_LIGHT[2]);
    drawRectangle(cx - half, cy - half, cx - half + 4, cy + half, STONE_LIGHT[0], STONE_LIGHT[1], STONE_LIGHT[2]);
    drawRectangle(cx - half, cy - half, cx + half, cy - half + 4, STONE_DARK[0], STONE_DARK[1], STONE_DARK[2]);
    drawRectangle(cx + half - 4, cy - half, cx + half, cy + half, STONE_DARK[0], STONE_DARK[1], STONE_DARK[2]);

    // Small light and dark specks of stone
    for (let i = 0; i < 5; i++) {
      const x = cx - half + 10 + hashNoise(seedX, seedY, 40 + i) * (TILE_SIZE - 24);
      const y = cy - half + 10 + hashNoise(seedX, seedY, 50 + i) * (TILE_SIZE - 24);

      if (i % 2 === 0) drawRectangle(x, y, x + 4, y + 4, STONE_LIGHT[0] - 0.04, STONE_LIGHT[1] - 0.04, STONE_LIGHT[2] - 0.04);
      else drawRectangle(x, y, x + 4, y + 4, STONE_DARK[0] + 0.06, STONE_DARK[1] + 0.06, STONE_DARK[2] + 0.06);
    }

    // Two specks of sand that blew onto the stone
    for (let i = 0; i < 2; i++) {
      const x = cx - half + 8 + hashNoise(seedX, seedY, 90 + i) * (TILE_SIZE - 20);
      const y = cy - half + 8 + hashNoise(seedX, seedY, 95 + i) * (TILE_SIZE - 20);
      const c = bgColors[BG_DIRT_SPECK];
      drawRectangle(x, y, x + 6, y + 4, c[0], c[1], c[2]);
    }

    // Some tiles have a crack
    if (hashNoise(seedX, seedY, 65) > 0.55) {
      const x1 = cx - half + 14 + hashNoise(seedX, seedY, 66) * (TILE_SIZE - 40);
      const y1 = cy - half + 24 + hashNoise(seedX, seedY, 67) * (TILE_SIZE - 48);

      strokePoints([
        x1, y1,
        x1 + (hashNoise(seedX, seedY, 68) - 0.5) * 16, y1 - 9,
        x1 + (hashNoise(seedX, seedY, 69) - 0.5) * 16, y1 - 19
      ], color(STONE_DARK[0] - 0.10, STONE_DARK[1] - 0.10, STONE_DARK[2] - 0.10), 2, false);
    }

    // Some tiles have a little moss in one corner
    if (hashNoise(seedX, seedY, 60) > 0.45) {
      const cornerX = hashNoise(seedX, seedY, 61) > 0.5 ? cx + half - 18 : cx - half + 4;
      const cornerY = hashNoise(seedX, seedY, 62) > 0.5 ? cy + half - 16 : cy - half + 4;

      drawRectangle(cornerX, cornerY, cornerX + 14, cornerY + 8, 0.36, 0.56, 0.28);
      drawRectangle(cornerX + 4, cornerY + 8, cornerX + 12, cornerY + 12, 0.36, 0.56, 0.28);
      drawRectangle(cornerX + 2, cornerY + 2, cornerX + 8, cornerY + 6, 0.47, 0.67, 0.34);
    }

    drawSquareOutline(cx, cy, half, 2, color(STONE_OUTLINE[0], STONE_OUTLINE[1], STONE_OUTLINE[2]));
  }

  // Draws bits of sand, dirt, and grass that have crept over the edges of the platform
  function drawEdgeDrift() {
    const half = TILE_SIZE / 2;
    const reach = TILE_SIZE * (ARM_TILES + 0.5);
    const left = CENTER_X - reach;
    const right = CENTER_X + reach;
    const armTop = CENTER_Y + half;
    const frontBottom = CENTER_Y - half - 22;
    const armEndTop = CENTER_Y + reach;
    const armEndBottom = CENTER_Y - reach;

    // The edges of the platform, each given as a start point and an end point (x1, y1, x2, y2)
    const edges = [
      [left, armTop, CENTER_X - half, armTop], [CENTER_X + half, armTop, right, armTop],
      [left, frontBottom, left, armTop], [right, frontBottom, right, armTop],
      [left, frontBottom, CENTER_X - half, frontBottom], [CENTER_X + half, frontBottom, right, frontBottom],
      [CENTER_X - half, armEndTop, CENTER_X + half, armEndTop],
      [CENTER_X - half, armTop, CENTER_X - half, armEndTop], [CENTER_X + half, armTop, CENTER_X + half, armEndTop],
      [CENTER_X - half, armEndBottom - 22, CENTER_X - half, frontBottom], [CENTER_X + half, armEndBottom - 22, CENTER_X + half, frontBottom],
      [CENTER_X - half, armEndBottom - 22, CENTER_X + half, armEndBottom - 22]
    ];

    for (let i = 0; i < 70; i++) {
      const edge = Math.trunc(hashNoise(i, 1, 80) * 12) % 12;
      const t = hashNoise(i, 2, 81);
      const x = edges[edge][0] + (edges[edge][2] - edges[edge][0]) * t;
      const y = edges[edge][1] + (edges[edge][3] - edges[edge][1]) * t;
      const size = 4 + hashNoise(i, 3, 82) * 6;
      const kind = hashNoise(i, 4, 83);

      // Mostly dirt and sand, sometimes a bit of grass
      const c = kind < 0.45 ? bgColors[BG_DIRT] : kind < 0.75 ? bgColors[BG_DIRT_SPECK] : [0.42, 0.62, 0.32];
      drawRectangle(x - size, y - size * 0.6, x + size, y + size * 0.6, c[0], c[1], c[2]);
    }
  }

  // Draws the 13 tiles: the center tile plus 3 tiles on each of the 4 arms
  function drawPlatform() {
    const half = TILE_SIZE / 2;
    const outline = color(STONE_OUTLINE[0], STONE_OUTLINE[1], STONE_OUTLINE[2]);

    // A faint shadow on the ground, moved down and to the right of the platform
    drawCrossShape(5, -7, 0, "rgba(0,0,0,0.14)");

    // A thin, soft outline around the whole platform
    drawCrossShape(0, 0, 2.5, outline);

    // Front edge under the left arm, the right arm, and the end of the bottom arm
    for (let k = 1; k <= ARM_TILES; k++) {
      drawRectangle(laneX(0, k) - half, CENTER_Y - half - 22, laneX(0, k) + half, CENTER_Y - half, STONE_FRONT[0], STONE_FRONT[1], STONE_FRONT[2]);
      drawRectangle(laneX(1, k) - half, CENTER_Y - half - 22, laneX(1, k) + half, CENTER_Y - half, STONE_FRONT[0], STONE_FRONT[1], STONE_FRONT[2]);
    }
    drawRectangle(CENTER_X - half, laneY(3, ARM_TILES) - half - 22, CENTER_X + half, laneY(3, ARM_TILES) - half, STONE_FRONT[0], STONE_FRONT[1], STONE_FRONT[2]);

    // A soft line along the bottom of the front edge
    strokePoints([laneX(0, ARM_TILES) - half, CENTER_Y - half - 22, CENTER_X - half, CENTER_Y - half - 22], outline, 2, false);
    strokePoints([CENTER_X + half, CENTER_Y - half - 22, laneX(1, ARM_TILES) + half, CENTER_Y - half - 22], outline, 2, false);
    strokePoints([CENTER_X - half, laneY(3, ARM_TILES) - half - 22, CENTER_X + half, laneY(3, ARM_TILES) - half - 22], outline, 2, false);

    drawTile(CENTER_X, CENTER_Y);
    for (let lane = 0; lane < 4; lane++) {
      for (let k = 1; k <= ARM_TILES; k++) drawTile(laneX(lane, k), laneY(lane, k));
    }

    // Tufts of grass poking over the top edge of the left and right arms
    for (let i = 0; i < 22; i++) {
      const x = CENTER_X - 266 + 14 + hashNoise(i, 7, 70) * 520;

      // Skip the spot where the up arm meets the sideways arms
      if (Math.abs(x - CENTER_X) > half + 10) drawSmallTuft(x, CENTER_Y + half + 4);
    }

    // And along the sides of the up arm
    for (let i = 0; i < 14; i++) {
      const y = CENTER_Y + half + 16 + hashNoise(i, 9, 71) * 200;
      drawSmallTuft(hashNoise(i, 3, 72) > 0.5 ? CENTER_X - half - 8 : CENTER_X + half + 8, y);
    }

    drawEdgeDrift();
  }

  // Draws a small tuft of grass that pokes up over the edge of the platform
  function drawSmallTuft(x, y) {
    const p = 5;

    drawRectangle(x - p, y, x - p * 0.5, y + 2 * p, 0.25, 0.50, 0.25);
    drawRectangle(x, y, x + p * 0.5, y + 3 * p, 0.30, 0.58, 0.30);
    drawRectangle(x + p, y, x + p * 1.5, y + 2 * p, 0.25, 0.50, 0.25);
  }

  // Builds the background and the platform once and saves them as an image, like the display lists.
  // The chunky pixels go through a tiny 75 x 100 image that is stretched without smoothing, so they stay crisp.
  function buildScene() {
    const cells = backgroundCells();
    const pixels = document.createElement("canvas");
    pixels.width = BG_COLS;
    pixels.height = BG_ROWS;
    const pg = pixels.getContext("2d");
    const image = pg.createImageData(BG_COLS, BG_ROWS);

    for (let row = 0; row < BG_ROWS; row++) {
      for (let col = 0; col < BG_COLS; col++) {
        // Plain light grass is the clear color, and the platform covers its own spots
        const type = cells[row][col] === BG_NONE ? BG_LIGHT : cells[row][col];
        const at = (row * BG_COLS + col) * 4;
        image.data[at] = Math.round(bgColors[type][0] * 255);
        image.data[at + 1] = Math.round(bgColors[type][1] * 255);
        image.data[at + 2] = Math.round(bgColors[type][2] * 255);
        image.data[at + 3] = 255;
      }
    }
    pg.putImageData(image, 0, 0);

    scene = document.createElement("canvas");
    scene.width = canvas.width;
    scene.height = canvas.height;
    g = scene.getContext("2d");
    useWorld(g, scene);

    // Row 0 of the image is the bottom of the world, which is where the flipped world puts it
    g.imageSmoothingEnabled = false;
    g.drawImage(pixels, 0, 0, WINDOW_WIDTH, WINDOW_HEIGHT);

    // Tufts of grass, placed in repeatable "random" spots
    for (let t = 0; t < 150; t++) {
      const col = 2 + Math.trunc(hashNoise(t, 1, 21) * (BG_COLS - 5));
      const row = 1 + Math.trunc(hashNoise(t, 2, 22) * (BG_ROWS - 8));
      const type = cells[row][col];
      const x = col * BG_PIXEL;
      const y = row * BG_PIXEL;

      // Tufts only grow on grass: not on dirt, not under the platform, not in the deep shade at the top
      if (type === BG_NONE || type >= BG_DIRT || y > 690) continue;

      // Darker tufts on the light grass, lighter ones in the shade
      if (type === BG_SHADE || type === BG_DEEP) drawTuft(x, y, 0.40, 0.68, 0.42, BG_PIXEL);
      else drawTuft(x, y, 0.30, 0.58, 0.30, BG_PIXEL);
    }

    drawRock(70, 70, 0.55, 0.57, 0.66);
    drawRock(525, 150, 0.60, 0.55, 0.50);
    drawRock(55, 610, 0.56, 0.58, 0.66);
    drawRock(548, 545, 0.55, 0.57, 0.66);
    drawRock(150, 190, 0.60, 0.55, 0.50);

    drawBattlefieldProps();
    drawPlatform();

    g = screen;
  }

  // Points a drawing surface at the 600 x 800 world, with y pointing up like gluOrtho2D
  function useWorld(context, surface) {
    const s = surface.width / WINDOW_WIDTH;
    context.setTransform(s, 0, 0, -s, 0, surface.height);
    context.lineJoin = "miter";
  }

  // Draws every enemy soldier that is still walking
  function drawEnemies() {
    for (const e of enemies) {
      if (!e.active) continue;

      const tiles = e.tile + e.slide;
      const x = laneX(e.lane, tiles);
      const y = laneY(e.lane, tiles);

      // An enemy soldier with dark armor and red accents, facing the hero
      drawSoldier(x, y, -laneDx[e.lane], -laneDy[e.lane], ENEMY_RADIUS, ENEMY_ARMOR, RED_ACCENT);

      // Red ring warns that an enemy soldier on tile 1 is about to strike
      if (e.tile === 1 && e.slide <= 0 && e.moveTimer < 0.15) drawSquareOutline(x, y, ENEMY_RADIUS + 5, 3, color(1, 0.1, 0.1));
    }
  }

  // Draws one filled part of the sword with a dark outline. a is the distance along the blade from
  // the hero, l is the distance to the side, and shift moves the whole sword along the way it points.
  function drawSwordPart(angle, shift, a, l, r, gr, b) {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const points = [];
    for (let i = 0; i < a.length; i++) {
      points.push(CENTER_X + (a[i] + shift) * c - l[i] * s, CENTER_Y + (a[i] + shift) * s + l[i] * c);
    }
    fillPoints(points, color(r, gr, b));
    strokePoints(points, color(0.1, 0.1, 0.1), 2, true);
  }

  // Draws the sword pointing at the given angle, moved forward by shift: a handle, a crossguard, and a pointed blade
  function drawSword(angle, shift) {
    drawSwordPart(angle, shift, [14, 26, 26, 14], [-2.5, -2.5, 2.5, 2.5], 0.45, 0.28, 0.12);
    drawSwordPart(angle, shift, [26, 30, 30, 26], [-9, -9, 9, 9], 0.95, 0.75, 0.20);
    drawSwordPart(angle, shift, [30, 82, 92, 82, 30], [-4.5, -3.2, 0, 3.2, 4.5], 0.88, 0.92, 0.95);
  }

  // Draws the sword stabbing straight out along the attack direction. progress goes from 0 to 1:
  // the sword thrusts out fast, is fully out at SWORD_CONTACT, and then pulls back.
  function drawSwordStab(lane, progress) {
    const angle = Math.atan2(laneDy[lane], laneDx[lane]);
    const out = progress < SWORD_CONTACT
      ? Math.sin(0.5 * PI * progress / SWORD_CONTACT)
      : Math.cos(0.5 * PI * (progress - SWORD_CONTACT) / (1 - SWORD_CONTACT));

    drawSword(angle, -SWORD_STAB + 2 * SWORD_STAB * out);
  }

  // Draws the fury attack: swords fly out from the hero in every direction, like the spokes of a wheel
  function drawFurySwords(progress) {
    // The swords start fast and slow down a little as they fly
    const out = 1 - (1 - progress) * (1 - progress);

    for (let i = 0; i < FURY_SWORDS; i++) drawSword(2 * PI * i / FURY_SWORDS, -14 + out * 420);
  }

  // Draws the puffs of one poof: a middle puff and six puffs around it that spread out
  function drawPoofPuffs(x, y, progress, extra, r, gr, b) {
    const spread = 10 + progress * 22;
    const size = 1 - progress * progress;

    drawDisc(x, y, 20 * size + extra, r, gr, b);
    for (let i = 0; i < 6; i++) {
      const angle = i * PI / 3 + 0.3;
      drawDisc(x + spread * Math.cos(angle), y + spread * Math.sin(angle), 14 * size + extra, r, gr, b);
    }
  }

  // Draws a puff of smoke: overlapping white circles with a soft gray edge that spread out and shrink away
  function drawPoof(x, y, progress) {
    drawPoofPuffs(x, y, progress, 2.5, 0.55, 0.58, 0.64);
    drawPoofPuffs(x, y, progress, 0, 0.96, 0.96, 0.97);
  }

  // Draws the hero, his sword stab, and the fury attack
  function drawPlayer() {
    // The hero: a soldier with silver armor and blue accents, facing the way he attacked last
    drawSoldier(CENTER_X, CENTER_Y, laneDx[facing], laneDy[facing], PLAYER_RADIUS, HERO_ARMOR, BLUE_ACCENT);

    // The sword stabs while an attack is happening
    if (attackTimer > 0) drawSwordStab(facing, 1 - attackTimer / ATTACK_TIME);

    // Red ring when an enemy soldier has reached the hero
    if (hurtTimer > 0) drawSquareOutline(CENTER_X, CENTER_Y, PLAYER_RADIUS + 6, 4, color(1, 0.1, 0.1));

    // The fury attack: swords fly out from the hero in every direction
    if (furyTimer > 0) drawFurySwords((FURY_TIME - furyTimer) / FURY_TIME);
  }

  // Draws the enemy soldiers waiting to be cut, and the poofs
  function drawEffects() {
    for (const e of effects) {
      if (!e.active) continue;

      // The blade has not reached the enemy soldier yet, so it is still standing there
      if (e.delay > 0) drawSoldier(e.x, e.y, -laneDx[e.lane], -laneDy[e.lane], ENEMY_RADIUS, ENEMY_ARMOR, RED_ACCENT);
      // The blade made contact, so the enemy soldier turns into a poof
      else drawPoof(e.x, e.y, 1 - e.timeLeft / POOF_TIME);
    }
  }

  // Draws the meter and the score number
  function drawHud() {
    // Meter frame
    drawRectangle(100, 760, 500, 790, 0.1, 0.1, 0.1);

    // The meter stays full for a moment while the fury attack plays
    const shown = furyTimer > 0 ? 100 : energy;

    // The fill is orange when the meter is full and yellow otherwise
    if (shown >= 100) drawRectangle(104, 764, 104 + 392 * shown / 100, 786, 1.0, 0.55, 0.0);
    else drawRectangle(104, 764, 104 + 392 * shown / 100, 786, 1.0, 0.9, 0.2);

    drawCenteredText(706, String(score), FONT_BIG, "#fff");
  }

  // Draws the title page: the game name and the basic controls, on top of the platform
  function drawTitlePage() {
    drawBigTextBox(690, "FOUR FRONTS");

    // A dark see-through panel behind the controls so the white text is easy to read
    const panel = [70, 478, 530, 478, 530, 648, 70, 648];
    fillPoints(panel, color(0.05, 0.12, 0.07, 0.80));
    strokePoints(panel, color(1, 1, 0.8), 3, true);

    drawCenteredText(613, "CONTROLS", FONT_MEDIUM, color(1, 1, 0.8));
    drawCenteredText(573, "Arrow keys or W A S D  -  stab with the sword", FONT_MEDIUM, "#fff");
    drawCenteredText(538, "Click or tap  -  stab toward that side", FONT_MEDIUM, "#fff");
    drawCenteredText(503, "R  -  restart          X  -  title page", FONT_MEDIUM, "#fff");

    drawBigTextBox(45, "Click, tap, or press a key to start");
  }

  // Draws the game over message on top of the game
  function drawGameOver() {
    drawBigTextBox(580, `GAME OVER   Score: ${score}   Best: ${highScore}`);

    // The restart prompt appears after the short delay
    if (overTimer <= 0) drawBigTextBox(520, "Click, tap, or press a key to play again");
  }

  // Draws the whole screen
  function display() {
    useWorld(screen, canvas);
    screen.save();
    screen.setTransform(1, 0, 0, 1, 0, 0);
    screen.drawImage(scene, 0, 0);
    screen.restore();

    // The title page is drawn on top of the platform
    if (gameState === STATE_TITLE) {
      drawTitlePage();
    }
    // Otherwise draw the game
    else {
      drawEnemies();
      drawPlayer();
      drawEffects();
      drawHud();

      // The game over message goes on top of the frozen game
      if (gameState === STATE_OVER) drawGameOver();
    }
  }

  // Sizes the canvas to its place on the page (sharp on high-density screens) and rebuilds the saved scene
  function resize() {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(1, Math.round(box.width * dpr));

    // Nothing to do if the size did not change
    if (scene && canvas.width === width) return;

    canvas.width = width;
    canvas.height = Math.round(width * WINDOW_HEIGHT / WINDOW_WIDTH);
    buildScene();
    needRedraw = true;
  }

  // Moves the game forward by the real time since the last frame and draws it when something can change
  function frame(now) {
    // Limit the time so the game does not jump if the tab was hidden for a moment
    const elapsed = Math.min(100, now - lastMs);
    lastMs = now;

    update(elapsed / 1000);

    // The title page and the finished game over screen stay the same, so they are not drawn over and over
    if (gameState === STATE_PLAYING || needRedraw) {
      needRedraw = false;
      display();
    }
    requestAnimationFrame(frame);
  }

  // Keyboard controls. Keys held down do not repeat the stab.
  const KEY_LANES = {
    ArrowLeft: 0, KeyA: 0,
    ArrowRight: 1, KeyD: 1,
    ArrowUp: 2, KeyW: 2,
    ArrowDown: 3, KeyS: 3
  };

  window.addEventListener("keydown", event => {
    // Leave shortcuts that use Ctrl, Alt, or Command to the browser
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    // Tab, Shift, and other keys that move around the page or do nothing on their own
    if (["Tab", "Shift", "CapsLock"].includes(event.key)) return;

    // Keep the arrow keys and the space bar from scrolling the page
    if (event.code in KEY_LANES || event.code === "Space") event.preventDefault();
    if (event.repeat) return;

    // X and Escape go back to the title page
    if (event.code === "KeyX" || event.key === "Escape") {
      showTitle();
      return;
    }

    // On the title page or the game over screen, any other key starts a game
    if (gameState !== STATE_PLAYING) {
      tryStartGame();
      return;
    }

    if (event.code in KEY_LANES) attack(KEY_LANES[event.code]);
    else if (event.code === "KeyR") startGame();
  });

  // Clicking or tapping starts the game from the title page, and attacks toward that side while playing
  canvas.addEventListener("pointerdown", event => {
    event.preventDefault();

    // On the title page or the game over screen, any button starts a game
    if (gameState !== STATE_PLAYING) {
      tryStartGame();
      return;
    }

    // While playing, only the main button (or a finger) attacks
    if (event.button !== 0) return;

    const box = canvas.getBoundingClientRect();
    const dx = (event.clientX - box.left) / box.width * WINDOW_WIDTH - CENTER_X;
    const dy = WINDOW_HEIGHT - (event.clientY - box.top) / box.height * WINDOW_HEIGHT - CENTER_Y;

    // The click was farther sideways than up or down, so attack left or right. Otherwise up or down.
    if (Math.abs(dx) > Math.abs(dy)) attack(dx < 0 ? 0 : 1);
    else attack(dy > 0 ? 2 : 3);
  });

  // The right button would open a menu over the game
  canvas.addEventListener("contextmenu", event => event.preventDefault());

  window.addEventListener("resize", resize);

  // Wait for the fonts so the title page is measured with the right ones
  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(() => {
    resize();
    resetGame();
    gameState = STATE_TITLE;
    lastMs = performance.now();
    requestAnimationFrame(frame);
  });
})();
