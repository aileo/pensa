import { lookup, resolve4, resolve6 } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
import { connect } from 'node:http2';
import { request } from 'node:https';
import { request as httpRequest } from 'node:http';
import type { Readable } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import * as cheerio from 'cheerio';

function publicAddress(ip: string) {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 ||
      a === 100 && b >= 64 && b <= 127 || a === 192 && b === 0 || a === 198 && (b === 18 || b === 19));
  }
  if (isIP(ip) === 6) {
    const normalized = ip.toLowerCase();
    if (normalized.includes('.')) return false;
    return !(normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
      normalized.startsWith('fd') || /^fe[89ab]/.test(normalized) ||
      normalized.startsWith('2001:db8') || normalized.startsWith('2001:0:') ||
      normalized.startsWith('2002:') || normalized.startsWith('::ffff:'));
  }
  return false;
}

const MAX_BYTES = 1_048_576;
const MAX_REDIRECTS = 5;
const HOP_TIMEOUT = 10_000;
const TOTAL_TIMEOUT = 20_000;
const CACHE_TTL = 86_400_000;
const NOTICE_TTL = 3_600_000;
const CACHE_LIMIT = 200;
const INTERSTITIAL_BYTES = 15_000;
const REFUSED = 'Le site refuse la prévisualisation';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';
// A real Chrome always negotiates HTTP/2, so shops behind Cloudflare or DataDome answer 403 to
// anything announcing Chrome over HTTP/1.1, whatever its headers say. Measured from this service:
// domadoo, fnac and cdiscount all refuse HTTP/1.1 and all answer over HTTP/2. We therefore speak
// HTTP/2 first and keep HTTP/1.1 as the fallback for servers that do not offer it.
const BROWSER_HEADERS: Headers = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'accept-encoding': 'gzip, deflate, br',
  'user-agent': USER_AGENT,
};
const PLAIN_HEADERS: Headers = {
  accept: '*/*', 'accept-encoding': 'gzip, deflate, br', 'user-agent': USER_AGENT,
};
const ATTEMPTS: Attempt[] = [
  { http2: true, headers: BROWSER_HEADERS },
  { http2: false, headers: PLAIN_HEADERS },
  { http2: false, headers: BROWSER_HEADERS },
];

type Address = { address: string; family: number };
type Node = Record<string, unknown>;
type Headers = Record<string, string>;
type Attempt = { http2: boolean; headers: Headers };
type HopResult = { redirect: URL } | { body: Buffer; charset: string };
export type LinkPreview = {
  url: string; title: string; description: string; image: string;
  price: string | null; notice?: string;
};

function statusMessage(status: number) {
  if ([401, 403, 405, 406, 429, 503].includes(status)) return REFUSED;
  if (status === 404 || status === 410) return 'Page introuvable';
  return 'Page inaccessible';
}

// Node resolves with Happy Eyeballs, so it calls custom lookups with `all` set and expects an
// array of addresses; answering with the legacy (address, family) form fails every request.
// The answer must also be deferred: a synchronous callback connects before the request attaches
// its error handler, so a failure would crash the process instead of rejecting.
const pinned = (target: Address): LookupFunction =>
  ((hostname: string, options: { all?: boolean }, callback: (...result: unknown[]) => void) => {
    setImmediate(() => {
      if (options?.all) callback(null, [{ ...target }]);
      else callback(null, target.address, target.family);
    });
  }) as unknown as LookupFunction;

// getaddrinfo hides A records whenever the host has no IPv6 route of its own, which makes
// IPv6-first sites such as amazon.fr look unreachable. Asking for both record types directly
// gives us every candidate, and we still try IPv4 first.
async function addressesOf(hostname: string) {
  if (isIP(hostname)) return [{ address: hostname, family: isIP(hostname) }];
  const [v4, v6] = await Promise.all([resolve4(hostname).catch(() => []), resolve6(hostname).catch(() => [])]);
  const found = [...v4.map(address => ({ address, family: 4 })), ...v6.map(address => ({ address, family: 6 }))];
  if (found.length) return found;
  return lookup(hostname, { all: true });
}

async function resolveTarget(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
    (url.port && !['80', '443'].includes(url.port))) throw new Error('URL non autorisée');
  let addresses: Address[];
  try { addresses = await addressesOf(url.hostname); }
  catch { throw new Error('Site introuvable'); }
  if (!addresses.length) throw new Error('Site introuvable');
  if (addresses.some(a => !publicAddress(a.address))) throw new Error('Adresse non autorisée');
  // Large CDN pools repeat addresses; a few candidates are enough to survive one dead endpoint.
  const unique = [...new Map(addresses.map(a => [a.address, a])).values()];
  return unique.sort((a, b) => a.family - b.family).slice(0, 4);
}

