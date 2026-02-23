import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('basic smoke tests', () => {
  it('index.html contains title or app root', async () => {
    const html = await fs.promises.readFile(path.resolve('index.html'), 'utf8');
    expect(html.length).toBeGreaterThan(0);
    expect(html).toMatch(/<title>|id="app"|<div id=\"root\"/i);
  });
});
