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
    expect(s).toContain('White-throated Kingfisher (𝘏𝘢𝘭𝘤𝘺𝘰𝘯 𝘴𝘮𝘺𝘳𝘯𝘦𝘯𝘴𝘪𝘴).');
    expect(s).toContain('White-throated Kingfisher (𝘏𝘢𝘭𝘤𝘺𝘰𝘯 𝘴𝘮𝘺𝘳𝘯𝘦𝘯𝘴𝘪𝘴).\n\n📍');
    expect(s).not.toContain('⚙️:');
    expect(s).toContain('📷: Nikon Z8 + 800mm f/6.3 PF\n\n#whitethroatedkingfisher\n\n@nikonsg @nikonasia @nikonschoolsg @nparksbuzz @natgeoasia @natgeo @natgeoanimals @natgeoyourshot @bbcearth');
  });

  it('starts Instagram Nikon tags with the Singapore handle in every country', () => {
    const location = { place: 'Tokyo', countryCode: 'jp', instagramNikonTag: '@nikonjp' };
    const s = buildSummary(baseData, location, { platform: 'instagram' });

    expect(s).toContain('@nikonsg @nikonjp @nikonasia @nikonschoolsg');
  });

  it('includes Nikon tags when only the lens identifies Nikon gear', () => {
    const data = { ...baseData, Make: 'OM Digital Solutions', Model: 'OM-1', LensModel: 'NIKKOR Z 100-400mm f/4.5-5.6 VR S' };
    const s = buildSummary(data, { place: 'Tokyo', countryCode: 'jp', instagramNikonTag: '@nikonjp' }, { platform: 'instagram' });

    expect(s).toContain('@nikonsg @nikonjp @nikonasia @nikonschoolsg');
  });

  it('omits all Nikon tags when neither the camera nor lens is Nikon', () => {
    const data = { ...baseData, Make: 'OM Digital Solutions', Model: 'OM-1', LensModel: 'LEICA DG 100-400mm f/4-6.3 II' };
    const s = buildSummary(data, { place: 'Tokyo', countryCode: 'jp', instagramNikonTag: '@nikonjp' }, { platform: 'instagram' });

    expect(s).not.toMatch(/@nikon(?:\w|[._-])*/i);
    expect(s).toContain('@natgeo @natgeoanimals @natgeoyourshot @bbcearth');
  });

  it('formats date differently for rednote', () => {
    const location = { place: '', countryCode: '' };
    const subject = { scientificName: 'Halcyon smyrnensis', instagramCommonName: 'White-throated Kingfisher', rednoteCommonName: '白胸翡翠' };
    const s = buildSummary(baseData, location, { platform: 'rednote', subject });
    expect(s).toContain('📆');
    expect(s).toContain('白胸翡翠\nWhite-throated Kingfisher\n𝘏𝘢𝘭𝘤𝘺𝘰𝘯 𝘴𝘮𝘺𝘳𝘯𝘦𝘯𝘴𝘪𝘴');
    expect(s).toContain('⚙️: 800mm | f/6.3 | 1/4000s | ISO 100 | 手持\n\n#观鸟 #鸟类摄影 #白胸翡翠');
  });

  it('formats rednote batch settings from all uploaded images while keeping primary gear from the first', () => {
    const location = { place: '', countryCode: '' };
    const subject = { scientificName: 'Halcyon smyrnensis', instagramCommonName: 'White-throated Kingfisher', rednoteCommonName: '白胸翡翠' };
    const batchData = [
      {
        ...baseData,
        FocalLength: 600,
        ExposureTime: 1 / 3200,
        ISO: 1250,
      },
      {
        ...baseData,
        FocalLength: 570,
        ExposureTime: 1 / 2000,
        ISO: 800,
      },
      {
        ...baseData,
        FocalLength: 800,
        ExposureTime: 1 / 4000,
        ISO: 1000,
      },
    ];
    const s = buildSummary(batchData[0], location, { platform: 'rednote', subject, batchData });

    expect(s).toContain('📷: 尼康 Z8 + 800mm f/6.3 PF');
    expect(s).toContain('[1/3]: 600mm | f/6.3 | 1/3200s | ISO 1250 | 手持\n[2/3]: 570mm | f/6.3 | 1/2000s | ISO 800 | 手持\n[3/3]: 800mm | f/6.3 | 1/4000s | ISO 1000 | 手持');
    expect(s).toContain('\n\n#观鸟 #鸟类摄影 #白胸翡翠');
  });

  it('still renders rednote tags cleanly when gear output is disabled', () => {
    const location = { place: '', countryCode: '' };
    const subject = { scientificName: 'Halcyon smyrnensis', rednoteCommonName: '白胸翡翠' };
    const s = buildSummary(baseData, location, { platform: 'rednote', showGear: false, showTags: true, subject });
    expect(s).toContain('#观鸟 #鸟类摄影 #白胸翡翠');
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

  it('normalizes the instagram common-name hashtag to lowercase ascii letters only', () => {
    const location = { place: '', countryCode: '' };
    const subject = { scientificName: 'Bubo bubo × bengalensis', instagramCommonName: 'Eurasian Eagle-Owl' };
    const s = buildSummary(baseData, location, { platform: 'instagram', subject });

    expect(s).toContain('#eurasianeagleowl');
  });

  it('uses the rednote chinese common name as the species hashtag', () => {
    const location = { place: '', countryCode: '' };
    const subject = { scientificName: 'Bubo bubo × bengalensis', rednoteCommonName: '雕鸮' };
    const s = buildSummary(baseData, location, { platform: 'rednote', subject });

    expect(s).toContain('#雕鸮');
  });

  it('omits the instagram species hashtag when no english common name is available', () => {
    const location = { place: '', countryCode: '' };
    const subject = { scientificName: 'Halcyon smyrnensis' };
    const s = buildSummary(baseData, location, { platform: 'instagram', subject });

    expect(s).not.toContain('#halcyonsmyrnensis');
    expect(s).not.toContain('\n\n#\n\n@');
  });

  it('ignores later batch images for instagram captions', () => {
    const location = { place: '', countryCode: '' };
    const subject = { scientificName: 'Halcyon smyrnensis', instagramCommonName: 'White-throated Kingfisher' };
    const batchData = [
      baseData,
      {
        ...baseData,
        FocalLength: 570,
        ExposureTime: 1 / 2000,
        ISO: 800,
      },
    ];
    const s = buildSummary(batchData[0], location, { platform: 'instagram', subject, batchData });

    expect(s).toContain('📷: Nikon Z8 + 800mm f/6.3 PF');
    expect(s).not.toContain('[1/2]:');
    expect(s).not.toContain('570mm | f/6.3 | 1/2000s | ISO 800 | 手持');
  });
});

