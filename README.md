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

## v1.3 — Animals & fishing
- 12 new creatures: cow, pig, sheep, chicken, deer, fox, bear (neutral — fights back only if hit), camel, penguin, turtle, songbirds and swimming fish. They spawn by biome, wander, and flee when hurt. Drops: leather, wool, feathers, raw fish.
- Fishing: craft a Fishing Rod (3 planks + 4 fibre), right-click water to cast, click again the moment the bobber shows "!". Lures (2 feathers + fibre) make bites faster and rarer loot likelier. Catch fish, resources, and rarely a Golden Carp.
- New gear: leather cap & tunic, wool blocks, fish tank; cooked fish heals a lot.
- Tests: `node test/animals.js`, `node test/animals-ui.js` (needs a running server).

## World backups
Free hosting wipes the database on every deploy, so each player's device keeps an automatic copy of every world they play (IndexedDB, refreshed every 3 minutes and on leaving). If the server forgets a world, joining its room code — or an in-progress reconnect — restores it automatically. Worlds list: ⬇ downloads a backup file, "Restore from file" loads one. API: `GET /api/export/CODE?pid=` (members only), `POST /api/import`. Test: `node test/backup.js`.

## v1.4 — New hostiles
- **Skeleton** (arrows from range, needs line of sight; keeps its distance), **Boomer** (creeps up, swells and blows up — hurts you and clears dirt/wood/glass, never ore or stone), **Cave Spider** (fast biter). Spawn at night on grass/forest and in caves. Test: `node test/hostiles.js`.

## v1.5 — Building
- **Ladders** (2 planks + fibre → 4): climb with W/Space/▲, descend with S/▼, cling when idle, steer sideways to let go. Chain upward through open air.
- **Doors** (6 planks, bench): two tiles tall, right-click to open/close, can't be closed on a player. Breaking either half drops one door.
- **Back wall panels** (plank/stone/brick/dark, 4 per craft): passable decorative walls that block sky light and mob spawns inside; any block placed on one replaces it. Limitation: single tile layer, so a torch placed on a wall replaces the wall.
- Tile ids 248–255 are now used; defs.js throws if generated shapes ever grow into them. Tests: `test/building.js`, `test/building-ui.js`.

## v1.6 — The Hollow Warden (boss)
- **Summon:** craft a Warden Sigil (5 crystal, 4 iron bar, 3 gel, 3 raw fish) and use it near the surface. One boss at a time; HP 700 +300 per extra player. It leaves if everyone is gone for 15 s.
- **Phase 1 (>66%)** stomps (ground shockwaves — jump them) and fires crystal shards; it tramples dirt/wood/glass but not stone. **Phase 2 (>33%)** fists detach and fly at you; it is shielded (35% damage) while both fists are home, so dodge, then hit it when a fist is out. **Phase 3** it floats, rains crystal spikes (roofs stop them), summons Boomers/spiders and every ~11 s crashes down stunned (150% damage).
- **Loot:** Warden Core (→ Warden Blade, Warden Mail), crystal, iron and gold bars. Tests: `test/boss.js`, `test/boss-ui.js`.

## v1.7 — Multiplayer smoothness
- **Culled snapshots:** each player only receives mobs, drops, projectiles and effects within ~58×40 tiles of them (about 10× less data in a busy world). The boss bar data is always sent.
- **Interpolation buffer:** remote players and mobs are rendered ~100 ms in the past between real snapshots (with a short extrapolation if a packet is late) instead of chasing the latest position.
- **Ping/FPS readout** in the HUD (Settings → Show ping & FPS), **Performance mode** (renders at 1× resolution, fewer particles, blocky lighting) with an automatic hint when FPS stays low. Tests: `test/netperf.js`, `test/smooth.js`.

## v1.8 — Farming, breeding & taming
- **Farming:** craft a Hoe (2 planks + 2 fibre), right-click grass/dirt to till farmland, plant Wheat Seeds (from tall grass, 14%) or Carrots (rabbits drop them). Crops grow in 3 stages while you are near; water within 4 tiles triples growth speed, rain boosts it. Breaking ripe crops harvests; wheat → bread (3 wheat, bench). Seeds come back from sprouts.
- **Breeding:** feed wheat to cows/sheep, carrots to pigs/rabbits, seeds to chickens; two in love close together make a baby that grows up in 90 s (120 s cooldown).
- **Husky companion:** wild huskies roam forests and snow; feed one raw or cooked meat to tame it (35% / 60% per try). It follows you, teleports if left behind, attacks hostile mobs near you, is immune to damage, and comes back after reconnects (one per player). Tap it to sit/stand. The older hostile Grey Wolf is unchanged.
- Tile ids 150–156 and item ids 164–168 are used; tests: `test/farming.js`, `test/farming-ui.js`.

## v1.9 — Quest Book & potions
- **Quest Book (press Q / 📜 button / pause menu):** 20 quests (chop, mine, kill each monster type, fish, bake, harvest, breed, tame, brew, beat the Warden, 100 kills). Progress is saved per player and survives reconnects; finishing one pays out items straight into your bag.
- **Buff potions** (3 gel + an ingredient at a Workbench): Swiftness (+30% speed, carrot), Haste (mine 60% faster, glow mushroom), Ironskin (+4 defense, iron bar), Regeneration (1.5 HP/s for 60 s, wheat + apple). Active buffs show in the HUD with a countdown.
- **Warden Visor** helmet (2 Warden Cores + 5 iron bars): +5 defense, +15 HP.
- Item ids 169–173 used; tests: `test/quests.js`, `test/quests-ui.js`.

## v1.10 — Co-op & building
- **Wooden Fence** (2 planks + 1 fibre → 4): see-through solid block that keeps mobs and animals in or out; great for pens.
- **Map markers:** press G (aim at a spot) to drop a beacon visible to everyone for 25 s, with your name and an edge arrow when it is off-screen. Tests: `test/coop.js`.
- **Revive:** when a teammate is alive, a downed player waits 7 s instead of 3.5 s; stand within ~4 tiles and press F (💖 button on touch) to revive them in place at 50% HP with brief invulnerability. 
- Touch gets a 📍 marker button (drops a beacon at your position).
