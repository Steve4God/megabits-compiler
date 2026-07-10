# Sixteen Megabits ROM Compiler

An SGDK-based compilation server that converts game data from the Sixteen Megabits Studio into real Sega Mega Drive / Genesis ROM files (`.md`).

## What This Does

1. Receives game data (levels, sprites, blueprints) as JSON via HTTP
2. Generates SGDK C source code from the data
3. Compiles a real Mega Drive ROM using SGDK + the m68k-elf GCC toolchain
4. Returns the compiled ROM as a downloadable `.md` file

## Architecture

```
Base44 App (Studio)  ──HTTP POST──>  ROM Compiler Server  ──SGDK──>  .md ROM
                      <──ROM (base64)──
```

## Deploy on Render (free tier)

### Step 1 — Push to GitHub

The contents of this folder should already be in your GitHub repo (`megabits-compiler`).

### Step 2 — Deploy on Render

1. Go to [render.com](https://render.com) and sign in with GitHub
2. Click **New +** → **Web Service**
3. Select your `megabits-compiler` repository
4. Render auto-detects the Dockerfile — set the following:
   - **Name**: `megabits-compiler`
   - **Runtime**: Docker
   - **Instance Type**: Free
   - **Health Check Path**: `/health`
5. Click **Create Web Service**
6. The first build takes ~5–10 minutes (pulls the 376 MB gendev toolchain image + installs Node.js)
7. Once deployed, Render gives you a public URL like `https://megabits-compiler.onrender.com`
8. Test it: visit `https://YOUR-URL/health` — you should see `{"status":"ok",...}`

### Step 3 — Connect to your Base44 studio

In your Base44 dashboard → Settings → Environment Variables, set:

```
ROM_COMPILER_URL = https://megabits-compiler.onrender.com
```

That's it — the "Compile ROM" button in your studio will now produce real `.md` ROMs.

### Render notes

- **Free tier**: Render gives 750 hours/month. The service spins down after 15 min of inactivity, so it won't consume hours while idle.
- **Cold starts**: After idle, the first compile request takes ~30–60 seconds to wake the server (subsequent requests are fast).
- **Build time**: Each ROM compilation takes 10–30 seconds once the server is awake.
- **Port**: Render sets `PORT` automatically — `server.js` already reads it.

## API

### `GET /health`
Returns server status.

### `POST /compile`
Compiles game data into a Mega Drive ROM.

**Request body:**
```json
{
  "name": "My Awesome Game",
  "author": "Game Studio Name",
  "splash_duration": 3,
  "levels": [
    {
      "name": "Level 1",
      "grid_width": 20,
      "grid_height": 14,
      "bg_color": "#6B8DFF",
      "bg_a_data": "[[1,1,0,...],...]",
      "collision_data": "[[1,1,0,...],...]",
      "gravity": 0.4,
      "player_speed": 2,
      "jump_power": 7
    }
  ],
  "sprites": [
    {
      "name": "Player",
      "width": 16,
      "height": 16,
      "frames_data": "[[[\"#FF0000\",null,...],...]]",
      "collision_data": "{\"x\":2,\"y\":2,\"w\":12,\"h\":12}"
    }
  ],
  "blueprints": [
    {
      "nodes_data": "[...]",
      "connections_data": "[...]"
    }
  ]
}
```

**Response:**
```json
{
  "status": "success",
  "game_name": "My Awesome Game",
  "rom_size": 131072,
  "rom_base64": "...",
  "rom_filename": "My_Awesome_Game.md"
}
```

## What's Included

- **Splash screen** — Each ROM boots with a splash showing the game name, author, and "Powered by Sixteen Megabits Studio / SGDK"
- **Level rendering** — Draws the level collision map
- **Player physics** — Gravity, jumping, collision detection with solid tiles
- **Input handling** — D-pad moves, A/B buttons jump (configurable via blueprints)
- **Blueprint logic** — Visual "When → Do" blocks are translated to C input handlers

## Local Development

```bash
npm install
npm start
```

The server runs on `http://localhost:3000`.

Note: Local development requires the gendev/SGDK toolchain. The easiest way is to build the Docker image:

```bash
docker build -t megabits-compiler .
docker run -p 3000:3000 megabits-compiler
```

## Tech Stack

- **SGDK** (Sega Genesis Development Kit) — C library for Mega Drive development
- **gendev** — Linux port of the SGDK toolchain (m68k-elf-gcc)
- **Node.js + Express** — HTTP server
- **pngjs** — PNG generation for sprite/tile sheets