describe('buildSubjectLine', () => {
  const subject = {
    scientificName: 'Halcyon smyrnensis',
    instagramCommonName: 'White-throated Kingfisher',
    rednoteCommonName: '白胸翡翠',
  };

  it('formats instagram species names inline', () => {
    expect(buildSubjectLine(subject, 'instagram')).toBe('White-throated Kingfisher (𝘏𝘢𝘭𝘤𝘺𝘰𝘯 𝘴𝘮𝘺𝘳𝘯𝘦𝘯𝘴𝘪𝘴).');
  });

  it('formats rednote species names on three lines', () => {
    expect(buildSubjectLine(subject, 'rednote')).toBe('白胸翡翠\nWhite-throated Kingfisher\n𝘏𝘢𝘭𝘤𝘺𝘰𝘯 𝘴𝘮𝘺𝘳𝘯𝘦𝘯𝘴𝘪𝘴');
  });

  it('appends the IUCN status suffix on instagram', () => {
    const endangered = { ...subject, conservationStatus: { code: 'EN', en: 'Endangered', zh: '濒危' } };
    expect(buildSubjectLine(endangered, 'instagram'))
      .toBe('White-throated Kingfisher (𝘏𝘢𝘭𝘤𝘺𝘰𝘯 𝘴𝘮𝘺𝘳𝘯𝘦𝘯𝘴𝘪𝘴) — Endangered (IUCN).');
  });

  it('adds a Chinese status line after the scientific name on rednote', () => {
    const endangered = { ...subject, conservationStatus: { code: 'EN', en: 'Endangered', zh: '濒危' } };
    expect(buildSubjectLine(endangered, 'rednote'))
      .toBe('白胸翡翠\nWhite-throated Kingfisher\n𝘏𝘢𝘭𝘤𝘺𝘰𝘯 𝘴𝘮𝘺𝘳𝘯𝘦𝘯𝘴𝘪𝘴\n濒危 (EN)');
  });

  it('preserves capitalization in compound group names on both platforms', () => {
    const hainan = {
      scientificName: 'Polyplectron katsumatae',
      instagramCommonName: 'Hainan Peacock-Pheasant',
      rednoteCommonName: '海南孔雀雉',
    };

    expect(buildSubjectLine(hainan, 'instagram')).toBe('Hainan Peacock-Pheasant (𝘗𝘰𝘭𝘺𝘱𝘭𝘦𝘤𝘵𝘳𝘰𝘯 𝘬𝘢𝘵𝘴𝘶𝘮𝘢𝘵𝘢𝘦).');
    expect(buildSubjectLine(hainan, 'rednote')).toBe('海南孔雀雉\nHainan Peacock-Pheasant\n𝘗𝘰𝘭𝘺𝘱𝘭𝘦𝘤𝘵𝘳𝘰𝘯 𝘬𝘢𝘵𝘴𝘶𝘮𝘢𝘵𝘢𝘦');
  });
});

