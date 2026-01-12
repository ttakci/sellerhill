import { readdir, rename, readFile, writeFile, unlink } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('..', import.meta.url));
const cjsDir = join(__dirname, 'dist', 'cjs');

async function renameToCjs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);

    if (entry.isDirectory()) {
      await renameToCjs(fullPath);
    } else if (extname(entry.name) === '.js') {
      // Read and update require() paths: ./path -> ./path.cjs
      // But skip .json paths (they should stay as .json)
      let content = await readFile(fullPath, 'utf-8');
      content = content.replace(/require\(["'](\.[^"']+)["']\)/g, (match, path) => {
        if (path.endsWith('.json')) {
          return match; // Keep .json as is
        }
        return `require("${path}.cjs")`;
      });
      
      const newPath = join(dir, basename(entry.name, '.js') + '.cjs');
      await writeFile(newPath, content, 'utf-8');
      await unlink(fullPath);
      console.log(`Renamed: ${entry.name} -> ${basename(newPath)}`);
    }
  }
}

console.log('Renaming .js to .cjs in dist/cjs...');
await renameToCjs(cjsDir);
console.log('Done!');
