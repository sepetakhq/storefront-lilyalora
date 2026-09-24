import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// The template's promise: nothing about a merchant. One bundle serves every
// shop that picks it, so a shop name, a city or a phone number in here is
// shown to all of them.

const SRC = import.meta.dirname;

function sources(dir = SRC) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    if (!/\.(js|jsx)$/.test(name) || /\.test\.(js|jsx)$/.test(name)) return [];
    return [p];
  });
}

const files = sources().map((p) => ({ path: relative(SRC, p), text: readFileSync(p, 'utf8') }));

describe('no hardcoded parts', () => {
  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  // Every label the merchant can rename has one home, DEFAULT_LABELS in
  // lib/copy.js, read through sectionText. The same words typed anywhere
  // else would be a label the backoffice cannot reach.
  it('keeps renameable labels in DEFAULT_LABELS only', () => {
    const copyJs = files.find((f) => f.path === 'lib/copy.js').text;
    const start = copyJs.indexOf('export const DEFAULT_LABELS');
    const table = copyJs.slice(start, copyJs.indexOf('};', start));
    const labels = [...table.matchAll(/:\s*'([^']+)'/g)].map((m) => m[1]).filter((l) => l.length > 6 && !l.includes('{'));
    // Checkout, the cart and the order page are the shop system's own wording
    // (step names, payment help, the free-shipping nudge), which shares a few
    // words with the labels.
    const SYSTEM = new Set(['screens/CheckoutRoute.jsx', 'screens/OrderRoute.jsx', 'screens/CartRoute.jsx']);
    const offenders = files.filter((f) => !SYSTEM.has(f.path)).flatMap((f) => {
      const text = f.path === 'lib/copy.js' ? f.text.replace(table, '') : f.text;
      return labels.filter((l) => text.includes(`'${l}'`) || text.includes(`>${l}<`) || text.includes(`\`${l} `) || new RegExp(`^\\s*${l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'm').test(text)).map((l) => `${f.path}: ${l}`);
    });
    expect(labels.length).toBeGreaterThan(10);
    expect(offenders).toEqual([]);
  });

  it('names no shop, contact or brand', () => {
    // The seeded demo shops, and the shop this template was first drawn for.
    const banned = [/pekalongan/i, /kebun/i, /camilan/i, /ayuna/i, /pasar segar/i, /lily ?alora/i, /bali linen/i, /wa\.me\/\d/, /\.local\b/];
    const offenders = files.flatMap((f) => banned.filter((re) => re.test(f.text)).map((re) => `${f.path}: ${re}`));
    expect(offenders).toEqual([]);
  });
});
