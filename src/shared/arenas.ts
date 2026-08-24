export type ArenaStyle = "vermilion-court" | "moon-garden";
export type ArenaStage = "teach" | "test" | "twist" | "mastery";

export interface ArenaPalette {
  background: number;
  floor: number;
  grid: number;
  border: number;
  accent: number;
  landmark: number;
}

export interface ArenaDefinition {
  id: string;
  name: string;
  description: string;
  routeHint: string;
  style: ArenaStyle;
  palette: ArenaPalette;
}

export interface ArenaStageDefinition {
  title: string;
  prompt: string;
}

export const ARENA_STAGES = {
  teach: {
    title: "教學 · 先看一條路",
    prompt: "沿著亮起的月燈走位；規則不變，先熟悉方向。",
  },
  test: {
    title: "測試 · 拉開距離",
    prompt: "四個月燈都能通過，保持隊友在可傳球距離。",
  },
  twist: {
    title: "轉折 · 斜線換位",
    prompt: "狗仍只追持球者；斜切路線改變你的傳球角度。",
  },
  mastery: {
    title: "熟練 · 掌握全場",
    prompt: "讀狗、讀隊友，把 Blink 留到真正危險的時刻。",
  },
} as const satisfies Record<ArenaStage, ArenaStageDefinition>;

/** 地圖節奏只改變視覺教學與路標，不改變伺服器物理規則。 */
export const ARENA_STAGE_START_SECONDS = {
  teach: 0,
  test: 6,
  twist: 16,
  mastery: 30,
} as const satisfies Record<ArenaStage, number>;

export function getArenaStage(roundTimeSec: number): ArenaStage {
  if (roundTimeSec >= ARENA_STAGE_START_SECONDS.mastery) return "mastery";
  if (roundTimeSec >= ARENA_STAGE_START_SECONDS.twist) return "twist";
  if (roundTimeSec >= ARENA_STAGE_START_SECONDS.test) return "test";
  return "teach";
}

export function getArenaStageDefinition(stage: ArenaStage): ArenaStageDefinition {
  return ARENA_STAGES[stage];
}

/**
 * 競技場是內容資料，不承擔碰撞規則；所有場地目前共用 constants 的圓形邊界。
 * 這讓新增視覺／路線變化時，不會偷偷改變已驗證的多人平衡。
 */
export const ARENAS = [
  {
    id: "vermilion-court",
    name: "朱印圓場",
    description: "開闊的標準場，適合先熟悉狗的甩尾與傳球節奏。",
    routeHint: "三層內圈是視覺路標；目前沒有障礙物碰撞。",
    style: "vermilion-court",
    palette: {
      background: 0x0f1118,
      floor: 0x1b2430,
      grid: 0x253041,
      border: 0x3d4f68,
      accent: 0xe0503a,
      landmark: 0xd9a441,
    },
  },
  {
    id: "moon-garden",
    name: "月影庭",
    description: "冷色月庭用四個路標拉出外圈與斜切路線，讓走位更容易讀。",
    routeHint: "四個月燈只是視覺路標；目前沒有障礙物碰撞。",
    style: "moon-garden",
    palette: {
      background: 0x0a1020,
      floor: 0x182846,
      grid: 0x315273,
      border: 0x637fa4,
      accent: 0xb9a7ff,
      landmark: 0x7de3d1,
    },
  },
] as const satisfies readonly ArenaDefinition[];

export type ArenaId = (typeof ARENAS)[number]["id"];

export const DEFAULT_ARENA_ID: ArenaId = "vermilion-court";

export function isValidArenaId(value: unknown): value is ArenaId {
  return typeof value === "string" && ARENAS.some((arena) => arena.id === value);
}

export function getArena(value: ArenaId | string | null | undefined): ArenaDefinition {
  return ARENAS.find((arena) => arena.id === value) ?? ARENAS[0];
}