describe('lookupTaxonCommonNames', () => {
  const scientificName = 'Polyplectron katsumatae';
  const englishName = 'Hainan Peacock-Pheasant';
  const chineseName = '海南孔雀雉';
  const jsonResponse = (data) => ({ ok: true, json: async () => data });
  const ebirdResponse = (name) => jsonResponse(name ? [{ sciName: scientificName, comName: name }] : []);

  function withWikidata(fetchMock, taxonName = scientificName, extraClaims = {}) {
    return fetchMock
      .mockResolvedValueOnce(jsonResponse({ search: [{ id: 'Q1' }, { id: 'Q2' }] }))
      .mockResolvedValueOnce(jsonResponse({ entities: {
        Q1: { labels: { en: { value: 'Wrong genus name' } }, claims: {
          P225: [{ mainsnak: { datavalue: { value: 'Polyplectron' } } }],
        } },
        Q2: { labels: { zh: { value: chineseName } }, claims: {
          P225: [{ mainsnak: { datavalue: { value: taxonName } } }],
          P1843: [{ mainsnak: { datavalue: { value: { text: 'Hainan peacock-pheasant', language: 'en' } } } }],
          ...extraClaims,
        } },
      } }));
  }

  it('skips requests for an empty scientific name', async () => {
    const fetchMock = vi.fn();

    await expect(lookupTaxonCommonNames(' \n ', fetchMock)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('prefers eBird names even when Wikidata also resolves the taxon', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ebirdResponse(englishName))
      .mockResolvedValueOnce(ebirdResponse(chineseName));
    withWikidata(fetchMock);

    await expect(lookupTaxonCommonNames(' Polyplectron   katsumatae ', fetchMock)).resolves.toEqual({
      scientificName,
      instagramCommonName: englishName,
      rednoteCommonName: chineseName,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const ebirdCalls = fetchMock.mock.calls.filter(([url]) => url.origin === 'https://api.ebird.org');
    expect(ebirdCalls.map(([url]) => url.searchParams.get('locale'))).toEqual(['en', 'zh_SIM']);
    for (const [url] of ebirdCalls) {
      expect(url.searchParams.get('species')).toBe(scientificName);
    }
  });

  it.each(['no match', 'scientific name mismatch', 'HTTP failure', 'network error'])('uses an exact Wikidata match on eBird %s', async (failure) => {
    const fetchMock = vi.fn();
    if (failure === 'network error') {
      fetchMock.mockRejectedValueOnce(new Error('offline')).mockRejectedValueOnce(new Error('offline'));
    } else {
      const response = failure === 'HTTP failure' ? { ok: false } : jsonResponse(
        failure === 'no match' ? [] : [{ sciName: 'Polyplectron bicalcaratum', comName: 'Wrong species' }],
      );
      fetchMock.mockResolvedValueOnce(response).mockResolvedValueOnce(response);
    }
    withWikidata(fetchMock);

    await expect(lookupTaxonCommonNames(scientificName, fetchMock)).resolves.toEqual({
      scientificName,
      instagramCommonName: 'Hainan peacock-pheasant',
      rednoteCommonName: chineseName,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it.each(['English missing', 'Chinese missing', 'Chinese is an English placeholder'])('only fills missing names when %s', async (failure) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ebirdResponse(failure === 'English missing' ? '' : englishName))
      .mockResolvedValueOnce(ebirdResponse(failure === 'Chinese missing' ? '' :
        failure === 'Chinese is an English placeholder' ? englishName : chineseName));
    withWikidata(fetchMock);

    await expect(lookupTaxonCommonNames(scientificName, fetchMock)).resolves.toEqual({
      scientificName,
      instagramCommonName: failure === 'English missing' ? 'Hainan peacock-pheasant' : englishName,
      rednoteCommonName: chineseName,
    });
  });

  it.each([englishName, ''])('retains resolved names when the remaining lookups fail: %s', async (name) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ebirdResponse(name))
      .mockRejectedValue(new Error('offline'));

    await expect(lookupTaxonCommonNames(scientificName, fetchMock)).resolves.toEqual({
      scientificName,
      instagramCommonName: name,
      rednoteCommonName: '',
    });
  });

  it('does not use a Wikidata result for a different scientific name', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ebirdResponse(''))
      .mockResolvedValueOnce(ebirdResponse(''));
    withWikidata(fetchMock, 'Polyplectron bicalcaratum');

    await expect(lookupTaxonCommonNames(scientificName, fetchMock)).resolves.toEqual({
      scientificName,
      instagramCommonName: '',
      rednoteCommonName: '',
    });
  });

  const p141 = (itemId, rank = 'normal') => ({
    rank,
    mainsnak: { datavalue: { value: { id: itemId } } },
  });

  it('reads the IUCN status from the P141 claim', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ebirdResponse(englishName))
      .mockResolvedValueOnce(ebirdResponse(chineseName));
    withWikidata(fetchMock, scientificName, { P141: [p141('Q96377276')] });

    await expect(lookupTaxonCommonNames(scientificName, fetchMock)).resolves.toEqual({
      scientificName,
      instagramCommonName: englishName,
      rednoteCommonName: chineseName,
      conservationStatus: { code: 'EN', en: 'Endangered', zh: '濒危' },
    });
  });

  it('omits the status when it is Least Concern', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ebirdResponse(englishName))
      .mockResolvedValueOnce(ebirdResponse(chineseName));
    withWikidata(fetchMock, scientificName, { P141: [p141('Q211005', 'preferred')] });

    await expect(lookupTaxonCommonNames(scientificName, fetchMock)).resolves.toEqual({
      scientificName,
      instagramCommonName: englishName,
      rednoteCommonName: chineseName,
    });
  });

  it.each(['Q3245245', 'Q56660252', 'Q3350324'])('omits non-threatening status %s (DD/NE)', async (itemId) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ebirdResponse(englishName))
      .mockResolvedValueOnce(ebirdResponse(chineseName));
    withWikidata(fetchMock, scientificName, { P141: [p141(itemId)] });

    await expect(lookupTaxonCommonNames(scientificName, fetchMock)).resolves.toEqual({
      scientificName,
      instagramCommonName: englishName,
      rednoteCommonName: chineseName,
    });
  });

  it('skips deprecated P141 claims', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ebirdResponse(englishName))
      .mockResolvedValueOnce(ebirdResponse(chineseName));
    withWikidata(fetchMock, scientificName, { P141: [p141('Q96377276', 'deprecated'), p141('Q278113')] });

    await expect(lookupTaxonCommonNames(scientificName, fetchMock)).resolves.toEqual({
      scientificName,
      instagramCommonName: englishName,
      rednoteCommonName: chineseName,
      conservationStatus: { code: 'VU', en: 'Vulnerable', zh: '易危' },
    });
  });

  it('keeps the subject when the status lookup fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ebirdResponse(englishName))
      .mockResolvedValueOnce(ebirdResponse(chineseName))
      .mockRejectedValue(new Error('offline'));

    await expect(lookupTaxonCommonNames(scientificName, fetchMock)).resolves.toEqual({
      scientificName,
      instagramCommonName: englishName,
      rednoteCommonName: chineseName,
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
      json: async () => ({
        index: {
          singapore: '@nikonsg',
        },
      }),
    });

    await expect(lookupOfficialNikonInstagramTag('sg', fetchMock)).resolves.toBe('@nikonsg');
  });

  it('reads the generated Nikon JSON index format', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        fetchedAt: '2026-04-13T08:45:49.878Z',
        sourceUrl: 'https://www.nikon.com/socialmedia/',
        index: {
          indonesia: '@nikonindonesia',
        },
      }),
    });

    await expect(lookupOfficialNikonInstagramTag('id', fetchMock)).resolves.toBe('@nikonindonesia');
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

  it('uses broader baked-in region coverage for Oceania when only a regional heading is available', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => `
        <h2>Oceania</h2>
        <h3>Oceania</h3>
        <a href="https://www.instagram.com/nikonoceania/">nikonoceania</a>
        <h3>Australia</h3>
      `,
    });

    await expect(lookupOfficialNikonInstagramTag('au', fetchMock)).resolves.toBe('@nikonoceania');
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

  it('falls back to Indonesia’s local Nikon handle when the live lookup is unavailable', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('cors blocked'));
    await expect(lookupOfficialNikonInstagramTag('id', fetchMock)).resolves.toBe('@nikonindonesia');
  });
});
