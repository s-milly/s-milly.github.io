// Computer Graphics Game Project (Four Fronts)
//
// A title page shows the game name and the basic controls. Click a button
// (or press any key) to start.
//
// The platform has 13 tiles: 1 center tile where the hero stands and
// 4 arms with 3 tiles each. Tile 1 is next to the hero, tile 3 is the end of the arm.
// Enemy soldiers hop one tile at a time toward the hero. The hero has only one life:
// if an enemy soldier reaches him, the game is over.
//
// Rule: only one enemy soldier can be on a tile number at a time, across all arms.
// If an enemy soldier is on tile 1 of one arm, no other arm can have an enemy soldier on tile 1.
// That means at most 3 enemy soldiers are on the screen at once.
//
// Every knocked out enemy soldier is worth 1 point and fills the meter at the top.
// The meter also drains slowly as time goes on, so it takes steady fighting to fill it.
// When the meter is completely full, a fury attack happens by itself: swords fly out in every
// direction and knock out every enemy soldier on the screen, and the game gets faster.
// The game starts at Speed 1.
// After the fury attack, no new enemy soldiers arrive for a couple of seconds so the player can rest.
//
// The only text on the game screen is the score: a number in the top middle.
// Circles and simple shapes mark where the final art will go.
//
// Controls:
//   Arrow keys / W A S D - stab with the sword left, right, up, or down
//   Mouse click          - stab toward the side of the screen you click
//   R restart, X exit
//
// Extra keys for development:
//   T show/hide the placeholder labels, F show speed measurements (also printed in the console)
//
// World coordinate window size: 600 x 800
// Display window size: 600 x 800

#define _CRT_SECURE_NO_WARNINGS
#include <cstdlib>
#include <cstring>
#include <cstdio>
#include <cmath>
#include <ctime>

#ifdef _WIN32
#include <windows.h>
#define SLEEP_MS(ms) Sleep(ms)
#else
#include <unistd.h>
#define SLEEP_MS(ms) usleep((ms) * 1000)
#endif

#include <GL/glut.h>

// Troubleshooting switches. Change one, rebuild, and press F to compare the frames per second.
//   USE_TIMER:     false = the idle function drives the game, true = glutTimerFunc drives it
//   USE_SLEEP:     true = the idle function calls Sleep(1) between frames, false = it never rests
//   DOUBLE_BUFFER: true = two buffers and a swap, false = one buffer (it may flicker)
// FRAME_MS is the delay used in timer mode. MIN_FRAME_MS is the shortest time allowed
// between two frames in idle mode (about 80 frames per second at most).
const bool USE_TIMER = false;
const bool USE_SLEEP = true;
const bool DOUBLE_BUFFER = true;
const int FRAME_MS = 16;
const int MIN_FRAME_MS = 12;

// Returns the time in milliseconds from the computer's precise clock (not GLUT's clock)
double nowMs(void) {
#ifdef _WIN32
    static LARGE_INTEGER frequency = { 0 };
    LARGE_INTEGER counter;

    // Ask for the clock speed the first time only
    if (frequency.QuadPart == 0) {
        QueryPerformanceFrequency(&frequency);
    }
    QueryPerformanceCounter(&counter);
    return 1000.0 * (double)counter.QuadPart / (double)frequency.QuadPart;
#else
    timespec ts;
    clock_gettime(CLOCK_MONOTONIC, &ts);
    return (double)ts.tv_sec * 1000.0 + (double)ts.tv_nsec / 1000000.0;
#endif
}

const float PI = 3.14159265f;
const int WINDOW_WIDTH = 600;
const int WINDOW_HEIGHT = 800;
const int CIRCLE_SEGMENTS = 28;

const float CENTER_X = 300.0f;
const float CENTER_Y = 400.0f;
const float TILE_SIZE = 76.0f;
const int ARM_TILES = 3;

// Half the width of the square each soldier fills (a tile is 76 wide, so these fill most of a tile)
const float PLAYER_RADIUS = 32.0f;
const float ENEMY_RADIUS = 29.0f;
const int ATTACK_REACH_TILES = 1;
const float ATTACK_TIME = 0.16f;
const float SWORD_STAB = 14.0f;
const float SWORD_CONTACT = 0.40f;
const float POOF_TIME = 0.45f;

// The background is a grid of chunky pixels (BG_PIXEL world units wide)
const int BG_PIXEL = 8;
const int BG_COLS = WINDOW_WIDTH / BG_PIXEL;
const int BG_ROWS = WINDOW_HEIGHT / BG_PIXEL;

// How much of the ground turns into dirt (a smaller number gives more dirt)
const float DIRT_LEVEL = 0.60f;

// What each spot of the background is made of
const int BG_NONE = -1;
const int BG_LIGHT = 0;
const int BG_LIGHT2 = 1;
const int BG_SHADE = 2;
const int BG_DEEP = 3;
const int BG_SUN = 4;
const int BG_DIRT = 5;
const int BG_DIRT_EDGE = 6;
const int BG_DIRT_SPECK = 7;
const int BG_PEBBLE = 8;
const float HIT_COOLDOWN = 0.10f;
const float MISS_COOLDOWN = 0.25f;

// How long an enemy soldier waits on a tile, and how often new enemy soldiers arrive, at Speed 1.
// Both get shorter (faster) by SPEED_FACTOR for every speed level above Speed 1.
// The game starts at Speed 1, and each time the meter fills up the speed goes up by 1.
const float START_STEP_TIME = 0.45f;
const float MIN_STEP_TIME = 0.10f;
const float START_SPAWN_TIME = 0.80f;
const float MIN_SPAWN_TIME = 0.20f;
const float SPEED_FACTOR = 0.88f;
const int START_SPEED = 1;
const float SLIDE_TIME = 0.08f;

const int MAX_ENEMIES = 8;
const int MAX_EFFECTS = 10;
const float ENERGY_PER_KILL = 10.0f;

// How much energy the meter loses every second at Speed 1 (the whole meter is 100).
// The drain grows as enemy soldiers arrive faster, so the meter stays hard to fill at every speed.
// Set this to 0 for a meter that never drains.
const float METER_DRAIN_PER_SECOND = 5.0f;
const float FURY_TIME = 0.5f;
const int FURY_SWORDS = 12;
const float GAME_OVER_DELAY = 1.0f;
const float REST_TIME = 2.5f;

const int STATE_TITLE = 0;
const int STATE_PLAYING = 1;
const int STATE_OVER = 2;

// Colors of the stone platform: dusty sandstone close to the color of the ground, with a soft brown
// outline and front edge, so the platform looks like part of the ground instead of standing out
const float STONE[3] = { 0.74f, 0.69f, 0.58f };
const float STONE_LIGHT[3] = { 0.84f, 0.79f, 0.68f };
const float STONE_DARK[3] = { 0.60f, 0.55f, 0.45f };
const float STONE_OUTLINE[3] = { 0.45f, 0.38f, 0.29f };
const float STONE_FRONT[3] = { 0.55f, 0.47f, 0.36f };

// Colors of the soldiers: silver armor with blue accents for the hero, dark armor with red accents for the enemies
const float HERO_ARMOR[3] = { 0.66f, 0.70f, 0.76f };
const float ENEMY_ARMOR[3] = { 0.38f, 0.37f, 0.40f };
const float BLUE_ACCENT[3] = { 0.18f, 0.38f, 0.90f };
const float RED_ACCENT[3] = { 0.88f, 0.18f, 0.18f };

// Lane (arm) numbers: 0 = left, 1 = right, 2 = up, 3 = down
float laneDx[4] = { -1.0f, 1.0f, 0.0f, 0.0f };
float laneDy[4] = { 0.0f, 0.0f, 1.0f, -1.0f };

struct Enemy {
    bool active;
    int lane;
    int tile;
    float slide;
    float moveTimer;
};

// An enemy soldier that was hit by the sword. It stays visible until the blade reaches it
// (delay), then turns into a puff of smoke (a poof).
struct Effect {
    bool active;
    int lane;
    float x, y;
    float delay;
    float timeLeft;
};

Enemy enemies[MAX_ENEMIES];
Effect effects[MAX_EFFECTS];

int gameState = STATE_TITLE;
int score = 0;
int highScore = 0;
int speedLevel = START_SPEED - 1;
float energy = 0.0f;

int facing = 1;
float attackTimer = 0.0f;
float attackCooldown = 0.0f;
float furyTimer = 0.0f;
float hurtTimer = 0.0f;
float spawnTimer = 0.0f;
float restTimer = 0.0f;
float overTimer = 0.0f;

bool showLabels = false;
bool showFps = false;
bool timerArmed = false;
bool needRedraw = true;
double lastMs = 0.0;
double fpsStartMs = 0.0;
int framesThisSecond = 0;
int framesPerSecond = 0;

// Measurements shown when F is pressed. They help find what is slowing the game down.
double drawTotalMs = 0.0;
double swapTotalMs = 0.0;
double sleepTotalMs = 0.0;
int sleepCount = 0;
int loopsThisSecond = 0;
int loopsPerSecond = 0;
float shownDrawMs = 0.0f;
float shownSwapMs = 0.0f;
float shownSleepMs = 0.0f;
int clockStepAtStart = 0;
int clockChangesAtStart = 0;
char glInfo[200] = "";
bool fpsDirty = true;
GLuint fpsList = 0;
GLuint backgroundList = 0;
GLuint meterList = 0;

// Saved drawing for the parts of the screen that never change, so they are
// replayed with one call per frame instead of being drawn again from scratch
GLuint sceneList = 0;
GLuint scoreList = 0;
GLuint titleList = 0;
char scoreShown[80] = "";

// Points around a circle, worked out once so they are not recalculated every frame
float circleCos[CIRCLE_SEGMENTS + 1];
float circleSin[CIRCLE_SEGMENTS + 1];

void timerFrame(int value);

// Returns the x position of a spot that is "tiles" tiles out along a lane
float laneX(int lane, float tiles) {
    return CENTER_X + laneDx[lane] * tiles * TILE_SIZE;
}

// Returns the y position of a spot that is "tiles" tiles out along a lane
float laneY(int lane, float tiles) {
    return CENTER_Y + laneDy[lane] * tiles * TILE_SIZE;
}

// Draws a filled rectangle
void drawRectangle(float x1, float y1, float x2, float y2, float r, float g, float b) {
    glColor3f(r, g, b);
    glBegin(GL_POLYGON);
    glVertex2f(x1, y1);
    glVertex2f(x2, y1);
    glVertex2f(x2, y2);
    glVertex2f(x1, y2);
    glEnd();
}

