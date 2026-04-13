# Italics Tool

A lightweight, client-side web app with two utilities.

**Live site → [italics.dev](https://italics.dev)**

---

## Features

### Italics tab
Converts plain text to Unicode sans-serif italic characters (e.g. `hello` → `𝘩𝘦𝘭𝘭𝘰`). Non-alphabetic characters pass through unchanged. You can paste from the clipboard into the input and copy the converted output with one click.

### Metadata tab
Reads EXIF data from a JPEG image (drag-and-drop or file picker) and produces two outputs:

- **Settings** — a formatted summary of shooting parameters (location, camera/lens gear, and keyword tags), with toggle controls for each section and platform presets for Instagram and RedNote.
- **Scientific-name lookup** — if the Italics tab input contains a scientific name, the Metadata tab searches Wikidata and inserts the most likely common name into the generated settings, using English for Instagram and Chinese for RedNote. The scientific name is appended in Unicode italics inline for Instagram and on its own line for RedNote.
- **EXIF** — the raw EXIF fields as plain text.

Current formatting behavior:

- **Instagram** — outputs species as `Common Name (italic scientific name)`, inserts blank lines between sections, omits the `⚙️` settings line, and includes country, regional, and global Instagram tags when available.
- **RedNote** — outputs species on three lines (`Chinese name`, `English name`, `italic scientific name`), keeps the `⚙️` settings line, and places the hashtag block after a blank line.

GPS coordinates are reverse-geocoded to a place name via [Nominatim](https://nominatim.openstreetmap.org/). Instagram Nikon tags are looked up dynamically from Nikon's official social-media accounts page based on the resolved country code, with conservative fallbacks when no local account exists or the lookup fails; the generated Instagram tags also always include `@nikonschoolsg`. Camera bodies and lenses are matched against known presets and formatted for each platform. For supported lenses, the metadata tool also infers `TC-1.4x` or `TC-2.0x` on the `📷` line when EXIF focal length clearly indicates a teleconverter. Unrecognised gear falls back to the raw EXIF value. All processing is done locally in the browser; no data is uploaded.

#### Supported camera bodies

| EXIF match | Instagram | RedNote |
|---|---|---|
| Nikon Z8 | Nikon Z8 | 尼康 Z8 |
| Nikon Z6III / Z6 III | Nikon Z6III | 尼康 Z6III |
| Nikon Z6II / Z6 II | Nikon Z6II | 尼康 Z6II |
| OM System / OM Digital Solutions OM-1 | OM-1 | 奥巴 OM-1 |

#### Supported lenses

| EXIF match | Instagram | RedNote |
|---|---|---|
| 180-600mm | 180-600mm f/5.6-6.3 | 180-600mm f/5.6-6.3 |
| 800mm | 800mm f/6.3 PF | 800mm f/6.3 PF |
| 500mm | 500mm f/5.6 PF | 500mm f/5.6 PF |
| OLYMPUS M.300mm F4.0 | 300mm f/4 PRO | 300mm f/4 PRO |
| 100-400mm + Leica/DG | Leica DG 100-400mm f/4-6.3 II | 松徕 100-400mm f/4-6.3 II |
| 100-400mm | NIKKOR Z 100-400mm f/4.5-5.6 VR S | NIKKOR Z 100-400mm f/4.5-5.6 VR S |

---

## Tech stack

| | |
|---|---|
| Bundler | [Vite](https://vitejs.dev/) |
| EXIF parsing | [exifr](https://github.com/MikeKovarik/exifr) |
| Geocoding | Nominatim (OpenStreetMap) |
| Deployment | GitHub Pages |

---

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build   # output in dist/
npm run preview # preview the production build
```
