import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ARENA_STAGE_START_SECONDS, ARENA_STAGES, ARENAS } from "../src/shared/arenas.js";
import { CHARACTERS } from "../src/shared/characters.js";
import {
  arenaText,
  characterText,
  setLocale,
  stageText,
  t,
} from "../src/client/i18n.js";

const sfxSource = readFileSync(resolve(process.cwd(), "src/client/audio/Sfx.ts"), "utf8");
for (const event of ["unlock", "pass", "blink", "death", "win", "countdown", "arenaStage"]) {
  assert.match(sfxSource, new RegExp(`${event}:`), `missing SFX event: ${event}`);
}
const audioSource = readFileSync(resolve(process.cwd(), "src/client/audio/AudioEngine.ts"), "utf8");
for (const mode of ["lobby", "practice", "teach", "test", "twist", "mastery"]) {
  assert.match(audioSource, new RegExp(`${mode}:`), `missing music mode: ${mode}`);
}
assert.match(audioSource, /setAudioEnabled/);
assert.match(audioSource, /setMusicMode/);
const mainSource = readFileSync(resolve(process.cwd(), "src/client/main.ts"), "utf8");
assert.match(mainSource, /audio-toggle/, "missing player audio toggle");

const styleSource = readFileSync(resolve(process.cwd(), "src/client/style.css"), "utf8");
assert.match(styleSource, /@media \(max-width: 420px\)/, "missing narrow viewport rules");
assert.match(styleSource, /calc\(100vw - 20px\)/, "narrow lobby must fit the viewport");

for (const character of CHARACTERS) {
  const relative = character.asset.replace(/^\//, "");
  const assetPath = resolve(process.cwd(), "public", relative);
  assert.equal(existsSync(assetPath), true, `missing character asset: ${relative}`);
  const svg = readFileSync(assetPath, "utf8");
  assert.match(svg, /<svg\b/);
  assert.match(svg, /width="96"/);
  assert.match(svg, /height="128"/);
}

assert.deepEqual(
  Object.keys(ARENA_STAGES),
  ["teach", "test", "twist", "mastery"],
  "arena stages must preserve the teach/test/twist/mastery order",
);
assert.ok(
  ARENA_STAGE_START_SECONDS.teach <
    ARENA_STAGE_START_SECONDS.test &&
    ARENA_STAGE_START_SECONDS.test <
      ARENA_STAGE_START_SECONDS.twist &&
    ARENA_STAGE_START_SECONDS.twist <
      ARENA_STAGE_START_SECONDS.mastery,
);
assert.equal(ARENAS.length >= 2, true, "content slice needs two arenas");

setLocale("zh-Hant");
const traditionalStrings = [
  t("lobbyDesc"),
  ...CHARACTERS.flatMap((character) => [
    characterText(character.id, 0),
    characterText(character.id, 1),
    characterText(character.id, 2),
  ]),
  ...ARENAS.flatMap((arena) => [arenaText(arena.id, 0), arenaText(arena.id, 1)]),
  ...(["teach", "test", "twist", "mastery"] as const).flatMap((stage) => [
    stageText(stage, 0),
    stageText(stage, 1),
  ]),
];
assert.ok(traditionalStrings.every((value) => value.trim().length > 0));

setLocale("en");
const englishStrings = [
  t("lobbyDesc"),
  t("guideMove"),
  t("resultNext"),
  t("replay"),
  ...CHARACTERS.flatMap((character) => [
    characterText(character.id, 0),
    characterText(character.id, 1),
    characterText(character.id, 2),
  ]),
  ...ARENAS.flatMap((arena) => [arenaText(arena.id, 0), arenaText(arena.id, 1)]),
  ...(["teach", "test", "twist", "mastery"] as const).flatMap((stage) => [
    stageText(stage, 0),
    stageText(stage, 1),
  ]),
];
assert.ok(englishStrings.every((value) => value.trim().length > 0));
assert.ok(englishStrings.some((value) => /[A-Za-z]/.test(value)));

console.log(`content tests passed: ${CHARACTERS.length} icons, ${ARENAS.length} arenas, 2 locales`);
