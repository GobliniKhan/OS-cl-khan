// Four Nations Colony: a single-file, top-down colony simulation prototype
// inspired by Avatar: The Last Airbender and RimWorld.
// React + HTML5 Canvas + Tailwind (HUD) + lucide-react (icons).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pause, Play, ChevronsRight, FastForward, Sun, Moon, Gem, Axe, Trash2, Crosshair,
  Square, DoorOpen, Bed, Flame, Coffee, AlertTriangle, Package, Sprout, Leaf,
  MousePointer2, Mountain, Droplets, Wind, Hand, Heart, Utensils, Swords, Triangle,
  X, RotateCcw, ZoomIn, ZoomOut, ScrollText, Hammer, Footprints, Skull, HelpCircle,
} from 'lucide-react';

// ============================================================================
// Constants & definitions
// ============================================================================
const W = 40, H = 40, TS = 32;
const DAY_LEN = 180;            // game seconds per in-game day (1x speed)
const MAXSTACK = 75;
const SPEEDS = [0, 1, 2, 3];
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
  earth: ['build', 'mine', 'decon', 'haul', 'chop', 'harvest', 'plant', 'kindle', 'cook', 'water'],
  water: ['water', 'harvest', 'plant', 'haul', 'build', 'decon', 'cook', 'kindle', 'chop', 'mine'],
  fire: ['kindle', 'cook', 'build', 'decon', 'harvest', 'haul', 'mine', 'chop', 'plant', 'water'],
  air: ['haul', 'harvest', 'plant', 'water', 'chop', 'build', 'decon', 'kindle', 'cook', 'mine'],
  none: ['build', 'decon', 'chop', 'cook', 'harvest', 'plant', 'haul', 'kindle', 'mine', 'water'],
};

const STRUCTS = {
  wall: { name: 'Stone Wall', mat: 'stone', cost: 5, work: 4, hp: 220, solid: true },
  door: { name: 'Door', mat: 'wood', cost: 4, work: 3, hp: 120, solid: false },
  bed: { name: 'Bed', mat: 'wood', cost: 6, work: 4, hp: 80, solid: false },
  campfire: { name: 'Campfire', mat: 'wood', cost: 4, work: 3, hp: 80, solid: true },
  teatable: { name: 'Tea Table', mat: 'wood', cost: 8, work: 5, hp: 100, solid: true },
  trap: { name: 'Spike Trap', mat: 'wood', cost: 4, work: 4, hp: 50, solid: false },
};

const ITEMS = {
  stone: { name: 'Stone', color: '#a3a7ae' },
  wood: { name: 'Wood', color: '#a0703e' },
  cabbage: { name: 'Cabbage', color: '#8fd16a', food: 28, raw: true },
  tea: { name: 'Jasmine Tea', color: '#efe2a8' },
  meal: { name: 'Hearty Meal', color: '#e8b04a', food: 55 },
  meat: { name: 'Raw Meat', color: '#c2504a', food: 20, raw: true },
};

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
  return d * (G.ev.fullmoon > 0 ? 0.42 : 0.62);
}

