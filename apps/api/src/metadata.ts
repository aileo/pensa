import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import type { LookupFunction } from 'node:net';
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
const BROWSER_HEADERS = {
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
  'accept-encoding': 'gzip, deflate, br',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
};

type Address = { address: string; family: number };
type Node = Record<string, unknown>;
type HopResult = { redirect: URL } | { body: Buffer; charset: string };

function statusMessage(status: number) {
  if ([401, 403, 405, 406, 429, 503].includes(status)) return 'Le site refuse la prévisualisation';
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

async function resolveTarget(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
    (url.port && !['80', '443'].includes(url.port))) throw new Error('URL non autorisée');
  let addresses: Address[];
  try { addresses = await lookup(url.hostname, { all: true }); }
  catch { throw new Error('Site injoignable'); }
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error('Adresse non autorisée');
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

function fetchHop(url: URL, target: Address, timeout: number) {
  return new Promise<HopResult>((resolve, reject) => {
    const send = url.protocol === 'https:' ? request : httpRequest;
    // We already pin a single address, and Happy Eyeballs emits connection failures on the socket
    // instead of the request, which would crash the process on an unreachable address.
    const options = {
      timeout, headers: BROWSER_HEADERS, lookup: pinned(target), autoSelectFamily: false,
      family: target.family,
    };
    const req = send(url, options, res => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        const { location } = res.headers;
        res.destroy();
        if (!location) { reject(new Error('Page inaccessible')); return; }
        try { resolve({ redirect: new URL(location, url) }); }
        catch { reject(new Error('Page inaccessible')); }
        return;
      }
      const type = res.headers['content-type']?.toLowerCase() ?? '';
      if (status < 200 || status >= 300) { res.destroy(); reject(new Error(statusMessage(status))); return; }
      if (!type.includes('text/html') && !type.includes('xhtml')) {
        res.destroy(); reject(new Error('Page inaccessible')); return;
      }
      const encoding = (res.headers['content-encoding'] ?? '').toLowerCase();
      let stream: Readable = res;
      if (encoding.includes('br')) stream = res.pipe(createBrotliDecompress());
      else if (encoding.includes('gzip')) stream = res.pipe(createGunzip());
      else if (encoding.includes('deflate')) stream = res.pipe(createInflate());
      const chunks: Buffer[] = [];
      let size = 0; let settled = false; let tail = '';
      // Metadata lives in <head>, so stop there (or at the cap) and parse what arrived
      // instead of rejecting pages that are merely large.
      const finish = () => {
        if (settled) return;
        settled = true; res.destroy();
        resolve({ body: Buffer.concat(chunks), charset: charsetOf(type) });
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
    req.on('timeout', () => req.destroy(new Error('Délai dépassé')));
    const deadline = setTimeout(() => req.destroy(new Error('Délai dépassé')), timeout);
    req.on('close', () => clearTimeout(deadline));
    req.on('error', (error: Error) =>
      reject(error.message === 'Délai dépassé' ? error : new Error('Site injoignable')));
    req.end();
  });
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

export async function preview(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('URL invalide'); }
  const budget = Date.now() + TOTAL_TIMEOUT;
  let page: { body: Buffer; charset: string } | undefined;
  for (let hop = 0; hop <= MAX_REDIRECTS && !page; hop++) {
    // Every hop is revalidated from scratch, so a redirect cannot smuggle us onto a private address.
    const targets = await resolveTarget(url);
    const remaining = Math.min(HOP_TIMEOUT, budget - Date.now());
    if (remaining <= 0) throw new Error('Délai dépassé');
    let result: HopResult | undefined;
    let failure: Error | undefined;
    for (const target of targets) {
      try { result = await fetchHop(url, target, remaining); failure = undefined; break; }
      catch (error) {
        failure = error as Error;
        if (failure.message !== 'Site injoignable') break;
      }
    }
    if (failure) throw failure;
    if (!result) throw new Error('Site injoignable');
    if ('redirect' in result) url = result.redirect;
    else page = result;
  }
  if (!page) throw new Error('Trop de redirections');
  const $ = cheerio.load(decode(page.body, page.charset));
  const content = (selector: string) => $(selector).attr('content')?.trim() || undefined;
  const product = productNode($);
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
  const fallbackTitle = $('title').first().text().trim() || $('h1').first().text().trim();
  return {
    url: url.href,
    title: content('meta[property="og:title"]') ?? content('meta[name="twitter:title"]') ??
      stringField(product?.name) ?? fallbackTitle,
    description: content('meta[property="og:description"]') ?? content('meta[name="twitter:description"]') ??
      content('meta[name="description"]') ?? stringField(product?.description) ?? '',
    image: safeImage ?? '',
    price: normalizePrice(content('meta[property="product:price:amount"]') ??
      content('meta[property="og:price:amount"]') ?? offerPrice(product)),
  };
}
