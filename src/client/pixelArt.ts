/**
 * 程式繪製的像素 sprite：方塊人角色與邊境牧羊犬。
 * 全部以字元網格定義，'.' 為透明，其餘查 palette。
 */

type Palette = Record<string, string>;

function paintGrid(grid: string[], palette: Palette, scale: number): HTMLCanvasElement {
  const rows = grid.length;
  const cols = grid[0]!.length;
  const canvas = document.createElement("canvas");
  canvas.width = cols * scale;
  canvas.height = rows * scale;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < rows; y++) {
    const row = grid[y]!;
    for (let x = 0; x < cols; x++) {
      const ch = row[x]!;
      if (ch === ".") continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  return canvas;
}

/* ---------- 方塊人（12×16） ---------- */
/* 圖例：T=帽 H=髮 S=皮膚 E=眼 B=軀幹 A=手臂/配件 L=褲 F=鞋 */

const SKIN = "#f2cfa0";
const EYE = "#25252d";

const BLOCK_PEOPLE: Record<string, { grid: string[]; palette: Palette }> = {
  /** 紳士：灰髮 + 深棕高帽 + 米色背心 */
  hat: {
    grid: [
      "..TTTTTTTT..",
      "..TTTTTTTT..",
      ".TTTTTTTTTT.",
      "..HHHHHHHH..",
      "..SESSSSES..",
      "..SSSSSSSS..",
      ".ABBBBBBBBA.",
      ".ABBBBBBBBA.",
      ".ABBBBBBBBA.",
      ".ABBBBBBBBA.",
      ".SBBBBBBBBS.",
      "..LLLLLLLL..",
      "..LLL..LLL..",
      "..LLL..LLL..",
      "..FFF..FFF..",
      "..FFF..FFF..",
    ],
    palette: {
      T: "#4a3324",
      H: "#b9b9c2",
      S: SKIN,
      E: EYE,
      B: "#cbb282",
      A: "#5d4531",
      L: "#7a6248",
      F: "#3c2d20",
    },
  },
  /** 拳手：亂棕髮 + 綠背心 + 橘色大護手 */
  gauntlet: {
    grid: [
      "..HHHHHHHH..",
      "..HHHHHHHH..",
      "..SSSSSSSS..",
      "..SESSSSES..",
      "..SSSSSSSS..",
      "..SSSSSSSS..",
      ".ABBBBBBBBA.",
      ".ABBBBBBBBA.",
      ".ABBBBBBBBA.",
      ".ABBBBBBBBA.",
      ".AABBBBBBAA.",
      "..LLLLLLLL..",
      "..LLL..LLL..",
      "..LLL..LLL..",
      "..FFF..FFF..",
      "..FFF..FFF..",
    ],
    palette: {
      H: "#6d4a2e",
      S: SKIN,
      E: EYE,
      B: "#4f7a48",
      A: "#e8862e",
      L: "#31415c",
      F: "#2a2a33",
    },
  },
  /** 少年：白色刺蝟頭 + 藏青連帽衣 */
  spike: {
    grid: [
      "..H..HH..H..",
      "..HHHHHHHH..",
      "..HHHHHHHH..",
      "..SESSSSES..",
      "..SSSSSSSS..",
      "..SSSSSSSS..",
      ".BBBBBBBBBB.",
      ".BBBBBBBBBB.",
      ".BBBBBBBBBB.",
      ".BBBBBBBBBB.",
      ".SBBBBBBBBS.",
      "..LLLLLLLL..",
      "..LLL..LLL..",
      "..LLL..LLL..",
      "..FFF..FFF..",
      "..FFF..FFF..",
    ],
    palette: {
      H: "#eceef2",
      S: SKIN,
      E: "#7b3fd4",
      B: "#2e3d66",
      L: "#e4ddc8",
      F: "#3a3f4d",
    },
  },
  /** 旅人：紅棕長髮 + 橄欖綠長外套 */
  coat: {
    grid: [
      "..HHHHHHHH..",
      "..HHHHHHHH..",
      ".HSSSSSSSSH.",
      ".HSESSSSESH.",
      ".HSSSSSSSSH.",
      ".HSSSSSSSSH.",
      ".BBBBBBBBBB.",
      ".BBBBBBBBBB.",
      ".BBBBBBBBBB.",
      ".BBBBBBBBBB.",
      ".BBBBBBBBBB.",
      ".BBBBBBBBBB.",
      "..BBB..BBB..",
      "..LLL..LLL..",
      "..FFF..FFF..",
      "..FFF..FFF..",
    ],
    palette: {
      H: "#8a4b2f",
      S: SKIN,
      E: EYE,
      B: "#5d6b3c",
      L: "#3d3a33",
      F: "#2c2620",
    },
  },
};

/* ---------- 邊境牧羊犬（俯視，面朝右，22×12） ---------- */
/* 圖例：K=黑毛 W=白毛 N=鼻 */

const COLLIE_GRID = [
  "..........KKKKK...KK..",
  ".......KKKKKKKKKKKKKK.",
  "......KKKKKKKWWKKKKKKK",
  ".....KKKKKKKKWWKKKWWWK",
  ".WWKKKKKKKKKKWWKKWWWWN",
  ".WWKKKKKKKKKKWWKKWWWWN",
  ".WWKKKKKKKKKKWWKKWWWWN",
  ".....KKKKKKKKWWKKKWWWK",
  "......KKKKKKKWWKKKKKKK",
  ".......KKKKKKKKKKKKKK.",
  "..........KKKKK...KK..",
  "......................",
];

const COLLIE_PALETTE: Palette = {
  K: "#20202a",
  W: "#f2f0e9",
  N: "#141419",
};

export function characterCanvas(id: string, scale = 1): HTMLCanvasElement {
  const def = BLOCK_PEOPLE[id] ?? BLOCK_PEOPLE.hat!;
  return paintGrid(def.grid, def.palette, scale);
}

export function characterDataURL(id: string, scale = 6): string {
  return characterCanvas(id, scale).toDataURL();
}

export function dogCanvas(scale = 1): HTMLCanvasElement {
  return paintGrid(COLLIE_GRID, COLLIE_PALETTE, scale);
}