// ============================================================================
// World generation
// ============================================================================
function createGame(seed) {
  const r = mulberry(seed);
  const N = W * H;
  const G = {
    seed, rand: r, time: 0, speed: 0, nextId: 1,
    terrain: new Uint8Array(N), shade: new Float32Array(N), tree: new Uint8Array(N),
    struct: new Array(N).fill(null), items: new Array(N).fill(null), plants: new Array(N).fill(null),
    zone: new Array(N).fill(null), desig: new Array(N).fill(null),
    res: new Map(), pawns: [], enemies: [], proj: [], parts: [], floats: [],
    log: [], banner: null, ev: { fullmoon: 0, heatwave: 0 }, raid: null,
    nextEvent: 80, eventCount: 0, lastRaid: -999, lastMoon: -999, wandererJoined: false, edgeSpawns: [],
    cam: { x: 0, y: 0, zoom: 1.2 }, view: { w: 800, h: 600, dpr: 1 },
    tool: 'select', selected: null, hover: null, drag: null, ptr: null,
    terrainDirty: true, over: false, witherLogT: 0,
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
  G.cam.x = cx * TS; G.cam.y = cy * TS; // centred properly once the view size is known
  G.camCentered = false;
  log(G, 'Four benders have settled a quiet valley. Build beds before nightfall.', 'iroh');
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
function log(G, text, who = 'info') {
  G.log.unshift({ day: dayOf(G), clock: clockStr(G), text, who, id: Math.random() });
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
  if (t === T.WATER || t === T.STONE || G.tree[i]) return false;
  const s = G.struct[i];
  return !(s && s.built && STRUCTS[s.type].solid);
}
const colCostFn = (G) => (x, y, i) => (colPass(G, i) ? (G.terrain[i] === T.SAND ? 1.3 : 1) : Infinity);
function enemyBlocked(G, i) { const s = G.struct[i]; return !!(s && s.built && (STRUCTS[s.type].solid || s.type === 'door')); }
const enemyCostFn = (G) => (x, y, i) => {
  const t = G.terrain[i];
  if (t === T.WATER || t === T.STONE || G.tree[i]) return Infinity;
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

function hurt(G, p, dmg, type) {
  if (p.dead) return;
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
    if (!e.provoked) log(G, 'The platypus-bear roars and charges!', 'azula');
    e.provoked = true; e.calm = 40; if (src) e.aggro = src;
  }
  if (e.hp <= 0) killEnemy(G, e);
}
function killEnemy(G, e) {
  e.dead = true;
  const [x, y] = tileOf(e);
  emit(G, e.x, e.y, 12, 'dust');
  if (e.faction === 'animal') {
    dropItem(G, x, y, 'meat', 14);
    log(G, 'The platypus-bear has been brought down. It left 14 raw meat.', 'info');
    for (const p of G.pawns) if (!p.dead) addThought(p, 'bear', 'Survived the platypus-bear', 5, 150);
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
  s.built = true; s.hp = def.hp; s.progress = 0;
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
  if (p.el === 'air') s *= 2.5;
  if (p.el === 'water' && G.ev.fullmoon > 0) s *= 1.5;
  if (p.health < 50) s *= 0.7;
  if (p.carrying && p.carrying.pawn !== undefined) s *= 0.7;
  return s;
}
function workSpeed(G, p, kind, stype) {
  let m = 1;
  if (p.el === 'earth' && (kind === 'mine' || kind === 'build' || kind === 'decon')) m *= 2.2;
  if (p.el === 'none' && (kind === 'build' || kind === 'chop' || kind === 'decon')) m *= stype === 'trap' ? 3 : 1.5;
  if (p.el === 'fire' && kind === 'cook') m *= 3;
  if (p.el === 'water' && (kind === 'tend' || kind === 'plant' || kind === 'harvest')) m *= 1.6;
  if (p.el === 'air' && (kind === 'harvest' || kind === 'plant')) m *= 1.3;
  if (p.health < 50) m *= 0.7;
  if (p.harmony > 80) m *= 1.15;
  return m;
}
const carryCap = (p) => (p.el === 'air' ? 75 : 25);
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
  const r = want(['meal']) || want(['cabbage', 'meat']);
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
    const r = seek(G, p, adjGoal((n) => G.desig[n] === 'chop' && G.tree[n] && !isRes(G, 'w' + n, p)));
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
      return s.delivered >= def.cost || (p.el === 'earth' && s.type === 'wall' && p.chi >= 25) || avail[def.mat] > 0;
    };
    const r = seek(G, p, adjGoal(ok)); if (!r) return null;
    const t = r.goal.t, s = G.struct[t], def = STRUCTS[s.type];
    reserve(G, 'b' + t, p);
    if (s.delivered >= def.cost) return { type: 'build', t, s, path: r.path, stage: 'go', work: 0, label: `Building ${def.name}` };
    if (p.el === 'earth' && s.type === 'wall' && p.chi >= 25) return { type: 'build', t, s, path: r.path, stage: 'go', work: 0, chi: true, label: 'Earthbending a wall' };
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
    if (countItems(G, 'meal') >= 6 + alive * 2) return null;
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
  if (p.harmony < 45 && (j = jobTea(G, p))) return j;
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
      const valid = j.type === 'mine' ? G.terrain[j.t] === T.STONE && G.desig[j.t] === 'mine' : G.tree[j.t] && G.desig[j.t] === 'chop';
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
        const qty = takeItem(G, j.item, Math.min(def.cost - s.delivered, carryCap(p)));
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
        if (j.chi && !hasChi(G, p, 25)) return done();
        j.stage = 'work'; j.label = j.chi ? 'Earthbending a wall' : `Building ${def.name}`;
      }
      const tx = (j.t % W) + 0.5, ty = ((j.t / W) | 0) + 0.5;
      p.facing = Math.atan2(ty - p.y, tx - p.x);
      const need = j.chi ? 0.7 : def.work;
      j.work += dt * (j.chi ? 1 : workSpeed(G, p, 'build', s.type));
      s.progress = j.work / need;
      if (G.rand() < dt * 4) emit(G, tx, ty, 1, 'dust');
      if (j.work >= need) {
        if (j.chi) { spendChi(G, p, 25); emit(G, tx, ty, 26, 'dust'); floatText(G, tx, ty - 0.5, 'Earth wall!', '#9be29f'); }
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
        const meals = c.type === 'cabbage' ? Math.ceil(c.qty / 2) : c.qty;
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
        const qty = takeItem(G, j.item, carryCap(p));
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
    default: done();
  }
}

