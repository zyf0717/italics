import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildSubjectLine,
  buildSummary,
  formatExif,
  formatShutterSpeed,
  lookupOfficialNikonInstagramTag,
  lookupTaxonCommonNames,
  parseNikonInstagramIndex,
} from '../js/metadata.js';

const sharedBaseData = {
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
  const baseData = sharedBaseData;

  it('includes camera and shooting settings and tags for instagram', () => {
    const location = { place: 'Singapore Botanic Gardens', countryCode: 'sg', instagramNikonTag: '@nikonsg' };
    const subject = { scientificName: 'Halcyon smyrnensis', instagramCommonName: 'White-throated Kingfisher', rednoteCommonName: '白胸翡翠' };
    const s = buildSummary(baseData, location, { showLocation: true, showGear: true, showTags: true, platform: 'instagram', subject });
    expect(s).toContain('📍');
    expect(s).toContain('📷');
    expect(s).toContain('800mm');
    expect(s).toContain('@nikonsg');
    expect(s).toContain('@nikonasia');
    expect(s).toContain('@nikonschoolsg');
    expect(s).toContain('White-throated Kingfisher (𝘏𝘢𝘭𝘤𝘺𝘰𝘯 𝘴𝘮𝘺𝘳𝘯𝘦𝘯𝘴𝘪𝘴)');
    expect(s).toContain('White-throated Kingfisher (𝘏𝘢𝘭𝘤𝘺𝘰𝘯 𝘴𝘮𝘺𝘳𝘯𝘦𝘯𝘴𝘪𝘴)\n\n📍');
    expect(s).not.toContain('⚙️:');
    expect(s).toContain('📷: Nikon Z8 + 800mm f/6.3 PF\n\n@nikonsg @nikonasia @nikonschoolsg @nparksbuzz @natgeoasia @natgeo @natgeoanimals @natgeoyourshot @bbcearth');
  });

  it('formats date differently for rednote', () => {
    const location = { place: '', countryCode: '' };
    const subject = { scientificName: 'Halcyon smyrnensis', instagramCommonName: 'White-throated Kingfisher', rednoteCommonName: '白胸翡翠' };
    const s = buildSummary(baseData, location, { platform: 'rednote', subject });
    expect(s).toContain('📆');
    expect(s).toContain('白胸翡翠\nWhite-throated Kingfisher\n𝘏𝘢𝘭𝘤𝘺𝘰𝘯 𝘴𝘮𝘺𝘳𝘯𝘦𝘯𝘴𝘪𝘴');
    expect(s).toContain('⚙️: 800mm | f/6.3 | 1/4000s | ISO 100 | 手持\n\n#观鸟');
  });

  it('still renders rednote tags cleanly when gear output is disabled', () => {
    const location = { place: '', countryCode: '' };
    const s = buildSummary(baseData, location, { platform: 'rednote', showGear: false, showTags: true });
    expect(s).toContain('#观鸟 #鸟类摄影');
    expect(s).not.toContain('\n\n#观鸟');
  });

  it('appends a 1.4x teleconverter when focal length exceeds a known lens max', () => {
    const location = { place: '', countryCode: '' };
    const data = {
      ...baseData,
      LensModel: '180-600mm f/5.6-6.3',
      FocalLength: 840,
      FNumber: 9,
      ExposureTime: 1 / 3200,
      ISO: 640,
    };

    expect(buildSummary(data, location, { platform: 'instagram' })).toContain('📷: Nikon Z8 + 180-600mm f/5.6-6.3 + TC-1.4x');
    expect(buildSummary(data, location, { platform: 'rednote' })).toContain('📷: 尼康 Z8 + 180-600mm f/5.6-6.3 + TC-1.4x');
  });

  it('appends a 2.0x teleconverter when focal length matches a doubled max focal length', () => {
    const location = { place: '', countryCode: '' };
    const data = {
      ...baseData,
      LensModel: '500mm f/5.6 PF',
      FocalLength: 1000,
    };

    expect(buildSummary(data, location, { platform: 'instagram' })).toContain('📷: Nikon Z8 + 500mm f/5.6 PF + TC-2.0x');
    expect(buildSummary(data, location, { platform: 'rednote' })).toContain('📷: 尼康 Z8 + 500mm f/5.6 PF + TC-2.0x');
  });

  it('does not infer a teleconverter for zooms still inside the native range', () => {
    const location = { place: '', countryCode: '' };
    const data = {
      ...baseData,
      LensModel: '180-600mm f/5.6-6.3',
      FocalLength: 420,
    };

    expect(buildSummary(data, location, { platform: 'instagram' })).toContain('📷: Nikon Z8 + 180-600mm f/5.6-6.3');
    expect(buildSummary(data, location, { platform: 'instagram' })).not.toContain('TC-');
  });

  it('still treats primes as clear teleconverter cases', () => {
    const location = { place: '', countryCode: '' };
    const data = {
      ...baseData,
      LensModel: '500mm f/5.6 PF',
      FocalLength: 700,
    };

    expect(buildSummary(data, location, { platform: 'instagram' })).toContain('📷: Nikon Z8 + 500mm f/5.6 PF + TC-1.4x');
  });

  it('treats Bhutan as Asia for regional Instagram tags', () => {
    const location = { place: 'Trashigang', countryCode: 'bt', instagramNikonTag: '' };
    const s = buildSummary(baseData, location, { platform: 'instagram' });
    expect(s).toContain('@nikonasia');
    expect(s).toContain('@natgeoasia');
  });
});

