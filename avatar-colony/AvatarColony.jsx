// Four Nations Colony: a single-file, top-down colony simulation prototype
// inspired by Avatar: The Last Airbender and RimWorld.
// React + HTML5 Canvas + Tailwind (HUD) + lucide-react (icons).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pause, Play, ChevronsRight, FastForward, Sun, Moon, Gem, Axe, Trash2, Crosshair,
  Square, DoorOpen, Bed, Flame, Coffee, AlertTriangle, Package, Sprout, Leaf,
  MousePointer2, Mountain, Droplets, Wind, Hand, Heart, Utensils, Swords, Triangle,
  X, RotateCcw, ZoomIn, ZoomOut, ScrollText, Hammer, Footprints, Skull, HelpCircle, Sparkles, Eye, Rocket, GitBranch, BookOpen, TreePine, FlaskConical,
} from 'lucide-react';

// ============================================================================
// Constants & definitions
// ============================================================================
const W = 40, H = 40, TS = 32;
const DAY_LEN = 180;            // game seconds per in-game day (1x speed)
const MAXSTACK = 75;
const SPEEDS = [0, 1, 2, 3, 8];
const T = { GRASS: 0, SOIL: 1, WATER: 2, STONE: 3, DIRT: 4, SAND: 5 };
const TERRAIN_NAME = ['Grass', 'Fertile Soil', 'Water', 'Stone Deposit', 'Bare Earth', 'Sand'];
const TERRAIN_COLOR = ['#5f8f45', '#6b4a2d', '#2d6c9e', '#7d8088', '#8b7a5a', '#cdb27a'];
const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const ELEMENTS = {
  earth: { name: 'Earthbender', color: '#5fbf5a', dark: '#2d6b2a', robe: '#4f7a3a', range: 6, dmg: 16, proj: 'boulder', cd: 1.6,
    perk: 'Mines and builds 2.2x faster. Raises stone walls instantly with Chi (no stone needed).', icon: Mountain },
  water: { name: 'Waterbender', color: '#4aa3e8', dark: '#1f5a8a', robe: '#2f6fb0', range: 5, dmg: 10, proj: 'water', cd: 1.0,
    perk: 'Waters whole crop patches with one motion, heals wounds, draws strength from the moon.', icon: Droplets },
  fire: { name: 'Firebender', color: '#e8553f', dark: '#8a2418', robe: '#a8321f', range: 7, dmg: 18, proj: 'fire', cd: 1.25,
    perk: 'Kindles campfires with Chi, cooks 3x faster, hardest-hitting ranged attacks.', icon: Flame },
  air: { name: 'Airbender', color: '#f2c53d', dark: '#9a6f12', robe: '#e0902a', range: 5, dmg: 7, proj: 'air', cd: 1.0,
    perk: 'Moves 2.5x faster, carries 3x as much, gusts push enemies back.', icon: Wind },
  none: { name: 'Non-Bender', color: '#d98a3c', dark: '#5d6066', robe: '#7d8189', range: 1.5, dmg: 9, proj: null, cd: 0.8,
    perk: 'Crafts 1.5x faster, builds traps 3x faster, chi-blocks enemies so they cannot bend.', icon: Hand },
};

const PRIORITIES = {
  earth: ['build', 'mine', 'decon', 'haul', 'chop', 'plantTree', 'harvest', 'plant', 'kindle', 'cook', 'water', 'research', 'tame'],
  water: ['water', 'harvest', 'plant', 'tame', 'haul', 'build', 'decon', 'cook', 'kindle', 'research', 'plantTree', 'chop', 'mine'],
  fire: ['kindle', 'cook', 'build', 'decon', 'harvest', 'haul', 'research', 'mine', 'chop', 'plant', 'water', 'plantTree', 'tame'],
  air: ['haul', 'tame', 'harvest', 'plant', 'water', 'chop', 'plantTree', 'build', 'decon', 'research', 'kindle', 'cook', 'mine'],
  none: ['build', 'research', 'decon', 'chop', 'cook', 'tame', 'harvest', 'plant', 'haul', 'plantTree', 'kindle', 'mine', 'water'],
};

const STRUCTS = {
  wall: { name: 'Stone Wall', mat: 'stone', cost: 5, work: 4, hp: 220, solid: true },
  door: { name: 'Door', mat: 'wood', cost: 4, work: 3, hp: 120, solid: false },
  bed: { name: 'Bed', mat: 'wood', cost: 6, work: 4, hp: 80, solid: false },
  campfire: { name: 'Campfire', mat: 'wood', cost: 4, work: 3, hp: 80, solid: true },
  teatable: { name: 'Tea Table', mat: 'wood', cost: 8, work: 5, hp: 100, solid: true },
  trap: { name: 'Spike Trap', mat: 'wood', cost: 4, work: 4, hp: 50, solid: false },
  desk: { name: 'Scroll Desk', mat: 'wood', cost: 10, work: 5, hp: 90, solid: true },
};

const ITEMS = {
  stone: { name: 'Stone', color: '#a3a7ae' },
  wood: { name: 'Wood', color: '#a0703e' },
  cabbage: { name: 'Cabbage', color: '#8fd16a', food: 28, raw: true },
  tea: { name: 'Jasmine Tea', color: '#efe2a8' },
  meal: { name: 'Hearty Meal', color: '#e8b04a', food: 55 },
  meat: { name: 'Raw Meat', color: '#c2504a', food: 20, raw: true },
  egg: { name: 'Eggs', color: '#f4ead2', food: 14, raw: true },
  milk: { name: 'Milk', color: '#eef3f7', food: 16 },
};

// ---------------------------------------------------------------- wildlife
// diet: herb (grazes grass, may raid crops), carn (hunts prey), omni (both).
// role: what the animal does once tamed.
const SPECIES = {
  duck: { name: 'Turtle-Duck', diet: 'herb', hp: 20, speed: 1.7, sense: 4, tame: 0.65, meat: 3, role: 'livestock', product: 'egg', every: 70, cap: 9, size: 0.45, swims: true },
  chicken: { name: 'Possum-Chicken', diet: 'herb', hp: 18, speed: 1.8, sense: 4, tame: 0.7, meat: 3, role: 'livestock', product: 'egg', every: 55, cap: 9, size: 0.45 },
  sheep: { name: 'Koala-Sheep', diet: 'herb', hp: 45, speed: 1.8, sense: 5, tame: 0.55, meat: 8, role: 'plough', product: 'milk', every: 90, cap: 7, size: 0.65 },
  hog: { name: 'Hog-Monkey', diet: 'herb', hp: 35, speed: 2.6, sense: 5, tame: 0.35, meat: 6, role: 'companion', cap: 6, size: 0.55, cropRaider: true },
  ostrich: { name: 'Ostrich-Horse', diet: 'herb', hp: 60, speed: 3.6, sense: 7, tame: 0.4, meat: 9, role: 'hauler', carry: 50, cap: 4, size: 0.7 },
  yak: { name: 'Buffalo-Yak', diet: 'herb', hp: 110, speed: 2.0, sense: 5, tame: 0.3, meat: 16, role: 'hauler', carry: 90, plough: true, cap: 4, size: 0.95, fightsBack: true, dmg: 10 },
  lion: { name: 'Saber-Tooth Moose-Lion', diet: 'carn', hp: 120, speed: 3.3, sense: 9, tame: 0.06, meat: 10, role: 'guard', cap: 3, size: 0.9, dmg: 14 },
  bear: { name: 'Platypus-Bear', diet: 'omni', hp: 170, speed: 2.6, sense: 6, tame: 0, meat: 14, cap: 1, size: 1, dmg: 16 },
};
const ROLE_TEXT = {
  hauler: 'carry loads to the stockpile', livestock: 'lay eggs', plough: 'plough the fields and give milk',
  companion: 'keep everyone in good spirits', guard: 'guard the camp',
};

// ---------------------------------------------------------------- research
const ERAS = ['Ancient', 'Classical', 'Medieval', 'Industrial', 'Modern'];
const TECHS = {
  husbandry: { name: 'Animal Husbandry', era: 0, cost: 40, req: [], cat: 'farming', desc: 'Colonists can tame wild animals for hauling, ploughing, eggs and milk.' },
  forestry: { name: 'Forestry', era: 0, cost: 40, req: [], cat: 'farming', desc: 'Colonists plant tree groves and replant what they cut.' },
  pottery: { name: 'Pottery', era: 0, cost: 50, req: [], cat: 'medicine', desc: 'Clay pots: every cooked batch yields 50% more meals.' },
  stonecraft: { name: 'Stonecraft', era: 0, cost: 50, req: [], cat: 'military', desc: 'Walls are 50% tougher; earthbent walls cost 15 Chi instead of 25.' },
  irrigation: { name: 'Irrigation', era: 1, cost: 90, req: ['forestry', 'pottery'], cat: 'farming', desc: 'Crops dry out half as fast.' },
  bronze: { name: 'Bronze Weapons', era: 1, cost: 90, req: ['stonecraft'], cat: 'military', desc: 'All colonist attacks deal 25% more damage.' },
  herbal: { name: 'Herbal Medicine', era: 1, cost: 90, req: ['pottery'], cat: 'medicine', desc: 'Wounds bleed 40% slower and tended wounds heal faster.' },
  wheel: { name: 'The Wheel', era: 1, cost: 90, req: ['husbandry'], cat: 'comfort', desc: 'Colonists and pack animals carry 50% more.' },
  rotation: { name: 'Crop Rotation', era: 2, cost: 150, req: ['irrigation'], cat: 'farming', desc: 'Crops grow 40% faster.' },
  masonry: { name: 'Masonry', era: 2, cost: 150, req: ['stonecraft', 'wheel'], cat: 'military', desc: 'Walls and doors are twice as tough.' },
  crossbow: { name: 'Crossbows', era: 2, cost: 150, req: ['bronze'], cat: 'military', desc: 'Non-benders shoot crossbow bolts from range instead of only fighting hand to hand.' },
  plough: { name: 'Animal Plough', era: 2, cost: 150, req: ['husbandry', 'rotation'], cat: 'farming', desc: 'Ploughing animals double crop growth around them; taming succeeds more often.' },
  steam: { name: 'Steam Power', era: 3, cost: 230, req: ['masonry'], cat: 'comfort', desc: 'Research goes 50% faster.' },
  metalbending: { name: 'Metalbending', era: 3, cost: 230, req: ['masonry', 'bronze'], cat: 'military', desc: 'Earthbenders hit 50% harder and mine 50% faster.' },
  lightning: { name: 'Lightning Generation', era: 3, cost: 230, req: ['steam', 'crossbow'], cat: 'military', desc: 'Firebenders throw lightning: 60% more damage and longer range.' },
  fertilizer: { name: 'Fertilizer', era: 3, cost: 230, req: ['rotation', 'plough'], cat: 'farming', desc: 'Crops grow faster still and wild grass regrows twice as fast.' },
  radio: { name: 'Radio', era: 4, cost: 320, req: ['steam'], cat: 'military', desc: 'Scouts radio ahead: raids are announced 25 seconds early and colonists gather inside camp.' },
  medicine: { name: 'Modern Medicine', era: 4, cost: 320, req: ['herbal', 'steam'], cat: 'medicine', desc: 'Bleeding slows to a trickle and wounds heal twice as fast.' },
  electricity: { name: 'Electricity', era: 4, cost: 320, req: ['lightning'], cat: 'comfort', desc: 'Electric lights push back the night and lift spirits.' },
  satomobile: { name: 'Satomobiles', era: 4, cost: 320, req: ['steam', 'wheel'], cat: 'comfort', desc: 'Colonists move 30% faster.' },
  probending: { name: 'Pro-Bending Arena', era: 4, cost: 400, req: ['electricity', 'metalbending'], cat: 'comfort', desc: 'Matches every evening lift everyone\'s Harmony. The colony has reached the modern era.' },
};
const hasTech = (G, k) => G.tech.has(k);
const availableTechs = (G) => Object.keys(TECHS).filter((k) => !G.tech.has(k) && TECHS[k].req.every((r) => G.tech.has(r)));
function eraOf(G) { let e = 0; for (const k of G.tech) e = Math.max(e, TECHS[k].era); return e; }
function chooseResearch(G) {
  const av = availableTechs(G);
  if (!av.length) return null;
  const f = G.genome.researchFocus;
  const score = (k) => (TECHS[k].cat === f ? 2.2 : 1) / TECHS[k].cost;
  av.sort((a, b) => score(b) - score(a));
  return av[0];
}
const structMaxHp = (G, s) => {
  const base = STRUCTS[s.type].hp;
  if (s.type === 'wall') return base * (hasTech(G, 'masonry') ? 2 : hasTech(G, 'stonecraft') ? 1.5 : 1);
  if (s.type === 'door') return base * (hasTech(G, 'masonry') ? 2 : 1);
  return base;
};
const wallChi = (G) => (hasTech(G, 'stonecraft') ? 15 : 25);
function addResearch(G, pts) {
  const R = G.research;
  if (!R.target || G.tech.has(R.target)) R.target = chooseResearch(G);
  if (!R.target) return;
  R.progress += pts;
  const t = TECHS[R.target];
  if (R.progress < t.cost) return;
  const before = eraOf(G);
  G.tech.add(R.target); R.progress = 0;
  // Tougher walls apply to walls already standing.
  for (const st of G.struct) if (st && st.built && (st.type === 'wall' || st.type === 'door')) st.hp = Math.max(st.hp, structMaxHp(G, st) * (st.hp / Math.max(1, st.maxHp || STRUCTS[st.type].hp)));
  for (const st of G.struct) if (st && st.built) st.maxHp = structMaxHp(G, st);
  const era = eraOf(G);
  if (era > before) banner(G, `The ${ERAS[era]} era`, `Discovering ${t.name} carries the colony into the ${ERAS[era]} era.`, 'iroh');
  else log(G, `Discovery: ${t.name}. ${t.desc}`, 'iroh');
  for (const p of G.pawns) if (!p.dead) addThought(p, 'discovery', `We discovered ${t.name}`, 4, 150);
  R.target = chooseResearch(G);
}

const RAIDERS = {
  scout: { name: 'Fire Nation Scout', hp: 55, range: 6, dmg: 10, cd: 1.8, proj: 'fire', inj: 'Burn', speed: 2.3, color: '#9c2a1e', bash: 9 },
  sand: { name: 'Sandbender', hp: 65, range: 5.5, dmg: 9, cd: 1.5, proj: 'sand', inj: 'Cut', speed: 2.2, color: '#c7a467', bash: 11 },
};

const BACKSTORIES = {
  earth: 'Former quarry worker from an Earth Kingdom village.',
  water: 'Healer trained in a Northern Water Tribe hut.',
  fire: 'Deserter from a Fire Nation garrison, seeking redemption.',
  air: 'Wandering nomad who misses the temple bells.',
  none: 'Resourceful hunter from the Southern Water Tribe.',
};

const JOB_ICON = {
  eat: Utensils, sleep: Moon, mine: Gem, chop: Axe, build: Hammer, decon: Hammer, plant: Sprout,
  harvest: Leaf, water: Droplets, cook: Flame, kindle: Flame, haul: Package, tend: Heart, rescue: Heart,
  tea: Coffee, wander: Footprints, retreat: Footprints, fight: Swords, mental: AlertTriangle, downed: AlertTriangle, dead: Skull, idle: Footprints,
};

// ============================================================================
// Helpers
// ============================================================================
const idx = (x, y) => y * W + x;
const inB = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tileOf = (e) => [clamp(Math.floor(e.x), 0, W - 1), clamp(Math.floor(e.y), 0, H - 1)];
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const hash = (i, k) => { const s = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return s - Math.floor(s); };

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseGrid(r, cells) {
  const n = cells + 1, g = [];
  for (let i = 0; i < n * n; i++) g.push(r());
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const fx = x * cells, fy = y * cells, ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = sm(fx - ix), ty = sm(fy - iy);
    const a = g[iy * n + ix], b = g[iy * n + ix + 1], c = g[(iy + 1) * n + ix], d = g[(iy + 1) * n + ix + 1];
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
  };
}
function fbm(r) {
  const a = noiseGrid(r, 4), b = noiseGrid(r, 8), c = noiseGrid(r, 16);
  return (x, y) => a(x, y) * 0.55 + b(x, y) * 0.3 + c(x, y) * 0.15;
}

function tint(hex, v) {
  const n = parseInt(hex.slice(1), 16);
  const f = 1 + v;
  const r = clamp(Math.round(((n >> 16) & 255) * f), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * f), 0, 255);
  const b = clamp(Math.round((n & 255) * f), 0, 255);
  return `rgb(${r},${g},${b})`;
}

class Heap {
  constructor() { this.a = []; this.p = []; this.lastP = 0; }
  get size() { return this.a.length; }
  push(v, pr) {
    const a = this.a, p = this.p; a.push(v); p.push(pr);
    let i = a.length - 1;
    while (i > 0) {
      const j = (i - 1) >> 1; if (p[j] <= p[i]) break;
      [a[i], a[j]] = [a[j], a[i]]; [p[i], p[j]] = [p[j], p[i]]; i = j;
    }
  }
  pop() {
    const a = this.a, p = this.p, v = a[0]; this.lastP = p[0];
    const lv = a.pop(), lp = p.pop();
    if (a.length) {
      a[0] = lv; p[0] = lp;
      let i = 0; const n = a.length;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < n && p[l] < p[m]) m = l;
        if (r < n && p[r] < p[m]) m = r;
        if (m === i) break;
        [a[i], a[m]] = [a[m], a[i]]; [p[i], p[m]] = [p[m], p[i]]; i = m;
      }
    }
    return v;
  }
}

// ============================================================================
// Time
// ============================================================================
const hourOf = (G) => ((G.time / DAY_LEN) * 24 + 7) % 24;
const dayOf = (G) => Math.floor(((G.time / DAY_LEN) * 24 + 7) / 24) + 1;
const isNight = (G) => { const h = hourOf(G); return h >= 21 || h < 5.5; };
const isDay = (G) => { const h = hourOf(G); return h >= 6 && h < 19; };
function clockStr(G) {
  const h = hourOf(G); const hh = Math.floor(h); const mm = Math.floor((h - hh) * 60 / 10) * 10;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function darkness(G) {
  const h = hourOf(G);
  let d;
  if (h >= 6.5 && h < 18) d = 0;
  else if (h >= 18 && h < 21) d = (h - 18) / 3;
  else if (h >= 4.5 && h < 6.5) d = 1 - (h - 4.5) / 2;
  else d = 1;
  return d * (G.ev.fullmoon > 0 ? 0.42 : 0.62) * (G.tech && G.tech.has('electricity') ? 0.45 : 1);
}


// ============================================================================
// Lineage learning
// Each colony carries a "genome" of habits. Generation 1 is naive and makes
// real mistakes. When a colony falls, its chronicle (what killed people,
// hunger, breaks, wounds, how far the wall got) becomes lessons for the next
// generation, plus one small experiment so the colony keeps trying new things.
// ============================================================================
const NAIVE_GENOME = {
  wallDay: 99,          // day the colonists start walling the camp (99 = never)
  wallAfterRaid: false, // start walling as soon as the first raid hits
  traps: 0,             // spike traps kept outside the gates
  fightHealth: 15,      // health below which a colonist stops fighting and retreats
  medic: false,         // one colonist leaves the fight to save a bleeding ally
  huntEager: true,      // hunt the platypus-bear on sight
  farmPerColonist: 2,   // cabbage tiles per colonist
  mealReserve: 1,       // how many meals per colonist the cooks keep ready (x2)
  waterFirst: false,    // drop other work to water crops during heatwaves
  teaTable: false,      // build a tea table and jasmine patch for Harmony
  woodReserve: 15,      // chop more trees when wood falls below this
  stoneReserve: 10,     // mine more stone when it falls below this
  huntPrey: false,      // hunt wild grazers for meat when food runs low
  researchFocus: 'balanced', // which branch of the research tree comes first
};
const GENE_LIMITS = {
  wallDay: [1.5, 99], traps: [0, 8], fightHealth: [15, 70], farmPerColonist: [2, 9],
  mealReserve: [1, 4], woodReserve: [10, 80], stoneReserve: [10, 90],
};
function describeGenome(g) {
  return [
    g.wallDay >= 99 && !g.wallAfterRaid ? 'Trust the open valley: no walls' : `Wall the camp ${g.wallAfterRaid ? 'after the first raid' : ''}${g.wallAfterRaid && g.wallDay < 99 ? ' or ' : ''}${g.wallDay < 99 ? `by day ${g.wallDay.toFixed(1)}` : ''}`,
    g.traps ? `Keep ${g.traps} spike traps outside the gates` : 'No traps',
    g.fightHealth <= 15 ? 'Fight until they drop' : `Fall back when health drops below ${g.fightHealth}`,
    g.medic ? 'A medic leaves the fight to save the bleeding' : 'Everyone fights; nobody tends wounds mid-battle',
    g.huntEager ? 'Hunt the platypus-bear on sight' : 'Hunt the platypus-bear only when hungry and healthy',
    `Farm ${g.farmPerColonist} cabbage tiles per colonist; keep ${g.mealReserve * 2} meals each`,
    g.waterFirst ? 'Drop everything to water crops in a heatwave' : 'Water crops when there is time',
    g.teaTable ? 'Build a tea table and grow jasmine' : 'No time for tea',
    `Restock below ${g.woodReserve} wood and ${g.stoneReserve} stone`,
    g.huntPrey ? 'Hunt wild grazers for meat when food runs low' : 'Leave the wild grazers alone',
    `Research focus: ${g.researchFocus}`,
  ];
}
function newStats() {
  return { downedInCombat: 0, bledOut: 0, breaks: 0, withered: 0, hungryTime: 0, matWait: 0, bearInjuries: 0,
    deaths: { raid: 0, bear: 0, starvation: 0, wounds: 0 }, peak: 4, tameFails: 0, livestockLost: 0, cropsEaten: 0 };
}
function ringCompletion(G) {
  let need = 0, done = 0;
  for (const [x, y] of ringTiles()) {
    const i = idx(x, y);
    if (G.terrain[i] === T.WATER || G.terrain[i] === T.STONE) continue;
    need++; const s = G.struct[i];
    if (s && s.built && (s.type === 'wall' || s.type === 'door')) done++;
  }
  return need ? done / need : 1;
}
function chronicle(G) {
  const st = G.stats, d = st.deaths;
  const fell = Object.entries(d).sort((a, b) => b[1] - a[1])[0];
  const cause = fell[1] === 0 ? 'unknown' : fell[0];
  return { gen: G.gen, days: +(G.time / DAY_LEN).toFixed(2), cause, raids: G.raidsSeen, era: eraOf(G), techs: G.tech.size, ring: +ringCompletion(G).toFixed(2), stats: JSON.parse(JSON.stringify(st)), genome: { ...G.genome } };
}
const CAUSE_TEXT = { raid: 'raiders', bear: 'wild beasts', starvation: 'starvation', wounds: 'untreated wounds', unknown: 'misfortune' };
function learnFromFall(mem, rec, rand) {
  mem.history.push(rec);
  if (!mem.best || rec.days > mem.best.days) mem.best = { days: rec.days, genome: { ...rec.genome }, gen: rec.gen };
  // A colony that did far worse than the best one goes back to the best habits before adding its own lessons.
  const regress = mem.best && mem.best.gen !== rec.gen && rec.days < mem.best.days * 0.7;
  const g = { ...(regress ? mem.best.genome : rec.genome) };
  const st = rec.stats, lessons = [];
  if (regress) lessons.push(`Generation ${rec.gen} did worse than generation ${mem.best.gen}, so its habits return as the starting point.`);
  const raidLosses = st.deaths.raid + (st.downedInCombat >= 3 ? 1 : 0);
  if (raidLosses > 0) {
    if (rec.ring < 0.8) {
      const day = Math.max(1.5, Math.min(g.wallDay, rec.days * 0.5));
      if (day < g.wallDay - 0.05 || !g.wallAfterRaid) { g.wallDay = +day.toFixed(1); g.wallAfterRaid = true; lessons.push(`The wall was only ${Math.round(rec.ring * 100)}% built when raiders struck. Start walling after the first raid, or by day ${g.wallDay}.`); }
    }
    if (g.traps < 8) { g.traps += 2; lessons.push(`Raiders walked straight in. Keep ${g.traps} spike traps outside the gates.`); }
  }
  if (st.downedInCombat >= 2 && g.fightHealth < 60) { g.fightHealth += 10; lessons.push(`Colonists were downed ${st.downedInCombat} times fighting to the last. Fall back below ${g.fightHealth} health.`); }
  if (st.bledOut > 0 && !g.medic) { g.medic = true; lessons.push(`${st.bledOut} bled out while everyone kept fighting. One colonist must act as medic.`); }
  if ((st.deaths.bear > 0 || st.bearInjuries >= 3) && g.huntEager) { g.huntEager = false; lessons.push('The platypus-bear mauled the hunters. Only hunt it when hungry and healthy.'); }
  if (st.deaths.starvation > 0 || st.hungryTime > 60) {
    g.farmPerColonist = Math.min(9, g.farmPerColonist + 2); g.mealReserve = Math.min(4, g.mealReserve + 1);
    lessons.push(`Hunger gnawed at the colony. Farm ${g.farmPerColonist} tiles per colonist and keep more meals cooked.`);
  }
  if (st.withered >= 3 && !g.waterFirst) { g.waterFirst = true; lessons.push(`${st.withered} crops withered in the heat. Water first during heatwaves.`); }
  if (st.breaks >= 2 && !g.teaTable) { g.teaTable = true; lessons.push(`${st.breaks} mental breaks tore the colony apart. Build a tea table and grow jasmine.`); }
  if (st.matWait > 60) {
    g.woodReserve = Math.min(80, g.woodReserve + 15); g.stoneReserve = Math.min(90, g.stoneReserve + 15);
    lessons.push(`Builders stood idle waiting for materials. Restock below ${g.woodReserve} wood and ${g.stoneReserve} stone.`);
  }
  const focus = { raid: 'military', starvation: 'farming', wounds: 'medicine', bear: 'military' }[rec.cause] || (st.breaks >= 3 ? 'comfort' : null);
  if (focus && g.researchFocus !== focus) { g.researchFocus = focus; lessons.push(`Our scholars studied the wrong things. Research ${focus} first.`); }
  if ((st.deaths.starvation > 0 || st.hungryTime > 60 || st.cropsEaten >= 6) && !g.huntPrey) { g.huntPrey = true; lessons.push(`${st.cropsEaten} crops were eaten by wild animals and food ran short. Hunt grazers for meat.`); }
  if (!lessons.length || (lessons.length === 1 && regress)) lessons.push('No clear mistake this time. The colony keeps its habits.');
  // One experiment: a small random change, which may well be a mistake.
  let experiment = null;
  if (rand() < 0.6) {
    const keys = Object.keys(GENE_LIMITS).filter((k) => !(k === 'wallDay' && g.wallDay >= 99));
    const k = keys[Math.floor(rand() * keys.length)];
    const step = { wallDay: 1, traps: 2, fightHealth: 10, farmPerColonist: 1, mealReserve: 1, woodReserve: 10, stoneReserve: 10 }[k];
    const [lo, hi] = GENE_LIMITS[k];
    const before = g[k];
    g[k] = clamp(+(g[k] + (rand() < 0.5 ? -step : step)).toFixed(1), lo, hi);
    if (g[k] !== before) experiment = `Experiment: ${k.replace(/([A-Z])/g, ' $1').toLowerCase()} ${before} → ${g[k]}.`;
  } else if (rand() < 0.25) {
    const flips = ['huntEager', 'waterFirst', 'teaTable', 'huntPrey'];
    const k = flips[Math.floor(rand() * flips.length)];
    g[k] = !g[k];
    experiment = `Experiment: ${k.replace(/([A-Z])/g, ' $1').toLowerCase()} is now ${g[k] ? 'on' : 'off'}.`;
  }
  mem.gen = rec.gen + 1;
  mem.genome = g;
  rec.lessons = lessons; rec.experiment = experiment;
  return rec;
}
const LINEAGE_KEY = 'four-nations-colony-lineage-v1';
function newMemory() { return { gen: 1, genome: { ...NAIVE_GENOME }, history: [], best: null }; }
function loadMemory() {
  try {
    const raw = window.localStorage.getItem(LINEAGE_KEY);
    if (raw) { const m = JSON.parse(raw); if (m && m.genome && Array.isArray(m.history)) return { ...m, genome: { ...NAIVE_GENOME, ...m.genome } }; }
  } catch (e) { /* storage unavailable: start fresh */ }
  return newMemory();
}
function saveMemory(mem) { try { window.localStorage.setItem(LINEAGE_KEY, JSON.stringify(mem)); } catch (e) { /* ignore */ } }

// ============================================================================
// World generation
// ============================================================================
function createGame(seed, genome = NAIVE_GENOME, gen = 1, lastRec = null) {
  const r = mulberry(seed);
  const N = W * H;
  const G = {
    seed, rand: r, time: 0, speed: 0, nextId: 1,
    terrain: new Uint8Array(N), shade: new Float32Array(N), tree: new Float32Array(N), forage: new Float32Array(N),
    struct: new Array(N).fill(null), items: new Array(N).fill(null), plants: new Array(N).fill(null),
    zone: new Array(N).fill(null), desig: new Array(N).fill(null),
    res: new Map(), pawns: [], enemies: [], proj: [], parts: [], floats: [],
    log: [], banner: null, ev: { fullmoon: 0, heatwave: 0 }, raid: null,
    nextEvent: 80, eventCount: 0, lastRaid: -999, lastMoon: -999, wandererJoined: false, edgeSpawns: [],
    cam: { x: 0, y: 0, zoom: 1.2 }, view: { w: 800, h: 600, dpr: 1 },
    tool: 'select', selected: null, hover: null, drag: null, ptr: null,
    terrainDirty: true, over: false, witherLogT: 0,
    freeWill: true, dirT: 2, planLog: {}, raidsSeen: 0,
    genome: { ...NAIVE_GENOME, ...genome }, gen, stats: newStats(), learned: false, restartIn: 0, report: null,
    tech: new Set(), research: { target: null, progress: 0 }, ecoT: 0, pendingRaid: 0,
  };
  const elev = fbm(r), moist = fbm(r);
  const cx = 20, cy = 20;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y);
    const d = Math.hypot(x - cx, y - cy) / 20;
    const e = elev(x / W, y / H) + d * 0.16 - 0.05;
    const m = moist(x / W, y / H);
    let t = T.GRASS;
    if (e > 0.62) t = T.STONE;
    else if (e < 0.27) t = T.WATER;
    else if (e < 0.3) t = T.SAND;
    else if (m > 0.66) t = T.SOIL;
    G.terrain[i] = t;
    G.shade[i] = (hash(i, 1) - 0.5) * 0.12;
    if (t === T.GRASS && r() < (m > 0.48 ? 0.13 : 0.045)) G.tree[i] = 1;
  }
  const countT = (t) => { let c = 0; for (let i = 0; i < N; i++) if (G.terrain[i] === t) c++; return c; };
  const stamp = (px, py, rad, t, ring) => {
    for (let y = py - rad - 1; y <= py + rad + 1; y++) for (let x = px - rad - 1; x <= px + rad + 1; x++) {
      if (!inB(x, y)) continue;
      const dd = Math.hypot(x - px, y - py);
      const i = idx(x, y);
      if (dd <= rad) { G.terrain[i] = t; G.tree[i] = 0; } else if (ring !== undefined && dd <= rad + 1.2 && G.terrain[i] !== t) { G.terrain[i] = ring; G.tree[i] = 0; }
    }
  };
  const farSpot = () => {
    for (let k = 0; k < 50; k++) {
      const x = 4 + Math.floor(r() * (W - 8)), y = 4 + Math.floor(r() * (H - 8));
      if (Math.hypot(x - cx, y - cy) > 10) return [x, y];
    }
    return [6, 6];
  };
  if (countT(T.WATER) < 18) { const [x, y] = farSpot(); stamp(x, y, 2.6, T.WATER, T.SAND); }
  if (countT(T.STONE) < 45) { for (let k = 0; k < 3; k++) { const [x, y] = farSpot(); stamp(x, y, 2.2, T.STONE); } }
  // Clear a homestead in the middle.
  for (let y = cy - 6; y <= cy + 6; y++) for (let x = cx - 7; x <= cx + 7; x++) {
    const i = idx(x, y);
    if (G.terrain[i] === T.WATER || G.terrain[i] === T.STONE || G.terrain[i] === T.SAND) G.terrain[i] = T.GRASS;
    G.tree[i] = 0;
  }
  // A guaranteed patch of fertile soil next to camp.
  for (let y = cy + 2; y <= cy + 5; y++) for (let x = cx + 2; x <= cx + 6; x++) G.terrain[idx(x, y)] = T.SOIL;
  // A small stone outcrop near camp so mining is possible early.
  stamp(cx - 6, cy - 5, 1.3, T.STONE);
  // Edge spawn points reachable from the colony.
  const flood = () => {
    const seen = new Uint8Array(N); const q = [idx(cx, cy)]; seen[q[0]] = 1;
    while (q.length) {
      const i = q.pop(); const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue;
        const n = idx(nx, ny);
        if (seen[n] || G.terrain[n] === T.WATER || G.terrain[n] === T.STONE || G.tree[n]) continue;
        seen[n] = 1; q.push(n);
      }
    }
    const out = [];
    for (let i = 0; i < N; i++) {
      const x = i % W, y = (i / W) | 0;
      if (seen[i] && (x === 0 || y === 0 || x === W - 1 || y === H - 1)) out.push([x, y]);
    }
    return out;
  };
  G.edgeSpawns = flood();
  if (G.edgeSpawns.length < 6) {
    for (let x = 0; x <= cx; x++) for (let y = cy - 1; y <= cy + 1; y++) { const i = idx(x, y); G.terrain[i] = T.GRASS; G.tree[i] = 0; }
    for (let y = 0; y <= cy; y++) for (let x = cx - 1; x <= cx + 1; x++) { const i = idx(x, y); G.terrain[i] = T.GRASS; G.tree[i] = 0; }
    G.edgeSpawns = flood();
  }

  // Starting colony.
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 6; x <= cx - 3; x++) G.zone[idx(x, y)] = 'stock';
  addItem(G, idx(cx - 6, cy - 1), 'wood', 40);
  addItem(G, idx(cx - 5, cy - 1), 'wood', 30);
  addItem(G, idx(cx - 4, cy - 1), 'stone', 25);
  addItem(G, idx(cx - 6, cy), 'cabbage', 30);
  addItem(G, idx(cx - 5, cy), 'meal', 10);
  addItem(G, idx(cx - 4, cy), 'tea', 6);
  for (let y = cy + 3; y <= cy + 4; y++) for (let x = cx + 2; x <= cx + 5; x++) G.zone[idx(x, y)] = 'cabbage';
  G.struct[idx(cx, cy + 2)] = { type: 'campfire', built: true, delivered: 4, progress: 0, hp: STRUCTS.campfire.hp, fuel: 70, decon: false };
  const crew = [['earth', 'Kanto'], ['water', 'Yuka'], ['fire', 'Ren'], ['air', 'Tashi']];
  crew.forEach(([el, name], k) => G.pawns.push(makeColonist(G, el, name, cx - 1 + (k % 2) * 2, cy - 1 + Math.floor(k / 2) * 2)));
  for (let i = 0; i < N; i++) G.forage[i] = G.terrain[i] === T.GRASS ? 1 : G.terrain[i] === T.SOIL ? 0.6 : 0;
  // Wildlife: a small food web of grazers and one predator.
  for (const [sp, n] of [['duck', 5], ['chicken', 4], ['sheep', 4], ['hog', 3], ['ostrich', 2], ['yak', 2], ['lion', 1]]) {
    for (let k = 0; k < n; k++) {
      const spot = randomWildSpot(G, sp === 'lion' ? 13 : 9, sp === 'duck');
      if (spot) G.enemies.push(makeAnimal(G, sp, spot[0], spot[1], false));
    }
  }
  G.cam.x = cx * TS; G.cam.y = cy * TS; // centred properly once the view size is known
  G.camCentered = false;
  if (gen === 1) log(G, 'Four benders have settled a quiet valley. They have no idea what is coming.', 'iroh');
  else {
    log(G, `Generation ${gen} settles a new valley, carrying the memory of those before them.`, 'iroh');
    if (lastRec) for (const l of [...lastRec.lessons, ...(lastRec.experiment ? [lastRec.experiment] : [])].reverse()) log(G, l, 'plan', '#c4b5fd');
  }
  return G;
}

