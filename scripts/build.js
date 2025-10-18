#!/usr/bin/env bun

import { readFileSync } from 'node:fs';

async function buildApp() {
  try {
    // Read version from package.json
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
    const version = pkg.version;

    const result = await Bun.build({
      entrypoints: ['src/utils/cli.js'],
      outdir: 'dist',
      naming: {
        entry: 'cli.[ext]'
      },
      target: 'node',
      format: 'esm',
      minify: true,
      define: {
        'process.env.NODE_ENV': '"production"',
        'process.env.VERSION': JSON.stringify(version) // Inject version from package.json
      },
      sourcemap: 'none'
    });

    if (!result.success) {
      for (const log of result.logs) {
        console.error(log);
      }
      throw new Error('Bun build reported errors');
    }

    const entryOutput = result.outputs.find(output => output.kind === 'entry-point');
    if (!entryOutput) {
      throw new Error('Unable to locate entry-point output from Bun build.');
    }

    const banner = `import { createRequire } from 'module';
const require = createRequire(import.meta.url);
globalThis.require = require;
`;
    const bundledCode = await entryOutput.text();
    let finalCode;
    if (bundledCode.startsWith('#!')) {
      const indexOfNewline = bundledCode.indexOf('\n');
      if (indexOfNewline === -1) {
        finalCode = `${bundledCode}\n${banner}`;
      } else {
        const shebang = bundledCode.slice(0, indexOfNewline + 1);
        const rest = bundledCode.slice(indexOfNewline + 1);
        finalCode = `${shebang}${banner}${rest}`;
      }
    } else {
      finalCode = `${banner}${bundledCode}`;
    }
    await Bun.write(entryOutput.path, finalCode);

    console.log('Build complete!', entryOutput.path);
  } catch (err) {
    console.error('Build failed:', err);
    process.exit(1);
  }
}

buildApp();
