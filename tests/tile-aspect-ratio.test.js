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

describe('tile rack shrink-to-fit behavior', () => {
  it('rack tiles maintain square aspect ratio when shrinking', () => {
    const rules = getRuleProperties(css, '.tile-rack .tile');
    const allProps = rules.join('\n');
    expect(allProps).toMatch(/aspect-ratio\s*:\s*1/);
  });

  it('rack tiles have a nonzero flex-shrink so they actually shrink', () => {
    const rules = getRuleProperties(css, '.tile-rack .tile');
    const allProps = rules.join('\n');
    // Either `flex: <grow> <shrink≥1> <basis>` shorthand or explicit `flex-shrink: ≥1`
    expect(allProps).toMatch(/flex\s*:\s*\d+\s+[1-9]\d*\s+\S+|flex-shrink\s*:\s*[1-9]/);
  });

  it('tile rack does not wrap tiles to a new line', () => {
    const rules = getRuleProperties(css, '.tile-rack');
    const allProps = rules.join('\n');
    expect(allProps).not.toMatch(/flex-wrap\s*:\s*wrap/);
  });
});