function makeColonist(G, el, name, x, y) {
  return {
    id: G.nextId++, kind: 'colonist', el, name, x: x + 0.5, y: y + 0.5, path: null, job: null,
    chi: 80 + G.rand() * 20, hunger: 70 + G.rand() * 25, rest: 75 + G.rand() * 20, harmony: 62,
    thoughts: [], sit: [], injuries: [], health: 100, downed: false, dead: false,
    carrying: null, carriedBy: null, inBed: -1, bed: -1, sleeping: false, mental: null, breakT: 0,
    atkCd: 0, think: G.rand() * 0.3, facing: Math.PI / 2, lastTea: -999, hitFlash: 0, walk: 0,
    backstory: BACKSTORIES[el], lastHeal: -999,
  };
}

// ============================================================================
// Log, banner, particles, floating text
// ============================================================================
function log(G, text, who = 'info', color) {
  G.log.unshift({ day: dayOf(G), clock: clockStr(G), text, who, color, id: Math.random() });
  if (G.log.length > 40) G.log.length = 40;
}
function banner(G, title, text, who) { G.banner = { title, text, who, t: 7 }; log(G, `${title}: ${text}`, who); }
function floatText(G, x, y, text, color) { G.floats.push({ x, y, text, color, t: 1.3 }); }

function emit(G, x, y, n, kind) {
  for (let k = 0; k < n; k++) {
    if (G.parts.length > 700) G.parts.shift();
    const a = G.rand() * Math.PI * 2, s = G.rand();
    const P = { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6 + G.rand() * 0.6, max: 1, size: 2, color: '#fff', g: 0, kind };
    switch (kind) {
      case 'dust': P.color = G.rand() < 0.5 ? '#b49b74' : '#8f8170'; P.size = 3 + G.rand() * 4; P.vx *= 1.6; P.vy *= 1.6; P.g = -0.2; break;
      case 'splash': P.color = G.rand() < 0.5 ? '#7cc6ff' : '#d4f0ff'; P.size = 1.5 + G.rand() * 2.5; P.vx *= 2.6; P.vy = P.vy * 2 - 2.2; P.g = 6; P.life = 0.5 + G.rand() * 0.3; break;
      case 'ember': P.color = ['#ffcc4d', '#ff8a2a', '#ff4d1f'][Math.floor(G.rand() * 3)]; P.size = 1.5 + G.rand() * 2; P.vx *= 1.2; P.vy = -0.8 - G.rand() * 1.5; P.g = -0.4; break;
      case 'air': P.color = 'rgba(240,248,255,0.9)'; P.size = 3 + G.rand() * 3; P.vx *= 3; P.vy *= 3; P.life = 0.35 + G.rand() * 0.3; break;
      case 'sand': P.color = G.rand() < 0.5 ? '#e0c48a' : '#c2a066'; P.size = 1.5 + G.rand() * 2; P.vx *= 2; P.vy *= 2; break;
      case 'chi': P.color = '#ffb347'; P.size = 2; P.vx *= 3; P.vy *= 3; P.life = 0.35; break;
      case 'blood': P.color = '#a3201b'; P.size = 1.5 + G.rand() * 1.5; P.vx *= 1.5; P.vy = P.vy - 1; P.g = 5; P.life = 0.5; break;
      case 'steam': P.color = 'rgba(255,255,255,0.7)'; P.size = 2 + G.rand() * 2; P.vx *= 0.3; P.vy = -0.6; P.life = 1.2; break;
      case 'leaf': P.color = G.rand() < 0.5 ? '#6fb34a' : '#3f7d2c'; P.size = 2 + G.rand() * 2; P.vx *= 1.5; P.vy = -1; P.g = 2; break;
      case 'heal': P.color = '#9ff5e1'; P.size = 2 + G.rand() * 2; P.vx *= 0.6; P.vy = -0.9 - G.rand(); P.life = 1.0; break;
      default: break;
    }
    P.max = P.life; G.parts.push(P);
  }
}
function updateParticles(G, dt) {
  for (const P of G.parts) { P.vy += P.g * dt; P.x += P.vx * dt; P.y += P.vy * dt; P.life -= dt; }
  G.parts = G.parts.filter((P) => P.life > 0);
  for (const f of G.floats) { f.t -= dt; f.y -= dt * 0.6; }
  G.floats = G.floats.filter((f) => f.t > 0);
}

// ============================================================================
// Items, reservations, passability
// ============================================================================
function colPass(G, i) {
  const t = G.terrain[i];
  if (t === T.WATER || t === T.STONE || G.tree[i] >= 0.5) return false;
  const s = G.struct[i];
  return !(s && s.built && STRUCTS[s.type].solid);
}
const colCostFn = (G) => (x, y, i) => (colPass(G, i) ? (G.terrain[i] === T.SAND ? 1.3 : 1) : Infinity);
function enemyBlocked(G, i) { const s = G.struct[i]; return !!(s && s.built && (STRUCTS[s.type].solid || s.type === 'door')); }
const enemyCostFn = (G) => (x, y, i) => {
  const t = G.terrain[i];
  if (t === T.WATER || t === T.STONE || G.tree[i] >= 0.5) return Infinity;
  const s = G.struct[i];
  if (s && s.built) { if (s.type === 'wall') return 14; if (s.type === 'door') return 7; if (STRUCTS[s.type].solid) return 9; }
  return 1;
};

function pathfind(G, sx, sy, goal, cost, maxCost = 300) {
  const N = W * H;
  if (!G._dist) { G._dist = new Float64Array(N); G._prev = new Int32Array(N); }
  const D = G._dist, P = G._prev;
  D.fill(Infinity); P.fill(-1);
  const s = idx(sx, sy); D[s] = 0;
  const h = new Heap(); h.push(s, 0);
  while (h.size) {
    const i = h.pop(); const d = h.lastP;
    if (d > D[i]) continue;
    const x = i % W, y = (i / W) | 0;
    const g = goal(x, y, i);
    if (g) {
      const path = []; let c = i;
      while (c !== s && c !== -1) { path.push({ x: c % W, y: (c / W) | 0 }); c = P[c]; }
      path.reverse();
      return { path, goal: g, x, y, cost: d };
    }
    if (d > maxCost) continue;
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue;
      const n = idx(nx, ny); const c = cost(nx, ny, n);
      if (c === Infinity) continue;
      if (dx && dy && (cost(x + dx, y, idx(x + dx, y)) > 3 || cost(x, y + dy, idx(x, y + dy)) > 3)) continue;
      const nd = d + c * (dx && dy ? 1.414 : 1);
      if (nd < D[n]) { D[n] = nd; P[n] = i; h.push(n, nd); }
    }
  }
  return null;
}

function addItem(G, i, type, qty) {
  const it = G.items[i];
  if (!it) { const add = Math.min(MAXSTACK, qty); G.items[i] = { type, qty: add }; return qty - add; }
  if (it.type === type) { const add = Math.min(MAXSTACK - it.qty, qty); it.qty += add; return qty - add; }
  return qty;
}
function canHold(G, i, type) {
  if (!colPass(G, i)) return false;
  const it = G.items[i];
  return !it || (it.type === type && it.qty < MAXSTACK);
}
function dropItem(G, x, y, type, qty) {
  for (let r = 0; r < 10 && qty > 0; r++) {
    for (let dy = -r; dy <= r && qty > 0; dy++) for (let dx = -r; dx <= r && qty > 0; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue;
      const i = idx(nx, ny);
      if (canHold(G, i, type)) qty = addItem(G, i, type, qty);
    }
  }
}
function takeItem(G, i, qty) {
  const it = G.items[i]; if (!it) return 0;
  const n = Math.min(qty, it.qty); it.qty -= n;
  if (it.qty <= 0) G.items[i] = null;
  return n;
}
function countItems(G, type) { let c = 0; for (const it of G.items) if (it && it.type === type) c += it.qty; return c; }

const reserve = (G, key, p) => G.res.set(key, p.id);
const isRes = (G, key, p) => { const v = G.res.get(key); return v !== undefined && v !== p.id; };
function releaseAll(G, p) { for (const [k, v] of G.res) if (v === p.id) G.res.delete(k); }

function countAvail(G, type, p) {
  let c = 0;
  for (let i = 0; i < G.items.length; i++) { const it = G.items[i]; if (it && it.type === type && !isRes(G, 'i' + i, p)) c += it.qty; }
  return c;
}
const fertile = (G, i) => G.terrain[i] === T.GRASS || G.terrain[i] === T.SOIL;
const pawnById = (G, id) => G.pawns.find((q) => q.id === id);
function bedOccupant(G, i) { return G.pawns.find((q) => !q.dead && q.inBed === i); }
function litCampfires(G) {
  const out = [];
  for (let i = 0; i < G.struct.length; i++) { const s = G.struct[i]; if (s && s.built && s.type === 'campfire' && s.fuel > 0) out.push(i); }
  return out;
}
function nearLitCampfire(G, p, r) {
  for (const i of G._lit || []) if (Math.hypot(i % W + 0.5 - p.x, ((i / W) | 0) + 0.5 - p.y) <= r) return true;
  return false;
}

// ============================================================================
// Thoughts, injuries, damage
// ============================================================================
function addThought(p, key, text, val, ttl) {
  const ex = p.thoughts.find((t) => t.key === key);
  if (ex) { ex.ttl = ttl; ex.val = val; ex.text = text; return; }
  p.thoughts.push({ key, text, val, ttl });
}
function healthOf(p) { return Math.max(0, 100 - p.injuries.reduce((s, j) => s + j.sev, 0)); }

function hurt(G, p, dmg, type, src = 'raid') {
  if (p.dead) return;
  p.lastHarm = src;
  if (src === 'bear') G.stats.bearInjuries++;
  const bleeding = (type === 'Cut' || type === 'Claw wound') && dmg >= 5;
  const same = p.injuries.find((j) => j.type === type && !j.tended);
  if (same && p.injuries.length >= 5) { same.sev += dmg; same.bleeding = same.bleeding || bleeding; }
  else p.injuries.push({ type, sev: dmg, bleeding, tended: false });
  // A single blow never kills outright: it downs the colonist, who then bleeds out unless rescued.
  const over = 3 - healthOf(p);
  if (over > 0) { const j = p.injuries.find((x) => x.type === type && x.sev > over) || p.injuries[p.injuries.length - 1]; j.sev = Math.max(0, j.sev - over); }
  p.hitFlash = 0.25;
  floatText(G, p.x, p.y - 0.6, `-${Math.round(dmg)}`, '#ff6b5e');
  if (bleeding) emit(G, p.x, p.y, 5, 'blood');
  if (p.sleeping) { const wasBed = p.inBed; abortJob(G, p); p.inBed = p.downed ? wasBed : -1; }
}

function damageEnemy(G, e, dmg, src) {
  if (e.dead) return;
  e.hp -= dmg; e.hitFlash = 0.2;
  floatText(G, e.x, e.y - 0.6, `-${Math.round(dmg)}`, '#ffd166');
  if (e.faction === 'animal') {
    const S = SPECIES[e.type];
    if (S.diet === 'herb' && !S.fightsBack) { e.fleeT = 6; e.fleeFrom = src || null; }
    else if (src && src.kind === 'colonist' && !e.tame) {
      if (!e.provoked && (e.type === 'bear' || e.type === 'lion')) log(G, `The ${S.name} roars and charges!`, 'azula');
      e.provoked = true; e.calm = 40; e.aggro = src;
    }
  }
  if (e.hp <= 0) killEnemy(G, e, src);
}
function killEnemy(G, e, src) {
  e.dead = true;
  const [x, y] = tileOf(e);
  emit(G, e.x, e.y, 12, 'dust');
  if (e.faction === 'animal') {
    const S = SPECIES[e.type];
    releaseAll(G, e);
    if (e.carrying) { dropItem(G, x, y, e.carrying.type, e.carrying.qty); e.carrying = null; }
    if (e.tame) { G.stats.livestockLost++; log(G, `The tamed ${S.name} was killed${src && src.faction === 'animal' ? ` by a ${src.name}` : ''}.`, 'azula'); }
    if (src && src.faction === 'animal') return; // eaten by the predator
    const meat = Math.max(1, Math.round(S.meat * (e.age < 1 ? 0.5 : 1)));
    dropItem(G, x, y, 'meat', meat);
    if (e.type === 'bear' || e.type === 'lion') {
      log(G, `The ${S.name} has been brought down. It left ${meat} raw meat.`, 'info');
      for (const p of G.pawns) if (!p.dead) addThought(p, 'beast', `Survived the ${S.name}`, 5, 150);
    }
  } else {
    if (G.rand() < 0.5) dropItem(G, x, y, G.rand() < 0.5 ? 'wood' : 'stone', 4 + Math.floor(G.rand() * 5));
  }
}
function damageStruct(G, i, dmg) {
  const s = G.struct[i]; if (!s) return;
  s.hp -= dmg;
  const x = i % W, y = (i / W) | 0;
  emit(G, x + 0.5, y + 0.5, 3, 'dust');
  if (s.hp <= 0) {
    G.struct[i] = null;
    emit(G, x + 0.5, y + 0.5, 14, 'dust');
    log(G, `${STRUCTS[s.type].name} at (${x},${y}) was destroyed.`, 'azula');
  }
}

function completeStruct(G, i) {
  const s = G.struct[i];
  const def = STRUCTS[s.type];
  s.built = true; s.hp = structMaxHp(G, s); s.maxHp = s.hp; s.progress = 0;
  if (s.type === 'campfire') s.fuel = 60;
  const x = i % W, y = (i / W) | 0;
  G.plants[i] = null;
  if (def.solid) {
    const it = G.items[i];
    if (it) { G.items[i] = null; dropItem(G, x, y, it.type, it.qty); }
    for (const e of [...G.pawns, ...G.enemies]) {
      if (e.dead) continue;
      const [ex, ey] = tileOf(e);
      if (ex === x && ey === y) {
        for (const [dx, dy] of DIRS8) {
          const nx = x + dx, ny = y + dy;
          if (inB(nx, ny) && colPass(G, idx(nx, ny))) { e.x = nx + 0.5; e.y = ny + 0.5; e.path = null; break; }
        }
      }
    }
  }
}

// ============================================================================
// Colonist job system
// ============================================================================
function speedOf(G, p) {
  let s = 2.5;
  if (hasTech(G, 'satomobile')) s *= 1.3;
  if (p.el === 'air') s *= 2.5;
  if (p.el === 'water' && G.ev.fullmoon > 0) s *= 1.5;
  if (p.health < 50) s *= 0.7;
  if (p.carrying && p.carrying.pawn !== undefined) s *= 0.7;
  return s;
}
function workSpeed(G, p, kind, stype) {
  let m = 1;
  if (p.el === 'earth' && (kind === 'mine' || kind === 'build' || kind === 'decon')) m *= 2.2;
  if (p.el === 'earth' && kind === 'mine' && hasTech(G, 'metalbending')) m *= 1.5;
  if (p.el === 'none' && (kind === 'build' || kind === 'chop' || kind === 'decon')) m *= stype === 'trap' ? 3 : 1.5;
  if (p.el === 'fire' && kind === 'cook') m *= 3;
  if (p.el === 'water' && (kind === 'tend' || kind === 'plant' || kind === 'harvest')) m *= 1.6;
  if (p.el === 'air' && (kind === 'harvest' || kind === 'plant')) m *= 1.3;
  if (p.health < 50) m *= 0.7;
  if (p.harmony > 80) m *= 1.15;
  return m;
}
const carryCap = (G, p) => (p.el === 'air' ? 75 : 25) * (hasTech(G, 'wheel') ? 1.5 : 1);
const hasChi = (G, p, n) => (p.el === 'water' && G.ev.fullmoon > 0) || p.chi >= n;
const spendChi = (G, p, n) => { if (!(p.el === 'water' && G.ev.fullmoon > 0)) p.chi = Math.max(0, p.chi - n); };

function seek(G, p, goal, max = 260) { const [x, y] = tileOf(p); return pathfind(G, x, y, goal, colCostFn(G), max); }
function adjGoal(test) {
  return (x, y) => {
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy; if (!inB(nx, ny)) continue;
      const n = idx(nx, ny); if (test(n, nx, ny)) return { t: n };
    }
    return null;
  };
}
const nearGoal = (tx, ty, r) => (x, y) => (Math.max(Math.abs(x - tx), Math.abs(y - ty)) <= r ? { t: idx(tx, ty) } : null);

function move(G, p, dt) {
  if (!p.path || p.path.length === 0) return 'arrived';
  const n = p.path[0]; const ni = idx(n.x, n.y);
  if (!colPass(G, ni)) { p.path = null; return 'blocked'; }
  const tx = n.x + 0.5, ty = n.y + 0.5, dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
  let sp = speedOf(G, p) * dt; if (G.terrain[ni] === T.SAND) sp *= 0.8;
  if (d <= sp) { p.x = tx; p.y = ty; p.path.shift(); } else { p.x += (dx / d) * sp; p.y += (dy / d) * sp; }
  if (d > 0.001) p.facing = Math.atan2(dy, dx);
  p.walk += sp;
  if (p.el === 'air' && G.rand() < dt * 6) emit(G, p.x, p.y + 0.2, 1, 'air');
  return p.path.length === 0 ? 'arrived' : 'moving';
}

function abortJob(G, p) {
  releaseAll(G, p);
  if (p.carrying) {
    if (p.carrying.pawn !== undefined) {
      const q = pawnById(G, p.carrying.pawn);
      if (q) { q.carriedBy = null; q.x = Math.floor(p.x) + 0.5; q.y = Math.floor(p.y) + 0.5; }
    } else if (p.carrying.type !== 'water') {
      const [x, y] = tileOf(p); dropItem(G, x, y, p.carrying.type, p.carrying.qty);
    }
    p.carrying = null;
  }
  if (p.sleeping) { p.sleeping = false; if (!p.downed) p.inBed = -1; }
  p.job = null; p.path = null;
}

// ---------------------------------------------------------------- finders
function jobEat(G, p) {
  const want = (types) => seek(G, p, (x, y, i) => { const it = G.items[i]; return it && types.includes(it.type) && !isRes(G, 'i' + i, p) ? { t: i } : null; });
  const r = want(['meal', 'milk']) || want(['cabbage', 'egg', 'meat']);
  if (!r) return null;
  reserve(G, 'i' + r.goal.t, p);
  return { type: 'eat', t: r.goal.t, path: r.path, stage: 'go', label: 'Going to eat' };
}
function jobSleep(G, p) {
  let bed = -1;
  const own = p.bed >= 0 && G.struct[p.bed] && G.struct[p.bed].built && G.struct[p.bed].type === 'bed' && G.struct[p.bed].owner === p.id;
  if (own) { const occ = bedOccupant(G, p.bed); if (!occ || occ === p) bed = p.bed; }
  let r = null;
  if (bed >= 0) r = seek(G, p, (x, y, i) => (i === bed ? { t: i } : null), 400);
  if (!r) {
    r = seek(G, p, (x, y, i) => {
      const s = G.struct[i];
      if (!s || !s.built || s.type !== 'bed' || isRes(G, 'bed' + i, p)) return null;
      const owner = s.owner && pawnById(G, s.owner);
      if (owner && owner !== p && !owner.dead) return null;
      if (bedOccupant(G, i)) return null;
      return { t: i };
    }, 400);
    if (r) { if (p.bed >= 0 && G.struct[p.bed] && G.struct[p.bed].owner === p.id) G.struct[p.bed].owner = null; p.bed = r.goal.t; G.struct[r.goal.t].owner = p.id; }
  }
  if (r) { reserve(G, 'bed' + r.goal.t, p); return { type: 'sleep', bed: r.goal.t, path: r.path, stage: 'go', label: 'Going to bed' }; }
  return { type: 'sleep', bed: -1, path: [], stage: 'go', label: 'Sleeping on the ground' };
}
function freeBeds(G, p) {
  const out = [];
  for (let i = 0; i < G.struct.length; i++) {
    const s = G.struct[i];
    if (s && s.built && s.type === 'bed' && !bedOccupant(G, i) && !isRes(G, 'bed' + i, p)) out.push(i);
  }
  return out;
}
function jobRescue(G, p) {
  const victims = G.pawns.filter((q) => q !== p && !q.dead && q.downed && !q.carriedBy && q.inBed < 0 && !isRes(G, 'r' + q.id, p));
  if (!victims.length) return null;
  const beds = freeBeds(G, p); if (!beds.length) return null;
  const r = seek(G, p, (x, y) => victims.find((q) => tileOf(q)[0] === x && tileOf(q)[1] === y) || null, 400);
  if (!r) return null;
  const q = r.goal;
  beds.sort((a, b) => Math.hypot(a % W - q.x, ((a / W) | 0) - q.y) - Math.hypot(b % W - q.x, ((b / W) | 0) - q.y));
  reserve(G, 'r' + q.id, p); reserve(G, 'bed' + beds[0], p);
  return { type: 'rescue', patient: q.id, bed: beds[0], path: r.path, stage: 'go', label: `Rescuing ${q.name}` };
}
function needsTend(G, p, q) {
  if (q.dead || q.carriedBy) return false;
  if (!(q.downed || q.inBed >= 0 || q === p)) return false;
  if (q === p && p.downed) return false;
  if (q.injuries.some((j) => !j.tended && j.type !== 'Malnutrition')) return true;
  return p.el === 'water' && q.health < 75 && G.time - q.lastHeal > 25 && hasChi(G, p, 20);
}
function jobTend(G, p) {
  const pats = G.pawns.filter((q) => needsTend(G, p, q) && !isRes(G, 't' + q.id, p));
  if (!pats.length) return null;
  pats.sort((a, b) => (b.injuries.some((j) => j.bleeding) ? 1 : 0) - (a.injuries.some((j) => j.bleeding) ? 1 : 0));
  for (const q of pats) {
    const [qx, qy] = tileOf(q);
    const r = q === p ? { path: [] } : seek(G, p, nearGoal(qx, qy, 1), 400);
    if (r) { reserve(G, 't' + q.id, p); return { type: 'tend', patient: q.id, path: r.path, stage: 'go', work: 0, label: q === p ? 'Tending own wounds' : `Tending ${q.name}` }; }
  }
  return null;
}
function jobTea(G, p) {
  if (G.time - p.lastTea < 50) return null;
  const tables = [];
  for (let i = 0; i < G.struct.length; i++) { const s = G.struct[i]; if (s && s.built && s.type === 'teatable') tables.push(i); }
  if (!tables.length) return null;
  const tr = seek(G, p, adjGoal((n) => tables.includes(n)), 300);
  if (!tr) return null;
  const table = tr.goal.t;
  const ti = seek(G, p, (x, y, i) => { const it = G.items[i]; return it && it.type === 'tea' && !isRes(G, 'i' + i, p) ? { t: i } : null; }, 300);
  if (ti) { reserve(G, 'i' + ti.goal.t, p); return { type: 'tea', table, item: ti.goal.t, path: ti.path, stage: 'fetch', label: 'Fetching jasmine tea' }; }
  return { type: 'tea', table, path: tr.path, stage: 'go', label: 'Chatting at the tea table' };
}
function nearestThreat(G, p, r) {
  let best = null, bd = r;
  for (const e of G.enemies) {
    if (!hostileToColony(G, e) || e.flee) continue;
    if (e.faction === 'animal' && !e.provoked) continue;
    const d = dist(p, e); if (d < bd) { bd = d; best = e; }
  }
  return best;
}
function jobRetreat(G, p) {
  const [x, y] = tileOf(p);
  const threats = G.enemies.filter((e) => hostileToColony(G, e) && !e.flee);
  let best = null, bs = -1;
  for (let k = 0; k < 18; k++) {
    const tx = clamp(x + Math.floor(G.rand() * 17) - 8, 0, W - 1), ty = clamp(y + Math.floor(G.rand() * 17) - 8, 0, H - 1);
    if (!colPass(G, idx(tx, ty))) continue;
    const sc = Math.min(...threats.map((e) => Math.hypot(e.x - tx - 0.5, e.y - ty - 0.5)), 99);
    if (sc > bs) { bs = sc; best = [tx, ty]; }
  }
  const r = best && seek(G, p, (a, b) => (a === best[0] && b === best[1] ? {} : null), 40);
  return { type: 'retreat', path: r ? r.path : [], stage: 'go', idle: 2, label: 'Retreating to safety' };
}
function jobWander(G, p) {
  const [x, y] = tileOf(p);
  for (let k = 0; k < 6; k++) {
    const tx = clamp(x + Math.floor(G.rand() * 11) - 5, 0, W - 1), ty = clamp(y + Math.floor(G.rand() * 11) - 5, 0, H - 1);
    if (!colPass(G, idx(tx, ty))) continue;
    const r = seek(G, p, (a, b) => (a === tx && b === ty ? {} : null), 18);
    if (r) return { type: 'wander', path: r.path, stage: 'go', idle: 1 + G.rand() * 2.5, label: 'Wandering' };
  }
  return { type: 'wander', path: [], stage: 'go', idle: 1.5, label: 'Idle' };
}

const WORK = {
  mine(G, p) {
    if (!G.desig.includes('mine')) return null;
    const r = seek(G, p, adjGoal((n) => G.desig[n] === 'mine' && G.terrain[n] === T.STONE && !isRes(G, 'w' + n, p)));
    if (!r) return null; reserve(G, 'w' + r.goal.t, p);
    return { type: 'mine', t: r.goal.t, path: r.path, stage: 'go', work: 0, need: 5, label: 'Mining stone' };
  },
  chop(G, p) {
    if (!G.desig.includes('chop')) return null;
    const r = seek(G, p, adjGoal((n) => G.desig[n] === 'chop' && G.tree[n] >= 1 && !isRes(G, 'w' + n, p)));
    if (!r) return null; reserve(G, 'w' + r.goal.t, p);
    return { type: 'chop', t: r.goal.t, path: r.path, stage: 'go', work: 0, need: 4, label: 'Chopping wood' };
  },
  build(G, p) {
    if (!G.struct.some((s) => s && !s.built)) return null;
    const avail = { stone: countAvail(G, 'stone', p), wood: countAvail(G, 'wood', p) };
    const ok = (n) => {
      const s = G.struct[n];
      if (!s || s.built || isRes(G, 'b' + n, p)) return false;
      const def = STRUCTS[s.type];
      return s.delivered >= def.cost || (p.el === 'earth' && s.type === 'wall' && p.chi >= wallChi(G)) || avail[def.mat] > 0;
    };
    const r = seek(G, p, adjGoal(ok)); if (!r) return null;
    const t = r.goal.t, s = G.struct[t], def = STRUCTS[s.type];
    reserve(G, 'b' + t, p);
    if (s.delivered >= def.cost) return { type: 'build', t, s, path: r.path, stage: 'go', work: 0, label: `Building ${def.name}` };
    if (p.el === 'earth' && s.type === 'wall' && p.chi >= wallChi(G)) return { type: 'build', t, s, path: r.path, stage: 'go', work: 0, chi: true, label: 'Earthbending a wall' };
    const ir = seek(G, p, (x, y, i) => { const it = G.items[i]; return it && it.type === def.mat && !isRes(G, 'i' + i, p) ? { t: i } : null; }, 400);
    if (!ir) { releaseAll(G, p); return null; }
    reserve(G, 'i' + ir.goal.t, p);
    return { type: 'build', t, s, item: ir.goal.t, path: ir.path, stage: 'fetch', work: 0, label: `Fetching ${ITEMS[def.mat].name.toLowerCase()}` };
  },
  decon(G, p) {
    if (!G.struct.some((s) => s && s.built && s.decon)) return null;
    const r = seek(G, p, adjGoal((n) => { const s = G.struct[n]; return s && s.built && s.decon && !isRes(G, 'b' + n, p); }));
    if (!r) return null; reserve(G, 'b' + r.goal.t, p);
    return { type: 'decon', t: r.goal.t, s: G.struct[r.goal.t], path: r.path, stage: 'go', work: 0, need: 2.5, label: 'Deconstructing' };
  },
  plant(G, p) {
    const r = seek(G, p, (x, y, i) => {
      const z = G.zone[i];
      return (z === 'cabbage' || z === 'tea') && !G.plants[i] && fertile(G, i) && !G.struct[i] && !G.items[i] && !isRes(G, 'p' + i, p) ? { t: i } : null;
    });
    if (!r) return null; reserve(G, 'p' + r.goal.t, p);
    return { type: 'plant', t: r.goal.t, path: r.path, stage: 'go', work: 0, need: 1.2, label: `Planting ${G.zone[r.goal.t] === 'tea' ? 'jasmine' : 'cabbage'}` };
  },
  harvest(G, p) {
    const r = seek(G, p, (x, y, i) => { const pl = G.plants[i]; return pl && pl.growth >= 1 && !isRes(G, 'p' + i, p) ? { t: i } : null; });
    if (!r) return null; reserve(G, 'p' + r.goal.t, p);
    return { type: 'harvest', t: r.goal.t, path: r.path, stage: 'go', work: 0, need: 1.5, label: 'Harvesting' };
  },
  water(G, p) {
    if (!G.plants.some((pl) => pl && pl.water < 0.35)) return null;
    const thirsty = (i) => { const pl = G.plants[i]; return pl && pl.water < 0.35 && !isRes(G, 'wa' + i, p); };
    if (p.el === 'water' && hasChi(G, p, 8)) {
      const r = seek(G, p, (x, y, i) => { for (const [dx, dy] of [[0, 0], ...DIRS8]) { const nx = x + dx, ny = y + dy; if (inB(nx, ny) && thirsty(idx(nx, ny))) return { t: idx(nx, ny) }; } return null; });
      if (!r) return null; reserve(G, 'wa' + r.goal.t, p);
      return { type: 'water', t: r.goal.t, path: r.path, stage: 'go', work: 0, bend: true, label: 'Waterbending the crops' };
    }
    let target = -1;
    for (let i = 0; i < G.plants.length; i++) if (thirsty(i)) { target = i; break; }
    if (target < 0) return null;
    const r = seek(G, p, (x, y) => { for (const [dx, dy] of DIRS4) { const nx = x + dx, ny = y + dy; if (inB(nx, ny) && G.terrain[idx(nx, ny)] === T.WATER) return {}; } return null; }, 400);
    if (!r) return null; reserve(G, 'wa' + target, p);
    return { type: 'water', t: target, path: r.path, stage: 'fetch', work: 0, label: 'Hauling water' };
  },
  cook(G, p) {
    const lit = G._lit || []; if (!lit.length) return null;
    const alive = G.pawns.filter((q) => !q.dead).length;
    if (countItems(G, 'meal') >= 4 + alive * 2 * G.genome.mealReserve) return null;
    const r = seek(G, p, (x, y, i) => { const it = G.items[i]; return it && ITEMS[it.type].raw && !isRes(G, 'i' + i, p) ? { t: i } : null; });
    if (!r) return null; reserve(G, 'i' + r.goal.t, p);
    return { type: 'cook', item: r.goal.t, path: r.path, stage: 'fetch', work: 0, label: 'Fetching ingredients' };
  },
  kindle(G, p) {
    const fires = [];
    for (let i = 0; i < G.struct.length; i++) { const s = G.struct[i]; if (s && s.built && s.type === 'campfire' && s.fuel < 35 && !isRes(G, 'k' + i, p)) fires.push(i); }
    if (!fires.length) return null;
    if (p.el === 'fire' && p.chi >= 15) {
      const r = seek(G, p, adjGoal((n) => fires.includes(n))); if (!r) return null;
      reserve(G, 'k' + r.goal.t, p);
      return { type: 'kindle', t: r.goal.t, path: r.path, stage: 'go', work: 0, bend: true, label: 'Firebending the campfire' };
    }
    if (countAvail(G, 'wood', p) < 2) return null;
    const ir = seek(G, p, (x, y, i) => { const it = G.items[i]; return it && it.type === 'wood' && !isRes(G, 'i' + i, p) ? { t: i } : null; });
    if (!ir) return null;
    reserve(G, 'i' + ir.goal.t, p); reserve(G, 'k' + fires[0], p);
    return { type: 'kindle', t: fires[0], item: ir.goal.t, path: ir.path, stage: 'fetch', work: 0, label: 'Fetching firewood' };
  },
  haul(G, p) {
    if (!G.zone.includes('stock')) return null;
    let anyEmpty = false; const acc = new Set();
    for (let i = 0; i < G.zone.length; i++) {
      if (G.zone[i] !== 'stock' || isRes(G, 'c' + i, p) || !colPass(G, i)) continue;
      const it = G.items[i];
      if (!it) anyEmpty = true; else if (it.qty < MAXSTACK) acc.add(it.type);
    }
    const r = seek(G, p, (x, y, i) => {
      const it = G.items[i];
      if (!it || G.zone[i] === 'stock' || isRes(G, 'i' + i, p)) return null;
      return anyEmpty || acc.has(it.type) ? { t: i } : null;
    });
    if (!r) return null; reserve(G, 'i' + r.goal.t, p);
    return { type: 'haul', item: r.goal.t, path: r.path, stage: 'go', label: `Hauling ${ITEMS[G.items[r.goal.t].type].name.toLowerCase()}` };
  },
};

