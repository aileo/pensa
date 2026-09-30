// The documentation is written once, in docs/, and stays readable on GitHub.
// This copies it into the VitePress source tree and repairs the links that
// point outside docs/ — VitePress fails the build on a dead link, and keeping
// a second copy by hand would guarantee the two drift apart.
import { mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const site = fileURLToPath(new URL('..', import.meta.url));
const repo = join(site, '..');

const BLOB = 'https://github.com/aileo/pensa/blob/main';

// Applied to every file copied out of docs/. The rewritten targets keep the
// same relative depth, so a link that worked on GitHub works on the site.
const fromDocs = [
  [/\.\.\/AGENT\.md/g, '../agent.md'],
  [/\.\.\/CHANGELOG\.md/g, '../changelog.md'],
  [/\.\.\/README\.md/g, '../index.md'],
  [/\.\.\/LICENSE/g, `${BLOB}/LICENSE`],
  // The folder index is renamed on the way in, so links to it must follow.
  [/\]\(README\.md/g, '](index.md'],
];

// AGENT.md and CHANGELOG.md sit at the root of the repository and of the site
// alike, so only the files renamed on the way in have to be repaired.
const fromRoot = [
  [/docs\/README\.md/g, 'docs/index.md'],
  [/\]\(AGENT\.md\)/g, '](agent.md)'],
  [/\]\(README\.md\)/g, '](index.md)'],
  [/\]\(LICENSE\)/g, `](${BLOB}/LICENSE)`],
];

const rewrite = (text, rules) => rules.reduce((acc, [from, to]) => acc.replace(from, to), text);

const copy = async (source, target, rules) => {
  await writeFile(target, rewrite(await readFile(source, 'utf8'), rules));
};

const collect = async () => {
  await mkdir(join(site, 'docs'), { recursive: true });

  const entries = (await readdir(join(repo, 'docs'))).filter((name) => name.endsWith('.md'));
  const written = new Set();
  for (const name of entries) {
    // README.md is the index for whoever browses the folder on GitHub; on the
    // site it becomes the landing page of the documentation section.
    const target = name === 'README.md' ? 'index.md' : name;
    await copy(join(repo, 'docs', name), join(site, 'docs', target), fromDocs);
    written.add(target);
  }

  // Overwrite rather than wipe and rebuild: the dev server is reading this
  // directory, and emptying it under its feet is how a rename turns into a
  // blank page. Stale copies go once the fresh ones are in place.
  for (const name of await readdir(join(site, 'docs'))) {
    if (!written.has(name)) await rm(join(site, 'docs', name));
  }

  await copy(join(repo, 'AGENT.md'), join(site, 'agent.md'), fromRoot);
  await copy(join(repo, 'CHANGELOG.md'), join(site, 'changelog.md'), fromRoot);

  return entries.length;
};

console.log(`Collected ${await collect()} documents, AGENT.md and CHANGELOG.md.`);

// In development the site renders the copies, so a change to the real file has
// to be brought over before Vite can notice anything. Without this, editing
// docs/ would appear to do nothing until the server was restarted.
//
// This polls instead of using fs.watch: the sources arrive through a bind
// mount, and inotify events do not cross that boundary on Docker Desktop, so
// a watcher would silently never fire. Vite polls its own watcher for the same
// reason.
if (process.argv.includes('--watch')) {
  const stamp = async () => {
    const dir = join(repo, 'docs');
    const names = await readdir(dir);
    const files = [...names.map((name) => join(dir, name)), join(repo, 'AGENT.md'), join(repo, 'CHANGELOG.md')];
    const times = await Promise.all(files.map(async (file) => `${file}:${(await stat(file)).mtimeMs}`));
    return times.join('|');
  };

  let previous = await stamp();
  console.log('Watching docs/, AGENT.md and CHANGELOG.md.');

  setInterval(async () => {
    try {
      const current = await stamp();
      if (current === previous) return;
      previous = current;
      console.log(`Collected ${await collect()} documents, AGENT.md and CHANGELOG.md.`);
    } catch (error) {
      console.error(`Collect failed: ${error.message}`);
    }
  }, 500);
}
