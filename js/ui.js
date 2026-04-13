/**
 * ui.js — shared browser UI helpers
 */

export function flashButtonLabel(button, text, durationMs = 1000) {
  const previousText = button.textContent;
  button.textContent = text;
  window.setTimeout(() => {
    button.textContent = previousText;
  }, durationMs);
}

export async function copyText(text, fallbackTarget, button, copiedLabel = "Copied") {
  if (!text) return false;

  try {
    await navigator.clipboard.writeText(text);
    if (button) flashButtonLabel(button, copiedLabel);
    return true;
  } catch {
    fallbackTarget?.select?.();
    document.execCommand("copy");
    return false;
  }
}
