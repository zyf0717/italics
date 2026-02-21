/**
 * metadata.js — JPEG EXIF metadata module
 *
 * Exports:
 *   initMetadataTab() → void
 */

import * as exifr from "exifr";

/**
 * Known camera bodies — matched against the EXIF Make+Model string.
 * instagram/rednote are the display names for each platform.
 */
const BODY_PRESETS = [
  { match: (b) => /Z\s*8/i.test(b),              instagram: "Nikon Z8",          rednote: "\u5C3C\u5EB7 Z8"    },
  { match: (b) => /Z\s*6\s*(iii|3)/i.test(b),    instagram: "Nikon Z6III",       rednote: "\u5C3C\u5EB7 Z6III" },
  { match: (b) => /Z\s*6\s*(ii|2)/i.test(b),     instagram: "Nikon Z6II",        rednote: "\u5C3C\u5EB7 Z6II"  },
  { match: (b) => /OM.?(Digital.Solutions|System).*OM.?1/i.test(b) || /^OM.?1$/i.test(b),
                                          instagram: "OM-1",             rednote: "\u5965\u5DF4 OM-1"  },
];

/**
 * Known lenses — matched against the EXIF LensModel string.
 */
const LENS_PRESETS = [
  { match: (l) => /180.?600/i.test(l),                          instagram: "180-600mm f/5.6-6.3",              rednote: "180-600mm f/5.6-6.3"                },
  { match: (l) => /800/i.test(l),                               instagram: "800mm f/6.3 PF",                   rednote: "800mm f/6.3 PF"                     },
  { match: (l) => /500/i.test(l),                               instagram: "500mm f/5.6 PF",                   rednote: "500mm f/5.6 PF"                     },
  { match: (l) => /M\.?300|olympus.*300/i.test(l),              instagram: "300mm f/4 PRO",                    rednote: "300mm f/4 PRO"                      },
  { match: (l) => /100.?400/i.test(l) && /leica|dg/i.test(l),   instagram: "Leica DG 100-400mm f/4-6.3 II",    rednote: "松徕 100-400mm f/4-6.3 II" },
  { match: (l) => /100.?400/i.test(l),                          instagram: "NIKKOR Z 100-400mm f/4.5-5.6 VR S", rednote: "NIKKOR Z 100-400mm f/4.5-5.6 VR S" },
];

/**
 * Resolves a platform-specific camera string from EXIF body + lens strings.
 * Falls back to the raw EXIF value for any unrecognised body or lens.
 * @param {string} body  Raw EXIF Make+Model string.
 * @param {string} lens  Raw EXIF LensModel string.
 * @param {string} platform  "instagram" | "rednote"
 * @returns {string}
 */
function resolveGear(body, lens, platform) {
  const b = BODY_PRESETS.find(p => p.match(body));
  const l = LENS_PRESETS.find(p => p.match(lens));
  const bodyStr = b?.[platform] ?? body;
  const lensStr = l?.[platform] ?? lens;
  return [bodyStr, lensStr].filter(Boolean).join(" + ");
}

/**
 * Reverse-geocodes a lat/lon pair to a human-readable place name using Nominatim.
 * Returns { place, countryCode } — both empty strings on failure or missing data.
 * @param {number} lat
 * @param {number} lon
 * @returns {Promise<{ place: string, countryCode: string }>}
 */
