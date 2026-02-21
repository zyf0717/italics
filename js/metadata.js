/**
 * metadata.js — Text metadata module
 *
 * Renders statistics about the current input text into the Metadata tab.
 *
 * Exports:
 *   initMetadataTab() → void
 *   updateMetadata(text: string) → void
 */

/* Characters that map to Unicode italic equivalents */
const ITALIC_RE = /[A-Za-z]/;

/**
 * Breaks a text string into categorised character groups.
 * @param {string} text
 * @returns {{ label: string, count: number }[]}
 */
function analyse(text) {
  const counters = {
    "Letters (converted)":    0,
    "Digits":                 0,
    "Spaces":                 0,
    "Newlines":               0,
    "Punctuation / symbols":  0,
  };

  for (const ch of text) {
    if (ITALIC_RE.test(ch))        counters["Letters (converted)"]   += 1;
    else if (ch >= "0" && ch <= "9") counters["Digits"]              += 1;
    else if (ch === " ")           counters["Spaces"]                 += 1;
    else if (ch === "\n")          counters["Newlines"]               += 1;
    else                           counters["Punctuation / symbols"]  += 1;
  }

  return Object.entries(counters).map(([label, count]) => ({ label, count }));
}

/**
 * Counts words in a string (whitespace-delimited, ignoring empty tokens).
 * @param {string} text
 * @returns {number}
 */
function countWords(text) {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

/**
 * Renders metadata for the given text into the Metadata tab DOM.
 * @param {string} text
 */
export function updateMetadata(text) {
  const chars  = document.getElementById("meta-chars");
  const words  = document.getElementById("meta-words");
  const lines  = document.getElementById("meta-lines");
  const converted = document.getElementById("meta-converted");
  const tbody  = document.getElementById("meta-tbody");
  const empty  = document.getElementById("meta-empty");

  if (!chars) return; // tab not yet in DOM

  const lineCount = text === "" ? 0 : text.split("\n").length;
  const letterCount = (text.match(/[A-Za-z]/g) ?? []).length;

  chars.textContent     = text.length;
  words.textContent     = countWords(text);
  lines.textContent     = lineCount;
  converted.textContent = letterCount;

  const breakdown = analyse(text);

  if (text.length === 0) {
    tbody.innerHTML = "";
    empty.hidden    = false;
  } else {
    empty.hidden    = true;
    tbody.innerHTML = breakdown
      .filter(({ count }) => count > 0)
      .map(({ label, count }) => {
        const pct = ((count / text.length) * 100).toFixed(1);
        return `<tr><td>${label}</td><td>${count}</td><td>${pct}%</td></tr>`;
      })
      .join("");
  }
}

/**
 * Initialises the Metadata tab (no event listeners needed here —
 * updates are driven by the shared text-change callback in app.js).
 */
export function initMetadataTab() {
  updateMetadata("");
}
