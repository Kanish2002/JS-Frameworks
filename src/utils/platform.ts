export function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function getRunShortcutLabel() {
  return isApplePlatform() ? "⌘↵" : "Ctrl↵";
}
