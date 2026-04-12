import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const css = readFileSync(resolve(__dirname, '../style.css'), 'utf-8');

function getRuleProperties(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\#]/g, '\\$&');
  const regex = new RegExp(escaped + '\\s*\\{([^}]+)\\}', 'g');
  const matches = [];
  let match;
  while ((match = regex.exec(css)) !== null) {
    matches.push(match[1]);
  }
  return matches;
}

describe('input area tile aspect ratio', () => {
  it('input tiles maintain square aspect ratio when shrinking', () => {
    const rules = getRuleProperties(css, '#input-area .tile');
    const allProps = rules.join('\n');
    expect(allProps).toContain('aspect-ratio');
    expect(allProps).toMatch(/aspect-ratio\s*:\s*1/);
  });
});
