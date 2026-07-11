import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const SOURCE_ROOT = path.resolve('src');
const ALLOWED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx']);
const MANUAL_SVG_PATTERN = /<svg\b/i;
const EMOJI_PATTERN = /\p{Extended_Pictographic}/u;

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return collectFiles(absolute);
    return ALLOWED_EXTENSIONS.has(path.extname(entry.name)) ? [absolute] : [];
  }));
  return nested.flat();
}

function lineForIndex(content, index) {
  return content.slice(0, index).split('\n').length;
}

const files = await collectFiles(SOURCE_ROOT);
const violations = [];

for (const file of files) {
  const content = await readFile(file, 'utf8');
  const relative = path.relative(process.cwd(), file);
  const svgMatch = MANUAL_SVG_PATTERN.exec(content);
  if (svgMatch) {
    violations.push(`${relative}:${lineForIndex(content, svgMatch.index)} contém SVG manual. Use um ícone da biblioteca Lucide ou um ativo oficial de imagem.`);
  }
  const emojiMatch = EMOJI_PATTERN.exec(content);
  if (emojiMatch) {
    violations.push(`${relative}:${lineForIndex(content, emojiMatch.index)} contém emoji. Use texto ou um ícone Lucide consistente.`);
  }
}

if (violations.length > 0) {
  process.stderr.write('Bubo UI policy failed:\n\n');
  process.stderr.write(`${violations.map((violation) => `- ${violation}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(`Bubo UI policy passed for ${files.length} source files.\n`);
