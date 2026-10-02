import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ignored = new Set([
  'node_modules',
  '.git',
  '.expo',
  '.local',
  '.wrangler',
  'build',
  'dist',
  '.cxx',
  '.gradle',
  'coverage',
]);
const rootFiles = ['package.json', 'package-lock.json', 'tsconfig.base.json'];
const digest = (file) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

export function syncBuildWorkspace(sourceRoot, destination) {
  sourceRoot = path.resolve(sourceRoot);
  destination = path.resolve(destination);
  const relative = path.relative(sourceRoot, destination);
  if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
    throw new Error('A cópia de build precisa ficar fora do projeto original.');
  }
  const marker = path.join(destination, '.bubo-build-state.json');
  let previous = { sourceRoot, files: {}, lockHash: null };
  if (fs.existsSync(marker)) {
    previous = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (previous.sourceRoot !== sourceRoot)
      throw new Error('Pasta de build já pertence a outro projeto.');
  } else if (fs.existsSync(destination) && fs.readdirSync(destination).length > 0) {
    throw new Error('Pasta de build não está vazia e não foi criada pelo Bubo.');
  }
  const files = {};
  function safeTarget(name) {
    const target = path.resolve(destination, name);
    const relative = path.relative(destination, target);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Arquivo fora da cópia de build.');
    }
    return target;
  }
  function copy(name) {
    const source = path.join(sourceRoot, name);
    const hash = digest(source);
    files[name] = hash;
    const target = safeTarget(name);
    if (previous.files[name] !== hash || !fs.existsSync(target)) {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(source, target);
    }
  }
  function walk(name) {
    const directory = path.join(sourceRoot, name);
    if (!fs.existsSync(directory)) return;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (
        ignored.has(entry.name) ||
        /^\.(env|dev\.vars)(\.|$)/.test(entry.name) ||
        /\.(jks|keystore|p8|p12|key|mobileprovision|zip|log)$/.test(entry.name) ||
        ['google-services.json', 'GoogleService-Info.plist'].includes(entry.name)
      )
        continue;
      const next = path.join(name, entry.name);
      if (['apps/mobile/android', 'apps/mobile/ios'].includes(next.split(path.sep).join('/')))
        continue;
      if (entry.isDirectory()) walk(next);
      else if (entry.isFile()) copy(next);
    }
  }
  rootFiles.filter((name) => fs.existsSync(path.join(sourceRoot, name))).forEach(copy);
  ['apps', 'packages'].forEach(walk);
  for (const name of Object.keys(previous.files)) {
    const target = safeTarget(name);
    if (!files[name] && fs.existsSync(target)) fs.unlinkSync(target);
  }
  const lockHash = files['package-lock.json'];
  const dependencyMarker = path.join(destination, '.bubo-dependencies.sha256');
  fs.mkdirSync(destination, { recursive: true });
  fs.writeFileSync(marker, JSON.stringify({ sourceRoot, files, lockHash }, null, 2) + '\n');
  return {
    lockHash,
    installDependencies:
      !fs.existsSync(dependencyMarker) ||
      fs.readFileSync(dependencyMarker, 'utf8') !== lockHash ||
      !fs.existsSync(path.join(destination, 'node_modules/expo/bin/cli')),
  };
}

export function windowsBuildWorkspace(root) {
  const id = createHash('sha256').update(path.resolve(root)).digest('hex').slice(0, 8);
  return path.join(path.parse(root).root, 'BuboBuild', id);
}
