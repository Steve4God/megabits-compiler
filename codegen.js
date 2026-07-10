const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PNG } = require('pngjs');

// Find the SGDK directory that contains mkfiles/Makefile.rom
function findGdkPath() {
  const gendev = process.env.GENDEV || '/opt/gendev';

  // Try common paths: symlink, versioned dir, direct
  const candidates = [
    path.join(gendev, 'sgdk'),
    path.join(gendev, 'sgdkv1.62'),
    path.join(gendev, 'sgdkv1.60'),
    path.join(gendev, 'sgdkv1.51'),
  ];

  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'mkfiles', 'Makefile.rom'))) {
      return c;
    }
  }

  // Fall back to searching the filesystem
  try {
    const found = execSync(`find ${gendev} -name Makefile.rom -path '*/mkfiles/*' 2>/dev/null | head -1`, { encoding: 'utf8' }).trim();
    if (found) {
      // found is .../mkfiles/Makefile.rom — return the parent of mkfiles
      return path.dirname(path.dirname(found));
    }
  } catch {}

  throw new Error(`SGDK Makefile.rom not found under ${gendev}. Checked: ${candidates.join(', ')}`);
}

const PALETTE = [
  [0, 0, 0],       // 0 - transparent
  [15, 15, 27],    // 1
  [255, 255, 255], // 2
  [155, 155, 170], // 3
  [74, 74, 94],    // 4
  [160, 96, 48],   // 5
  [92, 48, 16],    // 6
  [60, 176, 74],   // 7
  [26, 107, 42],   // 8
  [59, 93, 201],   // 9
  [107, 141, 255], // A
  [255, 215, 0],   // B
  [255, 140, 0],   // C
  [224, 32, 32],   // D
  [255, 204, 170], // E
  [255, 96, 170],  // F
];

function hexColorToPaletteIndex(hex) {
  if (!hex || hex === 'transparent') return 0;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  let minDist = Infinity, bestIdx = 0;
  for (let i = 1; i < PALETTE.length; i++) {
    const [pr, pg, pb] = PALETTE[i];
    const dist = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (dist < minDist) { minDist = dist; bestIdx = i; }
  }
  return bestIdx;
}

function createSpriteSheetPNG(frames, frameWidth, frameHeight) {
  const cols = Math.min(frames.length, 8);
  const rows = Math.ceil(frames.length / cols);
  const totalW = frameWidth * cols;
  const totalH = frameHeight * rows;
  const png = new PNG({ width: totalW, height: totalH });

  for (let f = 0; f < frames.length; f++) {
    const frame = frames[f];
    const col = f % cols;
    const row = Math.floor(f / cols);
    for (let y = 0; y < frameHeight; y++) {
      for (let x = 0; x < frameWidth; x++) {
        const pixel = frame[y] && frame[y][x];
        const pngX = col * frameWidth + x;
        const pngY = row * frameHeight + y;
        const idx = (pngY * totalW + pngX) << 2;
        if (pixel && pixel !== 'transparent') {
          const palIdx = hexColorToPaletteIndex(pixel);
          const [r, g, b] = PALETTE[palIdx];
          png.data[idx] = r;
          png.data[idx + 1] = g;
          png.data[idx + 2] = b;
          png.data[idx + 3] = 255;
        } else {
          png.data[idx] = 0;
          png.data[idx + 1] = 0;
          png.data[idx + 2] = 0;
          png.data[idx + 3] = 0;
        }
      }
    }
  }
  return png;
}

function createTileSheetPNG(tiles, tileSize = 16) {
  const cols = Math.min(tiles.length, 8);
  const rows = Math.ceil(tiles.length / cols);
  const totalW = tileSize * cols;
  const totalH = tileSize * rows;
  const png = new PNG({ width: totalW, height: totalH });

  for (let t = 0; t < tiles.length; t++) {
    const tile = tiles[t];
    const col = t % cols;
    const row = Math.floor(t / cols);
    for (let y = 0; y < tileSize; y++) {
      for (let x = 0; x < tileSize; x++) {
        const pixel = tile.pixels && tile.pixels[y] && tile.pixels[y][x];
        const pngX = col * tileSize + x;
        const pngY = row * tileSize + y;
        const idx = (pngY * totalW + pngX) << 2;
        if (pixel && pixel > 0) {
          const [r, g, b] = PALETTE[pixel] || PALETTE[0];
          png.data[idx] = r;
          png.data[idx + 1] = g;
          png.data[idx + 2] = b;
          png.data[idx + 3] = 255;
        } else {
          png.data[idx] = 107;
          png.data[idx + 1] = 141;
          png.data[idx + 2] = 255;
          png.data[idx + 3] = 255;
        }
      }
    }
  }
  return png;
}

