import { describe, expect, it } from 'vitest';
import { preview } from './metadata.js';

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
