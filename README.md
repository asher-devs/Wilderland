# WILDERLAND

Multiplayer 2D sandbox survival for the browser. Zero npm dependencies: the server uses Node's built-in `http`, `crypto`, `zlib` and `node:sqlite` (Node >= 22.5) and a hand-written WebSocket implementation. The client is plain HTML/CSS/JS on Canvas with procedurally generated pixel art and synthesized audio (no asset files).

## Run
```
node --no-warnings server/index.js      # or: npm start
# open http://localhost:3000 — create a world, share the 5-letter room code (up to 4 players)
```
Env: `PORT` (default 3000), `DATA_DIR` (default `./data`, holds `wilderland.db`).

## Controls
Desktop: A/D or arrows move, Space/W jump, Shift sprint, left-click mine/attack, right-click place/use/open chest, 1-0 or wheel hotbar, E inventory, Q drop, T chat, Tab players, Esc menu.
Mobile: on-screen ◀ ▶ ▲, ⛏/▦ toggle (mine/attack vs place/use), 🎒 inventory, 💬 chat, ☰ menu. Touch the world to act.

## Features
- 6 biomes (forest, plains, desert, snow, mountain, swamp), slate rock layers, interconnected caves, underground lakes, ores by depth, crystals, glow mushrooms, treasure rooms, abandoned mines, surface cabins.
- Timed mining with tool tiers, cracks, per-material particles/sounds, tool durability, auto tool selection. Chopping a trunk fells the whole tree.
- Crafting (hand / workbench / furnace), chests, equipment slots, drag & drop inventory, independent per-player inventories.
- Day/night, rain, snow, sandstorms, lighting with torches/crystals, parallax backgrounds.
- Authoritative server: blocks, drops, mobs, damage, crafting. SQLite persistence (terrain edits, chests, inventories, positions, appearance, settings, progression).
- Character creator (skin, hair style/colour, shirt, pants, trim colour). Appearance is stored per player on the server and broadcast, so everyone is distinguishable; names float above players and appear in the player list.
- Host controls: time, weather, difficulty, monsters, clear creatures, kick, save now. Auto-reconnect.

## Tests
```
npm test                 # boots the server, 2 real WebSocket clients (34 checks)
node test/browser.js     # headless Chrome, 3 browsers incl. mobile (needs puppeteer-core)
```

## Hosting (free options — check each provider's current free-tier terms)
- Frontend only (static): GitHub Pages, Cloudflare Pages or Netlify. Upload the `public/` folder and set `server` in `public/config.js` to your backend host.
- Backend (needs a long-running Node process with WebSockets): Render, Fly.io, Railway or any VPS. SQLite needs a persistent disk/volume: free tiers that sleep or have ephemeral disks will lose saves, so mount a volume (Fly volumes) or point `DATA_DIR` at persistent storage.
- Simplest: run the Node server anywhere (it serves the game itself) and share the URL.

## v1.2 — Mining, building & crafting overhaul
- **Mining tiers:** hand → wood → stone → copper → iron → crystal pickaxes. Stone/ore/metal blocks need a pickaxe of the right tier (axes and hands can't); the game tells you which one. Shovels dig soft blocks fast; axes chop wood and right-click strips logs. Hard blocks wear tools faster.
- **100+ new blocks:** cobblestone/brick/polished stone families, clay, bricks, terracotta, adobe, mud bricks, roofing, 4 glass types, metal blocks, 4 wood types with stripped logs & planks, marble, basalt, parquet, bookshelves, lanterns… plus **slabs, stairs and walls** (real collision, auto-step).
- **Crafting:** 125+ recipes in category tabs; new **Mason's Table** station. Stone now drops cobblestone — smelt it in a Furnace to get smooth stone.
- Clay, gravel and moss generate in the world; plants drop fibre. Bag has 50 slots and a Sort button.
- `node test/content.js` verifies every block is breakable, every item obtainable, every recipe craftable.
- **Beds:** craft a Bed (6 planks + 6 fibre, Workbench). Right-click it by day to set your respawn point; at night right-click to sleep. When half the players (rounded up) are in bed the night is skipped, everyone wakes healed and monsters vanish. Being hit wakes you; move keys / "Get up" wake you manually.
