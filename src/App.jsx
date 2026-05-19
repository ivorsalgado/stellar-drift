import React, { useRef, useEffect, useState, useCallback } from 'react';

// ═══════════════════════════════════════════════════════════════
// STELLAR DRIFT — A voyage through the solar system
// ═══════════════════════════════════════════════════════════════

const PLANETS = [
  {
    name: 'MERCURY',
    tagline: 'The scorched world remembers the sun',
    sky: ['#3a2618', '#5a3520', '#8a4a2a'],
    accent: '#ffb46b',
    columnFront: '#2a1f1c',
    columnSide: '#1a1310',
    columnEdge: '#ffc88a',
    fog: 'rgba(255, 140, 60, 0.08)',
  },
  {
    name: 'VENUS',
    tagline: 'Beneath veils of gold, a hidden world',
    sky: ['#5a3a1a', '#9a6a2a', '#d4a04a'],
    accent: '#ffe49a',
    columnFront: '#9a6a35',
    columnSide: '#6a4520',
    columnEdge: '#fff0bc',
    fog: 'rgba(255, 210, 130, 0.12)',
  },
  {
    name: 'EARTH',
    tagline: 'A pale blue dot, our fragile home',
    sky: ['#0a1830', '#1a3a5a', '#3a7090'],
    accent: '#8ad8ff',
    columnFront: '#2a5a8a',
    columnSide: '#15355a',
    columnEdge: '#c8ecff',
    fog: 'rgba(140, 200, 240, 0.06)',
  },
  {
    name: 'MARS',
    tagline: 'Rust-red dust and silent canyons',
    sky: ['#3a1a14', '#7a3520', '#b85a3a'],
    accent: '#ff9a78',
    columnFront: '#8a3520',
    columnSide: '#5a2010',
    columnEdge: '#ffb898',
    fog: 'rgba(255, 140, 100, 0.10)',
  },
  {
    name: 'JUPITER',
    tagline: 'A great red eye watches the storm',
    sky: ['#5a3a1a', '#8a5a2a', '#c89868'],
    accent: '#ffd49a',
    columnFront: '#a07040',
    columnSide: '#6a4525',
    columnEdge: '#ffe8b8',
    fog: 'rgba(255, 200, 140, 0.10)',
  },
  {
    name: 'SATURN',
    tagline: 'Crowned by rings of ancient ice',
    sky: ['#1a1a3a', '#2a2a5a', '#4a4a8a'],
    accent: '#ffd478',
    columnFront: '#a08850',
    columnSide: '#6a5530',
    columnEdge: '#ffe8a8',
    fog: 'rgba(200, 180, 130, 0.06)',
  },
  {
    name: 'URANUS',
    tagline: 'The tilted giant rolls through silence',
    sky: ['#1a4a4a', '#3a7a7a', '#6ab0b0'],
    accent: '#b8f0e8',
    columnFront: '#6aa8a0',
    columnSide: '#3a6868',
    columnEdge: '#d8fff8',
    fog: 'rgba(180, 240, 232, 0.10)',
  },
  {
    name: 'NEPTUNE',
    tagline: 'Cobalt depths where methane winds scream',
    sky: ['#0a1450', '#1a2880', '#2a48a8'],
    accent: '#6ab0ff',
    columnFront: '#1a3880',
    columnSide: '#0a1c50',
    columnEdge: '#a0d4ff',
    fog: 'rgba(80, 140, 240, 0.10)',
  },
  {
    name: 'THE SUN',
    tagline: 'Inside the heart of fire itself',
    sky: ['#fff0c0', '#ffb850', '#ff7020'],
    accent: '#fff5d8',
    columnFront: '#fff0b8',
    columnSide: '#d8a040',
    columnEdge: '#ffffff',
    fog: 'rgba(255, 230, 160, 0.18)',
  },
  {
    name: 'THE VOID',
    tagline: 'Beyond everything, only quiet light',
    sky: ['#000000', '#050010', '#0a0518'],
    accent: '#c890ff',
    columnFront: '#080510',
    columnSide: '#000000',
    columnEdge: '#b078ff',
    fog: 'rgba(140, 80, 200, 0.06)',
  },
];

const PHYSICS = {
  gravity: 0.40,
  thrust: -8.5,
  baseSpeed: 3.2,
  speedPerObstacle: 0.08,
  startGap: 175,
  gapShrinkPerPlanet: 8,
  minGap: 120,
  startSpawnInterval: 95,
  spawnShrinkPerPlanet: 4,
  minSpawnInterval: 55,
  shipX: 0.28,
  shipRadius: 16,
  columnWidth: 70,
};