function generateSplashC(gameData) {
  const name = gameData.name || 'MY GAME';
  const author = gameData.author || 'SIXTEEN MEGABITS';
  const splashTime = gameData.splash_duration || 3;

  return `// Auto-generated splash screen
#include "genesis.h"

#define SPLASH_TIME ${splashTime * 60}

void showSplash() {
    VDP_setBackgroundColor(6);
    VDP_clearPlane(BG_A, TRUE);
    VDP_clearPlane(BG_B, TRUE);

    // Draw a border
    VDP_drawText("================================", 1, 3);
    VDP_drawText("================================", 1, 22);

    // Game name (centered roughly)
    int nameLen = ${name.length};
    int nameX = (40 - nameLen) / 2;
    if (nameX < 1) nameX = 1;
    VDP_drawText("${name.toUpperCase()}", nameX, 8);

    // Decorative line
    VDP_drawText("--------------------------------", 1, 10);

    // Author
    int authorLen = ${author.length};
    int authorX = (40 - authorLen) / 2;
    if (authorX < 1) authorX = 1;
    VDP_drawText("by ${author}", authorX, 13);

    // Powered by
    VDP_drawText("Powered by Sixteen Megabits Studio", 4, 18);
    VDP_drawText("SGDK / Mega Drive", 12, 20);

    // Wait
    for (int i = 0; i < SPLASH_TIME; i++) {
        VDP_waitVSync();
    }

    VDP_clearPlane(BG_A, TRUE);
    VDP_clearPlane(BG_B, TRUE);
}
`;
}

function generateLevelC(gameData) {
  const levels = gameData.levels || [];
  if (levels.length === 0) {
    return generateSimpleLevelC(gameData);
  }

  const level = levels[0];
  const gridW = level.grid_width || 20;
  const gridH = level.grid_height || 14;

  // Parse collision data
  let collision = [];
  try { collision = JSON.parse(level.collision_data || '[]'); } catch {}
  if (!Array.isArray(collision) || collision.length === 0) {
    collision = Array(gridH).fill(null).map(() => Array(gridW).fill(0));
  }

  // Parse BG A (main layer)
  let bgA = [];
  try { bgA = JSON.parse(level.bg_a_data || '[]'); } catch {}
  if (!Array.isArray(bgA) || bgA.length === 0) {
    bgA = Array(gridH).fill(null).map(() => Array(gridW).fill(0));
  }

  // Generate collision map as C array
  let collisionArray = '';
  for (let y = 0; y < gridH; y++) {
    let row = '  ';
    for (let x = 0; x < gridW; x++) {
      const c = collision[y] && collision[y][x] ? 1 : 0;
      row += c + ',';
    }
    collisionArray += row + '\n';
  }

  // Generate tile map (which tile index at each position)
  let tileArray = '';
  for (let y = 0; y < gridH; y++) {
    let row = '  ';
    for (let x = 0; x < gridW; x++) {
      const t = bgA[y] && bgA[y][x] ? bgA[y][x] : 0;
      row += t + ',';
    }
    tileArray += row + '\n';
  }

  return `// Auto-generated level data
#include "genesis.h"

#define GRID_W ${gridW}
#define GRID_H ${gridH}
#define TILE_SIZE 16

// Collision map: 1 = solid, 0 = empty
const u8 collision_map[GRID_H][GRID_W] = {
${collisionArray}
};

// Tile index map for background
const u8 tile_map[GRID_H][GRID_W] = {
${tileArray}
};

// Check if a world-space pixel position is solid
u8 isSolid(s16 px, s16 py) {
    if (px < 0 || py < 0) return 1; // walls
    s16 tx = px / TILE_SIZE;
    s16 ty = py / TILE_SIZE;
    if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) return 0;
    return collision_map[ty][tx];
}

void drawLevel() {
    VDP_setBackgroundColor(10); // sky blue-ish
    VDP_clearPlane(BG_A, TRUE);
    VDP_clearPlane(BG_B, TRUE);

    // Draw a simple colored background pattern
    // For each cell, draw a colored rectangle representation
    for (int y = 0; y < GRID_H; y++) {
        for (int x = 0; x < GRID_W; x++) {
            if (collision_map[y][x] == 1) {
                // Draw solid blocks as text pattern (simplified)
                char buf[2];
                buf[0] = '#';
                buf[1] = 0;
                VDP_drawText(buf, x, y);
            }
        }
    }
}
`;
}