function chooseJob(G, p) {
  let j;
  if (p.hunger < 30 && (j = jobEat(G, p))) return j;
  if (p.rest < 22 || (isNight(G) && p.rest < 80)) return jobSleep(G, p);
  if ((j = jobTend(G, p))) return j;
  if ((j = jobRescue(G, p))) return j;
  if (G.genome.waterFirst && G.ev.heatwave > 0 && (j = WORK.water(G, p))) return j;
  if (p.harmony < 55 && (j = jobTea(G, p))) return j;
  if (G.pendingRaid > 0 && homeDist(...tileOf(p)) > HOME.ring - 2) {
    const [x, y] = tileOf(p);
    const r = seek(G, p, (a, b) => (homeDist(a, b) <= HOME.ring - 3 ? {} : null), 200);
    if (r) return { type: 'wander', path: r.path, stage: 'go', idle: 2, label: 'Heading home: radio warning' };
    void x; void y;
  }
  for (const w of PRIORITIES[p.el]) if ((j = WORK[w](G, p))) return j;
  if (p.harmony < 72 && (j = jobTea(G, p))) return j;
  return jobWander(G, p);
}

// ---------------------------------------------------------------- runners
function runJob(G, p, dt) {
  const j = p.job;
  const done = () => abortJob(G, p);
  const walk = () => { const m = move(G, p, dt); if (m === 'blocked') { done(); return false; } return m === 'arrived'; };
  switch (j.type) {
    case 'eat': {
      if (j.stage === 'go') {
        if (!walk()) return;
        const it = G.items[j.t];
        if (!it || !ITEMS[it.type].food) return done();
        j.food = it.type; takeItem(G, j.t, 1); releaseAll(G, p);
        j.stage = 'eat'; j.time = 0; j.label = `Eating ${ITEMS[j.food].name.toLowerCase()}`;
      } else {
        j.time += dt;
        if (j.time >= 2.5) {
          p.hunger = Math.min(100, p.hunger + ITEMS[j.food].food);
          if (j.food === 'meal') addThought(p, 'meal', 'Ate a hearty meal', 5, 160);
          else addThought(p, 'raw', 'Ate raw food', -3, 120);
          done();
        }
      }
      return;
    }
    case 'sleep': {
      if (j.stage === 'go') {
        if (j.bed >= 0 && !(G.struct[j.bed] && G.struct[j.bed].built)) return done();
        if (!walk()) return;
        j.stage = 'sleep'; p.sleeping = true; p.inBed = j.bed; j.label = j.bed >= 0 ? 'Sleeping' : 'Sleeping on the ground';
      } else {
        if (p.inBed >= 0 && !(G.struct[p.inBed] && G.struct[p.inBed].built)) { p.inBed = -1; j.bed = -1; }
        if (G.rand() < dt * 0.6) floatText(G, p.x + 0.2, p.y - 0.5, 'z', '#c7d2fe');
        if (p.rest >= 99 || (!isNight(G) && p.rest > 70) || p.hunger < 12) {
          if (j.bed < 0) addThought(p, 'ground', 'Slept on the ground', -6, 170);
          else addThought(p, 'bed', 'Slept in a warm bed', 2, 120);
          done();
        }
      }
      return;
    }
    case 'rescue': {
      const q = pawnById(G, j.patient);
      if (!q || q.dead || !q.downed || (q.carriedBy && q.carriedBy !== p.id) || (j.stage === 'go' && q.inBed >= 0)) return done();
      if (!(G.struct[j.bed] && G.struct[j.bed].built)) return done();
      if (j.stage === 'go') {
        if (!walk()) return;
        q.carriedBy = p.id; p.carrying = { pawn: q.id };
        const r = seek(G, p, (x, y, i) => (i === j.bed ? {} : null), 500);
        if (!r) return done();
        p.path = r.path; j.stage = 'carry'; j.label = `Carrying ${q.name} to bed`;
      } else {
        const arrived = walk();
        q.x = p.x; q.y = p.y - 0.15;
        if (!arrived) return;
        q.carriedBy = null; q.inBed = j.bed; q.x = (j.bed % W) + 0.5; q.y = ((j.bed / W) | 0) + 0.5;
        p.carrying = null;
        log(G, `${p.name} carried ${q.name} to safety.`, 'info');
        done();
      }
      return;
    }
    case 'tend': {
      const q = pawnById(G, j.patient);
      if (!q || q.dead || q.carriedBy) return done();
      if (j.stage === 'go') {
        if (q !== p) { const [qx, qy] = tileOf(q); const [px, py] = tileOf(p); if (p.path && p.path.length === 0 && Math.max(Math.abs(qx - px), Math.abs(qy - py)) > 1) return done(); }
        if (!walk()) return;
        j.stage = 'work'; j.work = 0;
      } else {
        j.work += dt * workSpeed(G, p, 'tend');
        if (p.el === 'water' && G.rand() < dt * 8) emit(G, q.x, q.y, 1, 'heal');
        if (j.work >= 3.5) {
          for (const inj of q.injuries) { inj.bleeding = false; inj.tended = true; }
          if (p.el === 'water' && hasChi(G, p, 15)) {
            spendChi(G, p, 15);
            for (const inj of q.injuries) inj.sev *= 0.55;
            q.lastHeal = G.time;
            emit(G, q.x, q.y, 18, 'splash'); emit(G, q.x, q.y, 10, 'heal');
            addThought(q, 'healed', 'Soothed by healing water', 6, 150);
            floatText(G, q.x, q.y - 0.7, 'Healed', '#9ff5e1');
          } else floatText(G, q.x, q.y - 0.7, 'Tended', '#e5e7eb');
          done();
        }
      }
      return;
    }
    case 'mine': case 'chop': {
      const valid = j.type === 'mine' ? G.terrain[j.t] === T.STONE && G.desig[j.t] === 'mine' : G.tree[j.t] >= 1 && G.desig[j.t] === 'chop';
      if (!valid) return done();
      if (j.stage === 'go') { if (!walk()) return; j.stage = 'work'; }
      const tx = (j.t % W) + 0.5, ty = ((j.t / W) | 0) + 0.5;
      p.facing = Math.atan2(ty - p.y, tx - p.x);
      j.work += dt * workSpeed(G, p, j.type);
      if (G.rand() < dt * 5) emit(G, tx, ty, 1, j.type === 'mine' ? 'dust' : 'leaf');
      if (p.el === 'earth' && j.type === 'mine' && G.rand() < dt * 4) emit(G, tx, ty, 2, 'dust');
      if (j.work >= j.need) {
        const x = j.t % W, y = (j.t / W) | 0;
        G.desig[j.t] = null;
        if (j.type === 'mine') { G.terrain[j.t] = T.DIRT; G.terrainDirty = true; dropItem(G, x, y, 'stone', 6); emit(G, tx, ty, 14, 'dust'); }
        else { G.tree[j.t] = 0; dropItem(G, x, y, 'wood', 7); emit(G, tx, ty, 10, 'leaf'); }
        done();
      }
      return;
    }
    case 'build': {
      const s = G.struct[j.t];
      if (s !== j.s || s.built) return done();
      const def = STRUCTS[s.type];
      if (j.stage === 'fetch') {
        if (!walk()) return;
        const it = G.items[j.item];
        if (!it || it.type !== def.mat) return done();
        const qty = takeItem(G, j.item, Math.min(def.cost - s.delivered, carryCap(G, p)));
        p.carrying = { type: def.mat, qty };
        G.res.delete('i' + j.item);
        const r = seek(G, p, adjGoal((n) => n === j.t), 400);
        if (!r) return done();
        p.path = r.path; j.stage = 'go'; j.label = `Hauling ${ITEMS[def.mat].name.toLowerCase()} to blueprint`;
        return;
      }
      if (j.stage === 'go') {
        if (!walk()) return;
        if (p.carrying && p.carrying.type === def.mat) {
          const use = Math.min(p.carrying.qty, def.cost - s.delivered);
          s.delivered += use; p.carrying.qty -= use;
          if (p.carrying.qty <= 0) p.carrying = null;
        }
        if (!j.chi && s.delivered < def.cost) return done();
        if (j.chi && !hasChi(G, p, wallChi(G))) return done();
        j.stage = 'work'; j.label = j.chi ? 'Earthbending a wall' : `Building ${def.name}`;
      }
      const tx = (j.t % W) + 0.5, ty = ((j.t / W) | 0) + 0.5;
      p.facing = Math.atan2(ty - p.y, tx - p.x);
      const need = j.chi ? 0.7 : def.work;
      j.work += dt * (j.chi ? 1 : workSpeed(G, p, 'build', s.type));
      s.progress = j.work / need;
      if (G.rand() < dt * 4) emit(G, tx, ty, 1, 'dust');
      if (j.work >= need) {
        if (j.chi) { spendChi(G, p, wallChi(G)); emit(G, tx, ty, 26, 'dust'); floatText(G, tx, ty - 0.5, 'Earth wall!', '#9be29f'); }
        completeStruct(G, j.t);
        done();
      }
      return;
    }
    case 'decon': {
      const s = G.struct[j.t];
      if (s !== j.s || !s.built || !s.decon) return done();
      if (j.stage === 'go') { if (!walk()) return; j.stage = 'work'; }
      j.work += dt * workSpeed(G, p, 'decon');
      if (j.work >= j.need) {
        const def = STRUCTS[s.type];
        G.struct[j.t] = null;
        dropItem(G, j.t % W, (j.t / W) | 0, def.mat, Math.floor(def.cost / 2));
        emit(G, (j.t % W) + 0.5, ((j.t / W) | 0) + 0.5, 10, 'dust');
        done();
      }
      return;
    }
    case 'plant': case 'harvest': {
      const z = G.zone[j.t];
      if (j.type === 'plant' && (!(z === 'cabbage' || z === 'tea') || G.plants[j.t] || G.struct[j.t])) return done();
      if (j.type === 'harvest' && !(G.plants[j.t] && G.plants[j.t].growth >= 1)) return done();
      if (j.stage === 'go') { if (!walk()) return; j.stage = 'work'; }
      j.work += dt * workSpeed(G, p, j.type);
      if (G.rand() < dt * 3) emit(G, p.x, p.y + 0.3, 1, 'leaf');
      if (j.work >= j.need) {
        if (j.type === 'plant') G.plants[j.t] = { kind: z, growth: 0, water: 1, dry: 0 };
        else {
          const pl = G.plants[j.t]; G.plants[j.t] = null;
          dropItem(G, j.t % W, (j.t / W) | 0, pl.kind === 'tea' ? 'tea' : 'cabbage', pl.kind === 'tea' ? 4 : 6);
          emit(G, p.x, p.y, 6, 'leaf');
        }
        done();
      }
      return;
    }
    case 'water': {
      if (!G.plants[j.t]) return done();
      const tx = (j.t % W) + 0.5, ty = ((j.t / W) | 0) + 0.5;
      const soak = (rad) => {
        const cx = j.t % W, cy = (j.t / W) | 0;
        for (let y = cy - rad; y <= cy + rad; y++) for (let x = cx - rad; x <= cx + rad; x++) {
          if (!inB(x, y)) continue; const pl = G.plants[idx(x, y)];
          if (pl) { pl.water = 1; pl.dry = 0; emit(G, x + 0.5, y + 0.5, 3, 'splash'); }
        }
      };
      if (j.stage === 'fetch') {
        if (!walk()) return;
        j.stage = 'fill'; j.work = 0; j.label = 'Filling a bucket';
        return;
      }
      if (j.stage === 'fill') {
        j.work += dt; if (G.rand() < dt * 6) emit(G, p.x, p.y, 1, 'splash');
        if (j.work < 1) return;
        p.carrying = { type: 'water', qty: 1 };
        const r = seek(G, p, nearGoal(j.t % W, (j.t / W) | 0, 1), 400);
        if (!r) return done();
        p.path = r.path; j.stage = 'go'; j.work = 0; j.label = 'Carrying water to crops';
        return;
      }
      if (j.stage === 'go') { if (!walk()) return; j.stage = 'work'; j.work = 0; }
      p.facing = Math.atan2(ty - p.y, tx - p.x);
      j.work += dt;
      if (j.work >= (j.bend ? 0.6 : 0.8)) {
        if (j.bend) { spendChi(G, p, 8); soak(2); floatText(G, tx, ty - 0.5, 'Splash!', '#7cc6ff'); }
        else { p.carrying = null; soak(1); }
        done();
      }
      return;
    }
    case 'cook': {
      if (j.stage === 'fetch') {
        if (!walk()) return;
        const it = G.items[j.item];
        if (!it || !ITEMS[it.type].raw) return done();
        const qty = takeItem(G, j.item, 4);
        p.carrying = { type: it.type, qty };
        G.res.delete('i' + j.item);
        const lit = G._lit || [];
        const r = seek(G, p, adjGoal((n) => lit.includes(n)), 400);
        if (!r) return done();
        j.fire = r.goal.t; p.path = r.path; j.stage = 'go'; j.label = 'Carrying food to the fire';
        return;
      }
      const fire = G.struct[j.fire];
      if (!fire || !fire.built || fire.fuel <= 0 || !p.carrying) return done();
      if (j.stage === 'go') {
        if (!walk()) return;
        j.stage = 'work'; j.work = 0; j.flash = p.el === 'fire' && p.chi >= 5;
        if (j.flash) spendChi(G, p, 5);
        j.label = j.flash ? 'Flash-cooking with firebending' : 'Cooking a meal';
      }
      const fx = (j.fire % W) + 0.5, fy = ((j.fire / W) | 0) + 0.5;
      p.facing = Math.atan2(fy - p.y, fx - p.x);
      j.work += dt * workSpeed(G, p, 'cook') * (j.flash ? 1.4 : 1);
      if (G.rand() < dt * (j.flash ? 14 : 4)) emit(G, fx, fy - 0.2, 1, 'ember');
      if (j.work >= 5) {
        const c = p.carrying;
        const meals = Math.ceil((c.type === 'cabbage' ? c.qty / 2 : c.qty) * (hasTech(G, 'pottery') ? 1.5 : 1));
        p.carrying = null;
        const [x, y] = tileOf(p); dropItem(G, x, y, 'meal', meals);
        emit(G, fx, fy, 6, 'steam');
        done();
      }
      return;
    }
    case 'kindle': {
      const s = G.struct[j.t];
      if (!s || !s.built || s.type !== 'campfire') return done();
      if (j.stage === 'fetch') {
        if (!walk()) return;
        const it = G.items[j.item];
        if (!it || it.type !== 'wood') return done();
        p.carrying = { type: 'wood', qty: takeItem(G, j.item, 2) };
        G.res.delete('i' + j.item);
        const r = seek(G, p, adjGoal((n) => n === j.t), 400);
        if (!r) return done();
        p.path = r.path; j.stage = 'go'; j.label = 'Refuelling the campfire';
        return;
      }
      if (j.stage === 'go') { if (!walk()) return; j.stage = 'work'; j.work = 0; }
      j.work += dt;
      const fx = (j.t % W) + 0.5, fy = ((j.t / W) | 0) + 0.5;
      if (j.work >= (j.bend ? 1 : 1.5)) {
        if (j.bend) { if (!hasChi(G, p, 15)) return done(); spendChi(G, p, 15); s.fuel = 100; emit(G, fx, fy, 24, 'ember'); floatText(G, fx, fy - 0.6, 'Kindled!', '#ffb347'); }
        else if (p.carrying && p.carrying.type === 'wood') { s.fuel = Math.min(100, s.fuel + p.carrying.qty * 30); p.carrying = null; emit(G, fx, fy, 8, 'ember'); }
        done();
      }
      return;
    }
    case 'haul': {
      if (j.stage === 'go') {
        if (!walk()) return;
        const it = G.items[j.item];
        if (!it) return done();
        const type = it.type;
        const qty = takeItem(G, j.item, Math.floor(carryCap(G, p)));
        p.carrying = { type, qty };
        G.res.delete('i' + j.item);
        const r = seek(G, p, (x, y, i) => (G.zone[i] === 'stock' && canHold(G, i, type) && !isRes(G, 'c' + i, p) ? { t: i } : null), 500);
        if (!r) return done();
        reserve(G, 'c' + r.goal.t, p);
        j.dest = r.goal.t; p.path = r.path; j.stage = 'carry';
        return;
      }
      if (!walk()) return;
      if (p.carrying) {
        const left = G.zone[j.dest] === 'stock' && canHold(G, j.dest, p.carrying.type) ? addItem(G, j.dest, p.carrying.type, p.carrying.qty) : p.carrying.qty;
        if (left > 0) { const [x, y] = tileOf(p); dropItem(G, x, y, p.carrying.type, left); }
        p.carrying = null;
      }
      done();
      return;
    }
    case 'tea': {
      const table = G.struct[j.table];
      if (!table || !table.built || table.type !== 'teatable') return done();
      if (j.stage === 'fetch') {
        if (!walk()) return;
        const it = G.items[j.item];
        if (it && it.type === 'tea') { takeItem(G, j.item, 1); j.hasTea = true; }
        G.res.delete('i' + j.item);
        const r = seek(G, p, adjGoal((n) => n === j.table), 300);
        if (!r) return done();
        p.path = r.path; j.stage = 'go'; j.label = j.hasTea ? 'Brewing jasmine tea' : 'Chatting at the tea table';
        return;
      }
      if (j.stage === 'go') { if (!walk()) return; j.stage = 'sit'; j.work = 0; }
      j.work += dt;
      const tx = (j.table % W) + 0.5, ty = ((j.table / W) | 0) + 0.5;
      p.facing = Math.atan2(ty - p.y, tx - p.x);
      if (G.rand() < dt * 3) emit(G, tx, ty - 0.2, 1, 'steam');
      if (j.work >= 4) {
        p.lastTea = G.time;
        if (j.hasTea) addThought(p, 'tea', 'Shared a pot of jasmine tea', 14, 170);
        else addThought(p, 'chat', 'Chatted at the tea table', 5, 110);
        for (const q of G.pawns) if (q !== p && !q.dead && !q.downed && dist(p, q) < 3) addThought(q, 'company', 'Good company', 4, 90);
        done();
      }
      return;
    }
    case 'wander': {
      if (j.stage === 'go') { if (!walk()) return; j.stage = 'idle'; }
      j.idle -= dt;
      if (j.idle <= 0) done();
      return;
    }
    case 'retreat': {
      if (j.stage === 'go') { if (!walk()) return; j.stage = 'idle'; }
      j.idle -= dt;
      if (j.idle <= 0) done();
      return;
    }
    case 'fight': return runFight(G, p, dt);
    case 'research': case 'plantTree': case 'tame': return runEcoJob(G, p, dt, j, walk, done);
    default: done();
  }
}

// ============================================================================
// Combat
// ============================================================================
function hostileToColony(G, e) {
  if (!e || e.dead || e.gone) return false;
  if (e.faction === 'raider') return true;
  if (e.tame) return false;
  return e.provoked || e.hunted || e.threat;
}
function findHostileFor(G, p) {
  let best = null, bd = Infinity;
  for (const e of G.enemies) {
    if (!hostileToColony(G, e)) continue;
    const d = dist(p, e);
    const ok = e.faction === 'raider' ? d < 10 && !e.flee : ((e.provoked || e.threat) && d < 10) || e.hunted;
    if (ok && d < bd) { bd = d; best = e; }
  }
  return best;
}
function canBend(G, p) { return p.el !== 'none' && hasChi(G, p, 6); }
function atkMul(G, p) {
  let m = hasTech(G, 'bronze') ? 1.25 : 1;
  if (p.el === 'earth' && hasTech(G, 'metalbending')) m *= 1.5;
  if (p.el === 'fire' && hasTech(G, 'lightning')) m *= 1.6;
  return m;
}
function runFight(G, p, dt) {
  const t = p.job.target;
  if (!hostileToColony(G, t) || !G.enemies.includes(t) || (t.flee && dist(p, t) > 7) || (!t.hunted && dist(p, t) > 14)) return abortJob(G, p);
  const el = ELEMENTS[p.el];
  const bend = canBend(G, p);
  const range = bend ? el.range + (p.el === 'fire' && hasTech(G, 'lightning') ? 1 : 0) : p.el === 'none' && hasTech(G, 'crossbow') ? 6 : 1.5;
  const d = dist(p, t);
  p.job.label = t.faction === 'animal' && !t.provoked ? `Hunting a ${t.name}` : `Fighting ${t.name}`;
  if (d <= range) {
    p.path = null;
    p.facing = Math.atan2(t.y - p.y, t.x - p.x);
    if (p.atkCd <= 0) colonistAttack(G, p, t, bend);
    return;
  }
  p.job.re = (p.job.re || 0) - dt;
  if (!p.path || !p.path.length || p.job.re <= 0) {
    p.job.re = 0.8;
    const r = seek(G, p, (x, y) => (Math.hypot(x + 0.5 - t.x, y + 0.5 - t.y) <= range - 0.2 ? {} : null), 80);
    if (!r) return abortJob(G, p);
    p.path = r.path;
  }
  if (move(G, p, dt) === 'blocked') p.path = null;
}
function colonistAttack(G, p, t, bend) {
  const el = ELEMENTS[p.el];
  p.atkCd = el.cd;
  const mul = atkMul(G, p);
  if (!bend && p.el === 'none' && hasTech(G, 'crossbow') && dist(p, t) > 1.6) {
    G.proj.push({ x: p.x, y: p.y, target: t, lx: t.x, ly: t.y, kind: 'bolt', dmg: 12 * mul, side: 'colony', shooter: p,
      speed: 16, life: 2, knock: 0, start: idx(...tileOf(p)), rot: 0 });
    p.atkCd = 1.1;
    return;
  }
  if (!bend) {
    if (p.el === 'none') {
      damageEnemy(G, t, el.dmg * mul, p); t.stun = 2.5;
      emit(G, t.x, t.y, 8, 'chi'); floatText(G, t.x, t.y - 0.9, 'Chi-blocked!', '#ffb347');
    } else { damageEnemy(G, t, 5, p); emit(G, t.x, t.y, 3, 'dust'); }
    return;
  }
  spendChi(G, p, 6);
  const lightning = p.el === 'fire' && hasTech(G, 'lightning');
  G.proj.push({ x: p.x, y: p.y, target: t, lx: t.x, ly: t.y, kind: lightning ? 'lightning' : el.proj, dmg: el.dmg * mul, side: 'colony', shooter: p,
    speed: lightning ? 22 : el.proj === 'boulder' ? 9 : el.proj === 'air' ? 14 : 12, life: 3, knock: p.el === 'air' ? 2.5 : 0, start: idx(...tileOf(p)), rot: 0 });
  const k = { boulder: 'dust', water: 'splash', fire: 'ember', air: 'air' }[el.proj];
  emit(G, p.x, p.y, 6, k);
}
function enemyAttack(G, e, tgt) {
  e.cd = e.atkCd;
  const tp = tgt.struct !== undefined ? { x: (tgt.struct % W) + 0.5, y: ((tgt.struct / W) | 0) + 0.5 } : tgt;
  e.facing = Math.atan2(tp.y - e.y, tp.x - e.x);
  if (e.melee) {
    if (tgt.struct !== undefined) damageStruct(G, tgt.struct, e.dmg);
    else hurt(G, tgt, e.dmg, e.inj, e.faction === 'animal' ? 'bear' : 'raid');
    emit(G, tp.x, tp.y, 5, 'dust');
    return;
  }
  G.proj.push({ x: e.x, y: e.y, target: tgt.struct !== undefined ? null : tgt, structI: tgt.struct, lx: tp.x, ly: tp.y, kind: e.proj,
    dmg: e.dmg, inj: e.inj, side: 'hostile', shooter: e, speed: 10, life: 3, knock: 0, start: idx(...tileOf(e)), rot: 0 });
  emit(G, e.x, e.y, 4, e.proj === 'fire' ? 'ember' : 'sand');
}
function knockback(G, e, fromX, fromY, amt) {
  const a = Math.atan2(e.y - fromY, e.x - fromX);
  for (let s = 0; s < amt; s += 0.1) {
    const nx = e.x + Math.cos(a) * 0.1, ny = e.y + Math.sin(a) * 0.1;
    if (!inB(Math.floor(nx), Math.floor(ny))) break;
    const ni = idx(Math.floor(nx), Math.floor(ny));
    if (enemyCostFn(G)(0, 0, ni) > 3) break;
    e.x = nx; e.y = ny;
  }
  e.path = null; e.root = Math.max(e.root || 0, 0.5);
  emit(G, e.x, e.y, 8, 'air');
}
function updateProjectiles(G, dt) {
  for (const pr of G.proj) {
    const t = pr.target;
    if (t && !t.dead && !t.gone) { pr.lx = t.x; pr.ly = t.y; }
    const dx = pr.lx - pr.x, dy = pr.ly - pr.y, d = Math.hypot(dx, dy);
    const step = pr.speed * dt;
    pr.rot += dt * 10;
    pr.life -= dt;
    if (d <= Math.max(0.3, step)) { hitProjectile(G, pr); pr.dead = true; continue; }
    pr.x += (dx / d) * step; pr.y += (dy / d) * step;
    const trail = { fire: 'ember', water: 'splash', boulder: 'dust', air: 'air', sand: 'sand', lightning: 'chi', bolt: 'dust' }[pr.kind];
    if (G.rand() < dt * 25) emit(G, pr.x, pr.y, 1, trail);
    const ti = idx(clamp(Math.floor(pr.x), 0, W - 1), clamp(Math.floor(pr.y), 0, H - 1));
    const targetTile = t ? idx(...tileOf(t)) : pr.structI;
    if (ti !== pr.start && ti !== targetTile) {
      const s = G.struct[ti];
      if (s && s.built && (s.type === 'wall' || s.type === 'door')) { damageStruct(G, ti, pr.dmg); impact(G, pr); pr.dead = true; continue; }
      if (G.terrain[ti] === T.STONE) { impact(G, pr); pr.dead = true; continue; }
    }
    if (pr.life <= 0) pr.dead = true;
  }
  G.proj = G.proj.filter((p) => !p.dead);
}
function impact(G, pr) {
  const k = { fire: 'ember', water: 'splash', boulder: 'dust', air: 'air', sand: 'sand', lightning: 'chi', bolt: 'dust' }[pr.kind];
  emit(G, pr.x, pr.y, 10, k);
}
function hitProjectile(G, pr) {
  impact(G, pr);
  if (pr.structI !== undefined && pr.structI !== null) { if (G.struct[pr.structI]) damageStruct(G, pr.structI, pr.dmg); return; }
  const t = pr.target;
  if (!t || t.dead || t.gone || Math.hypot(t.x - pr.x, t.y - pr.y) > 0.6) return;
  if (pr.side === 'colony') {
    damageEnemy(G, t, pr.dmg, pr.shooter);
    if (pr.knock && !t.dead) knockback(G, t, pr.shooter.x, pr.shooter.y, pr.knock);
  } else if (t.kind === 'colonist') {
    if (!t.downed) hurt(G, t, pr.dmg, pr.inj || 'Bruise', pr.shooter && pr.shooter.faction === 'animal' ? 'bear' : 'raid');
  } else if (t.faction) {
    damageEnemy(G, t, pr.dmg, null);
  }
}

