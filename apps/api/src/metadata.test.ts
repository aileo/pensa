import { describe, expect, it } from 'vitest';
import { extract, preview, titleFromUrl } from './metadata.js';

const page = (html: string) => ({ body: Buffer.from(html, 'utf8'), charset: 'utf-8' });

// The preview fetcher is the only place where the API follows a user-supplied URL, so these
// guards are the SSRF boundary. They are re-applied to every redirect hop, not just the first.
describe('garde-fous de la prévisualisation de lien', () => {
  it('refuse les URL malformées et les schémas non HTTP', async () => {
    await expect(preview('not-an-url')).rejects.toThrow('URL invalide');
    await expect(preview('ftp://example.com/file')).rejects.toThrow('URL non autorisée');
    await expect(preview('file:///etc/passwd')).rejects.toThrow('URL non autorisée');
  });
  it('refuse les ports détournés et les identifiants embarqués', async () => {
    await expect(preview('http://example.com:8080/')).rejects.toThrow('URL non autorisée');
    await expect(preview('http://user:secret@example.com/')).rejects.toThrow('URL non autorisée');
  });
  it('refuse les adresses privées, locales et de métadonnées cloud', async () => {
    for (const host of ['127.0.0.1', '10.0.0.1', '192.168.1.1', '172.16.0.1', '169.254.169.254', '0.0.0.0']) {
      await expect(preview(`http://${host}/`)).rejects.toThrow('Adresse non autorisée');
    }
  });
});

// Sites that refuse robots still have to yield a usable wish name, otherwise the form
// stays empty and the gift cannot be added at all.
describe('titre déduit du lien', () => {
  it('reconstitue un nom lisible depuis le chemin', () => {
    expect(titleFromUrl(new URL('https://www.domadoo.fr/fr/peripheriques/6412-neo-capteur-de-temperature.html')))
      .toBe('Neo capteur de temperature');
    expect(titleFromUrl(new URL('https://www.amazon.fr/Lego-Architecture-Tour-Eiffel/dp/B09XYZ1234')))
      .toBe('Lego architecture tour eiffel');
  });
  it('ignore les segments techniques et les identifiants', () => {
    expect(titleFromUrl(new URL('https://boutique.test/produit/12345'))).toBe('boutique.test');
    expect(titleFromUrl(new URL('https://www.fnac.com/'))).toBe('fnac.com');
  });
});

// Anti-robot walls answer 200 with a holding page, which used to be stored as a real preview.
describe('détection des pages anti-robot', () => {
  const url = new URL('https://boutique.test/produit-de-test');
  it('rejette une page courte sans métadonnées ni titre', () => {
    expect(() => extract(page('<html><head><title>boutique.test</title></head><body><p>Robot ?</p></body></html>'), url))
      .toThrow('Le site refuse la prévisualisation');
  });
  it('accepte une page pourvue de métadonnées', () => {
    expect(extract(page('<html><head><meta property="og:title" content="Théière en fonte">' +
      '<meta property="og:description" content="1,2 L"></head></html>'), url))
      .toMatchObject({ title: 'Théière en fonte', description: '1,2 L' });
  });
  it('accepte une page longue sans métadonnées grâce à son titre', () => {
    const filler = '<p>description du produit</p>'.repeat(800);
    expect(extract(page(`<html><head><title>Théière</title></head><body><h1>Théière</h1>${filler}</body></html>`), url))
      .toMatchObject({ title: 'Théière' });
  });
});
