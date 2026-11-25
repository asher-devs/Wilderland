/* WILDERLAND shared definitions: used by both the Node server and the browser client (UMD). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.DEFS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const T = {
    AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, LOG: 4, SAND: 5, SNOW: 6, COPPER: 7, IRON: 8, GOLD: 9,
    CRYSTAL: 10, LEAVES: 11, SANDSTONE: 12, ICE: 13, CACTUS: 14, WATER: 15, PLANKS: 16,
    BENCH: 17, FURNACE: 18, CHEST: 19, TORCH: 20, PLANT: 21, BEDROCK: 22,
    BUSH: 23, ROCK: 28, MUSHROOM: 29, MUD: 30, REED: 31, SLATE: 32, PINE: 33, WILLOW: 34, MAPLE: 35,
  };
  const I = {
    WOOD_PICK: 100, WOOD_AXE: 101, WOOD_SWORD: 102,
    STONE_PICK: 103, STONE_AXE: 104, STONE_SWORD: 105,
    COPPER_PICK: 106, COPPER_AXE: 107, COPPER_SWORD: 108,
    IRON_PICK: 109, IRON_AXE: 110, IRON_SWORD: 111,
    CRYSTAL_PICK: 112, CRYSTAL_BLADE: 113,
    COPPER_BAR: 114, IRON_BAR: 115, GOLD_BAR: 116,
    APPLE: 117, RAW_MEAT: 118, COOKED_MEAT: 119, GEL: 120, POTION: 121,
    COPPER_HELM: 122, IRON_HELM: 123, GOLD_HELM: 124,
    COPPER_MAIL: 125, IRON_MAIL: 126, CRYSTAL_MAIL: 127, AMULET: 128, MUSHROOM: 129,
  };

  // id, name, hardness(s at speed 1), min tool tier, material, drop item (-1 none), solid, light [r,g,b] 0..1
  const BLOCK_ROWS = [
    [T.AIR, 'Air', 0, 0, 'none', -1, false],
    [T.GRASS, 'Grass Block', 0.6, 0, 'soft', T.DIRT, true],
    [T.DIRT, 'Dirt Block', 0.5, 0, 'soft', T.DIRT, true],
    [T.STONE, 'Stone', 3.0, 1, 'stone', T.STONE, true],
    [T.LOG, 'Wood Log', 1.6, 0, 'wood', T.LOG, false],
    [T.SAND, 'Sand', 0.5, 0, 'soft', T.SAND, true],
    [T.SNOW, 'Snow Block', 0.4, 0, 'soft', T.SNOW, true],
    [T.COPPER, 'Copper Ore', 4.0, 2, 'ore', T.COPPER, true],
    [T.IRON, 'Iron Ore', 6.0, 3, 'ore', T.IRON, true],
    [T.GOLD, 'Gold Ore', 8.0, 4, 'ore', T.GOLD, true],
    [T.CRYSTAL, 'Glow Crystal', 9.0, 3, 'ore', T.CRYSTAL, true, [0.55, 0.75, 1.0]],
    [T.LEAVES, 'Leaves', 0.2, 0, 'soft', -1, false],
    [T.SANDSTONE, 'Sandstone', 2.5, 1, 'stone', T.SANDSTONE, true],
    [T.ICE, 'Ice', 2.0, 1, 'stone', T.ICE, true],
    [T.CACTUS, 'Cactus', 0.8, 0, 'wood', T.CACTUS, true],
    [T.WATER, 'Water', Infinity, 0, 'none', -1, false],
    [T.PLANKS, 'Wood Planks', 1.4, 0, 'wood', T.PLANKS, true],
    [T.BENCH, 'Workbench', 1.0, 0, 'wood', T.BENCH, false],
    [T.FURNACE, 'Furnace', 2.0, 1, 'stone', T.FURNACE, false, [0.5, 0.25, 0.08]],
    [T.CHEST, 'Storage Chest', 1.5, 0, 'wood', T.CHEST, false],
    [T.TORCH, 'Torch', 0.05, 0, 'soft', T.TORCH, false, [1.0, 0.72, 0.38]],
    [T.PLANT, 'Plant', 0.05, 0, 'soft', -1, false],
    [T.BEDROCK, 'Bedrock', Infinity, 99, 'none', -1, true],
    [T.BUSH, 'Bush', 0.15, 0, 'soft', -1, false],
    [T.ROCK, 'Loose Rock', 0.35, 0, 'soft', T.STONE, false],
    [T.MUSHROOM, 'Glow Mushroom', 0.05, 0, 'soft', I.MUSHROOM, false, [0.22, 0.42, 0.8]],
    [T.MUD, 'Mud', 0.6, 0, 'soft', T.MUD, true],
    [T.REED, 'Reeds', 0.05, 0, 'soft', -1, false],
    [T.SLATE, 'Slate', 4.5, 1, 'stone', T.SLATE, true],
    [T.PINE, 'Pine Needles', 0.25, 0, 'soft', -1, false],
    [T.WILLOW, 'Willow Leaves', 0.2, 0, 'soft', -1, false],
    [T.MAPLE, 'Maple Leaves', 0.2, 0, 'soft', -1, false],
  ];
  const BLOCKS = [];
  for (const r of BLOCK_ROWS) BLOCKS[r[0]] = { id: r[0], name: r[1], hard: r[2], tier: r[3], mat: r[4], drop: r[5], solid: r[6], light: r[7] || null };
  const SOLID = new Uint8Array(256);
  for (const b of BLOCKS) if (b && b.solid) SOLID[b.id] = 1;
  const PLACEABLE = new Set([T.GRASS, T.DIRT, T.STONE, T.LOG, T.SAND, T.SNOW, T.COPPER, T.IRON, T.GOLD, T.CRYSTAL,
    T.SANDSTONE, T.ICE, T.CACTUS, T.PLANKS, T.BENCH, T.FURNACE, T.CHEST, T.TORCH, T.MUD, T.SLATE]);
  const LEAF = new Uint8Array(256); for (const k of [T.LEAVES, T.PINE, T.WILLOW, T.MAPLE]) LEAF[k] = 1;
  const DECOR = new Uint8Array(256); for (const k of [T.PLANT, T.BUSH, T.ROCK, T.MUSHROOM, T.REED]) DECOR[k] = 1;
  const BIOMES = ['Forest', 'Desert', 'Snow', 'Plains', 'Mountain', 'Swamp'];

  const ITEMS = {};
  for (const b of BLOCKS) if (b && PLACEABLE.has(b.id)) ITEMS[b.id] = { id: b.id, name: b.name, block: b.id, stack: 99 };
  function tool(id, name, kind, tier, speed, dur, dmg) { ITEMS[id] = { id, name, kind, tier, speed, dur, dmg, stack: 1 }; }
  tool(I.WOOD_PICK, 'Wooden Pickaxe', 'pick', 1, 2.2, 60, 4);
  tool(I.WOOD_AXE, 'Wooden Axe', 'axe', 1, 2.2, 60, 5);
  tool(I.WOOD_SWORD, 'Wooden Sword', 'sword', 1, 1, 70, 9);
  tool(I.STONE_PICK, 'Stone Pickaxe', 'pick', 2, 3.6, 130, 6);
  tool(I.STONE_AXE, 'Stone Axe', 'axe', 2, 3.6, 130, 7);
  tool(I.STONE_SWORD, 'Stone Sword', 'sword', 2, 1, 150, 13);
  tool(I.COPPER_PICK, 'Copper Pickaxe', 'pick', 3, 5.2, 250, 8);
  tool(I.COPPER_AXE, 'Copper Axe', 'axe', 3, 5.2, 250, 9);
  tool(I.COPPER_SWORD, 'Copper Sword', 'sword', 3, 1, 280, 18);
  tool(I.IRON_PICK, 'Iron Pickaxe', 'pick', 4, 7.5, 500, 10);
  tool(I.IRON_AXE, 'Iron Axe', 'axe', 4, 7.5, 500, 11);
  tool(I.IRON_SWORD, 'Iron Sword', 'sword', 4, 1, 550, 25);
  tool(I.CRYSTAL_PICK, 'Crystal Pickaxe', 'pick', 5, 11, 900, 14);
  tool(I.CRYSTAL_BLADE, 'Crystal Blade', 'sword', 5, 1, 900, 40);
  const mat = (id, name) => { ITEMS[id] = { id, name, stack: 99 }; };
  mat(I.COPPER_BAR, 'Copper Bar'); mat(I.IRON_BAR, 'Iron Bar'); mat(I.GOLD_BAR, 'Gold Bar'); mat(I.GEL, 'Gel');
  ITEMS[I.APPLE] = { id: I.APPLE, name: 'Apple', stack: 99, heal: 20 };
  ITEMS[I.RAW_MEAT] = { id: I.RAW_MEAT, name: 'Raw Meat', stack: 99, heal: 8 };
  ITEMS[I.COOKED_MEAT] = { id: I.COOKED_MEAT, name: 'Cooked Meat', stack: 99, heal: 45 };
  ITEMS[I.POTION] = { id: I.POTION, name: 'Healing Potion', stack: 20, heal: 70 };
  ITEMS[I.MUSHROOM] = { id: I.MUSHROOM, name: 'Glow Mushroom', stack: 99, heal: 12 };
  const armor = (id, name, slot, def, hp) => { ITEMS[id] = { id, name, stack: 1, armor: slot, def, hp: hp || 0 }; };
  armor(I.COPPER_HELM, 'Copper Helm', 'head', 2); armor(I.IRON_HELM, 'Iron Helm', 'head', 3); armor(I.GOLD_HELM, 'Gold Crown', 'head', 4, 10);
  armor(I.COPPER_MAIL, 'Copper Mail', 'body', 3); armor(I.IRON_MAIL, 'Iron Mail', 'body', 5); armor(I.CRYSTAL_MAIL, 'Crystal Mail', 'body', 8);
  armor(I.AMULET, 'Crystal Amulet', 'charm', 0, 40);

  // [output, count, [[item, n], ...], station]  station: hand | bench | furnace
  const R = (out, n, ing, st) => ({ out, n, ing, st });
  const RECIPES = [
    R(T.PLANKS, 4, [[T.LOG, 1]], 'hand'),
    R(T.BENCH, 1, [[T.PLANKS, 10]], 'hand'),
    R(T.TORCH, 4, [[T.PLANKS, 1]], 'hand'),
    R(T.CHEST, 1, [[T.PLANKS, 12]], 'bench'),
    R(T.FURNACE, 1, [[T.STONE, 15]], 'bench'),
    R(I.WOOD_PICK, 1, [[T.PLANKS, 8]], 'bench'),
    R(I.WOOD_AXE, 1, [[T.PLANKS, 7]], 'bench'),
    R(I.WOOD_SWORD, 1, [[T.PLANKS, 6]], 'bench'),
    R(I.STONE_PICK, 1, [[T.STONE, 10], [T.PLANKS, 4]], 'bench'),
    R(I.STONE_AXE, 1, [[T.STONE, 9], [T.PLANKS, 4]], 'bench'),
    R(I.STONE_SWORD, 1, [[T.STONE, 8], [T.PLANKS, 3]], 'bench'),
    R(I.COPPER_BAR, 1, [[T.COPPER, 2], [T.PLANKS, 1]], 'furnace'),
    R(I.IRON_BAR, 1, [[T.IRON, 2], [T.PLANKS, 1]], 'furnace'),
    R(I.GOLD_BAR, 1, [[T.GOLD, 2], [T.PLANKS, 1]], 'furnace'),
    R(I.COOKED_MEAT, 1, [[I.RAW_MEAT, 1]], 'furnace'),
    R(I.COPPER_PICK, 1, [[I.COPPER_BAR, 6], [T.PLANKS, 4]], 'bench'),
    R(I.COPPER_AXE, 1, [[I.COPPER_BAR, 5], [T.PLANKS, 4]], 'bench'),
    R(I.COPPER_SWORD, 1, [[I.COPPER_BAR, 5], [T.PLANKS, 3]], 'bench'),
    R(I.COPPER_HELM, 1, [[I.COPPER_BAR, 8]], 'bench'),
    R(I.COPPER_MAIL, 1, [[I.COPPER_BAR, 12]], 'bench'),
    R(I.IRON_PICK, 1, [[I.IRON_BAR, 8], [T.PLANKS, 4]], 'bench'),
    R(I.IRON_AXE, 1, [[I.IRON_BAR, 7], [T.PLANKS, 4]], 'bench'),
    R(I.IRON_SWORD, 1, [[I.IRON_BAR, 7], [T.PLANKS, 3]], 'bench'),
    R(I.IRON_HELM, 1, [[I.IRON_BAR, 10]], 'bench'),
    R(I.IRON_MAIL, 1, [[I.IRON_BAR, 16]], 'bench'),
    R(I.GOLD_HELM, 1, [[I.GOLD_BAR, 10]], 'bench'),
    R(I.POTION, 1, [[I.GEL, 3], [I.APPLE, 1]], 'bench'),
    R(I.CRYSTAL_PICK, 1, [[T.CRYSTAL, 12], [I.IRON_BAR, 6], [I.GOLD_BAR, 2]], 'bench'),
    R(I.CRYSTAL_BLADE, 1, [[T.CRYSTAL, 14], [I.IRON_BAR, 8], [I.GOLD_BAR, 4]], 'bench'),
    R(I.CRYSTAL_MAIL, 1, [[T.CRYSTAL, 20], [I.IRON_BAR, 12], [I.GOLD_BAR, 4]], 'bench'),
    R(I.AMULET, 1, [[T.CRYSTAL, 8], [I.GOLD_BAR, 4]], 'bench'),
  ];

  // Mobs. hp, dmg(contact), speed(tiles/s), w,h, fly, drops [[item,chance,min,max]]
  const MOBS = {
    rabbit: { name: 'Rabbit', hp: 6, dmg: 0, speed: 3.5, w: 0.7, h: 0.6, passive: true, drops: [[I.RAW_MEAT, 0.9, 1, 1]] },
    slime: { name: 'Slime', hp: 16, dmg: 9, speed: 2.6, w: 0.9, h: 0.7, drops: [[I.GEL, 0.9, 1, 3], [I.APPLE, 0.08, 1, 1]] },
    zombie: { name: 'Zombie', hp: 26, dmg: 14, speed: 2.4, w: 0.7, h: 1.7, drops: [[I.RAW_MEAT, 0.45, 1, 2], [I.APPLE, 0.15, 1, 1], [T.PLANKS, 0.3, 1, 3]] },
    scorpion: { name: 'Sand Scorpion', hp: 24, dmg: 13, speed: 3.6, w: 1.0, h: 0.6, drops: [[I.RAW_MEAT, 0.5, 1, 1], [I.COPPER_BAR, 0.15, 1, 2], [I.GOLD_BAR, 0.05, 1, 1]] },
    frostling: { name: 'Frostling', hp: 18, dmg: 10, speed: 2.4, w: 0.8, h: 0.8, fly: true, glow: [0.5, 0.8, 1], drops: [[T.CRYSTAL, 0.2, 1, 1], [I.GEL, 0.5, 1, 2], [T.ICE, 0.5, 1, 3]] },
    bat: { name: 'Cave Bat', hp: 9, dmg: 7, speed: 4.5, w: 0.7, h: 0.5, fly: true, drops: [[I.GEL, 0.4, 1, 1]] },
    frog: { name: 'Bog Frog', hp: 11, dmg: 6, speed: 2.8, w: 0.6, h: 0.5, drops: [[I.GEL, 0.5, 1, 1], [I.RAW_MEAT, 0.4, 1, 1]] },
    wolf: { name: 'Grey Wolf', hp: 34, dmg: 16, speed: 4.6, w: 1.2, h: 0.85, drops: [[I.RAW_MEAT, 0.85, 1, 2]] },
    crawler: { name: 'Crystal Crawler', hp: 70, dmg: 24, speed: 4.4, w: 1.1, h: 0.8, glow: [0.8, 0.5, 1], drops: [[T.CRYSTAL, 0.6, 1, 3], [I.IRON_BAR, 0.4, 1, 3], [I.GOLD_BAR, 0.25, 1, 2], [I.COOKED_MEAT, 0.3, 1, 2]] },
  };

  const C = {
    INV: 40, HOTBAR: 10, STACK: 99, REACH: 5.6, PW: 0.62, PH: 1.7, PLAYER_HP: 100, MAX_PLAYERS: 4,
    DAY_LEN: 420, // seconds per full day
    GRAVITY: 42, MAXFALL: 32, RUN: 7.0, JUMP: 13.2,
    CHEST_SLOTS: 24, TICK: 20,
    SIZES: { small: [900, 280], medium: [1300, 320], large: [1800, 360] },
  };

  const isSolidTile = (v) => SOLID[v] === 1;

  /** Tile-based AABB physics. b: {x(center), y(top), w, h, vx, vy, grav(0..1), step(bool)} */
  function moveBody(b, dt, solid) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt / 0.35));
    const sdt = dt / steps;
    const hw = b.w / 2;
    const hit = (x, y) => {
      const x0 = Math.floor(x - hw), x1 = Math.floor(x + hw - 1e-6), y0 = Math.floor(y), y1 = Math.floor(y + b.h - 1e-6);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (solid(tx, ty)) return true;
      return false;
    };
    b.hitX = false; b.hitY = false;
    let ground = false;
    for (let s = 0; s < steps; s++) {
      let nx = b.x + b.vx * sdt;
      if (hit(nx, b.y)) {
        if (b.step && b.vy >= 0 && !hit(nx, b.y - 1.02) && (ground || b.onGround)) { b.y -= 1; b.x = nx; }
        else { b.x = b.vx > 0 ? Math.floor(nx + hw) - hw - 1e-4 : Math.floor(nx - hw) + 1 + hw + 1e-4; b.vx = 0; b.hitX = true; }
      } else b.x = nx;
      let ny = b.y + b.vy * sdt;
      if (hit(b.x, ny)) {
        if (b.vy > 0) { b.y = Math.floor(ny + b.h) - b.h - 1e-4; ground = true; }
        else b.y = Math.floor(ny) + 1 + 1e-4;
        b.vy = 0; b.hitY = true;
      } else b.y = ny;
    }
    b.onGround = ground;
  }

  const empty = () => null;
  function maxHpFor(eq) { let hp = C.PLAYER_HP; if (eq) for (const k of ['head', 'body', 'charm']) { const s = eq[k]; if (s && ITEMS[s[0]]) hp += ITEMS[s[0]].hp || 0; } return hp; }
  function defenseFor(eq) { let d = 0; if (eq) for (const k of ['head', 'body', 'charm']) { const s = eq[k]; if (s && ITEMS[s[0]]) d += ITEMS[s[0]].def || 0; } return d; }
  /** seconds needed to mine block `id` using tool item `it` (or null for bare hands) */
  function mineTime(id, it) {
    const b = BLOCKS[id];
    if (!b || !isFinite(b.hard)) return Infinity;
    const tier = it && it.tier || 0, sp = it && it.speed || 1;
    if (tier < b.tier) return Infinity;
    let m = 1;
    if (it && it.kind === 'pick' && (b.mat === 'stone' || b.mat === 'ore')) m = sp;
    else if (it && it.kind === 'axe' && b.mat === 'wood') m = sp;
    else if (it && (it.kind === 'pick' || it.kind === 'axe') && b.mat === 'soft') m = 1 + (sp - 1) * 0.6;
    return b.hard / m;
  }
  return { LEAF, DECOR, BIOMES, T, I, BLOCKS, ITEMS, RECIPES, MOBS, C, SOLID, PLACEABLE, isSolidTile, moveBody, maxHpFor, defenseFor, mineTime, empty };
});