function charsetOf(contentType: string) {
  return /charset=["']?([\w-]+)/i.exec(contentType)?.[1].toLowerCase() ?? 'utf-8';
}

function decode(body: Buffer, charset: string) {
  const latin = ['iso-8859-1', 'iso8859-1', 'latin1', 'windows-1252', 'cp1252'];
  return body.toString(latin.includes(charset) ? 'latin1' : 'utf8');
}

// Redirects, refusals and non-HTML answers read the same over both protocols.
function interpret(status: number, location: string | undefined, type: string, url: URL) {
  if (status >= 300 && status < 400) {
    if (!location) throw new Error('Page inaccessible');
    try { return { redirect: new URL(location, url) }; }
    catch { throw new Error('Page inaccessible'); }
  }
  if (status < 200 || status >= 300) throw new Error(statusMessage(status));
  if (!type.includes('text/html') && !type.includes('xhtml')) throw new Error('Page inaccessible');
  return undefined;
}

// Metadata lives in <head>, so stop there (or at the cap) and parse what arrived
// instead of rejecting pages that are merely large.
function readBody(source: Readable, encoding: string, close: () => void) {
  return new Promise<Buffer>((resolve, reject) => {
    let stream: Readable = source;
    if (encoding.includes('br')) stream = source.pipe(createBrotliDecompress());
    else if (encoding.includes('gzip')) stream = source.pipe(createGunzip());
    else if (encoding.includes('deflate')) stream = source.pipe(createInflate());
    const chunks: Buffer[] = [];
    let size = 0; let settled = false; let tail = '';
    const finish = () => {
      if (settled) return;
      settled = true; close();
      resolve(Buffer.concat(chunks));
    };
    stream.on('data', (chunk: Buffer) => {
      if (settled) return;
      const room = MAX_BYTES - size;
      const slice = chunk.length > room ? chunk.subarray(0, room) : chunk;
      chunks.push(slice); size += slice.length;
      const text = tail + slice.toString('latin1').toLowerCase();
      if (size >= MAX_BYTES || text.includes('</head>')) { finish(); return; }
      tail = text.slice(-7);
    });
    stream.on('end', finish);
    stream.on('error', () => { if (!settled) { settled = true; reject(new Error('Page inaccessible')); } });
  });
}

function fetchHop1(url: URL, target: Address, timeout: number, headers: Headers) {
  return new Promise<HopResult>((resolve, reject) => {
    const send = url.protocol === 'https:' ? request : httpRequest;
    // We already pin a single address, and Happy Eyeballs emits connection failures on the socket
    // instead of the request, which would crash the process on an unreachable address.
    const options = {
      timeout, headers, lookup: pinned(target), autoSelectFamily: false,
      family: target.family,
    };
    const req = send(url, options, res => {
      const type = res.headers['content-type']?.toLowerCase() ?? '';
      let redirect: { redirect: URL } | undefined;
      try { redirect = interpret(res.statusCode ?? 0, res.headers.location, type, url); }
      catch (error) { res.destroy(); reject(error); return; }
      if (redirect) { res.destroy(); resolve(redirect); return; }
      readBody(res, (res.headers['content-encoding'] ?? '').toLowerCase(), () => res.destroy())
        .then(body => resolve({ body, charset: charsetOf(type) })).catch(reject);
    });
    req.on('timeout', () => req.destroy(new Error('Délai dépassé')));
    const deadline = setTimeout(() => req.destroy(new Error('Délai dépassé')), timeout);
    req.on('close', () => clearTimeout(deadline));
    req.on('error', (error: Error) =>
      reject(error.message === 'Délai dépassé' ? error : new Error('Site injoignable')));
    req.end();
  });
}

function fetchHop2(url: URL, target: Address, timeout: number, headers: Headers) {
  return new Promise<HopResult>((resolve, reject) => {
    // The address stays pinned exactly as in HTTP/1.1: only the wire protocol changes,
    // so the SSRF guarantee is untouched.
    // Node forwards unknown options to tls.connect, but its HTTP/2 typings do not list the
    // socket-level ones, hence the cast. The pinned lookup is what keeps the address verified.
    const session = connect(url.origin, {
      lookup: pinned(target), settings: { enablePush: false },
      ...{ autoSelectFamily: false, family: target.family },
    } as Parameters<typeof connect>[1]);
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true; session.destroy(); reject(error);
    };
    const succeed = (value: HopResult) => {
      if (settled) return;
      settled = true; session.close(); resolve(value);
    };
    const deadline = setTimeout(() => fail(new Error('Délai dépassé')), timeout);
    session.on('close', () => clearTimeout(deadline));
    // A server without HTTP/2 fails here; the caller then retries over HTTP/1.1.
    session.on('error', () => fail(new Error('Site injoignable')));
    const req = session.request({
      ':method': 'GET', ':path': `${url.pathname}${url.search}`, ...headers,
    });
    req.on('error', () => fail(new Error('Site injoignable')));
    req.on('response', answer => {
      const type = String(answer['content-type'] ?? '').toLowerCase();
      let redirect: { redirect: URL } | undefined;
      try {
        redirect = interpret(Number(answer[':status'] ?? 0),
          answer.location ? String(answer.location) : undefined, type, url);
      } catch (error) { fail(error as Error); return; }
      if (redirect) { succeed(redirect); return; }
      readBody(req, String(answer['content-encoding'] ?? '').toLowerCase(), () => req.close())
        .then(body => succeed({ body, charset: charsetOf(type) }))
        .catch((error: Error) => fail(error));
    });
    req.end();
  });
}