function generateSimpleLevelC(gameData) {
  return `// Auto-generated level (no level data, using default)
#include "genesis.h"

#define GRID_W 20
#define GRID_H 14
#define TILE_SIZE 16

const u8 collision_map[GRID_H][GRID_W] = {
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
  {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
  {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
};

const u8 tile_map[GRID_H][GRID_W] = {
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0},
  {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
  {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
  {1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},
};

u8 isSolid(s16 px, s16 py) {
    if (px < 0 || py < 0) return 1;
    s16 tx = px / TILE_SIZE;
    s16 ty = py / TILE_SIZE;
    if (tx < 0 || tx >= GRID_W || ty < 0 || ty >= GRID_H) return 0;
    return collision_map[ty][tx];
}

void drawLevel() {
    VDP_setBackgroundColor(10);
    VDP_clearPlane(BG_A, TRUE);
    VDP_clearPlane(BG_B, TRUE);
    for (int y = 0; y < GRID_H; y++) {
        for (int x = 0; x < GRID_W; x++) {
            if (collision_map[y][x] == 1) {
                VDP_drawText("#", x, y);
            }
        }
    }
}
`;
}

function generateMainC(gameData) {
  const name = gameData.name || 'My Game';

  // Extract physics from level data
  const levels = gameData.levels || [];
  const level = levels[0] || {};
  const gravity = level.gravity || 0.4;
  const playerSpeed = level.player_speed || 2;
  const jumpPower = level.jump_power || 7;

  // Extract blueprint logic if available
  const blueprints = gameData.blueprints || [];
  const bp = blueprints[0];
  let blueprintCode = '';
  let blueprintCalls = '';

  if (bp && bp.nodes_data && bp.connections_data) {
    let nodes = [], connections = [];
    try { nodes = JSON.parse(bp.nodes_data); } catch {}
    try { connections = JSON.parse(bp.connections_data); } catch {}

    // Find "when_button" events and generate input handlers
    const buttonEvents = nodes.filter(n => n.type === 'when_button');
    buttonEvents.forEach(ev => {
      const btn = ev.properties?.button || 'right';
      const connected = connections.filter(c => c.from_node === ev.id);
      connected.forEach(conn => {
        const targetNode = nodes.find(n => n.id === conn.to_node);
        if (targetNode) {
          if (targetNode.type === 'do_move') {
            const dir = targetNode.properties?.direction || 'right';
            const speed = targetNode.properties?.speed || playerSpeed;
            const btnVar = `btn_${btn}`;
            blueprintCode += `  // When ${btn} pressed: Move ${dir}\n`;
            blueprintCode += `  if (state & BUTTON_${btn.toUpperCase()}) {\n`;
            if (dir === 'right') blueprintCode += `    player.vx = ${speed};\n`;
            else if (dir === 'left') blueprintCode += `    player.vx = -${speed};\n`;
            else if (dir === 'up') blueprintCode += `    player.vy = -${speed};\n`;
            else if (dir === 'down') blueprintCode += `    player.vy = ${speed};\n`;
            blueprintCode += `  }\n`;
          } else if (targetNode.type === 'do_jump') {
            const power = targetNode.properties?.power || jumpPower;
            blueprintCode += `  // When ${btn} pressed: Jump\n`;
            blueprintCode += `  if (state & BUTTON_${btn.toUpperCase()}) {\n`;
            blueprintCode += `    if (player.onGround) { player.vy = -${power}; player.onGround = 0; }\n`;
            blueprintCode += `  }\n`;
          }
        }
      });
    });
  }

  // If no blueprint logic, use default controls
  if (!blueprintCode) {
    blueprintCode = `  // Default controls
  if (state & BUTTON_RIGHT) player.vx = ${playerSpeed};
  else if (state & BUTTON_LEFT) player.vx = -${playerSpeed};
  else player.vx = 0;

  if (state & BUTTON_UP) player.vy = -${playerSpeed};
  else if (state & BUTTON_DOWN) player.vy = ${playerSpeed};

  if (state & BUTTON_A) {
    if (player.onGround) { player.vy = -${jumpPower}; player.onGround = 0; }
  }
  if (state & BUTTON_B) {
    if (player.onGround) { player.vy = -${jumpPower}; player.onGround = 0; }
  }
`;
  }

  return `// =====================================================
// ${name} - Generated by Sixteen Megabits Studio
// =====================================================
#include "genesis.h"
#include <stdio.h>

#define GRAVITY  FIX32(${gravity})
#define MAX_FALL FIX32(8)

typedef struct {
    fix32 x, y;
    fix32 vx, vy;
    s16 onGround;
} Player;

Player player;

void initPlayer() {
    player.x = FIX32(80);
    player.y = FIX32(100);
    player.vx = 0;
    player.vy = 0;
    player.onGround = 0;
}

void updatePlayer() {
    u16 state = JOY_readJoypad(JOY_1);

${blueprintCode}

    // Apply gravity
    if (!player.onGround) {
        player.vy += GRAVITY / 60;
        if (player.vy > MAX_FALL) player.vy = MAX_FALL;
    }

    // Move and check collisions
    fix32 newX = player.x + player.vx;
    // Horizontal collision
    if (isSolid(fix32ToInt(newX), fix32ToInt(player.y) + 8) ||
        isSolid(fix32ToInt(newX) + 15, fix32ToInt(player.y) + 8)) {
        // Don't move
    } else {
        player.x = newX;
    }

    fix32 newY = player.y + player.vy;
    // Vertical collision
    s16 footY = fix32ToInt(newY) + 15;
    s16 leftX = fix32ToInt(player.x);
    s16 rightX = fix32ToInt(player.x) + 15;

    if (player.vy >= 0) { // falling
        if (isSolid(leftX, footY) || isSolid(rightX, footY)) {
            player.y = FIX32((footY / 16) * 16 - 16);
            player.vy = 0;
            player.onGround = 1;
        } else {
            player.y = newY;
            player.onGround = 0;
        }
    } else { // jumping
        if (isSolid(leftX, fix32ToInt(newY)) || isSolid(rightX, fix32ToInt(newY))) {
            player.vy = 0;
        } else {
            player.y = newY;
        }
    }

    // Keep in bounds
    if (player.x < FIX32(0)) player.x = 0;
    if (player.x > FIX32(304)) player.x = FIX32(304);
    if (player.y > FIX32(400)) { // fell off
        initPlayer();
    }
}

void drawPlayer() {
    char buf[2];
    buf[0] = 'P';
    buf[1] = 0;

    // Clear old position area (simplified)
    VDP_clearText(0, 0, 40);

    // Draw player as a marker
    s16 px = fix32ToInt(player.x) / 8; // convert to tile coords for text
    s16 py = fix32ToInt(player.y) / 8;
    if (px < 0) px = 0;
    if (px > 39) px = 39;
    if (py < 0) py = 0;
    if (py > 27) py = 27;
    VDP_drawText("@", px, py);
}

int main() {
    // Show splash screen
    showSplash();

    // Init game
    initPlayer();
    drawLevel();

    // Display HUD
    VDP_drawText("${name.toUpperCase()}", 1, 0);

    char scoreText[16];
    int score = 0;

    while (1) {
        updatePlayer();
        drawPlayer();

        // Update score display
        sprintf(scoreText, "SCORE:%d", score);
        VDP_drawText("          ", 28, 0);
        VDP_drawText(scoreText, 28, 0);

        VDP_waitVSync();
        score++;
    }

    return 0;
}
`;
}

