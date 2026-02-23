import { describe, it, expect, beforeEach, vi } from 'vitest';
import { buildSummary, formatExif, formatShutterSpeed } from '../js/metadata.js';

describe('formatExif', () => {
  it('formats simple key values and skips buffers', () => {
    const data = { a: 1, b: 'x', bin: new Uint8Array([1,2,3]), d: new Date('2020-01-01T00:00:00Z') };
    const out = formatExif(data);
    expect(out).toContain('a: 1');
    expect(out).toContain('b: x');
    expect(out).toContain('d: 2020-01-01T00:00:00.000Z');
    expect(out).not.toContain('bin:');
  });
});

describe('buildSummary', () => {
  const baseData = {
    DateTimeOriginal: new Date('2023-01-02T00:00:00Z'),
    CreateDate: null,
    Make: 'Nikon',
    Model: 'Z8',
    LensModel: '800mm f/6.3 PF',
    FocalLength: 800,
    FNumber: 6.3,
    ExposureTime: 1/4000,
    ISO: 100,
  };

  it('includes camera and shooting settings and tags for instagram', () => {
    const location = { place: 'Singapore Botanic Gardens', countryCode: 'sg' };
    const s = buildSummary(baseData, location, { showLocation: true, showGear: true, showTags: true, platform: 'instagram' });
    expect(s).toContain('📍');
    expect(s).toContain('📷');
    expect(s).toContain('800mm');
    expect(s).toContain('@nikonsg');
  });

  it('formats date differently for rednote', () => {
    const location = { place: '', countryCode: '' };
    const s = buildSummary(baseData, location, { platform: 'rednote' });
    expect(s).toContain('📆');
  });
});
