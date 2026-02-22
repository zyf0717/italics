import { describe, it, expect } from 'vitest';
import { formatShutterSpeed } from '../js/metadata.js';

// export formatShutterSpeed by adding an export in the module if needed — but we'll import indirectly

describe('formatShutterSpeed', () => {
  it('returns null for null input', () => {
    expect(formatShutterSpeed(null)).toBeNull();
  });
  it('formats long exposures >=1s', () => {
    expect(formatShutterSpeed(2)).toBe('2s');
    expect(formatShutterSpeed(1.234)).toMatch(/s$/);
  });
  it('formats fractional speeds as 1/Ns', () => {
    expect(formatShutterSpeed(1/4000)).toBe('1/4000s');
    expect(formatShutterSpeed(1/30)).toBe('1/30s');
  });
});
