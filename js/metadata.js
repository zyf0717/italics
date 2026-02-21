/**
 * metadata.js — JPEG EXIF metadata module
 *
 * Exports:
 *   initMetadataTab() → void
 */

import * as exifr from "exifr";

/**
 * Formats a raw EXIF data object into a readable key: value string.
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
function formatExif(data) {
  return Object.entries(data)
    .map(([key, val]) => {
      if (val instanceof Uint8Array || val instanceof ArrayBuffer) return null;
      let display = val instanceof Date ? val.toISOString()
                  : typeof val === "object" && val !== null ? JSON.stringify(val)
                  : String(val);
      return `${key}: ${display}`;
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Initialises the Metadata tab UI and wires up file-upload / drag-drop events.
 */
export function initMetadataTab() {
  const dropZone  = document.getElementById("meta-dropzone");
  const fileInput = document.getElementById("meta-file");
  const metaOut   = document.getElementById("meta-output");
  const copyBtn   = document.getElementById("meta-copyBtn");
  const statusEl  = document.getElementById("meta-status");

  /* ── Open file picker on click / Enter / Space ── */
  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
  });

  /* ── Drag-and-drop ── */
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });

  /* ── File input change ── */
  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) processFile(fileInput.files[0]);
  });

  /* ── Copy button ── */
  copyBtn.addEventListener("click", async () => {
    if (!metaOut.value) return;
    try {
      await navigator.clipboard.writeText(metaOut.value);
      const prev = copyBtn.textContent;
      copyBtn.textContent = "Copied";
      setTimeout(() => { copyBtn.textContent = prev; }, 1000);
    } catch {
      metaOut.select();
      document.execCommand("copy");
    }
  });

  /* ── Process uploaded file ── */
  async function processFile(file) {
    if (!file.type.match(/image\/jpe?g/i)) {
      setStatus("Only JPEG files are supported.", true);
      return;
    }

    setStatus("Reading metadata\u2026");
    metaOut.value    = "";
    copyBtn.disabled = true;

    try {
      const data = await exifr.parse(file, { all: true });

      if (!data || Object.keys(data).length === 0) {
        setStatus("No EXIF metadata found in this image.");
        return;
      }

      metaOut.value    = formatExif(data);
      copyBtn.disabled = false;
      const n = Object.keys(data).length;
      setStatus(`${n} tag${n !== 1 ? "s" : ""} found \u2014 ${file.name}`);
    } catch (err) {
      setStatus(`Failed to read metadata: ${err.message}`, true);
    }
  }

  function setStatus(msg, isError = false) {
    statusEl.textContent  = msg;
    statusEl.style.color  = isError ? "#dc2626" : "var(--muted)";
  }
}
