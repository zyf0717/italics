import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readJpegMetadata } from '../js/metadata.js';

function segment(marker, payload) {
  const header = Buffer.from([0xff, marker, 0, 0]);
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([header, payload]);
}

function cameraExif() {
  // Little-endian TIFF with one IFD0 entry: Make = "NIKON".
  const tiff = Buffer.alloc(32);
  tiff.write('II');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8);
  tiff.writeUInt16LE(0x010f, 10);
  tiff.writeUInt16LE(2, 12);
  tiff.writeUInt32LE(6, 14);
  tiff.writeUInt32LE(26, 18);
  tiff.write('NIKON\0', 26);
  return segment(0xe1, Buffer.concat([Buffer.from('Exif\0\0'), tiff]));
}

describe('readJpegMetadata', () => {
  let directory;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'italics-jpeg-'));
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  async function writeJpeg(segments) {
    const path = join(directory, 'photo.jpg');
    await writeFile(path, Buffer.concat([
      Buffer.from([0xff, 0xd8]), ...segments, Buffer.from([0xff, 0xd9]),
    ]));
    return path;
  }

  it.each([false, true])('reads EXIF with large preceding APP11 segments: %s', async (largeHeader) => {
    // Match the layout of C2PA exports that put EXIF beyond the browser's 64 KiB scan.
    const prefix = largeHeader
      ? [segment(0xeb, Buffer.alloc(64000)), segment(0xeb, Buffer.alloc(64000))]
      : [];
    const path = await writeJpeg([...prefix, cameraExif()]);

    await expect(readJpegMetadata(path)).resolves.toEqual({ Make: 'NIKON' });
  });

  it('returns no metadata when the JPEG has no EXIF', async () => {
    const path = await writeJpeg([]);

    await expect(readJpegMetadata(path)).resolves.toBeUndefined();
  });
});