function fetchHop(url: URL, target: Address, timeout: number, attempt: Attempt) {
  return attempt.http2 && url.protocol === 'https:'
    ? fetchHop2(url, target, timeout, attempt.headers)
    : fetchHop1(url, target, timeout, attempt.headers);
}

function stringField(value: unknown, depth = 0): string | undefined {
  if (depth > 4) return undefined;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim() || undefined;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = stringField(item, depth + 1);
      if (found) return found;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    const node = value as Node;
    return stringField(node.url ?? node.contentUrl ?? node.name, depth + 1);
  }
  return undefined;
}

function productNode($: cheerio.CheerioAPI) {
  const queue: unknown[] = [];
  $('script[type="application/ld+json"]').each((_, element) => {
    try { queue.push(JSON.parse($(element).text()) as unknown); } catch { /* malformed JSON-LD is optional */ }
  });
  const seen = new Set<unknown>();
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) { queue.push(...node); continue; }
    const record = node as Node;
    if (Array.isArray(record['@graph'])) queue.push(...record['@graph']);
    const type = record['@type'];
    if (type === 'Product' || (Array.isArray(type) && type.includes('Product'))) return record;
  }
  return undefined;
}

function offerPrice(product?: Node) {
  const { offers } = product ?? {};
  for (const offer of Array.isArray(offers) ? offers : [offers]) {
    if (!offer || typeof offer !== 'object') continue;
    const node = offer as Node;
    const value = stringField(node.price ?? node.lowPrice);
    if (value) return value;
  }
  return undefined;
}

function normalizePrice(value?: string) {
  if (!value) return null;
  const cleaned = value.replace(/[\s\u00a0]/g, '').replace(/,(\d{1,2})$/, '.$1').replace(/[^\d.]/g, '');
  return /^\d+(\.\d{1,2})?$/.test(cleaned) ? cleaned : null;
}

const URL_NOISE = new Set(['dp', 'gp', 'ref', 'fiche', 'product', 'products', 'produit', 'produits',
  'item', 'items', 'catalogue', 'catalog', 'shop', 'boutique', 'achat', 'index', 'detail', 'details',
  'html', 'htm', 'php', 'aspx', 'fr', 'en', 'www', 'sku', 'id']);

