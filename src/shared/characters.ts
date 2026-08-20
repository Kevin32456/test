export interface CharacterDef {
  id: string;
  name: string;
  asset: string;
  /** 無 sprite 時的備用顏色 */
  color: string;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: "hat",
    name: "紳士",
    asset: "/assets/characters/char-hat.png",
    color: "#c9a86c",
  },
  {
    id: "gauntlet",
    name: "拳手",
    asset: "/assets/characters/char-gauntlet.png",
    color: "#e57373",
  },
  {
    id: "spike",
    name: "少年",
    asset: "/assets/characters/char-spike.png",
    color: "#4fc3f7",
  },
  {
    id: "coat",
    name: "旅人",
    asset: "/assets/characters/char-coat.png",
    color: "#81c784",
  },
] as const;

export type CharacterId = (typeof CHARACTERS)[number]["id"];

export const CHARACTER_IDS = CHARACTERS.map((c) => c.id);

export function getCharacter(id: string | null | undefined): CharacterDef | undefined {
  return CHARACTERS.find((c) => c.id === id);
}

export function isValidCharacterId(id: string): id is CharacterId {
  return CHARACTER_IDS.includes(id as CharacterId);
}
