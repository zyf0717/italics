import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  NIKON_SOCIALMEDIA_URL,
  parseNikonInstagramIndex,
  serializeNikonInstagramIndex,
} from "../js/nikon-social.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputPath = resolve(__dirname, "../public/nikon-instagram-index.json");

async function updateNikonInstagramIndex() {
  const res = await fetch(NIKON_SOCIALMEDIA_URL, {
    headers: {
      Accept: "text/html",
      "User-Agent": "italics-build/1.0",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch Nikon social page: ${res.status}`);
  }

  const html = await res.text();
  const index = parseNikonInstagramIndex(html);
  const payload = serializeNikonInstagramIndex(index);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`Wrote ${index.size} Nikon Instagram entries to ${outputPath}`);
}

updateNikonInstagramIndex().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
