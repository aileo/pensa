import { describe, expect, it } from 'vitest';
import { isLikelyDuplicate, normalizeWishTitle, normalizeWishUrl } from './duplicates.js';

describe('duplicate wish detection', () => {
  it('ignores the scheme, www, trailing slash, fragment and tracking parameters', () => {
    expect(normalizeWishUrl('https://www.Example.com/item/42/?utm_source=x&b=2&a=1#reviews')).toBe(
      normalizeWishUrl('http://example.com/item/42?a=1&b=2&fbclid=abc'),
    );
  });

  it('keeps meaningful path and query differences apart', () => {
    expect(normalizeWishUrl('https://example.com/item/42?size=s')).not.toBe(
      normalizeWishUrl('https://example.com/item/42?size=m'),
    );
    expect(normalizeWishUrl('https://example.com/item/42')).not.toBe(normalizeWishUrl('https://example.com/item/43'));
  });

  it('compares titles without case, accents or extra spacing', () => {
    expect(normalizeWishTitle('  Théière   en FONTE ')).toBe('theiere en fonte');
    expect(normalizeWishTitle('   ')).toBeNull();
  });

  it('matches on either the link or the title', () => {
    expect(isLikelyDuplicate({ title: 'A', url: 'https://shop.test/x' }, { title: 'B', url: 'https://www.shop.test/x/' })).toBe(true);
    expect(isLikelyDuplicate({ title: 'Livre', url: 'https://a.test/1' }, { title: 'livre', url: 'https://b.test/2' })).toBe(true);
    expect(isLikelyDuplicate({ title: 'Livre', url: 'https://a.test/1' }, { title: 'Disque', url: 'https://a.test/2' })).toBe(false);
    expect(isLikelyDuplicate({ title: 'Livre', url: 'not a url' }, { title: 'Disque', url: 'not a url' })).toBe(false);
  });
});