function generateResourceFile(gameData) {
  // Generate .res file for SGDK rescomp
  let res = '// Auto-generated resources\n';

  // Add palette from first sprite if available
  const sprites = gameData.sprites || [];
  if (sprites.length > 0) {
    const sprite = sprites[0];
    let frames = [];
    try { frames = JSON.parse(sprite.frames_data || '[]'); } catch {}
    if (frames.length > 0) {
      res += `SPRITE player_sprite "res/player.png" ${sprite.width || 16} ${sprite.height || 16} NONE 1\n`;
      res += `PALETTE player_pal "res/player.png"\n`;
    }
  }

  return res;
}

async function generateProject(projectDir, gameData) {
  // Create directory structure
  fs.mkdirSync(path.join(projectDir, 'src'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'res'), { recursive: true });

  // Generate sprite sheet PNG if sprites exist
  const sprites = gameData.sprites || [];
  if (sprites.length > 0) {
    const sprite = sprites[0];
    let frames = [];
    try { frames = JSON.parse(sprite.frames_data || '[]'); } catch {}
    if (frames.length > 0) {
      const png = createSpriteSheetPNG(frames, sprite.width || 16, sprite.height || 16);
      const buffer = PNG.sync.write(png);
      fs.writeFileSync(path.join(projectDir, 'res', 'player.png'), buffer);
    }
  }

  // Generate tile sheet PNG if tiles exist
  const tiles = gameData.tiles || [];
  if (tiles.length > 0) {
    const png = createTileSheetPNG(tiles, 16);
    const buffer = PNG.sync.write(png);
    fs.writeFileSync(path.join(projectDir, 'res', 'tiles.png'), buffer);
  }

  // Generate source files
  fs.writeFileSync(path.join(projectDir, 'src', 'splash.c'), generateSplashC(gameData));
  fs.writeFileSync(path.join(projectDir, 'src', 'level.c'), generateLevelC(gameData));
  fs.writeFileSync(path.join(projectDir, 'src', 'main.c'), generateMainC(gameData));

  // Generate resource file
  fs.writeFileSync(path.join(projectDir, 'res', 'resources.res'), generateResourceFile(gameData));

  // Generate Makefile (uses gendev's SGDK makefile)
  const gdkPath = findGdkPath();
  console.log('Found SGDK at:', gdkPath);
  const makefileContent = `# Auto-generated Makefile
GDK := ${gdkPath}
export GDK

# Project name
PROJNAME := game

# Source directories
SRC := src
RES := res
BIN := out

# Use SGDK build system
include $(GDK)/mkfiles/Makefile.rom
`;
  fs.writeFileSync(path.join(projectDir, 'Makefile'), makefileContent);

  // Copy SGDK rom header if needed (gendev provides one)
  console.log('Project generated at', projectDir);
}

