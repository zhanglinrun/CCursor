import esbuild from 'esbuild';
import { copyFileSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));

// The CLI delegates to the reinject worker, which is bundled separately below.
await esbuild.build({
  entryPoints: ['src/cli.js'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: 'dist/cli.cjs',
  minify: false,
  banner: {
    js: '#!/usr/bin/env node',
  },
  define: {
    'process.env.CURSOR2PLUS_VERSION': JSON.stringify(pkg.version),
  },
});

// Bundled for Cursor++/dist/restart-inject.cjs. acorn stays inside the bundle
// so a VSIX-only install needs no npm install and no external Node binary.
await esbuild.build({
  entryPoints: ['src/restart-inject.js'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node18',
  outfile: 'dist/restart-inject.cjs',
  minify: false,
  logLevel: 'silent',
});

mkdirSync('vsix', { recursive: true });
copyFileSync(join(__dirname, 'dist', 'cli.cjs'), join(__dirname, 'vsix', 'cli.cjs'));
copyFileSync(join(__dirname, 'dist', 'restart-inject.cjs'), join(__dirname, 'vsix', 'restart-inject.cjs'));
mkdirSync('dist', { recursive: true });
for (const asset of ['models-catalog.json']) {
  const src = join(__dirname, 'assets', asset);
  const dest = join(__dirname, 'dist', asset);
  copyFileSync(src, dest);
  console.log('[build] copied asset → dist/%s (%s KB)', asset, (readFileSync(dest).length / 1024).toFixed(1));
}

console.log('[build] dist/cli.cjs + dist/restart-inject.cjs (%s KB)', (readFileSync(join(__dirname, 'dist', 'restart-inject.cjs')).length / 1024).toFixed(1));
console.log('[build] done');
