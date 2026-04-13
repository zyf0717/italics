/**
 * metadata.js — JPEG EXIF metadata module
 *
 * Exports:
 *   initMetadataTab({ scientificNameInput }) → { syncScientificName }
 */

import * as exifr from "exifr";
import { toUnicodeItalic } from "./italics.js";
import { copyText } from "./ui.js";

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
  { match: (l) => /180.?600/i.test(l),                          instagram: "180-600mm f/5.6-6.3",              rednote: "180-600mm f/5.6-6.3",                minFocalLength: 180, maxFocalLength: 600 },
  { match: (l) => /800/i.test(l),                               instagram: "800mm f/6.3 PF",                   rednote: "800mm f/6.3 PF",                     minFocalLength: 800, maxFocalLength: 800 },
  { match: (l) => /500/i.test(l),                               instagram: "500mm f/5.6 PF",                   rednote: "500mm f/5.6 PF",                     minFocalLength: 500, maxFocalLength: 500 },
  { match: (l) => /M\.?300|olympus.*300/i.test(l),              instagram: "300mm f/4 PRO",                    rednote: "300mm f/4 PRO",                      minFocalLength: 300, maxFocalLength: 300 },
  { match: (l) => /100.?400/i.test(l) && /leica|dg/i.test(l),   instagram: "Leica DG 100-400mm f/4-6.3 II",    rednote: "松徕 100-400mm f/4-6.3 II", minFocalLength: 100, maxFocalLength: 400 },
  { match: (l) => /100.?400/i.test(l),                          instagram: "NIKKOR Z 100-400mm f/4.5-5.6 VR S", rednote: "NIKKOR Z 100-400mm f/4.5-5.6 VR S", minFocalLength: 100, maxFocalLength: 400 },
];

function inferTeleconverterMultiplier(ratio) {
  if (ratio <= 1.1) return "";
  if (Math.abs(ratio - 2) <= 0.12 || ratio >= 1.85) return " + TC-2.0x";
  if (Math.abs(ratio - 1.4) <= 0.1 || (ratio >= 1.3 && ratio <= 1.55)) return " + TC-1.4x";
  return "";
}

function resolveTeleconverterSuffix(lensPreset, focalLength) {
  if (!lensPreset || focalLength == null) return "";

  const { minFocalLength, maxFocalLength } = lensPreset;
  const isPrime = minFocalLength === maxFocalLength;

  if (isPrime) {
    return inferTeleconverterMultiplier(focalLength / maxFocalLength);
  }

  // For zooms, only infer a teleconverter when the effective focal length
  // exceeds the native zoom range. Lower focal lengths remain ambiguous.
  if (focalLength <= maxFocalLength * 1.05) return "";
  return inferTeleconverterMultiplier(focalLength / maxFocalLength);
}

/**
 * Resolves a platform-specific camera string from EXIF body + lens strings.
 * Falls back to the raw EXIF value for any unrecognised body or lens.
 * @param {string} body  Raw EXIF Make+Model string.
 * @param {string} lens  Raw EXIF LensModel string.
 * @param {string} platform  "instagram" | "rednote"
 * @param {number|null} focalLength
 * @returns {string}
 */
function resolveGear(body, lens, platform, focalLength = null) {
  const b = BODY_PRESETS.find(p => p.match(body));
  const l = LENS_PRESETS.find(p => p.match(lens));
  const bodyStr = b?.[platform] ?? body;
  const lensStr = (l?.[platform] ?? lens) + resolveTeleconverterSuffix(l, focalLength);
  return [bodyStr, lensStr].filter(Boolean).join(" + ");
}

function cleanExifText(value) {
  return String(value || "").replace(/\0/g, "").trim();
}

