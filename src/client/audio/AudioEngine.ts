import type { ArenaStage } from "@shared/arenas";

export type MusicMode = "lobby" | "practice" | ArenaStage;

interface MusicPattern {
  notes: number[];
  stepMs: number;
  noteDurationSec: number;
  accentEvery: number;
}

// 自製短循環旋律，不載入外部音檔；每個階段只改變節奏與音域，保持同一個音樂主題。
const MUSIC_PATTERNS: Record<MusicMode, MusicPattern> = {
  lobby: {
    notes: [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23],
    stepMs: 420,
    noteDurationSec: 0.3,
    accentEvery: 4,
  },
  practice: {
    notes: [392, 440, 523.25, 440, 392, 349.23, 440, 523.25],
    stepMs: 340,
    noteDurationSec: 0.24,
    accentEvery: 4,
  },
  teach: {
    notes: [261.63, 329.63, 392, 329.63, 261.63, 329.63, 440, 392],
    stepMs: 460,
    noteDurationSec: 0.32,
    accentEvery: 4,
  },
  test: {
    notes: [293.66, 349.23, 440, 523.25, 440, 349.23, 293.66, 392],
    stepMs: 360,
    noteDurationSec: 0.25,
    accentEvery: 4,
  },
  twist: {
    notes: [329.63, 392, 493.88, 587.33, 493.88, 392, 329.63, 440],
    stepMs: 285,
    noteDurationSec: 0.2,
    accentEvery: 2,
  },
  mastery: {
    notes: [392, 493.88, 587.33, 659.25, 587.33, 493.88, 392, 523.25],
    stepMs: 220,
    noteDurationSec: 0.16,
    accentEvery: 2,
  },
};

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let sfxGain: GainNode | null = null;
let musicGain: GainNode | null = null;
let audioEnabled = true;
let userUnlockedAudio = false;
let activeMusicMode: MusicMode | null = null;
let musicTimer: ReturnType<typeof setTimeout> | null = null;
let musicRun = 0;
let musicStep = 0;

function ensureAudioGraph(): AudioContext | null {
  if (audioContext) return audioContext;
  if (typeof window === "undefined" || typeof window.AudioContext !== "function") {
    return null;
  }

  try {
    audioContext = new window.AudioContext();
    masterGain = audioContext.createGain();
    sfxGain = audioContext.createGain();
    musicGain = audioContext.createGain();
    masterGain.gain.value = audioEnabled ? 0.72 : 0.0001;
    sfxGain.gain.value = 0.8;
    musicGain.gain.value = 0.28;
    sfxGain.connect(masterGain);
    musicGain.connect(masterGain);
    masterGain.connect(audioContext.destination);
    return audioContext;
  } catch {
    audioContext = null;
    masterGain = null;
    sfxGain = null;
    musicGain = null;
    return null;
  }
}

function setGain(target: GainNode | null, value: number, timeConstant = 0.04) {
  const ac = audioContext;
  if (!target || !ac) return;
  const now = ac.currentTime;
  target.gain.cancelScheduledValues(now);
  target.gain.setTargetAtTime(value, now, timeConstant);
}

function scheduleTone(
  output: GainNode,
  frequency: number,
  start: number,
  durationSec: number,
  type: OscillatorType,
  volume: number,
) {
  const ac = audioContext;
  if (!ac) return;

  const oscillator = ac.createOscillator();
  const envelope = ac.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  envelope.gain.setValueAtTime(Math.max(0.0001, volume), start);
  envelope.gain.exponentialRampToValueAtTime(
    0.0001,
    start + Math.max(0.04, durationSec),
  );
  oscillator.connect(envelope);
  envelope.connect(output);
  oscillator.start(start);
  oscillator.stop(start + Math.max(0.05, durationSec) + 0.02);
}

function clearMusicTimer() {
  if (musicTimer !== null) {
    clearTimeout(musicTimer);
    musicTimer = null;
  }
}

function scheduleMusicStep(run: number) {
  const mode = activeMusicMode;
  const ac = audioContext;
  const output = musicGain;
  if (!mode || !ac || !output || !audioEnabled || run !== musicRun) return;

  const pattern = MUSIC_PATTERNS[mode];
  const frequency = pattern.notes[musicStep % pattern.notes.length]!;
  const start = ac.currentTime + 0.03;
  scheduleTone(output, frequency, start, pattern.noteDurationSec, "triangle", 0.075);
  if (musicStep % pattern.accentEvery === 0) {
    scheduleTone(
      output,
      frequency / 2,
      start,
      pattern.noteDurationSec * 0.9,
      "sine",
      0.028,
    );
  }
  musicStep += 1;
  musicTimer = setTimeout(() => {
    musicTimer = null;
    scheduleMusicStep(run);
  }, pattern.stepMs);
}

function startMusic() {
  if (!activeMusicMode || !audioEnabled || !userUnlockedAudio) return;
  const ac = ensureAudioGraph();
  if (!ac || !musicGain) return;
  clearMusicTimer();
  musicRun += 1;
  musicStep = 0;
  setGain(musicGain, 0.28, 0.08);
  scheduleMusicStep(musicRun);
}

export function unlockAudio() {
  const ac = ensureAudioGraph();
  if (!ac) return;
  userUnlockedAudio = true;
  if (ac.state === "suspended") void ac.resume();
  if (activeMusicMode && musicTimer === null) startMusic();
}

export function playSfxTone(
  frequency: number,
  durationSec: number,
  type: OscillatorType = "square",
  volume = 0.07,
) {
  if (!audioEnabled) return;
  unlockAudio();
  if (!audioContext || !sfxGain) return;
  scheduleTone(
    sfxGain,
    frequency,
    audioContext.currentTime,
    durationSec,
    type,
    volume,
  );
}

export function setAudioEnabled(enabled: boolean) {
  audioEnabled = enabled;
  if (!enabled) {
    clearMusicTimer();
    musicRun += 1;
  }
  const ac = ensureAudioGraph();
  if (!ac) return;
  setGain(masterGain, enabled ? 0.72 : 0.0001, 0.06);
  if (enabled) {
    unlockAudio();
    startMusic();
  }
}

export function isAudioEnabled() {
  return audioEnabled;
}

export function setMusicMode(mode: MusicMode) {
  const changed = activeMusicMode !== mode;
  activeMusicMode = mode;
  if (changed || musicTimer === null) startMusic();
}

export function stopMusic() {
  activeMusicMode = null;
  clearMusicTimer();
  musicRun += 1;
  setGain(musicGain, 0.0001, 0.05);
}
