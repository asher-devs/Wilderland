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
    // v1.2 building blocks (ids 24-27 are reserved for background tiles in the atlas)
    COBBLE: 36, STONE_BRICK: 37, MOSSY_COBBLE: 38, MOSSY_BRICK: 39, CRACKED_BRICK: 40, POLISHED_STONE: 41, CHISELED_STONE: 42,
    SLATE_BRICK: 43, SLATE_TILE: 44, GRAVEL: 45, COARSE_DIRT: 46, MOSS: 47,
    COPPER_BLOCK: 48, IRON_BLOCK: 49, GOLD_BLOCK: 50, IRON_PLATE: 51, VERDIGRIS: 52, IRON_GRATE: 53, CRYSTAL_BLOCK: 54, CRYSTAL_LAMP: 55,
    CLAY: 56, BRICK: 57, TERRACOTTA: 58, TERRA_TILE: 59, ADOBE: 60, MUD_BRICK: 61, GLAZED_TILE: 62,
    ROOF_TILE: 63, SLATE_ROOF: 64, THATCH: 65, SHINGLE: 66,
    GLASS: 67, FRAMED_GLASS: 68, STAINED_GLASS: 69, TINTED_GLASS: 70,
    SANDSTONE_BRICK: 71, SMOOTH_SANDSTONE: 72, CHISELED_SANDSTONE: 73, SNOW_BRICK: 74, ICE_BRICK: 75,
    PINE_LOG: 76, MAPLE_LOG: 77, WILLOW_LOG: 78, STRIPPED_OAK: 79, STRIPPED_PINE: 80, STRIPPED_MAPLE: 81, STRIPPED_WILLOW: 82,
    PINE_PLANKS: 83, MAPLE_PLANKS: 84, WILLOW_PLANKS: 85, PARQUET: 86, BOOKSHELF: 87, BEAM: 88, HAY: 89,
    CHECKER: 90, MARBLE: 91, BASALT: 92, MASON: 93, LANTERN: 94, BED: 95, BED_R: 96, WOOL_BLOCK: 97, FISH_TANK: 98, LADDER: 99, FENCE: 157, SIGN: 158,
    // 248+ are the last free tile ids (shapes occupy 200-247)
    // farming (tile ids 150-156; items 164-168 so tile and item ids never clash)
    FARMLAND: 150, WHEAT1: 151, WHEAT2: 152, WHEAT3: 153, CARROT1: 154, CARROT2: 155, CARROT3: 156,
    DOOR: 248, DOOR_T: 249, DOOR_BO: 250, DOOR_TO: 251, WALL_PLANKS: 252, WALL_STONE: 253, WALL_BRICK: 254, WALL_DARK: 255,
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
    LEATHER: 136, WOOL: 137, FEATHER: 138, RAW_FISH: 139, COOKED_FISH: 140, FISHING_ROD: 141, LURE: 142, LEATHER_CAP: 143, LEATHER_TUNIC: 144, GOLDEN_CARP: 145,
    WARDEN_SIGIL: 146, WARDEN_CORE: 147, WARDEN_BLADE: 148, WARDEN_MAIL: 149,
    WHEAT_SEEDS: 164, WHEAT: 165, BREAD: 166, CARROT: 167, HOE: 168,
    SWIFT_POTION: 169, HASTE_POTION: 170, IRON_POTION: 171, REGEN_POTION: 172, WARDEN_HELM: 173,
    CLAY_BRICK: 130, FIBER: 131, WOOD_SHOVEL: 132, STONE_SHOVEL: 133, COPPER_SHOVEL: 134, IRON_SHOVEL: 135,
  };
  const TIER_NAMES = ['Hand', 'Wooden', 'Stone', 'Copper', 'Iron', 'Crystal'];

  // id, name, hardness(s at speed 1), min tool tier, material, drop item (-1 none), solid, light [r,g,b] 0..1
  // material: soft (any tool, shovel best) | wood (axe best) | stone / ore / metal (need a pickaxe of at least `tier`) | glass (any tool)
  const BLOCK_ROWS = [
    [T.AIR, 'Air', 0, 0, 'none', -1, false],
    [T.GRASS, 'Grass Block', 0.6, 0, 'soft', T.DIRT, true],
    [T.DIRT, 'Dirt Block', 0.5, 0, 'soft', T.DIRT, true],
    [T.STONE, 'Stone', 3.0, 1, 'stone', T.COBBLE, true],
    [T.LOG, 'Oak Log', 1.6, 0, 'wood', T.LOG, false],
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
    [T.PLANKS, 'Oak Planks', 1.4, 0, 'wood', T.PLANKS, true],
    [T.BENCH, 'Workbench', 1.0, 0, 'wood', T.BENCH, false],
    [T.FURNACE, 'Furnace', 2.0, 0, 'stone', T.FURNACE, false, [0.5, 0.25, 0.08]],
    [T.CHEST, 'Storage Chest', 1.5, 0, 'wood', T.CHEST, false],
    [T.TORCH, 'Torch', 0.05, 0, 'soft', T.TORCH, false, [1.0, 0.72, 0.38]],
    [T.PLANT, 'Plant', 0.05, 0, 'soft', I.FIBER, false],
    [T.BEDROCK, 'Bedrock', Infinity, 99, 'none', -1, true],
    [T.BUSH, 'Bush', 0.15, 0, 'soft', I.FIBER, false],
    [T.ROCK, 'Loose Rock', 0.35, 0, 'soft', T.COBBLE, false],
    [T.MUSHROOM, 'Glow Mushroom', 0.05, 0, 'soft', I.MUSHROOM, false, [0.22, 0.42, 0.8]],
    [T.MUD, 'Mud', 0.6, 0, 'soft', T.MUD, true],
    [T.REED, 'Reeds', 0.05, 0, 'soft', I.FIBER, false],
    [T.SLATE, 'Slate', 4.5, 1, 'stone', T.SLATE, true],
    [T.PINE, 'Pine Needles', 0.25, 0, 'soft', -1, false],
    [T.WILLOW, 'Willow Leaves', 0.2, 0, 'soft', -1, false],
    [T.MAPLE, 'Maple Leaves', 0.2, 0, 'soft', -1, false],
    // ---- stone family
    [T.COBBLE, 'Cobblestone', 2.5, 1, 'stone', T.COBBLE, true],
    [T.STONE_BRICK, 'Stone Bricks', 3.2, 1, 'stone', T.STONE_BRICK, true],
    [T.MOSSY_COBBLE, 'Mossy Cobblestone', 2.6, 1, 'stone', T.MOSSY_COBBLE, true],
    [T.MOSSY_BRICK, 'Mossy Stone Bricks', 3.2, 1, 'stone', T.MOSSY_BRICK, true],
    [T.CRACKED_BRICK, 'Cracked Stone Bricks', 2.6, 1, 'stone', T.CRACKED_BRICK, true],
    [T.POLISHED_STONE, 'Polished Stone', 3.4, 1, 'stone', T.POLISHED_STONE, true],
    [T.CHISELED_STONE, 'Chiseled Stone', 3.4, 1, 'stone', T.CHISELED_STONE, true],
    [T.SLATE_BRICK, 'Slate Bricks', 4.8, 1, 'stone', T.SLATE_BRICK, true],
    [T.SLATE_TILE, 'Slate Tiles', 4.8, 1, 'stone', T.SLATE_TILE, true],
    [T.GRAVEL, 'Gravel', 0.6, 0, 'soft', T.GRAVEL, true],
    [T.COARSE_DIRT, 'Coarse Dirt', 0.6, 0, 'soft', T.COARSE_DIRT, true],
    [T.MOSS, 'Moss Block', 0.4, 0, 'soft', T.MOSS, true],
    // ---- metal & crystal
    [T.COPPER_BLOCK, 'Copper Block', 5.0, 2, 'metal', T.COPPER_BLOCK, true],
    [T.IRON_BLOCK, 'Iron Block', 7.0, 3, 'metal', T.IRON_BLOCK, true],
    [T.GOLD_BLOCK, 'Gold Block', 8.0, 4, 'metal', T.GOLD_BLOCK, true],
    [T.IRON_PLATE, 'Riveted Iron Plate', 7.0, 3, 'metal', T.IRON_PLATE, true],
    [T.VERDIGRIS, 'Verdigris Copper', 5.0, 2, 'metal', T.VERDIGRIS, true],
    [T.IRON_GRATE, 'Iron Grate', 6.0, 3, 'metal', T.IRON_GRATE, true],
    [T.CRYSTAL_BLOCK, 'Crystal Block', 8.0, 3, 'metal', T.CRYSTAL_BLOCK, true, [0.45, 0.65, 1.0]],
    [T.CRYSTAL_LAMP, 'Crystal Lamp', 1.2, 0, 'glass', T.CRYSTAL_LAMP, true, [0.62, 0.84, 1.0]],
    // ---- clay & ceramics
    [T.CLAY, 'Clay', 0.7, 0, 'soft', T.CLAY, true],
    [T.BRICK, 'Red Bricks', 3.0, 1, 'stone', T.BRICK, true],
    [T.TERRACOTTA, 'Terracotta', 2.4, 1, 'stone', T.TERRACOTTA, true],
    [T.TERRA_TILE, 'Terracotta Tiles', 2.8, 1, 'stone', T.TERRA_TILE, true],
    [T.ADOBE, 'Adobe', 2.0, 1, 'stone', T.ADOBE, true],
    [T.MUD_BRICK, 'Mud Bricks', 2.0, 1, 'stone', T.MUD_BRICK, true],
    [T.GLAZED_TILE, 'Glazed Ceramic Tile', 2.8, 1, 'stone', T.GLAZED_TILE, true],
    // ---- roofing
    [T.ROOF_TILE, 'Clay Roof Tiles', 2.4, 1, 'stone', T.ROOF_TILE, true],
    [T.SLATE_ROOF, 'Slate Roof Tiles', 3.5, 1, 'stone', T.SLATE_ROOF, true],
    [T.THATCH, 'Thatch', 0.5, 0, 'soft', T.THATCH, true],
    [T.SHINGLE, 'Wood Shingles', 1.4, 0, 'wood', T.SHINGLE, true],
    // ---- glass
    [T.GLASS, 'Glass', 0.5, 0, 'glass', T.GLASS, true],
    [T.FRAMED_GLASS, 'Framed Window', 0.8, 0, 'glass', T.FRAMED_GLASS, true],
    [T.STAINED_GLASS, 'Stained Glass', 0.8, 0, 'glass', T.STAINED_GLASS, true],
    [T.TINTED_GLASS, 'Tinted Glass', 0.8, 0, 'glass', T.TINTED_GLASS, true],
    // ---- sand & snow
    [T.SANDSTONE_BRICK, 'Sandstone Bricks', 2.8, 1, 'stone', T.SANDSTONE_BRICK, true],
    [T.SMOOTH_SANDSTONE, 'Smooth Sandstone', 2.6, 1, 'stone', T.SMOOTH_SANDSTONE, true],
    [T.CHISELED_SANDSTONE, 'Chiseled Sandstone', 2.8, 1, 'stone', T.CHISELED_SANDSTONE, true],
    [T.SNOW_BRICK, 'Snow Bricks', 1.0, 0, 'soft', T.SNOW_BRICK, true],
    [T.ICE_BRICK, 'Ice Bricks', 2.2, 1, 'stone', T.ICE_BRICK, true],
    // ---- wood
    [T.PINE_LOG, 'Pine Log', 1.7, 0, 'wood', T.PINE_LOG, false],
    [T.MAPLE_LOG, 'Maple Log', 1.6, 0, 'wood', T.MAPLE_LOG, false],
    [T.WILLOW_LOG, 'Willow Log', 1.5, 0, 'wood', T.WILLOW_LOG, false],
    [T.STRIPPED_OAK, 'Stripped Oak Log', 1.6, 0, 'wood', T.STRIPPED_OAK, true],
    [T.STRIPPED_PINE, 'Stripped Pine Log', 1.7, 0, 'wood', T.STRIPPED_PINE, true],
    [T.STRIPPED_MAPLE, 'Stripped Maple Log', 1.6, 0, 'wood', T.STRIPPED_MAPLE, true],
    [T.STRIPPED_WILLOW, 'Stripped Willow Log', 1.5, 0, 'wood', T.STRIPPED_WILLOW, true],
    [T.PINE_PLANKS, 'Pine Planks', 1.4, 0, 'wood', T.PINE_PLANKS, true],
    [T.MAPLE_PLANKS, 'Maple Planks', 1.4, 0, 'wood', T.MAPLE_PLANKS, true],
    [T.WILLOW_PLANKS, 'Willow Planks', 1.3, 0, 'wood', T.WILLOW_PLANKS, true],
    [T.PARQUET, 'Parquet Flooring', 1.4, 0, 'wood', T.PARQUET, true],
    [T.BOOKSHELF, 'Bookshelf', 1.2, 0, 'wood', T.BOOKSHELF, true],
    [T.BEAM, 'Timber Beam', 1.5, 0, 'wood', T.BEAM, true],
    [T.HAY, 'Hay Bale', 0.5, 0, 'soft', T.HAY, true],
    // ---- decorative
    [T.CHECKER, 'Checkered Tile', 2.8, 1, 'stone', T.CHECKER, true],
    [T.MARBLE, 'Marble', 3.2, 1, 'stone', T.MARBLE, true],
    [T.BASALT, 'Basalt', 4.0, 1, 'stone', T.BASALT, true],
    [T.MASON, "Mason's Table", 1.5, 0, 'wood', T.MASON, false],
    [T.LANTERN, 'Lantern', 0.1, 0, 'soft', T.LANTERN, false, [1.0, 0.78, 0.45]],
    [T.BED, 'Bed', 0.6, 0, 'wood', T.BED, false],
    [T.BED_R, 'Bed', 0.6, 0, 'wood', -1, false],
    [T.WOOL_BLOCK, 'Wool Block', 0.6, 0, 'soft', T.WOOL_BLOCK, true],
    [T.FISH_TANK, 'Fish Tank', 1.0, 0, 'glass', T.FISH_TANK, true],
    [T.FARMLAND, 'Farmland', 0.5, 0, 'soft', T.DIRT, true],
    [T.WHEAT1, 'Wheat Sprout', 0.05, 0, 'soft', -1, false], [T.WHEAT2, 'Young Wheat', 0.05, 0, 'soft', -1, false], [T.WHEAT3, 'Ripe Wheat', 0.05, 0, 'soft', -1, false],
    [T.CARROT1, 'Carrot Sprout', 0.05, 0, 'soft', -1, false], [T.CARROT2, 'Young Carrots', 0.05, 0, 'soft', -1, false], [T.CARROT3, 'Ripe Carrots', 0.05, 0, 'soft', -1, false],
    [T.LADDER, 'Ladder', 0.3, 0, 'wood', T.LADDER, false],
    [T.SIGN, 'Sign', 0.3, 0, 'wood', T.SIGN, false],
    [T.FENCE, 'Wooden Fence', 0.5, 0, 'wood', T.FENCE, true],
    [T.DOOR, 'Door', 1.0, 0, 'wood', -1, true], [T.DOOR_T, 'Door', 1.0, 0, 'wood', -1, true], [T.DOOR_BO, 'Open Door', 1.0, 0, 'wood', -1, false], [T.DOOR_TO, 'Open Door', 1.0, 0, 'wood', -1, false],
    [T.WALL_PLANKS, 'Plank Back Wall', 0.4, 0, 'soft', T.WALL_PLANKS, false], [T.WALL_STONE, 'Stone Back Wall', 0.4, 0, 'soft', T.WALL_STONE, false],
    [T.WALL_BRICK, 'Brick Back Wall', 0.4, 0, 'soft', T.WALL_BRICK, false], [T.WALL_DARK, 'Dark Back Wall', 0.4, 0, 'soft', T.WALL_DARK, false],
  ];

  // ---- shaped variants (slab / stairs / wall). Each gets its own tile id (200+) and a collision shape.
  // [base block, label]
  const SHAPED = [
    [T.PLANKS, 'Oak Plank'], [T.PINE_PLANKS, 'Pine Plank'], [T.MAPLE_PLANKS, 'Maple Plank'],
    [T.COBBLE, 'Cobblestone'], [T.STONE, 'Stone'], [T.STONE_BRICK, 'Stone Brick'], [T.POLISHED_STONE, 'Polished Stone'],
    [T.BRICK, 'Red Brick'], [T.SANDSTONE, 'Sandstone'], [T.SANDSTONE_BRICK, 'Sandstone Brick'],
    [T.ROOF_TILE, 'Clay Roof'], [T.SLATE_ROOF, 'Slate Roof'], [T.SLATE_BRICK, 'Slate Brick'], [T.MUD_BRICK, 'Mud Brick'],
  ];
  const WALLED = [T.COBBLE, T.STONE_BRICK, T.BRICK, T.SANDSTONE_BRICK, T.SLATE_BRICK, T.MOSSY_COBBLE];
  // collision boxes (tile-local x0,y0,x1,y1; y grows downward)
  const BOXES = [null, [[0, 0, 1, 1]], [[0, 0.5, 1, 1]], [[0, 0.5, 1, 1], [0, 0, 0.5, 0.5]], [[0, 0.5, 1, 1], [0.5, 0, 1, 0.5]], [[0.25, -0.5, 0.75, 1]]]; // walls are 1.5 tiles tall (box pokes above its tile) so they can't be stepped over
  const SHAPE = []; // id -> { base, kind:'slab'|'stairL'|'stairR'|'wall', item }
  const SHAPE_OF = {}; // `${base}:${kind}` -> id
  let nid = 200;
  for (const [base, label] of SHAPED) {
    const slab = nid++, sr = nid++, sl = nid++, b = BLOCK_ROWS.find((r) => r[0] === base);
    SHAPE[slab] = { base, kind: 'slab', item: slab, box: 2 }; SHAPE[sr] = { base, kind: 'stairR', item: sr, box: 4 }; SHAPE[sl] = { base, kind: 'stairL', item: sr, box: 3 };
    SHAPE_OF[base + ':slab'] = slab; SHAPE_OF[base + ':stairR'] = sr; SHAPE_OF[base + ':stairL'] = sl;
    BLOCK_ROWS.push([slab, label + ' Slab', b[2] * 0.7, b[3], b[4], slab, false], [sr, label + ' Stairs', b[2] * 0.8, b[3], b[4], sr, false], [sl, label + ' Stairs', b[2] * 0.8, b[3], b[4], sr, false]);
  }
  for (const base of WALLED) {
    const w = nid++, b = BLOCK_ROWS.find((r) => r[0] === base), lab = b[1].replace(/s$/, '').replace('Cobblestone', 'Cobblestone');
    SHAPE[w] = { base, kind: 'wall', item: w, box: 5 }; SHAPE_OF[base + ':wall'] = w;
    BLOCK_ROWS.push([w, lab + ' Wall', b[2] * 0.8, b[3], b[4], w, false]);
  }
  if (nid > 248) throw new Error('tile ids 200-247 exhausted: shapes collide with doors/walls');
  const BLOCKS = [];
  for (const r of BLOCK_ROWS) BLOCKS[r[0]] = { id: r[0], name: r[1], hard: r[2], tier: r[3], mat: r[4], drop: r[5], solid: r[6], light: r[7] || null, tool: (r[4] === 'stone' || r[4] === 'ore' || r[4] === 'metal') ? 'pick' : null, dropP: 1 };
  BLOCKS[T.PLANT].dropP = 0.45; BLOCKS[T.BUSH].dropP = 1; BLOCKS[T.REED].dropP = 0.8;
  const SOLID = new Uint8Array(256);
  for (const b of BLOCKS) if (b && b.solid) SOLID[b.id] = 1;
  // COLL: 0 = passable, 1 = full block, 2.. = partial box set (index into BOXES) for slabs, stairs and walls
  const COLL = new Uint8Array(256);
  for (let i = 0; i < 256; i++) COLL[i] = SOLID[i] ? 1 : 0;
  for (const k in SHAPE) COLL[k] = SHAPE[k].box;
  const CLEAR = new Uint8Array(256); for (const k of [T.GLASS, T.FRAMED_GLASS, T.STAINED_GLASS, T.TINTED_GLASS, T.IRON_GRATE, T.CRYSTAL_LAMP, T.FISH_TANK, T.FENCE]) CLEAR[k] = 1;
  // background wall panels: not solid, drawn dim behind everything, block sky light; any block placed on one replaces it
  const BACKWALL = new Uint8Array(256); for (const k of [T.WALL_PLANKS, T.WALL_STONE, T.WALL_BRICK, T.WALL_DARK]) BACKWALL[k] = 1;
  const DOORTILE = new Uint8Array(256); for (const k of [T.DOOR, T.DOOR_T, T.DOOR_BO, T.DOOR_TO]) DOORTILE[k] = 1;
  /** crops: growth chain, what a ripe crop drops, and which seed a young one gives back */
  const CROPS = { next: { [T.WHEAT1]: T.WHEAT2, [T.WHEAT2]: T.WHEAT3, [T.CARROT1]: T.CARROT2, [T.CARROT2]: T.CARROT3 },
    ripe: { [T.WHEAT3]: [[I.WHEAT, 1, 2], [I.WHEAT_SEEDS, 1, 2]], [T.CARROT3]: [[I.CARROT, 1, 3]] },
    seed: { [T.WHEAT1]: I.WHEAT_SEEDS, [T.WHEAT2]: I.WHEAT_SEEDS, [T.CARROT1]: I.CARROT, [T.CARROT2]: I.CARROT }, seedChance: 0.14 };
  /** what each animal wants to be bred */
  const FEED = { cow: I.WHEAT, sheep: I.WHEAT, pig: I.CARROT, chicken: I.WHEAT_SEEDS, rabbit: I.CARROT };
  const OPAQUE = new Uint8Array(256); for (let i = 0; i < 256; i++) OPAQUE[i] = (SOLID[i] && !CLEAR[i]) || BACKWALL[i] ? 1 : 0;
  const LOGS = new Uint8Array(256); for (const k of [T.LOG, T.PINE_LOG, T.MAPLE_LOG, T.WILLOW_LOG]) LOGS[k] = 1; // natural trunks
  const STRIPPED = { [T.LOG]: T.STRIPPED_OAK, [T.PINE_LOG]: T.STRIPPED_PINE, [T.MAPLE_LOG]: T.STRIPPED_MAPLE, [T.WILLOW_LOG]: T.STRIPPED_WILLOW };
  const NEWBLOCKS = []; for (let i = 36; i <= T.BED; i++) NEWBLOCKS.push(i); NEWBLOCKS.push(T.WOOL_BLOCK, T.FISH_TANK);
  const PLACEABLE = new Set([T.GRASS, T.DIRT, T.STONE, T.LOG, T.SAND, T.SNOW, T.COPPER, T.IRON, T.GOLD, T.CRYSTAL,
    T.SANDSTONE, T.ICE, T.CACTUS, T.PLANKS, T.BENCH, T.FURNACE, T.CHEST, T.TORCH, T.MUD, T.SLATE, ...NEWBLOCKS, T.LADDER, T.FENCE, T.SIGN, T.DOOR, T.WALL_PLANKS, T.WALL_STONE, T.WALL_BRICK, T.WALL_DARK]);
  for (const k in SHAPE) if (SHAPE[k].item === +k) PLACEABLE.add(+k);
  const LEAF = new Uint8Array(256); for (const k of [T.LEAVES, T.PINE, T.WILLOW, T.MAPLE]) LEAF[k] = 1;
  const DECOR = new Uint8Array(256); for (const k of [T.PLANT, T.BUSH, T.ROCK, T.MUSHROOM, T.REED, T.WHEAT1, T.WHEAT2, T.WHEAT3, T.CARROT1, T.CARROT2, T.CARROT3, T.SIGN]) DECOR[k] = 1;
  const BIOMES = ['Forest', 'Desert', 'Snow', 'Plains', 'Mountain', 'Swamp'];

  const ITEMS = {};
  for (const b of BLOCKS) if (b && PLACEABLE.has(b.id)) ITEMS[b.id] = { id: b.id, name: b.name, block: b.id, stack: 99 };
  function tool(id, name, kind, tier, speed, dur, dmg) { ITEMS[id] = { id, name, kind, tier, speed, dur, dmg, stack: 1 }; }
  tool(I.WOOD_PICK, 'Wooden Pickaxe', 'pick', 1, 2.2, 60, 4);
  tool(I.WOOD_AXE, 'Wooden Axe', 'axe', 1, 2.2, 60, 5);
  tool(I.WOOD_SWORD, 'Wooden Sword', 'sword', 1, 1, 70, 9);
  tool(I.WOOD_SHOVEL, 'Wooden Shovel', 'shovel', 1, 2.4, 60, 3);
  tool(I.STONE_PICK, 'Stone Pickaxe', 'pick', 2, 3.6, 130, 6);
  tool(I.STONE_AXE, 'Stone Axe', 'axe', 2, 3.6, 130, 7);
  tool(I.STONE_SWORD, 'Stone Sword', 'sword', 2, 1, 150, 13);
  tool(I.STONE_SHOVEL, 'Stone Shovel', 'shovel', 2, 3.8, 130, 4);
  tool(I.COPPER_PICK, 'Copper Pickaxe', 'pick', 3, 5.2, 250, 8);
  tool(I.COPPER_AXE, 'Copper Axe', 'axe', 3, 5.2, 250, 9);
  tool(I.COPPER_SWORD, 'Copper Sword', 'sword', 3, 1, 280, 18);
  tool(I.COPPER_SHOVEL, 'Copper Shovel', 'shovel', 3, 5.6, 250, 5);
  tool(I.IRON_PICK, 'Iron Pickaxe', 'pick', 4, 7.5, 500, 10);
  tool(I.IRON_AXE, 'Iron Axe', 'axe', 4, 7.5, 500, 11);
  tool(I.IRON_SWORD, 'Iron Sword', 'sword', 4, 1, 550, 25);
  tool(I.IRON_SHOVEL, 'Iron Shovel', 'shovel', 4, 8, 500, 6);
  tool(I.CRYSTAL_PICK, 'Crystal Pickaxe', 'pick', 5, 11, 900, 14);
  tool(I.CRYSTAL_BLADE, 'Crystal Blade', 'sword', 5, 1, 900, 40);
  const mat = (id, name) => { ITEMS[id] = { id, name, stack: 99 }; };
  mat(I.COPPER_BAR, 'Copper Bar'); mat(I.IRON_BAR, 'Iron Bar'); mat(I.GOLD_BAR, 'Gold Bar'); mat(I.GEL, 'Gel');
  mat(I.CLAY_BRICK, 'Clay Brick'); mat(I.FIBER, 'Plant Fiber'); mat(I.LEATHER, 'Leather'); mat(I.WOOL, 'Wool'); mat(I.FEATHER, 'Feather');
  ITEMS[I.RAW_FISH] = { id: I.RAW_FISH, name: 'Raw Fish', stack: 99, heal: 5 };
  ITEMS[I.COOKED_FISH] = { id: I.COOKED_FISH, name: 'Cooked Fish', stack: 99, heal: 38 };
  ITEMS[I.GOLDEN_CARP] = { id: I.GOLDEN_CARP, name: 'Golden Carp', stack: 20, heal: 80 };
  ITEMS[I.FISHING_ROD] = { id: I.FISHING_ROD, name: 'Fishing Rod', kind: 'rod', dur: 120, dmg: 2, stack: 1 };
  ITEMS[I.LURE] = { id: I.LURE, name: 'Fishing Lure', stack: 99 };
  ITEMS[I.APPLE] = { id: I.APPLE, name: 'Apple', stack: 99, heal: 20 };
  ITEMS[I.RAW_MEAT] = { id: I.RAW_MEAT, name: 'Raw Meat', stack: 99, heal: 8 };
  ITEMS[I.COOKED_MEAT] = { id: I.COOKED_MEAT, name: 'Cooked Meat', stack: 99, heal: 45 };
  ITEMS[I.POTION] = { id: I.POTION, name: 'Healing Potion', stack: 20, heal: 70 };
  // timed buff potions: drink to gain an effect for `dur` seconds
  const BUFFS = {
    swift: { name: 'Swiftness', dur: 120, icon: '»', col: '#7be0ff', desc: '+30% move speed' },
    haste: { name: 'Mining Haste', dur: 120, icon: '⛏', col: '#ffd45c', desc: 'Mine 60% faster' },
    iron: { name: 'Ironskin', dur: 150, icon: '◆', col: '#c3ccd6', desc: '+4 defense' },
    regen: { name: 'Regeneration', dur: 60, icon: '+', col: '#ff7b8a', desc: 'Heal 1.5 HP/s' },
  };
  ITEMS[I.SWIFT_POTION] = { id: I.SWIFT_POTION, name: 'Swiftness Potion', stack: 20, buff: 'swift' };
  ITEMS[I.HASTE_POTION] = { id: I.HASTE_POTION, name: 'Haste Potion', stack: 20, buff: 'haste' };
  ITEMS[I.IRON_POTION] = { id: I.IRON_POTION, name: 'Ironskin Potion', stack: 20, buff: 'iron' };
  ITEMS[I.REGEN_POTION] = { id: I.REGEN_POTION, name: 'Regeneration Potion', stack: 20, buff: 'regen' };
  ITEMS[I.MUSHROOM] = { id: I.MUSHROOM, name: 'Glow Mushroom', stack: 99, heal: 12 };
  const armor = (id, name, slot, def, hp) => { ITEMS[id] = { id, name, stack: 1, armor: slot, def, hp: hp || 0 }; };
  armor(I.WARDEN_HELM, 'Warden Visor', 'head', 5, 15); armor(I.COPPER_HELM, 'Copper Helm', 'head', 2); armor(I.IRON_HELM, 'Iron Helm', 'head', 3); armor(I.GOLD_HELM, 'Gold Crown', 'head', 4, 10);
  armor(I.COPPER_MAIL, 'Copper Mail', 'body', 3); armor(I.IRON_MAIL, 'Iron Mail', 'body', 5); armor(I.CRYSTAL_MAIL, 'Crystal Mail', 'body', 8);
  ITEMS[I.WARDEN_SIGIL] = { id: I.WARDEN_SIGIL, name: 'Warden Sigil', stack: 5, summon: 'warden' };
  ITEMS[I.WARDEN_CORE] = { id: I.WARDEN_CORE, name: 'Warden Core', stack: 20 };
  tool(I.WARDEN_BLADE, 'Warden Blade', 'sword', 5, 1, 900, 46); armor(I.WARDEN_MAIL, 'Warden Mail', 'body', 11, 20);
  ITEMS[I.WHEAT_SEEDS] = { id: I.WHEAT_SEEDS, name: 'Wheat Seeds', stack: 99, plant: T.WHEAT1 };
  ITEMS[I.WHEAT] = { id: I.WHEAT, name: 'Wheat', stack: 99 };
  ITEMS[I.BREAD] = { id: I.BREAD, name: 'Bread', stack: 99, heal: 32 };
  ITEMS[I.CARROT] = { id: I.CARROT, name: 'Carrot', stack: 99, heal: 14, plant: T.CARROT1 };
  tool(I.HOE, 'Hoe', 'hoe', 1, 1, 150, 3);
  armor(I.LEATHER_CAP, 'Leather Cap', 'head', 1); armor(I.LEATHER_TUNIC, 'Leather Tunic', 'body', 2);
  armor(I.AMULET, 'Crystal Amulet', 'charm', 0, 40);

  // [output, count, [[item, n], ...], station, category]  station: hand | bench | furnace | mason
  const R = (out, n, ing, st, cat) => ({ out, n, ing, st, cat });
  const RECIPES = [
    // ---- basics
    R(T.PLANKS, 4, [[T.LOG, 1]], 'hand', 'wood'),
    R(T.BENCH, 1, [[T.PLANKS, 10]], 'hand', 'misc'),
    R(T.TORCH, 4, [[T.PLANKS, 1]], 'hand', 'misc'),
    R(T.CHEST, 1, [[T.PLANKS, 12]], 'bench', 'misc'),
    R(T.FURNACE, 1, [[T.COBBLE, 15]], 'bench', 'misc'),
    R(T.MASON, 1, [[T.COBBLE, 8], [T.PLANKS, 6]], 'bench', 'misc'),
    // ---- tools
    R(I.WOOD_PICK, 1, [[T.PLANKS, 8]], 'bench', 'tools'),
    R(I.WOOD_AXE, 1, [[T.PLANKS, 7]], 'bench', 'tools'),
    R(I.WOOD_SHOVEL, 1, [[T.PLANKS, 5]], 'bench', 'tools'),
    R(I.WOOD_SWORD, 1, [[T.PLANKS, 6]], 'bench', 'tools'),
    R(I.STONE_PICK, 1, [[T.COBBLE, 10], [T.PLANKS, 4]], 'bench', 'tools'),
    R(I.STONE_AXE, 1, [[T.COBBLE, 9], [T.PLANKS, 4]], 'bench', 'tools'),
    R(I.STONE_SHOVEL, 1, [[T.COBBLE, 6], [T.PLANKS, 3]], 'bench', 'tools'),
    R(I.STONE_SWORD, 1, [[T.COBBLE, 8], [T.PLANKS, 3]], 'bench', 'tools'),
    R(I.COPPER_BAR, 1, [[T.COPPER, 2], [T.PLANKS, 1]], 'furnace', 'metal'),
    R(I.IRON_BAR, 1, [[T.IRON, 2], [T.PLANKS, 1]], 'furnace', 'metal'),
    R(I.GOLD_BAR, 1, [[T.GOLD, 2], [T.PLANKS, 1]], 'furnace', 'metal'),
    R(I.COOKED_MEAT, 1, [[I.RAW_MEAT, 1]], 'furnace', 'misc'),
    R(I.COPPER_PICK, 1, [[I.COPPER_BAR, 6], [T.PLANKS, 4]], 'bench', 'tools'),
    R(I.COPPER_AXE, 1, [[I.COPPER_BAR, 5], [T.PLANKS, 4]], 'bench', 'tools'),
    R(I.COPPER_SHOVEL, 1, [[I.COPPER_BAR, 4], [T.PLANKS, 3]], 'bench', 'tools'),
    R(I.COPPER_SWORD, 1, [[I.COPPER_BAR, 5], [T.PLANKS, 3]], 'bench', 'tools'),
    R(I.COPPER_HELM, 1, [[I.COPPER_BAR, 8]], 'bench', 'tools'),
    R(I.COPPER_MAIL, 1, [[I.COPPER_BAR, 12]], 'bench', 'tools'),
    R(I.IRON_PICK, 1, [[I.IRON_BAR, 8], [T.PLANKS, 4]], 'bench', 'tools'),
    R(I.IRON_AXE, 1, [[I.IRON_BAR, 7], [T.PLANKS, 4]], 'bench', 'tools'),
    R(I.IRON_SHOVEL, 1, [[I.IRON_BAR, 5], [T.PLANKS, 3]], 'bench', 'tools'),
    R(I.IRON_SWORD, 1, [[I.IRON_BAR, 7], [T.PLANKS, 3]], 'bench', 'tools'),
    R(I.IRON_HELM, 1, [[I.IRON_BAR, 10]], 'bench', 'tools'),
    R(I.IRON_MAIL, 1, [[I.IRON_BAR, 16]], 'bench', 'tools'),
    R(I.GOLD_HELM, 1, [[I.GOLD_BAR, 10]], 'bench', 'tools'),
    R(I.POTION, 1, [[I.GEL, 3], [I.APPLE, 1]], 'bench', 'misc'),
    R(I.CRYSTAL_PICK, 1, [[T.CRYSTAL, 12], [I.IRON_BAR, 6], [I.GOLD_BAR, 2]], 'bench', 'tools'),
    R(I.CRYSTAL_BLADE, 1, [[T.CRYSTAL, 14], [I.IRON_BAR, 8], [I.GOLD_BAR, 4]], 'bench', 'tools'),
    R(I.CRYSTAL_MAIL, 1, [[T.CRYSTAL, 20], [I.IRON_BAR, 12], [I.GOLD_BAR, 4]], 'bench', 'tools'),
    R(I.AMULET, 1, [[T.CRYSTAL, 8], [I.GOLD_BAR, 4]], 'bench', 'tools'),
    // ---- wood
    R(T.PINE_PLANKS, 4, [[T.PINE_LOG, 1]], 'hand', 'wood'),
    R(T.MAPLE_PLANKS, 4, [[T.MAPLE_LOG, 1]], 'hand', 'wood'),
    R(T.WILLOW_PLANKS, 4, [[T.WILLOW_LOG, 1]], 'hand', 'wood'),
    R(T.PLANKS, 4, [[T.STRIPPED_OAK, 1]], 'hand', 'wood'),
    R(T.PINE_PLANKS, 4, [[T.STRIPPED_PINE, 1]], 'hand', 'wood'),
    R(T.MAPLE_PLANKS, 4, [[T.STRIPPED_MAPLE, 1]], 'hand', 'wood'),
    R(T.WILLOW_PLANKS, 4, [[T.STRIPPED_WILLOW, 1]], 'hand', 'wood'),
    R(T.BEAM, 2, [[T.LOG, 1]], 'bench', 'wood'),
    R(T.PARQUET, 4, [[T.PLANKS, 2], [T.PINE_PLANKS, 2]], 'bench', 'wood'),
    R(T.SHINGLE, 4, [[T.MAPLE_PLANKS, 4]], 'bench', 'wood'),
    R(T.BED, 1, [[T.PLANKS, 6], [I.FIBER, 6]], 'bench', 'decor'),
    R(I.FISHING_ROD, 1, [[T.PLANKS, 3], [I.FIBER, 4]], 'bench', 'tools'),
    R(I.LURE, 3, [[I.FEATHER, 2], [I.FIBER, 1]], 'hand', 'tools'),
    R(I.COOKED_FISH, 1, [[I.RAW_FISH, 1]], 'furnace', 'misc'),
    R(I.LEATHER_CAP, 1, [[I.LEATHER, 5]], 'bench', 'tools'),
    R(I.LEATHER_TUNIC, 1, [[I.LEATHER, 8]], 'bench', 'tools'),
    R(T.WOOL_BLOCK, 2, [[I.WOOL, 4]], 'hand', 'decor'),
    R(T.FISH_TANK, 1, [[T.GLASS, 6], [I.RAW_FISH, 1], [I.FIBER, 2]], 'bench', 'decor'),
    R(T.BOOKSHELF, 1, [[T.PLANKS, 6], [I.FIBER, 3]], 'bench', 'wood'),
    R(T.THATCH, 2, [[I.FIBER, 4]], 'hand', 'wood'),
    R(T.HAY, 1, [[I.FIBER, 9]], 'hand', 'wood'),
    // ---- earth, clay & glass
    R(T.CLAY, 2, [[T.MUD, 2], [T.SAND, 1]], 'hand', 'clay'),
    R(T.MOSS, 1, [[T.DIRT, 1], [I.FIBER, 2]], 'hand', 'clay'),
    R(T.GRASS, 1, [[T.DIRT, 1], [I.FIBER, 1]], 'hand', 'clay'),
    R(T.COARSE_DIRT, 2, [[T.DIRT, 2], [T.GRAVEL, 2]], 'hand', 'clay'),
    R(T.MUD_BRICK, 4, [[T.MUD, 4], [I.FIBER, 2]], 'bench', 'clay'),
    R(T.ADOBE, 4, [[T.CLAY, 2], [T.SAND, 2]], 'bench', 'clay'),
    R(I.CLAY_BRICK, 3, [[T.CLAY, 2], [T.PLANKS, 1]], 'furnace', 'clay'),
    R(T.TERRACOTTA, 2, [[T.CLAY, 2], [T.PLANKS, 1]], 'furnace', 'clay'),
    R(T.GLASS, 2, [[T.SAND, 2], [T.PLANKS, 1]], 'furnace', 'clay'),
    R(T.BRICK, 2, [[I.CLAY_BRICK, 4]], 'bench', 'clay'),
    R(T.TERRA_TILE, 2, [[T.TERRACOTTA, 2]], 'mason', 'clay'),
    R(T.GLAZED_TILE, 2, [[T.TERRACOTTA, 2], [T.GLASS, 1]], 'mason', 'clay'),
    R(T.ROOF_TILE, 4, [[T.TERRACOTTA, 3]], 'mason', 'clay'),
    R(T.SLATE_ROOF, 4, [[T.SLATE, 3]], 'mason', 'clay'),
    R(T.FRAMED_GLASS, 4, [[T.GLASS, 4], [T.PLANKS, 2]], 'bench', 'clay'),
    R(T.STAINED_GLASS, 4, [[T.GLASS, 4], [T.CRYSTAL, 1]], 'bench', 'clay'),
    R(T.TINTED_GLASS, 4, [[T.GLASS, 4], [T.SLATE, 1]], 'bench', 'clay'),
    // ---- stone
    R(T.STONE, 2, [[T.COBBLE, 2], [T.PLANKS, 1]], 'furnace', 'stone'),
    R(T.BASALT, 2, [[T.SLATE, 2], [T.PLANKS, 1]], 'furnace', 'stone'),
    R(T.SMOOTH_SANDSTONE, 2, [[T.SANDSTONE, 2], [T.PLANKS, 1]], 'furnace', 'stone'),
    R(T.GRAVEL, 2, [[T.COBBLE, 1]], 'mason', 'stone'),
    R(T.POLISHED_STONE, 1, [[T.STONE, 1]], 'mason', 'stone'),
    R(T.STONE_BRICK, 1, [[T.STONE, 1]], 'mason', 'stone'),
    R(T.MOSSY_COBBLE, 1, [[T.COBBLE, 1], [I.FIBER, 1]], 'mason', 'stone'),
    R(T.MOSSY_BRICK, 1, [[T.STONE_BRICK, 1], [I.FIBER, 1]], 'mason', 'stone'),
    R(T.CRACKED_BRICK, 1, [[T.STONE_BRICK, 1]], 'mason', 'stone'),
    R(T.SLATE_BRICK, 1, [[T.SLATE, 1]], 'mason', 'stone'),
    R(T.SLATE_TILE, 1, [[T.SLATE, 1]], 'mason', 'stone'),
    R(T.SANDSTONE_BRICK, 1, [[T.SANDSTONE, 1]], 'mason', 'stone'),
    R(T.SNOW_BRICK, 2, [[T.SNOW, 2]], 'mason', 'stone'),
    R(T.ICE_BRICK, 2, [[T.ICE, 2]], 'mason', 'stone'),
    R(T.MARBLE, 2, [[T.STONE, 2], [T.SNOW, 2]], 'mason', 'decor'),
    R(T.CHECKER, 2, [[T.MARBLE, 1], [T.BASALT, 1]], 'mason', 'decor'),
    R(T.CHISELED_STONE, 1, [['slab:' + T.STONE, 2]], 'mason', 'stone'),
    R(T.CHISELED_SANDSTONE, 1, [['slab:' + T.SANDSTONE, 2]], 'mason', 'stone'),
    // ---- metal & lighting
    R(T.COPPER_BLOCK, 1, [[I.COPPER_BAR, 4]], 'bench', 'metal'),
    R(T.IRON_BLOCK, 1, [[I.IRON_BAR, 4]], 'bench', 'metal'),
    R(T.GOLD_BLOCK, 1, [[I.GOLD_BAR, 4]], 'bench', 'metal'),
    R(T.IRON_PLATE, 2, [[I.IRON_BAR, 3]], 'bench', 'metal'),
    R(T.VERDIGRIS, 3, [[I.COPPER_BAR, 3], [I.GEL, 1]], 'bench', 'metal'),
    R(T.IRON_GRATE, 3, [[I.IRON_BAR, 2]], 'bench', 'metal'),
    R(T.CRYSTAL_BLOCK, 1, [[T.CRYSTAL, 4]], 'bench', 'metal'),
    R(T.CRYSTAL_LAMP, 2, [[T.CRYSTAL, 2], [T.GLASS, 2]], 'bench', 'decor'),
    R(I.WARDEN_SIGIL, 1, [[T.CRYSTAL, 5], [I.IRON_BAR, 4], [I.GEL, 3], [I.RAW_FISH, 3]], 'bench', 'tools'),
    R(I.WARDEN_BLADE, 1, [[I.WARDEN_CORE, 2], [I.IRON_BAR, 6]], 'bench', 'tools'),
    R(I.WARDEN_HELM, 1, [[I.WARDEN_CORE, 2], [I.IRON_BAR, 5]], 'bench', 'tools'),
    R(I.SWIFT_POTION, 1, [[I.GEL, 2], [I.CARROT, 1]], 'bench', 'misc'),
    R(I.HASTE_POTION, 1, [[I.GEL, 2], [I.MUSHROOM, 1]], 'bench', 'misc'),
    R(I.IRON_POTION, 1, [[I.GEL, 2], [I.IRON_BAR, 1]], 'bench', 'misc'),
    R(I.REGEN_POTION, 1, [[I.GEL, 2], [I.WHEAT, 1], [I.APPLE, 1]], 'bench', 'misc'),
    R(I.WARDEN_MAIL, 1, [[I.WARDEN_CORE, 3], [I.IRON_BAR, 8]], 'bench', 'tools'),
    R(I.HOE, 1, [[T.PLANKS, 2], [I.FIBER, 2]], 'bench', 'tools'),
    R(I.BREAD, 1, [[I.WHEAT, 3]], 'bench', 'misc'),
    R(T.SIGN, 2, [[T.PLANKS, 3]], 'hand', 'decor'),
    R(T.FENCE, 4, [[T.PLANKS, 2], [I.FIBER, 1]], 'hand', 'decor'),
    R(T.LADDER, 4, [[T.PLANKS, 2], [I.FIBER, 1]], 'hand', 'misc'),
    R(T.DOOR, 1, [[T.PLANKS, 6]], 'bench', 'decor'),
    R(T.WALL_PLANKS, 4, [[T.PLANKS, 1]], 'hand', 'decor'), R(T.WALL_STONE, 4, [[T.STONE, 1]], 'hand', 'decor'),
    R(T.WALL_BRICK, 4, [[T.BRICK, 1]], 'hand', 'decor'), R(T.WALL_DARK, 4, [[T.SLATE, 1]], 'hand', 'decor'),
    R(T.LANTERN, 2, [[I.IRON_BAR, 1], [T.TORCH, 2], [T.GLASS, 1]], 'bench', 'decor'),
  ];
  // slab / stairs / wall recipes for every shaped material
  for (const [base] of SHAPED) {
    const wood = base === T.PLANKS || base === T.PINE_PLANKS || base === T.MAPLE_PLANKS;
    RECIPES.push(R(SHAPE_OF[base + ':slab'], 2, [[base, 1]], wood ? 'bench' : 'mason', 'shape'));
    if (wood) RECIPES.push(R(SHAPE_OF[base + ':stairR'], 2, [[base, 3]], 'bench', 'shape'));
    else RECIPES.push(R(SHAPE_OF[base + ':stairR'], 1, [[base, 1]], 'mason', 'shape'));
  }
  for (const base of WALLED) RECIPES.push(R(SHAPE_OF[base + ':wall'], 1, [[base, 1]], 'mason', 'shape'));
  // resolve 'slab:<base>' ingredient shorthands to item ids
  for (const r of RECIPES) for (const g of r.ing) if (typeof g[0] === 'string') g[0] = SHAPE_OF[g[0].slice(5) + ':slab'];
  const CATS = [['all', 'All'], ['tools', 'Tools'], ['wood', 'Wood'], ['stone', 'Stone'], ['clay', 'Clay & Glass'], ['metal', 'Metal'], ['shape', 'Stairs & Slabs'], ['decor', 'Decor'], ['misc', 'Misc']];

  // Mobs. hp, dmg(contact), speed(tiles/s), w,h, fly, drops [[item,chance,min,max]]
  const MOBS = {
    rabbit: { name: 'Rabbit', hp: 6, dmg: 0, speed: 3.5, w: 0.7, h: 0.6, passive: true, hop: true, drops: [[I.RAW_MEAT, 0.9, 1, 1], [I.CARROT, 0.25, 1, 1]] },
    slime: { name: 'Slime', hp: 16, dmg: 9, speed: 2.6, w: 0.9, h: 0.7, drops: [[I.GEL, 0.9, 1, 3], [I.APPLE, 0.08, 1, 1]] },
    zombie: { name: 'Zombie', hp: 26, dmg: 14, speed: 2.4, w: 0.7, h: 1.7, drops: [[I.RAW_MEAT, 0.45, 1, 2], [I.APPLE, 0.15, 1, 1], [T.PLANKS, 0.3, 1, 3]] },
    scorpion: { name: 'Sand Scorpion', hp: 24, dmg: 13, speed: 3.6, w: 1.0, h: 0.6, drops: [[I.RAW_MEAT, 0.5, 1, 1], [I.COPPER_BAR, 0.15, 1, 2], [I.GOLD_BAR, 0.05, 1, 1]] },
    frostling: { name: 'Frostling', hp: 18, dmg: 10, speed: 2.4, w: 0.8, h: 0.8, fly: true, glow: [0.5, 0.8, 1], drops: [[T.CRYSTAL, 0.2, 1, 1], [I.GEL, 0.5, 1, 2], [T.ICE, 0.5, 1, 3]] },
    bat: { name: 'Cave Bat', hp: 9, dmg: 7, speed: 4.5, w: 0.7, h: 0.5, fly: true, drops: [[I.GEL, 0.4, 1, 1]] },
    frog: { name: 'Bog Frog', hp: 11, dmg: 6, speed: 2.8, w: 0.6, h: 0.5, drops: [[I.GEL, 0.5, 1, 1], [I.RAW_MEAT, 0.4, 1, 1]] },
    wolf: { name: 'Grey Wolf', hp: 34, dmg: 16, speed: 4.6, w: 1.2, h: 0.85, drops: [[I.RAW_MEAT, 0.85, 1, 2]] },
    crawler: { name: 'Crystal Crawler', hp: 70, dmg: 24, speed: 4.4, w: 1.1, h: 0.8, glow: [0.8, 0.5, 1], drops: [[T.CRYSTAL, 0.6, 1, 3], [I.IRON_BAR, 0.4, 1, 3], [I.GOLD_BAR, 0.25, 1, 2], [I.COOKED_MEAT, 0.3, 1, 2]] },
    warden: { name: 'Hollow Warden', hp: 700, dmg: 22, speed: 2.4, w: 3.4, h: 5.4, boss: true, drops: [[I.WARDEN_CORE, 1, 2, 3], [T.CRYSTAL, 1, 6, 10], [I.IRON_BAR, 1, 4, 8], [I.GOLD_BAR, 1, 1, 3]] },
    husky: { name: 'Husky', hp: 24, dmg: 8, speed: 4.2, w: 1.1, h: 0.9, neutral: true, animal: true, tameable: true, drops: [[I.RAW_MEAT, 0.5, 1, 1]] },
    skeleton: { name: 'Skeleton', hp: 22, dmg: 6, speed: 2.2, w: 0.6, h: 1.7, ranged: true, drops: [[I.COPPER_BAR, 0.3, 1, 2], [I.IRON_BAR, 0.12, 1, 1], [I.FEATHER, 0.5, 1, 2], [I.FIBER, 0.4, 1, 2]] },
    boomer: { name: 'Boomer', hp: 18, dmg: 0, speed: 2.6, w: 0.7, h: 1.2, boom: true, drops: [[I.GEL, 0.6, 1, 2], [T.CRYSTAL, 0.12, 1, 1], [I.IRON_BAR, 0.1, 1, 1]] },
    spider: { name: 'Cave Spider', hp: 20, dmg: 11, speed: 4.2, w: 1.1, h: 0.6, drops: [[I.FIBER, 0.7, 1, 3], [I.RAW_MEAT, 0.3, 1, 1], [I.GEL, 0.3, 1, 1]] },
      // ---- animals (peaceful; they live in the world even on Peaceful difficulty)
    cow: { name: 'Cow', hp: 14, dmg: 0, speed: 1.7, w: 1.5, h: 1.2, passive: true, animal: true, drops: [[I.RAW_MEAT, 1, 1, 3], [I.LEATHER, 0.8, 1, 2]] },
    pig: { name: 'Pig', hp: 10, dmg: 0, speed: 1.9, w: 1.1, h: 0.8, passive: true, animal: true, drops: [[I.RAW_MEAT, 1, 1, 2]] },
    sheep: { name: 'Sheep', hp: 10, dmg: 0, speed: 1.9, w: 1.2, h: 1.0, passive: true, animal: true, drops: [[I.WOOL, 1, 1, 2], [I.RAW_MEAT, 0.6, 1, 1]] },
    chicken: { name: 'Chicken', hp: 5, dmg: 0, speed: 2.4, w: 0.7, h: 0.75, passive: true, animal: true, drops: [[I.FEATHER, 1, 1, 2], [I.RAW_MEAT, 0.7, 1, 1]] },
    deer: { name: 'Deer', hp: 16, dmg: 0, speed: 4.0, w: 1.5, h: 1.5, passive: true, animal: true, flee: 9, drops: [[I.RAW_MEAT, 1, 2, 3], [I.LEATHER, 0.5, 1, 1]] },
    fox: { name: 'Fox', hp: 12, dmg: 0, speed: 3.8, w: 1.1, h: 0.8, passive: true, animal: true, flee: 8, drops: [[I.RAW_MEAT, 0.8, 1, 1], [I.LEATHER, 0.35, 1, 1]] },
    camel: { name: 'Camel', hp: 26, dmg: 0, speed: 1.8, w: 1.9, h: 1.7, passive: true, animal: true, drops: [[I.RAW_MEAT, 1, 2, 3], [I.LEATHER, 0.8, 1, 2]] },
    penguin: { name: 'Penguin', hp: 8, dmg: 0, speed: 1.5, w: 0.7, h: 0.9, passive: true, animal: true, drops: [[I.RAW_FISH, 0.8, 1, 1], [I.FEATHER, 0.5, 1, 1]] },
    turtle: { name: 'Turtle', hp: 14, dmg: 0, speed: 0.9, w: 1.0, h: 0.6, passive: true, animal: true, flee: 3, drops: [[I.RAW_MEAT, 0.7, 1, 1]] },
    bird: { name: 'Songbird', hp: 3, dmg: 0, speed: 3.2, w: 0.5, h: 0.4, passive: true, animal: true, fly: true, drops: [[I.FEATHER, 0.8, 1, 1]] },
    fish: { name: 'Fish', hp: 3, dmg: 0, speed: 1.9, w: 0.8, h: 0.4, passive: true, animal: true, swim: true, drops: [[I.RAW_FISH, 1, 1, 1]] },
    bear: { name: 'Brown Bear', hp: 45, dmg: 15, speed: 3.2, w: 1.7, h: 1.3, neutral: true, animal: true, drops: [[I.RAW_MEAT, 1, 2, 3], [I.LEATHER, 1, 1, 2]] },
  };

  /** fishing loot: [item, weight, min, max, condition]  condition: null | biome index | 'cave' (rare weights double with a lure) */
  const FISH_LOOT = [
    [I.RAW_FISH, 52, 1, 1, null], [I.FIBER, 12, 1, 2, null], [T.CLAY, 5, 1, 2, null],
    [T.ICE, 10, 1, 2, 2], [T.MUD, 10, 1, 2, 5], [T.SAND, 8, 1, 2, 1], [T.SLATE, 6, 1, 1, 4],
    [I.GEL, 6, 1, 2, 'cave'], [T.CRYSTAL, 3, 1, 1, 'cave'],
    [I.COPPER_BAR, 3, 1, 1, 'rare'], [I.IRON_BAR, 1.5, 1, 1, 'rare'], [I.GOLD_BAR, 0.8, 1, 1, 'rare'], [I.POTION, 1, 1, 1, 'rare'], [I.GOLDEN_CARP, 1.2, 1, 1, 'rare'],
  ];
  /** pick a catch. biome: biome index; cave: bool; lure: bool; rnd: () => [0,1) */
  function rollCatch(biome, cave, lure, rnd) {
    const list = FISH_LOOT.filter((e) => e[4] === null || e[4] === 'rare' || e[4] === biome || (e[4] === 'cave' && cave)).map((e) => [e, e[4] === 'rare' && lure ? e[1] * 2.2 : e[1]]);
    let tot = 0; for (const [, w] of list) tot += w; let r = rnd() * tot;
    for (const [e, w] of list) { if ((r -= w) <= 0) return [e[0], e[2] + Math.floor(rnd() * (e[3] - e[2] + 1))]; }
    return [I.RAW_FISH, 1];
  }

  const C = {
    INV: 50, HOTBAR: 10, STACK: 99, REACH: 5.6, PW: 0.62, PH: 1.7, PLAYER_HP: 100, MAX_PLAYERS: 4,
    DAY_LEN: 420, // seconds per full day
    GRAVITY: 42, MAXFALL: 32, RUN: 7.0, JUMP: 13.2,
    CHEST_SLOTS: 24, TICK: 20,
    SIZES: { small: [900, 280], medium: [1300, 320], large: [1800, 360] },
  };

  const isSolidTile = (v) => SOLID[v] === 1;

  /** Tile-based AABB physics with partial blocks (slabs, stairs, walls).
   *  b: {x(center), y(top), w, h, vx, vy, grav(0..1), step(bool)}; coll(tx,ty) -> 0 none | 1 full | 2+ partial shape id. */
  function moveBody(b, dt, coll) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt / 0.35));
    const sdt = dt / steps;
    const hw = b.w / 2;
    // iterate overlapping boxes at (x,y): fn(left,top,right,bottom) in world units; returns true to stop
    const scan = (x, y, fn) => {
      const l = x - hw, r = x + hw, t = y, bt = y + b.h;
      const x0 = Math.floor(l), x1 = Math.floor(r - 1e-6), y0 = Math.floor(t), y1 = Math.floor(bt - 1e-6);
      for (let ty = y0; ty <= y1 + 1; ty++) for (let tx = x0; tx <= x1; tx++) {
        const c = coll(tx, ty); if (!c) continue;
        const bx = BOXES[c], below = ty > y1;
        for (let k = 0; k < bx.length; k++) {
          const q = bx[k]; if (below && q[1] >= 0) continue;
          const ql = tx + q[0], qt = ty + q[1], qr = tx + q[2], qb = ty + q[3];
          if (ql < r - 1e-6 && qr > l + 1e-6 && qt < bt - 1e-6 && qb > t + 1e-6 && fn(ql, qt, qr, qb)) return true;
        }
      }
      return false;
    };
    const hit = (x, y) => scan(x, y, () => true);
    b.hitX = false; b.hitY = false;
    let ground = false;
    for (let s = 0; s < steps; s++) {
      const nx = b.x + b.vx * sdt;
      if (hit(nx, b.y)) {
        let stepped = false;
        if (b.step && b.vy >= 0 && (ground || b.onGround)) {
          for (const up of [0.5, 1]) if (!hit(nx, b.y - up - 0.02)) { b.y -= up; b.x = nx; stepped = true; break; }
        }
        if (!stepped) {
          if (b.vx > 0) { let m = Infinity; scan(nx, b.y, (l) => { if (l < m) m = l; return false; }); b.x = m - hw - 1e-4; }
          else { let m = -Infinity; scan(nx, b.y, (l, t, r) => { if (r > m) m = r; return false; }); b.x = m + hw + 1e-4; }
          b.vx = 0; b.hitX = true;
        }
      } else b.x = nx;
      const ny = b.y + b.vy * sdt;
      if (hit(b.x, ny)) {
        if (b.vy > 0) { let m = Infinity; scan(b.x, ny, (l, t) => { if (t < m) m = t; return false; }); b.y = m - b.h - 1e-4; ground = true; }
        else { let m = -Infinity; scan(b.x, ny, (l, t, r, bb) => { if (bb > m) m = bb; return false; }); b.y = m + 1e-4; }
        b.vy = 0; b.hitY = true;
      } else b.y = ny;
    }
    b.onGround = ground;
  }


  // quest book: ev = event kind, k = optional filter list (tile ids / mob names / item ids), n = amount needed
  const POTS = [I.SWIFT_POTION, I.HASTE_POTION, I.IRON_POTION, I.REGEN_POTION];
  const QUESTS = [
    { id: 'wood', name: 'Timber!', desc: 'Chop 15 logs', ev: 'mine', k: [T.LOG, T.PINE_LOG, T.MAPLE_LOG, T.WILLOW_LOG], n: 15, reward: [[I.POTION, 2]] },
    { id: 'stone', name: 'Stone Age', desc: 'Mine 40 stone', ev: 'mine', k: [T.STONE], n: 40, reward: [[I.SWIFT_POTION, 2]] },
    { id: 'ore', name: 'Prospector', desc: 'Mine 12 copper or iron ore', ev: 'mine', k: [T.COPPER, T.IRON], n: 12, reward: [[I.HASTE_POTION, 2]] },
    { id: 'gold', name: 'Gold Rush', desc: 'Mine 6 gold ore', ev: 'mine', k: [T.GOLD], n: 6, reward: [[I.IRON_POTION, 2]] },
    { id: 'gem', name: 'Gem Hunter', desc: 'Mine 6 glow crystals', ev: 'mine', k: [T.CRYSTAL], n: 6, reward: [[I.REGEN_POTION, 3]] },
    { id: 'smith', name: 'Ironworks', desc: 'Craft an iron pickaxe, axe or sword', ev: 'craft', k: [I.IRON_PICK, I.IRON_AXE, I.IRON_SWORD], n: 1, reward: [[I.IRON_BAR, 4]] },
    { id: 'slime', name: 'Slime Squasher', desc: 'Defeat 10 slimes', ev: 'kill', k: ['slime'], n: 10, reward: [[I.POTION, 3]] },
    { id: 'zombie', name: 'Night Watch', desc: 'Defeat 10 zombies', ev: 'kill', k: ['zombie'], n: 10, reward: [[I.IRON_POTION, 2]] },
    { id: 'bones', name: 'Bone Collector', desc: 'Defeat 8 skeletons', ev: 'kill', k: ['skeleton'], n: 8, reward: [[I.HASTE_POTION, 2]] },
    { id: 'boom', name: 'Bomb Squad', desc: 'Defeat 5 boomers', ev: 'kill', k: ['boomer'], n: 5, reward: [[I.SWIFT_POTION, 3]] },
    { id: 'spider', name: 'Web Cutter', desc: 'Defeat 5 cave spiders', ev: 'kill', k: ['spider'], n: 5, reward: [[I.REGEN_POTION, 2]] },
    { id: 'fish1', name: 'Angler', desc: 'Catch 5 fish', ev: 'fish', n: 5, reward: [[I.LURE, 5]] },
    { id: 'fish2', name: 'Master Angler', desc: 'Catch 25 fish', ev: 'fish', n: 25, reward: [[I.POTION, 5], [I.GOLD_BAR, 2]] },
    { id: 'bread', name: 'Baker', desc: 'Bake 3 bread', ev: 'craft', k: [I.BREAD], n: 3, reward: [[I.REGEN_POTION, 2]] },
    { id: 'farm', name: 'Green Thumb', desc: 'Harvest 20 ripe crops', ev: 'harvest', n: 20, reward: [[I.WHEAT_SEEDS, 10], [I.CARROT, 5]] },
    { id: 'breed', name: 'Shepherd', desc: 'Breed animals 3 times', ev: 'breed', n: 3, reward: [[I.LEATHER, 6], [I.WOOL, 6]] },
    { id: 'tame', name: "Man's Best Friend", desc: 'Tame a husky', ev: 'tame', n: 1, reward: [[I.SWIFT_POTION, 2]] },
    { id: 'brew', name: 'Alchemist', desc: 'Brew 5 buff potions', ev: 'craft', k: POTS, n: 5, reward: [[I.GOLD_BAR, 3]] },
    { id: 'boss', name: 'Warden Slayer', desc: 'Defeat the Hollow Warden', ev: 'boss', n: 1, reward: [[I.GOLD_BAR, 6], [I.REGEN_POTION, 4]] },
    { id: 'vet', name: 'Veteran', desc: 'Defeat 100 monsters', ev: 'kill', n: 100, reward: [[I.GOLD_BAR, 5], [I.IRON_POTION, 3]] },
  ];

  const empty = () => null;
  function maxHpFor(eq) { let hp = C.PLAYER_HP; if (eq) for (const k of ['head', 'body', 'charm']) { const s = eq[k]; if (s && ITEMS[s[0]]) hp += ITEMS[s[0]].hp || 0; } return hp; }
  function defenseFor(eq, buffs) { let d = 0; if (eq) for (const k of ['head', 'body', 'charm']) { const s = eq[k]; if (s && ITEMS[s[0]]) d += ITEMS[s[0]].def || 0; } if (buffs && buffs.iron) d += 4; return d; }
  /** Can tool item `it` (or bare hands) harvest block `id` at all? */
  function canMine(id, it) {
    const b = BLOCKS[id]; if (!b || !isFinite(b.hard)) return false;
    if (b.tier <= 0) return true;
    return !!(it && it.kind === 'pick' && it.tier >= b.tier);
  }
  /** seconds needed to mine block `id` using tool item `it` (or null for bare hands); Infinity = needs a better tool */
  function mineTime(id, it) {
    const b = BLOCKS[id];
    if (!b || !isFinite(b.hard)) return Infinity;
    if (!canMine(id, it)) return Infinity;
    const kind = it && it.kind, sp = it && it.speed || 1;
    let m = 1;
    if (b.mat === 'stone' || b.mat === 'ore' || b.mat === 'metal') { if (kind === 'pick') m = sp; }
    else if (b.mat === 'wood') { if (kind === 'axe') m = sp; else if (kind === 'pick' || kind === 'shovel') m = 1 + (sp - 1) * 0.2; }
    else if (b.mat === 'soft') { if (kind === 'shovel') m = sp; else if (kind === 'pick' || kind === 'axe') m = 1 + (sp - 1) * 0.3; }
    else if (b.mat === 'glass') { if (kind) m = 1 + (sp - 1) * 0.25; }
    return b.hard / m;
  }
  /** durability cost of breaking block `id` */
  function toolWear(id) { const b = BLOCKS[id]; return b && b.hard >= 6 ? 2 : 1; }
  /** message when `it` can't mine `id` */
  function needText(id) { const b = BLOCKS[id]; return `${b ? b.name : 'This block'} needs a ${TIER_NAMES[Math.min(5, b ? b.tier : 1)]} Pickaxe or better`; }
  return { QUESTS, BUFFS, FISH_LOOT, rollCatch, LEAF, DECOR, BACKWALL, CROPS, FEED, DOORTILE, COLL, BOXES, SHAPE, SHAPE_OF, SHAPED, WALLED, CLEAR, OPAQUE, LOGS, STRIPPED, CATS, TIER_NAMES, canMine, toolWear, needText, BIOMES, T, I, BLOCKS, ITEMS, RECIPES, MOBS, C, SOLID, PLACEABLE, isSolidTile, moveBody, maxHpFor, defenseFor, mineTime, empty };
});
