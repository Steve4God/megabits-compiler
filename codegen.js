const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

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

function createDefaultPlayerPNG() {
  const png = new PNG({ width: 16, height: 16 });
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const idx = (y * 16 + x) << 2;
      const isBorder = x === 0 || x === 15 || y === 0 || y === 15;
      png.data[idx] = isBorder ? 255 : 224;
      png.data[idx + 1] = isBorder ? 255 : 50;
      png.data[idx + 2] = isBorder ? 255 : 50;
      png.data[idx + 3] = 255;
    }
  }
  return png;
}

function generateIndexHtml(gameData) {
  const name = gameData.name || 'My Game';
  return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no, viewport-fit=cover">
    <title>${name}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { background: #000; overflow: hidden; width: 100%; height: 100%; }
        #game-container { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
        canvas { display: block; }
    </style>
</head>
<body>
    <div id="game-container"></div>
    <script src="phaser.min.js"></script>
    <script src="game.js"></script>
</body>
</html>`;
}

function generateInputLogic(blueprints, playerSpeed, jumpPower) {
  const speedVal = Math.round(playerSpeed * 75);
  const jumpVal = Math.round(jumpPower * 50);

  const buttonChecks = {
    right: 'this.cursors.right.isDown || this.wasd.D.isDown || this.touchRight',
    left:  'this.cursors.left.isDown || this.wasd.A.isDown || this.touchLeft',
    up:    'this.cursors.up.isDown || this.wasd.W.isDown',
    down:  'this.cursors.down.isDown || this.wasd.S.isDown',
    a:     'this.wasd.SPACE.isDown || this.touchJump',
    b:     'this.wasd.SPACE.isDown || this.touchJump',
  };

  let bp = null;
  if (blueprints && blueprints.length > 0) bp = blueprints[0];

  if (!bp || !bp.nodes_data || !bp.connections_data) {
    return `        const speed = GAME.playerSpeed;
        const onGround = this.player.body.blocked.down;

        if (this.cursors.left.isDown || this.wasd.A.isDown || this.touchLeft) {
            this.player.setVelocityX(-speed);
        } else if (this.cursors.right.isDown || this.wasd.D.isDown || this.touchRight) {
            this.player.setVelocityX(speed);
        } else {
            this.player.setVelocityX(0);
        }

        if ((this.cursors.up.isDown || this.wasd.W.isDown || this.wasd.SPACE.isDown || this.touchJump) && onGround) {
            this.player.setVelocityY(-GAME.jumpPower);
        }`;
  }

  let nodes = [], connections = [];
  try { nodes = JSON.parse(bp.nodes_data); } catch {}
  try { connections = JSON.parse(bp.connections_data); } catch {}

  let logic = '        const onGround = this.player.body.blocked.down;\n';
  let hasMove = false;

  const buttonEvents = nodes.filter(n => n.type === 'when_button');
  buttonEvents.forEach(ev => {
    const btn = (ev.properties?.button || 'right').toLowerCase();
    const check = buttonChecks[btn] || buttonChecks.right;
    const connected = connections.filter(c => c.from_node === ev.id);

    connected.forEach(conn => {
      const target = nodes.find(n => n.id === conn.to_node);
      if (!target) return;

      if (target.type === 'do_move') {
        const dir = target.properties?.direction || 'right';
        const speed = target.properties?.speed || playerSpeed;
        const sv = Math.round(speed * 75);
        hasMove = true;
        if (dir === 'right')      logic += `        if (${check}) { this.player.setVelocityX(${sv}); }\n`;
        else if (dir === 'left')  logic += `        if (${check}) { this.player.setVelocityX(-${sv}); }\n`;
        else if (dir === 'up')    logic += `        if (${check}) { this.player.setVelocityY(-${sv}); }\n`;
        else if (dir === 'down')  logic += `        if (${check}) { this.player.setVelocityY(${sv}); }\n`;
      } else if (target.type === 'do_jump') {
        const power = target.properties?.power || jumpPower;
        const jv = Math.round(power * 50);
        logic += `        if (${check} && onGround) { this.player.setVelocityY(-${jv}); }\n`;
      }
    });
  });

  if (hasMove) {
    logic += '        if (!this.cursors.left.isDown && !this.wasd.A.isDown && !this.touchLeft && !this.cursors.right.isDown && !this.wasd.D.isDown && !this.touchRight) { this.player.setVelocityX(0); }\n';
  }

  return logic || '        this.player.setVelocityX(0);';
}

function generateGameJs(gameData) {
  const name = gameData.name || 'My Game';
  const author = gameData.author || 'Anonymous';
  const splashMs = (gameData.splash_duration || 3) * 1000;

  const levels = gameData.levels || [];
  const level = levels[0] || {};
  const gridW = level.grid_width || 20;
  const gridH = level.grid_height || 14;
  const gravity = level.gravity || 0.4;
  const playerSpeed = level.player_speed || 2;
  const jumpPower = level.jump_power || 7;

  let collision = [];
  try { collision = JSON.parse(level.collision_data || '[]'); } catch {}
  if (!Array.isArray(collision) || collision.length === 0) {
    collision = Array(gridH).fill(null).map(() => Array(gridW).fill(0));
    for (let x = 0; x < gridW; x++) {
      collision[gridH - 1][x] = 1;
      collision[gridH - 2][x] = 1;
      collision[gridH - 3][x] = 1;
    }
  }

  const sprites = gameData.sprites || [];
  const sprite = sprites[0];
  const spriteW = sprite?.width || 16;
  const spriteH = sprite?.height || 16;

  const inputLogic = generateInputLogic(gameData.blueprints, playerSpeed, jumpPower);

  return `// =====================================================
// ${name} - Generated by Sixteen Megabits Studio
// Engine: Phaser 3 + Capacitor Android
// =====================================================

const GAME = {
    name: ${JSON.stringify(name)},
    author: ${JSON.stringify(author)},
    width: 320,
    height: 224,
    gravity: ${gravity},
    playerSpeed: ${Math.round(playerSpeed * 75)},
    jumpPower: ${Math.round(jumpPower * 50)},
    tileSize: 16,
    gridW: ${gridW},
    gridH: ${gridH},
    collision: ${JSON.stringify(collision)},
    splashTime: ${splashMs}
};

// --- Splash Scene ---
class SplashScene extends Phaser.Scene {
    constructor() { super({ key: 'Splash' }); }

    create() {
        this.cameras.main.setBackgroundColor('#0F0F1B');
        const { width, height } = this.scale;

        this.add.text(width / 2, height / 2 - 30, GAME.name, {
            fontFamily: 'monospace', fontSize: '20px', color: '#6C9EFF', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 10, 'by ' + GAME.author, {
            fontFamily: 'monospace', fontSize: '10px', color: '#9B9BAA'
        }).setOrigin(0.5);

        this.add.text(width / 2, height - 20, 'Sixteen Megabits Studio', {
            fontFamily: 'monospace', fontSize: '8px', color: '#4A4A5E'
        }).setOrigin(0.5);

        this.time.delayedCall(GAME.splashTime, () => this.scene.start('Game'));
    }
}

// --- Game Scene ---
class GameScene extends Phaser.Scene {
    constructor() { super({ key: 'Game' }); }

    preload() {
        this.load.spritesheet('player', 'assets/player.png', {
            frameWidth: ${spriteW}, frameHeight: ${spriteH}
        });
    }

    create() {
        this.cameras.main.setBackgroundColor('#6B8DFF');

        // Build level tiles
        this.solids = this.physics.add.staticGroup();
        for (let y = 0; y < GAME.gridH; y++) {
            for (let x = 0; x < GAME.gridW; x++) {
                if (GAME.collision[y] && GAME.collision[y][x]) {
                    const tile = this.add.rectangle(
                        x * GAME.tileSize + GAME.tileSize / 2,
                        y * GAME.tileSize + GAME.tileSize / 2,
                        GAME.tileSize, GAME.tileSize, 0x4A4A5E
                    );
                    tile.setStrokeStyle(1, 0x2A2A3E);
                    this.physics.add.existing(tile, true);
                    this.solids.add(tile);
                }
            }
        }

        // Create player
        this.player = this.physics.add.sprite(GAME.tileSize * 2, GAME.tileSize * 2, 'player');
        this.player.setCollideWorldBounds(true);
        this.player.setSize(${spriteW}, ${spriteH});

        // Collisions
        this.physics.add.collider(this.player, this.solids);

        // Input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys('W,A,S,D,SPACE');
        this.touchLeft = false;
        this.touchRight = false;
        this.touchJump = false;
        this.setupTouchControls();

        // HUD
        this.add.text(4, 4, GAME.name, {
            fontFamily: 'monospace', fontSize: '8px', color: '#FFFFFF'
        });
    }

    setupTouchControls() {
        const w = this.scale.width, h = this.scale.height;

        const left = this.add.zone(0, 0, w * 0.33, h).setOrigin(0, 0).setInteractive();
        left.on('pointerdown', () => this.touchLeft = true);
        left.on('pointerup', () => this.touchLeft = false);
        left.on('pointerout', () => this.touchLeft = false);

        const right = this.add.zone(w * 0.67, 0, w * 0.33, h).setOrigin(0, 0).setInteractive();
        right.on('pointerdown', () => this.touchRight = true);
        right.on('pointerup', () => this.touchRight = false);
        right.on('pointerout', () => this.touchRight = false);

        const jump = this.add.zone(w * 0.33, 0, w * 0.34, h).setOrigin(0, 0).setInteractive();
        jump.on('pointerdown', () => this.touchJump = true);
        jump.on('pointerup', () => this.touchJump = false);
    }

    update() {
${inputLogic}
    }
}

// --- Config ---
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: GAME.width,
    height: GAME.height,
    pixelArt: true,
    backgroundColor: '#000000',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: GAME.gravity * 1000 },
            debug: false
        }
    },
    scene: [SplashScene, GameScene]
};