// ============================================================================
// Colonist update
// ============================================================================
function becomeDowned(G, p) {
  const bed = p.inBed;
  abortJob(G, p);
  p.inBed = bed; p.downed = true; p.mental = null;
  if (G.raid || G.enemies.some((e) => e.provoked)) G.stats.downedInCombat++;
  log(G, `${p.name} has been downed${p.injuries.some((j) => j.bleeding) ? ' and is bleeding' : ''}!`, 'azula');
  for (const q of G.pawns) if (q !== p && !q.dead) addThought(q, 'down' + p.id, `${p.name} was downed`, -6, 120);
}
function killColonist(G, p) {
  const mal = p.injuries.find((j) => j.type === 'Malnutrition');
  const worst = p.injuries.reduce((a, j) => (j.sev > (a ? a.sev : -1) ? j : a), null);
  const cause = mal && worst === mal ? 'starvation' : p.lastHarm === 'bear' ? 'bear' : p.lastHarm === 'raid' ? 'raid' : 'wounds';
  G.stats.deaths[cause]++;
  if (cause !== 'starvation' && p.injuries.some((j) => j.bleeding)) G.stats.bledOut++;
  abortJob(G, p);
  for (const q of G.pawns) if (q.carrying && q.carrying.pawn === p.id) q.carrying = null;
  p.dead = true; p.downed = false; p.carriedBy = null; p.inBed = -1;
  if (p.bed >= 0 && G.struct[p.bed] && G.struct[p.bed].owner === p.id) G.struct[p.bed].owner = null;
  emit(G, p.x, p.y, 16, 'dust');
  banner(G, 'A colonist has died', `${p.name} the ${ELEMENTS[p.el].name} is gone. The colony mourns.`, 'azula');
  for (const q of G.pawns) if (!q.dead) addThought(q, 'death' + p.id, `${p.name} died`, -20, 400);
}
function updateHarmony(G, p, dt) {
  for (const t of p.thoughts) t.ttl -= dt;
  p.thoughts = p.thoughts.filter((t) => t.ttl > 0);
  const sit = [];
  if (p.hunger < 5) sit.push(['Starving', -22]); else if (p.hunger < 25) sit.push(['Hungry', -8]);
  if (p.rest < 15) sit.push(['Exhausted', -10]);
  if (p.health < 60) sit.push(['In pain', -8]);
  if (G.ev.fullmoon > 0 && p.el === 'water') sit.push(['Full moon power', 12]);
  if (G.ev.fullmoon > 0 && p.el !== 'water') sit.push(['Beautiful full moon', 2]);
  if (G.ev.heatwave > 0) sit.push(p.el === 'fire' ? ['Basking in the heat', 6] : ['Sweltering heat', -5]);
  if (isNight(G) && nearLitCampfire(G, p, 4)) sit.push(['Warm campfire', 4]);
  if (isNight(G) && hasTech(G, 'electricity')) sit.push(['Electric lights', 4]);
  if (hasTech(G, 'probending')) sit.push(['Pro-bending season', 8]);
  if (G.enemies.some((e) => e.tame && SPECIES[e.type].role === 'companion' && !e.dead && dist(e, p) < 3)) sit.push(['Playful hog-monkey', 3]);
  if (G.raid) sit.push(['Under attack', -4]);
  p.sit = sit;
  const target = clamp(52 + sit.reduce((s, x) => s + x[1], 0) + p.thoughts.reduce((s, t) => s + t.val, 0), 0, 100);
  p.harmony += (target - p.harmony) * Math.min(1, dt * 0.25);
}
function startBreak(G, p) {
  abortJob(G, p);
  const type = p.el === 'fire' ? 'Fire Tantrum' : p.el === 'air' ? 'Gale Wandering' : 'Chi Catatonia';
  p.mental = { type, t: 25, cd: 1 };
  G.stats.breaks++;
  banner(G, 'Mental break', `${p.name} has lost their harmony: ${type}!`, 'azula');
}
function doMental(G, p, dt) {
  const m = p.mental;
  if (m.type === 'Chi Catatonia') { if (G.rand() < dt) emit(G, p.x, p.y - 0.3, 1, 'steam'); return; }
  if (!p.path || !p.path.length) {
    const [x, y] = tileOf(p);
    const tx = clamp(x + Math.floor(G.rand() * 13) - 6, 0, W - 1), ty = clamp(y + Math.floor(G.rand() * 13) - 6, 0, H - 1);
    const r = seek(G, p, (a, b) => (a === tx && b === ty ? {} : null), 25);
    p.path = r ? r.path : null;
  }
  if (move(G, p, dt) === 'blocked') p.path = null;
  if (m.type === 'Fire Tantrum') {
    m.cd -= dt;
    if (G.rand() < dt * 5) emit(G, p.x, p.y, 1, 'ember');
    if (m.cd <= 0) {
      m.cd = 2.2;
      let best = -1, bd = 6;
      for (let i = 0; i < G.struct.length; i++) {
        const s = G.struct[i]; if (!s || !s.built) continue;
        const d = Math.hypot((i % W) + 0.5 - p.x, ((i / W) | 0) + 0.5 - p.y);
        if (d < bd) { bd = d; best = i; }
      }
      if (best >= 0) {
        G.proj.push({ x: p.x, y: p.y, target: null, structI: best, lx: (best % W) + 0.5, ly: ((best / W) | 0) + 0.5, kind: 'fire',
          dmg: 14, side: 'rogue', shooter: p, speed: 10, life: 3, knock: 0, start: idx(...tileOf(p)), rot: 0 });
      }
    }
  }
}
function updateColonist(G, p, dt) {
  if (p.dead) return;
  if (p.hitFlash > 0) p.hitFlash -= dt;
  if (p.hunger < 10) G.stats.hungryTime += dt;
  const eating = p.job && p.job.type === 'eat' && p.job.stage === 'eat';
  if (!eating) p.hunger = Math.max(0, p.hunger - dt * (p.downed ? 0.2 : 0.55));
  if (p.sleeping) p.rest = Math.min(100, p.rest + dt * (p.inBed >= 0 ? 2.4 : 1.4));
  else if (p.downed) p.rest = Math.min(100, p.rest + dt * 0.5);
  else p.rest = Math.max(0, p.rest - dt * 0.62);
  if (p.el === 'water' && G.ev.fullmoon > 0) p.chi = 100;
  else {
    let regen = 2.2;
    if (p.el === 'fire' && isDay(G)) regen *= 1.5;
    if (p.el === 'water' && !isDay(G)) regen *= 1.5;
    if (p.el === 'fire' && G.ev.heatwave > 0) regen *= 1.3;
    p.chi = Math.min(100, p.chi + regen * dt);
  }
  const bedOk = p.inBed >= 0 && G.struct[p.inBed] && G.struct[p.inBed].built && G.struct[p.inBed].type === 'bed';
  if (p.inBed >= 0 && !bedOk) p.inBed = -1;
  let bleed = 0;
  for (const j of p.injuries) if (j.bleeding) bleed++;
  const bleedRate = Math.min(0.3, bleed * 0.12) / Math.max(1, bleed) * (hasTech(G, 'medicine') ? 0.3 : hasTech(G, 'herbal') ? 0.6 : 1);
  const healMul = hasTech(G, 'medicine') ? 2 : hasTech(G, 'herbal') ? 1.3 : 1;
  for (const j of p.injuries) {
    if (j.type === 'Malnutrition') { j.sev += p.hunger <= 0 ? dt * 0.15 : -dt * 0.1; continue; }
    if (j.bleeding) j.sev += dt * bleedRate;
    else j.sev -= dt * healMul * (j.tended ? (bedOk || p.sleeping ? 0.4 : 0.12) : 0.035);
  }
  if (p.hunger <= 0 && !p.injuries.some((j) => j.type === 'Malnutrition')) p.injuries.push({ type: 'Malnutrition', sev: 0.1, bleeding: false, tended: true });
  p.injuries = p.injuries.filter((j) => j.sev > 0.01);
  p.health = healthOf(p);
  if (p.health <= 0) { killColonist(G, p); return; }
  if (!p.downed && p.health < 15) becomeDowned(G, p);
  else if (p.downed && p.health >= 30 && !p.carriedBy) { p.downed = false; p.inBed = -1; log(G, `${p.name} is back on their feet.`, 'iroh'); }
  updateHarmony(G, p, dt);
  if (p.atkCd > 0) p.atkCd -= dt;
  if (p.downed) {
    if (p.carriedBy) { const c = pawnById(G, p.carriedBy); if (!c || c.dead || c.downed) p.carriedBy = null; }
    return;
  }
  // Mental breaks
  if (!p.mental) {
    if (p.harmony < 22) { p.breakT += dt; if (p.breakT > 8 && G.rand() < dt * 0.12) startBreak(G, p); } else p.breakT = 0;
  }
  if (p.mental) {
    p.mental.t -= dt;
    if (p.mental.t <= 0) {
      p.mental = null; p.breakT = 0; p.path = null;
      addThought(p, 'catharsis', 'Catharsis', 18, 160);
      log(G, `${p.name} has calmed down.`, 'iroh');
    } else { doMental(G, p, dt); return; }
  }
  // Self-defence and hunting
  const medic = p.id === G._medic && G.pawns.some((q) => q !== p && q.downed && !q.dead && q.injuries.some((j) => j.bleeding));
  if (medic && p.job && p.job.type === 'fight') abortJob(G, p);
  if (!medic && p.health >= Math.max(G.genome.fightHealth, 15) && !(p.job && (p.job.type === 'fight' || p.job.type === 'rescue' || p.job.type === 'tend'))) {
    const h = findHostileFor(G, p);
    if (h) { abortJob(G, p); p.job = { type: 'fight', target: h, re: 0, label: `Fighting ${h.name}` }; }
  }
  if (p.health < G.genome.fightHealth && !(p.job && (p.job.type === 'retreat' || p.job.type === 'rescue')) && nearestThreat(G, p, 8)) {
    abortJob(G, p); p.job = jobRetreat(G, p); p.path = p.job.path;
  }
  if (!p.job) {
    p.think -= dt;
    if (p.think <= 0) { p.think = 0.3; p.job = chooseJob(G, p); p.path = p.job && p.job.path ? p.job.path : null; }
  }
  if (p.job) runJob(G, p, dt);
}

// ============================================================================
// Raiders & wildlife
// ============================================================================
function spawnRaid(G) {
  const kind = G.rand() < 0.5 ? 'scout' : 'sand';
  const def = RAIDERS[kind];
  const n = Math.min(10, 2 + Math.floor(dayOf(G) * 0.3));
  const sides = [(s) => s[0] === 0, (s) => s[0] === W - 1, (s) => s[1] === 0, (s) => s[1] === H - 1];
  let pool = G.edgeSpawns.filter(sides[Math.floor(G.rand() * 4)]);
  if (!pool.length) pool = G.edgeSpawns;
  const origin = pool[Math.floor(G.rand() * pool.length)];
  const near = G.edgeSpawns.filter((s) => Math.hypot(s[0] - origin[0], s[1] - origin[1]) < 6);
  for (let k = 0; k < n; k++) {
    const s = near[k % near.length];
    G.enemies.push({ id: G.nextId++, faction: 'raider', type: kind, name: def.name, x: s[0] + 0.5, y: s[1] + 0.5, hp: def.hp, maxHp: def.hp,
      range: def.range, dmg: def.dmg, atkCd: def.cd, cd: 1 + G.rand(), proj: def.proj, inj: def.inj, speed: def.speed, bash: def.bash,
      path: null, repath: 0, re: 0, target: null, flee: false, stun: 0, root: 0, hitFlash: 0, facing: 0 });
  }
  G.raid = { t: 0, kind, n }; G.lastRaid = G.time; G.raidsSeen++;
  const side = origin[0] === 0 ? 'west' : origin[0] === W - 1 ? 'east' : origin[1] === 0 ? 'north' : 'south';
  banner(G, kind === 'scout' ? 'Fire Nation raid' : 'Sandbender raid',
    `${n} ${def.name}s approach from the ${side}. "Let's see how your little village handles some pressure."`, 'azula');
}
function spawnBear(G) {
  const s = G.edgeSpawns[Math.floor(G.rand() * G.edgeSpawns.length)];
  G.enemies.push(makeAnimal(G, 'bear', s[0], s[1], false));
  banner(G, 'Platypus-bear sighted', 'A huge platypus-bear wanders into the valley. It is harmless unless startled or hunted.', 'iroh');
}
function moveEnemy(G, e, dt, speedMul = 1) {
  if (!e.path || !e.path.length) return 'arrived';
  const n = e.path[0];
  const tx = n.x + 0.5, ty = n.y + 0.5, dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  const sp = e.speed * speedMul * dt;
  if (d <= sp) { e.x = tx; e.y = ty; e.path.shift(); } else { e.x += (dx / d) * sp; e.y += (dy / d) * sp; }
  if (d > 0.001) e.facing = Math.atan2(dy, dx);
  return e.path.length ? 'moving' : 'arrived';
}
function moveToEdge(G, e, dt) {
  const [x, y] = tileOf(e);
  if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { e.gone = true; return; }
  if (!e.path || !e.path.length) {
    const r = pathfind(G, x, y, (a, b) => (a === 0 || b === 0 || a === W - 1 || b === H - 1 ? {} : null), enemyCostFn(G), 600);
    e.path = r ? r.path : null;
    if (!e.path) { e.gone = true; return; }
  }
  const n = e.path[0];
  if (n && enemyBlocked(G, idx(n.x, n.y))) {
    if (e.cd <= 0) { e.cd = 1.1; damageStruct(G, idx(n.x, n.y), e.bash); }
    return;
  }
  moveEnemy(G, e, dt, 1.1);
}
function pickTarget(G, e) {
  let best = null, bd = Infinity;
  if (e.aggro && !e.aggro.dead && !e.aggro.downed && dist(e, e.aggro) < 12) return e.aggro;
  for (const p of G.pawns) {
    if (p.dead || p.downed) continue;
    const d = dist(e, p); if (d < bd) { bd = d; best = p; }
  }
  if (best || e.faction === 'animal') return best;
  for (let i = 0; i < G.struct.length; i++) {
    const s = G.struct[i]; if (!s || !s.built) continue;
    const d = Math.hypot((i % W) + 0.5 - e.x, ((i / W) | 0) + 0.5 - e.y);
    if (d < bd) { bd = d; best = { struct: i, ref: s }; }
  }
  return best;
}
function targetValid(G, t) {
  if (!t) return false;
  if (t.struct !== undefined) return G.struct[t.struct] === t.ref && t.ref.built;
  return !t.dead && !t.downed;
}
function chaseAndAttack(G, e, dt) {
  e.re -= dt;
  if (!targetValid(G, e.target) || e.re <= 0) {
    const nt = pickTarget(G, e);
    if (nt !== e.target) e.path = null;
    e.target = nt; e.re = 1;
  }
  const t = e.target;
  if (!t) return false;
  const tp = t.struct !== undefined ? { x: (t.struct % W) + 0.5, y: ((t.struct / W) | 0) + 0.5 } : t;
  const d = Math.hypot(tp.x - e.x, tp.y - e.y);
  const canAttack = e.melee || e.stun <= 0;
  if (d <= e.range) { if (canAttack && e.cd <= 0) enemyAttack(G, e, t); return true; }
  e.repath -= dt;
  if (!e.path || !e.path.length || e.repath <= 0) {
    e.repath = 1.5;
    const [sx, sy] = tileOf(e);
    const r = pathfind(G, sx, sy, (x, y) => (Math.hypot(x + 0.5 - tp.x, y + 0.5 - tp.y) <= Math.max(1.2, e.range - 0.2) ? {} : null), enemyCostFn(G), 400);
    e.path = r ? r.path : null;
    if (!e.path) return true;
  }
  const n = e.path[0];
  if (n && enemyBlocked(G, idx(n.x, n.y))) {
    if (e.cd <= 0) { e.cd = 1.1; damageStruct(G, idx(n.x, n.y), e.bash); e.facing = Math.atan2(n.y + 0.5 - e.y, n.x + 0.5 - e.x); }
    return true;
  }
  moveEnemy(G, e, dt, e.stun > 0 ? 0.55 : 1);
  return true;
}
function updateEnemy(G, e, dt) {
  if (e.dead || e.gone) return;
  if (e.hitFlash > 0) e.hitFlash -= dt;
  e.cd -= dt; if (e.stun > 0) e.stun -= dt;
  if (e.root > 0) { e.root -= dt; return; }
  const ti = idx(...tileOf(e));
  const s = G.struct[ti];
  if (s && s.built && s.type === 'trap' && (e.faction === 'raider' || ((e.provoked || e.hunted) && !e.tame))) {
    G.struct[ti] = null; e.root = 2.5;
    emit(G, e.x, e.y, 10, 'dust'); emit(G, e.x, e.y, 6, 'blood');
    floatText(G, e.x, e.y - 0.8, 'Trapped!', '#ffd166');
    log(G, `A spike trap caught a ${e.name}!`, 'iroh');
    damageEnemy(G, e, 30, null);
    if (e.dead) return;
  }
  if (e.faction === 'animal') return updateAnimal(G, e, dt);
  if (!e.flee && e.hp < e.maxHp * 0.3) { e.flee = true; e.path = null; log(G, `A ${e.name} is fleeing!`, 'iroh'); }
  if (G.raid && G.raid.t > 130 && !e.flee) { e.flee = true; e.path = null; }
  if (e.flee) return moveToEdge(G, e, dt);
  if (!chaseAndAttack(G, e, dt)) { e.flee = true; e.path = null; }
}


// ============================================================================
// Ecology: wildlife, the food chain and taming
// Grass regrows -> grazers eat it (and raid crops) -> predators hunt grazers.
// Prey flee from predators and hunters; predators stalk when hungry; well-fed
// animals breed, starving ones die. Tamed animals haul, plough, lay eggs,
// give milk, guard or keep colonists company.
// ============================================================================
function makeAnimal(G, sp, x, y, baby) {
  const S = SPECIES[sp];
  return {
    id: G.nextId++, faction: 'animal', type: sp, name: S.name, x: x + 0.5, y: y + 0.5, hp: S.hp * (baby ? 0.5 : 1), maxHp: S.hp,
    range: 1.3, dmg: S.dmg || 4, atkCd: 1.4, cd: 0, melee: true, inj: sp === 'lion' || sp === 'bear' ? 'Claw wound' : 'Bruise',
    speed: S.speed, bash: 12, path: null, repath: 0, re: 0, target: null, provoked: false, hunted: false, calm: 0, life: 0,
    idle: G.rand() * 3, stun: 0, root: 0, hitFlash: 0, facing: G.rand() * 6.28,
    hunger: 55 + G.rand() * 45, age: baby ? 0 : 1, breedT: 90 + G.rand() * 150, tame: false, tameDesig: false,
    prodT: S.every || 0, state: 'wander', prey: null, carrying: null, haul: null, fleeT: 0, calmT: 0, threat: false,
  };
}
function randomWildSpot(G, minHome, swim) {
  for (let k = 0; k < 200; k++) {
    const x = Math.floor(G.rand() * W), y = Math.floor(G.rand() * H), i = idx(x, y);
    if (homeDist(x, y) < minHome) continue;
    if (swim) { if (G.terrain[i] === T.WATER || DIRS4.some(([dx, dy]) => inB(x + dx, y + dy) && G.terrain[idx(x + dx, y + dy)] === T.WATER)) return [x, y]; continue; }
    if (colPass(G, i)) return [x, y];
  }
  return null;
}
const countAnimals = (G, sp, tame) => G.enemies.filter((e) => e.faction === 'animal' && !e.dead && (!sp || e.type === sp) && (tame === undefined || e.tame === tame)).length;
function animalCost(G, e) {
  return (x, y, i) => {
    const t = G.terrain[i];
    if (t === T.STONE || G.tree[i] >= 0.5) return Infinity;
    if (t === T.WATER) return SPECIES[e.type].swims ? 1.2 : Infinity;
    const s = G.struct[i];
    if (s && s.built && (STRUCTS[s.type].solid || (s.type === 'door' && !e.tame))) return Infinity;
    return 1;
  };
}
function animalGo(G, e, goal, max = 30) {
  const [x, y] = tileOf(e);
  const r = pathfind(G, x, y, goal, animalCost(G, e), max);
  e.path = r ? r.path : null;
  return r;
}
function animalStep(G, e, dt, mul) {
  if (e.path && e.path.length) {
    const n = e.path[0];
    if (animalCost(G, e)(n.x, n.y, idx(n.x, n.y)) === Infinity) { e.path = null; return 'blocked'; }
  }
  return moveEnemy(G, e, dt, mul * (e.age < 1 ? 0.8 : 1));
}
const isPrey = (o) => o && !o.dead && o.faction === 'animal' && SPECIES[o.type].diet === 'herb';
function threatFor(G, e, S) {
  let best = null, bd = S.sense;
  for (const o of G.enemies) {
    if (o === e || o.dead || o.tame) continue;
    const pred = o.faction === 'raider' || (o.type === 'lion' && o.hunger < 70) || (o.type === 'bear' && (o.provoked || o.hunger < 40) && S.size < 0.6);
    if (!pred) continue;
    const d = dist(o, e); if (d < bd) { bd = d; best = o; }
  }
  if (!e.tame) {
    for (const p of G.pawns) {
      if (p.dead || p.downed) continue;
      const d = dist(p, e), r = e.hunted ? S.sense + 3 : 1.6;
      if (d < r && d < bd) { bd = d; best = p; }
    }
  }
  if (e.fleeT > 0 && e.fleeFrom && !e.fleeFrom.dead) return e.fleeFrom;
  return best;
}
function fleeFrom(G, e, o, dt) {
  e.state = 'flee';
  e.repath -= dt;
  if (!e.path || !e.path.length || e.repath <= 0) {
    e.repath = 1.2;
    const [x, y] = tileOf(e);
    const a = Math.atan2(e.y - o.y, e.x - o.x);
    let best = null, bs = -1;
    for (let k = 0; k < 8; k++) {
      const aa = a + (G.rand() - 0.5) * 1.6, r = 4 + G.rand() * 4;
      const tx = clamp(Math.round(x + Math.cos(aa) * r), 0, W - 1), ty = clamp(Math.round(y + Math.sin(aa) * r), 0, H - 1);
      if (animalCost(G, e)(tx, ty, idx(tx, ty)) === Infinity) continue;
      const sc = Math.hypot(tx + 0.5 - o.x, ty + 0.5 - o.y);
      if (sc > bs) { bs = sc; best = [tx, ty]; }
    }
    if (best) animalGo(G, e, (a2, b2) => (a2 === best[0] && b2 === best[1] ? {} : null), 24);
  }
  animalStep(G, e, dt, 1.25);
}
function eatHere(G, e, S, dt) {
  e.state = 'graze';
  e.eatT = (e.eatT || 0) + dt;
  if (e.eatT < 2) return;
  e.eatT = 0;
  const i = idx(...tileOf(e));
  const pl = G.plants[i];
  if (pl && (S.cropRaider || e.hunger < 25) && !e.tame) {
    G.plants[i] = null; e.hunger = Math.min(100, e.hunger + 40); G.stats.cropsEaten++;
    emit(G, e.x, e.y, 5, 'leaf');
    if (G.time - (G.cropLogT || -999) > 40) { G.cropLogT = G.time; log(G, `A wild ${S.name} is eating the crops!`, 'azula'); }
    return;
  }
  if (G.forage[i] >= 0.25) { G.forage[i] = Math.max(0, G.forage[i] - 0.6); e.hunger = Math.min(100, e.hunger + 32); emit(G, e.x, e.y + 0.2, 2, 'leaf'); return; }
  const it = G.items[i];
  if (e.tame && it && it.type === 'cabbage' && foodSurplus(G)) { takeItem(G, i, 2); e.hunger = Math.min(100, e.hunger + 40); return; }
  e.path = null; e.state = 'wander';
}
const foodSurplus = (G) => countItems(G, 'cabbage') + countItems(G, 'meal') > G.pawns.filter((p) => !p.dead).length * 5;
function findGraze(G, e, S) {
  const [x, y] = tileOf(e);
  const crop = S.cropRaider && !e.tame;
  const fodder = e.tame && e.hunger < 20 && foodSurplus(G);
  const r = animalGo(G, e, (a, b, i) => {
    if (crop && G.plants[i] && G.plants[i].growth > 0.3) return {};
    if (G.forage[i] >= 0.4 && !(e.tame && G.plants[i])) return {};
    if (fodder && G.items[i] && G.items[i].type === 'cabbage') return {};
    return null;
  }, 28);
  void x; void y;
  if (r) e.state = 'toGraze';
  return !!r;
}
function wanderAnimal(G, e, dt, S) {
  e.state = 'wander';
  if (!e.path || !e.path.length) {
    e.idle -= dt; if (e.idle > 0) return;
    e.idle = 2 + G.rand() * 4;
    const [x, y] = tileOf(e);
    let cx = x, cy = y;
    if (e.tame) {
      const role = S.role;
      if (role === 'plough' || S.plough) {
        const field = []; for (let i = 0; i < G.zone.length; i++) if ((G.zone[i] === 'cabbage' || G.zone[i] === 'tea') && G.plants[i]) field.push(i);
        if (field.length) { const f = field[Math.floor(G.rand() * field.length)]; cx = f % W; cy = (f / W) | 0; }
      } else if (homeDist(x, y) > HOME.ring - 2) { cx = HOME.cx; cy = HOME.cy; }
    } else {
      const mate = G.enemies.find((o) => o !== e && o.type === e.type && !o.dead && !o.tame && dist(o, e) < 10 && dist(o, e) > 3);
      if (mate) { cx = Math.floor(mate.x); cy = Math.floor(mate.y); }
      if (homeDist(x, y) < HOME.ring && S.diet !== 'carn' && !(S.cropRaider && e.hunger < 70)) { cx = x + Math.sign(x - HOME.cx) * 4; cy = y + Math.sign(y - HOME.cy) * 4; }
    }
    const tx = clamp(cx + Math.floor(G.rand() * 7) - 3, 0, W - 1), ty = clamp(cy + Math.floor(G.rand() * 7) - 3, 0, H - 1);
    animalGo(G, e, (a, b) => (a === tx && b === ty ? {} : null), 16);
  }
  animalStep(G, e, dt, 0.5);
}
function tryBreed(G, e, S, dt) {
  e.breedT -= dt;
  if (e.breedT > 0 || e.age < 1 || e.hunger < 70) return;
  e.breedT = 160 + G.rand() * 160;
  const total = G.enemies.filter((o) => o.faction === 'animal' && !o.dead).length;
  if (total >= 46) return;
  const cap = e.tame ? 4 : S.cap;
  if (e.tame && countAnimals(G, null, true) >= G.pawns.filter((p) => !p.dead).length * 2) return;
  if (countAnimals(G, e.type, e.tame) >= cap) return;
  const mate = G.enemies.some((o) => o !== e && o.type === e.type && !o.dead && o.tame === e.tame && o.age >= 1 && dist(o, e) < 12);
  if (!mate) return;
  const [x, y] = tileOf(e);
  const baby = makeAnimal(G, e.type, x, y, true);
  baby.tame = e.tame;
  G.enemies.push(baby);
  e.hunger -= 25;
  emit(G, e.x, e.y, 6, 'heal');
  if (e.tame) log(G, `A baby ${S.name} was born in the herd.`, 'iroh');
}
function haulForColony(G, e, S, dt) {
  const cap = Math.floor(S.carry * (hasTech(G, 'wheel') ? 1.5 : 1));
  const h = e.haul;
  if (!h) {
    if (!G.zone.includes('stock')) return false;
    e.haulT = (e.haulT || 0) - dt;
    if (e.haulT > 0) return false;
    e.haulT = 2;
    const r = animalGo(G, e, (x, y, i) => {
      const it = G.items[i];
      return it && G.zone[i] !== 'stock' && !isRes(G, 'i' + i, e) ? { t: i } : null;
    }, 70);
    if (!r) return false;
    reserve(G, 'i' + r.goal.t, e);
    e.haul = { stage: 'go', item: r.goal.t };
    e.state = 'haul';
    return true;
  }
  e.state = 'haul';
  const m = animalStep(G, e, dt, 1);
  if (m === 'blocked') { releaseAll(G, e); if (e.carrying) { dropItem(G, ...tileOf(e), e.carrying.type, e.carrying.qty); e.carrying = null; } e.haul = null; return true; }
  if (m !== 'arrived') return true;
  if (h.stage === 'go') {
    const it = G.items[h.item];
    G.res.delete('i' + h.item);
    if (!it) { e.haul = null; return true; }
    const type = it.type, qty = takeItem(G, h.item, cap);
    e.carrying = { type, qty };
    const r = animalGo(G, e, (x, y, i) => (G.zone[i] === 'stock' && canHold(G, i, type) && !isRes(G, 'c' + i, e) ? { t: i } : null), 90);
    if (!r) { dropItem(G, ...tileOf(e), type, qty); e.carrying = null; e.haul = null; return true; }
    reserve(G, 'c' + r.goal.t, e);
    h.stage = 'carry'; h.dest = r.goal.t;
    return true;
  }
  if (e.carrying) {
    const left = G.zone[h.dest] === 'stock' && canHold(G, h.dest, e.carrying.type) ? addItem(G, h.dest, e.carrying.type, e.carrying.qty) : e.carrying.qty;
    if (left > 0) dropItem(G, ...tileOf(e), e.carrying.type, left);
    e.carrying = null;
  }
  releaseAll(G, e); e.haul = null;
  return true;
}
function huntPrey(G, e, S, dt) {
  // A predator stalks the nearest prey it can reach; walls keep tamed herds safe.
  e.re -= dt;
  if (!isPrey(e.prey) || e.re <= 0) {
    e.re = 2;
    let best = null, bd = e.hunger < 30 ? 16 : 11;
    for (const o of G.enemies) {
      if (!isPrey(o) || (e.type === 'bear' && SPECIES[o.type].size >= 0.6)) continue;
      const d = dist(o, e); if (d < bd) { bd = d; best = o; }
    }
    e.prey = best; e.path = null;
  }
  const o = e.prey;
  if (!o) return false;
  e.state = 'hunt';
  e.threat = o.tame;
  const d = dist(o, e);
  if (d <= 1.3) {
    e.facing = Math.atan2(o.y - e.y, o.x - e.x);
    if (e.cd <= 0) {
      e.cd = 1.2;
      emit(G, o.x, o.y, 4, 'blood');
      damageEnemy(G, o, S.dmg, e);
      if (o.dead) {
        e.hunger = 100; e.prey = null; e.threat = false; e.eatT = -4; e.state = 'eat'; G.stats.predation = (G.stats.predation || 0) + 1;
        if (o.tame) log(G, `A ${S.name} took one of the colony's animals.`, 'azula');
      }
    }
    return true;
  }
  e.repath -= dt;
  if (!e.path || !e.path.length || e.repath <= 0) {
    e.repath = 1;
    const [ox, oy] = tileOf(o);
    if (!animalGo(G, e, (x, y) => (Math.max(Math.abs(x - ox), Math.abs(y - oy)) <= 1 ? {} : null), 40)) { e.prey = null; return false; }
  }
  animalStep(G, e, dt, d < 5 ? 1.15 : 0.8);
  return true;
}
function updateAnimal(G, e, dt) {
  const S = SPECIES[e.type];
  e.life += dt;
  if (e.age < 1) e.age = Math.min(1, e.age + dt / 150);
  e.hunger = Math.max(0, e.hunger - dt * (S.diet === 'carn' ? 0.3 : S.diet === 'omni' ? 0.25 : 0.2));
  if (e.hunger <= 0) { e.hp -= dt * 0.8; if (e.hp <= 0) { if (e.tame) log(G, `The tamed ${S.name} starved.`, 'azula'); killEnemy(G, e, { faction: 'animal', name: 'hunger' }); return; } }
  else if (e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + dt * 0.2);
  if (e.fleeT > 0) e.fleeT -= dt;
  if (e.calmT > 0) { e.calmT -= dt; e.state = 'calm'; return; } // being tamed: holds still
  if (e.eatT < 0) { e.eatT += dt; return; } // eating a kill

  // Enraged animals fight whoever provoked them.
  if (e.provoked) {
    e.calm -= dt;
    if (e.calm <= 0 && !e.hunted) { e.provoked = false; e.aggro = null; e.path = null; if (S.size >= 0.9) log(G, `The ${S.name} calms down.`, 'iroh'); }
    else { e.state = 'angry'; if (!chaseAndAttack(G, e, dt)) { e.provoked = false; e.path = null; } return; }
  }
  // Big wild animals startle when a colonist blunders too close.
  if (!e.tame && (S.dmg || 0) >= 10 && S.diet !== 'herb') {
    for (const p of G.pawns) {
      if (p.dead || p.downed) continue;
      if (dist(p, e) < 1.6 && G.rand() < dt * 0.08) {
        e.provoked = true; e.calm = 35; e.aggro = p;
        log(G, `The ${S.name} was startled by ${p.name} and attacks!`, 'azula');
        return;
      }
    }
  }

  if (S.diet === 'herb' || (S.diet === 'omni' && e.hunger >= 40)) {
    const th = threatFor(G, e, S);
    if (th) { if (e.haul) { releaseAll(G, e); e.haul = null; if (e.carrying) { dropItem(G, ...tileOf(e), e.carrying.type, e.carrying.qty); e.carrying = null; } } fleeFrom(G, e, th, dt); return; }
  }
  // Predators: stalk prey when hungry; a starving one turns on people.
  if (S.diet === 'carn' || (S.diet === 'omni' && e.hunger < 40)) {
    if (e.tame) {
      const raider = G.enemies.find((o) => o.faction === 'raider' && !o.dead && dist(o, e) < 8);
      if (raider) { e.aggro = null; e.target = raider; e.state = 'guard'; if (dist(raider, e) <= 1.4) { if (e.cd <= 0) { e.cd = 1.2; damageEnemy(G, raider, S.dmg, e); } } else { e.repath -= dt; if (!e.path || !e.path.length || e.repath <= 0) { e.repath = 1; const [rx, ry] = tileOf(raider); animalGo(G, e, (x, y) => (Math.max(Math.abs(x - rx), Math.abs(y - ry)) <= 1 ? {} : null), 30); } animalStep(G, e, dt, 1); } return; }
    }
    if (e.hunger < 55 && !e.tame && huntPrey(G, e, S, dt)) return;
    if (e.hunger < 55 && e.tame && e.hunger < 30) {
      const [x, y] = tileOf(e); const meat = G.items.findIndex((it) => it && it.type === 'meat');
      if (meat >= 0) { if (idx(x, y) === meat) { takeItem(G, meat, 3); e.hunger = 100; } else if (!e.path || !e.path.length) animalGo(G, e, (a, b, i) => (i === meat ? {} : null), 60); animalStep(G, e, dt, 1); return; }
    }
    e.threat = false;
    if (!e.tame && e.hunger < 15 && G.rand() < dt * 0.05) {
      const p = G.pawns.filter((q) => !q.dead && !q.downed).sort((a, b) => dist(a, e) - dist(b, e))[0];
      if (p && dist(p, e) < 14) { e.provoked = true; e.calm = 40; e.aggro = p; log(G, `A starving ${S.name} is stalking ${p.name}!`, 'azula'); return; }
    }
  }
  if (S.diet !== 'carn') {
    if (e.state === 'toGraze' || e.state === 'graze') {
      const m = animalStep(G, e, dt, 0.7);
      if (m === 'arrived') eatHere(G, e, S, dt);
      else if (m === 'blocked') e.state = 'wander';
      return;
    }
    if (e.hunger < 60 && findGraze(G, e, S)) return;
  }
  // Tamed work
  if (e.tame && e.hunger > 30) {
    if (S.role === 'hauler' && haulForColony(G, e, S, dt)) return;
    if (S.product) {
      e.prodT -= dt;
      if (e.prodT <= 0) { e.prodT = S.every; dropItem(G, ...tileOf(e), S.product, S.product === 'egg' ? 2 : 3); }
    }
  }
  tryBreed(G, e, S, dt);
  // Wandering wild migrants (the bear) eventually leave the valley.
  if (!e.tame && e.type === 'bear' && e.life > 300 && !e.hunted) { moveToEdge(G, e, dt); return; }
  wanderAnimal(G, e, dt, S);
}
function updateEcology(G, dt) {
  G.ecoT += dt;
  if (G.ecoT < 1) return;
  G.ecoT -= 1;
  const regrow = hasTech(G, 'fertilizer') ? 2 : 1;
  let trees = 0;
  for (let i = 0; i < G.forage.length; i++) {
    const t = G.terrain[i];
    if (t === T.GRASS && G.forage[i] < 1) G.forage[i] = Math.min(1, G.forage[i] + regrow / 160);
    else if (t === T.SOIL && G.forage[i] < 0.6) G.forage[i] = Math.min(0.6, G.forage[i] + regrow / 260);
    if (G.tree[i]) trees++;
  }
  // Trees grow from saplings and slowly seed the land around them.
  for (let i = 0; i < G.tree.length; i++) {
    const v = G.tree[i];
    if (!v) continue;
    if (v < 1) { G.tree[i] = Math.min(1, v + 1 / 220); continue; }
    if (trees < 230 && G.rand() < 0.0005) {
      const x = (i % W) + Math.floor(G.rand() * 5) - 2, y = ((i / W) | 0) + Math.floor(G.rand() * 5) - 2;
      if (!inB(x, y)) continue;
      const n = idx(x, y);
      if (G.terrain[n] === T.GRASS && !G.tree[n] && !G.struct[n] && !G.zone[n] && !G.plants[n] && !G.items[n] && homeDist(x, y) > HOME.ring) { G.tree[n] = 0.05; trees++; }
    }
  }
  // Ploughing animals speed up crops around them.
  const boost = hasTech(G, 'plough') ? 1 : 0.5;
  for (const e of G.enemies) {
    if (!e.tame || e.dead || !(SPECIES[e.type].role === 'plough' || SPECIES[e.type].plough)) continue;
    const [x, y] = tileOf(e);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!inB(x + dx, y + dy)) continue;
      const pl = G.plants[idx(x + dx, y + dy)];
      if (pl && pl.growth < 1 && pl.water > 0) pl.growth = Math.min(1, pl.growth + boost / 140);
    }
  }
}

