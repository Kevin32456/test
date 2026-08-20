export type ControlMode = "mouse" | "wasd";

const STORAGE_KEY = "shuai-gou-control";

export function getControlMode(): ControlMode {
  if (typeof localStorage === "undefined") return "mouse";
  return localStorage.getItem(STORAGE_KEY) === "wasd" ? "wasd" : "mouse";
}

export function setControlMode(mode: ControlMode) {
  localStorage.setItem(STORAGE_KEY, mode);
}

export const CONTROL_MODE_LABELS: Record<ControlMode, string> = {
  mouse: "滑鼠右鍵",
  wasd: "WASD 鍵盤",
};