async function compileProject(projectDir, projectId) {
  const gendevPath = process.env.GENDEV || '/opt/gendev';
  const gdkPath = findGdkPath();
  const buildLogPath = path.join(projectDir, 'build.log');

  // Run the SGDK build
  const cmd = `cd ${projectDir} && make -f ${gdkPath}/mkfiles/Makefile.rom clean all 2>&1 | tee ${buildLogPath}`;

  try {
    execSync(cmd, {
      timeout: 120000,
      env: { ...process.env, GENDEV: gendevPath, GDK: gdkPath },
    });
  } catch (error) {
    // Read build log for error details
    let log = '';
    try { log = fs.readFileSync(buildLogPath, 'utf8'); } catch {}
    throw new Error(`SGDK compilation failed. Build log:\n${log.slice(-2000)}`);
  }

  // Find the output ROM
  const possiblePaths = [
    path.join(projectDir, 'out', 'rom.bin'),
    path.join(projectDir, 'out', 'game.bin'),
    path.join(projectDir, 'out.bin'),
    path.join(projectDir, 'rom.bin'),
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // List what's in the out directory
  const outDir = path.join(projectDir, 'out');
  if (fs.existsSync(outDir)) {
    const files = fs.readdirSync(outDir);
    throw new Error(`ROM file not found. Files in out/: ${files.join(', ')}`);
  }

  throw new Error('ROM file not found and no out/ directory created. Check build.log for errors.');
}

module.exports = { generateProject, compileProject };