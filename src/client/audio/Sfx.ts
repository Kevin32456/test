import type { ArenaStage } from "@shared/arenas";
import { playSfxTone, unlockAudio } from "./AudioEngine";

function tone(
  freq: number,
  durationSec: number,
  type: OscillatorType = "square",
  volume = 0.07,
) {
  playSfxTone(freq, durationSec, type, volume);
}

export const Sfx = {
  unlock: () => unlockAudio(),
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