describe('buildSubjectLine', () => {
  const subject = {
    scientificName: 'Halcyon smyrnensis',
    instagramCommonName: 'White-throated Kingfisher',
    rednoteCommonName: '白胸翡翠',
  };

  it('formats instagram species names inline', () => {
    expect(buildSubjectLine(subject, 'instagram')).toBe('White-throated Kingfisher (𝘏𝘢𝘭𝘤𝘺𝘰𝘯 𝘴𝘮𝘺𝘳𝘯𝘦𝘯𝘴𝘪𝘴)');
  });

  it('formats rednote species names on two lines', () => {
    expect(buildSubjectLine(subject, 'rednote')).toBe('白胸翡翠\nWhite-throated Kingfisher\n𝘏𝘢𝘭𝘤𝘺𝘰𝘯 𝘴𝘮𝘺𝘳𝘯𝘦𝘯𝘴𝘪𝘴');
  });
});

describe('lookupTaxonCommonNames', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('prefers the exact taxon-name match and extracts localized common names', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          search: [
            { id: 'Q1', description: 'bird genus' },
            { id: 'Q2', description: 'bird species' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entities: {
            Q1: {
              labels: { en: { value: 'Halcyon' } },
              claims: {
                P225: [{ mainsnak: { datavalue: { value: 'Halcyon' } } }],
              },
            },
            Q2: {
              labels: {
                en: { value: 'Halcyon smyrnensis' },
                zh: { value: '白胸翡翠' },
              },
              claims: {
                P225: [{ mainsnak: { datavalue: { value: 'Halcyon smyrnensis' } } }],
                P1843: [{ mainsnak: { datavalue: { value: { text: 'White-throated Kingfisher', language: 'en' } } } }],
              },
            },
          },
        }),
      });

    await expect(lookupTaxonCommonNames('Halcyon smyrnensis', fetchMock)).resolves.toEqual({
      scientificName: 'Halcyon smyrnensis',
      instagramCommonName: 'White-throated Kingfisher',
      rednoteCommonName: '白胸翡翠',
    });
  });
});

describe('parseNikonInstagramIndex', () => {
  it('extracts instagram handles by section heading', () => {
    const html = `
      <h2>Asia</h2>
      <h3>Singapore</h3>
      <a href="https://www.instagram.com/nikonsg/">nikonsg</a>
      <h3>Japan</h3>
      <a href="https://www.instagram.com/nikonjp/">nikonjp</a>
      <h2>Europe</h2>
      <h3>Europe</h3>
      <a href="https://www.instagram.com/nikoneurope/">nikoneurope</a>
    `;

    const index = parseNikonInstagramIndex(html);
    expect(index.get('singapore')).toBe('@nikonsg');
    expect(index.get('japan')).toBe('@nikonjp');
    expect(index.get('europe')).toBe('@nikoneurope');
  });
});

describe('lookupOfficialNikonInstagramTag', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns a country-specific official handle when present', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <h2>Asia</h2>
        <h3>Singapore</h3>
        <a href="https://www.instagram.com/nikonsg/">nikonsg</a>
      `,
    });

    await expect(lookupOfficialNikonInstagramTag('sg', fetchMock)).resolves.toBe('@nikonsg');
  });

  it('falls back to the official regional handle when no country-specific handle exists', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <h2>Europe</h2>
        <h3>Europe</h3>
        <a href="https://www.instagram.com/nikoneurope/">nikoneurope</a>
        <h3>Belgium</h3>
      `,
    });

    await expect(lookupOfficialNikonInstagramTag('be', fetchMock)).resolves.toBe('@nikoneurope');
  });

  it('matches Hong Kong despite the Intl display-name mismatch', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <h2>Asia</h2>
        <h3>Hong Kong</h3>
        <a href="https://www.instagram.com/nikonhongkong/">nikonhongkong</a>
      `,
    });

    await expect(lookupOfficialNikonInstagramTag('hk', fetchMock)).resolves.toBe('@nikonhongkong');
  });

  it('matches South Africa despite the different heading text on Nikon page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <h2>Africa</h2>
        <h3>Republic of South Africa</h3>
        <a href="https://www.instagram.com/nikonsouthafrica/">nikonsouthafrica</a>
      `,
    });

    await expect(lookupOfficialNikonInstagramTag('za', fetchMock)).resolves.toBe('@nikonsouthafrica');
  });

  it('matches Turkey despite the Intl display name using Türkiye', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <h2>Middle East</h2>
        <h3>Turkey</h3>
        <a href="https://www.instagram.com/nikon_turkiye/">nikon_turkiye</a>
      `,
    });

    await expect(lookupOfficialNikonInstagramTag('tr', fetchMock)).resolves.toBe('@nikon_turkiye');
  });

  it('uses the Europe regional Nikon handle for Kazakhstan to match the live Nikon page', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <h2>Europe</h2>
        <h3>Europe</h3>
        <a href="https://www.instagram.com/nikoneurope/">nikoneurope</a>
      `,
    });

    const location = { place: 'Almaty', countryCode: 'kz', instagramNikonTag: await lookupOfficialNikonInstagramTag('kz', fetchMock) };
    const summary = buildSummary(sharedBaseData, location, { platform: 'instagram' });
    expect(summary).toContain('@nikoneurope');
    expect(summary).not.toContain('@nikonasia');
  });

  it('uses the conservative fallback map when the official lookup fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(lookupOfficialNikonInstagramTag('sg', fetchMock)).resolves.toBe('@nikonsg');
  });
});