// ---------------------------------------------------------------- colonist jobs for the new systems
WORK.research = (G, p) => {
  if (!G.research.target) G.research.target = chooseResearch(G);
  if (!G.research.target) return null;
  const desks = [];
  for (let i = 0; i < G.struct.length; i++) { const s = G.struct[i]; if (s && s.built && s.type === 'desk' && !isRes(G, 'rd' + i, p)) desks.push(i); }
  if (!desks.length) return null;
  const r = seek(G, p, adjGoal((n) => desks.includes(n)));
  if (!r) return null;
  reserve(G, 'rd' + r.goal.t, p);
  return { type: 'research', t: r.goal.t, path: r.path, stage: 'go', work: 0, label: `Researching ${TECHS[G.research.target].name}` };
};
WORK.plantTree = (G, p) => {
  if (!hasTech(G, 'forestry') || !G.zone.includes('grove')) return null;
  const r = seek(G, p, (x, y, i) => (G.zone[i] === 'grove' && !G.tree[i] && !G.struct[i] && !G.items[i] && !G.plants[i] && fertile(G, i) && !isRes(G, 'pt' + i, p) ? { t: i } : null));
  if (!r) return null;
  reserve(G, 'pt' + r.goal.t, p);
  return { type: 'plantTree', t: r.goal.t, path: r.path, stage: 'go', work: 0, need: 1.5, label: 'Planting a sapling' };
};
WORK.tame = (G, p) => {
  if (!hasTech(G, 'husbandry')) return null;
  const targets = G.enemies.filter((e) => e.faction === 'animal' && e.tameDesig && !e.tame && !e.dead && !isRes(G, 'tm' + e.id, p));
  if (!targets.length) return null;
  const e = targets.sort((a, b) => dist(a, p) - dist(b, p))[0];
  const food = SPECIES[e.type].diet === 'carn' ? ['meat'] : ['cabbage', 'meat'];
  const ir = seek(G, p, (x, y, i) => { const it = G.items[i]; return it && food.includes(it.type) && !isRes(G, 'i' + i, p) ? { t: i } : null; }, 300);
  if (!ir) return null;
  reserve(G, 'tm' + e.id, p); reserve(G, 'i' + ir.goal.t, p);
  return { type: 'tame', animal: e, item: ir.goal.t, path: ir.path, stage: 'fetch', work: 0, re: 0, label: `Fetching food to tame a ${e.name}` };
};
function runEcoJob(G, p, dt, j, walk, done) {
  if (j.type === 'research') {
    const s = G.struct[j.t];
    if (!s || !s.built || s.type !== 'desk') return done();
    if (j.stage === 'go') { if (!walk()) return; j.stage = 'work'; }
    const mul = { none: 1.5, air: 1.2, fire: 1.1, water: 1, earth: 0.85 }[p.el] * (hasTech(G, 'steam') ? 1.5 : 1) * (p.harmony > 70 ? 1.1 : 1);
    addResearch(G, dt * 0.9 * mul);
    const tx = (j.t % W) + 0.5, ty = ((j.t / W) | 0) + 0.5;
    p.facing = Math.atan2(ty - p.y, tx - p.x);
    if (G.rand() < dt * 2) emit(G, tx, ty - 0.3, 1, 'chi');
    j.label = G.research.target ? `Researching ${TECHS[G.research.target].name}` : 'Studying scrolls';
    j.work += dt;
    if (j.work >= 14) done();
    return;
  }
  if (j.type === 'plantTree') {
    if (G.zone[j.t] !== 'grove' || G.tree[j.t] || G.struct[j.t]) return done();
    if (j.stage === 'go') { if (!walk()) return; j.stage = 'work'; }
    j.work += dt;
    if (G.rand() < dt * 3) emit(G, p.x, p.y + 0.3, 1, 'leaf');
    if (j.work >= j.need) { G.tree[j.t] = 0.05; done(); }
    return;
  }
  if (j.type === 'tame') {
    const e = j.animal;
    if (!e || e.dead || e.tame || !G.enemies.includes(e) || !e.tameDesig) return done();
    if (j.stage === 'fetch') {
      if (!walk()) return;
      const it = G.items[j.item];
      if (!it || !(it.type === 'cabbage' || it.type === 'meat')) return done();
      p.carrying = { type: it.type, qty: takeItem(G, j.item, 1) };
      G.res.delete('i' + j.item);
      j.stage = 'approach'; j.label = `Approaching the ${e.name}`;
      p.path = null;
      return;
    }
    if (j.stage === 'approach') {
      if (dist(p, e) <= 1.6) { j.stage = 'calm'; j.work = 0; e.calmT = 1; e.path = null; return; }
      j.re -= dt;
      if (!p.path || !p.path.length || j.re <= 0) {
        j.re = 1;
        const [ex, ey] = tileOf(e);
        const r = seek(G, p, nearGoal(ex, ey, 1), 160);
        if (!r) return done();
        p.path = r.path;
      }
      if (move(G, p, dt) === 'blocked') p.path = null;
      return;
    }
    e.calmT = 1;
    p.facing = Math.atan2(e.y - p.y, e.x - p.x);
    j.work += dt;
    if (G.rand() < dt * 3) emit(G, e.x, e.y - 0.3, 1, 'heal');
    j.label = `Taming the ${e.name}`;
    if (j.work < 3) return;
    const S = SPECIES[e.type];
    const chance = S.tame * (p.el === 'air' ? 1.6 : p.el === 'water' ? 1.3 : 1) + (hasTech(G, 'plough') ? 0.15 : 0);
    p.carrying = null;
    e.calmT = 0;
    if (G.rand() < chance) {
      e.tame = true; e.tameDesig = false; e.hunted = false; e.provoked = false; e.threat = false; e.path = null;
      log(G, `${p.name} tamed a ${S.name}! It will ${ROLE_TEXT[S.role] || 'stay with the colony'}.`, 'plan', ELEMENTS[p.el].color);
      addThought(p, 'tamed', 'Made an animal friend', 6, 180);
      emit(G, e.x, e.y, 12, 'heal');
      floatText(G, e.x, e.y - 0.8, 'Tamed!', '#5eead4');
    } else {
      G.stats.tameFails++;
      floatText(G, e.x, e.y - 0.8, 'Refused', '#fca5a5');
      if ((S.fightsBack || S.diet !== 'herb') && G.rand() < 0.4) {
        e.provoked = true; e.calm = 15; e.aggro = p;
        log(G, `The ${S.name} lashed out at ${p.name} during taming!`, 'azula');
      } else { e.fleeT = 4; e.fleeFrom = p; }
    }
    done();
  }
}

// ============================================================================
// Storyteller
// ============================================================================
function fireEvent(G, forced) {
  const pool = [];
  if (G.time > 260 && !G.raid && G.time - G.lastRaid > 220) pool.push(['raid', 2.2 + dayOf(G) * 0.3]);
  if (G.ev.fullmoon <= 0 && G.time - G.lastMoon > 320) pool.push(['fullmoon', 1.1]);
  if (G.ev.heatwave <= 0) pool.push(['heatwave', 1.4]);
  if (!G.enemies.some((e) => e.type === 'bear')) pool.push(['bear', 1.0]);
  const wildGrazers = G.enemies.filter((e) => isPrey(e) && !e.tame).length;
  if (wildGrazers < 8) pool.push(['herd', 1.6]);
  if (!countAnimals(G, 'lion', false) && wildGrazers >= 10) pool.push(['predator', 1.0]);
  pool.push(['caravan', 1.1]);
  let pick = forced;
  if (!pick) {
    const tot = pool.reduce((s, x) => s + x[1], 0);
    let r = G.rand() * tot;
    for (const [k, w] of pool) { r -= w; if (r <= 0) { pick = k; break; } }
    pick = pick || 'caravan';
  }
  G.eventCount++;
  switch (pick) {
    case 'raid':
      if (hasTech(G, 'radio')) { G.pendingRaid = 25; banner(G, 'Radio warning', 'Scouts report raiders 25 seconds out. Everyone back inside camp!', 'iroh'); }
      else spawnRaid(G);
      break;
    case 'fullmoon':
      G.ev.fullmoon = 110; G.lastMoon = G.time;
      banner(G, 'Full Moon', 'The moon spirit shines. Waterbenders have limitless Chi and move 50% faster.', 'iroh');
      break;
    case 'heatwave':
      G.ev.heatwave = 140;
      banner(G, 'Heatwave', 'A scorching drought settles in. Crops dry out fast unless watered. "Fire is life, but also destruction."', 'azula');
      break;
    case 'bear': spawnBear(G); break;
    case 'herd': {
      const sp = ['sheep', 'hog', 'ostrich', 'yak', 'chicken'][Math.floor(G.rand() * 5)];
      const s = G.edgeSpawns[Math.floor(G.rand() * G.edgeSpawns.length)];
      const n = sp === 'yak' || sp === 'ostrich' ? 2 : 3;
      for (let k = 0; k < n; k++) G.enemies.push(makeAnimal(G, sp, s[0], s[1], false));
      banner(G, 'A herd arrives', `${n} wild ${SPECIES[sp].name}s wander into the valley to graze.`, 'iroh');
      break;
    }
    case 'predator': {
      const s = G.edgeSpawns[Math.floor(G.rand() * G.edgeSpawns.length)];
      G.enemies.push(makeAnimal(G, 'lion', s[0], s[1], false));
      banner(G, 'A predator follows the herds', 'A Saber-Tooth Moose-Lion has come for the grazers. Keep the animals inside the walls.', 'azula');
      break;
    }
    case 'wanderer': {
      G.wandererJoined = true;
      const s = G.edgeSpawns[Math.floor(G.rand() * G.edgeSpawns.length)];
      const p = makeColonist(G, 'none', 'Jin', s[0], s[1]);
      G.pawns.push(p);
      banner(G, 'A wanderer joins', 'Jin, a non-bender with a boomerang and sharp wits, asks to join. "There is always room for one more at the table."', 'iroh');
      break;
    }
    default: {
      const cx = 20, cy = 20;
      dropItem(G, cx - 2, cy - 3, 'cabbage', 18);
      dropItem(G, cx - 1, cy - 3, 'tea', 6);
      dropItem(G, cx, cy - 3, 'wood', 25);
      banner(G, 'Tea caravan', 'A travelling tea merchant leaves cabbages, jasmine tea and timber. "A gift from the road. Brew it slowly."', 'iroh');
    }
  }
}


// ============================================================================
// Free will: the colony director
// The colonists decide for themselves what the camp needs (beds, fire, farms,
// storage, materials, defences, hunting) and place the orders a player would.
// ============================================================================
const HOME = { cx: 20, cy: 20, ring: 9 };
const homeDist = (x, y) => Math.max(Math.abs(x - HOME.cx), Math.abs(y - HOME.cy));
const interior = (x, y) => homeDist(x, y) <= HOME.ring - 2;
const DOORS = [[HOME.cx, HOME.cy - HOME.ring], [HOME.cx, HOME.cy + HOME.ring], [HOME.cx - HOME.ring, HOME.cy], [HOME.cx + HOME.ring, HOME.cy]];
function ringTiles() {
  const out = [], r = HOME.ring, { cx, cy } = HOME;
  for (let x = cx - r; x <= cx + r; x++) out.push([x, cy - r]);
  for (let y = cy - r + 1; y <= cy + r; y++) out.push([cx + r, y]);
  for (let x = cx + r - 1; x >= cx - r; x--) out.push([x, cy + r]);
  for (let y = cy + r - 1; y > cy - r; y--) out.push([cx - r, y]);
  return out.filter(([x, y]) => inB(x, y));
}
function spiral(ax, ay, maxR, pred) {
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = ax + dx, y = ay + dy;
      if (inB(x, y) && pred(x, y, idx(x, y))) return [x, y];
    }
  }
  return null;
}
function countStruct(G, type, builtOnly) {
  let n = 0;
  for (const s of G.struct) if (s && s.type === type && (s.built || !builtOnly) && !s.decon) n++;
  return n;
}
// A solid building must not block a walkway: every neighbour stays walkable.
function roomy(G, x, y) {
  for (const [dx, dy] of DIRS8) {
    const nx = x + dx, ny = y + dy;
    if (!inB(nx, ny)) return false;
    const n = idx(nx, ny);
    if (!colPass(G, n) || (G.struct[n] && STRUCTS[G.struct[n].type].solid)) return false;
  }
  return !DOORS.some(([dx, dy]) => Math.max(Math.abs(dx - x), Math.abs(dy - y)) <= 2);
}
const placeStruct = (G, type, [x, y]) => { G.struct[idx(x, y)] = { type, built: false, delivered: 0, progress: 0, hp: 1, decon: false }; };
const freeSpot = (G, i) => !G.zone[i] && !G.struct[i] && !G.plants[i] && !G.tree[i] && G.terrain[i] !== T.WATER && G.terrain[i] !== T.STONE;
const ringActive = (G) => (G.genome.wallAfterRaid && G.raidsSeen > 0) || G.time / DAY_LEN >= G.genome.wallDay;

const PLANS = [
  // Somewhere to sleep for everyone.
  (G, say) => {
    const need = G.pawns.filter((p) => !p.dead).length, have = countStruct(G, 'bed');
    if (have >= need) return false;
    const t = spiral(HOME.cx - 1, HOME.cy - 4, 6, (x, y, i) => interior(x, y) && freeSpot(G, i) && !G.items[i]);
    if (!t) return false;
    placeStruct(G, 'bed', t);
    say('bed', 'earth', have === 0 ? 'We need beds before nightfall. I will lay one out.' : 'Someone still sleeps on the ground. Another bed, then.', 25);
    return true;
  },
  // A fire to cook on.
  (G, say) => {
    if (countStruct(G, 'campfire')) return false;
    const t = spiral(HOME.cx, HOME.cy + 2, 6, (x, y, i) => interior(x, y) && freeSpot(G, i) && roomy(G, x, y));
    if (!t) return false;
    placeStruct(G, 'campfire', t);
    say('fire', 'fire', 'No fire, no hot meals. I will build a campfire.', 60);
    return true;
  },
  // Enough cabbages to feed everyone.
  (G, say) => {
    const alive = G.pawns.filter((p) => !p.dead).length;
    let cells = 0; for (const z of G.zone) if (z === 'cabbage') cells++;
    if (cells >= alive * G.genome.farmPerColonist) return false;
    let added = 0;
    for (const soilOnly of [true, false]) {
      while (added < 4) {
        const t = spiral(HOME.cx + 4, HOME.cy + 4, 7, (x, y, i) => interior(x, y) && freeSpot(G, i) && !G.items[i] && (soilOnly ? G.terrain[i] === T.SOIL : fertile(G, i)));
        if (!t) break;
        G.zone[idx(...t)] = 'cabbage'; added++;
      }
    }
    if (!added) return false;
    say('farm', 'water', 'More mouths to feed. I am widening the cabbage patch.', 120);
    return true;
  },
  // Room in the stockpile.
  (G, say) => {
    let free = 0;
    for (let i = 0; i < G.zone.length; i++) if (G.zone[i] === 'stock' && colPass(G, i) && (!G.items[i] || G.items[i].qty < MAXSTACK * 0.8)) free++;
    if (free >= 3) return false;
    let added = 0;
    while (added < 4) {
      const t = spiral(HOME.cx - 5, HOME.cy, 7, (x, y, i) => interior(x, y) && freeSpot(G, i) && DIRS4.some(([dx, dy]) => inB(x + dx, y + dy) && G.zone[idx(x + dx, y + dy)] === 'stock'));
      if (!t) break;
      G.zone[idx(...t)] = 'stock'; added++;
    }
    if (!added) return false;
    say('stock', 'air', 'The stockpile is overflowing. I marked out more space.', 120);
    return true;
  },
  // Timber.
  (G, say) => {
    if (countItems(G, 'wood') >= G.genome.woodReserve) return false;
    let pending = 0; for (const d of G.desig) if (d === 'chop') pending++;
    if (pending >= 4) return false;
    const trees = [];
    for (let i = 0; i < G.tree.length; i++) if (G.tree[i] >= 1 && !G.desig[i]) trees.push(i);
    trees.sort((a, b) => homeDist(a % W, (a / W) | 0) - homeDist(b % W, (b / W) | 0));
    trees.slice(0, 5 - pending).forEach((i) => { G.desig[i] = 'chop'; });
    if (!trees.length) return false;
    say('chop', 'none', 'We are short on timber. I marked the nearest trees.', 120);
    return true;
  },
  // Stone, more of it once the wall goes up.
  (G, say) => {
    if (countItems(G, 'stone') >= G.genome.stoneReserve) return false;
    let pending = 0; for (const d of G.desig) if (d === 'mine') pending++;
    if (pending >= 3) return false;
    const faces = [];
    for (let i = 0; i < G.terrain.length; i++) {
      if (G.terrain[i] !== T.STONE || G.desig[i]) continue;
      const x = i % W, y = (i / W) | 0;
      if (DIRS4.some(([dx, dy]) => inB(x + dx, y + dy) && colPass(G, idx(x + dx, y + dy)))) faces.push(i);
    }
    faces.sort((a, b) => homeDist(a % W, (a / W) | 0) - homeDist(b % W, (b / W) | 0));
    faces.slice(0, 4 - pending).forEach((i) => { G.desig[i] = 'mine'; });
    if (!faces.length) return false;
    say('mine', 'earth', 'The earth will give us stone. I picked a good seam.', 120);
    return true;
  },
  // A desk for study once the basics are in place.
  (G, say) => {
    if (countStruct(G, 'desk') || countStruct(G, 'bed', true) < Math.min(2, G.pawns.filter((p) => !p.dead).length) || !countStruct(G, 'campfire', true)) return false;
    const t = spiral(HOME.cx - 3, HOME.cy - 3, 6, (x, y, i) => interior(x, y) && freeSpot(G, i) && !G.items[i] && roomy(G, x, y));
    if (!t) return false;
    placeStruct(G, 'desk', t);
    say('desk', 'none', 'I have ideas. Lots of ideas. I need a desk and some scrolls.', 200);
    return true;
  },
  // Tame useful animals once the colony knows how.
  (G, say) => {
    if (!hasTech(G, 'husbandry') || G.enemies.some((e) => e.tameDesig && !e.dead && !e.tame)) return false;
    const alive = G.pawns.filter((p) => !p.dead).length;
    const tamed = G.enemies.filter((e) => e.faction === 'animal' && e.tame && !e.dead);
    if (tamed.length >= 2 + alive) return false;
    if (countItems(G, 'cabbage') + countItems(G, 'meat') < alive * 2) return false;
    const roles = new Set(tamed.map((e) => SPECIES[e.type].role));
    const want = ['hauler', 'livestock', 'plough', 'companion'].find((r) => !roles.has(r));
    const cands = G.enemies.filter((e) => e.faction === 'animal' && !e.tame && !e.dead && !e.hunted && !e.provoked && e.age >= 1
      && SPECIES[e.type].tame >= 0.2 && homeDist(...tileOf(e)) <= 18);
    if (!cands.length) return false;
    cands.sort((a, b) => ((SPECIES[a.type].role === want ? 0 : 20) + homeDist(...tileOf(a))) - ((SPECIES[b.type].role === want ? 0 : 20) + homeDist(...tileOf(b))));
    const c = cands[0];
    c.tameDesig = true;
    say('tame', 'air', `That ${c.name} could ${ROLE_TEXT[SPECIES[c.type].role]}. I will try to tame it.`, 60);
    return true;
  },
  // Replant the forest the colony is cutting down.
  (G, say) => {
    if (!hasTech(G, 'forestry')) return false;
    let grove = 0; for (const z of G.zone) if (z === 'grove') grove++;
    let near = 0; for (let i = 0; i < G.tree.length; i++) if (G.tree[i] >= 1 && homeDist(i % W, (i / W) | 0) <= 15) near++;
    if (grove >= 12 || (grove > 0 && near >= 16)) return false;
    let added = 0;
    for (const [ax, ay] of [[HOME.cx + HOME.ring + 3, HOME.cy], [HOME.cx - HOME.ring - 3, HOME.cy], [HOME.cx, HOME.cy + HOME.ring + 3], [HOME.cx, HOME.cy - HOME.ring - 3]]) {
      while (added < 6) {
        const t = spiral(clamp(ax, 0, W - 1), clamp(ay, 0, H - 1), 4, (x, y, i) => homeDist(x, y) >= HOME.ring + 2 && freeSpot(G, i) && !G.items[i] && fertile(G, i));
        if (!t) break;
        G.zone[idx(...t)] = 'grove'; added++;
      }
      if (added) break;
    }
    if (!added) return false;
    say('grove', 'earth', 'We cut faster than the forest grows. I marked out a grove to replant.', 200);
    return true;
  },
  // Hunt wild grazers for meat when the habit has been learned.
  (G, say) => {
    if (!G.genome.huntPrey || G.enemies.some((e) => e.hunted && !e.dead && isPrey(e))) return false;
    const alive = G.pawns.filter((p) => !p.dead).length;
    const food = countItems(G, 'meal') + countItems(G, 'cabbage') + countItems(G, 'meat') + countItems(G, 'egg') + countItems(G, 'milk');
    if (food >= alive * 5) return false;
    const prey = G.enemies.filter((e) => isPrey(e) && !e.tame && !e.tameDesig && e.age >= 1 && countAnimals(G, e.type, false) > 2)
      .sort((a, b) => homeDist(...tileOf(a)) - homeDist(...tileOf(b)))[0];
    if (!prey) return false;
    prey.hunted = true;
    say('huntprey', 'fire', `Food is short. That ${prey.name} will feed us.`, 120);
    return true;
  },
  // Protect the herd from predators.
  (G, say) => {
    const pred = G.enemies.find((e) => e.threat && !e.hunted && !e.dead && homeDist(...tileOf(e)) <= 16);
    if (!pred) return false;
    pred.hunted = true;
    say('guard', 'earth', `A ${pred.name} is after our animals. Drive it off!`, 90);
    return true;
  },
  // Somewhere to share tea, once everyone has a bed.
  (G, say) => {
    if (!G.genome.teaTable || countStruct(G, 'teatable') || countStruct(G, 'bed', true) < G.pawns.filter((p) => !p.dead).length) return false;
    const t = spiral(HOME.cx + 3, HOME.cy - 3, 6, (x, y, i) => interior(x, y) && freeSpot(G, i) && !G.items[i] && roomy(G, x, y));
    if (!t) return false;
    placeStruct(G, 'teatable', t);
    say('teatable', 'fire', 'A camp needs a place for tea and talk. I will build a tea table.', 120);
    return true;
  },
  (G, say) => {
    if (!countStruct(G, 'teatable')) return false;
    let cells = 0; for (const z of G.zone) if (z === 'tea') cells++;
    if (cells >= 6) return false;
    let added = 0;
    while (added < 3) {
      const t = spiral(HOME.cx + 5, HOME.cy - 4, 6, (x, y, i) => interior(x, y) && freeSpot(G, i) && !G.items[i] && fertile(G, i));
      if (!t) break;
      G.zone[idx(...t)] = 'tea'; added++;
    }
    if (!added) return false;
    say('tea', 'air', 'Let us grow our own jasmine for the tea table.', 150);
    return true;
  },
  // A wall around camp once raids are a real threat; built a few sections at a time.
  (G, say) => {
    if (!ringActive(G)) return false;
    let pending = 0;
    for (const s of G.struct) if (s && !s.built && (s.type === 'wall' || s.type === 'door')) pending++;
    if (pending >= 8) return false;
    let added = 0;
    for (const [x, y] of ringTiles()) {
      if (added >= 6) break;
      const i = idx(x, y);
      if (G.struct[i] || G.terrain[i] === T.WATER || G.terrain[i] === T.STONE) continue;
      if (G.tree[i] >= 1) { if (!G.desig[i]) G.desig[i] = 'chop'; continue; }
      if (G.tree[i]) G.tree[i] = 0;
      if (G.zone[i] === 'grove') G.zone[i] = null;
      if (G.plants[i]) { G.plants[i] = null; }
      if (G.zone[i]) G.zone[i] = null;
      placeStruct(G, DOORS.some(([dx, dy]) => dx === x && dy === y) ? 'door' : 'wall', [x, y]);
      added++;
    }
    if (!added) return false;
    say('ring', 'earth', G.raidsSeen ? 'They will come back. We raise a wall around the camp.' : 'Raiders roam these lands. Better to wall the camp now.', 240);
    return true;
  },
  // Spike traps outside the gates after the first raid.
  (G, say) => {
    const have = countStruct(G, 'trap');
    if (!(G.raidsSeen || ringActive(G)) || have >= G.genome.traps) return false;
    let added = 0;
    for (const [dx, dy, r] of [...DOORS.map((d) => [...d, 2]), ...DOORS.map((d) => [...d, 3])]) {
      if (have + added >= G.genome.traps) break;
      const ox = dx + Math.sign(dx - HOME.cx) * r, oy = dy + Math.sign(dy - HOME.cy) * r;
      if (!inB(ox, oy)) continue;
      const i = idx(ox, oy);
      if (!freeSpot(G, i)) continue;
      placeStruct(G, 'trap', [ox, oy]); added++;
    }
    if (!added) return false;
    say('trap', 'none', 'I know a trick or two. Spike traps outside every gate.', 400);
    return true;
  },
  // Hunt the platypus-bear only when food is short and the group is healthy.
  (G, say) => {
    const bear = G.enemies.find((e) => e.type === 'bear' && !e.hunted && !e.tame);
    if (!bear) return false;
    const fit = G.pawns.filter((p) => !p.dead && !p.downed && p.health > 70).length;
    const food = countItems(G, 'meal') + countItems(G, 'cabbage') + countItems(G, 'meat');
    if (G.genome.huntEager) {
      if (fit < 1) return false;
      bear.hunted = true;
      say('hunt', 'fire', 'Look at the size of that beast! Meat for a week. Let us take it down.', 200);
      return true;
    }
    if (fit < 3 || food >= G.pawns.filter((p) => !p.dead).length * 6) return false;
    bear.hunted = true;
    say('hunt', 'none', 'Food is running low. Together we can take that platypus-bear.', 200);
    return true;
  },
];

function director(G, dt) {
  if (!G.freeWill) return;
  G.dirT -= dt;
  if (G.dirT > 0) return;
  G.dirT = 3;
  const able = G.pawns.filter((p) => !p.dead && !p.downed);
  if (!able.length) return;
  for (const st of G.struct) {
    if (st && !st.built && st.delivered < STRUCTS[st.type].cost && countItems(G, STRUCTS[st.type].mat) === 0) { G.stats.matWait += 3; break; }
  }
  const say = (key, el, text, cool) => {
    if (G.time - (G.planLog[key] ?? -1e9) < cool) return;
    G.planLog[key] = G.time;
    const p = able.find((q) => q.el === el) || able[Math.floor(G.rand() * able.length)];
    log(G, `${p.name}: "${text}"`, 'plan', ELEMENTS[p.el].color);
    floatText(G, p.x, p.y - 0.8, 'Idea!', ELEMENTS[p.el].color);
  };
  if (!G.research.target) G.research.target = chooseResearch(G);
  for (const plan of PLANS) if (plan(G, say)) return;
}

// ============================================================================
// Main simulation step
// ============================================================================
function update(G, dt) {
  G.time += dt;
  G._lit = litCampfires(G);
  for (const i of G._lit) {
    const s = G.struct[i]; s.fuel = Math.max(0, s.fuel - dt * 0.37);
    if (G.rand() < dt * 3) emit(G, (i % W) + 0.5, ((i / W) | 0) + 0.4, 1, 'ember');
  }
  updateEcology(G, dt);
  if (G.pendingRaid > 0) { G.pendingRaid -= dt; if (G.pendingRaid <= 0) spawnRaid(G); }
  // Plants
  const night = isNight(G);
  let withered = 0;
  for (let i = 0; i < G.plants.length; i++) {
    const pl = G.plants[i]; if (!pl) continue;
    pl.water = Math.max(0, pl.water - dt * (G.ev.heatwave > 0 ? 1 / 26 : 1 / 240) * (hasTech(G, 'irrigation') ? 0.5 : 1));
    if (pl.water <= 0) { pl.dry += dt; if (pl.dry > 45) { G.plants[i] = null; withered++; continue; } }
    else if (pl.growth < 1) {
      const rate = (pl.kind === 'cabbage' ? 1 / 140 : 1 / 190) * (G.terrain[i] === T.SOIL ? 1 : 0.6) * (night ? 0.5 : 1)
        * (hasTech(G, 'rotation') ? 1.4 : 1) * (hasTech(G, 'fertilizer') ? 1.4 : 1);
      pl.growth = Math.min(1, pl.growth + rate * dt);
    }
  }
  G.stats.withered += withered;
  if (withered && G.time - G.witherLogT > 20) { G.witherLogT = G.time; log(G, 'Crops have withered from thirst.', 'azula'); }
  // Events
  if (G.ev.fullmoon > 0) { G.ev.fullmoon -= dt; if (G.ev.fullmoon <= 0) log(G, 'The full moon wanes.', 'info'); }
  if (G.ev.heatwave > 0) { G.ev.heatwave -= dt; if (G.ev.heatwave <= 0) log(G, 'The heatwave breaks. Cool winds return.', 'iroh'); }
  director(G, dt);
  G.nextEvent -= dt;
  if (G.nextEvent <= 0) {
    G.nextEvent = 70 + G.rand() * 55;
    fireEvent(G, G.eventCount === 0 ? 'wanderer' : G.eventCount === 2 && !G.raid ? 'raid' : null);
  }
  // One colonist acts as medic in a crisis: the waterbender if able, otherwise a backup.
  const able = G.pawns.filter((p) => !p.dead && !p.downed && !p.mental);
  const medic = ['water', 'none', 'air', 'earth', 'fire'].map((el) => able.find((p) => p.el === el)).find(Boolean);
  G._medic = medic && G.genome.medic ? medic.id : -1;
  G.stats.peak = Math.max(G.stats.peak, G.pawns.filter((p) => !p.dead).length);
  for (const p of G.pawns) updateColonist(G, p, dt);
  for (const e of G.enemies) updateEnemy(G, e, dt);
  // Soft separation so raiders don't stack on one tile.
  for (const a of G.enemies) for (const c of G.enemies) {
    if (a === c || a.dead || c.dead || a.faction !== c.faction) continue;
    if (Math.abs(a.x - c.x) > 1 || Math.abs(a.y - c.y) > 1) continue;
    const dx = a.x - c.x, dy = a.y - c.y, d = Math.hypot(dx, dy), min = a.faction === 'animal' ? 0.35 : 0.55;
    if (d < min && d > 0.001) {
      const nx = a.x + (dx / d) * (min - d) * 0.5, ny = a.y + (dy / d) * (min - d) * 0.5;
      if (inB(Math.floor(nx), Math.floor(ny)) && enemyCostFn(G)(0, 0, idx(Math.floor(nx), Math.floor(ny))) <= 3) { a.x = nx; a.y = ny; }
    } else if (d <= 0.001) a.x += (G.rand() - 0.5) * 0.05;
  }
  G.enemies = G.enemies.filter((e) => !e.dead && !e.gone);
  updateProjectiles(G, dt);
  updateParticles(G, dt);
  if (G.raid) {
    G.raid.t += dt;
    if (!G.enemies.some((e) => e.faction === 'raider')) {
      G.raid = null;
      banner(G, 'Raid over', 'The raiders are gone. The colony stands.', 'iroh');
      for (const p of G.pawns) if (!p.dead) addThought(p, 'defended', 'Defended our home', 8, 220);
    }
  }
  if (G.banner) { G.banner.t -= dt; if (G.banner.t <= 0) G.banner = null; }
  if (!G.over && G.pawns.every((p) => p.dead)) { G.over = true; log(G, 'The colony has fallen.', 'azula'); }
}

