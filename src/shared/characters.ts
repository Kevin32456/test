export interface CharacterDef {
  id: string;
  name: string;
  asset: string;
  /** 無 sprite 時的備用顏色 */
  color: string;
  /** 選角時的風格提示；不代表不同的戰鬥數值。 */
  tagline: string;
  description: string;
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: "hat",
    name: "紳士",
    asset: "/assets/characters/char-hat.png",
    color: "#c9a86c",
    tagline: "冷靜周旋",
    description: "讀狗的路線，讓每次轉身都有餘裕。",
  },
  {
    id: "gauntlet",
    name: "拳手",
    asset: "/assets/characters/char-gauntlet.png",
    color: "#e57373",
    tagline: "正面挑釁",
    description: "在危險邊緣帶狗繞圈，再把球甩出去。",
  },
  {
    id: "spike",
    name: "少年",
    asset: "/assets/characters/char-spike.png",
    color: "#4fc3f7",
    tagline: "高速誘餌",
    description: "用短線走位拉開空間，替隊友製造接球角度。",
  },
  {
    id: "coat",
    name: "旅人",
    asset: "/assets/characters/char-coat.png",
    color: "#81c784",
    tagline: "穩健走位",
    description: "先活下來，再把球傳到下一個安全位置。",
  },
  {
    id: "ninja",
    name: "忍者",
    asset: "/assets/characters/char-ninja.png",
    color: "#9575cd",
    tagline: "瞬間脫身",
    description: "把 Blink 留給最後一刻，從狗的路線中消失。",
  },
  {
    id: "miko",
    name: "巫女",
    asset: "/assets/characters/char-miko.png",
    color: "#ef5350",
    tagline: "安全傳球",
    description: "先看隊友位置，再把燙手的球送到遠處。",
  },
  {
    id: "mechanic",
    name: "機工師",
    asset: "/assets/characters/char-mechanic.png",
    color: "#26a69a",
    tagline: "節奏控球",
    description: "控制持球時間，在狗加速前做出決定。",
  },
  {
    id: "captain",
    name: "船長",
    asset: "/assets/characters/char-captain.png",
    color: "#5c6bc0",
    tagline: "帶隊決策",
    description: "讓整隊保持可接球的距離，掌握傳球節奏。",
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