// Amazon and the like never let us read their pages, so the link itself becomes the last
// source of truth: `/6412-neo-capteur-de-temperature.html` still says what the gift is.
export function titleFromUrl(url: URL) {
  const segments = decodeURIComponent(url.pathname).split('/').filter(Boolean).reverse();
  for (const segment of segments) {
    const words = segment.replace(/\.\w{2,5}$/, '').split(/[-_+.%,]+/).filter(word =>
      word.length > 1 && /^[\p{L}][\p{L}’'-]*$/u.test(word) && !URL_NOISE.has(word.toLowerCase()));
    if (words.length < 2) continue;
    const text = words.join(' ').toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  return url.hostname.replace(/^www\./, '');
}

export function extract(page: { body: Buffer; charset: string }, url: URL): LinkPreview {
  const $ = cheerio.load(decode(page.body, page.charset));
  const content = (selector: string) => $(selector).attr('content')?.trim() || undefined;
  const product = productNode($);
  const heading = $('h1').first().text().trim();
  const title = content('meta[property="og:title"]') ?? content('meta[name="twitter:title"]') ??
    stringField(product?.name) ?? ($('title').first().text().trim() || heading);
  // Anti-bot walls answer 200 with a tiny holding page: no metadata, no product, no heading.
  // Treating that as a success would fill the form with "Amazon.fr" and a blank description.
  if (!product && !content('meta[property="og:title"]') && !heading && page.body.length < INTERSTITIAL_BYTES)
    throw new Error(REFUSED);
  const image = content('meta[property="og:image"]') ?? content('meta[property="og:image:url"]') ??
    content('meta[name="twitter:image"]') ?? content('meta[name="twitter:image:src"]') ??
    stringField(product?.image) ?? $('link[rel="image_src"]').attr('href')?.trim();
  let safeImage: string | undefined;
  try {
    if (image) {
      const candidate = new URL(image, url);
      if (['https:', 'http:'].includes(candidate.protocol) && !candidate.username && !candidate.password)
        safeImage = candidate.href;
    }
  } catch { /* malformed metadata is optional */ }
  return {
    url: url.href,
    title: title || titleFromUrl(url),
    description: content('meta[property="og:description"]') ?? content('meta[name="twitter:description"]') ??
      content('meta[name="description"]') ?? stringField(product?.description) ?? '',
    image: safeImage ?? '',
    price: normalizePrice(content('meta[property="product:price:amount"]') ??
      content('meta[property="og:price:amount"]') ?? offerPrice(product)),
  };
}

async function attempt(start: URL, mode: Attempt, budget: number) {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    // Every hop is revalidated from scratch, so a redirect cannot smuggle us onto a private address.
    const targets = await resolveTarget(url);
    const remaining = Math.min(HOP_TIMEOUT, budget - Date.now());
    if (remaining <= 0) throw new Error('Délai dépassé');
    let result: HopResult | undefined;
    let failure: Error | undefined;
    for (const target of targets) {
      try { result = await fetchHop(url, target, remaining, mode); failure = undefined; break; }
      catch (error) {
        failure = error as Error;
        if (failure.message !== 'Site injoignable') break;
      }
    }
    if (failure) throw failure;
    if (!result) throw new Error('Site injoignable');
    if (!('redirect' in result)) return extract(result, url);
    url = result.redirect;
  }
  throw new Error('Trop de redirections');
}

const cache = new Map<string, { expires: number; value: LinkPreview }>();

function cached(key: string) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expires < Date.now()) { cache.delete(key); return undefined; }
  cache.delete(key); cache.set(key, entry);
  return entry.value;
}

function remember(key: string, value: LinkPreview) {
  cache.set(key, { expires: Date.now() + (value.notice ? NOTICE_TTL : CACHE_TTL), value });
  while (cache.size > CACHE_LIMIT) cache.delete(cache.keys().next().value as string);
  return value;
}

// These say the link itself is wrong, so there is nothing to salvage from it. A 404 is not in
// the list: some shops answer one to anything they take for a robot, so it deserves a retry
// and, failing that, the name read from the link rather than a dead end.
const HARD_FAILURES = new Set(['URL invalide', 'URL non autorisée', 'Adresse non autorisée',
  'Site introuvable', 'Trop de redirections', 'Délai dépassé']);

export async function preview(raw: string): Promise<LinkPreview> {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('URL invalide'); }
  url.hash = '';
  const key = url.href;
  const hit = cached(key);
  if (hit) return hit;
  const budget = Date.now() + TOTAL_TIMEOUT;
  let refused: Error | undefined;
  for (const mode of ATTEMPTS) {
    try { return remember(key, await attempt(url, mode, budget)); }
    catch (error) {
      // A refusal or a failed HTTP/2 connection deserves another try with different wire
      // settings; a wrong address would fail identically every time.
      if (HARD_FAILURES.has((error as Error).message)) throw error;
      refused = error as Error;
    }
  }
  // The gift still has to be addable: the link gives a readable name and the rest is optional.
  return remember(key, {
    url: url.href, title: titleFromUrl(url), description: '', image: '', price: null,
    notice: (refused ?? new Error(REFUSED)).message,
  });
}