// ============================================================================
// Player tools
// ============================================================================
const TOOLS = {
  select: { label: 'Select', icon: MousePointer2, cat: 'orders', hint: 'Click a colonist, creature or tile to inspect it. Drag to pan.' },
  mine: { label: 'Mine', icon: Gem, cat: 'orders', hint: 'Drag across grey stone deposits to mine them for stone.' },
  chop: { label: 'Chop', icon: Axe, cat: 'orders', hint: 'Drag across trees to chop them for wood.' },
  hunt: { label: 'Hunt', icon: Crosshair, cat: 'orders', hint: 'Click a wild animal to mark it for hunting. Colonists will attack it.' },
  tameTool: { label: 'Tame', icon: Heart, cat: 'orders', hint: 'Click a wild animal to mark it for taming (needs Animal Husbandry).' },
  clear: { label: 'Clear', icon: Trash2, cat: 'orders', hint: 'Drag to cancel orders, blueprints and zones. Finished buildings get deconstructed for half their materials.' },
  wall: { label: 'Stone Wall', icon: Square, cat: 'build', struct: 'wall', hint: 'Drag to draw walls (a box draws its outline). 5 stone each, free for Earthbenders with Chi.' },
  door: { label: 'Door', icon: DoorOpen, cat: 'build', struct: 'door', hint: 'Colonists walk through doors; raiders must break them. 4 wood.' },
  bed: { label: 'Bed', icon: Bed, cat: 'build', struct: 'bed', hint: 'Colonists sleep and heal faster in beds. Downed colonists are carried here. 6 wood.' },
  campfire: { label: 'Campfire', icon: Flame, cat: 'build', struct: 'campfire', hint: 'Needed for cooking meals. Firebenders kindle it with Chi, others burn wood. 4 wood.' },
  teatable: { label: 'Tea Table', icon: Coffee, cat: 'build', struct: 'teatable', hint: 'Colonists drink jasmine tea and chat here to restore Harmony. 8 wood.' },
  trap: { label: 'Spike Trap', icon: Triangle, cat: 'build', struct: 'trap', hint: 'Single-use trap: 30 damage and roots the enemy. Non-benders build it 3x faster. 4 wood.' },
  stock: { label: 'Stockpile', icon: Package, cat: 'zones', zone: 'stock', hint: 'Drag to mark a stockpile. Colonists haul loose items here.' },
  cabbage: { label: 'Cabbage Patch', icon: Sprout, cat: 'zones', zone: 'cabbage', hint: 'Drag over grass or soil. Cabbages feed the colony. Fertile soil grows faster.' },
  desk: { label: 'Scroll Desk', icon: BookOpen, cat: 'build', struct: 'desk', hint: 'Colonists study here to advance the research tree. 10 wood.' },
  grove: { label: 'Tree Grove', icon: TreePine, cat: 'zones', zone: 'grove', hint: 'Drag over grass. Once Forestry is researched, colonists plant saplings here.' },
  tea: { label: 'Jasmine Tea', icon: Leaf, cat: 'zones', zone: 'tea', hint: 'Drag over grass or soil. Jasmine leaves are brewed at a tea table for Harmony.' },
};
const CATS = [['orders', 'Orders'], ['build', 'Structures'], ['zones', 'Zones']];

function toolCells(G, tool, x0, y0, x1, y1) {
  const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
  const outline = tool === 'wall' && bx - ax >= 2 && by - ay >= 2;
  const cells = [];
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
    if (!inB(x, y)) continue;
    if (outline && x > ax && x < bx && y > ay && y < by) continue;
    cells.push([x, y, toolValid(G, tool, idx(x, y))]);
  }
  return cells;
}
function toolValid(G, tool, i) {
  const def = TOOLS[tool]; const t = G.terrain[i];
  if (tool === 'mine') return t === T.STONE;
  if (tool === 'chop') return G.tree[i] >= 1;
  if (tool === 'clear') return !!(G.desig[i] || G.struct[i] || G.zone[i]);
  if (def.struct) return t !== T.WATER && t !== T.STONE && !G.tree[i] && !G.struct[i] && !G.plants[i];
  if (tool === 'stock') return t !== T.WATER && t !== T.STONE && !G.tree[i] && !(G.struct[i] && STRUCTS[G.struct[i].type].solid);
  if (tool === 'grove') return G.terrain[i] === T.GRASS && !G.struct[i] && !G.plants[i];
  if (def.zone) return fertile(G, i) && !G.tree[i] && !G.struct[i];
  return false;
}
function applyTool(G, tool, x0, y0, x1, y1) {
  const def = TOOLS[tool];
  for (const [x, y, ok] of toolCells(G, tool, x0, y0, x1, y1)) {
    if (!ok) continue;
    const i = idx(x, y);
    if (tool === 'mine') G.desig[i] = 'mine';
    else if (tool === 'chop') G.desig[i] = 'chop';
    else if (tool === 'clear') {
      G.desig[i] = null; G.zone[i] = null;
      const s = G.struct[i];
      if (s && !s.built) { if (s.delivered > 0) dropItem(G, x, y, STRUCTS[s.type].mat, s.delivered); G.struct[i] = null; }
      else if (s) s.decon = true;
    } else if (def.struct) G.struct[i] = { type: def.struct, built: false, delivered: 0, progress: 0, hp: 1, decon: false };
    else if (def.zone) G.zone[i] = def.zone;
  }
}

// ============================================================================
// Rendering
// ============================================================================
function renderTerrain(G) {
  const c = G.tcan || (G.tcan = document.createElement('canvas'));
  c.width = W * TS; c.height = H * TS;
  const g = c.getContext('2d');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y), t = G.terrain[i], v = G.shade[i];
    const px = x * TS, py = y * TS;
    g.fillStyle = tint(TERRAIN_COLOR[t], v); g.fillRect(px, py, TS, TS);
    if (t === T.GRASS) {
      g.strokeStyle = tint('#4b7636', v); g.lineWidth = 1.2;
      for (let k = 0; k < 4; k++) {
        const bx = px + 4 + hash(i, k + 3) * 24, by = py + 6 + hash(i, k + 9) * 22;
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 1.5, by - 4); g.stroke();
      }
    } else if (t === T.SOIL) {
      g.strokeStyle = 'rgba(40,24,12,0.45)'; g.lineWidth = 2;
      for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(px + 3, py + 7 + k * 9); g.lineTo(px + TS - 3, py + 7 + k * 9); g.stroke(); }
    } else if (t === T.STONE) {
      g.fillStyle = 'rgba(255,255,255,0.13)'; g.fillRect(px, py, TS, 5);
      g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(px, py + TS - 5, TS, 5);
      g.strokeStyle = 'rgba(40,40,46,0.55)'; g.lineWidth = 1.3;
      g.beginPath(); g.moveTo(px + 6 + hash(i, 2) * 8, py + 8); g.lineTo(px + 14 + hash(i, 4) * 6, py + 16); g.lineTo(px + 10 + hash(i, 5) * 14, py + 25); g.stroke();
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (inB(nx, ny) && G.terrain[idx(nx, ny)] !== T.STONE) {
          g.fillStyle = 'rgba(30,30,36,0.35)';
          if (dx === 1) g.fillRect(px + TS - 3, py, 3, TS); if (dx === -1) g.fillRect(px, py, 3, TS);
          if (dy === 1) g.fillRect(px, py + TS - 3, TS, 3); if (dy === -1) g.fillRect(px, py, TS, 3);
        }
      }
    } else if (t === T.SAND) {
      g.fillStyle = 'rgba(120,90,40,0.35)';
      for (let k = 0; k < 6; k++) g.fillRect(px + hash(i, k) * 30, py + hash(i, k + 7) * 30, 1.6, 1.6);
    } else if (t === T.DIRT) {
      g.fillStyle = 'rgba(60,50,35,0.3)';
      for (let k = 0; k < 4; k++) g.fillRect(px + hash(i, k) * 28, py + hash(i, k + 7) * 28, 3, 2);
    } else if (t === T.WATER) {
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (inB(nx, ny) && G.terrain[idx(nx, ny)] !== T.WATER) {
          g.fillStyle = 'rgba(180,220,240,0.25)';
          if (dx === 1) g.fillRect(px + TS - 3, py, 3, TS); if (dx === -1) g.fillRect(px, py, 3, TS);
          if (dy === 1) g.fillRect(px, py + TS - 3, TS, 3); if (dy === -1) g.fillRect(px, py, TS, 3);
        }
      }
    }
    g.strokeStyle = 'rgba(0,0,0,0.05)'; g.lineWidth = 1; g.strokeRect(px + 0.5, py + 0.5, TS - 1, TS - 1);
  }
  G.terrainDirty = false;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

function drawItem(ctx, it, px, py, zoom) {
  const c = ITEMS[it.type].color;
  ctx.save(); ctx.translate(px + TS / 2, py + TS / 2);
  switch (it.type) {
    case 'stone':
      ctx.fillStyle = '#6f737a'; roundRect(ctx, -9, -2, 9, 8, 2); ctx.fill();
      ctx.fillStyle = c; roundRect(ctx, -2, -6, 10, 9, 2); ctx.fill(); roundRect(ctx, -6, 1, 9, 7, 2); ctx.fill(); break;
    case 'wood':
      for (let k = 0; k < 3; k++) { ctx.fillStyle = k % 2 ? '#8a5a2e' : c; roundRect(ctx, -10, -7 + k * 5, 20, 4.5, 2); ctx.fill(); ctx.fillStyle = '#d9b07c'; ctx.beginPath(); ctx.arc(9, -4.7 + k * 5, 1.8, 0, 7); ctx.fill(); }
      break;
    case 'cabbage':
      for (const [dx, dy] of [[-4, 2], [4, 2], [0, -3]]) { ctx.fillStyle = '#5ea53c'; ctx.beginPath(); ctx.arc(dx, dy, 5.5, 0, 7); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.arc(dx, dy - 1, 3.2, 0, 7); ctx.fill(); }
      break;
    case 'tea':
      ctx.fillStyle = '#c9b77a'; roundRect(ctx, -7, -6, 14, 13, 3); ctx.fill();
      ctx.fillStyle = c; roundRect(ctx, -5, -4, 10, 9, 2); ctx.fill();
      ctx.fillStyle = '#4c8a3a'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 2, -0.6, 0, 7); ctx.fill(); break;
    case 'meal':
      ctx.fillStyle = '#7a4e2a'; ctx.beginPath(); ctx.ellipse(0, 2, 10, 6, 0, 0, 7); ctx.fill();
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, 8, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#6fb34a'; ctx.beginPath(); ctx.arc(-3, -1, 1.6, 0, 7); ctx.arc(3, 0, 1.4, 0, 7); ctx.fill(); break;
    case 'egg':
      for (const [dx, dy] of [[-4, 2], [3, 3], [0, -3]]) { ctx.fillStyle = '#d9cdb0'; ctx.beginPath(); ctx.ellipse(dx + 0.6, dy + 0.6, 3.4, 4.4, 0.2, 0, 7); ctx.fill(); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(dx, dy, 3.2, 4.2, 0.2, 0, 7); ctx.fill(); }
      break;
    case 'milk':
      ctx.fillStyle = '#8a6a48'; roundRect(ctx, -6, -8, 12, 16, 3); ctx.fill();
      ctx.fillStyle = c; roundRect(ctx, -4.5, -6, 9, 7, 2); ctx.fill();
      ctx.fillStyle = '#5b3b1f'; ctx.fillRect(-2, -10, 4, 3); break;
    case 'meat':
      ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(-1, 0, 8, 6, 0.4, 0, 7); ctx.fill();
      ctx.fillStyle = '#f2e6d8'; ctx.beginPath(); ctx.arc(7, -5, 2.4, 0, 7); ctx.fill(); break;
    default: break;
  }
  ctx.restore();
  if (zoom >= 0.75 && it.qty > 1) {
    ctx.font = 'bold 9px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(it.qty, px + TS - 2, py + TS - 2);
    ctx.fillStyle = '#fff'; ctx.fillText(it.qty, px + TS - 3, py + TS - 3);
  }
}

function drawStruct(ctx, G, s, i, px, py, t) {
  const bp = !s.built;
  ctx.save();
  if (bp) ctx.globalAlpha = 0.45;
  const cx = px + TS / 2, cy = py + TS / 2;
  switch (s.type) {
    case 'wall': {
      ctx.fillStyle = bp ? '#7fb4ff' : '#8d9098'; ctx.fillRect(px, py, TS, TS);
      if (!bp) {
        ctx.fillStyle = '#a9adb4'; ctx.fillRect(px, py, TS, 6);
        ctx.fillStyle = '#6a6d74'; ctx.fillRect(px, py + TS - 4, TS, 4);
        ctx.strokeStyle = 'rgba(50,50,56,0.6)'; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px, py + 15); ctx.lineTo(px + TS, py + 15); ctx.moveTo(px + 16, py + 6); ctx.lineTo(px + 16, py + 15);
        ctx.moveTo(px + 8, py + 15); ctx.lineTo(px + 8, py + TS - 4); ctx.moveTo(px + 24, py + 15); ctx.lineTo(px + 24, py + TS - 4);
        ctx.stroke();
        if (s.hp < structMaxHp(G, s) * 0.5) { ctx.strokeStyle = 'rgba(20,20,20,0.7)'; ctx.beginPath(); ctx.moveTo(px + 6, py + 4); ctx.lineTo(px + 14, py + 18); ctx.lineTo(px + 10, py + 28); ctx.stroke(); }
      }
      break;
    }
    case 'door': {
      const open = G.pawns.some((p) => !p.dead && tileOf(p)[0] === i % W && tileOf(p)[1] === ((i / W) | 0));
      ctx.fillStyle = '#5b3b1f'; ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = bp ? '#7fb4ff' : '#9a6a3a';
      if (open) ctx.fillRect(px + 2, py + 2, 6, TS - 4);
      else { ctx.fillRect(px + 3, py + 3, TS - 6, TS - 6); ctx.strokeStyle = '#6e4826'; ctx.lineWidth = 1.5; for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(px + 3 + k * 6.5, py + 4); ctx.lineTo(px + 3 + k * 6.5, py + TS - 4); ctx.stroke(); } ctx.fillStyle = '#e1c16e'; ctx.beginPath(); ctx.arc(px + TS - 9, cy, 1.8, 0, 7); ctx.fill(); }
      break;
    }
    case 'bed': {
      const owner = s.owner && pawnById(G, s.owner);
      ctx.fillStyle = '#6e4826'; roundRect(ctx, px + 3, py + 2, TS - 6, TS - 4, 3); ctx.fill();
      ctx.fillStyle = '#f1ece0'; roundRect(ctx, px + 6, py + 4, TS - 12, 7, 2); ctx.fill();
      ctx.fillStyle = bp ? '#7fb4ff' : owner ? ELEMENTS[owner.el].robe : '#8a7f72';
      roundRect(ctx, px + 5, py + 12, TS - 10, TS - 16, 2); ctx.fill();
      break;
    }
    case 'campfire': {
      ctx.fillStyle = '#5a5d63';
      for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 11, cy + Math.sin(a) * 11, 3.4, 0, 7); ctx.fill(); }
      ctx.strokeStyle = '#6e4826'; ctx.lineWidth = 3.5;
      ctx.beginPath(); ctx.moveTo(cx - 7, cy + 5); ctx.lineTo(cx + 7, cy - 5); ctx.moveTo(cx - 7, cy - 5); ctx.lineTo(cx + 7, cy + 5); ctx.stroke();
      if (!bp && s.fuel > 0) {
        const f = 0.6 + 0.4 * (s.fuel / 100);
        for (let k = 0; k < 3; k++) {
          const fl = Math.sin(t * 12 + k * 2) * 2;
          ctx.fillStyle = ['#ff4d1f', '#ff8a2a', '#ffd34d'][k];
          const hh = (12 - k * 3) * f + fl;
          ctx.beginPath(); ctx.moveTo(cx - (7 - k * 2), cy + 3); ctx.quadraticCurveTo(cx, cy - hh - 4, cx + (7 - k * 2), cy + 3); ctx.closePath(); ctx.fill();
        }
      }
      break;
    }
    case 'teatable': {
      ctx.fillStyle = '#5b3b1f'; roundRect(ctx, px + 3, py + 5, TS - 6, TS - 10, 4); ctx.fill();
      ctx.fillStyle = bp ? '#7fb4ff' : '#8b5e34'; roundRect(ctx, px + 4, py + 4, TS - 8, TS - 12, 4); ctx.fill();
      if (!bp) {
        ctx.fillStyle = '#d7e4e0'; ctx.beginPath(); ctx.arc(cx, cy - 2, 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#4a9b8a'; ctx.beginPath(); ctx.arc(cx, cy - 2, 3, 0, 7); ctx.fill();
        ctx.fillStyle = '#f1ece0'; ctx.beginPath(); ctx.arc(px + 8, py + 8, 2.4, 0, 7); ctx.arc(px + TS - 8, py + TS - 12, 2.4, 0, 7); ctx.fill();
      }
      break;
    }
    case 'desk': {
      ctx.fillStyle = '#4a2f18'; roundRect(ctx, px + 2, py + 6, TS - 4, TS - 10, 3); ctx.fill();
      ctx.fillStyle = bp ? '#7fb4ff' : '#7a5230'; roundRect(ctx, px + 3, py + 4, TS - 6, TS - 12, 3); ctx.fill();
      if (!bp) {
        ctx.fillStyle = '#efe2b8'; ctx.fillRect(px + 7, py + 8, 12, 7);
        ctx.strokeStyle = '#7a5230'; ctx.lineWidth = 0.8; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(px + 9, py + 10 + k * 2); ctx.lineTo(px + 17, py + 10 + k * 2); ctx.stroke(); }
        ctx.fillStyle = '#d9c38a'; ctx.beginPath(); ctx.arc(px + 23, py + 10, 2.5, 0, 7); ctx.arc(px + 23, py + 15, 2.5, 0, 7); ctx.fill();
        if (hasTech(G, 'electricity')) { ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(px + 9, py + 20, 2.2, 0, 7); ctx.fill(); }
      }
      break;
    }
    case 'trap': {
      ctx.fillStyle = bp ? '#7fb4ff' : '#4b4e55';
      for (let k = 0; k < 4; k++) {
        const ox = px + 6 + (k % 2) * 12, oy = py + 8 + Math.floor(k / 2) * 12;
        ctx.beginPath(); ctx.moveTo(ox, oy + 8); ctx.lineTo(ox + 4, oy - 2); ctx.lineTo(ox + 8, oy + 8); ctx.closePath(); ctx.fill();
      }
      break;
    }
    default: break;
  }
  ctx.restore();
  if (bp) {
    const def = STRUCTS[s.type];
    ctx.strokeStyle = 'rgba(127,180,255,0.9)'; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.5;
    ctx.strokeRect(px + 1.5, py + 1.5, TS - 3, TS - 3); ctx.setLineDash([]);
    const pr = s.progress > 0 ? s.progress : s.delivered / def.cost * 0.999;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px + 3, py + TS - 6, TS - 6, 3);
    ctx.fillStyle = s.progress > 0 ? '#9be29f' : '#7fb4ff'; ctx.fillRect(px + 3, py + TS - 6, (TS - 6) * clamp(pr, 0, 1), 3);
  } else if (s.hp < structMaxHp(G, s)) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px + 3, py - 4, TS - 6, 3);
    ctx.fillStyle = '#e8553f'; ctx.fillRect(px + 3, py - 4, (TS - 6) * (s.hp / structMaxHp(G, s)), 3);
  }
  if (s.decon) {
    ctx.strokeStyle = '#ff5d5d'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(px + 8, py + 8); ctx.lineTo(px + TS - 8, py + TS - 8); ctx.moveTo(px + TS - 8, py + 8); ctx.lineTo(px + 8, py + TS - 8); ctx.stroke();
  }
}

function drawPlant(ctx, pl, px, py, t) {
  const g = pl.growth, cx = px + TS / 2, cy = py + TS / 2;
  const dryish = pl.water < 0.2;
  if (pl.water < 0.35) {
    ctx.strokeStyle = 'rgba(70,40,15,0.55)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px + 4, py + 6); ctx.lineTo(px + 10, py + 12); ctx.lineTo(px + 7, py + 20); ctx.moveTo(px + 22, py + 5); ctx.lineTo(px + 26, py + 14); ctx.stroke();
  }
  const sway = Math.sin(t * 2 + px) * 0.6;
  if (pl.kind === 'cabbage') {
    const r = 3 + g * 9;
    ctx.fillStyle = dryish ? '#a29a45' : '#4f8f33'; ctx.beginPath(); ctx.arc(cx + sway, cy, r, 0, 7); ctx.fill();
    ctx.fillStyle = dryish ? '#c6bb62' : g >= 1 ? '#a6e07d' : '#7cc057'; ctx.beginPath(); ctx.arc(cx + sway, cy - 1, r * 0.6, 0, 7); ctx.fill();
  } else {
    const n = 2 + Math.floor(g * 5);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2, rr = 3 + g * 6;
      ctx.fillStyle = dryish ? '#8d8a3e' : '#2f6b2a';
      ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * rr * 0.6 + sway, cy + Math.sin(a) * rr * 0.6, 3 + g * 2, 2, a, 0, 7); ctx.fill();
    }
    if (g >= 1) { ctx.fillStyle = '#fffbea'; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.arc(cx - 5 + k * 3.5, cy - 4 + (k % 2) * 6, 1.6, 0, 7); ctx.fill(); } }
  }
  if (g >= 1) { ctx.strokeStyle = 'rgba(255,240,150,0.85)'; ctx.lineWidth = 1; ctx.strokeRect(px + 2.5, py + 2.5, TS - 5, TS - 5); }
}

function drawTree(ctx, i, px, py, t, growth = 1) {
  const cx = px + TS / 2, cy = py + TS / 2, s = (0.85 + hash(i, 11) * 0.3) * (0.3 + 0.7 * Math.min(1, growth));
  if (growth < 0.35) {
    ctx.strokeStyle = '#5b3b1f'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, cy + 6); ctx.lineTo(cx, cy - 2); ctx.stroke();
    ctx.fillStyle = '#6fb34a'; ctx.beginPath(); ctx.ellipse(cx - 3, cy - 2, 3, 1.6, -0.5, 0, 7); ctx.ellipse(cx + 3, cy - 3, 3, 1.6, 0.5, 0, 7); ctx.fill();
    return;
  }
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(cx + 3, cy + 8, 12 * s, 6 * s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#5b3b1f'; ctx.fillRect(cx - 2.5, cy, 5, 10);
  const sway = Math.sin(t * 1.3 + i) * 0.8;
  ctx.fillStyle = '#2f5e2a'; ctx.beginPath(); ctx.arc(cx + sway, cy - 2, 13 * s, 0, 7); ctx.fill();
  ctx.fillStyle = '#3e7a35'; ctx.beginPath(); ctx.arc(cx - 3 + sway, cy - 5, 9 * s, 0, 7); ctx.fill();
  ctx.fillStyle = '#58993f'; ctx.beginPath(); ctx.arc(cx - 5 + sway, cy - 8, 4.5 * s, 0, 7); ctx.fill();
}