function getCameraBody(make, model) {
  const cleanedMake = cleanExifText(make);
  const cleanedModel = cleanExifText(model);
  if (!cleanedMake) return cleanedModel;
  return cleanedModel.toLowerCase().startsWith(cleanedMake.toLowerCase())
    ? cleanedModel
    : `${cleanedMake} ${cleanedModel}`.trim();
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
export function formatShutterSpeed(t) {
  if (t == null) return null;
  if (t >= 1)    return `${Math.round(t * 10) / 10}s`;
  return `1/${Math.round(1 / t)}s`;
}

/**
 * ISO 3166-1 alpha-2 country codes considered "Asia" for tag purposes.
 */
const ASIA_COUNTRY_CODES = new Set([
  "sg","my","th","id","ph","vn","kh","la","mm","bn",
  "cn","jp","kr","tw","hk","mo","in","lk","np","bd","bt","mv",
  "pk","af","mn","kp","tl","tr","ge","am","az",
  "kz","uz","tm","kg","tj",
]);

const EUROPE_COUNTRY_CODES = new Set([
  "al","ad","at","ba","be","bg","by","ch","cy","cz","de","dk","ee","es","fi","fr","gb","gr",
  "hr","hu","ie","is","it","li","lt","lu","lv","mc","md","me","mk","mt","nl","no","pl","pt",
  "ro","rs","ru","se","si","sk","sm","ua","va","xk",
]);

const MIDDLE_EAST_COUNTRY_CODES = new Set([
  "ae","bh","eg","il","iq","ir","jo","kw","lb","om","ps","qa","sa","sy","tr","ye",
]);

const INSTAGRAM_TAGS_BASE = "@natgeo @natgeoanimals @natgeoyourshot @bbcearth";
const NIKON_SOCIALMEDIA_URL = "https://www.nikon.com/socialmedia/";
const COUNTRY_NAME_ALIASES = {
  ba: ["Bosnia and Herzegovina", "Bosnia & Herzegovina"],
  cn: ["Chinese Mainland", "China", "Mainland China"],
  cz: ["Czech Republic", "Czechia"],
  gb: ["United Kingdom", "U.K.", "UK", "Britain"],
  hk: ["Hong Kong", "Hong Kong SAR China"],
  kr: ["Korea", "South Korea", "Republic of Korea"],
  mk: ["Macedonia", "North Macedonia"],
  mm: ["Myanmar", "Myanmar (Burma)"],
  nl: ["The Netherlands", "Netherlands"],
  tr: ["Turkey", "Türkiye"],
  tw: ["Taiwan"],
  us: ["U.S.A.", "USA", "United States", "United States of America"],
  za: ["Republic of South Africa", "South Africa"],
};
const NIKON_INSTAGRAM_FALLBACKS = {
  sg: "@nikonsg",
  jp: "@nikonjp",
  us: "@nikonusa",
  asia: "@nikonasia",
  europe: "@nikoneurope",
  "middle east": "@nikonmea",
};
let nikonInstagramIndexPromise = null;

const REDNOTE_BODY_TAGS = [
  { match: (b) => /Z\s*8/i.test(b),            tag: "#尼康Z8"    },
  { match: (b) => /Z\s*6\s*(iii|3)/i.test(b),  tag: "#尼康Z6iii" },
  { match: (b) => /Z\s*6\s*(ii|2)/i.test(b),   tag: "#尼康Z6ii"  },
  { match: (b) => /OM.?1/i.test(b),            tag: "#OM1"       },
];

const WIKIDATA_API_URL = "https://www.wikidata.org/w/api.php";
const TAXON_NAME_PROPERTY = "P225";
const TAXON_COMMON_NAME_PROPERTY = "P1843";
const ENGLISH_LANGUAGE_CODES = ["en"];
const CHINESE_LANGUAGE_CODES = ["zh-cn", "zh-hans", "zh"];

/**
 * Normalizes a scientific name to a compact, whitespace-stable string.
 * @param {string} value
 * @returns {string}
 */
export function normalizeScientificName(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function normalizeHeadingText(value) {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLookupKey(value) {
  return normalizeHeadingText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractInstagramHandle(url) {
  const match = String(url || "").match(/instagram\.com\/([^/?#]+)/i);
  return match ? `@${match[1].toLowerCase()}` : "";
}

function getFallbackRegionName(countryCode) {
  if (countryCode === "kz") return "Europe";
  if (ASIA_COUNTRY_CODES.has(countryCode)) return "Asia";
  if (EUROPE_COUNTRY_CODES.has(countryCode)) return "Europe";
  if (MIDDLE_EAST_COUNTRY_CODES.has(countryCode)) return "Middle East";
  return "";
}

function getCountryLookupCandidates(countryCode) {
  const normalizedCountryCode = String(countryCode || "").toLowerCase();
  if (!normalizedCountryCode) return [];

  const displayName = typeof Intl?.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" }).of(normalizedCountryCode.toUpperCase()) ?? ""
    : "";

  return [...new Set([
    ...(COUNTRY_NAME_ALIASES[normalizedCountryCode] ?? []),
    displayName,
    getFallbackRegionName(normalizedCountryCode),
  ].filter(Boolean))];
}

export function parseNikonInstagramIndex(html) {
  const index = new Map();
  let currentSection = "";

  const tokenRegex = /<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>|<a\b[^>]*href=(["'])([^"']*instagram\.com\/[^"']*)\3[^>]*>[\s\S]*?<\/a>/gi;
  for (const match of html.matchAll(tokenRegex)) {
    if (match[1]) {
      currentSection = normalizeHeadingText(match[2]);
      continue;
    }

    const handle = extractInstagramHandle(match[4]);
    const key = normalizeLookupKey(currentSection);
    if (key && handle && !index.has(key)) {
      index.set(key, handle);
    }
  }

  return index;
}

async function fetchNikonInstagramIndex(fetchImpl = fetch) {
  if (fetchImpl !== fetch) {
    const res = await fetchImpl(NIKON_SOCIALMEDIA_URL, { headers: { Accept: "text/html" } });
    if (!res.ok) throw new Error(`Nikon social lookup failed with ${res.status}`);
    return parseNikonInstagramIndex(await res.text());
  }

  if (!nikonInstagramIndexPromise) {
    nikonInstagramIndexPromise = (async () => {
      const res = await fetchImpl(NIKON_SOCIALMEDIA_URL, { headers: { Accept: "text/html" } });
      if (!res.ok) throw new Error(`Nikon social lookup failed with ${res.status}`);
      return parseNikonInstagramIndex(await res.text());
    })().catch((err) => {
      nikonInstagramIndexPromise = null;
      throw err;
    });
  }

  return nikonInstagramIndexPromise;
}

function getFallbackNikonInstagramTag(countryCode) {
  const normalizedCountryCode = String(countryCode || "").toLowerCase();
  return NIKON_INSTAGRAM_FALLBACKS[normalizedCountryCode]
    ?? NIKON_INSTAGRAM_FALLBACKS[normalizeLookupKey(getFallbackRegionName(normalizedCountryCode))]
    ?? "";
}

function getRegionalNikonInstagramTag(countryCode) {
  const normalizedCountryCode = String(countryCode || "").toLowerCase();
  return NIKON_INSTAGRAM_FALLBACKS[normalizeLookupKey(getFallbackRegionName(normalizedCountryCode))] ?? "";
}

function isNatGeoAsiaCountry(countryCode) {
  return ASIA_COUNTRY_CODES.has(countryCode) && getFallbackRegionName(countryCode) === "Asia";
}

function buildInstagramTags(countryCode, instagramNikonTag) {
  return [...new Set([
    instagramNikonTag,
    getRegionalNikonInstagramTag(countryCode),
    "@nikonschoolsg",
    countryCode === "sg" ? "@nparksbuzz" : "",
    isNatGeoAsiaCountry(countryCode) ? "@natgeoasia" : "",
    ...INSTAGRAM_TAGS_BASE.split(" "),
  ].filter(Boolean))].join(" ");
}

function buildRednoteTags(body) {
  const bodyTag = REDNOTE_BODY_TAGS.find((preset) => preset.match(body))?.tag ?? "";
  return ["#观鸟", "#鸟类摄影", bodyTag].filter(Boolean).join(" ");
}

export async function lookupOfficialNikonInstagramTag(countryCode, fetchImpl = fetch) {
  const normalizedCountryCode = String(countryCode || "").toLowerCase();
  if (!normalizedCountryCode) return "";

  try {
    const index = await fetchNikonInstagramIndex(fetchImpl);
    for (const candidate of getCountryLookupCandidates(normalizedCountryCode)) {
      const handle = index.get(normalizeLookupKey(candidate));
      if (handle) return handle;
    }
  } catch {
    return getFallbackNikonInstagramTag(normalizedCountryCode);
  }

  return getFallbackNikonInstagramTag(normalizedCountryCode);
}

function getEntityClaims(entity, propertyId) {
  return entity?.claims?.[propertyId] ?? [];
}

function getStringClaimValues(entity, propertyId) {
  return getEntityClaims(entity, propertyId)
    .map((claim) => claim?.mainsnak?.datavalue?.value)
    .filter((value) => typeof value === "string");
}

function getMonolingualClaimValues(entity, propertyId) {
  return getEntityClaims(entity, propertyId)
    .map((claim) => claim?.mainsnak?.datavalue?.value)
    .filter((value) => value && typeof value.text === "string" && typeof value.language === "string");
}

function getLocalizedLabel(entity, languageCodes) {
  const labels = entity?.labels ?? {};
  for (const code of languageCodes) {
    const label = labels[code]?.value;
    if (label) return label;
  }
  return "";
}

function getLocalizedCommonName(entity, languageCodes, scientificName) {
  const normalizedScientificName = normalizeScientificName(scientificName).toLowerCase();
  const claimValues = getMonolingualClaimValues(entity, TAXON_COMMON_NAME_PROPERTY);
  const languagePreference = languageCodes.map((code) => code.toLowerCase());

  const byLanguage = (language) => {
    const normalizedLanguage = language.toLowerCase();
    return languagePreference.includes(normalizedLanguage) || languagePreference.includes(normalizedLanguage.split("-")[0]);
  };

  const commonNameFromClaims = claimValues.find(({ language, text }) => {
    const normalizedText = normalizeScientificName(text).toLowerCase();
    return normalizedText && normalizedText !== normalizedScientificName && byLanguage(language);
  })?.text;
  if (commonNameFromClaims) return commonNameFromClaims;

  const label = getLocalizedLabel(entity, languageCodes);
  if (normalizeScientificName(label).toLowerCase() === normalizedScientificName) return "";
  return label;
}

function scoreEntityMatch(entity, searchResult, scientificName) {
  const normalizedScientificName = normalizeScientificName(scientificName).toLowerCase();
  const taxonNames = getStringClaimValues(entity, TAXON_NAME_PROPERTY)
    .map((value) => normalizeScientificName(value).toLowerCase());
  const aliases = Object.values(entity?.aliases ?? {})
    .flat()
    .map((alias) => normalizeScientificName(alias?.value).toLowerCase())
    .filter(Boolean);
  const englishLabel = normalizeScientificName(getLocalizedLabel(entity, ["en"])).toLowerCase();
  const description = String(entity?.descriptions?.en?.value ?? searchResult?.description ?? "").toLowerCase();

  let score = 0;
  if (taxonNames.includes(normalizedScientificName)) score += 1000;
  if (englishLabel === normalizedScientificName) score += 120;
  if (aliases.includes(normalizedScientificName)) score += 80;
  if (searchResult?.match?.type === "label") score += 40;
  if (searchResult?.match?.type === "alias") score += 20;
  if (/(species|subspecies|genus|family|bird|taxon|organism)/.test(description)) score += 10;
  return score;
}

async function fetchWikidataJson(params, fetchImpl) {
  const url = new URL(WIKIDATA_API_URL);
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Lookup failed with ${res.status}`);
  return res.json();
}

/**
 * Looks up English and Chinese common names for a scientific name via Wikidata.
 * Falls back to the scientific name when no common name is available.
 * @param {string} scientificName
 * @param {(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>} [fetchImpl]
 * @returns {Promise<{ scientificName: string, instagramCommonName: string, rednoteCommonName: string } | null>}
 */
export async function lookupTaxonCommonNames(scientificName, fetchImpl = fetch) {
  const normalizedScientificName = normalizeScientificName(scientificName);
  if (!normalizedScientificName) return null;

  const searchJson = await fetchWikidataJson({
    action: "wbsearchentities",
    language: "en",
    uselang: "en",
    type: "item",
    limit: "7",
    search: normalizedScientificName,
  }, fetchImpl);

  const searchResults = searchJson.search ?? [];
  const ids = searchResults.map((result) => result.id).filter(Boolean);
  if (ids.length === 0) {
    return {
      scientificName: normalizedScientificName,
      instagramCommonName: "",
      rednoteCommonName: "",
    };
  }

  const entityJson = await fetchWikidataJson({
    action: "wbgetentities",
    ids: ids.join("|"),
    props: "labels|aliases|claims|descriptions",
    languages: [...new Set([...ENGLISH_LANGUAGE_CODES, ...CHINESE_LANGUAGE_CODES])].join("|"),
  }, fetchImpl);

  const rankedMatches = searchResults
    .map((result) => ({ result, entity: entityJson.entities?.[result.id] }))
    .filter(({ entity }) => entity)
    .sort((left, right) => (
      scoreEntityMatch(right.entity, right.result, normalizedScientificName) -
      scoreEntityMatch(left.entity, left.result, normalizedScientificName)
    ));

  const bestMatch = rankedMatches[0]?.entity;
  if (!bestMatch) {
    return {
      scientificName: normalizedScientificName,
      instagramCommonName: "",
      rednoteCommonName: "",
    };
  }

  return {
    scientificName: normalizedScientificName,
    instagramCommonName: getLocalizedCommonName(bestMatch, ENGLISH_LANGUAGE_CODES, normalizedScientificName),
    rednoteCommonName: getLocalizedCommonName(bestMatch, CHINESE_LANGUAGE_CODES, normalizedScientificName),
  };
}

/**
 * Formats the optional species line for the selected platform.
 * @param {{ scientificName?: string, instagramCommonName?: string, rednoteCommonName?: string } | null} subject
 * @param {string} platform
 * @returns {string}
 */
export function buildSubjectLine(subject, platform) {
  const scientificName = normalizeScientificName(subject?.scientificName);
  if (!scientificName) return "";

  const italicScientificName = toUnicodeItalic(scientificName);
  const englishCommonName = normalizeScientificName(subject?.instagramCommonName);
  const chineseCommonName = normalizeScientificName(subject?.rednoteCommonName);

  if (platform === "rednote") {
    return [chineseCommonName, englishCommonName, italicScientificName].filter(Boolean).join("\n");
  }

  if (!englishCommonName) return italicScientificName;
  return `${englishCommonName} (${italicScientificName})`;
}

function getDateLine(data, platform) {
  const dt = data.DateTimeOriginal ?? data.CreateDate;
  const dateStr = (dt instanceof Date)
    ? platform === "rednote"
      ? dt.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })
      : dt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "";
  return `\u{1F4C6}: ${dateStr}`;
}

function getCameraSummary(data, platform, dotSight) {
  const body = getCameraBody(data.Make, data.Model);
  const lens = cleanExifText(data.LensModel);
  const focalLength = typeof data.FocalLength === "number" ? data.FocalLength : null;
  return `${resolveGear(body, lens, platform, focalLength)}${dotSight ? " + DF-M1" : ""}`;
}

function getRednoteSettingsLine(data, tripod) {
  const focal    = data.FocalLength != null ? `${Math.round(data.FocalLength)}mm` : null;
  const aperture = data.FNumber     != null ? `f/${data.FNumber}` : null;
  const shutter  = formatShutterSpeed(data.ExposureTime);
  const iso      = data.ISO         != null ? `ISO ${data.ISO}` : null;
  const handheld = tripod ? "三角架" : "手持";
  return `\u2699\uFE0F: ${[focal, aperture, shutter, iso, handheld].filter(Boolean).join(" | ")}`;
}

async function resolveSummaryLocation(data) {
  const lat = data.latitude ?? data.GPSLatitude;
  const lon = data.longitude ?? data.GPSLongitude;
  const location = (lat != null && lon != null)
    ? await reverseGeocode(lat, lon)
    : { place: "", countryCode: "" };

  if (location.countryCode) {
    location.instagramNikonTag = await lookupOfficialNikonInstagramTag(location.countryCode);
  }

  return location;
}

/**
 * Builds the settings summary (synchronous — location must be pre-resolved).
 * @param {Record<string, unknown>} data
 * @param {{ place: string, countryCode: string, instagramNikonTag?: string }} location  Pre-fetched location object.
 * @param {{ showLocation: boolean, showGear: boolean, showTags: boolean, platform: string, subject?: { scientificName?: string, instagramCommonName?: string, rednoteCommonName?: string } | null }} opts
 * @returns {string}
 */
export function buildSummary(data, location, opts = {}) {
  const { showLocation = true, showGear = true, showTags = true, tripod = false, dotSight = false, platform = "instagram", subject = null } = opts;
  const { place = "", countryCode = "", instagramNikonTag = "" } = location;

  const sections = [];
  const subjectLine = buildSubjectLine(subject, platform);
  if (subjectLine) sections.push(subjectLine);

  if (showLocation) sections.push(`\u{1F4CD}: ${place}`);
  sections.push(getDateLine(data, platform));

  if (showGear) {
    const body = getCameraBody(data.Make, data.Model);
    sections.push(`\u{1F4F7}: ${getCameraSummary(data, platform, dotSight)}`);

    if (platform === "rednote") {
      sections.push(getRednoteSettingsLine(data, tripod));
      if (showTags) sections.push("");
      if (showTags) sections.push(buildRednoteTags(body));
    }
  }

  if (showTags && platform === "instagram") {
    sections.push(buildInstagramTags(countryCode, instagramNikonTag));
  }

  if (showTags && platform === "rednote" && !showGear) {
    sections.push(buildRednoteTags(getCameraBody(data.Make, data.Model)));
  }

  return sections.join(platform === "instagram" ? "\n\n" : "\n");
}

/**
 * Formats a raw EXIF data object into a readable key: value string.
 * @param {Record<string, unknown>} data
 * @returns {string}
 */
export function formatExif(data) {
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
 * @param {{ scientificNameInput?: HTMLTextAreaElement | HTMLInputElement | null }} deps
 */
export function initMetadataTab(deps = {}) {
  const dropZone    = document.getElementById("meta-dropzone");
  const fileInput   = document.getElementById("meta-file");
  const metaOut     = document.getElementById("meta-output");
  const copyBtn     = document.getElementById("meta-copyBtn");
  const statusEl    = document.getElementById("meta-status");
  const summaryOut  = document.getElementById("meta-summary");
  const summaryCopy = document.getElementById("meta-summaryCopyBtn");
  const scientificNameInput = deps.scientificNameInput ?? null;

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
  let lastSubject  = null;
  let lookupSequence = 0;
  const subjectCache = new Map();

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
    summaryOut.value     = buildSummary(lastData, lastLocation, { ...getOpts(), subject: lastSubject });
    summaryCopy.disabled = false;
  }

  [togLocation, togGear, togTags, togDotSight, togTripod, togInstagram, togRednote].forEach(el =>
    el.addEventListener("change", refreshSummary)
  );

  async function syncScientificName() {
    const scientificName = normalizeScientificName(scientificNameInput?.value);
    const cacheKey = scientificName.toLowerCase();
    const currentSequence = ++lookupSequence;

    if (!scientificName) {
      lastSubject = null;
      refreshSummary();
      return;
    }

    const cachedSubject = subjectCache.get(cacheKey);
    if (cachedSubject) {
      lastSubject = cachedSubject;
      refreshSummary();
      return;
    }

    lastSubject = { scientificName };
    refreshSummary();

    try {
      const resolvedSubject = await lookupTaxonCommonNames(scientificName);
      if (currentSequence !== lookupSequence) return;

      const subject = resolvedSubject ?? { scientificName };
      subjectCache.set(cacheKey, subject);
      lastSubject = subject;
      refreshSummary();
    } catch {
      if (currentSequence !== lookupSequence) return;
      lastSubject = { scientificName };
      refreshSummary();
    }
  }

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
    await copyText(summaryOut.value, summaryOut, summaryCopy);
  });

  /* ── Copy full EXIF button ── */
  copyBtn.addEventListener("click", async () => {
    if (!metaOut.value) return;
    await copyText(metaOut.value, metaOut, copyBtn);
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
      lastData     = data;
      lastLocation = await resolveSummaryLocation(data);
      refreshSummary();
      void syncScientificName();
    } catch (err) {
      setStatus(`Failed to read metadata: ${err.message}`, true);
    }
  }

  function setStatus(msg, isError = false) {
    statusEl.textContent  = msg;
    statusEl.style.color  = isError ? "#dc2626" : "var(--muted)";
  }

  return { syncScientificName };
}