// Draws a circle outline in the current color
void drawCircleOutline(float x, float y, float radius, float width) {
    glLineWidth(width);
    glBegin(GL_LINE_LOOP);
    for (int i = 0; i < CIRCLE_SEGMENTS; i++) {
        glVertex2f(x + radius * circleCos[i], y + radius * circleSin[i]);
    }
    glEnd();
}

// Draws the outline of a square centered at (x, y) in the current color
void drawSquareOutline(float x, float y, float half, float width) {
    glLineWidth(width);
    glBegin(GL_LINE_LOOP);
    glVertex2f(x - half, y - half);
    glVertex2f(x + half, y - half);
    glVertex2f(x + half, y + half);
    glVertex2f(x - half, y + half);
    glEnd();
}

// Draws a filled circle with a dark outline
void drawFilledCircle(float x, float y, float radius, float r, float g, float b) {
    glColor3f(r, g, b);
    glBegin(GL_TRIANGLE_FAN);
    glVertex2f(x, y);
    for (int i = 0; i <= CIRCLE_SEGMENTS; i++) {
        glVertex2f(x + radius * circleCos[i], y + radius * circleSin[i]);
    }
    glEnd();

    glColor3f(0.0f, 0.0f, 0.0f);
    drawCircleOutline(x, y, radius, 2.0f);
}

// Draws text starting at (x, y)
void drawText(float x, float y, const char* text) {
    glRasterPos2f(x, y);
    for (int i = 0; i < strlen(text); i++) {
        glutBitmapCharacter(GLUT_BITMAP_HELVETICA_12, text[i]);
    }
}

// Draws text in the given font, centered left to right on the window
void drawCenteredText(float y, const char* text, void* font) {
    float width = (float)glutBitmapLength(font, (const unsigned char*)text);

    glRasterPos2f(((float)WINDOW_WIDTH - width) / 2.0f, y);
    for (int i = 0; i < strlen(text); i++) {
        glutBitmapCharacter(font, text[i]);
    }
}

// Draws a light box with black text inside, sized to fit the text
void drawTextBox(float x, float y, const char* text) {
    float width = (float)strlen(text) * 7.0f + 12.0f;
    float height = 20.0f;

    drawRectangle(x, y, x + width, y + height, 1.0f, 1.0f, 0.8f);

    glColor3f(0.0f, 0.0f, 0.0f);
    glLineWidth(1.0f);
    glBegin(GL_LINE_LOOP);
    glVertex2f(x, y);
    glVertex2f(x + width, y);
    glVertex2f(x + width, y + height);
    glVertex2f(x, y + height);
    glEnd();

    drawText(x + 6.0f, y + 6.0f, text);
}

// Draws a big light box with large text, centered left to right on the window
void drawBigTextBox(float y, const char* text) {
    float width = (float)glutBitmapLength(GLUT_BITMAP_TIMES_ROMAN_24, (const unsigned char*)text) + 28.0f;
    float height = 40.0f;
    float x = ((float)WINDOW_WIDTH - width) / 2.0f;

    drawRectangle(x, y, x + width, y + height, 1.0f, 1.0f, 0.8f);

    glColor3f(0.0f, 0.0f, 0.0f);
    glLineWidth(2.0f);
    glBegin(GL_LINE_LOOP);
    glVertex2f(x, y);
    glVertex2f(x + width, y);
    glVertex2f(x + width, y + height);
    glVertex2f(x, y + height);
    glEnd();

    glRasterPos2f(x + 14.0f, y + 12.0f);
    for (int i = 0; i < strlen(text); i++) {
        glutBitmapCharacter(GLUT_BITMAP_TIMES_ROMAN_24, text[i]);
    }
}

// Puts everything back to the beginning (without starting the game)
void resetGame(void) {
    for (int i = 0; i < MAX_ENEMIES; i++) {
        enemies[i].active = false;
    }
    for (int i = 0; i < MAX_EFFECTS; i++) {
        effects[i].active = false;
    }

    score = 0;
    speedLevel = START_SPEED - 1;
    energy = 0.0f;
    facing = 1;
    attackTimer = 0.0f;
    attackCooldown = 0.0f;
    furyTimer = 0.0f;
    hurtTimer = 0.0f;
    spawnTimer = 0.4f;
    restTimer = 0.0f;
    overTimer = 0.0f;
    needRedraw = true;
}

// Starts a new game
void startGame(void) {
    resetGame();
    gameState = STATE_PLAYING;
}

// Starts a game from the title page, or from the game over screen after a short delay
void tryStartGame(void) {
    // The title page can always be dismissed
    if (gameState == STATE_TITLE) {
        startGame();
    }
    // The game over screen waits a moment so an attack in progress does not restart it by accident
    else if (gameState == STATE_OVER && overTimer <= 0.0f) {
        startGame();
    }
}

// Turns an enemy soldier into a poof after "delay" seconds (the time the sword takes to reach it)
void addPoof(float x, float y, float delay, int lane) {
    for (int i = 0; i < MAX_EFFECTS; i++) {
        // Use the first free effect slot
        if (!effects[i].active) {
            effects[i].active = true;
            effects[i].lane = lane;
            effects[i].x = x;
            effects[i].y = y;
            effects[i].delay = delay;
            effects[i].timeLeft = POOF_TIME;
            return;
        }
    }
}

// Returns how long an enemy soldier waits on a tile before hopping to the next one
float stepTime(void) {
    float time = START_STEP_TIME * (float)pow(SPEED_FACTOR, speedLevel);

    // Enemy soldiers never wait less than the minimum time
    if (time < MIN_STEP_TIME) {
        time = MIN_STEP_TIME;
    }
    return time;
}

// Returns how long it takes for the next enemy soldier to arrive
float spawnInterval(void) {
    float time = START_SPAWN_TIME * (float)pow(SPEED_FACTOR, speedLevel);

    // New enemy soldiers never arrive faster than the minimum time
    if (time < MIN_SPAWN_TIME) {
        time = MIN_SPAWN_TIME;
    }
    return time;
}

// Returns how much energy the meter loses each second. It drains faster as enemy soldiers arrive faster.
float meterDrain(void) {
    return METER_DRAIN_PER_SECOND * (START_SPAWN_TIME / spawnInterval());
}

// Returns true if no enemy soldier is on (or still hopping off of) this tile number on any arm
bool tileNumberFree(int number) {
    for (int i = 0; i < MAX_ENEMIES; i++) {
        // Only enemy soldiers that are still walking count
        if (enemies[i].active) {
            // An enemy soldier standing on this tile number blocks it
            if (enemies[i].tile == number) {
                return false;
            }

            // An enemy soldier still hopping off this tile number blocks it too
            if (enemies[i].slide > 0.0f && enemies[i].tile + 1 == number) {
                return false;
            }
        }
    }
    return true;
}

// Sends a new enemy soldier onto the outer tile of a random arm
void spawnEnemy(void) {
    for (int i = 0; i < MAX_ENEMIES; i++) {
        // Take the first free enemy slot
        if (!enemies[i].active) {
            enemies[i].active = true;
            enemies[i].lane = rand() % 4;
            enemies[i].tile = ARM_TILES;
            enemies[i].slide = 0.0f;
            enemies[i].moveTimer = stepTime();
            return;
        }
    }
}

// Fury attack: knocks out every enemy soldier on the screen
void furyAttack(void) {
    furyTimer = FURY_TIME;

    for (int i = 0; i < MAX_ENEMIES; i++) {
        // Knock out every enemy soldier that is still walking
        if (enemies[i].active) {
            float tiles = (float)enemies[i].tile + enemies[i].slide;
            enemies[i].active = false;
            score++;
            addPoof(laneX(enemies[i].lane, tiles), laneY(enemies[i].lane, tiles), 0.0f, enemies[i].lane);
        }
    }
}

// Adds energy to the meter. A completely full meter speeds up the game and sets off the fury attack.
void addEnergy(float amount) {
    energy = energy + amount;

    // The meter is full: it empties, the game gets faster, and the fury attack happens by itself
    if (energy >= 100.0f) {
        energy = 0.0f;
        speedLevel++;
        restTimer = REST_TIME;
        furyAttack();
    }
}