// ============================================================================
// Combat
// ============================================================================
function hostileToColony(G, e) {
  if (!e || e.dead || e.gone) return false;
  if (e.faction === 'raider') return true;
  return e.provoked || e.hunted;
}
function findHostileFor(G, p) {
  let best = null, bd = Infinity;
  for (const e of G.enemies) {
    if (!hostileToColony(G, e)) continue;
    const d = dist(p, e);
    const ok = e.faction === 'raider' ? d < 10 && !e.flee : (e.provoked && d < 10) || e.hunted;
    if (ok && d < bd) { bd = d; best = e; }
  }
  return best;
}
function canBend(G, p) { return p.el !== 'none' && hasChi(G, p, 6); }
function runFight(G, p, dt) {
  const t = p.job.target;
  if (!hostileToColony(G, t) || !G.enemies.includes(t) || (t.flee && dist(p, t) > 7) || (!t.hunted && dist(p, t) > 14)) return abortJob(G, p);
  const el = ELEMENTS[p.el];
  const bend = canBend(G, p);
  const range = bend ? el.range : 1.5;
  const d = dist(p, t);
  p.job.label = `Fighting ${t.name}`;
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
  if (!bend) {
    if (p.el === 'none') {
      damageEnemy(G, t, el.dmg, p); t.stun = 2.5;
      emit(G, t.x, t.y, 8, 'chi'); floatText(G, t.x, t.y - 0.9, 'Chi-blocked!', '#ffb347');
    } else { damageEnemy(G, t, 5, p); emit(G, t.x, t.y, 3, 'dust'); }
    return;
  }
  spendChi(G, p, 6);
  G.proj.push({ x: p.x, y: p.y, target: t, lx: t.x, ly: t.y, kind: el.proj, dmg: el.dmg, side: 'colony', shooter: p,
    speed: el.proj === 'boulder' ? 9 : el.proj === 'air' ? 14 : 12, life: 3, knock: p.el === 'air' ? 2.5 : 0, start: idx(...tileOf(p)), rot: 0 });
  const k = { boulder: 'dust', water: 'splash', fire: 'ember', air: 'air' }[el.proj];
  emit(G, p.x, p.y, 6, k);
}
function enemyAttack(G, e, tgt) {
  e.cd = e.atkCd;
  const tp = tgt.struct !== undefined ? { x: (tgt.struct % W) + 0.5, y: ((tgt.struct / W) | 0) + 0.5 } : tgt;
  e.facing = Math.atan2(tp.y - e.y, tp.x - e.x);
  if (e.melee) {
    if (tgt.struct !== undefined) damageStruct(G, tgt.struct, e.dmg);
    else hurt(G, tgt, e.dmg, e.inj);
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
    const trail = { fire: 'ember', water: 'splash', boulder: 'dust', air: 'air', sand: 'sand' }[pr.kind];
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
  const k = { fire: 'ember', water: 'splash', boulder: 'dust', air: 'air', sand: 'sand' }[pr.kind];
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
    if (!t.downed) hurt(G, t, pr.dmg, pr.inj || 'Bruise');
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
  log(G, `${p.name} has been downed${p.injuries.some((j) => j.bleeding) ? ' and is bleeding' : ''}!`, 'azula');
  for (const q of G.pawns) if (q !== p && !q.dead) addThought(q, 'down' + p.id, `${p.name} was downed`, -6, 120);
}
function killColonist(G, p) {
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
  if (G.raid) sit.push(['Under attack', -4]);
  p.sit = sit;
  const target = clamp(52 + sit.reduce((s, x) => s + x[1], 0) + p.thoughts.reduce((s, t) => s + t.val, 0), 0, 100);
  p.harmony += (target - p.harmony) * Math.min(1, dt * 0.25);
}
function startBreak(G, p) {
  abortJob(G, p);
  const type = p.el === 'fire' ? 'Fire Tantrum' : p.el === 'air' ? 'Gale Wandering' : 'Chi Catatonia';
  p.mental = { type, t: 25, cd: 1 };
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
  const bleedRate = Math.min(0.3, bleed * 0.12) / Math.max(1, bleed);
  for (const j of p.injuries) {
    if (j.type === 'Malnutrition') { j.sev += p.hunger <= 0 ? dt * 0.15 : -dt * 0.1; continue; }
    if (j.bleeding) j.sev += dt * bleedRate;
    else j.sev -= dt * (j.tended ? (bedOk || p.sleeping ? 0.4 : 0.12) : 0.035);
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
  const medic = p.el === 'water' && G.pawns.some((q) => q !== p && q.downed && !q.dead && q.injuries.some((j) => j.bleeding));
  if (medic && p.job && p.job.type === 'fight') abortJob(G, p);
  if (!medic && p.health >= 40 && !(p.job && (p.job.type === 'fight' || p.job.type === 'rescue' || p.job.type === 'tend'))) {
    const h = findHostileFor(G, p);
    if (h) { abortJob(G, p); p.job = { type: 'fight', target: h, re: 0, label: `Fighting ${h.name}` }; }
  }
  if (p.health < 40 && !(p.job && (p.job.type === 'retreat' || p.job.type === 'rescue')) && nearestThreat(G, p, 8)) {
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
  const n = Math.min(5, 2 + Math.floor(dayOf(G) * 0.3));
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
  G.raid = { t: 0, kind, n }; G.lastRaid = G.time;
  const side = origin[0] === 0 ? 'west' : origin[0] === W - 1 ? 'east' : origin[1] === 0 ? 'north' : 'south';
  banner(G, kind === 'scout' ? 'Fire Nation raid' : 'Sandbender raid',
    `${n} ${def.name}s approach from the ${side}. "Let's see how your little village handles some pressure."`, 'azula');
}
function spawnBear(G) {
  const s = G.edgeSpawns[Math.floor(G.rand() * G.edgeSpawns.length)];
  G.enemies.push({ id: G.nextId++, faction: 'animal', type: 'bear', name: 'Platypus-Bear', x: s[0] + 0.5, y: s[1] + 0.5, hp: 170, maxHp: 170,
    range: 1.4, dmg: 16, atkCd: 1.5, cd: 0, melee: true, inj: 'Claw wound', speed: 2.6, bash: 14, path: null, repath: 0, re: 0, target: null,
    provoked: false, hunted: false, calm: 0, life: 0, idle: 0, stun: 0, root: 0, hitFlash: 0, facing: 0 });
  banner(G, 'Platypus-bear sighted', 'A huge platypus-bear wanders into the valley. Leave it alone, or mark it for hunting.', 'iroh');
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
  if (s && s.built && s.type === 'trap') {
    G.struct[ti] = null; e.root = 2.5;
    emit(G, e.x, e.y, 10, 'dust'); emit(G, e.x, e.y, 6, 'blood');
    floatText(G, e.x, e.y - 0.8, 'Trapped!', '#ffd166');
    log(G, `A spike trap caught a ${e.name}!`, 'iroh');
    damageEnemy(G, e, 30, null);
    if (e.dead) return;
  }
  if (e.faction === 'animal') {
    e.life += dt;
    if (e.provoked) {
      e.calm -= dt;
      if (e.calm <= 0 && !e.hunted) { e.provoked = false; e.aggro = null; e.path = null; log(G, 'The platypus-bear calms down.', 'iroh'); }
    }
    if (!e.provoked) {
      for (const p of G.pawns) {
        if (p.dead || p.downed) continue;
        if (dist(p, e) < 1.6 && G.rand() < dt * 0.08) {
          e.provoked = true; e.calm = 35; e.aggro = p;
          log(G, `The platypus-bear was startled by ${p.name} and attacks!`, 'azula');
          break;
        }
      }
    }
    if (!e.provoked) {
      if (e.life > 260 && !e.hunted) return moveToEdge(G, e, dt);
      if (!e.path || !e.path.length) {
        e.idle -= dt; if (e.idle > 0) return;
        e.idle = 2 + G.rand() * 3;
        const [x, y] = tileOf(e);
        const tx = clamp(x + Math.floor(G.rand() * 9) - 4, 0, W - 1), ty = clamp(y + Math.floor(G.rand() * 9) - 4, 0, H - 1);
        const r = pathfind(G, x, y, (a, b) => (a === tx && b === ty ? {} : null), colCostFn(G), 14);
        e.path = r ? r.path : null;
      }
      if (e.path && e.path.length && !colPass(G, idx(e.path[0].x, e.path[0].y))) { e.path = null; return; }
      moveEnemy(G, e, dt, 0.45);
      return;
    }
    if (!chaseAndAttack(G, e, dt)) { e.provoked = false; e.path = null; }
    return;
  }
  if (!e.flee && e.hp < e.maxHp * 0.3) { e.flee = true; e.path = null; log(G, `A ${e.name} is fleeing!`, 'iroh'); }
  if (G.raid && G.raid.t > 130 && !e.flee) { e.flee = true; e.path = null; }
  if (e.flee) return moveToEdge(G, e, dt);
  if (!chaseAndAttack(G, e, dt)) { e.flee = true; e.path = null; }
}

// ============================================================================
// Storyteller
// ============================================================================
function fireEvent(G, forced) {
  const pool = [];
  if (G.time > 260 && !G.raid && G.time - G.lastRaid > 220) pool.push(['raid', 2.2 + dayOf(G) * 0.3]);
  if (G.ev.fullmoon <= 0 && G.time - G.lastMoon > 320) pool.push(['fullmoon', 1.1]);
  if (G.ev.heatwave <= 0) pool.push(['heatwave', 1.4]);
  if (!G.enemies.some((e) => e.type === 'bear')) pool.push(['bear', 1.2]);
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
    case 'raid': spawnRaid(G); break;
    case 'fullmoon':
      G.ev.fullmoon = 110; G.lastMoon = G.time;
      banner(G, 'Full Moon', 'The moon spirit shines. Waterbenders have limitless Chi and move 50% faster.', 'iroh');
      break;
    case 'heatwave':
      G.ev.heatwave = 140;
      banner(G, 'Heatwave', 'A scorching drought settles in. Crops dry out fast unless watered. "Fire is life, but also destruction."', 'azula');
      break;
    case 'bear': spawnBear(G); break;
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
// Main simulation step
// ============================================================================
function update(G, dt) {
  G.time += dt;
  G._lit = litCampfires(G);
  for (const i of G._lit) {
    const s = G.struct[i]; s.fuel = Math.max(0, s.fuel - dt * 0.37);
    if (G.rand() < dt * 3) emit(G, (i % W) + 0.5, ((i / W) | 0) + 0.4, 1, 'ember');
  }
  // Plants
  const night = isNight(G);
  let withered = 0;
  for (let i = 0; i < G.plants.length; i++) {
    const pl = G.plants[i]; if (!pl) continue;
    pl.water = Math.max(0, pl.water - dt * (G.ev.heatwave > 0 ? 1 / 26 : 1 / 240));
    if (pl.water <= 0) { pl.dry += dt; if (pl.dry > 45) { G.plants[i] = null; withered++; continue; } }
    else if (pl.growth < 1) {
      const rate = (pl.kind === 'cabbage' ? 1 / 140 : 1 / 190) * (G.terrain[i] === T.SOIL ? 1 : 0.6) * (night ? 0.5 : 1);
      pl.growth = Math.min(1, pl.growth + rate * dt);
    }
  }
  if (withered && G.time - G.witherLogT > 20) { G.witherLogT = G.time; log(G, 'Crops have withered from thirst.', 'azula'); }
  // Events
  if (G.ev.fullmoon > 0) { G.ev.fullmoon -= dt; if (G.ev.fullmoon <= 0) log(G, 'The full moon wanes.', 'info'); }
  if (G.ev.heatwave > 0) { G.ev.heatwave -= dt; if (G.ev.heatwave <= 0) log(G, 'The heatwave breaks. Cool winds return.', 'iroh'); }
  G.nextEvent -= dt;
  if (G.nextEvent <= 0) {
    G.nextEvent = 70 + G.rand() * 55;
    fireEvent(G, G.eventCount === 0 ? 'wanderer' : G.eventCount === 2 && !G.raid ? 'raid' : null);
  }
  for (const p of G.pawns) updateColonist(G, p, dt);
  for (const e of G.enemies) updateEnemy(G, e, dt);
  // Soft separation so raiders don't stack on one tile.
  for (const a of G.enemies) for (const c of G.enemies) {
    if (a === c || a.dead || c.dead) continue;
    const dx = a.x - c.x, dy = a.y - c.y, d = Math.hypot(dx, dy), min = a.type === 'bear' || c.type === 'bear' ? 0.9 : 0.55;
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
  clear: { label: 'Clear', icon: Trash2, cat: 'orders', hint: 'Drag to cancel orders, blueprints and zones. Finished buildings get deconstructed for half their materials.' },
  wall: { label: 'Stone Wall', icon: Square, cat: 'build', struct: 'wall', hint: 'Drag to draw walls (a box draws its outline). 5 stone each, free for Earthbenders with Chi.' },
  door: { label: 'Door', icon: DoorOpen, cat: 'build', struct: 'door', hint: 'Colonists walk through doors; raiders must break them. 4 wood.' },
  bed: { label: 'Bed', icon: Bed, cat: 'build', struct: 'bed', hint: 'Colonists sleep and heal faster in beds. Downed colonists are carried here. 6 wood.' },
  campfire: { label: 'Campfire', icon: Flame, cat: 'build', struct: 'campfire', hint: 'Needed for cooking meals. Firebenders kindle it with Chi, others burn wood. 4 wood.' },
  teatable: { label: 'Tea Table', icon: Coffee, cat: 'build', struct: 'teatable', hint: 'Colonists drink jasmine tea and chat here to restore Harmony. 8 wood.' },
  trap: { label: 'Spike Trap', icon: Triangle, cat: 'build', struct: 'trap', hint: 'Single-use trap: 30 damage and roots the enemy. Non-benders build it 3x faster. 4 wood.' },
  stock: { label: 'Stockpile', icon: Package, cat: 'zones', zone: 'stock', hint: 'Drag to mark a stockpile. Colonists haul loose items here.' },
  cabbage: { label: 'Cabbage Patch', icon: Sprout, cat: 'zones', zone: 'cabbage', hint: 'Drag over grass or soil. Cabbages feed the colony. Fertile soil grows faster.' },
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
  if (tool === 'chop') return !!G.tree[i];
  if (tool === 'clear') return !!(G.desig[i] || G.struct[i] || G.zone[i]);
  if (def.struct) return t !== T.WATER && t !== T.STONE && !G.tree[i] && !G.struct[i] && !G.plants[i];
  if (tool === 'stock') return t !== T.WATER && t !== T.STONE && !G.tree[i] && !(G.struct[i] && STRUCTS[G.struct[i].type].solid);
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
        if (s.hp < STRUCTS.wall.hp * 0.5) { ctx.strokeStyle = 'rgba(20,20,20,0.7)'; ctx.beginPath(); ctx.moveTo(px + 6, py + 4); ctx.lineTo(px + 14, py + 18); ctx.lineTo(px + 10, py + 28); ctx.stroke(); }
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
  } else if (s.hp < STRUCTS[s.type].hp) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px + 3, py - 4, TS - 6, 3);
    ctx.fillStyle = '#e8553f'; ctx.fillRect(px + 3, py - 4, (TS - 6) * (s.hp / STRUCTS[s.type].hp), 3);
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

function drawTree(ctx, i, px, py, t) {
  const cx = px + TS / 2, cy = py + TS / 2, s = 0.85 + hash(i, 11) * 0.3;
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
  if (e.type === 'bear') {
    ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.beginPath(); ctx.ellipse(0, 12, 18, 7, 0, 0, 7); ctx.fill();
    ctx.rotate(e.facing);
    ctx.fillStyle = e.provoked ? '#6b3a22' : '#7a5232'; ctx.beginPath(); ctx.ellipse(-2, 0, 18, 13, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#5d3d22'; ctx.beginPath(); ctx.ellipse(-12, 0, 6, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#86603d'; ctx.beginPath(); ctx.arc(12, 0, 8.5, 0, 7); ctx.fill();
    ctx.fillStyle = '#e8b64a'; ctx.beginPath(); ctx.ellipse(21, 0, 7, 4.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = e.provoked ? '#ff3b2f' : '#111'; ctx.beginPath(); ctx.arc(14, -4, 1.6, 0, 7); ctx.arc(14, 4, 1.6, 0, 7); ctx.fill();
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
  if (e.hitFlash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.beginPath(); ctx.arc(0, 0, e.type === 'bear' ? 18 : 11, 0, 7); ctx.fill(); }
  ctx.restore();
  if (e.stun > 0 && e.type !== 'bear') {
    ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 1.5;
    for (let k = 0; k < 3; k++) { const a = t * 5 + k * 2.1; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 9, y - 14 + Math.sin(a) * 3, 1.8, 0, 7); ctx.stroke(); }
  }
  if (e.root > 0) { ctx.strokeStyle = 'rgba(200,200,200,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y + 6, 12, 0, Math.PI); ctx.stroke(); }
  const hostile = hostileToColony(G, e);
  const r = e.type === 'bear' ? 22 : 15;
  if (e.hunted) {
    ctx.strokeStyle = '#ff5d5d'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r, 0, 7);
    ctx.moveTo(x - r - 4, y); ctx.lineTo(x - r + 4, y); ctx.moveTo(x + r - 4, y); ctx.lineTo(x + r + 4, y); ctx.stroke();
  }
  if (e.hp < e.maxHp || hostile) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x - 12, y - r - 6, 24, 4);
    ctx.fillStyle = hostile ? '#e8553f' : '#d9c27a'; ctx.fillRect(x - 11, y - r - 5, 22 * clamp(e.hp / e.maxHp, 0, 1), 2);
  }
  const sel = G.selected && G.selected.kind === 'enemy' && G.selected.id === e.id;
  if (sel) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, r + 2, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
  if (zoom >= 0.8) {
    ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = hostile ? '#ff9c8f' : '#e9dcae';
    ctx.fillText(e.flee ? `${e.name} (fleeing)` : e.name, x, y + r + 10);
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
    const zn = G.zone[i];
    if (zn) {
      ctx.fillStyle = zn === 'stock' ? 'rgba(232,196,120,0.16)' : zn === 'cabbage' ? 'rgba(140,220,90,0.14)' : 'rgba(255,220,240,0.14)';
      ctx.fillRect(px, py, TS, TS);
      ctx.strokeStyle = zn === 'stock' ? 'rgba(232,196,120,0.55)' : zn === 'cabbage' ? 'rgba(140,220,90,0.5)' : 'rgba(255,200,230,0.55)';
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
    if (G.tree[i]) drawTree(ctx, i, px, py, t);
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
    const ok = G.tool === 'select' || G.tool === 'hunt' || toolValid(G, G.tool, idx(G.hover.x, G.hover.y));
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
};

export default function AvatarColony() {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [seed, setSeed] = useState(() => (Math.random() * 1e9) | 0);
  const G = useMemo(() => createGame(seed), [seed]);
  const gRef = useRef(G); gRef.current = G;
  const [, force] = useState(0);
  const [tool, setToolState] = useState('select');
  const [cat, setCat] = useState('orders');
  const [showHelp, setShowHelp] = useState(true);
  const [showLog, setShowLog] = useState(() => typeof window === 'undefined' || window.innerWidth > 640);
  const toolRef = useRef(setToolState);

  const setTool = (tl) => { G.tool = tl; G.drag = null; setToolState(tl); };
  toolRef.current = setTool;

  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current;
    const ctx = canvas.getContext('2d');
    if (globalThis.__COLONY_DEBUG__) globalThis.__colony = { G, sim: { update, fireEvent, applyTool } };
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
        while (sim > 1e-6) { const s = Math.min(0.05, sim); update(G, s); sim -= s; }
      }
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
      st.mode = e.button !== 0 || G.tool === 'select' || G.tool === 'hunt' ? 'pan' : 'drag';
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
      if (G.tool === 'hunt') {
        const a = near(G.enemies.filter((en) => en.faction === 'animal'), 1.2);
        if (a) { a.hunted = true; log(G, 'The platypus-bear has been marked for hunting.', 'info'); }
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
      if (k === '1' || k === '2' || k === '3') G.speed = Number(k);
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
  const restart = () => { setSeed((Math.random() * 1e9) | 0); setShowHelp(false); setToolState('select'); };

  // Derived HUD data
  const res = { stone: 0, wood: 0, cabbage: 0, meal: 0, tea: 0, meat: 0 };
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
              {[[0, Pause, 'Pause (Space)'], [1, Play, '1x (1)'], [2, ChevronsRight, '2x (2)'], [3, FastForward, '3x (3)']].map(([s, Ic, tl]) => (
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
                <span className={WHO[l.who].cls}>{l.text}</span>
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

      {/* Bottom action bar */}
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

      {/* Help */}
      {showHelp && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/55 p-4">
          <div className="max-h-full w-[min(560px,100%)] overflow-y-auto rounded-2xl border border-amber-200/20 bg-[#141c1f] p-5 shadow-2xl">
            <div className="text-[11px] uppercase tracking-[0.2em] text-amber-300">A colony of the four nations</div>
            <h1 className="mb-2 text-2xl font-semibold text-stone-50">Four Nations Colony</h1>
            <p className="mb-3 text-[13px] text-stone-300">Kanto, Yuka, Ren and Tashi have settled a quiet valley. They work on their own: they eat, sleep, haul, farm, build and defend. You give orders and keep their Harmony up.</p>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {Object.entries(ELEMENTS).map(([k, el]) => { const EI = el.icon; return (
                <div key={k} className="flex gap-2 rounded-lg bg-black/25 p-2">
                  <EI size={16} style={{ color: el.color }} className="mt-0.5 shrink-0" />
                  <div><div className="text-[12px] font-semibold" style={{ color: el.color }}>{el.name}</div><div className="text-[11px] text-stone-400">{el.perk}</div></div>
                </div>
              ); })}
            </div>
            <ul className="mb-4 list-disc space-y-1 pl-5 text-[12px] text-stone-300">
              <li>Pan with WASD, arrow keys, or drag the map. Scroll to zoom.</li>
              <li>Space pauses; 1, 2, 3 set the speed. Esc or right-click returns to Select.</li>
              <li>Build beds first, then a tea table. Mark stone for mining and trees for chopping.</li>
              <li>Raids arrive from the map edge. Walls give cover; doors and traps slow raiders down.</li>
              <li>Downed colonists bleed. Waterbenders tend and heal them; others carry them to beds.</li>
            </ul>
            <button onClick={() => { setShowHelp(false); setSpeed(G.lastSpeed || 1); }} className="w-full rounded-lg bg-amber-400 py-2 text-[14px] font-semibold text-stone-900 hover:bg-amber-300">Begin</button>
          </div>
        </div>
      )}

      {G.over && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-4">
          <div className="w-[min(420px,100%)] rounded-2xl border border-rose-300/30 bg-[#1a1214] p-6 text-center">
            <Skull className="mx-auto mb-2 text-rose-300" size={28} />
            <h2 className="mb-1 text-xl font-semibold">The colony has fallen</h2>
            <p className="mb-4 text-[13px] text-stone-300">Your benders held out until day {dayOf(G)}. "Even in the darkest times, hope can be found." Try a new valley.</p>
            <button onClick={restart} className="rounded-lg bg-rose-400 px-4 py-2 font-semibold text-stone-900 hover:bg-rose-300">New colony</button>
          </div>
        </div>
      )}
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

function EnemyInspector({ G, e }) {
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
      <div className="text-[15px] font-semibold">{TERRAIN_NAME[G.terrain[i]]}{G.tree[i] ? ' · Tree' : ''}</div>
      <div className="text-[11px] tabular-nums text-stone-400">Tile ({x}, {y})</div>
      {s && <div><span className="text-stone-400">Structure: </span>{STRUCTS[s.type].name}{s.built ? ` · ${Math.ceil(s.hp)}/${STRUCTS[s.type].hp} HP` : ` · blueprint (${s.delivered}/${STRUCTS[s.type].cost} ${STRUCTS[s.type].mat})`}{s.decon ? ' · to deconstruct' : ''}</div>}
      {s && s.type === 'campfire' && s.built && <Bar label="Fuel" icon={Flame} value={s.fuel} color="#ff8a2a" />}
      {s && s.type === 'bed' && s.built && <div><span className="text-stone-400">Owner: </span>{(s.owner && (pawnById(G, s.owner) || {}).name) || 'Unclaimed'}</div>}
      {pl && <>
        <div><span className="text-stone-400">Crop: </span>{pl.kind === 'tea' ? 'Jasmine tea' : 'Cabbage'}{pl.growth >= 1 ? ' · ready to harvest' : ''}</div>
        <Bar label="Growth" icon={Sprout} value={pl.growth * 100} color="#8fd16a" />
        <Bar label="Water" icon={Droplets} value={pl.water * 100} color="#4aa3e8" />
      </>}
      {it && <div><span className="text-stone-400">Item: </span>{it.qty} {ITEMS[it.type].name}</div>}
      {z && <div><span className="text-stone-400">Zone: </span>{z === 'stock' ? 'Stockpile' : z === 'cabbage' ? 'Cabbage patch' : 'Jasmine tea patch'}</div>}
      {d && <div><span className="text-stone-400">Order: </span>{d === 'mine' ? 'Mine' : 'Chop'}</div>}
      {G.terrain[i] === T.SOIL && !pl && <div className="text-[11px] text-stone-400">Fertile soil: crops grow 65% faster than on grass.</div>}
    </div>
  );
}

// Exposed for headless testing of the simulation.
export const __sim = { createGame, update, applyTool, fireEvent, W, H };
