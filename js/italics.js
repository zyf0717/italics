/**
 * italics.js — Unicode italic conversion module
 *
 * Exports:
 *   toUnicodeItalic(text: string) → string
 *   initItalicsTab(onTextChange: (text: string) => void) → void
 */

const italicMap = new Map();

for (let i = 0; i < 26; i += 1) {
  italicMap.set(
    String.fromCharCode(65 + i),          // A–Z
    String.fromCodePoint(0x1d608 + i)     // 𝘈–𝘡
  );
  italicMap.set(
    String.fromCharCode(97 + i),          // a–z
    String.fromCodePoint(0x1d622 + i)     // 𝘢–𝘻
  );
}

/**
 * Converts plain text to Unicode sans-serif italic characters.
 * Non-alphabetic characters are passed through unchanged.
 * @param {string} text
 * @returns {string}
 */
export function toUnicodeItalic(text) {
  return Array.from(text, (ch) => italicMap.get(ch) ?? ch).join("");
}

/**
 * Initialises the Italics tab UI and wires up events.
 */
export function initItalicsTab() {
  const input   = document.getElementById("input");
  const output  = document.getElementById("output");
  const copyBtn = document.getElementById("copyBtn");

  function syncOutput() {
    const converted = toUnicodeItalic(input.value);
    output.value     = converted;
    copyBtn.disabled = converted.trim().length === 0;
  }

  async function copyOutput() {
    if (!output.value) return;

    try {
      await navigator.clipboard.writeText(output.value);
      const prev = copyBtn.textContent;
      copyBtn.textContent = "Copied";
      setTimeout(() => { copyBtn.textContent = prev; }, 1000);
    } catch {
      output.select();
      document.execCommand("copy");
    }
  }

  input.addEventListener("input", syncOutput);
  copyBtn.addEventListener("click", copyOutput);
  syncOutput();
}
