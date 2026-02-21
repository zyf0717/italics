/**
 * app.js — Application entry point
 *
 * Responsibilities:
 *   • Tab switching
 *   • Wires the Italics and Metadata modules together
 */

import { initItalicsTab }  from "./italics.js";
import { initMetadataTab } from "./metadata.js";

/* ── Tab switching ──────────────────────────────────────── */

const tabBtns   = document.querySelectorAll(".tab-btn");
const tabPanels = document.querySelectorAll(".tab-panel");

function activateTab(tabId) {
  tabBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
    btn.setAttribute("aria-selected", btn.dataset.tab === tabId);
  });
  tabPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${tabId}`);
  });
}

tabBtns.forEach((btn) => {
  btn.addEventListener("click", () => activateTab(btn.dataset.tab));
});

/* ── Module init ────────────────────────────────────────── */

initMetadataTab();
initItalicsTab();

// Activate the default tab.
activateTab("italics");
