import React, { useRef, useEffect, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// STELLAR DRIFT — A voyage through the solar system
// ═══════════════════════════════════════════════════════════════

// Monument-Valley-inspired palettes: soft pastels, dreamy gradients, painted
// not photoreal. Each planet keeps a distinct mood within the same aesthetic.
const PLANETS = [
  {
    name: 'MERCURY',
    tagline: 'The scorched world remembers the sun',
    sky: ['#f7c79a', '#e89a7c', '#b76a72'],
    accent: '#ffd2a8',
    columnFront: '#a5677a',
    columnSide: '#6e4458',
    columnEdge: '#ffe8c8',
    fog: 'rgba(255, 200, 160, 0.12)',
  },
  {
    name: 'VENUS',
    tagline: 'Beneath veils of gold, a hidden world',
    sky: ['#fbe7c4', '#f3c98a', '#c89870'],
    accent: '#fff0c8',
    columnFront: '#b8946a',
    columnSide: '#7a5e44',
    columnEdge: '#fff4d4',
    fog: 'rgba(255, 230, 180, 0.14)',
  },
  {
    name: 'EARTH',
    tagline: 'A pale blue dot, our fragile home',
    sky: ['#cfb8d8', '#a8c8d8', '#7ea8c2'],
    accent: '#dfe9f5',
    columnFront: '#6a89a8',
    columnSide: '#3f5878',
    columnEdge: '#e8f1fa',
    fog: 'rgba(200, 220, 240, 0.10)',
  },
  {
    name: 'MARS',
    tagline: 'Rust-red dust and silent canyons',
    sky: ['#f3c4a8', '#dc8e7a', '#a85c66'],
    accent: '#ffc7a8',
    columnFront: '#9c5a64',
    columnSide: '#653d4a',
    columnEdge: '#ffd8b8',
    fog: 'rgba(240, 180, 150, 0.12)',
  },
  {
    name: 'JUPITER',
    tagline: 'A great red eye watches the storm',
    sky: ['#f3dcb4', '#e0b683', '#b87f5e'],
    accent: '#ffe0ba',
    columnFront: '#a47c5c',
    columnSide: '#6a4f3a',
    columnEdge: '#ffeacc',
    fog: 'rgba(240, 210, 170, 0.12)',
  },
  {
    name: 'SATURN',
    tagline: 'Crowned by rings of ancient ice',
    sky: ['#d8c6e0', '#b8a8d0', '#8a7eae'],
    accent: '#f3e0d0',
    columnFront: '#7e7298',
    columnSide: '#534a6a',
    columnEdge: '#f5e9d8',
    fog: 'rgba(220, 200, 220, 0.10)',
  },
  {
    name: 'URANUS',
    tagline: 'The tilted giant rolls through silence',
    sky: ['#c8e6dc', '#9fcfc2', '#7aae9a'],
    accent: '#dff4eb',
    columnFront: '#6a9c8e',
    columnSide: '#42685e',
    columnEdge: '#eafcf3',
    fog: 'rgba(200, 232, 220, 0.12)',
  },
  {
    name: 'NEPTUNE',
    tagline: 'Cobalt depths where methane winds scream',
    sky: ['#b3b8de', '#7a83c0', '#4d5694'],
    accent: '#c9d6ff',
    columnFront: '#5a6394',
    columnSide: '#363c66',
    columnEdge: '#e0e8ff',
    fog: 'rgba(180, 190, 240, 0.12)',
  },
  {
    name: 'THE SUN',
    tagline: 'Inside the heart of fire itself',
    sky: ['#fff3d3', '#fcc78a', '#e2826c'],
    accent: '#fff6dc',
    columnFront: '#d49872',
    columnSide: '#9a6650',
    columnEdge: '#fff8e0',
    fog: 'rgba(255, 220, 170, 0.18)',
  },
  {
    name: 'THE VOID',
    tagline: 'Beyond everything, only quiet light',
    sky: ['#1a1230', '#241844', '#3a1f5c'],
    accent: '#e0c0ff',
    columnFront: '#2c1d4a',
    columnSide: '#150c28',
    columnEdge: '#d8b8ff',
    fog: 'rgba(180, 130, 220, 0.10)',
  },
];

// Planets whose backgrounds are too light for a warm-white frosted tint
// (text contrast drops). These get a warm dark amber tint instead.
const DARK_TINT_PLANETS = new Set(['THE SUN']);
const needsDarkTint = (planet) => DARK_TINT_PLANETS.has(planet.name);
const FROSTED_TINT_LIGHT = 'rgba(255, 240, 220, 0.18)';
const FROSTED_TINT_DARK = 'rgba(40, 25, 15, 0.35)';
// Shared "fast Gaussian": render the offscreen scene into a 1/N-size canvas
// with a small blur kernel once per frame; each frosted card upsamples a
// region of it. The downsample + bilinear upscale do most of the blurring
// for free, so the explicit blur radius can stay tiny — way cheaper than
// running ctx.filter blur(20px) at full resolution per card per frame.
const FROSTED_SCENE_DOWNSCALE = 4;
const FROSTED_SCENE_BLUR_PX = 5;

// Append ?fps to the URL for a tiny on-canvas perf meter (fps, worst RAF
// interval, JS main-thread time per frame). Gated — invisible to normal
// players, read once at module load. Purely diagnostic; changes no game timing.
const SHOW_FPS = typeof location !== 'undefined' && /[?&]fps\b/.test(location.search);

// ── Fixed-timestep simulation (Phase 0.5) ──────────────────────────
// The simulation advances in fixed 60 Hz ticks, decoupled from the display
// refresh rate, so motion runs at the same wall-clock speed whether the device
// renders at 60 fps or — iOS Low Power Mode — 30 fps. Each rendered frame
// accumulates the real elapsed time and runs as many fixed ticks as needed to
// catch up to real time ("Fix Your Timestep!", Glenn Fiedler).
//
// PER-FRAME → PER-SECOND CONVERSION AUDIT (the original May-24 build advanced a
// fixed amount per *rendered frame*, assuming 60 fps). Conversion strategy:
//   • CONTINUOUS LINEAR MOTION (ship vertical velocity/gravity/thrust, world
//     scroll speed) is expressed in units PER SECOND and integrated by the
//     fixed timestep in simulateTick() (v*dtSec). The per-frame → per-second
//     factor depends on the time exponent: a VELOCITY (px/frame) scales ×60
//     (= TICKS_PER_SECOND); an ACCELERATION (px/frame²) scales ×60² (=3600),
//     because the time unit is squared. So in makePhysics(): impulse,
//     maxRiseSpeed, maxFallSpeed, baseSpeed, speedPerObstacle use ×60, but
//     gravity uses ×60². (NOTE: this corrects the spec's "×60 for everything"
//     calibration hint — ×60 gravity is 60× too weak and sends the ship to the
//     top of the screen on a single tap.)
//   • DURATION / TICK COUNTERS (comboTimer 180, transitionCard 120, deathOverlay
//     20, spawnInterval 95→55, framesSinceSpawn, shake/flash, planetTransition
//     +1/90, the flap cooldown, particle/ring/popup life) are counted in SIM
//     TICKS. A tick is a fixed 16.667 ms quantum, so a tick count already encodes
//     a fixed wall-clock duration and is inherently frame-rate-independent — no
//     literal ms conversion is needed, and avoiding it keeps the May-24 feel
//     byte-identical (one tick == one old 60 fps frame) with no rounding drift.
//   • The LATERAL damped-spring (lateralTiltInfluence/Damping/Recenter/AmbientSway)
//     and cosmetic particle/dust/ring velocities are kept in per-tick units:
//     multiplicative damping/springs have no clean ×60 per-second form, and at a
//     fixed 60 Hz timestep per-tick == per-frame, so feel is preserved exactly.
//   • gs.time stays an integer TICK counter (++ per tick). All draw-time animation
//     phases (Math.sin(gs.time*…), gs.time%2 trail, twinkle) therefore run at the
//     correct rate at any display fps.
// NOTE: atmospheric dust used to advance inside drawDust() (the render path),
// which made it frame-rate-dependent; its integration is now in simulateTick().
const FIXED_DT = 1000 / 60;                 // ms of simulated time per tick (16.667 ms)
const TICKS_PER_SECOND = 1000 / FIXED_DT;   // 60 — the per-frame → per-second factor
const MAX_FRAME_TIME = 250;                 // clamp accumulated time (spiral-of-death guard)

// RENDERING: everything is drawn at its LIVE simulated position — there is no
// render interpolation. Batch 2 added it to smooth low-refresh (30 fps Low
// Power Mode) motion, but interpolating against the fixed 60 Hz timestep, whose
// ticks-per-frame fluctuates (0/1/2 at 60 fps, 1/2/3 at 30 fps), turned that
// jitter into a continuous position wobble (shake) and a smear at 30 fps; it
// also put the world a tick behind the live-rendered ship, exposing a relative
// wobble on every tap. Live rendering keeps ship and world on one clock — the
// May-24 feel — at the cost of honest stepping (not lag/wobble) at 30 fps. The
// fixed-timestep accumulator (Batch 1) is what keeps speed frame-rate
// independent and is unaffected by this; only the draw path reverted.

// ── Configurable constants ─────────────────────────────────────────
// Set this to your deployed game URL. Used in the share-score snippet.
const VERCEL_URL = 'https://stellar-drift.vercel.app';

// Cute & goofy alien characters. hatAnchor (x, y, scale) tells the hat-draw
// routine where to perch a hat on each alien's head.
const ALIENS = [
  { id: 'blip',   name: 'Blip',   cost: 0,   blurb: 'A cheery green alien waving hello.',  hatAnchor: { x:  0, y: -10, scale: 1.00 } },
  { id: 'pip',    name: 'Pip',    cost: 0,   blurb: 'A pink pufferball with three eyes.',  hatAnchor: { x:  0, y:  -8, scale: 0.90 } },
  { id: 'goop',   name: 'Goop',   cost: 0,   blurb: 'A yellow slime drop, sticky and silly.', hatAnchor: { x:  0, y: -11, scale: 0.95 } },
  { id: 'wobble', name: 'Wobble', cost: 50,  blurb: 'A roly-poly egg with stubby legs.',   hatAnchor: { x:  0, y:  -9, scale: 1.00 } },
  { id: 'glim',   name: 'Glim',   cost: 150, blurb: 'A translucent jellyfish-ghost.',      hatAnchor: { x:  0, y:  -9, scale: 1.00 } },
];

// Hats / accessories. "none" is the default no-hat option.
const HATS = [
  { id: 'none',      name: 'No hat',    cost: 0   },
  { id: 'shades',    name: 'Shades',    cost: 0   },
  { id: 'tophat',    name: 'Top Hat',   cost: 25  },
  { id: 'propeller', name: 'Propeller', cost: 50  },
  { id: 'crown',     name: 'Crown',     cost: 100 },
];

const findAlien = (id) => ALIENS.find((a) => a.id === id) || ALIENS[0];

const LB_KEY = 'stellardrift_leaderboard_v1';
const LB_LIMIT = 10;

const loadLeaderboard = () => {
  try {
    const raw = localStorage.getItem(LB_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};
const saveLeaderboard = (entries) => {
  try { localStorage.setItem(LB_KEY, JSON.stringify(entries.slice(0, LB_LIMIT))); } catch {}
};

const loadFragments = () => {
  try { return parseInt(localStorage.getItem('stellardrift_fragments') || '0', 10) || 0; } catch { return 0; }
};
const saveFragments = (n) => {
  try { localStorage.setItem('stellardrift_fragments', String(Math.max(0, n | 0))); } catch {}
};

const loadOwned = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
};
const saveOwned = (key, arr) => {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch {}
};

const loadSelection = () => {
  try {
    const rawAlien = localStorage.getItem('stellardrift_alien');
    const rawHat = localStorage.getItem('stellardrift_hat');
    const alien = ALIENS.some((a) => a.id === rawAlien) ? rawAlien : 'blip';
    const hat = HATS.some((h) => h.id === rawHat) ? rawHat : 'none';
    return { alien, hat };
  } catch { return { alien: 'blip', hat: 'none' }; }
};
const saveSelection = (alien, hat) => {
  try {
    localStorage.setItem('stellardrift_alien', alien);
    localStorage.setItem('stellardrift_hat', hat);
  } catch {}
};

const loadSettings = () => {
  try {
    return {
      muted: localStorage.getItem('stellardrift_muted') === '1',
      vibration: localStorage.getItem('stellardrift_vibration') !== '0',
      colorBlind: localStorage.getItem('stellardrift_colorblind') === '1',
    };
  } catch { return { muted: false, vibration: true, colorBlind: false }; }
};
const saveSettings = (s) => {
  try {
    localStorage.setItem('stellardrift_muted', s.muted ? '1' : '0');
    localStorage.setItem('stellardrift_vibration', s.vibration ? '1' : '0');
    localStorage.setItem('stellardrift_colorblind', s.colorBlind ? '1' : '0');
  } catch {}
};

// Reference resolution for visual scaling. All hardcoded pixel values
// are tuned against this and multiplied by scale = min(w/BASE_W, h/BASE_H).
const BASE_W = 400;
const BASE_H = 800;
const getScale = (w, h) => Math.min(w / BASE_W, h / BASE_H);
// Horizontal-motion scale is decoupled from visual scale so the screen-cross
// tempo stays constant across aspect ratios (phone → iPad → desktop).
const getWidthScale = (w) => w / BASE_W;

// PHYSICS_BASE is in reference-resolution units. makePhysics(scale, widthScale)
// returns the scaled values used by the running game. Frame-count fields (spawn
// intervals) and proportional fields (shipX) are not scaled.
// Per-level speed bonus (ref-units) added on top of baseSpeed. Indexed by
// planetIdx (0 = Mercury / Level 1, 9 = The Void / Level 10).
const LEVEL_SPEED_BONUS = [0, 0.15, 0.3, 0.5, 0.7, 0.9, 1.15, 1.4, 1.7, 2.0];

const PHYSICS_BASE = {
  gravity: 0.38,
  impulse: -8.2,
  maxRiseSpeed: -10.0,
  maxFallSpeed: 11.0,
  baseSpeed: 2.5,
  speedPerObstacle: 0.05,
  startGap: 195,
  gapShrinkPerPlanet: 8,
  minGap: 140,
  startSpawnInterval: 95,
  spawnShrinkPerPlanet: 4,
  minSpawnInterval: 55,
  shipX: 0.28,
  shipRadius: 22,
  columnWidth: 70,
  lateralTiltInfluence: 0.16,
  lateralDamping: 0.93,
  lateralRecenter: 0.02,
  lateralAmbientSway: 0.04,
  tiltSmoothing: 0.18,
};

const makePhysics = (scale, widthScale) => ({
  // Vertical physics in PER-SECOND units, integrated by the fixed timestep in
  // simulateTick(). Conversion factor depends on the dimension's time exponent:
  //   • a VELOCITY (px/frame → px/s) scales by ×TICKS_PER_SECOND (×60)
  //   • an ACCELERATION (px/frame² → px/s²) scales by ×TICKS_PER_SECOND² (×3600)
  // because the unit of time appears squared. At a 1/60 s tick these reproduce
  // the original per-frame values exactly (gravity 0.38/frame² → 1368 px/s²,
  // impulse -8.2/frame → -492 px/s).
  gravity: PHYSICS_BASE.gravity * scale * TICKS_PER_SECOND * TICKS_PER_SECOND, // px/s² (accel ⇒ ×60²)
  impulse: PHYSICS_BASE.impulse * scale * TICKS_PER_SECOND,           // px/s (tap sets vy)
  maxRiseSpeed: PHYSICS_BASE.maxRiseSpeed * scale * TICKS_PER_SECOND, // px/s
  maxFallSpeed: PHYSICS_BASE.maxFallSpeed * scale * TICKS_PER_SECOND, // px/s
  // Horizontal scroll, also PER SECOND. widthScale keeps column-cross time
  // constant across aspect ratios; ×TICKS_PER_SECOND converts 2.5 px/frame → 150 px/s.
  baseSpeed: PHYSICS_BASE.baseSpeed * widthScale * TICKS_PER_SECOND,
  speedPerObstacle: PHYSICS_BASE.speedPerObstacle * widthScale * TICKS_PER_SECOND,
  startGap: PHYSICS_BASE.startGap * scale,
  gapShrinkPerPlanet: PHYSICS_BASE.gapShrinkPerPlanet * scale,
  minGap: PHYSICS_BASE.minGap * scale,
  startSpawnInterval: PHYSICS_BASE.startSpawnInterval,
  spawnShrinkPerPlanet: PHYSICS_BASE.spawnShrinkPerPlanet,
  minSpawnInterval: PHYSICS_BASE.minSpawnInterval,
  shipX: PHYSICS_BASE.shipX,
  shipRadius: PHYSICS_BASE.shipRadius * scale,
  columnWidth: PHYSICS_BASE.columnWidth * scale,
  lateralTiltInfluence: PHYSICS_BASE.lateralTiltInfluence * scale,
  lateralDamping: PHYSICS_BASE.lateralDamping,
  lateralRecenter: PHYSICS_BASE.lateralRecenter,
  lateralAmbientSway: PHYSICS_BASE.lateralAmbientSway * scale,
  tiltSmoothing: PHYSICS_BASE.tiltSmoothing,
  scale,
  widthScale,
});

export default function StellarDrift() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const offscreenRef = useRef(null);
  // Downsampled, pre-blurred copy of the offscreen scene. Updated once per
  // frame so every frosted card can sample a fresh blur via a single cheap
  // drawImage. Frosted cards no longer run ctx.filter per frame.
  const blurredSceneRef = useRef(null);
  // Per-card shadow cache. The drop shadow (shadowBlur=20px) is the only
  // remaining expensive op in a frosted card; cache it per card and refresh
  // only when the card resizes. Everything else (scene sample, tint, border,
  // highlight) is cheap enough to redraw each frame.
  const cardCacheRef = useRef(null);
  const audioRef = useRef(null);
  const gsRef = useRef(null);
  const rafRef = useRef(null);
  const initialSettings = loadSettings();
  const initialSel = loadSelection();
  const [view, setView] = useState('start');
  const viewRef = useRef('start');
  // Mirror of gs.planetIdx so DOM menus can derive frosted-glass tint and
  // accent color from the player's current planet (gsRef is a render-unsafe
  // imperative handle; reading it during render trips react-hooks lint rules).
  const [currentPlanetIdx, setCurrentPlanetIdx] = useState(0);
  const [openPanel, setOpenPanel] = useState(null); // null | 'aliens' | 'leaderboard' | 'settings'
  const [fragments, setFragments] = useState(loadFragments());
  const [ownedAliens, setOwnedAliens] = useState(() => {
    // Merge stored owned aliens with all cost-0 designs so any new free
    // aliens introduced after the player's last visit auto-unlock.
    const stored = loadOwned('stellardrift_owned_aliens');
    const free = ALIENS.filter((a) => a.cost === 0).map((a) => a.id);
    const merged = Array.from(new Set([...free, ...stored]));
    return merged;
  });
  const [ownedHats, setOwnedHats] = useState(() => {
    const stored = loadOwned('stellardrift_owned_hats');
    const free = HATS.filter((h) => h.cost === 0).map((h) => h.id);
    return Array.from(new Set([...free, ...stored]));
  });
  const [selectedAlien, setSelectedAlien] = useState(initialSel.alien);
  const [selectedHat, setSelectedHat] = useState(initialSel.hat);
  const [leaderboard, setLeaderboard] = useState(loadLeaderboard());
  const [pendingEntry, setPendingEntry] = useState(null); // {score, planet}
  const [initials, setInitials] = useState('AAA');
  const [lastEntryId, setLastEntryId] = useState(null);
  const [shareToast, setShareToast] = useState(false);
  const [muted, setMuted] = useState(initialSettings.muted);
  const [vibration, setVibration] = useState(initialSettings.vibration);
  const [colorBlind, setColorBlind] = useState(initialSettings.colorBlind);
  const mutedRef = useRef(initialSettings.muted);
  const vibrationRef = useRef(initialSettings.vibration);

  useEffect(() => { mutedRef.current = muted; }, [muted]);
  useEffect(() => { vibrationRef.current = vibration; }, [vibration]);
  useEffect(() => { saveSettings({ muted, vibration, colorBlind }); }, [muted, vibration, colorBlind]);
  useEffect(() => { saveSelection(selectedAlien, selectedHat); }, [selectedAlien, selectedHat]);
  useEffect(() => { saveOwned('stellardrift_owned_aliens', ownedAliens); }, [ownedAliens]);
  useEffect(() => { saveOwned('stellardrift_owned_hats', ownedHats); }, [ownedHats]);
  // Push current selection into the game state ref so the canvas renderer picks it up
  useEffect(() => {
    if (gsRef.current) {
      gsRef.current.alienId = selectedAlien;
      gsRef.current.hatId = selectedHat;
    }
  }, [selectedAlien, selectedHat]);
  // Hook callbacks for the canvas loop to notify React of state changes
  useEffect(() => {
    if (gsRef.current) {
      gsRef.current.onFragmentChange = setFragments;
      gsRef.current.onView = setView;
      gsRef.current.onPlanetChange = setCurrentPlanetIdx;
      gsRef.current.onLeaderboardEligible = setPendingEntry;
    }
  });

  // ─────────────────────────────────────────────────────────────
  // AUDIO ENGINE
  // ─────────────────────────────────────────────────────────────
  const initAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      const ctx = new AC();

      // Master bus
      const master = ctx.createGain();
      master.gain.value = 0.7;
      master.connect(ctx.destination);

      // Convolution reverb
      const reverb = ctx.createConvolver();
      const irLen = ctx.sampleRate * 2.2;
      const ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
      for (let c = 0; c < 2; c++) {
        const d = ir.getChannelData(c);
        for (let i = 0; i < irLen; i++) {
          d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLen, 2.5);
        }
      }
      reverb.buffer = ir;
      const reverbGain = ctx.createGain();
      reverbGain.gain.value = 0.25;
      reverb.connect(reverbGain).connect(master);

      // SFX bus
      const sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.8;
      sfxBus.connect(master);
      const sfxSend = ctx.createGain();
      sfxSend.gain.value = 0.3;
      sfxBus.connect(sfxSend).connect(reverb);

      // Music bus
      const musicBus = ctx.createGain();
      musicBus.gain.value = 0.0;
      musicBus.connect(master);
      const musicSend = ctx.createGain();
      musicSend.gain.value = 0.5;
      musicBus.connect(musicSend).connect(reverb);

      audioRef.current = {
        ctx, master, sfxBus, musicBus, reverb,
        musicState: { layer: 0, started: false, nodes: [], lookahead: 0, beatStep: 0 },
      };
      return audioRef.current;
    } catch (e) {
      console.warn('Audio init failed', e);
      return null;
    }
  }, []);

  const resumeAudio = useCallback(() => {
    const a = audioRef.current;
    if (a && a.ctx.state === 'suspended') a.ctx.resume();
  }, []);

  const playFlap = useCallback((pitch = 0.5) => {
    if (mutedRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    try {
      const t = a.ctx.currentTime;
      const baseFreq = 220 + pitch * 180;
      const o1 = a.ctx.createOscillator();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(baseFreq * 0.6, t);
      o1.frequency.exponentialRampToValueAtTime(baseFreq * 1.4, t + 0.08);
      const o2 = a.ctx.createOscillator();
      o2.type = 'triangle';
      o2.frequency.setValueAtTime(baseFreq * 1.2, t);
      o2.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, t + 0.08);
      const g = a.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o1.connect(g);
      o2.connect(g);
      g.connect(a.sfxBus);
      o1.start(t); o2.start(t);
      o1.stop(t + 0.2); o2.stop(t + 0.2);
    } catch {}
  }, []);

  const playScore = useCallback((combo = 1) => {
    if (mutedRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    try {
      const t = a.ctx.currentTime;
      const baseFreq = 700 + Math.min(combo - 1, 14) * 60;
      const o = a.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(baseFreq, t);
      const o2 = a.ctx.createOscillator();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(baseFreq * 2, t);
      const g = a.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.18, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      o.connect(g); o2.connect(g);
      g.connect(a.sfxBus);
      o.start(t); o2.start(t);
      o.stop(t + 0.5); o2.stop(t + 0.5);
    } catch {}
  }, []);

  const playCombo = useCallback(() => {
    if (mutedRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    try {
      const t0 = a.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const t = t0 + i * 0.07;
        const o = a.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, t);
        const g = a.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.15, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
        o.connect(g); g.connect(a.sfxBus);
        o.start(t); o.stop(t + 0.4);
      });
    } catch {}
  }, []);

  const playLevelUp = useCallback(() => {
    if (mutedRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    try {
      const t0 = a.ctx.currentTime;
      const chord = [261.63, 329.63, 392.00, 523.25, 659.25];
      chord.forEach((f, i) => {
        const t = t0 + i * 0.1;
        const o = a.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        const o2 = a.ctx.createOscillator();
        o2.type = 'triangle';
        o2.frequency.setValueAtTime(f * 2, t);
        const g = a.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.16, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
        o.connect(g); o2.connect(g);
        g.connect(a.sfxBus);
        o.start(t); o2.start(t);
        o.stop(t + 1.3); o2.stop(t + 1.3);
      });
    } catch {}
  }, []);

  const playFragment = useCallback(() => {
    if (mutedRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    try {
      const t0 = a.ctx.currentTime;
      // Sparkly chime — three high harmonics in a quick arpeggio
      const notes = [1396.91, 1760.00, 2349.32];
      notes.forEach((freq, i) => {
        const when = t0 + i * 0.028;
        const o = a.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, when);
        const o2 = a.ctx.createOscillator();
        o2.type = 'triangle';
        o2.frequency.setValueAtTime(freq * 2, when);
        const g = a.ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.11, when + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, when + 0.42);
        o.connect(g); o2.connect(g);
        g.connect(a.sfxBus);
        o.start(when); o2.start(when);
        o.stop(when + 0.45); o2.stop(when + 0.45);
      });
    } catch {}
  }, []);

  const playMenuTap = useCallback(() => {
    if (mutedRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    try {
      const t = a.ctx.currentTime;
      const o = a.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(880, t);
      o.frequency.exponentialRampToValueAtTime(1320, t + 0.06);
      const g = a.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.10, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.connect(g); g.connect(a.sfxBus);
      o.start(t); o.stop(t + 0.15);
    } catch {}
  }, []);

  const playDeath = useCallback(() => {
    if (mutedRef.current) return;
    const a = audioRef.current;
    if (!a) return;
    try {
      const t0 = a.ctx.currentTime;
      const notes = [440, 349.23, 261.63, 174.61];
      notes.forEach((f, i) => {
        const t = t0 + i * 0.12;
        const o = a.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 0.7, t + 0.5);
        const g = a.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.18, t + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        o.connect(g); g.connect(a.sfxBus);
        o.start(t); o.stop(t + 0.8);
      });
    } catch {}
  }, []);

  const startMusic = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.musicState.started) return;
    a.musicState.started = true;
    try {
      a.musicBus.gain.cancelScheduledValues(a.ctx.currentTime);
      a.musicBus.gain.linearRampToValueAtTime(0.35, a.ctx.currentTime + 1.5);
    } catch {}

    // Uptempo 4-bar I–V–vi–IV groove in C major (the "axis" progression —
    // the same shape behind countless feel-good pop songs). Deterministic
    // melodic hook so the player can hum along after one loop.
    const bpm = 128;
    const beatDur = 60 / bpm;
    const stepDur = beatDur / 4; // 16th notes — 16 per bar, 64 per loop
    const STEPS_PER_BAR = 16;
    const TOTAL_STEPS = 64;

    // Chord progression: C major, G major, A minor, F major (I-V-vi-IV).
    const chordRoots = [261.63, 196.00, 220.00, 174.61];
    const chordStacks = [
      [261.63, 329.63, 392.00], // C E G
      [196.00, 246.94, 293.66], // G B D
      [220.00, 261.63, 329.63], // A C E
      [174.61, 220.00, 261.63], // F A C
    ];

    // Lead hook — quarter notes (steps 0, 4, 8, 12 within each bar).
    // 4 notes per bar × 4 bars = 16 notes. Pleasant rising-falling contour
    // that resolves back to the root each bar.
    const leadHook = [
      // Bar 1: C major  — C, E, G, E
      523.25, 659.25, 783.99, 659.25,
      // Bar 2: G major  — D, G, B, G
      587.33, 783.99, 987.77, 783.99,
      // Bar 3: A minor  — C, E, A, E
      523.25, 659.25, 880.00, 659.25,
      // Bar 4: F major  — C, F, A, F
      523.25, 698.46, 880.00, 698.46,
    ];

    const scheduleNote = (when, freq, dur, type, volume, target) => {
      try {
        const o = a.ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, when);
        const g = a.ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(volume, when + 0.02);
        g.gain.linearRampToValueAtTime(volume * 0.7, when + dur * 0.5);
        g.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(g); g.connect(target || a.musicBus);
        o.start(when); o.stop(when + dur + 0.05);
      } catch {}
    };

    const scheduleBass = (when, freq, dur) => {
      // Punchy bass with quick pluck attack
      try {
        const o = a.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(freq * 1.5, when);
        o.frequency.exponentialRampToValueAtTime(freq, when + 0.04);
        const g = a.ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.20, when + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o.connect(g); g.connect(a.musicBus);
        o.start(when); o.stop(when + dur + 0.05);
      } catch {}
    };

    const schedulePad = (when, freq, dur) => {
      try {
        const o1 = a.ctx.createOscillator();
        const o2 = a.ctx.createOscillator();
        o1.type = 'triangle';
        o2.type = 'triangle';
        o1.frequency.setValueAtTime(freq, when);
        o2.frequency.setValueAtTime(freq * 1.005, when);
        const g = a.ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.045, when + 0.25);
        g.gain.linearRampToValueAtTime(0.035, when + dur - 0.3);
        g.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o1.connect(g); o2.connect(g);
        g.connect(a.musicBus);
        o1.start(when); o2.start(when);
        o1.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
      } catch {}
    };

    const scheduleKick = (when) => {
      try {
        const o = a.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(120, when);
        o.frequency.exponentialRampToValueAtTime(38, when + 0.10);
        const g = a.ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.26, when + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
        o.connect(g); g.connect(a.musicBus);
        o.start(when); o.stop(when + 0.2);
      } catch {}
    };

    const scheduleSnare = (when) => {
      // Quick noise burst with a body tone for a bright clap-snare hybrid
      try {
        const bufSize = a.ctx.sampleRate * 0.12;
        const buf = a.ctx.createBuffer(1, bufSize, a.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1);
        const src = a.ctx.createBufferSource();
        src.buffer = buf;
        const hp = a.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1800;
        const ng = a.ctx.createGain();
        ng.gain.setValueAtTime(0.18, when);
        ng.gain.exponentialRampToValueAtTime(0.001, when + 0.13);
        src.connect(hp).connect(ng).connect(a.musicBus);
        src.start(when); src.stop(when + 0.14);
        // Body tone
        const o = a.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(220, when);
        o.frequency.exponentialRampToValueAtTime(110, when + 0.08);
        const og = a.ctx.createGain();
        og.gain.setValueAtTime(0.10, when);
        og.gain.exponentialRampToValueAtTime(0.001, when + 0.08);
        o.connect(og); og.connect(a.musicBus);
        o.start(when); o.stop(when + 0.1);
      } catch {}
    };

    const scheduleHat = (when, open = false) => {
      try {
        const bufSize = a.ctx.sampleRate * (open ? 0.12 : 0.04);
        const buf = a.ctx.createBuffer(1, bufSize, a.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1);
        const src = a.ctx.createBufferSource();
        src.buffer = buf;
        const hp = a.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 7500;
        const g = a.ctx.createGain();
        g.gain.setValueAtTime(open ? 0.045 : 0.06, when);
        g.gain.exponentialRampToValueAtTime(0.001, when + (open ? 0.12 : 0.035));
        src.connect(hp).connect(g).connect(a.musicBus);
        src.start(when); src.stop(when + (open ? 0.13 : 0.045));
      } catch {}
    };

    a.musicState.beatStep = 0;
    a.musicState.lookahead = a.ctx.currentTime + 0.1;

    const tick = () => {
      if (!a.musicState.started) return;
      const now = a.ctx.currentTime;
      while (a.musicState.lookahead < now + 0.4) {
        const step = a.musicState.beatStep;
        const t = a.musicState.lookahead;
        const layer = a.musicState.layer;
        const barIdx = Math.floor(step / STEPS_PER_BAR);
        const stepInBar = step % STEPS_PER_BAR;
        const beatInBar = Math.floor(stepInBar / 4);   // 0..3
        const stepInBeat = stepInBar % 4;              // 0..3 (16ths in a beat)
        const root = chordRoots[barIdx];
        const chord = chordStacks[barIdx];

        // Pad chord — held one full bar, drops in at step 0 of each bar.
        // Always present (layer 0+) so even the menu has harmonic warmth.
        if (stepInBar === 0) {
          chord.forEach((f) => schedulePad(t, f, beatDur * 4));
        }

        // Bass — root on beats 1 & 3, octave bounce on the "and" of 2 & 4.
        if (layer >= 1) {
          if (beatInBar === 0 && stepInBeat === 0) scheduleBass(t, root * 0.5, beatDur * 0.6);
          if (beatInBar === 2 && stepInBeat === 0) scheduleBass(t, root * 0.5, beatDur * 0.6);
          if (beatInBar === 1 && stepInBeat === 2) scheduleBass(t, root, beatDur * 0.25);
          if (beatInBar === 3 && stepInBeat === 2) scheduleBass(t, root, beatDur * 0.25);
        }

        // Kick — four on the floor (every quarter note).
        if (layer >= 1 && stepInBeat === 0) {
          scheduleKick(t);
        }

        // Snare — back-beat on beats 2 and 4.
        if (layer >= 1 && (beatInBar === 1 || beatInBar === 3) && stepInBeat === 0) {
          scheduleSnare(t);
        }

        // Hi-hat — 8ths (every 2 steps). Open hat on the "and" of beat 4.
        if (layer >= 2 && stepInBeat % 2 === 0) {
          const isOpen = (beatInBar === 3 && stepInBeat === 2);
          scheduleHat(t, isOpen);
        }

        // Lead hook — quarter notes, deterministic 16-note loop over 4 bars.
        if (layer >= 2 && stepInBeat === 0) {
          const idx = barIdx * 4 + beatInBar;
          const freq = leadHook[idx];
          if (freq > 0) scheduleNote(t, freq, beatDur * 0.85, 'square', 0.055);
        }

        a.musicState.lookahead += stepDur;
        a.musicState.beatStep = (step + 1) % TOTAL_STEPS;
      }
      a.musicState.timer = setTimeout(tick, 50);
    };
    tick();
  }, []);

  const setMusicLayer = useCallback((layer) => {
    const a = audioRef.current;
    if (!a) return;
    a.musicState.layer = layer;
  }, []);

  const stopMusic = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.musicState.started = false;
    if (a.musicState.timer) clearTimeout(a.musicState.timer);
    try {
      a.musicBus.gain.cancelScheduledValues(a.ctx.currentTime);
      a.musicBus.gain.linearRampToValueAtTime(0, a.ctx.currentTime + 0.5);
    } catch {}
  }, []);

  // ─────────────────────────────────────────────────────────────
  // GAME STATE INIT
  // ─────────────────────────────────────────────────────────────
  const makeStars = useCallback((w, h, count, s = 1) => {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.85,
        r: (Math.random() * 1.4 + 0.3) * s,
        a: Math.random() * 0.6 + 0.2,
        tw: Math.random() * Math.PI * 2,
      });
    }
    return stars;
  }, []);

  const makeDust = useCallback((w, h, count, s = 1) => {
    const dust = [];
    for (let i = 0; i < count; i++) {
      dust.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: -(Math.random() * 0.5 + 0.2) * s,
        vy: (Math.random() - 0.5) * 0.1 * s,
        r: (Math.random() * 1.8 + 0.5) * s,
        a: Math.random() * 0.35 + 0.1,
      });
    }
    return dust;
  }, []);

  const initGameState = useCallback((w, h) => {
    const best = parseInt(localStorage.getItem('stellardrift_best') || '0', 10);
    const scale = getScale(w, h);
    const widthScale = getWidthScale(w);
    const phys = makePhysics(scale, widthScale);
    const sel = loadSelection();
    return {
      w, h,
      scale,
      phys,
      alienId: sel.alien,
      hatId: sel.hat,
      state: 'start', // 'start' | 'playing' | 'dead'
      ship: {
        x: w * phys.shipX,
        y: h * 0.5,
        vx: 0,
        vy: 0,
        tilt: 0,
        idleT: 0,
        trail: [],
      },
      columns: [],
      fragments: [],
      particles: [],
      rings: [],
      popups: [],
      score: 0,
      best,
      newBest: false,
      combo: 0,
      comboTimer: 0,
      planetIdx: 0,
      prevPlanetIdx: 0,
      planetTransition: 0, // 0..1 (1 = fully on new planet)
      obstaclesInPlanet: 0,
      framesSinceSpawn: 999,
      spawnInterval: phys.startSpawnInterval,
      gap: phys.startGap,
      stars: makeStars(w, h, 60, scale),
      dust: makeDust(w, h, 30, scale),
      shake: 0,
      flash: 0,
      transitionCard: 0, // counts down frames showing the card
      transitionCardPlanet: 0,
      deathOverlay: 0,
      time: 0,
      lastFlapFrame: -10,
      hasInteracted: false,
      // Fixed-timestep accumulator state (Phase 0.5). _lastFrameTime is set on
      // the first rendered frame; _accumulator banks real elapsed time and is
      // drained one FIXED_DT tick at a time in step().
      _lastFrameTime: null,
      _accumulator: 0,
    };
  }, [makeStars, makeDust]);

  // ─────────────────────────────────────────────────────────────
  // DRAW HELPERS
  // ─────────────────────────────────────────────────────────────
  const drawBackground = useCallback((ctx, w, h, planet, t, s = 1) => {
    // Sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, planet.sky[0]);
    g.addColorStop(0.55, planet.sky[1]);
    g.addColorStop(1, planet.sky[2]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Planet-specific background scenery
    const name = planet.name;

    if (name === 'MERCURY') {
      // Distant sun glow (upper-left), painted not photoreal
      ctx.save();
      const sunX = w * 0.18, sunY = h * 0.22, sunR = Math.min(w, h) * 0.10;
      const sunHalo = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR * 3.4);
      sunHalo.addColorStop(0, 'rgba(255, 235, 200, 0.55)');
      sunHalo.addColorStop(0.4, 'rgba(255, 200, 160, 0.20)');
      sunHalo.addColorStop(1, 'rgba(255, 180, 140, 0)');
      ctx.fillStyle = sunHalo;
      ctx.beginPath(); ctx.arc(sunX, sunY, sunR * 3.4, 0, Math.PI * 2); ctx.fill();
      const sunBody = ctx.createRadialGradient(sunX - sunR * 0.2, sunY - sunR * 0.2, 0, sunX, sunY, sunR);
      sunBody.addColorStop(0, '#fff7dc');
      sunBody.addColorStop(0.7, '#fbd8a8');
      sunBody.addColorStop(1, '#e9a888');
      ctx.fillStyle = sunBody;
      ctx.beginPath(); ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Hot haze shimmer near horizon
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const y = h * (0.75 + i * 0.04);
        const grad = ctx.createLinearGradient(0, y, 0, y + 30 * s);
        grad.addColorStop(0, 'rgba(255, 200, 160, 0)');
        grad.addColorStop(0.5, `rgba(255, 200, 160, ${0.10 + Math.sin(t * 0.04 + i) * 0.03})`);
        grad.addColorStop(1, 'rgba(255, 200, 160, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, w, 30 * s);
      }
      ctx.restore();
      // Heavily cratered terrain silhouette (painted, soft edges)
      ctx.save();
      const terrainGrad = ctx.createLinearGradient(0, h * 0.85, 0, h);
      terrainGrad.addColorStop(0, '#7a3f50');
      terrainGrad.addColorStop(1, '#3a1e2c');
      ctx.fillStyle = terrainGrad;
      ctx.beginPath();
      ctx.moveTo(0, h);
      const segs = 22;
      for (let i = 0; i <= segs; i++) {
        const x = (i / segs) * w;
        const baseY = h * 0.86;
        const v = (Math.sin(i * 1.7) * 14 + Math.sin(i * 3.4) * 6 + Math.sin(i * 5.1) * 3) * s;
        ctx.lineTo(x, baseY + v);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      // Craters along terrain — circles with shadowed inside, lit rim
      const craters = [
        { fx: 0.10, fy: 0.92, r: 0.045 },
        { fx: 0.28, fy: 0.94, r: 0.030 },
        { fx: 0.42, fy: 0.91, r: 0.055 },
        { fx: 0.62, fy: 0.93, r: 0.038 },
        { fx: 0.78, fy: 0.95, r: 0.050 },
        { fx: 0.92, fy: 0.92, r: 0.028 },
      ];
      craters.forEach((c) => {
        const cx = w * c.fx, cy = h * c.fy, cr = Math.min(w, h) * c.r;
        // Shadow interior
        ctx.fillStyle = 'rgba(30, 15, 22, 0.55)';
        ctx.beginPath(); ctx.ellipse(cx, cy, cr, cr * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        // Lit rim toward sun (upper-left direction)
        ctx.strokeStyle = 'rgba(255, 220, 190, 0.55)';
        ctx.lineWidth = 1.5 * s;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cr, cr * 0.45, 0, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      });
      ctx.restore();
    }

    if (name === 'VENUS') {
      // Thick swirling cloud bands with sinusoidal undulation
      ctx.save();
      for (let i = 0; i < 9; i++) {
        const baseY = (i / 9) * h;
        const bandH = 36 * s;
        // Sweeping bezier band — each segment offset by a sine wave
        ctx.beginPath();
        const segments = 16;
        for (let j = 0; j <= segments; j++) {
          const x = (j / segments) * w;
          const wave = Math.sin(j * 0.6 + t * 0.015 + i * 0.9) * 8 * s;
          const y = baseY + wave;
          if (j === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let j = segments; j >= 0; j--) {
          const x = (j / segments) * w;
          const wave = Math.sin(j * 0.6 + t * 0.015 + i * 0.9) * 8 * s;
          ctx.lineTo(x, baseY + wave + bandH);
        }
        ctx.closePath();
        const bandGrad = ctx.createLinearGradient(0, baseY, 0, baseY + bandH);
        const alpha = 0.10 + (i % 2) * 0.06;
        bandGrad.addColorStop(0, `rgba(255, 232, 188, 0)`);
        bandGrad.addColorStop(0.5, `rgba(255, 224, 168, ${alpha})`);
        bandGrad.addColorStop(1, `rgba(255, 232, 188, 0)`);
        ctx.fillStyle = bandGrad;
        ctx.fill();
      }
      // Hazy golden glow overlay
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.7);
      glow.addColorStop(0, 'rgba(255, 232, 180, 0.18)');
      glow.addColorStop(1, 'rgba(255, 232, 180, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      // Occasional lightning flash — pseudo-random based on time
      const flashWindow = Math.floor(t / 220);
      const flashSeed = (flashWindow * 1664525 + 1013904223) >>> 0;
      const flashFrame = t % 220;
      if (flashFrame < 7 && (flashSeed % 5) === 0) {
        const fade = 1 - flashFrame / 7;
        ctx.save();
        // Sky-wide pale flash
        ctx.fillStyle = `rgba(255, 248, 220, ${0.35 * fade})`;
        ctx.fillRect(0, 0, w, h);
        // Branching bolt
        const boltX = w * (0.25 + ((flashSeed >> 4) % 50) / 100);
        ctx.strokeStyle = `rgba(255, 250, 230, ${0.85 * fade})`;
        ctx.lineWidth = 1.8 * s;
        ctx.beginPath();
        let px = boltX, py = h * 0.15;
        ctx.moveTo(px, py);
        for (let k = 0; k < 6; k++) {
          px += (((flashSeed >> (k * 3)) & 7) - 3) * 8 * s;
          py += (h * 0.10);
          ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.restore();
      }
    }

    if (name === 'EARTH') {
      // The big Earth in the background (upper-right)
      ctx.save();
      const ex = w * 0.74, ey = h * 0.30, er = Math.min(w, h) * 0.20;
      // Halo
      const halo = ctx.createRadialGradient(ex, ey, er * 0.95, ex, ey, er * 1.5);
      halo.addColorStop(0, 'rgba(170, 210, 240, 0.30)');
      halo.addColorStop(1, 'rgba(170, 210, 240, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(ex, ey, er * 1.5, 0, Math.PI * 2); ctx.fill();
      // Ocean body (soft pastel cobalt)
      const earthGrad = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.3, 0, ex, ey, er);
      earthGrad.addColorStop(0, '#a6c8e0');
      earthGrad.addColorStop(0.6, '#6a8eb4');
      earthGrad.addColorStop(1, '#324a6e');
      ctx.fillStyle = earthGrad;
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
      // Continents (soft sage green, clearly visible shapes)
      ctx.save();
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.clip();
      const drift = (t * 0.15) % (er * 2);
      // Painted continent silhouettes — vaguely Americas + Africa shapes
      const continents = [
        { dx: -0.35, dy: -0.10, rx: 0.18, ry: 0.30, rot: 0.4 },
        { dx: -0.10, dy:  0.20, rx: 0.22, ry: 0.18, rot: -0.2 },
        { dx:  0.30, dy: -0.15, rx: 0.20, ry: 0.32, rot: 0.5 },
        { dx:  0.15, dy:  0.32, rx: 0.16, ry: 0.10, rot: 0.0 },
      ];
      ctx.fillStyle = '#86a878';
      continents.forEach((c, i) => {
        const cx = ex + (c.dx * er * 2 + drift) % (er * 2) - er;
        const cy = ey + c.dy * er * 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, er * c.rx, er * c.ry, c.rot + i * 0.05, 0, Math.PI * 2);
        ctx.fill();
        // Inland shadow for depth
        ctx.fillStyle = 'rgba(60, 80, 50, 0.30)';
        ctx.beginPath();
        ctx.ellipse(cx + er * 0.04, cy + er * 0.05, er * c.rx * 0.6, er * c.ry * 0.6, c.rot + i * 0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#86a878';
      });
      // Soft cloud swirls
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      for (let i = 0; i < 6; i++) {
        const cx = ex - er + ((i * er * 0.5 + drift * 1.4 + 50) % (er * 2));
        const cy = ey - er * 0.5 + Math.sin(i * 2.1 + t * 0.01) * er * 0.6;
        ctx.beginPath();
        ctx.ellipse(cx, cy, er * 0.28, er * 0.09, Math.sin(i) * 0.3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // The Moon — small pale companion
      const mx = w * 0.30, my = h * 0.18, mr = Math.min(w, h) * 0.045;
      const moonHalo = ctx.createRadialGradient(mx, my, mr * 0.9, mx, my, mr * 1.8);
      moonHalo.addColorStop(0, 'rgba(240, 235, 220, 0.30)');
      moonHalo.addColorStop(1, 'rgba(240, 235, 220, 0)');
      ctx.fillStyle = moonHalo;
      ctx.beginPath(); ctx.arc(mx, my, mr * 1.8, 0, Math.PI * 2); ctx.fill();
      const moonGrad = ctx.createRadialGradient(mx - mr * 0.3, my - mr * 0.3, 0, mx, my, mr);
      moonGrad.addColorStop(0, '#f3edd8');
      moonGrad.addColorStop(0.7, '#c8bea0');
      moonGrad.addColorStop(1, '#6a5e48');
      ctx.fillStyle = moonGrad;
      ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();
      // Subtle moon craters
      ctx.fillStyle = 'rgba(80, 70, 55, 0.30)';
      ctx.beginPath(); ctx.arc(mx + mr * 0.1, my + mr * 0.15, mr * 0.18, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(mx - mr * 0.25, my - mr * 0.10, mr * 0.12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(mx + mr * 0.30, my - mr * 0.20, mr * 0.10, 0, Math.PI * 2); ctx.fill();
      // Cloud wisps across the sky
      ctx.fillStyle = 'rgba(245, 235, 250, 0.20)';
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 250 * s - t * 0.3) % (w + 200 * s)) - 100 * s;
        const cy = h * (0.50 + i * 0.10);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 80 * s, 14 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (name === 'MARS') {
      // Horizon haze
      ctx.save();
      const haze = ctx.createLinearGradient(0, h * 0.6, 0, h);
      haze.addColorStop(0, 'rgba(240, 180, 150, 0)');
      haze.addColorStop(1, 'rgba(240, 180, 150, 0.30)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, h * 0.6, w, h * 0.4);
      // Mars planet (upper-right) with visible polar ice cap
      const px = w * 0.78, py = h * 0.24, pr = Math.min(w, h) * 0.14;
      const halo = ctx.createRadialGradient(px, py, pr * 0.85, px, py, pr * 1.4);
      halo.addColorStop(0, 'rgba(255, 220, 200, 0.30)');
      halo.addColorStop(1, 'rgba(255, 220, 200, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(px, py, pr * 1.4, 0, Math.PI * 2); ctx.fill();
      const grad = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
      grad.addColorStop(0, '#e09a82');
      grad.addColorStop(0.7, '#a45a5e');
      grad.addColorStop(1, '#5a2a36');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      // Polar ice cap on top
      ctx.save();
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(255, 248, 240, 0.90)';
      ctx.beginPath();
      ctx.ellipse(px, py - pr * 0.78, pr * 0.55, pr * 0.22, 0, 0, Math.PI * 2);
      ctx.fill();
      // Faint surface marks (Valles Marineris suggestion)
      ctx.strokeStyle = 'rgba(80, 30, 30, 0.30)';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(px - pr * 0.6, py + pr * 0.15);
      ctx.quadraticCurveTo(px, py + pr * 0.05, px + pr * 0.55, py + pr * 0.20);
      ctx.stroke();
      ctx.restore();
      // Phobos and Deimos — two small specks
      const ph_x = px + pr * 1.6, ph_y = py + pr * 0.3, ph_r = pr * 0.10;
      const ph_grad = ctx.createRadialGradient(ph_x - ph_r * 0.3, ph_y - ph_r * 0.3, 0, ph_x, ph_y, ph_r);
      ph_grad.addColorStop(0, '#bcaa9a');
      ph_grad.addColorStop(1, '#5a4a3e');
      ctx.fillStyle = ph_grad;
      ctx.beginPath(); ctx.arc(ph_x, ph_y, ph_r, 0, Math.PI * 2); ctx.fill();
      const de_x = px - pr * 1.45, de_y = py - pr * 0.4, de_r = pr * 0.07;
      const de_grad = ctx.createRadialGradient(de_x - de_r * 0.3, de_y - de_r * 0.3, 0, de_x, de_y, de_r);
      de_grad.addColorStop(0, '#c8b6a6');
      de_grad.addColorStop(1, '#6a5848');
      ctx.fillStyle = de_grad;
      ctx.beginPath(); ctx.arc(de_x, de_y, de_r, 0, Math.PI * 2); ctx.fill();
      // Dust devils — vertical spiraling cyclones near ground
      const devils = [{ fx: 0.18, phase: 0 }, { fx: 0.62, phase: 1.7 }];
      devils.forEach((d) => {
        const baseX = w * d.fx;
        const baseY = h * 0.92;
        const height = h * 0.18;
        ctx.save();
        ctx.strokeStyle = 'rgba(240, 190, 160, 0.35)';
        ctx.lineWidth = 2 * s;
        ctx.beginPath();
        const turns = 12;
        for (let k = 0; k <= turns; k++) {
          const yProgress = k / turns;
          const y = baseY - height * yProgress;
          const ampl = (1 - yProgress) * 14 * s;
          const xWobble = Math.sin(t * 0.06 + d.phase + k * 0.7) * ampl;
          if (k === 0) ctx.moveTo(baseX + xWobble, y);
          else ctx.lineTo(baseX + xWobble, y);
        }
        ctx.stroke();
        // Base dust puff
        const puff = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, 18 * s);
        puff.addColorStop(0, 'rgba(240, 190, 160, 0.40)');
        puff.addColorStop(1, 'rgba(240, 190, 160, 0)');
        ctx.fillStyle = puff;
        ctx.beginPath(); ctx.arc(baseX, baseY, 18 * s, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      ctx.restore();
    }

    if (name === 'JUPITER') {
      // Banded atmosphere — overlay slow horizontal stripes
      ctx.save();
      const bands = [
        { y: 0.08, c: 'rgba(255, 220, 170, 0.28)' },
        { y: 0.18, c: 'rgba(180, 120, 70, 0.30)' },
        { y: 0.30, c: 'rgba(255, 230, 180, 0.25)' },
        { y: 0.42, c: 'rgba(200, 140, 80, 0.30)' },
        { y: 0.55, c: 'rgba(255, 220, 170, 0.22)' },
        { y: 0.70, c: 'rgba(180, 120, 70, 0.28)' },
        { y: 0.85, c: 'rgba(255, 230, 180, 0.20)' },
      ];
      bands.forEach((b) => {
        const grad = ctx.createLinearGradient(0, h * b.y, 0, h * b.y + h * 0.10);
        grad.addColorStop(0, 'rgba(255, 230, 180, 0)');
        grad.addColorStop(0.5, b.c);
        grad.addColorStop(1, 'rgba(255, 230, 180, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, h * b.y, w, h * 0.10);
      });
      // Storm streaks
      ctx.strokeStyle = 'rgba(255, 240, 200, 0.12)';
      ctx.lineWidth = 1.5 * s;
      for (let i = 0; i < 18; i++) {
        const y = (i / 18) * h + Math.sin(t * 0.02 + i) * 4 * s;
        const xOff = (t * 0.6 + i * 60 * s) % (w + 100 * s) - 100 * s;
        ctx.beginPath();
        ctx.moveTo(xOff, y);
        ctx.lineTo(xOff + 70 * s, y + Math.sin(i) * 3 * s);
        ctx.stroke();
      }
      // Great Red Spot — softened to fit pastel palette
      const rx = w * 0.72, ry = h * 0.50;
      const pulse = 0.85 + Math.sin(t * 0.025) * 0.15;
      const spotR = 70 * s;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.scale(1, 0.55);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, spotR * pulse);
      sg.addColorStop(0, 'rgba(214, 124, 96, 0.85)');
      sg.addColorStop(0.6, 'rgba(168, 80, 78, 0.55)');
      sg.addColorStop(1, 'rgba(120, 60, 60, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(0, 0, spotR * pulse, 0, Math.PI * 2); ctx.fill();
      // Inner darker eye
      const eye = ctx.createRadialGradient(0, 0, 0, 0, 0, spotR * 0.35);
      eye.addColorStop(0, 'rgba(150, 70, 60, 0.55)');
      eye.addColorStop(1, 'rgba(150, 70, 60, 0)');
      ctx.fillStyle = eye;
      ctx.beginPath(); ctx.arc(0, 0, spotR * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Io — small fiery-yellow moon orbiting drift
      const ioOrb = t * 0.0025;
      const io_cx = w * 0.25 + Math.cos(ioOrb) * w * 0.04;
      const io_cy = h * 0.20 + Math.sin(ioOrb) * h * 0.02;
      const io_r = Math.min(w, h) * 0.025;
      const ioHalo = ctx.createRadialGradient(io_cx, io_cy, io_r * 0.9, io_cx, io_cy, io_r * 2);
      ioHalo.addColorStop(0, 'rgba(255, 220, 150, 0.40)');
      ioHalo.addColorStop(1, 'rgba(255, 220, 150, 0)');
      ctx.fillStyle = ioHalo;
      ctx.beginPath(); ctx.arc(io_cx, io_cy, io_r * 2, 0, Math.PI * 2); ctx.fill();
      const ioGrad = ctx.createRadialGradient(io_cx - io_r * 0.3, io_cy - io_r * 0.3, 0, io_cx, io_cy, io_r);
      ioGrad.addColorStop(0, '#f9e090');
      ioGrad.addColorStop(0.7, '#d49860');
      ioGrad.addColorStop(1, '#6a4030');
      ctx.fillStyle = ioGrad;
      ctx.beginPath(); ctx.arc(io_cx, io_cy, io_r, 0, Math.PI * 2); ctx.fill();
      // Europa — small pale-blue moon
      const euOrb = t * 0.0018 + 2.1;
      const eu_cx = w * 0.40 + Math.cos(euOrb) * w * 0.05;
      const eu_cy = h * 0.12 + Math.sin(euOrb) * h * 0.015;
      const eu_r = Math.min(w, h) * 0.020;
      const euHalo = ctx.createRadialGradient(eu_cx, eu_cy, eu_r * 0.9, eu_cx, eu_cy, eu_r * 2);
      euHalo.addColorStop(0, 'rgba(200, 220, 240, 0.35)');
      euHalo.addColorStop(1, 'rgba(200, 220, 240, 0)');
      ctx.fillStyle = euHalo;
      ctx.beginPath(); ctx.arc(eu_cx, eu_cy, eu_r * 2, 0, Math.PI * 2); ctx.fill();
      const euGrad = ctx.createRadialGradient(eu_cx - eu_r * 0.3, eu_cy - eu_r * 0.3, 0, eu_cx, eu_cy, eu_r);
      euGrad.addColorStop(0, '#dee8f0');
      euGrad.addColorStop(0.7, '#92aabe');
      euGrad.addColorStop(1, '#3a5068');
      ctx.fillStyle = euGrad;
      ctx.beginPath(); ctx.arc(eu_cx, eu_cy, eu_r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    if (name === 'SATURN') {
      // Saturn dominant upper background — rings span wide
      ctx.save();
      const sx = w * 0.55, sy = h * 0.32;
      const sr = Math.min(w, h) * 0.20;
      // Ring system definition with explicit Cassini Division
      const ringBands = [
        { r0: 1.30, r1: 1.45, color: 'rgba(232, 210, 178, 0.55)' }, // D/C
        { r0: 1.48, r1: 1.78, color: 'rgba(248, 232, 200, 0.85)' }, // B (broadest, brightest)
        // Cassini Division gap from 1.78 to 1.90
        { r0: 1.90, r1: 2.15, color: 'rgba(220, 200, 168, 0.70)' }, // A
        { r0: 2.18, r1: 2.30, color: 'rgba(200, 180, 158, 0.35)' }, // F (faint outer)
      ];
      const drawRing = (rOuter, rInner, color, startA, endA) => {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(-0.25);
        ctx.scale(1, 0.20);
        ctx.beginPath();
        ctx.arc(0, 0, sr * rOuter, startA, endA);
        ctx.arc(0, 0, sr * rInner, endA, startA, true);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();
      };
      // Rings — back half (behind planet)
      ringBands.forEach((b) => drawRing(b.r1, b.r0, b.color, Math.PI, Math.PI * 2));
      // Planet body
      const grad = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 0, sx, sy, sr);
      grad.addColorStop(0, '#fbe8c4');
      grad.addColorStop(0.6, '#c8a888');
      grad.addColorStop(1, '#6c5470');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      // Soft horizontal bands
      ctx.save();
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = 'rgba(120, 90, 110, 0.20)';
      ctx.lineWidth = 3 * s;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sx - sr, sy + i * sr * 0.25);
        ctx.lineTo(sx + sr, sy + i * sr * 0.25);
        ctx.stroke();
      }
      ctx.restore();
      // Rings — front half
      ringBands.forEach((b) => drawRing(b.r1, b.r0, b.color, 0, Math.PI));
      // Ring shadow on planet
      ctx.save();
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(60, 40, 60, 0.35)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + sr * 0.05, sr, sr * 0.10, -0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    if (name === 'URANUS') {
      // Uranus planet, tilted at famous ~98 degrees so the pole faces us —
      // its rings appear nearly vertical (perpendicular to the ecliptic).
      ctx.save();
      const ux = w * 0.74, uy = h * 0.30, ur = Math.min(w, h) * 0.18;
      const tiltAngle = (98 * Math.PI) / 180; // ring plane tilt
      // Halo
      const halo = ctx.createRadialGradient(ux, uy, ur * 0.95, ux, uy, ur * 1.6);
      halo.addColorStop(0, 'rgba(180, 232, 220, 0.30)');
      halo.addColorStop(1, 'rgba(180, 232, 220, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(ux, uy, ur * 1.6, 0, Math.PI * 2); ctx.fill();
      // Planet body — soft mint with pole-on lighting
      const ugrad = ctx.createRadialGradient(ux - ur * 0.3, uy - ur * 0.3, 0, ux, uy, ur);
      ugrad.addColorStop(0, '#d8f0e6');
      ugrad.addColorStop(0.6, '#90c0b2');
      ugrad.addColorStop(1, '#3e6b62');
      ctx.fillStyle = ugrad;
      ctx.beginPath(); ctx.arc(ux, uy, ur, 0, Math.PI * 2); ctx.fill();
      // Polar cap (lighter at the visible pole, hinting at the tilt)
      ctx.save();
      ctx.beginPath(); ctx.arc(ux, uy, ur, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(232, 248, 244, 0.45)';
      ctx.beginPath();
      ctx.ellipse(ux + ur * 0.05, uy - ur * 0.10, ur * 0.65, ur * 0.55, tiltAngle - Math.PI / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // Rings — nearly vertical because the planet is tipped over.
      // Drawn back-half then planet then front-half so the planet occludes properly.
      const drawURing = (rMult, alpha, lwScale, startA, endA) => {
        ctx.save();
        ctx.translate(ux, uy);
        ctx.rotate(tiltAngle - Math.PI / 2);
        ctx.scale(0.18, 1);
        ctx.beginPath();
        ctx.arc(0, 0, ur * rMult, startA, endA);
        ctx.strokeStyle = `rgba(220, 248, 240, ${alpha})`;
        ctx.lineWidth = lwScale * s;
        ctx.stroke();
        ctx.restore();
      };
      // Back half — top semicircle in pre-rotation space
      [1.40, 1.55, 1.72, 1.90].forEach((rm, i) => {
        drawURing(rm, 0.32 - i * 0.05, 2 - i * 0.3, Math.PI, Math.PI * 2);
      });
      // Front half — bottom semicircle
      [1.40, 1.55, 1.72, 1.90].forEach((rm, i) => {
        drawURing(rm, 0.55 - i * 0.08, 2 - i * 0.3, 0, Math.PI);
      });
      ctx.restore();
      // Distant background ring particles (subtle sparkle)
      ctx.save();
      ctx.fillStyle = 'rgba(220, 250, 245, 0.50)';
      for (let i = 0; i < 24; i++) {
        const x = ((i * 73 + t * 0.6) % w);
        const y = ((i * 47 + t * 0.4) % h);
        ctx.beginPath(); ctx.arc(x, y, 1.2 * s, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    if (name === 'NEPTUNE') {
      ctx.save();
      // Churning lavender-cobalt storm clouds
      const cloudR = 130 * s;
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 200 * s + t * 0.4) % (w + 300 * s)) - 150 * s;
        const cy = h * (0.20 + i * 0.15);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, cloudR);
        grad.addColorStop(0, 'rgba(160, 170, 230, 0.30)');
        grad.addColorStop(1, 'rgba(160, 170, 230, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, cloudR, 0, Math.PI * 2); ctx.fill();
      }
      // The Great Dark Spot — a deep oval bruise rotating slowly
      const dsx = w * 0.62, dsy = h * 0.38;
      const dsR = Math.min(w, h) * 0.13;
      const dsPulse = 0.92 + Math.sin(t * 0.02) * 0.08;
      ctx.save();
      ctx.translate(dsx, dsy);
      ctx.rotate(Math.sin(t * 0.003) * 0.12);
      ctx.scale(1, 0.62);
      const dsGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, dsR * dsPulse);
      dsGrad.addColorStop(0, 'rgba(40, 50, 100, 0.85)');
      dsGrad.addColorStop(0.6, 'rgba(60, 70, 130, 0.55)');
      dsGrad.addColorStop(1, 'rgba(80, 90, 150, 0)');
      ctx.fillStyle = dsGrad;
      ctx.beginPath(); ctx.arc(0, 0, dsR * dsPulse, 0, Math.PI * 2); ctx.fill();
      // White wispy clouds around the spot edge
      ctx.strokeStyle = 'rgba(240, 245, 255, 0.55)';
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.ellipse(0, 0, dsR * dsPulse * 1.05, dsR * dsPulse * 1.05, 0, Math.PI * 0.10, Math.PI * 0.90);
      ctx.stroke();
      ctx.restore();
      // Fast supersonic white methane cloud streaks
      ctx.strokeStyle = 'rgba(240, 248, 255, 0.55)';
      ctx.lineWidth = 1.8 * s;
      for (let i = 0; i < 14; i++) {
        const xOff = ((t * 3.5 + i * 120 * s) % (w + 220 * s)) - 110 * s;
        const y = h * (0.08 + (i * 0.07) % 0.85);
        ctx.beginPath();
        ctx.moveTo(xOff, y);
        ctx.lineTo(xOff + 100 * s, y - 1 * s);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (name === 'THE SUN') {
      // Inside the sun — radiant cream/peach core (Monument Valley sunset)
      ctx.save();
      const cx = w * 0.5, cy = h * 0.5;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
      grad.addColorStop(0, 'rgba(255, 248, 220, 0.85)');
      grad.addColorStop(0.3, 'rgba(255, 220, 170, 0.55)');
      grad.addColorStop(0.7, 'rgba(240, 150, 110, 0.40)');
      grad.addColorStop(1, 'rgba(180, 100, 90, 0.40)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // Corona arms (soft, painted)
      ctx.translate(cx, cy);
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2 + t * 0.004;
        const len = Math.max(w, h) * (0.5 + Math.sin(t * 0.02 + i) * 0.08);
        const grad2 = ctx.createLinearGradient(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
        grad2.addColorStop(0, 'rgba(255, 235, 180, 0.25)');
        grad2.addColorStop(1, 'rgba(250, 140, 100, 0)');
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle - 0.05) * len, Math.sin(angle - 0.05) * len);
        ctx.lineTo(Math.cos(angle + 0.05) * len, Math.sin(angle + 0.05) * len);
        ctx.closePath(); ctx.fill();
      }
      // Solar flare arches — graceful curved plasma loops at the limb
      const limbR = Math.min(w, h) * 0.36;
      const flares = [
        { ang: -0.4, scale: 1.0, phase: 0 },
        { ang: Math.PI * 0.6, scale: 0.85, phase: 1.2 },
        { ang: Math.PI * 1.15, scale: 1.15, phase: 2.7 },
      ];
      flares.forEach((f) => {
        const breathe = 1 + Math.sin(t * 0.025 + f.phase) * 0.15;
        const baseX = Math.cos(f.ang) * limbR;
        const baseY = Math.sin(f.ang) * limbR;
        const arcR = limbR * 0.22 * f.scale * breathe;
        const normalA = f.ang;
        const startX = baseX + Math.cos(normalA + Math.PI / 2) * arcR;
        const startY = baseY + Math.sin(normalA + Math.PI / 2) * arcR;
        const endX = baseX + Math.cos(normalA - Math.PI / 2) * arcR;
        const endY = baseY + Math.sin(normalA - Math.PI / 2) * arcR;
        const apexX = baseX + Math.cos(normalA) * arcR * 1.8;
        const apexY = baseY + Math.sin(normalA) * arcR * 1.8;
        ctx.save();
        ctx.strokeStyle = 'rgba(255, 220, 160, 0.65)';
        ctx.lineWidth = 3 * s;
        ctx.shadowColor = 'rgba(255, 180, 120, 0.8)';
        ctx.shadowBlur = 14 * s;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(apexX, apexY, endX, endY);
        ctx.stroke();
        // Inner brighter core of the loop
        ctx.strokeStyle = 'rgba(255, 248, 220, 0.85)';
        ctx.lineWidth = 1.4 * s;
        ctx.shadowBlur = 6 * s;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(apexX, apexY, endX, endY);
        ctx.stroke();
        ctx.restore();
      });
      // Sunspots — small darker patches drifting slowly
      const spots = [
        { fx: -0.15, fy:  0.05, r: 0.05 },
        { fx:  0.12, fy: -0.10, r: 0.035 },
        { fx:  0.08, fy:  0.18, r: 0.025 },
      ];
      const driftS = t * 0.0008;
      spots.forEach((sp, i) => {
        const sx = Math.cos(sp.fx * Math.PI * 2 + driftS + i) * limbR * 0.45;
        const sy = Math.sin(sp.fy * Math.PI * 2 + driftS + i * 0.7) * limbR * 0.35;
        const sR = limbR * sp.r;
        const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sR);
        sg.addColorStop(0, 'rgba(140, 70, 60, 0.85)');
        sg.addColorStop(0.6, 'rgba(180, 100, 80, 0.45)');
        sg.addColorStop(1, 'rgba(200, 120, 90, 0)');
        ctx.fillStyle = sg;
        ctx.beginPath(); ctx.arc(sx, sy, sR, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    }

    if (name === 'THE VOID') {
      // Distant galaxy + nebula clouds
      ctx.save();
      // Galaxy spiral
      const gx = w * 0.72, gy = h * 0.30;
      ctx.translate(gx, gy);
      ctx.rotate(t * 0.0015);
      for (let arm = 0; arm < 2; arm++) {
        ctx.save();
        ctx.rotate(arm * Math.PI);
        for (let i = 0; i < 35; i++) {
          const r = i * 4 * s;
          const a = i * 0.32;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          const grad = ctx.createRadialGradient(x, y, 0, x, y, 14 * s);
          grad.addColorStop(0, `rgba(180, 200, 255, ${0.30 - i * 0.006})`);
          grad.addColorStop(1, 'rgba(120, 80, 200, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(x, y, 14 * s, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      // Galaxy core
      const coreR = 30 * s;
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, coreR);
      coreGrad.addColorStop(0, 'rgba(255, 240, 220, 0.95)');
      coreGrad.addColorStop(1, 'rgba(200, 160, 240, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath(); ctx.arc(0, 0, coreR, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Nebula clouds elsewhere (more painted, more diverse colors)
      ctx.save();
      const nebs = [
        { x: w * 0.15, y: h * 0.55, r: 130 * s, c: 'rgba(180, 120, 220, 0.22)' },
        { x: w * 0.32, y: h * 0.82, r: 100 * s, c: 'rgba(232, 140, 200, 0.18)' },
        { x: w * 0.85, y: h * 0.70, r: 150 * s, c: 'rgba(140, 130, 240, 0.20)' },
        { x: w * 0.55, y: h * 0.92, r: 110 * s, c: 'rgba(220, 180, 240, 0.14)' },
      ];
      nebs.forEach((n) => {
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        grad.addColorStop(0, n.c);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
      // Pulsar — a single brilliant pulsating star with diffraction rays
      ctx.save();
      const pulsX = w * 0.28, pulsY = h * 0.62;
      const beat = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.08));
      const pulsCore = (3 + beat * 2) * s;
      const pulsGlow = (28 + beat * 16) * s;
      // Outer glow
      const pGlow = ctx.createRadialGradient(pulsX, pulsY, 0, pulsX, pulsY, pulsGlow);
      pGlow.addColorStop(0, `rgba(220, 230, 255, ${0.55 * beat + 0.30})`);
      pGlow.addColorStop(0.4, 'rgba(180, 200, 255, 0.22)');
      pGlow.addColorStop(1, 'rgba(140, 160, 240, 0)');
      ctx.fillStyle = pGlow;
      ctx.beginPath(); ctx.arc(pulsX, pulsY, pulsGlow, 0, Math.PI * 2); ctx.fill();
      // Diffraction spikes (4-way cross)
      ctx.strokeStyle = `rgba(240, 240, 255, ${0.50 + 0.40 * beat})`;
      ctx.lineWidth = 1.2 * s;
      const spike = pulsGlow * 1.3;
      ctx.beginPath();
      ctx.moveTo(pulsX - spike, pulsY); ctx.lineTo(pulsX + spike, pulsY);
      ctx.moveTo(pulsX, pulsY - spike); ctx.lineTo(pulsX, pulsY + spike);
      ctx.stroke();
      // Hot white core
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(pulsX, pulsY, pulsCore, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }, []);

  const drawStars = useCallback((ctx, stars, t, opacity) => {
    ctx.save();
    stars.forEach((s) => {
      const tw = 0.5 + 0.5 * Math.sin(t * 0.04 + s.tw);
      ctx.fillStyle = `rgba(255, 255, 240, ${s.a * tw * opacity})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }, []);

  // Pure draw: dust positions are advanced in simulateTick() (Phase 0.5) so the
  // drift no longer slows down at low display frame rates.
  const drawDust = useCallback((ctx, dust) => {
    ctx.save();
    dust.forEach((d) => {
      ctx.fillStyle = `rgba(255, 240, 220, ${d.a})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }, []);

  const drawFog = useCallback((ctx, w, h, color) => {
    ctx.save();
    const grad = ctx.createLinearGradient(0, h * 0.4, 0, h);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }, []);

  const drawColumn = useCallback((ctx, x, y, width, height, planet, depthOffset, s) => {
    if (height <= 0) return;
    // Right side face (darker, isometric depth)
    ctx.save();
    ctx.fillStyle = planet.columnSide;
    ctx.beginPath();
    ctx.moveTo(x + width, y);
    ctx.lineTo(x + width + depthOffset, y - depthOffset);
    ctx.lineTo(x + width + depthOffset, y + height - depthOffset);
    ctx.lineTo(x + width, y + height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Front face main color with subtle vertical shading
    ctx.save();
    const grad = ctx.createLinearGradient(x, 0, x + width, 0);
    grad.addColorStop(0, planet.columnFront);
    grad.addColorStop(0.6, planet.columnFront);
    grad.addColorStop(1, planet.columnSide);
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);
    ctx.restore();

    // Subtle panel lines every 50px (scaled)
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    const lineSpacing = 50 * s;
    const startLine = Math.ceil(y / lineSpacing) * lineSpacing;
    for (let py = startLine; py < y + height; py += lineSpacing) {
      ctx.beginPath();
      ctx.moveTo(x + 4 * s, py);
      ctx.lineTo(x + width - 4 * s, py);
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  const drawColumnPair = useCallback((ctx, col, planet, h, columnWidth, s) => {
    const { x, gapY, gap } = col;
    const w = columnWidth;
    const topH = gapY - gap / 2;
    const botY = gapY + gap / 2;
    const botH = h - botY;
    const depth = 8 * s;
    const edgeT = 4 * s;

    // Top column
    drawColumn(ctx, x, 0, w, topH, planet, depth, s);
    // Bottom column
    drawColumn(ctx, x, botY, w, botH, planet, depth, s);

    // Bright top edge highlight (bottom of top column - the edge facing the gap)
    ctx.save();
    const eg1 = ctx.createLinearGradient(0, topH - edgeT, 0, topH);
    eg1.addColorStop(0, planet.columnFront);
    eg1.addColorStop(1, planet.columnEdge);
    ctx.fillStyle = eg1;
    ctx.fillRect(x, topH - edgeT, w, edgeT);
    // Thin highlight line
    ctx.fillStyle = planet.columnEdge;
    ctx.fillRect(x, topH - 1, w, 1);
    // Subtle edge cap depth
    ctx.fillStyle = planet.columnEdge;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x + w, topH);
    ctx.lineTo(x + w + 8 * s, topH - 8 * s);
    ctx.lineTo(x + w + 8 * s, topH - 12 * s);
    ctx.lineTo(x + w, topH - edgeT);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Bright bottom edge (top of bottom column - facing the gap)
    ctx.save();
    const eg2 = ctx.createLinearGradient(0, botY, 0, botY + edgeT);
    eg2.addColorStop(0, planet.columnEdge);
    eg2.addColorStop(1, planet.columnFront);
    ctx.fillStyle = eg2;
    ctx.fillRect(x, botY, w, edgeT);
    ctx.fillStyle = planet.columnEdge;
    ctx.fillRect(x, botY, w, 1);
    ctx.fillStyle = planet.columnEdge;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x + w, botY);
    ctx.lineTo(x + w + 8 * s, botY - 8 * s);
    ctx.lineTo(x + w + 8 * s, botY - edgeT);
    ctx.lineTo(x + w, botY + edgeT);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Soft light shaft in the gap
    ctx.save();
    const shaft = ctx.createLinearGradient(x, 0, x + w, 0);
    shaft.addColorStop(0, 'rgba(255,255,255,0)');
    shaft.addColorStop(0.5, `${planet.columnEdge}33`);
    shaft.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shaft;
    ctx.fillRect(x, topH, w, gap);
    ctx.restore();
  }, [drawColumn]);

  const drawShip = useCallback((ctx, ship, planet, t, s, design = 'blip', hatId = 'none') => {
    const alien = findAlien(design);
    // Rendered at the LIVE simulated y (like everything else — see the
    // RENDERING note up top). The alien is the primary input-feedback element:
    // players tap and immediately watch it to judge timing, so any render lag
    // reads as broken input.
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.tilt);

    // Trail — uses planet accent, same across all aliens
    ctx.save();
    for (let i = 0; i < ship.trail.length; i++) {
      const p = ship.trail[i];
      const a = (i / ship.trail.length) * 0.4;
      ctx.fillStyle = `${planet.accent}${Math.floor(a * 255).toString(16).padStart(2, '0')}`;
      ctx.beginPath();
      const dx = p.x - ship.x;
      const dy = p.y - ship.y;
      const cos = Math.cos(-ship.tilt), sin = Math.sin(-ship.tilt);
      const tx = dx * cos - dy * sin;
      const ty = dx * sin + dy * cos;
      ctx.arc(tx, ty, (4 - i * 0.2) * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Scale ship body up — original geometry felt cramped against obstacle
    // gaps. Applied after the trail so the trail keeps its size. shipRadius
    // is tuned to match this visual scale.
    ctx.scale(1.4, 1.4);

    const drawFlame = (baseX, halfH, len, splitTwin) => {
      const passes = splitTwin ? [-1, 1] : [0];
      passes.forEach((k) => {
        const fy = k * halfH;
        const outerGrad = ctx.createLinearGradient(baseX, fy, baseX - len, fy);
        outerGrad.addColorStop(0, planet.accent);
        outerGrad.addColorStop(0.5, `${planet.accent}80`);
        outerGrad.addColorStop(1, `${planet.accent}00`);
        ctx.fillStyle = outerGrad;
        ctx.beginPath();
        ctx.moveTo(baseX, fy - 3 * s);
        ctx.lineTo(baseX - len, fy);
        ctx.lineTo(baseX, fy + 3 * s);
        ctx.closePath();
        ctx.fill();
        const innerLen = len * 0.55;
        const innerGrad = ctx.createLinearGradient(baseX, fy, baseX - innerLen, fy);
        innerGrad.addColorStop(0, '#ffffff');
        innerGrad.addColorStop(1, `${planet.accent}00`);
        ctx.fillStyle = innerGrad;
        ctx.beginPath();
        ctx.moveTo(baseX, fy - 1.5 * s);
        ctx.lineTo(baseX - innerLen, fy);
        ctx.lineTo(baseX, fy + 1.5 * s);
        ctx.closePath();
        ctx.fill();
      });
    };

    if (design === 'blip') {
      // Friendly green-alien-in-a-bubble. Wobbly idle, big eye, two antennae.
      const wobble = Math.sin(t * 0.18) * 1.2 * s;
      const blink = (Math.sin(t * 0.05) > 0.97) ? 0.15 : 1.0; // occasional blink
      // Soft halo behind
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 18 * s);
      halo.addColorStop(0, '#8effa0aa');
      halo.addColorStop(1, '#8effa000');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, 18 * s, 0, Math.PI * 2); ctx.fill();
      // Tail spark — short, behind
      const flameLen = (8 + Math.sin(t * 0.7) * 2 + (ship.vy < 0 ? 5 : 0)) * s;
      drawFlame(-9 * s, 0, flameLen, false);
      // Body (rounded green blob)
      const bodyGrad = ctx.createRadialGradient(-2 * s, -3 * s, 0, 0, 0, 12 * s);
      bodyGrad.addColorStop(0, '#c5f5b0');
      bodyGrad.addColorStop(0.55, '#6dcc54');
      bodyGrad.addColorStop(1, '#2c7a36');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, wobble, 11 * s, 9.5 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Belly highlight
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.ellipse(-1 * s, 2 * s + wobble, 6 * s, 2.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Two stubby arms — one waving
      ctx.strokeStyle = '#3c8444';
      ctx.lineWidth = 2.2 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-7 * s, 2 * s);
      ctx.lineTo(-11 * s, 5 * s + Math.sin(t * 0.25) * 2 * s);
      ctx.moveTo(7 * s, 2 * s);
      ctx.lineTo(11 * s, 4 * s + Math.cos(t * 0.25) * 1 * s);
      ctx.stroke();
      // Two antennae with bobbing tips
      ctx.strokeStyle = '#3c8444';
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.moveTo(-3 * s, -8 * s);
      ctx.lineTo(-5 * s, -13 * s);
      ctx.moveTo(3 * s, -8 * s);
      ctx.lineTo(5 * s, -13 * s);
      ctx.stroke();
      // Antenna tips (pulsing)
      const ant = 0.7 + Math.sin(t * 0.3) * 0.3;
      ctx.fillStyle = '#ffe480';
      ctx.beginPath(); ctx.arc(-5 * s, -13 * s, 1.6 * s * ant, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 5 * s, -13 * s, 1.6 * s * ant, 0, Math.PI * 2); ctx.fill();
      // Big single eye, facing forward
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(3 * s, -2 * s + wobble, 5 * s, 5 * s * blink, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pupil tracks slightly
      if (blink > 0.5) {
        ctx.fillStyle = '#1a2030';
        ctx.beginPath();
        ctx.arc(4 * s, -2 * s + wobble, 2.2 * s, 0, Math.PI * 2);
        ctx.fill();
        // Catchlight
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(4.7 * s, -2.8 * s + wobble, 0.7 * s, 0, Math.PI * 2);
        ctx.fill();
      }
      // Tiny grin
      ctx.strokeStyle = '#1a2030';
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.arc(2 * s, 3 * s + wobble, 2.5 * s, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else if (design === 'pip') {
      // Pink pufferball — three eyes in a row, tiny side fins flap.
      const bob = Math.sin(t * 0.20) * 1.0 * s;
      const flap = Math.sin(t * 0.45) * 2 * s;
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 16 * s);
      halo.addColorStop(0, '#ffb6d6aa');
      halo.addColorStop(1, '#ffb6d600');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, 16 * s, 0, Math.PI * 2); ctx.fill();
      // Side fins
      ctx.fillStyle = '#e07ab0';
      ctx.beginPath();
      ctx.ellipse(-9 * s, bob + flap, 4 * s, 2 * s, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse( 9 * s, bob - flap, 4 * s, 2 * s, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // Body
      const bodyGrad = ctx.createRadialGradient(-2 * s, -3 * s, 0, 0, 0, 10 * s);
      bodyGrad.addColorStop(0, '#ffd8e8');
      bodyGrad.addColorStop(0.6, '#ff8bbf');
      bodyGrad.addColorStop(1, '#b04c80');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.arc(0, bob, 9 * s, 0, Math.PI * 2);
      ctx.fill();
      // Belly highlight
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.beginPath();
      ctx.ellipse(-2 * s, 3 * s + bob, 5 * s, 2 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Three eyes
      const eyeY = -1 * s + bob;
      [-5, 0, 5].forEach((ex) => {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(ex * s, eyeY, 2.0 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a2030';
        ctx.beginPath(); ctx.arc(ex * s + 0.4 * s, eyeY, 0.9 * s, 0, Math.PI * 2); ctx.fill();
      });
      // Tiny smile
      ctx.strokeStyle = '#1a2030';
      ctx.lineWidth = 1.0 * s;
      ctx.beginPath();
      ctx.arc(0, 4 * s + bob, 2 * s, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (design === 'goop') {
      // Yellow slime drop — tongue sticking out, dripping.
      const wiggle = Math.sin(t * 0.15) * 0.8 * s;
      const tongueWobble = Math.sin(t * 0.25) * 0.6 * s;
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 16 * s);
      halo.addColorStop(0, '#fff2a0aa');
      halo.addColorStop(1, '#fff2a000');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, 16 * s, 0, Math.PI * 2); ctx.fill();
      // Body — slime blob
      const bodyGrad = ctx.createRadialGradient(-2 * s, -3 * s, 0, 0, 0, 12 * s);
      bodyGrad.addColorStop(0, '#fff7b8');
      bodyGrad.addColorStop(0.55, '#f5d040');
      bodyGrad.addColorStop(1, '#a87a10');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.moveTo(0, -11 * s);
      ctx.bezierCurveTo( 7 * s, -10 * s,  11 * s, -2 * s, 10 * s + wiggle, 5 * s);
      ctx.bezierCurveTo( 8 * s,  10 * s, -8 * s,  10 * s, -10 * s + wiggle, 5 * s);
      ctx.bezierCurveTo(-11 * s, -2 * s, -7 * s, -10 * s, 0, -11 * s);
      ctx.closePath();
      ctx.fill();
      // Shine
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(-3 * s, -5 * s, 3 * s, 1.4 * s, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Eyes — two black dots
      ctx.fillStyle = '#1a2030';
      ctx.beginPath(); ctx.arc(-3 * s, -1 * s, 1.6 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 3 * s, -1 * s, 1.6 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-2.5 * s, -1.5 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 3.5 * s, -1.5 * s, 0.5 * s, 0, Math.PI * 2); ctx.fill();
      // Tongue
      ctx.fillStyle = '#ff6a8a';
      ctx.beginPath();
      ctx.ellipse(1 * s + tongueWobble, 6 * s, 2.5 * s, 1.6 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Drip
      const dripY = (Math.sin(t * 0.08) + 1) * 4 * s + 8 * s;
      ctx.fillStyle = '#f5d040cc';
      ctx.beginPath(); ctx.arc(-1 * s, dripY, 1.6 * s, 0, Math.PI * 2); ctx.fill();
    } else if (design === 'wobble') {
      // Orange roly-poly egg — stubby legs, wide eyes.
      const bob = Math.sin(t * 0.22) * 1.2 * s;
      const legSwing = Math.sin(t * 0.35) * 1.5 * s;
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 16 * s);
      halo.addColorStop(0, '#ffc080aa');
      halo.addColorStop(1, '#ffc08000');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, 16 * s, 0, Math.PI * 2); ctx.fill();
      // Stubby legs (behind body)
      ctx.strokeStyle = '#a85428';
      ctx.lineWidth = 3 * s;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-4 * s,  7 * s);
      ctx.lineTo(-5 * s, 11 * s + legSwing);
      ctx.moveTo( 4 * s,  7 * s);
      ctx.lineTo( 5 * s, 11 * s - legSwing);
      ctx.stroke();
      // Egg body
      const bodyGrad = ctx.createRadialGradient(-2 * s, -3 * s, 0, 0, 0, 12 * s);
      bodyGrad.addColorStop(0, '#ffd0a0');
      bodyGrad.addColorStop(0.55, '#ff8c44');
      bodyGrad.addColorStop(1, '#a44818');
      ctx.fillStyle = bodyGrad;
      ctx.beginPath();
      ctx.ellipse(0, bob, 9 * s, 10 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Belly highlight
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.beginPath();
      ctx.ellipse(-1 * s, 3 * s + bob, 4 * s, 1.8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Wide eyes
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(-3 * s, -2 * s + bob, 2.4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 3 * s, -2 * s + bob, 2.4 * s, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a2030';
      ctx.beginPath(); ctx.arc(-2.5 * s, -2 * s + bob, 1.2 * s, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc( 3.5 * s, -2 * s + bob, 1.2 * s, 0, Math.PI * 2); ctx.fill();
      // Mouth
      ctx.strokeStyle = '#1a2030';
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.arc(0, 3 * s + bob, 2 * s, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
    } else if (design === 'glim') {
      // Translucent purple jellyfish-ghost — tendrils, pulsing dome, wink.
      const pulse2 = 0.85 + Math.sin(t * 0.10) * 0.15;
      const wink = (Math.sin(t * 0.04) > 0.95) ? 0.1 : 1.0;
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 18 * s);
      halo.addColorStop(0, '#d4a8ffaa');
      halo.addColorStop(1, '#d4a8ff00');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, 18 * s, 0, Math.PI * 2); ctx.fill();
      // Tendrils
      ctx.strokeStyle = '#9858ce99';
      ctx.lineWidth = 1.6 * s;
      ctx.lineCap = 'round';
      for (let i = -2; i <= 2; i++) {
        const tx = i * 2.5 * s;
        const off = Math.sin(t * 0.18 + i) * 1.8 * s;
        ctx.beginPath();
        ctx.moveTo(tx, 3 * s);
        ctx.bezierCurveTo(tx + off, 7 * s, tx - off, 10 * s, tx + off * 0.5, 13 * s);
        ctx.stroke();
      }
      // Dome body
      const domeGrad = ctx.createRadialGradient(-2 * s, -4 * s, 0, 0, 0, 11 * s * pulse2);
      domeGrad.addColorStop(0, '#f0d8ffdd');
      domeGrad.addColorStop(0.5, '#b878e0bb');
      domeGrad.addColorStop(1, '#6838988a');
      ctx.fillStyle = domeGrad;
      ctx.beginPath();
      ctx.ellipse(0, -1 * s, 10 * s * pulse2, 8 * s, 0, Math.PI, 2 * Math.PI);
      ctx.closePath();
      ctx.fill();
      // Bottom rim of dome
      ctx.fillStyle = '#9858cebb';
      ctx.beginPath();
      ctx.ellipse(0, -1 * s, 10 * s * pulse2, 2 * s, 0, 0, Math.PI);
      ctx.fill();
      // Highlight
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.ellipse(-3 * s, -5 * s, 2.5 * s, 1.0 * s, -0.4, 0, Math.PI * 2);
      ctx.fill();
      // Single winking eye
      if (wink > 0.5) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(1 * s, -3 * s, 3 * s, 3 * s, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#3a1855';
        ctx.beginPath();
        ctx.arc(1.5 * s, -3 * s, 1.5 * s, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#3a1855';
        ctx.lineWidth = 1.4 * s;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-2 * s, -3 * s);
        ctx.lineTo( 4 * s, -3 * s);
        ctx.stroke();
      }
    }

    // ── Hat overlay (drawn last so it sits on top) ──
    if (hatId && hatId !== 'none') {
      const anchor = alien.hatAnchor;
      ctx.save();
      ctx.translate(anchor.x * s, anchor.y * s);
      const hs = anchor.scale * s;
      if (hatId === 'shades') {
        // Two black lenses + bridge bar
        ctx.fillStyle = '#1a1a22';
        ctx.beginPath(); ctx.arc(-3.5 * hs, 0, 2.8 * hs, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc( 3.5 * hs, 0, 2.8 * hs, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(-1.5 * hs, -0.5 * hs, 3 * hs, 1 * hs);
        // Sheen
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.ellipse(-4.2 * hs, -1 * hs, 1.2 * hs, 0.5 * hs, -0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse( 2.8 * hs, -1 * hs, 1.2 * hs, 0.5 * hs, -0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (hatId === 'tophat') {
        // Black top hat with red band
        ctx.fillStyle = '#0a0a14';
        ctx.fillRect(-5 * hs, -7 * hs, 10 * hs, 7 * hs);
        ctx.fillRect(-7 * hs, -1 * hs, 14 * hs, 1.5 * hs);
        ctx.fillStyle = '#cc2a3a';
        ctx.fillRect(-5 * hs, -2 * hs, 10 * hs, 1.5 * hs);
      } else if (hatId === 'propeller') {
        // Blue beanie + spinning yellow propeller
        ctx.fillStyle = '#3a6ad8';
        ctx.beginPath();
        ctx.ellipse(0, 0, 5 * hs, 3 * hs, 0, Math.PI, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = '#2a4ba8';
        ctx.fillRect(-5 * hs, 0, 10 * hs, 1 * hs);
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 0.8 * hs;
        ctx.beginPath();
        ctx.moveTo(0, -3 * hs);
        ctx.lineTo(0, -5 * hs);
        ctx.stroke();
        ctx.save();
        ctx.translate(0, -5 * hs);
        ctx.rotate(t * 0.3);
        ctx.fillStyle = '#ffcc44';
        ctx.fillRect(-4 * hs, -0.5 * hs, 8 * hs, 1 * hs);
        ctx.restore();
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.arc(0, -5 * hs, 0.7 * hs, 0, Math.PI * 2);
        ctx.fill();
      } else if (hatId === 'crown') {
        // Gold crown with three jewels
        ctx.fillStyle = '#f5c84c';
        ctx.beginPath();
        ctx.moveTo(-6 * hs, 0);
        ctx.lineTo(-6 * hs, -3 * hs);
        ctx.lineTo(-3 * hs, -6 * hs);
        ctx.lineTo( 0,      -3 * hs);
        ctx.lineTo( 3 * hs, -6 * hs);
        ctx.lineTo( 6 * hs, -3 * hs);
        ctx.lineTo( 6 * hs,  0);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#a8801c';
        ctx.lineWidth = 0.8 * hs;
        ctx.stroke();
        ctx.fillStyle = '#ff4060';
        ctx.beginPath(); ctx.arc(-3 * hs, -4.5 * hs, 0.9 * hs, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4080ff';
        ctx.beginPath(); ctx.arc( 0,      -2 * hs,   0.9 * hs, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#40c060';
        ctx.beginPath(); ctx.arc( 3 * hs, -4.5 * hs, 0.9 * hs, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    ctx.restore();
  }, []);

  const drawParticles = useCallback((ctx, particles) => {
    ctx.save();
    particles.forEach((p) => {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = `${p.color}${Math.floor(a * 255).toString(16).padStart(2, '0')}`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * a, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }, []);

  const drawFragments = useCallback((ctx, fragments, planet, s) => {
    // Faceted gemstone with cyan halo and slow-rotating sparkle star.
    // Colors are fixed (not planet-tinted) so the crystal reads clearly on
    // every sky — planet accents already colorize column edges.
    const FACET_TOP    = '#fff3b0'; // bright lit facet
    const FACET_MAIN   = '#ffd84a'; // warm gold body
    const FACET_LEFT   = '#f0a920'; // mid-tone left facet
    const FACET_RIGHT  = '#b97810'; // deep shadow right facet
    const FACET_OUTLINE = '#5a3a08';
    const HALO_OUTER   = '#7fe0ff';
    const HALO_INNER   = '#ffe6a0';
    fragments.forEach((f) => {
      if (f.collected) return;
      ctx.save();
      ctx.translate(f.x, f.y + Math.sin(f.bounce) * 3 * s);

      const pulse = 0.88 + Math.sin(f.bounce * 1.3) * 0.12;

      // Outer cyan halo
      const haloR = 28 * s * pulse;
      const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, haloR);
      halo.addColorStop(0, `${HALO_INNER}aa`);
      halo.addColorStop(0.35, `${HALO_OUTER}55`);
      halo.addColorStop(0.75, `${HALO_OUTER}1a`);
      halo.addColorStop(1, `${HALO_OUTER}00`);
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(0, 0, haloR, 0, Math.PI * 2); ctx.fill();

      // Sparkle star rays — counter-rotates, gently pulses
      ctx.save();
      ctx.rotate(-f.rot * 0.8);
      const rayLen = 22 * s * pulse;
      const rayAlpha = 0.55 + Math.sin(f.bounce * 1.7) * 0.25;
      ctx.strokeStyle = `rgba(255, 248, 210, ${rayAlpha})`;
      ctx.lineCap = 'round';
      // Long horizontal/vertical rays (4-point star)
      ctx.lineWidth = 1.6 * s;
      ctx.beginPath();
      ctx.moveTo(-rayLen, 0); ctx.lineTo(rayLen, 0);
      ctx.moveTo(0, -rayLen); ctx.lineTo(0, rayLen);
      ctx.stroke();
      // Short diagonal rays (8-point sparkle)
      ctx.lineWidth = 1.0 * s;
      const d = rayLen * 0.55;
      ctx.beginPath();
      ctx.moveTo(-d, -d); ctx.lineTo(d, d);
      ctx.moveTo(-d, d);  ctx.lineTo(d, -d);
      ctx.stroke();
      ctx.restore();

      // Crystal body — slowly rotating faceted gem
      ctx.rotate(f.rot);
      const sz = 13 * s;

      // Outline / silhouette (drawn first, slightly larger to create a clean border)
      ctx.fillStyle = FACET_OUTLINE;
      ctx.beginPath();
      ctx.moveTo(0, -sz * 1.05);
      ctx.lineTo(sz * 0.62, -sz * 0.22);
      ctx.lineTo(sz * 0.62, sz * 0.22);
      ctx.lineTo(0, sz * 1.05);
      ctx.lineTo(-sz * 0.62, sz * 0.22);
      ctx.lineTo(-sz * 0.62, -sz * 0.22);
      ctx.closePath();
      ctx.fill();

      // Main body (warm gold) — hexagonal bipyramid silhouette
      ctx.fillStyle = FACET_MAIN;
      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.lineTo(sz * 0.56, -sz * 0.20);
      ctx.lineTo(sz * 0.56, sz * 0.20);
      ctx.lineTo(0, sz);
      ctx.lineTo(-sz * 0.56, sz * 0.20);
      ctx.lineTo(-sz * 0.56, -sz * 0.20);
      ctx.closePath();
      ctx.fill();

      // Right shadow facet — deep gold, gives 3D volume
      ctx.fillStyle = FACET_RIGHT;
      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.lineTo(sz * 0.56, -sz * 0.20);
      ctx.lineTo(sz * 0.56, sz * 0.20);
      ctx.lineTo(0, sz);
      ctx.lineTo(0, sz * 0.15);
      ctx.lineTo(sz * 0.18, -sz * 0.10);
      ctx.closePath();
      ctx.fill();

      // Left lit facet — mid-tone
      ctx.fillStyle = FACET_LEFT;
      ctx.beginPath();
      ctx.moveTo(-sz * 0.56, -sz * 0.20);
      ctx.lineTo(0, -sz);
      ctx.lineTo(sz * 0.18, -sz * 0.10);
      ctx.lineTo(0, sz * 0.15);
      ctx.lineTo(-sz * 0.56, sz * 0.20);
      ctx.closePath();
      ctx.fill();

      // Top-cap brightest facet — directly catches the "light"
      ctx.fillStyle = FACET_TOP;
      ctx.beginPath();
      ctx.moveTo(0, -sz);
      ctx.lineTo(sz * 0.18, -sz * 0.10);
      ctx.lineTo(-sz * 0.30, -sz * 0.18);
      ctx.closePath();
      ctx.fill();

      // Specular highlight — narrow vertical streak near top-left
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.beginPath();
      ctx.moveTo(-sz * 0.10, -sz * 0.85);
      ctx.lineTo(-sz * 0.04, -sz * 0.85);
      ctx.lineTo(-sz * 0.18, -sz * 0.20);
      ctx.lineTo(-sz * 0.24, -sz * 0.20);
      ctx.closePath();
      ctx.fill();

      // Sparkle dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(-sz * 0.14, -sz * 0.55, sz * 0.13, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }, []);

  const drawRings = useCallback((ctx, rings) => {
    ctx.save();
    rings.forEach((r) => {
      const a = Math.max(0, r.life / r.maxLife);
      ctx.strokeStyle = `${r.color}${Math.floor(a * 200).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 2 * a * (r.scale || 1);
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.restore();
  }, []);

  const drawPopups = useCallback((ctx, popups) => {
    popups.forEach((p) => {
      ctx.save();
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.font = `${p.size}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // FROSTED GLASS CARD — simulates backdrop-blur on canvas.
  //
  // Per-frame cost is dominated by two blurs: the drop shadow (shadowBlur)
  // and the scene sample (ctx.filter blur). Running both 3× per frame for
  // the HUD pills tanks mobile framerate.
  //
  // Strategy here:
  //  - Scene blur: one shared downsampled blur (`blurredSceneRef`) is
  //    refreshed by the game loop every frame; each card just upsamples a
  //    fresh region of it — no per-card filter blur, no caching lag.
  //  - Shadow: cached per card (keyed by `opts.id`) and re-rendered only
  //    when the card's size changes. Shadow geometry doesn't depend on
  //    the moving scene, so this cache never goes stale.
  //  - Tint, border, highlight: cheap; drawn fresh on the main ctx.
  // ─────────────────────────────────────────────────────────────
  const drawFrostedCard = useCallback((ctx, off, gs, x, y, w, h, opts = {}) => {
    const { id, radius = 22, planet } = opts;
    const useDarkTint = opts.useDarkTint != null
      ? opts.useDarkTint
      : (planet ? needsDarkTint(planet) : false);
    const s = gs.scale;
    const r = radius * s;
    const dpr = off && off.width > 0 ? off.width / gs.w : 1;
    const bs = blurredSceneRef.current;

    // 1. Drop shadow — blit from per-card cache if we have an id, otherwise
    // fall back to drawing it directly each frame. The cache only needs to
    // refresh when the card resizes (e.g., score digit grows).
    const padCss = Math.ceil(28 * s);
    const cardW = w + padCss * 2;
    const cardH = h + padCss * 2;
    if (id) {
      if (!cardCacheRef.current) cardCacheRef.current = new Map();
      const cache = cardCacheRef.current;
      let shadowEntry = cache.get(id);
      const wantW = Math.max(1, Math.ceil(cardW * dpr));
      const wantH = Math.max(1, Math.ceil(cardH * dpr));
      const sizeChanged = !shadowEntry
        || shadowEntry.canvas.width !== wantW
        || shadowEntry.canvas.height !== wantH;
      if (sizeChanged) {
        if (!shadowEntry) {
          shadowEntry = { canvas: document.createElement('canvas') };
          cache.set(id, shadowEntry);
        }
        shadowEntry.canvas.width = wantW;
        shadowEntry.canvas.height = wantH;
        const cctx = shadowEntry.canvas.getContext('2d');
        cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cctx.clearRect(0, 0, cardW, cardH);
        cctx.translate(padCss, padCss);
        cctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        cctx.shadowBlur = 20 * s;
        cctx.shadowOffsetY = 8 * s;
        cctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        roundRect(cctx, 0, 0, w, h, r);
        cctx.fill();
      }
      ctx.drawImage(
        shadowEntry.canvas,
        0, 0, shadowEntry.canvas.width, shadowEntry.canvas.height,
        x - padCss, y - padCss, cardW, cardH,
      );
    } else {
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
      ctx.shadowBlur = 20 * s;
      ctx.shadowOffsetY = 8 * s;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.restore();
    }

    // 2. Fresh blurred scene snapshot inside the card region (clipped).
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    const pad = 24 * s;
    const sx = Math.max(0, x - pad);
    const sy = Math.max(0, y - pad);
    const sw = Math.min(gs.w - sx, w + pad * 2);
    const sh = Math.min(gs.h - sy, h + pad * 2);
    if (bs && bs.width > 0) {
      // bs is downsampled: bs.width pixels span gs.w CSS px.
      const sScaleX = bs.width / gs.w;
      const sScaleY = bs.height / gs.h;
      ctx.drawImage(
        bs,
        sx * sScaleX, sy * sScaleY, sw * sScaleX, sh * sScaleY,
        sx, sy, sw, sh,
      );
    } else if (off && off.width > 0) {
      // First-frame fallback before the shared blur exists.
      try {
        ctx.filter = `blur(${20 * s}px)`;
        ctx.drawImage(off, sx * dpr, sy * dpr, sw * dpr, sh * dpr, sx, sy, sw, sh);
        ctx.filter = 'none';
      } catch {
        ctx.filter = 'none';
      }
    }
    // 3. Warm tint overlay (dark variant for light-background planets like Sun).
    ctx.fillStyle = useDarkTint ? FROSTED_TINT_DARK : FROSTED_TINT_LIGHT;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // 4. Border (1px white at 25%).
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
    ctx.restore();

    // 5. Inner top-edge highlight (subtle glass refraction).
    ctx.save();
    roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + r * 0.55, y + 0.5);
    ctx.lineTo(x + w - r * 0.55, y + 0.5);
    ctx.stroke();
    ctx.restore();
  }, []);

  const drawHUD = useCallback((ctx, gs, planet, speedMul, off) => {
    const { w, score, best, planetIdx, obstaclesInPlanet, combo, comboTimer } = gs;
    const s = gs.scale;

    // ── Score pill (centered, top) ──
    ctx.save();
    const scoreText = String(score);
    ctx.font = `200 ${36 * s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const sw = Math.max(110 * s, ctx.measureText(scoreText).width + 50 * s);
    const sx = (w - sw) / 2, sy = 14 * s;
    const sh = 56 * s;
    drawFrostedCard(ctx, off, gs, sx, sy, sw, sh, { id: 'hud-score', radius: 22, planet });
    // Score number — pure white with accent glow
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = planet.accent;
    ctx.shadowBlur = 16 * s;
    ctx.fillText(scoreText, w / 2, sy + sh / 2);
    ctx.restore();

    // BEST label — sits BELOW the score pill, no background (label text)
    ctx.save();
    ctx.font = `600 ${11 * s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.60)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    // Letter-spaced uppercase (approximate with spaces)
    ctx.fillText(`BEST ${best}`, w / 2, sy + sh + 6 * s);
    ctx.restore();

    // Score flash (accent ring around the pill). The countdown is decremented
    // in simulateTick() (not here) so its duration is frame-rate independent.
    if (gs.scoreFlash > 0) {
      ctx.save();
      ctx.globalAlpha = gs.scoreFlash / 10;
      ctx.strokeStyle = planet.accent;
      ctx.lineWidth = 2 * s;
      roundRect(ctx, sx - 2 * s, sy - 2 * s, sw + 4 * s, sh + 4 * s, 24 * s);
      ctx.stroke();
      ctx.restore();
    }

    // Combo bar (moved down to clear the BEST label)
    if (combo > 1 && comboTimer > 0) {
      ctx.save();
      const cx = (w - sw) / 2 + 10 * s, cy = sy + sh + 24 * s;
      const cw = sw - 20 * s;
      const fill = Math.min(1, comboTimer / 180);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      roundRect(ctx, cx, cy, cw, 4 * s, 2 * s);
      ctx.fill();
      const cg = ctx.createLinearGradient(cx, 0, cx + cw, 0);
      cg.addColorStop(0, planet.accent);
      cg.addColorStop(1, '#ffffff');
      ctx.fillStyle = cg;
      roundRect(ctx, cx, cy, cw * fill, 4 * s, 2 * s);
      ctx.fill();
      ctx.restore();
    }

    // ── Level badge top-left ──
    ctx.save();
    const levelLabel = `${planetIdx + 1} · ${planet.name}`;
    ctx.font = `600 ${12 * s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const lw = Math.max(120 * s, ctx.measureText(levelLabel).width + 50 * s);
    const lx = 12 * s, ly = 14 * s, lh = 38 * s;
    drawFrostedCard(ctx, off, gs, lx, ly, lw, lh, { id: 'hud-level', radius: 18, planet });
    // Progress arc (planet accent)
    const ax = lx + 18 * s, ay = ly + lh / 2, ar = 11 * s;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.arc(ax, ay, ar, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    const prog = Math.min(1, obstaclesInPlanet / 15);
    ctx.strokeStyle = planet.accent;
    ctx.lineWidth = 2.5 * s;
    ctx.beginPath();
    ctx.arc(ax, ay, ar, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.stroke();
    // Inner dot
    ctx.fillStyle = planet.accent;
    ctx.beginPath();
    ctx.arc(ax, ay, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
    // Label
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
    ctx.shadowBlur = 4;
    ctx.fillText(levelLabel, lx + 36 * s, ly + lh / 2);
    ctx.restore();

    // ── Speed top-right ──
    ctx.save();
    const spdText = `${speedMul.toFixed(1)}×`;
    ctx.font = `600 ${13 * s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    const tw = Math.max(60 * s, ctx.measureText(spdText).width + 26 * s);
    const tx = w - tw - 12 * s, ty = 14 * s, th = 38 * s;
    drawFrostedCard(ctx, off, gs, tx, ty, tw, th, { id: 'hud-speed', radius: 18, planet });
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = planet.accent;
    ctx.shadowBlur = 12 * s;
    ctx.fillText(spdText, tx + tw / 2, ty + th / 2);
    ctx.restore();
  }, [drawFrostedCard]);

  const drawTransitionCard = useCallback((ctx, gs, w, h, off) => {
    if (gs.transitionCard <= 0) return;
    const planet = PLANETS[gs.transitionCardPlanet];
    const s = gs.scale;
    // Fade in then fade out — peak in middle of 120 frame window
    const total = 120;
    const t = total - gs.transitionCard; // 0..120
    let alpha;
    if (t < 20) alpha = t / 20;
    else if (t > 100) alpha = (120 - t) / 20;
    else alpha = 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    const cw = Math.min(w - 60 * s, 320 * s), ch = 112 * s;
    const cx = (w - cw) / 2, cy = 90 * s;

    // Frosted glass card
    drawFrostedCard(ctx, off, gs, cx, cy, cw, ch, { id: 'transition', radius: 22, planet });

    // 2px accent border on top
    ctx.strokeStyle = `${planet.accent}99`;
    ctx.lineWidth = 2 * s;
    roundRect(ctx, cx, cy, cw, ch, 22 * s);
    ctx.stroke();

    // Outer glow in the accent
    ctx.save();
    ctx.shadowColor = planet.accent;
    ctx.shadowBlur = 24 * s;
    ctx.strokeStyle = `${planet.accent}40`;
    ctx.lineWidth = 1;
    roundRect(ctx, cx, cy, cw, ch, 22 * s);
    ctx.stroke();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    // PLANET N OF 10 — label text
    ctx.font = `600 ${11 * s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.60)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
    ctx.shadowBlur = 4;
    ctx.fillText(`PLANET ${gs.transitionCardPlanet + 1} OF ${PLANETS.length}`, w / 2, cy + 18 * s);
    ctx.shadowBlur = 0;

    // Planet name — 28px in the planet's accent color (heading)
    ctx.font = `600 ${28 * s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = planet.accent;
    ctx.shadowColor = planet.accent;
    ctx.shadowBlur = 14 * s;
    ctx.fillText(planet.name, w / 2, cy + 38 * s);
    ctx.shadowBlur = 0;

    // Tagline — italic 13px, secondary white
    ctx.font = `italic 400 ${13 * s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
    ctx.shadowBlur = 4;
    ctx.fillText(planet.tagline, w / 2, cy + 78 * s);
    ctx.restore();
  }, [drawFrostedCard]);

  const drawStartScreen = useCallback((ctx, gs, w, h) => {
    // The DOM overlay (StartMenuOverlay) draws title, stats, PLAY, and roster.
    // Canvas keeps only a soft accent glow + a floating platform under the alien.
    const planet = PLANETS[gs.planetIdx];
    const s = gs.scale;
    ctx.save();
    const glow = ctx.createRadialGradient(w / 2, h * 0.55, 0, w / 2, h * 0.55, Math.min(w, h) * 0.45);
    glow.addColorStop(0, `${planet.accent}30`);
    glow.addColorStop(0.6, `${planet.accent}10`);
    glow.addColorStop(1, `${planet.accent}00`);
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Floating platform below the hero alien (rounded ellipse in the planet's
    // secondary column color with a soft shadow underneath).
    const px = w * 0.28;     // matches gs.phys.shipX (where the alien stands)
    const py = h * 0.5 + 42 * s;  // a bit below the alien's idle position
    const pw = 78 * s;
    const ph = 14 * s;
    // Soft shadow under the platform
    ctx.save();
    const shadowGrad = ctx.createRadialGradient(px, py + 10 * s, 0, px, py + 10 * s, pw * 0.7);
    shadowGrad.addColorStop(0, 'rgba(0, 0, 0, 0.35)');
    shadowGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = shadowGrad;
    ctx.beginPath();
    ctx.ellipse(px, py + 10 * s, pw * 0.7, ph * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Platform body
    ctx.save();
    const platGrad = ctx.createLinearGradient(px - pw / 2, py, px + pw / 2, py);
    platGrad.addColorStop(0, planet.columnSide);
    platGrad.addColorStop(0.5, planet.columnFront);
    platGrad.addColorStop(1, planet.columnSide);
    ctx.fillStyle = platGrad;
    ctx.beginPath();
    ctx.ellipse(px, py, pw / 2, ph / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Top highlight (catches light)
    ctx.fillStyle = `${planet.columnEdge}88`;
    ctx.beginPath();
    ctx.ellipse(px, py - ph * 0.2, pw / 2 * 0.85, ph * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, []);

  // Sad alien — drawn small at the top of the death card. Uses the SAFE
  // fallback variant from the design spec: 70% opacity, slow gentle sway,
  // melancholy blue-tinted glow underneath, and NO facial modifications
  // (each alien has bespoke eye/mouth geometry; modifying every variant
  // safely was too risky, so we keep the silhouette intact).
  const drawSadAlien = useCallback((ctx, x, y, planet, t, scale, alienId, hatId) => {
    ctx.save();
    ctx.globalAlpha = 0.7;
    // Blue-tinted halo underneath
    const haloR = 26 * scale;
    const halo = ctx.createRadialGradient(x, y + 4 * scale, 0, x, y + 4 * scale, haloR);
    halo.addColorStop(0, 'rgba(130, 170, 220, 0.45)');
    halo.addColorStop(0.6, 'rgba(130, 170, 220, 0.15)');
    halo.addColorStop(1, 'rgba(130, 170, 220, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y + 4 * scale, haloR, 0, Math.PI * 2);
    ctx.fill();
    // Gentle sway: ±5deg over 2s (≈120 frames at 60fps)
    const sway = Math.sin(t * (2 * Math.PI / 120)) * (5 * Math.PI / 180);
    const fakeShip = {
      x, y, vx: 0, vy: 0,
      tilt: sway,
      idleT: 0,
      trail: [],
    };
    drawShip(ctx, fakeShip, planet, t, scale, alienId, hatId);
    ctx.restore();
  }, [drawShip]);

  const drawDeathScreen = useCallback((ctx, gs, w, h, t, off) => {
    const overlay = Math.min(1, gs.deathOverlay / 20);
    const s = gs.scale;
    ctx.save();
    ctx.fillStyle = `rgba(5, 10, 18, ${overlay * 0.65})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    if (overlay < 0.6) return;
    const cardAlpha = (overlay - 0.4) / 0.6;
    const planet = PLANETS[gs.planetIdx];

    ctx.save();
    ctx.globalAlpha = Math.min(1, cardAlpha);
    const cw = Math.min(w - 50 * s, 320 * s);
    const ch = 240 * s;
    const cx = (w - cw) / 2;
    const cy = (h - ch) / 2 - 40 * s;

    // Frosted glass card
    drawFrostedCard(ctx, off, gs, cx, cy, cw, ch, { id: 'death', radius: 22, planet });

    // 1.5px accent border on top
    ctx.strokeStyle = `${planet.accent}80`;
    ctx.lineWidth = 1.5 * s;
    roundRect(ctx, cx, cy, cw, ch, 22 * s);
    ctx.stroke();

    // Sad alien at the top of the card (60% of normal in-game scale)
    drawSadAlien(ctx, w / 2, cy + 44 * s, planet, t, s * 0.6, gs.alienId, gs.hatId);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // "JOURNEY ENDED" — 10px uppercase label
    ctx.font = `600 ${10 * s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.60)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
    ctx.shadowBlur = 4;
    ctx.fillText('JOURNEY ENDED', w / 2, cy + 104 * s);
    ctx.shadowBlur = 0;

    // Final score — 56px weight 200, accent glow
    ctx.font = `200 ${56 * s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = planet.accent;
    ctx.shadowBlur = 16 * s;
    ctx.fillText(String(gs.score), w / 2, cy + 148 * s);
    ctx.shadowBlur = 0;

    // REACHED PLANET — accent color
    ctx.font = `600 ${12 * s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
    ctx.fillStyle = planet.accent;
    ctx.shadowColor = planet.accent;
    ctx.shadowBlur = 10 * s;
    ctx.fillText(`REACHED ${planet.name}`, w / 2, cy + 188 * s);
    ctx.shadowBlur = 0;

    // Best — body text
    if (gs.newBest) {
      const glowPulse = 0.5 + 0.5 * Math.sin(t * 0.15);
      ctx.font = `600 ${13 * s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = planet.accent;
      ctx.shadowBlur = (8 + glowPulse * 8) * s;
      ctx.fillText(`★ NEW BEST · ${gs.best}`, w / 2, cy + 214 * s);
      ctx.shadowBlur = 0;
    } else {
      ctx.font = `400 ${13 * s}px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.40)';
      ctx.shadowBlur = 4;
      ctx.fillText(`Best · ${gs.best}`, w / 2, cy + 214 * s);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }, [drawFrostedCard, drawSadAlien]);

  // ─────────────────────────────────────────────────────────────
  // GAME LOGIC
  // ─────────────────────────────────────────────────────────────
  const spawnColumn = useCallback((gs) => {
    const s = gs.phys.scale;
    const margin = 70 * s;
    const minGapY = gs.gap / 2 + margin;
    const maxGapY = gs.h - gs.gap / 2 - margin;
    const gapY = Math.random() * (maxGapY - minGapY) + minGapY;
    const colX = gs.w + 20 * s;
    gs.columns.push({ x: colX, gapY, gap: gs.gap, scored: false });
    // ~40% chance to spawn a Star Fragment in the gap, biased toward center
    if (Math.random() < 0.4) {
      const yOffset = (Math.random() - 0.5) * gs.gap * 0.4;
      gs.fragments.push({
        x: colX + gs.phys.columnWidth / 2,
        y: gapY + yOffset,
        rot: Math.random() * Math.PI * 2,
        bounce: Math.random() * Math.PI * 2,
        collected: false,
      });
    }
    gs.framesSinceSpawn = 0;
  }, []);

  const flap = useCallback((gs) => {
    if (gs.state !== 'playing') return;
    if (gs.time - gs.lastFlapFrame < 3) return; // per-frame guard
    gs.lastFlapFrame = gs.time;
    const phys = gs.phys;
    const s = phys.scale;
    // Classic Flappy-Bird-style: each tap REPLACES vertical velocity with
    // impulse. Predictable rise height regardless of how fast you were falling,
    // no rapid-tap stacking, so every gap is reachable with the same rhythm.
    gs.ship.vy = phys.impulse;
    // Tiny lateral nudge — thruster jitter
    gs.ship.vx += (Math.random() - 0.5) * 0.6 * s;
    const planet = PLANETS[gs.planetIdx];
    // Particles
    for (let i = 0; i < 11; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (Math.random() * 3 + 1) * s;
      gs.particles.push({
        x: gs.ship.x - 10 * s, y: gs.ship.y + (Math.random() - 0.5) * 6 * s,
        vx: Math.cos(a) * sp - 1 * s, vy: Math.sin(a) * sp + 0.5 * s,
        r: (Math.random() * 2.5 + 1.5) * s,
        life: 30, maxLife: 30,
        color: planet.accent,
      });
    }
    // Ring pulse
    gs.rings.push({ x: gs.ship.x, y: gs.ship.y, radius: 8 * s, life: 22, maxLife: 22, color: planet.accent, scale: s });
    const pitch = 1 - gs.ship.y / gs.h;
    playFlap(pitch);
  }, [playFlap]);

  const onContinueRequested = () => console.log('[STELLAR DRIFT] onContinueRequested — wire AdMob rewarded ad here');
  const onMilestoneReached = (score) => console.log(`[STELLAR DRIFT] onMilestoneReached(${score}) — wire share/interstitial here`);
  const onRatingPromptEligible = () => console.log('[STELLAR DRIFT] onRatingPromptEligible — wire App Store rating request here');
  const onShipSkinUnlocked = (skinId) => console.log(`[STELLAR DRIFT] onShipSkinUnlocked(${skinId}) — wire IAP cosmetic system here`);

  const die = useCallback((gs) => {
    if (gs.state !== 'playing') return;
    gs.state = 'dead';
    gs.shake = 22;
    gs.flash = 18;
    gs.deathOverlay = 0;
    playDeath();
    setMusicLayer(0);
    if (vibrationRef.current && typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate([60, 40, 80]); } catch {}
    }
    if (gs.score > gs.best) {
      gs.best = gs.score;
      gs.newBest = true;
      try { localStorage.setItem('stellardrift_best', String(gs.best)); } catch {}
    }
    // Leaderboard qualification — top 10 (or any score if board < 10 entries)
    const lb = loadLeaderboard();
    const lowest = lb.length >= LB_LIMIT ? lb[lb.length - 1].score : 0;
    if (gs.score > 0 && (lb.length < LB_LIMIT || gs.score > lowest)) {
      if (gs.onLeaderboardEligible) {
        gs.onLeaderboardEligible({
          score: gs.score,
          planet: PLANETS[gs.planetIdx].name,
        });
      }
    }
    if (gs.score > 8 && !gs.ratedThisRun) {
      onRatingPromptEligible();
      gs.ratedThisRun = true;
    }
  }, [playDeath, setMusicLayer]);

  const startGame = useCallback((gs) => {
    gs.state = 'playing';
    gs.ship.x = gs.w * gs.phys.shipX;
    gs.ship.y = gs.h * 0.5;
    gs.ship.vx = 0;
    gs.ship.vy = 0;
    gs.ship.tilt = 0;
    gs.ship.trail = [];
    gs.columns = [];
    gs.fragments = [];
    gs.particles = [];
    gs.rings = [];
    gs.popups = [];
    gs.score = 0;
    gs.newBest = false;
    gs.combo = 0;
    gs.comboTimer = 0;
    gs.planetIdx = 0;
    gs.prevPlanetIdx = 0;
    gs.planetTransition = 1;
    gs.obstaclesInPlanet = 0;
    gs.framesSinceSpawn = 999;
    gs.spawnInterval = gs.phys.startSpawnInterval;
    gs.gap = gs.phys.startGap;
    gs.shake = 0;
    gs.flash = 0;
    gs.deathOverlay = 0;
    gs.scoreFlash = 0;
    gs.ratedThisRun = false;
    // Start the run with the full backing track (pad + kick) so the player
    // hears music immediately. Layer 2 (hat + lead) still kicks in at score 10.
    setMusicLayer(1);
  }, [setMusicLayer]);

  // Return to the start menu from any state — resets the run but stays at
  // music layer 0 so ambient music continues seamlessly.
  const goToMenu = useCallback((gs) => {
    gs.state = 'start';
    gs.ship.x = gs.w * gs.phys.shipX;
    gs.ship.y = gs.h * 0.5;
    gs.ship.vx = 0;
    gs.ship.vy = 0;
    gs.ship.tilt = 0;
    gs.ship.trail = [];
    gs.columns = [];
    gs.fragments = [];
    gs.particles = [];
    gs.rings = [];
    gs.popups = [];
    gs.score = 0;
    gs.combo = 0;
    gs.comboTimer = 0;
    gs.planetIdx = 0;
    gs.prevPlanetIdx = 0;
    gs.planetTransition = 1;
    gs.obstaclesInPlanet = 0;
    gs.deathOverlay = 0;
    setMusicLayer(0);
  }, [setMusicLayer]);

  // ─────────────────────────────────────────────────────────────
  // FIXED-TIMESTEP SIMULATION
  // ─────────────────────────────────────────────────────────────
  // Advances the game by exactly one fixed 16.667 ms tick. Called 0 or more
  // times per rendered frame by the accumulator in step(), so simulated time
  // always tracks real time regardless of the display refresh rate. See the
  // conversion audit near the top of this file for the per-frame → per-second
  // rationale. Rendering reads whatever state the last tick left behind.
  const simulateTick = useCallback((gs) => {
    const w = gs.w, h = gs.h;
    const phys = gs.phys;
    const s = phys.scale;
    const dtSec = FIXED_DT / 1000; // seconds of simulated time this tick (1/60)
    gs.time++;

    const planet = PLANETS[gs.planetIdx];
    // World scroll speed in px/s: base + per-level bonus + (score × per-obstacle).
    const levelBonus = (LEVEL_SPEED_BONUS[gs.planetIdx] || 0) * phys.widthScale * TICKS_PER_SECOND;
    const scoreBonus = gs.score * phys.speedPerObstacle;
    const moveSpeed = phys.baseSpeed + levelBonus + scoreBonus;

    // Planet transition crossfade (90 ticks = 1.5 s)
    if (gs.planetTransition < 1) {
      gs.planetTransition = Math.min(1, gs.planetTransition + 1 / 90);
    }

    // ── UPDATE ──
    if (gs.state === 'playing') {
      // Spawn (spawnInterval / framesSinceSpawn count sim ticks)
      gs.framesSinceSpawn++;
      if (gs.framesSinceSpawn >= gs.spawnInterval) {
        spawnColumn(gs);
      }
      // Ship vertical physics — per-second velocity/accel integrated by dtSec.
      gs.ship.vy += phys.gravity * dtSec;
      if (gs.ship.vy < phys.maxRiseSpeed) gs.ship.vy = phys.maxRiseSpeed;
      if (gs.ship.vy > phys.maxFallSpeed) gs.ship.vy = phys.maxFallSpeed;
      gs.ship.y += gs.ship.vy * dtSec;
      // Smoothed tilt — driven by the per-tick vertical displacement (vy*dtSec,
      // i.e. the old per-frame vy), unscaled so feel is viewport-independent.
      const targetTilt = Math.max(-0.5, Math.min(0.9, (gs.ship.vy * dtSec / s) * 0.06));
      gs.ship.tilt += (targetTilt - gs.ship.tilt) * phys.tiltSmoothing;
      // Lateral drift — self-contained damped spring, kept in per-tick units
      // (multiplicative damping/spring has no clean per-second ×60 form; at a
      // fixed 60 Hz timestep one tick == one May-24 frame, so feel is identical).
      const restX = gs.w * phys.shipX;
      gs.ship.vx += gs.ship.tilt * phys.lateralTiltInfluence;
      gs.ship.vx += Math.sin(gs.time * 0.04) * 0.015 * phys.lateralAmbientSway;
      gs.ship.vx += (restX - gs.ship.x) * phys.lateralRecenter;
      gs.ship.vx *= phys.lateralDamping;
      gs.ship.x += gs.ship.vx;
      // Trail
      if (gs.time % 2 === 0) {
        gs.ship.trail.push({ x: gs.ship.x - 12 * s, y: gs.ship.y });
        if (gs.ship.trail.length > 12) gs.ship.trail.shift();
      }
      for (let i = gs.columns.length - 1; i >= 0; i--) {
        const c = gs.columns[i];
        c.x -= moveSpeed * dtSec;
        // Score?
        if (!c.scored && c.x + phys.columnWidth < gs.ship.x - phys.shipRadius * 0.6) {
          c.scored = true;
          gs.score++;
          gs.obstaclesInPlanet++;
          gs.combo++;
          gs.comboTimer = 180;
          gs.scoreFlash = 10;
          // Score popup
          gs.popups.push({
            text: '+1', x: c.x + phys.columnWidth / 2, y: c.gapY,
            size: 22 * s, color: planet.accent,
            life: 40, maxLife: 40, vy: -1 * s,
          });
          playScore(gs.combo);
          if (gs.combo >= 4 && gs.combo % 4 === 0) {
            gs.popups.push({
              text: `×${gs.combo} COMBO`, x: w / 2, y: h * 0.4,
              size: 32 * s, color: planet.accent,
              life: 50, maxLife: 50, vy: -0.6 * s,
            });
            playCombo();
          }
          // Milestones
          if (gs.score === 10 || gs.score === 25 || gs.score === 50 || gs.score === 100) {
            onMilestoneReached(gs.score);
          }
          // Milestone celebration particles
          if (gs.score === 5 || gs.score === 15 || gs.score === 25 || gs.score === 50 || gs.score === 75 || gs.score === 100) {
            for (let k = 0; k < 30; k++) {
              const a = Math.random() * Math.PI * 2;
              const sp = (Math.random() * 5 + 1.5) * s;
              gs.particles.push({
                x: c.x + phys.columnWidth / 2, y: c.gapY,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                r: (Math.random() * 3 + 1.5) * s,
                life: 50, maxLife: 50,
                color: planet.accent,
              });
            }
          }
          // Music layer progression — starts at layer 1, hat+lead joins at 10.
          if (gs.score === 10) setMusicLayer(2);
          // Planet transition
          if (gs.obstaclesInPlanet >= 15 && gs.planetIdx < PLANETS.length - 1) {
            gs.prevPlanetIdx = gs.planetIdx;
            gs.planetIdx++;
            gs.obstaclesInPlanet = 0;
            gs.planetTransition = 0;
            gs.transitionCard = 120;
            gs.combo = 0;
            gs.comboTimer = 0;
            gs.transitionCardPlanet = gs.planetIdx;
            gs.gap = Math.max(phys.minGap, gs.gap - phys.gapShrinkPerPlanet);
            gs.spawnInterval = Math.max(phys.minSpawnInterval, gs.spawnInterval - phys.spawnShrinkPerPlanet);
            gs.stars = makeStars(w, h, 60, s);
            gs.dust = makeDust(w, h, 30, s);
            playLevelUp();
          }
        }
        // Off-screen
        if (c.x + phys.columnWidth + 20 * s < 0) {
          gs.columns.splice(i, 1);
          continue;
        }
        // Collision
        const topH = c.gapY - c.gap / 2;
        const botY = c.gapY + c.gap / 2;
        const sx = gs.ship.x, sy = gs.ship.y, sr = phys.shipRadius - 2 * s;
        if (sx + sr > c.x && sx - sr < c.x + phys.columnWidth) {
          if (sy - sr < topH || sy + sr > botY) {
            die(gs);
          }
        }
      }
      // Ground/ceiling
      if (gs.ship.y - phys.shipRadius < 0) {
        gs.ship.y = phys.shipRadius;
        gs.ship.vy = 0;
      }
      if (gs.ship.y + phys.shipRadius > h) {
        die(gs);
      }
      // Star Fragments — move with world, animate, collect on overlap
      for (let i = gs.fragments.length - 1; i >= 0; i--) {
        const f = gs.fragments[i];
        f.x -= moveSpeed * dtSec;
        f.rot += 0.045;
        f.bounce += 0.08;
        if (!f.collected) {
          const dx = f.x - gs.ship.x;
          const dy = f.y - gs.ship.y;
          const cr = phys.shipRadius + 12 * s;
          if (dx * dx + dy * dy < cr * cr) {
            f.collected = true;
            const newTotal = loadFragments() + 1;
            saveFragments(newTotal);
            if (gs.onFragmentChange) gs.onFragmentChange(newTotal);
            playFragment();
            // Particle burst in accent
            for (let k = 0; k < 22; k++) {
              const a = Math.random() * Math.PI * 2;
              const sp = (Math.random() * 4 + 1) * s;
              gs.particles.push({
                x: f.x, y: f.y,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                r: (Math.random() * 2.5 + 1) * s,
                life: 40, maxLife: 40,
                color: planet.accent,
              });
            }
            gs.popups.push({
              text: '+1 ★', x: f.x, y: f.y - 10 * s,
              size: 18 * s, color: planet.accent,
              life: 36, maxLife: 36, vy: -1 * s,
            });
          }
        }
        if (f.collected || f.x + 30 * s < 0) {
          gs.fragments.splice(i, 1);
        }
      }
      // Combo timer
      if (gs.comboTimer > 0) {
        gs.comboTimer--;
        if (gs.comboTimer === 0) gs.combo = 0;
      }
    } else if (gs.state === 'start') {
      // Idle ship bob
      gs.ship.idleT += 0.04;
      gs.ship.y = h * 0.5 + Math.sin(gs.ship.idleT) * 14 * s;
      gs.ship.vy = Math.cos(gs.ship.idleT) * 14 * 0.04 * s * TICKS_PER_SECOND; // px/s (sign drives flame)
      gs.ship.vx = 0;
      gs.ship.tilt = Math.cos(gs.ship.idleT) * 0.12;
      gs.ship.x = w * phys.shipX;
      if (gs.time % 4 === 0) {
        gs.ship.trail.push({ x: gs.ship.x - 12 * s, y: gs.ship.y });
        if (gs.ship.trail.length > 10) gs.ship.trail.shift();
      }
    } else if (gs.state === 'dead') {
      gs.deathOverlay = Math.min(20, gs.deathOverlay + 1);
      // Ship falls — per-second gravity integrated by dtSec; lateral per-tick.
      gs.ship.vy += phys.gravity * 0.6 * dtSec;
      gs.ship.y += gs.ship.vy * dtSec;
      gs.ship.x += gs.ship.vx;
      gs.ship.vx *= 0.95;
      gs.ship.tilt = Math.min(1.2, gs.ship.tilt + 0.02);
    }

    // Particles update (cosmetic bursts; velocities kept in per-tick units)
    for (let i = gs.particles.length - 1; i >= 0; i--) {
      const p = gs.particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.08 * s;
      p.vx *= 0.98;
      p.life--;
      if (p.life <= 0) gs.particles.splice(i, 1);
    }
    // Rings update
    for (let i = gs.rings.length - 1; i >= 0; i--) {
      const r = gs.rings[i];
      r.radius += 2.5 * (r.scale || s);
      r.life--;
      if (r.life <= 0) gs.rings.splice(i, 1);
    }
    // Popups update
    for (let i = gs.popups.length - 1; i >= 0; i--) {
      const p = gs.popups[i];
      p.y += p.vy || -1 * s;
      p.life--;
      if (p.life <= 0) gs.popups.splice(i, 1);
    }
    // Atmospheric dust — advanced here (previously inside drawDust) so its drift
    // is frame-rate independent. Velocities are per-tick (ambient / cosmetic).
    for (let i = 0; i < gs.dust.length; i++) {
      const d = gs.dust[i];
      d.x += d.vx;
      d.y += d.vy;
      if (d.x < -10) d.x = w + 10;
      if (d.y < 0) d.y = h;
      if (d.y > h) d.y = 0;
    }

    // Timers / screen-shake decay (tick countdowns)
    if (gs.scoreFlash > 0) gs.scoreFlash--;
    if (gs.shake > 0) gs.shake--;
    if (gs.flash > 0) gs.flash--;
    if (gs.transitionCard > 0) gs.transitionCard--;
  }, [spawnColumn, die, playScore, playCombo, playLevelUp, playFragment, setMusicLayer, makeStars, makeDust]);

  // ─────────────────────────────────────────────────────────────
  // GAME LOOP
  // ─────────────────────────────────────────────────────────────
  const step = useCallback((timestamp) => {
    const canvas = canvasRef.current;
    const off = offscreenRef.current;
    const gs = gsRef.current;
    if (!canvas || !gs) {
      rafRef.current = requestAnimationFrame(step);
      return;
    }

    try {
      const ctx = canvas.getContext('2d');
      const w = gs.w, h = gs.h;
      // ── FIXED-TIMESTEP ACCUMULATOR ──
      // Bank real elapsed time and drain it one fixed 60 Hz tick at a time, so
      // the simulation runs at a constant wall-clock rate regardless of the
      // display refresh. frameTime is clamped to MAX_FRAME_TIME so a backgrounded
      // tab can't bank seconds of time and spiral / fast-forward on return.
      const now = timestamp ?? performance.now();
      // ?fps diagnostic: start of this frame’s JS work (no-op unless flag on).
      const _jsStart = SHOW_FPS ? performance.now() : 0;
      if (gs._lastFrameTime == null) gs._lastFrameTime = now;
      let frameTime = now - gs._lastFrameTime;
      gs._lastFrameTime = now;
      if (frameTime < 0) frameTime = 0;
      if (frameTime > MAX_FRAME_TIME) frameTime = MAX_FRAME_TIME;
      gs._accumulator += frameTime;
      let ticksThisFrame = 0;
      while (gs._accumulator >= FIXED_DT) {
        simulateTick(gs);
        gs._accumulator -= FIXED_DT;
        ticksThisFrame++;
      }

      // Mirror gs.state into React so menu DOM can react to play/dead transitions.
      if (gs.state !== gs._lastViewSeen) {
        gs._lastViewSeen = gs.state;
        if (gs.onView) gs.onView(gs.state);
      }
      // Mirror gs.planetIdx into React so menu surfaces (frosted tints, accent
      // glows, leaderboard player-row highlight) update as the player advances.
      if (gs.planetIdx !== gs._lastPlanetSeen) {
        gs._lastPlanetSeen = gs.planetIdx;
        if (gs.onPlanetChange) gs.onPlanetChange(gs.planetIdx);
      }

      // Resolve current planet & speed for rendering / HUD.
      const planet = PLANETS[gs.planetIdx];
      const phys = gs.phys;
      const s = phys.scale;
      // speedMul is the HUD "×": current scroll speed ÷ base. Both are per-second
      // now, so the ratio (and the displayed multiplier) is unchanged from May-24.
      const levelBonus = (LEVEL_SPEED_BONUS[gs.planetIdx] || 0) * phys.widthScale * TICKS_PER_SECOND;
      const scoreBonus = gs.score * phys.speedPerObstacle;
      const speedMul = (phys.baseSpeed + levelBonus + scoreBonus) / phys.baseSpeed;

      // ── DRAW to offscreen for bloom pass ──
      const offCtx = off.getContext('2d');
      const shakeX = gs.shake > 0 ? (Math.random() - 0.5) * gs.shake * s : 0;
      const shakeY = gs.shake > 0 ? (Math.random() - 0.5) * gs.shake * s : 0;

      offCtx.save();
      offCtx.clearRect(0, 0, w, h);
      offCtx.translate(shakeX, shakeY);

      // Background — handle crossfade if transitioning
      if (gs.planetTransition < 1 && gs.prevPlanetIdx !== gs.planetIdx) {
        const prev = PLANETS[gs.prevPlanetIdx];
        drawBackground(offCtx, w, h, prev, gs.time, s);
        drawStars(offCtx, gs.stars, gs.time, 1 - gs.planetTransition);
        offCtx.save();
        offCtx.globalAlpha = gs.planetTransition;
        drawBackground(offCtx, w, h, planet, gs.time, s);
        drawStars(offCtx, gs.stars, gs.time, gs.planetTransition);
        offCtx.restore();
      } else {
        drawBackground(offCtx, w, h, planet, gs.time, s);
        drawStars(offCtx, gs.stars, gs.time, 1);
      }

      // Atmospheric dust
      if (planet.name === 'MARS' || planet.name === 'JUPITER' || planet.name === 'URANUS') {
        drawDust(offCtx, gs.dust);
      }

      // Columns (only while playing or dead-falling)
      if (gs.state === 'playing' || gs.state === 'dead') {
        gs.columns.forEach((c) => drawColumnPair(offCtx, c, planet, h, phys.columnWidth, s));
      }

      // Star Fragments (between columns and ship)
      if (gs.state === 'playing' || gs.state === 'dead') {
        drawFragments(offCtx, gs.fragments, planet, s);
      }

      // Rings (under ship)
      drawRings(offCtx, gs.rings);
      // Cinematic ambient halo behind the ship on the start screen
      if (gs.state === 'start') {
        const haloPulse = 0.85 + Math.sin(gs.time * 0.04) * 0.15;
        const haloR = Math.min(w, h) * 0.32 * haloPulse;
        // Live ship y (matches drawShip — the ship is not interpolated).
        const halo = offCtx.createRadialGradient(gs.ship.x, gs.ship.y, 0, gs.ship.x, gs.ship.y, haloR);
        halo.addColorStop(0, `${planet.accent}38`);
        halo.addColorStop(0.5, `${planet.accent}14`);
        halo.addColorStop(1, `${planet.accent}00`);
        offCtx.fillStyle = halo;
        offCtx.fillRect(0, 0, w, h);
      }
      // Ship
      drawShip(offCtx, gs.ship, planet, gs.time, s, gs.alienId, gs.hatId);
      // Particles
      drawParticles(offCtx, gs.particles);
      // Popups
      drawPopups(offCtx, gs.popups);

      // Fog
      drawFog(offCtx, w, h, planet.fog);

      offCtx.restore();

      // Refresh the shared downsampled-blur of the scene used by all
      // frosted-glass cards this frame. One small blur per frame instead
      // of three large ones per card.
      const bs = blurredSceneRef.current;
      if (bs && bs.width > 0) {
        const bsCtx = bs.getContext('2d');
        bsCtx.setTransform(1, 0, 0, 1, 0, 0);
        bsCtx.clearRect(0, 0, bs.width, bs.height);
        bsCtx.filter = `blur(${FROSTED_SCENE_BLUR_PX}px)`;
        bsCtx.drawImage(off, 0, 0, bs.width, bs.height);
        bsCtx.filter = 'none';
      }

      // ── COMPOSITE TO MAIN CANVAS WITH BLOOM ──
      ctx.clearRect(0, 0, w, h);
      // Base. Destination size (w, h) is required: the offscreen canvas is
      // sized w*dpr x h*dpr in intrinsic pixels, and the main ctx already
      // has a dpr transform applied — omitting the size double-scales by dpr.
      ctx.drawImage(off, 0, 0, w, h);
      // Bloom: blurred copy at low opacity
      ctx.save();
      ctx.globalAlpha = 0.40;
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = `blur(${8 * s}px)`;
      ctx.drawImage(off, 0, 0, w, h);
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      // Vignette — soft dark edges to focus the eye, deepens for the start menu
      ctx.save();
      const vigDepth = gs.state === 'start' ? 0.55 : 0.38;
      const vg = ctx.createRadialGradient(w / 2, h * 0.50, Math.min(w, h) * 0.40, w / 2, h * 0.50, Math.max(w, h) * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, `rgba(0,0,0,${vigDepth})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();

      // White flash on death
      if (gs.flash > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${gs.flash / 18 * 0.5})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      // HUD (only in playing/dead, not start). Pass `off` so the frosted
      // cards can sample and blur the rendered scene behind them.
      if (gs.state === 'playing' || gs.state === 'dead') {
        drawHUD(ctx, gs, planet, speedMul, off);
      }

      // Transition card overlay
      if (gs.transitionCard > 0) {
        drawTransitionCard(ctx, gs, w, h, off);
      }

      // Start / Death screens
      if (gs.state === 'start') {
        drawStartScreen(ctx, gs, w, h);
      } else if (gs.state === 'dead') {
        drawDeathScreen(ctx, gs, w, h, gs.time, off);
      }

      // ── PERF METER (?fps) ── read-only diagnostic, gated behind the URL flag.
      // frame = real interval between RAF callbacks (its max catches stalls);
      // js = main-thread work this frame. If js is tiny but frame is large/erratic,
      // the cost is iOS compositor/throttling, not our code.
      if (SHOW_FPS) {
        const st = gs._fps || (gs._fps = {
          last: now, shownAt: now, n: 0, dSum: 0, dMax: 0, jSum: 0, tickSum: 0,
          fps: 0, dmax: 0, jms: '0.0', stps: 0,
        });
        const interval = now - st.last;
        st.last = now;
        const jsMs = performance.now() - _jsStart;
        st.tickSum += ticksThisFrame; // count sim ticks regardless of frame interval
        if (interval > 0 && interval < 1000) {
          st.n++; st.dSum += interval; st.jSum += jsMs;
          if (interval > st.dMax) st.dMax = interval;
        }
        const windowMs = now - st.shownAt;
        if (windowMs >= 500 && st.n > 0) {
          st.fps = Math.round(1000 / (st.dSum / st.n));
          st.dmax = Math.round(st.dMax);
          st.jms = (st.jSum / st.n).toFixed(1);
          // Simulation rate — the key Phase 0.5 diagnostic: should read ~60
          // even when the display fps line reads ~30 (iOS Low Power Mode).
          st.stps = Math.round((st.tickSum * 1000) / windowMs);
          st.shownAt = now; st.n = 0; st.dSum = 0; st.dMax = 0; st.jSum = 0; st.tickSum = 0;
        }
        ctx.save();
        ctx.font = '600 13px ui-monospace, Menlo, monospace';
        ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        const lines = [`${st.fps} fps`, `${st.stps} sim/s`, `frame max ${st.dmax}ms`, `js ${st.jms}ms`];
        // Bottom-left: the top corners are covered by DOM HUD (fragment pill,
        // trophy/settings buttons). Lifted to clear Safari's bottom bar.
        const boxH = 16 * lines.length + 12;
        const boxY = h - boxH - 90;
        ctx.fillStyle = 'rgba(0,0,0,0.62)';
        ctx.fillRect(8, boxY, 132, boxH);
        ctx.fillStyle = '#00ff88';
        lines.forEach((t, i) => ctx.fillText(t, 14, boxY + 6 + i * 16));
        ctx.restore();
      }
    } catch (err) {
      console.error('[STELLAR DRIFT] loop error', err);
    }

    rafRef.current = requestAnimationFrame(step);
  }, [
    simulateTick, drawBackground, drawStars, drawDust, drawColumnPair,
    drawShip, drawParticles, drawRings, drawPopups, drawFog, drawFragments,
    drawHUD, drawStartScreen, drawDeathScreen, drawTransitionCard,
  ]);

  // ─────────────────────────────────────────────────────────────
  // SETUP / EVENTS
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const off = document.createElement('canvas');
    offscreenRef.current = off;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = rect.width, h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      off.width = w * dpr;
      off.height = h * dpr;
      off.style.width = `${w}px`;
      off.style.height = `${h}px`;
      const offCtx = off.getContext('2d');
      offCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Allocate / resize the shared blurred-scene canvas to match `off`
      // at 1/FROSTED_SCENE_DOWNSCALE intrinsic resolution.
      if (!blurredSceneRef.current) blurredSceneRef.current = document.createElement('canvas');
      const bs = blurredSceneRef.current;
      bs.width = Math.max(1, Math.floor(off.width / FROSTED_SCENE_DOWNSCALE));
      bs.height = Math.max(1, Math.floor(off.height / FROSTED_SCENE_DOWNSCALE));
            if (gsRef.current) {
        const prevW = gsRef.current.w;
        const prevH = gsRef.current.h;
        const oldScale = gsRef.current.scale || getScale(prevH > 0 ? gsRef.current.w : w, prevH || h);
        const newScale = getScale(w, h);
        const newWidthScale = getWidthScale(w);
        const scaleRatio = newScale / oldScale;
        // Horizontal positions rescale by the width ratio so columns stay at the
        // same fractional x across viewport changes; visual scale would distort
        // this on aspect-ratio changes (e.g., rotation to landscape).
        const widthRatio = prevW > 0 ? w / prevW : 1;
        gsRef.current.w = w;
        gsRef.current.h = h;
        gsRef.current.scale = newScale;
        gsRef.current.phys = makePhysics(newScale, newWidthScale);
        gsRef.current.ship.x = w * gsRef.current.phys.shipX;
        // Re-center ship vertically if not actively playing
        if (gsRef.current.state !== 'playing') {
          gsRef.current.ship.y = h * 0.5;
        } else if (prevH > 0) {
          // Scale ship Y proportionally during play
          gsRef.current.ship.y = (gsRef.current.ship.y / prevH) * h;
        }
        // Rescale velocities and gameplay pixel quantities
        gsRef.current.ship.vy *= scaleRatio;
        gsRef.current.ship.vx = 0;
        if (gsRef.current.columns && gsRef.current.columns.length) {
          gsRef.current.columns.forEach((c) => {
            c.gapY = (c.gapY / prevH) * h;
            c.gap *= scaleRatio;
            c.x *= widthRatio;
          });
        }
        if (gsRef.current.fragments && gsRef.current.fragments.length) {
          gsRef.current.fragments.forEach((f) => {
            f.y = (f.y / prevH) * h;
            f.x *= widthRatio;
          });
        }
        gsRef.current.gap *= scaleRatio;
        gsRef.current.stars = makeStars(w, h, 60, newScale);
        gsRef.current.dust = makeDust(w, h, 30, newScale);
      } else {
        gsRef.current = initGameState(w, h);
        // Wire React setters directly — the dedicated wiring effect runs
        // before this resize effect on first mount, so gs.onView would
        // otherwise stay undefined and the start-menu overlay wouldn't
        // hide when the game transitions to 'playing'.
        gsRef.current.onFragmentChange = setFragments;
        gsRef.current.onView = setView;
        gsRef.current.onPlanetChange = setCurrentPlanetIdx;
        gsRef.current.onLeaderboardEligible = setPendingEntry;
      }

    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(container);

    rafRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [step, initGameState, makeStars, makeDust]);

  const handleInput = useCallback(() => {
    const gs = gsRef.current;
    if (!gs) return;
    // First interaction — init audio
    if (!gs.hasInteracted) {
      initAudio();
      resumeAudio();
      startMusic();
      gs.hasInteracted = true;
    } else {
      resumeAudio();
    }
    if (gs.state === 'start') {
      startGame(gs);
    } else if (gs.state === 'playing') {
      flap(gs);
    } else if (gs.state === 'dead') {
      // Allow restart after death overlay has appeared
      if (gs.deathOverlay >= 15) {
        startGame(gs);
        startMusic();
      }
    }
  }, [flap, startGame, initAudio, resumeAudio, startMusic]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        handleInput();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleInput]);

  const onTouchStart = useCallback((e) => {
    e.preventDefault();
    handleInput();
  }, [handleInput]);

  const onMouseDown = useCallback((e) => {
    // Desktop / browser fallback (touch already handled separately)
    e.preventDefault();
    handleInput();
  }, [handleInput]);

  // Apply mute state to master gain
  useEffect(() => {
    const a = audioRef.current;
    if (a) {
      try {
        a.master.gain.cancelScheduledValues(a.ctx.currentTime);
        a.master.gain.linearRampToValueAtTime(muted ? 0 : 0.7, a.ctx.currentTime + 0.15);
      } catch {}
    }
  }, [muted]);

  // Player taps the PLAY button — start the game (and audio) immediately
  const handlePlay = useCallback(() => {
    playMenuTap();
    const gs = gsRef.current;
    if (!gs) return;
    if (!gs.hasInteracted) {
      initAudio();
      resumeAudio();
      startMusic();
      gs.hasInteracted = true;
    } else {
      resumeAudio();
    }
    if (gs.state === 'start' || gs.state === 'dead') startGame(gs);
  }, [initAudio, resumeAudio, startMusic, startGame, playMenuTap]);

  const handleOpenPanel = useCallback((panel) => {
    playMenuTap();
    if (!audioRef.current) {
      initAudio();
      resumeAudio();
    }
    setOpenPanel(panel);
  }, [initAudio, resumeAudio, playMenuTap]);

  const handleBackToMenu = useCallback(() => {
    playMenuTap();
    const gs = gsRef.current;
    if (gs) goToMenu(gs);
  }, [goToMenu, playMenuTap]);

  const handleClosePanel = useCallback(() => {
    playMenuTap();
    setOpenPanel(null);
  }, [playMenuTap]);

  const handleUnlockAlien = useCallback((alienId) => {
    const alien = ALIENS.find((a) => a.id === alienId);
    if (!alien || ownedAliens.includes(alienId)) return;
    if (fragments < alien.cost) return;
    const newCount = fragments - alien.cost;
    setFragments(newCount);
    saveFragments(newCount);
    setOwnedAliens((arr) => [...arr, alienId]);
    setSelectedAlien(alienId);
    onShipSkinUnlocked(alienId);
    playLevelUp();
  }, [fragments, ownedAliens, playLevelUp]);

  const handleUnlockHat = useCallback((hatId) => {
    const h = HATS.find((x) => x.id === hatId);
    if (!h || ownedHats.includes(hatId)) return;
    if (fragments < h.cost) return;
    const newCount = fragments - h.cost;
    setFragments(newCount);
    saveFragments(newCount);
    setOwnedHats((arr) => [...arr, hatId]);
    setSelectedHat(hatId);
    playLevelUp();
  }, [fragments, ownedHats, playLevelUp]);

  const handleSelectAlien = useCallback((alienId) => {
    if (!ownedAliens.includes(alienId)) return;
    playMenuTap();
    setSelectedAlien(alienId);
  }, [ownedAliens, playMenuTap]);

  const handleSelectHat = useCallback((hatId) => {
    if (!ownedHats.includes(hatId)) return;
    playMenuTap();
    setSelectedHat(hatId);
  }, [ownedHats, playMenuTap]);

  const handleSubmitInitials = useCallback(() => {
    if (!pendingEntry) return;
    const cleaned = (initials || 'AAA').toUpperCase().replace(/[^A-Z]/g, 'A').padEnd(3, 'A').slice(0, 3);
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      initials: cleaned,
      score: pendingEntry.score,
      planet: pendingEntry.planet,
      date: new Date().toISOString().slice(0, 10),
    };
    const next = [...leaderboard, entry].sort((a, b) => b.score - a.score).slice(0, LB_LIMIT);
    setLeaderboard(next);
    saveLeaderboard(next);
    setLastEntryId(entry.id);
    setPendingEntry(null);
    setInitials('AAA');
    playLevelUp();
  }, [pendingEntry, initials, leaderboard, playLevelUp]);

  const handleShareScore = useCallback(async (score, planet) => {
    const text = `I reached ${planet} with ${score} points in Stellar Drift! Beat me: ${VERCEL_URL}`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      } else {
        // Fallback: create a temporary input
        const el = document.createElement('textarea');
        el.value = text;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      setShareToast(true);
      setTimeout(() => setShareToast(false), 1800);
    } catch {}
  }, []);

  // Block in-game taps from triggering while a menu panel or initials modal is open
  const tapsBlocked = openPanel !== null || pendingEntry !== null || view === 'start';
  // Mobile browsers fire a synthetic mousedown after every touchstart, which
  // would otherwise flap twice per tap. Ignore mousedown shortly after a touch.
  const lastTouchRef = useRef(0);
  const onCanvasTap = useCallback((e) => {
    if (tapsBlocked) return;
    const now = Date.now();
    if (e.type === 'mousedown') {
      if (now - lastTouchRef.current < 600) return;
    } else if (e.type === 'touchstart') {
      lastTouchRef.current = now;
    }
    e.preventDefault();
    handleInput();
  }, [tapsBlocked, handleInput]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        background: '#05070d',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif',
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          maxWidth: '100vw',
          maxHeight: '100vh',
          background: '#0a0f1a',
          overflow: 'hidden',
          boxShadow: '0 0 80px rgba(0,0,0,0.6)',
          WebkitTapHighlightColor: 'transparent',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
        }}
        onTouchStart={onCanvasTap}
        onMouseDown={onCanvasTap}
      >
        <canvas
          ref={canvasRef}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            WebkitTapHighlightColor: 'transparent',
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
          }}
        />

        {/* `currentPlanet` drives frosted-glass tint (light→dark on the Sun)
            and accent color across all menus. It mirrors gs.planetIdx via the
            onPlanetChange callback, so it follows the player into each level. */}
        {(() => {
          const currentPlanet = PLANETS[currentPlanetIdx] || PLANETS[0];
          return (
            <>
              {/* Start menu — arcade card layout */}
              {view === 'start' && !openPanel && (
                <StartMenuOverlay
                  fragments={fragments}
                  best={parseInt(localStorage.getItem('stellardrift_best') || '0', 10)}
                  ownedAliens={ownedAliens}
                  selectedAlien={selectedAlien}
                  selectedHat={selectedHat}
                  planet={currentPlanet}
                  onSelectAlien={handleSelectAlien}
                  onPlay={handlePlay}
                  onOpenPanel={handleOpenPanel}
                />
              )}

              {/* Death menu — replay + share when there's no pending initials entry.
                  Score is read from the ref by the share-callback closure rather
                  than during render, sidestepping react-hooks/refs lint. */}
              {view === 'dead' && !pendingEntry && (
                <DeathOverlay
                  planet={currentPlanet}
                  onRetry={handlePlay}
                  onShare={() => {
                    const s = gsRef.current?.score || 0;
                    handleShareScore(s, currentPlanet.name);
                  }}
                  onLeaderboard={() => handleOpenPanel('leaderboard')}
                  onMenu={handleBackToMenu}
                />
              )}

              {/* Initials entry modal when score qualifies for the leaderboard */}
              {pendingEntry && (
                <InitialsModal
                  entry={pendingEntry}
                  initials={initials}
                  onChange={setInitials}
                  onSubmit={handleSubmitInitials}
                  planet={currentPlanet}
                />
              )}

              {/* Panels */}
              {openPanel === 'aliens' && (
                <AliensPanel
                  fragments={fragments}
                  ownedAliens={ownedAliens}
                  ownedHats={ownedHats}
                  selectedAlien={selectedAlien}
                  selectedHat={selectedHat}
                  planet={currentPlanet}
                  onSelectAlien={handleSelectAlien}
                  onSelectHat={handleSelectHat}
                  onUnlockAlien={handleUnlockAlien}
                  onUnlockHat={handleUnlockHat}
                  onClose={handleClosePanel}
                />
              )}
              {openPanel === 'leaderboard' && (
                <LeaderboardPanel
                  entries={leaderboard}
                  highlightId={lastEntryId}
                  planet={currentPlanet}
                  onShare={handleShareScore}
                  onClose={handleClosePanel}
                />
              )}
              {openPanel === 'settings' && (
                <SettingsPanel
                  muted={muted}
                  vibration={vibration}
                  colorBlind={colorBlind}
                  planet={currentPlanet}
                  onMutedChange={setMuted}
                  onVibrationChange={setVibration}
                  onColorBlindChange={setColorBlind}
                  onClose={handleClosePanel}
                />
              )}
            </>
          );
        })()}

        {/* Transient share-success toast */}
        {shareToast && (
          <div
            style={{
              position: 'absolute',
              bottom: 90,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: '10px 18px',
              borderRadius: 20,
              background: 'rgba(20,25,38,0.92)',
              color: '#fff',
              fontSize: 13,
              border: '1px solid rgba(255,255,255,0.10)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
              pointerEvents: 'none',
              animation: 'sd-fade 0.25s ease-out',
            }}
          >
            Score copied — share it!
          </div>
        )}

        {/* Global animation + design-token styles */}
        <style>{`
          @keyframes sd-fade {
            from { opacity: 0; transform: translate(-50%, 8px); }
            to   { opacity: 1; transform: translate(-50%, 0); }
          }
          @keyframes sd-panel-in {
            0%   { opacity: 0; transform: scale(0.86); }
            65%  { opacity: 1; transform: scale(1.025); }
            100% { opacity: 1; transform: scale(1); }
          }
          @keyframes sd-overlay-in {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes sd-title-in {
            0%   { opacity: 0; transform: translateY(8px); letter-spacing: 14px; }
            100% { opacity: 1; transform: translateY(0);   letter-spacing: 4px; }
          }
          @keyframes sd-soft-pulse {
            0%, 100% { box-shadow: 0 16px 40px rgba(0,0,0,0.45), 0 0 30px rgba(255,255,255,0.12), 0 0 0 1px rgba(255,255,255,0.06) inset; }
            50%      { box-shadow: 0 16px 44px rgba(0,0,0,0.50), 0 0 56px rgba(255,255,255,0.22), 0 0 0 1px rgba(255,255,255,0.08) inset; }
          }
          .sd-btn {
            transition: transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
          }
          .sd-btn:active { transform: scale(0.95); }
          .sd-btn-primary {
            animation: sd-soft-pulse 3.4s ease-in-out infinite;
          }
          .sd-btn-primary:active { transform: scale(0.93); }
        `}</style>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MENU UI COMPONENTS (DOM overlays on the canvas)
// ═══════════════════════════════════════════════════════════════

// Frosted glass design tokens. `frostedCardStyle()` returns the main panel
// card style; pass a planet so dark-tinted planets (e.g., The Sun) get the
// readable warm-amber variant. `frostedSubCardStyle()` is for nested cards
// (alien tiles, hat tiles, leaderboard rows).
const frostedCardStyle = (planet) => {
  const dark = planet ? needsDarkTint(planet) : false;
  return {
    background: dark ? FROSTED_TINT_DARK : FROSTED_TINT_LIGHT,
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: 22,
    boxShadow: '0 8px 40px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
    color: '#ffffff',
    WebkitTapHighlightColor: 'transparent',
  };
};

const frostedSubCardStyle = (planet, selected, accent) => {
  const dark = planet ? needsDarkTint(planet) : false;
  const base = dark
    ? 'rgba(20, 12, 8, 0.30)'
    : 'rgba(255, 255, 255, 0.10)';
  const selBase = dark
    ? 'rgba(40, 25, 15, 0.50)'
    : 'rgba(255, 255, 255, 0.22)';
  return {
    background: selected ? selBase : base,
    border: selected
      ? `1px solid ${accent || 'rgba(255, 255, 255, 0.40)'}66`
      : '1px solid rgba(255, 255, 255, 0.18)',
    borderRadius: 18,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    boxShadow: selected ? `0 0 24px ${accent || '#ffffff'}26` : 'none',
    color: '#ffffff',
  };
};

// Primary text style — pure white with the spec-mandated soft shadow.
const textShadowPrimary = '0 1px 4px rgba(0, 0, 0, 0.4)';
const textShadowSubtle = '0 1px 3px rgba(0, 0, 0, 0.35)';
// Label text — uppercase, 11px, 600, letter-spaced.
const labelStyle = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.10em',
  textTransform: 'uppercase',
  color: 'rgba(255, 255, 255, 0.60)',
  textShadow: textShadowSubtle,
};

const overlayBackdropStyle = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(4, 6, 12, 0.45)',
  backdropFilter: 'blur(4px)',
  WebkitBackdropFilter: 'blur(4px)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 10,
  animation: 'sd-overlay-in 0.2s ease-out',
  touchAction: 'none',
};

const stopProp = (e) => e.stopPropagation();

function Icon({ name, size = 22, color = 'currentColor' }) {
  const common = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' };
  if (name === 'play') return (
    <svg {...common} fill={color} stroke="none"><path d="M7 5v14l12 -7z" /></svg>
  );
  if (name === 'ship') return (
    <svg {...common}><path d="M14 3l5 5l-7 7l-5 -5z" /><path d="M14 3l-3 3l5 5l3 -3" /><path d="M10 14l-3 3l-3 -1l1 -3z" /><circle cx="14.5" cy="8.5" r="0.8" fill={color}/></svg>
  );
  if (name === 'trophy') return (
    <svg {...common}><path d="M8 4h8v4a4 4 0 0 1 -8 0z" /><path d="M5 6h3v2a3 3 0 0 1 -3 -3" /><path d="M19 6h-3v2a3 3 0 0 0 3 -3" /><path d="M10 14h4v3h-4z" /><path d="M9 20h6" /><path d="M10 17v3" /><path d="M14 17v3" /></svg>
  );
  if (name === 'gear') return (
    <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1 -2.1M17.7 6.3l2.1 -2.1" /></svg>
  );
  if (name === 'star') return (
    <svg {...common} fill={color} stroke="none"><path d="M12 3l2.7 6.1l6.7 0.6l-5.1 4.4l1.5 6.6L12 17.5l-5.8 3.2l1.5 -6.6l-5.1 -4.4l6.7 -0.6z" /></svg>
  );
  if (name === 'close') return (
    <svg {...common}><path d="M6 6l12 12M6 18L18 6" /></svg>
  );
  if (name === 'share') return (
    <svg {...common}><circle cx="6" cy="12" r="2.4"/><circle cx="18" cy="6" r="2.4"/><circle cx="18" cy="18" r="2.4"/><path d="M8 11l8 -4M8 13l8 4"/></svg>
  );
  if (name === 'check') return (
    <svg {...common}><path d="M5 13l4 4l10 -10" /></svg>
  );
  if (name === 'lock') return (
    <svg {...common}><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10v-3a4 4 0 0 1 8 0v3" /></svg>
  );
  if (name === 'home') return (
    <svg {...common}><path d="M4 11l8 -7l8 7" /><path d="M6 10v9h12v-9" /></svg>
  );
  return null;
}

function StartMenuOverlay({ fragments, best, ownedAliens, selectedAlien, selectedHat, planet, onSelectAlien, onPlay, onOpenPanel }) {
  // "Level" stat = highest planet reached. 15 obstacles per planet.
  const levelReached = Math.min(10, 1 + Math.floor((best || 0) / 15));
  const accent = planet?.accent || '#ffffff';
  const dark = planet ? needsDarkTint(planet) : false;
  const tint = dark ? FROSTED_TINT_DARK : FROSTED_TINT_LIGHT;

  // Frosted icon button — small (36px) circular for the top-right toolbar.
  const iconButtonStyle = {
    width: 36,
    height: 36,
    borderRadius: 18,
    border: '1px solid rgba(255, 255, 255, 0.25)',
    background: tint,
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    outline: 'none',
    boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
  };

  return (
    <>
      {/* Top bar — fragments (left), action icons (right) */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(18px + env(safe-area-inset-top, 0px))',
          left: 18,
          right: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
          animation: 'sd-overlay-in 0.5s ease-out both',
          zIndex: 5,
        }}
      >
        <div
          style={{
            padding: '7px 14px',
            borderRadius: 22,
            background: tint,
            backdropFilter: 'blur(24px) saturate(140%)',
            WebkitBackdropFilter: 'blur(24px) saturate(140%)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            color: '#ffffff',
            fontSize: 13,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
            textShadow: textShadowPrimary,
          }}
        >
          <Icon name="star" size={15} color="#f5d878" />
          <span>{fragments.toLocaleString()}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto' }} onMouseDown={stopProp} onTouchStart={stopProp}>
          <button className="sd-btn" onClick={() => onOpenPanel('leaderboard')} aria-label="Ranks" style={iconButtonStyle}>
            <Icon name="trophy" size={18} />
          </button>
          <button className="sd-btn" onClick={() => onOpenPanel('settings')} aria-label="Settings" style={iconButtonStyle}>
            <Icon name="gear" size={18} />
          </button>
        </div>
      </div>

      {/* Elegant title — no background card, pure white text with soft shadow */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(80px + env(safe-area-inset-top, 0px))',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 18,
          pointerEvents: 'none',
          animation: 'sd-overlay-in 0.6s ease-out 0.1s both',
          zIndex: 4,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div
            style={{
              color: '#ffffff',
              fontSize: 44,
              fontWeight: 300,
              letterSpacing: '0.06em',
              textShadow: `0 2px 12px rgba(0, 0, 0, 0.45), 0 0 32px ${accent}40`,
            }}
          >
            STELLAR DRIFT
          </div>
          <div
            style={{
              color: 'rgba(255, 255, 255, 0.70)',
              fontSize: 13,
              fontStyle: 'italic',
              fontWeight: 400,
              letterSpacing: '0.04em',
              textShadow: textShadowSubtle,
            }}
          >
            A voyage through the solar system
          </div>
        </div>
        {/* BEST + LEVEL pills — 60% of original size, side-by-side, frosted */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { label: 'BEST', value: best || 0 },
            { label: 'LEVEL', value: levelReached },
          ].map((t) => (
            <div
              key={t.label}
              style={{
                width: 56,
                padding: '7px 6px',
                borderRadius: 14,
                background: tint,
                border: '1px solid rgba(255, 255, 255, 0.25)',
                backdropFilter: 'blur(24px) saturate(140%)',
                WebkitBackdropFilter: 'blur(24px) saturate(140%)',
                color: '#ffffff',
                textAlign: 'center',
                boxShadow: '0 6px 18px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
              }}
            >
              <div style={{
                fontSize: 9, letterSpacing: '0.10em', fontWeight: 600,
                color: 'rgba(255, 255, 255, 0.60)',
                textTransform: 'uppercase',
              }}>{t.label}</div>
              <div style={{
                fontSize: 16, fontWeight: 600, marginTop: 1,
                color: '#ffffff',
                textShadow: `0 0 12px ${accent}`,
              }}>{t.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom stack — PLAY + roster */}
      <div
        style={{
          position: 'absolute',
          bottom: 'calc(28px + env(safe-area-inset-bottom, 0px))',
          left: 0,
          right: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          zIndex: 5,
          animation: 'sd-overlay-in 0.6s ease-out 0.18s both',
        }}
        onTouchStart={stopProp}
        onMouseDown={stopProp}
      >
        {/* Large frosted PLAY capsule with planet-accent edge glow */}
        <button
          className="sd-btn sd-btn-primary"
          onClick={onPlay}
          aria-label="Play"
          style={{
            padding: '16px 64px',
            borderRadius: 32,
            border: `1px solid ${accent}66`,
            background: tint,
            backdropFilter: 'blur(24px) saturate(140%)',
            WebkitBackdropFilter: 'blur(24px) saturate(140%)',
            color: '#ffffff',
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: '0.10em',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            outline: 'none',
            textShadow: textShadowPrimary,
            boxShadow: `0 8px 40px rgba(0, 0, 0, 0.25), 0 0 24px ${accent}26, inset 0 1px 0 rgba(255, 255, 255, 0.3)`,
          }}
        >
          <Icon name="play" size={16} />
          PLAY
        </button>

        {/* Frosted roster — selected character gets a 2px accent ring */}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: '8px 10px',
            borderRadius: 22,
            background: tint,
            border: '1px solid rgba(255, 255, 255, 0.25)',
            backdropFilter: 'blur(24px) saturate(140%)',
            WebkitBackdropFilter: 'blur(24px) saturate(140%)',
            boxShadow: '0 8px 40px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
          }}
        >
          {ALIENS.map((a) => {
            const owned = ownedAliens.includes(a.id);
            const sel = a.id === selectedAlien;
            return (
              <button
                key={a.id}
                className="sd-btn"
                onClick={() => owned ? onSelectAlien(a.id) : onOpenPanel('aliens')}
                aria-label={a.name}
                style={{
                  position: 'relative',
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  background: sel ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.06)',
                  border: sel
                    ? `2px solid ${accent}`
                    : '1px solid rgba(255, 255, 255, 0.18)',
                  padding: 0,
                  cursor: 'pointer',
                  outline: 'none',
                  opacity: owned ? 1 : 0.65,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  boxShadow: sel ? `0 0 16px ${accent}66` : 'none',
                }}
              >
                <AlienSilhouette design={a.id} hat={sel ? selectedHat : 'none'} size={48} />
                {!owned && (
                  <div style={{ position: 'absolute', top: 3, right: 4 }}>
                    <Icon name="lock" size={9} color="#f5d878" />
                  </div>
                )}
              </button>
            );
          })}
          <button
            className="sd-btn"
            onClick={() => onOpenPanel('aliens')}
            aria-label="Customize"
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px dashed rgba(255, 255, 255, 0.30)',
              color: 'rgba(255, 255, 255, 0.75)',
              fontSize: 24,
              fontWeight: 300,
              cursor: 'pointer',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              textShadow: textShadowPrimary,
            }}
          >
            +
          </button>
        </div>
      </div>
    </>
  );
}

function DeathOverlay({ planet, onRetry, onShare, onLeaderboard, onMenu }) {
  const accent = planet?.accent || '#ffffff';
  const dark = planet ? needsDarkTint(planet) : false;
  const tint = dark ? FROSTED_TINT_DARK : FROSTED_TINT_LIGHT;

  const circleBtn = {
    width: 48, height: 48, borderRadius: 24,
    border: '1px solid rgba(255, 255, 255, 0.25)',
    background: tint,
    backdropFilter: 'blur(24px) saturate(140%)',
    WebkitBackdropFilter: 'blur(24px) saturate(140%)',
    color: '#ffffff', cursor: 'pointer', outline: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 8px 28px rgba(0, 0, 0, 0.30), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'calc(36px + env(safe-area-inset-bottom, 0px))',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
        zIndex: 5,
        animation: 'sd-overlay-in 0.45s ease-out 0.2s both',
        padding: '0 32px',
      }}
      onTouchStart={stopProp}
      onMouseDown={stopProp}
    >
      {/* TRY AGAIN — full-width frosted capsule with accent glow */}
      <button
        className="sd-btn"
        onClick={onRetry}
        style={{
          width: 'min(320px, 100%)',
          padding: '16px 48px',
          borderRadius: 32,
          border: `1px solid ${accent}66`,
          background: tint,
          backdropFilter: 'blur(24px) saturate(140%)',
          WebkitBackdropFilter: 'blur(24px) saturate(140%)',
          color: '#ffffff',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '0.10em',
          cursor: 'pointer',
          outline: 'none',
          textShadow: textShadowPrimary,
          boxShadow: `0 8px 40px rgba(0, 0, 0, 0.25), 0 0 24px ${accent}26, inset 0 1px 0 rgba(255, 255, 255, 0.3)`,
        }}
      >
        TRY AGAIN
      </button>
      {/* Three icon-only circular frosted buttons */}
      <div style={{ display: 'flex', gap: 14 }}>
        <button
          className="sd-btn"
          onClick={onMenu}
          aria-label="Back to menu"
          style={circleBtn}
        >
          <Icon name="home" size={20} />
        </button>
        <button
          className="sd-btn"
          onClick={onShare}
          aria-label="Share score"
          style={circleBtn}
        >
          <Icon name="share" size={20} />
        </button>
        <button
          className="sd-btn"
          onClick={onLeaderboard}
          aria-label="Open leaderboard"
          style={circleBtn}
        >
          <Icon name="trophy" size={20} />
        </button>
      </div>
    </div>
  );
}

function InitialsModal({ entry, initials, onChange, onSubmit, planet }) {
  const handleChange = (idx, ch) => {
    const arr = initials.padEnd(3, 'A').split('');
    const v = (ch || 'A').toUpperCase().replace(/[^A-Z]/g, '');
    arr[idx] = v || 'A';
    onChange(arr.join('').slice(0, 3));
  };
  const accent = planet?.accent || '#ffffff';
  return (
    <div style={overlayBackdropStyle} onTouchStart={stopProp} onMouseDown={stopProp}>
      <div
        style={{
          ...frostedCardStyle(planet),
          width: 'min(360px, calc(100% - 48px))',
          padding: '28px 24px',
          textAlign: 'center',
          animation: 'sd-panel-in 0.22s ease-out',
        }}
      >
        <div style={labelStyle}>NEW HIGH SCORE</div>
        <div style={{
          fontSize: 48, fontWeight: 200, margin: '8px 0 4px',
          color: '#ffffff', textShadow: `0 0 16px ${accent}`,
        }}>
          {entry.score}
        </div>
        <div style={{
          fontSize: 13, color: accent, marginBottom: 22,
          fontWeight: 600, textShadow: textShadowSubtle,
        }}>
          Reached {entry.planet}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 22 }}>
          {[0, 1, 2].map((i) => (
            <input
              key={i}
              type="text"
              maxLength={1}
              value={initials.charAt(i) || ''}
              onChange={(e) => handleChange(i, e.target.value)}
              style={{
                width: 56,
                height: 64,
                fontSize: 32,
                fontWeight: 600,
                textAlign: 'center',
                background: 'rgba(255, 255, 255, 0.10)',
                border: '1px solid rgba(255, 255, 255, 0.30)',
                borderRadius: 14,
                color: '#ffffff',
                outline: 'none',
                fontFamily: 'inherit',
                textShadow: textShadowPrimary,
              }}
            />
          ))}
        </div>
        <button
          className="sd-btn"
          onClick={onSubmit}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 22,
            border: `1px solid ${accent}66`,
            background: 'rgba(255, 255, 255, 0.18)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            color: '#ffffff',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: '0.10em',
            cursor: 'pointer',
            outline: 'none',
            textShadow: textShadowPrimary,
            boxShadow: `0 0 24px ${accent}26`,
          }}
        >
          SAVE
        </button>
      </div>
    </div>
  );
}

function PanelHeader({ title, onClose }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
      <div style={{
        fontSize: 18, fontWeight: 600, letterSpacing: 0.5,
        color: '#ffffff', textShadow: textShadowPrimary,
      }}>
        {title}
      </div>
      <button
        className="sd-btn"
        onClick={onClose}
        aria-label="Close"
        style={{
          width: 36, height: 36, borderRadius: 18,
          border: '1px solid rgba(255, 255, 255, 0.30)',
          background: 'rgba(255, 255, 255, 0.10)',
          color: '#ffffff', cursor: 'pointer', outline: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Icon name="close" size={18} />
      </button>
    </div>
  );
}

function AlienSilhouette({ design, hat, size = 64 }) {
  // Static SVG portrait of an alien for menu cards. Optional hat overlay.
  const HAT_ANCHORS = {
    blip:   { x: 32, y: 18, scale: 1.0 },
    pip:    { x: 32, y: 19, scale: 0.9 },
    goop:   { x: 32, y: 17, scale: 0.95 },
    wobble: { x: 32, y: 19, scale: 1.0 },
    glim:   { x: 32, y: 21, scale: 1.0 },
  };

  const renderHat = (hatId) => {
    if (!hatId || hatId === 'none') return null;
    const anchor = HAT_ANCHORS[design] || HAT_ANCHORS.blip;
    const t = `translate(${anchor.x} ${anchor.y}) scale(${anchor.scale})`;
    if (hatId === 'shades') {
      return (
        <g transform={t}>
          <circle cx={-4} cy={0} r={3} fill="#1a1a22" />
          <circle cx={4} cy={0} r={3} fill="#1a1a22" />
          <rect x={-1.5} y={-0.5} width={3} height={1} fill="#1a1a22" />
          <ellipse cx={-4.5} cy={-1} rx={1.2} ry={0.5} fill="rgba(255,255,255,0.35)" transform="rotate(-15 -4.5 -1)" />
          <ellipse cx={3.5} cy={-1} rx={1.2} ry={0.5} fill="rgba(255,255,255,0.35)" transform="rotate(-15 3.5 -1)" />
        </g>
      );
    }
    if (hatId === 'tophat') {
      return (
        <g transform={t}>
          <rect x={-6} y={-9} width={12} height={9} fill="#0a0a14" />
          <rect x={-8} y={-1} width={16} height={2} fill="#0a0a14" />
          <rect x={-6} y={-3} width={12} height={1.6} fill="#cc2a3a" />
        </g>
      );
    }
    if (hatId === 'propeller') {
      return (
        <g transform={t}>
          <path d="M-6 0 A 6 4 0 0 1 6 0 Z" fill="#3a6ad8" />
          <rect x={-6} y={0} width={12} height={1} fill="#2a4ba8" />
          <line x1={0} y1={-3} x2={0} y2={-6} stroke="#cccccc" strokeWidth="0.8" />
          <rect x={-5} y={-6.5} width={10} height={1} fill="#ffcc44" transform="rotate(25 0 -6)" />
          <circle cx={0} cy={-6} r={0.8} fill="#ffaa00" />
        </g>
      );
    }
    if (hatId === 'crown') {
      return (
        <g transform={t}>
          <polygon points="-7,0 -7,-3.5 -3.5,-7 0,-3.5 3.5,-7 7,-3.5 7,0" fill="#f5c84c" stroke="#a8801c" strokeWidth="0.8" />
          <circle cx={-3.5} cy={-5} r={1} fill="#ff4060" />
          <circle cx={0} cy={-2.5} r={1} fill="#4080ff" />
          <circle cx={3.5} cy={-5} r={1} fill="#40c060" />
        </g>
      );
    }
    return null;
  };

  let body;
  if (design === 'pip') {
    body = (
      <g>
        <defs>
          <radialGradient id="g-pip" cx="0.4" cy="0.35">
            <stop offset="0%" stopColor="#ffd8e8" />
            <stop offset="55%" stopColor="#ff8bbf" />
            <stop offset="100%" stopColor="#b04c80" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="30" r="22" fill="#ffb6d633" />
        <ellipse cx="20" cy="32" rx="4" ry="2" fill="#e07ab0" transform="rotate(20 20 32)" />
        <ellipse cx="44" cy="32" rx="4" ry="2" fill="#e07ab0" transform="rotate(-20 44 32)" />
        <circle cx="32" cy="30" r="11" fill="url(#g-pip)" />
        <ellipse cx="30" cy="34" rx="6" ry="2" fill="rgba(255,255,255,0.3)" />
        <circle cx="26" cy="28" r="2" fill="#ffffff" />
        <circle cx="32" cy="28" r="2" fill="#ffffff" />
        <circle cx="38" cy="28" r="2" fill="#ffffff" />
        <circle cx="26.4" cy="28" r="0.9" fill="#1a2030" />
        <circle cx="32.4" cy="28" r="0.9" fill="#1a2030" />
        <circle cx="38.4" cy="28" r="0.9" fill="#1a2030" />
        <path d="M28 34 Q32 37 36 34" stroke="#1a2030" strokeWidth="1" fill="none" strokeLinecap="round" />
      </g>
    );
  } else if (design === 'goop') {
    body = (
      <g>
        <defs>
          <radialGradient id="g-goop" cx="0.4" cy="0.3">
            <stop offset="0%" stopColor="#fff7b8" />
            <stop offset="55%" stopColor="#f5d040" />
            <stop offset="100%" stopColor="#a87a10" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="22" fill="#fff2a033" />
        <path d="M32 16 C39 17 43 24 43 33 C41 38 23 38 21 33 C21 24 25 17 32 16 Z" fill="url(#g-goop)" />
        <ellipse cx="28" cy="22" rx="3" ry="1.4" fill="rgba(255,255,255,0.45)" transform="rotate(-25 28 22)" />
        <circle cx="28" cy="28" r="1.6" fill="#1a2030" />
        <circle cx="36" cy="28" r="1.6" fill="#1a2030" />
        <circle cx="28.4" cy="27.4" r="0.5" fill="#ffffff" />
        <circle cx="36.4" cy="27.4" r="0.5" fill="#ffffff" />
        <ellipse cx="33" cy="36" rx="2.5" ry="1.6" fill="#ff6a8a" />
        <circle cx="31" cy="44" r="1.6" fill="#f5d040cc" />
      </g>
    );
  } else if (design === 'wobble') {
    body = (
      <g>
        <defs>
          <radialGradient id="g-wob" cx="0.4" cy="0.35">
            <stop offset="0%" stopColor="#ffd0a0" />
            <stop offset="55%" stopColor="#ff8c44" />
            <stop offset="100%" stopColor="#a44818" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="30" r="22" fill="#ffc08033" />
        <line x1="28" y1="38" x2="27" y2="44" stroke="#a85428" strokeWidth="3" strokeLinecap="round" />
        <line x1="36" y1="38" x2="37" y2="44" stroke="#a85428" strokeWidth="3" strokeLinecap="round" />
        <ellipse cx="32" cy="30" rx="9" ry="10" fill="url(#g-wob)" />
        <ellipse cx="31" cy="34" rx="4" ry="1.8" fill="rgba(255,255,255,0.3)" />
        <circle cx="29" cy="28" r="2.4" fill="#ffffff" />
        <circle cx="35" cy="28" r="2.4" fill="#ffffff" />
        <circle cx="29.5" cy="28" r="1.2" fill="#1a2030" />
        <circle cx="35.5" cy="28" r="1.2" fill="#1a2030" />
        <path d="M28 34 Q32 36 36 34" stroke="#1a2030" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>
    );
  } else if (design === 'glim') {
    body = (
      <g>
        <defs>
          <radialGradient id="g-glim" cx="0.4" cy="0.3">
            <stop offset="0%" stopColor="#f0d8ffdd" />
            <stop offset="55%" stopColor="#b878e0bb" />
            <stop offset="100%" stopColor="#6838988a" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="32" r="22" fill="#d4a8ff33" />
        <path d="M27 34 Q26 38 28 42 Q26 46 28 48" stroke="#9858ce99" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M31 35 Q30 39 32 43 Q30 47 32 49" stroke="#9858ce99" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M35 35 Q36 39 34 43 Q36 47 34 49" stroke="#9858ce99" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M39 34 Q40 38 38 42 Q40 46 38 48" stroke="#9858ce99" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <path d="M22 34 Q22 22 32 22 Q42 22 42 34 Z" fill="url(#g-glim)" />
        <ellipse cx="32" cy="34" rx="10" ry="2" fill="#9858cebb" />
        <ellipse cx="28" cy="27" rx="2.5" ry="1" fill="rgba(255,255,255,0.5)" transform="rotate(-25 28 27)" />
        <circle cx="33" cy="30" r="3" fill="#ffffff" />
        <circle cx="33.5" cy="30" r="1.5" fill="#3a1855" />
      </g>
    );
  } else {
    // 'blip' (default)
    body = (
      <g>
        <defs>
          <radialGradient id="g-blip" cx="0.4" cy="0.35">
            <stop offset="0%" stopColor="#c5f5b0" />
            <stop offset="55%" stopColor="#6dcc54" />
            <stop offset="100%" stopColor="#2c7a36" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="30" r="22" fill="#8effa033" />
        <line x1="28" y1="22" x2="26" y2="14" stroke="#3c8444" strokeWidth="1.6" />
        <line x1="36" y1="22" x2="38" y2="14" stroke="#3c8444" strokeWidth="1.6" />
        <circle cx="26" cy="14" r="1.6" fill="#ffe480" />
        <circle cx="38" cy="14" r="1.6" fill="#ffe480" />
        <line x1="23" y1="32" x2="18" y2="36" stroke="#3c8444" strokeWidth="2.2" strokeLinecap="round" />
        <line x1="41" y1="32" x2="46" y2="36" stroke="#3c8444" strokeWidth="2.2" strokeLinecap="round" />
        <ellipse cx="32" cy="30" rx="11" ry="9.5" fill="url(#g-blip)" />
        <ellipse cx="31" cy="33" rx="6" ry="2.2" fill="rgba(255,255,255,0.25)" />
        <ellipse cx="35" cy="28" rx="4.5" ry="4.5" fill="#ffffff" />
        <circle cx="36" cy="28" r="2" fill="#1a2030" />
        <circle cx="36.7" cy="27.3" r="0.7" fill="#ffffff" />
        <path d="M30 35 Q34 38 38 35" stroke="#1a2030" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      </g>
    );
  }

  return (
    <svg viewBox="0 0 64 56" width={size} height={size * 0.88}>
      {body}
      {renderHat(hat)}
    </svg>
  );
}

function AliensPanel({ fragments, ownedAliens, ownedHats, selectedAlien, selectedHat, planet, onSelectAlien, onSelectHat, onUnlockAlien, onUnlockHat, onClose }) {
  const accent = planet?.accent || '#ffffff';
  // Pad the hat grid with 3 "Coming soon" placeholder slots so the Crown row
  // doesn't sit alone at the bottom (currently 5 hats → 1 orphan on the
  // wrapped second row). Styled like the Settings "Coming soon" cue.
  const PLACEHOLDER_HATS = 3;
  return (
    <div style={overlayBackdropStyle} onTouchStart={stopProp} onMouseDown={stopProp} onClick={onClose}>
      <div
        onClick={stopProp}
        style={{
          ...frostedCardStyle(planet),
          width: 'min(440px, calc(100% - 32px))',
          maxHeight: 'calc(100% - 64px)',
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sd-panel-in 0.22s ease-out',
        }}
      >
        <PanelHeader title="Aliens" onClose={onClose} />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, marginBottom: 14,
          color: 'rgba(255, 255, 255, 0.75)', textShadow: textShadowSubtle,
        }}>
          <Icon name="star" size={14} color="#f5d878" />
          <span>{fragments.toLocaleString()} fragments</span>
        </div>
        {/* 24px top padding on the scrollable area to prevent the first row
            from being visually clipped by the panel header's edge. */}
        <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4, paddingTop: 24 }}>
          {/* Aliens */}
          <div style={{ ...labelStyle, marginBottom: 10 }}>CHARACTER</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
            {ALIENS.map((a) => {
              const owned = ownedAliens.includes(a.id);
              const sel = a.id === selectedAlien;
              const canAfford = fragments >= a.cost;
              return (
                <button
                  key={a.id}
                  className="sd-btn"
                  onClick={() => owned ? onSelectAlien(a.id) : (canAfford ? onUnlockAlien(a.id) : null)}
                  disabled={!owned && !canAfford}
                  style={{
                    ...frostedSubCardStyle(planet, sel, accent),
                    padding: '14px 12px',
                    cursor: (owned || canAfford) ? 'pointer' : 'not-allowed',
                    outline: 'none',
                    textAlign: 'left',
                    opacity: (!owned && !canAfford) ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
                    <AlienSilhouette design={a.id} hat={sel ? selectedHat : 'none'} size={88} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: '#ffffff',
                      textShadow: textShadowPrimary,
                    }}>{a.name}</div>
                    {owned
                      ? (sel
                        ? <span style={{ color: accent, textShadow: `0 0 8px ${accent}` }}><Icon name="check" size={16} color={accent} /></span>
                        : <span style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.60)' }}>Owned</span>)
                      : <span style={{
                          fontSize: 12, fontWeight: 600, display: 'flex',
                          alignItems: 'center', gap: 4,
                          color: '#ffffff', textShadow: textShadowSubtle,
                          opacity: canAfford ? 1 : 0.65,
                        }}>
                          <Icon name="star" size={12} color="#f5d878" />
                          {a.cost}
                        </span>}
                  </div>
                  <div style={{
                    fontSize: 11, marginTop: 4,
                    color: 'rgba(255, 255, 255, 0.60)',
                  }}>{a.blurb}</div>
                </button>
              );
            })}
          </div>

          {/* Hats — divider line + 32px top margin separate the section visually */}
          <div style={{
            height: 1, background: 'rgba(255, 255, 255, 0.18)',
            margin: '32px 0 16px',
          }} />
          <div style={{ ...labelStyle, marginBottom: 10 }}>HAT</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 8 }}>
            {HATS.map((h) => {
              const owned = ownedHats.includes(h.id);
              const sel = h.id === selectedHat;
              const canAfford = fragments >= h.cost;
              return (
                <button
                  key={h.id}
                  className="sd-btn"
                  onClick={() => owned ? onSelectHat(h.id) : (canAfford ? onUnlockHat(h.id) : null)}
                  disabled={!owned && !canAfford}
                  style={{
                    ...frostedSubCardStyle(planet, sel, accent),
                    width: 72,
                    borderRadius: 14,
                    padding: '8px 6px',
                    cursor: (owned || canAfford) ? 'pointer' : 'not-allowed',
                    outline: 'none',
                    opacity: (!owned && !canAfford) ? 0.5 : 1,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
                    <AlienSilhouette design={selectedAlien} hat={h.id} size={56} />
                  </div>
                  <div style={{
                    fontSize: 10, fontWeight: 600, textAlign: 'center',
                    color: '#ffffff', textShadow: textShadowSubtle,
                  }}>{h.name}</div>
                  <div style={{
                    fontSize: 9, textAlign: 'center', marginTop: 2,
                    color: sel && owned ? accent : 'rgba(255, 255, 255, 0.60)',
                  }}>
                    {owned
                      ? (sel ? '✓ selected' : 'owned')
                      : `★ ${h.cost}`}
                  </div>
                </button>
              );
            })}
            {/* Placeholder "Coming soon" slots pad the Crown row */}
            {Array.from({ length: PLACEHOLDER_HATS }).map((_, i) => (
              <div
                key={`placeholder-${i}`}
                style={{
                  ...frostedSubCardStyle(planet, false, accent),
                  width: 72,
                  height: 92,
                  borderRadius: 14,
                  padding: '8px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px dashed rgba(255, 255, 255, 0.20)',
                  background: 'rgba(255, 255, 255, 0.04)',
                  opacity: 0.7,
                }}
              >
                <div style={{
                  fontSize: 18, color: 'rgba(255, 255, 255, 0.40)', marginBottom: 4,
                }}>+</div>
                <div style={{
                  fontSize: 9, fontWeight: 600, textAlign: 'center',
                  color: 'rgba(255, 255, 255, 0.55)',
                  letterSpacing: '0.04em',
                }}>Coming soon</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function LeaderboardPanel({ entries, highlightId, planet, onShare, onClose }) {
  const accent = planet?.accent || '#ffffff';
  // Planet accent at ~12% opacity (1E hex ≈ 30/255 = 12%) for the player row.
  const playerRowBg = `${accent}1F`;
  return (
    <div style={overlayBackdropStyle} onTouchStart={stopProp} onMouseDown={stopProp} onClick={onClose}>
      <div
        onClick={stopProp}
        style={{
          ...frostedCardStyle(planet),
          width: 'min(420px, calc(100% - 32px))',
          maxHeight: 'calc(100% - 64px)',
          padding: '20px 22px',
          display: 'flex',
          flexDirection: 'column',
          animation: 'sd-panel-in 0.22s ease-out',
        }}
      >
        <PanelHeader title="Leaderboard" onClose={onClose} />
        {entries.length === 0 ? (
          <div style={{
            fontSize: 13, padding: '40px 0', textAlign: 'center',
            color: 'rgba(255, 255, 255, 0.75)', textShadow: textShadowSubtle,
            fontStyle: 'italic',
          }}>
            No runs yet — fly far to claim the top spot.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {entries.map((e, i) => {
              const isPlayer = e.id === highlightId;
              return (
                <div
                  key={e.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '32px 64px 1fr auto',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
                    fontSize: 13,
                    background: isPlayer ? playerRowBg : 'transparent',
                    borderRadius: isPlayer ? 12 : 0,
                    border: isPlayer ? `1px solid ${accent}40` : '1px solid transparent',
                    borderBottomColor: isPlayer ? `${accent}40` : 'rgba(255, 255, 255, 0.10)',
                    boxShadow: isPlayer ? `0 0 16px ${accent}22` : 'none',
                  }}
                >
                  <div style={{
                    color: 'rgba(255, 255, 255, 0.60)', fontWeight: 600,
                    textShadow: textShadowSubtle,
                  }}>{i + 1}</div>
                  <div style={{
                    fontWeight: 600, fontSize: 15, letterSpacing: '0.08em',
                    color: '#ffffff', textShadow: textShadowPrimary,
                  }}>{e.initials}</div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{
                      fontSize: 11,
                      color: 'rgba(255, 255, 255, 0.60)',
                    }}>{e.planet} · {e.date}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      fontWeight: 600, fontSize: 16,
                      color: '#ffffff',
                      textShadow: isPlayer ? `0 0 12px ${accent}` : textShadowPrimary,
                    }}>{e.score}</div>
                    <button
                      className="sd-btn"
                      onClick={() => onShare(e.score, e.planet)}
                      aria-label="Share entry"
                      style={{
                        width: 28, height: 28, borderRadius: 14,
                        border: '1px solid rgba(255, 255, 255, 0.25)',
                        background: 'rgba(255, 255, 255, 0.10)',
                        color: '#ffffff', cursor: 'pointer', outline: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <Icon name="share" size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange, sub, accent }) {
  return (
    <button
      className="sd-btn"
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '14px 16px', borderRadius: 16,
        background: 'rgba(255, 255, 255, 0.08)',
        border: '1px solid rgba(255, 255, 255, 0.18)',
        color: '#ffffff', cursor: 'pointer', outline: 'none',
        marginBottom: 8, fontFamily: 'inherit',
      }}
    >
      <div style={{ textAlign: 'left' }}>
        <div style={{
          fontSize: 14, fontWeight: 600, color: '#ffffff',
          textShadow: textShadowPrimary,
        }}>{label}</div>
        {sub && <div style={{
          fontSize: 11, marginTop: 2,
          color: 'rgba(255, 255, 255, 0.60)',
        }}>{sub}</div>}
      </div>
      <div
        style={{
          width: 44, height: 26, borderRadius: 13,
          background: value ? `${accent || '#a8e8c8'}A6` : 'rgba(255, 255, 255, 0.15)',
          position: 'relative', transition: 'background 0.18s ease',
          boxShadow: value ? `0 0 12px ${accent || '#a8e8c8'}66` : 'none',
        }}
      >
        <div style={{
          position: 'absolute', top: 3, left: value ? 21 : 3,
          width: 20, height: 20, borderRadius: 10,
          background: '#ffffff', transition: 'left 0.18s ease',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
        }} />
      </div>
    </button>
  );
}

function SettingsPanel({ muted, vibration, colorBlind, planet, onMutedChange, onVibrationChange, onColorBlindChange, onClose }) {
  const accent = planet?.accent || '#a8e8c8';
  return (
    <div style={overlayBackdropStyle} onTouchStart={stopProp} onMouseDown={stopProp} onClick={onClose}>
      <div
        onClick={stopProp}
        style={{
          ...frostedCardStyle(planet),
          width: 'min(360px, calc(100% - 32px))',
          padding: '20px 22px',
          animation: 'sd-panel-in 0.22s ease-out',
        }}
      >
        <PanelHeader title="Settings" onClose={onClose} />
        <ToggleRow
          label="Sound"
          sub="Music and effects"
          value={!muted}
          accent={accent}
          onChange={(v) => onMutedChange(!v)}
        />
        <ToggleRow
          label="Vibration"
          sub="Haptic feedback on death (mobile)"
          value={vibration}
          accent={accent}
          onChange={onVibrationChange}
        />
        <ToggleRow
          label="Color blind mode"
          sub="Coming soon"
          value={colorBlind}
          accent={accent}
          onChange={onColorBlindChange}
        />
        <div style={{
          fontSize: 11, textAlign: 'center', marginTop: 14,
          color: 'rgba(255, 255, 255, 0.45)',
        }}>
          Stellar Drift · v0.3
        </div>
      </div>
    </div>
  );
}

// Helper drawn outside the component closure but used inside via reference
function roundRect(ctx, x, y, w, h, r) {
  if (w < 2 * r) r = w / 2;
  if (h < 2 * r) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ═══════════════════════════════════════════════════════════════
// HOW TO LAUNCH STELLAR DRIFT
// ═══════════════════════════════════════════════════════════════
//
// 1. PLAY INSTANTLY IN BROWSER
//    Paste this file into claude.ai as a React artifact.
//    Tap or press Space to play. No setup required.
//
// 2. RUN ON YOUR PHONE WITH EXPO GO (free, 5 minutes)
//    a. Install Node.js from nodejs.org
//    b. Run: npx create-expo-app StellarDrift --template blank
//    c. Replace the contents of App.js with this file
//    d. Run: npx expo start
//    e. Scan the QR code with the Expo Go app (iOS / Android)
//    f. The game loads instantly on your phone
//
// 3. BUILD FOR IOS APP STORE
//    a. Apple Developer account required — $99/year at developer.apple.com
//    b. Run: npm install -g eas-cli
//    c. Run: eas build --platform ios
//    d. Run: eas submit --platform ios
//    e. Apple review typically takes 1–3 business days
//
// 4. BUILD FOR GOOGLE PLAY
//    a. Google Play Developer account — $25 one-time at play.google.com/console
//    b. Run: eas build --platform android
//    c. Run: eas submit --platform android
//    d. Google review typically takes 1–7 business days
//
// 5. ADD MONETIZATION
//    a. AdMob (ads): npx expo install react-native-google-mobile-ads
//       Wire the onContinueRequested() and onMilestoneReached() hooks
//    b. RevenueCat (IAP): npx expo install react-native-purchases
//       Wire the onShipSkinUnlocked() hook for cosmetic purchases
//    c. iOS requires ATT prompt for ad tracking — add expo-tracking-transparency
//
// 6. PERSIST SCORES ON MOBILE
//    Replace localStorage with:
//    npx expo install @react-native-async-storage/async-storage
//    import AsyncStorage from '@react-native-async-storage/async-storage'
//
// 7. MARKETING TIPS TO GO VIRAL
//    a. Record a 15-second gameplay clip showing levels 1→5 transition
//    b. Post to TikTok and Instagram Reels with text overlay "I made this game"
//    c. Submit to r/indiegaming and r/WebGames on Reddit on a Tuesday morning
//    d. The Monument Valley-inspired visuals are extremely shareable — lean into it
//    e. Add the game to itch.io for free (instant web audience)
//
// ═══════════════════════════════════════════════════════════════