function drawColonist(ctx, G, p, t, zoom) {
  const x = p.x * TS, y = p.y * TS, el = ELEMENTS[p.el];
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 9, 10, 4, 0, 0, 7); ctx.fill();
  if (p.mental) {
    const a = 0.35 + Math.sin(t * 8) * 0.15;
    ctx.fillStyle = p.mental.type === 'Fire Tantrum' ? `rgba(255,80,30,${a})` : `rgba(170,90,255,${a})`;
    ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ctx.fill();
  }
  if (p.el === 'water' && G.ev.fullmoon > 0) { ctx.strokeStyle = `rgba(160,220,255,${0.4 + Math.sin(t * 4) * 0.2})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 15, 0, 7); ctx.stroke(); }
  if (p.downed || p.sleeping) {
    ctx.rotate(Math.PI / 2 * 0.9);
    ctx.fillStyle = el.robe; ctx.beginPath(); ctx.ellipse(0, 2, 7, 12, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#e7c39a'; ctx.beginPath(); ctx.arc(0, -9, 5.5, 0, 7); ctx.fill();
    ctx.restore();
    if (p.downed) {
      const a = 0.5 + Math.sin(t * 6) * 0.4;
      ctx.strokeStyle = `rgba(255,70,60,${a})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.stroke();
    }
  } else {
    const bob = Math.sin(p.walk * 3) * 1.2;
    ctx.translate(0, bob * 0.5);
    ctx.fillStyle = el.dark; ctx.beginPath(); ctx.arc(0, 1, 11, 0, 7); ctx.fill();
    ctx.fillStyle = el.robe; ctx.beginPath(); ctx.arc(0, 1, 9.5, 0, 7); ctx.fill();
    ctx.strokeStyle = el.color; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 1, 9.5, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    const hx = Math.cos(p.facing) * 2.5, hy = Math.sin(p.facing) * 2.5 - 2;
    ctx.fillStyle = '#e7c39a'; ctx.beginPath(); ctx.arc(hx, hy, 6, 0, 7); ctx.fill();
    if (p.el === 'air') { ctx.fillStyle = '#3d7fd6'; ctx.beginPath(); ctx.moveTo(hx, hy - 5); ctx.lineTo(hx - 2.5, hy - 1); ctx.lineTo(hx + 2.5, hy - 1); ctx.closePath(); ctx.fill(); }
    else if (p.el === 'fire') { ctx.fillStyle = '#2a1a14'; ctx.beginPath(); ctx.arc(hx, hy - 1.5, 4.5, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#d4a017'; ctx.fillRect(hx - 1.2, hy - 7, 2.4, 3); }
    else if (p.el === 'water') { ctx.fillStyle = '#3a2618'; ctx.beginPath(); ctx.arc(hx, hy - 1, 5.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill(); ctx.fillStyle = '#2f6fb0'; ctx.beginPath(); ctx.arc(hx - 4, hy + 2, 1.8, 0, 7); ctx.arc(hx + 4, hy + 2, 1.8, 0, 7); ctx.fill(); }
    else if (p.el === 'earth') { ctx.fillStyle = '#2b2018'; ctx.beginPath(); ctx.arc(hx, hy - 1, 5.6, Math.PI, 0); ctx.fill(); ctx.fillStyle = '#6aa84f'; ctx.fillRect(hx - 5.5, hy - 2, 11, 1.8); }
    else { ctx.fillStyle = '#3a2618'; ctx.beginPath(); ctx.arc(hx, hy - 1, 5.2, Math.PI, 0); ctx.fill(); ctx.beginPath(); ctx.arc(hx, hy - 6.5, 1.8, 0, 7); ctx.fill(); }
    if (p.carrying && p.carrying.type) {
      const cx = Math.cos(p.facing) * 9, cy = Math.sin(p.facing) * 9 + 2;
      ctx.fillStyle = p.carrying.type === 'water' ? '#4aa3e8' : ITEMS[p.carrying.type].color;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1;
      roundRect(ctx, cx - 4, cy - 4, 8, 8, 2); ctx.fill(); ctx.stroke();
    }
    if (p.hitFlash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  const sel = G.selected && G.selected.kind === 'pawn' && G.selected.id === p.id;
  if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, 16, t * 2, t * 2 + Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
  if (p.health < 99 || sel) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 11, y - 20, 22, 6);
    ctx.fillStyle = p.health > 50 ? '#5bd36a' : p.health > 25 ? '#f2c53d' : '#e8553f'; ctx.fillRect(x - 10, y - 19.5, 20 * p.health / 100, 2);
    ctx.fillStyle = '#5ad1ff'; ctx.fillRect(x - 10, y - 17, 20 * p.chi / 100, 2);
  }
  if (zoom >= 0.8) {
    ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center';
    const label = p.mental ? `${p.name} · ${p.mental.type}` : p.name;
    const w = ctx.measureText(label).width + 8;
    ctx.fillStyle = 'rgba(12,16,20,0.7)'; roundRect(ctx, x - w / 2, y + 13, w, 12, 4); ctx.fill();
    ctx.fillStyle = p.mental ? '#ffb4a8' : el.color; ctx.fillText(label, x, y + 22);
  }
}

function drawEnemy(ctx, G, e, t, zoom) {
  const x = e.x * TS, y = e.y * TS;
  ctx.save(); ctx.translate(x, y);
  const animal = e.faction === 'animal';
  if (animal) {
    drawAnimalBody(ctx, G, e);
  } else {
    const def = RAIDERS[e.type];
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, 9, 10, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#1f1a17'; ctx.beginPath(); ctx.arc(0, 1, 11, 0, 7); ctx.fill();
    ctx.fillStyle = def.color; ctx.beginPath(); ctx.arc(0, 1, 9.5, 0, 7); ctx.fill();
    const hx = Math.cos(e.facing) * 2.5, hy = Math.sin(e.facing) * 2.5 - 2;
    if (e.type === 'scout') {
      ctx.fillStyle = '#2b2b2e'; ctx.beginPath(); ctx.arc(hx, hy, 6.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#c23a28'; ctx.beginPath(); ctx.moveTo(hx - 5, hy - 3); ctx.lineTo(hx, hy - 11); ctx.lineTo(hx + 5, hy - 3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e8e2d6'; ctx.fillRect(hx - 3.5, hy - 1, 7, 2.5);
    } else {
      ctx.fillStyle = '#8a6a3c'; ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#e7c39a'; ctx.fillRect(hx - 3.5, hy - 2, 7, 2.5);
    }
  }
  const R0 = animal ? SPECIES[e.type].size * 18 * (e.age < 1 ? 0.6 + 0.4 * e.age : 1) : 11;
  if (e.hitFlash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(0, 0, R0, 0, 7); ctx.fill(); }
  ctx.restore();
  if (animal && e.tame) {
    ctx.strokeStyle = 'rgba(94,234,212,0.85)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(x, y + R0 * 0.6, R0 * 0.9, R0 * 0.35, 0, 0, 7); ctx.stroke();
    if (e.carrying) { ctx.fillStyle = ITEMS[e.carrying.type].color; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; roundRect(ctx, x - 4, y - R0 - 4, 8, 8, 2); ctx.fill(); ctx.stroke(); }
  }
  if (animal && e.tameDesig && !e.tame) { ctx.fillStyle = '#5eead4'; ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♥', x, y - R0 - 4); }
  if (e.stun > 0 && !animal) {
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { const a = t * 5 + k * 2.1; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 9, y - 14 + Math.sin(a) * 3, 1.8, 0, 7); ctx.stroke(); }
  }
  if (e.root > 0) { ctx.strokeStyle = 'rgba(200,200,200,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + 6, 12, 0, Math.PI); ctx.stroke(); }
  const hostile = hostileToColony(G, e);
  const r = animal ? Math.max(10, R0 + 4) : 15;
  if (e.hunted) {
    ctx.strokeStyle = '#ff5d5d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
    ctx.moveTo(x - r - 4, y); ctx.lineTo(x - r + 4, y); ctx.moveTo(x + r - 4, y); ctx.lineTo(x + r + 4, y); ctx.stroke();
  }
  if (e.hp < e.maxHp - 0.5 || hostile) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 12, y - r - 6, 24, 4);
    ctx.fillStyle = hostile ? '#e8553f' : '#d9c27a'; ctx.fillRect(x - 11, y - r - 5, 22 * clamp(e.hp / e.maxHp, 0, 1), 2);
  }
  const sel = G.selected && G.selected.kind === 'enemy' && G.selected.id === e.id;
  if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  if (zoom >= 0.8 && (!animal || e.tame || hostile || sel || zoom >= 1.3 || (SPECIES[e.type].size >= 0.9))) {
    ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = hostile ? '#ff9c8f' : animal && e.tame ? '#99f6e4' : '#e9dcae';
    ctx.fillText(e.flee ? `${e.name} (fleeing)` : e.name, x, y + r + 10);
  }
}

function drawAnimalBody(ctx, G, e) {
  const S = SPECIES[e.type];
  const sc = e.age < 1 ? 0.6 + 0.4 * e.age : 1;
  ctx.scale(sc, sc);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(0, S.size * 11, S.size * 16, S.size * 6, 0, 0, 7); ctx.fill();
  ctx.rotate(e.facing);
  const ell = (x, y, rx, ry, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill(); };
  const dot = (x, y, r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  switch (e.type) {
    case 'bear':
      ell(-2, 0, 18, 13, e.provoked ? '#6b3a22' : '#7a5232'); ell(-12, 0, 6, 9, '#5d3d22'); dot(12, 0, 8.5, '#86603d');
      ell(21, 0, 7, 4.5, '#e8b64a'); dot(14, -4, 1.6, e.provoked ? '#ff3b2f' : '#111'); dot(14, 4, 1.6, e.provoked ? '#ff3b2f' : '#111'); break;
    case 'duck':
      ell(-1, 0, 7.5, 6.5, '#46703a'); ell(-1, 0, 4.5, 3.8, '#6f9a4e'); dot(7, 0, 3.6, '#c9a64a'); ell(10.5, 0, 2.6, 1.6, '#e8902a'); dot(7.5, -1.5, 0.8, '#111'); break;
    case 'chicken':
      ell(-6, 0, 3, 1.6, '#4b4744'); ell(0, 0, 7, 5.6, '#8a8580'); dot(7, 0, 3.6, '#efe3cf'); ell(7, -3.4, 1.6, 1.2, '#d9443a'); dot(8.5, -1, 0.7, '#111'); ell(10.5, 0, 1.6, 1, '#e8b04a'); break;
    case 'sheep':
      for (const [x, y] of [[-5, -3], [-5, 3], [1, -3.5], [1, 3.5], [-2, 0]]) dot(x, y, 5, '#f1eee6');
      dot(8, -4.8, 2.8, '#5f6168'); dot(8, 4.8, 2.8, '#5f6168'); dot(8.5, 0, 4.4, '#80838a'); ell(12, 0, 1.6, 2, '#2b2b2e'); break;
    case 'hog':
      ctx.strokeStyle = '#6b4a2b'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(-11, 0, 3, 0, 5); ctx.stroke();
      ell(0, 0, 9, 6.5, '#d99a8c'); dot(9, 0, 4.6, '#b9775f'); ell(12.5, 0, 2.2, 2.6, '#f0b8aa'); dot(9.5, -2, 0.8, '#111'); dot(9.5, 2, 0.8, '#111'); break;
    case 'ostrich':
      ell(-3, 0, 9, 7, '#c99a5b'); ell(-6, 0, 4, 6, '#8a6234');
      if (e.tame) { ctx.fillStyle = '#7a3e1e'; ctx.fillRect(-7, -6.5, 7, 13); }
      ctx.strokeStyle = '#b88a4c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(12, 0); ctx.stroke();
      dot(14, 0, 3.2, '#a9793e'); ell(17.5, 0, 2.2, 1.2, '#e8b04a'); ell(13, -3, 1.4, 2.6, '#6b4a2b'); break;
    case 'yak':
      ell(-2, 0, 15, 11, '#6b4b33'); ell(-1, 0, 9, 8, '#e8e2d6');
      if (e.tame) { ctx.fillStyle = '#7a3e1e'; ctx.fillRect(-9, -11, 8, 22); }
      dot(13, 0, 6, '#4d3423');
      ctx.strokeStyle = '#d9cfbd'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(14, -7, 4, 3.6, 5.6); ctx.stroke(); ctx.beginPath(); ctx.arc(14, 7, 4, 0.7, 2.7); ctx.stroke(); break;
    case 'lion':
      ell(-3, 0, 14, 8, e.provoked || e.state === 'hunt' ? '#b8742e' : '#c98a3a'); dot(9, 0, 7.5, '#7a4a1f'); dot(12, 0, 4.6, '#d99a4a');
      ctx.strokeStyle = '#e8dcc0'; ctx.lineWidth = 1.6;
      for (const sgn of [-1, 1]) { ctx.beginPath(); ctx.moveTo(11, 3 * sgn); ctx.lineTo(8, 10 * sgn); ctx.lineTo(4, 12 * sgn); ctx.moveTo(8, 10 * sgn); ctx.lineTo(10, 14 * sgn); ctx.stroke(); }
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(15, -1.5); ctx.lineTo(18, -1.2); ctx.moveTo(15, 1.5); ctx.lineTo(18, 1.2); ctx.stroke();
      dot(14, -2, 0.9, e.provoked ? '#ff3b2f' : '#111'); dot(14, 2, 0.9, e.provoked ? '#ff3b2f' : '#111'); break;
    default: dot(0, 0, 6, '#999');
  }
}

function drawProjectile(ctx, pr) {
  const x = pr.x * TS, y = pr.y * TS;
  ctx.save(); ctx.translate(x, y);
  switch (pr.kind) {
    case 'fire': {
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, 10);
      g.addColorStop(0, '#fff3b0'); g.addColorStop(0.4, '#ff8a2a'); g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.fill(); break;
    }
    case 'water': {
      const a = Math.atan2(pr.ly - pr.y, pr.lx - pr.x); ctx.rotate(a);
      ctx.fillStyle = 'rgba(120,200,255,0.9)'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 3.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(230,248,255,0.9)'; ctx.beginPath(); ctx.ellipse(2, -1, 4, 1.2, 0, 0, 7); ctx.fill(); break;
    }
    case 'boulder':
      ctx.rotate(pr.rot); ctx.fillStyle = '#7d8088'; roundRect(ctx, -6, -6, 12, 12, 3); ctx.fill();
      ctx.fillStyle = '#a3a7ae'; ctx.fillRect(-5, -5, 6, 4); break;
    case 'air':
      ctx.rotate(pr.rot); ctx.strokeStyle = 'rgba(240,248,255,0.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 1.3); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 3.5, Math.PI, Math.PI * 2.4); ctx.stroke(); break;
    case 'lightning': {
      const a = Math.atan2(pr.ly - pr.y, pr.lx - pr.x); ctx.rotate(a);
      ctx.strokeStyle = 'rgba(200,230,255,0.95)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-14, 0); for (let k = 1; k <= 5; k++) ctx.lineTo(-14 + k * 4, (k % 2 ? -3 : 3) * Math.sin(pr.rot * 3 + k)); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(6, 0, 3, 0, 7); ctx.fill(); break;
    }
    case 'bolt': {
      const a = Math.atan2(pr.ly - pr.y, pr.lx - pr.x); ctx.rotate(a);
      ctx.strokeStyle = '#d9c38a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(5, 0); ctx.stroke();
      ctx.fillStyle = '#9aa0a8'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(4, -2.5); ctx.lineTo(4, 2.5); ctx.closePath(); ctx.fill(); break;
    }
    case 'sand':
      ctx.fillStyle = 'rgba(224,196,138,0.9)'; ctx.beginPath(); ctx.arc(0, 0, 5, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(194,160,102,0.7)'; ctx.beginPath(); ctx.arc(-4, 2, 3, 0, 7); ctx.fill(); break;
    default: break;
  }
  ctx.restore();
}

function render(G, ctx, canvas, t) {
  const { w, h, dpr } = G.view;
  const z = G.cam.zoom;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0d1214'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (G.terrainDirty || !G.tcan) renderTerrain(G);
  ctx.setTransform(dpr * z, 0, 0, dpr * z, -G.cam.x * z * dpr, -G.cam.y * z * dpr);
  ctx.imageSmoothingEnabled = z < 1;
  ctx.drawImage(G.tcan, 0, 0);
  const x0 = clamp(Math.floor(G.cam.x / TS) - 1, 0, W - 1), y0 = clamp(Math.floor(G.cam.y / TS) - 1, 0, H - 1);
  const x1 = clamp(Math.ceil((G.cam.x + w / z) / TS) + 1, 0, W - 1), y1 = clamp(Math.ceil((G.cam.y + h / z) / TS) + 1, 0, H - 1);
  // Water shimmer & zones
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = idx(x, y), px = x * TS, py = y * TS;
    if (G.terrain[i] === T.WATER) {
      ctx.strokeStyle = `rgba(200,235,255,${0.18 + 0.12 * Math.sin(t * 1.7 + x * 0.9 + y * 0.6)})`; ctx.lineWidth = 1.2;
      const o = (Math.sin(t + x + y * 2) + 1) * 4;
      ctx.beginPath(); ctx.moveTo(px + 4 + o, py + 10); ctx.lineTo(px + 14 + o, py + 10); ctx.moveTo(px + 10 - o / 2, py + 22); ctx.lineTo(px + 20 - o / 2, py + 22); ctx.stroke();
    }
    if (G.terrain[i] === T.GRASS && G.forage[i] < 0.5) { ctx.fillStyle = `rgba(190,165,80,${(0.5 - G.forage[i]) * 0.7})`; ctx.fillRect(px, py, TS, TS); }
    const zn = G.zone[i];
    if (zn) {
      ctx.fillStyle = zn === 'stock' ? 'rgba(232,196,120,0.16)' : zn === 'cabbage' ? 'rgba(140,220,90,0.14)' : zn === 'grove' ? 'rgba(60,140,80,0.16)' : 'rgba(255,220,240,0.14)';
      ctx.fillRect(px, py, TS, TS);
      ctx.strokeStyle = zn === 'stock' ? 'rgba(232,196,120,0.55)' : zn === 'cabbage' ? 'rgba(140,220,90,0.5)' : zn === 'grove' ? 'rgba(90,190,110,0.6)' : 'rgba(255,200,230,0.55)';
      ctx.lineWidth = 1;
      for (const [dx, dy] of DIRS4) {
        const nx = x + dx, ny = y + dy;
        if (inB(nx, ny) && G.zone[idx(nx, ny)] === zn) continue;
        ctx.beginPath();
        if (dx === 1) { ctx.moveTo(px + TS - 0.5, py); ctx.lineTo(px + TS - 0.5, py + TS); }
        if (dx === -1) { ctx.moveTo(px + 0.5, py); ctx.lineTo(px + 0.5, py + TS); }
        if (dy === 1) { ctx.moveTo(px, py + TS - 0.5); ctx.lineTo(px + TS, py + TS - 0.5); }
        if (dy === -1) { ctx.moveTo(px, py + 0.5); ctx.lineTo(px + TS, py + 0.5); }
        ctx.stroke();
      }
    }
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = idx(x, y), px = x * TS, py = y * TS;
    if (G.plants[i]) drawPlant(ctx, G.plants[i], px, py, t);
    if (G.items[i]) drawItem(ctx, G.items[i], px, py, z);
    if (G.struct[i]) drawStruct(ctx, G, G.struct[i], i, px, py, t);
  }
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = idx(x, y), px = x * TS, py = y * TS;
    if (G.tree[i]) drawTree(ctx, i, px, py, t, G.tree[i]);
    const d = G.desig[i];
    if (d) {
      ctx.save(); ctx.translate(px + TS / 2, py + TS / 2);
      ctx.fillStyle = 'rgba(15,18,22,0.6)'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill();
      ctx.strokeStyle = d === 'mine' ? '#ffcf5a' : '#ff9a5a'; ctx.lineWidth = 2;
      if (d === 'mine') { ctx.beginPath(); ctx.arc(0, 2, 6, Math.PI * 1.15, Math.PI * 1.85); ctx.moveTo(0, -4); ctx.lineTo(0, 6); ctx.stroke(); }
      else { ctx.beginPath(); ctx.moveTo(-3, 6); ctx.lineTo(2, -5); ctx.stroke(); ctx.fillStyle = '#ff9a5a'; ctx.beginPath(); ctx.moveTo(1, -6); ctx.lineTo(6, -3); ctx.lineTo(3, 1); ctx.closePath(); ctx.fill(); }
      ctx.restore();
    }
  }
  const ents = [...G.pawns.filter((p) => !p.dead), ...G.enemies].sort((a, b) => a.y - b.y);
  for (const e of ents) { if (e.kind === 'colonist') drawColonist(ctx, G, e, t, z); else drawEnemy(ctx, G, e, t, z); }
  for (const pr of G.proj) drawProjectile(ctx, pr);
  for (const P of G.parts) {
    ctx.globalAlpha = clamp(P.life / P.max, 0, 1);
    ctx.fillStyle = P.color;
    ctx.beginPath(); ctx.arc(P.x * TS, P.y * TS, P.size * (P.kind === 'dust' ? 1.3 - P.life / P.max * 0.5 : 1), 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const f of G.floats) {
    ctx.globalAlpha = clamp(f.t, 0, 1);
    ctx.font = 'bold 10px ui-sans-serif, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillText(f.text, f.x * TS + 1, f.y * TS + 1);
    ctx.fillStyle = f.color; ctx.fillText(f.text, f.x * TS, f.y * TS);
  }
  ctx.globalAlpha = 1;
  // Heatwave haze
  if (G.ev.heatwave > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(255,150,40,${0.07 + Math.sin(t * 2) * 0.02})`; ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  // Night lighting
  const dk = darkness(G);
  if (dk > 0.01) {
    const dc = G.dark || (G.dark = document.createElement('canvas'));
    if (dc.width !== canvas.width || dc.height !== canvas.height) { dc.width = canvas.width; dc.height = canvas.height; }
    const g = dc.getContext('2d');
    g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, dc.width, dc.height);
    g.fillStyle = G.ev.fullmoon > 0 ? `rgba(18,32,70,${dk})` : `rgba(8,12,34,${dk})`;
    g.fillRect(0, 0, dc.width, dc.height);
    g.globalCompositeOperation = 'destination-out';
    const toS = (wx, wy) => [(wx * TS - G.cam.x) * z * dpr, (wy * TS - G.cam.y) * z * dpr];
    const light = (wx, wy, rad, a) => {
      const [sx, sy] = toS(wx, wy); const R = rad * TS * z * dpr;
      const gr = g.createRadialGradient(sx, sy, 0, sx, sy, R);
      gr.addColorStop(0, `rgba(0,0,0,${a})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(sx - R, sy - R, R * 2, R * 2);
    };
    for (const i of G._lit || []) light((i % W) + 0.5, ((i / W) | 0) + 0.5, 5.5 + Math.sin(t * 9) * 0.15, 1);
    for (const p of G.pawns) if (!p.dead) light(p.x, p.y, 1.8, 0.55);
    for (const pr of G.proj) if (pr.kind === 'fire') light(pr.x, pr.y, 2, 0.8);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(dc, 0, 0);
    ctx.globalCompositeOperation = 'lighter';
    for (const i of G._lit || []) {
      const [sx, sy] = toS((i % W) + 0.5, ((i / W) | 0) + 0.5); const R = 3.5 * TS * z * dpr;
      const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, R);
      gr.addColorStop(0, `rgba(255,140,40,${0.22 * dk})`); gr.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = gr; ctx.fillRect(sx - R, sy - R, R * 2, R * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // Tool overlays
  ctx.setTransform(dpr * z, 0, 0, dpr * z, -G.cam.x * z * dpr, -G.cam.y * z * dpr);
  if (G.drag) {
    for (const [x, y, ok] of toolCells(G, G.tool, G.drag.x0, G.drag.y0, G.drag.x1, G.drag.y1)) {
      ctx.fillStyle = ok ? 'rgba(127,220,160,0.28)' : 'rgba(255,90,90,0.18)'; ctx.fillRect(x * TS, y * TS, TS, TS);
    }
  }
  if (G.hover && inB(G.hover.x, G.hover.y)) {
    const ok = G.tool === 'select' || G.tool === 'hunt' || G.tool === 'tameTool' || toolValid(G, G.tool, idx(G.hover.x, G.hover.y));
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.7)' : 'rgba(255,100,100,0.7)'; ctx.lineWidth = 1.5;
    ctx.strokeRect(G.hover.x * TS + 1, G.hover.y * TS + 1, TS - 2, TS - 2);
  }
  if (G.selected && G.selected.kind === 'tile') {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]);
    ctx.strokeRect(G.selected.x * TS + 1, G.selected.y * TS + 1, TS - 2, TS - 2); ctx.setLineDash([]);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 3; ctx.strokeRect(0, 0, W * TS, H * TS);
}

function clampCam(G) {
  const { w, h } = G.view, z = G.cam.zoom;
  const mw = W * TS, mh = H * TS, pad = 160 / z;
  const vw = w / z, vh = h / z;
  G.cam.x = vw > mw + pad * 2 ? (mw - vw) / 2 : clamp(G.cam.x, -pad, mw - vw + pad);
  G.cam.y = vh > mh + pad * 2 ? (mh - vh) / 2 : clamp(G.cam.y, -pad, mh - vh + pad);
}

// ============================================================================
// React HUD
// ============================================================================
function Bar({ value, color, label, icon: Icon }) {
  return (
    <div className="flex items-center gap-2">
      {Icon && <Icon size={13} className="shrink-0 text-stone-300" />}
      <span className="w-16 shrink-0 text-[11px] text-stone-300">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-800">
        <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${clamp(value, 0, 100)}%`, background: color }} />
      </div>
      <span className="w-7 shrink-0 text-right text-[11px] tabular-nums text-stone-300">{Math.round(value)}</span>
    </div>
  );
}

function pawnStatus(p) {
  if (p.dead) return { text: 'Deceased', key: 'dead' };
  if (p.downed) return { text: p.carriedBy ? 'Being carried' : p.injuries.some((j) => j.bleeding) ? 'Downed · bleeding' : 'Downed', key: 'downed' };
  if (p.mental) return { text: p.mental.type, key: 'mental' };
  if (p.job) return { text: p.job.label || p.job.type, key: p.job.type };
  return { text: 'Idle', key: 'idle' };
}

function DayDial({ G }) {
  const h = hourOf(G);
  const a = (h / 24) * Math.PI * 2 - Math.PI / 2;
  const night = isNight(G) || darkness(G) > 0.3;
  const nx = 20 + Math.cos(a) * 14, ny = 20 + Math.sin(a) * 14;
  const arc = (h0, h1) => {
    const a0 = (h0 / 24) * Math.PI * 2 - Math.PI / 2, a1 = (h1 / 24) * Math.PI * 2 - Math.PI / 2;
    return `M ${20 + Math.cos(a0) * 16} ${20 + Math.sin(a0) * 16} A 16 16 0 ${h1 - h0 > 12 ? 1 : 0} 1 ${20 + Math.cos(a1) * 16} ${20 + Math.sin(a1) * 16}`;
  };
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-label={`Time ${clockStr(G)}`}>
      <circle cx="20" cy="20" r="16" fill="#1b2328" stroke="#e8c37a55" strokeWidth="4" />
      <path d={arc(21, 29.5)} stroke="#38418a" strokeWidth="4" fill="none" />
      <line x1="20" y1="20" x2={nx} y2={ny} stroke="#f6e7c1" strokeWidth="1.5" />
      <circle cx={nx} cy={ny} r="4" fill={night ? (G.ev.fullmoon > 0 ? '#e7f1ff' : '#b9c3d9') : '#ffcf5a'} />
    </svg>
  );
}

const WHO = {
  iroh: { name: 'Uncle Iroh', cls: 'text-amber-300' },
  azula: { name: 'Azula', cls: 'text-rose-400' },
  info: { name: 'Colony', cls: 'text-stone-400' },
  plan: { name: 'Colonist', cls: 'text-stone-200' },
};

export default function AvatarColony() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [seed, setSeed] = useState(() => (Math.random() * 1e9) | 0);
  const memRef = useRef(null);
  if (!memRef.current) memRef.current = loadMemory();
  const lastRecRef = useRef(null);
  const carryRef = useRef({ speed: 0, lastSpeed: 1, freeWill: true });
  const G = useMemo(() => {
    const m = memRef.current, c = carryRef.current;
    const g = createGame(seed, m.genome, m.gen, lastRecRef.current);
    g.speed = c.speed; g.lastSpeed = c.lastSpeed; g.freeWill = c.freeWill;
    return g;
  }, [seed]);
  const [showLineage, setShowLineage] = useState(false);
  const [showResearch, setShowResearch] = useState(false);
  const [confirmForget, setConfirmForget] = useState(false);
  const nextRef = useRef(null);
  const gRef = useRef(G); gRef.current = G;
  const [, force] = useState(0);
  const [tool, setToolState] = useState('select');
  const [cat, setCat] = useState('orders');
  const [showHelp, setShowHelp] = useState(true);
  const [freeWill, setFreeWillState] = useState(true);
  const [showLog, setShowLog] = useState(() => typeof window === 'undefined' || window.innerWidth > 640);
  const toolRef = useRef(setToolState);

  const setTool = (tl) => { G.tool = tl; G.drag = null; setToolState(tl); };
  toolRef.current = setTool;

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    const ctx = canvas.getContext('2d');
    if (globalThis.__COLONY_DEBUG__) globalThis.__colony = { G, mem: memRef.current, sim: { update, fireEvent, applyTool } };
    let raf, last = performance.now(), hudT = 0;
    const keys = new Set();
    const resize = () => {
      const r = wrap.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
      G.view = { w: r.width, h: r.height, dpr };
      canvas.width = Math.max(1, Math.floor(r.width * dpr)); canvas.height = Math.max(1, Math.floor(r.height * dpr));
      canvas.style.width = `${r.width}px`; canvas.style.height = `${r.height}px`;
      if (!G.camCentered) { G.cam.x = 20 * TS - r.width / 2 / G.cam.zoom; G.cam.y = 20 * TS - r.height / 2 / G.cam.zoom; G.camCentered = true; }
      clampCam(G);
    };
    const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
    const frame = (now) => {
      const rdt = Math.min(0.1, (now - last) / 1000); last = now;
      let kx = 0, ky = 0;
      if (keys.has('a') || keys.has('arrowleft')) kx -= 1; if (keys.has('d') || keys.has('arrowright')) kx += 1;
      if (keys.has('w') || keys.has('arrowup')) ky -= 1; if (keys.has('s') || keys.has('arrowdown')) ky += 1;
      if (kx || ky) { G.cam.x += (kx * 620 * rdt) / G.cam.zoom; G.cam.y += (ky * 620 * rdt) / G.cam.zoom; clampCam(G); }
      if (G.speed > 0 && !G.over) {
        let sim = rdt * SPEEDS[G.speed];
        while (sim > 1e-6 && !G.over) { const s = Math.min(0.05, sim); update(G, s); sim -= s; }
      }
      // A fallen colony becomes a lesson, then the next generation begins on its own.
      if (G.over && !G.learned) {
        G.learned = true;
        G.report = learnFromFall(memRef.current, chronicle(G), Math.random);
        lastRecRef.current = G.report;
        saveMemory(memRef.current);
        G.restartIn = 12; G.hold = false;
      }
      if (G.over && G.learned && !G.hold) { G.restartIn -= rdt; if (G.restartIn <= 0 && nextRef.current) { G.hold = true; nextRef.current(); } }
      G.anim = (G.anim || 0) + rdt * (G.speed > 0 ? 1 : 0.25);
      render(G, ctx, canvas, G.anim);
      hudT += rdt; if (hudT > 0.2) { hudT = 0; force((v) => (v + 1) % 1e9); }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    const screen = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    const toWorld = (sx, sy) => [(sx / G.cam.zoom + G.cam.x) / TS, (sy / G.cam.zoom + G.cam.y) / TS];
    const onDown = (e) => {
      canvas.setPointerCapture(e.pointerId);
      const [sx, sy] = screen(e);
      const [wx, wy] = toWorld(sx, sy);
      const st = { sx, sy, btn: e.button, moved: false, camX: G.cam.x, camY: G.cam.y };
      st.mode = e.button !== 0 || G.tool === 'select' || G.tool === 'hunt' || G.tool === 'tameTool' ? 'pan' : 'drag';
      if (st.mode === 'drag') { const tx = Math.floor(wx), ty = Math.floor(wy); G.drag = { x0: tx, y0: ty, x1: tx, y1: ty }; }
      G.ptr = st;
    };
    const onMove = (e) => {
      const [sx, sy] = screen(e);
      const [wx, wy] = toWorld(sx, sy);
      G.hover = { x: Math.floor(wx), y: Math.floor(wy) };
      const st = G.ptr; if (!st) return;
      if (Math.hypot(sx - st.sx, sy - st.sy) > 5) st.moved = true;
      if (st.mode === 'pan' && st.moved) { G.cam.x = st.camX - (sx - st.sx) / G.cam.zoom; G.cam.y = st.camY - (sy - st.sy) / G.cam.zoom; clampCam(G); }
      if (st.mode === 'drag' && G.drag) { G.drag.x1 = clamp(Math.floor(wx), 0, W - 1); G.drag.y1 = clamp(Math.floor(wy), 0, H - 1); }
    };
    const onUp = (e) => {
      const st = G.ptr; G.ptr = null;
      if (!st) return;
      const [sx, sy] = screen(e);
      const [wx, wy] = toWorld(sx, sy);
      if (st.mode === 'drag' && G.drag) { applyTool(G, G.tool, G.drag.x0, G.drag.y0, G.drag.x1, G.drag.y1); G.drag = null; return; }
      if (st.moved) return;
      if (st.btn === 2) { toolRef.current('select'); return; }
      if (st.btn !== 0) return;
      const near = (list, r) => { let best = null, bd = r; for (const en of list) { const d = Math.hypot(en.x - wx, en.y - wy); if (d < bd) { bd = d; best = en; } } return best; };
      if (G.tool === 'hunt' || G.tool === 'tameTool') {
        const a = near(G.enemies.filter((en) => en.faction === 'animal' && !en.tame), 1.2);
        if (a && G.tool === 'hunt') { a.hunted = true; a.tameDesig = false; log(G, `The ${a.name} has been marked for hunting.`, 'info'); }
        if (a && G.tool === 'tameTool') { a.tameDesig = true; a.hunted = false; log(G, hasTech(G, 'husbandry') ? `The ${a.name} has been marked for taming.` : `The ${a.name} is marked for taming, but nobody knows how yet. Research Animal Husbandry.`, 'info'); }
        return;
      }
      const p = near(G.pawns.filter((q) => !q.dead), 0.7);
      if (p) { G.selected = { kind: 'pawn', id: p.id }; return; }
      const en = near(G.enemies, 0.9);
      if (en) { G.selected = { kind: 'enemy', id: en.id }; return; }
      const tx = Math.floor(wx), ty = Math.floor(wy);
      G.selected = inB(tx, ty) ? { kind: 'tile', x: tx, y: ty } : null;
    };
    const onWheel = (e) => {
      e.preventDefault();
      const [sx, sy] = screen(e);
      const before = [sx / G.cam.zoom + G.cam.x, sy / G.cam.zoom + G.cam.y];
      G.cam.zoom = clamp(G.cam.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12), 0.45, 2.6);
      G.cam.x = before[0] - sx / G.cam.zoom; G.cam.y = before[1] - sy / G.cam.zoom; clampCam(G);
    };
    const onLeave = () => { G.hover = null; };
    const onCtx = (e) => e.preventDefault();
    const typing = (e) => e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA');
    const onKey = (e) => {
      if (typing(e)) return;
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(k)) { keys.add(k); e.preventDefault(); }
      if (k === ' ') { e.preventDefault(); G.speed = G.speed === 0 ? (G.lastSpeed || 1) : (G.lastSpeed = G.speed, 0); }
      if (k === '1' || k === '2' || k === '3' || k === '4') { G.speed = Number(k); G.lastSpeed = G.speed; }
      if (k === 'escape') { toolRef.current('select'); G.selected = null; }
    };
    const onKeyUp = (e) => keys.delete(e.key.toLowerCase());
    const onBlur = () => keys.clear();
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('pointerleave', onLeave);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', onCtx);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      canvas.removeEventListener('pointerdown', onDown); canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp); canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('pointerleave', onLeave); canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onCtx);
      window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); window.removeEventListener('blur', onBlur);
    };
  }, [G]);

  const setSpeed = (s) => { G.speed = s; if (s > 0) G.lastSpeed = s; force((v) => v + 1); };
  const zoomBy = (f) => {
    const cx = G.view.w / 2, cy = G.view.h / 2;
    const wx = cx / G.cam.zoom + G.cam.x, wy = cy / G.cam.zoom + G.cam.y;
    G.cam.zoom = clamp(G.cam.zoom * f, 0.45, 2.6); G.cam.x = wx - cx / G.cam.zoom; G.cam.y = wy - cy / G.cam.zoom; clampCam(G);
  };
  const focusPawn = (p) => {
    G.selected = { kind: 'pawn', id: p.id };
    G.cam.x = p.x * TS - G.view.w / 2 / G.cam.zoom; G.cam.y = p.y * TS - G.view.h / 2 / G.cam.zoom; clampCam(G);
    force((v) => v + 1);
  };
  const carry = () => { carryRef.current = { speed: G.speed || (G.over ? G.lastSpeed || 1 : 0), lastSpeed: G.lastSpeed || 1, freeWill: G.freeWill }; };
  const nextGeneration = () => { carry(); setTool('select'); setSeed((Math.random() * 1e9) | 0); };
  nextRef.current = nextGeneration;
  const restart = () => { lastRecRef.current = null; carry(); carryRef.current.freeWill = true; setSeed((Math.random() * 1e9) | 0); setShowHelp(false); setToolState('select'); setFreeWillState(true); };
  const forgetLineage = () => {
    memRef.current = newMemory(); saveMemory(memRef.current); lastRecRef.current = null;
    setConfirmForget(false); setShowLineage(false); carry(); setSeed((Math.random() * 1e9) | 0);
  };
  const mem = memRef.current;
  const setFreeWill = (on) => {
    G.freeWill = on; setFreeWillState(on);
    if (on) { setTool('select'); log(G, 'The colonists take charge of their own plans again.', 'iroh'); }
    else log(G, 'You take command. Colonists still work on their own, but only you place orders.', 'info');
  };

  // Derived HUD data
  const res = Object.fromEntries(Object.keys(ITEMS).map((k) => [k, 0]));
  for (const it of G.items) if (it) res[it.type] += it.qty;
  const alive = G.pawns.filter((p) => !p.dead);
  let beds = 0; for (const s of G.struct) if (s && s.built && s.type === 'bed') beds++;
  const alerts = [];
  if (G.raid) alerts.push({ text: `Raid: ${G.enemies.filter((e) => e.faction === 'raider').length} hostiles`, tone: 'bad' });
  if (G.enemies.some((e) => e.type === 'bear' && e.provoked)) alerts.push({ text: 'Platypus-bear is enraged', tone: 'bad' });
  for (const p of alive) if (p.injuries.some((j) => j.bleeding)) alerts.push({ text: `${p.name} is bleeding`, tone: 'bad' });
  for (const p of alive) if (p.harmony < 25 && !p.mental) alerts.push({ text: `${p.name} is near a mental break`, tone: 'warn' });
  if (beds < alive.length) alerts.push({ text: `Need beds (${beds}/${alive.length})`, tone: 'warn' });
  if (res.meal + res.cabbage + res.meat < alive.length * 3) alerts.push({ text: 'Food is running low', tone: 'warn' });
  if (!(G._lit || []).length) alerts.push({ text: 'No lit campfire: no cooking', tone: 'warn' });
  if (G.ev.heatwave > 0 && G.plants.some((pl) => pl && pl.water < 0.2)) alerts.push({ text: 'Crops are drying out', tone: 'warn' });

  const sel = G.selected;
  const selPawn = sel && sel.kind === 'pawn' ? G.pawns.find((p) => p.id === sel.id) : null;
  const selEnemy = sel && sel.kind === 'enemy' ? G.enemies.find((e) => e.id === sel.id) : null;
  if (sel && sel.kind === 'enemy' && !selEnemy) G.selected = null;
  const tdef = TOOLS[tool];

  return (
    <div ref={wrapRef} className="relative h-full min-h-[560px] w-full select-none overflow-hidden bg-[#0d1214] font-sans text-stone-100" style={{ height: '100%' }}>
      <canvas ref={canvasRef} className="absolute inset-0 block touch-none" style={{ cursor: tool === 'select' ? 'grab' : 'crosshair' }} />

      {/* Top: colonist bar */}
      <div className="pointer-events-none absolute left-2 right-2 top-2 flex flex-wrap items-start gap-2">
        <div className="pointer-events-auto flex max-w-full gap-1.5 overflow-x-auto rounded-xl border border-white/10 bg-[#11181b]/85 p-1.5 backdrop-blur">
          {G.pawns.map((p) => {
            const el = ELEMENTS[p.el]; const st = pawnStatus(p); const JI = JOB_ICON[st.key] || Footprints; const EI = el.icon;
            const active = selPawn && selPawn.id === p.id;
            return (
              <button key={p.id} onClick={() => !p.dead && focusPawn(p)}
                className={`flex w-[118px] shrink-0 flex-col gap-1 rounded-lg border px-2 py-1.5 text-left transition-colors ${active ? 'border-white/60 bg-white/10' : 'border-white/5 bg-black/20 hover:bg-white/5'} ${p.dead ? 'opacity-45' : ''}`}>
                <div className="flex items-center gap-1.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: `${el.color}26`, boxShadow: `inset 0 0 0 1.5px ${el.color}` }}>
                    {p.dead ? <Skull size={13} className="text-stone-300" /> : <EI size={13} style={{ color: el.color }} />}
                  </span>
                  <div className="min-w-0 leading-tight">
                    <div className="truncate text-[12px] font-semibold" style={{ color: el.color }}>{p.name}</div>
                    <div className="truncate text-[9.5px] uppercase tracking-wider text-stone-400">{el.name}</div>
                  </div>
                </div>
                <div className="h-1 w-full overflow-hidden rounded bg-stone-800"><div className="h-full" style={{ width: `${p.health}%`, background: p.health > 50 ? '#5bd36a' : p.health > 25 ? '#f2c53d' : '#e8553f' }} /></div>
                <div className="h-1 w-full overflow-hidden rounded bg-stone-800"><div className="h-full bg-sky-400" style={{ width: `${p.chi}%` }} /></div>
                <div className={`flex items-center gap-1 text-[10px] ${st.key === 'downed' || st.key === 'mental' ? 'text-rose-300' : 'text-stone-300'}`}>
                  <JI size={11} className="shrink-0" /><span className="truncate">{st.text}</span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="pointer-events-auto ml-auto flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#11181b]/85 px-2.5 py-1.5 backdrop-blur">
            <DayDial G={G} />
            <div className="leading-tight">
              <div className="text-[11px] uppercase tracking-wider text-stone-400">Day {dayOf(G)}</div>
              <div className="flex items-center gap-1 text-[15px] font-semibold tabular-nums">
                {isNight(G) ? <Moon size={13} className="text-indigo-300" /> : <Sun size={13} className="text-amber-300" />}{clockStr(G)}
              </div>
            </div>
            <div className="ml-1 flex gap-0.5">
              {[[0, Pause, 'Pause (Space)'], [1, Play, '1x (1)'], [2, ChevronsRight, '2x (2)'], [3, FastForward, '3x (3)'], [4, Rocket, '8x (4)']].map(([s, Ic, tl]) => (
                <button key={s} title={tl} aria-label={tl} onClick={() => setSpeed(s)}
                  className={`flex h-8 w-8 items-center justify-center rounded-md border text-[10px] ${G.speed === s ? 'border-amber-300/70 bg-amber-300/20 text-amber-200' : 'border-white/10 bg-black/20 text-stone-300 hover:bg-white/10'}`}>
                  <Ic size={14} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-1 rounded-xl border border-white/10 bg-[#11181b]/85 px-2 py-1 text-[11px] tabular-nums backdrop-blur">
            {Object.entries(res).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1 rounded px-1.5 py-0.5">
                <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ITEMS[k].color }} />
                <span className="text-stone-400">{ITEMS[k].name}</span><span className="font-semibold">{v}</span>
              </span>
            ))}
          </div>
          <button onClick={() => setShowResearch(true)} className="flex items-center gap-1.5 rounded-xl border border-sky-300/30 bg-[#11181b]/85 px-2.5 py-1 text-[11px] text-sky-200 backdrop-blur hover:bg-sky-400/10">
            <FlaskConical size={12} />{ERAS[eraOf(G)]} era
            <span className="text-stone-400">{G.research.target ? `· ${TECHS[G.research.target].name} ${Math.floor((G.research.progress / TECHS[G.research.target].cost) * 100)}%` : G.tech.size === Object.keys(TECHS).length ? '· every discovery made' : countStruct(G, 'desk', true) ? '· choosing a study' : '· no scroll desk yet'}</span>
          </button>
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#11181b]/85 px-2.5 py-1 text-[11px] text-stone-300 backdrop-blur">
            <TreePine size={12} className="text-emerald-300" />
            {(() => { const a = G.enemies.filter((e) => e.faction === 'animal' && !e.dead); return `${a.filter((e) => !e.tame && SPECIES[e.type].diet === 'herb').length} grazers · ${a.filter((e) => !e.tame && SPECIES[e.type].diet !== 'herb').length} predators · ${a.filter((e) => e.tame).length} tamed`; })()}
          </div>
          <button onClick={() => setShowLineage(true)} className="flex items-center gap-1.5 rounded-xl border border-violet-300/30 bg-[#11181b]/85 px-2.5 py-1 text-[11px] text-violet-200 backdrop-blur hover:bg-violet-400/10">
            <GitBranch size={12} />Generation {G.gen}
            <span className="text-stone-400">{mem.best ? `· best ${mem.best.days.toFixed(1)} days (gen ${mem.best.gen})` : '· first of the lineage'}</span>
          </button>
          <div className="flex flex-wrap justify-end gap-1">
            {G.ev.fullmoon > 0 && <span className="flex items-center gap-1 rounded-full border border-sky-300/40 bg-sky-400/15 px-2 py-0.5 text-[11px] text-sky-200"><Moon size={11} />Full Moon {Math.ceil(G.ev.fullmoon)}s</span>}
            {G.ev.heatwave > 0 && <span className="flex items-center gap-1 rounded-full border border-orange-300/40 bg-orange-400/15 px-2 py-0.5 text-[11px] text-orange-200"><Sun size={11} />Heatwave {Math.ceil(G.ev.heatwave)}s</span>}
            {G.raid && <span className="flex items-center gap-1 rounded-full border border-rose-300/50 bg-rose-500/20 px-2 py-0.5 text-[11px] text-rose-200"><Swords size={11} />Raid in progress</span>}
            {G.enemies.some((e) => e.type === 'bear') && <span className="flex items-center gap-1 rounded-full border border-amber-200/40 bg-amber-700/20 px-2 py-0.5 text-[11px] text-amber-100"><AlertTriangle size={11} />Platypus-bear</span>}
          </div>
          <div className="flex max-w-[230px] flex-col items-end gap-1">
            {alerts.slice(0, 6).map((a, k) => (
              <span key={k} className={`rounded-md px-2 py-0.5 text-[11px] ${a.tone === 'bad' ? 'bg-rose-600/80 text-white' : 'bg-amber-500/25 text-amber-100'}`}>{a.text}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Banner */}
      {G.banner && (
        <div className="pointer-events-none absolute left-1/2 top-[118px] w-[min(520px,calc(100%-32px))] -translate-x-1/2 rounded-xl border px-4 py-2.5 text-center shadow-2xl backdrop-blur"
          style={{ background: G.banner.who === 'azula' ? 'rgba(60,14,20,0.88)' : 'rgba(48,36,14,0.88)', borderColor: G.banner.who === 'azula' ? '#f43f5e88' : '#fbbf2488', opacity: Math.min(1, G.banner.t) }}>
          <div className={`text-[10px] uppercase tracking-[0.18em] ${WHO[G.banner.who].cls}`}>{WHO[G.banner.who].name}</div>
          <div className="text-[16px] font-semibold">{G.banner.title}</div>
          <div className="text-[12px] text-stone-200">{G.banner.text}</div>
        </div>
      )}

      {/* Storyteller log */}
      <div className="absolute bottom-[104px] left-2 w-[min(300px,calc(100%-16px))]">
        <button onClick={() => setShowLog((v) => !v)} className="mb-1 flex items-center gap-1 rounded-md border border-white/10 bg-[#11181b]/85 px-2 py-1 text-[11px] text-stone-300 hover:bg-white/10">
          <ScrollText size={12} />Storyteller{showLog ? '' : ` (${G.log.length})`}
        </button>
        {showLog && (
          <div className="max-h-[180px] overflow-y-auto rounded-xl border border-white/10 bg-[#11181b]/85 p-2 text-[11px] leading-snug backdrop-blur">
            {G.log.slice(0, 14).map((l) => (
              <div key={l.id} className="border-b border-white/5 py-1 last:border-0">
                <span className="mr-1 tabular-nums text-stone-500">D{l.day} {l.clock}</span>
                <span className={WHO[l.who].cls} style={l.color ? { color: l.color } : undefined}>{l.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inspector */}
      {(selPawn || selEnemy || (sel && sel.kind === 'tile')) && (
        <div className="absolute bottom-[104px] right-2 max-h-[calc(100%-260px)] min-h-[120px] w-[min(300px,calc(100%-16px))] overflow-y-auto rounded-xl border border-white/10 bg-[#11181b]/92 p-3 text-[12px] shadow-2xl backdrop-blur">
          <button aria-label="Close inspector" onClick={() => { G.selected = null; force((v) => v + 1); }} className="absolute right-2 top-2 rounded p-1 text-stone-400 hover:bg-white/10 hover:text-white"><X size={14} /></button>
          {selPawn && <PawnInspector G={G} p={selPawn} />}
          {selEnemy && <EnemyInspector G={G} e={selEnemy} />}
          {sel && sel.kind === 'tile' && <TileInspector G={G} x={sel.x} y={sel.y} />}
        </div>
      )}

      {/* Free will bar: the colony runs itself, the player watches */}
      {freeWill && (
        <div className="absolute bottom-2 left-1/2 flex w-[min(860px,calc(100%-16px))] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-[#11181b]/90 px-3 py-2 backdrop-blur">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-emerald-400/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-emerald-200"><Sparkles size={12} />Free will</span>
          <span className="min-w-0 flex-1 text-[12px] text-stone-300"><Eye size={12} className="mr-1 inline align-[-2px] text-stone-400" />The colonists plan, build, farm and defend on their own. Watch, click anyone to inspect them, and set the speed.</span>
          <div className="ml-auto flex items-center gap-1">
            <button title="Zoom out" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)} className="rounded-md p-1.5 text-stone-300 hover:bg-white/10"><ZoomOut size={14} /></button>
            <button title="Zoom in" aria-label="Zoom in" onClick={() => zoomBy(1.2)} className="rounded-md p-1.5 text-stone-300 hover:bg-white/10"><ZoomIn size={14} /></button>
            <button title="How to play" aria-label="How to play" onClick={() => { setShowHelp(true); setSpeed(0); }} className="rounded-md p-1.5 text-stone-300 hover:bg-white/10"><HelpCircle size={14} /></button>
            <button title="New map" aria-label="New map" onClick={restart} className="rounded-md p-1.5 text-stone-300 hover:bg-white/10"><RotateCcw size={14} /></button>
            <button onClick={() => setFreeWill(false)} className="flex items-center gap-1 rounded-md border border-white/10 px-2 py-1 text-[11px] text-stone-300 hover:bg-white/10"><Hammer size={12} />Give orders</button>
          </div>
        </div>
      )}

      {/* Bottom action bar (only when the player has taken command) */}
      {!freeWill && (
      <div className="absolute bottom-2 left-1/2 w-[min(860px,calc(100%-16px))] -translate-x-1/2 rounded-xl border border-white/10 bg-[#11181b]/90 p-1.5 backdrop-blur">
        <div className="mb-1 flex items-center gap-1">
          {CATS.map(([k, l]) => (
            <button key={k} onClick={() => setCat(k)} className={`rounded-md px-2.5 py-1 text-[11px] uppercase tracking-wider ${cat === k ? 'bg-white/15 text-white' : 'text-stone-400 hover:bg-white/5'}`}>{l}</button>
          ))}
          <div className="ml-auto flex items-center gap-1">
            <button title="Zoom out" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)} className="rounded-md p-1.5 text-stone-300 hover:bg-white/10"><ZoomOut size={14} /></button>
            <button title="Zoom in" aria-label="Zoom in" onClick={() => zoomBy(1.2)} className="rounded-md p-1.5 text-stone-300 hover:bg-white/10"><ZoomIn size={14} /></button>
            <button title="How to play" aria-label="How to play" onClick={() => { setShowHelp(true); setSpeed(0); }} className="rounded-md p-1.5 text-stone-300 hover:bg-white/10"><HelpCircle size={14} /></button>
            <button title="New map" aria-label="New map" onClick={restart} className="rounded-md p-1.5 text-stone-300 hover:bg-white/10"><RotateCcw size={14} /></button>
            <button onClick={() => setFreeWill(true)} className="flex items-center gap-1 rounded-md border border-emerald-300/40 bg-emerald-400/10 px-2 py-1 text-[11px] text-emerald-200 hover:bg-emerald-400/20"><Sparkles size={12} />Free will</button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {Object.entries(TOOLS).filter(([k, d]) => d.cat === cat || k === 'select').map(([k, d]) => {
            const Ic = d.icon; const s = d.struct && STRUCTS[d.struct];
            return (
              <button key={k} onClick={() => setTool(k)}
                className={`flex min-w-[78px] shrink-0 flex-col items-center gap-0.5 rounded-lg border px-2 py-1.5 text-[11px] ${tool === k ? 'border-amber-300/70 bg-amber-300/15 text-amber-100' : 'border-white/5 bg-black/20 text-stone-200 hover:bg-white/10'}`}>
                <Ic size={16} />
                <span className="whitespace-nowrap">{d.label}</span>
                {s && <span className="text-[9.5px] text-stone-400">{s.cost} {s.mat}</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-1 truncate px-1 text-[11px] text-stone-400">{tdef.hint}</div>
      </div>
      )}

      {/* Help */}
      {showHelp && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-4">
          <div className="max-h-full w-[min(560px,100%)] overflow-y-auto rounded-2xl border border-amber-200/20 bg-[#141c1f] p-5 shadow-2xl">
            <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300">A colony of the four nations</div>
            <h1 className="mb-2 text-2xl font-semibold text-stone-50">Four Nations Colony</h1>
            <p className="mb-3 text-[13px] text-stone-300">Kanto, Yuka, Ren and Tashi have settled a quiet valley. They have free will and start out naive: they will make mistakes. Every colony that falls teaches the next generation how to do better. You watch their story unfold and set the pace.</p>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(ELEMENTS).map(([k, el]) => { const EI = el.icon; return (
                <div key={k} className="flex gap-2 rounded-lg bg-black/25 p-2">
                  <EI size={16} style={{ color: el.color }} className="mt-0.5 shrink-0" />
                  <div><div className="text-[12px] font-semibold" style={{ color: el.color }}>{el.name}</div><div className="text-[11px] text-stone-400">{el.perk}</div></div>
                </div>
              ); })}
            </div>
            <ul className="mb-4 list-disc space-y-1 pl-5 text-[12px] text-stone-300">
              <li>Space pauses; 1, 2, 3 set the speed. The buttons at the top right do the same.</li>
              <li>Pan with WASD, arrow keys, or by dragging the map. Scroll to zoom.</li>
              <li>Click a colonist portrait or anyone on the map to see their needs, thoughts and wounds.</li>
              <li>Colonists announce their plans in the Storyteller log in their own colours.</li>
              <li>When a colony falls, its mistakes become lessons and the next generation starts on its own. Open Generation (top right) to follow the lineage.</li>
              <li>The valley is alive: grass feeds grazers, and moose-lions hunt grazers. Colonists hunt for meat and tame animals to haul, plough, lay eggs and give milk. They replant the forest they cut.</li>
              <li>Colonists research at a Scroll Desk, from the Ancient era to the Modern era. Open the era button (top right) to see the tree.</li>
              <li>Press 4 for 8x speed to watch generations go by. Give orders (bottom) lets you direct them yourself.</li>
            </ul>
            <button onClick={() => { setShowHelp(false); setSpeed(G.lastSpeed || 1); }} className="w-full rounded-lg bg-amber-400 py-2 text-[14px] font-semibold text-stone-900 hover:bg-amber-300">Watch the colony</button>
          </div>
        </div>
      )}

      {G.over && G.report && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-full w-[min(520px,100%)] overflow-y-auto rounded-2xl border border-violet-300/30 bg-[#16131c] p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-rose-300"><Skull size={14} />Generation {G.report.gen} has fallen</div>
            <h2 className="mb-1 mt-1 text-xl font-semibold">Lost to {CAUSE_TEXT[G.report.cause]} on day {Math.floor(G.report.days) + 1}</h2>
            <p className="mb-3 text-[12px] text-stone-400">They survived {G.report.days.toFixed(1)} days and {G.report.raids} raid{G.report.raids === 1 ? '' : 's'}, reaching the {ERAS[G.report.era || 0]} era with {G.report.techs || 0} discoveries. Their mistakes become the next generation's memory.</p>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-violet-300">Lessons carried forward</div>
            <ul className="mb-3 list-disc space-y-1 pl-5 text-[12px] text-stone-200">
              {G.report.lessons.map((l, k) => <li key={k}>{l}</li>)}
              {G.report.experiment && <li className="text-violet-200">{G.report.experiment}</li>}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={nextGeneration} className="rounded-lg bg-violet-300 px-4 py-2 text-[13px] font-semibold text-stone-900 hover:bg-violet-200">Begin generation {G.report.gen + 1}</button>
              {G.hold
                ? <button onClick={() => { G.hold = false; G.restartIn = 6; force((v) => v + 1); }} className="rounded-lg border border-white/15 px-3 py-2 text-[12px] text-stone-300 hover:bg-white/10">Resume countdown</button>
                : <button onClick={() => { G.hold = true; force((v) => v + 1); }} className="rounded-lg border border-white/15 px-3 py-2 text-[12px] text-stone-300 hover:bg-white/10">Stay on this report</button>}
              {!G.hold && <span className="text-[12px] tabular-nums text-stone-400">Next generation in {Math.max(0, Math.ceil(G.restartIn))}s</span>}
            </div>
          </div>
        </div>
      )}

      {showResearch && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowResearch(false)}>
          <div className="max-h-full w-[min(980px,100%)] overflow-y-auto rounded-2xl border border-sky-300/30 bg-[#12171c] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-sky-300"><FlaskConical size={14} />Research</div>
              <button aria-label="Close research" onClick={() => setShowResearch(false)} className="rounded p-1 text-stone-400 hover:bg-white/10 hover:text-white"><X size={14} /></button>
            </div>
            <h2 className="mb-1 text-xl font-semibold">{ERAS[eraOf(G)]} era · {G.tech.size} of {Object.keys(TECHS).length} discoveries</h2>
            <p className="mb-3 text-[12px] text-stone-400">
              Colonists study at the Scroll Desk; Non-Benders learn fastest. {freeWill
                ? `With free will, they choose what to study themselves. This generation favours ${G.genome.researchFocus} research.`
                : 'You are giving orders: click any available discovery to study it next.'}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {ERAS.map((era, ei) => (
                <div key={era} className="flex min-w-0 flex-col gap-2">
                  <div className={`text-[11px] font-semibold uppercase tracking-wider ${ei <= eraOf(G) ? 'text-sky-200' : 'text-stone-500'}`}>{era}</div>
                  {Object.entries(TECHS).filter(([, t]) => t.era === ei).map(([k, t]) => {
                    const done = G.tech.has(k), cur = G.research.target === k, avail = !done && t.req.every((r) => G.tech.has(r));
                    const cls = done ? 'border-sky-300/40 bg-sky-400/15' : cur ? 'border-amber-300/70 bg-amber-300/10' : avail ? 'border-white/20 bg-black/25' : 'border-white/5 bg-black/20 opacity-50';
                    return (
                      <button key={k} disabled={freeWill || !avail} onClick={() => { G.research.target = k; G.research.progress = 0; force((v) => v + 1); }}
                        className={`rounded-lg border p-2 text-left ${cls} ${!freeWill && avail ? 'hover:border-amber-300/70' : ''}`}>
                        <div className="flex items-center justify-between gap-1 text-[12px] font-semibold">
                          <span>{t.name}</span><span className="text-[10px] font-normal tabular-nums text-stone-400">{done ? 'Known' : `${t.cost} pts`}</span>
                        </div>
                        <div className="text-[10.5px] leading-snug text-stone-400">{t.desc}</div>
                        {t.req.length > 0 && !done && <div className="mt-0.5 text-[10px] text-stone-500">Needs {t.req.map((r) => TECHS[r].name).join(', ')}</div>}
                        {cur && <div className="mt-1 h-1.5 overflow-hidden rounded bg-stone-800"><div className="h-full bg-amber-300" style={{ width: `${(G.research.progress / t.cost) * 100}%` }} /></div>}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showLineage && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowLineage(false)}>
          <div className="max-h-full w-[min(620px,100%)] overflow-y-auto rounded-2xl border border-violet-300/30 bg-[#14161c] p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-violet-300"><GitBranch size={14} />Lineage</div>
              <button aria-label="Close lineage" onClick={() => setShowLineage(false)} className="rounded p-1 text-stone-400 hover:bg-white/10 hover:text-white"><X size={14} /></button>
            </div>
            <h2 className="mb-1 text-xl font-semibold">Generation {G.gen}</h2>
            <p className="mb-3 text-[12px] text-stone-400">Every fallen colony passes its lessons on. Each generation also tries one small experiment, which may turn out to be a mistake.</p>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-stone-400">Habits of this generation</div>
            <ul className="mb-4 space-y-0.5 text-[12px] text-stone-200">
              {describeGenome(G.genome).map((d, k) => <li key={k} className="flex gap-2"><span className="text-violet-300">·</span>{d}</li>)}
            </ul>
            <div className="mb-1 text-[10px] uppercase tracking-wider text-stone-400">Days survived per generation</div>
            <LineageChart history={mem.history} current={G} />
            <div className="mt-3 flex flex-col gap-2">
              {[...mem.history].reverse().map((h) => (
                <details key={h.gen} className="rounded-lg bg-black/25 px-3 py-2 text-[12px]">
                  <summary className="cursor-pointer select-none">
                    <span className="font-semibold">Gen {h.gen}</span>
                    <span className="text-stone-400"> · {h.days.toFixed(1)} days · {ERAS[h.era || 0]} era · fell to {CAUSE_TEXT[h.cause]}{mem.best && mem.best.gen === h.gen ? ' · best so far' : ''}</span>
                  </summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-stone-300">
                    {(h.lessons || []).map((l, k) => <li key={k}>{l}</li>)}
                    {h.experiment && <li className="text-violet-200">{h.experiment}</li>}
                  </ul>
                </details>
              ))}
              {!mem.history.length && <div className="text-[12px] text-stone-500">No colony has fallen yet. This is the first generation.</div>}
            </div>
            <div className="mt-4 flex items-center gap-2">
              {confirmForget
                ? <>
                    <span className="text-[12px] text-rose-200">Erase every lesson and start again from generation 1?</span>
                    <button onClick={forgetLineage} className="rounded-md bg-rose-400 px-3 py-1 text-[12px] font-semibold text-stone-900 hover:bg-rose-300">Erase lineage</button>
                    <button onClick={() => setConfirmForget(false)} className="rounded-md border border-white/15 px-3 py-1 text-[12px] text-stone-300 hover:bg-white/10">Keep it</button>
                  </>
                : <button onClick={() => setConfirmForget(true)} className="rounded-md border border-white/15 px-3 py-1 text-[12px] text-stone-300 hover:bg-white/10">Forget the lineage</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LineageChart({ history, current }) {
  const bars = [...history.map((h) => ({ gen: h.gen, days: h.days, cause: h.cause, live: false })),
    { gen: current.gen, days: current.time / DAY_LEN, cause: null, live: !current.over }].filter((b) => b.live || history.some((h) => h.gen === b.gen)).slice(-24);
  const max = Math.max(5, ...bars.map((b) => b.days));
  const color = { raid: '#f87171', bear: '#d6a35c', starvation: '#facc15', wounds: '#fb923c', unknown: '#9ca3af' };
  const w = 560, h = 120, bw = Math.min(36, (w - 30) / bars.length - 4);
  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h + 22}`} className="w-full min-w-[320px]" role="img" aria-label="Days survived per generation">
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1="26" x2={w} y1={h - f * (h - 10)} y2={h - f * (h - 10)} stroke="#ffffff14" />
            <text x="22" y={h - f * (h - 10) + 3} textAnchor="end" fontSize="9" fill="#a8a29e">{(max * f).toFixed(0)}</text>
          </g>
        ))}
        {bars.map((b, k) => {
          const x = 32 + k * (bw + 4), bh = Math.max(2, (b.days / max) * (h - 10));
          return (
            <g key={b.gen}>
              <rect x={x} y={h - bh} width={bw} height={bh} rx="2" fill={b.live ? '#c4b5fd' : color[b.cause] || '#9ca3af'} opacity={b.live ? 0.55 : 0.9} />
              <text x={x + bw / 2} y={h + 12} textAnchor="middle" fontSize="9" fill="#d6d3d1">{b.gen}</text>
            </g>
          );
        })}
      </svg>
      <div className="flex flex-wrap gap-3 text-[10px] text-stone-400">
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#f87171]" />Raiders</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#d6a35c]" />Platypus-bear</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#facc15]" />Starvation</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#fb923c]" />Wounds</span>
        <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#c4b5fd]" />Living generation</span>
      </div>
    </div>
  );
}