// The hero stabs with his sword along an arm and hits the closest enemy soldier in reach
void attack(int lane) {
    // Ignore attacks before the game starts, after it ends, or while still recovering
    if (gameState != STATE_PLAYING || attackCooldown > 0.0f) {
        return;
    }

    facing = lane;
    attackTimer = ATTACK_TIME;

    int target = -1;
    for (int i = 0; i < MAX_ENEMIES; i++) {
        // Look for an enemy soldier on this arm that is close enough for the sword to reach
        if (enemies[i].active && enemies[i].lane == lane && enemies[i].tile <= ATTACK_REACH_TILES) {
            target = i;
        }
    }

    // An enemy soldier was in reach, so it is knocked out
    if (target != -1) {
        // The hit happens at the tile the enemy soldier is on, which is where the blade can reach
        float tiles = (float)enemies[target].tile;

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
void hurtPlayer(void) {
    gameState = STATE_OVER;
    overTimer = GAME_OVER_DELAY;
    hurtTimer = 1.0f;
    needRedraw = true;

    // Remember the best score
    if (score > highScore) {
        highScore = score;
    }
}

// Moves every enemy soldier: hop to the next tile when its timer runs out, or strike from tile 1
void updateEnemies(float dt) {
    for (int i = 0; i < MAX_ENEMIES; i++) {
        // Skip empty slots
        if (!enemies[i].active) {
            continue;
        }

        // The enemy soldier is in the middle of a hop, so just let the hop finish
        if (enemies[i].slide > 0.0f) {
            enemies[i].slide = enemies[i].slide - dt / SLIDE_TIME;

            // The hop is done
            if (enemies[i].slide < 0.0f) {
                enemies[i].slide = 0.0f;
            }
            continue;
        }

        enemies[i].moveTimer = enemies[i].moveTimer - dt;

        // Not time to move yet
        if (enemies[i].moveTimer > 0.0f) {
            continue;
        }

        // An enemy soldier on tile 1 strikes the hero
        if (enemies[i].tile == 1) {
            enemies[i].active = false;
            hurtPlayer();
        }
        // Otherwise hop to the next tile, but only if no other arm has an enemy soldier on that tile number
        else if (tileNumberFree(enemies[i].tile - 1)) {
            enemies[i].tile = enemies[i].tile - 1;
            enemies[i].slide = 1.0f;
            enemies[i].moveTimer = stepTime();
        }
    }
}

// Moves everything forward by dt seconds
void update(float dt) {
    // The game over screen counts down before it accepts a new game
    if (gameState == STATE_OVER && overTimer > 0.0f) {
        overTimer = overTimer - dt;
        needRedraw = true;
    }

    // Nothing moves on the title page or after the game is over
    if (gameState != STATE_PLAYING) {
        return;
    }

    if (attackTimer > 0.0f) attackTimer = attackTimer - dt;
    if (attackCooldown > 0.0f) attackCooldown = attackCooldown - dt;
    if (furyTimer > 0.0f) furyTimer = furyTimer - dt;

    // The meter slowly loses energy as time goes on
    if (energy > 0.0f) {
        energy = energy - meterDrain() * dt;

        // The meter cannot go below empty
        if (energy < 0.0f) {
            energy = 0.0f;
        }
    }

    updateEnemies(dt);

    // After the bolt goes off, no new enemy soldiers arrive for a couple of seconds so the player can rest
    if (restTimer > 0.0f) {
        restTimer = restTimer - dt;
        spawnTimer = 0.0f;
    }
    // Otherwise enemy soldiers keep arriving as usual
    else {
        spawnTimer = spawnTimer + dt;

        // Time for the next enemy soldier, and the outer tile number must be free
        if (spawnTimer >= spawnInterval() && tileNumberFree(ARM_TILES)) {
            spawnTimer = 0.0f;
            spawnEnemy();
        }
    }

    for (int i = 0; i < MAX_EFFECTS; i++) {
        // Effects fade after a short time
        if (effects[i].active) {
            // The enemy soldier is still waiting for the blade to reach it
            if (effects[i].delay > 0.0f) {
                effects[i].delay = effects[i].delay - dt;
            }
            // The poof is playing
            else {
                effects[i].timeLeft = effects[i].timeLeft - dt;
            }

            // This effect is finished
            if (effects[i].timeLeft <= 0.0f) {
                effects[i].active = false;
            }
        }
    }
}

// The colors used by the background (the numbers match the BG_ constants above).
// The dirt colors (numbers 5 to 8) are a light, dusty wasteland brown.
float bgColors[9][3] = {
    { 0.62f, 0.80f, 0.36f },
    { 0.68f, 0.86f, 0.42f },
    { 0.33f, 0.62f, 0.34f },
    { 0.22f, 0.48f, 0.28f },
    { 0.93f, 0.93f, 0.60f },
    { 0.78f, 0.64f, 0.44f },
    { 0.62f, 0.49f, 0.33f },
    { 0.87f, 0.76f, 0.57f },
    { 0.67f, 0.63f, 0.59f }
};

// Returns a repeatable pseudo-random number from 0.0 to 1.0 for a spot on the grid
float hashNoise(int x, int y, int seed) {
    unsigned int n = (unsigned int)x * 374761393u + (unsigned int)y * 668265263u + (unsigned int)seed * 2246822519u;
    n = (n ^ (n >> 13)) * 1274126177u;
    n = n ^ (n >> 16);
    return (float)(n & 0xFFFFu) / 65535.0f;
}

// Returns smooth noise: a blobby pattern that changes slowly from place to place
float smoothNoise(float x, float y, int seed) {
    int xi = (int)floor(x);
    int yi = (int)floor(y);
    float fx = x - (float)xi;
    float fy = y - (float)yi;

    fx = fx * fx * (3.0f - 2.0f * fx);
    fy = fy * fy * (3.0f - 2.0f * fy);

    float a = hashNoise(xi, yi, seed);
    float b = hashNoise(xi + 1, yi, seed);
    float c = hashNoise(xi, yi + 1, seed);
    float d = hashNoise(xi + 1, yi + 1, seed);

    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

// Two layers of smooth noise: big blobs with smaller wiggles along their edges
float blobNoise(float x, float y, int seed) {
    return 0.7f * smoothNoise(x, y, seed) + 0.3f * smoothNoise(x * 2.3f, y * 2.3f, seed + 11);
}

// Returns true if this spot is under the stone platform (nothing needs to be drawn there)
bool underPlatform(float x, float y) {
    float reach = TILE_SIZE * ((float)ARM_TILES + 0.5f) - 2.0f;
    float half = TILE_SIZE / 2.0f - 2.0f;

    bool inHorizontalArm = fabs(x - CENTER_X) < reach && y > CENTER_Y - half - 18.0f && y < CENTER_Y + half;
    bool inVerticalArm = fabs(x - CENTER_X) < half && y > CENTER_Y - reach - 18.0f && y < CENTER_Y + reach;

    return inHorizontalArm || inVerticalArm;
}

// Draws one rectangle of one background color
void drawBgRect(float x1, float y1, float x2, float y2, int color) {
    drawRectangle(x1, y1, x2, y2, bgColors[color][0], bgColors[color][1], bgColors[color][2]);
}

// Draws a small rock from a few rectangles: a dark base, a rounded body, and a light top
void drawRock(float x, float y, float r, float g, float b) {
    float p = (float)BG_PIXEL;

    drawRectangle(x - 2.5f * p, y, x + 2.5f * p, y + p, r * 0.55f, g * 0.55f, b * 0.55f);
    drawRectangle(x - 3.5f * p, y + p, x + 3.5f * p, y + 2.0f * p, r * 0.8f, g * 0.8f, b * 0.8f);
    drawRectangle(x - 3.5f * p, y + 2.0f * p, x + 3.5f * p, y + 3.0f * p, r, g, b);
    drawRectangle(x - 2.5f * p, y + 3.0f * p, x + 2.5f * p, y + 4.0f * p, r * 1.12f, g * 1.12f, b * 1.12f);
    drawRectangle(x - 1.5f * p, y + 4.0f * p, x + 0.5f * p, y + 5.0f * p, r * 1.22f, g * 1.22f, b * 1.22f);
}

// Draws a small tuft of grass: three thin blades of different heights
void drawTuft(float x, float y, float r, float g, float b) {
    float p = (float)BG_PIXEL;

    drawRectangle(x - p, y, x - p * 0.5f, y + 2.0f * p, r, g, b);
    drawRectangle(x, y, x + p * 0.5f, y + 3.0f * p, r, g, b);
    drawRectangle(x + p, y, x + p * 1.5f, y + 2.0f * p, r, g, b);
}

// Returns the x position of a spot measured in a figure's own directions: "forward" is the way the
// figure faces (fx, fy) and "side" is to its left
float partX(float x, float fx, float fy, float forward, float side) {
    return x + fx * forward - fy * side;
}

// Returns the y position of a spot measured in a figure's own directions (see partX)
float partY(float y, float fx, float fy, float forward, float side) {
    return y + fy * forward + fx * side;
}

// Draws a filled shape made of "corners" points, given in the figure's own directions, with a thin dark outline
void drawPart(float x, float y, float fx, float fy, const float* forward, const float* side, int corners, float r, float g, float b) {
    glColor3f(r, g, b);
    glBegin(GL_POLYGON);
    for (int i = 0; i < corners; i++) {
        glVertex2f(partX(x, fx, fy, forward[i], side[i]), partY(y, fx, fy, forward[i], side[i]));
    }
    glEnd();

    glColor3f(0.12f, 0.10f, 0.10f);
    glLineWidth(1.5f);
    glBegin(GL_LINE_LOOP);
    for (int i = 0; i < corners; i++) {
        glVertex2f(partX(x, fx, fy, forward[i], side[i]), partY(y, fx, fy, forward[i], side[i]));
    }
    glEnd();
}

// Draws a rectangle in a figure's own directions, from forward1 to forward2 and from side1 to side2
void drawPartRect(float x, float y, float fx, float fy, float forward1, float forward2, float side1, float side2, float r, float g, float b) {
    float forward[4] = { forward1, forward2, forward2, forward1 };
    float side[4] = { side1, side1, side2, side2 };

    drawPart(x, y, fx, fy, forward, side, 4, r, g, b);
}

// Draws a soldier seen from above, facing the way (fx, fy) points: a square helmet with a square
// shoulder pad on each side (there is no body underneath). The shoulder pads and the helmet stripe
// are the accent color (blue for the hero, red for the enemies). radius is half the width of the
// square he fills.
void drawSoldier(float x, float y, float fx, float fy, float radius, const float* armor, const float* accent) {
    float R = radius;

    // PLACEHOLDER: squares. Soldier sprite goes here.
    // Square shoulder pads on both sides, in the accent color
    drawPartRect(x, y, fx, fy, -0.55f * R, 0.50f * R, 0.62f * R, 1.00f * R, accent[0], accent[1], accent[2]);
    drawPartRect(x, y, fx, fy, -0.55f * R, 0.50f * R, -1.00f * R, -0.62f * R, accent[0], accent[1], accent[2]);

    // The square helmet in armor color, with its stripe and the dark visor slit at the front
    drawPartRect(x, y, fx, fy, -0.55f * R, 0.50f * R, -0.47f * R, 0.47f * R, armor[0], armor[1], armor[2]);
    drawPartRect(x, y, fx, fy, -0.55f * R, 0.50f * R, -0.08f * R, 0.08f * R, accent[0], accent[1], accent[2]);
    drawPartRect(x, y, fx, fy, 0.26f * R, 0.42f * R, -0.32f * R, 0.32f * R, 0.10f, 0.10f, 0.12f);
}

// Draws a see-through dark disc, used for the soft shadow under things lying on the ground
void drawShadowDisc(float x, float y, float radius, float alpha) {
    glColor4f(0.0f, 0.0f, 0.0f, alpha);
    glBegin(GL_TRIANGLE_FAN);
    glVertex2f(x, y);
    for (int i = 0; i <= CIRCLE_SEGMENTS; i++) {
        glVertex2f(x + radius * circleCos[i], y + radius * circleSin[i]);
    }
    glEnd();
}

// Draws a fallen soldier lying on the ground. angle is the way the head points. The accent is blue
// for a soldier on the hero's side and red for an enemy soldier.
void drawFallenSoldier(float x, float y, float angle, const float* armor, const float* accent) {
    float fx = (float)cos(angle);
    float fy = (float)sin(angle);

    drawShadowDisc(x + 3.0f, y - 4.0f, 22.0f, 0.22f);

    // Legs, arms, then the body, the shoulder pads, and the helmet with its stripe
    drawPartRect(x, y, fx, fy, -34.0f, -12.0f, 2.0f, 8.0f, 0.28f, 0.28f, 0.31f);
    drawPartRect(x, y, fx, fy, -34.0f, -12.0f, -8.0f, -2.0f, 0.28f, 0.28f, 0.31f);
    drawPartRect(x, y, fx, fy, -2.0f, 15.0f, 13.0f, 20.0f, armor[0] * 0.85f, armor[1] * 0.85f, armor[2] * 0.85f);
    drawPartRect(x, y, fx, fy, -2.0f, 15.0f, -20.0f, -13.0f, armor[0] * 0.85f, armor[1] * 0.85f, armor[2] * 0.85f);
    float torsoF[8] = { -12.0f, -8.0f, 8.0f, 12.0f, 12.0f, 8.0f, -8.0f, -12.0f };
    float torsoS[8] = { -11.0f, -16.0f, -16.0f, -11.0f, 11.0f, 16.0f, 16.0f, 11.0f };
    drawPart(x, y, fx, fy, torsoF, torsoS, 8, armor[0] * 0.9f, armor[1] * 0.9f, armor[2] * 0.9f);
    drawPartRect(x, y, fx, fy, -1.0f, 11.0f, 10.0f, 21.0f, accent[0] * 0.9f, accent[1] * 0.9f, accent[2] * 0.9f);
    drawPartRect(x, y, fx, fy, -1.0f, 11.0f, -21.0f, -10.0f, accent[0] * 0.9f, accent[1] * 0.9f, accent[2] * 0.9f);
    drawPartRect(x, y, fx, fy, 11.0f, 29.0f, -9.0f, 9.0f, 0.62f, 0.64f, 0.68f);
    drawPartRect(x, y, fx, fy, 11.0f, 29.0f, -1.6f, 1.6f, accent[0] * 0.9f, accent[1] * 0.9f, accent[2] * 0.9f);
}

// Draws a sword lying on the ground, with the tip pointing at the given angle
void drawGroundSword(float x, float y, float angle, float length, float r, float g, float b) {
    float fx = (float)cos(angle);
    float fy = (float)sin(angle);
    float bladeF[5] = { 0.0f, length * 0.85f, length, length * 0.85f, 0.0f };
    float bladeS[5] = { -2.6f, -2.0f, 0.0f, 2.0f, 2.6f };

    drawShadowDisc(x + fx * length * 0.4f + 2.0f, y + fy * length * 0.4f - 3.0f, 9.0f, 0.15f);

    drawPart(x, y, fx, fy, bladeF, bladeS, 5, r, g, b);
    drawPartRect(x, y, fx, fy, -3.0f, 1.5f, -7.0f, 7.0f, 0.78f, 0.62f, 0.22f);
    drawPartRect(x, y, fx, fy, -12.0f, -3.0f, -2.0f, 2.0f, 0.40f, 0.26f, 0.12f);
}

// Draws a round shield lying on the ground, with a colored rim
void drawShield(float x, float y, float radius, const float* accent) {
    drawShadowDisc(x + 3.0f, y - 4.0f, radius, 0.20f);
    drawFilledCircle(x, y, radius, accent[0] * 0.9f, accent[1] * 0.9f, accent[2] * 0.9f);
    drawFilledCircle(x, y, radius * 0.70f, 0.58f, 0.60f, 0.64f);
    drawFilledCircle(x, y, radius * 0.24f, 0.36f, 0.37f, 0.41f);
}

// Draws a helmet lying on the ground, with a highlight on top and a dark visor slit
void drawHelmetPiece(float x, float y, float angle) {
    float fx = (float)cos(angle);
    float fy = (float)sin(angle);

    drawShadowDisc(x + 2.0f, y - 3.0f, 11.0f, 0.20f);
    drawFilledCircle(x, y, 11.0f, 0.50f, 0.52f, 0.57f);
    drawFilledCircle(partX(x, fx, fy, -2.0f, 2.5f), partY(y, fx, fy, -2.0f, 2.5f), 5.0f, 0.68f, 0.70f, 0.75f);
    drawPartRect(x, y, fx, fy, 4.0f, 10.0f, -5.0f, 5.0f, 0.12f, 0.12f, 0.14f);
}

// Draws a breastplate lying on the ground, with a stripe in the accent color
void drawBreastplate(float x, float y, float angle, const float* accent) {
    float fx = (float)cos(angle);
    float fy = (float)sin(angle);
    float plateF[8] = { -13.0f, -9.0f, 9.0f, 13.0f, 13.0f, 9.0f, -9.0f, -13.0f };
    float plateS[8] = { -9.0f, -15.0f, -15.0f, -9.0f, 9.0f, 15.0f, 15.0f, 9.0f };

    drawShadowDisc(x + 3.0f, y - 4.0f, 16.0f, 0.20f);
    drawPart(x, y, fx, fy, plateF, plateS, 8, 0.58f, 0.60f, 0.64f);
    drawPartRect(x, y, fx, fy, -9.0f, 9.0f, -2.0f, 2.0f, accent[0] * 0.9f, accent[1] * 0.9f, accent[2] * 0.9f);
}

// Draws what is left of a battle in the background: fallen soldiers, swords, and pieces of armor.
// They are kept well away from the platform so they never get in the way of the game.
void drawBattlefieldProps(void) {
    // PLACEHOLDER: fallen soldiers made of shapes. Fallen soldier art goes here.
    drawFallenSoldier(130.0f, 545.0f, 0.45f, HERO_ARMOR, BLUE_ACCENT);
    drawFallenSoldier(455.0f, 600.0f, 3.50f, ENEMY_ARMOR, RED_ACCENT);
    drawFallenSoldier(110.0f, 270.0f, 1.95f, ENEMY_ARMOR, RED_ACCENT);
    drawFallenSoldier(470.0f, 255.0f, 2.80f, HERO_ARMOR, BLUE_ACCENT);
    drawFallenSoldier(215.0f, 70.0f, 0.35f, ENEMY_ARMOR, RED_ACCENT);
    drawFallenSoldier(425.0f, 75.0f, 5.70f, HERO_ARMOR, BLUE_ACCENT);

    // PLACEHOLDER: swords lying around. Sword art goes here.
    drawGroundSword(205.0f, 505.0f, 0.60f, 38.0f, 0.78f, 0.80f, 0.84f);
    drawGroundSword(395.0f, 530.0f, 2.20f, 34.0f, 0.66f, 0.60f, 0.56f);
    drawGroundSword(60.0f, 300.0f, 1.40f, 36.0f, 0.78f, 0.80f, 0.84f);
    drawGroundSword(535.0f, 290.0f, 0.25f, 32.0f, 0.66f, 0.60f, 0.56f);
    drawGroundSword(175.0f, 135.0f, 3.50f, 38.0f, 0.78f, 0.80f, 0.84f);
    drawGroundSword(360.0f, 150.0f, 1.15f, 34.0f, 0.66f, 0.60f, 0.56f);
    drawGroundSword(300.0f, 55.0f, 1.75f, 36.0f, 0.78f, 0.80f, 0.84f);
    drawGroundSword(100.0f, 650.0f, 2.80f, 36.0f, 0.66f, 0.60f, 0.56f);
    drawGroundSword(495.0f, 665.0f, 0.70f, 38.0f, 0.78f, 0.80f, 0.84f);
    drawGroundSword(205.0f, 600.0f, 1.20f, 30.0f, 0.66f, 0.60f, 0.56f);

    // PLACEHOLDER: pieces of armor. Shield, helmet, and breastplate art goes here.
    drawShield(180.0f, 650.0f, 17.0f, BLUE_ACCENT);
    drawShield(430.0f, 500.0f, 17.0f, RED_ACCENT);
    drawHelmetPiece(85.0f, 235.0f, 0.8f);
    drawHelmetPiece(520.0f, 225.0f, 2.4f);
    drawHelmetPiece(250.0f, 60.0f, 4.0f);
    drawHelmetPiece(385.0f, 625.0f, 5.2f);
    drawBreastplate(180.0f, 240.0f, 0.3f, BLUE_ACCENT);
    drawBreastplate(410.0f, 200.0f, 1.2f, RED_ACCENT);
}

// Builds the background once and saves it: a pixel-art meadow with shade, sunlight, dirt, tufts, and rocks.
// Plain light grass is the clear color, so only the other colors need to be drawn.
void buildBackgroundList(void) {
    static int cells[BG_ROWS][BG_COLS];

    for (int row = 0; row < BG_ROWS; row++) {
        for (int col = 0; col < BG_COLS; col++) {
            float x = ((float)col + 0.5f) * (float)BG_PIXEL;
            float y = ((float)row + 0.5f) * (float)BG_PIXEL;

            // Nothing is drawn under the stone platform
            if (underPlatform(x, y)) {
                cells[row][col] = BG_NONE;
                continue;
            }

            float shade = blobNoise((float)col / 12.0f, (float)row / 12.0f, 1);
            float dirt = blobNoise((float)col / 10.0f + 20.0f, (float)row / 10.0f + 9.0f, 2);
            float sun = blobNoise((float)col / 8.0f + 70.0f, (float)row / 8.0f + 5.0f, 3);

            // The top of the screen is in deep shade so the score and the meter are easy to see
            if (y > 560.0f) {
                shade = shade + (y - 560.0f) / 130.0f * 0.55f;
            }

            // How far this spot is from the platform arms (more dirt is worn into the ground close to them)
            float pathDistance = fabs(y - CENTER_Y);
            if (y > 100.0f && y < 700.0f && fabs(x - CENTER_X) < pathDistance) {
                pathDistance = fabs(x - CENTER_X);
            }
            if (pathDistance < 110.0f) {
                dirt = dirt + (110.0f - pathDistance) / 110.0f * 0.10f;
            }

            int type = BG_LIGHT;

            // Deep shade, then shade
            if (shade > 0.76f) {
                type = BG_DEEP;
            }
            else if (shade > 0.64f) {
                type = BG_SHADE;
            }
            // Sunlit patches only on the plain light grass
            else if (sun > 0.70f) {
                type = BG_SUN;
            }

            // Dirt patches go on top of everything except the very top of the screen
            if (dirt > DIRT_LEVEL && y < 680.0f) {
                type = BG_DIRT;
            }

            // A few lighter specks in the plain grass
            if (type == BG_LIGHT && hashNoise(col, row, 5) < 0.05f) {
                type = BG_LIGHT2;
            }

            cells[row][col] = type;
        }
    }

    // Give each dirt patch a darker edge, a few lighter specks inside, and a few small pebbles
    for (int row = 1; row < BG_ROWS - 1; row++) {
        for (int col = 1; col < BG_COLS - 1; col++) {
            // Only dirt spots need this
            if (cells[row][col] != BG_DIRT) {
                continue;
            }

            bool edge = (cells[row][col - 1] != BG_DIRT && cells[row][col - 1] != BG_NONE) ||
                (cells[row][col + 1] != BG_DIRT && cells[row][col + 1] != BG_NONE) ||
                (cells[row - 1][col] != BG_DIRT && cells[row - 1][col] != BG_NONE) ||
                (cells[row + 1][col] != BG_DIRT && cells[row + 1][col] != BG_NONE);
            float chance = hashNoise(col, row, 6);

            // A dirt spot next to grass becomes the darker edge color
            if (edge) {
                cells[row][col] = BG_DIRT_EDGE;
            }
            // Inside the patch, a few spots become lighter specks or pebbles
            else if (chance < 0.07f) {
                cells[row][col] = BG_DIRT_SPECK;
            }
            else if (chance > 0.97f) {
                cells[row][col] = BG_PEBBLE;
            }
        }
    }

    glNewList(backgroundList, GL_COMPILE);

    // Each row is drawn as long rectangles, one for every run of the same color
    for (int row = 0; row < BG_ROWS; row++) {
        int col = 0;

        while (col < BG_COLS) {
            int type = cells[row][col];
            int end = col;

            while (end + 1 < BG_COLS && cells[row][end + 1] == type) {
                end++;
            }

            // Plain light grass is the clear color, and the platform covers its own spots
            if (type != BG_LIGHT && type != BG_NONE) {
                drawBgRect((float)(col * BG_PIXEL), (float)(row * BG_PIXEL), (float)((end + 1) * BG_PIXEL), (float)((row + 1) * BG_PIXEL), type);
            }
            col = end + 1;
        }
    }

    // Tufts of grass, placed in repeatable "random" spots
    for (int t = 0; t < 150; t++) {
        int col = 2 + (int)(hashNoise(t, 1, 21) * (float)(BG_COLS - 5));
        int row = 1 + (int)(hashNoise(t, 2, 22) * (float)(BG_ROWS - 8));
        int type = cells[row][col];
        float x = (float)(col * BG_PIXEL);
        float y = (float)(row * BG_PIXEL);

        // Tufts only grow on grass: not on dirt, not under the platform, not in the deep shade at the top
        if (type == BG_NONE || type >= BG_DIRT || y > 690.0f) {
            continue;
        }

        // Darker tufts on the light grass, lighter ones in the shade
        if (type == BG_SHADE || type == BG_DEEP) {
            drawTuft(x, y, 0.40f, 0.68f, 0.42f);
        }
        else {
            drawTuft(x, y, 0.30f, 0.58f, 0.30f);
        }
    }

    // PLACEHOLDER: rocks made of rectangles. Rock art goes here.
    drawRock(70.0f, 70.0f, 0.55f, 0.57f, 0.66f);
    drawRock(525.0f, 150.0f, 0.60f, 0.55f, 0.50f);
    drawRock(55.0f, 610.0f, 0.56f, 0.58f, 0.66f);
    drawRock(548.0f, 545.0f, 0.55f, 0.57f, 0.66f);
    drawRock(150.0f, 190.0f, 0.60f, 0.55f, 0.50f);

    drawBattlefieldProps();

    glEndList();
}

// Draws the background: pixel-art grass, dirt, and rocks
void drawBackground(void) {
    // PLACEHOLDER: grass, dirt, and rocks made of rectangles. Final background art goes here.
    glClear(GL_COLOR_BUFFER_BIT);
    glCallList(backgroundList);
}

// Draws the outline of the whole cross shape in the current color. It is drawn as three
// rectangles that do not overlap (so a see-through color does not get darker where they meet).
// dx and dy move the shape, and grow makes it bigger on every side.
void drawCrossShape(float dx, float dy, float grow) {
    float half = TILE_SIZE / 2.0f + grow;
    float reach = TILE_SIZE * ((float)ARM_TILES + 0.5f) + grow;
    float cx = CENTER_X + dx;
    float cy = CENTER_Y + dy;

    glBegin(GL_POLYGON);
    glVertex2f(cx - reach, cy - half);
    glVertex2f(cx + reach, cy - half);
    glVertex2f(cx + reach, cy + half);
    glVertex2f(cx - reach, cy + half);
    glEnd();

    glBegin(GL_POLYGON);
    glVertex2f(cx - half, cy + half);
    glVertex2f(cx + half, cy + half);
    glVertex2f(cx + half, cy + reach);
    glVertex2f(cx - half, cy + reach);
    glEnd();

    glBegin(GL_POLYGON);
    glVertex2f(cx - half, cy - reach);
    glVertex2f(cx + half, cy - reach);
    glVertex2f(cx + half, cy - half);
    glVertex2f(cx - half, cy - half);
    glEnd();
}

// Draws a small tuft of grass that pokes up over the edge of the platform
void drawSmallTuft(float x, float y) {
    float p = 5.0f;

    glColor3f(0.25f, 0.50f, 0.25f);
    drawRectangle(x - p, y, x - p * 0.5f, y + 2.0f * p, 0.25f, 0.50f, 0.25f);
    drawRectangle(x, y, x + p * 0.5f, y + 3.0f * p, 0.30f, 0.58f, 0.30f);
    drawRectangle(x + p, y, x + p * 1.5f, y + 2.0f * p, 0.25f, 0.50f, 0.25f);
}

// Draws one square stone tile centered at (cx, cy): warm stone with a light top and left edge,
// a dark bottom and right edge, a few specks, and sometimes a patch of moss
void drawTile(float cx, float cy) {
    float half = TILE_SIZE / 2.0f;
    int seedX = (int)cx;
    int seedY = (int)cy;

    // Each tile is a tiny bit lighter or darker than the others
    float variation = (hashNoise(seedX, seedY, 31) - 0.5f) * 0.07f;

    // PLACEHOLDER: warm stone square. Stone tile sprite goes here.
    drawRectangle(cx - half, cy - half, cx + half, cy + half, STONE[0] + variation, STONE[1] + variation, STONE[2] + variation);

    // Light edge along the top and left, dark edge along the bottom and right
    drawRectangle(cx - half, cy + half - 4.0f, cx + half, cy + half, STONE_LIGHT[0], STONE_LIGHT[1], STONE_LIGHT[2]);
    drawRectangle(cx - half, cy - half, cx - half + 4.0f, cy + half, STONE_LIGHT[0], STONE_LIGHT[1], STONE_LIGHT[2]);
    drawRectangle(cx - half, cy - half, cx + half, cy - half + 4.0f, STONE_DARK[0], STONE_DARK[1], STONE_DARK[2]);
    drawRectangle(cx + half - 4.0f, cy - half, cx + half, cy + half, STONE_DARK[0], STONE_DARK[1], STONE_DARK[2]);

    // Small light and dark specks of stone
    for (int i = 0; i < 5; i++) {
        float x = cx - half + 10.0f + hashNoise(seedX, seedY, 40 + i) * (TILE_SIZE - 24.0f);
        float y = cy - half + 10.0f + hashNoise(seedX, seedY, 50 + i) * (TILE_SIZE - 24.0f);

        // Every other speck is lighter, the rest are darker
        if (i % 2 == 0) {
            drawRectangle(x, y, x + 4.0f, y + 4.0f, STONE_LIGHT[0] - 0.04f, STONE_LIGHT[1] - 0.04f, STONE_LIGHT[2] - 0.04f);
        }
        else {
            drawRectangle(x, y, x + 4.0f, y + 4.0f, STONE_DARK[0] + 0.06f, STONE_DARK[1] + 0.06f, STONE_DARK[2] + 0.06f);
        }
    }

    // Two specks of sand that blew onto the stone
    for (int i = 0; i < 2; i++) {
        float x = cx - half + 8.0f + hashNoise(seedX, seedY, 90 + i) * (TILE_SIZE - 20.0f);
        float y = cy - half + 8.0f + hashNoise(seedX, seedY, 95 + i) * (TILE_SIZE - 20.0f);
        drawRectangle(x, y, x + 6.0f, y + 4.0f, bgColors[BG_DIRT_SPECK][0], bgColors[BG_DIRT_SPECK][1], bgColors[BG_DIRT_SPECK][2]);
    }

    // Some tiles have a crack
    if (hashNoise(seedX, seedY, 65) > 0.55f) {
        float x1 = cx - half + 14.0f + hashNoise(seedX, seedY, 66) * (TILE_SIZE - 40.0f);
        float y1 = cy - half + 24.0f + hashNoise(seedX, seedY, 67) * (TILE_SIZE - 48.0f);

        glColor3f(STONE_DARK[0] - 0.10f, STONE_DARK[1] - 0.10f, STONE_DARK[2] - 0.10f);
        glLineWidth(2.0f);
        glBegin(GL_LINE_STRIP);
        glVertex2f(x1, y1);
        glVertex2f(x1 + (hashNoise(seedX, seedY, 68) - 0.5f) * 16.0f, y1 - 9.0f);
        glVertex2f(x1 + (hashNoise(seedX, seedY, 69) - 0.5f) * 16.0f, y1 - 19.0f);
        glEnd();
    }

    // Some tiles have a little moss in one corner
    if (hashNoise(seedX, seedY, 60) > 0.45f) {
        float cornerX = cx - half + 4.0f;
        float cornerY = cy - half + 4.0f;

        // The moss sits in a different corner on different tiles
        if (hashNoise(seedX, seedY, 61) > 0.5f) {
            cornerX = cx + half - 18.0f;
        }
        if (hashNoise(seedX, seedY, 62) > 0.5f) {
            cornerY = cy + half - 16.0f;
        }

        drawRectangle(cornerX, cornerY, cornerX + 14.0f, cornerY + 8.0f, 0.36f, 0.56f, 0.28f);
        drawRectangle(cornerX + 4.0f, cornerY + 8.0f, cornerX + 12.0f, cornerY + 12.0f, 0.36f, 0.56f, 0.28f);
        drawRectangle(cornerX + 2.0f, cornerY + 2.0f, cornerX + 8.0f, cornerY + 6.0f, 0.47f, 0.67f, 0.34f);
    }

    glColor3f(STONE_OUTLINE[0], STONE_OUTLINE[1], STONE_OUTLINE[2]);
    glLineWidth(2.0f);
    glBegin(GL_LINE_LOOP);
    glVertex2f(cx - half, cy - half);
    glVertex2f(cx + half, cy - half);
    glVertex2f(cx + half, cy + half);
    glVertex2f(cx - half, cy + half);
    glEnd();
}

// Draws bits of sand, dirt, and grass that have crept over the edges of the platform, so its edge
// looks worn and melts into the ground. Each bit sits half on the platform and half on the ground.
void drawEdgeDrift(void) {
    float half = TILE_SIZE / 2.0f;
    float reach = TILE_SIZE * ((float)ARM_TILES + 0.5f);
    float left = CENTER_X - reach;
    float right = CENTER_X + reach;
    float armTop = CENTER_Y + half;
    float frontBottom = CENTER_Y - half - 22.0f;
    float armEndTop = CENTER_Y + reach;
    float armEndBottom = CENTER_Y - reach;

    // The edges of the platform, each given as a start point and an end point (x1, y1, x2, y2)
    float edges[12][4] = {
        { left, armTop, CENTER_X - half, armTop },{ CENTER_X + half, armTop, right, armTop },
        { left, frontBottom, left, armTop },{ right, frontBottom, right, armTop },
        { left, frontBottom, CENTER_X - half, frontBottom },{ CENTER_X + half, frontBottom, right, frontBottom },
        { CENTER_X - half, armEndTop, CENTER_X + half, armEndTop },
        { CENTER_X - half, armTop, CENTER_X - half, armEndTop },{ CENTER_X + half, armTop, CENTER_X + half, armEndTop },
        { CENTER_X - half, armEndBottom - 22.0f, CENTER_X - half, frontBottom },{ CENTER_X + half, armEndBottom - 22.0f, CENTER_X + half, frontBottom },
        { CENTER_X - half, armEndBottom - 22.0f, CENTER_X + half, armEndBottom - 22.0f }
    };

    for (int i = 0; i < 70; i++) {
        int edge = (int)(hashNoise(i, 1, 80) * 12.0f) % 12;
        float t = hashNoise(i, 2, 81);
        float x = edges[edge][0] + (edges[edge][2] - edges[edge][0]) * t;
        float y = edges[edge][1] + (edges[edge][3] - edges[edge][1]) * t;
        float size = 4.0f + hashNoise(i, 3, 82) * 6.0f;
        float kind = hashNoise(i, 4, 83);

        // Mostly dirt and sand, sometimes a bit of grass
        if (kind < 0.45f) {
            drawRectangle(x - size, y - size * 0.6f, x + size, y + size * 0.6f, bgColors[BG_DIRT][0], bgColors[BG_DIRT][1], bgColors[BG_DIRT][2]);
        }
        else if (kind < 0.75f) {
            drawRectangle(x - size, y - size * 0.6f, x + size, y + size * 0.6f, bgColors[BG_DIRT_SPECK][0], bgColors[BG_DIRT_SPECK][1], bgColors[BG_DIRT_SPECK][2]);
        }
        else {
            drawRectangle(x - size, y - size * 0.6f, x + size, y + size * 0.6f, 0.42f, 0.62f, 0.32f);
        }
    }
}

// Draws the 13 tiles: the center tile plus 3 tiles on each of the 4 arms
void drawPlatform(void) {
    float half = TILE_SIZE / 2.0f;

    // A faint shadow on the ground, moved down and to the right of the platform
    glColor4f(0.0f, 0.0f, 0.0f, 0.14f);
    drawCrossShape(5.0f, -7.0f, 0.0f);

    // A thin, soft outline around the whole platform
    glColor3f(STONE_OUTLINE[0], STONE_OUTLINE[1], STONE_OUTLINE[2]);
    drawCrossShape(0.0f, 0.0f, 2.5f);

    // Front edge under the left arm, the right arm, and the end of the bottom arm
    for (int k = 1; k <= ARM_TILES; k++) {
        drawRectangle(laneX(0, (float)k) - half, CENTER_Y - half - 22.0f, laneX(0, (float)k) + half, CENTER_Y - half, STONE_FRONT[0], STONE_FRONT[1], STONE_FRONT[2]);
        drawRectangle(laneX(1, (float)k) - half, CENTER_Y - half - 22.0f, laneX(1, (float)k) + half, CENTER_Y - half, STONE_FRONT[0], STONE_FRONT[1], STONE_FRONT[2]);
    }
    drawRectangle(CENTER_X - half, laneY(3, (float)ARM_TILES) - half - 22.0f, CENTER_X + half, laneY(3, (float)ARM_TILES) - half, STONE_FRONT[0], STONE_FRONT[1], STONE_FRONT[2]);

    // A soft line along the bottom of the front edge
    glColor3f(STONE_OUTLINE[0], STONE_OUTLINE[1], STONE_OUTLINE[2]);
    glLineWidth(2.0f);
    glBegin(GL_LINES);
    glVertex2f(laneX(0, (float)ARM_TILES) - half, CENTER_Y - half - 22.0f);
    glVertex2f(CENTER_X - half, CENTER_Y - half - 22.0f);
    glVertex2f(CENTER_X + half, CENTER_Y - half - 22.0f);
    glVertex2f(laneX(1, (float)ARM_TILES) + half, CENTER_Y - half - 22.0f);
    glVertex2f(CENTER_X - half, laneY(3, (float)ARM_TILES) - half - 22.0f);
    glVertex2f(CENTER_X + half, laneY(3, (float)ARM_TILES) - half - 22.0f);
    glEnd();

    drawTile(CENTER_X, CENTER_Y);

    for (int lane = 0; lane < 4; lane++) {
        for (int k = 1; k <= ARM_TILES; k++) {
            drawTile(laneX(lane, (float)k), laneY(lane, (float)k));

            // Placeholder labels: show the tile number in the corner of each arm tile
            if (showLabels) {
                char number[2];
                number[0] = (char)('0' + k);
                number[1] = '\0';
                glColor3f(0.2f, 0.25f, 0.3f);
                drawText(laneX(lane, (float)k) - half + 5.0f, laneY(lane, (float)k) + half - 14.0f, number);
            }
        }
    }

    // Tufts of grass poking over the top edge of the left and right arms
    for (int i = 0; i < 22; i++) {
        float x = CENTER_X - 266.0f + 14.0f + hashNoise(i, 7, 70) * 520.0f;

        // Skip the spot where the up arm meets the sideways arms
        if (fabs(x - CENTER_X) > half + 10.0f) {
            drawSmallTuft(x, CENTER_Y + half + 4.0f);
        }
    }

    // And along the sides of the up arm
    for (int i = 0; i < 14; i++) {
        float y = CENTER_Y + half + 16.0f + hashNoise(i, 9, 71) * 200.0f;

        // Tufts on the left side or the right side
        if (hashNoise(i, 3, 72) > 0.5f) {
            drawSmallTuft(CENTER_X - half - 8.0f, y);
        }
        else {
            drawSmallTuft(CENTER_X + half + 8.0f, y);
        }
    }

    drawEdgeDrift();

    // Placeholder labels explaining what goes here
    if (showLabels) {
        glColor3f(0.0f, 0.0f, 0.0f);
        drawText(CENTER_X - 30.0f, CENTER_Y - 48.0f, "[PLAYER]");

        drawTextBox(350.0f, 670.0f, "PLATFORM: 13 stone tile sprites");
        drawTextBox(10.0f, 660.0f, "RULE: 1 enemy per tile number");
        drawTextBox(10.0f, 90.0f, "BACKGROUND: grass, dirt, rocks");
    }
}

// Draws every enemy soldier that is still walking
void drawEnemies(void) {
    for (int i = 0; i < MAX_ENEMIES; i++) {
        // Skip enemy soldiers that are already knocked out
        if (enemies[i].active) {
            float tiles = (float)enemies[i].tile + enemies[i].slide;
            float x = laneX(enemies[i].lane, tiles);
            float y = laneY(enemies[i].lane, tiles);

            // An enemy soldier with dark armor and red accents, facing the hero
            drawSoldier(x, y, -laneDx[enemies[i].lane], -laneDy[enemies[i].lane], ENEMY_RADIUS, ENEMY_ARMOR, RED_ACCENT);

            // Red ring warns that an enemy soldier on tile 1 is about to strike
            if (enemies[i].tile == 1 && enemies[i].slide <= 0.0f && enemies[i].moveTimer < 0.15f) {
                glColor3f(1.0f, 0.1f, 0.1f);
                drawSquareOutline(x, y, ENEMY_RADIUS + 5.0f, 3.0f);
            }

            // Placeholder label for the enemy soldier sprite
            if (showLabels) {
                glColor3f(1.0f, 1.0f, 1.0f);
                drawText(x - 22.0f, y + 28.0f, "[ENEMY]");
            }
        }
    }
}

// Returns the x position of a point on the sword. a is the distance along the blade
// from the hero, l is the distance to the side. angle is the way the sword points.
float swordX(float angle, float a, float l) {
    return CENTER_X + a * (float)cos(angle) - l * (float)sin(angle);
}

// Returns the y position of a point on the sword (see swordX)
float swordY(float angle, float a, float l) {
    return CENTER_Y + a * (float)sin(angle) + l * (float)cos(angle);
}

// Draws one filled part of the sword (a polygon given by its corner points) with a dark outline.
// shift moves the whole sword forward (or back) along the way it points.
void drawSwordPart(float angle, float shift, const float* a, const float* l, int corners, float r, float g, float b) {
    glColor3f(r, g, b);
    glBegin(GL_POLYGON);
    for (int i = 0; i < corners; i++) {
        glVertex2f(swordX(angle, a[i] + shift, l[i]), swordY(angle, a[i] + shift, l[i]));
    }
    glEnd();

    glColor3f(0.1f, 0.1f, 0.1f);
    glLineWidth(2.0f);
    glBegin(GL_LINE_LOOP);
    for (int i = 0; i < corners; i++) {
        glVertex2f(swordX(angle, a[i] + shift, l[i]), swordY(angle, a[i] + shift, l[i]));
    }
    glEnd();
}

// Draws the sword pointing at the given angle, moved forward by shift:
// a handle, a crossguard, and a pointed blade
void drawSword(float angle, float shift) {
    float handleA[4] = { 14.0f, 26.0f, 26.0f, 14.0f };
    float handleL[4] = { -2.5f, -2.5f, 2.5f, 2.5f };
    float guardA[4] = { 26.0f, 30.0f, 30.0f, 26.0f };
    float guardL[4] = { -9.0f, -9.0f, 9.0f, 9.0f };
    float bladeA[5] = { 30.0f, 82.0f, 92.0f, 82.0f, 30.0f };
    float bladeL[5] = { -4.5f, -3.2f, 0.0f, 3.2f, 4.5f };

    // PLACEHOLDER: simple shapes. Sword art goes here.
    drawSwordPart(angle, shift, handleA, handleL, 4, 0.45f, 0.28f, 0.12f);
    drawSwordPart(angle, shift, guardA, guardL, 4, 0.95f, 0.75f, 0.20f);
    drawSwordPart(angle, shift, bladeA, bladeL, 5, 0.88f, 0.92f, 0.95f);
}

// Draws the sword stabbing straight out along the attack direction, from the middle of the platform.
// progress goes from 0 (the stab just started) to 1 (the stab is over). The sword thrusts out fast,
// is fully out when it reaches the enemy soldier (at SWORD_CONTACT), and then pulls back.
void drawSwordStab(int lane, float progress) {
    float angle = (float)atan2(laneDy[lane], laneDx[lane]);
    float out;

    // Thrust out quickly
    if (progress < SWORD_CONTACT) {
        out = (float)sin(0.5f * PI * progress / SWORD_CONTACT);
    }
    // Then pull back
    else {
        out = (float)cos(0.5f * PI * (progress - SWORD_CONTACT) / (1.0f - SWORD_CONTACT));
    }

    drawSword(angle, -SWORD_STAB + 2.0f * SWORD_STAB * out);
}

// Draws the fury attack: swords fly out from the hero in every direction, like the spokes of a wheel
// (some go straight down the arms and the rest go in between). progress goes from 0 (the attack
// just started) to 1 (the swords have flown off the screen).
void drawFurySwords(float progress) {
    // The swords start fast and slow down a little as they fly
    float out = 1.0f - (1.0f - progress) * (1.0f - progress);

    for (int i = 0; i < FURY_SWORDS; i++) {
        float angle = 2.0f * PI * (float)i / (float)FURY_SWORDS;
        drawSword(angle, -14.0f + out * 420.0f);
    }
}

// Draws one solid disc (a filled circle with no outline)
void drawDisc(float x, float y, float radius, float r, float g, float b) {
    glColor3f(r, g, b);
    glBegin(GL_TRIANGLE_FAN);
    glVertex2f(x, y);
    for (int i = 0; i <= CIRCLE_SEGMENTS; i++) {
        glVertex2f(x + radius * circleCos[i], y + radius * circleSin[i]);
    }
    glEnd();
}

// Draws the puffs of one poof: a middle puff and six puffs around it that spread out.
// extra makes every puff a little bigger, which is used to draw a gray edge under the white.
void drawPoofPuffs(float x, float y, float progress, float extra, float r, float g, float b) {
    float spread = 10.0f + progress * 22.0f;
    float size = 1.0f - progress * progress;

    drawDisc(x, y, 20.0f * size + extra, r, g, b);

    for (int i = 0; i < 6; i++) {
        float angle = (float)i * PI / 3.0f + 0.3f;
        drawDisc(x + spread * (float)cos(angle), y + spread * (float)sin(angle), 14.0f * size + extra, r, g, b);
    }
}

// Draws a puff of smoke: overlapping white circles with a soft gray edge that spread out and shrink away
void drawPoof(float x, float y, float progress) {
    // PLACEHOLDER: white circles. Poof cloud art goes here.
    drawPoofPuffs(x, y, progress, 2.5f, 0.55f, 0.58f, 0.64f);
    drawPoofPuffs(x, y, progress, 0.0f, 0.96f, 0.96f, 0.97f);
}

// Draws the hero, his sword stab, and the fury shockwave
void drawPlayer(void) {
    // The hero: a soldier with silver armor and blue accents, facing the way he attacked last
    drawSoldier(CENTER_X, CENTER_Y, laneDx[facing], laneDy[facing], PLAYER_RADIUS, HERO_ARMOR, BLUE_ACCENT);

    // The sword stabs while an attack is happening
    if (attackTimer > 0.0f) {
        drawSwordStab(facing, 1.0f - attackTimer / ATTACK_TIME);
    }

    // Red ring when an enemy soldier has reached the hero
    if (hurtTimer > 0.0f) {
        glColor3f(1.0f, 0.1f, 0.1f);
        drawSquareOutline(CENTER_X, CENTER_Y, PLAYER_RADIUS + 6.0f, 4.0f);
    }

    // The fury attack: swords fly out from the hero in every direction
    if (furyTimer > 0.0f) {
        drawFurySwords((FURY_TIME - furyTimer) / FURY_TIME);
    }
}

// Draws the enemy soldiers waiting to be cut, and the poofs
void drawEffects(void) {
    for (int i = 0; i < MAX_EFFECTS; i++) {
        // Only draw effects that are still showing
        if (effects[i].active) {
            // The blade has not reached the enemy soldier yet, so it is still standing there
            if (effects[i].delay > 0.0f) {
                drawSoldier(effects[i].x, effects[i].y, -laneDx[effects[i].lane], -laneDy[effects[i].lane], ENEMY_RADIUS, ENEMY_ARMOR, RED_ACCENT);
            }
            // The blade made contact, so the enemy soldier turns into a poof
            else {
                drawPoof(effects[i].x, effects[i].y, 1.0f - effects[i].timeLeft / POOF_TIME);
            }
        }
    }
}

// Draws the meter frame, which never changes (and a placeholder label if labels are on)
void drawStaticHud(void) {
    // Meter frame
    drawRectangle(100.0f, 760.0f, 500.0f, 790.0f, 0.1f, 0.1f, 0.1f);

    // Placeholder label
    if (showLabels) {
        drawTextBox(10.0f, 700.0f, "METER: fills with each KO");
    }
}

// Draws the meter fill and the score number
void drawHud(void) {
    float shown = energy;

    // The meter stays full for a moment while the fury attack plays
    if (furyTimer > 0.0f) {
        shown = 100.0f;
    }

    // The fill is orange when the meter is full and yellow otherwise
    if (shown >= 100.0f) {
        drawRectangle(104.0f, 764.0f, 104.0f + 392.0f * shown / 100.0f, 786.0f, 1.0f, 0.55f, 0.0f);
    }
    else {
        drawRectangle(104.0f, 764.0f, 104.0f + 392.0f * shown / 100.0f, 786.0f, 1.0f, 0.9f, 0.2f);
    }

    char text[20];
    sprintf(text, "%d", score);

    // The score number is saved and only drawn again from scratch when it changes
    if (strcmp(text, scoreShown) != 0) {
        strcpy(scoreShown, text);
        glNewList(scoreList, GL_COMPILE);
        glColor3f(1.0f, 1.0f, 1.0f);
        drawCenteredText(706.0f, text, GLUT_BITMAP_TIMES_ROMAN_24);
        glEndList();
    }
    glCallList(scoreList);
}

// Shows the speed measurements in the corner when F has been pressed
void drawFpsText(void) {
    // Only show the numbers when they were turned on
    if (showFps) {
        // The text is saved and built again once a second, when the numbers change
        if (fpsDirty) {
            char line[200];
            fpsDirty = false;

            glNewList(fpsList, GL_COMPILE);
            glColor3f(1.0f, 1.0f, 1.0f);

            sprintf(line, "FPS: %d   loops/sec: %d   draw: %.2f ms   swap: %.2f ms", framesPerSecond, loopsPerSecond, shownDrawMs, shownSwapMs);
            drawText(10.0f, 50.0f, line);

            sprintf(line, "Sleep(1) took: %.1f ms   GLUT clock step: %d ms", shownSleepMs, clockStepAtStart);
            drawText(10.0f, 34.0f, line);

            drawText(10.0f, 18.0f, glInfo);
            glEndList();
        }
        glCallList(fpsList);
    }
}

// Draws the title page: the game name and the basic controls, on top of the platform. The text is
// placed so the middle of the platform (the center tile and the side arms) stays visible.
void drawTitlePage(void) {
    // PLACEHOLDER: box with the game name. Game logo goes here.
    drawBigTextBox(690.0f, "FOUR FRONTS");

    // A dark see-through panel behind the controls so the white text is easy to read,
    // while the platform still shows through it
    glColor4f(0.05f, 0.12f, 0.07f, 0.80f);
    glBegin(GL_POLYGON);
    glVertex2f(70.0f, 478.0f);
    glVertex2f(530.0f, 478.0f);
    glVertex2f(530.0f, 648.0f);
    glVertex2f(70.0f, 648.0f);
    glEnd();

    glColor3f(1.0f, 1.0f, 0.8f);
    glLineWidth(3.0f);
    glBegin(GL_LINE_LOOP);
    glVertex2f(70.0f, 478.0f);
    glVertex2f(530.0f, 478.0f);
    glVertex2f(530.0f, 648.0f);
    glVertex2f(70.0f, 648.0f);
    glEnd();

    glColor3f(1.0f, 1.0f, 0.8f);
    drawCenteredText(613.0f, "CONTROLS", GLUT_BITMAP_HELVETICA_18);

    glColor3f(1.0f, 1.0f, 1.0f);
    drawCenteredText(573.0f, "Arrow keys or W A S D  -  stab with the sword", GLUT_BITMAP_HELVETICA_18);
    drawCenteredText(538.0f, "Mouse click  -  stab toward the side you click", GLUT_BITMAP_HELVETICA_18);
    drawCenteredText(503.0f, "R  -  restart          X  -  exit", GLUT_BITMAP_HELVETICA_18);

    drawBigTextBox(45.0f, "Click a button to start the game");
}

// Draws the game over message on top of the game
void drawGameOver(void) {
    char text[80];
    sprintf(text, "GAME OVER   Score: %d   Best: %d", score, highScore);
    drawBigTextBox(580.0f, text);

    // The restart prompt appears after the short delay
    if (overTimer <= 0.0f) {
        drawBigTextBox(520.0f, "Click a button to play again");
    }
}

// Saves the platform, and the meter frame, so each can be replayed with one call
void buildSceneList(void) {
    glNewList(sceneList, GL_COMPILE);
    drawPlatform();
    glEndList();

    glNewList(meterList, GL_COMPILE);
    drawStaticHud();
    glEndList();
}

// Saves the title page so it can be replayed with one call
void buildTitleList(void) {
    glNewList(titleList, GL_COMPILE);
    drawTitlePage();
    glEndList();
}

// Draws the whole screen
void display(void) {
    double drawStart = nowMs();

    glClearColor(0.62f, 0.80f, 0.36f, 0.0f);
    drawBackground();

    // The title page is drawn on top of the platform
    if (gameState == STATE_TITLE) {
        glCallList(sceneList);
        glCallList(titleList);
    }
    // Otherwise draw the game
    else {
        glCallList(sceneList);
        glCallList(meterList);
        drawEnemies();
        drawPlayer();
        drawEffects();
        drawHud();

        // The game over message goes on top of the frozen game
        if (gameState == STATE_OVER) {
            drawGameOver();
        }
    }

    drawFpsText();

    // In timer mode, ask for the next frame (only one timer waits at a time)
    if (USE_TIMER && !timerArmed) {
        timerArmed = true;
        glutTimerFunc(FRAME_MS, timerFrame, 0);
    }

    // While the numbers are showing, wait for the graphics card to finish so the drawing time is honest
    if (showFps) {
        glFinish();
    }
    double drawEnd = nowMs();

    // Two buffers need a swap. One buffer only needs to be flushed.
    if (DOUBLE_BUFFER) {
        glutSwapBuffers();
    }
    else {
        glFlush();
    }

    drawTotalMs = drawTotalMs + (drawEnd - drawStart);
    swapTotalMs = swapTotalMs + (nowMs() - drawEnd);
    framesThisSecond++;
}

// Sets up the coordinate system and shows the title page
void init(void) {
    glEnable(GL_BLEND);
    glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);

    glMatrixMode(GL_PROJECTION);
    glLoadIdentity();
    gluOrtho2D(0.0, 600.0, 0.0, 800.0);

    for (int i = 0; i <= CIRCLE_SEGMENTS; i++) {
        float angle = 2.0f * PI * (float)i / (float)CIRCLE_SEGMENTS;
        circleCos[i] = cos(angle);
        circleSin[i] = sin(angle);
    }

    sceneList = glGenLists(6);
    scoreList = sceneList + 1;
    titleList = sceneList + 2;
    fpsList = sceneList + 3;
    backgroundList = sceneList + 4;
    meterList = sceneList + 5;
    buildBackgroundList();
    buildSceneList();
    buildTitleList();

    const char* renderer = (const char*)glGetString(GL_RENDERER);
    const char* vendor = (const char*)glGetString(GL_VENDOR);
    const char* version = (const char*)glGetString(GL_VERSION);

    // glGetString gives nothing if there is no OpenGL context
    if (renderer == NULL) renderer = "unknown";
    if (vendor == NULL) vendor = "unknown";
    if (version == NULL) version = "unknown";

    printf("OpenGL renderer: %s\nOpenGL vendor:   %s\nOpenGL version:  %s\n", renderer, vendor, version);
    sprintf(glInfo, "OpenGL: %.70s", renderer);

    srand((unsigned)time(NULL));
    resetGame();
    gameState = STATE_TITLE;
}

// Checks how finely GLUT's clock ticks. A clock that only changes once in a long while
// would make the game draw only that often.
void measureClock(void) {
    double start = nowMs();
    int last = glutGet(GLUT_ELAPSED_TIME);
    int smallest = 0;
    int changes = 0;

    while (nowMs() - start < 100.0) {
        int value = glutGet(GLUT_ELAPSED_TIME);

        // The clock moved forward, so remember how big the step was
        if (value != last) {
            int step = value - last;
            changes++;

            // Keep the smallest step seen
            if (smallest == 0 || step < smallest) {
                smallest = step;
            }
            last = value;
        }
    }

    clockStepAtStart = smallest;
    clockChangesAtStart = changes;
    printf("GLUT clock check: it changed %d times in 100 ms, smallest step %d ms\n", changes, smallest);
}

// Moves the game forward by the real time since the last frame and asks for a redraw.
// The computer's precise clock is used for timing instead of glutTimerFunc or GLUT's clock.
void nextFrame(void) {
    double now = nowMs();
    double elapsed = now - lastMs;

    // Limit the time so the game does not jump if the window was frozen for a moment
    if (elapsed > 100.0) {
        elapsed = 100.0;
    }
    lastMs = now;

    update((float)(elapsed / 1000.0));

    // Once a second, remember the speed measurements
    if (now - fpsStartMs >= 1000.0) {
        framesPerSecond = framesThisSecond;
        loopsPerSecond = loopsThisSecond;

        // Averages only make sense if something was measured
        if (framesThisSecond > 0) {
            shownDrawMs = (float)(drawTotalMs / framesThisSecond);
            shownSwapMs = (float)(swapTotalMs / framesThisSecond);
        }
        if (sleepCount > 0) {
            shownSleepMs = (float)(sleepTotalMs / sleepCount);
        }

        // When F is on, print the numbers in the console too so they can be copied
        if (showFps) {
            printf("FPS %d | loops/sec %d | draw %.2f ms | swap %.2f ms | Sleep(1) %.1f ms | GLUT clock step %d ms\n", framesPerSecond, loopsPerSecond, shownDrawMs, shownSwapMs, shownSleepMs, clockStepAtStart);
            fflush(stdout);
        }

        framesThisSecond = 0;
        loopsThisSecond = 0;
        drawTotalMs = 0.0;
        swapTotalMs = 0.0;
        sleepTotalMs = 0.0;
        sleepCount = 0;
        fpsStartMs = now;
        fpsDirty = true;
    }

    // Draw a new frame only if something on the screen can change. The title page and the
    // finished game over screen stay the same, so they are not drawn over and over.
    // (Timer mode keeps asking for frames because each display call sets the next timer.)
    if (USE_TIMER || gameState == STATE_PLAYING || needRedraw) {
        needRedraw = false;
        glutPostRedisplay();
    }
}

// Timer mode: runs when the timer goes off, then the next display call sets the next timer
void timerFrame(int value) {
    timerArmed = false;
    nextFrame();
}

// Idle mode: runs whenever GLUT has nothing else to do. It draws a new frame when
// enough time has passed and rests with Sleep so the program does not hog the processor.
void idle(void) {
    loopsThisSecond++;

    // Only start a new frame when enough time has passed since the last one
    if (nowMs() - lastMs >= (double)MIN_FRAME_MS) {
        nextFrame();
    }

    // Rest for a moment (and measure how long the rest really took)
    if (USE_SLEEP) {
        double sleepStart = nowMs();
        SLEEP_MS(1);
        sleepTotalMs = sleepTotalMs + (nowMs() - sleepStart);
        sleepCount++;
    }
}

// Keyboard controls
void keyboard(unsigned char key, int x, int y) {
    // X and Escape always exit
    if (key == 'x' || key == 'X' || key == 27) {
        exit(0);
    }

    // On the title page or the game over screen, any other key starts a game
    if (gameState != STATE_PLAYING) {
        tryStartGame();
        return;
    }

    switch (key) {
        // W: attack up
    case 'w':
    case 'W':
        attack(2);
        break;
        // A: attack left
    case 'a':
    case 'A':
        attack(0);
        break;
        // S: attack down
    case 's':
    case 'S':
        attack(3);
        break;
        // D: attack right
    case 'd':
    case 'D':
        attack(1);
        break;
        // R: restart
    case 'r':
    case 'R':
        startGame();
        break;
        // T: show or hide the placeholder labels (the saved scene is built again)
    case 't':
    case 'T':
        showLabels = !showLabels;
        buildSceneList();
        break;
        // F: show or hide the frames per second
    case 'f':
    case 'F':
        showFps = !showFps;
        fpsDirty = true;
        break;
    }
}

// Arrow keys attack
void special(int key, int x, int y) {
    // On the title page or the game over screen, an arrow key starts a game
    if (gameState != STATE_PLAYING) {
        tryStartGame();
        return;
    }

    switch (key) {
        // Left arrow: attack left
    case GLUT_KEY_LEFT:
        attack(0);
        break;
        // Right arrow: attack right
    case GLUT_KEY_RIGHT:
        attack(1);
        break;
        // Up arrow: attack up
    case GLUT_KEY_UP:
        attack(2);
        break;
        // Down arrow: attack down
    case GLUT_KEY_DOWN:
        attack(3);
        break;
    }
}

// Clicking starts the game from the title page, and attacks toward the clicked side while playing
void mouse(int button, int state, int x, int y) {
    // Only react when a button is pressed down
    if (state != GLUT_DOWN) {
        return;
    }

    // On the title page or the game over screen, any mouse button starts a game
    if (gameState != STATE_PLAYING) {
        tryStartGame();
        return;
    }

    // While playing, only the left button attacks
    if (button != GLUT_LEFT_BUTTON) {
        return;
    }

    float dx = (float)x - CENTER_X;
    float dy = (float)(WINDOW_HEIGHT - y) - CENTER_Y;

    // The click was farther sideways than up or down, so attack left or right
    if (fabs(dx) > fabs(dy)) {
        // Click on the left half attacks left, right half attacks right
        if (dx < 0.0f) {
            attack(0);
        }
        else {
            attack(1);
        }
    }
    // Otherwise attack up or down
    else {
        // Click above the hero attacks up, below attacks down
        if (dy > 0.0f) {
            attack(2);
        }
        else {
            attack(3);
        }
    }
}

int main(int argc, char** argv) {
    glutInit(&argc, argv);
    glutInitDisplayMode((DOUBLE_BUFFER ? GLUT_DOUBLE : GLUT_SINGLE) | GLUT_RGB);
    glutInitWindowPosition(100, 50);
    glutInitWindowSize(600, 800);
    glutCreateWindow("Four Fronts - Prototype");

    init();
    glutDisplayFunc(display);
    glutKeyboardFunc(keyboard);
    glutSpecialFunc(special);
    glutMouseFunc(mouse);

    // In sleep mode the idle function drives the game. In timer mode display() starts the timers.
    if (!USE_TIMER) {
        glutIdleFunc(idle);
    }

    measureClock();

    lastMs = nowMs();
    fpsStartMs = lastMs;

    glutMainLoop();

    return 0;
}
