// A likely duplicate is the same product reached through a slightly different link, or the same
// name typed with different casing, accents or spacing. Both keys stay deliberately narrow: a
// false alarm costs one extra click, but a real variant (another size, another colour) must still
// be addable, which is why the warning can always be overridden.

const trackingParameter = /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref|ref_src)$/i;

export const normalizeWishUrl = (value: string | null | undefined) => {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  const params = [...url.searchParams.entries()]
    .filter(([key]) => !trackingParameter.test(key))
    .sort(([a, av], [b, bv]) => a.localeCompare(b) || av.localeCompare(bv));
  const query = params.length ? `?${new URLSearchParams(params).toString()}` : '';
  const path = url.pathname.replace(/\/+$/, '');
  return `${host}${url.port ? `:${url.port}` : ''}${path}${query}`;
};

export const normalizeWishTitle = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim() || null;

export const isLikelyDuplicate = (
  candidate: { title?: string | null; url?: string | null },
  existing: { title?: string | null; url?: string | null },
) => {
  const url = normalizeWishUrl(candidate.url);
  if (url && url === normalizeWishUrl(existing.url)) return true;
  const title = normalizeWishTitle(candidate.title);
  return !!title && title === normalizeWishTitle(existing.title);
};