function PawnInspector({ G, p }) {
  const el = ELEMENTS[p.el]; const EI = el.icon; const st = pawnStatus(p);
  const thoughts = [...p.sit.map(([text, val]) => ({ text, val, key: text })), ...p.thoughts];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 pr-6">
        <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: `${el.color}26`, boxShadow: `inset 0 0 0 2px ${el.color}` }}><EI size={18} style={{ color: el.color }} /></span>
        <div>
          <div className="text-[15px] font-semibold" style={{ color: el.color }}>{p.name}</div>
          <div className="text-[11px] text-stone-400">{el.name}{p.dead ? ' · deceased' : ''}</div>
        </div>
      </div>
      <div className="text-[11px] italic text-stone-400">{p.backstory}</div>
      <div className="rounded-md bg-black/25 px-2 py-1 text-[11px]"><span className="text-stone-400">Doing: </span><span className={st.key === 'downed' || st.key === 'mental' ? 'text-rose-300' : ''}>{st.text}</span></div>
      <div className="flex flex-col gap-1">
        <Bar label="Health" icon={Heart} value={p.health} color="#5bd36a" />
        <Bar label="Chi" icon={Wind} value={p.chi} color="#5ad1ff" />
        <Bar label="Food" icon={Utensils} value={p.hunger} color="#f2b84b" />
        <Bar label="Rest" icon={Moon} value={p.rest} color="#8f9cff" />
        <Bar label="Harmony" icon={Sun} value={p.harmony} color={p.harmony < 25 ? '#f43f5e' : '#e9a8ff'} />
      </div>
      <div className="text-[11px] text-stone-300"><span className="text-stone-400">Bending: </span>{el.perk}</div>
      <div className="text-[11px]"><span className="text-stone-400">Carrying: </span>{p.carrying ? (p.carrying.pawn !== undefined ? (pawnById(G, p.carrying.pawn) || {}).name : p.carrying.type === 'water' ? 'Bucket of water' : `${p.carrying.qty} ${ITEMS[p.carrying.type].name}`) : 'Nothing'}</div>
      <div>
        <div className="mb-0.5 text-[10px] uppercase tracking-wider text-stone-400">Health conditions</div>
        {p.injuries.length === 0 ? <div className="text-[11px] text-stone-500">No injuries</div> : p.injuries.map((j, k) => (
          <div key={k} className="flex items-center justify-between text-[11px]">
            <span>{j.type} <span className="tabular-nums text-stone-400">({Math.ceil(j.sev)})</span></span>
            <span className="flex gap-1">
              {j.bleeding && <span className="rounded bg-rose-600/70 px-1 text-[10px]">Bleeding</span>}
              {j.tended ? <span className="rounded bg-teal-600/50 px-1 text-[10px]">Tended</span> : <span className="rounded bg-stone-600/60 px-1 text-[10px]">Untended</span>}
            </span>
          </div>
        ))}
      </div>
      <div>
        <div className="mb-0.5 text-[10px] uppercase tracking-wider text-stone-400">Thoughts</div>
        {thoughts.length === 0 ? <div className="text-[11px] text-stone-500">A calm mind</div> : thoughts.map((t, k) => (
          <div key={t.key + k} className="flex justify-between text-[11px]">
            <span>{t.text}</span><span className={`tabular-nums ${t.val >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{t.val > 0 ? '+' : ''}{t.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnimalInspector({ G, e }) {
  const S = SPECIES[e.type];
  const hostile = hostileToColony(G, e);
  const stateText = { flee: 'Fleeing', graze: 'Grazing', toGraze: 'Looking for food', hunt: e.prey ? `Stalking a ${e.prey.name}` : 'Hunting', eat: 'Eating its kill',
    calm: 'Being tamed', angry: 'Enraged', haul: e.carrying ? `Hauling ${e.carrying.qty} ${ITEMS[e.carrying.type].name}` : 'Fetching a load', guard: 'Guarding the camp', wander: 'Wandering' }[e.state] || e.state;
  const diet = { herb: 'Grazer: eats grass, sometimes crops. Prey for predators.', carn: 'Predator: hunts grazers when hungry; turns on people if starving.', omni: 'Omnivore: grazes and hunts small prey.' }[S.diet];
  return (
    <div className="flex flex-col gap-2 pr-6">
      <div className={`text-[15px] font-semibold ${hostile ? 'text-rose-300' : e.tame ? 'text-teal-200' : 'text-amber-200'}`}>{e.name}{e.age < 1 ? ' (young)' : ''}</div>
      <div className="text-[11px] text-stone-400">{diet}</div>
      <div className="text-[11px]">{e.tame ? <span className="text-teal-200">Tamed: {ROLE_TEXT[S.role] || 'stays with the colony'}.</span> : S.tame > 0 ? <span className="text-stone-300">Wild. Tameable ({Math.round(S.tame * 100)}% base chance): would {ROLE_TEXT[S.role]}.</span> : <span className="text-stone-300">Wild. Cannot be tamed.</span>}</div>
      <Bar label="Health" icon={Heart} value={(e.hp / e.maxHp) * 100} color={hostile ? '#e8553f' : '#d9c27a'} />
      <Bar label="Fed" icon={Utensils} value={e.hunger} color="#f2b84b" />
      <div className="text-[11px]"><span className="text-stone-400">Doing: </span>{stateText}{e.hunted ? ' · marked for hunting' : ''}{e.tameDesig ? ' · marked for taming' : ''}</div>
      {S.product && e.tame && <div className="text-[11px] text-stone-400">Next {ITEMS[S.product].name.toLowerCase()} in {Math.max(0, Math.ceil(e.prodT))}s</div>}
      {!e.tame && (
        <div className="flex gap-1">
          {!e.hunted && <button onClick={() => { e.hunted = true; e.tameDesig = false; log(G, `The ${e.name} has been marked for hunting.`, 'info'); }} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-rose-500/80 py-1 text-[12px] font-semibold hover:bg-rose-500"><Crosshair size={13} />Hunt</button>}
          {S.tame > 0 && !e.tameDesig && <button onClick={() => { e.tameDesig = true; e.hunted = false; log(G, `The ${e.name} has been marked for taming.`, 'info'); }} className="flex flex-1 items-center justify-center gap-1 rounded-md bg-teal-500/70 py-1 text-[12px] font-semibold hover:bg-teal-500"><Heart size={13} />Tame</button>}
        </div>
      )}
    </div>
  );
}

function EnemyInspector({ G, e }) {
  if (e.faction === 'animal') return <AnimalInspector G={G} e={e} />;
  const hostile = hostileToColony(G, e);
  const status = e.flee ? 'Fleeing' : e.root > 0 ? 'Rooted' : e.stun > 0 ? 'Chi-blocked (cannot bend)' : e.faction === 'animal' ? (e.provoked ? 'Enraged' : 'Grazing peacefully') : 'Attacking';
  return (
    <div className="flex flex-col gap-2 pr-6">
      <div className={`text-[15px] font-semibold ${hostile ? 'text-rose-300' : 'text-amber-200'}`}>{e.name}</div>
      <div className="text-[11px] text-stone-400">{e.faction === 'animal' ? 'Wild animal. Neutral until provoked.' : e.type === 'scout' ? 'Fire Nation soldier. Hurls fireballs that cause burns.' : 'Desert raider. Sand blades cause bleeding cuts.'}</div>
      <Bar label="Health" icon={Heart} value={(e.hp / e.maxHp) * 100} color={hostile ? '#e8553f' : '#d9c27a'} />
      <div className="text-[11px]"><span className="text-stone-400">Status: </span>{status}{e.hunted ? ' · marked for hunting' : ''}</div>
      {e.faction === 'animal' && !e.hunted && (
        <button onClick={() => { e.hunted = true; log(G, 'The platypus-bear has been marked for hunting.', 'info'); }} className="flex items-center justify-center gap-1 rounded-md bg-rose-500/80 py-1 text-[12px] font-semibold hover:bg-rose-500"><Crosshair size={13} />Hunt it</button>
      )}
    </div>
  );
}

function TileInspector({ G, x, y }) {
  const i = idx(x, y);
  const s = G.struct[i], pl = G.plants[i], it = G.items[i], z = G.zone[i], d = G.desig[i];
  return (
    <div className="flex flex-col gap-1 pr-6 text-[12px]">
      <div className="text-[15px] font-semibold">{TERRAIN_NAME[G.terrain[i]]}{G.tree[i] >= 1 ? ' · Tree' : G.tree[i] ? ` · Sapling (${Math.round(G.tree[i] * 100)}% grown)` : ''}</div>
      {G.terrain[i] === T.GRASS && <Bar label="Forage" icon={Leaf} value={G.forage[i] * 100} color="#a3c95a" />}
      <div className="text-[11px] tabular-nums text-stone-400">Tile ({x}, {y})</div>
      {s && <div><span className="text-stone-400">Structure: </span>{STRUCTS[s.type].name}{s.built ? ` · ${Math.ceil(s.hp)}/${Math.round(structMaxHp(G, s))} HP` : ` · blueprint (${s.delivered}/${STRUCTS[s.type].cost} ${STRUCTS[s.type].mat})`}{s.decon ? ' · to deconstruct' : ''}</div>}
      {s && s.type === 'campfire' && s.built && <Bar label="Fuel" icon={Flame} value={s.fuel} color="#ff8a2a" />}
      {s && s.type === 'bed' && s.built && <div><span className="text-stone-400">Owner: </span>{(s.owner && (pawnById(G, s.owner) || {}).name) || 'Unclaimed'}</div>}
      {pl && <>
        <div><span className="text-stone-400">Crop: </span>{pl.kind === 'tea' ? 'Jasmine tea' : 'Cabbage'}{pl.growth >= 1 ? ' · ready to harvest' : ''}</div>
        <Bar label="Growth" icon={Sprout} value={pl.growth * 100} color="#8fd16a" />
        <Bar label="Water" icon={Droplets} value={pl.water * 100} color="#4aa3e8" />
      </>}
      {it && <div><span className="text-stone-400">Item: </span>{it.qty} {ITEMS[it.type].name}</div>}
      {z && <div><span className="text-stone-400">Zone: </span>{z === 'stock' ? 'Stockpile' : z === 'cabbage' ? 'Cabbage patch' : z === 'grove' ? 'Tree grove' : 'Jasmine tea patch'}</div>}
      {d && <div><span className="text-stone-400">Order: </span>{d === 'mine' ? 'Mine' : 'Chop'}</div>}
      {G.terrain[i] === T.SOIL && !pl && <div className="text-[11px] text-stone-400">Fertile soil: crops grow 65% faster than on grass.</div>}
    </div>
  );
}

// Exposed for headless testing of the simulation.
export const __sim = { createGame, update, applyTool, fireEvent, chronicle, learnFromFall, newMemory, describeGenome, TECHS, SPECIES, W, H };