export default function StellarDrift() {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const offscreenRef = useRef(null);
  const audioRef = useRef(null);
  const gsRef = useRef(null);
  const rafRef = useRef(null);
  const [, forceUpdate] = useState(0);
  const [muted, setMuted] = useState(false);
  const mutedRef = useRef(false);

  useEffect(() => { mutedRef.current = muted; }, [muted]);

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
      const baseFreq = 700 + Math.min(combo - 1, 12) * 60;
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

    const bpm = 105;
    const beatDur = 60 / bpm;
    const stepDur = beatDur / 2; // 8th notes
    const pentatonic = [0, 2, 4, 7, 9];
    const baseNote = 220; // A3

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

    const schedulePad = (when, freq, dur) => {
      try {
        const o1 = a.ctx.createOscillator();
        const o2 = a.ctx.createOscillator();
        o1.type = 'triangle';
        o2.type = 'triangle';
        o1.frequency.setValueAtTime(freq, when);
        o2.frequency.setValueAtTime(freq * 1.005, when); // slight detune
        const lfo = a.ctx.createOscillator();
        lfo.frequency.setValueAtTime(0.3, when);
        const lfoGain = a.ctx.createGain();
        lfoGain.gain.value = 1.5;
        lfo.connect(lfoGain).connect(o2.frequency);
        const g = a.ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.05, when + 0.4);
        g.gain.linearRampToValueAtTime(0.04, when + dur - 0.5);
        g.gain.exponentialRampToValueAtTime(0.001, when + dur);
        o1.connect(g); o2.connect(g);
        g.connect(a.musicBus);
        o1.start(when); o2.start(when); lfo.start(when);
        o1.stop(when + dur + 0.05); o2.stop(when + dur + 0.05); lfo.stop(when + dur + 0.05);
      } catch {}
    };

    const scheduleKick = (when) => {
      try {
        const o = a.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(110, when);
        o.frequency.exponentialRampToValueAtTime(40, when + 0.12);
        const g = a.ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.22, when + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, when + 0.18);
        o.connect(g); g.connect(a.musicBus);
        o.start(when); o.stop(when + 0.2);
      } catch {}
    };

    const scheduleHat = (when) => {
      try {
        const bufSize = a.ctx.sampleRate * 0.05;
        const buf = a.ctx.createBuffer(1, bufSize, a.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < bufSize; i++) d[i] = (Math.random() * 2 - 1);
        const src = a.ctx.createBufferSource();
        src.buffer = buf;
        const hp = a.ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 7000;
        const g = a.ctx.createGain();
        g.gain.setValueAtTime(0.04, when);
        g.gain.exponentialRampToValueAtTime(0.001, when + 0.04);
        src.connect(hp).connect(g).connect(a.musicBus);
        src.start(when); src.stop(when + 0.05);
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

        // Bass on every other beat (quarter notes 0, 2, 4, 6 ...)
        if (step % 4 === 0) {
          const chordRoot = [0, -2, -4, -2][(Math.floor(step / 16)) % 4];
          scheduleNote(t, baseNote * Math.pow(2, chordRoot / 12) * 0.5, 0.7, 'sine', 0.12);
        }

        // Pad chords every 4 beats (every 8 steps)
        if (layer >= 1 && step % 8 === 0) {
          const chordRoot = [0, -2, -4, -2][(Math.floor(step / 32)) % 4];
          const f = baseNote * Math.pow(2, chordRoot / 12);
          schedulePad(t, f, beatDur * 4);
          schedulePad(t, f * 1.25, beatDur * 4);
          schedulePad(t, f * 1.5, beatDur * 4);
        }

        // Kick on beats 1 and 3 (steps 0, 4 of each measure)
        if (layer >= 1 && (step % 8 === 0 || step % 8 === 4)) {
          scheduleKick(t);
        }

        // Hi-hat on 8ths
        if (layer >= 2 && step % 2 === 1) {
          scheduleHat(t);
        }

        // Melodic lead on layer 2
        if (layer >= 2 && step % 2 === 0) {
          if (Math.random() < 0.4) {
            const note = pentatonic[Math.floor(Math.random() * pentatonic.length)];
            const octave = 1 + Math.floor(Math.random() * 2);
            const f = baseNote * Math.pow(2, (note + octave * 12) / 12);
            scheduleNote(t, f, 0.4, 'triangle', 0.07);
          }
        }

        a.musicState.lookahead += stepDur;
        a.musicState.beatStep = (step + 1) % 64;
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
  const makeStars = useCallback((w, h, count) => {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h * 0.85,
        r: Math.random() * 1.4 + 0.3,
        a: Math.random() * 0.6 + 0.2,
        tw: Math.random() * Math.PI * 2,
      });
    }
    return stars;
  }, []);

  const makeDust = useCallback((w, h, count) => {
    const dust = [];
    for (let i = 0; i < count; i++) {
      dust.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: -(Math.random() * 0.5 + 0.2),
        vy: (Math.random() - 0.5) * 0.1,
        r: Math.random() * 1.8 + 0.5,
        a: Math.random() * 0.35 + 0.1,
      });
    }
    return dust;
  }, []);

  const initGameState = useCallback((w, h) => {
    const best = parseInt(localStorage.getItem('stellardrift_best') || '0', 10);
    return {
      w, h,
      state: 'start', // 'start' | 'playing' | 'dead'
      ship: {
        x: w * PHYSICS.shipX,
        y: h * 0.5,
        vy: 0,
        tilt: 0,
        idleT: 0,
        trail: [],
      },
      columns: [],
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
      spawnInterval: PHYSICS.startSpawnInterval,
      gap: PHYSICS.startGap,
      stars: makeStars(w, h, 60),
      dust: makeDust(w, h, 30),
      shake: 0,
      flash: 0,
      transitionCard: 0, // counts down frames showing the card
      transitionCardPlanet: 0,
      deathOverlay: 0,
      time: 0,
      lastFlapFrame: -10,
      hasInteracted: false,
    };
  }, [makeStars, makeDust]);

  // ─────────────────────────────────────────────────────────────
  // DRAW HELPERS
  // ─────────────────────────────────────────────────────────────
  const drawBackground = useCallback((ctx, w, h, planet, t) => {
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
      // Hot haze shimmer near horizon
      ctx.save();
      for (let i = 0; i < 3; i++) {
        const y = h * (0.75 + i * 0.04);
        const grad = ctx.createLinearGradient(0, y, 0, y + 30);
        grad.addColorStop(0, 'rgba(255, 180, 100, 0)');
        grad.addColorStop(0.5, `rgba(255, 180, 100, ${0.08 + Math.sin(t * 0.04 + i) * 0.03})`);
        grad.addColorStop(1, 'rgba(255, 180, 100, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y, w, 30);
      }
      ctx.restore();
      // Cracked rocky horizon
      ctx.save();
      ctx.fillStyle = '#1a0e08';
      ctx.beginPath();
      ctx.moveTo(0, h);
      const segs = 14;
      for (let i = 0; i <= segs; i++) {
        const x = (i / segs) * w;
        const baseY = h * 0.88;
        const v = Math.sin(i * 1.7) * 12 + Math.sin(i * 3.4) * 6;
        ctx.lineTo(x, baseY + v);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
      // Crack highlights
      ctx.strokeStyle = 'rgba(255, 140, 60, 0.3)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        const sx = (i + 0.5) * w / 5;
        ctx.moveTo(sx, h * 0.9);
        ctx.lineTo(sx + 20, h);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (name === 'VENUS') {
      // Horizontal cloud bands
      ctx.save();
      for (let i = 0; i < 7; i++) {
        const y = (i / 7) * h + (t * 0.3 + i * 30) % (h / 7);
        const grad = ctx.createLinearGradient(0, y - 20, 0, y + 20);
        grad.addColorStop(0, 'rgba(255, 220, 140, 0)');
        grad.addColorStop(0.5, `rgba(255, 220, 140, ${0.13 + (i % 2) * 0.05})`);
        grad.addColorStop(1, 'rgba(255, 220, 140, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, y - 20, w, 40);
      }
      // Hazy glow overlay
      const glow = ctx.createRadialGradient(w * 0.5, h * 0.4, 0, w * 0.5, h * 0.4, w * 0.7);
      glow.addColorStop(0, 'rgba(255, 230, 160, 0.20)');
      glow.addColorStop(1, 'rgba(255, 230, 160, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    if (name === 'EARTH') {
      // The big Earth in the background (upper-right)
      ctx.save();
      const ex = w * 0.78, ey = h * 0.32, er = Math.min(w, h) * 0.18;
      // Halo
      const halo = ctx.createRadialGradient(ex, ey, er * 0.95, ex, ey, er * 1.5);
      halo.addColorStop(0, 'rgba(140, 200, 255, 0.35)');
      halo.addColorStop(1, 'rgba(140, 200, 255, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(ex, ey, er * 1.5, 0, Math.PI * 2); ctx.fill();
      // Earth body
      const earthGrad = ctx.createRadialGradient(ex - er * 0.3, ey - er * 0.3, 0, ex, ey, er);
      earthGrad.addColorStop(0, '#5ab4ff');
      earthGrad.addColorStop(0.7, '#1e5a9a');
      earthGrad.addColorStop(1, '#0a2848');
      ctx.fillStyle = earthGrad;
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
      // Continents (animated drift)
      ctx.save();
      ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = '#3a8a4a';
      const drift = (t * 0.2) % (er * 2);
      for (let i = 0; i < 4; i++) {
        const cx = ex - er + ((i * er * 0.7 + drift) % (er * 2));
        const cy = ey + Math.sin(i * 1.7) * er * 0.4;
        ctx.beginPath();
        ctx.ellipse(cx, cy, er * 0.25, er * 0.18, i, 0, Math.PI * 2);
        ctx.fill();
      }
      // Clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      for (let i = 0; i < 5; i++) {
        const cx = ex - er + ((i * er * 0.5 + drift * 1.4 + 50) % (er * 2));
        const cy = ey - er * 0.5 + Math.sin(i * 2.1 + t * 0.01) * er * 0.6;
        ctx.beginPath();
        ctx.ellipse(cx, cy, er * 0.3, er * 0.1, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      // Cloud wisps across the sky
      ctx.fillStyle = 'rgba(220, 235, 250, 0.18)';
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 250 - t * 0.3) % (w + 200)) - 100;
        const cy = h * (0.15 + i * 0.12);
        ctx.beginPath();
        ctx.ellipse(cx, cy, 80, 14, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    if (name === 'MARS') {
      // Horizon haze
      ctx.save();
      const haze = ctx.createLinearGradient(0, h * 0.6, 0, h);
      haze.addColorStop(0, 'rgba(255, 160, 130, 0)');
      haze.addColorStop(1, 'rgba(255, 170, 140, 0.25)');
      ctx.fillStyle = haze;
      ctx.fillRect(0, h * 0.6, w, h * 0.4);
      // Polar ice cap (small in the upper-right)
      const px = w * 0.82, py = h * 0.22, pr = Math.min(w, h) * 0.12;
      const halo = ctx.createRadialGradient(px, py, pr * 0.85, px, py, pr * 1.4);
      halo.addColorStop(0, 'rgba(255, 240, 230, 0.3)');
      halo.addColorStop(1, 'rgba(255, 240, 230, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(px, py, pr * 1.4, 0, Math.PI * 2); ctx.fill();
      const grad = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, 0, px, py, pr);
      grad.addColorStop(0, '#d87055');
      grad.addColorStop(1, '#6a2818');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(px, py, pr, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255, 245, 235, 0.85)';
      ctx.beginPath();
      ctx.ellipse(px, py - pr * 0.7, pr * 0.55, pr * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
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
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 18; i++) {
        const y = (i / 18) * h + Math.sin(t * 0.02 + i) * 4;
        const xOff = (t * 0.6 + i * 60) % (w + 100) - 100;
        ctx.beginPath();
        ctx.moveTo(xOff, y);
        ctx.lineTo(xOff + 70, y + Math.sin(i) * 3);
        ctx.stroke();
      }
      // Great Red Spot
      const rx = w * 0.72, ry = h * 0.50;
      const pulse = 0.85 + Math.sin(t * 0.025) * 0.15;
      ctx.save();
      ctx.translate(rx, ry);
      ctx.scale(1, 0.55);
      const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 70 * pulse);
      sg.addColorStop(0, 'rgba(220, 80, 50, 0.85)');
      sg.addColorStop(0.7, 'rgba(160, 50, 30, 0.5)');
      sg.addColorStop(1, 'rgba(120, 40, 20, 0)');
      ctx.fillStyle = sg;
      ctx.beginPath(); ctx.arc(0, 0, 70 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    if (name === 'SATURN') {
      // Saturn upper-right with rings
      ctx.save();
      const sx = w * 0.78, sy = h * 0.30;
      const sr = Math.min(w, h) * 0.16;
      // Rings back half (behind planet)
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-0.3);
      ctx.scale(1, 0.22);
      ctx.beginPath(); ctx.arc(0, 0, sr * 2.0, Math.PI, Math.PI * 2);
      ctx.strokeStyle = 'rgba(220, 180, 120, 0.7)'; ctx.lineWidth = 8; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, sr * 1.7, Math.PI, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 230, 160, 0.5)'; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, sr * 1.45, Math.PI, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 220, 150, 0.4)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
      // Planet body
      const grad = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, 0, sx, sy, sr);
      grad.addColorStop(0, '#ffe0a0');
      grad.addColorStop(0.6, '#c89858');
      grad.addColorStop(1, '#5a3818');
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      // Bands
      ctx.save();
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = 'rgba(100, 60, 20, 0.25)';
      ctx.lineWidth = 3;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(sx - sr, sy + i * sr * 0.25);
        ctx.lineTo(sx + sr, sy + i * sr * 0.25);
        ctx.stroke();
      }
      ctx.restore();
      // Front half of rings
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(-0.3);
      ctx.scale(1, 0.22);
      ctx.beginPath(); ctx.arc(0, 0, sr * 2.0, 0, Math.PI);
      ctx.strokeStyle = 'rgba(220, 180, 120, 0.85)'; ctx.lineWidth = 8; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, sr * 1.7, 0, Math.PI);
      ctx.strokeStyle = 'rgba(255, 230, 160, 0.7)'; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, sr * 1.45, 0, Math.PI);
      ctx.strokeStyle = 'rgba(255, 220, 150, 0.55)'; ctx.lineWidth = 3; ctx.stroke();
      ctx.restore();
      // Ring shadow on planet
      ctx.save();
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(40, 25, 10, 0.35)';
      ctx.beginPath();
      ctx.ellipse(sx, sy + sr * 0.05, sr, sr * 0.10, -0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.restore();
    }

    if (name === 'URANUS') {
      // Tilted rings across the background
      ctx.save();
      const cx = w * 0.5, cy = h * 0.45;
      ctx.translate(cx, cy);
      ctx.rotate(-1.0);
      ctx.scale(1, 0.35);
      for (let i = 0; i < 5; i++) {
        ctx.beginPath();
        ctx.arc(0, 0, Math.min(w, h) * (0.4 + i * 0.06), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(180, 240, 232, ${0.10 + i * 0.04})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
      // Ring particles
      ctx.fillStyle = 'rgba(220, 250, 245, 0.55)';
      for (let i = 0; i < 20; i++) {
        const x = ((i * 73 + t * 0.6) % w);
        const y = ((i * 47 + t * 0.4) % h);
        ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    if (name === 'NEPTUNE') {
      // Churning storm clouds
      ctx.save();
      for (let i = 0; i < 5; i++) {
        const cx = ((i * 200 + t * 0.4) % (w + 300)) - 150;
        const cy = h * (0.2 + i * 0.15);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 120);
        grad.addColorStop(0, 'rgba(100, 140, 220, 0.30)');
        grad.addColorStop(1, 'rgba(100, 140, 220, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.fill();
      }
      // Fast methane streaks
      ctx.strokeStyle = 'rgba(220, 235, 255, 0.45)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) {
        const xOff = ((t * 3 + i * 130) % (w + 200)) - 100;
        const y = h * (0.1 + (i * 0.07) % 0.8);
        ctx.beginPath();
        ctx.moveTo(xOff, y);
        ctx.lineTo(xOff + 90, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (name === 'THE SUN') {
      // Inside the sun — radiant white core fading outward
      ctx.save();
      const cx = w * 0.5, cy = h * 0.5;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.85);
      grad.addColorStop(0, 'rgba(255, 255, 240, 0.85)');
      grad.addColorStop(0.3, 'rgba(255, 220, 130, 0.55)');
      grad.addColorStop(0.7, 'rgba(255, 140, 50, 0.35)');
      grad.addColorStop(1, 'rgba(180, 70, 20, 0.4)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
      // Corona arms
      ctx.translate(cx, cy);
      for (let i = 0; i < 14; i++) {
        const angle = (i / 14) * Math.PI * 2 + t * 0.004;
        const len = Math.max(w, h) * (0.5 + Math.sin(t * 0.02 + i) * 0.08);
        const grad2 = ctx.createLinearGradient(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
        grad2.addColorStop(0, 'rgba(255, 230, 140, 0.25)');
        grad2.addColorStop(1, 'rgba(255, 100, 40, 0)');
        ctx.fillStyle = grad2;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle - 0.05) * len, Math.sin(angle - 0.05) * len);
        ctx.lineTo(Math.cos(angle + 0.05) * len, Math.sin(angle + 0.05) * len);
        ctx.closePath(); ctx.fill();
      }
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
          const r = i * 4;
          const a = i * 0.32;
          const x = Math.cos(a) * r;
          const y = Math.sin(a) * r;
          const grad = ctx.createRadialGradient(x, y, 0, x, y, 14);
          grad.addColorStop(0, `rgba(180, 200, 255, ${0.30 - i * 0.006})`);
          grad.addColorStop(1, 'rgba(120, 80, 200, 0)');
          ctx.fillStyle = grad;
          ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      }
      // Galaxy core
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 30);
      coreGrad.addColorStop(0, 'rgba(255, 240, 220, 0.95)');
      coreGrad.addColorStop(1, 'rgba(200, 160, 240, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Nebula clouds elsewhere
      ctx.save();
      const nebs = [
        { x: w * 0.15, y: h * 0.6, r: 110, c: 'rgba(160, 80, 200, 0.18)' },
        { x: w * 0.35, y: h * 0.85, r: 90,  c: 'rgba(220, 100, 200, 0.15)' },
        { x: w * 0.85, y: h * 0.75, r: 130, c: 'rgba(100, 80, 220, 0.16)' },
      ];
      nebs.forEach((n) => {
        const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        grad.addColorStop(0, n.c);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
      });
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

  const drawDust = useCallback((ctx, dust, w, h, accent) => {
    ctx.save();
    dust.forEach((d) => {
      d.x += d.vx;
      d.y += d.vy;
      if (d.x < -10) d.x = w + 10;
      if (d.y < 0) d.y = h;
      if (d.y > h) d.y = 0;
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

  const drawColumn = useCallback((ctx, x, y, width, height, planet, depthOffset = 8) => {
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

    // Subtle panel lines every 50px
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
    ctx.lineWidth = 1;
    const startLine = Math.ceil(y / 50) * 50;
    for (let py = startLine; py < y + height; py += 50) {
      ctx.beginPath();
      ctx.moveTo(x + 4, py);
      ctx.lineTo(x + width - 4, py);
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  const drawColumnPair = useCallback((ctx, col, planet, h) => {
    const { x, gapY, gap } = col;
    const w = PHYSICS.columnWidth;
    const topH = gapY - gap / 2;
    const botY = gapY + gap / 2;
    const botH = h - botY;

    // Top column
    drawColumn(ctx, x, 0, w, topH, planet, 8);
    // Bottom column
    drawColumn(ctx, x, botY, w, botH, planet, 8);

    // Bright top edge highlight (bottom of top column - the edge facing the gap)
    ctx.save();
    const eg1 = ctx.createLinearGradient(0, topH - 4, 0, topH);
    eg1.addColorStop(0, planet.columnFront);
    eg1.addColorStop(1, planet.columnEdge);
    ctx.fillStyle = eg1;
    ctx.fillRect(x, topH - 4, w, 4);
    // Thin highlight line
    ctx.fillStyle = planet.columnEdge;
    ctx.fillRect(x, topH - 1, w, 1);
    // Subtle edge cap depth
    ctx.fillStyle = planet.columnEdge;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x + w, topH);
    ctx.lineTo(x + w + 8, topH - 8);
    ctx.lineTo(x + w + 8, topH - 12);
    ctx.lineTo(x + w, topH - 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Bright bottom edge (top of bottom column - facing the gap)
    ctx.save();
    const eg2 = ctx.createLinearGradient(0, botY, 0, botY + 4);
    eg2.addColorStop(0, planet.columnEdge);
    eg2.addColorStop(1, planet.columnFront);
    ctx.fillStyle = eg2;
    ctx.fillRect(x, botY, w, 4);
    ctx.fillStyle = planet.columnEdge;
    ctx.fillRect(x, botY, w, 1);
    ctx.fillStyle = planet.columnEdge;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(x + w, botY);
    ctx.lineTo(x + w + 8, botY - 8);
    ctx.lineTo(x + w + 8, botY - 4);
    ctx.lineTo(x + w, botY + 4);
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

  const drawShip = useCallback((ctx, ship, planet, t, scale = 1) => {
    ctx.save();
    ctx.translate(ship.x, ship.y);
    ctx.rotate(ship.tilt);
    ctx.scale(scale, scale);

    // Trail
    ctx.save();
    for (let i = 0; i < ship.trail.length; i++) {
      const p = ship.trail[i];
      const a = (i / ship.trail.length) * 0.4;
      ctx.fillStyle = `${planet.accent}${Math.floor(a * 255).toString(16).padStart(2, '0')}`;
      ctx.beginPath();
      const dx = p.x - ship.x;
      const dy = p.y - ship.y;
      // Translate back to world for trail, but we are in ship space — use offset
      const cos = Math.cos(-ship.tilt), sin = Math.sin(-ship.tilt);
      const tx = dx * cos - dy * sin;
      const ty = dx * sin + dy * cos;
      ctx.arc(tx, ty, 4 - i * 0.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Engine flame (two cones)
    const flameLen = 14 + Math.sin(t * 0.7) * 4 + (ship.vy < 0 ? 8 : 0);
    for (let s = -1; s <= 1; s += 2) {
      const fy = s * 6;
      // Outer flame
      const outerGrad = ctx.createLinearGradient(-12, fy, -12 - flameLen, fy);
      outerGrad.addColorStop(0, planet.accent);
      outerGrad.addColorStop(0.5, `${planet.accent}80`);
      outerGrad.addColorStop(1, `${planet.accent}00`);
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.moveTo(-12, fy - 3);
      ctx.lineTo(-12 - flameLen, fy);
      ctx.lineTo(-12, fy + 3);
      ctx.closePath();
      ctx.fill();
      // Inner white-hot core
      const innerLen = flameLen * 0.55;
      const innerGrad = ctx.createLinearGradient(-12, fy, -12 - innerLen, fy);
      innerGrad.addColorStop(0, '#ffffff');
      innerGrad.addColorStop(1, `${planet.accent}00`);
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.moveTo(-12, fy - 1.5);
      ctx.lineTo(-12 - innerLen, fy);
      ctx.lineTo(-12, fy + 1.5);
      ctx.closePath();
      ctx.fill();
    }

    // Wings — swept delta
    ctx.fillStyle = '#3a4f6a';
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.lineTo(-14, -13);
    ctx.lineTo(-10, -2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2, 2);
    ctx.lineTo(-14, 13);
    ctx.lineTo(-10, 2);
    ctx.closePath();
    ctx.fill();
    // Wing highlights
    ctx.fillStyle = 'rgba(220, 230, 250, 0.5)';
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.lineTo(-13, -12);
    ctx.lineTo(-11, -8);
    ctx.lineTo(-3, -1);
    ctx.closePath();
    ctx.fill();

    // Fuselage — elongated teardrop
    ctx.save();
    const fGrad = ctx.createLinearGradient(0, -8, 0, 8);
    fGrad.addColorStop(0, '#e8eef8');
    fGrad.addColorStop(0.5, '#b8c4d8');
    fGrad.addColorStop(1, '#6a7890');
    ctx.fillStyle = fGrad;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.quadraticCurveTo(10, -7, -4, -5);
    ctx.quadraticCurveTo(-13, -3, -14, 0);
    ctx.quadraticCurveTo(-13, 3, -4, 5);
    ctx.quadraticCurveTo(10, 7, 18, 0);
    ctx.closePath();
    ctx.fill();
    // Body bottom shadow
    ctx.fillStyle = 'rgba(40, 50, 70, 0.35)';
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.quadraticCurveTo(10, 6, -4, 5);
    ctx.quadraticCurveTo(-13, 3, -14, 0);
    ctx.lineTo(18, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Cockpit dome
    ctx.save();
    const cGrad = ctx.createRadialGradient(2, -3, 0, 2, -2, 6);
    cGrad.addColorStop(0, `${planet.accent}`);
    cGrad.addColorStop(0.7, '#2a4868');
    cGrad.addColorStop(1, '#152030');
    ctx.fillStyle = cGrad;
    ctx.beginPath();
    ctx.ellipse(3, -3, 6, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Specular highlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.beginPath();
    ctx.ellipse(1.5, -4.5, 1.6, 0.7, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Pulsing nav light on nose tip
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.3);
    ctx.save();
    ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + pulse * 0.2})`;
    ctx.shadowColor = planet.accent;
    ctx.shadowBlur = 8 + pulse * 6;
    ctx.beginPath();
    ctx.arc(17, 0, 1.6 + pulse * 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

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

  const drawRings = useCallback((ctx, rings) => {
    ctx.save();
    rings.forEach((r) => {
      const a = Math.max(0, r.life / r.maxLife);
      ctx.strokeStyle = `${r.color}${Math.floor(a * 200).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 2 * a;
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

  const drawHUD = useCallback((ctx, gs, planet, speedMul) => {
    const { w, score, best, planetIdx, obstaclesInPlanet, combo, comboTimer } = gs;

    // Score pill (centered, top)
    ctx.save();
    const scoreText = String(score);
    ctx.font = '600 44px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    const sw = Math.max(110, ctx.measureText(scoreText).width + 50);
    const sx = (w - sw) / 2, sy = 14;
    ctx.fillStyle = 'rgba(10, 15, 25, 0.55)';
    roundRect(ctx, sx, sy, sw, 60, 22);
    ctx.fill();
    // Border tint with accent
    ctx.strokeStyle = `${planet.accent}40`;
    ctx.lineWidth = 1;
    roundRect(ctx, sx, sy, sw, 60, 22);
    ctx.stroke();
    // Score number
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText(scoreText, w / 2, sy + 32);
    // BEST
    ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.shadowBlur = 2;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(`BEST ${best}`, w / 2, sy + 53);
    ctx.restore();

    // Score flash
    if (gs.scoreFlash > 0) {
      ctx.save();
      ctx.globalAlpha = gs.scoreFlash / 10;
      ctx.strokeStyle = planet.accent;
      ctx.lineWidth = 2;
      roundRect(ctx, sx - 2, sy - 2, sw + 4, 64, 24);
      ctx.stroke();
      ctx.restore();
      gs.scoreFlash--;
    }

    // Combo bar
    if (combo > 1 && comboTimer > 0) {
      ctx.save();
      const cx = (w - sw) / 2 + 10, cy = sy + 64;
      const cw = sw - 20;
      const fill = Math.min(1, comboTimer / 180);
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      roundRect(ctx, cx, cy, cw, 4, 2);
      ctx.fill();
      const cg = ctx.createLinearGradient(cx, 0, cx + cw, 0);
      cg.addColorStop(0, planet.accent);
      cg.addColorStop(1, '#ffffff');
      ctx.fillStyle = cg;
      roundRect(ctx, cx, cy, cw * fill, 4, 2);
      ctx.fill();
      ctx.restore();
    }

    // Level badge top-left
    ctx.save();
    const levelLabel = `${planetIdx + 1} · ${planet.name}`;
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    const lw = Math.max(120, ctx.measureText(levelLabel).width + 50);
    const lx = 12, ly = 14, lh = 38;
    ctx.fillStyle = 'rgba(10, 15, 25, 0.55)';
    roundRect(ctx, lx, ly, lw, lh, 18);
    ctx.fill();
    // Progress arc
    const ax = lx + 18, ay = ly + lh / 2, ar = 11;
    ctx.strokeStyle = 'rgba(255,255,255,0.20)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ax, ay, ar, -Math.PI / 2, Math.PI * 1.5);
    ctx.stroke();
    const prog = Math.min(1, obstaclesInPlanet / 15);
    ctx.strokeStyle = planet.accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(ax, ay, ar, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.stroke();
    // Inner dot
    ctx.fillStyle = planet.accent;
    ctx.beginPath();
    ctx.arc(ax, ay, 3.5, 0, Math.PI * 2);
    ctx.fill();
    // Label
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    ctx.fillText(levelLabel, lx + 36, ly + lh / 2);
    ctx.restore();

    // Speed top-right
    ctx.save();
    const spdText = `${speedMul.toFixed(1)}×`;
    ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    const tw = Math.max(60, ctx.measureText(spdText).width + 26);
    const tx = w - tw - 12, ty = 14, th = 38;
    ctx.fillStyle = 'rgba(10, 15, 25, 0.55)';
    roundRect(ctx, tx, ty, tw, th, 18);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    ctx.fillText(spdText, tx + tw / 2, ty + th / 2);
    ctx.restore();
  }, []);

  const drawTransitionCard = useCallback((ctx, gs, w, h) => {
    if (gs.transitionCard <= 0) return;
    const planet = PLANETS[gs.transitionCardPlanet];
    // Fade in then fade out — peak in middle of 120 frame window
    const total = 120;
    const t = total - gs.transitionCard; // 0..120
    let alpha;
    if (t < 20) alpha = t / 20;
    else if (t > 100) alpha = (120 - t) / 20;
    else alpha = 1;

    ctx.save();
    ctx.globalAlpha = alpha;
    const cw = Math.min(w - 60, 320), ch = 110;
    const cx = (w - cw) / 2, cy = (h - ch) / 2;
    // Glow border
    ctx.shadowColor = planet.accent;
    ctx.shadowBlur = 30;
    ctx.fillStyle = 'rgba(15, 20, 30, 0.85)';
    roundRect(ctx, cx, cy, cw, ch, 22);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Inner border line
    ctx.strokeStyle = `${planet.accent}80`;
    ctx.lineWidth = 1;
    roundRect(ctx, cx + 3, cy + 3, cw - 6, ch - 6, 18);
    ctx.stroke();
    // Planet number tag
    ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = planet.accent;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(`PLANET ${gs.transitionCardPlanet + 1} OF ${PLANETS.length}`, w / 2, cy + 18);
    // Planet name
    ctx.font = '600 26px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(planet.name, w / 2, cy + 36);
    // Tagline
    ctx.font = '400 13px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(planet.tagline, w / 2, cy + 74);
    ctx.restore();
  }, []);

  const drawStartScreen = useCallback((ctx, gs, w, h, t) => {
    // Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '300 44px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    // Letter-spaced title
    const title = 'STELLAR DRIFT';
    ctx.letterSpacing = '4px';
    ctx.fillText(title, w / 2, h * 0.28);
    ctx.letterSpacing = '0px';
    // Subtitle
    ctx.font = '400 14px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.shadowBlur = 3;
    ctx.fillText('A voyage through the solar system', w / 2, h * 0.34);
    ctx.restore();

    // Tap prompt (pulsing)
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.08);
    ctx.save();
    ctx.globalAlpha = 0.55 + pulse * 0.45;
    ctx.font = '500 16px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.fillText('Tap to begin', w / 2, h * 0.72);
    ctx.restore();

    // Planet indicator dots
    ctx.save();
    const n = PLANETS.length;
    const spacing = 18;
    const totalW = (n - 1) * spacing;
    const startX = (w - totalW) / 2;
    const dotY = h * 0.80;
    for (let i = 0; i < n; i++) {
      const x = startX + i * spacing;
      ctx.fillStyle = i === 0 ? PLANETS[i].accent : 'rgba(255,255,255,0.25)';
      ctx.beginPath();
      ctx.arc(x, dotY, i === 0 ? 4 : 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Daily challenge banner
    ctx.save();
    const bw = Math.min(w - 60, 260), bh = 32;
    const bx = (w - bw) / 2, by = h * 0.86;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    roundRect(ctx, bx, by, bw, bh, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    roundRect(ctx, bx, by, bw, bh, 16);
    ctx.stroke();
    ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("TODAY'S CHALLENGE · REACH NEPTUNE", w / 2, by + bh / 2);
    ctx.restore();

    // Personal best
    if (gs.best > 0) {
      ctx.save();
      ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.textAlign = 'center';
      ctx.fillText(`Personal best · ${gs.best}`, w / 2, h * 0.40);
      ctx.restore();
    }
  }, []);

  const drawDeathScreen = useCallback((ctx, gs, w, h, t) => {
    const overlay = Math.min(1, gs.deathOverlay / 20);
    ctx.save();
    ctx.fillStyle = `rgba(5, 10, 18, ${overlay * 0.72})`;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    if (overlay < 0.6) return;
    const cardAlpha = (overlay - 0.4) / 0.6;
    const planet = PLANETS[gs.planetIdx];

    ctx.save();
    ctx.globalAlpha = Math.min(1, cardAlpha);
    const cw = Math.min(w - 50, 320);
    const ch = 240;
    const cx = (w - cw) / 2;
    const cy = (h - ch) / 2;

    // Card
    ctx.fillStyle = 'rgba(15, 22, 35, 0.92)';
    roundRect(ctx, cx, cy, cw, ch, 22);
    ctx.fill();
    ctx.strokeStyle = `${planet.accent}50`;
    ctx.lineWidth = 1;
    roundRect(ctx, cx, cy, cw, ch, 22);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // "JOURNEY ENDED"
    ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('JOURNEY ENDED', w / 2, cy + 28);

    // Final score
    ctx.font = '300 64px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText(String(gs.score), w / 2, cy + 78);
    ctx.shadowBlur = 0;

    // Planet reached
    ctx.font = '500 13px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = planet.accent;
    ctx.fillText(`Reached · ${planet.name}`, w / 2, cy + 122);

    // Best
    if (gs.newBest) {
      const glowPulse = 0.5 + 0.5 * Math.sin(t * 0.15);
      ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = planet.accent;
      ctx.shadowBlur = 8 + glowPulse * 8;
      ctx.fillText(`★ NEW BEST · ${gs.best}`, w / 2, cy + 148);
      ctx.shadowBlur = 0;
    } else {
      ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`Best · ${gs.best}`, w / 2, cy + 148);
    }

    // Tap to retry
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.10);
    ctx.font = '500 14px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = `rgba(255,255,255,${0.55 + pulse * 0.35})`;
    ctx.fillText('Tap to try again', w / 2, cy + 184);

    // Remove ads placeholder
    ctx.font = '500 10px -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('· remove ads ·', w / 2, cy + 218);

    ctx.restore();
  }, []);

  // ─────────────────────────────────────────────────────────────
  // GAME LOGIC
  // ─────────────────────────────────────────────────────────────
  const spawnColumn = useCallback((gs) => {
    const minGapY = gs.gap / 2 + 70;
    const maxGapY = gs.h - gs.gap / 2 - 70;
    const gapY = Math.random() * (maxGapY - minGapY) + minGapY;
    gs.columns.push({ x: gs.w + 20, gapY, gap: gs.gap, scored: false });
    gs.framesSinceSpawn = 0;
  }, []);

  const flap = useCallback((gs) => {
    if (gs.state !== 'playing') return;
    if (gs.time - gs.lastFlapFrame < 3) return; // per-frame guard
    gs.lastFlapFrame = gs.time;
    gs.ship.vy = PHYSICS.thrust;
    const planet = PLANETS[gs.planetIdx];
    // Particles
    for (let i = 0; i < 11; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = Math.random() * 3 + 1;
      gs.particles.push({
        x: gs.ship.x - 10, y: gs.ship.y + (Math.random() - 0.5) * 6,
        vx: Math.cos(a) * sp - 1, vy: Math.sin(a) * sp + 0.5,
        r: Math.random() * 2.5 + 1.5,
        life: 30, maxLife: 30,
        color: planet.accent,
      });
    }
    // Ring pulse
    gs.rings.push({ x: gs.ship.x, y: gs.ship.y, radius: 8, life: 22, maxLife: 22, color: planet.accent });
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
    if (gs.score > gs.best) {
      gs.best = gs.score;
      gs.newBest = true;
      try { localStorage.setItem('stellardrift_best', String(gs.best)); } catch {}
    }
    if (gs.score > 8 && !gs.ratedThisRun) {
      onRatingPromptEligible();
      gs.ratedThisRun = true;
    }
  }, [playDeath, setMusicLayer]);

  const startGame = useCallback((gs) => {
    gs.state = 'playing';
    gs.ship.y = gs.h * 0.5;
    gs.ship.vy = 0;
    gs.ship.tilt = 0;
    gs.ship.trail = [];
    gs.columns = [];
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
    gs.spawnInterval = PHYSICS.startSpawnInterval;
    gs.gap = PHYSICS.startGap;
    gs.shake = 0;
    gs.flash = 0;
    gs.deathOverlay = 0;
    gs.scoreFlash = 0;
    gs.ratedThisRun = false;
    setMusicLayer(0);
  }, [setMusicLayer]);

  // ─────────────────────────────────────────────────────────────
  // GAME LOOP
  // ─────────────────────────────────────────────────────────────
  const step = useCallback(() => {
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
      gs.time++;

      // Resolve current planet & speed at top so HUD always has it
      const planet = PLANETS[gs.planetIdx];
      const speedMul = 1 + (gs.score * PHYSICS.speedPerObstacle + gs.planetIdx * 0.4);
      const currentSpeed = PHYSICS.baseSpeed * speedMul / 1.0; // pixels/frame, scaled later

      // Apply planet transition crossfade
      if (gs.planetTransition < 1) {
        gs.planetTransition = Math.min(1, gs.planetTransition + 1 / 90);
      }

      // ── UPDATE ──
      if (gs.state === 'playing') {
        // Spawn
        gs.framesSinceSpawn++;
        if (gs.framesSinceSpawn >= gs.spawnInterval) {
          spawnColumn(gs);
        }
        // Ship physics
        gs.ship.vy += PHYSICS.gravity;
        gs.ship.vy = Math.min(gs.ship.vy, 12);
        gs.ship.y += gs.ship.vy;
        gs.ship.tilt = Math.max(-0.5, Math.min(0.9, gs.ship.vy * 0.06));
        // Trail
        if (gs.time % 2 === 0) {
          gs.ship.trail.push({ x: gs.ship.x - 12, y: gs.ship.y });
          if (gs.ship.trail.length > 12) gs.ship.trail.shift();
        }
        // Columns
        const moveSpeed = PHYSICS.baseSpeed + gs.score * PHYSICS.speedPerObstacle + gs.planetIdx * 0.4;
        for (let i = gs.columns.length - 1; i >= 0; i--) {
          const c = gs.columns[i];
          c.x -= moveSpeed;
          // Score?
          if (!c.scored && c.x + PHYSICS.columnWidth < gs.ship.x - PHYSICS.shipRadius * 0.6) {
            c.scored = true;
            gs.score++;
            gs.obstaclesInPlanet++;
            gs.combo++;
            gs.comboTimer = 180;
            gs.scoreFlash = 10;
            // Score popup
            gs.popups.push({
              text: '+1', x: c.x + PHYSICS.columnWidth / 2, y: c.gapY,
              size: 22, color: planet.accent,
              life: 40, maxLife: 40, vy: -1,
            });
            playScore(gs.combo);
            if (gs.combo >= 4 && gs.combo % 4 === 0) {
              gs.popups.push({
                text: `×${gs.combo} COMBO`, x: w / 2, y: h * 0.4,
                size: 32, color: planet.accent,
                life: 50, maxLife: 50, vy: -0.6,
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
                const sp = Math.random() * 5 + 1.5;
                gs.particles.push({
                  x: c.x + PHYSICS.columnWidth / 2, y: c.gapY,
                  vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
                  r: Math.random() * 3 + 1.5,
                  life: 50, maxLife: 50,
                  color: planet.accent,
                });
              }
            }
            // Music layer progression
            if (gs.score === 10) setMusicLayer(1);
            if (gs.score === 25) setMusicLayer(2);
            // Planet transition
            if (gs.obstaclesInPlanet >= 15 && gs.planetIdx < PLANETS.length - 1) {
              gs.prevPlanetIdx = gs.planetIdx;
              gs.planetIdx++;
              gs.obstaclesInPlanet = 0;
              gs.planetTransition = 0;
              gs.transitionCard = 120;
              gs.transitionCardPlanet = gs.planetIdx;
              gs.gap = Math.max(PHYSICS.minGap, gs.gap - PHYSICS.gapShrinkPerPlanet);
              gs.spawnInterval = Math.max(PHYSICS.minSpawnInterval, gs.spawnInterval - PHYSICS.spawnShrinkPerPlanet);
              gs.stars = makeStars(w, h, 60);
              gs.dust = makeDust(w, h, 30);
              playLevelUp();
            }
          }
          // Off-screen
          if (c.x + PHYSICS.columnWidth + 20 < 0) {
            gs.columns.splice(i, 1);
            continue;
          }
          // Collision
          const topH = c.gapY - c.gap / 2;
          const botY = c.gapY + c.gap / 2;
          const sx = gs.ship.x, sy = gs.ship.y, sr = PHYSICS.shipRadius - 2;
          if (sx + sr > c.x && sx - sr < c.x + PHYSICS.columnWidth) {
            if (sy - sr < topH || sy + sr > botY) {
              die(gs);
            }
          }
        }
        // Ground/ceiling
        if (gs.ship.y - PHYSICS.shipRadius < 0) {
          gs.ship.y = PHYSICS.shipRadius;
          gs.ship.vy = 0;
        }
        if (gs.ship.y + PHYSICS.shipRadius > h) {
          die(gs);
        }
        // Combo timer
        if (gs.comboTimer > 0) {
          gs.comboTimer--;
          if (gs.comboTimer === 0) gs.combo = 0;
        }
      } else if (gs.state === 'start') {
        // Idle ship bob
        gs.ship.idleT += 0.04;
        gs.ship.y = h * 0.5 + Math.sin(gs.ship.idleT) * 14;
        gs.ship.vy = Math.cos(gs.ship.idleT) * 14 * 0.04;
        gs.ship.tilt = Math.cos(gs.ship.idleT) * 0.12;
        gs.ship.x = w * PHYSICS.shipX;
        if (gs.time % 4 === 0) {
          gs.ship.trail.push({ x: gs.ship.x - 12, y: gs.ship.y });
          if (gs.ship.trail.length > 10) gs.ship.trail.shift();
        }
      } else if (gs.state === 'dead') {
        gs.deathOverlay = Math.min(20, gs.deathOverlay + 1);
        // Ship falls
        gs.ship.vy += PHYSICS.gravity * 0.6;
        gs.ship.y += gs.ship.vy;
        gs.ship.tilt = Math.min(1.2, gs.ship.tilt + 0.02);
      }

      // Particles update
      for (let i = gs.particles.length - 1; i >= 0; i--) {
        const p = gs.particles[i];
        p.x += p.vx; p.y += p.vy;
        p.vy += 0.08;
        p.vx *= 0.98;
        p.life--;
        if (p.life <= 0) gs.particles.splice(i, 1);
      }
      // Rings update
      for (let i = gs.rings.length - 1; i >= 0; i--) {
        const r = gs.rings[i];
        r.radius += 2.5;
        r.life--;
        if (r.life <= 0) gs.rings.splice(i, 1);
      }
      // Popups update
      for (let i = gs.popups.length - 1; i >= 0; i--) {
        const p = gs.popups[i];
        p.y += p.vy || -1;
        p.life--;
        if (p.life <= 0) gs.popups.splice(i, 1);
      }

      // Shake decay
      if (gs.shake > 0) gs.shake--;
      if (gs.flash > 0) gs.flash--;
      if (gs.transitionCard > 0) gs.transitionCard--;

      // ── DRAW to offscreen for bloom pass ──
      const offCtx = off.getContext('2d');
      const shakeX = gs.shake > 0 ? (Math.random() - 0.5) * gs.shake : 0;
      const shakeY = gs.shake > 0 ? (Math.random() - 0.5) * gs.shake : 0;

      offCtx.save();
      offCtx.clearRect(0, 0, w, h);
      offCtx.translate(shakeX, shakeY);

      // Background — handle crossfade if transitioning
      if (gs.planetTransition < 1 && gs.prevPlanetIdx !== gs.planetIdx) {
        const prev = PLANETS[gs.prevPlanetIdx];
        drawBackground(offCtx, w, h, prev, gs.time);
        drawStars(offCtx, gs.stars, gs.time, 1 - gs.planetTransition);
        offCtx.save();
        offCtx.globalAlpha = gs.planetTransition;
        drawBackground(offCtx, w, h, planet, gs.time);
        drawStars(offCtx, gs.stars, gs.time, gs.planetTransition);
        offCtx.restore();
      } else {
        drawBackground(offCtx, w, h, planet, gs.time);
        drawStars(offCtx, gs.stars, gs.time, 1);
      }

      // Atmospheric dust
      if (planet.name === 'MARS' || planet.name === 'JUPITER' || planet.name === 'URANUS') {
        drawDust(offCtx, gs.dust, w, h, planet.accent);
      }

      // Columns (only while playing or dead-falling)
      if (gs.state === 'playing' || gs.state === 'dead') {
        gs.columns.forEach((c) => drawColumnPair(offCtx, c, planet, h));
      }

      // Rings (under ship)
      drawRings(offCtx, gs.rings);
      // Ship
      drawShip(offCtx, gs.ship, planet, gs.time);
      // Particles
      drawParticles(offCtx, gs.particles);
      // Popups
      drawPopups(offCtx, gs.popups);

      // Fog
      drawFog(offCtx, w, h, planet.fog);

      offCtx.restore();

      // ── COMPOSITE TO MAIN CANVAS WITH BLOOM ──
      ctx.clearRect(0, 0, w, h);
      // Base
      ctx.drawImage(off, 0, 0);
      // Bloom: blurred copy at low opacity
      ctx.save();
      ctx.globalAlpha = 0.40;
      ctx.globalCompositeOperation = 'lighter';
      ctx.filter = 'blur(8px)';
      ctx.drawImage(off, 0, 0);
      ctx.filter = 'none';
      ctx.globalCompositeOperation = 'source-over';
      ctx.restore();

      // White flash on death
      if (gs.flash > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${gs.flash / 18 * 0.5})`;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }

      // HUD (only in playing/dead, not start)
      if (gs.state === 'playing' || gs.state === 'dead') {
        drawHUD(ctx, gs, planet, speedMul);
      }

      // Transition card overlay
      if (gs.transitionCard > 0) {
        drawTransitionCard(ctx, gs, w, h);
      }

      // Start / Death screens
      if (gs.state === 'start') {
        drawStartScreen(ctx, gs, w, h, gs.time);
      } else if (gs.state === 'dead') {
        drawDeathScreen(ctx, gs, w, h, gs.time);
      }
    } catch (err) {
      console.error('[STELLAR DRIFT] loop error', err);
    }

    rafRef.current = requestAnimationFrame(step);
  }, [
    spawnColumn, drawBackground, drawStars, drawDust, drawColumnPair,
    drawShip, drawParticles, drawRings, drawPopups, drawFog,
    drawHUD, drawStartScreen, drawDeathScreen, drawTransitionCard,
    die, playScore, playCombo, playLevelUp, setMusicLayer, makeStars, makeDust,
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
            if (gsRef.current) {
        const prevW = gsRef.current.w;
        const prevH = gsRef.current.h;
        gsRef.current.w = w;
        gsRef.current.h = h;
        gsRef.current.ship.x = w * PHYSICS.shipX;
        // Re-center ship vertically if not actively playing
        if (gsRef.current.state !== 'playing') {
          gsRef.current.ship.y = h * 0.5;
        } else if (prevH > 0) {
          // Scale ship Y proportionally during play
          gsRef.current.ship.y = (gsRef.current.ship.y / prevH) * h;
        }
        gsRef.current.stars = makeStars(w, h, 60);
        gsRef.current.dust = makeDust(w, h, 30);
      } else {
        gsRef.current = initGameState(w, h);
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

  const toggleMute = useCallback((e) => {
    e.stopPropagation();
    setMuted((m) => {
      const next = !m;
      const a = audioRef.current;
      if (a) {
        try {
          a.master.gain.cancelScheduledValues(a.ctx.currentTime);
          a.master.gain.linearRampToValueAtTime(next ? 0 : 0.7, a.ctx.currentTime + 0.15);
        } catch {}
      }
      return next;
    });
  }, []);

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
        onTouchStart={onTouchStart}
        onMouseDown={onMouseDown}
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
        {/* Mute toggle */}
        <button
          onTouchStart={toggleMute}
          onMouseDown={toggleMute}
          aria-label="Toggle sound"
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            width: 40,
            height: 40,
            borderRadius: 20,
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(10, 15, 25, 0.55)',
            color: '#ffffff',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            touchAction: 'none',
            padding: 0,
            outline: 'none',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>
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
