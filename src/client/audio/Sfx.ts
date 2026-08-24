import type { ArenaStage } from "@shared/arenas";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  try {
    if (!ctx) {
      ctx = new AudioContext();
    }
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    return ctx;
  } catch {
    return null;
  }
}

function tone(
  freq: number,
  durationSec: number,
  type: OscillatorType = "square",
  volume = 0.07,
) {
  const ac = getCtx();
  if (!ac) return;

  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ac.destination);
  const end = ac.currentTime + durationSec;
  gain.gain.exponentialRampToValueAtTime(0.001, end);
  osc.start();
  osc.stop(end);
}

export const Sfx = {
  unlock: () => getCtx()?.resume(),
  pass: () => tone(520, 0.07, "triangle"),
  blink: () => tone(920, 0.05, "sine", 0.05),
  death: () => tone(160, 0.18, "sawtooth", 0.06),
  win: () => {
    tone(523, 0.1, "triangle");
    setTimeout(() => tone(784, 0.14, "triangle"), 90);
  },
  countdown: () => tone(440, 0.04, "sine", 0.05),
  arenaStage: (stage: ArenaStage) => {
    const notes: Record<ArenaStage, number[]> = {
      teach: [392],
      test: [392, 523],
      twist: [523, 659, 523],
      mastery: [523, 659, 784],
    };
    notes[stage].forEach((frequency, index) => {
      setTimeout(() => tone(frequency, 0.06, "triangle", 0.045), index * 75);
    });
  },
};
