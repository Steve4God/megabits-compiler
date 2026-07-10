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
  res.json({ status: 'ok', service: 'megabits-rom-compiler', sgdk: 'gendev' });
});

app.get('/diag', (req, res) => {
  const { execSync } = require('child_process');
  const gendev = process.env.GENDEV || '/opt/gendev';
  let listing = '';
  try {
    listing = execSync(`ls -la ${gendev}/ && echo "---" && ls -la ${gendev}/sgdk* 2>/dev/null && echo "---" && find ${gendev} -name Makefile.rom 2>/dev/null`, { encoding: 'utf8' });
  } catch (e) {
    listing = e.stdout || e.message;
  }
  res.type('text/plain').send(listing);
});

app.post('/compile', async (req, res) => {
  const gameData = req.body;

  if (!gameData || !gameData.name) {
    return res.status(400).json({ error: 'Game data must include a "name" field' });
  }

  const projectId = `game_${Date.now()}`;
  const projectDir = path.join(os.tmpdir(), projectId);

  console.log(`[${projectId}] Starting compilation for "${gameData.name}"`);

  try {
    // Step 1: Generate SGDK C source from game data
    console.log(`[${projectId}] Generating C source code...`);
    await generateProject(projectDir, gameData);

    // Step 2: Compile with SGDK
    console.log(`[${projectId}] Compiling ROM with SGDK...`);
    const romPath = await compileProject(projectDir, projectId);

    // Step 3: Read the compiled ROM
    const romBuffer = fs.readFileSync(romPath);
    const romBase64 = romBuffer.toString('base64');

    console.log(`[${projectId}] Compilation successful! ROM size: ${romBuffer.length} bytes`);

    res.json({
      status: 'success',
      game_name: gameData.name,
      rom_size: romBuffer.length,
      rom_base64: romBase64,
      rom_filename: `${gameData.name.replace(/[^a-zA-Z0-9]/g, '_')}.md`,
    });

    // Clean up after a delay
    setTimeout(() => {
      try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}
    }, 30000);

  } catch (error) {
    console.error(`[${projectId}] Compilation failed:`, error.message);

    let buildLog = '';
    try {
      buildLog = fs.readFileSync(path.join(projectDir, 'build.log'), 'utf8');
    } catch {}

    res.status(500).json({
      status: 'error',
      error: error.message,
      build_log: buildLog.slice(-3000),
    });

    setTimeout(() => {
      try { fs.rmSync(projectDir, { recursive: true, force: true }); } catch {}
    }, 60000);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sixteen Megabits ROM Compiler running on port ${PORT}`);
  console.log(`SGDK (GENDEV) path: ${process.env.GENDEV || '/opt/gendev'}`);
});