async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=16`;
    const res  = await fetch(url, { headers: { "Accept-Language": "en" } });
    if (!res.ok) return { place: "", countryCode: "" };
    const json = await res.json();
    const a    = json.address || {};
    const place = (
      a.tourism || a.leisure || a.amenity || a.building ||
      a.suburb  || a.neighbourhood || a.city_district ||
      a.town    || a.city || a.county || ""
    );
    return { place, countryCode: (json.address?.country_code || "").toLowerCase() };
  } catch {
    return { place: "", countryCode: "" };
  }
}

/**
 * Formats an ExposureTime decimal as a shutter speed string (e.g. "1/4000s", "2s").
 * @param {number|null} t
 * @returns {string|null}
 */
function formatShutterSpeed(t) {
  if (t == null) return null;
  if (t >= 1)    return `${Math.round(t * 10) / 10}s`;
  return `1/${Math.round(1 / t)}s`;
}

/**
 * ISO 3166-1 alpha-2 country codes considered "Asia" for tag purposes.
 */
const ASIA_COUNTRY_CODES = new Set([
  "sg","my","th","id","ph","vn","kh","la","mm","bn",
  "cn","jp","kr","tw","hk","mo","in","lk","np","bd",
  "pk","af","mn","kp","tl","tr","ge","am","az",
  "kz","uz","tm","kg","tj",
]);

const INSTAGRAM_TAGS_BASE = "@natgeo @natgeoanimals @natgeoyourshot @bbcearth";

const REDNOTE_BODY_TAGS = [
  { match: (b) => /Z\s*8/i.test(b),            tag: "#尼康Z8"    },
  { match: (b) => /Z\s*6\s*(iii|3)/i.test(b),  tag: "#尼康Z6iii" },
  { match: (b) => /Z\s*6\s*(ii|2)/i.test(b),   tag: "#尼康Z6ii"  },
  { match: (b) => /OM.?1/i.test(b),            tag: "#OM1"       },
];

/**
 * Builds the settings summary (synchronous — location must be pre-resolved).
 * @param {Record<string, unknown>} data
 * @param {{ place: string, countryCode: string }} location  Pre-fetched location object.
 * @param {{ showLocation: boolean, showGear: boolean, showTags: boolean, platform: string }} opts
 * @returns {string}
 */
function buildSummary(data, location, opts = {}) {
  const { showLocation = true, showGear = true, showTags = true, tripod = false, dotSight = false, platform = "instagram" } = opts;
  const { place = "", countryCode = "" } = location;

  const lines = [];

  // 📍 Location
  if (showLocation) lines.push(`\u{1F4CD}: ${place}`);

  // 📆 Date
  const dt = data.DateTimeOriginal ?? data.CreateDate;
  const dateStr = (dt instanceof Date)
    ? platform === "rednote"
      ? dt.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
      : dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";
  lines.push(`\u{1F4C6}: ${dateStr}`);

  if (showGear) {
    // 📷 Camera body + lens
    const make  = String(data.Make  || "").replace(/\0/g, "").trim();
    const model = String(data.Model || "").replace(/\0/g, "").trim();
    const body  = (model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`).trim();
    const lens  = String(data.LensModel || "").replace(/\0/g, "").trim();
    const camera = resolveGear(body, lens, platform) + (dotSight ? " + DF-M1" : "");
    lines.push(`\u{1F4F7}: ${camera}`);

    // ⚙️ Shooting settings
    const focal    = data.FocalLength != null ? `${Math.round(data.FocalLength)}mm` : null;
    const aperture = data.FNumber     != null ? `f/${data.FNumber}` : null;
    const shutter  = formatShutterSpeed(data.ExposureTime);
    const iso      = data.ISO         != null ? `ISO ${data.ISO}` : null;
    const handheld = tripod ? (platform === "rednote" ? "三角架" : "Tripod") : (platform === "rednote" ? "手持" : "Handheld");
    lines.push(`\u2699\uFE0F: ${[focal, aperture, shutter, iso, handheld].filter(Boolean).join(" | ")}`);
  }

  // Platform tags
  if (showTags) {
    if (platform === "instagram") {
      const regional = countryCode === "sg"
        ? "@nikonsg @nikonasia @nparksbuzz @natgeoasia "
        : ASIA_COUNTRY_CODES.has(countryCode)
          ? "@nikonasia @natgeoasia "
          : "";
      lines.push("", regional + INSTAGRAM_TAGS_BASE);
    } else {
      const make   = String(data.Make  || "").replace(/\0/g, "").trim();
      const model  = String(data.Model || "").replace(/\0/g, "").trim();
      const body   = (model.toLowerCase().startsWith(make.toLowerCase()) ? model : `${make} ${model}`).trim();
      const bodyTag = REDNOTE_BODY_TAGS.find(p => p.match(body))?.tag ?? "";
      lines.push("", ["#观鸟", "#鸟类摄影", bodyTag].filter(Boolean).join(" "));
    }
  }

  return lines.join("\n");
}

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
  const dropZone    = document.getElementById("meta-dropzone");
  const fileInput   = document.getElementById("meta-file");
  const metaOut     = document.getElementById("meta-output");
  const copyBtn     = document.getElementById("meta-copyBtn");
  const statusEl    = document.getElementById("meta-status");
  const summaryOut  = document.getElementById("meta-summary");
  const summaryCopy = document.getElementById("meta-summaryCopyBtn");

  const togLocation  = document.getElementById("tog-location");
  const togGear      = document.getElementById("tog-gear");
  const togTags      = document.getElementById("tog-tags");
  const togDotSight  = document.getElementById("tog-dotsight");
  const togTripod    = document.getElementById("tog-tripod");
  const togInstagram = document.getElementById("tog-instagram");
  const togRednote   = document.getElementById("tog-rednote");

  /** Current EXIF data and pre-fetched location, kept for re-rendering on toggle changes. */
  let lastData     = null;
  let lastLocation = { place: "", countryCode: "" };

  function getOpts() {
    return {
      showLocation: togLocation.checked,
      showGear:     togGear.checked,
      showTags:     togTags.checked,
      dotSight:     togDotSight.checked,
      tripod:       togTripod.checked,
      platform:     togInstagram.checked ? "instagram" : "rednote",
    };
  }

  function refreshSummary() {
    if (!lastData) return;
    summaryOut.value     = buildSummary(lastData, lastLocation, getOpts());
    summaryCopy.disabled = false;
  }

  [togLocation, togGear, togTags, togDotSight, togTripod, togInstagram, togRednote].forEach(el =>
    el.addEventListener("change", refreshSummary)
  );

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

  /* ── Summary copy button ── */
  summaryCopy.addEventListener("click", async () => {
    if (!summaryOut.value) return;
    try {
      await navigator.clipboard.writeText(summaryOut.value);
      const prev = summaryCopy.textContent;
      summaryCopy.textContent = "Copied";
      setTimeout(() => { summaryCopy.textContent = prev; }, 1000);
    } catch {
      summaryOut.select();
      document.execCommand("copy");
    }
  });

  /* ── Copy full EXIF button ── */
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
    metaOut.value        = "";
    summaryOut.value     = "";
    copyBtn.disabled     = true;
    summaryCopy.disabled = true;

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

      // Resolve location once; then render summary (sync from here on)
      summaryOut.value = "Building caption\u2026";
      const lat = data.latitude  ?? data.GPSLatitude;
      const lon = data.longitude ?? data.GPSLongitude;
      lastData     = data;
      lastLocation = (lat != null && lon != null) ? await reverseGeocode(lat, lon) : { place: "", countryCode: "" };
      refreshSummary();
    } catch (err) {
      setStatus(`Failed to read metadata: ${err.message}`, true);
    }
  }

  function setStatus(msg, isError = false) {
    statusEl.textContent  = msg;
    statusEl.style.color  = isError ? "#dc2626" : "var(--muted)";
  }
}
