import { build } from 'esbuild';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const requireShim = `
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
globalThis.require = require;
`.trim();

const currentDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(currentDir, '..');
const distDir = resolve(projectRoot, 'dist');
const outfile = resolve(distDir, 'cli.js');
const relativeOutfile = relative(projectRoot, outfile);

async function readPackageVersion() {
  const pkgRaw = await readFile(resolve(projectRoot, 'package.json'), 'utf8');
  const pkg = JSON.parse(pkgRaw);
  return pkg.version;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

async function buildApp() {
  try {
    await mkdir(distDir, { recursive: true });
    const version = await readPackageVersion();

    const result = await build({
      absWorkingDir: projectRoot,
      entryPoints: [resolve(projectRoot, 'src/utils/cli.js')],
      bundle: true,
      platform: 'node',
      target: ['node18'],
      format: 'esm',
      outfile,
      banner: { js: requireShim },
      logLevel: 'silent',
      logOverride: {
        'assign-to-define': 'silent',
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
        'process.env.VERSION': JSON.stringify(version),
      },
      treeShaking: true,
      legalComments: 'none',
      sourcemap: false,
      minify: true,
      metafile: true,
      packages: 'external',
    });

    const outputInfo = result.metafile?.outputs?.[relativeOutfile];
    const size = outputInfo ? formatBytes(outputInfo.bytes) : null;

    const warningCount = result.warnings.length;
    if (warningCount) {
      console.warn(`Build completed with ${warningCount} warning${warningCount === 1 ? '' : 's'}.`);
      for (const warning of result.warnings) {
        console.warn(`${warning.text}${warning.location ? ` (${warning.location.file}:${warning.location.line})` : ''}`);
      }
    } else {
      console.log(`Built ${relativeOutfile}${size ? ` (${size})` : ''}`);
    }
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

buildApp();
