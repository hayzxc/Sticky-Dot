import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const isWatch = process.argv.includes('--watch');
const distDir = path.resolve('dist');
const iconsDistDir = path.join(distDir, 'icons');
const iconsSrcDir = path.resolve('src/icons');

function copyStaticFiles() {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // Copy manifest.json
  fs.copyFileSync(path.resolve('manifest.json'), path.join(distDir, 'manifest.json'));

  // Copy icons
  if (!fs.existsSync(iconsDistDir)) {
    fs.mkdirSync(iconsDistDir, { recursive: true });
  }

  if (fs.existsSync(iconsSrcDir)) {
    const iconFiles = fs.readdirSync(iconsSrcDir);
    for (const file of iconFiles) {
      fs.copyFileSync(path.join(iconsSrcDir, file), path.join(iconsDistDir, file));
    }
  }

  console.log('[build] Static assets copied to dist/');
}

const buildOptions = {
  entryPoints: ['src/content/main.ts'],
  outfile: 'dist/content.js',
  bundle: true,
  format: 'iife',
  target: ['es2022'],
  sourcemap: false,
  minify: false,
  logLevel: 'info',
};

async function run() {
  copyStaticFiles();

  if (isWatch) {
    const ctx = await esbuild.context({
      ...buildOptions,
      plugins: [
        {
          name: 'copy-static-plugin',
          setup(build) {
            build.onEnd(() => {
              copyStaticFiles();
              console.log('[watch] Rebuilt and copied static files.');
            });
          },
        },
      ],
    });
    await ctx.watch();
    console.log('[watch] Watching for changes...');
  } else {
    await esbuild.build(buildOptions);
    console.log('[build] Build complete.');
  }
}

run().catch((err) => {
  console.error('[build] Failed:', err);
  process.exit(1);
});
