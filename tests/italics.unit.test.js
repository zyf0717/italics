import { describe, it, expect } from 'vitest';
import { toUnicodeItalic } from '../js/italics.js';

describe('toUnicodeItalic', () => {
  it('converts ascii letters to unicode italic equivalents', () => {
    expect(toUnicodeItalic('ABCxyz')).not.toBe('ABCxyz');
    // Expect some known mappings
    expect(toUnicodeItalic('A')).toMatch(/\p{Letter}/u);
    expect(toUnicodeItalic('hello')).toContain(toUnicodeItalic('h')[0]);
  });

  it('passes non-alphabetic characters through unchanged', () => {
    expect(toUnicodeItalic('123 !?')).toBe('123 !?');
  });
});
