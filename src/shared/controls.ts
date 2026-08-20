export type ControlMode = "mouse" | "wasd";

const STORAGE_KEY = "shuai-gou-control";

export function getControlMode(): ControlMode {
  if (typeof localStorage === "undefined") return "mouse";
  return localStorage.getItem(STORAGE_KEY) === "wasd" ? "wasd" : "mouse";
}

type ControlModeListener = (mode: ControlMode) => void;

const listeners = new Set<ControlModeListener>();

export function setControlMode(mode: ControlMode) {
  localStorage.setItem(STORAGE_KEY, mode);
  for (const listener of listeners) listener(mode);
}

export function subscribeControlMode(listener: ControlModeListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export const CONTROL_MODE_LABELS: Record<ControlMode, string> = {
  mouse: "滑鼠右鍵",
  wasd: "WASD 鍵盤",
};
