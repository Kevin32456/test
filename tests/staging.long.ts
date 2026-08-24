// 長 replay gate 的固定入口，避免每次手動設定環境變數造成驗證範圍漂移。
process.env.REPLAY_ROUNDS = process.env.REPLAY_ROUNDS ?? "3";
process.env.REPLAY_ROUND_MS = process.env.REPLAY_ROUND_MS ?? "15000";

await import("./staging.replay.ts");
