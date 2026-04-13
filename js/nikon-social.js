export const NIKON_SOCIALMEDIA_URL = "https://www.nikon.com/socialmedia/";
export const NIKON_INSTAGRAM_INDEX_URL = "./nikon-instagram-index.json";

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

export function normalizeLookupKey(value) {
  return normalizeHeadingText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function extractInstagramHandle(url) {
  const match = String(url || "").match(/instagram\.com\/([^/?#]+)/i);
  return match ? `@${match[1].toLowerCase()}` : "";
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

export function serializeNikonInstagramIndex(index, fetchedAt = new Date().toISOString()) {
  return {
    fetchedAt,
    sourceUrl: NIKON_SOCIALMEDIA_URL,
    index: Object.fromEntries(index),
  };
}

export function normalizeNikonInstagramIndexData(data) {
  const rawIndex = data?.index ?? data;
  if (!rawIndex || typeof rawIndex !== "object" || Array.isArray(rawIndex)) {
    return new Map();
  }

  return new Map(
    Object.entries(rawIndex)
      .map(([key, value]) => [normalizeLookupKey(key), String(value || "").trim()])
      .filter(([, value]) => value.startsWith("@"))
  );
}
