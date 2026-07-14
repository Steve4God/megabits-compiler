const express = require('express');
const cors = require('cors');
const { generateProject, compileProject } = require('./codegen');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'megabits-android-compiler', engine: 'phaser3', platform: 'capacitor-android' });
});

app.post('/compile', async (req, res) => {
  const gameData = req.body;

  if (!gameData || !gameData.name) {
    return res.status(400).json({ error: 'Game data must include a "name" field' });
  }

  const projectId = `game_${Date.now()}`;
  const projectDir = path.join(os.tmpdir(), projectId);

  console.log(`[${projectId}] Starting Android build for "${gameData.name}"`);

  try {
    // Step 1: Generate Phaser 3 game project
    console.log(`[${projectId}] Generating Phaser 3 game code...`);
    await generateProject(projectDir, gameData);

    // Step 2: Build Android APK with Capacitor
    console.log(`[${projectId}] Building Android APK...`);
    const apkPath = await compileProject(projectDir, projectId);

    // Step 3: Read the compiled APK
    const apkBuffer = fs.readFileSync(apkPath);
    const apkBase64 = apkBuffer.toString('base64');

    console.log(`[${projectId}] Build successful! APK size: ${apkBuffer.length} bytes`);

    res.json({
      status: 'success',
      game_name: gameData.name,
      apk_size: apkBuffer.length,
      apk_base64: apkBase64,
      apk_filename: `${gameData.name.replace(/[^a-zA-Z0-9]/g, '_')}.apk`,
    });

    // Clean up after a delay
    setTimeout(() => {
      try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}
    }, 30000);

  } catch (error) {
    console.error(`[${projectId}] Build failed:`, error.message);

    let buildLog = '';
    try {
      buildLog = fs.readFileSync(path.join(projectDir, 'build.log'), 'utf8');
    } catch {}

    res.status(500).json({
      status: 'error',
      error: error.message,
      build_log: buildLog.slice(-8000),
    });

    setTimeout(() => {
      try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}
    }, 60000);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sixteen Megabits Android Compiler running on port ${PORT}`);
  console.log(`Engine: Phaser 3 + Capacitor Android`);
});