new Phaser.Game(config);`;
}

function generateCapacitorConfig(gameData) {
  const cleanName = (gameData.name || 'game').toLowerCase().replace(/[^a-z0-9]/g, '');
  return JSON.stringify({
    appId: `com.megabits.${cleanName || 'game'}`,
    appName: gameData.name || 'My Game',
    webDir: 'www',
    server: { androidScheme: 'https' }
  }, null, 2);
}

function generateProjectPackageJson(gameData) {
  const cleanName = (gameData.name || 'game').toLowerCase().replace(/[^a-z0-9]/g, '-');
  return JSON.stringify({
    name: cleanName,
    version: '1.0.0',
    dependencies: {
      '@capacitor/android': '^6.1.2',
      '@capacitor/core': '^6.1.2',
      '@capacitor/cli': '^6.1.2',
      'phaser': '^3.80.1'
    }
  }, null, 2);
}

async function generateProject(projectDir, gameData) {
  const wwwDir = path.join(projectDir, 'www');
  const assetsDir = path.join(wwwDir, 'assets');
  fs.mkdirSync(wwwDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  // index.html
  fs.writeFileSync(path.join(wwwDir, 'index.html'), generateIndexHtml(gameData));

  // game.js
  fs.writeFileSync(path.join(wwwDir, 'game.js'), generateGameJs(gameData));

  // player.png
  const sprites = gameData.sprites || [];
  let playerPng;
  if (sprites.length > 0) {
    const sprite = sprites[0];
    let frames = [];
    try { frames = JSON.parse(sprite.frames_data || '[]'); } catch {}
    if (frames.length > 0) {
      playerPng = createSpriteSheetPNG(frames, sprite.width || 16, sprite.height || 16);
    } else {
      playerPng = createDefaultPlayerPNG();
    }
  } else {
    playerPng = createDefaultPlayerPNG();
  }
  fs.writeFileSync(path.join(assetsDir, 'player.png'), PNG.sync.write(playerPng));

  // capacitor.config.json
  fs.writeFileSync(path.join(projectDir, 'capacitor.config.json'), generateCapacitorConfig(gameData));

  // package.json
  fs.writeFileSync(path.join(projectDir, 'package.json'), generateProjectPackageJson(gameData));

  console.log('Project generated at', projectDir);
}

async function compileProject(projectDir, projectId) {
  const { execSync } = require('child_process');
  const buildLogPath = path.join(projectDir, 'build.log');
  fs.writeFileSync(buildLogPath, '');

  function runStep(stepName, cmd, opts = {}) {
    console.log(`[${projectId}] ${stepName}...`);
    fs.appendFileSync(buildLogPath, `\n=== ${stepName} ===\n`);
    try {
      execSync(`${cmd} >> "${buildLogPath}" 2>&1`, {
        timeout: opts.timeout || 300000,
        env: process.env,
        cwd: opts.cwd || projectDir,
      });
    } catch (error) {
      let log = '';
      try { log = fs.readFileSync(buildLogPath, 'utf8'); } catch {}
      throw new Error(`${stepName} failed. Build log (last 6000 chars):\n${log.slice(-6000)}`);
    }
  }

  // Step 1: Install npm dependencies
  runStep('Installing npm dependencies', 'npm install');

  // Step 2: Copy phaser.min.js to www/
  const phaserSrc = path.join(projectDir, 'node_modules', 'phaser', 'dist', 'phaser.min.js');
  const phaserDest = path.join(projectDir, 'www', 'phaser.min.js');
  if (fs.existsSync(phaserSrc)) {
    fs.copyFileSync(phaserSrc, phaserDest);
    console.log(`[${projectId}] Copied phaser.min.js to www/`);
  } else {
    throw new Error('phaser.min.js not found after npm install');
  }

  // Step 3: Add Android platform
  runStep('Adding Android platform', 'npx cap add android');

  // Step 4: Sync web assets
  runStep('Syncing Capacitor', 'npx cap sync android');

  // Step 5: Build debug APK
  const gradleCmd = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
  runStep('Building APK (Gradle assembleDebug)', `${gradleCmd} assembleDebug`, {
    cwd: path.join(projectDir, 'android'),
    timeout: 600000,
  });

  // Step 6: Find the APK
  const apkPath = path.join(projectDir, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
  if (fs.existsSync(apkPath)) {
    return apkPath;
  }

  throw new Error('APK file not found after build');
}

module.exports = { generateProject, compileProject };