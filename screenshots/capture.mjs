// Takes the user-guide screenshots in French and English from a freshly seeded
// instance (see compose.screenshots.yaml). Every shot is named after what it
// shows and written to OUT_DIR/{fr,en}/<name>.png, so the two guides embed the
// same file name under their own language folder.
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT_DIR = process.env.OUT_DIR ?? '../docs/images';
const PASSWORD = 'PensaDemo2026!';
const VIEWPORT = { width: 1280, height: 800 };

// Visible labels the script has to click, in each language.
const labels = {
  fr: { signIn: 'Se connecter', addWish: 'Ajouter une envie', addToList: 'Ajouter à ma liste', addAnyway: 'Ajouter quand même', reserve: 'Réserver' },
  en: { signIn: 'Sign in', addWish: 'Add a wish', addToList: 'Add to my list', addAnyway: 'Add anyway', reserve: 'Reserve' },
};

const waitForApp = async () => {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch { /* Not up yet. */ }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${BASE_URL} did not answer in time`);
};

// Pictures and fonts may still be arriving when the page looks ready. The fonts
// come from Google Fonts with display=swap, so a shot taken too early silently
// uses a fallback: wait until both families have actually loaded.
const settle = async (page) => {
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForFunction(() => ['DM Sans', 'Outfit'].every((family) =>
    [...document.fonts].some((face) => face.family.replace(/["']/g, '') === family && face.status === 'loaded')), null, { timeout: 15_000 })
    .catch(() => console.warn('  web fonts did not load; using fallbacks'));
  await page.waitForTimeout(300);
};

const failures = [];

const shot = async (page, locale, name, target) => {
  try {
    await settle(page);
    const file = join(OUT_DIR, locale, `${name}.png`);
    await (target ?? page).screenshot({ path: file, animations: 'disabled' });
    console.log(`  ${locale}/${name}.png`);
  } catch (error) {
    failures.push(`${locale}/${name}: ${error.message}`);
    console.error(`  ${locale}/${name}.png FAILED: ${error.message}`);
  }
};

const step = async (page, locale, name, action) => {
  try {
    await action();
  } catch (error) {
    failures.push(`${locale}/${name}: ${error.message}`);
    console.error(`  ${locale}/${name} FAILED: ${error.message}`);
    // What the page looked like when it went wrong, outside the published folders.
    await page.screenshot({ path: join(OUT_DIR, `failed-${locale}-${name}.png`) }).catch(() => {});
  }
};

const browser = await chromium.launch();

// Every request reaches the API through the same Vite proxy, so they would all
// share one rate-limit budget. Each browser context presents its own client
// address instead, as the API tests do.
let contexts = 0;
const open = async (locale) => {
  contexts += 1;
  const address = `198.51.100.${contexts}`;
  const context = await browser.newContext({
    viewport: VIEWPORT,
    locale: locale === 'fr' ? 'fr-FR' : 'en-GB',
    timezoneId: 'Europe/Paris',
  });
  // Only on API calls: on the cross-origin font requests, an extra header would trigger a CORS preflight that fails.
  await context.route('**/api/**', (route) => route.continue({ headers: { ...route.request().headers(), 'x-forwarded-for': address } }));
  await context.addInitScript((value) => localStorage.setItem('pensa-language', value), locale);
  return context;
};

const signIn = async (context, locale, user) => {
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`);
  await page.locator('#email').fill(`${user}@example.test`);
  await page.locator('#password').fill(PASSWORD);
  await page.locator('form').filter({ has: page.locator('#email') }).getByRole('button', { name: labels[locale].signIn }).click();
  await page.waitForURL(/\/dashboard/);
  return page;
};

const findPerson = async (page, firstName) => {
  const results = await page.evaluate(async (q) => (await fetch(`/api/search?q=${encodeURIComponent(q)}`)).json(), firstName);
  const person = results.people.find((candidate) => candidate.firstName === firstName);
  if (!person) throw new Error(`${firstName} not found`);
  return person.id;
};

await waitForApp();

for (const locale of ['fr', 'en']) {
  console.log(`${locale}:`);
  await mkdir(join(OUT_DIR, locale), { recursive: true });
  const l = labels[locale];

  const anonymous = await open(locale);
  const landing = await anonymous.newPage();
  await landing.goto(`${BASE_URL}/`);
  await shot(landing, locale, 'sign-in');
  await anonymous.close();

  // Bob: his list, the duplicate warning, the history and searching it.
  const bobContext = await open(locale);
  const bob = await signIn(bobContext, locale, 'bob');
  await shot(bob, locale, 'dashboard');

  await bob.goto(`${BASE_URL}/wishes`);
  await shot(bob, locale, 'my-wishes');

  await step(bob, locale, 'duplicate-warning', async () => {
    // The preview would fetch a real page; answer it here so the shot never depends on a shop.
    await bob.route('**/api/wishes/preview', (route) => route.fulfill({
      json: { url: 'https://shop.example/console', title: 'Console de jeux', image: 'https://picsum.photos/seed/gift/400/300', price: 349 },
    }));
    await bob.getByRole('button', { name: l.addWish }).first().click();
    const dialog = bob.getByRole('dialog');
    await dialog.locator('#product-url').fill('https://shop.example/console?utm_source=newsletter');
    await dialog.locator('#product-title').and(dialog.locator('[value="Console de jeux"]')).waitFor();
    await dialog.getByRole('button', { name: l.addToList }).click();
    const addAnyway = dialog.getByRole('button', { name: l.addAnyway });
    await addAnyway.waitFor();
    await addAnyway.scrollIntoViewIfNeeded();
    await shot(bob, locale, 'duplicate-warning', dialog);
    await bob.keyboard.press('Escape');
  });

  await bob.goto(`${BASE_URL}/history`);
  await shot(bob, locale, 'history');

  await bob.goto(`${BASE_URL}/search?q=photo`);
  await bob.getByRole('main').locator('article').first().waitFor().catch(() => {});
  await shot(bob, locale, 'search-history');

  await bob.goto(`${BASE_URL}/profile`);
  await shot(bob, locale, 'profile');
  await bobContext.close();

  // Alice: someone else's list, reserving, her reservations and a managed list.
  const aliceContext = await open(locale);
  const alice = await signIn(aliceContext, locale, 'alice');

  await step(alice, locale, 'person-wishes', async () => {
    await alice.goto(`${BASE_URL}/users/${await findPerson(alice, 'Charlie')}/wishes`);
    await shot(alice, locale, 'person-wishes');
    await alice.getByRole('button', { name: l.reserve, exact: true }).first().click();
    await alice.getByRole('dialog').waitFor();
    await shot(alice, locale, 'reserve', alice.getByRole('dialog'));
    await alice.keyboard.press('Escape');
  });

  await alice.goto(`${BASE_URL}/reservations`);
  await shot(alice, locale, 'reservations');

  await alice.goto(`${BASE_URL}/families`);
  await shot(alice, locale, 'families');

  await step(alice, locale, 'managed-list', async () => {
    await alice.goto(`${BASE_URL}/users/${await findPerson(alice, 'Lucie')}/wishes`);
    await shot(alice, locale, 'managed-list');
  });
  await aliceContext.close();
}

await browser.close();

if (failures.length) {
  console.error(`\n${failures.length} screenshot(s) failed:\n${failures.join('\n')}`);
  process.exit(1);
}
