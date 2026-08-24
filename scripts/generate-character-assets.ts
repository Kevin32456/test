import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type CharacterAsset = {
  id: string;
  grid: string[];
  palette: Record<string, string>;
};

const skin = "#f2cfa0";
const eye = "#25252d";

const assets: CharacterAsset[] = [
  {
    id: "hat",
    grid: [
      "..TTTTTTTT..", "..TTTTTTTT..", ".TTTTTTTTTT.", "..HHHHHHHH..",
      "..SESSSSES..", "..SSSSSSSS..", ".ABBBBBBBBA.", ".ABBBBBBBBA.",
      ".ABBBBBBBBA.", ".ABBBBBBBBA.", ".SBBBBBBBBS.", "..LLLLLLLL..",
      "..LLL..LLL..", "..LLL..LLL..", "..FFF..FFF..", "..FFF..FFF..",
    ],
    palette: { T: "#4a3324", H: "#b9b9c2", S: skin, E: eye, B: "#cbb282", A: "#5d4531", L: "#7a6248", F: "#3c2d20" },
  },
  {
    id: "gauntlet",
    grid: [
      "..HHHHHHHH..", "..HHHHHHHH..", "..SSSSSSSS..", "..SESSSSES..",
      "..SSSSSSSS..", "..SSSSSSSS..", ".ABBBBBBBBA.", ".ABBBBBBBBA.",
      ".ABBBBBBBBA.", ".ABBBBBBBBA.", ".AABBBBBBAA.", "..LLLLLLLL..",
      "..LLL..LLL..", "..LLL..LLL..", "..FFF..FFF..", "..FFF..FFF..",
    ],
    palette: { H: "#6d4a2e", S: skin, E: eye, B: "#4f7a48", A: "#e8862e", L: "#31415c", F: "#2a2a33" },
  },
  {
    id: "spike",
    grid: [
      "..H..HH..H..", "..HHHHHHHH..", "..HHHHHHHH..", "..SESSSSES..",
      "..SSSSSSSS..", "..SSSSSSSS..", ".BBBBBBBBBB.", ".BBBBBBBBBB.",
      ".BBBBBBBBBB.", ".BBBBBBBBBB.", ".SBBBBBBBBS.", "..LLLLLLLL..",
      "..LLL..LLL..", "..LLL..LLL..", "..FFF..FFF..", "..FFF..FFF..",
    ],
    palette: { H: "#eceef2", S: skin, E: "#7b3fd4", B: "#2e3d66", L: "#e4ddc8", F: "#3a3f4d" },
  },
  {
    id: "coat",
    grid: [
      "..HHHHHHHH..", "..HHHHHHHH..", ".HSSSSSSSSH.", ".HSESSSESH.",
      ".HSSSSSSSSH.", ".HSSSSSSSSH.", ".BBBBBBBBBB.", ".BBBBBBBBBB.",
      ".BBBBBBBBBB.", ".BBBBBBBBBB.", ".BBBBBBBBBB.", ".BBBBBBBBBB.",
      "..BBB..BBB..", "..LLL..LLL..", "..FFF..FFF..", "..FFF..FFF..",
    ],
    palette: { H: "#8a4b2f", S: skin, E: eye, B: "#5d6b3c", L: "#3d3a33", F: "#2c2620" },
  },
  {
    id: "ninja",
    grid: [
      "..HHHHHHHH..", ".HHHHHHHHHH.", ".HHSSSSSSHH.", ".HHSESSSEHH.",
      ".HHBBBBBBHH.", ".AABBBBBBAA.", ".ABBBBBBBBA.", ".ABBBBBBBBA.",
      ".ABBBBBBBBA.", ".ABBBBBBBBA.", "..BBBBBBBB..", "..LLLLLLLL..",
      "..LLL..LLL..", "..LLL..LLL..", "..FFF..FFF..", "..FFF..FFF..",
    ],
    palette: { H: "#1f2029", S: skin, E: "#f6d365", B: "#4b3a67", A: "#b83b45", L: "#30283f", F: "#171820" },
  },
  {
    id: "miko",
    grid: [
      "...RR..RR...", "..HHHHHHHH..", ".HHSSSSSSHH.", ".HHSESSSEHH.",
      ".HHSSSSSSHH.", "..WWWWWWWW..", ".RWWWWWWWWR.", ".RWWWWWWWWR.",
      ".RRRRRRRRRR.", ".RRRRRRRRRR.", ".SRRRRRRRRS.", "..RRRRRRRR..",
      "..RRR..RRR..", "..RRR..RRR..", "..FFF..FFF..", "..FFF..FFF..",
    ],
    palette: { H: "#27242e", R: "#c94343", W: "#f2eee4", S: skin, E: eye, F: "#6f252d" },
  },
  {
    id: "mechanic",
    grid: [
      "..GGGGGGGG..", ".GGHHHHHHGG.", "..GSSSSSSG..", "..GSESSSEG..",
      "..SSSSSSSS..", ".AABBBBBBAA.", ".ABBBBBBBBA.", ".ABBBBBBBBA.",
      ".ABBBBBBBBA.", ".ABBBBBBBBA.", ".AABBBBBBAA.", "..LLLLLLLL..",
      "..LLL..LLL..", "..LLL..LLL..", "..FFF..FFF..", "..FFF..FFF..",
    ],
    palette: { G: "#d5a43b", H: "#5b3c2a", S: skin, E: "#2c4652", B: "#317b78", A: "#df7f32", L: "#344f57", F: "#202b31" },
  },
  {
    id: "captain",
    grid: [
      "..TTTTTTTT..", ".TTTTTTTTTT.", "..HHHHHHHH..", "..SESSSSES..",
      "..SSSSSSSS..", ".AABBBBBBAA.", ".ABBBBBBBBA.", ".ABBBBBBBBA.",
      ".ABBBBBBBBA.", ".ABBBBBBBBA.", ".SBBBBBBBBS.", "..LLLLLLLL..",
      "..LLL..LLL..", "..LLL..LLL..", "..FFF..FFF..", "..FFF..FFF..",
    ],
    palette: { T: "#a83e45", H: "#46352d", S: skin, E: eye, B: "#344b78", A: "#d6aa45", L: "#273654", F: "#161d2d" },
  },
];

function renderSvg(asset: CharacterAsset) {
  const cells: string[] = [];
  for (const [y, row] of asset.grid.entries()) {
    for (const [x, key] of [...row].entries()) {
      const color = asset.palette[key];
      if (key === "." || !color) continue;
      cells.push(`<rect x="${x}" y="${y}" width="1" height="1" fill="${color}"/>`);
    }
  }
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="128" viewBox="0 0 12 16" shape-rendering="crispEdges">',
    '  <title>Shuai Gou character icon</title>',
    '  <rect width="12" height="16" fill="none"/>',
    `  ${cells.join("\n  ")}`,
    "</svg>",
    "",
  ].join("\n");
}

const outputDir = resolve(process.cwd(), "public/assets/characters");
mkdirSync(outputDir, { recursive: true });
for (const asset of assets) {
  const outputPath = resolve(outputDir, `char-${asset.id}.svg`);
  writeFileSync(outputPath, renderSvg(asset), "utf8");
  console.log(outputPath);
}

console.log(`generated ${assets.length} character icons`);
