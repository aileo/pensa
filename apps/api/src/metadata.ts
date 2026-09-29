import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request } from 'node:https';
import { request as httpRequest } from 'node:http';
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

export async function preview(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error('URL invalide'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
    (url.port && !['80', '443'].includes(url.port))) throw new Error('URL non autorisée');
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(a => !publicAddress(a.address))) throw new Error('Adresse non autorisée');
  const ip = addresses[0];
  const html = await new Promise<string>((resolve, reject) => {
    const req = (url.protocol === 'https:' ? request : httpRequest)(url, {
      timeout: 5000, headers: { accept: 'text/html', 'user-agent': 'GiftitPreview/1.0' },
      lookup: (_hostname, _options, callback) => callback(null, ip.address, ip.family),
    }, res => {
      if ((res.statusCode ?? 0) >= 300 || (res.statusCode ?? 0) < 200 ||
        !res.headers['content-type']?.toLowerCase().includes('text/html')) {
        res.destroy(); reject(new Error('Page inaccessible')); return;
      }
      let content = ''; let size = 0;
      res.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > 512_000) { req.destroy(new Error('Page trop volumineuse')); return; }
        content += chunk.toString('utf8');
      });
      res.on('end', () => resolve(content));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('Délai dépassé')));
    const deadline = setTimeout(() => req.destroy(new Error('Délai dépassé')), 6000);
    req.on('close', () => clearTimeout(deadline));
    req.on('error', reject);
    req.end();
  });
  const $ = cheerio.load(html);
  const meta = (key: string) => $(`meta[property="${key}"]`).attr('content')?.trim();
  const image = meta('og:image') ?? $('meta[name="twitter:image"]').attr('content');
  let safeImage: string | undefined;
  try {
    if (image) {
      const candidate = new URL(image, url);
      if (['https:', 'http:'].includes(candidate.protocol) && !candidate.username && !candidate.password)
        safeImage = candidate.href;
    }
  } catch { /* malformed metadata is optional */ }
  const price = meta('product:price:amount') ?? $('meta[property="og:price:amount"]').attr('content');
  return {
    url: url.href, title: meta('og:title') ?? $('title').first().text().trim(),
    description: meta('og:description') ?? $('meta[name="description"]').attr('content') ?? '',
    image: safeImage ?? '', price: price && /^\d+(\.\d{1,2})?$/.test(price) ? price : null,
  };
}
