import { build } from 'esbuild';
import { cp, mkdir, rm, readFile, writeFile, stat } from 'node:fs/promises';

const OUT = 'dist';

await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const res = await build({
  entryPoints: ['src/main.jsx'],
  bundle: true,
  outfile: `${OUT}/bundle.js`,
  loader: { '.js': 'jsx', '.jsx': 'jsx', '.css': 'css' },
  jsx: 'automatic',
  minify: true,
  sourcemap: false,
  target: ['es2020'],
  legalComments: 'none',
  define: {
    'process.env.NODE_ENV': '"production"',
    global: 'globalThis',
  },
  logLevel: 'info',
  metafile: true,
});

await cp('public/index.html', `${OUT}/index.html`);

const bundle = await stat(`${OUT}/bundle.js`);
console.log(`\nbuilt dist/bundle.js  ${(bundle.size / 1024).toFixed(1)} kB (minified, no external deps at runtime)`);
const css = await stat(`${OUT}/bundle.css`).catch(() => null);
if (css) console.log(`built dist/bundle.css  ${(css.size / 1024).toFixed(1)} kB`);
